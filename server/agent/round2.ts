import {createHash, randomUUID} from 'node:crypto';
import {readFile, writeFile, mkdir, rename, lstat} from 'node:fs/promises';
import {join, basename, dirname} from 'node:path';
import {
  DemoManifestSchema, ProjectInputSchema, ProjectSnapshotSchema, SetupAnswerSchema, PhotoPairSchema, SourceSchema,
  type DemoManifest, type InputFile, type ProjectSnapshot, type Proposal, type DataModules,
} from '../../packages/contracts';
import {parseFamilyPacket, parseFamilyNotesPacket} from '../ingestion/index.mjs';
import {AppError, validateSnapshot, validateSpans} from '../state/validation';
import {createSavedProject, loadProject, updateProject, saveAsset, readAsset, readSealedProject, dataRoot} from '../state/store';
import {event} from '../events';
import {analyzeSource, generatePassage} from './astra';
import {dataModules} from './data-modules';
import {readGeneratedZip} from './bundle';
import {readSavedSourceJob} from '../research/staged-sources.mjs';

const hash = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const at = (ms = Date.now()) => new Date(ms).toISOString();
const pendingModels = new Map<string, Promise<ProjectSnapshot>>();
const pendingBooks = new Map<string, Promise<ProjectSnapshot>>();
const pendingDownloads = new Map<string, Promise<Awaited<ReturnType<DataModules['buildFamilyBundle']>>>>();
const pendingSourceJobs = new Map<string,Promise<ProjectSnapshot>>();
interface Stage { graph: ProjectSnapshot; manifest: DemoManifest; packetRoot?: string; }
interface RoundOptions {
  manifest?: DemoManifest;
  parse?: typeof parseFamilyPacket;
  analyze?: typeof analyzeSource;
  passage?: typeof generatePassage;
  modules?: DataModules;
  nowMs?: number;
}
const stagePath = (id: string) => join(dataRoot(), id, 'staging.json');
const cachePath = (id: string) => join(dataRoot(), id, 'prepared.zip');
async function readStage(id: string): Promise<Stage> {
  const raw = JSON.parse(await readFile(stagePath(id), 'utf8'));
  return {graph: validateSnapshot(raw.graph), manifest: DemoManifestSchema.parse(raw.manifest), packetRoot:raw.packetRoot};
}
function assertEnglish(value: unknown) {
  if (/[\u0400-\u04ff]/u.test(JSON.stringify(value)))
    throw new AppError('This English packet contains non-English source text or filenames. Keep original-language audit material outside the upload selection.', 400, 'ENGLISH_PACKET_REQUIRED');
}
function contentKey(s: ProjectSnapshot) {
  return hash(JSON.stringify({people:s.people, relationships:s.relationships, claims:s.claims, stories:s.stories,
    answers:s.run?.answers, packet:s.run?.packetHash, language:s.run?.language,
    assets:s.assets.map(a => ({id:a.id,hash:a.contentHash})), photos:s.photoAnnotations, pairs:s.photoPairs}));
}
export function isRound2Input(files: InputFile[]) {
  return !files.some(f=>f.originalName==='project.json') && files.some(f => ['family_register.csv','family notes.txt'].includes(f.originalName.toLowerCase()));
}
async function manifestFor(files: InputFile[], supplied?: DemoManifest) {
  let manifest = supplied;
  if (!manifest) {
    const path = process.env.ROOTS_DEMO_MANIFEST || join(dataRoot(), 'demo-artefacts', 'DEMO_MANIFEST.json');
    try { manifest = DemoManifestSchema.parse(JSON.parse(await readFile(path, 'utf8'))); }
    catch { throw new AppError('The source packet manifest is not configured or validated yet. Your selected files have been retained; finish packet preparation and retry.', 409, 'PACKET_NOT_READY'); }
  }
  manifest = DemoManifestSchema.parse(manifest);
  const expected = manifest.files.filter(f => f.path.startsWith('01-upload/') || !f.path.includes('/'));
  if (expected.length !== files.length) throw new AppError('Select the complete frozen upload folder, without presenter or audit files.', 400, 'PACKET_MISMATCH');
  for (const file of expected) {
    const picked = files.find(f => f.originalName === basename(file.path));
    if (!picked || picked.bytes.length !== file.bytes || hash(picked.bytes) !== file.sha256)
      throw new AppError(`${basename(file.path)} does not match the frozen input packet. Restore that file or freeze a new packet version.`, 400, 'PACKET_MISMATCH');
  }
  return manifest;
}
function validatePairs(s: ProjectSnapshot) {
  for (const pair of s.photoPairs || []) {
    PhotoPairSchema.parse(pair);
    const original = s.assets.find(a => a.id === pair.originalAssetId);
    const enhanced = s.assets.find(a => a.id === pair.enhancedAssetId);
    if (!original || !enhanced || original.id === enhanced.id || original.contentHash !== pair.originalHash || enhanced.contentHash !== pair.enhancedHash || !original.mediaType.startsWith('image/') || !enhanced.mediaType.startsWith('image/'))
      throw new AppError('A photo pair does not match its original and derivative assets.');
    for (const id of pair.personIds) {
      if (!s.people.some(p => p.id === id) || !(s.photoAnnotations || []).some(a => a.assetId === original.id && (a.positions.some(p => p.personId === id)||a.depictedPersonIds?.includes(id))))
        throw new AppError('Photo comparison person references need supplied original annotations.');
    }
  }
}
export async function startRound2(raw: unknown, files: InputFile[], options: RoundOptions = {}) {
  const started = options.nowMs ?? Date.now();
  const input = ProjectInputSchema.parse(raw);
  const manifest = await manifestFor(files, options.manifest);
  const manifestPath=process.env.ROOTS_DEMO_MANIFEST || join(dataRoot(),'demo-artefacts','DEMO_MANIFEST.json');
  const packetHash=hash(JSON.stringify(manifest));
  const packetRoot=options.manifest?undefined:dirname(manifestPath);
  const parse = options.parse || (manifest.inputFormat === 'family_notes' ? parseFamilyNotesPacket : parseFamilyPacket);
  const parsed: any = await parse({files,identityKeys:manifest.identityKeys} as any);
  if (parsed.files.some((f: any) => f.status === 'failed')) throw new AppError('One or more packet files failed parsing. Inspect the selected file format and retry.');
  const id = randomUUID();
  const full = ProjectSnapshotSchema.parse({schemaVersion:'roots-v1',projectId:id,version:1,input,
    people:parsed.people,relationships:parsed.relationships,claims:parsed.claims,stories:parsed.stories,
    sources:parsed.sources,assets:parsed.assets,proposals:[],researchEvents:[],history:[],bookPassages:[],bookStatus:'empty',
    layout:parsed.layout||{},files:parsed.files,issues:parsed.issues||[],photoAnnotations:manifest.photos,photoPairs:manifest.photoPairs});
  for(const file of manifest.files) for(const sourceId of file.sourceIds) {
    const source=full.sources.find(s=>s.id===sourceId);if(!source)continue;
    source.evidenceRootIds=[...new Set([...(source.evidenceRootIds||[]),...file.evidenceRootIds])];
    if(file.lineage.length)source.lineage=file.lineage;
  }
  assertEnglish(full);
  validateSnapshot(full);
  for (const annotation of manifest.photos) {
    validateSpans(annotation.support, full);
    const asset = full.assets.find(asset => asset.id === annotation.assetId);
    const fromUpload = parsed.photoAnnotations?.find((photo: any) => photo.assetId === annotation.assetId);
    const positions = (photo: any) => [...(photo.positions || [])].map(({position,personId,label,status}: any) => ({position,personId,label,status})).sort((a,b) => a.position-b.position);
    const identities = (photo: any) => [...(photo.depictedPersonIds || [])].sort();
    if (!asset || !asset.mediaType.startsWith('image/') || asset.originalName !== basename(annotation.file) || !fromUpload ||
        JSON.stringify(positions(annotation)) !== JSON.stringify(positions(fromUpload)) || JSON.stringify(identities(annotation)) !== JSON.stringify(identities(fromUpload)))
      throw new AppError('A photo annotation differs from its uploaded caption. Keep identities and order grounded in the selected photo notes.',400,'PHOTO_ANNOTATION_MISMATCH');
    if ([...annotation.positions.map(position=>position.personId),...(annotation.depictedPersonIds||[])].some(id=>id&&!full.people.some(person=>person.id===id)))
      throw new AppError('A photo annotation names a person absent from the uploaded notes.');
  }
  validatePairs(full);
  if (full.people.length !== manifest.selectedPersonIds.length || full.people.some(p => !manifest.selectedPersonIds.includes(p.id)) || full.relationships.length !== manifest.expectedRelationshipCount)
    throw new AppError('Parsed roster or relationship coverage differs from the frozen manifest.', 409, 'COVERAGE_MISMATCH');
  for (const question of manifest.questions) {
    validateSpans(question.support, full);
    if (question.personIds.some(id => !manifest.selectedPersonIds.includes(id))) throw new AppError('Question references an unavailable person.');
    if (question.requiresAstra && question.category !== 'recollection') throw new AppError('The held-out interpretation must use the recollection question.');
  }
  if (!manifest.questions.some(q => q.category === 'recollection' && q.requiresAstra)) throw new AppError('The recollection question must require a real Astra interpretation.');
  // No selected records or expected answers are silently imported as accepted stories.
  if (full.stories.length) throw new AppError('The starting packet must leave its recollections unaccepted.');
  for (const bytes of parsed.assetBytes) await saveAsset(id, bytes.assetId, bytes.bytes);
  await mkdir(join(dataRoot(), id), {recursive:true,mode:0o700});
  await writeFile(stagePath(id), JSON.stringify({graph:full,manifest,packetRoot}), {mode:0o600});
  const s = ProjectSnapshotSchema.parse({...full,people:[],relationships:[],claims:[],stories:[],photoAnnotations:[],photoPairs:[],
    run:{runId:id,startedAt:at(started),phase:'questions',nextSequence:1,packetVersion:manifest.packetVersion,packetHash,language:'en',sourceJobs:manifest.sourceJobs.map(j=>({...j,status:'pending'})),
      questions:manifest.questions.map(q => ({...q,recommendation:q.requiresAstra?'':q.recommendation,status:q.requiresAstra?'waiting':'ready',origin:'prepared'})),answers:[],
      batches:manifest.batches.map(b => ({...b,status:'pending'})),initialBranchIds:manifest.initialBranchIds,targetPeople:full.people.length,modelStatus:'pending',book:{status:'empty'}}});
  for (const file of s.files) event(s,{eventId:`parse-${file.uploadId}`,runId:id,operation:'parse_file',origin:'live',state:file.status==='parsed'?'completed':'blocked',sourceId:file.sourceIds[0],assetId:file.assetIds[0],finding:`${file.originalName}: ${file.status}`});
  event(s,{runId:id,operation:'normalize_entity',origin:'prepared',state:'completed',finding:`Read ${full.people.length} supplied family records into a review queue. They are not new archive discoveries.`});
  return createSavedProject(s);
}

