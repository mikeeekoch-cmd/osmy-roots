import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { readArchive, ArchiveError, unsafePathReason, UPLOAD_POLICY } from '../../server/ingestion/archive.mjs';
import { parseCsv, parseCsvRecords } from '../../server/ingestion/csv.mjs';
import { parseChatTranscript } from '../../server/ingestion/chat.mjs';
import { extractPdfText } from '../../server/ingestion/pdf-text.mjs';
import { ingestDemoPacket, SUPPORTED_INPUTS } from '../../server/ingestion/packet.mjs';
import { createZip } from '../../server/export/zip.mjs';
import { sha256 } from '../../server/ingestion/hash.mjs';

// The twin is generated once per run so a fresh clone needs no fixtures on disk.
const TWIN = fs.mkdtempSync(path.join(os.tmpdir(), 'roots-twin-'));
execFileSync(process.execPath, ['scripts/make-test-packet.mjs', TWIN], { cwd: process.cwd(), stdio: 'pipe' });
const UPLOAD = path.join(TWIN, '01-upload');
const packetFiles = () => fs.readdirSync(UPLOAD).map((n) => ({ originalName: n, bytes: fs.readFileSync(path.join(UPLOAD, n)) }));

// ---------------------------------------------------------------- archives
test('archive rejects traversal, absolute and drive-letter paths', () => {
  assert.equal(unsafePathReason('../../etc/passwd'), 'parent-directory traversal');
  assert.equal(unsafePathReason('/etc/passwd'), 'absolute path');
  assert.equal(unsafePathReason('C:\\Windows\\x'), 'drive-letter path');
  assert.equal(unsafePathReason('chat/_chat.txt'), null);
  const evil = createZip([{ path: 'ok.txt', bytes: 'fine' }]);
  const patched = Buffer.from(evil.toString('latin1').replace('ok.txt', '../evil'), 'latin1');
  assert.throws(() => readArchive(patched), (e) => e instanceof ArchiveError);
});

test('archive refuses executable content by extension', () => {
  const z = createZip([{ path: 'payload.sh', bytes: '#!/bin/sh\necho hi' }]);
  assert.throws(() => readArchive(z), (e) => e.code === 'EXECUTABLE');
});

test('archive lists a nested archive but never expands it', () => {
  const inner = createZip([{ path: 'deep.txt', bytes: 'deep' }]);
  const outer = createZip([{ path: '_chat.txt', bytes: '[01/01/2024, 10:00] A: hi' }, { path: 'inner.zip', bytes: inner }]);
  const r = readArchive(outer);
  const nested = r.entries.find((e) => e.name === 'inner.zip');
  assert.equal(nested.status, 'stored_only');
  assert.match(nested.reason, /not expanded/i);
  assert.ok(r.warnings.some((w) => /nested archive/i.test(w)));
});

test('archive enforces the entry cap and the expansion budget', () => {
  const many = Array.from({ length: 201 }, (_, i) => ({ path: `f${i}.txt`, bytes: 'x' }));
  assert.throws(() => readArchive(createZip(many)), (e) => e.code === 'TOO_MANY_ENTRIES');
  // Incompressible bytes, so the budget rather than the ratio bound is what trips.
  const noise = Buffer.alloc(50_000);
  for (let i = 0; i < noise.length; i += 1) noise[i] = (i * 2654435761) % 251;
  const big = createZip([{ path: 'big.bin', bytes: noise }]);
  assert.throws(() => readArchive(big, { budgetBytes: 1000 }), (e) => e.code === 'BUDGET_EXCEEDED');
});

test('archive refuses a highly compressible bomb by ratio', () => {
  const z = createZip([{ path: 'bomb.txt', bytes: '\0'.repeat(2_000_000) }]);
  assert.throws(() => readArchive(z, { limits: { maxCompressionRatio: 50 } }), (e) => e.code === 'COMPRESSION_RATIO' || e.code === 'ENTRY_TOO_LARGE');
});

