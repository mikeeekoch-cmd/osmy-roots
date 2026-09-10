import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  DemoManifestSchema,
  DemoManifestV3Schema,
  type DemoManifestV3,
  type Proposal,
  type ResearchPlan,
  type GraphChangeProposal,
} from "../packages/contracts";
import {
  startRound2,
  answerSetupQuestion,
  readStage,
} from "../server/agent/round2";
import {
  executeResearch,
  cycleAction,
  waitForResearch,
  answerBankQuestion,
  reviewGraphProposal,
  pumpResearch,
} from "../server/agent/research";
import { loadProject, updateProject } from "../server/state/store";
import {
  digest,
  researchFingerprint,
  authoritativeMetrics,
} from "../server/state/research";
import {
  connectionStatuses,
  beginConnection,
  disconnectConnection,
} from "../server/connectors/google";
import { searchPublicRecords } from "../server/research/index.mjs";
const fixture = resolve("tests/fixtures/round2/packet");
const at = () => new Date().toISOString();
const intake: any = async (s: any, source: any): Promise<Proposal> => ({
  id: "intake-analysis",
  personId: "F005",
  candidatePersonIds: ["F005"],
  text: "A family recollection about Alder.",
  predicate: "craft",
  evidenceType: "family_recollection",
  sourceIds: [source.id],
  spans: [
    {
      sourceId: source.id,
      locator: source.originalLocator,
      quote: source.originalText,
    },
  ],
  question: "Does this recollection belong to Alder?",
  uncertainty: "Family memory.",
  status: "pending",
  model: "test-stub",
  origin: "live",
  createdAt: at(),
});
const plan: any = async (
  s: any,
  c: any,
  ids: string[],
): Promise<ResearchPlan> => ({
  id: `plan-${c.id}`,
  cycleId: c.id,
  objectives: ["Check the supplied family record."],
  sourceIds: ids,
  queries: [{ kind: "local_search", query: "Alder", sourceIds: ids }],
  createdAt: at(),
  model: "test-stub",
  origin: "live",
});
const analysis: any = async (s: any, c: any, source: any) => ({
  proposal: {
    id: `graph-${randomUUID()}`,
    cycleId: c.id,
    inputFingerprint: researchFingerprint(s),
    deduplicationKey: digest([source.contentHash, c.id]),
    status: "pending",
    createdAt: at(),
    model: "test-stub",
    summary: "A source-backed record awaits review.",
    support: [
      {
        sourceId: source.id,
        locator: source.originalLocator,
        quote: source.originalText.slice(0, 80),
      },
    ],
    evidenceRootIds: [source.contentHash],
    alternatives: [],
    people: [],
    relationships: [],
  },
  question: "What can you confirm about this record?",
  uncertainty: "Unconfirmed.",
  personIds: [],
  candidatePersonIds: [],
});
const deps = { plan, analyze: analysis, intakeAnalyze: { analyze: intake } };
async function setup(extraScopes: DemoManifestV3["researchSources"] = []) {
  const root = await mkdtemp(join(tmpdir(), "roots-r3-test-"));
  process.env.ROOTS_DATA_DIR = root;
  const m = DemoManifestSchema.parse(
    JSON.parse(await readFile(join(fixture, "DEMO_MANIFEST.json"), "utf8")),
  );
  const photo = m.questions.find((q) => q.category === "photo")!;
  const questions = [
    ...m.photos.slice(0, 3).map((p, i) => ({
      ...photo,
      id: `photo-check-${i}`,
      support: p.support,
      personIds: [
        ...new Set(p.positions.map((x) => x.personId).filter(Boolean)),
      ],
      photoAssetId: p.assetId,
      photoEra: i === 0 ? "modern" : "old",
      effect: { kind: "annotation", photoAssetId: p.assetId },
    })),
    m.questions.find((q) => q.category === "origin"),
    m.questions.find((q) => q.requiresAstra),
    m.questions.find((q) => q.category === "conflict"),
  ];
  const support = m.questions.find((q) => q.requiresAstra)!.support;
  const manifest = DemoManifestV3Schema.parse({
    ...m,
    schemaVersion: "roots-demo-v3",
    inputFormat: "register",
    identityKeys: { people: {}, relationships: {}, assets: {} },
    questions,
    oldPhotoAssetIds: m.photos.slice(1, 3).map((p) => p.assetId),
    photoPairs: [],
    researchSources: [
      ...[1, 2, 3].map((n) => ({
        id: `scope-${n}`,
        kind: "local",
        sourceIds: [support[0].sourceId],
        cycleOrdinal: n,
        query: "Alder",
      })),
      ...extraScopes,
    ],
    bookPlan: {
      id: "fictional-book-plan",
      sourceBook: {
        title: "Fictional reference",
        sha256: "a".repeat(64),
        edition: "test",
      },
      language: "en",
      pageRange: [35, 40],
      chapters: [
        {
          id: "chapter-1",
          title: "Supplied recollection",
          text: "Fictional fixture for runtime tests.",
          sourceBookHash: "a".repeat(64),
          sourceLocators: ["paragraph 1"],
          support,
          personIds: m.selectedPersonIds,
          assetIds: [],
          origin: "prepared",
          language: "en",
          fingerprint: "b".repeat(64),
        },
      ],
      selectedPersonIds: m.selectedPersonIds,
      selectedOriginalAssetIds: m.photos.map((p) => p.assetId),
      coverage: [],
    },
  });
  const files = await Promise.all(
    (await readdir(join(fixture, "01-upload"))).map(async (originalName) => ({
      uploadId: originalName,
      originalName,
      mediaType: "application/octet-stream",
      bytes: new Uint8Array(
        await readFile(join(fixture, "01-upload", originalName)),
      ),
    })),
  );
  let s = await startRound2(
    { seedName: "Fictional Family", researchMode: "round3" },
    files,
    { manifest: manifest as any },
  );
  return { root, s, manifest, files };
}
async function ready(extraScopes: DemoManifestV3["researchSources"] = []) {
  const f = await setup(extraScopes);
  await executeResearch(f.s.projectId, deps);
  let s = await loadProject(f.s.projectId);
  for (const q of s.run!.questions)
    s = await answerSetupQuestion(s.projectId, {
      questionId: q.id,
      action:
        q.category === "conflict"
          ? "skip"
          : q.category === "photo"
            ? "unknown"
            : "confirm",
      baseVersion: s.version,
      requestId: `answer-${q.id}`,
    });
  await executeResearch(s.projectId, deps);
  return { ...f, s: await loadProject(s.projectId) };
}
test("six checks, separate intake, three explicit cycles, bank answers and refresh never create a fourth round", async () => {
  const { s: start, root } = await ready();
  try {
    let s = start;
    assert.equal(s.run!.questions.length, 6);
    assert.equal(s.people.length, 0);
    assert.equal(s.research!.intake.status, "ready");
    assert.equal(
      s.research!.jobs.filter((j) => j.kind === "analyze").length,
      1,
    );
    for (const ordinal of [1, 2, 3]) {
      const request = {
        action: ordinal === 1 ? "initial" : "deeper",
        requestId: `click-${ordinal}`,
        baseVersion: s.version,
      };
      await cycleAction(s.projectId, request, deps);
      await cycleAction(s.projectId, request, deps);
      s = await waitForResearch(s.projectId);
      assert.equal(s.research!.cycles.length, ordinal);
      assert.equal(
        s.research!.cycles.at(-1)!.status,
        "completed",
        JSON.stringify(s.research!.jobs),
      );
      assert.ok(s.people.length >= 5);
      assert.ok(s.research!.questionBank.length);
      const count = s.research!.cycles.length;
      await pumpResearch(s.projectId, deps);
      s = await waitForResearch(s.projectId);
      assert.equal(s.research!.cycles.length, count);
    }
    const q = s.research!.questionBank[0];
    s = await answerBankQuestion(s.projectId, {
      questionId: q.id,
      action: "unknown",
      baseVersion: s.version,
      requestId: "later-answer",
    });
    assert.equal(s.run!.answers.length, 6);
    assert.equal(s.research!.intake.status, "ready");
    assert.equal(s.research!.questionBank[0].status, "answered");
    await assert.rejects(
      () =>
        cycleAction(
          s.projectId,
          { action: "deeper", requestId: "fourth", baseVersion: s.version },
          deps,
        ),
      /two deeper/,
    );
    const before = s.research!.cycles.length;
    s = await cycleAction(
      s.projectId,
      { action: "initial", requestId: "repeated-initial", baseVersion: 1 },
      deps,
    );
    assert.equal(s.research!.cycles.length, before);
    const metrics = authoritativeMetrics(s);
    assert.equal(
      metrics.totals.photosReceived,
      new Set(
        s.assets
          .filter((a) => a.mediaType.startsWith("image/"))
          .map((a) => a.contentHash),
      ).size,
    );
    assert.equal(metrics.totals.astraAnalyses, 4);
    assert.equal(metrics.totals.pagesRetrieved, 0);
    assert.equal(metrics.totals.searchAttempts, 3);
  } finally {
    await waitForResearch(start.projectId);
    await rm(root, { recursive: true, force: true });
  }
});
test("failed job retry keeps cycle ID and cannot duplicate saved results", async () => {
  const { s: start, root } = await ready();
  try {
    const broken = {
      ...deps,
      plan: async () => {
        throw new Error("simulated outage");
      },
    };
    await cycleAction(
      start.projectId,
      { action: "initial", requestId: "initial", baseVersion: start.version },
      broken,
    );
    let s = await waitForResearch(start.projectId);
    assert.equal(s.research!.cycles[0].status, "failed");
    const id = s.research!.cycles[0].id;
    s = await cycleAction(
      s.projectId,
      {
        action: "retry",
        cycleId: id,
        requestId: "retry",
        baseVersion: s.version,
      },
      deps,
    );
    s = await waitForResearch(s.projectId);
    assert.equal(s.research!.cycles.length, 1);
    assert.equal(s.research!.cycles[0].id, id);
    assert.equal(s.research!.cycles[0].status, "completed");
    assert.equal(s.research!.jobs.find((j) => j.kind === "plan")!.attempt, 2);
  } finally {
    await waitForResearch(start.projectId);
    await rm(root, { recursive: true, force: true });
  }
});
test("stale analysis cannot apply after a human edit and cancel invalidates the lease", async () => {
  const { s: start, root } = await ready();
  let finish!: (v: any) => void, entered!: () => void;
  const gate = new Promise<void>((r) => (entered = r));
  try {
    const delayed = {
      ...deps,
      analyze: async (...args: any[]) => {
        entered();
        return new Promise<any>(
          (resolve) => (finish = async () => resolve(await analysis(...args))),
        );
      },
    };
    await cycleAction(
      start.projectId,
      { action: "initial", requestId: "start", baseVersion: start.version },
      delayed,
    );
    await gate;
    let s = await updateProject(
      start.projectId,
      (p) => {
        p.input.context = "Human correction during analysis";
        p.people[0].displayNameEn = "Edited family name";
      },
      { invalidateBook: true },
    );
    finish(null);
    s = await waitForResearch(start.projectId);
    assert.equal(s.research!.graphProposals.length, 0);
    assert.ok(s.research!.jobs.some((j) => j.error?.includes("changed")));
  } finally {
    await waitForResearch(start.projectId);
    await rm(root, { recursive: true, force: true });
  }
});
test("source-backed new people require explicit graph review, with atomic ancestry validation", async () => {
  const { s: start, root } = await ready();
  try {
    await cycleAction(
      start.projectId,
      { action: "initial", requestId: "start", baseVersion: start.version },
      deps,
    );
    let s = await waitForResearch(start.projectId);
    const source = s.sources.find((x) => x.originalText.includes("Alder"))!;
    const support = [
      {
        sourceId: source.id,
        locator: source.originalLocator,
        quote: source.originalText,
      },
    ];
    const proposal: GraphChangeProposal = {
      id: "new-person-proposal",
      cycleId: s.research!.cycles[0].id,
      inputFingerprint: researchFingerprint(s),
      deduplicationKey: digest("new-person"),
      status: "pending",
      createdAt: at(),
      model: "test-stub",
      summary: "A separate candidate awaiting explicit review.",
      support,
      evidenceRootIds: [source.contentHash],
      alternatives: [
        {
          personId: s.people[0].id,
          reason: "Same-name alternative, not merged.",
        },
      ],
      people: [
        {
          id: "new-relative",
          displayNameEn: "Alder",
          originalName: "Alder",
          birth: { value: null, precision: "unknown" },
          death: { value: null, precision: "unknown" },
          support,
        },
      ],
      relationships: [],
    };
    s = await updateProject(s.projectId, (p) => {
      p.research!.graphProposals.push(proposal);
    });
    assert.ok(!s.people.some((p) => p.id === "new-relative"));
    s = await reviewGraphProposal(s.projectId, {
      proposalId: proposal.id,
      action: "accept",
      baseVersion: s.version,
      requestId: "accept-new",
    });
    assert.equal(s.people.filter((p) => p.id === "new-relative").length, 1);
    const version = s.version;
    s = await reviewGraphProposal(s.projectId, {
      proposalId: proposal.id,
      action: "accept",
      baseVersion: 1,
      requestId: "accept-new",
    });
    assert.equal(s.version, version);
  } finally {
    await waitForResearch(start.projectId);
    await rm(root, { recursive: true, force: true });
  }
});
test("demo provider state is explicit and never fabricates a verified OAuth read", async () => {
  const root = await mkdtemp(join(tmpdir(), "roots-demo-connect-"));
  process.env.ROOTS_DATA_DIR = root;
  process.env.ROOTS_DEMO_CONNECTIONS = "true";
  try {
    assert.ok(
      (await connectionStatuses()).every((s) => s.status === "disconnected"),
    );
    const connection = await beginConnection("drive");
    assert.match(connection.url, /connection=demo/);
    const drive = (await connectionStatuses()).find(
      (s) => s.provider === "drive",
    )!;
    assert.equal(drive.mode, "demo");
    assert.equal(drive.status, "connected");
    assert.equal(drive.verifiedAt, undefined);
    assert.equal(drive.accountDisplay, "Demo: prepared local copies");
    await disconnectConnection("drive");
    assert.equal((await connectionStatuses())[0].status, "disconnected");
  } finally {
    delete process.env.ROOTS_DEMO_CONNECTIONS;
    await rm(root, { recursive: true, force: true });
  }
});

