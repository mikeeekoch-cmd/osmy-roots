import { createHash, randomUUID } from 'node:crypto';
import { GraphMutationSchema, PersonSchema, RelationshipSchema, ReviewDecisionSchema, type ProjectSnapshot, type Proposal, type HistoryEvent } from '../../packages/contracts';
import { updateProject, loadProject } from './store';
import { AppError } from './validation';
import { event } from '../events';
const now=()=>new Date().toISOString();
function graphState(s:ProjectSnapshot){return structuredClone({people:s.people,relationships:s.relationships,claims:s.claims,stories:s.stories})}
function history(s:ProjectSnapshot,action:string,before:unknown,after:unknown,sourceIds:string[],claimIds:string[],requestId?:string){s.history.push({eventId:requestId||randomUUID(),at:now(),actor:'local-user',action,before,after,sourceIds,claimIds,projectVersion:s.version+1})}
function isRetry(s:ProjectSnapshot,requestId?:string){return requestId&&s.history.some(h=>h.eventId===requestId)}
export async function reviewProposal(projectId:string,raw:unknown){
 const input=ReviewDecisionSchema.parse(raw);const current=await loadProject(projectId);const existing=current.proposals.find(p=>p.id===input.proposalId);if(!existing)throw new AppError('Proposal not found.',404);
 if(isRetry(current,input.requestId)||(input.action==='accept'&&existing.status==='accepted')||(input.action==='reject'&&existing.status==='rejected')||(input.action==='unknown'&&existing.status==='unknown'))return current;
 return updateProject(projectId,s=>{
 if(isRetry(s,input.requestId))return false;
 const p=s.proposals.find(p=>p.id===input.proposalId)!;
 const before={...graphState(s),proposal:structuredClone(p)};
 if((p.status==='rejected'||p.status==='corrected'||p.status==='accepted')&&input.action!=='correct')throw new AppError('This proposal already has a final decision.',409,'ALREADY_REVIEWED');
 const touchedClaims:string[]=[];
 if(input.action==='accept'||input.action==='correct'){
 const personId=input.corrections?.personId||p.personId;
 if(!personId||!s.people.some(x=>x.id===personId))throw new AppError('Choose the intended person before accepting.');
 if(input.action==='accept'&&p.candidatePersonIds.length>1)throw new AppError('Multiple candidates remain. Use Correct to choose the intended person.');
 const text=input.action==='correct'?(input.corrections?.text||p.text):p.text;
 const claimId=`claim-${p.id}`,storyId=`story-${p.id}`;
 // Upsert fixed IDs so a retry/correction cannot duplicate the accepted story.
 const oldClaim=s.claims.find(c=>c.id===claimId);const oldStory=s.stories.find(st=>st.id===storyId);
 const claim={id:claimId,subjectId:personId,predicate:input.corrections?.predicate||p.predicate,value:text,sourceIds:p.sourceIds,spans:p.spans,status:'accepted' as const,evidenceType:p.evidenceType,version:(oldClaim?.version||0)+1};
 const attribution=p.evidenceType==='family_recollection'?(s.sources.find(x=>p.sourceIds.includes(x.id))?.author||'Family contributor'):'Source document';
 const story={id:storyId,personId,text,sourceIds:p.sourceIds,claimIds:[claimId],spans:p.spans,evidenceType:p.evidenceType,status:'accepted' as const,attribution};
 if(oldClaim)Object.assign(oldClaim,claim);else s.claims.push(claim);if(oldStory)Object.assign(oldStory,story);else s.stories.push(story);
 for(const person of s.people){person.claimIds=person.claimIds.filter(id=>id!==claimId);person.storyIds=person.storyIds.filter(id=>id!==storyId)}
 const person=s.people.find(x=>x.id===personId)!;person.claimIds.push(claimId);person.storyIds.push(storyId);touchedClaims.push(claimId);
 p.personId=personId;p.status=input.action==='correct'?'corrected':'accepted';
 }else p.status=input.action==='unknown'?'unknown':'rejected';
 history(s,`review:${input.action}`,before,{...graphState(s),proposal:structuredClone(p)},p.sourceIds,touchedClaims,input.requestId);
 event(s,{runId:p.id,operation:'apply_review',origin:'live',state:'completed',finding:input.action==='unknown'?'Identity remains unresolved. Accepted family facts were kept.':`Saved ${input.action} decision.`});
 },{baseVersion:input.baseVersion,invalidateBook:input.action==='accept'||input.action==='correct',isReplay:s=>!!isRetry(s,input.requestId)||(input.action==='accept'&&s.proposals.some(p=>p.id===input.proposalId&&p.status==='accepted'))});
}
function addManualEvidence(s:ProjectSnapshot,subjectId:string,predicate:string,value:unknown){const text=JSON.stringify(value);const id=randomUUID();const sourceId=`source-${id}`,claimId=`claim-${id}`;s.sources.push({id:sourceId,kind:'human_edit',originalLocator:`Human edit ${id}`,contentHash:createHash('sha256').update(text).digest('hex'),originalText:text,origin:'live',author:'Local user',messageTimestamp:now(),parentAttachmentId:null});s.claims.push({id:claimId,subjectId,predicate,value:text,sourceIds:[sourceId],spans:[{sourceId,locator:`Human edit ${id}`,quote:text}],status:'accepted',evidenceType:'user_correction',version:1});return {sourceId,claimId}}
export async function mutateGraph(projectId:string,raw:unknown){const input=GraphMutationSchema.parse(raw);const current=await loadProject(projectId);if(isRetry(current,input.requestId))return current;
 return updateProject(projectId,s=>{
 if(isRetry(s,input.requestId))return false;
 const before=graphState(s);const sources:string[]=[],claims:string[]=[];
 if(input.operation==='undo'){
 const undone=new Set(s.history.filter(h=>h.action.startsWith('undo:')).map(h=>h.action.slice(5)));
 const entry=[...s.history].reverse().find(h=>(h.action.startsWith('graph:')||h.action.startsWith('review:'))&&!undone.has(h.eventId));
 if(!entry)throw new AppError('Nothing to undo.');
 // Only one level: a second undo requires a new user mutation.
 if(s.history.at(-1)?.action.startsWith('undo:'))throw new AppError('Only one-level undo is available.');
 const previous=entry.before as ReturnType<typeof graphState>&{proposal?:Proposal};Object.assign(s,structuredClone({people:previous.people,relationships:previous.relationships,claims:previous.claims,stories:previous.stories}));
 if(previous.proposal){const i=s.proposals.findIndex(p=>p.id===previous.proposal!.id);if(i>=0)s.proposals[i]=structuredClone(previous.proposal)}
 history(s,`undo:${entry.eventId}`,before,graphState(s),entry.sourceIds,entry.claimIds,input.requestId);return;
 }
 const values=input.values||{};
 if(input.operation==='addPerson'||input.operation==='editPerson'){
 const old=s.people.find(p=>p.id===input.entityId);if(input.operation==='editPerson'&&!old)throw new AppError('Person not found.',404);
 const id=old?.id||`person-${randomUUID()}`;
 const editable={displayNameEn:values.displayNameEn??old?.displayNameEn,originalName:values.originalName??old?.originalName??values.displayNameEn,lifeYears:values.lifeYears??old?.lifeYears??{birth:{value:null,precision:'unknown'},death:{value:null,precision:'unknown'}}};
 const person=PersonSchema.parse({...old,...editable,id,claimIds:old?.claimIds||[],storyIds:old?.storyIds||[],photoIds:old?.photoIds||[]});
 const evidence=addManualEvidence(s,id,'human_profile_edit',editable);person.claimIds.push(evidence.claimId);sources.push(evidence.sourceId);claims.push(evidence.claimId);
 if(old)Object.assign(old,person);else s.people.push(person);
 }else{
 const old=s.relationships.find(r=>r.id===input.entityId);if(input.operation==='editRelationship'&&!old)throw new AppError('Relationship not found.',404);
 const relation=RelationshipSchema.parse({...old,...values,id:old?.id||`relationship-${randomUUID()}`,claimIds:old?.claimIds||[],status:'accepted'});
 const evidence=addManualEvidence(s,relation.fromPersonId,'relationship',{fromPersonId:relation.fromPersonId,toPersonId:relation.toPersonId,type:relation.type});relation.claimIds.push(evidence.claimId);sources.push(evidence.sourceId);claims.push(evidence.claimId);
 if(old)Object.assign(old,relation);else s.relationships.push(relation);
 }
 history(s,`graph:${input.operation}`,before,graphState(s),sources,claims,input.requestId);
 event(s,{runId:input.requestId||randomUUID(),operation:'apply_review',origin:'live',state:'completed',finding:'Saved family edit with its original user input.'});
 },{baseVersion:input.baseVersion,invalidateBook:true,isReplay:s=>!!isRetry(s,input.requestId)});
}
