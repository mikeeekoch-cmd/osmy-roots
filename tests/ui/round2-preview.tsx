/** Isolated UI contract harness. Not the Product twin or a live model/backend rehearsal. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RootsApp } from "../../src/ui";
import { OriginalPhotos } from "../../src/ui/OriginalPhotos";
import { PhotoComparison } from "../../src/ui/PhotoComparison";
import { syntheticSnapshot } from "../../packages/contracts/fixtures";
import {
  DemoManifestSchema,
  RunStateSchema,
} from "../../packages/contracts/round2";
import type { RootsApi, ProjectSnapshot } from "../../packages/contracts";
import example from "../../docs/round-2/DEMO_MANIFEST.example.json";
const manifest = DemoManifestSchema.parse(example);
const storage = "roots-round2-ui-harness";
const image = (color: string, landscape = false) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${landscape ? 320 : 180}" height="${landscape ? 180 : 240}"><rect width="100%" height="100%" fill="${color}"/><rect x="20" y="40" width="100" height="80" rx="20" fill="#b5ad96"/><text x="12" y="24" font-size="11">FICTIONAL PLACEHOLDER</text></svg>`,
  );
const master = structuredClone(syntheticSnapshot);
master.people = manifest.selectedPersonIds.map((id, i) => ({
  ...structuredClone(syntheticSnapshot.people[i % 5]),
  id,
  displayNameEn: `Fictional Person ${i + 1}`,
  originalName: "",
  photoIds: i === 0 ? ["qa-original"] : [],
  claimIds: [],
  storyIds: [],
}));
master.relationships = master.people.slice(1).map((p, i) => ({
  id: `fixture-link-${i}`,
  fromPersonId: master.people[Math.floor(i / 3)].id,
  toPersonId: p.id,
  type: "parent",
  claimIds: [],
  status: i % 3 ? "unresolved" : "accepted",
}));
master.sources = [
  {
    ...syntheticSnapshot.sources[0],
    id: "fictional-register",
    kind: "saved_folder",
    title: "Fictional UI test evidence",
    originalLocator: "contract-example.txt",
    originalText: "Fictional contract example only.",
  },
];
master.assets = [
  {
    id: "qa-original",
    sourceId: "fictional-register",
    originalName: "Fictional_Placeholder.svg",
    mediaType: "image/svg+xml",
    byteLength: 300,
    storageKey: "fixture",
  },
];
let holdCreation = false;
let creationGate: {
  resolve: () => void;
  reject: (error: Error) => void;
} | null = null;
let current: ProjectSnapshot | null = null;
try {
  const saved = localStorage.getItem(storage);
  if (saved) current = JSON.parse(saved);
} catch {}
const save = () => {
  localStorage.setItem(storage, JSON.stringify(current));
  return structuredClone(current!);
};
const unavailable = async () => {
  throw new Error(
    "UI contract harness only. Connect the real API for this action.",
  );
};
const api: RootsApi = {
  async createProject(input) {
    if (holdCreation)
      await new Promise<void>((resolve, reject) => {
        creationGate = { resolve, reject };
      });
    current = {
      ...structuredClone(master),
      projectId: crypto.randomUUID(),
      input,
      people: [],
      relationships: [],
      stories: [],
      claims: [],
      proposals: [],
      bookPassages: [],
      bookStatus: "empty",
      history: [],
      researchEvents: [],
      version: 1,
      run: RunStateSchema.parse({
        runId: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        phase: "questions",
        nextSequence: 1,
        packetVersion: manifest.packetVersion,
        packetHash: "0".repeat(64),
        language: "en",
        questions: manifest.questions,
        answers: [],
        batches: manifest.batches.map((b) => ({ ...b, status: "pending" })),
        initialBranchIds: manifest.initialBranchIds,
        targetPeople: 35,
        modelStatus: "completed",
        book: { status: "empty" },
      }),
    };
    return save();
  },
  async getSnapshot() {
    if (!current) throw new Error("No UI fixture started.");
    return structuredClone(current);
  },
  async answerSetupQuestion(_id, input) {
    if (!current) throw new Error("No fixture.");
    if (input.baseVersion !== current.version)
      throw new Error(
        "The fixture changed. Use latest version and keep draft.",
      );
    const q = current.run!.questions.find((q) => q.id === input.questionId)!;
    current.run!.answers = current.run!.answers.filter(
      (a) => a.questionId !== q.id,
    );
    current.run!.answers.push({
      ...input,
      savedAt: new Date().toISOString(),
      originalRecommendation: q.recommendation,
      savedText:
        input.action === "unknown" ? "Unknown" : input.text || q.recommendation,
      sourceIds: q.support.map((s) => s.sourceId),
    });
    q.status = "answered";
    current.version++;
    return save();
  },
  async cancelRun() {
    current!.run!.phase = "cancelled";
    current!.version++;
    return save();
  },
  addContribution: unavailable,
  reviewProposal: unavailable,
  mutateGraph: unavailable,
  prepareFamilyBook: unavailable,
  downloadFamilyBook: async () => {
    throw new Error(
      "Deliberate UI export failure. No ZIP was generated or downloaded.",
    );
  },
  assetUrl: () => image("#d7c8ab"),
};
function Harness() {
  const [pairs, setPairs] = useState(false);
  const [notice, setNotice] = useState("");
  const [variant, setVariant] = useState("portrait");
  return (
    <>
      <aside
        className="test-controls"
        style={{ padding: 12, background: "#fff0d5", fontSize: 12 }}
      >
        <strong>
          TEST ONLY: isolated UI states. No live Astra, packet parsing or real
          download.
        </strong>
        <button
          onClick={() => {
            holdCreation = true;
            setNotice(
              "The next create request will be held for preparation QA.",
            );
          }}
        >
          Hold next preparation
        </button>
        <button
          onClick={() => {
            holdCreation = false;
            creationGate?.resolve();
            creationGate = null;
          }}
        >
          Finish preparation
        </button>
        <button
          onClick={() => {
            holdCreation = false;
            creationGate?.reject(
              new Error(
                "Deliberate preparation failure. Selected files must remain.",
              ),
            );
            creationGate = null;
          }}
        >
          Fail preparation
        </button>{" "}
        <button
          onClick={() => {
            if (!current || current.run!.answers.length !== 7) {
              setNotice("Answer all seven fixture questions first.");
              return;
            }
            const run = current.run!;
            const batch = run.initialSavedAt
              ? run.batches.find((b) => b.status === "pending")
              : null;
            const ids =
              batch?.personIds ||
              (!run.initialSavedAt ? run.initialBranchIds : []);
            if (!ids.length) return;
            current.people.push(
              ...master.people.filter((p) => ids.includes(p.id)),
            );
            current.relationships = master.relationships.filter(
              (r) =>
                current!.people.some((p) => p.id === r.fromPersonId) &&
                current!.people.some((p) => p.id === r.toPersonId),
            );
            if (batch) {
              batch.status = "saved";
              batch.savedAt = new Date().toISOString();
            } else run.initialSavedAt = new Date().toISOString();
            run.phase = run.batches.every((b) => b.status === "saved")
              ? "review"
              : "growing";
            current.version++;
            save();
            setNotice(
              `Saved fixture batch: ${current.people.length} people. Poll will deliver it.`,
            );
          }}
        >
          TEST ONLY: release next batch
        </button>{" "}
        <button onClick={() => setPairs(!pairs)}>Comparison QA</button>
        <p role="status">{notice}</p>
      </aside>
      {pairs ? (
        <>
          <nav style={{ padding: 12 }}>
            {["portrait", "landscape", "unaligned", "missing"].map((v) => (
              <button key={v} onClick={() => setVariant(v)}>
                {v}
              </button>
            ))}
          </nav>
          <div
            style={{
              background: "#253529",
              padding: 30,
              display: "grid",
              placeItems: "center",
            }}
          >
            <OriginalPhotos
              ids={["qa-original", "qa-landscape", "qa-unpaired", "qa-missing"]}
              snapshot={{
                ...master,
                assets: [
                  "qa-original",
                  "qa-landscape",
                  "qa-unpaired",
                  "qa-missing",
                ].map((id) => ({
                  ...master.assets[0],
                  id,
                  originalName: `${id}.svg`,
                })),
              }}
              api={{
                ...api,
                assetUrl: (_id, asset) =>
                  image("#c9b78e", asset === "qa-landscape"),
              }}
              comparisonFor={(id) =>
                id === "qa-unpaired"
                  ? undefined
                  : {
                      enhancedUrl:
                        id === "qa-missing"
                          ? "/missing-enhanced.png"
                          : image("#819a7d", id === "qa-landscape"),
                      aligned: true,
                    }
              }
            />
            <PhotoComparison
              originalUrl={image("#c9b78e", variant === "landscape")}
              enhancedUrl={
                variant === "missing"
                  ? "/missing-fixture.png"
                  : image("#819a7d", variant === "landscape")
              }
              aligned={variant !== "unaligned"}
              caption="Code-generated UI placeholder"
            />
          </div>
        </>
      ) : (
        <RootsApp api={api} mode="replay" />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <div className="roots-app">
    <Harness />
  </div>,
);
