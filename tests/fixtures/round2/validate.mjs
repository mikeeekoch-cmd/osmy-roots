import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFamilyPacket } from '../../../server/ingestion/packet.mjs';
import { DemoManifestSchema } from '../../../packages/contracts/round2.ts';
import { ProjectSnapshotSchema } from '../../../packages/contracts/index.ts';
import { validateSnapshot, validateSpans } from '../../../server/state/validation.ts';

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), 'packet');
const root = process.argv[2] || defaultRoot;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const manifestBytes = await readFile(join(root, 'DEMO_MANIFEST.json'));
const manifest = DemoManifestSchema.parse(JSON.parse(manifestBytes));
const expected = JSON.parse(await readFile(join(root, '80-presenter/EXPECTED_OUTCOME.json'), 'utf8'));
const filenames = (await readdir(join(root, '01-upload'))).sort();
const files = await Promise.all(filenames.map(async (originalName) => ({ originalName, bytes: await readFile(join(root, '01-upload', originalName)) })));
assert.equal(files.length, 14);
assert.ok(files.reduce((sum, file) => sum + file.bytes.length, 0) <= 20_000_000);
assert.equal(hash(manifestBytes), expected.packetHash);
assert.equal(hash(await readFile(join(root, '80-presenter/SCRIPT_120_SECONDS.md'))), manifest.script.sha256);
for (const file of manifest.files) {
  const bytes = await readFile(join(root, file.path));
  assert.equal(hash(bytes), file.sha256, file.path);
  assert.equal(bytes.length, file.bytes, file.path);
  for (const lineage of file.lineage) assert.equal(lineage.derivativeHash, file.sha256);
}

const packet = await parseFamilyPacket({ files });
const snapshot = ProjectSnapshotSchema.parse({ schemaVersion: 'roots-v1', projectId: 'fictional-packet-validation', version: 1,
  input: { seedName: 'Rowan Vale', geography: 'Willowford and Harbourfield' },
  people: packet.people, relationships: packet.relationships, claims: packet.claims, stories: packet.stories,
  sources: packet.sources, assets: packet.assets, proposals: [], researchEvents: [], history: [], bookPassages: [], bookStatus: 'empty',
  layout: packet.layout || {}, files: packet.files, issues: packet.issues || [], photoAnnotations: manifest.photos });
validateSnapshot(snapshot);
for (const question of manifest.questions) validateSpans(question.support, snapshot);
for (const photo of manifest.photos) validateSpans(photo.support, snapshot);
assert.deepEqual(packet.issues, []);
assert.deepEqual(packet.warnings, []);
assert.equal(packet.people.length, 35);
assert.equal(packet.relationships.length, 56);
assert.equal(packet.stories.length, 0, 'Recollection must remain unaccepted initially');
assert.equal(packet.photoAnnotations.length, 6);
assert.equal(packet.files.filter((file) => file.status === 'parsed').length, 8);
assert.equal(packet.files.filter((file) => file.status === 'stored_only').length, 6);
assert.deepEqual(packet.people.find((person) => person.id === 'F017').lifeYears.birth, { value: null, precision: 'unknown' });
assert.equal(packet.people.filter((person) => person.displayNameEn === 'Mira Vale').length, 2);
assert.equal(packet.relationships.find((relation) => relation.id === 'FR003').status, 'proposed');
assert.equal(packet.relationships.find((relation) => relation.id === 'FR039').status, 'accepted');
assert.equal(packet.people.find((person) => person.id === 'F005').lifeYears.birth.precision, 'approximate');

for (const source of packet.sources) {
  assert.ok(!/[\u0400-\u04ff\u2014]/u.test(source.originalText || ''), `English text: ${source.id}`);
  assert.ok(!/\/Users\/|\/private\/tmp\//.test(JSON.stringify(source)), `Public source boundary: ${source.id}`);
}
for (const question of manifest.questions) for (const span of question.support) {
  const source = packet.sources.find((item) => item.id === span.sourceId);
  assert.ok(source, `Missing question source ${span.sourceId}`);
  assert.equal(span.locator, source.originalLocator, `Canonical locator: ${question.id}`);
  assert.ok(source.originalText.includes(span.quote), `Quote not present: ${question.id}`);
}
for (const photo of manifest.photos) {
  for (const span of photo.support) assert.equal(span.locator, packet.sources.find((source) => source.id === span.sourceId)?.originalLocator);
  const asset = packet.assets.find((item) => item.id === photo.assetId);
  assert.ok(asset, `Missing photo ${photo.assetId}`);
  const bytes = packet.assetBytes.find((item) => item.assetId === asset.id).bytes;
  assert.equal(hash(bytes), hash(await readFile(join(root, '01-upload', photo.file))));
}
const recollection = packet.sources.find((source) => source.id === 'chat-family');
assert.equal(recollection.evidenceRootId, 'fictional-memory:17');
assert.equal(recollection.messageTimestamp, null);
assert.ok(recollection.originalText.includes('[Transcription gap.]'));
assert.ok(!packet.sources.find((source) => source.id === 'family-overview').originalText.includes('repaired wooden boats'));
const rawRelationships = await readFile(join(root, '90-provenance/RAW_RELATIONSHIPS.csv'));
const duplicatePacket = await parseFamilyPacket({ files: files.map((file) => file.originalName === 'Family_Relationships.csv' ? { ...file, bytes: rawRelationships } : file) });
assert.equal(duplicatePacket.relationships.length, 56);
assert.ok(duplicatePacket.relationshipReconciliation.some((row) => row.id === 'FR046' && row.action === 'merged_duplicate' && row.retainedId === 'FR039'));

let available = new Set(manifest.initialBranchIds);
const relationMap = new Map(packet.relationships.map((relation) => [relation.id, relation]));
const assigned = new Set(expected.initialRelationships);
for (const [index, batch] of manifest.batches.entries()) {
  for (const id of batch.personIds) { assert.ok(!available.has(id)); available.add(id); }
  for (const id of batch.relationshipIds) {
    const relationship = relationMap.get(id);
    assert.ok(relationship && available.has(relationship.fromPersonId) && available.has(relationship.toPersonId), `Dangling release ${id}`);
    assert.ok(!assigned.has(id), `Repeated release ${id}`);
    assigned.add(id);
  }
  assert.equal(available.size, expected.batchTotals[index]);
}
assert.equal(available.size, 35);
assert.equal(assigned.size, 56);
assert.equal(manifest.batches.at(-1).releaseOffsetSeconds - manifest.batches[0].releaseOffsetSeconds, 45);
console.log(JSON.stringify({ status: 'fixture-ready', people: 35, relationships: 56, rawRelationships: 57, photos: 6, parsedDocumentsAndArchives: 8, uploadFiles: 14, bytes: files.reduce((sum, file) => sum + file.bytes.length, 0), questions: 7, batches: 6, batchSpanSeconds: 45, packetHash: expected.packetHash }));
