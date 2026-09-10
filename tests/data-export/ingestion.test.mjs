import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importPreparedFamily, ingestContribution, personIdFromPath } from '../../server/ingestion/index.mjs';
import { parseDate } from '../../server/ingestion/normalize-seed.mjs';
import { displayNameFromFullName } from '../../server/ingestion/translit.mjs';

const FIXTURES = path.join(process.cwd(), 'fixtures/public');
const seedJson = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'synthetic-family.json'), 'utf8'));
const portrait = fs.readFileSync(path.join(FIXTURES, 'placeholder-portrait.png'));

test('imports every person and keeps original ids', async () => {
  const r = await importPreparedFamily({ seedJson });
  assert.equal(r.counts.people, 9);
  assert.ok(r.people.find((p) => p.id === 'P004'));
  assert.equal(r.origin, 'prepared');
});

test('reports a relationship whose endpoint is missing instead of dropping it silently', async () => {
  const r = await importPreparedFamily({ seedJson });
  const issue = r.issues.find((i) => i.code === 'relationship_missing_endpoint');
  assert.ok(issue, 'missing-endpoint issue must be reported');
  assert.ok(issue.missing.includes('P099'));
  assert.ok(r.warnings.some((w) => w.includes('P099')));
  assert.equal(r.relationships.some((x) => x.fromPersonId === 'P099'), false);
});

test('reports a declared/actual person count mismatch', async () => {
  const r = await importPreparedFamily({ seedJson: { ...seedJson, meta: { ...seedJson.meta, total_persons: 4 } } });
  const issue = r.issues.find((i) => i.code === 'meta_count_mismatch');
  assert.ok(issue);
  assert.equal(issue.declared, 4);
  assert.equal(issue.actual, 9);
});

test('a probable relationship stays a candidate rather than an accepted fact', async () => {
  const r = await importPreparedFamily({ seedJson });
  const confirmed = r.relationships.find((x) => x.fromPersonId === 'P002' && x.toPersonId === 'P001');
  const probable = r.relationships.find((x) => x.fromPersonId === 'P006' && x.toPersonId === 'P004');
  assert.equal(confirmed.status, 'accepted');
  assert.equal(probable.status, 'proposed');
});

test('date precision is preserved and a bare year is never called exact', () => {
  assert.deepEqual(parseDate('1994-04-02', 'точно').precision, 'exact');
  assert.equal(parseDate('1938', 'приблизительно').precision, 'approximate');
  assert.equal(parseDate('1968', 'точно').precision, 'year_only', 'a bare year cannot be exact');
  const unknown = parseDate(null, 'неизвестно');
  assert.equal(unknown.value, null);
  assert.equal(unknown.year, null);
  assert.equal(unknown.precision, 'unknown');
});

test('unknown life years render as Unknown rather than a guess', async () => {
  const r = await importPreparedFamily({ seedJson });
  const iris = r.people.find((p) => p.id === 'P007');
  assert.match(iris.lifeYears.label, /^b\. c\. 1912$/);
  assert.equal(iris.lifeYears.death.year, null);
});

test('the same-name distractor stays a separate person', async () => {
  const r = await importPreparedFamily({ seedJson });
  const alex = r.people.find((p) => p.id === 'P004');
  const alexander = r.people.find((p) => p.id === 'P009');
  assert.notEqual(alex.id, alexander.id);
  assert.notEqual(alex.birthPlace, alexander.birthPlace);
});

test('media attaches only through an explicit person id in the path', async () => {
  assert.equal(personIdFromPath('photo to use/P004_Alex/portrait.png'), 'P004');
  assert.equal(personIdFromPath('random/holiday.png'), null, 'never infer a person from image content');
  const r = await importPreparedFamily({
    seedJson,
    mediaFiles: [{ originalName: 'portrait.png', path: 'P004_Alex/portrait.png', bytes: portrait }],
  });
  const person = r.people.find((p) => p.id === 'P004');
  assert.equal(person.photoIds.length, 1);
  const asset = r.assets[0];
  assert.equal(asset.mediaType, 'image/png');
  assert.ok(asset.storageKey.startsWith('assets/'), 'storage key must be opaque');
  assert.ok(!asset.storageKey.includes('/Users/'), 'no host path may leak into an asset key');
});

