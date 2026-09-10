import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DemoManifestSchema, type Proposal, type BookPassage} from '../packages/contracts';
import {startRound2, pumpRound2, answerSetupQuestion, cancelRound2, downloadRound2,prepareRound2Book} from '../server/agent/round2';
import {loadProject,updateProject} from '../server/state/store';
import {multipart} from '../server/agent/http';
const fixture=resolve('tests/fixtures/round2/packet');
async function setup(){
  const raw=JSON.parse(await readFile(join(fixture,'DEMO_MANIFEST.json'),'utf8'));
  const manifest=DemoManifestSchema.parse(raw);
  const files=await Promise.all((await readdir(join(fixture,'01-upload'))).map(async name=>({uploadId:name,originalName:name,mediaType:'application/octet-stream',bytes:new Uint8Array(await readFile(join(fixture,'01-upload',name)))})));
  return {manifest,files};
}
const analysis: any = async(s:any,source:any,_r:any,target?:string):Promise<Proposal>=>{
  assert.equal(target,undefined,'The held-out call must not contain a prepared identity hint');
  return {id:'fixture-live-proposal',personId:'F005',candidatePersonIds:['F005'],text:'Aunt Iris recalls Alder repairing wooden boats.',predicate:'craft',evidenceType:'family_recollection',sourceIds:[source.id],spans:[{sourceId:source.id,locator:source.originalLocator,quote:source.originalText}],question:'Does this recollection belong to this relative?',uncertainty:'A recollection, not an independently verified record.',status:'pending',model:'test-stub',origin:'live',createdAt:new Date().toISOString()};
};
const passage:any=async(s:any):Promise<BookPassage>=>{const st=s.stories.find((x:any)=>x.status==='accepted');return {id:'test-passage',text:st.text,claimIds:st.claimIds,sourceIds:st.sourceIds,sourceLocators:st.spans,acceptedStateVersion:s.version,origin:'live',model:'test-stub'}};

test('round2 actual packet parsing, seven explicit answers, saved staging, resume and sealed export',async()=>{
  const root=await mkdtemp(join(tmpdir(),'roots-r2-'));const old=process.env.ROOTS_DATA_DIR;process.env.ROOTS_DATA_DIR=root;
  try{
    const {manifest,files}=await setup();const t=Date.now();
    let s=await startRound2({seedName:'Fictional Family',geographyUnknown:true},files,{manifest,nowMs:t});
    assert.equal(s.people.length,0);assert.equal(s.run!.questions.length,7);assert.equal(s.run!.modelStatus,'pending');
    assert.equal(s.run!.questions.find(q=>q.requiresAstra)!.recommendation,'');
    s=await pumpRound2(s.projectId,{analyze:analysis,nowMs:t+8000});
    assert.equal(s.run!.modelStatus,'completed');assert.equal(s.people.length,0);
    assert.match(s.run!.questions.find(q=>q.requiresAstra)!.recommendation,/not an independently verified record/);
    for(const q of s.run!.questions){s=await answerSetupQuestion(s.projectId,{questionId:q.id,action:q.category==='conflict'?'unknown':'confirm',baseVersion:s.version,requestId:`answer-${q.id}`});}
    const before=s.version;
    s=await answerSetupQuestion(s.projectId,{questionId:s.run!.questions[0].id,action:'confirm',baseVersion:1,requestId:`answer-${s.run!.questions[0].id}`});assert.equal(s.version,before);
    s=await pumpRound2(s.projectId,{nowMs:t+35000,passage});assert.equal(s.people.length,5);assert.equal(s.stories.length,1);
    assert.match(s.stories[0].text,/not an independently verified record/);
    assert.match(s.claims.find(claim=>claim.id===s.stories[0].claimIds[0])!.value,/not an independently verified record/);
    s=await pumpRound2(s.projectId,{nowMs:t+44000,passage});assert.equal(s.people.length,10);
    s=await pumpRound2(s.projectId,{nowMs:t+44000,passage});assert.equal(s.people.length,10);
    for(const ms of [53000,62000,71000,80000,89000])s=await pumpRound2(s.projectId,{nowMs:t+ms,passage});
    assert.equal(s.people.length,35);assert.equal(s.relationships.length,56);assert.equal(s.run!.book.status,'ready');
    assert.equal(s.run!.batches.filter(b=>b.status==='saved').length,6);
    assert.equal(Date.parse(s.run!.batches[5].savedAt!)-Date.parse(s.run!.batches[0].savedAt!),45000);
    const [first,second]=await Promise.all([downloadRound2(s.projectId,{passage}),downloadRound2(s.projectId,{passage})]);
    assert.ok(first.bytes.length>1000);assert.equal(first,second);
    s=await loadProject(s.projectId);assert.equal(s.run!.phase,'completed');
    await assert.rejects(()=>updateProject(s.projectId,p=>{p.people[0].displayNameEn='Not allowed';}),/sealed/);
    const resumed=await pumpRound2(s.projectId,{nowMs:t+200000});assert.deepEqual(resumed,s);
  }finally{process.env.ROOTS_DATA_DIR=old;await rm(root,{recursive:true,force:true});}
});

