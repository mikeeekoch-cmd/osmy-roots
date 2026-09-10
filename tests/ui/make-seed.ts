/// <reference types="node" />
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  syntheticSnapshot,
  syntheticProposal,
} from "../../packages/contracts/fixtures";
import { validateSnapshot } from "../../server/state/validation";
const s = structuredClone(syntheticSnapshot);
s.input.context = "";
s.input.preparedPacket = false;
s.sources[0].contentHash = createHash("sha256")
  .update(s.sources[0].originalText)
  .digest("hex");
s.relationships = s.people.slice(0, -1).map((p, i) => ({
  id: `r-${i}`,
  fromPersonId: p.id,
  toPersonId: s.people[i + 1].id,
  type: "parent",
  claimIds: [`claim-r-${i}`],
  status: "accepted",
}));
s.claims = s.relationships.map((r) => {
  const quote = `Fictional fixture: ${s.people.find((p) => p.id === r.fromPersonId)!.displayNameEn} is the parent of ${s.people.find((p) => p.id === r.toPersonId)!.displayNameEn}.`;
  const sourceId = `source-${r.id}`;
  s.sources.push({
    id: sourceId,
    kind: "fixture",
    originalLocator: `fictional-family.txt#${r.id}`,
    contentHash: createHash("sha256").update(quote).digest("hex"),
    originalText: quote,
    origin: "prepared",
    author: null,
    messageTimestamp: null,
    parentAttachmentId: null,
  });
  return {
    id: r.claimIds[0],
    subjectId: r.fromPersonId,
    predicate: "parent",
    value: quote,
    sourceIds: [sourceId],
    spans: [{ sourceId, locator: `fictional-family.txt#${r.id}`, quote }],
    status: "accepted" as const,
    evidenceType: "family_document" as const,
    version: 1,
  };
});
s.proposals = [structuredClone(syntheticProposal)];
s.issues = [
  "Synthetic UI acceptance fixture. Imported proposal is prepared, not a live model response.",
];
validateSnapshot(s);
await mkdir(".ui-preview", { recursive: true });
await writeFile(
  ".ui-preview/fictional-family.json",
  JSON.stringify(s, null, 2),
);
await writeFile(
  ".ui-preview/new-memory.txt",
  "I remember my grandfather Alex Morgan repairing watches in his workshop.",
);
console.log(
  "Wrote .ui-preview/fictional-family.json and new-memory.txt; safe synthetic fixtures only.",
);

// A deliberately synthetic portrait-shaped raster, made during the event for
// aspect-ratio/asset-route tests. No real photograph or identity is represented.
const { deflateSync } = await import("node:zlib");
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
}
const width = 180,
  height = 240,
  raw = Buffer.alloc(height * (width * 3 + 1));
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const circle = (x - 90) ** 2 + (y - 78) ** 2 < 34 ** 2;
    const shoulders =
      ((x - 90) / 66) ** 2 + ((y - 203) / 70) ** 2 < 1 && y > 136;
    const c = circle
      ? [165, 151, 121]
      : shoulders
        ? [123, 142, 112]
        : [235, 229, 210];
    const i = y * (width * 3 + 1) + 1 + x * 3;
    c.forEach((v, k) => (raw[i + k] = v));
  }
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 2;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
await writeFile(".ui-preview/fictional-placeholder.png", png);
const withPhoto = structuredClone(s);
withPhoto.people[2].photoIds = ["fixture-photo"];
withPhoto.assets = [
  {
    id: "fixture-photo",
    sourceId: "source-memory",
    originalName: "fictional-placeholder.png",
    mediaType: "image/png",
    byteLength: png.length,
    storageKey: "assets/fixture-photo",
    contentHash: createHash("sha256").update(png).digest("hex"),
  },
];
await writeFile(
  ".ui-preview/fictional-family-with-photo.json",
  JSON.stringify(validateSnapshot(withPhoto), null, 2),
);

// Layout stress fixture only: 35 fictional people across five generations.
// It is separate from the supplied private family and makes no archive claim.
const thirtyFive = structuredClone(withPhoto);
for (let generation = 0; generation < 5; generation++) {
  for (let index = 0; index < 6; index++) {
    const id = `layout-person-${generation}-${index}`;
    thirtyFive.people.push({
      ...structuredClone(s.people[generation]),
      id,
      displayNameEn: `Fictional Relative ${generation + 1}.${index + 1}`,
      originalName: "",
      photoIds: [],
      claimIds: [],
      storyIds: [],
    });
    if (generation === 0) continue;
    const fromPersonId =
      index === 0
        ? s.people[generation - 1].id
        : `layout-person-${generation - 1}-${index}`;
    const relationId = `layout-edge-${generation}-${index}`;
    const sourceId = `layout-source-${generation}-${index}`;
    const quote = `Synthetic layout fixture only: ${fromPersonId} is recorded as the parent of ${id}.`;
    thirtyFive.sources.push({
      id: sourceId,
      kind: "fixture",
      author: null,
      messageTimestamp: null,
      parentAttachmentId: null,
      originalLocator: `layout-fixture.txt#${relationId}`,
      contentHash: createHash("sha256").update(quote).digest("hex"),
      originalText: quote,
      origin: "prepared",
    });
    const claimId = `claim-${relationId}`;
    thirtyFive.claims.push({
      id: claimId,
      subjectId: fromPersonId,
      predicate: "parent",
      value: quote,
      sourceIds: [sourceId],
      spans: [{ sourceId, locator: `layout-fixture.txt#${relationId}`, quote }],
      status: "unresolved",
      evidenceType: "family_document",
      version: 1,
    });
    thirtyFive.relationships.push({
      id: relationId,
      fromPersonId,
      toPersonId: id,
      type: "parent",
      status: "unresolved",
      claimIds: [claimId],
    });
  }
}
thirtyFive.issues.push(
  "35-person synthetic layout stress test, not the supplied family seed.",
);
await writeFile(
  ".ui-preview/fictional-35-person-layout.json",
  JSON.stringify(validateSnapshot(thirtyFive), null, 2),
);
