import { inflateRawSync } from 'node:zlib';
import { crc32 } from '../export/zip.mjs';
import { decodeUtf8 } from './parse-text.mjs';

export const ZIP_LIMITS = Object.freeze({ maxEntries: 200, maxExpandedBytes: 100_000_000, maxCompressionRatio: 200 });
const blocked = /\.(zip|rar|7z|tar|gz|bz2|xz|exe|dll|so|dylib|com|bat|cmd|ps1|sh|bash|zsh|js|mjs|py|rb|pl|php|html|htm|svg|app|dmg|pkg|deb|jar|wasm)$/i;
/** Central-directory validated bounded extraction. No writes to the filesystem. */
export function readUploadZip(input, budget = { expandedBytes: 0 }) {
  const b = Buffer.from(input); let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50 && i + 22 + b.readUInt16LE(i + 20) === b.length) { eocd = i; break; }
  if (eocd < 0) throw new Error('Malformed ZIP: end directory is missing');
  const count = b.readUInt16LE(eocd + 10), size = b.readUInt32LE(eocd + 12), offset = b.readUInt32LE(eocd + 16);
  if (b.readUInt16LE(eocd + 4) || b.readUInt16LE(eocd + 6) || b.readUInt16LE(eocd + 8) !== count || count > ZIP_LIMITS.maxEntries || offset + size !== eocd) throw new Error('Unsupported multipart, ZIP64, or oversized ZIP directory');
  const entries = []; const names = new Set(); let cursor = offset; let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > eocd || b.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Malformed ZIP directory entry');
    const flags = b.readUInt16LE(cursor + 8), method = b.readUInt16LE(cursor + 10), crc = b.readUInt32LE(cursor + 16), compressed = b.readUInt32LE(cursor + 20), raw = b.readUInt32LE(cursor + 24), nl = b.readUInt16LE(cursor + 28), xl = b.readUInt16LE(cursor + 30), cl = b.readUInt16LE(cursor + 32), attrs = b.readUInt32LE(cursor + 38), local = b.readUInt32LE(cursor + 42);
    if (cursor + 46 + nl + xl + cl > eocd) throw new Error('Truncated ZIP filename');
    const name = decodeUtf8(b.subarray(cursor + 46, cursor + 46 + nl));
    if (!name || /[\u0000-\u001f\\]/.test(name) || name.startsWith('/') || /^[a-z]:/i.test(name) || name.split('/').some((p) => p === '..' || p === '.') || names.has(name)) throw new Error('Unsafe or duplicate ZIP path');
    names.add(name);
    if (((attrs >>> 16) & 0xf000) === 0xa000) throw new Error('ZIP symlinks are not supported');
    if (!name.endsWith('/') && (b.readUInt16LE(cursor + 4) >>> 8) === 3 && ((attrs >>> 16) & 0o111)) throw new Error('Executable ZIP file permissions are not supported');
    if (flags & 0x0041 || ![0, 8].includes(method) || b.readUInt16LE(cursor + 34)) throw new Error('Encrypted or unsupported ZIP entry');
    if (blocked.test(name)) throw new Error('Nested archives or executable ZIP content are not supported');
    expanded += raw;
    if (expanded + budget.expandedBytes > ZIP_LIMITS.maxExpandedBytes || (raw > 0 && raw / Math.max(1, compressed) > ZIP_LIMITS.maxCompressionRatio)) throw new Error('ZIP expansion or compression-ratio limit exceeded');
    if (local + 30 > offset || b.readUInt32LE(local) !== 0x04034b50) throw new Error('Malformed ZIP local entry');
    const localNameLength = b.readUInt16LE(local + 26), localExtraLength = b.readUInt16LE(local + 28), begin = local + 30 + localNameLength + localExtraLength;
    if (begin + compressed > offset || b.readUInt16LE(local + 6) !== flags || b.readUInt16LE(local + 8) !== method || decodeUtf8(b.subarray(local + 30, local + 30 + localNameLength)) !== name) throw new Error('ZIP local/directory mismatch');
    const payload = b.subarray(begin, begin + compressed);
    const bytes = method === 0 ? Buffer.from(payload) : inflateRawSync(payload, { maxOutputLength: Math.max(1, raw) });
    if (bytes.length !== raw || crc32(bytes) !== crc) throw new Error('ZIP entry integrity check failed');
    if (bytes.length >= 4 && (/^(PK|MZ)/.test(bytes.toString('latin1', 0, 2)) || bytes.subarray(0, 4).equals(Buffer.from([0x7f,0x45,0x4c,0x46])) || ['feedface','feedfacf','cefaedfe','cffaedfe','cafebabe'].includes(bytes.subarray(0,4).toString('hex')))) throw new Error('Nested archive or executable bytes are not supported');
    if (!name.endsWith('/')) entries.push({ name, bytes });
    cursor += 46 + nl + xl + cl;
  }
  if (cursor !== eocd) throw new Error('ZIP central directory length mismatch');
  budget.expandedBytes += expanded;
  return entries;
}

export function parseChatText(text, originalName) {
  const lines = text.split(/\r\n|\r|\n/), messages = []; let current = null;
  lines.forEach((line, i) => {
    const match = /^(?:\[([^\]]+)\]|(\d{1,4}[\/.]\d{1,2}[\/.]\d{1,4},?\s+[^-]+)\s+-)\s*([^:]+):\s*(.*)$/.exec(line);
    const undated = !match && /^([A-Za-z][A-Za-z0-9 _-]{0,60}):\s*(.*)$/.exec(line);
    if (match || undated) { current = { index: messages.length + 1, scaffoldTimestamp: match ? match[1] || match[2] : null, scaffoldSpeaker: match ? match[3] : undated[1], text: match ? match[4] : undated[2], startLine: i + 1, endLine: i + 1 }; messages.push(current); }
    else if (current) { current.text += `\n${line}`; current.endLine = i + 1; }
  });
  return messages.map((m) => ({ ...m, locator: `${originalName}#message-${m.index}:L${m.startLine}-L${m.endLine}` }));
}
