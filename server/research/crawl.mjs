/**
 * Bounded crawl of pages linked from one starting page.
 *
 * Every request goes through fetchPublicRecord, so the allowlist, SSRF, redirect,
 * size and time protections are enforced in exactly one place. Nothing here
 * reimplements them.
 *
 * The bounds exist because a crawl is the easiest way to turn one approved lookup
 * into hundreds of unapproved ones:
 *  - maxPages caps the pages opened, cached or fresh, so a warm cache cannot walk
 *    further than a cold run.
 *  - maxDepth caps how far from the start page we travel.
 *  - sameHostOnly keeps a crawl on the archive it started on.
 *  - a URL is opened at most once per run.
 *
 * A retrieved page is a candidate source. It is never proof of kinship.
 */

import { fetchPublicRecord } from './public-fetch.mjs';
import { sha256 } from '../ingestion/hash.mjs';
import { normalizeUrlKey } from './search-provider.mjs';

/**
 * In-process content cache, keyed by the normalised URL. A repeat visit inside the
 * same run reports fromCache and is not a new retrieval, so a rerun cannot inflate
 * the page counters. It stores what we actually got, truncation included.
 */
const contentCache = new Map();

/** Tests and a fresh research cycle start from an empty cache. */
export function clearCrawlCache() {
  contentCache.clear();
  return contentCache.size;
}

/** Hard stop on candidate links examined, so one link farm cannot spin the loop. */
const MAX_CANDIDATES = 200;

/**
 * Outbound http(s) links from HTML, resolved against the page they came from.
 * Fragments, mailto, javascript, tel and data URLs are not pages to retrieve.
 * @returns {string[]} normalised, de-duplicated, in document order
 */
