import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
const exec = promisify(execFile);
/** Actual Poppler extraction. A missing binary or image-only PDF fails explicitly. */
export async function extractPdfText(bytes) {
  if (Buffer.from(bytes).subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF signature');
  const dir = await mkdtemp(join(tmpdir(), 'roots-pdf-'));
  try {
    const file = join(dir, 'input.pdf'); await writeFile(file, bytes, { mode: 0o600 });
    const { stdout } = await exec(process.env.ROOTS_PDFTOTEXT || 'pdftotext', ['-layout', '-enc', 'UTF-8', '-f', '1', '-l', '10', file, '-'], { timeout: 10000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' });
    const text = stdout.replace(/\f/g, '\n').trim();
    if (!text) throw new Error('PDF has no extractable text; OCR was not performed');
    return text;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