test('media naming an unknown person is kept and reported', async () => {
  const r = await importPreparedFamily({
    seedJson, mediaFiles: [{ originalName: 'x.png', path: 'P777_Nobody/x.png', bytes: portrait }],
  });
  assert.ok(r.issues.some((i) => i.code === 'media_missing_person'));
  assert.equal(r.assets.length, 1, 'the asset is still retained');
});

test('a cited source with no supplied document is flagged, not invented', async () => {
  const r = await importPreparedFamily({ seedJson });
  assert.ok(r.issues.some((i) => i.code === 'cited_source_not_supplied'));
  const syn = r.sources.find((s) => s.id === 'SYN01');
  assert.equal(syn.unresolved, true);
  assert.equal(syn.originalText, '');
});

test('pasted text keeps a resolvable locator and no invented author or timestamp', async () => {
  const text = fs.readFileSync(path.join(FIXTURES, 'alex-morgan-contribution.txt'), 'utf8');
  const r = await ingestContribution({ text, targetPersonId: 'P004' });
  const source = r.sources[0];
  assert.equal(source.author, null);
  assert.equal(source.messageTimestamp, null, 'a wall clock time is not a message time');
  assert.match(source.originalLocator, /#L1/);
  assert.ok(source.originalText.includes('Alex Morgan'));
  assert.equal(source.origin, 'live');
});

test('multi-paragraph text produces per-paragraph line locators', async () => {
  const r = await ingestContribution({ files: [{ originalName: 'note.txt', bytes: Buffer.from('First line.\n\n\nFourth line.', 'utf8') }] });
  const locators = r.sources[0].segments.map((s) => s.locator);
  assert.deepEqual(locators, ['note.txt#L1', 'note.txt#L4']);
});

test('unsupported formats are stored_only with an explicit reason, never faked as parsed', async () => {
  const r = await ingestContribution({
    files: [
      { originalName: 'chat.zip', bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]) },
      { originalName: 'voice.m4a', bytes: Buffer.from('....ftypM4A ', 'latin1') },
      { originalName: 'photo.png', bytes: portrait },
    ],
  });
  const byName = Object.fromEntries(r.files.map((f) => [f.originalName, f]));
  assert.equal(byName['chat.zip'].status, 'stored_only');
  assert.match(byName['chat.zip'].reason, /no compatibility is claimed/i);
  assert.equal(byName['voice.m4a'].status, 'stored_only');
  assert.equal(byName['photo.png'].status, 'stored_only');
  assert.match(byName['photo.png'].warnings.join(' '), /no text extraction, OCR or face identification/i);
  assert.equal(r.sources.length, 0, 'no source text may be invented from unparsed files');
});

test('a wrong extension does not change what we claim to have parsed', async () => {
  const r = await ingestContribution({ files: [{ originalName: 'notes.txt', bytes: portrait }] });
  assert.equal(r.files[0].status, 'stored_only');
  assert.equal(r.files[0].mediaType, 'image/png', 'sniffed type wins over the extension');
});

test('binary masquerading as text is stored, not decoded', async () => {
  const r = await ingestContribution({ files: [{ originalName: 'broken.txt', bytes: Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x80]) }] });
  assert.equal(r.files[0].status, 'stored_only');
});

test('duplicate content is reported for the lead to deduplicate', async () => {
  const bytes = Buffer.from('same content', 'utf8');
  const r = await ingestContribution({
    files: [{ originalName: 'a.txt', bytes }, { originalName: 'b.txt', bytes }],
  });
  assert.equal(r.duplicateHashes.length, 1);
  const known = await ingestContribution({ files: [{ originalName: 'a.txt', bytes }], knownHashes: [r.sources[0].contentHash] });
  assert.equal(known.duplicateHashes.length, 1);
});

test('empty and unreadable uploads fail loudly', async () => {
  const r = await ingestContribution({ files: [{ originalName: 'empty.txt', bytes: Buffer.alloc(0) }] });
  assert.equal(r.files[0].status, 'failed');
});

test('Unicode and maiden names survive normalization', () => {
  // Invented names that exercise patronymics, the -ий ending and a maiden-name suffix.
  assert.equal(displayNameFromFullName('Петров Василий Андреевич'), 'Vasily Andreevich Petrov');
  assert.equal(displayNameFromFullName('Петрова (Сидорова) Мария Ивановна'), 'Mariya Ivanovna Petrova (Sidorova)');
  assert.equal(displayNameFromFullName('Alex Morgan'), 'Alex Morgan');
});
