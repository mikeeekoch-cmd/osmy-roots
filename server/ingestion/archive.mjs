/**
 * Bounded ZIP reader for supplied chat archives.
 *
 * An uploaded archive is untrusted input. Every limit below is enforced here rather
 * than left to the caller, and a refusal is always explicit:
 *   - absolute paths, `..` traversal and drive letters are rejected
 *   - symlinks and any entry with an executable mode bit are rejected
 *   - nested archives are never expanded (stored, reported, not opened)
 *   - encrypted entries and compression methods other than store/deflate are rejected
 *   - at most 200 entries and 100 MB expanded per run, with a compression-ratio bound
 *
 * Reading stops at the first violation so a malicious archive cannot exhaust memory.
 */

import { inflateRawSync } from 'node:zlib';
import { sha256 } from './hash.mjs';

export const ARCHIVE_LIMITS = Object.freeze({
  maxEntries: 200,
  maxExpandedBytes: 100 * 1024 * 1024,
  maxEntryBytes: 25 * 1024 * 1024,
  maxCompressionRatio: 200,
});

/** Upload policy shared with the lead's route layer. */
export const UPLOAD_POLICY = Object.freeze({
  maxTotalBytes: 100 * 1024 * 1024,
  maxFileBytes: 25 * 1024 * 1024,
  maxFiles: 40,
});

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const NESTED_ARCHIVE = /\.(zip|tar|gz|tgz|7z|rar|bz2|xz)$/i;
const EXECUTABLE_EXT = /\.(exe|dll|so|dylib|sh|bash|zsh|bat|cmd|com|scr|ps1|app|jar|msi|deb|pkg)$/i;

export class ArchiveError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ArchiveError';
    this.code = code;
  }
}

/** Reject anything that could escape the extraction root. */
export function unsafePathReason(name) {
  const raw = String(name || '');
  if (!raw) return 'empty entry name';
  if (raw.startsWith('/') || raw.startsWith('\\')) return 'absolute path';
  if (/^[A-Za-z]:[\\/]/.test(raw)) return 'drive-letter path';
  if (raw.includes('\0')) return 'null byte in name';
  const parts = raw.replace(/\\/g, '/').split('/');
  if (parts.some((p) => p === '..')) return 'parent-directory traversal';
  return null;
}

