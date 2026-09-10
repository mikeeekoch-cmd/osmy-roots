import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFamilyPacket, parseCsv, readUploadZip, ingestContribution } from '../../server/ingestion/index.mjs';
import { createZip } from '../../server/export/zip.mjs';
import { readFileSync } from 'node:fs';
import { sha256 } from '../../server/ingestion/hash.mjs';

const f = (originalName, text) => ({ originalName, bytes: Buffer.isBuffer(text) ? text : Buffer.from(text) });
const people = 'person_id,full_name,birth,birth_precision,death,death_precision,places,source_refs,status\nP1,"Alex Morgan",1900,approximate,,unknown,London,prior-register,reported\nP2,"Alex Morgan",1930 or 1932,unknown,,unknown,Unknown,prior-register,candidate\nP3,"Jamie Morgan",1950,year,,unknown,Unknown,prior-register,reported\n';
const rels = 'relationship_id,from_person_id,to_person_id,type,source_refs,status\nR1,P1,P2,parent,prior-register,reported\nR2,P2,P3,parent,prior-register,candidate\nR3,P1,P2,parent,prior-register,reported\n';
const basic = () => [f('Family_Register.csv', people), f('Family_Relationships.csv', rels)];

test('packet reconstructs ordinary CSV, preserves same names, uncertainty and audited duplicates', async () => {
  const r = await parseFamilyPacket({ files: basic() });
  assert.equal(r.people.length, 3); assert.equal(r.relationships.length, 2);
  assert.equal(r.people[0].lifeYears.birth.precision, 'approximate');
  assert.deepEqual(r.people[1].lifeYears.birth, { value: '1930 or 1932', precision: 'unknown' });
  assert.equal(r.relationships[1].status, 'proposed');
  assert.deepEqual(r.relationshipReconciliation.at(-1).action, 'merged_duplicate');
  for (const c of r.claims) for (const s of c.spans) assert.ok(r.sources.find((x) => x.id === s.sourceId).originalText.includes(s.quote));
  assert.equal(r.assetBytes.length, 2); assert.equal(r.stories.length, 0);
});
test('CSV quoted newlines, double quotes, commas and exact row spans survive', () => {
  const rows = parseCsv('id,name,note\r\n1,"Morgan, Alex","First line\nSecond ""quoted"" line"\r\n');
  assert.equal(rows[0].values.name, 'Morgan, Alex'); assert.equal(rows[0].values.note, 'First line\nSecond "quoted" line');
  assert.equal(rows[0].startLine, 2); assert.equal(rows[0].endLine, 3);
  assert.throws(() => parseCsv('id,id\n1,2'), /duplicate/); assert.throws(() => parseCsv('id,name\n1,"open'), /Unterminated/);
});
test('packet rejects duplicate IDs, missing references and parent cycles', async () => {
  await assert.rejects(parseFamilyPacket({ files: [f('Family_Register.csv', people.replace('P2,', 'P1,')), basic()[1]] }), /duplicate person/);
  await assert.rejects(parseFamilyPacket({ files: [basic()[0], f('Family_Relationships.csv', rels.replace('R1,P1,P2', 'R1,P9,P2'))] }), /Invalid relationship/);
  await assert.rejects(parseFamilyPacket({ files: [basic()[0], f('Family_Relationships.csv', rels + 'R4,P3,P1,parent,prior-register,reported\n')] }), /cycle/);
});
test('three actual reconstructed chats share evidence roots and preserve real attribution', async () => {
  const files = ['mom', 'dad', 'family'].map((role) => f(`WhatsApp_${role}.zip`, createZip([
    { path: '_chat.txt', bytes: '[01/01/2000, 00:00:00] Reconstructed voice: The potter worked in clay.\nThis continues the same memory.\n<attached: missing.jpg>\n' },
    { path: 'metadata.json', bytes: JSON.stringify({ sourceId: `chat-${role}`, reconstruction: true, evidenceRootId: 'book-p12', attribution: 'Actual memoir author' }) },
  ])));
  const r = await ingestContribution({ files });
  assert.equal(r.sources.length, 3); assert.equal(new Set(r.sources.map((s) => s.evidenceRootId)).size, 1);
  assert.equal(r.sources[0].author, 'Actual memoir author'); assert.equal(r.sources[0].messageTimestamp, null);
  assert.match(r.sources[0].segments[0].text, /continues the same memory/); assert.match(r.sources[0].segments[0].locator, /message-1/);
  assert.ok(r.files.every((s) => s.status === 'parsed' && s.warnings.some((w) => w.includes('attachment missing'))));
});
test('ZIP rejects traversal, symlink, nesting, corruption, compression bombs and entry count', () => {
  const safe = createZip([{ path: '_chat.txt', bytes: 'Valid chat text' }]);
  assert.equal(readUploadZip(safe)[0].name, '_chat.txt');
  const traversal = Buffer.from(safe); for (let i = 0; i < traversal.length - 9; i++) if (traversal.toString('utf8', i, i + 9) === '_chat.txt') traversal.write('../xx.txt', i);
  assert.throws(() => readUploadZip(traversal), /Unsafe/);
  const symlink = Buffer.from(safe), central = symlink.indexOf(Buffer.from('504b0102', 'hex')); symlink.writeUInt32LE(0xa1ff0000, central + 38);
  assert.throws(() => readUploadZip(symlink), /symlink/);
  const executable = Buffer.from(safe); executable.writeUInt16LE(0x0314, central + 4); executable.writeUInt32LE(0x81ed0000, central + 38);
  assert.throws(() => readUploadZip(executable), /Executable/);
  assert.throws(() => readUploadZip(createZip([{ path: 'inner.zip', bytes: 'x' }])), /Nested/);
  const broken = Buffer.from(safe); broken[39] ^= 0xff; assert.throws(() => readUploadZip(broken));
  assert.throws(() => readUploadZip(createZip([{ path: '_chat.txt', bytes: 'x'.repeat(1000000) }])), /ratio/);
  assert.throws(() => readUploadZip(createZip(Array.from({ length: 201 }, (_, i) => ({ path: `${i}.txt`, bytes: 'a' })))), /oversized/);
  assert.throws(() => readUploadZip(safe, { expandedBytes: 100_000_000 }), /expansion/);
});
test('ordered photo annotations preserve original image bytes and do not identify without review', async () => {
  const image = readFileSync('fixtures/public/placeholder-portrait.png');
  const caption = [{ assetId: 'photo-01', file: '01__Alex_Morgan.png', sha256: sha256(image), positions: [{ position: 1, personId: 'P1', label: 'Alex Morgan', status: 'proposed' }], support: [] }];
  const r = await parseFamilyPacket({ files: [...basic(), f('01__Alex_Morgan.png', image), f('Photo_Captions.txt', JSON.stringify(caption))] });
  assert.ok(r.assets.find((a) => a.id === 'photo-01')); assert.deepEqual(r.assetBytes.find((a) => a.assetId === 'photo-01').bytes, image);
  assert.equal(r.people[0].photoIds.length, 0); assert.equal(r.photoAnnotations[0].positions[0].personId, 'P1');
});