test('archive refuses malformed input rather than guessing', () => {
  assert.throws(() => readArchive(Buffer.from('not a zip at all')), (e) => e.code === 'MALFORMED');
});

test('a total upload above the former 30 MB cap is accepted under the 100 MB policy', async () => {
  assert.equal(UPLOAD_POLICY.maxTotalBytes, 100 * 1024 * 1024);
  assert.equal(UPLOAD_POLICY.maxFileBytes, 25 * 1024 * 1024);
  const files = packetFiles();
  // Two 20 MB photos push the selection well past the old 30 MB total cap while
  // each file stays inside the 25 MB per-file limit.
  const png = (n) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(n, 7)]);
  files.push({ originalName: 'Extra_Scan_A.png', bytes: png(20 * 1024 * 1024) });
  files.push({ originalName: 'Extra_Scan_B.png', bytes: png(20 * 1024 * 1024) });
  const total = files.reduce((a, f) => a + f.bytes.length, 0);
  assert.ok(total > 30 * 1024 * 1024, 'the selection must exceed the old cap');
  const r = await ingestDemoPacket({ files });
  assert.equal(r.issues.some((i) => i.code === 'file_too_large'), false);
  assert.equal(r.issues.some((i) => i.code === 'upload_too_large'), false);
  assert.equal(r.report.counts.people, 35);
});

test('a single file above the 25 MB per-file limit is refused', async () => {
  const files = packetFiles();
  files.push({ originalName: 'Oversize.png', bytes: Buffer.alloc(26 * 1024 * 1024, 3) });
  const r = await ingestDemoPacket({ files });
  assert.ok(r.issues.some((i) => i.code === 'file_too_large'));
});

// ---------------------------------------------------------------- csv
test('CSV keeps quoted commas, doubled quotes and embedded newlines', () => {
  const { records } = parseCsvRecords('id,note\nP1,"He said ""yes"", then left\nthe next morning"\nP2,plain\n');
  assert.equal(records[0].note, 'He said "yes", then left\nthe next morning');
  assert.equal(records[1].note, 'plain');
  assert.equal(records[0].__row, 2);
});

test('CSV reports an unterminated quoted field instead of truncating', () => {
  assert.throws(() => parseCsv('id,note\nP1,"never closed\n'), (e) => e.code === 'ECSVUNTERMINATED');
});

// ---------------------------------------------------------------- chat
test('chat parser keeps multiline messages, attachments and system notices', () => {
  const t = ['[12/03/2024, 10:04:11] Mom: first line', 'second line', '[12/03/2024, 10:05:02] Dad: <attached: IMG-1.jpg>', '[12/03/2024, 10:06:00] Messages are encrypted.'].join('\n');
  const r = parseChatTranscript(t, { archiveName: 'WhatsApp_Mom.zip' });
  assert.equal(r.format, 'whatsapp-ios');
  assert.equal(r.messages.length, 3);
  assert.match(r.messages[0].text, /first line\nsecond line/);
  assert.equal(r.messages[1].attachmentName, 'IMG-1.jpg');
  assert.equal(r.messages[2].isSystemNotice, true);
  assert.equal(r.messages[0].locator, 'WhatsApp_Mom.zip!_chat.txt#msg:1');
});

test('chat parser also reads the Android layout', () => {
  const r = parseChatTranscript('12/03/2024, 10:04 - Dad: hello\n12/03/2024, 10:05 - Mom: hi');
  assert.equal(r.format, 'whatsapp-android');
  assert.equal(r.messages.length, 2);
});

test('an unrecognised transcript is reported, not silently accepted', () => {
  const r = parseChatTranscript('just some prose with no timestamps at all');
  assert.equal(r.format, 'unrecognised');
  assert.equal(r.messages.length, 0);
});

// ---------------------------------------------------------------- pdf
test('PDF text extraction reads the supplied overview', () => {
  const bytes = fs.readFileSync(path.join(UPLOAD, 'Family_Overview.pdf'));
  const r = extractPdfText(bytes);
  assert.equal(r.ok, true);
  assert.equal(r.pages, 1);
  assert.match(r.text, /Vale Family Overview/);
  assert.match(r.text, /thirty five people/);
});

