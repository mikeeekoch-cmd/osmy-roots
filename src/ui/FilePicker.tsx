import { formatBytes, uploadIssue, UPLOAD_LIMITS } from "./upload";
import { useEffect, useRef, useState } from "react";

function Thumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? (
    <img src={url} alt={file.name} />
  ) : (
    <span className="file-icon" aria-hidden="true">
      ▤
    </span>
  );
}
export function FilePicker({
  files,
  onChange,
  compact = false,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const add = (incoming: FileList | null) => {
    if (!incoming || disabled) return;
    const unique = new Map(
      files.map((f) => [`${f.name}:${f.size}:${f.lastModified}`, f]),
    );
    Array.from(incoming).forEach((f) =>
      unique.set(`${f.name}:${f.size}:${f.lastModified}`, f),
    );
    onChange([...unique.values()]);
  };
  return (
    <div className="file-picker">
      <div
        className={`drop-zone ${over ? "drag-over" : ""} ${compact ? "compact" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <span className="upload-mark" aria-hidden="true">
          ↑
        </span>
        <strong>
          {compact
            ? "Add another source"
            : "Every family has a starting point."}
        </strong>
        <p>
          Drop your files here, or{" "}
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            browse files
          </button>
        </p>
        <input
          ref={input}
          type="file"
          multiple
          aria-label="Choose family files"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
          disabled={disabled}
        />
        {!compact && (
          <small>
            Family records, documents, photos and exported chats. Originals stay
            linked to their sources.
          </small>
        )}
      </div>
      {!compact && (
        <small className="upload-limits">
          Up to {UPLOAD_LIMITS.maxFiles} files ·{" "}
          {formatBytes(UPLOAD_LIMITS.maxTotalBytes)} total ·{" "}
          {formatBytes(UPLOAD_LIMITS.maxFileBytes)} per file
        </small>
      )}
      {uploadIssue(files) && (
        <p className="error upload-issue" role="alert">
          {uploadIssue(files)}
        </p>
      )}
      {files.length > 0 && (
        <p className="file-total" role="status">
          {files.length} {files.length === 1 ? "file" : "files"} selected ·{" "}
          {formatBytes(files.reduce((total, file) => total + file.size, 0))}{" "}
          total
        </p>
      )}
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file, i) => (
            <li key={`${file.name}:${file.size}:${file.lastModified}`}>
              <Thumbnail file={file} />
              <div>
                <strong>{file.name}</strong>
                <small>{formatBytes(file.size)} · Ready to upload</small>
              </div>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() =>
                  onChange(files.filter((_, index) => index !== i))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
