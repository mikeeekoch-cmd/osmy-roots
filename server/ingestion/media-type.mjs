/** Media type detection by magic bytes first, extension second. No guessing beyond that. */

const EXT = {
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', json: 'application/json',
  csv: 'text/csv', tsv: 'text/tab-separated-values',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', tif: 'image/tiff', tiff: 'image/tiff',
  pdf: 'application/pdf', zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
};

export function extensionOf(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

function sniff(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b.slice(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5 || b[2] === 7)) return 'application/zip';
  if (b.length > 11 && b.slice(4, 12).toString('latin1') === 'ftypheic') return 'image/heic';
  if (b.length > 11 && b.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/** Sniffed type wins over a wrong or missing extension. */
export function detectMediaType(originalName, bytes, declared) {
  const sniffed = sniff(bytes);
  if (sniffed) {
    // A .docx/.xlsx is a zip container; keep the more specific extension type.
    if (sniffed === 'application/zip') {
      const byExt = EXT[extensionOf(originalName)];
      if (byExt && byExt !== 'application/zip') return byExt;
    }
    return sniffed;
  }
  return EXT[extensionOf(originalName)] || declared || 'application/octet-stream';
}

export function isImage(mediaType) { return String(mediaType || '').startsWith('image/'); }
export function isAudioOrVideo(mediaType) {
  const t = String(mediaType || '');
  return t.startsWith('audio/') || t.startsWith('video/');
}