test('a text-free PDF is reported as needing a sidecar, not as parsed', () => {
  const empty = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');
  const r = extractPdfText(empty);
  assert.equal(r.ok, false);
  assert.match(r.reason, /sidecar/i);
});

test('a sidecar is only trusted when it is bound to the PDF hash', async () => {
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');
  const files = packetFiles().filter((f) => f.originalName !== 'Family_Overview.pdf');
  files.push({ originalName: 'Family_Overview.pdf', bytes: pdfBytes });

  const unbound = [...files, { originalName: 'Family_Overview.pdf.txt', bytes: Buffer.from('Some prepared text with no hash.', 'utf8') }];
  const bad = await ingestDemoPacket({ files: unbound });
  assert.ok(bad.issues.some((i) => i.code === 'sidecar_not_hash_bound'));

  const bound = [...files, { originalName: 'Family_Overview.pdf.txt', bytes: Buffer.from(`sha256: ${sha256(pdfBytes)}\n\nPrepared overview text.`, 'utf8') }];
  const good = await ingestDemoPacket({ files: bound });
  assert.equal(good.issues.some((i) => i.code === 'sidecar_not_hash_bound'), false);
  assert.equal(good.report.pdfExtraction.mode, 'prepared_sidecar', 'a sidecar is labelled, never called PDF extraction');
});

// ---------------------------------------------------------------- packet
test('a normal intake reconstructs the whole roster with no project JSON', async () => {
  const r = await ingestDemoPacket({ files: packetFiles() });
  assert.equal(r.report.counts.people, 35);
  assert.equal(r.report.errors, 0);
  assert.equal(r.report.recognised.chatArchive, 3);
  assert.ok(r.report.counts.relationships > 40);
  assert.equal(r.report.pdfExtraction.mode, 'pdf_text_layer');
  assert.equal(r.files.some((f) => /project\.json/i.test(f.originalName)), false);
});

test('the raw-to-normalized reconciliation records every merged row', async () => {
  const r = await ingestDemoPacket({ files: packetFiles() });
  const rec = r.report.reconciliation;
  assert.equal(rec.normalized, rec.rawRows - rec.mergedCount - rec.excludedCount);
  assert.ok(rec.mergedCount >= 1);
  assert.ok(rec.merged[0].mergedInto, 'a merged row names the row it merged into');
  assert.ok(rec.merged[0].locator);
});

test('duplicate person IDs and dangling links are reported, never quietly fixed', async () => {
  const files = packetFiles();
  const reg = files.find((f) => f.originalName === 'Family_Register.csv');
  reg.bytes = Buffer.concat([reg.bytes, Buffer.from('P001,Duplicate Vale,,1900,year,,unknown,Nowhere,Nowhere,SRC_OVERVIEW,confirmed,\n', 'utf8')]);
  const rel = files.find((f) => f.originalName === 'Family_Relationships.csv');
  rel.bytes = Buffer.concat([rel.bytes, Buffer.from('R900,P001,P999,parent,parent to child,SRC_OVERVIEW,confirmed,\n', 'utf8')]);
  const r = await ingestDemoPacket({ files });
  assert.ok(r.issues.some((i) => i.code === 'duplicate_person_id'));
  const dangling = r.issues.find((i) => i.code === 'relationship_missing_endpoint');
  assert.ok(dangling);
  assert.ok(dangling.missing.includes('P999'));
  assert.equal(r.relationships.some((x) => x.id === 'R900'), false);
  assert.ok(r.report.reconciliation.excluded.some((e) => e.relationshipId === 'R900'));
});

