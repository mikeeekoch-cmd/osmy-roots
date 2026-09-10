import { createHash } from "node:crypto";
import {
  type ProjectSnapshot,
  type ResearchMetrics,
  MetricTotalsSchema,
} from "../../packages/contracts";
export const digest = (value: unknown) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export function researchFingerprint(s: ProjectSnapshot) {
  return digest({
    people: s.people,
    relationships: s.relationships,
    claims: s.claims,
    stories: s.stories,
    sources: s.sources.map((x) => [x.id, x.contentHash]),
    answers: s.run?.answers,
    questions: s.research?.questionBank.map((q) => [q.id, q.answers]),
    assets: s.assets.map((a) => [a.id, a.contentHash]),
    photoAnnotations: s.photoAnnotations,
    photoPairs: s.photoPairs,
    portraits: s.research?.portraits,
    bookPlan: s.research?.bookPlan,
  });
}
export function authoritativeMetrics(s: ProjectSnapshot): ResearchMetrics {
  const r = s.research,
    zeros = Object.fromEntries(
      Object.keys(MetricTotalsSchema.shape).map((k) => [k, 0]),
    ) as any;
  const jobs = r?.jobs || [],
    derivativeIds = new Set((s.photoPairs || []).map((p) => p.enhancedAssetId));
  const originals = s.assets.filter(
    (a) =>
      a.mediaType.startsWith("image/") &&
      a.role !== "derivative" &&
      !derivativeIds.has(a.id),
  );
  const distinct = (values: (string | undefined)[]) =>
    new Set(values.filter(Boolean)).size;
  const fileKey = (f: ProjectSnapshot["files"][number]) =>
    s.assets.find((a) => f.assetIds.includes(a.id))?.contentHash || f.uploadId;
  const urls = jobs
    .filter((j) => j.status === "completed" && j.kind === "crawl")
    .flatMap((j) => j.urls);
  const pages = [...new Set(urls)];
  const reviewed = new Set(
    s.research?.graphProposals
      .filter((p) => p.status === "accepted")
      .flatMap((p) => p.people.map((x) => x.id)) || [],
  );
  const totals = {
    ...zeros,
    people: s.people.length,
    candidatePeople: s.people.filter((p) => p.recordStatus === "candidate")
      .length,
    reviewedPeople: s.people.filter(
      (p) => p.recordStatus === "reviewed" || reviewed.has(p.id),
    ).length,
    sourcesSelected: distinct(s.files.map(fileKey)),
    sourcesProcessed: distinct(
      s.files.filter((f) => f.status === "parsed").map(fileKey),
    ),
    sourcesFailed: distinct(
      s.files.filter((f) => f.status === "failed").map(fileKey),
    ),
    documentsRead: distinct(
      s.files
        .filter(
          (f) =>
            f.status === "parsed" &&
            !f.assetIds.some((id) =>
              s.assets.some(
                (a) => a.id === id && a.mediaType.startsWith("image/"),
              ),
            ),
        )
        .map(fileKey),
    ),
    photosReceived: distinct(originals.map((a) => a.contentHash || a.id)),
    photosIndexed: distinct(
      originals
        .filter(
          (a) =>
            a.indexedAt ||
            s.files.some(
              (f) => f.status === "parsed" && f.assetIds.includes(a.id),
            ),
        )
        .map((a) => a.contentHash || a.id),
    ),
    oldPhotosSelected: distinct(r?.oldPhotoAssetIds || []),
    enhancedPhotosReady: distinct(
      r?.photoPairQA
        .filter(
          (p) =>
            p.qa.status === "passed" &&
            p.alignment.mode === "aligned" &&
            s.assets.some(
              (a) =>
                a.id === p.originalAssetId && a.contentHash === p.originalHash,
            ) &&
            s.assets.some(
              (a) =>
                a.id === p.enhancedAssetId && a.contentHash === p.enhancedHash,
            ),
        )
        .map((p) => p.originalHash) || [],
    ),
    evidenceChecked: distinct(r?.validationOutcomes.map((v) => v.key) || []),
    astraAnalyses: distinct(
      jobs
        .filter((j) => j.kind === "analyze" && j.status === "completed")
        .map((j) => j.id),
    ),
    searchAttempts: jobs
      .filter((j) =>
        ["local_search", "public_search", "drive_read", "gmail_read"].includes(
          j.kind,
        ),
      )
      .reduce((n, j) => n + j.attempt, 0),
    pagesRetrieved: pages.length,
    cachedPages: distinct(
      jobs
        .filter(
          (j) =>
            j.status === "completed" &&
            j.kind === "crawl" &&
            j.origin === "cached",
        )
        .flatMap((j) => j.urls),
    ),
    uniqueDomains: distinct(
      pages.map((u) => {
        try {
          return new URL(u).hostname;
        } catch {
          return undefined;
        }
      }),
    ),
    newFindings: distinct([
      ...(r?.graphProposals.map((p) => p.id) || []),
      ...s.proposals.map((p) => p.id),
    ]),
    reviewedAdditions: reviewed.size,
    openQuestions:
      r?.questionBank.filter((q) => q.status === "open").length || 0,
  };
  return {
    asOfVersion: s.version,
    totals,
    cycles: (r?.cycles || []).map((c) => {
      const own = jobs.filter((j) => j.cycleId === c.id),
        proposals = r!.graphProposals.filter((p) => p.cycleId === c.id),
        pages = [
          ...new Set(
            own
              .filter((j) => j.status === "completed" && j.kind === "crawl")
              .flatMap((j) => j.urls),
          ),
        ];
      return {
        cycleId: c.id,
        delta: {
          ...zeros,
          people: distinct([
            ...own
              .flatMap((j) => j.resultIds)
              .filter((id) => s.people.some((p) => p.id === id)),
            ...proposals
              .filter((p) => p.status === "accepted")
              .flatMap((p) => p.people.map((person) => person.id)),
          ]),
          evidenceChecked: distinct(
            r!.validationOutcomes
              .filter((v) => v.cycleId === c.id)
              .map((v) => v.key),
          ),
          astraAnalyses: own.filter(
            (j) => j.kind === "analyze" && j.status === "completed",
          ).length,
          searchAttempts: own
            .filter((j) =>
              [
                "local_search",
                "public_search",
                "drive_read",
                "gmail_read",
              ].includes(j.kind),
            )
            .reduce((n, j) => n + j.attempt, 0),
          pagesRetrieved: pages.length,
          cachedPages: distinct(
            own
              .filter(
                (j) =>
                  j.status === "completed" &&
                  j.kind === "crawl" &&
                  j.origin === "cached",
              )
              .flatMap((j) => j.urls),
          ),
          uniqueDomains: distinct(pages.map((u) => new URL(u).hostname)),
          newFindings: proposals.length,
          reviewedAdditions: proposals
            .filter((p) => p.status === "accepted")
            .reduce((n, p) => n + p.people.length, 0),
          openQuestions: r!.questionBank.filter(
            (q) => q.cycleId === c.id && q.status === "open",
          ).length,
        },
      };
    }),
  };
}
