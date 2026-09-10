/** Explicit development replay only. Never imported by the production app. */
import {
  syntheticSnapshot,
  syntheticProposal,
} from "../../packages/contracts/fixtures";
import type {
  ProjectSnapshot,
  RootsApi,
  Person,
} from "../../packages/contracts";
const clone = <T>(value: T): T => structuredClone(value);
const portrait =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="240"><rect width="180" height="240" fill="#e6deca"/><circle cx="90" cy="85" r="39" fill="#a99b7e"/><path d="M25 230V190a65 65 0 0 1 130 0v40" fill="#8b947d"/><text x="90" y="20" text-anchor="middle" font-size="10" fill="#545f4e">FICTIONAL PLACEHOLDER</text></svg>',
  );
export function makeReplayApi(): RootsApi {
  let snapshot = clone(syntheticSnapshot),
    undo: ProjectSnapshot | null = null;
  try {
    const saved = localStorage.getItem("roots-ui-replay-state");
    if (saved) snapshot = JSON.parse(saved);
  } catch {}
  const persist = () => {
    localStorage.setItem("roots-ui-replay-state", JSON.stringify(snapshot));
    return clone(snapshot);
  };
  const record = (action: string, before: unknown, after: unknown) => {
    snapshot.version++;
    snapshot.history.push({
      eventId: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: "Development replay",
      action,
      before,
      after,
      sourceIds: [],
      claimIds: [],
      projectVersion: snapshot.version,
    });
    snapshot.bookStatus = "stale";
  };
  return {
    async createProject(input, files = []) {
      snapshot = clone(syntheticSnapshot);
      snapshot.input = input;
      snapshot.projectId = "synthetic-demo";
      snapshot.relationships = snapshot.people.slice(0, -1).map((p, i) => ({
        id: `relationship-${i}`,
        fromPersonId: p.id,
        toPersonId: snapshot.people[i + 1].id,
        type: "parent",
        claimIds: ["claim-tree"],
        status: "accepted",
      }));
      snapshot.claims = [
        {
          id: "claim-tree",
          subjectId: "person-2",
          predicate: "birth_year",
          value: "Two conflicting years in the fictional fixture; unresolved.",
          sourceIds: ["source-memory"],
          spans: [],
          status: "disputed",
          evidenceType: "family_document",
          version: 1,
        },
      ];
      snapshot.people[2].photoIds = ["portrait"];
      snapshot.people[2].claimIds = ["claim-tree"];
      snapshot.assets = [
        {
          id: "portrait",
          sourceId: "source-memory",
          originalName: "fictional-placeholder.svg",
          mediaType: "image/svg+xml",
          byteLength: 0,
          storageKey: "fixture",
        },
      ];
      snapshot.proposals = [clone(syntheticProposal)];
      snapshot.proposals[0].origin = "replay";
      snapshot.researchEvents.forEach((e) => (e.origin = "replay"));
      snapshot.files = files.map((f, i) => ({
        uploadId: `file-${i}`,
        originalName: f.name,
        status: "stored_only",
        sourceIds: [],
        assetIds: [],
        warnings: [
          "Replay only: selected file was not processed by a backend.",
        ],
      }));
      return persist();
    },
    async getSnapshot() {
      return clone(snapshot);
    },
    async addContribution(_id, input) {
      undo = clone(snapshot);
      const text =
        input.text || "File-only contribution in a development replay.";
      const sourceId = crypto.randomUUID();
      snapshot.sources.push({
        id: sourceId,
        kind: "text",
        originalLocator: "replay-contribution.txt",
        contentHash: sourceId,
        originalText: text,
        origin: "replay",
        author: null,
        messageTimestamp: null,
        parentAttachmentId: null,
      });
      snapshot.proposals.push({
        ...clone(syntheticProposal),
        id: crypto.randomUUID(),
        sourceIds: [sourceId],
        personId: input.targetPersonId || "person-2",
        text,
        spans: [{ sourceId, locator: "replay-contribution.txt", quote: text }],
        origin: "replay",
      });
      record("add_contribution", null, text);
      return persist();
    },
    async reviewProposal(_id, decision) {
      if (decision.baseVersion !== snapshot.version)
        throw new Error("Version conflict: refresh before reviewing.");
      const p = snapshot.proposals.find((p) => p.id === decision.proposalId);
      if (!p) throw new Error("Proposal missing.");
      if (p.status !== "pending") return clone(snapshot);
      undo = clone(snapshot);
      p.status =
        decision.action === "accept"
          ? "accepted"
          : decision.action === "correct"
            ? "corrected"
            : decision.action === "reject"
              ? "rejected"
              : "unknown";
      if (["accept", "correct"].includes(decision.action)) {
        const personId =
          decision.corrections?.personId || p.personId || "person-2";
        snapshot.stories.push({
          id: crypto.randomUUID(),
          personId,
          text: decision.corrections?.text || p.text,
          sourceIds: p.sourceIds,
          claimIds: [],
          spans: p.spans,
          evidenceType: p.evidenceType,
          status: "accepted",
          attribution: "Fictional recollection · replay",
        });
      }
      record(decision.action, null, p);
      return persist();
    },
    async mutateGraph(_id, mutation) {
      if (mutation.baseVersion !== snapshot.version)
        throw new Error("Version conflict.");
      if (mutation.operation === "undo") {
        if (!undo) throw new Error("Nothing to undo.");
        const previous = clone(undo);
        previous.version = snapshot.version + 1;
        snapshot = previous;
        undo = null;
        return persist();
      }
      const values = mutation.values || {};
      if (mutation.operation.includes("Relationship")) {
        if (values.fromPersonId === values.toPersonId)
          throw new Error("A person cannot be their own parent.");
        const edges = snapshot.relationships.filter(
          (r) => r.id !== mutation.entityId && r.type === "parent",
        );
        const reachable = (
          id: string,
          target: string,
          seen = new Set<string>(),
        ): boolean =>
          id === target ||
          (!seen.has(id) &&
            Boolean(seen.add(id)) &&
            edges.some(
              (r) =>
                r.fromPersonId === id && reachable(r.toPersonId, target, seen),
            ));
        if (
          values.type === "parent" &&
          reachable(String(values.toPersonId), String(values.fromPersonId))
        )
          throw new Error("That parent link would create an ancestry cycle.");
      }
      undo = clone(snapshot);
      if (mutation.operation === "addPerson")
        snapshot.people.push({
          id: crypto.randomUUID(),
          displayNameEn: String(values.displayNameEn),
          originalName: String(values.originalName || ""),
          lifeYears: values.lifeYears as Person["lifeYears"],
          photoIds: [],
          claimIds: [],
          storyIds: [],
        });
      if (mutation.operation === "editPerson")
        snapshot.people = snapshot.people.map((p) =>
          p.id === mutation.entityId ? { ...p, ...values } : p,
        );
      if (mutation.operation === "addRelationship")
        snapshot.relationships.push({
          id: crypto.randomUUID(),
          ...values,
        } as ProjectSnapshot["relationships"][number]);
      if (mutation.operation === "editRelationship")
        snapshot.relationships = snapshot.relationships.map((r) =>
          r.id === mutation.entityId ? { ...r, ...values } : r,
        );
      record(mutation.operation, null, values);
      return persist();
    },
    async downloadFamilyBook() {
      throw new Error(
        "Development replay cannot produce a real family-book ZIP. Connect the lead adapter to validate export.",
      );
    },
    assetUrl() {
      return portrait;
    },
  };
}
