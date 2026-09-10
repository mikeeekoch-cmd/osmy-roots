import { z } from "zod";

export const UPLOAD_LIMITS = Object.freeze({maxFiles: 40, maxFileBytes: 25_000_000, maxTotalBytes: 100_000_000, multipartOverheadBytes: 1_000_000, maxArchiveEntries: 200, maxExpandedBytes: 100_000_000, maxCompressionRatio: 200});
const Id = z.string().min(1).max(160);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const RelativePath = z.string().min(1).refine(x => !x.startsWith("/") && !x.includes("\\") && !x.split("/").includes(".."), "Use a safe relative file path");
export const EvidenceSpanSchema = z.object({sourceId: Id, locator: z.string().min(1), quote: z.string().min(1)});
export const TranslationLineageSchema = z.object({originalHash: Hash, originalLocator: z.string().min(1), derivativeHash: Hash, language: z.literal("en")});
export const PhotoAnnotationSchema = z.object({assetId: Id, file: RelativePath, positions: z.array(z.object({position: z.number().int().positive(), personId: Id.nullable(), label: z.string(), status: z.enum(["proposed", "confirmed", "unresolved"])})), support: z.array(EvidenceSpanSchema)});
export const QuestionCategorySchema = z.enum(["photo", "kinship", "origin", "time", "movement", "recollection", "conflict"]);
export const QuestionEffectSchema = z.object({kind: z.enum(["annotation", "claim", "relationship", "story", "editorial"]), personId: Id.optional(), predicate: z.string().optional(), relationshipId: Id.optional(), photoAssetId: Id.optional()});
export const SetupQuestionSchema = z.object({id: Id, category: QuestionCategorySchema, prompt: z.string().min(1), recommendation: z.string(), support: z.array(EvidenceSpanSchema).min(1), personIds: z.array(Id), effect: QuestionEffectSchema, requiresAstra: z.boolean().default(false), status: z.enum(["waiting", "ready", "answered", "failed"]).default("ready"), origin: z.enum(["prepared", "live"]).default("prepared"), proposalId: Id.optional()});
export type SetupQuestion = z.infer<typeof SetupQuestionSchema>;
export const SetupAnswerSchema = z.object({questionId: Id, action: z.enum(["confirm", "correct", "unknown"]), text: z.string().min(1).max(4000).optional(), baseVersion: z.number().int().nonnegative(), requestId: Id});
export type SetupAnswer = z.infer<typeof SetupAnswerSchema>;
export const SavedAnswerSchema = SetupAnswerSchema.extend({savedAt: z.string(), originalRecommendation: z.string(), savedText: z.string(), sourceIds: z.array(Id)});
export const GraphBatchSchema = z.object({id: Id, personIds: z.array(Id), relationshipIds: z.array(Id).default([]), dependencyIds: z.array(Id).default([]), releaseOffsetSeconds: z.number().nonnegative()});
export const SourceJobSchema = z.object({id: Id, kind: z.enum(["saved_folder", "saved_correspondence"]), filePaths: z.array(RelativePath), evidenceRootIds: z.array(Id), releaseOffsetSeconds: z.number().nonnegative()});
export const DemoManifestSchema = z.object({
  schemaVersion: z.literal("roots-demo-v2"), packetVersion: z.string().min(1),
  script: z.object({title: z.string(), version: z.string(), sha256: Hash}),
  selectedPersonIds: z.array(Id).min(1), expectedRelationshipCount: z.number().int().nonnegative(),
  files: z.array(z.object({path: RelativePath, sha256: Hash, bytes: z.number().int().nonnegative(), sourceIds: z.array(Id), evidenceRootIds: z.array(Id), lineage: z.array(TranslationLineageSchema).default([])})).max(40),
  photos: z.array(PhotoAnnotationSchema), questions: z.array(SetupQuestionSchema).length(7),
  initialBranchIds: z.array(Id).min(1), initialReleaseOffsetSeconds: z.number().nonnegative().default(35), batches: z.array(GraphBatchSchema).length(6),
  sourceJobs: z.array(SourceJobSchema).default([]), requiredBookSections: z.array(z.string()).min(1),
}).superRefine((m, ctx) => {
  const fail = (message: string) => ctx.addIssue({code: "custom", message});
  if (new Set(m.selectedPersonIds).size !== m.selectedPersonIds.length) fail("Roster IDs must be unique");
  if (new Set(m.questions.map(q => q.id)).size !== 7 || new Set(m.questions.map(q => q.category)).size !== 7) fail("Seven distinct questions and categories are required");
  const ids = [...m.initialBranchIds, ...m.batches.flatMap(b => b.personIds)];
  if (new Set(ids).size !== ids.length || ids.length !== m.selectedPersonIds.length || ids.some(id => !m.selectedPersonIds.includes(id))) fail("Batch coverage must equal the complete roster exactly once");
  const released = new Set(["initial"]);
  let previous = m.initialReleaseOffsetSeconds;
  for (const b of m.batches) {
    if (released.has(b.id) || b.dependencyIds.some(id => !released.has(id)) || b.releaseOffsetSeconds <= previous) fail("Batches require unique IDs, prior dependencies and increasing release times");
    released.add(b.id); previous = b.releaseOffsetSeconds;
  }
  if (m.batches.at(-1)!.releaseOffsetSeconds - m.batches[0].releaseOffsetSeconds < 45) fail("Six arrivals must span at least 45 seconds");
});
export type DemoManifest = z.infer<typeof DemoManifestSchema>;
export const RunStateSchema = z.object({
  runId: Id, startedAt: z.string(), phase: z.enum(["preparing", "questions", "growing", "review", "preparing_book", "ready", "sealing", "completed", "failed", "cancelled"]),
  nextSequence: z.number().int(), packetVersion: z.string(), packetHash: Hash, language: z.literal("en"),
  questions: z.array(SetupQuestionSchema), answers: z.array(SavedAnswerSchema),
  batches: z.array(GraphBatchSchema.extend({status: z.enum(["pending", "saved", "cancelled"]), savedAt: z.string().optional()})),
  initialBranchIds: z.array(Id), initialSavedAt: z.string().optional(), targetPeople: z.number().int(),
  modelStatus: z.enum(["pending", "running", "completed", "failed"]),
  book: z.object({status: z.enum(["empty", "preparing", "ready", "failed"]), key: z.string().optional(), preparedAt: z.string().optional(), stateVersion: z.number().int().optional(), error: z.string().optional()}),
  sealedAt: z.string().optional(), sealedVersion: z.number().int().optional(), completedAt: z.string().optional(), error: z.string().optional(),
});
export type RunState = z.infer<typeof RunStateSchema>;
