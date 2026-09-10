#!/usr/bin/env node
/**
 * Packet validator for Product.
 *
 * Runs the exact production parsers over a candidate 01-upload folder and prints
 * what would happen in the demo. Generic unzip or a spreadsheet preview is not
 * enough: this is the code the app actually runs.
 *
 * Usage:
 *   node scripts/check-packet.mjs <01-upload dir> [--manifest <DEMO_MANIFEST.json>]
 *
 * Exit code 0 means the packet parses with no errors. 1 means at least one error.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ingestDemoPacket, SUPPORTED_INPUTS } from '../server/ingestion/packet.mjs';
import { UPLOAD_POLICY } from '../server/ingestion/archive.mjs';
import { planInitialBranch, planStagedBatches, validateBatchPlan } from '../server/research/staged.mjs';

const dir = process.argv[2];
const mIdx = process.argv.indexOf('--manifest');
const manifestPath = mIdx !== -1 ? process.argv[mIdx + 1] : null;

if (!dir || !fs.existsSync(dir)) {
  console.error('Usage: node scripts/check-packet.mjs <01-upload dir> [--manifest <DEMO_MANIFEST.json>]');
  console.error('\nSupported inputs:');
  for (const [key, spec] of Object.entries(SUPPORTED_INPUTS)) {
    console.error(`  ${String(key).padEnd(18)} ${String(spec.pattern)}  ${spec.role}${spec.required ? '  (REQUIRED)' : ''}`);
  }
  process.exit(2);
}

const names = fs.readdirSync(dir).filter((n) => !n.startsWith('.'));
const files = names.map((n) => ({ originalName: n, bytes: fs.readFileSync(path.join(dir, n)) }));
const manifest = manifestPath && fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;

const totalBytes = files.reduce((a, f) => a + f.bytes.length, 0);
console.log(`Packet: ${dir}`);
console.log(`Files: ${files.length} (limit ${UPLOAD_POLICY.maxFiles}), total ${(totalBytes / 1024 / 1024).toFixed(2)} MB (limit ${(UPLOAD_POLICY.maxTotalBytes / 1024 / 1024).toFixed(0)} MB)\n`);

const t0 = Date.now();
const r = await ingestDemoPacket({ files, manifest });
const ms = Date.now() - t0;

console.log('FILE OUTCOMES');
for (const f of r.files) {
  const detail = f.format ? `format ${f.format}, ${f.messages} message(s)`
    : f.extractionMode ? `${f.extractionMode}, ${f.words || 0} word(s)`
    : f.rows != null ? `${f.rows} row(s)`
    : f.segments != null ? `${f.segments} paragraph(s)`
    : f.reason || '';
  console.log(`  ${String(f.status).padEnd(12)} ${String(f.originalName).padEnd(32)} ${detail}`);
}

console.log('\nCOVERAGE');
const c = r.report.counts;
console.log(`  people ${c.people} | relationships ${c.relationships} | sources ${c.sources} | photos ${c.assets} | stories ${c.stories} | evidence roots ${c.evidenceRoots}`);
const rec = r.report.reconciliation;
console.log(`  relationships: ${rec.rawRows} raw rows -> ${rec.normalized} normalized (${rec.mergedCount} merged, ${rec.excludedCount} excluded)`);
for (const m of rec.merged) console.log(`    merged  ${m.relationshipId} into ${m.mergedInto} at ${m.locator} (${m.reason})`);
for (const e of rec.excluded) console.log(`    EXCLUDED ${e.relationshipId} at ${e.locator}: ${e.reason}`);
console.log(`  PDF: ${r.report.pdfExtraction ? r.report.pdfExtraction.mode : 'no Family_Overview.pdf supplied'}`);

console.log('\nPHOTOS');
for (const a of r.assets) {
  const who = a.personIds?.length ? a.personIds.join(', ') : 'nobody identified';
  const order = a.orderIsSupplied ? 'left-to-right supplied' : a.positionsUnknown ? 'positions unknown' : '';
  console.log(`  ${String(a.originalName).padEnd(32)} ${who}${order ? `  (${order})` : ''}${a.caption ? '' : '  NO CAPTION'}`);
}

const errors = r.issues.filter((i) => i.severity === 'error');
const warns = r.issues.filter((i) => i.severity !== 'error');
if (errors.length) {
  console.log(`\nERRORS (${errors.length}) - these block the demo`);
  for (const e of errors) console.log(`  ! ${e.code}: ${e.message}`);
}
if (warns.length) {
  console.log(`\nISSUES (${warns.length})`);
  for (const w of warns) console.log(`  - ${w.code}: ${w.message}`);
}
if (r.warnings.length) {
  console.log(`\nPARSER NOTES (${r.warnings.length})`);
  for (const w of r.warnings) console.log(`  - ${w}`);
}

// Staged coverage: can every person be released safely in six batches?
if (r.people.length) {
  const snap = { people: r.people, relationships: r.relationships, claims: r.claims, stories: r.stories, assets: r.assets, sources: r.sources, layout: r.layout };
  const youngest = [...r.people].sort((a, b) => (r.layout.positions[b.id]?.generation ?? 0) - (r.layout.positions[a.id]?.generation ?? 0))[0];
  const init = planInitialBranch(snap, { focusPersonId: youngest.id, size: 5 });
  const plan = planStagedBatches({ snapshot: snap, releasedIds: init.personIds });
  const check = validateBatchPlan({ snapshot: snap, releasedIds: init.personIds, batches: plan.batches });
  console.log('\nSTAGED RELEASE');
  console.log(`  initial branch: ${init.personIds.join(', ')}`);
  for (const b of plan.batches) console.log(`  batch ${b.index} @ ${b.offsetSeconds}s  +${b.personIds.length} -> ${b.cumulativeTotal}`);
  console.log(`  dependency-safe: ${check.ok}${check.problems.length ? `\n    ${check.problems.join('\n    ')}` : ''}`);
  if (check.unreachable.length) console.log(`  NOT REACHED: ${check.unreachable.join(', ')}`);
}

console.log(`\nParsed in ${ms} ms. ${errors.length ? `${errors.length} error(s).` : 'No errors.'}`);
process.exit(errors.length ? 1 : 0);
