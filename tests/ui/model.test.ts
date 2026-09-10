/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { syntheticSnapshot } from "../../packages/contracts/fixtures";
import {
  branchIds,
  familyLayout,
  progressCounts,
  years,
} from "../../src/ui/model";
import { validateInput } from "../../src/ui/InputScreen";
import type { ResearchEvent } from "../../packages/contracts";
const snapshot = () => structuredClone(syntheticSnapshot);
const event = (values: Partial<ResearchEvent>): ResearchEvent => ({
  runId: "run",
  eventId: "event",
  sequence: 1,
  at: "2026-09-10T16:00:00Z",
  operation: "parse_file",
  state: "completed",
  origin: "live",
  ...values,
});
test("input requires a seed, explicit geography decision and actual material", () => {
  const input = {
    ...snapshot().input,
    seedName: "",
    context: "",
    preparedPacket: false,
  };
  assert.match(validateInput(input, 0)!, /name/);
  input.seedName = "Alex";
  input.geographyUnknown = false;
  assert.match(validateInput(input, 0)!, /location/);
  input.geographyUnknown = true;
  assert.match(validateInput(input, 0)!, /file/);
  assert.equal(validateInput(input, 1), null);
});
test("retries and duplicate hashes do not inflate progress; cached/failed fetches are not live websites", () => {
  const s = snapshot();
  s.sources = [
    {
      ...s.sources[0],
      id: "a",
      contentHash: "same",
      originalLocator: "https://www.example.org/a",
    },
    {
      ...s.sources[0],
      id: "b",
      contentHash: "same",
      originalLocator: "https://example.org/b",
    },
  ];
  s.researchEvents = [
    event({ eventId: "parse-a", sourceId: "a" }),
    event({ eventId: "parse-a", sourceId: "a" }),
    event({ eventId: "parse-b", sourceId: "b" }),
    event({
      eventId: "website-a",
      sourceId: "a",
      operation: "retrieve_website",
    }),
    event({
      eventId: "website-b",
      sourceId: "b",
      operation: "retrieve_website",
    }),
    event({
      eventId: "cached",
      sourceId: "b",
      origin: "cached",
      operation: "retrieve_website",
    }),
    event({
      eventId: "failed",
      sourceId: "b",
      state: "failed",
      operation: "retrieve_website",
    }),
    event({
      eventId: "running",
      sourceId: "b",
      state: "running",
      operation: "analyze_record",
    }),
  ];
  assert.deepEqual(progressCounts(s), {
    files: 1,
    records: 0,
    websites: 1,
    people: 5,
  });
});
test("unknown date values are retained and approximate dates are visibly qualified", () => {
  const p = snapshot().people[0];
  assert.equal(years(p), "? – ?");
  p.lifeYears.birth = { value: "1890", precision: "approximate" };
  assert.equal(years(p), "c. 1890 – ?");
});
test("focused branch includes five generations through a middle-generation seed", () => {
  const s = snapshot();
  s.relationships = s.people.slice(0, -1).map((p, i) => ({
    id: `r${i}`,
    fromPersonId: p.id,
    toPersonId: s.people[i + 1].id,
    type: "parent",
    claimIds: [],
    status: "accepted",
  }));
  assert.equal(branchIds(s).size, 5);
  const { positions } = familyLayout(s.people, s.relationships);
  s.relationships.forEach((r) =>
    assert.ok(positions[r.fromPersonId].y < positions[r.toPersonId].y),
  );
});
test("malformed imported parent cycles cannot hang map layout", () => {
  const s = snapshot();
  s.relationships = [
    {
      id: "a",
      fromPersonId: "person-0",
      toPersonId: "person-1",
      type: "parent",
      claimIds: [],
      status: "unresolved",
    },
    {
      id: "b",
      fromPersonId: "person-1",
      toPersonId: "person-0",
      type: "parent",
      claimIds: [],
      status: "unresolved",
    },
  ];
  const layout = familyLayout(s.people, s.relationships);
  assert.ok(
    Object.values(layout.positions).every(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
    ),
  );
});