test("cancelled in-flight jobs cannot publish a late proposal", async () => {
  const { s: start, root } = await ready();
  let finish!: (v: any) => void, entered!: () => void;
  const gate = new Promise<void>((r) => (entered = r));
  try {
    const delayed = {
      ...deps,
      analyze: async (...args: any[]) => {
        entered();
        return new Promise<any>(
          (resolve) => (finish = async () => resolve(await analysis(...args))),
        );
      },
    };
    await cycleAction(
      start.projectId,
      {
        action: "initial",
        requestId: "start-cancel",
        baseVersion: start.version,
      },
      delayed,
    );
    await gate;
    let s = await loadProject(start.projectId);
    const cycleId = s.research!.cycles[0].id;
    s = await cycleAction(
      s.projectId,
      {
        action: "cancel",
        cycleId,
        requestId: "cancel",
        baseVersion: s.version,
      },
      delayed,
    );
    finish(null);
    s = await waitForResearch(s.projectId);
    assert.equal(s.research!.cycles[0].status, "cancelled");
    assert.equal(s.research!.graphProposals.length, 0);
    assert.ok(
      s
        .research!.jobs.filter((j) => j.kind === "analyze" && j.cycleId)
        .every((j) => j.status === "cancelled"),
    );
  } finally {
    await waitForResearch(start.projectId);
    await rm(root, { recursive: true, force: true });
  }
});

