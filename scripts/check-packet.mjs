#!/usr/bin/env node
/** Validate the same strict roots-v1 parser used by the app. No model/network calls.
 *
 * Round 2 manifests (roots-demo-v2) keep their staged-batch checks. Round 3 manifests
 * (roots-demo-v3) are checked for six initial checks, three distinct question photos,
 * a declared old-photo subset with a passing pair for every one of them, supported
 * portraits, autofill spans and a 35-40 page book plan. Nothing here trusts the
 * manifest's own numbers: every claim is re-derived from the actual files.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseFamilyPacket, parseFamilyNotesPacket } from '../server/ingestion/index.mjs';
import { prepareManifestBatches } from '../server/research/staged-sources.mjs';
import { DemoManifestSchema } from '../packages/contracts/round2.ts';
import { DemoManifestV3Schema } from '../packages/contracts/round3.ts';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Round-3 media and book checks. Returns a report section; throws on a hard failure. */
async function checkRound3(manifest, parsed, manifestPath, mediaDir) {
  const fail = (message) => { throw new Error(message); };

  // Exactly six checks, three distinct photographs, one modern and two old.
  if (manifest.questions.length !== 6) fail(`Expected six initial checks, found ${manifest.questions.length}`);
  const questionPhotos = manifest.questions.map((q) => q.photoAssetId || q.effect.photoAssetId).filter(Boolean);
  if (new Set(questionPhotos).size < 3) fail('Six checks must show at least three distinct photographs');
  const eras = manifest.questions.filter((q) => q.photoEra).map((q) => q.photoEra);
  if (!eras.includes('modern') || eras.filter((e) => e === 'old').length < 2) fail('Question photographs must be one modern and at least two old');
  for (const q of manifest.questions) {
    if (!q.photoAssetId) continue;
    if (!parsed.photoAnnotations.some((a) => a.assetId === q.photoAssetId)) fail(`Check ${q.id} points at a photograph the packet does not contain`);
  }

  // Every declared old photograph needs a prepared, aligned, QA-passed pair whose
  // parent hash is the original's actual hash on disk.
  const annotationByAsset = new Map(parsed.photoAnnotations.map((a) => [a.assetId, a]));
  const pairByOriginal = new Map(manifest.photoPairs.map((p) => [p.originalAssetId, p]));
  const missingPairs = [];
  for (const assetId of manifest.oldPhotoAssetIds) {
    if (!annotationByAsset.has(assetId)) fail(`Old-photo list names ${assetId}, which the packet does not contain`);
    const pair = pairByOriginal.get(assetId);
    if (!pair) { missingPairs.push(assetId); continue; }
    if (pair.alignment.mode !== 'aligned') fail(`Pair for ${assetId} is not aligned, so the slider cannot use it`);
    if (pair.qa.status !== 'passed') fail(`Pair for ${assetId} has not passed visual QA (${pair.qa.status})`);
    const file = manifest.files.find((f) => path.posix.basename(f.path) === annotationByAsset.get(assetId).file);
    if (!file) fail(`Pair for ${assetId} has no file entry`);
    if (file.sha256 !== pair.originalHash) fail(`Pair for ${assetId} records a parent hash that is not the original's`);
    if (mediaDir) {
      const bytes = await readFile(path.join(mediaDir, `${path.parse(annotationByAsset.get(assetId).file).name} (enhanced).jpg`)).catch(() => null);
      if (!bytes) fail(`Enhanced file for ${assetId} was not found in ${mediaDir}`);
      if (sha(bytes) !== pair.enhancedHash) fail(`Enhanced file for ${assetId} does not match its recorded hash`);
    }
  }
  if (missingPairs.length) fail(`Old photographs without an enhanced pair: ${missingPairs.join(', ')}`);

  // Prepared derivative bytes must exist at a safe packet-relative path, hash exactly,
  // and belong to a declared pair. They are never counted as uploaded originals.
  const enhancedIds = new Set(manifest.photoPairs.map((p) => p.enhancedAssetId));
  const preparedIds = new Set();
  for (const prepared of manifest.preparedAssets || []) {
    if (!enhancedIds.has(prepared.assetId)) fail(`preparedAssets names ${prepared.assetId}, which is not a pair's enhanced asset`);
    if (preparedIds.has(prepared.assetId)) fail(`preparedAssets repeats ${prepared.assetId}`);
    preparedIds.add(prepared.assetId);
    if (manifest.files.some((f) => f.path === prepared.path)) fail(`${prepared.path} is both a selected upload and a prepared derivative`);
    if (manifestPath) {
      const bytes = await readFile(path.resolve(path.dirname(manifestPath), prepared.path)).catch(() => null);
      if (!bytes) fail(`Prepared derivative not found: ${prepared.path}`);
      if (bytes.length !== prepared.bytes || sha(bytes) !== prepared.sha256) fail(`Prepared derivative size or hash mismatch: ${prepared.path}`);
      const pair = manifest.photoPairs.find((p) => p.enhancedAssetId === prepared.assetId);
      if (sha(bytes) !== pair.enhancedHash) fail(`Prepared derivative does not match its pair record: ${prepared.path}`);
    }
  }
  if (manifest.preparedAssets?.length && preparedIds.size !== enhancedIds.size) {
    fail(`preparedAssets covers ${preparedIds.size} of ${enhancedIds.size} enhanced versions`);
  }

  // A portrait must be supported by a real span, and a crop must be explicitly reviewed.
  for (const portrait of manifest.portraits) {
    if (!annotationByAsset.has(portrait.assetId)) fail(`Portrait for ${portrait.personId} points at a missing photograph`);
    for (const span of portrait.support) {
      const source = parsed.sources.find((s) => s.id === span.sourceId);
      if (!source || !source.originalText.includes(span.quote)) fail(`Portrait for ${portrait.personId} has an unresolved source span`);
    }
    if (portrait.kind === 'reviewed_crop' && !portrait.reviewed) fail(`Cropped portrait for ${portrait.personId} is not marked reviewed`);
    if (portrait.kind === 'solo') {
      const annotation = annotationByAsset.get(portrait.assetId);
      const named = annotation.positions.filter((p) => p.personId);
      if (named.length !== 1 || named[0].personId !== portrait.personId) fail(`Solo portrait for ${portrait.personId} is not supported by a single named position`);
    }
  }

  // Autofill values must each resolve to real source text; unknown fields stay absent.
  for (const field of manifest.autofill?.fields || []) {
    for (const span of field.support) {
      const source = parsed.sources.find((s) => s.id === span.sourceId);
      if (!source || !source.originalText.includes(span.quote)) fail(`Autofill field ${field.path} has an unresolved source span`);
    }
  }

  // Book plan: chapters resolve to real sources and every selected person and original
  // is claimed by the plan.
  const plan = manifest.bookPlan;
  for (const chapter of plan.chapters) {
    for (const span of chapter.support) {
      const source = parsed.sources.find((s) => s.id === span.sourceId);
      if (!source || !source.originalText.includes(span.quote)) fail(`Chapter ${chapter.id} has an unresolved source span`);
    }
    if (!chapter.sourceLocators.length) fail(`Chapter ${chapter.id} has no source locator`);
  }
  const selected = new Set(plan.selectedPersonIds);
  for (const person of parsed.people) if (!selected.has(person.id)) fail(`Book plan omits ${person.id} from the register`);
  const originals = new Set(plan.selectedOriginalAssetIds);
  for (const annotation of parsed.photoAnnotations) if (!originals.has(annotation.assetId)) fail(`Book plan omits photograph ${annotation.assetId}`);
  const coveredHashes = new Set(plan.coverage.map((c) => c.fileHash));
  for (const file of manifest.files) if (!coveredHashes.has(file.sha256)) fail(`Coverage ledger omits ${file.path}`);

  return {
    checks: manifest.questions.length,
    distinctQuestionPhotos: new Set(questionPhotos).size,
    modernQuestionPhotos: eras.filter((e) => e === 'modern').length,
    oldQuestionPhotos: eras.filter((e) => e === 'old').length,
    oldPhotographs: manifest.oldPhotoAssetIds.length,
    pairsPrepared: manifest.photoPairs.length,
    pairsPassed: manifest.photoPairs.filter((p) => p.qa.status === 'passed').length,
    preparedDerivatives: manifest.preparedAssets?.length ?? 0,
    portraits: manifest.portraits.length,
    soloPortraits: manifest.portraits.filter((p) => p.kind === 'solo').length,
    reviewedCrops: manifest.portraits.filter((p) => p.kind === 'reviewed_crop').length,
    autofillFields: manifest.autofill?.fields.length ?? 0,
    chapters: plan.chapters.length,
    coverageRows: plan.coverage.length,
    researchSourcesByCycle: [1, 2, 3].map((ordinal) => manifest.researchSources.filter((r) => r.cycleOrdinal === ordinal).length),
  };
}

