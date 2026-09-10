/**
 * Small PDF writer: pages, embedded TrueType text (Identity-H), images, vectors.
 *
 * Dependency-free. Enough to typeset a short illustrated book with Cyrillic
 * originals beside English text, and to draw a readable family branch.
 */

import { deflateSync } from 'node:zlib';
import { readImage } from './images.mjs';

const PT = 1;
export const A4 = { width: 595.28, height: 841.89 };
export const LETTER = { width: 612, height: 792 };

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** PDF text strings for Identity-H are hex-encoded 2-byte glyph ids. */
function glyphHex(font, text) {
  let out = '';
  const missing = [];
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    const gid = font.gidFor(cp);
    if (!gid && cp !== 32) missing.push(ch);
    out += gid.toString(16).padStart(4, '0');
  }
  return { hex: out, missing };
}

export class PdfDocument {
  constructor(options = {}) {
    this.size = options.size || A4;
    this.objects = [];              // 1-indexed on output
    this.pages = [];
    this.fonts = new Map();         // key -> {ref, font, name}
    this.images = new Map();        // key -> {ref, name, width, height}
    this.warnings = [];
    this.info = options.info || {};
    this._imageSeq = 0;
    this._fontSeq = 0;
  }

  _alloc(body) { this.objects.push(body); return this.objects.length; }

  /** Register an embedded TrueType font. Returns the resource name (e.g. F1). */
  addFont(key, font) {
    if (this.fonts.has(key)) return this.fonts.get(key).name;
    this._fontSeq += 1;
    const name = `F${this._fontSeq}`;
    this.fonts.set(key, { font, name, ref: null });
    return name;
  }

  fontFor(key) { return this.fonts.get(key)?.font || null; }

  /** Text width in points. */
  widthOf(key, text, size) {
    const font = this.fontFor(key);
    if (!font) return 0;
    let units = 0;
    for (const ch of String(text)) units += font.widthOf(font.gidFor(ch.codePointAt(0)));
    return (units / 1000) * size;
  }

