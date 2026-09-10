import { createHash, randomUUID } from 'node:crypto';
import { ProjectInputSchema, ProjectSnapshotSchema, type DataModules, type InputFile, type ProjectSnapshot, type IngestionResult, type Source, type Proposal, type BookPassage } from '../../packages/contracts';
import { syntheticSnapshot } from '../../packages/contracts/fixtures';
import { loadProject, createSavedProject, updateProject, saveAsset, readAsset } from '../state/store';
import { AppError, validateSnapshot } from '../state/validation';
import { event } from '../events';
import { analyzeSource, generatePassage } from './astra';
import { dataModules } from './data-modules';
export interface AgentModules {analyze:typeof analyzeSource;passage:typeof generatePassage}
const liveAgent:AgentModules={analyze:analyzeSource,passage:generatePassage};
const now=()=>new Date().toISOString();
function fingerprint(s:ProjectSnapshot){return createHash('sha256').update(JSON.stringify({people:s.people,relationships:s.relationships,claims:s.claims,stories:s.stories})).digest('hex')}
function mergeIngestion(s:ProjectSnapshot,result:IngestionResult){
 const sourceMap=new Map<string,string>();const added:Source[]=[];
 for(const source of result.sources){const existing=s.sources.find(x=>x.contentHash===source.contentHash);if(existing)sourceMap.set(source.id,existing.id);else{sourceMap.set(source.id,source.id);s.sources.push(source);added.push(source)}}
 const assetMap=new Map<string,string>();
 for(const asset of result.assets){const existing=s.assets.find(x=>(asset.contentHash&&x.contentHash===asset.contentHash)||(x.id===asset.id));if(existing)assetMap.set(asset.id,existing.id);else{assetMap.set(asset.id,asset.id);s.assets.push({...asset,sourceId:sourceMap.get(asset.sourceId)||asset.sourceId,storageKey:`assets/${asset.id}`})}}
 for(const f of result.files){const outcome={...f,sourceIds:f.sourceIds.map(id=>sourceMap.get(id)||id),assetIds:f.assetIds.map(id=>assetMap.get(id)||id)};if(!s.files.some(x=>x.uploadId===f.uploadId))s.files.push(outcome);const sourceId=outcome.sourceIds[0],assetId=outcome.assetIds[0];if(!s.researchEvents.some(e=>e.operation==='parse_file'&&e.state==='completed'&&e.assetId===assetId&&assetId))event(s,{eventId:`parse-${f.uploadId}`,runId:f.uploadId,operation:'parse_file',origin:'live',state:f.status==='parsed'?'completed':f.status==='failed'?'failed':'blocked',sourceId,assetId,finding:`${f.originalName}: ${f.status}`,error:f.warnings.length?f.warnings.join(' '):undefined})}
 return {added,sourceMap,assetMap};
}
export async function createProject(raw:unknown,files:InputFile[]=[],modules:DataModules=dataModules){
 const input=ProjectInputSchema.parse(raw);if(!input.context.trim()&&!input.preparedPacket&&!files.length)throw new AppError('Add family context, files, or a prepared packet.');
 let seed:unknown;const json=files.find(f=>/\.json$/i.test(f.originalName));if(json){try{const obj=JSON.parse(new TextDecoder().decode(json.bytes));if(obj&&typeof obj==='object'&&('people' in obj||'persons' in obj))seed=obj}catch{/* The ingestion module reports invalid JSON. */}}
 const id=randomUUID();let s:ProjectSnapshot;
 if(seed&&ProjectSnapshotSchema.safeParse(seed).success){s=validateSnapshot(seed);s={...structuredClone(s),projectId:id,version:s.version+1,bookPassages:s.bookPassages.map(p=>({...p,acceptedStateVersion:s.version+1}))};s.issues.push('Reopened editable project. Supply original assets with matching filenames if they are not in this local store.');for(const a of s.assets)a.storageKey=`assets/${a.id}`;
 }else if(seed||input.preparedPacket){
 const result=await modules.importPreparedFamily({seedJson:seed||structuredClone(syntheticSnapshot),mediaFiles:files.filter(f=>f!==json)});
 s=ProjectSnapshotSchema.parse({schemaVersion:'roots-v1',projectId:id,version:1,input,people:result.people,relationships:result.relationships,claims:result.claims,stories:result.stories,sources:result.sources,assets:result.assets.map(a=>({...a,storageKey:`assets/${a.id}`})),proposals:[],researchEvents:[],history:result.history,bookPassages:[],bookStatus:'empty',layout:result.layout,issues:[...result.issues,...result.warnings,...(!seed?['Synthetic prepared family, not a real family discovery.']:[])],files:[]});for(const bytes of result.assetBytes)await saveAsset(id,bytes.assetId,bytes.bytes);
 }else{
 const sourceId=`source-${randomUUID()}`,personId=`person-${randomUUID()}`;const text=`Starting person supplied by local user: ${input.seedName}`;const claimId=`claim-${randomUUID()}`;
 s=ProjectSnapshotSchema.parse({schemaVersion:'roots-v1',projectId:id,version:1,input,people:[{id:personId,displayNameEn:input.seedName,originalName:input.seedName,lifeYears:{birth:{value:null,precision:'unknown'},death:{value:null,precision:'unknown'}},photoIds:[],claimIds:[claimId],storyIds:[]}],relationships:[],claims:[{id:claimId,subjectId:personId,predicate:'display_name',value:input.seedName,sourceIds:[sourceId],spans:[{sourceId,locator:'Starting context',quote:text}],status:'accepted',evidenceType:'user_correction',version:1}],stories:[],sources:[{id:sourceId,kind:'human_edit',originalLocator:'Starting context',contentHash:createHash('sha256').update(text).digest('hex'),originalText:text,origin:'live',author:'Local user',messageTimestamp:now(),parentAttachmentId:null}],assets:[],proposals:[],researchEvents:[],history:[],bookPassages:[],bookStatus:'empty',issues:[]});
 }
 // Original media are resolved by ID; never accept a browser-supplied server path.
 for(const asset of s.assets){const file=files.find(f=>f.originalName===asset.originalName);if(file){if(asset.contentHash&&createHash('sha256').update(file.bytes).digest('hex')!==asset.contentHash)throw new AppError('An original asset does not match its saved hash.');await saveAsset(id,asset.id,file.bytes)}}
 event(s,{runId:id,operation:'normalize_entity',origin:seed||input.preparedPacket?'prepared':'live',state:'completed',finding:seed||input.preparedPacket?`Imported ${s.people.length} existing people. This is prepared evidence.`:'Saved the supplied starting person. Planning uses the supplied evidence.'});
 await createSavedProject(s);
 const remaining=files.filter(f=>f!==json);if(input.context.trim()||remaining.length||input.publicRecordUrl)return addContribution(id,{text:input.context,files:remaining,publicRecordUrl:input.publicRecordUrl},modules);
 return s;
}
export interface ServerContribution {text?:string;files?:InputFile[];targetPersonId?:string;requestId?:string;publicRecordUrl?:string}
export async function addContribution(projectId:string,input:ServerContribution,modules:DataModules=dataModules,agent:AgentModules=liveAgent){
 if(!input.text?.trim()&&!input.files?.length&&!input.publicRecordUrl)throw new AppError('Add text, a file, or a public source URL.');
 const current=await loadProject(projectId);if(input.targetPersonId&&!current.people.some(p=>p.id===input.targetPersonId))throw new AppError('Target person not found.');
 const ingestion=await modules.ingestContribution({text:input.text,files:input.files,targetPersonId:input.targetPersonId});
 let candidates:Source[]=[];
 for(const bytes of ingestion.assetBytes)await saveAsset(projectId,bytes.assetId,bytes.bytes);
 await updateProject(projectId,s=>{const merged=mergeIngestion(s,ingestion);candidates=ingestion.sources.map(source=>s.sources.find(x=>x.id===merged.sourceMap.get(source.id))!).filter(Boolean);
 if(input.targetPersonId){const person=s.people.find(p=>p.id===input.targetPersonId)!;const before=structuredClone(person.photoIds);const photoIds=ingestion.assets.filter(a=>a.mediaType.startsWith('image/')).map(a=>merged.assetMap.get(a.id)||a.id);person.photoIds=[...new Set([...person.photoIds,...photoIds])];if(person.photoIds.length!==before.length){s.history.push({eventId:randomUUID(),at:now(),actor:'local-user',action:'attach_photo',before,after:person.photoIds,sourceIds:ingestion.assets.filter(a=>photoIds.includes(merged.assetMap.get(a.id)||a.id)).map(a=>merged.sourceMap.get(a.sourceId)||a.sourceId),claimIds:[],projectVersion:s.version+1});s.bookStatus=s.bookPassages.length?'stale':'empty'}}
 });
 if(input.publicRecordUrl){const runId=randomUUID();await updateProject(projectId,s=>event(s,{runId,operation:'retrieve_website',origin:'live',state:'running',finding:'Fetching the supplied public source with time and size limits.'}));let fetched;try{fetched=await modules.fetchPublicRecord({url:input.publicRecordUrl,timeoutMs:8000,maxBytes:2_000_000})}catch{fetched={status:'unavailable' as const,error:'The public retrieval adapter failed.'}}await updateProject(projectId,s=>{if(fetched.status==='ok'&&fetched.source){const existing=s.sources.find(x=>x.contentHash===fetched.source!.contentHash);if(!existing)s.sources.push(fetched.source);const source=existing||fetched.source;candidates.push(source);event(s,{runId,operation:'retrieve_website',origin:source.origin,state:'completed',sourceId:source.id,finding:'Retrieved one public source. Identity is still unconfirmed.'})}else event(s,{runId,operation:'retrieve_website',origin:'live',state:fetched.status==='blocked'?'blocked':'failed',error:fetched.error||`Public retrieval ${fetched.status}.`,finding:'No live website result. Local family evidence is still available.'})});}
 const source=candidates.find(x=>x.originalText.trim());if(!source)return loadProject(projectId);
 const runId=randomUUID();let shouldRun=false;
 let snapshot=await updateProject(projectId,s=>{
 if(s.proposals.some(p=>p.sourceIds.includes(source.id)))return false;
 const running=s.researchEvents.find(e=>e.operation==='analyze_record'&&e.sourceId===source.id&&e.state==='running'&&!s.researchEvents.some(t=>t.runId===e.runId&&['failed','completed','blocked'].includes(t.state)&&t.operation==='analyze_record'));
 if(running&&Date.now()-Date.parse(running.at)<120000)return false;
 if(running)event(s,{runId:running.runId,operation:'analyze_record',origin:'live',sourceId:source.id,state:'failed',error:'Previous analysis was interrupted; retrying from the saved source.'});
 shouldRun=true;event(s,{runId,operation:'analyze_record',origin:'live',sourceId:source.id,state:'running',finding:'Astra is analyzing the actual source text. Accepted family state remains editable.'});
 });
 if(!shouldRun)return snapshot;
 try{
 const target=snapshot.people.find(p=>p.id===input.targetPersonId);const query=target?.displayNameEn||snapshot.input.seedName;
 const local=await modules.searchLocalSources({query,sources:snapshot.sources,limit:5});
 snapshot=await updateProject(projectId,s=>event(s,{runId,operation:'search_local',origin:'live',state:'completed',sourceId:source.id,finding:local.status==='no_match'?'Local evidence search found no match.':`Local evidence search returned ${local.hits.length} source excerpts. No website was searched.`}));
 const retrieved=local.hits.map(hit=>snapshot.sources.find(s=>s.id===hit.sourceId)).filter((s):s is Source=>!!s&&s.id!==source.id);
 const proposal=await agent.analyze(snapshot,{...source,originalText:source.originalText.slice(0,24000)},retrieved.map(s=>({...s,originalText:s.originalText.slice(0,12000)})),input.targetPersonId);
 return updateProject(projectId,s=>{if(!s.proposals.some(p=>p.sourceIds.includes(source.id))){s.proposals.push(proposal);event(s,{runId,operation:'analyze_record',origin:'live',state:'completed',sourceId:source.id,finding:'Source-linked interpretation is ready for human review.'});event(s,{runId,operation:'request_human',origin:'live',state:'paused',sourceId:source.id,finding:proposal.question})}});
 }catch(e){return updateProject(projectId,s=>event(s,{runId,operation:'analyze_record',origin:'live',state:'failed',sourceId:source.id,error:e instanceof AppError?e.message:'Source analysis failed. The original source remains saved.',finding:'No live proposal was accepted or invented.'}))}
}
export async function downloadFamilyBook(projectId:string,modules:DataModules=dataModules,agent:AgentModules=liveAgent){
 let snapshot=await loadProject(projectId);const runId=randomUUID();
 if(snapshot.bookStatus!=='current'){
 const originalFingerprint=fingerprint(snapshot);
 await updateProject(projectId,s=>{s.bookStatus='generating';event(s,{runId,operation:'generate_book',origin:'live',state:'running',finding:'Generating a cited passage from currently accepted stories.'})});
 try{const passage=await agent.passage(snapshot);snapshot=await updateProject(projectId,s=>{if(fingerprint(s)!==originalFingerprint)throw new AppError('Accepted family facts changed during generation. Please download again.',409,'STALE_GENERATION');s.bookPassages=[{...passage,acceptedStateVersion:s.version+1}];s.bookStatus='current';event(s,{runId,operation:'generate_book',origin:'live',state:'completed',finding:'Generated a current cited family passage.'})})}catch(e){await updateProject(projectId,s=>{s.bookStatus='failed';event(s,{runId,operation:'generate_book',origin:'live',state:'failed',error:e instanceof AppError?e.message:'Book generation failed.'})});throw e}
 }
 const exportFingerprint=fingerprint(snapshot);const bundle=await modules.buildFamilyBundle({snapshot,passages:snapshot.bookPassages,resolveAsset:id=>readAsset(projectId,id)});
 const latest=await loadProject(projectId);if(fingerprint(latest)!==exportFingerprint)throw new AppError('The family changed during export. Download again for the current book.',409,'STALE_EXPORT');
 await updateProject(projectId,s=>event(s,{runId,operation:'export_project',origin:'live',state:'completed',finding:'Created current PDF/HTML and editable project ZIP.'}));return bundle;
}
