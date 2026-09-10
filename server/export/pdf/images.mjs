/**
 * JPEG and PNG embedding for the PDF writer, over node:zlib only.
 *
 * JPEG is passed through as DCTDecode (no re-encode, no quality loss).
 * PNG without alpha is passed through as FlateDecode with a PNG predictor.
 * PNG with alpha is decoded, split into colour + SMask, and re-compressed.
 * Aspect ratio is always preserved by the layout, never by resampling here.
 */

import { inflateSync, deflateSync } from 'node:zlib';

/** Read intrinsic size and colour model from a JPEG without decoding pixels. */
export function readJpeg(bytes) {
  const buf = Buffer.from(bytes);
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) throw new Error('Not a JPEG');
  let i = 2;
  let adobeInverted = false;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9) break;
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xee && buf.toString('latin1', i + 4, i + 9) === 'Adobe') adobeInverted = true;
    // SOF0..SOF15 except DHT(c4), JPGA(c8), DAC(cc)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const precision = buf[i + 4];
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      const components = buf[i + 9];
      return { width, height, components, precision, bytes: buf, filter: 'DCTDecode', adobeInverted };
    }
    i += 2 + len;
  }
  throw new Error('No JPEG SOF marker found');
}

function pngChunks(buf) {
  const out = [];
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    out.push({ type, data });
    p += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

/** Undo PNG per-scanline filtering into raw samples. */
function unfilter(raw, width, height, bpp, rowBytes) {
  const out = Buffer.alloc(height * rowBytes);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const row = raw.subarray(pos, pos + rowBytes);
    pos += rowBytes;
    const cur = out.subarray(y * rowBytes, (y + 1) * rowBytes);
    const prev = y > 0 ? out.subarray((y - 1) * rowBytes, y * rowBytes) : null;
    for (let x = 0; x < rowBytes; x += 1) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: throw new Error(`Unsupported PNG filter ${filter}`);
      }
      cur[x] = v;
    }
  }
  return out;
}

export function readPng(bytes) {
  const buf = Buffer.from(bytes);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i += 1) if (buf[i] !== sig[i]) throw new Error('Not a PNG');

  const chunks = pngChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('PNG missing IHDR');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];
  if (interlace !== 0) throw new Error('Interlaced PNG is not supported');
  if (![8, 16].includes(bitDepth) && colorType !== 3) throw new Error(`Unsupported PNG bit depth ${bitDepth}`);

  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const plte = chunks.find((c) => c.type === 'PLTE');
  const trns = chunks.find((c) => c.type === 'tRNS');

  // No alpha channel: hand the compressed data straight to PDF with a predictor.
  if (colorType === 0 || colorType === 2 || (colorType === 3 && !trns)) {
    const colors = colorType === 2 ? 3 : 1;
    return {
      width, height, bitDepth, colorType,
      filter: 'FlateDecode',
      bytes: idat,
      passthrough: true,
      colors,
      decodeParms: { Predictor: 15, Colors: colors, BitsPerComponent: bitDepth, Columns: width },
      palette: plte ? plte.data : null,
      indexed: colorType === 3,
    };
  }

  // Alpha present: decode, split colour and alpha, recompress both.
  const channels = colorType === 4 ? 2 : colorType === 6 ? 4 : 1;
  const sampleBytes = bitDepth / 8;
  const bpp = Math.ceil(channels * sampleBytes);
  const rowBytes = Math.ceil(width * channels * sampleBytes);
  const raw = unfilter(inflateSync(idat), width, height, bpp, rowBytes);

  const colorChannels = colorType === 4 ? 1 : 3;
  const color = Buffer.alloc(width * height * colorChannels * sampleBytes);
  const alpha = Buffer.alloc(width * height * sampleBytes);
  let ci = 0; let ai = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const base = y * rowBytes + x * channels * sampleBytes;
      for (let c = 0; c < colorChannels; c += 1) {
        for (let s = 0; s < sampleBytes; s += 1) color[ci++] = raw[base + c * sampleBytes + s];
      }
      for (let s = 0; s < sampleBytes; s += 1) alpha[ai++] = raw[base + colorChannels * sampleBytes + s];
    }
  }

  return {
    width, height, bitDepth, colorType,
    filter: 'FlateDecode',
    bytes: deflateSync(color, { level: 9 }),
    passthrough: false,
    colors: colorChannels,
    smask: { bytes: deflateSync(alpha, { level: 9 }), width, height, bitDepth },
    palette: null,
    indexed: false,
  };
}

/** Dispatch on sniffed type. Returns null for anything we will not embed. */
export function readImage(bytes, mediaType) {
  const buf = Buffer.from(bytes);
  try {
    if (buf[0] === 0xff && buf[1] === 0xd8) return { kind: 'jpeg', ...readJpeg(buf) };
    if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return { kind: 'png', ...readPng(buf) };
  } catch (e) {
    return { kind: 'unsupported', error: e.message, mediaType };
  }
  return { kind: 'unsupported', error: `Unsupported image type ${mediaType || 'unknown'}`, mediaType };
}