async function analyzeHeldOut(id: string, options: RoundOptions) {
  const stage = await readStage(id);
  let started = false;
  const current = await updateProject(id, s => {
    if (!s.run || s.run.sealedAt || s.run.phase==='cancelled' || s.run.modelStatus==='completed') return false;
    if (s.run.modelStatus==='running') {
      const latest = s.researchEvents.filter(e=>e.operation==='analyze_record'&&e.state==='running').at(-1);
      if (latest && Date.now()-Date.parse(latest.at)<100000) return false;
    }
    started = true;
    s.run.modelStatus='running';
    const q=s.run.questions.find(q=>q.requiresAstra)!;
    q.status='waiting';
    event(s,{runId:s.run.runId,operation:'analyze_record',origin:'live',state:'running',sourceId:q.support[0].sourceId,finding:'Astra is checking the uploaded recollection against its source.'});
  });
  if (!started) return current;
  const q = stage.manifest.questions.find(q=>q.requiresAstra)!;
  const source = stage.graph.sources.find(s=>s.id===q.support[0].sourceId)!;
  const excerpt = [...new Set(q.support.filter(span=>span.sourceId===source.id).map(span=>span.quote))].join('\n\n');
  const analysisSource = {...source,originalText:excerpt,contentHash:hash(excerpt)};
  try {
    // Only actual uploaded evidence and parsed roster enter Astra. Manifest answers,
    // presenter notes and overview text are excluded from this held-out request.
    const proposal = await (options.analyze || analyzeSource)({...stage.graph,claims:[],stories:[]},analysisSource,[],undefined,q.support.filter(span=>span.sourceId===source.id));
    proposal.evidenceType = 'family_recollection';
    validateSpans(proposal.spans,stage.graph);
    assertEnglish(proposal);
    return updateProject(id,s=>{
      if (!s.run || s.run.sealedAt || s.run.phase==='cancelled') return false;
      const currentQuestion=s.run.questions.find(x=>x.id===q.id)!;
      if (s.run.answers.some(a=>a.questionId===q.id)) { s.run.modelStatus='completed'; return; }
      s.run.analysis={...proposal,origin:'live'};
      s.run.modelStatus='completed';
      currentQuestion.prompt=proposal.question;
      currentQuestion.recommendation=[proposal.text,proposal.uncertainty ? `Uncertainty: ${proposal.uncertainty}` : ''].filter(Boolean).join('\n\n');
      currentQuestion.support=proposal.spans;
      currentQuestion.personIds=proposal.personId?[proposal.personId]:proposal.candidatePersonIds;
      currentQuestion.proposalId=proposal.id;
      currentQuestion.status='ready'; currentQuestion.origin='live';
      event(s,{runId:s.run.runId,operation:'analyze_record',origin:'live',state:'completed',sourceId:source.id,finding:'Astra returned a source-checked recollection for your review.'});
    });
  } catch(e) {
    const latest=await loadProject(id);
    if (latest.run?.sealedAt || latest.run?.phase==='cancelled') return latest;
    return updateProject(id,s=>{
      s.run!.modelStatus='failed';
      s.run!.questions.find(x=>x.id===q.id)!.status='failed';
      s.run!.error=e instanceof AppError?e.message:'Astra analysis failed. The original evidence remains saved.';
      event(s,{runId:id,operation:'analyze_record',origin:'live',state:'failed',sourceId:source.id,error:s.run!.error});
    });
  }
}
function appendUnique<T extends {id:string}>(to:T[], additions:T[]) { for(const row of additions) if(!to.some(x=>x.id===row.id)) to.push(structuredClone(row)); }
function applySavedAnswer(s: ProjectSnapshot, stage: Stage, questionId: string) {
  const run=s.run!; const q=run.questions.find(q=>q.id===questionId)!; const answer=run.answers.find(a=>a.questionId===questionId)!;
  if (!answer || !q.personIds.every(id=>s.people.some(p=>p.id===id))) return;
  if (run.appliedAnswerIds.includes(answer.requestId)) return;
  run.appliedAnswerIds.push(answer.requestId);
  const claimId=q.requiresAstra&&run.analysis?`claim-${run.analysis.id}`:`setup-claim-${q.id}`, storyId=q.requiresAstra&&run.analysis?`story-${run.analysis.id}`:`setup-story-${q.id}`;
  s.claims=s.claims.filter(c=>c.id!==claimId); s.stories=s.stories.filter(st=>st.id!==storyId);
  for(const r of s.relationships)r.claimIds=r.claimIds.filter(id=>id!==claimId);
  for(const p of s.people) {p.claimIds=p.claimIds.filter(id=>id!==claimId);p.storyIds=p.storyIds.filter(id=>id!==storyId);}
  if(q.effect.kind==='annotation') {
    for (const a of stage.manifest.photos) {
      if(q.effect.photoAssetId && a.assetId!==q.effect.photoAssetId) continue;
      const saved=structuredClone(a);
      for(const pos of saved.positions) {
        if (answer.action==='unknown' || answer.action==='correct') {pos.status='unresolved'; if(answer.action==='correct') pos.label=answer.savedText;}
        else if(pos.personId) pos.status='confirmed';
      }
      s.photoAnnotations=(s.photoAnnotations||[]).filter(x=>x.assetId!==saved.assetId);
      s.photoAnnotations.push(saved);
      for(const p of s.people) p.photoIds=p.photoIds.filter(id=>id!==a.assetId);
      for(const pos of saved.positions) if(pos.personId && pos.status==='confirmed') {
        const p=s.people.find(p=>p.id===pos.personId); if(p && !p.photoIds.includes(a.assetId)) p.photoIds.push(a.assetId);
      }
    }
    return;
  }
  if(q.effect.kind==='editorial' || q.effect.kind==='relationship') {
    if(q.effect.relationshipId) {
      const rel=s.relationships.find(r=>r.id===q.effect.relationshipId);
      if(rel) {
        if(answer.action==='unknown') rel.status='unresolved';
        if(answer.action==='confirm')rel.status=stage.graph.relationships.find(r=>r.id===rel.id)?.status||'unresolved';
        if(answer.action==='correct') {
          rel.status='disputed';
          const sourceId=`setup-correction-${answer.requestId}`,locator=`Human correction ${sourceId}`;
          if(!s.sources.some(x=>x.id===sourceId))s.sources.push({id:sourceId,kind:'human_edit',originalLocator:locator,originalText:answer.savedText,contentHash:hash(answer.savedText),origin:'live',author:'Local user',messageTimestamp:answer.savedAt,parentAttachmentId:null,language:'en'});
          s.claims.push({id:claimId,subjectId:rel.fromPersonId,predicate:'relationship_correction',value:answer.savedText,sourceIds:[sourceId],spans:[{sourceId,locator,quote:answer.savedText}],status:'accepted',evidenceType:'user_correction',version:1});
          if(!rel.claimIds.includes(claimId))rel.claimIds.push(claimId);
        }
      }
    }
    return;
  }
  const personId=q.requiresAstra?run.analysis?.personId:q.effect.personId||q.personIds[0];
  if(!personId || !s.people.some(p=>p.id===personId)) return;
  if(answer.action==='unknown') return;
  if(q.requiresAstra && !run.analysis) throw new AppError('A live interpretation is required before saving this story.');
  const spans=structuredClone(q.support), sourceIds=[...new Set(spans.map(x=>x.sourceId))];
  if(answer.action==='correct') {
    const sourceId=`setup-correction-${answer.requestId}`;const text=answer.savedText;
    if(!s.sources.some(x=>x.id===sourceId)) s.sources.push({id:sourceId,kind:'human_edit',originalLocator:`Human correction ${sourceId}`,contentHash:hash(text),originalText:text,origin:'live',author:'Local user',messageTimestamp:answer.savedAt,parentAttachmentId:null,language:'en'});
    sourceIds.push(sourceId);spans.push({sourceId,locator:`Human correction ${sourceId}`,quote:text});
  }
  const isMemory=q.effect.kind==='story'||q.support.some(span=>{const source=s.sources.find(x=>x.id===span.sourceId);return source?.kind.includes('chat')||/recollections/i.test(source?.title||'');});
  const evidenceType=isMemory?'family_recollection' as const:'family_document' as const;
  s.claims.push({id:claimId,subjectId:personId,predicate:q.effect.predicate||q.category,value:answer.savedText,sourceIds,spans,status:'accepted',evidenceType,version:1});
  s.people.find(p=>p.id===personId)!.claimIds.push(claimId);
  if(q.effect.kind==='story') {
    const original=s.sources.find(source=>source.id===q.support[0].sourceId);
    s.stories.push({id:storyId,personId,text:answer.savedText,sourceIds,claimIds:[claimId],spans,evidenceType,status:'accepted',attribution:original?.author||'Family contributor'});
    s.people.find(p=>p.id===personId)!.storyIds.push(storyId);
    if(run.analysis && !s.proposals.some(p=>p.id===run.analysis!.id)) s.proposals.push({...run.analysis,status:answer.action==='correct'?'corrected':'accepted'});
  }
}
function releaseGraph(s: ProjectSnapshot, stage: Stage, ids: string[]) {
  const full=stage.graph;
  const all=new Set([...s.people.map(p=>p.id),...ids]);
  const rels=full.relationships.filter(r=>all.has(r.fromPersonId)&&all.has(r.toPersonId));
  const relationshipClaims=new Set(full.relationships.flatMap(r=>r.claimIds));
  const eligibleRelationshipClaims=new Set(rels.flatMap(r=>r.claimIds));
  const claims=full.claims.filter(c=>all.has(c.subjectId)&&(!relationshipClaims.has(c.id)||eligibleRelationshipClaims.has(c.id)));
  appendUnique(s.claims,claims);
  for(const person of full.people.filter(p=>ids.includes(p.id))) {
    if(s.people.some(p=>p.id===person.id)) continue;
    s.people.push({...structuredClone(person),claimIds:person.claimIds.filter(id=>s.claims.some(c=>c.id===id)),storyIds:[],photoIds:[]});
  }
  appendUnique(s.relationships,rels);
  for(const a of stage.manifest.photos) {
    if(!(a.positions||[]).some(pos=>pos.personId&&all.has(pos.personId)))continue;
    if(!(s.photoAnnotations||[]).some(x=>x.assetId===a.assetId)) (s.photoAnnotations ||= []).push(structuredClone(a));
    // A supplied confirmed photo annotation retains its attribution. Unreviewed
    // filename hints stay proposals and never identify faces automatically.
    const currentAnnotation=s.photoAnnotations!.find(x=>x.assetId===a.assetId)!;
    for(const pos of currentAnnotation.positions) if(pos.personId&&pos.status==='confirmed') {
      const p=s.people.find(p=>p.id===pos.personId);if(p&&!p.photoIds.includes(a.assetId))p.photoIds.push(a.assetId);
    }
  }
  for(const pair of stage.manifest.photoPairs) if(pair.personIds.every(id=>all.has(id))) {
    if(!(s.photoPairs||[]).some(p=>p.id===pair.id))(s.photoPairs||=[]).push(structuredClone(pair));
    const photoQuestion=s.run!.questions.find(q=>q.effect.photoAssetId===pair.originalAssetId);
    const photoAnswer=s.run!.answers.find(a=>a.questionId===photoQuestion?.id);
    if(!photoAnswer||photoAnswer.action==='confirm')for(const id of pair.personIds){const p=s.people.find(p=>p.id===id);if(p&&!p.photoIds.includes(pair.originalAssetId))p.photoIds.push(pair.originalAssetId);}
  }
  for(const answer of s.run!.answers) applySavedAnswer(s,stage,answer.questionId);
}
export async function answerSetupQuestion(id:string, raw:unknown) {
  const input=SetupAnswerSchema.parse(raw);const stage=await readStage(id);
  if(input.action==='correct'&&!input.text?.trim()) throw new AppError('Enter your correction before saving.');
  assertEnglish(input.text||'');
  return updateProject(id,s=>{
    const run=s.run!;const q=run.questions.find(q=>q.id===input.questionId);
    if(!q)throw new AppError('Question not found.',404);
    if(run.phase==='cancelled')throw new AppError('This run was cancelled.',409);
    if(input.action!=='unknown'&&q.status==='waiting')throw new AppError('Wait for the source interpretation or choose I do not know.',409);
    if(input.action!=='unknown'&&q.requiresAstra&&run.modelStatus!=='completed')throw new AppError('A live source interpretation is not available. Retry analysis or keep this answer unresolved.',409);
    if(input.action==='confirm'&&q.requiresAstra&&(!run.analysis?.personId||run.analysis.candidatePersonIds.length!==1))throw new AppError('The recollection has unresolved identity candidates. Keep it unresolved.',409);
    const previous=run.answers.find(a=>a.questionId===q.id);
    const answer={...input,savedAt:at(),originalRecommendation:q.recommendation,savedText:input.action==='unknown'?'Unresolved':input.action==='correct'?input.text!:q.recommendation,sourceIds:[...new Set(q.support.map(s=>s.sourceId))]};
    run.answers=run.answers.filter(a=>a.questionId!==q.id);run.answers.push(answer);q.status='answered';
    s.history.push({eventId:input.requestId,at:answer.savedAt,actor:'local-user',action:`setup:${input.action}`,before:previous||null,after:answer,sourceIds:answer.sourceIds,claimIds:[],projectVersion:s.version+1});
    if(run.initialSavedAt)applySavedAnswer(s,stage,q.id);
    event(s,{runId:run.runId,operation:'apply_review',origin:'live',state:'completed',finding:input.action==='unknown'?'Saved an explicitly unresolved answer.':`Saved your ${q.category} answer.`});
  },{baseVersion:input.baseVersion,invalidateBook:true,isReplay:s=>s.history.some(h=>h.eventId===input.requestId)});
}
async function releaseEligible(id:string, options:RoundOptions={}) {
  const stage=await readStage(id), now=options.nowMs??Date.now();
  return updateProject(id,s=>{
    const run=s.run;
    if(!run||run.sealedAt||run.phase==='cancelled'||run.answers.length!==7)return false;
    if(!run.initialSavedAt) {
      if(now<Date.parse(run.startedAt)+stage.manifest.initialReleaseOffsetSeconds*1000)return false;
      releaseGraph(s,stage,run.initialBranchIds);run.initialSavedAt=at(now);run.phase='growing';
      event(s,{eventId:'release-initial',runId:id,operation:'normalize_entity',origin:'prepared',state:'completed',finding:`Added the initial ${s.people.length}-person branch from your supplied records.`});
      return;
    }
    const next=run.batches.find(b=>b.status==='pending');
    if(!next)return false;
    const previous=run.batches.filter(b=>b.status==='saved').at(-1)?.savedAt||run.initialSavedAt;
    const due=Math.max(Date.parse(run.startedAt)+next.releaseOffsetSeconds*1000,Date.parse(previous)+9000);
    if(now<due||next.dependencyIds.some(dep=>dep!=='initial'&&!run.batches.some(b=>b.id===dep&&b.status==='saved')))return false;
    releaseGraph(s,stage,next.personIds);next.status='saved';next.savedAt=at(now);
    run.phase=run.batches.every(b=>b.status==='saved')?'review':'growing';
    event(s,{eventId:`release-${next.id}`,runId:id,operation:'normalize_entity',origin:'prepared',state:'completed',finding:`Added ${next.personIds.length} supplied family records. ${s.people.length} people are now in your map.`});
  },{invalidateBook:true});
}
export async function pumpRound2(id:string,options:RoundOptions={}) {
  let s=await loadProject(id);if(!s.run||s.run.sealedAt||s.run.phase==='cancelled')return s;
  if(s.run.modelStatus==='pending'||s.run.modelStatus==='running') {
    if(!pendingModels.has(id)) {
      const task=analyzeHeldOut(id,options);pendingModels.set(id,task);
      try{await task;}finally{pendingModels.delete(id);}
    }
  }
  s=await releaseEligible(id,options);
  if(!pendingSourceJobs.has(id)) {
    const task=releaseSourceJob(id,options);pendingSourceJobs.set(id,task);
    try{s=await task;}finally{pendingSourceJobs.delete(id);}
  }
  if(s.run?.phase==='review'&&s.run.book.status==='empty')return prepareRound2Book(id,options);
  return s;
}
async function releaseSourceJob(id:string,options:RoundOptions={}) {
  const s=await loadProject(id),run=s.run;
  if(!run||run.sealedAt||run.phase==='cancelled')return s;
  const now=options.nowMs??Date.now();
  const job=run.sourceJobs.find(j=>j.status==='pending'&&now>=Date.parse(run.startedAt)+j.releaseOffsetSeconds*1000);
  if(!job)return s;
  const stage=await readStage(id);
  try {
    if(!stage.packetRoot)throw new AppError('Saved source directory is unavailable for this packet.');
    const roots=s.sources.flatMap(source=>(source.evidenceRootIds||[]).map(root=>({...source,evidenceRootId:root})));
    const outcome=await readSavedSourceJob({job,existingSources:[...s.sources,...roots],readFile:async(path:string)=>{
      const file=stage.manifest.files.find(f=>f.path===path);if(!file)throw new AppError('Saved source is absent from the frozen inventory.');
      const fullPath=join(stage.packetRoot!,path);const stat=await lstat(fullPath);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2_000_000)throw new AppError('Saved source is not a bounded regular text file.');
      const bytes=await readFile(fullPath);if(hash(bytes)!==file.sha256||bytes.length!==file.bytes)throw new AppError('Saved source changed after packet freeze.');return bytes;
    }} as any);
    const additions: {source:ProjectSnapshot['sources'][number];asset:ProjectSnapshot['assets'][number]}[]=[];
    for(const source of outcome.sources) {
      const sourceId=source.id,assetId=`original-${sourceId}`,bytes=Buffer.from(source.originalText);
      await saveAsset(id,assetId,bytes);additions.push({source:SourceSchema.parse(source),asset:{id:assetId,sourceId,originalName:source.title,mediaType:'text/plain',byteLength:bytes.length,contentHash:hash(bytes),storageKey:`assets/${assetId}`}});
    }
    return updateProject(id,p=>{
      const current=p.run!.sourceJobs.find(j=>j.id===job.id)!;if(current.status!=='pending')return false;
      for(const {source,asset}of additions){const existing=p.sources.find(s=>s.contentHash===source.contentHash);if(!existing){p.sources.push(source);p.assets.push(asset);}event(p,{eventId:`saved-source-${source.id}`,runId:id,operation:'parse_file',origin:'prepared',state:'completed',sourceId:existing?.id||source.id,assetId:existing?undefined:asset.id,finding:'Read a saved copy of supplied family evidence. Its evidence root is unchanged.'});}
      current.status='completed';current.completedAt=at(now);
    },{invalidateBook:true});
  }catch(error){const latest=await loadProject(id);if(latest.run?.sealedAt||latest.run?.phase==='cancelled')return latest;return updateProject(id,p=>{const current=p.run!.sourceJobs.find(j=>j.id===job.id)!;current.status='failed';current.error=error instanceof AppError?error.message:'Saved-source read failed. Initial supplied evidence remains available.';event(p,{runId:id,operation:'parse_file',origin:'prepared',state:'failed',error:current.error});});}
}
async function prepareBook(id:string,options:RoundOptions={}) {
  let s=await loadProject(id);if(!s.run)throw new AppError('No active file run.');
  if(s.run.phase==='cancelled')throw new AppError('This run was cancelled.',409,'RUN_CANCELLED');
  if(s.run.sealedAt) return s;
  const key=contentKey(s);
  if(s.run.book.status==='ready'&&s.run.book.key===key)return s;
  if(!s.people.length)throw new AppError('Answer the source checks before preparing a book.',409);
  if(s.run.batches.every(b=>b.status==='saved')) {
    const stage=await readStage(id);
    if(stage.manifest.selectedPersonIds.some(id=>!s.people.some(p=>p.id===id))||stage.graph.relationships.some(r=>!s.relationships.some(saved=>saved.id===r.id)))
      throw new AppError('A saved family batch is missing from the current project. Restore the missing records before preparing the complete book.',409,'COVERAGE_MISMATCH');
  }
  const modules=options.modules||dataModules;
  await updateProject(id,p=>{p.run!.book={status:'preparing',key};p.run!.phase='preparing_book';p.bookStatus='generating';event(p,{runId:id,operation:'generate_book',origin:'live',state:'running',finding:'Preparing the current cited English family book.'});});
  try {
    let passage;
    if(s.stories.some(st=>st.status==='accepted')) passage=await(options.passage||generatePassage)(s);
    else {
      const claim=s.claims.find(c=>c.status==='accepted');
      if(!claim)throw new AppError('No reviewed or supplied accepted record is available for the book.',409);
      passage={id:`passage-${randomUUID()}`,text:`Supplied family record: ${claim.value}`,claimIds:[claim.id],sourceIds:claim.sourceIds,sourceLocators:claim.spans,acceptedStateVersion:s.version,origin:'prepared' as const};
    }
    s=await updateProject(id,p=>{
      if(p.run!.phase==='cancelled')throw new AppError('This run was cancelled.',409,'RUN_CANCELLED');
      if(contentKey(p)!==key)throw new AppError('The family changed during book preparation. Prepare the current version again.',409,'STALE_GENERATION');
      p.bookPassages=[{...passage,acceptedStateVersion:p.version+1}];p.bookStatus='current';
    });
    const bundle=await modules.buildFamilyBundle({snapshot:s,passages:s.bookPassages,resolveAsset:assetId=>readAsset(id,assetId)});
    const entries=readGeneratedZip(bundle.bytes);
    for(const [name,bytes]of entries)if(/\.(json|txt|csv|md|html)$/i.test(name)){assertEnglish(name);assertEnglish(bytes.toString('utf8'));}
    const tmp=cachePath(id)+`.${randomUUID()}.tmp`;await writeFile(tmp,bundle.bytes,{mode:0o600});
    await rename(tmp,cachePath(id));
    return updateProject(id,p=>{
      if(p.run!.phase==='cancelled')throw new AppError('This run was cancelled.',409,'RUN_CANCELLED');
      if(contentKey(p)!==key)throw new AppError('The family changed before the bundle was ready.',409,'STALE_EXPORT');
      p.run!.book={status:'ready',key,preparedAt:at(),stateVersion:s.version};p.run!.phase='ready';
      event(p,{runId:id,operation:'generate_book',origin:passage.origin,state:'completed',finding:'The current illustrated book and editable project are ready.'});
    });
  }catch(error){
    const latest=await loadProject(id);if(!latest.run?.sealedAt&&latest.run?.phase!=='cancelled')await updateProject(id,p=>{if(p.run!.phase==='cancelled')return false;p.run!.book={status:'failed',error:error instanceof AppError?error.message:'Current book preparation failed; retry is available.'};p.run!.phase='review';p.bookStatus='failed';});
    throw error;
  }
}
export async function prepareRound2Book(id:string,options:RoundOptions={}) {
  const existing=pendingBooks.get(id);if(existing)return existing;
  const task=prepareBook(id,options);pendingBooks.set(id,task);
  try{return await task;}finally{pendingBooks.delete(id);}
}
async function sealDownload(id:string,options:RoundOptions={}) {
  let s=await loadProject(id);
  if(s.run?.phase==='cancelled')throw new AppError('This run was cancelled.',409);
  if(!s.run?.sealedAt) {
    if(s.run?.book.status!=='ready'||s.run.book.key!==contentKey(s))await prepareRound2Book(id,options);
    s=await updateProject(id,p=>{
      if(p.run!.book.status!=='ready'||p.run!.book.key!==contentKey(p))throw new AppError('The book changed. Prepare it again.',409,'STALE_EXPORT');
      p.run!.sealedAt=at();p.run!.sealedVersion=p.version+1;p.run!.phase='sealing';
      if(p.people.length<p.run!.targetPeople)p.issues.push(`This early download includes ${p.people.length} of ${p.run!.targetPeople} supplied people. Pending records were left open and are not claimed complete.`);
      for(const b of p.run!.batches)if(b.status==='pending')b.status='cancelled';
    },{writeSeal:true,isReplay:p=>!!p.run?.sealedAt});
  }
  s=await readSealedProject(id);
  const modules=options.modules||dataModules;
  try {
    // Repackage current portable metadata at the exact seal; model prose and PDF
    // preparation are reused only while the reviewed-content fingerprint matches.
    const bundle=await modules.buildFamilyBundle({snapshot:s,passages:s.bookPassages,resolveAsset:assetId=>readAsset(id,assetId)});
    await updateProject(id,p=>{p.run!.phase='completed';p.run!.completedAt=at();event(p,{eventId:'sealed-export-completed',runId:id,operation:'export_project',origin:'live',state:'completed',finding:'Created the sealed current family book and editable project.'});},{allowSealed:true});
    return {...bundle,filename:`Osmy-Roots-${id.slice(0,8)}.zip`};
  }catch(error){await updateProject(id,p=>{p.run!.error='Download failed. Retry will use the same sealed family version.';},{allowSealed:true});throw error;}
}
export async function downloadRound2(id:string,options:RoundOptions={}) {
  const existing=pendingDownloads.get(id);if(existing)return existing;
  const task=sealDownload(id,options);pendingDownloads.set(id,task);
  try{return await task;}finally{pendingDownloads.delete(id);}
}
export async function cancelRound2(id:string) {
  const s=await loadProject(id);if(!s.run||s.run.sealedAt||s.run.phase==='cancelled')return s;
  return updateProject(id,p=>{p.run!.phase='cancelled';for(const b of p.run!.batches)if(b.status==='pending')b.status='cancelled';},{isReplay:p=>p.run?.phase==='cancelled'});
}
export async function retryRound2Analysis(id:string) {
  return updateProject(id,s=>{
    if(!s.run||s.run.modelStatus!=='failed')return false;
    const q=s.run.questions.find(q=>q.requiresAstra)!;
    if(s.run.answers.some(a=>a.questionId===q.id))throw new AppError('This recollection already has a saved answer. Add a new clue to request another interpretation.',409);
    s.run.modelStatus='pending';q.status='waiting';delete s.run.error;
  });
}
export async function previewRound2Book(id:string,kind:'pdf'|'html'='pdf') {
  const s=await loadProject(id);if(!s.run||s.run.book.status!=='ready'||s.run.book.key!==contentKey(s))throw new AppError('The current book preview is not ready.',409);
  const entries=readGeneratedZip(await readFile(cachePath(id)));
  return entries.get(kind==='pdf'?'book.pdf':'book.html')!;
}
