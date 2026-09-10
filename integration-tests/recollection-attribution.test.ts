import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Source } from "../packages/contracts";
import { recollectionAttribution } from "../server/agent/round2";

const recollection = "I remember Alder repairing wooden boats by the river.";
const secondRecollection = "I remember the sound of his plane.";

function chatSource(
  originalText: string,
  messages: { speaker: string; text: string }[],
): Source {
  return {
    id: "fictional-chat-family",
    kind: "reconstructed_chat",
    originalLocator: "Fictional_Family.zip/_chat.txt",
    originalText,
    contentHash: createHash("sha256").update(originalText).digest("hex"),
    origin: "prepared",
    author: "Reconstructed family correspondence wrapper",
    messageTimestamp: null,
    parentAttachmentId: "fictional-chat-archive",
    reconstructed: true,
    reconstructionMetadata: { reconstruction: true, messages },
  };
}

test("recollection attribution uses the speaker supported by the exact source quote", () => {
  const source = chatSource(
    `Collector: What do you remember?\nAunt Iris: ${recollection}`,
    [{ speaker: "Aunt Iris", text: recollection }],
  );
  assert.equal(recollectionAttribution(source, [recollection]), "Aunt Iris");
});

test("metadata-only speaker cannot replace the contributor in the actual source", () => {
  const source = chatSource(`Family contributor: ${recollection}`, [
    { speaker: "Aunt Iris", text: recollection },
  ]);
  assert.equal(
    recollectionAttribution(source, [recollection]),
    "Family contributor",
  );
});

test("metadata-only recollection cannot establish attribution without source text", () => {
  const source = chatSource("Collector: No recollection was provided.", [
    { speaker: "Aunt Iris", text: recollection },
  ]);
  assert.equal(
    recollectionAttribution(source, [recollection]),
    "Family contributor",
  );
});

test("the same quoted recollection assigned to conflicting speakers stays generic", () => {
  const source = chatSource(
    `Aunt Iris: ${recollection}\nUncle Ellis: ${recollection}`,
    [
      { speaker: "Aunt Iris", text: recollection },
      { speaker: "Uncle Ellis", text: recollection },
    ],
  );
  assert.equal(
    recollectionAttribution(source, [recollection]),
    "Family contributor",
  );
});

test("quotes from different supported speakers do not receive a single attribution", () => {
  const source = chatSource(
    `Aunt Iris: ${recollection}\nUncle Ellis: ${secondRecollection}`,
    [
      { speaker: "Aunt Iris", text: recollection },
      { speaker: "Uncle Ellis", text: secondRecollection },
    ],
  );
  assert.equal(
    recollectionAttribution(source, [recollection, secondRecollection]),
    "Family contributor",
  );
});

test("a missing quote match does not use the chat wrapper author as narrator", () => {
  const collectorText = "What do you remember?";
  const source = chatSource(
    `Collector: ${collectorText}\nAunt Iris: ${recollection}`,
    [{ speaker: "Aunt Iris", text: recollection }],
  );
  assert.equal(
    recollectionAttribution(source, [collectorText]),
    "Family contributor",
  );
  assert.equal(recollectionAttribution(source, []), "Family contributor");
});

test("every selected quote must match before a named narrator is retained", () => {
  const source = chatSource(`Aunt Iris: ${recollection}`, [
    { speaker: "Aunt Iris", text: recollection },
  ]);
  assert.equal(
    recollectionAttribution(source, [recollection, secondRecollection]),
    "Family contributor",
  );
});

test("an ordinary source retains its explicitly supplied author", () => {
  const source: Source = {
    ...chatSource(recollection, []),
    kind: "family_memory",
    reconstructed: false,
    author: "Aunt Iris",
    reconstructionMetadata: undefined,
  };
  assert.equal(recollectionAttribution(source, [recollection]), "Aunt Iris");
});
