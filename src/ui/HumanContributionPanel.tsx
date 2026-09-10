import { useState } from "react";
import type { ProjectSnapshot, ReviewDecision, RootsApi } from "./types";
import { FilePicker } from "./FilePicker";
import { label } from "./model";
export function HumanContributionPanel({
  snapshot,
  selectedId,
  busy,
  onContribute,
  onReview,
  focusedProposalId,
  onFocusProposal,
}: {
  snapshot: ProjectSnapshot;
  selectedId: string | null;
  busy: boolean;
  onContribute: (
    input: Parameters<RootsApi["addContribution"]>[1],
  ) => Promise<boolean>;
  onReview: (input: ReviewDecision) => Promise<boolean>;
  focusedProposalId?: string | null;
  onFocusProposal: (id: string | null) => void;
}) {
  const [text, setText] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [attach, setAttach] = useState(true),
    [correcting, setCorrecting] = useState(false),
    [correction, setCorrection] = useState(""),
    [personId, setPersonId] = useState(""),
    [correctionVersion, setCorrectionVersion] = useState(snapshot.version),
    [pendingInputs, setPendingInputs] = useState<
      { id: string; text: string; files: File[]; failed: boolean }[]
    >([]);
  const pending =
    snapshot.proposals.find((p) => p.id === focusedProposalId) ||
    snapshot.proposals.find((p) => p.status === "pending");
  const savedStory = pending
    ? snapshot.stories.find(
        (st) =>
          st.status === "accepted" &&
          st.personId === pending.personId &&
          st.spans.some((span) =>
            pending.spans.some(
              (original) =>
                original.sourceId === span.sourceId &&
                original.quote === span.quote,
            ),
          ),
      )
    : undefined;
  const finalized =
    !!pending && ["accepted", "corrected", "rejected"].includes(pending.status);
  const unknown = snapshot.proposals.filter((p) => p.status === "unknown");
  const selected = snapshot.people.find((p) => p.id === selectedId);
  const review = async (action: ReviewDecision["action"]) => {
    if (!pending) return;
    const ok = await onReview({
      proposalId: pending.id,
      action,
      baseVersion: action === "correct" ? correctionVersion : snapshot.version,
      corrections:
        action === "correct"
          ? {
              text: correction,
              personId: personId || pending.personId || undefined,
            }
          : undefined,
    });
    if (ok) {
      setCorrecting(false);
      onFocusProposal(null);
    }
  };
  const contribute = async () => {
    if (!text.trim() && !files.length) return;
    const item = {
      id: crypto.randomUUID(),
      text: text.trim(),
      files: [...files],
      failed: false,
    };
    setPendingInputs((items) => [...items, item]);
    setText("");
    setFiles([]);
    const ok = await onContribute({
      text: item.text || undefined,
      files: item.files,
      targetPersonId: attach && selected ? selected.id : undefined,
    });
    setPendingInputs((items) =>
      ok
        ? items.filter((p) => p.id !== item.id)
        : items.map((p) => (p.id === item.id ? { ...p, failed: true } : p)),
    );
  };
  return (
    <aside className="human-panel">
      <span className="eyebrow">Your turn</span>
      <h2>
        You know the people.
        <br />
        <em>Help connect the story.</em>
      </h2>
      {pending ? (
        <article className="question-card" key={pending.id}>
          <span className={`origin ${pending.origin}`}>
            {pending.origin} · {pending.status} interpretation
          </span>
          <h3>{pending.question}</h3>
          <p>{pending.text}</p>
          {pending.spans.map((s, i) => (
            <div key={i}>
              <blockquote>{s.quote}</blockquote>
              <small className="source-locator">{s.locator}</small>
            </div>
          ))}
          <p className="muted">{pending.uncertainty}</p>
          <span className="badge">{label(pending.evidenceType)}</span>
          {focusedProposalId && (
            <button
              className="text-button close-review"
              onClick={() => {
                onFocusProposal(null);
                setCorrecting(false);
              }}
            >
              Close review
            </button>
          )}
          {correcting ? (
            <div className="correction">
              <label className="field">
                Intended person
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                >
                  <option value="">Use proposed person</option>
                  {snapshot.people.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.displayNameEn}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Corrected interpretation
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                />
              </label>
              {snapshot.version !== correctionVersion && (
                <p className="version-notice">
                  The saved project changed. Review the current evidence before
                  saving.
                  <button
                    onClick={() => setCorrectionVersion(snapshot.version)}
                  >
                    Use latest version, keep my draft
                  </button>
                </p>
              )}
              <button
                disabled={busy || !correction.trim()}
                className="primary"
                onClick={() => review("correct")}
              >
                Save correction
              </button>
              <button onClick={() => setCorrecting(false)}>Cancel</button>
            </div>
          ) : (
            <div className="review-actions">
              <button
                className="primary"
                disabled={busy || finalized}
                onClick={() => void review("accept")}
              >
                Accept
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setCorrecting(true);
                  setCorrectionVersion(snapshot.version);
                  setCorrection(savedStory?.text || pending.text);
                  setPersonId(pending.personId || "");
                }}
              >
                Correct
              </button>
              <button
                disabled={busy || finalized}
                onClick={() => void review("reject")}
              >
                Reject
              </button>
              <button
                disabled={busy || finalized}
                onClick={() => void review("unknown")}
              >
                I do not know
              </button>
            </div>
          )}
        </article>
      ) : (
        <div className="no-question">
          <span aria-hidden="true">✧</span>
          <p>
            {busy
              ? "Reading your new clue…"
              : "A little detail can open a new chapter."}
          </p>
          <small>Questions appear here when there is evidence to review.</small>
        </div>
      )}
      {unknown.length > 0 && (
        <details className="open-questions">
          <summary>
            {unknown.length} unanswered{" "}
            {unknown.length === 1 ? "question" : "questions"}
          </summary>
          {unknown.map((p) => (
            <p key={p.id}>
              {p.question}
              <small>Unresolved · no accepted change</small>
              <button onClick={() => onFocusProposal(p.id)}>
                Revisit question
              </button>
            </p>
          ))}
        </details>
      )}
      <section className="contribute">
        <h3>Add a clue, anytime</h3>
        {pendingInputs.length > 0 && (
          <ul className="pending-inputs">
            {pendingInputs.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.failed ? "Not saved" : "Saving & analyzing"}
                </strong>
                <p>{item.text || item.files.map((f) => f.name).join(", ")}</p>
                {item.failed ? (
                  <button
                    onClick={() => {
                      setText(item.text);
                      setFiles(item.files);
                      setPendingInputs((items) =>
                        items.filter((p) => p.id !== item.id),
                      );
                    }}
                  >
                    Restore this draft
                  </button>
                ) : (
                  <small>Your next clue can be added below.</small>
                )}
              </li>
            ))}
          </ul>
        )}
        <label className="field">
          <span className="sr-only">New family memory or clue</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="I remember…"
            rows={4}
          />
        </label>
        {selected && (
          <label className="check">
            <input
              type="checkbox"
              checked={attach}
              onChange={(e) => setAttach(e.target.checked)}
            />
            About {selected.displayNameEn}
          </label>
        )}
        <FilePicker compact files={files} onChange={setFiles} disabled={busy} />
        <button
          className="contribute-button"
          disabled={busy || (!text.trim() && !files.length)}
          onClick={contribute}
        >
          {busy ? (
            <>
              <span className="spinner" />
              Saving & reading…
            </>
          ) : (
            "Add to the investigation ↗"
          )}
        </button>
        <small>
          New clues remain proposals until reviewed.
          <br />A memory stays a memory, even when accepted.
        </small>
      </section>
    </aside>
  );
}
