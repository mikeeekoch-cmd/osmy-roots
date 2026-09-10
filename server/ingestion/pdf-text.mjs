/**
 * PDF text extraction, dependency-free.
 *
 * Parses indirect objects (including objects inside /Type /ObjStm streams),
 * walks the page tree, decodes each page's content stream and pulls text from
 * the text-showing operators, mapping character codes through /ToUnicode when
 * the font supplies it.
 *
 * If extraction yields nothing usable the caller is told so explicitly. We never
 * report "PDF parsed" for a scanned or otherwise text-free page; that case needs
 * a hash-bound sidecar, labelled as a prepared extraction.
 */

import { inflateSync, unzipSync, inflateRawSync } from 'node:zlib';

const WINANSI_EXTRA = {
  128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†',
  135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ',
  142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•',
  150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›',
  156: 'œ', 158: 'ž', 159: 'Ÿ',
};

function decodeStream(dict, raw) {
  const filter = /\/Filter\s*\/(\w+)/.exec(dict);
  const filterArray = /\/Filter\s*\[([^\]]*)\]/.exec(dict);
  const names = filterArray
    ? filterArray[1].split('/').map((s) => s.trim()).filter(Boolean)
    : filter ? [filter[1]] : [];
  let data = raw;
  for (const name of names) {
    try {
      if (name === 'FlateDecode') {
        try { data = inflateSync(data); } catch { try { data = unzipSync(data); } catch { data = inflateRawSync(data); } }
      } else if (name === 'ASCIIHexDecode') {
        const hex = data.toString('latin1').replace(/[^0-9a-fA-F]/g, '');
        data = Buffer.from(hex.slice(0, hex.length - (hex.length % 2)), 'hex');
      } else if (name === 'ASCII85Decode') {
        data = ascii85(data.toString('latin1'));
      } else {
        return { data: null, unsupported: name };
      }
    } catch (e) {
      return { data: null, error: `${name}: ${e.message}` };
    }
  }
  // PNG predictors on a text stream are rare; applied only when declared.
  const pred = /\/Predictor\s+(\d+)/.exec(dict);
  if (pred && Number(pred[1]) >= 10 && data) {
    const colsM = /\/Columns\s+(\d+)/.exec(dict);
    data = undoPngPredictor(data, colsM ? Number(colsM[1]) : 1);
  }
  return { data };
}

