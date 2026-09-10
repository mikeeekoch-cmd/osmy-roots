#!/usr/bin/env node
/** Validate the same strict roots-v1 parser used by the app. No model/network calls. */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseFamilyPacket } from '../server/ingestion/index.mjs';
import { prepareManifestBatches } from '../server/research/staged-sources.mjs';
import { DemoManifestSchema } from '../packages/contracts/round2.ts';

const directory = process.argv[2], manifestFlag = process.argv.indexOf('--manifest');
if (!directory) { console.error('Usage: node scripts/check-packet.mjs <01-upload directory> [--manifest <DEMO_MANIFEST.json>]'); process.exit(2); }
try {
  const files = await Promise.all((await readdir(directory)).filter(name => !name.startsWith('.')).map(async originalName => ({ originalName, bytes: await readFile(path.join(directory, originalName)) })));
  const startedAt = Date.now(), parsed = await parseFamilyPacket({ files });
  const failures = [...parsed.issues, ...parsed.files.filter(f => f.status === 'failed').map(f => `${f.originalName}: ${f.reason}`)];
  let batches;
  if (manifestFlag !== -1) {
    const manifestPath = process.argv[manifestFlag + 1];
    if (!manifestPath) throw new Error('--manifest requires a file path');
    const manifest = DemoManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
    const uploaded = new Map(files.map(f => [f.originalName, f]));
    for (const item of manifest.files) {
      const file = item.path.startsWith('01-upload/') ? uploaded.get(path.posix.basename(item.path)) : { bytes: await readFile(path.resolve(path.dirname(manifestPath), item.path)) };
      if (!file || file.bytes.length !== item.bytes || createHash('sha256').update(file.bytes).digest('hex') !== item.sha256) throw new Error(`Manifest file size/hash mismatch: ${item.path}`);
    }
    if (manifest.files.filter(item => item.path.startsWith('01-upload/')).length !== files.length) throw new Error('Selected file count differs from the frozen manifest');
    for (const question of manifest.questions) for (const span of question.support) {
      const source = parsed.sources.find(s => s.id === span.sourceId);
      if (!source || source.originalLocator !== span.locator || !source.originalText.includes(span.quote)) throw new Error(`Question ${question.id} has an unresolved source span`);
    }
    batches = prepareManifestBatches({ manifest, packet: parsed });
    const scheduled = new Set(batches.flatMap(batch => batch.relationshipIds));
    if (scheduled.size !== parsed.relationships.length) throw new Error('Manifest staged relationships omit part of the parsed graph');
  }
  const report = {
    parser: 'parseFamilyPacket (runtime roots-v1)', status: failures.length ? 'FAIL' : 'PASS',
    coverage: parsed.counts, files: parsed.files.map(f => ({ name: f.originalName, status: f.status })),
    photoAnnotations: parsed.photoAnnotations.length, chatMessages: parsed.sources.filter(s => s.kind === 'reconstructed_chat' || s.kind === 'uploaded_chat').reduce((n, s) => n + (s.segments?.length || 0), 0),
    manifestValidated: !!batches, batches: batches?.map(b => ({ id: b.id, people: b.personIds.length, relationships: b.relationshipIds.length, releaseOffsetSeconds: b.releaseOffsetSeconds })),
    errors: failures, elapsedMs: Date.now() - startedAt,
  };
  console.log(JSON.stringify(report, null, 2)); process.exitCode = failures.length ? 1 : 0;
} catch (error) { console.error(`Packet validation FAILED: ${error.message}`); process.exitCode = 1; }
