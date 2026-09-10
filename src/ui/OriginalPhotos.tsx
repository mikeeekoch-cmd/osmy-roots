import { PhotoComparison } from "./PhotoComparison";
import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot, RootsApi } from "./types";
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
    <img key={src} src={src} alt={alt} onError={() => setFailed(true)} />
  );
}
export function OriginalPhotos({
  ids,
  snapshot,
  api,
  comparisonFor,
}: {
  ids: string[];
  snapshot: ProjectSnapshot;
  api: RootsApi;
  /** Render-only adapter. Pass only pairs already validated by the shared API. */
  comparisonFor?: (
    originalId: string,
  ) => { enhancedUrl: string; aligned: boolean } | undefined;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = selected !== null;
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const move = (delta: number) => {
    setComparing(false);
    setSelected((current) =>
      current
        ? idsRef.current[
            (idsRef.current.indexOf(current) + delta + idsRef.current.length) %
              idsRef.current.length
          ]
        : null,
    );
  };
  useEffect(() => {
    if (selected && !ids.includes(selected)) {
      setSelected(null);
      setComparing(false);
    }
  }, [ids.join("|"), selected]);
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
            'button:not([disabled]),input:not([disabled]),a[href],[tabindex="0"]',
          ) || []),
        ];
        const first = buttons[0],
          last = buttons.at(-1);
        if (!dialog.current?.contains(document.activeElement)) {
          e.preventDefault();
          first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (
        (e.target as HTMLElement).matches(
          "input,textarea,select,[role='slider']",
        )
      )
        return;
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
  }, [open]);
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
            <figcaption>
              {name(id)}
              <br />
              Original file
            </figcaption>
            <PhotoCaption assetId={id} snapshot={snapshot} />
            {comparisonFor?.(id) && (
              <button
                className="compare-photo-button"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setSelected(id);
                  setComparing(true);
                }}
              >
                Compare photos
              </button>
            )}
          </figure>
        ))}
      </div>
      {selected && (
        <div
          ref={dialog}
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={
            comparing
              ? "Original and enhanced photographs"
              : "Original photograph"
          }
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
            {comparing && comparisonFor?.(selected) ? (
              <PhotoComparison
                originalUrl={api.assetUrl(snapshot.projectId, selected)}
                enhancedUrl={comparisonFor(selected)!.enhancedUrl}
                aligned={comparisonFor(selected)!.aligned}
                caption={name(selected)}
              />
            ) : (
              <OriginalPhoto
                src={api.assetUrl(snapshot.projectId, selected)}
                alt={name(selected)}
              />
            )}
            {comparisonFor?.(selected) && (
              <button
                className="comparison-toggle"
                onClick={() => setComparing(!comparing)}
              >
                {comparing ? "View original photograph" : "Compare photos"}
              </button>
            )}
            <p aria-live="polite">
              {name(selected)} · Original {ids.indexOf(selected) + 1} of{" "}
              {ids.length}
            </p>
            {ids.length > 1 && (
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

function PhotoCaption({
  assetId,
  snapshot,
}: {
  assetId: string;
  snapshot: ProjectSnapshot;
}) {
  const annotation = snapshot.photoAnnotations?.find(
    (a) => a.assetId === assetId,
  );
  if (!annotation?.positions.length) return null;
  return (
    <details className="photo-identities">
      <summary>People, left to right</summary>
      <ol>
        {[...annotation.positions]
          .sort((a, b) => a.position - b.position)
          .map((position) => (
            <li key={position.position} value={position.position}>
              {position.label || "Unknown"} <small>· {position.status}</small>
            </li>
          ))}
      </ol>
    </details>
  );
}
