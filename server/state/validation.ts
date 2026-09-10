import {
  ProjectSnapshotSchema,
  type ProjectSnapshot,
  type SourceSpan,
} from "../../packages/contracts";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_INPUT",
  ) {
    super(message);
  }
}
export function validateSpans(spans: SourceSpan[], s: ProjectSnapshot) {
  if (!spans.length)
    throw new AppError("A factual assertion needs an exact source span.");
  for (const span of spans) {
    const source = s.sources.find((x) => x.id === span.sourceId);
    if (
      !source ||
      source.originalLocator !== span.locator ||
      !source.originalText.includes(span.quote)
    )
      throw new AppError("A citation does not resolve to the original source.");
    if (
      span.start !== undefined &&
      source.originalText.slice(span.start, span.end) !== span.quote
    )
      throw new AppError("Source offsets do not match the quotation.");
  }
}
export function validateSnapshot(raw: unknown): ProjectSnapshot {
  const s = ProjectSnapshotSchema.parse(raw);
  const personIds = new Set(s.people.map((x) => x.id));
  const sourceIds = new Set(s.sources.map((x) => x.id));
  const claimIds = new Set(s.claims.map((x) => x.id));
  const assetIds = new Set(s.assets.map((x) => x.id));
  const storyIds = new Set(s.stories.map((x) => x.id));
  for (const list of [
    s.people,
    s.relationships,
    s.claims,
    s.stories,
    s.sources,
    s.assets,
    s.proposals,
  ])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw new AppError("Duplicate record IDs.");
  for (const source of s.sources)
    if (!source.contentHash) throw new AppError("Missing source hash.");
  for (const claim of s.claims) {
    if (
      !personIds.has(claim.subjectId) ||
      !claim.sourceIds.length ||
      claim.sourceIds.some((id) => !sourceIds.has(id))
    )
      throw new AppError("Claim references are invalid.");
    validateSpans(claim.spans, s);
    if (claim.spans.some((x) => !claim.sourceIds.includes(x.sourceId)))
      throw new AppError("Claim source/span mismatch.");
  }
  for (const story of s.stories) {
    if (
      !personIds.has(story.personId) ||
      story.claimIds.some((id) => !claimIds.has(id)) ||
      story.sourceIds.some((id) => !sourceIds.has(id))
    )
      throw new AppError("Story references are invalid.");
    validateSpans(story.spans, s);
  }
  for (const person of s.people)
    if (
      person.claimIds.some((id) => !claimIds.has(id)) ||
      person.storyIds.some((id) => !storyIds.has(id)) ||
      person.photoIds.some((id) => !assetIds.has(id))
    )
      throw new AppError("Person references are invalid.");
  for (const asset of s.assets)
    if (
      !sourceIds.has(asset.sourceId) ||
      asset.storageKey.includes("..") ||
      asset.storageKey.startsWith("/") ||
      /https?:/.test(asset.storageKey)
    )
      throw new AppError("Invalid private asset reference.");
  for (const p of s.proposals) {
    if (
      p.sourceIds.some((id) => !sourceIds.has(id)) ||
      p.candidatePersonIds.some((id) => !personIds.has(id)) ||
      (p.personId !== null && !personIds.has(p.personId))
    )
      throw new AppError("Proposal references are invalid.");
    validateSpans(p.spans, s);
  }
  const parents = new Map<string, string[]>();
  for (const r of s.relationships) {
    if (
      r.fromPersonId === r.toPersonId ||
      !personIds.has(r.fromPersonId) ||
      !personIds.has(r.toPersonId) ||
      r.claimIds.some((id) => !claimIds.has(id))
    )
      throw new AppError("Invalid relationship endpoints or evidence.");
    if (r.status === "accepted" && !r.claimIds.length)
      throw new AppError("Accepted relationships need evidence.");
    if (r.type === "parent" && r.status !== "rejected") {
      const children = parents.get(r.fromPersonId) || [];
      children.push(r.toPersonId);
      parents.set(r.fromPersonId, children);
    }
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id))
      throw new AppError(
        "A parent relationship would create an ancestry cycle.",
      );
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of parents.get(id) || []) visit(child);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of personIds) visit(id);
  for (const p of s.bookPassages) {
    if (
      !p.claimIds.length ||
      p.claimIds.some(
        (id) => !s.claims.some((c) => c.id === id && c.status === "accepted"),
      )
    ) {
      if (s.bookStatus === "current")
        throw new AppError("Book contains a claim that is not accepted.");
    }
    validateSpans(p.sourceLocators, s);
    if (s.bookStatus === "current" && p.acceptedStateVersion !== s.version)
      throw new AppError("Book passage is stale.");
  }
  if(s.research){
    const r=s.research;
    if(new Set(r.cycles.map(c=>c.id)).size!==r.cycles.length || r.cycles.some((c,i)=>c.ordinal!==i+1||c.kind!==(i===0?'initial':'deeper')))throw new AppError('Research cycles require unique sequential identities.');
    if(r.cycles.filter(c=>['queued','running','paused'].includes(c.status)).length>1)throw new AppError('Only one research cycle may be active.');
    if(new Set(r.jobs.map(j=>j.id)).size!==r.jobs.length)throw new AppError('Duplicate research jobs.');
    for(const j of r.jobs){if(j.cycleId&&!r.cycles.some(c=>c.id===j.cycleId&&c.jobIds.includes(j.id)))throw new AppError('A research job is not owned by its cycle.');if(j.sourceIds.some(id=>!sourceIds.has(id)))throw new AppError('Research job source is unavailable.');}
    for(const q of r.questionBank){validateSpans(q.support,s);if(!r.cycles.some(c=>c.id===q.cycleId))throw new AppError('Question has no originating cycle.');}
    for(const p of r.graphProposals){validateSpans(p.support,s);for(const person of p.people)validateSpans(person.support,s);for(const rel of p.relationships)validateSpans(rel.support,s);}
    for(const pair of r.photoPairQA){const original=s.assets.find(a=>a.id===pair.originalAssetId),enhanced=s.assets.find(a=>a.id===pair.enhancedAssetId);if(!original||!enhanced||original.id===enhanced.id||original.contentHash!==pair.originalHash||enhanced.contentHash!==pair.enhancedHash||!original.mediaType.startsWith('image/')||!enhanced.mediaType.startsWith('image/'))throw new AppError('Photo pair bytes do not match their evidence assets.');if(enhanced.parentAssetId&&enhanced.parentAssetId!==original.id)throw new AppError('Photo derivative has a different original parent.');if(enhanced.parentHash&&enhanced.parentHash!==original.contentHash)throw new AppError('Photo derivative parent hash differs from its original.');if(enhanced.evidenceRootId&&enhanced.evidenceRootId!==pair.evidenceRootId)throw new AppError('Photo derivative has a different evidence root.');for(const crop of [pair.alignment.originalCrop,pair.alignment.enhancedCrop])if(crop&&(crop.some(v=>v<0||v>1)||crop[2]<=0||crop[3]<=0||crop[0]+crop[2]>1||crop[1]+crop[3]>1))throw new AppError('Photo comparison crop is outside the original image.');}
    for(const portrait of r.portraits){if(!assetIds.has(portrait.assetId))throw new AppError('Portrait asset is unavailable.');validateSpans(portrait.support,s);if(portrait.kind==='reviewed_crop'&&portrait.reviewed&&!portrait.crop)throw new AppError('A person crop needs explicit review.');}
    if(r.bookPlan)for(const chapter of r.bookPlan.chapters){if(chapter.sourceBookHash!==r.bookPlan.sourceBook.sha256)throw new AppError('Chapter belongs to a different source book.');validateSpans(chapter.support,s);}
  }
  return s;
}
