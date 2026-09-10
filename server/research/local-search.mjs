/**
 * Local evidence search over ACTUAL parsed source text.
 *
 * Simple normalized token matching, as specified. No vector store, and no
 * prerecorded answer list: every hit resolves to a real span of real source text.
 */

import { searchableTextOf } from '../ingestion/searchable.mjs';

/** Lowercase, strip diacritics/punctuation, collapse whitespace. Cyrillic-safe. */
export function normalizeForSearch(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ъь]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text) {
  const n = normalizeForSearch(text);
  return n ? n.split(' ').filter((t) => t.length > 1) : [];
}

/** Score one segment against query tokens. Returns 0 when nothing matches. */
function scoreSegment(segmentText, tokens) {
  const hay = normalizeForSearch(segmentText);
  if (!hay) return 0;
  const words = new Set(hay.split(' '));
  let exact = 0;
  let prefix = 0;
  for (const t of tokens) {
    if (words.has(t)) { exact += 1; continue; }
    // Russian inflection means a stem match is often the real hit.
    if (t.length >= 4 && hay.includes(t.slice(0, Math.max(4, t.length - 2)))) prefix += 1;
  }
  if (!exact && !prefix) return 0;
  const coverage = (exact + prefix * 0.5) / tokens.length;
  const phrase = hay.includes(tokens.join(' ')) ? 0.35 : 0;
  return Math.min(1, coverage * 0.8 + phrase);
}

/** Build a readable snippet centred on the first matching token. */
function snippetFor(text, tokens, radius = 160) {
  const raw = String(text);
  const hay = normalizeForSearch(raw);
  let at = -1;
  for (const t of tokens) {
    const i = hay.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1 || raw.length <= radius * 2) return raw.trim().slice(0, radius * 2);
  // Map the normalized offset back to roughly the same place in the original.
  const ratio = raw.length / Math.max(1, hay.length);
  const centre = Math.floor(at * ratio);
  const start = Math.max(0, centre - radius);
  const end = Math.min(raw.length, centre + radius);
  return `${start > 0 ? '...' : ''}${raw.slice(start, end).trim()}${end < raw.length ? '...' : ''}`;
}

/**
 * @param {object} args
 * @param {string} args.query
 * @param {Array} args.sources   parsed sources from ingestion (with segments/originalText)
 * @param {number} [args.limit]
 * @returns {Promise<{status:'hit'|'no_match'|'invalid_query', hits:Array, query:string, searchedSources:number}>}
 */
export async function searchLocalSources({ query, sources = [], limit = 5 } = {}) {
  const tokens = tokenize(query);
  if (!tokens.length) {
    return { status: 'invalid_query', hits: [], query: String(query || ''), searchedSources: 0, reason: 'Query contained no searchable tokens.' };
  }

  const hits = [];
  let searched = 0;
  for (const source of sources) {
    const text = searchableTextOf(source);
    if (!text) continue;
    searched += 1;
    const segments = Array.isArray(source.segments) && source.segments.length
      ? source.segments
      : [{ index: 1, startLine: 1, endLine: text.split(/\r\n|\r|\n/).length, locator: source.originalLocator, text }];

    for (const seg of segments) {
      const score = scoreSegment(seg.text, tokens);
      if (score <= 0) continue;
      hits.push({
        sourceId: source.id,
        locator: seg.locator || source.originalLocator,
        snippet: snippetFor(seg.text, tokens),
        score: Number(score.toFixed(4)),
        segmentIndex: seg.index,
        origin: source.origin,
        sourceTitle: source.title || source.originalLocator,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId));
  const top = hits.slice(0, Math.max(1, limit));
  return {
    status: top.length ? 'hit' : 'no_match',
    hits: top,
    query: String(query),
    searchedSources: searched,
    totalMatches: hits.length,
  };
}
