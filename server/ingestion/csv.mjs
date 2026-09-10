/** RFC 4180-style CSV with source offsets, quoted commas and embedded newlines. */
function readCsvRows(text, delimiter = ',') {
  text = String(text).replace(/^\uFEFF/, '');
  const records = []; let fields = [], field = '', quoted = false, afterQuote = false, start = 0, line = 1, startLine = 1;
  const push = (end) => { fields.push(field); if (fields.length > 100 || end - start > 100_000 || records.length > 10_000) throw new Error('CSV row, column or record limit exceeded'); if (fields.some((v) => v !== '')) records.push({ fields, raw: text.slice(start, end), start, end, startLine, endLine: line }); fields = []; field = ''; afterQuote = false; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; afterQuote = true; } } else { field += c; if (c === '\n') line++; } continue; }
    if (c === '"') { if (field || afterQuote) throw new Error(`Malformed CSV quote at line ${line}`); quoted = true; continue; }
    if (c === delimiter) { fields.push(field); field = ''; afterQuote = false; continue; }
    if (c === '\r' || c === '\n') { push(i); if (c === '\r' && text[i + 1] === '\n') i++; line++; start = i + 1; startLine = line; continue; }
    if (afterQuote) throw new Error(`Unexpected content after CSV quote at line ${line}`);
    field += c;
  }
  if (quoted) throw Object.assign(new Error('Unterminated CSV quoted field'), { code: 'ECSVUNTERMINATED' });
  if (field || fields.length) push(text.length);
  return records;
}

/** Runtime CSV records include exact source offsets and preserve cell text. */
export function parseCsvWithSpans(text) {
  const records = readCsvRows(text);
  if (!records.length) return [];
  const headers = records.shift().fields.map((h) => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length || headers.some((h) => !h)) throw new Error('CSV has empty or duplicate headers');
  return records.map((r) => { if (r.fields.length !== headers.length) throw new Error(`CSV line ${r.startLine} has ${r.fields.length} values, expected ${headers.length}`); return { ...r, values: Object.fromEntries(headers.map((h, i) => [h, r.fields[i]])) }; });
}

/** Preserved raw-import API: matrix rows, including the header. */
export function parseCsv(text, options = {}) { return readCsvRows(text, options.delimiter || ',').map((r) => r.fields); }
export function headerKey(name) { return String(name || '').trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, ''); }
export function parseCsvRecords(text) {
  const rows = readCsvRows(text);
  if (!rows.length) return { headers: [], records: [], warnings: ['CSV is empty.'] };
  const headers = rows.shift().fields.map(headerKey), warnings = [];
  if (new Set(headers).size !== headers.length) warnings.push('Duplicate column headers.');
  const records = rows.map((row, i) => {
    if (row.fields.length !== headers.length) warnings.push(`Row ${i + 2} has ${row.fields.length} cells but the header declares ${headers.length}.`);
    return { ...Object.fromEntries(headers.filter(Boolean).map((h) => [h, String(row.fields[headers.indexOf(h)] || '').trim()])), __row: i + 2 };
  });
  return { headers, records, warnings };
}
export function pick(record, ...names) { for (const name of names) { const key = headerKey(name); if (record[key] != null && record[key] !== '') return record[key]; } return ''; }
