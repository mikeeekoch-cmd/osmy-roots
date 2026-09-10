import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { syntheticSnapshot } from "../../packages/contracts/fixtures";
import type { Source, Claim, ProjectSnapshot } from "../../packages/contracts";
export async function syntheticDemo() {
  const s: ProjectSnapshot = structuredClone(syntheticSnapshot);
  s.sources = [];
  s.claims = [];
  s.relationships = [];
  s.issues = [
    "Fictional five-generation family used to test the prototype. Alex has conflicting birth years in two prepared records.",
  ];
  const text =
    "Fictional family record: Evelyn Morgan is the parent of Robin Morgan. Robin Morgan is the parent of Alex Morgan. Alex Morgan is the parent of Taylor Morgan. Taylor Morgan is the parent of Jamie Morgan.";
  const record: Source = {
    id: "fixture-family-record",
    kind: "synthetic_fixture",
    originalLocator: "fictional-family-register.txt",
    originalText: text,
    contentHash: createHash("sha256").update(text).digest("hex"),
    origin: "prepared",
    author: null,
    messageTimestamp: null,
    parentAttachmentId: null,
  };
  s.sources.push(record);
  const names = ["Evelyn", "Robin", "Alex", "Taylor", "Jamie"];
  for (let i = 0; i < 4; i++) {
    const claim: Claim = {
      id: `fixture-parent-${i}`,
      subjectId: `person-${i}`,
      predicate: "parent",
      value: `${names[i]} Morgan is the parent of ${names[i + 1]} Morgan.`,
      sourceIds: [record.id],
      spans: [
        {
          sourceId: record.id,
          locator: record.originalLocator,
          quote: `${names[i]} Morgan is the parent of ${names[i + 1]} Morgan.`,
        },
      ],
      status: "accepted",
      evidenceType: "family_document",
      version: 1,
    };
    s.claims.push(claim);
    s.people[i].claimIds.push(claim.id);
    s.relationships.push({
      id: `fixture-edge-${i}`,
      fromPersonId: `person-${i}`,
      toPersonId: `person-${i + 1}`,
      type: "parent",
      claimIds: [claim.id],
      status: "accepted",
    });
  }
  for (const year of ["1910", "1912"]) {
    const originalText = `Fictional record: Alex Morgan was born in ${year}.`;
    const src: Source = {
      id: `fixture-birth-${year}`,
      kind: "synthetic_fixture",
      originalLocator: `fictional-birth-record-${year}.txt`,
      originalText,
      contentHash: createHash("sha256").update(originalText).digest("hex"),
      origin: "prepared",
      author: null,
      messageTimestamp: null,
      parentAttachmentId: null,
    };
    s.sources.push(src);
    const id = `fixture-claim-${year}`;
    s.claims.push({
      id,
      subjectId: "person-2",
      predicate: "birth_year",
      value: year,
      sourceIds: [src.id],
      spans: [
        { sourceId: src.id, locator: src.originalLocator, quote: originalText },
      ],
      status: "disputed",
      evidenceType: "family_document",
      version: 1,
    });
    s.people[2].claimIds.push(id);
  }
  const bytes = new Uint8Array(
    await readFile(join(process.cwd(), "assets/synthetic-portrait.png")),
  );
  const sourceId = "fixture-portrait-source";
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  s.sources.push({
    id: sourceId,
    kind: "synthetic_image",
    originalLocator: "synthetic-portrait.png",
    originalText: "",
    contentHash,
    origin: "prepared",
    author: null,
    messageTimestamp: null,
    parentAttachmentId: null,
  });
  s.assets = [
    {
      id: "fixture-portrait",
      sourceId,
      originalName: "synthetic-portrait.png",
      mediaType: "image/png",
      byteLength: bytes.length,
      storageKey: "assets/fixture-portrait",
      contentHash,
    },
  ];
  s.people[2].photoIds = ["fixture-portrait"];
  return { snapshot: s, assetBytes: [{ assetId: "fixture-portrait", bytes }] };
}
