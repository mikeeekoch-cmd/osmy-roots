import { ProjectSnapshotSchema, type Proposal } from "./index";
export const syntheticQuote =
  "I remember my grandfather Alex Morgan repairing watches in his workshop.";
export const syntheticSnapshot = ProjectSnapshotSchema.parse({
  schemaVersion: "roots-v1",
  projectId: "synthetic-demo",
  version: 1,
  input: {
    seedName: "Alex Morgan",
    geography: "",
    geographyUnknown: true,
    context: "Fictional five-generation coding fixture.",
    preparedPacket: true,
  },
  people: ["Evelyn", "Robin", "Alex", "Taylor", "Jamie"].map((name, i) => ({
    id: `person-${i}`,
    displayNameEn: `${name} Morgan`,
    originalName: `${name} Morgan`,
    lifeYears: {
      birth: { value: null, precision: "unknown" },
      death: { value: null, precision: "unknown" },
    },
    photoIds: [],
    claimIds: [],
    storyIds: [],
  })),
  relationships: [],
  claims: [],
  stories: [],
  sources: [
    {
      id: "source-memory",
      kind: "text",
      originalLocator: "synthetic-memory.txt",
      contentHash: "synthetic-placeholder-not-upload-hash",
      originalText: syntheticQuote,
      origin: "prepared",
      author: null,
      messageTimestamp: null,
      parentAttachmentId: null,
    },
  ],
  assets: [],
  proposals: [],
  researchEvents: [
    {
      runId: "fixture",
      eventId: "fixture-import",
      sequence: 1,
      at: "2026-09-10T16:27:53Z",
      operation: "normalize_entity",
      origin: "prepared",
      state: "completed",
      finding: "Synthetic development fixture, not a live result.",
    },
  ],
  history: [],
  bookPassages: [],
  bookStatus: "empty",
  issues: ["Synthetic fixture. Birth years remain unknown."],
  layout: {},
});
export const syntheticProposal: Proposal = {
  id: "proposal-fixture",
  sourceIds: ["source-memory"],
  candidatePersonIds: ["person-2"],
  personId: "person-2",
  text: syntheticQuote,
  predicate: "recollection",
  evidenceType: "family_recollection",
  spans: [
    {
      sourceId: "source-memory",
      locator: "synthetic-memory.txt",
      quote: syntheticQuote,
    },
  ],
  question: "Does this recollection refer to Alex Morgan?",
  uncertainty:
    "This is an attributed memory, not an independently verified record.",
  status: "pending",
  createdAt: "2026-09-10T16:27:53Z",
  model: "fixture-only",
  origin: "prepared",
};
