import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importPreparedFamily, ingestContribution } from '../../server/ingestion/index.mjs';
import { buildFamilyBundle, selectBranch } from '../../server/export/index.mjs';
import { readZip } from './unzip-helper.mjs';

const FIXTURES = path.join(process.cwd(), 'fixtures/public');
const seedJson = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'synthetic-family.json'), 'utf8'));
const portrait = fs.readFileSync(path.join(FIXTURES, 'placeholder-portrait.png'));

async function makeSnapshot(overrides = {}) {
  const imported = await importPreparedFamily({
    seedJson,
    mediaFiles: [{ originalName: 'portrait.png', path: 'P004_Alex/portrait.png', bytes: portrait }],
  });
  return {
    schemaVersion: imported.schemaVersion,
    projectId: 'test', version: 1,
    input: { seedName: 'Morgan', geography: 'Riverton' },
    people: imported.people, relationships: imported.relationships,
    claims: imported.claims, stories: imported.stories,
    sources: imported.sources, assets: imported.assets,
    proposals: [], researchEvents: [], history: imported.history,
    issues: imported.issues, layout: imported.layout,
    ...overrides,
  };
}
const resolverFor = (snapshot) => (id) => {
  const a = snapshot.assets.find((x) => x.id === id);
  return a?.bytes ? { bytes: a.bytes, mediaType: a.mediaType, originalName: a.originalName } : null;
};

const OPTS = { focusPersonId: 'P004', branchRootId: 'P001', title: 'Test Book', dedication: 'For Dad.' };

test('bundle contains every contracted file and passes integrity checks', async () => {
  const snapshot = await makeSnapshot();
  const out = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: OPTS });
  assert.equal(out.mimeType, 'application/zip');
  assert.match(out.filename, /\.zip$/);
  const files = readZip(out.bytes);   // throws on any CRC or size mismatch
  for (const required of ['book.pdf', 'book.html', 'project.json', 'sources.json', 'research-notes.json', 'starting-context.json', 'README.md', 'editable-family-map.html']) {
    assert.ok(files.has(required), `bundle must contain ${required}`);
  }
  assert.equal(files.get('book.pdf').subarray(0, 5).toString('latin1'), '%PDF-');
  assert.equal(out.manifest.pdfPages, 4);
});

test('project.json retains ALL people and edges, not only the printed branch', async () => {
  const snapshot = await makeSnapshot();
  const out = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: OPTS });
  const project = JSON.parse(readZip(out.bytes).get('project.json').toString('utf8'));
  assert.equal(project.people.length, snapshot.people.length);
  assert.equal(project.relationships.length, snapshot.relationships.length);
  assert.ok(out.manifest.branchPeople < out.manifest.totalPeople, 'the printed branch is a subset');
});

test('a stale passage is excluded and reported, never printed as current', async () => {
  const snapshot = await makeSnapshot({ version: 3 });
  const passages = [
    { id: 'CURRENT', personId: 'P004', text: 'Current sentence about the workshop.', claimIds: [], sourceLocators: ['note.txt#L1'], acceptedStateVersion: 3 },
    { id: 'STALE', personId: 'P004', text: 'ZZSTALEMARKERZZ must not appear.', claimIds: [], sourceLocators: ['note.txt#L1'], acceptedStateVersion: 2 },
  ];
  const out = await buildFamilyBundle({ snapshot, passages, resolveAsset: resolverFor(snapshot), options: OPTS });
  assert.equal(out.manifest.printedPassages, 1);
  assert.equal(out.manifest.stalePassages, 1);
  const files = readZip(out.bytes);
  assert.equal(files.get('book.html').toString('utf8').includes('ZZSTALEMARKERZZ'), false);
  const notes = JSON.parse(files.get('research-notes.json').toString('utf8'));
  assert.equal(notes.stalePassages.length, 1);
  assert.match(notes.stalePassages[0].reason, /does not match project version 3/);
});

test('a passage with no claim or source locator is rejected', async () => {
  const snapshot = await makeSnapshot();
  const out = await buildFamilyBundle({
    snapshot,
    passages: [{ id: 'NOSRC', text: 'An unsupported factual assertion.', claimIds: [], sourceLocators: [], acceptedStateVersion: 1 }],
    resolveAsset: resolverFor(snapshot), options: OPTS,
  });
  assert.equal(out.manifest.printedPassages, 0);
  assert.equal(out.manifest.invalidPassages, 1);
});

