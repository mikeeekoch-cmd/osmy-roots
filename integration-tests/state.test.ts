import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { selectBookClaims } from "../server/agent/astra";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  syntheticSnapshot,
  syntheticProposal,
} from "../packages/contracts/fixtures";
import {
  createSavedProject,
  loadProject,
  updateProject,
  readAsset,
} from "../server/state/store";
import { reviewProposal, mutateGraph } from "../server/state/decisions";
import { validateSnapshot } from "../server/state/validation";
import { event, counters } from "../server/events";
let dir: string;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "roots-state-test-"));
  process.env.ROOTS_DATA_DIR = dir;
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});
async function seed() {
  const s = structuredClone(syntheticSnapshot);
  s.projectId = randomUUID();
  s.proposals = [structuredClone(syntheticProposal)];
  return createSavedProject(s);
}
test("accept persists attributed memory, exact original quote, source and history", async () => {
  let s = await seed();
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "accept",
    baseVersion: s.version,
  });
  const reopened = await loadProject(s.projectId);
  assert.equal(reopened.stories.length, 1);
  assert.equal(reopened.claims.length, 1);
  assert.equal(reopened.stories[0].evidenceType, "family_recollection");
  assert.equal(
    reopened.stories[0].spans[0].quote,
    syntheticProposal.spans[0].quote,
  );
  assert.equal(reopened.people[2].storyIds[0], reopened.stories[0].id);
  assert.equal(reopened.history.length, 1);
  assert.equal(reopened.version, 2);
});
test("unknown and rejection do not become accepted family facts", async () => {
  let s = await seed();
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "unknown",
    baseVersion: s.version,
  });
  assert.equal(s.proposals[0].status, "unknown");
  assert.equal(s.stories.length, 0);
  assert.equal(s.claims.length, 0);
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "reject",
    baseVersion: s.version,
  });
  assert.equal(s.proposals[0].status, "rejected");
  assert.equal(s.history.length, 2);
  assert.equal(s.stories.length, 0);
});
test("repeated and concurrent review is idempotent even with original baseVersion", async () => {
  const s = await seed();
  const input = {
    proposalId: syntheticProposal.id,
    action: "accept",
    baseVersion: s.version,
    requestId: "same-review",
  };
  const results = await Promise.all([
    reviewProposal(s.projectId, input),
    reviewProposal(s.projectId, input),
  ]);
  assert.equal(results[0].version, results[1].version);
  const repeated = await reviewProposal(s.projectId, input);
  assert.equal(repeated.history.length, 1);
  assert.equal(repeated.stories.length, 1);
});
test("stale different decision is rejected without overwriting accepted work", async () => {
  const s = await seed();
  await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "accept",
    baseVersion: s.version,
  });
  await assert.rejects(
    () =>
      reviewProposal(s.projectId, {
        proposalId: syntheticProposal.id,
        action: "correct",
        baseVersion: s.version,
        corrections: { text: "Changed" },
      }),
    { code: "STALE_VERSION" },
  );
  assert.equal(
    (await loadProject(s.projectId)).stories[0].text,
    syntheticProposal.text,
  );
});
test("correction moves story to selected person and keeps original quotation", async () => {
  let s = await seed();
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "accept",
    baseVersion: s.version,
  });
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "correct",
    baseVersion: s.version,
    corrections: {
      personId: "person-1",
      text: "The contributor corrects the intended relative to Robin.",
    },
  });
  assert.equal(s.stories.length, 1);
  assert.equal(s.stories[0].personId, "person-1");
  assert.equal(s.people[2].storyIds.length, 0);
  assert.equal(s.people[1].storyIds.length, 1);
  assert.equal(s.stories[0].spans[0].quote, syntheticProposal.spans[0].quote);
  const correction = s.sources.find((source) => source.kind === "human_edit")!;
  assert.ok(correction.originalText.includes("Intended person: person-1"));
  assert.ok(
    s.stories[0].spans.some(
      (span) =>
        span.sourceId === correction.id &&
        span.quote === correction.originalText,
    ),
  );
  assert.ok(s.history.at(-1)!.sourceIds.includes(correction.id));
  assert.equal(s.claims[0].version, 2);
  assert.equal(s.history.length, 2);
});
test("book selection follows the latest reviewed person after correcting an earlier story", async () => {
  let s = await seed();
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "accept",
    baseVersion: s.version,
  });
  s = await updateProject(s.projectId, (draft) => {
    const originalText =
      "I remember Taylor Morgan keeping a workshop notebook.";
    draft.sources.push({
      ...draft.sources[0],
      id: "source-taylor",
      originalLocator: "taylor.txt",
      originalText,
    });
    draft.proposals.push({
      ...structuredClone(syntheticProposal),
      id: "proposal-taylor",
      personId: "person-3",
      candidatePersonIds: ["person-3"],
      text: originalText,
      sourceIds: ["source-taylor"],
      spans: [
        {
          sourceId: "source-taylor",
          locator: "taylor.txt",
          quote: originalText,
        },
      ],
    });
  });
  s = await reviewProposal(s.projectId, {
    proposalId: "proposal-taylor",
    action: "accept",
    baseVersion: s.version,
  });
  assert.deepEqual(
    [...new Set(selectBookClaims(s).map((c) => c.subjectId))],
    ["person-3"],
  );
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "correct",
    baseVersion: s.version,
    corrections: {
      personId: "person-1",
      text: "The contributor meant Robin Morgan in the original recollection.",
    },
  });
  assert.deepEqual(
    [...new Set(selectBookClaims(s).map((c) => c.subjectId))],
    ["person-1"],
  );
  assert.equal(s.stories.length, 2);
});
test("same-name candidates remain separate until explicit correction chooses a person", async () => {
  let s = await seed();
  s = await updateProject(s.projectId, (s) => {
    s.people[1].displayNameEn = "Alex Morgan";
    s.proposals[0].candidatePersonIds = ["person-1", "person-2"];
    s.proposals[0].personId = null;
  });
  await assert.rejects(() =>
    reviewProposal(s.projectId, {
      proposalId: syntheticProposal.id,
      action: "accept",
      baseVersion: s.version,
    }),
  );
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "correct",
    baseVersion: s.version,
    corrections: { personId: "person-1" },
  });
  assert.equal(s.people.length, 5);
  assert.equal(s.stories[0].personId, "person-1");
});
test("manual edit persists evidence and undo records a new version", async () => {
  let s = await seed();
  const initial = s.people[2].displayNameEn;
  s = await mutateGraph(s.projectId, {
    operation: "editPerson",
    entityId: "person-2",
    values: { displayNameEn: "Alexander Morgan" },
    baseVersion: s.version,
  });
  assert.equal(
    (await loadProject(s.projectId)).people[2].displayNameEn,
    "Alexander Morgan",
  );
  assert.equal(s.claims[0].evidenceType, "user_correction");
  const editedVersion = s.version;
  s = await mutateGraph(s.projectId, {
    operation: "undo",
    baseVersion: s.version,
  });
  assert.equal(s.people[2].displayNameEn, initial);
  assert.equal(s.version, editedVersion + 1);
  assert.ok(s.history[1].action.startsWith("undo:"));
  await assert.rejects(() =>
    mutateGraph(s.projectId, { operation: "undo", baseVersion: s.version }),
  );
});
test("parent cycles, self-parent links, unknown references and citation forgery fail atomically", async () => {
  let s = await seed();
  const base = s.version;
  await assert.rejects(() =>
    mutateGraph(s.projectId, {
      operation: "addRelationship",
      values: {
        fromPersonId: "person-2",
        toPersonId: "person-2",
        type: "parent",
      },
      baseVersion: base,
    }),
  );
  assert.equal((await loadProject(s.projectId)).version, base);
  s = await mutateGraph(s.projectId, {
    operation: "addRelationship",
    values: {
      fromPersonId: "person-1",
      toPersonId: "person-2",
      type: "parent",
    },
    baseVersion: s.version,
  });
  await assert.rejects(() =>
    mutateGraph(s.projectId, {
      operation: "addRelationship",
      values: {
        fromPersonId: "person-2",
        toPersonId: "person-1",
        type: "parent",
      },
      baseVersion: s.version,
    }),
  );
  const bad = structuredClone(s);
  bad.proposals[0].spans[0].quote = "A quotation absent from the source";
  assert.throws(() => validateSnapshot(bad));
  await assert.rejects(() => readAsset(s.projectId, "../../secret"));
});
test("book invalidation follows accepted edits; event-only writes keep current text valid", async () => {
  let s = await seed();
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "accept",
    baseVersion: s.version,
  });
  s = await updateProject(s.projectId, (s) => {
    s.bookStatus = "current";
    s.bookPassages = [
      {
        id: "passage-1",
        text: "An attributed memory.",
        claimIds: [s.claims[0].id],
        sourceIds: s.claims[0].sourceIds,
        sourceLocators: s.claims[0].spans,
        acceptedStateVersion: s.version + 1,
        origin: "prepared",
      },
    ];
  });
  s = await updateProject(s.projectId, (s) =>
    event(s, {
      runId: "export",
      operation: "export_project",
      origin: "live",
      state: "completed",
    }),
  );
  assert.equal(s.bookStatus, "current");
  assert.equal(s.bookPassages[0].acceptedStateVersion, s.version);
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "correct",
    baseVersion: s.version,
    corrections: { text: "A corrected recollection." },
  });
  assert.equal(s.bookStatus, "stale");
  assert.notEqual(s.bookPassages[0].acceptedStateVersion, s.version);
});
test("counters deduplicate completed events and never count models as websites", async () => {
  const s = await seed();
  event(s, {
    runId: "r",
    eventId: "once",
    operation: "analyze_record",
    origin: "live",
    state: "completed",
    sourceId: "source-memory",
  });
  event(s, {
    runId: "r",
    eventId: "once",
    operation: "analyze_record",
    origin: "live",
    state: "completed",
    sourceId: "source-memory",
  });
  event(s, {
    runId: "r2",
    operation: "analyze_record",
    origin: "live",
    state: "completed",
    sourceId: "source-memory",
  });
  assert.deepEqual(counters(s), {
    peopleInMap: 5,
    filesProcessed: 0,
    recordsAnalyzed: 1,
    websitesRead: 0,
  });
});
