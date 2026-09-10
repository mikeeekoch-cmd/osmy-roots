import { z } from "zod";
import { RunStateSchema, PhotoAnnotationSchema, PhotoPairSchema, TranslationLineageSchema, type SetupAnswer } from "./round2";
export * from "./round2";

export const SCHEMA_VERSION = "roots-v1" as const;
export const Id = z.string().min(1).max(160);
export const OriginSchema = z.enum(["live", "cached", "prepared", "replay"]);
export const EvidenceTypeSchema = z.enum([
  "family_recollection",
  "family_document",
  "archive_record",
  "user_correction",
]);
export const ProjectInputSchema = z
  .object({
    seedName: z.string().trim().min(1).max(200),
    geography: z.string().trim().max(300).default(""),
    geographyUnknown: z.boolean().default(false),
    context: z.string().max(100000).default(""),
    preparedPacket: z.boolean().default(false),
    language: z.literal("en").default("en"),
    birthPlace: z.string().optional(),
    currentPlace: z.string().optional(),
    period: z.string().optional(),
    aliases: z.array(z.string()).default([]),
    publicRecordUrl: z.string().url().optional(),
  })
  .refine(
    (x) => x.geographyUnknown || !!x.geography,
    "Supply geography or explicitly choose unknown",
  );
export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export const SourceSchema = z.object({
  id: Id,
  kind: z.string(),
  originalLocator: z.string().min(1),
  contentHash: z.string().min(1),
  originalText: z.string(),
  origin: OriginSchema,
  author: z.string().nullable().default(null),
  messageTimestamp: z.string().nullable().default(null),
  parentAttachmentId: z.string().nullable().default(null),
  title: z.string().optional(),
  retrievedAt: z.string().optional(),
  url: z.string().optional(),
  language: z.string().optional(),
  extractionMethod: z.string().optional(),
  evidenceRootIds: z.array(z.string()).optional(),
  lineage: z.array(TranslationLineageSchema).optional(),
  reconstructed: z.boolean().optional(),
  evidenceRootId: z.string().optional(),
  archiveHash: z.string().optional(),
  reconstructionMetadata: z.unknown().optional(),
});
export type Source = z.infer<typeof SourceSchema>;
export const SourceAssetSchema = z.object({
  id: Id,
  sourceId: Id,
  originalName: z.string(),
  mediaType: z.string(),
  byteLength: z.number().int().nonnegative(),
  storageKey: z.string(),
  contentHash: z.string().optional(),
  caption: z.string().optional(),
});
export type SourceAsset = z.infer<typeof SourceAssetSchema>;
export const SourceSpanSchema = z.object({
  sourceId: Id,
  locator: z.string().min(1),
  quote: z.string().min(1),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
});
export type SourceSpan = z.infer<typeof SourceSpanSchema>;
export const LifeDateSchema = z.object({
  value: z.string().nullable(),
  precision: z.enum(["day", "month", "year", "approximate", "unknown"]),
});
export const PersonSchema = z.object({
  id: Id,
  displayNameEn: z.string().min(1),
  originalName: z.string(),
  lifeYears: z.object({ birth: LifeDateSchema, death: LifeDateSchema }),
  photoIds: z.array(Id).default([]),
  claimIds: z.array(Id).default([]),
  storyIds: z.array(Id).default([]),
  aliases: z.array(z.string()).optional(),
  recordStatus: z.string().optional(),
  importedSourceRefs: z.array(z.string()).optional(),
});
export type Person = z.infer<typeof PersonSchema>;
export const ClaimSchema = z.object({
  id: Id,
  subjectId: Id,
  predicate: z.string(),
  value: z.string(),
  sourceIds: z.array(Id),
  spans: z.array(SourceSpanSchema),
  status: z.enum([
    "proposed",
    "accepted",
    "disputed",
    "unresolved",
    "superseded",
  ]),
  evidenceType: EvidenceTypeSchema,
  version: z.number().int().default(1),
});
export type Claim = z.infer<typeof ClaimSchema>;
export type ExtractedClaim = Claim;
export const StorySchema = z.object({
  id: Id,
  personId: Id,
  text: z.string(),
  sourceIds: z.array(Id),
  claimIds: z.array(Id),
  spans: z.array(SourceSpanSchema),
  evidenceType: EvidenceTypeSchema,
  status: z.enum([
    "proposed",
    "accepted",
    "unresolved",
    "rejected",
    "superseded",
  ]),
  attribution: z.string(),
});
export type Story = z.infer<typeof StorySchema>;
export const RelationshipSchema = z.object({
  id: Id,
  fromPersonId: Id,
  toPersonId: Id,
  type: z.enum(["parent", "partner", "sibling"]),
  claimIds: z.array(Id),
  status: z.enum([
    "proposed",
    "accepted",
    "disputed",
    "unresolved",
    "rejected",
  ]),
});
export type Relationship = z.infer<typeof RelationshipSchema>;
export const ProposalSchema = z.object({
  id: Id,
  sourceIds: z.array(Id).min(1),
  candidatePersonIds: z.array(Id),
  personId: Id.nullable(),
  text: z.string(),
  predicate: z.string(),
  evidenceType: EvidenceTypeSchema,
  spans: z.array(SourceSpanSchema).min(1),
  question: z.string(),
  uncertainty: z.string(),
  status: z.enum(["pending", "accepted", "corrected", "rejected", "unknown"]),
  createdAt: z.string(),
  model: z.string(),
  origin: OriginSchema,
});
export type Proposal = z.infer<typeof ProposalSchema>;
export const ResearchEventSchema = z.object({
  runId: Id,
  eventId: Id,
  sequence: z.number().int(),
  at: z.string(),
  operation: z.enum([
    "parse_file",
    "normalize_entity",
    "retrieve_website",
    "search_local",
    "analyze_record",
    "compare_candidates",
    "request_human",
    "apply_review",
    "generate_book",
    "export_project",
  ]),
  origin: OriginSchema,
  state: z.enum([
    "planned",
    "running",
    "completed",
    "blocked",
    "failed",
    "paused",
  ]),
  sourceId: Id.optional(),
  assetId: Id.optional(),
  finding: z.string().optional(),
  error: z.string().optional(),
  countsDelta: z.record(z.string(), z.number()).optional(),
});
export type ResearchEvent = z.infer<typeof ResearchEventSchema>;
export const HistorySchema = z.object({
  eventId: Id,
  at: z.string(),
  actor: z.string(),
  action: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  sourceIds: z.array(Id),
  claimIds: z.array(Id),
  projectVersion: z.number().int(),
});
export type HistoryEvent = z.infer<typeof HistorySchema>;
export const BookPassageSchema = z.object({
  id: Id,
  text: z.string(),
  claimIds: z.array(Id),
  sourceIds: z.array(Id),
  sourceLocators: z.array(SourceSpanSchema),
  acceptedStateVersion: z.number().int(),
  origin: OriginSchema,
  model: z.string().optional(),
});
export type BookPassage = z.infer<typeof BookPassageSchema>;
export const FileOutcomeSchema = z.object({
  uploadId: Id,
  originalName: z.string(),
  status: z.enum(["parsed", "stored_only", "failed"]),
  sourceIds: z.array(Id),
  assetIds: z.array(Id),
  warnings: z.array(z.string()),
});
export type FileOutcome = z.infer<typeof FileOutcomeSchema>;
export const ProjectSnapshotSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: Id,
  version: z.number().int().nonnegative(),
  input: ProjectInputSchema,
  people: z.array(PersonSchema),
  relationships: z.array(RelationshipSchema),
  claims: z.array(ClaimSchema),
  stories: z.array(StorySchema),
  sources: z.array(SourceSchema),
  assets: z.array(SourceAssetSchema),
  proposals: z.array(ProposalSchema),
  researchEvents: z.array(ResearchEventSchema),
  history: z.array(HistorySchema),
  bookPassages: z.array(BookPassageSchema),
  bookStatus: z.enum(["empty", "stale", "generating", "current", "failed"]),
  layout: z
    .record(z.string(), z.object({ x: z.number(), y: z.number() }))
    .default({}),
  files: z.array(FileOutcomeSchema).default([]),
  issues: z.array(z.string()).default([]),
  run: RunStateSchema.optional(),
  previousRuns: z.array(RunStateSchema).optional(),
  photoAnnotations: z.array(PhotoAnnotationSchema).optional(),
  photoPairs: z.array(PhotoPairSchema).optional(),
});
export type ProjectSnapshot = z.infer<typeof ProjectSnapshotSchema>;
export const ReviewDecisionSchema = z.object({
  proposalId: Id,
  action: z.enum(["accept", "correct", "reject", "unknown"]),
  baseVersion: z.number().int(),
  corrections: z
    .object({
      personId: Id.optional(),
      text: z.string().min(1).optional(),
      predicate: z.string().optional(),
    })
    .optional(),
  requestId: Id.optional(),
});
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export const GraphMutationSchema = z.object({
  operation: z.enum([
    "addPerson",
    "editPerson",
    "addRelationship",
    "editRelationship",
    "undo",
  ]),
  entityId: Id.optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  baseVersion: z.number().int(),
  requestId: Id.optional(),
});
export type GraphMutation = z.infer<typeof GraphMutationSchema>;
export interface Contribution {
  text?: string;
  files?: File[];
  targetPersonId?: string;
  requestId?: string;
  publicRecordUrl?: string;
}
export interface RootsApi {
  answerSetupQuestion?(projectId: string, input: SetupAnswer): Promise<ProjectSnapshot>;
  prepareFamilyBook?(projectId: string): Promise<ProjectSnapshot>;
  cancelRun?(projectId: string): Promise<ProjectSnapshot>;
  bookPreviewUrl?(projectId: string): string;
  retryAnalysis?(projectId: string): Promise<ProjectSnapshot>;
  createProject(input: ProjectInput, files?: File[]): Promise<ProjectSnapshot>;
  getSnapshot(
    projectId: string,
    afterSequence?: number,
  ): Promise<ProjectSnapshot>;
  addContribution(
    projectId: string,
    input: Contribution,
  ): Promise<ProjectSnapshot>;
  reviewProposal(
    projectId: string,
    input: ReviewDecision,
  ): Promise<ProjectSnapshot>;
  mutateGraph(
    projectId: string,
    input: GraphMutation,
  ): Promise<ProjectSnapshot>;
  downloadFamilyBook(projectId: string): Promise<Blob>;
  assetUrl(projectId: string, assetId: string): string;
}
// Bytes exist only at module boundaries. Snapshot contains metadata, never raw bytes.
export interface InputFile {
  uploadId: string;
  originalName: string;
  mediaType: string;
  bytes: Uint8Array;
}
export interface AssetBytes {
  assetId: string;
  bytes: Uint8Array;
}
export interface IngestionResult {
  sources: Source[];
  assets: SourceAsset[];
  assetBytes: AssetBytes[];
  duplicateHashes: string[];
  files: FileOutcome[];
}
export interface ImportResult {
  people: Person[];
  relationships: Relationship[];
  claims: Claim[];
  stories: Story[];
  sources: Source[];
  assets: SourceAsset[];
  assetBytes: AssetBytes[];
  history: HistoryEvent[];
  issues: string[];
  layout: Record<string, { x: number; y: number }>;
  warnings: string[];
}
export interface ImportPreparedFamilyInput {
  seedJson: unknown;
  mediaFiles?: InputFile[];
}
export interface IngestContributionInput {
  text?: string;
  files?: InputFile[];
  targetPersonId?: string;
}
export interface LocalSearchInput {
  query: string;
  sources: Source[];
  limit?: number;
}
export interface LocalSearchResult {
  hits: { sourceId: string; snippet: string; locator: string; score: number }[];
  status: "ok" | "no_match";
}
export interface PublicFetchInput {
  url: string;
  timeoutMs?: number;
  maxBytes?: number;
}
export interface PublicFetchResult {
  status: "ok" | "blocked" | "timeout" | "unavailable";
  source?: Source;
  finalUrl?: string;
  retrievedAt?: string;
  error?: string;
}
export interface BundleInput {
  snapshot: ProjectSnapshot;
  passages: BookPassage[];
  resolveAsset: (assetId: string) => Promise<Uint8Array>;
}
export interface BundleResult {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  manifest: Record<string, unknown>;
}
export interface DataModules {
  importPreparedFamily(input: ImportPreparedFamilyInput): Promise<ImportResult>;
  ingestContribution(input: IngestContributionInput): Promise<IngestionResult>;
  searchLocalSources(input: LocalSearchInput): Promise<LocalSearchResult>;
  fetchPublicRecord(input: PublicFetchInput): Promise<PublicFetchResult>;
  buildFamilyBundle(input: BundleInput): Promise<BundleResult>;
}
