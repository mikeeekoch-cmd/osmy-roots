import test from 'node:test';
import assert from 'node:assert/strict';

import { renderBookEdition, readableCaption, compressLocators, TARGET_MIN_PAGES, TARGET_MAX_PAGES } from '../../server/export/book-edition.mjs';
import { claimText, decodeClaimValue } from '../../server/export/select.mjs';
import { buildCoverageLedger } from '../../server/export/index.mjs';

/** A fictional family. No real person, place or photograph appears in this file. */
const PEOPLE = [
  { id: 'F001', displayNameEn: 'Ada Vale', originalName: 'Ada Vale', lifeYears: { birth: { value: '1901', precision: 'year' }, death: { value: '1980', precision: 'year' }, label: '1901 - 1980' }, recordStatus: 'reported', photoIds: [], claimIds: [], storyIds: [] },
  { id: 'F002', displayNameEn: 'Bram Vale', originalName: 'Bram Vale', lifeYears: { birth: { value: null, precision: 'unknown' }, death: { value: null, precision: 'unknown' }, label: 'Unknown' }, recordStatus: 'candidate', photoIds: [], claimIds: [], storyIds: [] },
  { id: 'F003', displayNameEn: 'Cora Vale', originalName: 'Cora Vale', lifeYears: { birth: { value: '1935', precision: 'year' }, death: { value: null, precision: 'unknown' }, label: 'b. 1935' }, recordStatus: 'reported', photoIds: [], claimIds: [], storyIds: [] },
];

const SOURCES = [
  { id: 'notes', kind: 'family_document', title: 'Vale notes.txt', originalLocator: 'Vale notes.txt#L1-L20', contentHash: 'a'.repeat(64), origin: 'live', originalText: 'Ada Vale lived at Alder Vale. Bram Vale may be her brother.' },
  { id: 'captions', kind: 'family_document', title: 'Vale captions.txt', originalLocator: 'Vale captions.txt#L1-L9', contentHash: 'b'.repeat(64), origin: 'live', originalText: 'Ada Vale, undated portrait.' },
];

const PHOTOS = [
  { assetId: 'ph-old', file: 'ada.jpg', positions: [{ position: 1, personId: 'F001', label: 'Ada Vale', status: 'proposed' }], support: [{ sourceId: 'captions', locator: 'Vale captions.txt#L1', quote: 'Ada Vale, undated portrait.' }], depictedPersonIds: ['F001'], caption: 'Ada Vale, undated portrait.\nPeople named in the caption: Ada Vale.\nLeft to right: Ada Vale.' },
  { assetId: 'ph-new', file: 'cora.jpg', positions: [], support: [{ sourceId: 'captions', locator: 'Vale captions.txt#L5', quote: 'Cora Vale in the garden.' }], depictedPersonIds: ['F003'], caption: 'Cora Vale in the garden.' },
];

const makeChapters = (count, paragraphs) => Array.from({ length: count }, (_, i) => ({
  id: `ch-${i + 1}`,
  title: `Chapter ${i + 1}`,
  // Enough prose that pagination has to do real work.
  text: Array.from({ length: paragraphs }, (_, p) => `Paragraph ${p + 1} of chapter ${i + 1}. ${'The Vale family kept notes, photographs and letters, and this edition prints only what those notes actually say. '.repeat(4)}`).join('\n\n'),
  sourceBookHash: 'c'.repeat(64),
  sourceLocators: [`vale_book.pdf p.${i * 3 + 1}`, `vale_book.pdf p.${i * 3 + 2}`, `vale_book.pdf p.${i * 3 + 3}`],
  support: [{ sourceId: 'notes', locator: 'Vale notes.txt#L1-L20', quote: 'Ada Vale lived at Alder Vale.' }],
  personIds: i === 0 ? ['F001'] : [],
  assetIds: i === 0 ? ['ph-old'] : [],
  claimIds: [],
  origin: 'prepared',
  language: 'en',
  part: i < count / 2 ? 'Part I' : 'Part II',
  fingerprint: 'd'.repeat(64),
}));

const CHAPTERS = makeChapters(18, 11);

const BOOK_PLAN = {
  id: 'plan-fictional',
  sourceBook: { title: 'The Vale book', sha256: 'c'.repeat(64), edition: 'v2' },
  language: 'en',
  pageRange: [35, 40],
  chapters: CHAPTERS,
  selectedPersonIds: PEOPLE.map((p) => p.id),
  selectedOriginalAssetIds: PHOTOS.map((p) => p.assetId),
  coverage: [
    { fileHash: 'e'.repeat(64), sourceIds: ['notes'], personIds: ['F001'], chapterIds: ['ch-1'], pages: [], zipPath: 'uploads/notes.txt' },
    { fileHash: 'f'.repeat(64), sourceIds: [], personIds: ['F001'], chapterIds: [], pages: [], zipPath: 'photos/ada.jpg' },
  ],
};

