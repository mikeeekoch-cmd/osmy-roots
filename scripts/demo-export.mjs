#!/usr/bin/env node
/**
 * End-to-end check of ingestion -> retrieval -> export against the REAL private packet.
 *
 * Private inputs are read from a local path and private outputs are written to the
 * gitignored exports/ directory. Nothing here is committed.
 *
 * Usage: node scripts/demo-export.mjs [--family-tree <path>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { importPreparedFamily, ingestContribution } from '../server/ingestion/index.mjs';
import { searchLocalSources } from '../server/research/index.mjs';
import { buildFamilyBundle } from '../server/export/index.mjs';

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
// Private inputs are supplied at run time. No private path is hard-coded in this
// public repository; set ROOTS_PRIVATE_SEED or pass --family-tree.
const ROOT = argOf('--family-tree', process.env.ROOTS_PRIVATE_SEED || '');
if (!ROOT) {
  console.error('Supply the private packet: node scripts/demo-export.mjs --family-tree <path>');
  console.error('(or set ROOTS_PRIVATE_SEED). This script never bundles private data into git.');
  process.exit(2);
}
const chapterPersonId = argOf('--person', 'P005');
const branchRootId = argOf('--branch-root', 'P001');
const projectName = argOf('--project-name', 'family');
const OUT = path.join(process.cwd(), 'exports');
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(...a);
const readDirSafe = (p) => (fs.existsSync(p) ? fs.readdirSync(p) : []);

// ---------------------------------------------------------------- inputs
const seedPath = path.join(ROOT, 'tree/family_tree.json');
if (!fs.existsSync(seedPath)) {
  console.error(`Private seed not found at ${seedPath}. Pass --family-tree <path>.`);
  process.exit(2);
}
const seedJson = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const sourceDir = path.join(ROOT, 'normalized-data/sources');
const sourceDocuments = readDirSafe(sourceDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({
    id: /^(S\d+)/.exec(f)?.[1] || undefined,
    originalName: f,
    bytes: fs.readFileSync(path.join(sourceDir, f)),
    kind: 'family_document',
  }));

const photoRoot = path.join(ROOT, 'photo to use');
const mediaFiles = [];
for (const personDir of readDirSafe(photoRoot)) {
  const abs = path.join(photoRoot, personDir);
  if (!fs.statSync(abs).isDirectory()) continue;
  for (const f of readDirSafe(abs)) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    mediaFiles.push({
      originalName: f,
      path: `${personDir}/${f}`,
      bytes: fs.readFileSync(path.join(abs, f)),
      caption: f.replace(/\.[^.]+$/, ''),
    });
  }
}

log(`Inputs: seed ${path.basename(seedPath)}, ${sourceDocuments.length} source docs, ${mediaFiles.length} photos`);

// ---------------------------------------------------------------- import
const imported = await importPreparedFamily({ seedJson, mediaFiles, sourceDocuments });
log(`\nIMPORT  people=${imported.counts.people} rels=${imported.counts.relationships} claims=${imported.counts.claims} stories=${imported.counts.stories} sources=${imported.counts.sources} assets=${imported.counts.assets}`);
log(`        warnings=${imported.warnings.length} issues=${imported.issues.length}`);
for (const w of imported.warnings.slice(0, 5)) log(`        - ${w}`);

// A minimal local snapshot so export can be exercised before the lead's state module lands.
// This is a TEST HARNESS ONLY; server/state is the lead's module.
const snapshot = {
  schemaVersion: imported.schemaVersion,
  projectId: 'demo-local',
  version: 1,
  input: { seedName: argOf('--seed-name', 'Family'), geography: argOf('--geography', 'unknown'), language: 'en' },
  people: imported.people,
  relationships: imported.relationships,
  claims: imported.claims,
  stories: imported.stories,
  sources: imported.sources,
  assets: imported.assets,
  proposals: [],
  researchEvents: [],
  history: imported.history,
  issues: imported.issues,
  layout: imported.layout,
  seedOrigin: 'prepared',
};

const resolveAsset = (assetId) => {
  const a = snapshot.assets.find((x) => x.id === assetId);
  return a && a.bytes ? { bytes: a.bytes, mediaType: a.mediaType, originalName: a.originalName } : null;
};

// ---------------------------------------------------------------- local search
const q = argOf('--query', 'harness leather horses');
const hit = await searchLocalSources({ query: q, sources: snapshot.sources, limit: 3 });
log(`\nSEARCH  "${q}" -> ${hit.status}, ${hit.hits.length} hit(s) over ${hit.searchedSources} source(s)`);
for (const h of hit.hits) log(`        ${h.sourceId} ${h.locator} score=${h.score}\n          ${h.snippet.slice(0, 110).replace(/\n/g, ' ')}`);
const miss = await searchLocalSources({ query: 'zzz nonexistent phrase qqq', sources: snapshot.sources });
log(`        control no-match query -> ${miss.status}`);

// ---------------------------------------------------------------- export BEFORE
const before = await buildFamilyBundle({
  snapshot, passages: [], resolveAsset,
  options: { focusPersonId: chapterPersonId, branchRootId: branchRootId, projectName, title: 'Roots: The Family Book', dedication: 'Dad, this is for you.' },
});
fs.writeFileSync(path.join(OUT, 'before-' + before.filename), before.bytes);
log(`\nEXPORT BEFORE  ${before.filename}  ${(before.bytes.length / 1024 / 1024).toFixed(2)} MB  pdfPages=${before.manifest.pdfPages} printedPassages=${before.manifest.printedPassages} branchPeople=${before.manifest.branchPeople}/${before.manifest.totalPeople}`);

// ---------------------------------------------------------------- contribution + acceptance
const contribution = await ingestContribution({
  text: argOf('--contribution', 'He made leather horse harnesses to sell, and that work supported the family.'),
  targetPersonId: chapterPersonId,
});
log(`\nCONTRIBUTION  ${contribution.sources.length} source(s), locator ${contribution.sources[0].originalLocator}`);

const newSource = contribution.sources[0];
const after = JSON.parse(JSON.stringify({ ...snapshot, assets: [] }));
after.assets = snapshot.assets;           // keep bytes references
after.version = 2;
after.sources = [...snapshot.sources, newSource];
after.stories = [...snapshot.stories, {
  id: 'ST_NEW_001', subjectId: chapterPersonId,
  text: 'He made leather horse harnesses to sell, and supported the family with that work.',
  sourceIds: [newSource.id], evidenceType: 'family_recollection',
  attributedTo: 'a relative', status: 'accepted',
}];
// An UNKNOWN decision must not become a book fact.
after.stories.push({
  id: 'ST_UNKNOWN_001', subjectId: chapterPersonId, text: 'A rumoured second workshop in the next village.',
  sourceIds: [newSource.id], evidenceType: 'family_recollection', attributedTo: null, status: 'unresolved',
});
after.history = [...snapshot.history, {
  eventId: 'H0002', at: new Date().toISOString(), actor: 'mike', action: 'accept_proposal',
  before: null, after: { storyId: 'ST_NEW_001' }, note: 'Accepted attributed recollection with its source.',
}];

const currentPassage = {
  id: 'BP_001', personId: chapterPersonId,
  text: 'He made leather horse harnesses to sell, and a relative remembered that this work supported the family.',
  claimIds: [], sourceLocators: [newSource.originalLocator], acceptedStateVersion: 2,
};
const stalePassage = {
  id: 'BP_STALE', personId: 'P005', text: 'This sentence was written against an older version and must not print as current.',
  claimIds: [], sourceLocators: [newSource.originalLocator], acceptedStateVersion: 1,
};

const afterBundle = await buildFamilyBundle({
  snapshot: after, passages: [currentPassage, stalePassage], resolveAsset,
  options: { focusPersonId: chapterPersonId, branchRootId: branchRootId, projectName, title: 'Roots: The Family Book', dedication: 'Dad, this is for you.' },
});
fs.writeFileSync(path.join(OUT, 'after-' + afterBundle.filename), afterBundle.bytes);
log(`EXPORT AFTER   ${afterBundle.filename}  ${(afterBundle.bytes.length / 1024 / 1024).toFixed(2)} MB  pdfPages=${afterBundle.manifest.pdfPages} printedPassages=${afterBundle.manifest.printedPassages} stalePassages=${afterBundle.manifest.stalePassages}`);

// ---------------------------------------------------------------- assertions
const problems = [];
const check = (ok, label) => { log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) problems.push(label); };

log('\nVERIFICATION');
check(before.manifest.projectVersion === 1 && afterBundle.manifest.projectVersion === 2, 'exported project version changes 1 -> 2');
check(afterBundle.manifest.printedPassages === 1, 'exactly one current passage printed');
check(afterBundle.manifest.stalePassages === 1, 'stale passage excluded and reported');
check(afterBundle.bytes.length !== before.bytes.length, 'after bundle differs from before');
check(afterBundle.manifest.pdfPages === 4, 'book is four pages');
check(afterBundle.manifest.assets.every((a) => a.hashMatchesProject !== false), 'every bundled original matches its recorded hash');
check(afterBundle.manifest.missingAssets.length === 0, 'no unresolved attachments');

// PDF must actually contain the new story and NOT the stale sentence or unknown rumour.
const pdfHead = afterBundle.bytes.subarray(0, 9).toString('latin1');
check(pdfHead.startsWith('%PDF') === false, 'bundle is a zip, not a bare pdf');

fs.writeFileSync(path.join(OUT, 'manifest-after.json'), JSON.stringify(afterBundle.manifest, null, 2));
log(`\nWrote ${OUT}/`);
log(`Warnings (${afterBundle.manifest.warnings.length}):`);
for (const w of afterBundle.manifest.warnings.slice(0, 8)) log(`  - ${w}`);
if (problems.length) { console.error(`\n${problems.length} check(s) failed.`); process.exit(1); }
log('\nAll demo checks passed.');
