import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
const exec = promisify(execFile);

/**
 * Pages read from an uploaded PDF. Ten was enough for a one-page personal note, but a
 * family-book excerpt runs to tens of pages and a chapter beyond the cap would silently
 * lose its citable text. Forty pages stays well inside the 10 second and 2 MB limits,
 * which are the actual protections here.
 */
export const MAX_PDF_PAGES = 40;

/**
 * Actual Poppler extraction. A missing binary or image-only PDF fails explicitly.
 *
 * Returns the text. `extractPdfTextWithPages` returns the same text plus the number of
 * pages actually read, which the caller needs so a locator can state the real extent
 * instead of repeating the cap.
 */
export async function extractPdfText(bytes, options) {
  return (await extractPdfTextWithPages(bytes, options)).text;
}

export async function extractPdfTextWithPages(bytes, { maxPages = MAX_PDF_PAGES } = {}) {
  if (Buffer.from(bytes).subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF signature');
  const cap = Math.max(1, Math.min(Number(maxPages) || MAX_PDF_PAGES, MAX_PDF_PAGES));
  const dir = await mkdtemp(join(tmpdir(), 'roots-pdf-'));
  try {
    const file = join(dir, 'input.pdf'); await writeFile(file, bytes, { mode: 0o600 });
    const { stdout } = await exec(process.env.ROOTS_PDFTOTEXT || 'pdftotext', ['-layout', '-enc', 'UTF-8', '-f', '1', '-l', String(cap), file, '-'], { timeout: 10000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' });
    // pdftotext separates pages with a form feed, so counting them is exact.
    const pages = Math.min(cap, (stdout.match(/\f/g) || []).length || 1);
    const text = stdout.replace(/\f/g, '\n').trim();
    if (!text) throw new Error('PDF has no extractable text; OCR was not performed');
    return { text, pages, cap, truncated: pages >= cap };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
