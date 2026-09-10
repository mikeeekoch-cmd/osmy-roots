import type { ProjectSnapshot } from "./types";
import { label, progressCounts, uniqueEvents } from "./model";
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
  return (
    <aside className="research-progress">
      <span className="eyebrow">Roots is working with you</span>
      <h2>Following the clues</h2>
      <div className={`run-status ${busy ? "working" : ""}`}>
        {busy && <span className="spinner" />}
        <strong>{busy ? "Working…" : label(latest?.state || "Ready")}</strong>
      </div>
      <p className="current-action" aria-live="polite">
        {latest?.finding ||
          (latest
            ? label(latest.operation)
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
                <strong>{label(e.operation)}</strong>
                <span className={`origin ${e.origin}`}>{e.origin}</span>
              </div>
              <small>{label(e.state)}</small>
              {e.finding && <p>{e.finding}</p>}
              {e.error && <p className="error">{e.error}</p>}
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