export function extractLinks(html, baseUrl) {
  const pattern = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
  const source = String(html || '');
  const seen = new Set();
  const out = [];
  let m;
  while ((m = pattern.exec(source)) !== null) {
    const raw = String(m[1] ?? m[2] ?? m[3] ?? '').replace(/&amp;/gi, '&').trim();
    if (!raw || raw.startsWith('#')) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) continue;
    let resolved;
    try {
      resolved = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    const key = normalizeUrlKey(resolved.toString());
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** One page row, same key order whether it came from the network or the cache. */
function pageRow(base, depth, fromCache) {
  return {
    url: base.url,
    depth,
    status: base.status,
    title: base.title,
    textHash: base.textHash,
    bytes: base.bytes,
    textLength: base.textLength,
    truncated: base.truncated,
    fromCache,
    fetchedAt: base.fetchedAt,
  };
}

/**
 * @param {object} args
 * @param {string} args.startUrl
 * @param {number} [args.maxPages]      pages opened in total, cached ones included
 * @param {number} [args.maxDepth]      0 means the start page only
 * @param {boolean} [args.sameHostOnly]
 * @param {number} [args.timeoutMs]     passed straight to the fetcher
 * @param {number} [args.maxBytes]      passed straight to the fetcher
 * @param {string[]} [args.allowHosts]  allowlist override, same semantics as the fetcher
 * @param {Function} [args.fetchImpl]   injected in tests
 * @param {Function} [args.dnsImpl]     injected in tests; becomes the fetcher's lookupImpl
 * @param {Function} [args.now]         clock injection for deterministic timestamps
 * @returns {Promise<{status:string, startUrl:string|null, pages:Array, visitedCount:number,
 *   uniqueDomains:number, cachedCount:number, duplicateTextRoots:number,
 *   blocked:Array<{url:string, reason:string, message?:string}>, error?:object}>}
 */
export async function crawlLinkedPages({
  startUrl, maxPages = 3, maxDepth = 1, sameHostOnly = true,
  timeoutMs, maxBytes, allowHosts, fetchImpl, dnsImpl, now,
} = {}) {
  const stamp = () => {
    const v = typeof now === 'function' ? now() : Date.now();
    if (v instanceof Date) return v.toISOString();
    return typeof v === 'string' ? v : new Date(v).toISOString();
  };

  const pages = [];
  const blocked = [];
  const summarise = (status, error) => {
    const ok = pages.filter((p) => p.status === 'ok');
    const hashes = ok.map((p) => p.textHash).filter(Boolean);
    return {
      status,
      startUrl: startUrl == null ? null : String(startUrl),
      pages,
      visitedCount: pages.length,
      uniqueDomains: new Set(ok.map((p) => hostOf(p.url)).filter(Boolean)).size,
      cachedCount: pages.filter((p) => p.fromCache).length,
      // Same text under two URLs is one evidence root, not two findings.
      duplicateTextRoots: hashes.length - new Set(hashes).size,
      blocked,
      ...(error ? { error } : {}),
    };
  };

  const startKey = normalizeUrlKey(startUrl);
  if (!startKey) {
    return summarise('failed', { code: 'BAD_URL', message: `Not a crawlable http or https URL: ${startUrl}` });
  }
  const startHost = hostOf(startKey);
  const pageBudget = Math.max(1, Number(maxPages) || 1);
  const depthLimit = Math.max(0, Number(maxDepth) || 0);

  const queue = [{ url: startKey, depth: 0 }];
  const seen = new Set([startKey]);
  let status = 'ok';
  let error = null;

  while (queue.length && pages.length < pageBudget) {
    const { url, depth } = queue.shift();
    let links = [];

    const cached = contentCache.get(url);
    if (cached) {
      pages.push(pageRow(cached.page, depth, true));
      links = cached.links;
    } else {
      const result = await fetchPublicRecord({
        url, timeoutMs, maxBytes, allowHosts, fetchImpl, lookupImpl: dnsImpl, includeRawBody: true,
      });

      // not_allowed and BLOCKED_PRIVATE are refusals decided before any request, so
      // they are recorded as links we would not open and cost no page budget.
      if (result.status === 'not_allowed' || result.error?.code === 'BLOCKED_PRIVATE') {
        blocked.push({ url, reason: result.error?.code || 'REFUSED', message: result.error?.message || '' });
        if (url === startKey) {
          status = 'blocked';
          error = result.error || { code: 'REFUSED', message: 'The start URL was refused.' };
        }
        continue;
      }

      if (result.status !== 'ok') {
        // A page we opened and failed to read is still an attempt worth showing.
        pages.push({
          ...pageRow({ url: result.finalUrl || url, status: result.status, title: null, textHash: null, bytes: 0, textLength: 0, truncated: false, fetchedAt: result.retrievedAt || stamp() }, depth, false),
          error: result.error || null,
        });
        if (url === startKey) {
          status = result.status === 'timeout' ? 'timeout' : 'failed';
          error = result.error || null;
        }
        continue;
      }

      const text = result.source.originalText || '';
      const base = {
        url: result.finalUrl || url,
        status: 'ok',
        title: result.source.title || null,
        // Hash the extracted text, not the bytes: the same record served under two
        // URLs rarely has identical markup but does have identical text.
        textHash: sha256(text),
        bytes: result.source.byteLength,
        textLength: text.length,
        truncated: Boolean(result.truncated),
        fetchedAt: result.retrievedAt || stamp(),
      };
      links = result.isHtml ? extractLinks(result.rawBody || '', base.url) : [];
      contentCache.set(url, { page: base, links });
      // A redirect target is the same content; cache it too so it is not fetched twice.
      const finalKey = normalizeUrlKey(base.url);
      if (finalKey && finalKey !== url) {
        contentCache.set(finalKey, { page: base, links });
        seen.add(finalKey);
      }
      pages.push(pageRow(base, depth, false));
    }

    if (depth >= depthLimit) continue;
    for (const link of links) {
      if (seen.size >= MAX_CANDIDATES) break;
      if (seen.has(link)) continue;
      seen.add(link);
      if (sameHostOnly && hostOf(link) !== startHost) {
        blocked.push({ url: link, reason: 'different_host', message: `${hostOf(link)} is not the host this crawl started on.` });
        continue;
      }
      queue.push({ url: link, depth: depth + 1 });
    }
  }

  return summarise(status, error);
}