test("unknown bank answers do not reopen initial checks and corrections invalidate the current book", async () => {
  const { s: start, root } = await ready();
  try {
    await cycleAction(
      start.projectId,
      {
        action: "initial",
        requestId: "start-answer",
        baseVersion: start.version,
      },
      deps,
    );
    let s = await waitForResearch(start.projectId);
    const q = s.research!.questionBank[0];
    s = await updateProject(s.projectId, (p) => {
      p.research!.questionBank[0].personIds = [p.people[0].id];
      p.research!.bookEdition = {
        id: "sealed-state-fixture",
        fingerprint: researchFingerprint(p),
        status: "sealed",
        stateVersion: p.version,
        pageCount: 35,
        createdAt: at(),
        sealedAt: at(),
        chapterFingerprints: {},
      };
    });
    const editionFingerprint = s.research!.bookEdition!.fingerprint;
    s = await updateProject(
      s.projectId,
      (p) => {
        p.research!.jobs[0].summary = "Completed source parsing.";
      },
      { invalidateBook: true },
    );
    assert.equal(
      s.research!.bookEdition!.status,
      "sealed",
      "Job bookkeeping must not invalidate unchanged content",
    );
    s = await answerBankQuestion(s.projectId, {
      questionId: q.id,
      action: "confirm",
      baseVersion: s.version,
      requestId: "bank-confirm",
    });
    assert.equal(
      s.claims.find((c) => c.id === `bank-claim-${q.id}`)!.status,
      "accepted",
    );
    assert.equal(s.research!.bookEdition!.status, "stale");
    assert.equal(s.research!.previousEditions.at(-1)!.status, "sealed");
    assert.equal(
      s.research!.previousEditions.at(-1)!.fingerprint,
      editionFingerprint,
    );
    s = await answerBankQuestion(s.projectId, {
      questionId: q.id,
      action: "correct",
      text: "The narrator left this uncertain.",
      baseVersion: s.version,
      requestId: "bank-correct",
    });
    assert.equal(
      s.claims.find((c) => c.id === `bank-claim-${q.id}`)!.value,
      "The narrator left this uncertain.",
    );
    assert.equal(
      s.sources.filter((source) => source.id === "answer-bank-correct").length,
      1,
    );
    s = await answerBankQuestion(s.projectId, {
      questionId: q.id,
      action: "unknown",
      baseVersion: s.version,
      requestId: "bank-unknown",
    });
    assert.equal(
      s.claims.find((c) => c.id === `bank-claim-${q.id}`)!.status,
      "superseded",
    );
    assert.equal(s.run!.answers.length, 6);
    assert.equal(s.research!.intake.status, "ready");
  } finally {
    await waitForResearch(start.projectId);
    await rm(root, { recursive: true, force: true });
  }
});

