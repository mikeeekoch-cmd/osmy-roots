/**
 * server/research - Claude Code Mike
 *
 * Exports:
 *   searchLocalSources({query, sources, limit}) -> {status, hits[]}
 *   fetchPublicRecord({url, timeoutMs, maxBytes}) -> {status, source?, error?}
 *
 * These functions never edit the family graph and never call a model. They return
 * results the lead persists as research events and feeds to Astra.
 * Only an actual successful retrieval may increment a website counter.
 */

export { searchLocalSources, normalizeForSearch, tokenize } from './local-search.mjs';
export { prepareManifestBatches, readSavedSourceJob } from './staged-sources.mjs';
export {
  fetchPublicRecord, isPrivateAddress, htmlToText, extractTitle,
  ALLOWED_HOSTS, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_BYTES,
} from './public-fetch.mjs';

/**
 * Counter guidance for the lead, matching CONTRACT-V3 countRules.
 * A fetch that returns `blocked`/`timeout`/`not_allowed` contributes nothing.
 */
export function websiteCountDelta(fetchResult) {
  return fetchResult && fetchResult.status === 'ok' && fetchResult.source?.origin === 'live' ? 1 : 0;
}
