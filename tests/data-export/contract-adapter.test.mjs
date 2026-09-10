import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildFamilyBundleFromContract, adaptSnapshot, flattenLocators } from '../../server/export/contract-adapter.mjs';
import { readZip } from './unzip-helper.mjs';

const portrait = fs.readFileSync(path.join(process.cwd(), 'fixtures/public/placeholder-portrait.png'));

/** A snapshot shaped exactly like packages/contracts, not like this module's internals. */
function contractSnapshot(overrides = {}) {
  return {
    schemaVersion: 'roots-v1',
    projectId: 'p1',
    version: 4,
    input: { seedName: 'Morgan', geography: 'Riverton' },
    people: [
      { id: 'P1', displayNameEn: 'Dana Morgan', originalName: 'Dana Morgan', lifeYears: { birth: { value: '1994-04-02', precision: 'day' }, death: { value: null, precision: 'unknown' } }, photoIds: [], claimIds: [], storyIds: [] },
      { id: 'P2', displayNameEn: 'Jesse Morgan', originalName: 'Jesse Morgan', lifeYears: { birth: { value: '1966', precision: 'year' }, death: { value: null, precision: 'unknown' } }, photoIds: [], claimIds: [], storyIds: [] },
      { id: 'P3', displayNameEn: 'Alex Morgan', originalName: 'Alex Morgan', lifeYears: { birth: { value: '1938', precision: 'approximate' }, death: { value: '2011', precision: 'year' } }, photoIds: ['A1'], claimIds: ['C1'], storyIds: ['S1'] },
    ],
    relationships: [
      { id: 'R1', fromPersonId: 'P2', toPersonId: 'P1', type: 'parent', claimIds: [], status: 'accepted' },
      { id: 'R2', fromPersonId: 'P3', toPersonId: 'P2', type: 'parent', claimIds: ['C1'], status: 'accepted' },
    ],
    claims: [{ id: 'C1', subjectId: 'P3', predicate: 'occupation', value: 'watch repairer', sourceIds: ['SRC1'], spans: [], status: 'accepted', evidenceType: 'family_recollection', version: 1 }],
    stories: [
      { id: 'S1', personId: 'P3', text: 'ADAPTEDSTORY kept a bench in the back room.', sourceIds: ['SRC1'], claimIds: [], spans: [], evidenceType: 'family_recollection', status: 'accepted', attribution: 'Dana Morgan' },
      { id: 'S2', personId: 'P3', text: 'ZZUNRESOLVEDZZ a rumoured second shop.', sourceIds: ['SRC1'], claimIds: [], spans: [], evidenceType: 'family_recollection', status: 'unresolved', attribution: '' },
    ],
    sources: [{ id: 'SRC1', kind: 'family_memory', originalLocator: 'note.txt#L1', contentHash: 'abc', origin: 'live', originalText: 'He repaired watches at a bench.', title: 'Pasted contribution' }],
    assets: [{ id: 'A1', sourceId: 'SRC1', originalName: 'portrait.png', mediaType: 'image/png', byteLength: portrait.length, storageKey: 'assets/A1', contentHash: 'unused' }],
    proposals: [],
    researchEvents: [],
    history: [{ eventId: 'H1', at: '2026-09-10T16:00:00Z', actor: 'mike', action: 'accept' }],
    issues: ['A plain string issue from the contract shape'],
    layout: { P1: { x: 0, y: 0 }, P2: { x: 0, y: 180 }, P3: { x: 0, y: 360 } },
    bookPassages: [],
    ...overrides,
  };
}

const OPTS = { focusPersonId: 'P3', branchRootId: 'P1', title: 'Contract Book', dedication: 'For Dad.' };

test('adaptSnapshot translates relationship, story, date and issue shapes', () => {
  const a = adaptSnapshot(contractSnapshot());
  assert.equal(a.relationships[0].type, 'parent_child', 'parent -> parent_child');
  assert.equal(a.stories[0].subjectId, 'P3', 'personId -> subjectId');
  assert.equal(a.stories[0].attributedTo, 'Dana Morgan', 'attribution -> attributedTo');
  assert.equal(a.people[2].lifeYears.label, 'c. 1938 - 2011', 'label derived from contract dates');
  assert.equal(a.people[2].lifeYears.birth.year, 1938);
  assert.equal(a.people[0].lifeYears.birth.precision, 'exact', 'day precision maps to exact');
  assert.equal(typeof a.issues[0], 'object');
  assert.equal(a.issues[0].severity, 'warning');
  assert.equal(a.layout.positions.P2.y, 180, 'flat layout is normalized');
});

