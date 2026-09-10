import { ProjectSnapshotSchema, type ProjectSnapshot, type SourceSpan } from '../../packages/contracts';
export class AppError extends Error {constructor(message:string,public status=400,public code='INVALID_INPUT'){super(message)}}
export function validateSpans(spans:SourceSpan[],s:ProjectSnapshot) {
 if(!spans.length) throw new AppError('A factual assertion needs an exact source span.');
 for(const span of spans){const source=s.sources.find(x=>x.id===span.sourceId);if(!source || source.originalLocator!==span.locator || !source.originalText.includes(span.quote)) throw new AppError('A citation does not resolve to the original source.');if(span.start!==undefined && source.originalText.slice(span.start,span.end)!==span.quote)throw new AppError('Source offsets do not match the quotation.');}
}
export function validateSnapshot(raw:unknown):ProjectSnapshot {
 const s=ProjectSnapshotSchema.parse(raw);const personIds=new Set(s.people.map(x=>x.id));const sourceIds=new Set(s.sources.map(x=>x.id));const claimIds=new Set(s.claims.map(x=>x.id));const assetIds=new Set(s.assets.map(x=>x.id));const storyIds=new Set(s.stories.map(x=>x.id));
 for(const list of [s.people,s.relationships,s.claims,s.stories,s.sources,s.assets,s.proposals])if(new Set(list.map(x=>x.id)).size!==list.length)throw new AppError('Duplicate record IDs.');
 for(const source of s.sources)if(!source.contentHash)throw new AppError('Missing source hash.');
 for(const claim of s.claims){if(!personIds.has(claim.subjectId)||!claim.sourceIds.length||claim.sourceIds.some(id=>!sourceIds.has(id)))throw new AppError('Claim references are invalid.');validateSpans(claim.spans,s);if(claim.spans.some(x=>!claim.sourceIds.includes(x.sourceId)))throw new AppError('Claim source/span mismatch.');}
 for(const story of s.stories){if(!personIds.has(story.personId)||story.claimIds.some(id=>!claimIds.has(id))||story.sourceIds.some(id=>!sourceIds.has(id)))throw new AppError('Story references are invalid.');validateSpans(story.spans,s);}
 for(const person of s.people)if(person.claimIds.some(id=>!claimIds.has(id))||person.storyIds.some(id=>!storyIds.has(id))||person.photoIds.some(id=>!assetIds.has(id)))throw new AppError('Person references are invalid.');
 for(const asset of s.assets)if(!sourceIds.has(asset.sourceId)||asset.storageKey.includes('..')||asset.storageKey.startsWith('/')||/https?:/.test(asset.storageKey))throw new AppError('Invalid private asset reference.');
 for(const p of s.proposals){if(p.sourceIds.some(id=>!sourceIds.has(id))||p.candidatePersonIds.some(id=>!personIds.has(id))||(p.personId!==null&&!personIds.has(p.personId)))throw new AppError('Proposal references are invalid.');validateSpans(p.spans,s);}
 const parents=new Map<string,string[]>();
 for(const r of s.relationships){if(r.fromPersonId===r.toPersonId||!personIds.has(r.fromPersonId)||!personIds.has(r.toPersonId)||r.claimIds.some(id=>!claimIds.has(id)))throw new AppError('Invalid relationship endpoints or evidence.');if(r.status==='accepted'&&!r.claimIds.length)throw new AppError('Accepted relationships need evidence.');if(r.type==='parent'&&r.status!=='rejected'){const children=parents.get(r.fromPersonId)||[];children.push(r.toPersonId);parents.set(r.fromPersonId,children);}}
 const visiting=new Set<string>(),visited=new Set<string>();function visit(id:string){if(visiting.has(id))throw new AppError('A parent relationship would create an ancestry cycle.');if(visited.has(id))return;visiting.add(id);for(const child of parents.get(id)||[])visit(child);visiting.delete(id);visited.add(id)}for(const id of personIds)visit(id);
 for(const p of s.bookPassages){if(!p.claimIds.length||p.claimIds.some(id=>!s.claims.some(c=>c.id===id&&c.status==='accepted'))) {if(s.bookStatus==='current')throw new AppError('Book contains a claim that is not accepted.');}validateSpans(p.sourceLocators,s);if(s.bookStatus==='current'&&p.acceptedStateVersion!==s.version)throw new AppError('Book passage is stale.');}
 return s;
}
