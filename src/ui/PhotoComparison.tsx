import { useState, type CSSProperties } from "react";
import type { PhotoPair } from "../../packages/contracts/round2";

type Dimensions = { width: number; height: number };
type Crop = [number, number, number, number];
const fullCrop: Crop = [0, 0, 1, 1];
function cropStyle(crop: Crop = fullCrop): CSSProperties {
  const [x, y, w, h] = crop;
  return { position: "absolute", width: `${100 / w}%`, height: `${100 / h}%`, maxWidth: "none", maxHeight: "none", left: `${-x / w * 100}%`, top: `${-y / h * 100}%`, objectFit: "fill" };
}
export const usableCrop = (crop: Crop | undefined) => !crop || crop.every(Number.isFinite) && crop[0] >= 0 && crop[1] >= 0 && crop[2] > 0 && crop[3] > 0 && crop[0] + crop[2] <= 1 && crop[1] + crop[3] <= 1;
type ComparisonProps = {originalUrl: string; enhancedUrl: string} & ({pair: PhotoPair; caption?: never; aligned?: never} | {pair?: never; caption: string; aligned: boolean});
export function PhotoComparison(props: ComparisonProps) {
  return <Comparison key={`${props.originalUrl}|${props.enhancedUrl}|${props.pair?.id || props.aligned}`} {...props} />;
}
function Comparison({ pair, originalUrl, enhancedUrl, caption, aligned: suppliedAlignment }: ComparisonProps) {
  const [position, setPosition] = useState(50);
  const [original, setOriginal] = useState<Dimensions | null>(null);
  const [enhanced, setEnhanced] = useState<Dimensions | null>(null);
  const [originalFailed, setOriginalFailed] = useState(false);
  const [enhancedFailed, setEnhancedFailed] = useState(false);
  const originalCrop = pair?.alignment.originalCrop || fullCrop;
  const enhancedCrop = pair?.alignment.enhancedCrop || fullCrop;
  const ratio = original ? original.width * originalCrop[2] / (original.height * originalCrop[3]) : 4 / 3;
  const enhancedRatio = enhanced ? enhanced.width * enhancedCrop[2] / (enhanced.height * enhancedCrop[3]) : ratio;
  const aligned = (pair ? pair.alignment.mode === "aligned" : suppliedAlignment) && usableCrop(pair?.alignment.originalCrop) && usableCrop(pair?.alignment.enhancedCrop) && (!original || !enhanced || Math.abs(ratio - enhancedRatio) / ratio < 0.03);
  const load = (setter: (d: Dimensions) => void) => (e: React.SyntheticEvent<HTMLImageElement>) => setter({width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight});
  if (originalFailed) return <p className="photo-comparison-error" role="status">The original photograph is unavailable. This pair cannot be compared.</p>;
  return <section className="photo-comparison" aria-label="Compare original and enhanced photograph">
    {enhancedFailed ? <><img className="comparison-original-fallback" src={originalUrl} alt="Original photograph" onError={() => setOriginalFailed(true)} /><p role="status">Enhanced version unavailable. Showing the original.</p></> : aligned ? <>
      <div className="comparison-viewport" style={{aspectRatio: ratio, maxWidth: `min(100%, ${62 * ratio}vh)`}} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className="comparison-layer"><img src={enhancedUrl} alt="Enhanced photograph" style={cropStyle(enhancedCrop)} onLoad={load(setEnhanced)} onError={() => setEnhancedFailed(true)} /></div>
        <div className="comparison-layer comparison-original" style={{clipPath: `inset(0 ${100-position}% 0 0)`}}><img src={originalUrl} alt="Original photograph" style={cropStyle(originalCrop)} onLoad={load(setOriginal)} onError={() => setOriginalFailed(true)} /></div>
        {(!original || !enhanced) && <span className="comparison-loading" role="status">Loading both photographs…</span>}
        {original && enhanced && <>
          <span className="comparison-label original">Original</span><span className="comparison-label enhanced">Enhanced</span>
          <span className="comparison-divider" style={{left: `${position}%`}} aria-hidden="true"><span>↔</span></span>
          <input className="comparison-range" type="range" min={0} max={100} step={1} value={position} aria-label="Photo comparison divider" aria-valuetext={`${position}% original, ${100-position}% enhanced`} onChange={(e) => setPosition(Number(e.target.value))} onKeyDown={(e) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) e.stopPropagation(); }} />
        </>}
      </div>
      {original && enhanced && <div className="comparison-presets" aria-label="Photo comparison views"><button onClick={() => setPosition(100)}>Full original</button><button onClick={() => setPosition(50)}>Half and half</button><button onClick={() => setPosition(0)}>Full enhanced</button></div>}
    </> : <div className="comparison-side-by-side"><figure><img src={originalUrl} alt="Original photograph" onLoad={load(setOriginal)} onError={() => setOriginalFailed(true)} /><figcaption>Original</figcaption></figure><figure><img src={enhancedUrl} alt="Enhanced photograph" onLoad={load(setEnhanced)} onError={() => setEnhancedFailed(true)} /><figcaption>Enhanced</figcaption></figure></div>}
    <p className="comparison-caption">{pair?.caption || caption}</p>
    {!aligned && !enhancedFailed && <small>The versions use different framing, so they are shown side by side.</small>}
    {pair && <details className="comparison-provenance"><summary>About this enhancement</summary><p>{pair.origin === "prepared" ? "Prepared before this session." : "Created during this session."} {pair.method}</p><p>The original remains the historical evidence. Enhanced details are a visual interpretation.</p></details>}
  </section>;
}
