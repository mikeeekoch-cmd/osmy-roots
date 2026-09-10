/** Concatenate a source's citable text. Kept separate so search and export agree. */
export function searchableTextOf(source) {
  if (!source) return '';
  if (source.originalText) return source.originalText;
  if (Array.isArray(source.segments)) return source.segments.map((s) => s.text).join('\n\n');
  return '';
}
