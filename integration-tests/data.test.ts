import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { dataModules } from "../server/agent/data-modules";
import { readGeneratedZip } from "../server/agent/bundle";
import { createProject } from "../server/agent/service";
import { updateProject, readAsset } from "../server/state/store";
import { reviewProposal } from "../server/state/decisions";
import { validateSnapshot } from "../server/state/validation";
import {
  syntheticSnapshot,
  syntheticProposal,
} from "../packages/contracts/fixtures";
let root: string;
before(async () => {
  root = await mkdtemp(join(tmpdir(), "roots-data-integration-"));
  process.env.ROOTS_DATA_DIR = root;
});
after(async () => {
  await rm(root, { recursive: true, force: true });
});

test("actual ingestion keeps text bytes, exact quotes, hashes and honest unsupported outcomes", async () => {
  const text = Buffer.from("Family note\nAlex repaired watches.");
  const out = await dataModules.ingestContribution({
    files: [
      {
        uploadId: "text",
        originalName: "note.txt",
        mediaType: "text/plain",
        bytes: text,
      },
      {
        uploadId: "zip",
        originalName: "chat.zip",
        mediaType: "application/zip",
        bytes: Buffer.from("PK-unsupported-fixture"),
      },
    ],
  });
  assert.equal(out.files[0].status, "parsed");
  assert.equal(out.files[1].status, "stored_only");
  assert.ok(
    out.sources.some((s) => s.originalText.includes("Alex repaired watches.")),
  );
  assert.ok(out.assetBytes.some((a) => Buffer.from(a.bytes).equals(text)));
  const hit = await dataModules.searchLocalSources({
    query: "Alex",
    sources: out.sources,
    limit: 3,
  });
  assert.equal(hit.status, "ok");
  assert.ok(hit.hits[0].snippet.includes("Alex"));
  assert.equal(
    (
      await dataModules.searchLocalSources({
        query: "NoMatchingPerson",
        sources: out.sources,
        limit: 3,
      })
    ).status,
    "no_match",
  );
});

test("real PDF/ZIP adapter preserves runtime schema and reopens originals on a different local store", async () => {
  let s = await createProject({
    seedName: "Alex Morgan",
    geographyUnknown: true,
    context: "",
    preparedPacket: true,
  });
  s = await updateProject(s.projectId, (draft) => {
    draft.sources.push(structuredClone(syntheticSnapshot.sources[0]));
    draft.proposals.push(structuredClone(syntheticProposal));
  });
  s = await reviewProposal(s.projectId, {
    proposalId: syntheticProposal.id,
    action: "accept",
    baseVersion: s.version,
  });
  s = await updateProject(s.projectId, (draft) => {
    const story = draft.stories[0];
    draft.bookStatus = "current";
    draft.bookPassages = [
      {
        id: "test-passage",
        text: "TEST FIXTURE: The contributor remembers Alex repairing watches.",
        claimIds: story.claimIds,
        sourceIds: story.sourceIds,
        sourceLocators: story.spans,
        acceptedStateVersion: draft.version + 1,
        origin: "prepared",
        model: "TEST_ONLY",
      },
    ];
  });
  const originalAssets = await Promise.all(
    s.assets.map(async (asset) => ({
      asset,
      bytes: await readAsset(s.projectId, asset.id),
    })),
  );
  const bundle = await dataModules.buildFamilyBundle({
    snapshot: s,
    passages: s.bookPassages,
    resolveAsset: (id) => readAsset(s.projectId, id),
  });
  const entries = readGeneratedZip(bundle.bytes);
  const exported = validateSnapshot(
    JSON.parse(entries.get("project.json")!.toString()),
  );
  assert.equal(exported.schemaVersion, "roots-v1");
  assert.deepEqual(exported.sources, s.sources);
  assert.deepEqual(exported.history, s.history);
  assert.equal(exported.bookStatus, "current");
  assert.ok(
    entries.get("book.pdf")!.subarray(0, 4).equals(Buffer.from("%PDF")),
  );
  assert.ok(
    entries.get("book.html")!.toString().includes("synthetic-memory.txt"),
  );
  assert.ok(!entries.get("book.html")!.toString().includes("[object Object]"));
  assert.equal(entries.has("editable-family-map.html"), false);
  for (const { asset, bytes } of originalAssets) {
    const portableAsset = exported.assets.find((a) => a.id === asset.id)!;
    assert.deepEqual(entries.get(portableAsset.storageKey), Buffer.from(bytes));
  }
  process.env.ROOTS_DATA_DIR = join(root, "different-machine");
  try {
    const reopened = await createProject(exported.input, [
      {
        uploadId: "project",
        originalName: "project.json",
        mediaType: "application/json",
        bytes: entries.get("project.json")!,
      },
      ...exported.assets.map((a) => ({
        uploadId: a.id,
        originalName: a.storageKey.split("/").at(-1)!,
        mediaType: a.mediaType,
        bytes: entries.get(a.storageKey)!,
      })),
    ]);
    assert.equal(reopened.stories[0].text, s.stories[0].text);
    assert.deepEqual(reopened.history, s.history);
    assert.equal(reopened.bookStatus, "current");
    assert.ok(!reopened.issues.some((i) => i.includes("unavailable locally")));
    for (const { asset, bytes } of originalAssets)
      assert.deepEqual(await readAsset(reopened.projectId, asset.id), bytes);
  } finally {
    process.env.ROOTS_DATA_DIR = root;
  }
  await assert.rejects(
    dataModules.buildFamilyBundle({
      snapshot: { ...s, bookStatus: "stale" },
      passages: s.bookPassages,
      resolveAsset: (id) => readAsset(s.projectId, id),
    }),
    /Regenerate/,
  );
  await assert.rejects(
    dataModules.buildFamilyBundle({
      snapshot: s,
      passages: s.bookPassages,
      resolveAsset: async () => new Uint8Array([1]),
    }),
    /metadata/,
  );
});
