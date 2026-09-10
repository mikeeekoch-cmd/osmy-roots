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
  s.relationships = s.people
    .slice(0, -1)
    .map((p, i) => ({
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