test('partner maps to spouse', () => {
  const a = adaptSnapshot(contractSnapshot({
    relationships: [{ id: 'R9', fromPersonId: 'P1', toPersonId: 'P2', type: 'partner', claimIds: [], status: 'accepted' }],
  }));
  assert.equal(a.relationships[0].type, 'spouse');
});

test('SourceSpan locators flatten to readable strings and keep the quote', () => {
  const out = flattenLocators([{ sourceId: 'SRC1', locator: 'note.txt#L1', quote: 'He repaired watches' }, 'plain#L2']);
  assert.equal(out[0], 'note.txt#L1 "He repaired watches"');
  assert.equal(out[1], 'plain#L2');
});

test('builds a real bundle from a contract-shaped snapshot and async resolver', async () => {
  const out = await buildFamilyBundleFromContract(
    { snapshot: contractSnapshot(), passages: [], resolveAsset: async () => new Uint8Array(portrait) },
    OPTS,
  );
  assert.equal(out.mimeType, 'application/zip');
  assert.equal(out.manifest.pdfPages, 4);
  const files = readZip(Buffer.from(out.bytes));
  assert.equal(files.get('book.pdf').subarray(0, 5).toString('latin1'), '%PDF-');
  const html = files.get('book.html').toString('utf8');
  assert.ok(html.includes('ADAPTEDSTORY'), 'accepted story reaches the book');
  assert.equal(html.includes('ZZUNRESOLVEDZZ'), false, 'unresolved story does not');
  assert.ok(html.includes('Alex Morgan'));
  assert.equal(out.manifest.missingAssets.length, 0);
  assert.deepEqual(files.get(out.manifest.assets[0].path), portrait, 'original bytes preserved');
});

test('a contract passage with SourceSpan locators prints with its citation', async () => {
  const passages = [{
    id: 'BP1', text: 'CONTRACTPASSAGE He repaired watches at a bench.',
    claimIds: ['C1'], sourceIds: ['SRC1'],
    sourceLocators: [{ sourceId: 'SRC1', locator: 'note.txt#L1', quote: 'He repaired watches at a bench.' }],
    acceptedStateVersion: 4, origin: 'live',
  }];
  const out = await buildFamilyBundleFromContract(
    { snapshot: contractSnapshot(), passages, resolveAsset: async () => new Uint8Array(portrait) }, OPTS,
  );
  assert.equal(out.manifest.printedPassages, 1);
  const html = readZip(Buffer.from(out.bytes)).get('book.html').toString('utf8');
  assert.ok(html.includes('CONTRACTPASSAGE'));
  assert.ok(html.includes('note.txt#L1'));
});

test('a stale contract passage is still excluded after adaptation', async () => {
  const passages = [{ id: 'OLD', text: 'ZZSTALEZZ', claimIds: ['C1'], sourceIds: ['SRC1'], sourceLocators: [{ sourceId: 'SRC1', locator: 'note.txt#L1', quote: 'x' }], acceptedStateVersion: 3, origin: 'live' }];
  const out = await buildFamilyBundleFromContract(
    { snapshot: contractSnapshot(), passages, resolveAsset: async () => new Uint8Array(portrait) }, OPTS,
  );
  assert.equal(out.manifest.stalePassages, 1);
  assert.equal(out.manifest.printedPassages, 0);
  assert.equal(readZip(Buffer.from(out.bytes)).get('book.html').toString('utf8').includes('ZZSTALEZZ'), false);
});

test('a resolver that throws yields a reported missing attachment, not a failed download', async () => {
  const out = await buildFamilyBundleFromContract(
    { snapshot: contractSnapshot(), passages: [], resolveAsset: async () => { throw new Error('asset gone'); } }, OPTS,
  );
  assert.equal(out.manifest.missingAssets.length, 1);
  assert.equal(out.manifest.pdfPages, 4, 'the book is still produced');
});

test('the adapter rejects a missing snapshot or resolver', async () => {
  await assert.rejects(() => buildFamilyBundleFromContract({ passages: [], resolveAsset: async () => new Uint8Array() }), /snapshot/);
  await assert.rejects(() => buildFamilyBundleFromContract({ snapshot: contractSnapshot() }), /resolveAsset/);
});
