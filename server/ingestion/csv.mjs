/** RFC 4180-style CSV with source offsets, quoted commas and embedded newlines. */
export function parseCsv(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const records = []; let fields = [], field = '', quoted = false, afterQuote = false, start = 0, line = 1, startLine = 1;
  const push = (end) => { fields.push(field); if (fields.length > 100 || end - start > 100_000 || records.length > 10_000) throw new Error('CSV row, column or record limit exceeded'); if (fields.some((v) => v !== '')) records.push({ fields, raw: text.slice(start, end), start, end, startLine, endLine: line }); fields = []; field = ''; afterQuote = false; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; afterQuote = true; } } else { field += c; if (c === '\n') line++; } continue; }
    if (c === '"') { if (field || afterQuote) throw new Error(`Malformed CSV quote at line ${line}`); quoted = true; continue; }
    if (c === ',') { fields.push(field); field = ''; afterQuote = false; continue; }
    if (c === '\r' || c === '\n') { push(i); if (c === '\r' && text[i + 1] === '\n') i++; line++; start = i + 1; startLine = line; continue; }
    if (afterQuote) throw new Error(`Unexpected content after CSV quote at line ${line}`);
    field += c;
  }
  if (quoted) throw new Error('Unterminated CSV quoted field');
  if (field || fields.length) push(text.length);
  if (!records.length) return [];
  const headers = records.shift().fields.map((h) => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length || headers.some((h) => !h)) throw new Error('CSV has empty or duplicate headers');
  return records.map((r) => { if (r.fields.length !== headers.length) throw new Error(`CSV line ${r.startLine} has ${r.fields.length} values, expected ${headers.length}`); return { ...r, values: Object.fromEntries(headers.map((h, i) => [h, r.fields[i]])) }; });
}
