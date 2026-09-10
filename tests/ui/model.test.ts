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

test("saved arrivals follow versioned entity changes, not polling or event-only updates", async () => {
  const { savedDelta } = await import("../../src/ui/SavedArrivals");
  const before = snapshot(),
    after = snapshot();
  assert.equal(savedDelta(before, after), null);
  after.version++;
  after.researchEvents.push(event({ eventId: "work-only" }));
  assert.equal(savedDelta(before, after), null);
  after.people[0].displayNameEn = "Corrected name";
  after.people[0].photoIds = ["new-original"];
  after.assets.push({
    id: "new-original",
    sourceId: after.sources[0].id,
    mediaType: "image/png",
    originalName: "Fictional.png",
    byteLength: 10,
    storageKey: "fixture",
  });
  after.sources.push({ ...after.sources[0], id: "unrelated-source" });
  const result = savedDelta(before, after)!;
  assert.deepEqual(result.personIds, [after.people[0].id]);
  assert.deepEqual(result.photoIds, ["new-original"]);
  assert.deepEqual(result.sourceIds, [after.sources[0].id]);
  assert.equal(savedDelta(after, before), null);
  after.projectId = "another-project";
  assert.equal(savedDelta(before, after), null);
});

test("caption-associated originals are inspectable without confirming identity or photo order", async () => {
  const {photoIdsForPerson} = await import("../../src/ui/OriginalPhotos");
  const s = snapshot(), person = s.people[0];
  person.photoIds = [];
  s.assets.push({id: "caption-only", sourceId: s.sources[0].id, mediaType: "image/jpeg", originalName: "Supplied_group.jpg", byteLength: 10, storageKey: "fixture"});
  s.photoAnnotations = [{assetId: "caption-only", file: "Supplied_group.jpg", positions: [], depictedPersonIds: [person.id], caption: "A supplied family caption; order unknown.", support: []}];
  const before = structuredClone(s);
  assert.deepEqual(photoIdsForPerson(s, person.id), ["caption-only"]);
  assert.deepEqual(s, before);
  assert.deepEqual(person.photoIds, []);
  assert.deepEqual(s.photoAnnotations[0].positions, []);
});

test("round-3 optional family fields can stay blank", () => {
  assert.equal(validateInput({...snapshot().input, seedName: "Fictional Alex", geography: "", geographyUnknown: false, researchMode: "round3"}, 1), null);
});
test("autofill preserves manual edits, explicit clears, conflicts and unknown family side", async () => {
  const {applyAutofill, emptyProfile, updateProfile, fieldValue} = await import("../../src/ui/intake");
  const p = updateProfile(emptyProfile(), "self.fullName", "Manual Alex");
  const support = [{sourceId: "source", locator: "line 1", quote: "Fictional record"}];
  const draft = {id: "draft", createdAt: new Date().toISOString(), inputFingerprint: "a".repeat(64), appliedPaths: [], fields: [
    {path: "self.fullName", value: "Other Alex", support, conflicts: []},
    {path: "self.birthPlace", value: "Fictional Harbor", support, conflicts: []},
    {path: "father.fullName", value: "Fictional Morgan", support, conflicts: []},
    {path: "mother.birthYear", value: "1940", support, conflicts: ["1941"]},
    {path: "grandfather.fullName", value: "Fictional Lee", support, conflicts: []},
    {path: "__proto__.polluted", value: "bad", support, conflicts: []},
  ]};
  const result = applyAutofill(p, draft, new Set(["father.fullName"]));
  assert.equal(result.profile.self.fullName, "Manual Alex");
  assert.equal(result.profile.self.birthPlace, "Fictional Harbor");
  assert.equal(fieldValue(result.profile, "father.fullName"), "");
  assert.equal(fieldValue(result.profile, "mother.birthYear"), "");
  assert.equal(result.profile.grandfather?.side, "unknown");
  assert.deepEqual(result.applied, ["self.birthPlace", "grandfather.fullName"]);
  assert.equal(p.self.birthPlace, "");
});
test("research controls resume saved state without inventing a fourth round", async () => {
  const {nextCycleAction} = await import("../../src/ui/ResearchCycles");
  const {Round3StateSchema, ResearchCycleSchema} = await import("../../packages/contracts");
  const s = snapshot();
  const at = new Date().toISOString(), hash = "a".repeat(64);
  s.research = Round3StateSchema.parse({schemaVersion: "roots-research-v3", packetVersion: "fictional", packetHash: hash, intake: {id: "intake", status: "ready", startedAt: at, inputFingerprint: hash, questionIds: ["1","2","3","4","5","6"], jobIds: []}});
  assert.equal(nextCycleAction(s), "initial");
  for (let ordinal = 1; ordinal <= 3; ordinal++) {
    s.research.cycles.push(ResearchCycleSchema.parse({id: `cycle-${ordinal}`, ordinal, kind: ordinal === 1 ? "initial" : "deeper", requestId: `request-${ordinal}`, inputFingerprint: hash, status: "running", createdAt: at}));
    assert.equal(nextCycleAction(s), null);
    s.research.cycles.at(-1)!.status = "failed";
    assert.equal(nextCycleAction(s), null);
    s.research.cycles.at(-1)!.status = "completed";
    assert.equal(nextCycleAction(s), ordinal < 3 ? "deeper" : null);
  }
});
test("shared group photos cannot masquerade as independent solo portraits", async () => {
  const {portraitForPerson} = await import("../../src/ui/PersonPortrait");
  const s = snapshot();
  s.people[0].photoIds = [s.assets[0].id];
  s.people[1].photoIds = [s.assets[0].id];
  assert.equal(portraitForPerson(s, s.people[0].id), undefined);
  assert.equal(portraitForPerson(s, s.people[1].id), undefined);
});