const directory = process.argv[2];
const manifestFlag = process.argv.indexOf('--manifest');
const mediaFlag = process.argv.indexOf('--media');
if (!directory) {
  console.error('Usage: node scripts/check-packet.mjs <01-upload directory> [--manifest <DEMO_MANIFEST.json>] [--media <enhanced directory>]');
  process.exit(2);
}
try {
  const files = await Promise.all((await readdir(directory)).filter((name) => !name.startsWith('.')).map(async (originalName) => ({ originalName, bytes: await readFile(path.join(directory, originalName)) })));
  const manifestPath = manifestFlag === -1 ? undefined : process.argv[manifestFlag + 1];
  if (manifestFlag !== -1 && !manifestPath) throw new Error('--manifest requires a file path');
  const mediaDir = mediaFlag === -1 ? undefined : process.argv[mediaFlag + 1];
  if (mediaDir) await stat(mediaDir);

  const raw = manifestPath ? JSON.parse(await readFile(manifestPath, 'utf8')) : undefined;
  const isV3 = raw?.schemaVersion === 'roots-demo-v3';
  const manifest = raw ? (isV3 ? DemoManifestV3Schema.parse(raw) : DemoManifestSchema.parse(raw)) : undefined;

  const parser = manifest?.inputFormat === 'family_notes' ? parseFamilyNotesPacket : parseFamilyPacket;
  const startedAt = Date.now();
  const parsed = await parser({ files, identityKeys: manifest?.identityKeys });
  const failures = [...parsed.issues, ...parsed.files.filter((f) => f.status === 'failed').map((f) => `${f.originalName}: ${f.reason}`)];

  let batches;
  let round3;
  if (manifest) {
    const uploaded = new Map(files.map((f) => [f.originalName, f]));
    for (const item of manifest.files) {
      const file = item.path.startsWith('01-upload/') ? uploaded.get(path.posix.basename(item.path)) : { bytes: await readFile(path.resolve(path.dirname(manifestPath), item.path)) };
      if (!file || file.bytes.length !== item.bytes || sha(file.bytes) !== item.sha256) throw new Error(`Manifest file size/hash mismatch: ${item.path}`);
    }
    if (manifest.files.filter((item) => item.path.startsWith('01-upload/')).length !== files.length) throw new Error('Selected file count differs from the frozen manifest');
    for (const question of manifest.questions) {
      for (const span of question.support) {
        const source = parsed.sources.find((s) => s.id === span.sourceId);
        if (!source || source.originalLocator !== span.locator || !source.originalText.includes(span.quote)) throw new Error(`Question ${question.id} has an unresolved source span`);
      }
    }
    if (isV3) {
      round3 = await checkRound3(manifest, parsed, manifestPath, mediaDir);
    } else {
      batches = prepareManifestBatches({ manifest, packet: parsed });
      const scheduled = new Set(batches.flatMap((batch) => batch.relationshipIds));
      if (scheduled.size !== parsed.relationships.length) throw new Error('Manifest staged relationships omit part of the parsed graph');
    }
  }

  const report = {
    parser: `${parser.name} (runtime roots-v1)`,
    manifestSchema: manifest?.schemaVersion ?? null,
    status: failures.length ? 'FAIL' : 'PASS',
    coverage: parsed.counts,
    files: parsed.files.map((f) => ({ name: f.originalName, status: f.status })),
    photoAnnotations: parsed.photoAnnotations.length,
    chatMessages: parsed.sources.filter((s) => s.kind === 'reconstructed_chat' || s.kind === 'uploaded_chat').reduce((n, s) => n + (s.segments?.length || 0), 0),
    manifestValidated: Boolean(batches || round3),
    batches: batches?.map((b) => ({ id: b.id, people: b.personIds.length, relationships: b.relationshipIds.length, releaseOffsetSeconds: b.releaseOffsetSeconds })),
    round3,
    errors: failures,
    elapsedMs: Date.now() - startedAt,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
} catch (error) {
  console.error(`Packet validation FAILED: ${error.message}`);
  process.exitCode = 1;
}