const PAIRS = [{
  id: 'pair-ada', personIds: ['F001'], originalAssetId: 'ph-old', originalHash: 'f'.repeat(64),
  enhancedAssetId: 'ph-old-enh', enhancedHash: '1'.repeat(64), origin: 'prepared',
  method: 'luminance-only tone and detail pass', originalLabel: 'Original', enhancedLabel: 'Enhanced',
  caption: 'Enhanced for readability only.', alignment: { mode: 'aligned' },
  evidenceRootId: 'photo-f', preparedAt: '2026-09-10T20:00:00.000Z',
  qa: { status: 'passed', reviewedAt: '2026-09-10T20:05:00.000Z', reviewer: 'test', notes: 'same composition' },
}];

const SNAPSHOT = {
  version: 7,
  people: PEOPLE,
  sources: SOURCES,
  claims: [
    { id: 'c1', subjectId: 'F001', predicate: 'supplied_family_record', value: 'Ada Vale lived at Alder Vale.', sourceIds: ['notes'], spans: [{ sourceId: 'notes', locator: 'Vale notes.txt#L1', quote: 'Ada Vale lived at Alder Vale.' }], status: 'accepted', evidenceType: 'family_document', version: 1 },
    { id: 'c2', subjectId: 'F002', predicate: 'relationship_sibling', value: '{"from":"F001","to":"F002"}', sourceIds: ['notes'], spans: [{ sourceId: 'notes', locator: 'Vale notes.txt#L2', quote: 'Bram Vale may be her brother.' }], status: 'proposed', evidenceType: 'family_document', version: 1 },
  ],
  stories: [],
  relationships: [],
  photoAnnotations: PHOTOS,
  assets: [
    { id: 'ph-old', originalName: 'ada.jpg', mediaType: 'image/jpeg', contentHash: 'f'.repeat(64), byteLength: 10 },
    { id: 'ph-new', originalName: 'cora.jpg', mediaType: 'image/jpeg', contentHash: '2'.repeat(64), byteLength: 10 },
  ],
};

// The renderer only asks for bytes; a null resolver exercises the missing-original path.
const noImages = () => null;

test('the edition paginates into the 35 to 40 page range and reports its real page count', () => {
  const edition = renderBookEdition({ snapshot: SNAPSHOT, bookPlan: BOOK_PLAN, getImage: noImages, photoPairs: PAIRS });
  assert.ok(edition.pages >= TARGET_MIN_PAGES && edition.pages <= TARGET_MAX_PAGES, `pages ${edition.pages} outside target`);
  assert.equal(edition.cuts.length, 0);
  const last = edition.sections.at(-1);
  assert.equal(last.endPage, edition.pages, 'the final section must end on the final page, so no page is left blank');
});

test('too little material is reported as a short edition rather than padded to 35 pages', () => {
  const thin = { ...BOOK_PLAN, chapters: makeChapters(3, 1) };
  const edition = renderBookEdition({ snapshot: SNAPSHOT, bookPlan: thin, getImage: noImages, photoPairs: PAIRS });
  assert.ok(edition.pages < TARGET_MIN_PAGES, 'this fixture is deliberately too short');
  assert.ok(edition.cuts.some((c) => /outside the 35-40 target/.test(c)), 'the shortfall must be stated');
  assert.ok(edition.cuts.some((c) => /not padded/.test(c)));
  const last = edition.sections.at(-1);
  assert.equal(last.endPage, edition.pages, 'no blank page is appended to reach the floor');
});

test('every section is reachable and no section starts after the book ends', () => {
  const edition = renderBookEdition({ snapshot: SNAPSHOT, bookPlan: BOOK_PLAN, getImage: noImages, photoPairs: PAIRS });
  const covered = new Set();
  for (const s of edition.sections) {
    assert.ok(s.startPage >= 1 && s.endPage <= edition.pages, `${s.title} spans ${s.startPage}-${s.endPage}`);
    assert.ok(s.endPage >= s.startPage, `${s.title} ends before it starts`);
    for (let p = s.startPage; p <= s.endPage; p += 1) covered.add(p);
  }
  for (let p = 1; p <= edition.pages; p += 1) assert.ok(covered.has(p), `page ${p} belongs to no section`);
});

test('the contents page prints the page a section actually starts on', () => {
  const edition = renderBookEdition({ snapshot: SNAPSHOT, bookPlan: BOOK_PLAN, getImage: noImages, photoPairs: PAIRS });
  const register = edition.sections.find((s) => s.id === 'register');
  const exhibits = edition.sections.find((s) => s.id === 'exhibits');
  assert.ok(register && exhibits);
  assert.ok(exhibits.startPage > register.startPage, 'exhibits follow the register');
});

test('a missing original is reported, never silently dropped', () => {
  const edition = renderBookEdition({ snapshot: SNAPSHOT, bookPlan: BOOK_PLAN, getImage: noImages, photoPairs: PAIRS });
  assert.ok(edition.warnings.some((w) => w.includes('ph-old')), 'an unresolved photograph must warn');
});