test('unreviewed and unresolved stories stay out of the biography', async () => {
  const base = await makeSnapshot();
  const snapshot = {
    ...base,
    stories: [
      ...base.stories,
      { id: 'OK', subjectId: 'P004', text: 'ACCEPTEDMARKER kept a workshop bench.', sourceIds: [], evidenceType: 'family_recollection', attributedTo: 'Dana', status: 'accepted' },
      { id: 'NO', subjectId: 'P004', text: 'ZZUNRESOLVEDMARKERZZ rumoured second workshop.', sourceIds: [], evidenceType: 'family_recollection', attributedTo: null, status: 'unresolved' },
    ],
  };
  const out = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: OPTS });
  const html = readZip(out.bytes).get('book.html').toString('utf8');
  assert.ok(html.includes('ACCEPTEDMARKER'), 'accepted recollection should appear');
  assert.equal(html.includes('ZZUNRESOLVEDMARKERZZ'), false, 'unresolved material must not become a book fact');
  assert.ok(html.includes('recollection'), 'an accepted recollection stays labelled as one');
});

test('a missing attachment is reported rather than silently omitted', async () => {
  const snapshot = await makeSnapshot();
  const out = await buildFamilyBundle({
    snapshot, passages: [], options: OPTS,
    resolveAsset: () => null,
  });
  assert.equal(out.manifest.missingAssets.length, 1);
  assert.ok(out.manifest.warnings.some((w) => /missing from bundle/i.test(w)));
  const notes = JSON.parse(readZip(out.bytes).get('research-notes.json').toString('utf8'));
  assert.equal(notes.missingAssets.length, 1);
});

test('bundled originals are byte-identical and hash-checked', async () => {
  const snapshot = await makeSnapshot();
  const out = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: OPTS });
  const files = readZip(out.bytes);
  const entry = out.manifest.assets[0];
  assert.ok(files.has(entry.path));
  assert.deepEqual(files.get(entry.path), portrait, 'original bytes must be preserved unmodified');
  assert.equal(entry.hashMatchesProject, true);
});

test('a hash mismatch between project and resolved bytes is flagged', async () => {
  const snapshot = await makeSnapshot();
  const out = await buildFamilyBundle({
    snapshot, passages: [], options: OPTS,
    resolveAsset: (id) => ({ bytes: Buffer.from('different bytes'), mediaType: 'image/png', originalName: 'x.png' }),
  });
  assert.ok(out.manifest.warnings.some((w) => /do not match the recorded content hash/.test(w)));
  assert.equal(out.manifest.assets[0].hashMatchesProject, false);
});

test('no absolute host path leaks into the bundle', async () => {
  const snapshot = await makeSnapshot();
  const out = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: OPTS });
  const files = readZip(out.bytes);
  for (const name of files.keys()) {
    assert.equal(name.startsWith('/'), false, `${name} must be a relative path`);
    assert.equal(name.includes('..'), false);
  }
  for (const textFile of ['project.json', 'sources.json', 'book.html', 'README.md']) {
    const body = files.get(textFile).toString('utf8');
    assert.equal(/\/Users\/[A-Za-z0-9._-]+\//.test(body), false, `${textFile} must not contain a host path`);
  }
});

test('the export changes when accepted state changes', async () => {
  const snapshot = await makeSnapshot();
  const resolve = resolverFor(snapshot);
  const before = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolve, options: OPTS });
  const contribution = await ingestContribution({ text: 'He repaired watches at a bench in the back room.', targetPersonId: 'P004' });
  const after = await buildFamilyBundle({
    snapshot: {
      ...snapshot, version: 2,
      sources: [...snapshot.sources, contribution.sources[0]],
      stories: [...snapshot.stories, { id: 'NEW', subjectId: 'P004', text: 'NEWSTORYMARKER repaired watches at a bench.', sourceIds: [contribution.sources[0].id], evidenceType: 'family_recollection', attributedTo: 'Dana', status: 'accepted' }],
    },
    passages: [{ id: 'P', personId: 'P004', text: 'NEWPASSAGEMARKER He repaired watches.', claimIds: [], sourceLocators: [contribution.sources[0].originalLocator], acceptedStateVersion: 2 }],
    resolveAsset: resolve, options: OPTS,
  });
  const beforeHtml = readZip(before.bytes).get('book.html').toString('utf8');
  const afterHtml = readZip(after.bytes).get('book.html').toString('utf8');
  assert.equal(beforeHtml.includes('NEWSTORYMARKER'), false);
  assert.ok(afterHtml.includes('NEWSTORYMARKER'));
  assert.ok(afterHtml.includes('NEWPASSAGEMARKER'));
  assert.equal(before.manifest.projectVersion, 1);
  assert.equal(after.manifest.projectVersion, 2);
});