function findEocd(buf) {
  const min = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

/**
 * List and optionally extract entries.
 *
 * @param {Buffer} bytes
 * @param {object} [options]
 * @param {number} [options.budgetBytes] remaining expanded-byte budget for this run
 * @returns {{entries: Array, warnings: string[], expandedBytes: number}}
 */
export function readArchive(bytes, options = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const limits = { ...ARCHIVE_LIMITS, ...(options.limits || {}) };
  let budget = options.budgetBytes == null ? limits.maxExpandedBytes : options.budgetBytes;
  const warnings = [];

  if (buf.length < 22) throw new ArchiveError('MALFORMED', 'Archive is too small to be a ZIP.');
  const eocd = findEocd(buf);
  if (eocd === -1) throw new ArchiveError('MALFORMED', 'No end-of-central-directory record: not a readable ZIP.');

  // Zip64 is refused rather than partially supported.
  for (let i = Math.max(0, eocd - 20); i < eocd; i += 1) {
    if (buf.readUInt32LE(i) === SIG_EOCD64_LOCATOR) {
      throw new ArchiveError('UNSUPPORTED', 'Zip64 archives are not supported by this parser.');
    }
  }

  const count = buf.readUInt16LE(eocd + 8);
  if (count > limits.maxEntries) {
    throw new ArchiveError('TOO_MANY_ENTRIES', `Archive declares ${count} entries; the limit is ${limits.maxEntries}.`);
  }

  let p = buf.readUInt32LE(eocd + 16);
  if (p === 0xffffffff) throw new ArchiveError('UNSUPPORTED', 'Zip64 central directory offset is not supported.');

  const entries = [];
  let expandedBytes = 0;

  for (let i = 0; i < count; i += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CENTRAL) {
      throw new ArchiveError('MALFORMED', `Central directory entry ${i + 1} is malformed.`);
    }
    const versionMadeBy = buf.readUInt16LE(p + 4);
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const rawSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttrs = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x0001) throw new ArchiveError('ENCRYPTED', `Entry "${name}" is encrypted; encrypted archives are refused.`);
    if (compSize === 0xffffffff || rawSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new ArchiveError('UNSUPPORTED', `Entry "${name}" needs Zip64 fields.`);
    }

    const unsafe = unsafePathReason(name);
    if (unsafe) throw new ArchiveError('UNSAFE_PATH', `Entry "${name}" rejected: ${unsafe}.`);

    const isDirectory = name.endsWith('/') || name.endsWith('\\');
    // Unix host: the high 16 bits of external attributes carry st_mode.
    const hostSystem = versionMadeBy >> 8;
    const mode = hostSystem === 3 ? (externalAttrs >>> 16) & 0xffff : 0;
    if (mode && (mode & 0xf000) === 0xa000) {
      throw new ArchiveError('SYMLINK', `Entry "${name}" is a symlink; symlinks are refused.`);
    }
    if (mode && (mode & 0o111)) {
      throw new ArchiveError('EXECUTABLE', `Entry "${name}" has an executable mode bit; executable content is refused.`);
    }
    if (!isDirectory && EXECUTABLE_EXT.test(name)) {
      throw new ArchiveError('EXECUTABLE', `Entry "${name}" looks like executable content and is refused.`);
    }

    if (isDirectory) {
      entries.push({ name, isDirectory: true, byteLength: 0, contentHash: null, status: 'skipped', reason: 'directory' });
      continue;
    }

    // Nested archives are recorded but never opened.
    if (NESTED_ARCHIVE.test(name)) {
      entries.push({
        name, isDirectory: false, byteLength: rawSize, contentHash: null,
        status: 'stored_only', reason: 'Nested archive is not expanded.',
      });
      warnings.push(`"${name}" is a nested archive; it was listed but not expanded.`);
      continue;
    }

    if (method !== 0 && method !== 8) {
      throw new ArchiveError('UNSUPPORTED_METHOD', `Entry "${name}" uses compression method ${method}; only store and deflate are supported.`);
    }
    if (rawSize > limits.maxEntryBytes) {
      throw new ArchiveError('ENTRY_TOO_LARGE', `Entry "${name}" expands to ${rawSize} bytes; the per-entry limit is ${limits.maxEntryBytes}.`);
    }
    if (compSize > 0 && rawSize / compSize > limits.maxCompressionRatio) {
      throw new ArchiveError('COMPRESSION_RATIO', `Entry "${name}" has a compression ratio of ${Math.round(rawSize / compSize)}:1, above the ${limits.maxCompressionRatio}:1 bound.`);
    }
    if (rawSize > budget) {
      throw new ArchiveError('BUDGET_EXCEEDED', `Expanding "${name}" would exceed the ${limits.maxExpandedBytes}-byte budget for this run.`);
    }

    // Read the local header to find the data, then decompress within the budget.
    if (localOffset + 30 > buf.length) throw new ArchiveError('MALFORMED', `Entry "${name}" has an out-of-range local header.`);
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    if (dataStart + compSize > buf.length) throw new ArchiveError('MALFORMED', `Entry "${name}" data runs past the end of the archive.`);
    const comp = buf.subarray(dataStart, dataStart + compSize);

    let data;
    try {
      data = method === 0 ? Buffer.from(comp) : inflateRawSync(comp, { maxOutputLength: Math.min(budget, limits.maxEntryBytes) + 1 });
    } catch (e) {
      throw new ArchiveError('MALFORMED', `Entry "${name}" could not be decompressed: ${e.message}`);
    }
    if (data.length > limits.maxEntryBytes || data.length > budget) {
      throw new ArchiveError('BUDGET_EXCEEDED', `Entry "${name}" expanded beyond the allowed budget.`);
    }
    if (rawSize !== data.length) {
      warnings.push(`"${name}" declared ${rawSize} bytes but expanded to ${data.length}.`);
    }

    budget -= data.length;
    expandedBytes += data.length;
    entries.push({
      name, isDirectory: false, byteLength: data.length, contentHash: sha256(data),
      declaredCrc32: crc, status: 'extracted', bytes: data,
    });
  }

  return { entries, warnings, expandedBytes, entryCount: entries.length };
}
