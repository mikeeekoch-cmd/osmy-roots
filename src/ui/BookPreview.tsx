import { useState } from "react";
import type { ProjectSnapshot } from "./types";
import { Modal } from "./Modal";
export function BookPreview({ snapshot, busy, downloaded, onPrepare, onSource, previewUrl }: {
  snapshot: ProjectSnapshot; busy: boolean; downloaded: boolean; onPrepare?: () => void; onDownload?: () => void; onSource: (id: string) => void; previewUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const run = snapshot.run;
  const edition = snapshot.research?.bookEdition;
  const ready = snapshot.research ? !!edition && ["current", "sealed"].includes(edition.status) : run ? run.book.status === "ready" : snapshot.bookStatus === "current";
  const failed = edition?.status === "error" || run?.book.status === "failed" || snapshot.bookStatus === "failed";
  const preparing = edition?.status === "preparing" || run?.book.status === "preparing" || snapshot.bookStatus === "generating";
  const status = downloaded ? "Delivered edition" : ready ? "Book ready" : failed ? "Book needs attention" : preparing ? "Preparing book…" : edition?.status === "stale" || snapshot.bookStatus === "stale" ? "Book needs updating" : "Family book";
  return <div className="compact-book">
    <button className="book-info-button" aria-haspopup="dialog" onClick={() => setOpen(true)}>{preparing && <span className="spinner" />} {status} <span aria-hidden="true">ⓘ</span></button>
    {open && <Modal label="Current family book" className="book-details-dialog" onClose={() => { setOpen(false); setPreview(false); }}>
      <section className="book-details-content">
        <div className="drawer-header"><span className="eyebrow">{status}</span><button onClick={() => { setOpen(false); setPreview(false); }} aria-label="Close book details">×</button></div>
        <h2>{snapshot.input.seedName}</h2>
        <p>{ready ? "Preview the current PDF. Download includes this edition, readable HTML, your editable project and original evidence." : "The current edition is assembled from saved records, reviewed contributions and open questions."}</p>
        {edition && <p>{edition.pageCount} pages · {edition.status} · Edition {edition.id}</p>}
        {edition?.error && <p className="error" role="alert">{edition.error}</p>}
        <small>Saved project v{snapshot.version}{run?.book.stateVersion !== undefined ? ` · Book v${run.book.stateVersion}` : ""}</small>
        {run?.book.error && <p className="error" role="alert">{run.book.error}</p>}
        <div className="book-preview-actions">{ready && previewUrl && <button onClick={() => setPreview(true)}>Preview current PDF</button>}{!ready && !preparing && onPrepare && <button disabled={busy} onClick={onPrepare}>{failed ? "Retry book preparation" : "Prepare current edition"}</button>}</div>
        {preview && ready && previewUrl && <div className="book-pdf"><iframe title="Current family-book PDF" src={`${previewUrl}?version=${edition?.stateVersion || run?.book.stateVersion || snapshot.version}`} /><a href={`${previewUrl}?version=${edition?.stateVersion || run?.book.stateVersion || snapshot.version}`} target="_blank" rel="noreferrer">Open full PDF in a new tab ↗</a></div>}
        {preview && !ready && <p role="status">The project changed. Prepare its current edition to preview the updated book.</p>}
        {!!snapshot.bookPassages.length && <details className="preview-passages"><summary>Saved passages and sources</summary>{snapshot.bookPassages.map(p => <article key={p.id}><p>{p.text}</p>{p.sourceLocators.map((span, i) => <button className="text-button" key={i} onClick={() => { setOpen(false); onSource(span.sourceId); }}>{span.locator}</button>)}</article>)}</details>}
      </section>
    </Modal>}
  </div>;
}