test('PDF intake actually extracts English text and preserves exact original PDF bytes', async () => {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const content = 'BT /F1 16 Tf 30 150 Td (An English family overview.) Tj ET';
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  let pdf = '%PDF-1.4\n', offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = Buffer.from(pdf), result = await ingestContribution({ files: [f('Family_Overview.pdf', bytes)] });
  assert.equal(result.files[0].status, 'parsed'); assert.match(result.sources[0].originalText, /An English family overview/);
  assert.match(result.sources[0].extractionMethod, /actual text extraction/); assert.deepEqual(result.assets[0].bytes, bytes);
});

test('archive detection is based on bytes, and undated message provenance is retained', async () => {
  const zip = createZip([{ path: '_chat.txt', bytes: 'Collector: The vessel is remembered.\nFamily role: It was made of wood.' }, { path: 'metadata.json', bytes: JSON.stringify({ reconstruction: true, sourceId: 'chat-family', messages: [{ ordinal: 2, evidenceRootId: 'memoir-1', attribution: 'Original author', sourceSpan: 'page 7' }] }) }]);
  const r = await ingestContribution({ files: [f('misnamed.txt', zip)] });
  assert.equal(r.files[0].status, 'parsed'); assert.equal(r.sources[0].segments[1].evidenceRootId, 'memoir-1');
  assert.equal(r.sources[0].segments[1].scaffoldTimestamp, null); assert.equal(r.sources[0].messageTimestamp, null);
  assert.throws(() => readUploadZip(createZip([{ path: '_chat.txt', bytes: zip }])), /Nested archive/);
});