test("partners occupy adjacent cards on one generation without changing genealogy", () => {
  const s = snapshot();
  s.relationships = [
    {
      id: "parent",
      fromPersonId: "person-0",
      toPersonId: "person-2",
      type: "parent",
      claimIds: [],
      status: "accepted",
    },
    {
      id: "partners",
      fromPersonId: "person-2",
      toPersonId: "person-3",
      type: "partner",
      claimIds: [],
      status: "accepted",
    },
  ];
  const before = structuredClone(s.relationships);
  const { positions } = familyLayout(s.people, s.relationships);
  assert.equal(positions["person-2"].y, positions["person-3"].y);
  assert.equal(
    Math.abs(positions["person-2"].x - positions["person-3"].x),
    224,
  );
  assert.deepEqual(s.relationships, before);
});

test("explicit branch selection stays on that person and ignores rejected parents", () => {
  const s = snapshot();
  s.relationships = s.people
    .slice(0, -1)
    .map((p, i) => ({
      id: `branch-${i}`,
      fromPersonId: p.id,
      toPersonId: s.people[i + 1].id,
      type: "parent",
      claimIds: [],
      status: "accepted",
    }));
  const before = structuredClone(s.relationships);
  assert.equal(branchIds(s, s.people[0].id).size, 5);
  assert.equal(branchIds(s, s.people[4].id).size, 5);
  s.relationships[2].status = "rejected";
  assert.deepEqual(
    [...branchIds(s, s.people[4].id)],
    [s.people[3].id, s.people[4].id],
  );
  assert.deepEqual(s.relationships.slice(0, 2), before.slice(0, 2));
});

test("round-2 upload preflight uses the shared policy and retains a valid selection over 30 MB", async () => {
  const {validateFiles, fileSize} = await import("../../src/ui/FilePicker");
  const {UPLOAD_LIMITS} = await import("../../packages/contracts/round2");
  assert.equal(validateFiles([{name: "First.zip", size: 20_000_000}, {name: "Second.zip", size: 20_000_000}]), null);
  assert.equal(validateFiles(Array.from({length: 4}, (_, i) => ({name: `${i}.zip`, size: UPLOAD_LIMITS.maxFileBytes}))), null);
  assert.match(validateFiles([{name: "Large.zip", size: UPLOAD_LIMITS.maxFileBytes + 1}])!, /Large.zip/);
  assert.match(validateFiles(Array.from({length: 41}, (_, i) => ({name: `${i}.txt`, size: 1})))!, /Remove 1/);
  assert.match(validateFiles(Array.from({length: 5}, (_, i) => ({name: `${i}.zip`, size: 21_000_000})))!, /100 MB/);
  assert.equal(fileSize(UPLOAD_LIMITS.maxTotalBytes), "100 MB");
});

test("saved map positions remain fixed and new records do not overlap existing nodes", async () => {
  const {stableFamilyLayout} = await import("../../src/ui/model");
  const s = snapshot();
  const first = stableFamilyLayout(s.people.slice(0, 3), s.relationships);
  const next = stableFamilyLayout(s.people, s.relationships, first.positions);
  for (const person of s.people.slice(0, 3)) assert.deepEqual(next.positions[person.id], first.positions[person.id]);
  const positions = Object.values(next.positions);
  assert.equal(new Set(positions.map((p) => `${p.x}:${p.y}`)).size, s.people.length);
});

test("photo comparison accepts only bounded normalized crops", async () => {
  const {usableCrop} = await import("../../src/ui/PhotoComparison");
  assert.equal(usableCrop(undefined), true);
  assert.equal(usableCrop([0.1, 0.1, 0.8, 0.8]), true);
  assert.equal(usableCrop([0, 0, 0, 1]), false);
  assert.equal(usableCrop([-0.1, 0, 1, 1]), false);
  assert.equal(usableCrop([0.5, 0, 0.6, 1]), false);
  assert.equal(usableCrop([NaN, 0, 1, 1]), false);
});
