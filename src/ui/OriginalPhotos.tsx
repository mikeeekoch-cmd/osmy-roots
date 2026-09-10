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
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = selected !== null;
  const move = (delta: number) =>
    setSelected((current) =>
      current
        ? ids[(ids.indexOf(current) + delta + ids.length) % ids.length]
        : null,
    );
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
          ...(dialog.current?.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled])",
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
  }, [open, ids.join("|")]);
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
            <OriginalPhoto
              src={api.assetUrl(snapshot.projectId, selected)}
              alt={name(selected)}
            />
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
