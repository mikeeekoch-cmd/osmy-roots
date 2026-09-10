/**
 * RFC 4180 CSV reader: quoted fields, embedded commas, embedded newlines and
 * doubled quotes. Registers arrive as CSV, so a naive split would corrupt any
 * caption or note containing a comma.
 */

/** @returns {string[][]} rows of raw cell strings */
export function parseCsv(text, options = {}) {
  const delimiter = options.delimiter || ',';
  const src = String(text).replace(/^﻿/, '');   // strip BOM
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let started = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; continue; }
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; started = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; started = true; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = []; field = ''; started = false;
      continue;
    }
    field += ch;
    started = true;
  }
  if (inQuotes) {
    const err = new Error('CSV ended inside a quoted field');
    err.code = 'ECSVUNTERMINATED';
    throw err;
  }
  if (started || field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0].trim() === ''));
}

/** Normalize a header cell to a comparable key. */
export function headerKey(name) {
  return String(name || '').trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Parse to objects keyed by normalized header, keeping the 1-based source line
 * of each record so a locator like `Family_Register.csv#row:12` resolves.
 */
export function parseCsvRecords(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], records: [], warnings: ['CSV is empty.'] };
  const headers = rows[0].map(headerKey);
  const warnings = [];
  const seenHeader = new Set();
  headers.forEach((h, i) => {
    if (!h) warnings.push(`Column ${i + 1} has an empty header.`);
    else if (seenHeader.has(h)) warnings.push(`Duplicate column header "${h}".`);
    seenHeader.add(h);
  });

  const records = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    if (cells.every((c) => String(c).trim() === '')) continue;
    if (cells.length !== headers.length) {
      warnings.push(`Row ${r + 1} has ${cells.length} cells but the header declares ${headers.length}.`);
    }
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = cells[i] == null ? '' : String(cells[i]).trim(); });
    obj.__row = r + 1;
    records.push(obj);
  }
  return { headers, records, warnings };
}

/** First present value among candidate header names. */
export function pick(record, ...names) {
  for (const n of names) {
    const k = headerKey(n);
    if (record[k] != null && record[k] !== '') return record[k];
  }
  return '';
}