test('project.json round-trips ids, edge direction, status and history', async () => {
  const snapshot = await makeSnapshot();
  const out = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: OPTS });
  const project = JSON.parse(readZip(out.bytes).get('project.json').toString('utf8'));
  const original = snapshot.relationships.find((r) => r.fromPersonId === 'P002' && r.toPersonId === 'P001');
  const roundTripped = project.relationships.find((r) => r.id === original.id);
  assert.equal(roundTripped.fromPersonId, 'P002');
  assert.equal(roundTripped.toPersonId, 'P001');
  assert.equal(roundTripped.status, original.status);
  assert.ok(project.history.length >= 1);
  assert.equal(project.schemaVersion, snapshot.schemaVersion);
});

test('raw mode preserves Unicode, as the general-purpose export always did', async () => {
  const base = await makeSnapshot();
  const contribution = await ingestContribution({ text: 'Петров Василий — «шорник», 1889.' });
  const snapshot = {
    ...base,
    sources: [...base.sources, contribution.sources[0]],
    stories: [...base.stories, { id: 'RU', subjectId: 'P004', text: 'Работал по коже — делал упряжь.', sourceIds: [contribution.sources[0].id], evidenceType: 'family_recollection', attributedTo: 'Наталья', status: 'accepted' }],
  };
  const raw = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: { ...OPTS, mode: 'raw' } });
  const files = readZip(raw.bytes);
  assert.ok(files.get('book.html').toString('utf8').includes('Работал по коже'));
  assert.ok(files.get('sources.json').toString('utf8').includes('шорник'));
  assert.equal(raw.manifest.language, 'raw');
});

test('the English demo bundle withholds non-English source text and reports it', async () => {
  const base = await makeSnapshot();
  const contribution = await ingestContribution({ text: 'Петров Василий — «шорник», 1889.' });
  const snapshot = {
    ...base,
    sources: [...base.sources, contribution.sources[0]],
    stories: base.stories,
  };
  const out = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: OPTS });
  assert.equal(out.manifest.language, 'en');
  const sourcesJson = readZip(out.bytes).get('sources.json').toString('utf8');
  assert.equal(sourcesJson.includes('шорник'), false, 'non-English body must not travel in the English bundle');
  assert.ok(out.manifest.sourcesNeedingEnglishDerivative.includes(contribution.sources[0].id));
  const parsed = JSON.parse(sourcesJson);
  const withheld = parsed.sources.find((x) => x.id === contribution.sources[0].id);
  assert.equal(withheld.textWithheld, true, 'the record and its locator still travel');
  assert.ok(withheld.originalLocator, 'lineage back to the original is preserved');
});

test('an accepted non-English story fails the English guard rather than printing', async () => {
  const base = await makeSnapshot();
  const snapshot = {
    ...base,
    stories: [...base.stories, { id: 'RU2', subjectId: 'P004', text: 'Работал по коже.', sourceIds: [], evidenceType: 'family_recollection', attributedTo: null, status: 'accepted' }],
  };
  const out = await buildFamilyBundle({ snapshot, passages: [], resolveAsset: resolverFor(snapshot), options: OPTS });
  assert.equal(out.manifest.guardsPassed, false);
  assert.ok(out.manifest.guardFailures.some((g) => /non-English/i.test(g)));
});

test('branch selection follows real edges and excludes rejected ones', async () => {
  const snapshot = await makeSnapshot();
  const branch = selectBranch(snapshot, { focusPersonId: 'P001', generations: 5 });
  assert.ok(branch.personIds.includes('P004'), 'a real ancestor is in the branch');
  assert.equal(branch.personIds.includes('P009'), false, 'the same-name distractor is not an ancestor');
  const rejected = {
    ...snapshot,
    relationships: snapshot.relationships.map((r) => (r.fromPersonId === 'P004' && r.toPersonId === 'P002' ? { ...r, status: 'rejected' } : r)),
  };
  // Isolate descent: with spouses included P004 would still legitimately appear as
  // the partner of P005, who remains an ancestor.
  const lineOnly = selectBranch(rejected, { focusPersonId: 'P001', generations: 5, includeSpouses: false });
  assert.equal(lineOnly.personIds.includes('P004'), false, 'a rejected parent edge removes that line');
  assert.equal(lineOnly.personIds.includes('P006'), false, 'and everything reachable only through it');
  const withSpouses = selectBranch(rejected, { focusPersonId: 'P001', generations: 5 });
  assert.ok(withSpouses.personIds.includes('P004'), 'but a spouse of a remaining ancestor still belongs');
});

test('buildFamilyBundle refuses an arbitrary filesystem path in place of a resolver', async () => {
  const snapshot = await makeSnapshot();
  await assert.rejects(() => buildFamilyBundle({ snapshot, passages: [] }), /resolveAsset/);
  await assert.rejects(() => buildFamilyBundle({ passages: [], resolveAsset: () => null }), /snapshot/);
});
