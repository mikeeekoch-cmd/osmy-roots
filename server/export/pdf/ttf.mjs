/**
 * Minimal TrueType reader for PDF embedding.
 *
 * We embed the full font as a CIDFontType2 with Identity-H encoding and an
 * Identity CIDToGIDMap, so a CID is a glyph id and no subsetting is required.
 * That keeps Cyrillic, and any other script the font covers, intact in the book.
 */

import fs from 'node:fs';

const tag = (buf, off) => buf.toString('latin1', off, off + 4);

function readTables(buf) {
  const sfnt = buf.readUInt32BE(0);
  if (sfnt === 0x74746366) throw new Error('TrueType Collection (.ttc) is not supported; supply a .ttf');
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i += 1) {
    const rec = 12 + i * 16;
    tables[tag(buf, rec)] = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
  }
  return tables;
}

/** cmap format 4: the standard BMP mapping. */
function parseCmap4(buf, off) {
  const map = new Map();
  const segCountX2 = buf.readUInt16BE(off + 6);
  const segCount = segCountX2 / 2;
  const endBase = off + 14;
  const startBase = endBase + segCountX2 + 2;
  const deltaBase = startBase + segCountX2;
  const rangeBase = deltaBase + segCountX2;

  for (let s = 0; s < segCount; s += 1) {
    const end = buf.readUInt16BE(endBase + s * 2);
    const start = buf.readUInt16BE(startBase + s * 2);
    const delta = buf.readInt16BE(deltaBase + s * 2);
    const rangeOffset = buf.readUInt16BE(rangeBase + s * 2);
    if (start === 0xffff) continue;
    for (let c = start; c <= end && c !== 0x10000; c += 1) {
      let gid;
      if (rangeOffset === 0) {
        gid = (c + delta) & 0xffff;
      } else {
        const gi = rangeBase + s * 2 + rangeOffset + (c - start) * 2;
        if (gi + 1 >= buf.length) continue;
        gid = buf.readUInt16BE(gi);
        if (gid !== 0) gid = (gid + delta) & 0xffff;
      }
      if (gid) map.set(c, gid);
    }
  }
  return map;
}

/** cmap format 12: full Unicode range. */
function parseCmap12(buf, off) {
  const map = new Map();
  const nGroups = buf.readUInt32BE(off + 12);
  for (let g = 0; g < nGroups; g += 1) {
    const rec = off + 16 + g * 12;
    const start = buf.readUInt32BE(rec);
    const end = buf.readUInt32BE(rec + 4);
    const startGid = buf.readUInt32BE(rec + 8);
    // Guard against pathological fonts declaring enormous ranges.
    const span = Math.min(end - start, 0x10000);
    for (let i = 0; i <= span; i += 1) map.set(start + i, startGid + i);
  }
  return map;
}

function parseCmap(buf, table) {
  const base = table.offset;
  const n = buf.readUInt16BE(base + 2);
  let best = null;
  for (let i = 0; i < n; i += 1) {
    const rec = base + 4 + i * 8;
    const platform = buf.readUInt16BE(rec);
    const encoding = buf.readUInt16BE(rec + 2);
    const offset = base + buf.readUInt32BE(rec + 4);
    const format = buf.readUInt16BE(offset);
    let rank = -1;
    if (platform === 3 && encoding === 10 && format === 12) rank = 4;
    else if (platform === 0 && format === 12) rank = 3;
    else if (platform === 3 && encoding === 1 && format === 4) rank = 2;
    else if (platform === 0 && format === 4) rank = 1;
    if (rank > (best?.rank ?? -1)) best = { rank, offset, format };
  }
  if (!best) throw new Error('No usable cmap subtable (need format 4 or 12)');
  return best.format === 12 ? parseCmap12(buf, best.offset) : parseCmap4(buf, best.offset);
}

/**
 * @param {string} filePath path to a .ttf
 * @returns {object} font record used by the PDF document writer
 */