function undoPngPredictor(data, columns) {
  const rowLen = columns + 1;
  const out = [];
  let prev = Buffer.alloc(columns);
  for (let i = 0; i + rowLen <= data.length; i += rowLen) {
    const ft = data[i];
    const row = Buffer.from(data.subarray(i + 1, i + rowLen));
    for (let x = 0; x < columns; x += 1) {
      const a = x >= 1 ? row[x - 1] : 0;
      const b = prev[x];
      if (ft === 1) row[x] = (row[x] + a) & 0xff;
      else if (ft === 2) row[x] = (row[x] + b) & 0xff;
      else if (ft === 3) row[x] = (row[x] + ((a + b) >> 1)) & 0xff;
      else if (ft === 4) {
        const c = x >= 1 ? prev[x - 1] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        row[x] = (row[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }
    out.push(row); prev = row;
  }
  return Buffer.concat(out);
}

function ascii85(s) {
  const body = s.replace(/^<~/, '').replace(/~>[\s\S]*$/, '').replace(/\s+/g, '');
  const out = [];
  let tuple = []; 
  for (const ch of body) {
    if (ch === 'z' && tuple.length === 0) { out.push(0, 0, 0, 0); continue; }
    tuple.push(ch.charCodeAt(0) - 33);
    if (tuple.length === 5) {
      let v = 0; for (const t of tuple) v = v * 85 + t;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      tuple = [];
    }
  }
  if (tuple.length) {
    const n = tuple.length;
    for (let i = n; i < 5; i += 1) tuple.push(84);
    let v = 0; for (const t of tuple) v = v * 85 + t;
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n - 1));
  }
  return Buffer.from(out);
}

/** Scan for `N 0 obj … endobj`, then expand any object streams. */
function collectObjects(buf) {
  const objects = new Map();
  const text = buf.toString('latin1');
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(text))) {
    const num = Number(m[1]);
    const start = m.index + m[0].length;
    const endIdx = text.indexOf('endobj', start);
    if (endIdx === -1) continue;
    const body = text.slice(start, endIdx);
    const sIdx = body.indexOf('stream');
    let dict = body;
    let stream = null;
    if (sIdx !== -1) {
      dict = body.slice(0, sIdx);
      let dataStart = start + sIdx + 'stream'.length;
      if (text[dataStart] === '\r') dataStart += 1;
      if (text[dataStart] === '\n') dataStart += 1;
      const lenM = /\/Length\s+(\d+)/.exec(dict);
      let dataEnd;
      if (lenM) dataEnd = dataStart + Number(lenM[1]);
      else {
        const e = text.indexOf('endstream', dataStart);
        dataEnd = e === -1 ? dataStart : e;
      }
      if (dataEnd > buf.length || dataEnd <= dataStart) {
        const e = text.indexOf('endstream', dataStart);
        dataEnd = e === -1 ? buf.length : e;
      }
      stream = buf.subarray(dataStart, dataEnd);
      // Never scan inside binary stream payloads: an embedded font can contain
      // bytes that look like "12 0 obj" and would otherwise shadow a real object.
      re.lastIndex = Math.max(re.lastIndex, dataEnd);
    }
    if (!objects.has(num)) objects.set(num, { dict, stream });
  }

  // Objects packed inside /Type /ObjStm.
  for (const [, obj] of [...objects]) {
    if (!obj.stream || !/\/Type\s*\/ObjStm/.test(obj.dict)) continue;
    const { data } = decodeStream(obj.dict, obj.stream);
    if (!data) continue;
    const nM = /\/N\s+(\d+)/.exec(obj.dict);
    const firstM = /\/First\s+(\d+)/.exec(obj.dict);
    if (!nM || !firstM) continue;
    const n = Number(nM[1]);
    const first = Number(firstM[1]);
    const header = data.subarray(0, first).toString('latin1').trim().split(/\s+/).map(Number);
    const body = data.subarray(first).toString('latin1');
    for (let i = 0; i < n; i += 1) {
      const num = header[i * 2];
      const off = header[i * 2 + 1];
      if (!Number.isFinite(num) || !Number.isFinite(off)) continue;
      const next = i + 1 < n ? header[(i + 1) * 2 + 1] : body.length;
      if (!objects.has(num)) objects.set(num, { dict: body.slice(off, next), stream: null });
    }
  }
  return objects;
}

const refOf = (s) => { const m = /(\d+)\s+\d+\s+R/.exec(s || ''); return m ? Number(m[1]) : null; };

/** /ToUnicode CMap: bfchar and bfrange entries. */
function parseToUnicode(text) {
  const map = new Map();
  const hexToStr = (h) => {
    const clean = h.replace(/[^0-9a-fA-F]/g, '');
    let out = '';
    for (let i = 0; i + 3 < clean.length + 1; i += 4) {
      const cp = parseInt(clean.slice(i, i + 4), 16);
      if (Number.isFinite(cp)) out += String.fromCharCode(cp);
    }
    return out;
  };
  for (const block of text.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      map.set(parseInt(m[1], 16), hexToStr(m[2]));
    }
  }
  for (const block of text.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const lo = parseInt(m[1], 16); const hi = parseInt(m[2], 16);
      const base = parseInt(m[3], 16);
      for (let c = lo; c <= hi && c - lo < 65536; c += 1) map.set(c, String.fromCharCode(base + (c - lo)));
    }
    for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g)) {
      const lo = parseInt(m[1], 16);
      const items = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => hexToStr(x[1]));
      items.forEach((s, i) => map.set(lo + i, s));
    }
  }
  return map;
}

