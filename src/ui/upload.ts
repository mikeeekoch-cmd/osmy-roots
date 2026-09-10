import { UPLOAD_LIMITS } from "../../packages/contracts/round2";
export { UPLOAD_LIMITS };
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
export function uploadIssue(
  files: ReadonlyArray<{ name: string; size: number }>,
): string | null {
  if (files.length > UPLOAD_LIMITS.maxFiles)
    return `Choose up to ${UPLOAD_LIMITS.maxFiles} files. Remove ${files.length - UPLOAD_LIMITS.maxFiles} to continue.`;
  const large = files.find((f) => f.size > UPLOAD_LIMITS.maxFileBytes);
  if (large)
    return `${large.name} is ${formatBytes(large.size)}. Choose a copy under ${formatBytes(UPLOAD_LIMITS.maxFileBytes)} or remove this file.`;
  const empty = files.find((f) => f.size === 0);
  if (empty)
    return `${empty.name} is empty. Choose a readable copy or remove this file.`;
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > UPLOAD_LIMITS.maxTotalBytes)
    return `Your selection is ${formatBytes(total)}. Remove files to stay within ${formatBytes(UPLOAD_LIMITS.maxTotalBytes)}.`;
  return null;
}
