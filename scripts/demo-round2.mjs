#!/usr/bin/env node
/**
 * Round-2 end-to-end check: packet ingestion -> staged plan -> current English book.
 *
 * Measures the engineering cost of every step so the lead can see how much of the
 * 120-second application budget this side consumes. There are no timers in the
 * modules themselves; the schedule belongs to the lead.
 *
 * Usage: node scripts/demo-round2.mjs [--packet <01-upload dir>] [--out <dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { ingestDemoPacket } from '../server/ingestion/packet.mjs';
import { planInitialBranch, planStagedBatches, validateBatchPlan } from '../server/research/staged.mjs';
import { searchLocalSources } from '../server/research/index.mjs';
import { buildFamilyBundle, selectBranch, preparationKey, isPreparedStillCurrent } from '../server/export/index.mjs';

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PACKET = argOf('--packet', process.env.ROOTS_PACKET || '');
const OUT = argOf('--out', path.join(process.cwd(), 'exports'));
if (!PACKET) {
  console.error('Supply the frozen packet: node scripts/demo-round2.mjs --packet <01-upload dir>');
  console.error('For the fictional twin: node scripts/make-test-packet.mjs /tmp/twin && node scripts/demo-round2.mjs --packet /tmp/twin/01-upload');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const timings = [];
const step = async (label, fn) => {
  const t = Date.now();
  const value = await fn();
  const ms = Date.now() - t;
  timings.push({ label, ms });
  console.log(`  ${String(ms).padStart(6)} ms  ${label}`);
  return value;
};

console.log(`Packet: ${PACKET}\n`);
const files = fs.readdirSync(PACKET)
  .filter((n) => !n.startsWith('.'))
  .map((n) => ({ originalName: n, bytes: fs.readFileSync(path.join(PACKET, n)) }));
console.log(`Selected ${files.length} files, ${(files.reduce((a, f) => a + f.bytes.length, 0) / 1024 / 1024).toFixed(2)} MB\n`);

console.log('TIMINGS');
const packet = await step('ingest packet (parse PDF, CSVs, text, photos, 3 archives)', () => ingestDemoPacket({ files }));

const snapshot = {
  schemaVersion: packet.schemaVersion,
  projectId: 'round2-local',
  version: 1,
  bookStatus: 'current',
  input: { seedName: 'packet', geography: 'unknown', language: 'en' },
  people: packet.people, relationships: packet.relationships, claims: packet.claims,
  stories: packet.stories, sources: packet.sources, assets: packet.assets,
  proposals: [], researchEvents: [], history: packet.history,
  issues: packet.issues, layout: packet.layout, seedOrigin: 'prepared',
};

const youngest = [...snapshot.people].sort((a, b) =>
  (snapshot.layout.positions[b.id]?.generation ?? 0) - (snapshot.layout.positions[a.id]?.generation ?? 0))[0];
const init = await step('plan initial five-person branch', () => planInitialBranch(snapshot, { focusPersonId: youngest.id, size: 5 }));
const plan = await step('plan six dependency-safe batches', () => planStagedBatches({ snapshot, releasedIds: init.personIds }));
const check = validateBatchPlan({ snapshot, releasedIds: init.personIds, batches: plan.batches });
const hit = await step('local evidence search over parsed sources', () => searchLocalSources({ query: 'workshop mended tools', sources: snapshot.sources, limit: 3 }));

// The chapter subject is the person carrying the reviewed story.
const storySubject = snapshot.stories[0]?.subjectId || snapshot.people[0].id;
const reviewed = snapshot.stories.map((s, i) => (i === 0 ? { ...s, status: 'accepted' } : s));
const reviewedSnapshot = { ...snapshot, version: 2, stories: reviewed };
const passage = {
  id: 'BP_ROUND2', personId: storySubject,
  text: 'The family kept a workshop behind the house and mended tools for the whole lane. The record was reviewed and accepted in this session.',
  claimIds: [], sourceLocators: [reviewed[0]?.locator || 'Family_Recollections.txt#L1'],
  acceptedStateVersion: 2,
};

const resolveAsset = (id) => {
  const a = reviewedSnapshot.assets.find((x) => x.id === id);
  return a?.bytes ? { bytes: a.bytes, mediaType: a.mediaType, originalName: a.originalName } : null;
};
const opts = {
  focusPersonId: storySubject, branchRootId: init.focusPersonId,
  title: 'Roots: The Family Book', dedication: 'Dad, this is for you.',
  projectName: 'osmy-roots-family', packetVersion: 'twin-1',
};

const prepared = await step('prepare current English book and bundle', () =>
  buildFamilyBundle({ snapshot: reviewedSnapshot, passages: [passage], resolveAsset, options: opts }));
fs.writeFileSync(path.join(OUT, prepared.filename), prepared.bytes);

console.log('\nSTAGED PLAN');
console.log(`  initial branch @35s: ${init.personIds.join(', ')}`);
for (const b of plan.batches) console.log(`  batch ${b.index} @ ${b.offsetSeconds}s  +${b.personIds.length} -> ${b.cumulativeTotal} people, ${b.evidence.photoIds.length} photo(s), ${b.evidence.storyIds.length} story/ies`);
console.log(`  plan valid: ${check.ok}${check.problems.length ? ` | ${check.problems.length} problem(s)` : ''}`);

console.log('\nINGESTION REPORT');
console.log(`  people ${packet.report.counts.people} | relationships ${packet.report.counts.relationships} | sources ${packet.report.counts.sources} | photos ${packet.report.counts.assets}`);
console.log(`  reconciliation: ${packet.report.reconciliation.rawRows} raw rows -> ${packet.report.reconciliation.normalized} normalized (${packet.report.reconciliation.mergedCount} merged, ${packet.report.reconciliation.excludedCount} excluded)`);
console.log(`  PDF extraction: ${packet.report.pdfExtraction ? packet.report.pdfExtraction.mode : 'no overview PDF'}`);
console.log(`  evidence roots ${packet.report.counts.evidenceRoots} | ingestion errors ${packet.report.errors}`);
console.log(`  local search: ${hit.status}, ${hit.hits.length} hit(s)`);

console.log('\nEXPORT');
const m = prepared.manifest;
console.log(`  ${prepared.filename}  ${(prepared.bytes.length / 1024 / 1024).toFixed(2)} MB  pdf ${m.pdfPages} pages  language ${m.language}`);
console.log(`  guards passed: ${m.guardsPassed}${m.guardFailures.length ? ` | ${m.guardFailures.join(' | ')}` : ''}`);
console.log(`  printed passages ${m.printedPassages} | stale ${m.stalePassages} | assets ${m.assets.length} | missing ${m.missingAssets.length}`);
console.log(`  preparation key ${m.preparationKey.slice(0, 16)}...`);

// Version safety: a correction must invalidate the prepared bundle.
const corrected = { ...reviewedSnapshot, version: 3 };
const still = isPreparedStillCurrent({ prepared: { key: m.preparationKey }, snapshot: corrected, passages: [passage], options: opts });
console.log(`  after a correction, prepared bundle still valid: ${still.valid} (expected false)`);

const total = timings.reduce((a, t) => a + t.ms, 0);
console.log(`\nTOTAL ENGINEERING TIME: ${total} ms (${(total / 1000).toFixed(2)} s) of the 120 s application budget`);
console.log(`Book+bundle preparation alone: ${timings.find((t) => t.label.startsWith('prepare')).ms} ms`);
console.log(`\nWrote ${path.join(OUT, prepared.filename)}`);

const failures = [];
if (!check.ok) failures.push('batch plan invalid');
if (!m.guardsPassed) failures.push('layout guards failed');
if (packet.report.errors) failures.push(`${packet.report.errors} ingestion error(s)`);
if (still.valid) failures.push('prepared bundle was not invalidated by a correction');
if (failures.length) { console.error(`\nFAILED: ${failures.join('; ')}`); process.exit(1); }
console.log('\nAll round-2 checks passed.');
