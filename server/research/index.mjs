/**
 * server/research - Claude Code Mike
 *
 * Exports:
 *   searchLocalSources({query, sources, limit}) -> {status, hits[]}
 *   fetchPublicRecord({url, timeoutMs, maxBytes}) -> {status, source?, error?}
 *   searchPublicRecords({query, limit, env, fetchImpl}) -> {status, results[], ...}
 *   crawlLinkedPages({startUrl, maxPages, maxDepth}) -> {status, pages[], blocked[], ...}
 *
 * These functions never edit the family graph and never call a model. They return
 * results the lead persists as research events and feeds to Astra.
 * Only an actual successful retrieval may increment a website counter.
 */

export { searchLocalSources, normalizeForSearch, tokenize } from './local-search.mjs';
export { prepareManifestBatches, readSavedSourceJob } from './staged-sources.mjs';
export {
  fetchPublicRecord, isPrivateAddress, isHostAllowed, htmlToText, extractTitle,
  ALLOWED_HOSTS, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_BYTES,
} from './public-fetch.mjs';
export {
  getSearchProviderConfig, searchPublicRecords, normalizeUrlKey, SEARCH_PROVIDERS,
} from './search-provider.mjs';
export { crawlLinkedPages, extractLinks, clearCrawlCache } from './crawl.mjs';

import { normalizeUrlKey as urlKey } from './search-provider.mjs';

/**
 * Counter guidance for the lead, matching CONTRACT-V3 countRules.
 * A fetch that returns `blocked`/`timeout`/`not_allowed` contributes nothing.
 */
export function websiteCountDelta(fetchResult) {
  return fetchResult && fetchResult.status === 'ok' && fetchResult.source?.origin === 'live' ? 1 : 0;
}

function domainOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Retrieval counters for one result, or for an array of results from one cycle.
 * Accepts a search result, a crawl result or a single fetchPublicRecord result.
 *
 * Everything is derived from operations that actually succeeded, and every tally is
 * a set of distinct keys, so a retry, a cache hit, a redirect or the same page found
 * twice cannot raise a number. Cached pages are reported apart from retrieved ones
 * because a cache hit is not new retrieval work, and for the same reason a cached
 * page contributes no domain.
 *
 * @returns {{searchAttempts:number, pagesRetrieved:number, cachedPages:number, uniqueDomains:number}}
 */
export function retrievalCountDelta(result) {
  const items = Array.isArray(result) ? result : [result];
  const answeredSearches = new Set();
  const retrieved = new Set();
  const cached = new Set();
  const domains = new Set();

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    if (Array.isArray(item.pages)) {
      for (const page of item.pages) {
        if (!page || page.status !== 'ok' || !page.url) continue;
        const key = urlKey(page.url) || String(page.url);
        if (page.fromCache) { cached.add(key); continue; }
        retrieved.add(key);
        const host = domainOf(key);
        if (host) domains.add(host);
      }
      continue;
    }

    if (Array.isArray(item.results) && 'provider' in item) {
      // Only a provider answer counts. A timeout, refusal or failure produced
      // nothing, so retrying it must not move the counter.
      if (item.provider && ['ok', 'no_match'].includes(item.status)) {
        answeredSearches.add(`${item.provider}::${String(item.query || '').trim().toLowerCase()}`);
      }
      continue;
    }

    if (item.status === 'ok' && item.source) {
      const key = urlKey(item.finalUrl || item.source.finalUrl || '') || item.source.id;
      if (item.source.origin === 'live') {
        retrieved.add(key);
        const host = domainOf(item.finalUrl || item.source.finalUrl || '');
        if (host) domains.add(host);
      } else if (item.source.origin === 'cached') {
        cached.add(key);
      }
    }
  }

  return {
    searchAttempts: answeredSearches.size,
    pagesRetrieved: retrieved.size,
    cachedPages: cached.size,
    uniqueDomains: domains.size,
  };
}
