"use client";
import { useEffect, useRef, useState } from "react";
import type { GraphMutation, ProjectSnapshot, RootsApi } from "./types";
import { SetupQuestions } from "./SetupQuestions";
import { PreparationState } from "./PreparationState";
import { SavedArrivals, savedDelta, type SavedDelta } from "./SavedArrivals";
import { BookPreview } from "./BookPreview";
import { Brand } from "./Brand";
import { InputScreen } from "./InputScreen";
import { FamilyCanvas } from "./FamilyCanvas";
import { ResearchProgress } from "./ResearchProgress";
import { HumanContributionPanel } from "./HumanContributionPanel";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { GraphEditor } from "./GraphEditor";
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
    [delivery, setDelivery] = useState<
      "idle" | "sealing" | "delivering" | "completed" | "failed"
    >("idle"),
    [reviewSetup, setReviewSetup] = useState(false),
    [arrivals, setArrivals] = useState<SavedDelta | null>(null),
    [downloaded, setDownloaded] = useState(false),
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
  const active = useRef(false),
    mounted = useRef(true),
    latestSnapshot = useRef<ProjectSnapshot | null>(null),
    downloadLock = useRef(false),
    projectEpoch = useRef(0);
  const saveSnapshot = (next: ProjectSnapshot) => {
    const current = latestSnapshot.current;
    if (current?.projectId === next.projectId && current.version > next.version)
      return;
    if (
      current?.projectId === next.projectId &&
      next.version > current.version
    ) {
      const delta = savedDelta(current, next);
      if (delta) setArrivals(delta);
    }
    latestSnapshot.current = next;
    setSnapshot(next);
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
    if (
      !snapshot ||
      snapshot.run?.phase === "completed" ||
      snapshot.run?.phase === "cancelled"
    )
      return;
    let cancelled = false;
    let polling = false;
    const timer = setInterval(async () => {
      if (
        document.visibilityState === "hidden" ||
        polling ||
        downloadLock.current
      )
        return;
      polling = true;
      try {
        const next = await api.getSnapshot(
          snapshot.projectId,
          latestSnapshot.current?.run?.nextSequence,
        );
        if (!cancelled) saveSnapshot(next);
      } catch (e) {
        if (!cancelled) setError(`Connection interrupted: ${errorMessage(e)}`);
      } finally {
        polling = false;
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, snapshot?.projectId, snapshot?.run?.phase, download]);
  useEffect(() => {
    if (!arrivals) return;
    const timer = setTimeout(() => setArrivals(null), 5000);
    return () => clearTimeout(timer);
  }, [arrivals]);
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
    if (downloadLock.current || (!background && active.current)) return false;
    const epoch = projectEpoch.current;
    if (background) setContributionsRunning((n) => n + 1);
    else {
      active.current = true;
      setBusy(true);
    }
    setError(null);
    try {
      const next = await action();
      if (mounted.current && epoch === projectEpoch.current) {
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
    setDelivery("sealing");
    setError(null);
    try {
      const blob = await api.downloadFamilyBook(snapshot.projectId);
      if (!blob.size)
        throw new Error("The export was empty. Please retry the download.");
      setDelivery("delivering");
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "osmy-roots-family-book.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloaded(true);
      setDelivery("completed");
      try {
        saveSnapshot(await api.getSnapshot(snapshot.projectId));
      } catch {
        setError(
          "Your file was sent to the browser. Project status could not refresh; reopen this project to check its saved state.",
        );
      }
    } catch (e) {
      setDelivery("failed");
      setError(errorMessage(e));
    } finally {
      downloadLock.current = false;
      setDownload(false);
    }
  }
  async function newProject() {
    if (
      snapshot?.run &&
      !["completed", "cancelled"].includes(snapshot.run.phase)
    ) {
      if (!api.cancelRun) {
        setError(
          "This connection cannot stop the current run yet. Reconnect to the updated application before starting another project.",
        );
        return;
      }
      if (!(await perform(() => api.cancelRun!(snapshot.projectId)))) return;
    }
    projectEpoch.current += 1;
    latestSnapshot.current = null;
    setSnapshot(null);
    setSelection(null);
    setEditor(null);
    setFocusedProposalId(null);
    setSavedConnection(null);
    setHighlight(null);
    setArrivals(null);
    setPanel("map");
    setError(null);
    setDownloaded(false);
    setDelivery("idle");
    setReviewSetup(false);
    try {
      localStorage.removeItem(`roots-last-project-${mode}`);
    } catch {}
  }
  const sealed =
    !!snapshot?.run?.sealedAt ||
    ["sealing", "completed", "cancelled"].includes(snapshot?.run?.phase || "");
  const needsSetup =
    !!snapshot?.run && (!snapshot.run.initialSavedAt || reviewSetup) && !sealed;
  const running =
    !sealed &&
    (busy ||
      snapshot?.run?.modelStatus === "running" ||
      snapshot?.run?.phase === "preparing" ||
      snapshot?.run?.phase === "preparing_book" ||
      contributionsRunning > 0 ||
      !!snapshot?.researchEvents.some(
        (e) =>
          e.state === "running" &&
          !snapshot.researchEvents.some(
            (other) =>
              other.runId === e.runId &&
              other.operation === e.operation &&
              other.sequence > e.sequence &&
              other.state !== "running",
          ),
      ));
  return (
    <div className="roots-app">
      <header className="roots-header">
        <Brand />
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
            onClick={() => void newProject()}
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
            <span className="book-state">
              {delivery === "completed" || snapshot.run?.phase === "completed"
                ? "Book download sent"
                : snapshot.bookStatus === "stale"
                  ? "Book needs updating"
                  : snapshot.bookStatus === "current"
                    ? "Book is up to date"
                    : snapshot.bookStatus === "failed"
                      ? "Book generation needs attention"
                      : snapshot.bookStatus === "generating"
                        ? "Preparing your book…"
                        : downloaded
                          ? "Download saved"
                          : "Your story, taking shape"}
            </span>
            <button
              className="primary download-button"
              disabled={download || busy}
              onClick={downloadBook}
            >
              {download ? (
                <>
                  <span className="spinner" />
                  {delivery === "delivering"
                    ? "Sending your download…"
                    : "Finishing your book…"}
                </>
              ) : (
                <>
                  ↓{" "}
                  <span>
                    {delivery === "failed"
                      ? "Retry book download"
                      : "Download family book"}
                  </span>
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
              onClick={() => setPanel(needsSetup ? "map" : "human")}
            >
              {needsSetup ? "Source questions" : "Your turn"}{" "}
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
          <main
            className={`research-workspace show-${panel} ${needsSetup ? "setup-workspace" : ""}`}
          >
            <ResearchProgress
              snapshot={snapshot}
              busy={running}
              onSource={(id) => {
                setSelection({ kind: "source", id });
                setEditor(null);
                setPanel("map");
              }}
            />
            <div className="center-workspace">
              {needsSetup ? (
                <>
                  {snapshot.run!.questions.length ? (
                    <SetupQuestions
                      snapshot={snapshot}
                      api={api}
                      busy={busy || download}
                      onSource={(id) => setSelection({ kind: "source", id })}
                      onAnswer={(answer) =>
                        perform(() => {
                          if (!api.answerSetupQuestion)
                            throw new Error(
                              "The question-saving API is not connected yet. Your answer has not been saved.",
                            );
                          return api.answerSetupQuestion(
                            snapshot.projectId,
                            answer,
                          );
                        })
                      }
                    />
                  ) : (
                    <PreparationState
                      summary={
                        snapshot.run!.error ||
                        "Reading your files and checking the source references."
                      }
                      active={snapshot.run!.phase !== "failed"}
                    />
                  )}
                  {reviewSetup && (
                    <button onClick={() => setReviewSetup(false)}>
                      Return to family map
                    </button>
                  )}
                </>
              ) : (
                <>
                  {arrivals && (
                    <SavedArrivals
                      delta={arrivals}
                      snapshot={snapshot}
                      api={api}
                      onSelect={(id) => setSelection({ kind: "person", id })}
                    />
                  )}
                  <FamilyCanvas
                    snapshot={snapshot}
                    api={api}
                    selectedId={
                      selection?.kind === "person" ? selection.id : null
                    }
                    highlightId={highlight}
                    changedPersonIds={arrivals?.personIds}
                    changedRelationshipIds={arrivals?.relationshipIds}
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
                  <BookPreview
                    snapshot={snapshot}
                    busy={busy || download}
                    delivery={delivery}
                    onPrepare={
                      api.prepareFamilyBook
                        ? () =>
                            void perform(() =>
                              api.prepareFamilyBook!(snapshot.projectId),
                            )
                        : undefined
                    }
                    onDownload={() => void downloadBook()}
                    onSource={(id) => setSelection({ kind: "source", id })}
                  />
                  {snapshot.run && (
                    <button
                      className="text-button review-setup"
                      onClick={() => setReviewSetup(true)}
                      disabled={sealed}
                    >
                      Review setup answers
                    </button>
                  )}
                  <div className="canvas-footer">
                    <button
                      disabled={busy || sealed || !snapshot.history.length}
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
                      PDF, editable project, evidence & originals in one ZIP
                    </span>
                  </div>
                </>
              )}
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
                  onEdit={(operation, entityId) => {
                    if (sealed) {
                      setError(
                        "This book is sealed. Open its saved project to start a new editable copy.",
                      );
                      return;
                    }
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
                  busy={busy}
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
            {!needsSetup && (
              <HumanContributionPanel
                snapshot={snapshot}
                selectedId={selection?.kind === "person" ? selection.id : null}
                busy={busy || sealed || download}
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
                      const saved = await api.reviewProposal(
                        snapshot.projectId,
                        {
                          ...input,
                          requestId: crypto.randomUUID(),
                        },
                      );
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
            )}
          </main>
        </>
      )}
    </div>
  );
}
export default RootsApp;
