import { createHash } from 'node:crypto';

/** sha256 of original bytes. Used for dedup and export integrity checks. */
export function sha256(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash('sha256').update(buf).digest('hex');
}

/** Short, stable, filesystem-safe token derived from a full hash. */
export function shortHash(hex, len = 12) {
  return String(hex).slice(0, len);
}
