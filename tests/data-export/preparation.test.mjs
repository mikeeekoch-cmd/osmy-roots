import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparationKey, isPreparedStillCurrent, PreparedBundleCache } from '../../server/export/preparation.mjs';

const base = () => ({
  schemaVersion: 'roots-v1', projectId: 'p1', version: 4, bookStatus: 'current',
  people: [{ id: 'P1' }, { id: 'P2' }],
  relationships: [{ id: 'R1', status: 'accepted' }],
  claims: [{ id: 'C1', status: 'accepted', version: 1 }],
  stories: [{ id: 'S1', status: 'accepted', text: 'A workshop story.' }],
  assets: [{ id: 'A1', contentHash: 'aaa' }],
});
const passages = [{ id: 'BP1', acceptedStateVersion: 4, text: 'Current sentence.' }];

test('the key is stable for identical state and order-independent', () => {
  const a = preparationKey({ snapshot: base(), passages });
  const shuffled = base();
  shuffled.people = [{ id: 'P2' }, { id: 'P1' }];
  assert.equal(preparationKey({ snapshot: shuffled, passages }).key, a.key);
});

for (const [label, mutate] of [
  ['a version bump', (s) => { s.version = 5; }],
  ['an accepted claim changing version', (s) => { s.claims[0].version = 2; }],
  ['a story being edited', (s) => { s.stories[0].text = 'A corrected workshop story.'; }],
  ['an asset being replaced', (s) => { s.assets[0].contentHash = 'bbb'; }],
  ['a relationship being rejected', (s) => { s.relationships[0].status = 'rejected'; }],
  ['a new person arriving', (s) => { s.people.push({ id: 'P3' }); }],
  ['the book falling out of date', (s) => { s.bookStatus = 'stale'; }],
]) {
  test(`the key changes on ${label}`, () => {
    const before = preparationKey({ snapshot: base(), passages }).key;
    const s = base();
    mutate(s);
    assert.notEqual(preparationKey({ snapshot: s, passages }).key, before);
  });
}

test('the key changes when the passage text or its state version changes', () => {
  const before = preparationKey({ snapshot: base(), passages }).key;
  assert.notEqual(preparationKey({ snapshot: base(), passages: [{ ...passages[0], text: 'Different.' }] }).key, before);
  assert.notEqual(preparationKey({ snapshot: base(), passages: [{ ...passages[0], acceptedStateVersion: 5 }] }).key, before);
});

test('language and packet version are part of the key', () => {
  const en = preparationKey({ snapshot: base(), passages, options: { language: 'en' } }).key;
  assert.notEqual(preparationKey({ snapshot: base(), passages, options: { language: 'raw' } }).key, en);
  assert.notEqual(preparationKey({ snapshot: base(), passages, options: { language: 'en', packetVersion: 'v2' } }).key, en);
});

test('a correction invalidates a prepared bundle with a readable reason', () => {
  const prepared = { key: preparationKey({ snapshot: base(), passages }).key };
  const corrected = base();
  corrected.version = 5;
  const r = isPreparedStillCurrent({ prepared, snapshot: corrected, passages });
  assert.equal(r.valid, false);
  assert.match(r.reason, /changed after this bundle was prepared/);
  assert.ok(r.currentKey);
});

test('a missing prepared artifact is never treated as current', () => {
  assert.equal(isPreparedStillCurrent({ prepared: null, snapshot: base(), passages }).valid, false);
});

test('the cache keeps prepared bundles keyed by state and can drop the stale ones', () => {
  const cache = new PreparedBundleCache(2);
  cache.put('k1', { bytes: 1 }); cache.put('k2', { bytes: 2 }); cache.put('k3', { bytes: 3 });
  assert.equal(cache.get('k1'), null, 'oldest entry is evicted at the limit');
  cache.invalidateAllExcept('k3');
  assert.equal(cache.get('k2'), null);
  assert.ok(cache.get('k3'));
});
