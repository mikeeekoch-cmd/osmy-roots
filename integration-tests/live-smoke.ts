// Opt-in real API acceptance using only the rights-safe fictional family.
// Run with pnpm test:live after configuring server-side API credit.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  createProject,
  addContribution,
  downloadFamilyBook,
} from "../server/agent/service";
import { reviewProposal } from "../server/state/decisions";
import { loadProject, dataRoot } from "../server/state/store";
import { validateSnapshot } from "../server/state/validation";
import { syntheticQuote } from "../packages/contracts/fixtures";
const started = Date.now();
let snapshot = await createProject({
  seedName: "Alex Morgan",
  geographyUnknown: true,
  context: "",
  preparedPacket: true,
});
snapshot = await addContribution(snapshot.projectId, {
  text: syntheticQuote,
  targetPersonId: "person-2",
});
const proposal = snapshot.proposals.find(
  (p) => p.origin === "live" && p.model === "gpt-6-astra",
);
assert.ok(proposal, "A real validated Astra proposal is required.");
assert.equal(proposal.status, "pending");
assert.equal(snapshot.stories.length, 0);
assert.ok(proposal.spans.some((s) => s.quote === syntheticQuote));
snapshot = await reviewProposal(snapshot.projectId, {
  proposalId: proposal.id,
  action: "accept",
  baseVersion: snapshot.version,
});
assert.equal(snapshot.stories.length, 1);
assert.equal(snapshot.stories[0].evidenceType, "family_recollection");
const bundle = await downloadFamilyBook(snapshot.projectId);
assert.equal(bundle.mimeType, "application/zip");
const dir = join(dataRoot(), "validation", snapshot.projectId);
await mkdir(dir, { recursive: true });
const path = join(dir, "family-book.zip");
await writeFile(path, bundle.bytes);
execFileSync("unzip", ["-t", path], { stdio: "pipe" });
const projectBytes = execFileSync("unzip", ["-p", path, "project.json"]);
const reopened = validateSnapshot(JSON.parse(projectBytes.toString("utf8")));
assert.equal(reopened.stories.length, 1);
assert.equal(reopened.proposals[0].status, "accepted");
assert.ok(
  reopened.bookPassages.every(
    (p) => p.origin === "live" && p.acceptedStateVersion === reopened.version,
  ),
);
const imported = await createProject(reopened.input, [
  {
    uploadId: "reopen-live-check",
    originalName: "project.json",
    mediaType: "application/json",
    bytes: projectBytes,
  },
]);
assert.equal(imported.stories[0].text, reopened.stories[0].text);
assert.equal(imported.history.length, reopened.history.length);
const final = await loadProject(snapshot.projectId);
assert.equal(final.bookStatus, "current");
console.log(
  JSON.stringify({
    passed: true,
    model: "gpt-6-astra",
    projectId: snapshot.projectId,
    reopenedProjectId: imported.projectId,
    people: final.people.length,
    acceptedStories: final.stories.length,
    passages: final.bookPassages.length,
    zipBytes: bundle.bytes.length,
    latencyMs: Date.now() - started,
    output: path,
  }),
);