test('a chapter that is not English fails the guard instead of printing', () => {
  const plan = { ...BOOK_PLAN, chapters: [{ ...CHAPTERS[0], text: 'Долина Ольховая, вымышленное название' }, ...CHAPTERS.slice(1)] };
  assert.throws(
    () => renderBookEdition({ snapshot: SNAPSHOT, bookPlan: plan, getImage: noImages, photoPairs: PAIRS }),
    (e) => e.code === 'BOOK_GUARD' && /non-English/.test(e.message),
  );
});

test('a citation with no source in the register fails the guard', () => {
  const snapshot = { ...SNAPSHOT, claims: [{ ...SNAPSHOT.claims[0], sourceIds: ['nowhere'] }] };
  assert.throws(
    () => renderBookEdition({ snapshot, bookPlan: BOOK_PLAN, getImage: noImages, photoPairs: PAIRS }),
    (e) => e.code === 'BOOK_GUARD' && /nowhere/.test(e.message),
  );
});

test('a relationship claim whose value arrives as JSON text still reads as a sentence', () => {
  const people = new Map(PEOPLE.map((p) => [p.id, p]));
  const text = claimText(SNAPSHOT.claims[1], people);
  assert.equal(text, 'Ada Vale is sibling of Bram Vale');
  assert.ok(!text.includes('{'), 'raw JSON must never reach a reader');
});

test('decodeClaimValue leaves a plain string alone', () => {
  assert.equal(decodeClaimValue('Alder Vale'), 'Alder Vale');
  assert.deepEqual(decodeClaimValue('{"from":"A","to":"B"}'), { from: 'A', to: 'B' });
  assert.equal(decodeClaimValue('{not json'), '{not json');
});

test('a photo note keeps its sentence and drops the machine-readable lines', () => {
  const caption = readableCaption(PHOTOS[0].caption);
  assert.equal(caption, 'Ada Vale, undated portrait.');
  assert.equal(readableCaption(''), 'No caption was supplied with this photograph.');
  assert.equal(readableCaption('x'.repeat(400)).length, 320);
});

test('consecutive source pages collapse into a range', () => {
  assert.equal(compressLocators(['book.pdf p.3', 'book.pdf p.4', 'book.pdf p.5']), 'book.pdf p.3-5');
  assert.equal(compressLocators(['book.pdf p.3', 'book.pdf p.9']), 'book.pdf p.3, 9');
  assert.equal(compressLocators(['an unstructured locator']), 'an unstructured locator');
});

test('the coverage ledger maps each input file to its pages and keeps derivatives separate', () => {
  const edition = renderBookEdition({ snapshot: SNAPSHOT, bookPlan: BOOK_PLAN, getImage: noImages, photoPairs: PAIRS });
  const assetPaths = new Map([['ph-old', 'photos/ada.jpg'], ['ph-new', 'photos/cora.jpg'], ['ph-old-enh', 'photos/ada-enh.jpg']]);
  const ledger = buildCoverageLedger({ edition, snapshot: SNAPSHOT, bookPlan: BOOK_PLAN, assetPaths, photoPairs: PAIRS, oldPhotoAssetIds: ['ph-old'] });

  assert.equal(ledger.rows.length, BOOK_PLAN.coverage.length, 'one row per input file, never one per rendering');
  assert.equal(ledger.counts.originalPhotographs, 2);
  assert.equal(ledger.counts.derivatives, 1, 'an enhanced photograph is not a second original');
  assert.equal(ledger.oldPhotographsWithoutAnEnhancedVersion.length, 0);
  assert.equal(ledger.modernPhotographsWithoutAPair, 1, 'a modern photograph without a pair is the intended state');

  const photoRow = ledger.rows.find((r) => r.zipPath === 'photos/ada.jpg');
  assert.equal(photoRow.role, 'original_photograph');
  assert.ok(photoRow.exhibitPages.length > 0, 'every original reaches an exhibit page');
  assert.equal(photoRow.enhanced.parentHash, photoRow.fileHash);
  assert.equal(photoRow.enhanced.qa, 'passed');
  assert.equal(ledger.pageCount, edition.pages);
});

test('an unprinted file keeps its archive path and says why it was not printed', () => {
  const edition = renderBookEdition({ snapshot: SNAPSHOT, bookPlan: BOOK_PLAN, getImage: noImages, photoPairs: PAIRS });
  const plan = { ...BOOK_PLAN, coverage: [...BOOK_PLAN.coverage, { fileHash: '9'.repeat(64), sourceIds: [], personIds: [], chapterIds: [], pages: [], zipPath: 'uploads/spare.txt' }] };
  const ledger = buildCoverageLedger({ edition, snapshot: SNAPSHOT, bookPlan: plan, assetPaths: new Map(), photoPairs: PAIRS, oldPhotoAssetIds: ['ph-old'] });
  const spare = ledger.rows.find((r) => r.zipPath === 'uploads/spare.txt');
  assert.equal(spare.printed, false);
  assert.match(spare.omission, /still travel/);
  assert.equal(ledger.counts.unprintedFiles, 1);
});
