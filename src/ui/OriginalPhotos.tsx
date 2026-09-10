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
    <img src={src} alt={alt} onError={() => setFailed(true)} />
  );
}
export function OriginalPhotos({
  ids,
  snapshot,
  api,
}: {
  ids: string[];
  snapshot: ProjectSnapshot;
  api: RootsApi;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!selected) return;
    close.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setSelected(null);
      }
      if (e.key === "Tab") {
        e.preventDefault();
        close.current?.focus();
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [selected]);
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
              onClick={() => setSelected(id)}
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
          </figure>
        ))}
      </div>
      {selected && (
        <div
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
            <OriginalPhoto
              src={api.assetUrl(snapshot.projectId, selected)}
              alt={name(selected)}
            />
            <p>{name(selected)}</p>
          </div>
        </div>
      )}
    </>
  );
}
