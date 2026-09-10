import {useEffect, useRef, useState} from "react";
import type { ProjectSnapshot } from "./types";
export function BookPreview({ snapshot, busy, downloaded, onPrepare, onDownload, onSource, previewUrl }: {
  snapshot: ProjectSnapshot; busy: boolean; downloaded: boolean; onPrepare?: () => void; onDownload: () => void; onSource: (id: string) => void; previewUrl?: string;
}) {
  const [preview, setPreview] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!preview) return;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopImmediatePropagation(); setPreview(false); } };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); opener.current?.focus(); };
  }, [preview]);
  const run = snapshot.run;
  const ready = run ? run.book.status === "ready" : snapshot.bookStatus === "current";
  const failed = run?.book.status === "failed" || snapshot.bookStatus === "failed";
  const preparing = run?.book.status === "preparing" || snapshot.bookStatus === "generating";
  return <section className={`current-book-preview ${ready ? "book-ready" : ""}`} aria-label="Current family book">
    <div className="book-cover" aria-hidden="true"><span>OSMY ROOTS</span><strong>{snapshot.input.seedName}</strong><i>A family story</i></div>
    <div className="book-preview-body">
      <span className="eyebrow">{downloaded ? "Your family book was delivered" : ready ? "Your current family book is ready" : failed ? "Book preparation needs attention" : "Your family book"}</span>
      <h3>{ready || downloaded ? "A story you can keep" : preparing ? "Preparing the current illustrated book" : "Built from your saved family records"}</h3>
      <p>{snapshot.people.length} people · {snapshot.assets.filter((a) => a.mediaType.startsWith("image/")).length} photographs · {snapshot.bookPassages.length} sourced passages</p>
      <small>{ready ? "PDF, readable HTML and the complete editable project in one ZIP." : "The download includes the current reviewed state and its open questions."}</small>
      {run?.book.error && <p className="error" role="alert">{run.book.error}</p>}
      {snapshot.bookPassages.length > 0 && <details className="preview-passages"><summary>Read the current book passages</summary>{snapshot.bookPassages.map((p) => <article key={p.id}><p>{p.text}</p>{p.sourceLocators.map((span, i) => <button className="text-button" key={i} onClick={() => onSource(span.sourceId)}>{span.locator}</button>)}</article>)}</details>}
      <div className="book-preview-actions">{ready && previewUrl && <button ref={opener} onClick={() => setPreview(true)}>Preview current PDF</button>}{failed && onPrepare && <button disabled={busy} onClick={onPrepare}>Retry book preparation</button>}{ready && !downloaded && <button className="primary" disabled={busy} onClick={onDownload}>↓ Download family book</button>}</div>
    </div>
    {preview && previewUrl && ready && <div className="book-preview-dialog" role="dialog" aria-modal="true" aria-label="Current family-book PDF"><div><button ref={close} onClick={() => setPreview(false)}>Close book preview</button><iframe title="Current family-book PDF" src={`${previewUrl}?version=${run?.book.stateVersion || snapshot.version}`} /></div></div>}
  </section>;
}