test('manifest cannot forge a photo citation or replace the identity in uploaded captions',async()=>{
  const {manifest,files}=await setup();
  const citation=structuredClone(manifest);
  citation.photos[0].support=[{sourceId:'missing-source',locator:'invented',quote:'Invented identity'}];
  await assert.rejects(()=>startRound2({seedName:'Fictional',geographyUnknown:true},files,{manifest:citation}),/source|span/i);
  const identity=structuredClone(manifest);
  identity.photos[0].positions[0].personId='F001';
  await assert.rejects(()=>startRound2({seedName:'Fictional',geographyUnknown:true},files,{manifest:identity}),/photo annotation differs/i);
});

test('background model status cannot invalidate an unchanged first prepared answer, but conflicting answers still fail',async()=>{
  const root=await mkdtemp(join(tmpdir(),'roots-r2-answer-race-'));const old=process.env.ROOTS_DATA_DIR;process.env.ROOTS_DATA_DIR=root;
  try{
    const {manifest,files}=await setup();let s=await startRound2({seedName:'Fictional',geographyUnknown:true},files,{manifest});
    const displayedVersion=s.version,question=s.run!.questions[0];
    let entered!:()=>void,finish!:(value:any)=>void;
    const started=new Promise<void>(resolve=>entered=resolve);
    const pending=pumpRound2(s.projectId,{analyze:(async()=>{entered();return new Promise(resolve=>finish=resolve)}) as any});
    await started;
    s=await answerSetupQuestion(s.projectId,{questionId:question.id,action:'confirm',baseVersion:displayedVersion,requestId:'first-answer-during-analysis'});
    assert.equal(s.run!.answers.length,1);assert.equal(s.people.length,0);
    await assert.rejects(()=>answerSetupQuestion(s.projectId,{questionId:question.id,action:'unknown',baseVersion:displayedVersion,requestId:'conflicting-old-answer'}),/answer changed/);
    const stage=JSON.parse(await readFile(join(root,s.projectId,'staging.json'),'utf8'));
    finish(await analysis(stage.graph,stage.graph.sources.find((source:any)=>source.id==='chat-family'),[],undefined));
    await pending;
  }finally{process.env.ROOTS_DATA_DIR=old;await rm(root,{recursive:true,force:true});}
});

test('unanswered checks cannot reveal graph; cancelled run never starts model or batches',async()=>{
  const root=await mkdtemp(join(tmpdir(),'roots-r2-cancel-'));const old=process.env.ROOTS_DATA_DIR;process.env.ROOTS_DATA_DIR=root;
  try{const {manifest,files}=await setup();const t=Date.now();let s=await startRound2({seedName:'Fictional',geographyUnknown:true},files,{manifest,nowMs:t});
    s=await pumpRound2(s.projectId,{analyze:analysis,nowMs:t+200000});assert.equal(s.people.length,0);
    s=await cancelRound2(s.projectId);s=await pumpRound2(s.projectId,{analyze:()=>{throw Error('must not run')},nowMs:t+300000});assert.equal(s.run!.phase,'cancelled');assert.equal(s.people.length,0);
  }finally{process.env.ROOTS_DATA_DIR=old;await rm(root,{recursive:true,force:true});}
});

