"use client";
import { useEffect, useRef, useState } from "react";
import type { GraphMutation, ProjectSnapshot, RootsApi } from "./types";
import { InputScreen } from "./InputScreen";
import { FamilyCanvas } from "./FamilyCanvas";
import { ResearchProgress } from "./ResearchProgress";
import { HumanContributionPanel } from "./HumanContributionPanel";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { GraphEditor } from "./GraphEditor";
import { SetupQuestions } from "./SetupQuestions";
import { BookPreview } from "./BookPreview";
import {SavedArrivals, savedDelta, type SavedDelta} from "./SavedArrivals";
import type { SavedConnection } from "./SourceConnection";
import "./styles.css";
export type { RootsApi } from "./types";
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The request could not be completed. Please try again.";
export function RootsApp({
  api,
  initialProjectId,
  mode = "live",
}: {
  api: RootsApi;
  initialProjectId?: string;
  mode?: "live" | "replay";
}) {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [contributionsRunning, setContributionsRunning] = useState(0),
    [error, setError] = useState<string | null>(null),
    [download, setDownload] = useState(false),
    [downloaded, setDownloaded] = useState(false),
    [setupReview, setSetupReview] = useState(false),
    [arrivals, setArrivals] = useState<SavedDelta | null>(null),
    [downloadStage, setDownloadStage] = useState<"sealing" | "delivering">("sealing"),
    [selection, setSelection] = useState<{
      kind: "person" | "relationship" | "source";
      id: string;
    } | null>(null),
    [editor, setEditor] = useState<{
      operation: GraphMutation["operation"];
      entityId?: string;
    } | null>(null),
    [highlight, setHighlight] = useState<string | null>(null),
    [savedConnection, setSavedConnection] = useState<SavedConnection | null>(
      null,
    ),
    [focusedProposalId, setFocusedProposalId] = useState<string | null>(null),
    [panel, setPanel] = useState<"map" | "progress" | "human">("map"),
    [restoring, setRestoring] = useState(true);
  const downloadLock = useRef(false);
  const previousSnapshot = useRef<ProjectSnapshot | null>(null);
  useEffect(() => {
    if (!snapshot) { previousSnapshot.current = null; return; }
    const prior = previousSnapshot.current; previousSnapshot.current = snapshot;
    if (prior) { const delta = savedDelta(prior, snapshot); if (delta) setArrivals(delta); }
  }, [snapshot?.projectId, snapshot?.version]);
  useEffect(() => { if (!arrivals) return; const timer = setTimeout(() => setArrivals(null), 3500); return () => clearTimeout(timer); }, [arrivals?.version]);
  const active = useRef(false),
    mounted = useRef(true);
  const saveSnapshot = (next: ProjectSnapshot) => {
    setSnapshot((current) =>
      current &&
      current.projectId === next.projectId &&
      current.version > next.version
        ? current
        : next,
    );
    try {
      localStorage.setItem(`roots-last-project-${mode}`, next.projectId);
    } catch {
      /* Storage may be disabled; server persistence remains authoritative. */
    }
  };
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const restore = async () => {
      try {
        const id =
          initialProjectId ||
          localStorage.getItem(`roots-last-project-${mode}`);
        if (id) {
          const saved = await api.getSnapshot(id);
          if (!cancelled) saveSnapshot(saved);
        }
      } catch (e) {
        if (!cancelled)
          setError(`Could not reopen the last project: ${errorMessage(e)}`);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    };
    void restore();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [api, initialProjectId, mode]);
  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    let polling = false;
    const timer = setInterval(async () => {
      if (document.visibilityState === "hidden" || polling) return;
      polling = true;
      try {
        const next = await api.getSnapshot(snapshot.projectId);
        if (!cancelled) { saveSnapshot(next); setError((current) => current?.startsWith("Connection interrupted:") ? null : current); }
      } catch (e) {
        if (!cancelled) setError(`Connection interrupted: ${errorMessage(e)}`);
      } finally { polling = false; }
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, snapshot?.projectId, download]);
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 2400);
    return () => clearTimeout(timer);
  }, [highlight]);
  useEffect(() => {
    if (!savedConnection) return;
    const timer = setTimeout(() => setSavedConnection(null), 3000);
    return () => clearTimeout(timer);
  }, [savedConnection]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setEditor(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  async function perform(
    action: () => Promise<ProjectSnapshot>,
    changedId?: string,
    background = false,
  ): Promise<boolean> {
    if (downloadLock.current || closed || (!background && active.current)) return false;
    if (background) setContributionsRunning((n) => n + 1);
    else {
      active.current = true;
      setBusy(true);
    }
    setError(null);
    try {
      const next = await action();
      if (mounted.current) {
        saveSnapshot(next);
        setDownloaded(false);
        const savedPerson =
          changedId ||
          (snapshot?.projectId === next.projectId
            ? next.people.find(
                (p) => !snapshot.people.some((old) => old.id === p.id),
              )?.id
            : undefined);
        if (savedPerson) setHighlight(savedPerson);
      }
      return true;
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
      return false;
    } finally {
      if (background) {
        if (mounted.current) setContributionsRunning((n) => Math.max(0, n - 1));
      } else {
        active.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }
  async function downloadBook() {
    if (!snapshot || downloadLock.current) return;
    downloadLock.current = true;
    setDownload(true);
    setDownloadStage("sealing");
    setError(null);
    try {
      const blob = await api.downloadFamilyBook(snapshot.projectId);
      if (!blob.size)
        throw new Error("The export was empty. No file was downloaded.");
      setDownloadStage("delivering");
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "osmy-roots-family-book.zip";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloaded(true);
      try { saveSnapshot(await api.getSnapshot(snapshot.projectId)); } catch { /* The file is already received; polling can refresh state. */ }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      downloadLock.current = false;
      setDownload(false);
    }
  }
  const closed = !!snapshot?.run && (downloaded || !!snapshot.run.sealedAt || ["sealing", "completed", "cancelled"].includes(snapshot.run.phase));
  const running = !closed && (
    busy ||
    contributionsRunning > 0 ||
    (snapshot?.run ? snapshot.run.modelStatus === "running" || snapshot.run.book.status === "preparing" || snapshot.run.phase === "preparing" : !!snapshot?.researchEvents.some(
      (e) =>
        e.state === "running" &&
        !snapshot.researchEvents.some(
          (other) =>
            other.runId === e.runId &&
            other.operation === e.operation &&
            other.sequence > e.sequence &&
            other.state !== "running",
        ),
    )));
  const setupVisible = !closed && !!snapshot?.run && (!snapshot.run.initialSavedAt || setupReview) && !["completed", "cancelled"].includes(snapshot.run.phase);
  return (
    <div className="roots-app">
      <header className="roots-header">
        <div className="brand" aria-label="Osmy Roots">
          <svg viewBox="0 0 160 160" aria-hidden="true"><rect width="160" height="160" rx="36" fill="#f3efe5"/><path d="M80 127V85M80 102L43 70V41M80 85L117 54V34M80 64V30M80 127L59 143M80 127L101 143" fill="none" stroke="#315943" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/><g fill="#315943"><circle cx="43" cy="41" r="11"/><circle cx="117" cy="34" r="11"/><circle cx="80" cy="30" r="11"/></g><circle cx="80" cy="85" r="12" fill="#b8884d"/></svg>
          <span className="brand-wordmark"><small>Osmy</small>Roots</span>
        </div>
        <div className="project-label">
          {snapshot ? (
            <>
              <strong>{snapshot.input.seedName}</strong>
              <small>
                {snapshot.input.geographyUnknown
                  ? "Family geography unknown"
                  : snapshot.input.geography}{" "}
                · Saved v{snapshot.version}
              </small>
            </>
          ) : (
            <small>A place for your family story</small>
          )}
        </div>
        {snapshot && (
          <button
            className="new-project-button"
            disabled={busy || download || contributionsRunning > 0}
            onClick={async () => {
              if (snapshot.run && !closed && api.cancelRun) {
                const cancelled = await perform(() => api.cancelRun!(snapshot.projectId));
                if (!cancelled) return;
              }
              setSnapshot(null);
              setSelection(null);
              setEditor(null);
              setFocusedProposalId(null);
              setSavedConnection(null);
              setHighlight(null);
              setPanel("map");
              setError(null);
              setDownloaded(false);
              setSetupReview(false);
              setArrivals(null);
              previousSnapshot.current = null;
              try {
                localStorage.removeItem(`roots-last-project-${mode}`);
              } catch {}
            }}
          >
            New project
          </button>
        )}
        {mode === "replay" && (
          <span className="replay-banner">
            Development replay · no live research
          </span>
        )}
        {snapshot && (
          <>
            <BookPreview previewUrl={api.bookPreviewUrl?.(snapshot.projectId)} snapshot={snapshot} busy={download || busy} downloaded={downloaded || snapshot.run?.phase === "completed"} onPrepare={api.prepareFamilyBook && !closed ? () => void perform(() => api.prepareFamilyBook!(snapshot.projectId)) : undefined} onSource={(id) => setSelection({kind: "source", id})} />
            <button
              className="primary download-button"
              disabled={download || busy}
              onClick={downloadBook}
            >
              {download ? (
                <>
                  <span className="spinner" />
                  {downloadStage === "sealing" ? "Sealing your book…" : "Delivering your book…"}
                </>
              ) : (
                <>
                  ↓ <span>Download family book</span>
                </>
              )}
            </button>
          </>
        )}
      </header>
      {restoring ? (
        <main className="restoring">
          <span className="spinner" />
          Reopening your family project…
        </main>
      ) : !snapshot ? (
        <InputScreen
          busy={busy}
          error={error}
          onStart={(input, files) =>
            void perform(() => api.createProject(input, files))
          }
        />
      ) : (
        <>
          <div className="mobile-panels">
            <button
              aria-pressed={panel === "progress"}
              onClick={() => setPanel("progress")}
            >
              Research
            </button>
            <button
              aria-pressed={panel === "map"}
              onClick={() => setPanel("map")}
            >
              Family map
            </button>
            <button
              aria-pressed={panel === "human"}
              onClick={() => setPanel("human")}
            >
              Your turn{" "}
              {snapshot.proposals.some((p) => p.status === "pending")
                ? "●"
                : ""}
            </button>
          </div>
          {error && (
            <div className="workspace-error" role="alert">
              {error}
              <button onClick={() => setError(null)} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          <main className={`research-workspace show-${panel}`}>
            <ResearchProgress
              snapshot={snapshot}
              busy={running}
              onSource={(id) => {
                setSelection({ kind: "source", id });
                setEditor(null);
                setPanel("map");
              }}
            />
            <div className={`center-workspace ${setupVisible ? "setup-center" : ""}`}>
              {setupVisible ? <SetupQuestions
                snapshot={snapshot}
                api={api}
                busy={busy}
                onAnswer={(answer) => perform(() => {
                  if (!api.answerSetupQuestion) throw new Error("The source-check API is unavailable. Please refresh and try again.");
                  return api.answerSetupQuestion(snapshot.projectId, answer);
                })}
                onSource={(id) => setSelection({kind: "source", id})}
                onRetry={api.retryAnalysis ? () => void perform(() => api.retryAnalysis!(snapshot.projectId)) : undefined}
                onClose={setupReview ? () => setSetupReview(false) : undefined}
              /> : <>
              {snapshot.run && <div className="run-arrivals" aria-live="polite"><strong>{snapshot.people.length} of {snapshot.run.targetPeople} supplied people saved</strong>{snapshot.run.batches.map((batch) => <span key={batch.id} className={`batch-dot ${batch.status}`} title={batch.status === "saved" ? "Family records saved" : batch.status === "cancelled" ? "Pending records left open" : "More supplied records to add"} />)}{snapshot.run.initialSavedAt && !closed && <button className="text-button" onClick={() => setSetupReview(true)}>Your {snapshot.run.questions.length} answers</button>}</div>}
              {arrivals && <SavedArrivals delta={arrivals} snapshot={snapshot} api={api} onSelect={(id) => setSelection({kind:"person", id})} onSource={(id) => setSelection({kind:"source", id})} />}
              <FamilyCanvas
                snapshot={snapshot}
                api={api}
                progressive={!!snapshot.run}
                readOnly={closed}
                selectedId={selection?.kind === "person" ? selection.id : null}
                highlightId={highlight}
                savedConnection={savedConnection}
                onSelect={(id) => {
                  setSelection({ kind: "person", id });
                  setEditor(null);
                }}
                onRelationship={(id) => {
                  setSelection({ kind: "relationship", id });
                  setEditor(null);
                }}
                onAdd={() => {
                  setEditor({ operation: "addPerson" });
                  setSelection(null);
                }}
              />

              <div className="canvas-footer">
                <button
                  disabled={busy || closed || !snapshot.history.length}
                  onClick={() =>
                    void perform(() =>
                      api.mutateGraph(snapshot.projectId, {
                        operation: "undo",
                        baseVersion: snapshot.version,
                        requestId: crypto.randomUUID(),
                      }),
                    )
                  }
                >
                  ↶ Undo last change
                </button>
                <span>
                  PDF, editable project and source evidence in one ZIP
                </span>
              </div>
              </>}
              {selection && (
                <EvidenceDrawer
                  key={`${selection.kind}-${selection.id}`}
                  snapshot={snapshot}
                  api={api}
                  selection={selection}
                  onClose={() => setSelection(null)}
                  onReviewProposal={(id) => {
                    setFocusedProposalId(id);
                    setPanel("human");
                  }}
                  readOnly={closed}
                  onEdit={(operation, entityId) => {
                    setEditor({ operation, entityId });
                    setSelection(null);
                  }}
                />
              )}
              {editor && (
                <GraphEditor
                  key={`${editor.operation}-${editor.entityId || "new"}`}
                  snapshot={snapshot}
                  {...editor}
                  busy={busy || download || closed}
                  onClose={() => setEditor(null)}
                  onSave={async (mutation) => {
                    if (
                      await perform(
                        () =>
                          api.mutateGraph(snapshot.projectId, {
                            ...mutation,
                            requestId: crypto.randomUUID(),
                          }),
                        mutation.entityId,
                      )
                    )
                      setEditor(null);
                  }}
                />
              )}
            </div>
            <HumanContributionPanel
              snapshot={snapshot}
              selectedId={selection?.kind === "person" ? selection.id : null}
              busy={busy || closed}
              focusedProposalId={focusedProposalId}
              onFocusProposal={setFocusedProposalId}
              onContribute={(input) =>
                perform(
                  () =>
                    api.addContribution(snapshot.projectId, {
                      ...input,
                      requestId: crypto.randomUUID(),
                    }),
                  undefined,
                  true,
                )
              }
              onReview={(input) => {
                const proposal = snapshot.proposals.find(
                  (p) => p.id === input.proposalId,
                );
                return perform(
                  async () => {
                    const saved = await api.reviewProposal(snapshot.projectId, {
                      ...input,
                      requestId: crypto.randomUUID(),
                    });
                    const reviewed = saved.proposals.find(
                      (p) => p.id === input.proposalId,
                    );
                    const person = saved.people.find(
                      (p) => p.id === reviewed?.personId,
                    );
                    const source = saved.sources.find((s) =>
                      reviewed?.sourceIds.includes(s.id),
                    );
                    if (
                      mounted.current &&
                      ["accept", "correct"].includes(input.action) &&
                      reviewed &&
                      ["accepted", "corrected"].includes(reviewed.status) &&
                      person &&
                      source
                    ) {
                      setSelection(null);
                      setSavedConnection({
                        key: `${saved.version}-${reviewed.id}`,
                        personId: person.id,
                        personName: person.displayNameEn,
                        sourceLabel: source.title || source.originalLocator,
                      });
                    }
                    return saved;
                  },
                  ["accept", "correct"].includes(input.action)
                    ? input.corrections?.personId ||
                        proposal?.personId ||
                        undefined
                    : undefined,
                );
              }}
            />
          </main>
        </>
      )}
    </div>
  );
}
export default RootsApp;
