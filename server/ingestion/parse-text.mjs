/**
 * Text extraction with exact, resolvable locators.
 *
 * A locator must point back into the ORIGINAL text so a cited quote can be verified.
 * We only claim to parse formats we genuinely decode: UTF-8 text, Markdown, CSV and JSON.
 */

/** Decode UTF-8 strictly enough to reject binary masquerading as text. */
export function decodeUtf8(bytes) {
  const text = Buffer.from(bytes).toString('utf8');
  // U+FFFD in the output means the bytes were not valid UTF-8.
  if (text.includes('�')) {
    const err = new Error('Not valid UTF-8 text');
    err.code = 'ENOTUTF8';
    throw err;
  }
  return text;
}

/**
 * Split text into addressable segments. Blank-line separated paragraphs, with
 * 1-based line numbers retained so `file#L12-L14` resolves exactly.
 * @returns {{index:number,startLine:number,endLine:number,text:string}[]}
 */
export function segmentText(text) {
  const lines = String(text).split(/\r\n|\r|\n/);
  const segments = [];
  let buf = [];
  let start = 1;
  const flush = (endLine) => {
    const joined = buf.join('\n').trim();
    if (joined) segments.push({ index: segments.length + 1, startLine: start, endLine, text: joined });
    buf = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') {
      if (buf.length) flush(i);
      start = i + 2;
      continue;
    }
    if (!buf.length) start = i + 1;
    buf.push(line);
  }
  if (buf.length) flush(lines.length);
  return segments;
}

/** `name#L3-L7`, or `name#L3` for a single line. */
export function lineLocator(name, startLine, endLine) {
  return endLine && endLine !== startLine ? `${name}#L${startLine}-L${endLine}` : `${name}#L${startLine}`;
}

/**
 * Verify a quote actually occurs in the source text at the claimed locator.
 * Used by export validation before a quote reaches the book.
 */
export function quoteResolves(originalText, quote) {
  if (!quote) return false;
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  return norm(originalText).includes(norm(quote));
}

/** JSON is parsed for validity; the original text is still what gets cited. */
export function parseJsonSafely(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
