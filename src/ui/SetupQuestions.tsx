import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot } from "./types";
import type {
  SetupAnswer,
  SetupQuestion,
} from "../../packages/contracts/round2";
import { PreparationState } from "./PreparationState";
import type { RootsApi } from "./types";
import { OriginalPhoto } from "./OriginalPhotos";
const categoryLabels: Record<SetupQuestion["category"], string> = {
  photo: "The people in a photograph",
  kinship: "A family connection",
  origin: "A place to begin",
  time: "A moment in time",
  movement: "A journey",
  recollection: "A story worth keeping",
  conflict: "What the evidence leaves open",
};
export function SetupQuestions({
  snapshot,
  api,
  busy,
  onAnswer,
  onSource,
}: {
  snapshot: ProjectSnapshot;
  api: RootsApi;
  busy: boolean;
  onAnswer: (answer: SetupAnswer) => Promise<boolean>;
  onSource: (id: string) => void;
}) {
  const run = snapshot.run!;
  const [index, setIndex] = useState(() => {
    const pending = run.questions.findIndex(
      (q) => !run.answers.some((a) => a.questionId === q.id),
    );
    return pending < 0
      ? run.initialSavedAt
        ? 0
        : run.questions.length
      : pending;
  });
  const answered = new Set(run.answers.map((a) => a.questionId));
  const question = run.questions[index];
  const firstPending = run.questions.findIndex((q) => !answered.has(q.id));
  if (
    index >= run.questions.length ||
    (answered.size === run.questions.length &&
      !run.initialSavedAt &&
      run.phase !== "questions")
  )
    return (
      <PreparationState
        title="Your answers are saved"
        summary={
          run.error ||
          "Bringing together the first family branch from your supplied records. Unknown answers remain open."
        }
        active={run.phase !== "failed"}
      />
    );
  if (!question)
    return (
      <PreparationState
        summary={
          run.error ||
          "Reading your supplied files and checking their source references."
        }
        active={run.phase !== "failed"}
      />
    );
  return (
    <section className="setup-questions" aria-label="Family source questions">
      <div className="question-heading">
        <span className="eyebrow">
          A few connections only you can help with
        </span>
        <span className="question-count">
          Question {index + 1} of {run.questions.length}
        </span>
      </div>
      <nav className="question-steps" aria-label="Setup question progress">
        {run.questions.map((q, i) => (
          <button
            key={q.id}
            aria-label={`Question ${i + 1}${answered.has(q.id) ? ", answered" : ""}`}
            aria-current={i === index ? "step" : undefined}
            disabled={
              busy ||
              (firstPending >= 0 && i > firstPending && !answered.has(q.id))
            }
            onClick={() => setIndex(i)}
            className={answered.has(q.id) ? "answered" : ""}
          >
            {answered.has(q.id) ? "✓" : i + 1}
          </button>
        ))}
      </nav>
      <Question
        key={question.id}
        question={question}
        snapshot={snapshot}
        api={api}
        busy={busy}
        onSource={onSource}
        onAnswer={async (answer) => {
          if (!(await onAnswer(answer))) return false;
          const next = run.questions.findIndex(
            (q, i) => i > index && !answered.has(q.id),
          );
          setIndex(
            next >= 0 ? next : Math.min(index + 1, run.questions.length),
          );
          return true;
        }}
      />
      <div className="question-navigation">
        <button
          disabled={index === 0 || busy}
          onClick={() => setIndex((i) => i - 1)}
        >
          ← Back
        </button>
        <small>
          {answered.size} of {run.questions.length} answers saved · Unknown is a
          useful answer.
        </small>
      </div>
    </section>
  );
}
function Question({
  question: q,
  snapshot,
  api,
  busy,
  onAnswer,
  onSource,
}: {
  question: SetupQuestion;
  snapshot: ProjectSnapshot;
  api: RootsApi;
  busy: boolean;
  onAnswer: (answer: SetupAnswer) => Promise<boolean>;
  onSource: (id: string) => void;
}) {
  const previous = snapshot
    .run!.answers.filter((a) => a.questionId === q.id)
    .at(-1);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(previous?.savedText || q.recommendation);
  const [baseVersion, setBaseVersion] = useState(snapshot.version);
  const [submitted, setSubmitted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [q.id]);
  const waiting = q.status === "waiting";
  const failed = q.status === "failed";
  const stale = editing && baseVersion !== snapshot.version;
  useEffect(() => {
    if (!editing) setText(previous?.savedText || q.recommendation);
  }, [q.recommendation, previous?.savedText, editing]);
  const save = async (action: SetupAnswer["action"]) => {
    if (submitted || busy) return;
    setSubmitted(true);
    try {
      await onAnswer({
        questionId: q.id,
        action,
        ...(action === "correct" ? { text: text.trim() } : {}),
        baseVersion:
          editing && action === "correct" ? baseVersion : snapshot.version,
        requestId: crypto.randomUUID(),
      });
    } finally {
      setSubmitted(false);
    }
  };
  return (
    <article className="setup-question">
      <span className="eyebrow">{categoryLabels[q.category]}</span>
      <h2 ref={heading} tabIndex={-1}>
        {q.prompt}
      </h2>
      {q.category === "photo" &&
        q.effect.photoAssetId &&
        snapshot.assets.some((a) => a.id === q.effect.photoAssetId) && (
          <OriginalPhoto
            src={api.assetUrl(snapshot.projectId, q.effect.photoAssetId)}
            alt="Source photograph for the left-to-right identity check"
          />
        )}
      {waiting ? (
        <p className="question-pending" role="status">
          <span className="spinner" />
          {snapshot.run!.modelStatus === "running"
            ? "Astra is checking the source quotation."
            : "Preparing a source-backed suggestion."}
        </p>
      ) : failed ? (
        <p className="error">
          The source check needs attention. You can keep this answer unknown.
        </p>
      ) : (
        <div className="recommended-answer">
          <span className="badge">
            {previous ? "Saved answer" : "Recommended"}
          </span>
          <p>
            {previous?.action === "unknown"
              ? "Kept unknown"
              : previous?.savedText || q.recommendation || "Keep unresolved"}
          </p>
        </div>
      )}
      <details className="question-sources">
        <summary>
          Read the source {q.support.length > 1 ? `(${q.support.length})` : ""}
        </summary>
        <small>
          {q.origin === "live"
            ? "Suggestion from a validated Astra source check."
            : "Prepared suggestion from supplied evidence."}{" "}
          The original quotation remains preserved.
        </small>
        {q.support.map((span, i) => (
          <blockquote key={`${span.sourceId}-${i}`}>
            <p>{span.quote}</p>
            <button
              className="text-button"
              onClick={() => onSource(span.sourceId)}
            >
              {snapshot.sources.find((s) => s.id === span.sourceId)?.title ||
                "Supplied source"}{" "}
              · {span.locator} ↗
            </button>
          </blockquote>
        ))}
      </details>
      {editing && (
        <div className="question-edit">
          <label className="field">
            Your answer
            <textarea
              value={text}
              maxLength={4000}
              rows={3}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          </label>
          <small>
            Your correction is saved separately from the original evidence.
          </small>
          {stale && (
            <p className="stale-draft">
              New project activity arrived. Your draft is preserved.{" "}
              <button
                className="text-button"
                onClick={() => setBaseVersion(snapshot.version)}
              >
                Use latest version and keep draft
              </button>
            </p>
          )}
        </div>
      )}
      <div className="question-actions">
        <button
          className="primary"
          disabled={
            busy ||
            submitted ||
            waiting ||
            failed ||
            (editing && (!text.trim() || stale))
          }
          onClick={() =>
            void save(editing ? "correct" : previous?.action || "confirm")
          }
        >
          {busy || submitted
            ? "Saving answer…"
            : editing
              ? "Save my answer"
              : previous
                ? "Keep saved answer"
                : "Confirm answer"}
        </button>
        <button
          disabled={busy || submitted || waiting || failed}
          onClick={() => {
            setEditing(!editing);
            setBaseVersion(snapshot.version);
          }}
        >
          {editing ? "Cancel edit" : "Edit"}
        </button>
        <button
          className="text-button"
          disabled={busy || submitted}
          onClick={() => void save("unknown")}
        >
          I don't know
        </button>
      </div>
    </article>
  );
}
