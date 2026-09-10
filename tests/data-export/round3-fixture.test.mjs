/**
 * The public round-3 twin. Invented people, invented places, invented photographs.
 * It exercises the same parser, manifest schema, pair rules and export path as the
 * private packet, so those rules stay covered in a repository nobody has to redact.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, basename, parse as parsePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFamilyNotesPacket } from '../../server/ingestion/family-notes.mjs';
import { DemoManifestV3Schema } from '../../packages/contracts/round3.ts';
import { renderBookEdition } from '../../server/export/book-edition.mjs';
import { buildFamilyBundle } from '../../server/export/index.mjs';
import { adaptSnapshot } from '../../server/export/contract-adapter.mjs';

const PACKET = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/round3/packet');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const manifest = DemoManifestV3Schema.parse(JSON.parse(await readFile(join(PACKET, 'DEMO_MANIFEST.json'), 'utf8')));
const names = (await readdir(join(PACKET, '01-upload'))).sort();
const files = await Promise.all(names.map(async (originalName) => ({ originalName, bytes: await readFile(join(PACKET, '01-upload', originalName)) })));
const parsed = await parseFamilyNotesPacket({ files, identityKeys: manifest.identityKeys });

test('the twin parses cleanly through the production entrypoint', () => {
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.files.filter((f) => f.status === 'failed').length, 0);
  assert.equal(parsed.people.length, manifest.selectedPersonIds.length);
  assert.equal(parsed.relationships.length, manifest.expectedRelationshipCount);
  assert.equal(parsed.photoAnnotations.length, manifest.photos.length);
});

test('every manifest file matches the bytes on disk', async () => {
  assert.equal(manifest.files.length, files.length);
  for (const entry of manifest.files) {
    const bytes = await readFile(join(PACKET, entry.path));
    assert.equal(sha(bytes), entry.sha256, entry.path);
    assert.equal(bytes.length, entry.bytes, entry.path);
  }
});

test('every declared old photograph has an aligned pair that passed QA', async () => {
  const byOriginal = new Map(manifest.photoPairs.map((p) => [p.originalAssetId, p]));
  assert.ok(manifest.oldPhotoAssetIds.length >= 2);
  for (const assetId of manifest.oldPhotoAssetIds) {
    const pair = byOriginal.get(assetId);
    assert.ok(pair, `no pair for ${assetId}`);
    assert.equal(pair.alignment.mode, 'aligned');
    assert.equal(pair.qa.status, 'passed');

    const annotation = parsed.photoAnnotations.find((a) => a.assetId === assetId);
    const original = await readFile(join(PACKET, '01-upload', annotation.file));
    const enhanced = await readFile(join(PACKET, '02-media/enhanced', `${parsePath(annotation.file).name} (enhanced).jpg`));
    assert.equal(sha(original), pair.originalHash, 'the pair must name its real parent');
    assert.equal(sha(enhanced), pair.enhancedHash);
    assert.notEqual(sha(original), sha(enhanced), 'an enhanced version that is byte-identical is not an enhancement');
  }
});

test('a modern photograph is not required to have a pair', () => {
  const old = new Set(manifest.oldPhotoAssetIds);
  const modern = manifest.photos.filter((p) => !old.has(p.assetId));
  assert.ok(modern.length > 0);
  for (const photo of modern) {
    assert.equal(manifest.photoPairs.some((p) => p.originalAssetId === photo.assetId), false);
  }
});

test('every question and portrait span resolves to real source text', () => {
  const source = (id) => parsed.sources.find((s) => s.id === id);
  for (const question of manifest.questions) {
    for (const span of question.support) {
      const found = source(span.sourceId);
      assert.ok(found, `question ${question.id} cites a missing source`);
      assert.equal(found.originalLocator, span.locator);
      assert.ok(found.originalText.includes(span.quote), `question ${question.id} quote does not resolve`);
    }
  }
  for (const portrait of manifest.portraits) {
    const annotation = parsed.photoAnnotations.find((a) => a.assetId === portrait.assetId);
    const named = annotation.positions.filter((p) => p.personId);
    assert.equal(named.length, 1, 'a solo portrait needs exactly one named position');
    assert.equal(named[0].personId, portrait.personId);
  }
});

test('the twin renders a book edition and reports its real page count', async () => {
  const bytesById = new Map(parsed.assetBytes.map((a) => [a.assetId, a.bytes]));
  for (const pair of manifest.photoPairs) {
    const annotation = parsed.photoAnnotations.find((a) => a.assetId === pair.originalAssetId);
    bytesById.set(pair.enhancedAssetId, await readFile(join(PACKET, '02-media/enhanced', `${parsePath(annotation.file).name} (enhanced).jpg`)));
  }
  const snapshot = adaptSnapshot({
    version: 3, people: parsed.people, sources: parsed.sources, claims: parsed.claims,
    stories: [], relationships: parsed.relationships, photoAnnotations: parsed.photoAnnotations, assets: parsed.assets,
  });
  const edition = renderBookEdition({
    snapshot, bookPlan: manifest.bookPlan, photoPairs: manifest.photoPairs,
    getImage: (id) => (bytesById.has(id) ? { bytes: bytesById.get(id), mediaType: 'image/jpeg' } : null),
  });
  assert.ok(edition.pages > 0);
  assert.equal(edition.sections.at(-1).endPage, edition.pages);
  // This small twin has less material than the private packet, so it is expected to be
  // short. The renderer must say so rather than padding it out.
  if (edition.pages < 35) assert.ok(edition.cuts.some((c) => /not padded/.test(c)));
  const exhibits = edition.coverage.filter((row) => row.assetId);
  assert.equal(exhibits.length, manifest.photos.length, 'every original reaches an exhibit');
  assert.equal(exhibits.filter((row) => row.paired).length, manifest.oldPhotoAssetIds.length);
});

test('the twin exports a bundle whose coverage ledger accounts for every input file', async () => {
  const bytesById = new Map(parsed.assetBytes.map((a) => [a.assetId, a.bytes]));
  const assets = [...parsed.assets];
  for (const pair of manifest.photoPairs) {
    const annotation = parsed.photoAnnotations.find((a) => a.assetId === pair.originalAssetId);
    const bytes = await readFile(join(PACKET, '02-media/enhanced', `${parsePath(annotation.file).name} (enhanced).jpg`));
    bytesById.set(pair.enhancedAssetId, bytes);
    const parent = parsed.assets.find((a) => a.id === pair.originalAssetId);
    assets.push({ id: pair.enhancedAssetId, sourceId: parent.sourceId, originalName: basename(pair.enhancedAssetId), mediaType: 'image/jpeg', byteLength: bytes.length, contentHash: sha(bytes), role: 'derivative', parentAssetId: parent.id });
  }
  const snapshot = adaptSnapshot({
    version: 3, people: parsed.people, sources: parsed.sources, claims: parsed.claims,
    stories: [], relationships: parsed.relationships, photoAnnotations: parsed.photoAnnotations, assets,
  });
  const bundle = await buildFamilyBundle({
    snapshot, passages: [],
    resolveAsset: (id) => (bytesById.has(id) ? { bytes: bytesById.get(id), mediaType: 'image/jpeg' } : null),
    options: { bookPlan: manifest.bookPlan, photoPairs: manifest.photoPairs, oldPhotoAssetIds: manifest.oldPhotoAssetIds, includeAssets: 'all' },
  });
  assert.deepEqual(bundle.manifest.guardFailures, []);
  assert.equal(bundle.manifest.missingAssets.length, 0);
  assert.ok(bundle.bytes.length > 0);
  assert.equal(bundle.manifest.assets.length, assets.length, 'originals and derivatives both travel');
});
