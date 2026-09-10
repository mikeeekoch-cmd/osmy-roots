import { useState } from "react";
/** A view only: URLs/alignment come from validated shared pair metadata. No state/API writes. */
export function PhotoComparison({
  originalUrl,
  enhancedUrl,
  caption,
  aligned,
}: {
  originalUrl: string;
  enhancedUrl: string;
  caption: string;
  aligned: boolean;
}) {
  return (
    <Comparison
      key={`${originalUrl}|${enhancedUrl}|${aligned}`}
      originalUrl={originalUrl}
      enhancedUrl={enhancedUrl}
      caption={caption}
      aligned={aligned}
    />
  );
}
function Comparison({
  originalUrl,
  enhancedUrl,
  caption,
  aligned,
}: {
  originalUrl: string;
  enhancedUrl: string;
  caption: string;
  aligned: boolean;
}) {
  const [position, setPosition] = useState(50);
  const [originalSize, setOriginalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [enhancedSize, setEnhancedSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [failed, setFailed] = useState<"original" | "enhanced" | null>(null);
  const ready = !!originalSize && !!enhancedSize;
  const matchingRatio =
    ready &&
    Math.abs(
      originalSize.width / originalSize.height -
        enhancedSize.width / enhancedSize.height,
    ) < 0.01;
  const sideBySide = !aligned || (ready && !matchingRatio);
  if (failed)
    return (
      <div className="comparison-fallback" role="status">
        {failed !== "original" && (
          <img
            src={originalUrl}
            alt={`${caption}, original`}
            onError={() => setFailed("original")}
          />
        )}
        <p>
          {failed === "enhanced"
            ? "Enhanced photo unavailable. Showing the original."
            : "Original photo unavailable. Comparison cannot be shown."}
        </p>
      </div>
    );
  return (
    <section
      className={`photo-comparison ${sideBySide ? "side-by-side" : "aligned"}`}
      aria-label="Original and enhanced photo comparison"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="comparison-images"
        style={
          sideBySide
            ? undefined
            : {
                aspectRatio: originalSize
                  ? `${originalSize.width} / ${originalSize.height}`
                  : "4 / 3",
              }
        }
      >
        <figure className="comparison-enhanced">
          <img
            src={enhancedUrl}
            alt={`${caption}, enhanced derivative`}
            onLoad={(e) =>
              setEnhancedSize({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
            onError={() => setFailed("enhanced")}
          />
          <figcaption>Enhanced</figcaption>
        </figure>
        <figure
          className="comparison-original"
          style={
            sideBySide
              ? undefined
              : { clipPath: `inset(0 ${100 - position}% 0 0)` }
          }
        >
          <img
            src={originalUrl}
            alt={`${caption}, original photograph`}
            onLoad={(e) =>
              setOriginalSize({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
            onError={() => setFailed("original")}
          />
          <figcaption>Original</figcaption>
        </figure>
        {!sideBySide && (
          <>
            <div
              className="comparison-divider"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            >
              <span>↔</span>
            </div>
            <label className="comparison-range-label">
              <span className="visually-hidden">Photo comparison divider</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={position}
                disabled={!ready}
                aria-valuetext={`${position}% original, ${100 - position}% enhanced`}
                onChange={(e) => setPosition(Number(e.target.value))}
              />
            </label>
            <span className="comparison-side-label original-label">
              Original
            </span>
            <span className="comparison-side-label enhanced-label">
              Enhanced
            </span>
          </>
        )}
      </div>
      {!ready && (
        <p className="comparison-status" role="status">
          Loading the two photographs…
        </p>
      )}
      <div className="comparison-tools">
        {sideBySide ? (
          <p>Shown side by side to preserve each photograph's framing.</p>
        ) : (
          <>
            <span>Drag the divider or use the arrow keys.</span>
            <button onClick={() => setPosition(100)} disabled={!ready}>
              Full original
            </button>
            <button onClick={() => setPosition(50)} disabled={!ready}>
              50 / 50
            </button>
            <button onClick={() => setPosition(0)} disabled={!ready}>
              Full enhanced
            </button>
          </>
        )}
      </div>
      <small>
        Enhanced details are a visual interpretation. The original remains the
        historical source.
      </small>
    </section>
  );
}
