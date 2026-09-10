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
s.relationships = s.people
  .slice(0, -1)
  .map((p, i) => ({
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
