import { createHash } from "node:crypto";
import {
  ingestContribution as ingestRaw,
  importPreparedFamily as importRaw,
} from "../ingestion/index.mjs";
import {
  searchLocalSources as searchRaw,
  fetchPublicRecord as fetchRaw,
} from "../research/index.mjs";
import {
  ProjectSnapshotSchema,
  SourceSchema,
  SourceAssetSchema,
  ClaimSchema,
  PersonSchema,
  StorySchema,
  RelationshipSchema,
  HistorySchema,
  type DataModules,
  type Source,
  type SourceAsset,
  type AssetBytes,
  type ImportResult,
  type IngestionResult,
} from "../../packages/contracts";
import { AppError } from "../state/validation";
import { buildRuntimeBundle } from "./bundle";
// Compatibility boundary for Claude's dependency-free ESM modules. Public runtime
// schemas remain authoritative; no worker-owned implementation is rewritten here.
type Raw = Record<string, any>;
const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
function source(raw: Raw): Source {
  return SourceSchema.parse({
    ...raw,
    contentHash: raw.contentHash || hash(raw.originalText || ""),
    originalText: raw.originalText || "",
    url: raw.url || raw.finalUrl,
  });
}
function normalizeAssets(raw: Raw, sources: Source[], files: Raw[] = []) {
  const assets: SourceAsset[] = [],
    assetBytes: AssetBytes[] = [];
  for (const a of raw.assets || []) {
    let sourceId = a.sourceId;
    if (!sourceId) {
      sourceId = `source-${a.id}`;
      sources.push(
        source({
          id: sourceId,
          kind: "stored_file",
          originalLocator: a.originalName,
          contentHash: a.contentHash,
          originalText: "",
          origin: a.origin || "live",
          title: a.originalName,
        }),
      );
    }
    assets.push(
      SourceAssetSchema.parse({ ...a, sourceId, storageKey: `assets/${a.id}` }),
    );
    if (a.bytes)
      assetBytes.push({ assetId: a.id, bytes: new Uint8Array(a.bytes) });
  }
  // Preserve original parsed bytes as assets as well as extracted source text.
  for (const s of raw.sources || []) {
    if (!s.bytes) continue;
    const file = files.find((f) => hash(f.bytes) === s.contentHash);
    const id = `original-${s.id}`;
    const originalName = file?.originalName || s.title || `${s.id}.txt`;
    assets.push({
      id,
      sourceId: s.id,
      originalName,
      mediaType: s.mediaType || "text/plain",
      byteLength: s.bytes.length,
      storageKey: `assets/${id}`,
      contentHash: s.contentHash,
    });
    assetBytes.push({ assetId: id, bytes: new Uint8Array(s.bytes) });
  }
  return { assets, assetBytes };
}
async function ingest(
  input: Parameters<DataModules["ingestContribution"]>[0],
): Promise<IngestionResult> {
  const raw = (await ingestRaw({
    ...input,
    files: input.files?.map((f) => ({ ...f, bytes: Buffer.from(f.bytes) })),
  })) as Raw;
  const sources = (raw.sources || []).map(source);
  const { assets, assetBytes } = normalizeAssets(raw, sources, input.files);
  return {
    sources,
    assets,
    assetBytes,
    duplicateHashes: (raw.duplicateHashes || []).map((x: Raw | string) =>
      typeof x === "string" ? x : x.contentHash,
    ),
    files: (raw.files || []).map((f: Raw) => ({
      ...f,
      warnings: [
        ...(f.warnings || []),
        ...(f.status === "failed" && f.reason ? [f.reason] : []),
      ],
      assetIds: [
        ...new Set([
          ...(f.assetIds || []),
          ...assets
            .filter((a) => (f.sourceIds || []).includes(a.sourceId))
            .map((a) => a.id),
        ]),
      ],
    })),
  };
}
async function importPrepared(
  input: Parameters<DataModules["importPreparedFamily"]>[0],
): Promise<ImportResult> {
  const saved = ProjectSnapshotSchema.safeParse(input.seedJson);
  if (saved.success) {
    const s = saved.data;
    const media = await ingest({ files: input.mediaFiles });
    return {
      people: s.people,
      relationships: s.relationships,
      claims: s.claims,
      stories: s.stories,
      sources: [...s.sources, ...media.sources],
      assets: [...s.assets, ...media.assets],
      assetBytes: media.assetBytes,
      history: s.history,
      issues: s.issues,
      layout: s.layout,
      warnings: [],
    };
  }
  const raw = (await importRaw({
    seedJson: input.seedJson as object,
    mediaFiles: input.mediaFiles?.map((f) => ({
      ...f,
      bytes: Buffer.from(f.bytes),
    })),
  })) as Raw;
  const seed = input.seedJson as Raw;
  const records: Raw[] = seed.persons || seed.people || [];
  const rels: Raw[] = seed.relationships || [];
  const originalText = JSON.stringify(seed, null, 2),
    seedSource: Source = source({
      id: "source-prepared-tree",
      kind: "prepared_tree",
      originalLocator: "prepared-family.json (normalized JSON)",
      extractionMethod:
        "JSON object serialization; original uploaded bytes are retained separately",
      contentHash: hash(originalText),
      originalText,
      origin: "prepared",
      title:
        "Imported family tree. Existing assertions; primary references may be unavailable.",
    });
  const sources: Source[] = [
    seedSource,
    ...(raw.sources || [])
      .filter((s: Raw) => s.originalText && s.contentHash)
      .map(source),
  ];
  const issues = (raw.issues || []).map((i: Raw | string) =>
    typeof i === "string" ? i : i.message || JSON.stringify(i),
  );
  const warnings = [
    ...(raw.warnings || []),
    "Imported assertions cite the supplied tree JSON. This import does not independently verify the tree or its referenced primary records.",
  ];
  const { assets, assetBytes } = normalizeAssets(
    raw,
    sources,
    input.mediaFiles,
  );
  function spansFor(personId: string, claim?: Raw) {
    const row = claim?.predicate?.startsWith("relationship_")
      ? rels.find(
          (r) =>
            (r.person_1_id || r.fromPersonId) === claim.value?.from &&
            (r.person_2_id || r.toPersonId) === claim.value?.to,
        )
      : records.find((p) => String(p.id) === personId);
    const compact = row ? JSON.stringify(row, null, 2) : "";
    const quote = compact
      ? compact
          .split("\n")
          .map((line, i) => (i ? `    ${line}` : line))
          .join("\n")
      : ""; // Find the exact formatted object within the stored seed.
    const value =
      claim && typeof claim.value === "string"
        ? JSON.stringify(claim.value)
        : "";
    const actual =
      quote && originalText.includes(quote)
        ? quote
        : value && originalText.includes(value)
          ? value
          : "";
    if (!actual || !originalText.includes(actual))
      throw new AppError(
        "Imported claim cannot be located in its original tree JSON.",
      );
    return [
      {
        sourceId: seedSource.id,
        locator: seedSource.originalLocator,
        quote: actual,
      },
    ];
  }
  const claims = (raw.claims || []).map((c: Raw) =>
    ClaimSchema.parse({
      ...c,
      value: typeof c.value === "string" ? c.value : JSON.stringify(c.value),
      sourceIds: [seedSource.id],
      spans: spansFor(c.subjectId, c),
      evidenceType: "family_document",
    }),
  );
  const stories = (raw.stories || []).map((st: Raw) => {
    const claimId = `claim-${st.id}`;
    const spans = spansFor(st.subjectId, { value: st.text });
    claims.push(
      ClaimSchema.parse({
        id: claimId,
        subjectId: st.subjectId,
        predicate: "imported_story",
        value: st.text,
        sourceIds: [seedSource.id],
        spans,
        status: st.status === "accepted" ? "accepted" : "unresolved",
        evidenceType: "family_recollection",
        version: 1,
      }),
    );
    return StorySchema.parse({
      id: st.id,
      personId: st.subjectId,
      text: st.text,
      sourceIds: [seedSource.id],
      claimIds: [claimId],
      spans,
      evidenceType: "family_recollection",
      status: st.status === "accepted" ? "accepted" : "unresolved",
      attribution: st.attributedTo || "Imported family recollection",
    });
  });
  function date(d: Raw) {
    return {
      value: d?.value ?? null,
      precision: d?.value
        ? d.precision === "year_only"
          ? "year"
          : d.precision === "exact"
            ? "day"
            : d.precision || "unknown"
        : "unknown",
    };
  }
  const people = (raw.people || []).map((p: Raw) =>
    PersonSchema.parse({
      ...p,
      lifeYears: {
        birth: date(p.lifeYears.birth),
        death: date(p.lifeYears.death),
      },
      storyIds: stories
        .filter((st: { personId: string }) => st.personId === p.id)
        .map((st: { id: string }) => st.id),
      claimIds: claims
        .filter((c: { subjectId: string }) => c.subjectId === p.id)
        .map((c: { id: string }) => c.id),
    }),
  );
  const relationships = (raw.relationships || []).map((r: Raw) =>
    RelationshipSchema.parse({
      ...r,
      type:
        r.type === "parent_child"
          ? "parent"
          : r.type === "spouse"
            ? "partner"
            : r.type,
    }),
  );
  const history = (raw.history || []).map((h: Raw) =>
    HistorySchema.parse({
      ...h,
      sourceIds: [seedSource.id],
      claimIds: [],
      projectVersion: 1,
    }),
  );
  return {
    people,
    relationships,
    claims,
    stories,
    sources,
    assets,
    assetBytes,
    history,
    issues,
    layout: raw.layout?.positions || {},
    warnings,
  };
}
export const dataModules: DataModules = {
  importPreparedFamily: importPrepared,
  ingestContribution: ingest,
  async searchLocalSources(input) {
    const out = await searchRaw(input);
    return { hits: out.hits, status: out.hits.length ? "ok" : "no_match" };
  },
  async fetchPublicRecord(input) {
    const out = (await fetchRaw(input)) as Raw;
    return {
      status:
        out.status === "ok"
          ? "ok"
          : out.status === "timeout"
            ? "timeout"
            : ["blocked", "not_allowed"].includes(out.status)
              ? "blocked"
              : "unavailable",
      source: out.source ? source(out.source) : undefined,
      finalUrl: out.finalUrl,
      retrievedAt: out.retrievedAt,
      error: typeof out.error === "string" ? out.error : out.error?.message,
    };
  },
  buildFamilyBundle: buildRuntimeBundle,
};
