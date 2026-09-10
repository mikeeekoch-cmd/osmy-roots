import { useEffect, useRef, useState } from "react";
import { UPLOAD_LIMITS } from "../../packages/contracts/round2";

export const fileSize = (bytes: number) => bytes < 1000 * 1000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / (1000 * 1000)).toFixed(bytes % (1000 * 1000) ? 1 : 0)} MB`;
export function validateFiles(files: Pick<File, "name" | "size">[]): string | null {
  if (files.length > UPLOAD_LIMITS.maxFiles) return `You selected ${files.length} files. Remove ${files.length - UPLOAD_LIMITS.maxFiles} to stay within the ${UPLOAD_LIMITS.maxFiles}-file limit.`;
  const large = files.find((f) => f.size > UPLOAD_LIMITS.maxFileBytes);
  if (large) return `${large.name} is ${fileSize(large.size)}. Each file must be ${fileSize(UPLOAD_LIMITS.maxFileBytes)} or smaller.`;
  const empty = files.find((f) => f.size === 0);
  if (empty) return `${empty.name} is empty. Choose a readable copy or remove this file.`;
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > UPLOAD_LIMITS.maxTotalBytes) return `Selected files total ${fileSize(total)}. Remove files to stay within ${fileSize(UPLOAD_LIMITS.maxTotalBytes)}.`;
  return null;
}
function Thumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? <img src={url} alt={file.name} /> : <span className="file-icon" aria-hidden="true">▤</span>;
}
export function FilePicker({ files, onChange, compact = false, disabled = false, savedProject = false }: {
  files: File[]; onChange: (files: File[]) => void; compact?: boolean; disabled?: boolean; savedProject?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const issue = validateFiles(files);
  const add = (incoming: FileList | null) => {
    if (!incoming || disabled) return;
    const unique = new Map(files.map((f) => [`${f.name}:${f.size}:${f.lastModified}`, f]));
    Array.from(incoming).forEach((f) => unique.set(`${f.name}:${f.size}:${f.lastModified}`, f));
    onChange([...unique.values()]);
  };
  return <div className="file-picker">
    <div className={`drop-zone ${over ? "drag-over" : ""} ${compact ? "compact" : ""}`} onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
      <span className="upload-mark" aria-hidden="true">↑</span>
      <strong>{compact ? "Add another source" : savedProject ? "Continue your family project." : "Every family has a starting point."}</strong>
      <p>Drop your files here, or <button type="button" className="text-button" disabled={disabled} onClick={() => input.current?.click()}>browse files</button></p>
      <input ref={input} type="file" multiple accept={savedProject ? undefined : ".pdf,.csv,.txt,.zip,.jpg,.jpeg,.png,.webp,.gif"} aria-label={savedProject ? "Choose saved project files" : "Choose family files"} onChange={(e) => { add(e.target.files); e.target.value = ""; }} disabled={disabled} />
      {!compact && <small>{savedProject ? "Saved project JSON and its original files" : "PDF, CSV, TXT, photographs and supported chat ZIPs"}<br />{fileSize(UPLOAD_LIMITS.maxTotalBytes)} total · {fileSize(UPLOAD_LIMITS.maxFileBytes)} per file · {UPLOAD_LIMITS.maxFiles} files</small>}
    </div>
    {files.length > 0 && <>
      <div className="file-summary" aria-live="polite"><strong>{files.length} {files.length === 1 ? "file" : "files"} selected</strong><span>{fileSize(files.reduce((sum, f) => sum + f.size, 0))} total</span></div>
      {issue && <p className="error file-preflight" role="alert">{issue}</p>}
      <ul className="file-list">{files.map((file, i) => <li key={`${file.name}:${file.size}:${file.lastModified}`} className={file.size > UPLOAD_LIMITS.maxFileBytes ? "file-invalid" : ""}>
        <Thumbnail file={file} /><div><strong>{file.name}</strong><small>{fileSize(file.size)} · Selected</small></div>
        <button type="button" aria-label={`Remove ${file.name}`} disabled={disabled} onClick={() => onChange(files.filter((_, index) => index !== i))}>×</button>
      </li>)}</ul>
    </>}
  </div>;
}
