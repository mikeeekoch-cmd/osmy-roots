import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planInitialBranch, planStagedBatches, validateBatchPlan, checkBackgroundArrival, DEFAULT_RELEASE_OFFSETS } from '../../server/research/staged.mjs';

/** Small chain family: G0 -> G1 -> G2, plus spouses. */
function snapshot(n = 20) {
  const people = Array.from({ length: n }, (_, i) => ({ id: `P${String(i + 1).padStart(3, '0')}`, displayNameEn: `Person ${i + 1}` }));
  const relationships = [];
  for (let i = 1; i < n; i += 1) {
    relationships.push({ id: `R${i}`, fromPersonId: people[Math.floor((i - 1) / 2)].id, toPersonId: people[i].id, type: 'parent_child', status: 'accepted', claimIds: [] });
  }
  return { people, relationships, claims: [], stories: [], assets: [], sources: [] };
}

test('the initial branch is one connected line, not a scatter', () => {
  const s = snapshot();
  const init = planInitialBranch(s, { focusPersonId: 'P020', size: 5 });
  assert.equal(init.personIds.length, 5);
  assert.equal(init.personIds[0], 'P020');
  const check = validateBatchPlan({ snapshot: s, releasedIds: [init.personIds[0]], batches: [{ index: 1, personIds: init.personIds.slice(1) }] });
  assert.equal(check.problems.length, 0, 'every person after the first attaches to someone already visible');
});

test('six batches release everyone exactly once, in a dependency-safe order', () => {
  const s = snapshot(35);
  const init = planInitialBranch(s, { focusPersonId: 'P035', size: 5 });
  const { batches, warnings } = planStagedBatches({ snapshot: s, releasedIds: init.personIds });
  assert.equal(batches.length, 6);
  assert.deepEqual(batches.map((b) => b.offsetSeconds), [...DEFAULT_RELEASE_OFFSETS]);
  const check = validateBatchPlan({ snapshot: s, releasedIds: init.personIds, batches });
  assert.equal(check.ok, true, check.problems.join('; '));
  assert.equal(check.unreachable.length, 0, 'nobody is left out');
  assert.equal(batches.at(-1).cumulativeTotal, 35);
  assert.equal(warnings.length, 0);
});

test('the plan spreads across at least 45 seconds', () => {
  const s = snapshot(35);
  const init = planInitialBranch(s, { focusPersonId: 'P035', size: 5 });
  const { batches } = planStagedBatches({ snapshot: s, releasedIds: init.personIds });
  assert.ok(batches.at(-1).offsetSeconds - batches[0].offsetSeconds >= 45);
});

test('an unsafe manifest plan is rejected rather than trusted', () => {
  const s = snapshot(10);
  const bad = [{ index: 1, offsetSeconds: 44, personIds: ['P009'] }, { index: 2, offsetSeconds: 53, personIds: ['P002'] }];
  const check = validateBatchPlan({ snapshot: s, releasedIds: ['P001'], batches: bad });
  assert.equal(check.ok, false);
  assert.ok(check.problems.some((p) => /before any of its relatives/.test(p)));
});

test('a plan that releases someone twice is rejected', () => {
  const s = snapshot(10);
  const check = validateBatchPlan({ snapshot: s, releasedIds: ['P001'], batches: [
    { index: 1, offsetSeconds: 44, personIds: ['P002'] },
    { index: 2, offsetSeconds: 53, personIds: ['P002'] },
  ] });
  assert.equal(check.ok, false);
  assert.ok(check.problems.some((p) => /more than once/.test(p)));
});

test('out-of-order offsets are rejected', () => {
  const s = snapshot(10);
  const check = validateBatchPlan({ snapshot: s, releasedIds: ['P001'], batches: [
    { index: 1, offsetSeconds: 60, personIds: ['P002'] },
    { index: 2, offsetSeconds: 44, personIds: ['P003'] },
  ] });
  assert.ok(check.problems.some((p) => /not after the previous batch/.test(p)));
});

test('batches carry real evidence, never invented counts', () => {
  const s = snapshot(12);
  s.assets = [{ id: 'A1', personIds: ['P004'] }];
  s.stories = [{ id: 'ST1', subjectId: 'P004' }];
  s.claims = [{ id: 'C1', subjectId: 'P004', sourceIds: ['SRC1'] }];
  const init = planInitialBranch(s, { focusPersonId: 'P012', size: 3 });
  const { batches } = planStagedBatches({ snapshot: s, releasedIds: init.personIds });
  const withP4 = batches.find((b) => b.personIds.includes('P004'));
  if (withP4) {
    assert.deepEqual(withP4.evidence.photoIds, ['A1']);
    assert.deepEqual(withP4.evidence.storyIds, ['ST1']);
    assert.deepEqual(withP4.evidence.sourceIds, ['SRC1']);
  }
});

test('a background arrival may add evidence but never a new person', () => {
  const s = snapshot(5);
  s.sources = [{ id: 'SRC1', evidenceRootId: 'EV_A' }];
  const r = checkBackgroundArrival({ snapshot: s, arrival: { items: [
    { personId: 'P002', evidenceRootId: 'EV_A' },
    { personId: 'P002', evidenceRootId: 'EV_NEW' },
    { personId: 'P999', evidenceRootId: 'EV_B' },
  ] } });
  assert.equal(r.rejected.length, 1);
  assert.match(r.rejected[0].reason, /absent from the initial packet/);
  assert.equal(r.accepted.length, 2);
  assert.equal(r.accepted[0].countsAsNewSource, false, 'a repeated evidence root is not a new source');
  assert.equal(r.accepted[1].countsAsNewSource, true);
  assert.equal(r.accepted.every((a) => a.isOnlineDiscovery === false), true, 'a saved copy is never an online discovery');
});
