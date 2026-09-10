import { useEffect, useRef, useState } from "react";
import type { SetupAnswer, SetupQuestion } from "../../packages/contracts/round2";
import type { ProjectSnapshot, RootsApi } from "./types";
import { OriginalPhoto } from "./OriginalPhotos";
import { PreparationState } from "./PreparationState";

const categoryLabels: Record<SetupQuestion["category"], string> = { photo: "The people in your photograph", kinship: "A family connection", origin: "Where the story begins", time: "A place in time", movement: "The journeys they made", recollection: "A story worth keeping", conflict: "What stays open" };
export const nextUnansweredQuestion = (snapshot: ProjectSnapshot) => {
  const run = snapshot.run;
  if (!run) return 0;
  const index = run.questions.findIndex((q) => !run.answers.some((a) => a.questionId === q.id));
  return index < 0 ? run.questions.length : index;
};
export function SetupQuestions({ snapshot, api, busy, onAnswer, onSource, onClose, onRetry }: {
  snapshot: ProjectSnapshot; api: RootsApi; busy: boolean;
  onAnswer: (answer: SetupAnswer) => Promise<boolean>;
  onSource: (sourceId: string) => void; onClose?: () => void; onRetry?: () => void;
}) {
  const run = snapshot.run!;
  const [index, setIndex] = useState(() => Math.max(0, Math.min(nextUnansweredQuestion(snapshot), run.questions.length - 1)));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editVersion, setEditVersion] = useState(snapshot.version);
  const [answerError, setAnswerError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = run.questions[Math.min(index, Math.max(0, run.questions.length - 1))];
  const answer = run.answers.find((a) => a.questionId === question?.id);
  const answered = new Set(run.answers.map((a) => a.questionId)).size;
  const allAnswered = answered === run.questions.length;
  useEffect(() => { setEditing(false); setDraft(""); setAnswerError(""); heading.current?.focus(); }, [question?.id]);
  if (!question) return <PreparationState title={run.phase === "failed" ? "Your sources need attention" : "Preparing your family sources"} summary={run.error || "Reading your supplied files and checking their source references."} active={run.phase === "preparing" || run.modelStatus === "running"} />;
  if (allAnswered && !reviewing && !onClose) return <section className="setup-questions setup-complete" aria-live="polite">
    <span className="setup-complete-mark" aria-hidden="true">✓</span>
    <span className="eyebrow">Your seven checks are saved</span>
    <h2>Your first family branch is taking shape</h2>
    <p>{run.error || "We are adding the supported records and keeping your unknowns open."}</p>
    <button onClick={() => { setIndex(0); setReviewing(true); }}>Review your answers</button>
    {run.modelStatus === "running" && <p className="preparation-note"><span className="spinner" />Astra is still analyzing the supplied recollection.</p>}
  </section>;
  const ready = ["ready", "answered"].includes(question.status);
  const photoId = question.effect.photoAssetId || (question.category === "photo" ? snapshot.photoAnnotations?.[0]?.assetId : undefined);
  const photo = photoId ? snapshot.assets.find((a) => a.id === photoId) : undefined;
  const save = async (action: SetupAnswer["action"]) => {
    const correction = editing ? draft.trim() : answer?.savedText || draft.trim();
    if (action === "correct" && !correction) { setAnswerError("Write your correction or choose I don't know."); return; }
    setAnswerError("");
    const success = await onAnswer({ questionId: question.id, action, ...(action === "correct" ? { text: correction } : {}), baseVersion: editing && action === "correct" ? editVersion : snapshot.version, requestId: crypto.randomUUID() });
    if (success) {
      setEditing(false);
      if (index < run.questions.length - 1) setIndex(index + 1);
      else { setReviewing(false); onClose?.(); }
    }
  };
  return <section className="setup-questions" aria-label="Family source checks">
    <div className="setup-topline"><span className="eyebrow">Your knowledge connects the records</span><span className="setup-number">{index + 1} of {run.questions.length}</span></div>
    <div className="setup-dots" aria-label={`${answered} of ${run.questions.length} checks saved`}>{run.questions.map((q, i) => <span key={q.id} className={`${run.answers.some((a) => a.questionId === q.id) ? "saved" : ""} ${i === index ? "current" : ""}`} />)}</div>
    <span className="setup-category">{categoryLabels[question.category]}</span>
    <h2 ref={heading} tabIndex={-1}>{question.prompt}</h2>
    {photo && <figure className="setup-photo"><OriginalPhoto src={api.assetUrl(snapshot.projectId, photo.id)} alt={photo.originalName} /><figcaption>Identify people from left to right. Unknown is always an option.</figcaption></figure>}
    {!ready ? <div className="setup-waiting" role="status">
      {question.status !== "failed" && run.modelStatus === "running" && <span className="spinner" />}
      <strong>{question.status === "failed" ? "This interpretation needs another look" : question.requiresAstra ? run.modelStatus === "running" ? "Astra is checking this source" : "Waiting for a source-backed suggestion" : "Reading the supporting source"}</strong>
      <p>{question.status === "failed" ? "The analysis did not complete. You can keep this question unresolved." : "A recommendation appears after its source check completes. You can keep it unknown."}</p>
    </div> : <div className="recommended-answer">
      <span className="eyebrow">{answer ? answer.action === "unknown" ? "Saved as unresolved" : "Your saved answer" : "Recommended"}</span>
      {editing ? <label className="field">Your correction<textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={4000} /></label> : <p>{answer ? answer.action === "unknown" ? "I don't know. Keep this unresolved." : answer.savedText : question.recommendation}</p>}
      <small>{question.origin === "live" ? "Source-checked Astra interpretation" : "From your supplied family records"}</small>
    </div>}
    <details className="setup-source"><summary>See the source{question.support.length > 1 ? `s (${question.support.length})` : ""}</summary>
      {question.support.map((span, i) => <article key={`${span.sourceId}-${i}`}><blockquote>{span.quote}</blockquote><button className="text-button" onClick={() => onSource(span.sourceId)}>{snapshot.sources.find((s) => s.id === span.sourceId)?.title || span.sourceId} · {span.locator}</button></article>)}
    </details>
    {editing && editVersion !== snapshot.version && <p className="stale-draft">New project activity arrived. Your draft is preserved. <button className="text-button" onClick={() => setEditVersion(snapshot.version)}>Use latest version and keep draft</button></p>}
    {question.status === "failed" && onRetry && <button disabled={busy} onClick={onRetry}>Retry source analysis</button>}
    {answerError && <p className="error" role="alert">{answerError}</p>}
    <div className="setup-actions">
      <button className="primary" disabled={busy || !ready || (!question.recommendation && !editing) || (editing && editVersion !== snapshot.version)} onClick={() => void save(editing ? "correct" : answer && answer.action !== "unknown" ? "correct" : "confirm")}>
        {busy ? <><span className="spinner" />Saving…</> : editing ? "Save correction" : "Confirm and continue"}
      </button>
      {ready && <button disabled={busy} onClick={() => { setDraft(answer?.savedText || question.recommendation); setEditVersion(snapshot.version); setEditing(!editing); }}>{editing ? "Cancel edit" : "Edit"}</button>}
      <button disabled={busy} onClick={() => void save("unknown")}>I don't know</button>
    </div>
    <div className="setup-navigation"><button disabled={busy || index === 0} onClick={() => { setIndex(index - 1); setReviewing(true); }}>← Back</button><small>Every answer is saved explicitly. Unknowns stay open.</small>{onClose && <button onClick={onClose}>Back to map</button>}</div>
  </section>;
}