/** Split a content stream into text runs, honouring the active font's cmap. */
function extractFromContent(content, fontCmaps, fontRefs) {
  const src = content.toString('latin1');
  let out = '';
  let activeCmap = null;
  let i = 0;

  const decodeLiteral = (raw) => {
    let s = '';
    for (let k = 0; k < raw.length; k += 1) {
      const c = raw[k];
      if (c === '\\') {
        const n = raw[k + 1];
        if (n === undefined) break;
        if (n === 'n') { s += '\n'; k += 1; }
        else if (n === 'r') { s += '\r'; k += 1; }
        else if (n === 't') { s += '\t'; k += 1; }
        else if (n === 'b') { s += '\b'; k += 1; }
        else if (n === 'f') { s += '\f'; k += 1; }
        else if (n === '\n') { k += 1; }
        else if (/[0-7]/.test(n)) {
          let oct = '';
          let j = k + 1;
          while (j < raw.length && /[0-7]/.test(raw[j]) && oct.length < 3) { oct += raw[j]; j += 1; }
          s += String.fromCharCode(parseInt(oct, 8)); k = j - 1;
        } else { s += n; k += 1; }
      } else s += c;
    }
    return s;
  };

  const mapCodes = (s, cmap) => {
    if (!cmap || !cmap.size) {
      let t = '';
      for (const ch of s) {
        const c = ch.charCodeAt(0);
        t += WINANSI_EXTRA[c] || ch;
      }
      return t;
    }
    // With a cmap present, codes are usually 2 bytes (Identity-H).
    let t = '';
    const twoByte = [...cmap.keys()].some((k) => k > 0xff);
    if (twoByte) {
      for (let k = 0; k + 1 < s.length; k += 2) {
        const code = (s.charCodeAt(k) << 8) | s.charCodeAt(k + 1);
        t += cmap.has(code) ? cmap.get(code) : '';
      }
    } else {
      for (const ch of s) {
        const code = ch.charCodeAt(0);
        t += cmap.has(code) ? cmap.get(code) : (WINANSI_EXTRA[code] || ch);
      }
    }
    return t;
  };

  const pending = [];
  while (i < src.length) {
    const ch = src[i];
    if (ch === '(') {
      let depth = 1; let j = i + 1; let raw = '';
      while (j < src.length && depth > 0) {
        if (src[j] === '\\') { raw += src[j] + (src[j + 1] || ''); j += 2; continue; }
        if (src[j] === '(') depth += 1;
        if (src[j] === ')') { depth -= 1; if (!depth) break; }
        raw += src[j]; j += 1;
      }
      pending.push({ type: 'str', value: decodeLiteral(raw) });
      i = j + 1; continue;
    }
    if (ch === '<' && src[i + 1] !== '<') {
      const end = src.indexOf('>', i);
      if (end === -1) break;
      const hex = src.slice(i + 1, end).replace(/[^0-9a-fA-F]/g, '');
      let s = '';
      const padded = hex.length % 2 ? `${hex}0` : hex;
      for (let k = 0; k < padded.length; k += 2) s += String.fromCharCode(parseInt(padded.slice(k, k + 2), 16));
      pending.push({ type: 'str', value: s });
      i = end + 1; continue;
    }
    if (ch === '/') {
      const m = /^\/([^\s/[\]()<>]+)/.exec(src.slice(i));
      if (m) { pending.push({ type: 'name', value: m[1] }); i += m[0].length; continue; }
    }
    const opM = /^(TJ|Tj|T\*|Td|TD|Tf|'|"|ET|BT|Tw|TL)\b/.exec(src.slice(i));
    if (opM) {
      const op = opM[1];
      if (op === 'Tf') {
        const name = [...pending].reverse().find((p) => p.type === 'name');
        if (name) {
          const ref = fontRefs.get(name.value);
          activeCmap = ref != null ? fontCmaps.get(ref) || null : null;
        }
      } else if (op === 'Tj' || op === "'" || op === '"') {
        const s = [...pending].reverse().find((p) => p.type === 'str');
        if (s) out += mapCodes(s.value, activeCmap);
        if (op !== 'Tj') out += '\n';
      } else if (op === 'TJ') {
        for (const p of pending) if (p.type === 'str') out += mapCodes(p.value, activeCmap);
      } else if (op === 'T*' || op === 'Td' || op === 'TD') {
        if (out && !out.endsWith('\n')) out += '\n';
      }
      pending.length = 0;
      i += opM[0].length; continue;
    }
    i += 1;
  }
  return out;
}

/**
 * @param {Buffer} bytes
 * @returns {{ok:boolean, text:string, pages:number, reason?:string, warnings:string[]}}
 */
export function extractPdfText(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const warnings = [];
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return { ok: false, text: '', pages: 0, reason: 'Not a PDF file.', warnings };
  }
  if (/\/Encrypt\b/.test(buf.toString('latin1', 0, Math.min(buf.length, 4096))) || /trailer[\s\S]{0,400}\/Encrypt/.test(buf.toString('latin1'))) {
    return { ok: false, text: '', pages: 0, reason: 'PDF is encrypted; text was not extracted.', warnings };
  }

  const objects = collectObjects(buf);
  if (!objects.size) return { ok: false, text: '', pages: 0, reason: 'No PDF objects could be read.', warnings };

  // Fonts -> ToUnicode cmaps.
  const fontCmaps = new Map();
  for (const [num, obj] of objects) {
    if (!/\/Type\s*\/Font/.test(obj.dict)) continue;
    const tuM = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(obj.dict);
    if (!tuM) continue;
    const tu = objects.get(Number(tuM[1]));
    if (!tu || !tu.stream) continue;
    const { data } = decodeStream(tu.dict, tu.stream);
    if (data) fontCmaps.set(num, parseToUnicode(data.toString('latin1')));
  }

  const pages = [...objects.entries()].filter(([, o]) => /\/Type\s*\/Page\b/.test(o.dict));
  let text = '';
  let pageCount = 0;

  const collectPage = (dict) => {
    pageCount += 1;
    const fontRefs = new Map();
    const fontBlock = /\/Font\s*<<([\s\S]*?)>>/.exec(dict);
    if (fontBlock) {
      for (const m of fontBlock[1].matchAll(/\/([^\s/]+)\s+(\d+)\s+\d+\s+R/g)) fontRefs.set(m[1], Number(m[2]));
    }
    const contentRefs = [];
    const single = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(dict);
    const arr = /\/Contents\s*\[([^\]]*)\]/.exec(dict);
    if (arr) for (const m of arr[1].matchAll(/(\d+)\s+\d+\s+R/g)) contentRefs.push(Number(m[1]));
    else if (single) contentRefs.push(Number(single[1]));
    for (const ref of contentRefs) {
      const c = objects.get(ref);
      if (!c || !c.stream) continue;
      const { data, unsupported, error } = decodeStream(c.dict, c.stream);
      if (!data) { warnings.push(`Content stream ${ref} not decoded${unsupported ? ` (${unsupported})` : error ? ` (${error})` : ''}.`); continue; }
      const t = extractFromContent(data, fontCmaps, fontRefs);
      if (t.trim()) text += `${t}\n`;
    }
  };

  if (pages.length) for (const [, o] of pages) collectPage(o.dict);
  else {
    // Some producers omit an explicit page tree in the scan; fall back to every
    // stream that looks like page content.
    for (const [, o] of objects) {
      if (!o.stream) continue;
      const { data } = decodeStream(o.dict, o.stream);
      if (data && /\bBT\b[\s\S]*\bET\b/.test(data.toString('latin1'))) {
        const t = extractFromContent(data, fontCmaps, new Map());
        if (t.trim()) { text += `${t}\n`; pageCount += 1; }
      }
    }
    if (pageCount) warnings.push('No /Type /Page objects were found; text was read from content streams directly.');
  }

  const cleaned = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').split('\n').map((l) => l.trim()).join('\n').trim();
  const words = cleaned ? cleaned.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length : 0;

  if (words < 5) {
    return {
      ok: false, text: cleaned, pages: pageCount, warnings,
      reason: `Only ${words} word(s) of text were recovered. The page is probably scanned or uses an unmapped font. Supply a hash-bound text sidecar; do not report this as successful PDF extraction.`,
    };
  }
  return { ok: true, text: cleaned, pages: pageCount, words, warnings };
}
