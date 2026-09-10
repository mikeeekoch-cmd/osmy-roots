import { randomUUID } from "node:crypto";
import { syntheticSnapshot } from "../packages/contracts/fixtures";
import {
  planResearch,
  analyzeResearchRecord,
} from "../server/agent/research-astra";
import { researchFingerprint } from "../server/state/research";
import type { ResearchCycle, Source } from "../packages/contracts";
const s = structuredClone(syntheticSnapshot);
s.projectId = randomUUID();
const source: Source = {
  id: "round3-live-fiction",
  kind: "family_document",
  title: "Fictional genealogy test record",
  originalLocator: "fictional-record.txt, paragraph 1",
  contentHash: "fictional-test-only",
  originalText:
    "Fictional test record: Nora Finch was born in 1910. Nora Finch was the mother of Ellis Finch, born in 1935. This invented fixture tests citation handling; neither name describes a real person.",
  origin: "prepared",
  author: null,
  messageTimestamp: null,
  parentAttachmentId: null,
};
s.sources.push(source);
const c: ResearchCycle = {
  id: "live-test-cycle",
  ordinal: 1,
  kind: "initial",
  requestId: "live-test-click",
  inputFingerprint: researchFingerprint(s),
  status: "running",
  createdAt: new Date().toISOString(),
  jobIds: [],
};
const start = Date.now();
const plan = await planResearch(s, c, [source.id]);
const result = await analyzeResearchRecord(s, c, source);
if (result.noMatch || !result.proposal.people.length)
  throw new Error(
    "The fictional source did not produce a reviewable new-person proposal.",
  );
console.log(
  JSON.stringify({
    model: plan.model,
    planObjectives: plan.objectives.length,
    newPeople: result.proposal.people.length,
    relationships: result.proposal.relationships.length,
    spans: result.proposal.support.length,
    latencyMs: Date.now() - start,
    source: "fictional",
  }),
);