test('multipart enforces body cap without content-length before formData allocation',async()=>{
  let reads=0;const body=new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(26_000_000));},cancel(){}});
  const req=new Request('http://localhost/api/projects',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=x'},body,duplex:'half'} as any);
  await assert.rejects(()=>multipart(req),/100 MB/);assert.ok(reads<=5);
});

test('unknown photo and corrected kinship survive later saved arrivals; undo preserves those arrivals',async()=>{
  const root=await mkdtemp(join(tmpdir(),'roots-r2-corrections-'));const old=process.env.ROOTS_DATA_DIR;process.env.ROOTS_DATA_DIR=root;
  try{
    const {manifest,files}=await setup();const t=Date.now();let s=await startRound2({seedName:'Fictional',geographyUnknown:true},files,{manifest,nowMs:t});
    s=await pumpRound2(s.projectId,{analyze:analysis,nowMs:t+8000});
    for(const q of s.run!.questions)s=await answerSetupQuestion(s.projectId,{questionId:q.id,action:q.category==='photo'?'unknown':'confirm',baseVersion:s.version,requestId:`saved-${q.id}`});
    s=await pumpRound2(s.projectId,{nowMs:t+35000});
    const photo=s.run!.questions.find(q=>q.category==='photo')!;
    const photoId=photo.effect.photoAssetId!;
    assert.ok(s.people.every(p=>!p.photoIds.includes(photoId)));
    const kinship=s.run!.questions.find(q=>q.category==='kinship')!;
    s=await answerSetupQuestion(s.projectId,{questionId:kinship.id,action:'correct',text:'Keep this supplied connection disputed.',baseVersion:s.version,requestId:'kinship-correction'});
    assert.equal(s.relationships.find(r=>r.id===kinship.effect.relationshipId)!.status,'disputed');
    s=await answerSetupQuestion(s.projectId,{questionId:kinship.id,action:'unknown',baseVersion:s.version,requestId:'kinship-unknown'});
    assert.equal(s.relationships.find(r=>r.id===kinship.effect.relationshipId)!.status,'unresolved');
    const {mutateGraph}=await import('../server/state/decisions');
    const person=s.people[0],name=person.displayNameEn;
    s=await mutateGraph(s.projectId,{operation:'editPerson',entityId:person.id,values:{displayNameEn:'A reviewed spelling'},baseVersion:s.version,requestId:'spelling'});
    s=await pumpRound2(s.projectId,{nowMs:t+44000});assert.equal(s.people.length,10);assert.ok(s.people.every(p=>!p.photoIds.includes(photoId)));
    s=await mutateGraph(s.projectId,{operation:'undo',baseVersion:s.version,requestId:'undo-spelling'});
    assert.equal(s.people.length,10);assert.equal(s.people.find(p=>p.id===person.id)!.displayNameEn,name);
  }finally{process.env.ROOTS_DATA_DIR=old;await rm(root,{recursive:true,force:true});}
});

test('late book completion cannot resurrect a cancelled run',async()=>{
  const root=await mkdtemp(join(tmpdir(),'roots-r2-late-'));const old=process.env.ROOTS_DATA_DIR;process.env.ROOTS_DATA_DIR=root;
  try{
    const {manifest,files}=await setup();const t=Date.now();let s=await startRound2({seedName:'Fictional',geographyUnknown:true},files,{manifest,nowMs:t});
    s=await pumpRound2(s.projectId,{analyze:analysis,nowMs:t+8000});for(const q of s.run!.questions)s=await answerSetupQuestion(s.projectId,{questionId:q.id,action:'confirm',baseVersion:s.version,requestId:`cancel-${q.id}`});
    s=await pumpRound2(s.projectId,{nowMs:t+35000});
    let finish!:(value:any)=>void;let started!:(value?:unknown)=>void;const entered=new Promise(r=>started=r);
    const task=prepareRound2Book(s.projectId,{passage:async()=>{started();return new Promise(r=>finish=r)}});
    await entered;await cancelRound2(s.projectId);finish(await passage(s));
    await assert.rejects(()=>task,/cancelled/);assert.equal((await loadProject(s.projectId)).run!.phase,'cancelled');
  }finally{process.env.ROOTS_DATA_DIR=old;await rm(root,{recursive:true,force:true});}
});
