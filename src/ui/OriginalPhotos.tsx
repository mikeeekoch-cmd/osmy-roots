import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import type { ProjectSnapshot, RootsApi } from "./types";
import { PhotoComparison } from "./PhotoComparison";
export function OriginalPhoto({ src, alt, retry = false }: { src: string; alt: string; retry?: boolean }) {
  return <RetryablePhoto key={src} src={src} alt={alt} retry={retry} />;
}
function ZoomablePhoto({src, alt}: {src: string; alt: string}) {
  const [zoom, setZoom] = useState(1);
  return <><div className="photo-zoom-tools" aria-label="Photograph zoom"><button disabled={zoom === 1} onClick={() => setZoom(n => Math.max(1, n - .5))} aria-label="Zoom photograph out">−</button><span>{Math.round(zoom * 100)}%</span><button disabled={zoom === 3} onClick={() => setZoom(n => Math.min(3, n + .5))} aria-label="Zoom photograph in">+</button><button onClick={() => setZoom(1)}>Fit photograph</button></div><div className={`photo-zoom-surface ${zoom > 1 ? "zoomed" : ""}`}><div style={{width: `${zoom * 100}%`}}><OriginalPhoto src={src} alt={alt} retry /></div></div></>;
}
function RetryablePhoto({ src, alt, retry }: { src: string; alt: string; retry: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return failed ? <span className="photo-unavailable" role="status">{alt}: original unavailable
    {retry && <button type="button" onClick={event => { event.stopPropagation(); setAttempt(n => n + 1); setFailed(false); }}>Retry photograph</button>}
  </span> : <img key={attempt} src={src} alt={alt} onError={() => setFailed(true)} />;
}
/** Caption associations are view-only and never become confirmed portrait IDs. */
export function photoIdsForPerson(snapshot: ProjectSnapshot, personId: string): string[] {
  const person = snapshot.people.find((p) => p.id === personId);
  const fromCaptions = (snapshot.photoAnnotations || []).filter((a) => a.positions.some((p) => p.personId === personId) || a.depictedPersonIds?.includes(personId)).map((a) => a.assetId);
  const enhanced = new Set((snapshot.photoPairs || []).map((pair) => pair.enhancedAssetId));
  return [...new Set([...(person?.photoIds || []), ...fromCaptions])].filter((id) => !enhanced.has(id) && snapshot.assets.some((asset) => asset.id === id && asset.mediaType.startsWith("image/")));
}
export function OriginalPhotos({
  ids,
  snapshot,
  api,
  personId,
  comparisonFor,
}: {
  ids: string[];
  snapshot: ProjectSnapshot;
  api: RootsApi;
  personId?: string;
  comparisonFor?: (originalId: string) => {enhancedUrl: string; aligned: boolean} | undefined;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const pairs = (snapshot.photoPairs || []).filter((pair) => snapshot.assets.some((a) => a.id === pair.originalAssetId && a.mediaType.startsWith("image/")) && snapshot.assets.some((a) => a.id === pair.enhancedAssetId && a.mediaType.startsWith("image/")));
  const pair = pairs.find((item) => item.originalAssetId === selected);
  const suppliedPair = selected ? comparisonFor?.(selected) : undefined;
  const candidateIds = personId ? [...new Set([...ids, ...photoIdsForPerson(snapshot, personId)])] : ids;
  const galleryIds = candidateIds.filter((id) => !pairs.some((item) => item.enhancedAssetId === id));
  useEffect(() => { setSelected(null); setComparing(false); }, [personId]);
  const open = selected !== null;
  const idsRef = useRef(galleryIds);
  idsRef.current = galleryIds;
  useEffect(() => { if (selected && !galleryIds.includes(selected)) { setSelected(null); setComparing(false); } }, [galleryIds.join("|"), selected]);
  const move = (delta: number) => {
    setComparing(false);
    setSelected((current) =>
      current
        ? idsRef.current[(idsRef.current.indexOf(current) + delta + idsRef.current.length) % idsRef.current.length]
        : null,
    );
  };
  useEffect(() => {
    if (!open) return;
    const listener = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches('input, textarea, select, [role="slider"]')) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => {
      window.removeEventListener("keydown", listener, true);

    };
  }, [open]);
  if (!galleryIds.length) return null;
  const name = (id: string) =>
    snapshot.assets.find((a) => a.id === id)?.originalName ||
    "Original photograph";
  return (
    <>
      <div className="photo-gallery">
        {galleryIds.map((id) => (
          <figure key={id}>
            <button
              className="photo-open"
              onClick={(event) => {
                setComparing(false);
                setSelected(id);
              }}
              aria-label={`Enlarge ${name(id)}`}
            >
              <OriginalPhoto
                src={api.assetUrl(snapshot.projectId, id)}
                alt={name(id)}
              />
            </button>
            {(pairs.some((pair) => pair.originalAssetId === id) || comparisonFor?.(id)) && <button className="compare-photo-button" onClick={(event) => { setSelected(id); setComparing(true); }}>Compare photos</button>}
            <figcaption>
              {name(id)}
              <br />
              Original file
            </figcaption>
            <PhotoCaption assetId={id} snapshot={snapshot} personId={personId} />
          </figure>
        ))}
      </div>
      {selected && (
        <Modal className="photo-lightbox" label={comparing ? "Original and enhanced photographs" : "Original photograph"} onClose={() => setSelected(null)}>
          <button
            className="photo-lightbox-close"
            aria-label="Close photograph"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <div className="photo-lightbox-content" onClick={(e) => e.stopPropagation()}>
            {comparing && pair ? <PhotoComparison key={pair.id} pair={pair} originalUrl={api.assetUrl(snapshot.projectId, pair.originalAssetId)} enhancedUrl={api.assetUrl(snapshot.projectId, pair.enhancedAssetId)} /> : comparing && suppliedPair ? <PhotoComparison originalUrl={api.assetUrl(snapshot.projectId, selected)} enhancedUrl={suppliedPair.enhancedUrl} aligned={suppliedPair.aligned} caption={name(selected)} /> : <ZoomablePhoto key={selected}
              src={api.assetUrl(snapshot.projectId, selected)}
              alt={name(selected)}
            />}
            {(pair || suppliedPair) && <button className="toggle-photo-comparison" onClick={() => setComparing(!comparing)}>{comparing ? "View complete original" : "Compare photos"}</button>}
            <p aria-live="polite">
              {name(selected)} · Photograph {galleryIds.indexOf(selected) + 1} of{" "}
              {galleryIds.length}
            </p>
            <PhotoCaption assetId={selected} snapshot={snapshot} personId={personId} />
            {galleryIds.length > 1 && (
              <nav
                className="photo-navigation"
                aria-label="Original photo navigation"
              >
                <button
                  aria-label="Previous photograph"
                  onClick={() => move(-1)}
                >
                  ← Previous
                </button>
                <button aria-label="Next photograph" onClick={() => move(1)}>
                  Next →
                </button>
              </nav>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function PhotoCaption({ assetId, snapshot, personId }: {
  assetId: string; snapshot: ProjectSnapshot; personId?: string;
}) {
  const annotation = snapshot.photoAnnotations?.find((a) => a.assetId === assetId);
  if (!annotation) return null;
  const reviewed = personId ? annotation.positions.some((position) => position.personId === personId && position.status === "confirmed") : annotation.positions.length > 0 && annotation.positions.every((position) => position.status === "confirmed");
  return <div className="supplied-photo-caption">
    <small>From the supplied caption</small>
    {!reviewed && <small className="photo-review-status">Identity not reviewed</small>}
    {annotation.caption && <p>{annotation.caption}</p>}
    {annotation.positions.length ? <details className="photo-identities"><summary>People, left to right</summary><ol>{[...annotation.positions].sort((a,b) => a.position-b.position).map((position) => <li key={position.position} value={position.position}>{position.label || "Unknown"} <small>· {position.status}</small></li>)}</ol></details> : <>
      <p className="photo-order-unknown">Left-to-right order is unknown.</p>
      {!!annotation.depictedPersonIds?.length && <details className="photo-identities"><summary>People named in the caption</summary><ul>{annotation.depictedPersonIds.map((id) => <li key={id}>{snapshot.people.find((person) => person.id === id)?.displayNameEn || "Person not yet in this branch"}</li>)}</ul></details>}
    </>}
  </div>;
}
