import type { ProjectSnapshot, ResearchEvent } from "./types";
import { label, progressCounts, uniqueEvents } from "./model";
const operationText: Record<ResearchEvent["operation"], string> = {
  parse_file: "Read a source file",
  normalize_entity: "Import family records",
  retrieve_website: "Retrieve a public source",
  search_local: "Search saved sources",
  analyze_record: "Analyze source evidence",
  compare_candidates: "Compare possible people",
  request_human: "Ask for your knowledge",
  apply_review: "Save your contribution",
  generate_book: "Write the family book",
  export_project: "Package your family book",
};
export function ResearchProgress({
  snapshot,
  busy,
  onSource,
}: {
  snapshot: ProjectSnapshot;
  busy: boolean;
  onSource: (id: string) => void;
}) {
  const events = uniqueEvents(snapshot.researchEvents),
    counts = progressCounts(snapshot),
    latest = events.at(-1);
  const storedOriginal = (event: ResearchEvent | undefined) =>
    !!event &&
    event.operation === "parse_file" &&
    event.state === "blocked" &&
    snapshot.files.some(
      (file) =>
        file.status === "stored_only" &&
        event.finding?.includes(file.originalName),
    );
  const findingText = (event: ResearchEvent) =>
    storedOriginal(event)
      ? event.finding?.replace(": stored_only", ": original saved")
      : event.finding;
  return (
    <aside className="research-progress">
      <span className="eyebrow">Roots is working with you</span>
      <h2>Following the clues</h2>
      <div className={`run-status ${busy ? "working" : ""}`}>
        {busy && <span className="spinner" />}
        <strong>
          {busy
            ? "Working…"
            : storedOriginal(latest)
              ? "Original saved"
              : label(latest?.state || "Ready")}
        </strong>
      </div>
      <p className="current-action" aria-live="polite">
        {(latest && findingText(latest)) ||
          (latest
            ? operationText[latest.operation]
            : "Ready for your family material.")}
      </p>
      <div className="metrics">
        {(
          [
            [counts.people, "People in map"],
            [counts.files, "Files parsed"],
            [counts.records, "Records analyzed"],
            [counts.websites, "Live websites"],
          ] as const
        ).map(([n, text]) => (
          <div key={text}>
            <strong>{n}</strong>
            <span>{text}</span>
          </div>
        ))}
      </div>
      {snapshot.files.length > 0 && (
        <details className="processing-files">
          <summary>Source files ({snapshot.files.length})</summary>
          {snapshot.files.map((file) => (
            <article key={file.uploadId}>
              <strong>{file.originalName}</strong>
              <span className={`badge ${file.status}`}>
                {label(file.status)}
              </span>
              {file.warnings.map((warning, i) => (
                <p key={i}>{warning}</p>
              ))}
              {file.sourceIds.map((id) => (
                <button
                  className="text-button"
                  key={id}
                  onClick={() => onSource(id)}
                >
                  Inspect source ↗
                </button>
              ))}
            </article>
          ))}
        </details>
      )}
      <h3>Research activity</h3>
      <ol className="activity">
        {events
          .slice(-15)
          .reverse()
          .map((e) => (
            <li key={e.eventId} className={e.state}>
              <div className="activity-label">
                <strong>{operationText[e.operation]}</strong>
                <span className={`origin ${e.origin}`}>{e.origin}</span>
              </div>
              <small>
                {storedOriginal(e) ? "Original saved" : label(e.state)}
              </small>
              {e.finding && <p>{findingText(e)}</p>}
              {e.error && (
                <p className={storedOriginal(e) ? "muted" : "error"}>
                  {e.error}
                </p>
              )}
              {e.sourceId && (
                <button
                  className="text-button"
                  onClick={() => onSource(e.sourceId!)}
                >
                  Inspect source ↗
                </button>
              )}
            </li>
          ))}
      </ol>
      {!events.length && <p className="muted">No completed research yet.</p>}
      <div className="trust-note">
        A suggestion is a starting point.
        <br />
        The evidence stays with every story.
      </div>
    </aside>
  );
}
