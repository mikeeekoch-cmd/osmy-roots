/**
 * Build DEMO_MANIFEST.json for the round-3 fictional twin.
 *
 * Everything is derived from the generated packet by running the production parser, so
 * the manifest can never claim something the files do not contain.
 *
 *   node --import tsx tests/fixtures/round3/build_manifest.mjs
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, basename, parse as parsePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFamilyNotesPacket } from '../../../server/ingestion/family-notes.mjs';
import { DemoManifestV3Schema } from '../../../packages/contracts/round3.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PACKET = join(ROOT, 'packet');
const UPLOAD = join(PACKET, '01-upload');
const MEDIA = join(PACKET, '02-media', 'enhanced');
const AT = '2026-09-10T20:00:00.000Z';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const fixture = JSON.parse(await readFile(join(PACKET, 'FIXTURE_INPUT.json'), 'utf8'));
const OLD_PHOTOS = ['Ellis Vale.jpg', 'Marta Vale.jpg', 'Ellis and Marta.jpg', 'The move to Harbourfield.jpg'];

const names = (await readdir(UPLOAD)).sort();
const files = await Promise.all(names.map(async (originalName) => ({ originalName, bytes: await readFile(join(UPLOAD, originalName)) })));

const identityKeys = {
  people: Object.fromEntries(fixture.people.map((n, i) => [n, `V${String(i + 1).padStart(3, '0')}`])),
  relationships: {},
  assets: Object.fromEntries(fixture.photos.map((n, i) => [n, `photo-tw-${String(i + 1).padStart(2, '0')}`])),
};
const parsed = await parseFamilyNotesPacket({ files, identityKeys });
const P = identityKeys.people;
const A = identityKeys.assets;
const annotation = (assetId) => parsed.photoAnnotations.find((a) => a.assetId === assetId);
const sourceIdsFor = (name) => parsed.files.find((f) => f.originalName === name)?.sourceIds || [];
const sourceText = (id) => parsed.sources.find((s) => s.id === id)?.originalText || '';

// Relationship keys stay empty: the parser derives a stable id from the sentence itself,
// and a key that is not an exact uploaded sentence is rejected by design.
const manifestFiles = files.map((f) => {
  const hash = sha(f.bytes);
  const isImage = /\.(jpe?g|png)$/i.test(f.originalName);
  return {
    path: `01-upload/${f.originalName}`,
    sha256: hash,
    bytes: f.bytes.length,
    sourceIds: sourceIdsFor(f.originalName),
    evidenceRootIds: isImage ? [`photo-${hash}`] : sourceIdsFor(f.originalName).map((s) => `doc-${s}`),
    lineage: [],
  };
});

const photoPairs = await Promise.all(OLD_PHOTOS.map(async (name) => {
  const originalAssetId = A[name];
  const original = files.find((f) => f.originalName === name).bytes;
  const enhanced = await readFile(join(MEDIA, `${parsePath(name).name} (enhanced).jpg`));
  return {
    id: `pair-${originalAssetId}`,
    personIds: annotation(originalAssetId).depictedPersonIds,
    originalAssetId,
    originalHash: sha(original),
    enhancedAssetId: `${originalAssetId}-enh`,
    enhancedHash: sha(enhanced),
    origin: 'prepared',
    method: 'luminance-only tone stretch, flat-area median denoise, low-amount clarity, thresholded unsharp; chroma preserved',
    originalLabel: 'Original',
    enhancedLabel: 'Enhanced',
    caption: 'Enhanced for readability only. Same pixel dimensions, chroma untouched.',
    alignment: { mode: 'aligned' },
    evidenceRootId: `photo-${sha(original)}`,
    preparedAt: AT,
    qa: { status: 'passed', reviewedAt: AT, reviewer: 'fixture generator', notes: 'Identical dimensions, luminance-only transform, invented image.' },
  };
}));

const portraits = parsed.photoAnnotations
  .filter((a) => a.positions.length === 1 && a.positions[0].personId)
  .map((a) => ({
    personId: a.positions[0].personId,
    assetId: a.assetId,
    kind: 'solo',
    support: a.support.map((s) => ({ sourceId: s.sourceId, locator: s.locator, quote: s.quote })),
    reviewed: false,
  }));

const notesSection = (heading) => {
  const text = sourceText('family-notes');
  const start = text.indexOf(`## ${heading}`);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next === -1 ? text.length : next).trim();
};
const span = (heading) => ({ sourceId: 'family-notes', locator: parsed.sources.find((s) => s.id === 'family-notes').originalLocator, quote: notesSection(heading) });
const photoSpan = (assetId) => annotation(assetId).support.map((s) => ({ sourceId: s.sourceId, locator: s.locator, quote: s.quote }));
// Chat archives keep content-derived ids, so resolve them by the file they came from.
const chatSourceByTitle = (title) => parsed.sources.find((s) => s.title === title);
const chatSpan = (title, needle) => {
  const source = chatSourceByTitle(title);
  if (!source) throw new Error(`Chat source not found: ${title}`);
  const at = source.originalText.indexOf(needle);
  if (at === -1) throw new Error(`Quote not found in ${title}: ${needle}`);
  return [{ sourceId: source.id, locator: source.originalLocator, quote: source.originalText.slice(at, at + 200).trim() }];
};

const MODERN = A['Rowan and Martin.jpg'];
const OLD_PORTRAIT = A['Ellis Vale.jpg'];
const OLD_GROUP = A['The move to Harbourfield.jpg'];

const questions = [
  { id: 'C1', category: 'photo', prompt: 'Is this the order of people in this photograph, from left to right?', recommendation: '', support: photoSpan(MODERN), personIds: [P['Rowan Vale'], P['Martin Vale']], effect: { kind: 'annotation', photoAssetId: MODERN }, requiresAstra: false, status: 'ready', origin: 'prepared', photoAssetId: MODERN, photoEra: 'modern' },
  { id: 'C2', category: 'photo', prompt: 'The family label on this old portrait gives one name. Is that who this is?', recommendation: 'Ellis Vale. The print carries his name and no date.', support: photoSpan(OLD_PORTRAIT), personIds: [P['Ellis Vale']], effect: { kind: 'annotation', personId: P['Ellis Vale'], photoAssetId: OLD_PORTRAIT }, requiresAstra: false, status: 'ready', origin: 'prepared', photoAssetId: OLD_PORTRAIT, photoEra: 'old' },
  { id: 'C3', category: 'kinship', prompt: 'This old photograph is labelled as the family who left Alder Vale. Who is standing where?', recommendation: '', support: photoSpan(OLD_GROUP), personIds: [P['Ellis Vale'], P['Marta Vale'], P['Jonah Vale']], effect: { kind: 'annotation', photoAssetId: OLD_GROUP }, requiresAstra: false, status: 'ready', origin: 'prepared', photoAssetId: OLD_GROUP, photoEra: 'old' },
  { id: 'C4', category: 'origin', prompt: 'Where was Ellis from?', recommendation: 'Alder Vale.', support: [span('Ellis Vale')], personIds: [P['Ellis Vale']], effect: { kind: 'claim', personId: P['Ellis Vale'], predicate: 'origin_place' }, requiresAstra: false, status: 'ready', origin: 'prepared' },
  { id: 'C5', category: 'recollection', prompt: 'What does Clara remember about the move?', recommendation: '', support: chatSpan('Messages - Mum.zip', 'Around 1946'), personIds: [P['Jonah Vale']], effect: { kind: 'story', personId: P['Jonah Vale'] }, requiresAstra: true, status: 'ready', origin: 'prepared' },
  { id: 'C6', category: 'conflict', prompt: 'The notes hold two birth years for Marta. Can you settle them?', recommendation: 'Keep 1902 and 1904 unresolved.', support: [span('Marta Vale')], personIds: [P['Marta Vale']], effect: { kind: 'editorial', personId: P['Marta Vale'], predicate: 'birth_date_conflict' }, requiresAstra: false, status: 'ready', origin: 'prepared' },
];

const excerptText = sourceText('book-excerpt');
const CHAPTER_META = {
  'ch-dedication': { title: 'For Dad', part: 'Front matter', pages: [1] },
  'ch-alder-vale': { title: 'Alder Vale', part: 'Part I: Origins', pages: [2, 3] },
  'ch-ellis': { title: 'Ellis Vale', part: 'Part II: The Vale line', pages: [4] },
  'ch-jonah': { title: 'Jonah Vale', part: 'Part II: The Vale line', pages: [5] },
  'ch-martin': { title: 'Martin Vale', part: 'Part II: The Vale line', pages: [6] },
  'ch-rowan': { title: 'Rowan Vale', part: 'Part II: The Vale line', pages: [7] },
  'ch-move': { title: 'The move to Harbourfield', part: 'Documented stories', pages: [8] },
  'ch-harness': { title: 'The harness-maker', part: 'Documented stories', pages: [9] },
  'ch-open': { title: 'What is still open', part: 'Appendices', pages: [10] },
  'ch-sources': { title: 'Sources and thanks', part: 'Appendices', pages: [11] },
};
const chapterPeople = {
  'ch-dedication': ['Martin Vale', 'Rowan Vale'], 'ch-alder-vale': [], 'ch-ellis': ['Ellis Vale', 'Marta Vale'],
  'ch-jonah': ['Jonah Vale', 'Martin Vale'], 'ch-martin': ['Martin Vale', 'Clara Vale', 'Rowan Vale'],
  'ch-rowan': ['Rowan Vale'], 'ch-move': ['Ellis Vale', 'Marta Vale', 'Jonah Vale'],
  'ch-harness': ['Ellis Vale'], 'ch-open': ['Marta Vale', 'Ellis Vale'], 'ch-sources': ['Clara Vale'],
};
const chapterAssets = { 'ch-ellis': ['Ellis Vale.jpg'], 'ch-move': ['The move to Harbourfield.jpg'], 'ch-martin': ['Martin Vale.jpg'] };

const chapters = Object.entries(fixture.chapters).map(([id, text]) => {
  const meta = CHAPTER_META[id];
  const opening = text.split('\n\n')[0].split(/\s+/).slice(0, 8).join(' ');
  const pattern = new RegExp(opening.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s]*'));
  const match = pattern.exec(excerptText);
  if (!match) throw new Error(`Chapter opening not found in the twin excerpt: ${id}`);
  return {
    id,
    title: meta.title,
    text,
    sourceBookHash: sha(Buffer.from('the-vale-family-book-fictional-source')),
    sourceLocators: meta.pages.map((p) => `vale_family_book.pdf p.${p}`),
    support: [{ sourceId: 'book-excerpt', locator: `Family book excerpt.pdf, ${meta.title}`, quote: excerptText.slice(match.index, match.index + 240).trim() }],
    personIds: (chapterPeople[id] || []).map((n) => P[n]),
    assetIds: (chapterAssets[id] || []).map((n) => A[n]),
    claimIds: [],
    origin: 'prepared',
    language: 'en',
    fingerprint: sha(Buffer.from(id + text)),
  };
});

const manifest = DemoManifestV3Schema.parse({
  schemaVersion: 'roots-demo-v3',
  packetVersion: 'fictional-round3-v1',
  inputFormat: 'family_notes',
  identityKeys,
  selectedPersonIds: parsed.people.map((p) => p.id),
  expectedRelationshipCount: parsed.relationships.length,
  files: manifestFiles,
  photos: parsed.photoAnnotations,
  questions,
  photoPairs,
  oldPhotoAssetIds: OLD_PHOTOS.map((n) => A[n]),
  portraits,
  initialBranchIds: [P['Rowan Vale'], P['Martin Vale'], P['Clara Vale'], P['Jonah Vale']],
  researchSources: [
    { id: 'rs-1-notes', kind: 'local', sourceIds: ['family-notes', 'photo-notes'], cycleOrdinal: 1, query: 'Vale family names, dates and places already written down', personIds: [P['Ellis Vale'], P['Jonah Vale']] },
    { id: 'rs-2-archive', kind: 'local', sourceIds: ['archive-findings'], cycleOrdinal: 2, query: 'Vale entries in the Willowford parish registers', personIds: [P['Ellis Vale']] },
    { id: 'rs-3-book', kind: 'local', sourceIds: ['book-excerpt'], cycleOrdinal: 3, query: 'Vale family book chapters and open questions', personIds: [P['Marta Vale']] },
  ],
  bookPlan: {
    id: 'plan-fictional-round3',
    sourceBook: { title: 'The Vale family book (fictional)', sha256: sha(Buffer.from('the-vale-family-book-fictional-source')), edition: 'v1, 11 pages' },
    language: 'en',
    pageRange: [35, 40],
    chapters,
    selectedPersonIds: parsed.people.map((p) => p.id),
    selectedOriginalAssetIds: parsed.photoAnnotations.map((a) => a.assetId),
    coverage: manifestFiles.map((f) => {
      const assetId = A[basename(f.path)];
      const chapterIds = chapters.filter((c) => (assetId ? c.assetIds.includes(assetId) : c.support.some((s) => f.sourceIds.includes(s.sourceId)))).map((c) => c.id);
      return {
        fileHash: f.sha256,
        sourceIds: f.sourceIds,
        personIds: assetId ? annotation(assetId).depictedPersonIds : [],
        chapterIds: chapterIds.length || !assetId ? chapterIds : [],
        pages: [],
        zipPath: `originals/${basename(f.path)}`,
      };
    }),
  },
  requiredBookSections: ['dedication', 'contents', 'register', 'exhibits', 'sources', 'open-questions'],
});

const serialized = `${JSON.stringify(manifest, null, 1)}\n`;
await writeFile(join(PACKET, 'DEMO_MANIFEST.json'), serialized);
console.log(JSON.stringify({
  files: manifest.files.length,
  people: manifest.selectedPersonIds.length,
  relationships: manifest.expectedRelationshipCount,
  photos: manifest.photos.length,
  oldPhotos: manifest.oldPhotoAssetIds.length,
  pairs: manifest.photoPairs.length,
  portraits: manifest.portraits.length,
  questions: manifest.questions.length,
  chapters: manifest.bookPlan.chapters.length,
  manifestHash: sha(Buffer.from(serialized)),
}, null, 1));
