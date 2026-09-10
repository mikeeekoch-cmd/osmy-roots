import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot, RootsApi } from "./types";
import { PhotoComparison } from "./PhotoComparison";
export function OriginalPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed ? (
    <span
      className="photo-unavailable"
      role="img"
      aria-label={`${alt}: original unavailable`}
    >
      Original unavailable
    </span>
  ) : (
    <img src={src} alt={alt} onError={() => setFailed(true)} />
  );
}
export function OriginalPhotos({
  ids,
  snapshot,
  api,
  personId,
}: {
  ids: string[];
  snapshot: ProjectSnapshot;
  api: RootsApi;
  personId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const pairs = (snapshot.photoPairs || []).filter((pair) => (!personId || pair.personIds.includes(personId)) && snapshot.assets.some((a) => a.id === pair.originalAssetId && a.mediaType.startsWith("image/")) && snapshot.assets.some((a) => a.id === pair.enhancedAssetId && a.mediaType.startsWith("image/")));
  const pair = pairs.find((item) => item.originalAssetId === selected);
  const galleryIds = ids.filter((id) => !pairs.some((item) => item.enhancedAssetId === id));
  useEffect(() => { setSelected(null); setComparing(false); }, [personId]);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = selected !== null;
  const move = (delta: number) => {
    setComparing(false);
    setSelected((current) =>
      current
        ? galleryIds[(galleryIds.indexOf(current) + delta + galleryIds.length) % galleryIds.length]
        : null,
    );
  };
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setSelected(null);
      }
      if (e.key === "Tab") {
        const buttons = [
          ...(dialog.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled])",
          ) || []),
        ];
        const first = buttons[0],
          last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
      if ((e.target as HTMLElement)?.closest('input[type="range"]')) return;
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
      opener.current?.focus();
    };
  }, [open, galleryIds.join("|")]);
  if (!ids.length) return null;
  const name = (id: string) =>
    snapshot.assets.find((a) => a.id === id)?.originalName ||
    "Original photograph";
  return (
    <>
      <div className="photo-gallery">
        {ids.map((id) => (
          <figure key={id}>
            <button
              className="photo-open"
              onClick={(event) => {
                opener.current = event.currentTarget;
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
            {pairs.some((pair) => pair.originalAssetId === id) && <button className="compare-photo-button" onClick={(event) => { opener.current = event.currentTarget; setSelected(id); setComparing(true); }}>Compare photos</button>}
            <figcaption>
              {name(id)}
              <br />
              Original file
            </figcaption>
          </figure>
        ))}
      </div>
      {selected && (
        <div
          ref={dialog}
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Original photograph"
          onClick={() => setSelected(null)}
        >
          <button
            ref={close}
            aria-label="Close photograph"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            {comparing && pair ? <PhotoComparison key={pair.id} pair={pair} originalUrl={api.assetUrl(snapshot.projectId, pair.originalAssetId)} enhancedUrl={api.assetUrl(snapshot.projectId, pair.enhancedAssetId)} /> : <OriginalPhoto
              src={api.assetUrl(snapshot.projectId, selected)}
              alt={name(selected)}
            />}
            {pair && <button className="toggle-photo-comparison" onClick={() => setComparing(!comparing)}>{comparing ? "View complete original" : "Compare photos"}</button>}
            <p aria-live="polite">
              {name(selected)} · Photograph {galleryIds.indexOf(selected) + 1} of{" "}
              {galleryIds.length}
            </p>
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
        </div>
      )}
    </>
  );
}