export function loadTrueType(filePath) {
  const buf = fs.readFileSync(filePath);
  const tables = readTables(buf);
  for (const req of ['head', 'hhea', 'maxp', 'hmtx', 'cmap']) {
    if (!tables[req]) throw new Error(`Font ${filePath} is missing required table ${req}`);
  }

  const head = tables.head.offset;
  const unitsPerEm = buf.readUInt16BE(head + 18) || 1000;
  const xMin = buf.readInt16BE(head + 36);
  const yMin = buf.readInt16BE(head + 38);
  const xMax = buf.readInt16BE(head + 40);
  const yMax = buf.readInt16BE(head + 42);

  const hhea = tables.hhea.offset;
  const ascender = buf.readInt16BE(hhea + 4);
  const descender = buf.readInt16BE(hhea + 6);
  const numberOfHMetrics = buf.readUInt16BE(hhea + 34);

  const numGlyphs = buf.readUInt16BE(tables.maxp.offset + 4);

  // Advance widths, in font units.
  const hmtx = tables.hmtx.offset;
  const advances = new Uint16Array(numGlyphs);
  let last = 0;
  for (let g = 0; g < numGlyphs; g += 1) {
    if (g < numberOfHMetrics) {
      const o = hmtx + g * 4;
      last = o + 1 < buf.length ? buf.readUInt16BE(o) : last;
    }
    advances[g] = last;
  }

  const cmap = parseCmap(buf, tables.cmap);

  // Embedding permission lives in OS/2 fsType.
  let fsType = 0;
  let capHeight = Math.round(yMax * 0.7);
  if (tables['OS/2']) {
    const os2 = tables['OS/2'].offset;
    fsType = buf.readUInt16BE(os2 + 8);
    const version = buf.readUInt16BE(os2);
    if (version >= 2 && os2 + 90 < buf.length) {
      const ch = buf.readInt16BE(os2 + 88);
      if (ch) capHeight = ch;
    }
  }
  const italicAngle = tables.post ? buf.readInt32BE(tables.post.offset + 4) / 65536 : 0;

  const scale = 1000 / unitsPerEm;
  const name = filePath.split('/').pop().replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]/g, '');

  return {
    name: name || 'EmbeddedFont',
    bytes: buf,
    unitsPerEm,
    numGlyphs,
    cmap,
    advances,
    fsType,
    // Bit 1 set (and not bits 2/3) means the vendor forbids embedding.
    embeddingRestricted: (fsType & 0x0002) !== 0 && (fsType & 0x0004) === 0 && (fsType & 0x0008) === 0,
    italicAngle,
    ascent: Math.round(ascender * scale),
    descent: Math.round(descender * scale),
    capHeight: Math.round(capHeight * scale),
    bbox: [Math.round(xMin * scale), Math.round(yMin * scale), Math.round(xMax * scale), Math.round(yMax * scale)],
    /** Glyph id for a code point, 0 (notdef) when the font has no glyph. */
    gidFor(codePoint) { return this.cmap.get(codePoint) || 0; },
    /** Advance width in 1/1000 em, matching PDF text space. */
    widthOf(gid) { return Math.round((this.advances[gid] || 0) * (1000 / this.unitsPerEm)); },
    covers(text) {
      for (const ch of String(text)) if (!this.cmap.get(ch.codePointAt(0))) return false;
      return true;
    },
  };
}

/**
 * Pick the first candidate font that exists, parses and permits embedding.
 * @param {string[]} candidates
 * @param {string} [mustCover] sample text the font has to support
 */
export function selectFont(candidates, mustCover = '') {
  const tried = [];
  for (const path of candidates) {
    try {
      if (!fs.existsSync(path)) { tried.push(`${path}: not present`); continue; }
      const font = loadTrueType(path);
      if (font.embeddingRestricted) { tried.push(`${path}: fsType ${font.fsType} forbids embedding`); continue; }
      if (mustCover && !font.covers(mustCover)) { tried.push(`${path}: does not cover required characters`); continue; }
      return { font, path, tried };
    } catch (e) {
      tried.push(`${path}: ${e.message}`);
    }
  }
  return { font: null, path: null, tried };
}
