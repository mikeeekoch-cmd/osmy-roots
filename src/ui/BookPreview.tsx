import type { ProjectSnapshot } from "./types";
import { RootsMark } from "./Brand";
export function BookPreview({
  snapshot,
  busy,
  delivery,
  onPrepare,
  onDownload,
  onSource,
}: {
  snapshot: ProjectSnapshot;
  busy: boolean;
  delivery: string;
  onPrepare?: () => void;
  onDownload: () => void;
  onSource: (id: string) => void;
}) {
  const book = snapshot.run?.book;
  const ready = book
    ? book.status === "ready"
    : snapshot.bookStatus === "current";
  const completed =
    delivery === "completed" || snapshot.run?.phase === "completed";
  const active =
    ["sealing", "delivering"].includes(delivery) ||
    book?.status === "preparing" ||
    snapshot.bookStatus === "generating";
  const failed =
    delivery === "failed" ||
    book?.status === "failed" ||
    snapshot.bookStatus === "failed";
  const title = completed
    ? "Your family book is ready to keep"
    : delivery === "delivering"
      ? "Sending your download"
      : delivery === "sealing"
        ? "Finishing this edition"
        : failed
          ? "Your book needs another try"
          : active
            ? "Preparing your family book"
            : ready
              ? "Your family book is ready"
              : "Your story, taking shape";
  return (
    <section
      className={`book-preview ${ready ? "ready" : ""}`}
      aria-label="Family book preview"
    >
      <div className="book-cover" aria-hidden="true">
        <RootsMark />
        <span>Osmy Roots</span>
        <strong>{snapshot.input.seedName}</strong>
        <small>A family book</small>
      </div>
      <div className="book-preview-copy">
        <span className="eyebrow">The connections you keep</span>
        <h2>{title}</h2>
        <p role="status">
          {completed
            ? "The ZIP was sent to your browser. It includes the saved family project, sources and original files."
            : failed
              ? book?.error ||
                "Your work is saved. Retry to prepare and download the current edition."
              : ready
                ? "Your reviewed stories, photographs and their sources, together in one edition."
                : "Review your sources while your family book takes shape. Unresolved questions remain visible."}
        </p>
        {snapshot.bookPassages.length > 0 && (
          <details className="book-passage">
            <summary>
              {ready ? "Read the current passage" : "Read the saved passage"}
              {snapshot.bookStatus === "stale" ? " · awaiting an update" : ""}
            </summary>
            {snapshot.bookPassages.map((p) => (
              <article key={p.id}>
                <p>{p.text}</p>
                {p.sourceLocators.map((span, i) => (
                  <button
                    className="text-button"
                    key={i}
                    onClick={() => onSource(span.sourceId)}
                  >
                    {span.locator} ↗
                  </button>
                ))}
              </article>
            ))}
          </details>
        )}
        <div className="book-actions">
          {!ready && !completed && !snapshot.run?.sealedAt && onPrepare && (
            <button disabled={busy || active} onClick={onPrepare}>
              Prepare current book
            </button>
          )}
          <button
            className={ready ? "primary" : ""}
            disabled={busy || active}
            onClick={onDownload}
          >
            {active ? (
              <>
                <span className="spinner" /> Preparing…
              </>
            ) : completed ? (
              "Download again"
            ) : failed ? (
              "Retry book download"
            ) : ready ? (
              "Download family book"
            ) : (
              "Download current work"
            )}
          </button>
        </div>
        {!ready && !completed && (
          <small>
            {snapshot.run
              ? "Downloading closes this run with the current reviewed state. Open questions stay documented."
              : "Your current reviewed work and open questions are included in the download."}
          </small>
        )}
      </div>
    </section>
  );
}