  /** Greedy word wrap that also breaks over-long single words. */
  wrap(key, text, size, maxWidth) {
    const lines = [];
    for (const paragraph of String(text).split(/\n/)) {
      if (!paragraph.trim()) { lines.push(''); continue; }
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.widthOf(key, candidate, size) <= maxWidth) { line = candidate; continue; }
        if (line) lines.push(line);
        if (this.widthOf(key, word, size) <= maxWidth) { line = word; continue; }
        let chunk = '';
        for (const ch of word) {
          if (this.widthOf(key, chunk + ch, size) > maxWidth && chunk) { lines.push(chunk); chunk = ch; }
          else chunk += ch;
        }
        line = chunk;
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  addPage() {
    const page = { ops: [], usedFonts: new Set(), usedImages: new Set(), ...this.size };
    this.pages.push(page);
    return new PageContext(this, page);
  }

  /** Register an image once, keyed by content hash. */
  addImage(key, bytes, mediaType) {
    if (this.images.has(key)) return this.images.get(key);
    const parsed = readImage(bytes, mediaType);
    if (parsed.kind === 'unsupported') {
      this.warnings.push(`Image not embedded (${parsed.error}).`);
      return null;
    }
    this._imageSeq += 1;
    const record = { name: `Im${this._imageSeq}`, parsed, width: parsed.width, height: parsed.height, ref: null, smaskRef: null };
    this.images.set(key, record);
    return record;
  }

  toBuffer() {
    // Fonts.
    for (const entry of this.fonts.values()) {
      const f = entry.font;
      const fileRef = this._alloc({
        stream: f.bytes,
        dict: `<< /Length ${f.bytes.length} /Length1 ${f.bytes.length} >>`,
        raw: true,
      });
      const descriptorRef = this._alloc({
        dict: `<< /Type /FontDescriptor /FontName /${f.name} /Flags 32 `
          + `/FontBBox [${f.bbox.join(' ')}] /ItalicAngle ${f.italicAngle} /Ascent ${f.ascent} `
          + `/Descent ${f.descent} /CapHeight ${f.capHeight} /StemV 80 /FontFile2 ${fileRef} 0 R >>`,
      });

      // Widths for every glyph actually reachable, expressed compactly.
      const widths = [];
      const maxGid = Math.min(f.numGlyphs, 65535);
      let run = null;
      for (let gid = 0; gid < maxGid; gid += 1) {
        const w = f.widthOf(gid);
        if (w === 0) { if (run) { widths.push(`${run.start} [${run.values.join(' ')}]`); run = null; } continue; }
        if (run && run.start + run.values.length === gid) run.values.push(w);
        else { if (run) widths.push(`${run.start} [${run.values.join(' ')}]`); run = { start: gid, values: [w] }; }
      }
      if (run) widths.push(`${run.start} [${run.values.join(' ')}]`);

      const cidRef = this._alloc({
        dict: `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${f.name} `
          + `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> `
          + `/FontDescriptor ${descriptorRef} 0 R /DW 1000 /W [${widths.join(' ')}] /CIDToGIDMap /Identity >>`,
      });

      // ToUnicode keeps copy/paste and text extraction working.
      const pairs = [];
      for (const [cp, gid] of f.cmap.entries()) {
        if (cp > 0xffff) continue;
        pairs.push(`<${gid.toString(16).padStart(4, '0')}> <${cp.toString(16).padStart(4, '0')}>`);
      }
      const cmapChunks = [];
      for (let i = 0; i < pairs.length; i += 100) {
        const slice = pairs.slice(i, i + 100);
        cmapChunks.push(`${slice.length} beginbfchar\n${slice.join('\n')}\nendbfchar`);
      }
      const toUni = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${cmapChunks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
      const toUniBytes = deflateSync(Buffer.from(toUni, 'latin1'), { level: 9 });
      const toUniRef = this._alloc({ stream: toUniBytes, dict: `<< /Length ${toUniBytes.length} /Filter /FlateDecode >>`, raw: true });

      entry.ref = this._alloc({
        dict: `<< /Type /Font /Subtype /Type0 /BaseFont /${f.name} /Encoding /Identity-H `
          + `/DescendantFonts [${cidRef} 0 R] /ToUnicode ${toUniRef} 0 R >>`,
      });
    }

    // Images.
    for (const img of this.images.values()) {
      const p = img.parsed;
      if (p.smask) {
        img.smaskRef = this._alloc({
          stream: p.smask.bytes, raw: true,
          dict: `<< /Type /XObject /Subtype /Image /Width ${p.smask.width} /Height ${p.smask.height} `
            + `/ColorSpace /DeviceGray /BitsPerComponent ${p.smask.bitDepth} /Filter /FlateDecode /Length ${p.smask.bytes.length} >>`,
        });
      }
      let colorSpace;
      if (p.indexed && p.palette) {
        const pal = p.palette.toString('hex');
        colorSpace = `[/Indexed /DeviceRGB ${p.palette.length / 3 - 1} <${pal}>]`;
      } else if (p.kind === 'jpeg') {
        colorSpace = p.components === 1 ? '/DeviceGray' : p.components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
      } else {
        colorSpace = p.colors === 1 ? '/DeviceGray' : '/DeviceRGB';
      }
      const bpc = p.kind === 'jpeg' ? (p.precision || 8) : p.bitDepth;
      const parms = p.decodeParms
        ? ` /DecodeParms << /Predictor ${p.decodeParms.Predictor} /Colors ${p.decodeParms.Colors} /BitsPerComponent ${p.decodeParms.BitsPerComponent} /Columns ${p.decodeParms.Columns} >>`
        : '';
      const decode = p.kind === 'jpeg' && p.components === 4 && p.adobeInverted ? ' /Decode [1 0 1 0 1 0 1 0]' : '';
      img.ref = this._alloc({
        stream: p.bytes, raw: true,
        dict: `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace ${colorSpace} `
          + `/BitsPerComponent ${bpc} /Filter /${p.filter}${parms}${decode}`
          + `${img.smaskRef ? ` /SMask ${img.smaskRef} 0 R` : ''} /Length ${p.bytes.length} >>`,
      });
    }

    // Page content streams.
    const pageRefs = [];
    const contentRefs = [];
    for (const page of this.pages) {
      const content = Buffer.from(page.ops.join('\n'), 'latin1');
      const packed = deflateSync(content, { level: 9 });
      contentRefs.push(this._alloc({ stream: packed, raw: true, dict: `<< /Length ${packed.length} /Filter /FlateDecode >>` }));
    }

    const pagesRefPlaceholder = this.objects.length + this.pages.length + 1;
    this.pages.forEach((page, i) => {
      const fontRes = [...this.fonts.values()]
        .filter((f) => page.usedFonts.has(f.name))
        .map((f) => `/${f.name} ${f.ref} 0 R`).join(' ');
      const imgRes = [...this.images.values()]
        .filter((im) => page.usedImages.has(im.name) && im.ref)
        .map((im) => `/${im.name} ${im.ref} 0 R`).join(' ');
      pageRefs.push(this._alloc({
        dict: `<< /Type /Page /Parent ${pagesRefPlaceholder} 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] `
          + `/Resources << /ProcSet [/PDF /Text /ImageC /ImageB /ImageI]`
          + `${fontRes ? ` /Font << ${fontRes} >>` : ''}${imgRes ? ` /XObject << ${imgRes} >>` : ''} >> `
          + `/Contents ${contentRefs[i]} 0 R >>`,
      }));
    });

    const pagesRef = this._alloc({
      dict: `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((r) => `${r} 0 R`).join(' ')}] >>`,
    });
    const infoParts = [];
    if (this.info.title) infoParts.push(`/Title (${esc(this.info.title)})`);
    if (this.info.author) infoParts.push(`/Author (${esc(this.info.author)})`);
    if (this.info.subject) infoParts.push(`/Subject (${esc(this.info.subject)})`);
    infoParts.push(`/Producer (Osmy Roots prototype)`);
    const infoRef = this._alloc({ dict: `<< ${infoParts.join(' ')} >>` });
    const catalogRef = this._alloc({ dict: `<< /Type /Catalog /Pages ${pagesRef} 0 R >>` });

    // Serialize with a correct xref table.
    const header = Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'latin1');
    const parts = [header];
    let offset = header.length;
    const offsets = [];
    this.objects.forEach((obj, idx) => {
      const num = idx + 1;
      offsets[num] = offset;
      const head = Buffer.from(`${num} 0 obj\n${obj.dict}\n`, 'latin1');
      let body;
      if (obj.stream) {
        body = Buffer.concat([
          head, Buffer.from('stream\n', 'latin1'),
          Buffer.isBuffer(obj.stream) ? obj.stream : Buffer.from(obj.stream, 'latin1'),
          Buffer.from('\nendstream\nendobj\n', 'latin1'),
        ]);
      } else {
        body = Buffer.concat([head, Buffer.from('endobj\n', 'latin1')]);
      }
      parts.push(body);
      offset += body.length;
    });

    const xrefStart = offset;
    let xref = `xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= this.objects.length; n += 1) {
      xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogRef} 0 R /Info ${infoRef} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    parts.push(Buffer.from(xref, 'latin1'));

    if (pagesRef !== pagesRefPlaceholder) {
      throw new Error(`Internal: /Pages ref ${pagesRef} does not match placeholder ${pagesRefPlaceholder}`);
    }
    return Buffer.concat(parts);
  }
}

/** Drawing surface for one page. Y is measured from the top for readability. */
export class PageContext {
  constructor(doc, page) {
    this.doc = doc;
    this.page = page;
    this.width = page.width;
    this.height = page.height;
  }

  _op(s) { this.page.ops.push(s); }
  _y(yFromTop) { return this.height - yFromTop; }

  setFill([r, g, b]) { this._op(`${r} ${g} ${b} rg`); return this; }
  setStroke([r, g, b]) { this._op(`${r} ${g} ${b} RG`); return this; }
  setLineWidth(w) { this._op(`${w} w`); return this; }

  rect(x, yFromTop, w, h, mode = 'f') {
    this._op(`${x.toFixed(2)} ${this._y(yFromTop + h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
    return this;
  }

  line(x1, y1, x2, y2) {
    this._op(`${x1.toFixed(2)} ${this._y(y1).toFixed(2)} m ${x2.toFixed(2)} ${this._y(y2).toFixed(2)} l S`);
    return this;
  }

  /**
   * Draw one line of text. Returns the advance width used.
   * @param {object} o {x, y, text, font, size, color, align, maxWidth}
   */
  text(o) {
    const { text, font: fontKey, size = 11 } = o;
    if (text == null || text === '') return 0;
    const entry = this.doc.fonts.get(fontKey);
    if (!entry) throw new Error(`Font "${fontKey}" was not registered`);
    const { hex, missing } = glyphHex(entry.font, text);
    if (missing.length) {
      this.doc.warnings.push(`Font ${entry.font.name} has no glyph for: ${[...new Set(missing)].join(' ')}`);
    }
    const w = this.doc.widthOf(fontKey, text, size);
    let x = o.x;
    if (o.align === 'center') x = o.x - w / 2;
    else if (o.align === 'right') x = o.x - w;

    this.page.usedFonts.add(entry.name);
    if (o.color) this.setFill(o.color);
    this._op(`BT /${entry.name} ${size} Tf ${x.toFixed(2)} ${this._y(o.y).toFixed(2)} Td <${hex}> Tj ET`);
    return w;
  }

  /**
   * Draw wrapped text. Returns the y position after the last line.
   */
  paragraph(o) {
    const { text, font, size = 11, x, y, maxWidth, leading = size * 1.45, color, align } = o;
    const lines = this.doc.wrap(font, text, size, maxWidth);
    let cy = y;
    for (const line of lines) {
      if (line) {
        const tx = align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;
        this.text({ x: tx, y: cy, text: line, font, size, color, align });
      }
      cy += leading;
    }
    return cy;
  }

  /**
   * Place an image inside a box, preserving aspect ratio (contain).
   * @returns {{x:number,y:number,w:number,h:number}|null} the drawn rectangle
   */
  image(record, box) {
    if (!record) return null;
    const { x, y, width: bw, height: bh, align = 'center' } = box;
    const scale = Math.min(bw / record.width, bh / record.height);
    const w = record.width * scale;
    const h = record.height * scale;
    const dx = align === 'left' ? x : align === 'right' ? x + bw - w : x + (bw - w) / 2;
    const dy = y + (bh - h) / 2;
    this.page.usedImages.add(record.name);
    this._op('q');
    this._op(`${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${dx.toFixed(2)} ${this._y(dy + h).toFixed(2)} cm`);
    this._op(`/${record.name} Do`);
    this._op('Q');
    return { x: dx, y: dy, w, h };
  }
}
