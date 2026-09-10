/** Bind fictional manifest support to actual production parser locators. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { parseFamilyPacket } from '../../../server/ingestion/packet.mjs';
import { DemoManifestSchema } from '../../../packages/contracts/round2.ts';

const root = resolve(process.argv[2]);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const readFiles = async () => Promise.all((await readdir(join(root, '01-upload'))).sort().map(async (originalName) => ({ originalName, bytes: await readFile(join(root, '01-upload', originalName)) })));
const manifest = JSON.parse(await readFile(join(root, 'DEMO_MANIFEST.json'), 'utf8'));
let packet = await parseFamilyPacket({ files: await readFiles() });
if (packet.issues.length) throw Error(packet.issues.join('; '));
const locate = (span) => {
  const source = packet.sources.find((source) => source.id === span.sourceId);
  if (!source || !source.originalText.includes(span.quote)) throw Error(`Unsupported fictional source span ${span.sourceId}`);
  return { ...span, locator: source.originalLocator };
};
const annotations = JSON.parse(await readFile(join(root, '01-upload/Photo_Captions.txt'), 'utf8'));
for (const photo of annotations) photo.support = photo.support.map(locate);
await writeFile(join(root, '01-upload/Photo_Captions.txt'), encode(annotations));
packet = await parseFamilyPacket({ files: await readFiles() });
for (const question of manifest.questions) question.support = question.support.map(locate);
for (const photo of manifest.photos) photo.support = photo.support.map(locate);
for (const file of manifest.files) {
  const bytes = await readFile(join(root, file.path));
  file.sha256 = hash(bytes); file.bytes = bytes.length;
  for (const lineage of file.lineage || []) lineage.derivativeHash = file.sha256;
}
DemoManifestSchema.parse(manifest);
const bytes = encode(manifest);
await writeFile(join(root, 'DEMO_MANIFEST.json'), bytes);
const expected = JSON.parse(await readFile(join(root, '80-presenter/EXPECTED_OUTCOME.json'), 'utf8'));
expected.packetHash = hash(bytes);
await writeFile(join(root, '80-presenter/EXPECTED_OUTCOME.json'), encode(expected));
console.log(JSON.stringify({ status: 'fictional-fixture-frozen', packetVersion: manifest.packetVersion, packetHash: expected.packetHash }));