test("an empty record analysis remains a completed no-match outcome without fabricated findings", async () => {
  const { s: start, root } = await ready();
  try {
    await cycleAction(
      start.projectId,
      {
        action: "initial",
        requestId: "empty-record",
        baseVersion: start.version,
      },
      {
        ...deps,
        analyze: async () => ({
          noMatch: true,
          summary: "No supported new finding in this record.",
        }),
      },
    );
    const s = await waitForResearch(start.projectId);
    assert.equal(s.research!.cycles[0].status, "completed");
    assert.equal(s.research!.graphProposals.length, 0);
    assert.equal(s.research!.questionBank.length, 0);
    assert.ok(
      s.research!.jobs.some(
        (job) =>
          job.cycleId && job.kind === "analyze" && job.status === "no_match",
      ),
    );
    assert.equal(s.research!.metrics!.cycles[0].delta.people, s.people.length);
  } finally {
    await waitForResearch(start.projectId);
    await rm(root, { recursive: true, force: true });
  }
});

test("an unconfigured public provider records a blocked job with no network search or page credit", async () => {
  const { s: start, root } = await ready([
    {
      id: "selected-public-query",
      kind: "public",
      query: "Fictional family archive",
      sourceIds: [],
      personIds: [],
      cycleOrdinal: 1,
    },
  ]);
  try {
    await cycleAction(
      start.projectId,
      {
        action: "initial",
        requestId: "search-missing-config",
        baseVersion: start.version,
      },
      {
        ...deps,
        publicSearch: (args) =>
          searchPublicRecords({ ...args, query: args?.query || "", env: {} }),
      },
    );
    const s = await waitForResearch(start.projectId),
      publicJob = s.research!.jobs.find((job) => job.kind === "public_search")!;
    assert.equal(s.research!.cycles[0].status, "completed");
    assert.equal(publicJob.status, "blocked");
    assert.equal(publicJob.networkAttempts, 0);
    assert.equal(publicJob.urls.length, 0);
    assert.equal(s.research!.metrics!.totals.pagesRetrieved, 0);
    assert.equal(s.research!.metrics!.totals.searchAttempts, 1);
  } finally {
    await waitForResearch(start.projectId);
    await rm(root, { recursive: true, force: true });
  }
});
