#!/usr/bin/env node
/**
 * Generate a FICTIONAL engineering twin of the demo packet, for parser tests only.
 *
 * This is not the demo artifact pack and not a second content pack. Product owns the
 * real private packet and its facts. Everything here is invented: names, dates,
 * places and photographs. It exists so ingestion, retrieval and export can be tested
 * on a fresh clone with no private material.
 *
 * Usage: node scripts/make-test-packet.mjs <outputDir>
 */

import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { createZip } from '../server/export/zip.mjs';
import { PdfDocument, A4 } from '../server/export/pdf/document.mjs';
import { selectFont } from '../server/export/pdf/ttf.mjs';

const OUT = process.argv[2] || path.join(process.cwd(), '.tmp-test-packet');

/** Deterministic tiny PNG so photo bytes and hashes are stable across runs. */
function makePng(w, h, seed) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y += 1) {
    raw[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x += 1) {
      const i = y * (1 + w * 3) + 1 + x * 3;
      raw[i] = (x * 7 + seed * 13) % 256;
      raw[i + 1] = (y * 5 + seed * 29) % 256;
      raw[i + 2] = (x + y + seed * 47) % 256;
    }
  }
  const table = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  const crc = (b) => { let c = -1; for (const x of b) c = (c >>> 8) ^ table[(c ^ x) & 255]; return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- fictional roster: 35 people across five generations --------------------
const GIVEN = ['Alder', 'Briar', 'Cedar', 'Dahlia', 'Elm', 'Fern', 'Grove', 'Hazel', 'Ivy', 'Juniper',
  'Larch', 'Maple', 'Nettle', 'Olive', 'Poplar', 'Quince', 'Rowan', 'Sorrel', 'Thistle', 'Vetch',
  'Willow', 'Yarrow', 'Aspen', 'Birch', 'Clover', 'Dogwood', 'Elder', 'Foxglove', 'Gorse', 'Heather',
  'Indigo', 'Jasmine', 'Kale', 'Linden', 'Myrtle'];
const SURNAME = 'Vale';
const PLACES = ['Northbrook', 'Rill Ford', 'Ashfen', 'Harrow Green', 'Mereton'];

const people = GIVEN.map((given, i) => {
  const id = `P${String(i + 1).padStart(3, '0')}`;
  const generation = i < 2 ? 0 : i < 7 ? 1 : i < 15 ? 2 : i < 25 ? 3 : 4;
  const baseYear = [1868, 1896, 1924, 1953, 1981][generation];
  const known = i % 7 !== 3;
  return {
    id,
    name: `${given} ${SURNAME}`,
    alias: i % 5 === 0 ? `${given[0]}. ${SURNAME}` : '',
    birth: known ? String(baseYear + (i % 6)) : '',
    birthPrecision: known ? (i % 4 === 0 ? 'approximate' : 'year') : 'unknown',
    death: generation <= 2 && i % 3 === 0 ? String(baseYear + 60 + (i % 5)) : '',
    deathPrecision: generation <= 2 && i % 3 === 0 ? 'year' : 'unknown',
    place: PLACES[i % PLACES.length],
    status: i % 11 === 5 ? 'candidate' : 'confirmed',
    generation,
  };
});

const byGen = (g) => people.filter((p) => p.generation === g);
const rels = [];
let relSeq = 0;
const addRel = (from, to, type, status, note) => {
  relSeq += 1;
  rels.push({ id: `R${String(relSeq).padStart(3, '0')}`, from, to, type, status: status || 'confirmed', note: note || '' });
};
for (let g = 0; g < 4; g += 1) {
  const parents = byGen(g);
  const children = byGen(g + 1);
  children.forEach((child, i) => {
    const father = parents[i % parents.length];
    const mother = parents[(i + 1) % parents.length];
    addRel(father.id, child.id, 'parent', i % 9 === 4 ? 'candidate' : 'confirmed');
    if (mother.id !== father.id && i % 2 === 0) addRel(mother.id, child.id, 'parent', 'confirmed');
  });
}
addRel('P001', 'P002', 'spouse', 'confirmed');
addRel('P003', 'P004', 'spouse', 'candidate');
// One deliberate duplicate row: raw count is one higher than the normalized count.
const dup = rels[0];
relSeq += 1;
rels.push({ id: `R${String(relSeq).padStart(3, '0')}`, from: dup.from, to: dup.to, type: dup.type, status: dup.status, note: 'duplicate of ' + dup.id });

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

fs.rmSync(OUT, { recursive: true, force: true });
const upload = path.join(OUT, '01-upload');
fs.mkdirSync(upload, { recursive: true });

// Family_Register.csv
fs.writeFileSync(path.join(upload, 'Family_Register.csv'), toCsv([
  ['person_id', 'full_name_en', 'aliases', 'birth_date', 'birth_precision', 'death_date', 'death_precision', 'birth_place', 'places', 'source_refs', 'record_status', 'notes'],
  ...people.map((p) => [p.id, p.name, p.alias, p.birth, p.birthPrecision, p.death, p.deathPrecision, p.place, p.place, 'SRC_OVERVIEW', p.status,
    p.id === 'P010' ? 'Two registers disagree, 1927 and 1929. Kept unresolved.' : '']),
]));

// Family_Relationships.csv
fs.writeFileSync(path.join(upload, 'Family_Relationships.csv'), toCsv([
  ['relationship_id', 'from_person_id', 'to_person_id', 'relationship_type', 'subtype', 'source_refs', 'status', 'notes'],
  ...rels.map((r) => [r.id, r.from, r.to, r.type, r.type === 'parent' ? 'parent to child' : 'partners', 'SRC_OVERVIEW', r.status, r.note]),
]));

// Family_Recollections.txt
fs.writeFileSync(path.join(upload, 'Family_Recollections.txt'), [
  '[SRC_REC_01] P003 kept a workshop behind the house at Ashfen and mended tools for the whole lane. evidence_root: EV_WORKSHOP',
  '',
  '[SRC_REC_02] P008 walked to Mereton for work each spring and came home for the harvest. The exact year of the first journey is not recorded.',
  '',
  '[SRC_REC_03] P010 has two recorded birth years, 1927 in one register and 1929 in a later copy. The family never resolved which is correct.',
  '',
  '[SRC_REC_04] P001 and P002 were married at Northbrook. The month is not preserved in the supplied record.',
  '',
].join('\n'));

// Photo_Captions.txt and the photographs
const photoSpecs = [
  { file: '01__Alder_Vale.png', ids: ['P001'], order: 1, caption: 'Studio portrait. Confirmed sitter.' },
  { file: '02__Briar_Vale.png', ids: ['P002'], order: 2, caption: 'Portrait supplied by the family.' },
  { file: '03__Cedar_and_Dahlia.png', ids: ['P003', 'P004'], order: 3, caption: 'Two people, left to right as annotated.' },
  { file: '04__Workshop_at_Ashfen.png', ids: ['P003'], order: 4, caption: 'The workshop doorway. evidence_root: EV_WORKSHOP' },
  { file: '05__Elm_Vale.png', ids: ['P005'], order: 5, caption: 'Portrait, date approximate.' },
  { file: '06__Family_group.png', ids: ['P008', 'P009', 'P010'], order: 6, caption: 'Group photograph. Positions were not recorded.' },
  { file: '07__Memorial_stone.png', ids: [], order: 7, caption: 'A memorial stone. No living person is identified in this image.' },
  { file: '08__Hazel_Vale.png', ids: ['P008'], order: 8, caption: 'Portrait supplied with the register.' },
];
photoSpecs.forEach((spec, i) => fs.writeFileSync(path.join(upload, spec.file), makePng(320, 400, i + 1)));
fs.writeFileSync(path.join(upload, 'Photo_Captions.txt'), photoSpecs.map((s, i) => {
  const ltr = s.ids.length > 1 && s.file.includes('Cedar') ? ' Shown left to right.' : '';
  return `[CAP_${String(i + 1).padStart(2, '0')}] ${s.file} ${s.ids.join(' ')} order: ${s.order} ${s.caption}${ltr}`;
}).join('\n\n') + '\n');

// Three reconstructed chat archives. The workshop memory repeats across two of
// them, sharing one evidence root so corroboration cannot be inflated.
const chat = (lines) => lines.join('\n');
const archives = {
  'WhatsApp_Mom.zip': chat([
    '[03/04/2024, 09:12:04] Mom: Do you remember the workshop behind the house?',
    '[03/04/2024, 09:13:20] Mom: P003 mended tools for the whole lane there.',
    'original_source: family register note; evidence_root: EV_WORKSHOP',
    '[03/04/2024, 09:14:02] Mom: <attached: 04__Workshop_at_Ashfen.png>',
  ]),
  'WhatsApp_Dad.zip': chat([
    '[03/04/2024, 18:40:00] Dad: P008 used to walk to Mereton every spring for work.',
    '[03/04/2024, 18:41:11] Dad: He came back for the harvest. evidence_root: EV_JOURNEY',
  ]),
  'WhatsApp_Family.zip': chat([
    '[04/04/2024, 11:02:00] Family: The workshop story again, as Mum tells it.',
    'P003 kept a workshop and mended tools. evidence_root: EV_WORKSHOP',
    '[04/04/2024, 11:03:30] Family: <attached: Missing_Photo.png>',
  ]),
};
for (const [name, transcript] of Object.entries(archives)) {
  const entries = [
    { path: '_chat.txt', bytes: Buffer.from(transcript, 'utf8') },
    { path: 'README_reconstruction.txt', bytes: 'These transcripts are reconstructed for a rehearsal. The speaker roles Mom, Dad and Family are format roles and are not evidence of who authored the underlying recollection.\n' },
  ];
  if (name === 'WhatsApp_Mom.zip') entries.push({ path: '04__Workshop_at_Ashfen.png', bytes: makePng(320, 400, 4), store: true });
  fs.writeFileSync(path.join(upload, name), createZip(entries));
}

// Family_Overview.pdf, one real page of text
const { font: serif } = selectFont([
  '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Geneva.ttf',
], 'Vale family overview');
const doc = new PdfDocument({ size: A4, info: { title: 'Vale Family Overview' } });
if (!serif) throw new Error('No embeddable font found for the twin overview PDF');
doc.addFont('body', serif);
const page = doc.addPage();
page.text({ x: 56, y: 74, text: 'Vale Family Overview', font: 'body', size: 20 });
page.paragraph({
  x: 56, y: 110, maxWidth: 483, font: 'body', size: 11.5, leading: 16,
  text: [
    'This overview accompanies a fictional family register prepared for engineering tests. It describes what the supplied records cover and what they leave open.',
    '',
    'The family is recorded across five generations at Northbrook, Rill Ford, Ashfen, Harrow Green and Mereton. The main line runs from Alder Vale through Cedar Vale and Hazel Vale to the youngest generation. The registers name thirty five people and the links between them.',
    '',
    'Some entries remain uncertain. Several birth years are approximate and are marked as such. One person carries two conflicting recorded birth years, and the family never resolved which register was right. Where a value is unknown the register says so rather than guessing.',
    '',
    'The photographs supplied with this packet were annotated by the family. One image shows a memorial stone and identifies nobody living. Where an annotation does not record who stands where, the positions stay unknown.',
    '',
    'Every person and link in the finished tree traces back to these supplied files.',
  ].join('\n'),
});
fs.writeFileSync(path.join(upload, 'Family_Overview.pdf'), doc.toBuffer());

const files = fs.readdirSync(upload);
const total = files.reduce((n, f) => n + fs.statSync(path.join(upload, f)).size, 0);
fs.writeFileSync(path.join(OUT, 'TWIN_README.md'),
  `# Fictional engineering twin\n\nGenerated by scripts/make-test-packet.mjs. Every name, date, place and image is invented.\nThis is a parser and export test bed, not the demo artifact pack and not content.\n\nFiles: ${files.length}, total ${total} bytes.\nExpected roster: ${people.length} people.\nRaw relationship rows: ${rels.length}. Expected normalized: ${rels.length - 1} (one deliberate duplicate).\n`);

console.log(`Twin written to ${OUT}`);
console.log(`  01-upload: ${files.length} files, ${(total / 1024).toFixed(0)} KB`);
console.log(`  people ${people.length}, raw relationship rows ${rels.length}, expected normalized ${rels.length - 1}`);