test('same-name people stay separate records', async () => {
  const files = packetFiles();
  const reg = files.find((f) => f.originalName === 'Family_Register.csv');
  reg.bytes = Buffer.concat([reg.bytes, Buffer.from('P900,Cedar Vale,,1899,year,,unknown,Elsewhere,Elsewhere,SRC_OVERVIEW,candidate,Same name as P003\n', 'utf8')]);
  const r = await ingestDemoPacket({ files });
  const sameName = r.people.filter((p) => p.displayNameEn === 'Cedar Vale');
  assert.equal(sameName.length, 2);
  assert.notEqual(sameName[0].id, sameName[1].id);
});

test('repeated copies of one memory share an evidence root', async () => {
  const r = await ingestDemoPacket({ files: packetFiles() });
  const workshop = r.evidenceRoots.EV_WORKSHOP;
  assert.ok(Array.isArray(workshop) && workshop.length > 1, 'the workshop memory appears in more than one file');
  assert.ok(r.warnings.some((w) => /EV_WORKSHOP/.test(w) && /Counted once/i.test(w)));
});

test('a missing chat attachment is reported with its message locator', async () => {
  const r = await ingestDemoPacket({ files: packetFiles() });
  const missing = r.issues.find((i) => i.code === 'missing_attachment');
  assert.ok(missing);
  assert.match(missing.message, /Missing_Photo\.png/);
  assert.match(missing.locator, /#msg:/);
});

test('photo bytes, hashes and English names map to the supplied annotations', async () => {
  const r = await ingestDemoPacket({ files: packetFiles() });
  const asset = r.assets.find((a) => a.originalName === '03__Cedar_and_Dahlia.png');
  const onDisk = fs.readFileSync(path.join(UPLOAD, '03__Cedar_and_Dahlia.png'));
  assert.deepEqual(asset.bytes, onDisk, 'photo bytes are unchanged');
  assert.equal(asset.contentHash, sha256(onDisk));
  assert.deepEqual(asset.personIds, ['P003', 'P004']);
  assert.equal(asset.orderIsSupplied, true, 'left-to-right was annotated for this image');
  const group = r.assets.find((a) => a.originalName === '06__Family_group.png');
  assert.equal(group.positionsUnknown, true, 'positions stay unknown when not annotated');
});

test('a caption naming a photo that was not uploaded is reported', async () => {
  const files = packetFiles().filter((f) => f.originalName !== '05__Elm_Vale.png');
  const r = await ingestDemoPacket({ files });
  assert.ok(r.issues.some((i) => i.code === 'caption_photo_missing' && /05__Elm_Vale\.png/.test(i.message)));
});

test('supplied recollections stay unaccepted until a live review', async () => {
  const r = await ingestDemoPacket({ files: packetFiles() });
  assert.ok(r.stories.length > 0);
  assert.equal(r.stories.every((s) => s.status === 'proposed'), true, 'nothing arrives pre-accepted');
});

test('a file outside the supported formats is stored honestly, not faked', async () => {
  const files = [...packetFiles(), { originalName: 'Notes.rtf', bytes: Buffer.from('{\\rtf1 hello}', 'utf8') }];
  const r = await ingestDemoPacket({ files });
  const outcome = r.files.find((f) => f.originalName === 'Notes.rtf');
  assert.equal(outcome.status, 'stored_only');
  assert.match(outcome.reason, /not a recognised packet input|does not match a supported/i);
});

test('a manifest mismatch fails loudly', async () => {
  const r = await ingestDemoPacket({ files: packetFiles(), manifest: { expectedPeople: 40, expectedNormalizedRelationships: 99 } });
  assert.ok(r.issues.some((i) => i.code === 'roster_mismatch'));
  assert.ok(r.issues.some((i) => i.code === 'relationship_count_mismatch'));
});

test('the supported-format list is published for Product', () => {
  assert.ok(SUPPORTED_INPUTS.register.required);
  assert.ok(SUPPORTED_INPUTS.relationships.required);
  assert.match('Family_Register.csv', SUPPORTED_INPUTS.register.pattern);
  assert.match('WhatsApp_Mom.zip', SUPPORTED_INPUTS.chatArchive.pattern);
});
