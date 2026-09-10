/**
 * Public web search through a configured provider.
 *
 * Rules this adapter exists to enforce:
 *  - With no provider configured it reports `not_configured` and returns nothing.
 *    It never invents a URL or a plausible-looking archive link. Downstream code
 *    treats every URL here as a citable lead, so a fabricated one is worse than
 *    an empty result.
 *  - Provider rows are filtered through the same host allowlist the fetcher
 *    enforces, because a provider must not be able to point us at a host we are
 *    not permitted to visit.
 *  - A response shape we do not recognise is reported as `failed`, not guessed at.
 *
 * A search result is a lead. It is never evidence and never proof of kinship.
 */

import { isHostAllowed, DEFAULT_TIMEOUT_MS } from './public-fetch.mjs';

/** Providers with a parser here. Anything else counts as unconfigured. */
export const SEARCH_PROVIDERS = Object.freeze(['brave', 'serpapi']);

const MAX_TITLE = 300;
const MAX_SNIPPET = 500;
const MAX_PROVIDER_ROWS = 50;

/**
 * One canonical spelling of a URL, shared with the crawler so both agree on what
 * "the same page" means. Without a shared key, dedup and the retrieval counters
 * would disagree and a repeat would look like new work.
 */
export function normalizeUrlKey(raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

/**
 * @param {object} [env]
 * @returns {{configured:boolean, provider:string|null, reason?:string}}
 */
export function getSearchProviderConfig(env = process.env) {
  const source = env || {};
  const provider = String(source.ROOTS_SEARCH_PROVIDER || '').trim().toLowerCase();
  const key = String(source.ROOTS_SEARCH_API_KEY || '').trim();
  if (!provider) {
    return { configured: false, provider: null, reason: 'ROOTS_SEARCH_PROVIDER is not set. Public search stays off until a provider and key are supplied.' };
  }
  if (provider === 'none') {
    return { configured: false, provider: null, reason: 'ROOTS_SEARCH_PROVIDER is set to none. Public search is deliberately disabled.' };
  }
  if (!SEARCH_PROVIDERS.includes(provider)) {
    return { configured: false, provider: null, reason: `Unsupported ROOTS_SEARCH_PROVIDER "${provider}". Supported: ${SEARCH_PROVIDERS.join(', ')}.` };
  }
  if (!key) {
    return { configured: false, provider: null, reason: `ROOTS_SEARCH_API_KEY is missing, so provider "${provider}" cannot be called.` };
  }
  return { configured: true, provider };
}

/** Request shape per provider. The key travels in the header where the provider supports it. */
function buildRequest(provider, { query, limit, apiKey }) {
  if (provider === 'brave') {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(limit));
    return {
      url: url.toString(),
      init: { headers: { accept: 'application/json', 'accept-encoding': 'gzip', 'X-Subscription-Token': apiKey } },
    };
  }
  // SerpAPI only accepts the key as a query parameter. Nothing about the user goes into the URL.
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('num', String(limit));
  return { url: url.toString(), init: { headers: { accept: 'application/json' } } };
}

/**
 * Pull rows out of a provider payload, or say we did not recognise it.
 * @returns {{rows:Array}|{unrecognised:string}}
 */
function parsePayload(provider, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { unrecognised: 'Response body was not a JSON object.' };
  }
  if (provider === 'brave') {
    const web = data.web;
    if (!web || typeof web !== 'object' || !Array.isArray(web.results)) {
      return { unrecognised: 'Brave response had no web.results array.' };
    }
    return { rows: web.results.slice(0, MAX_PROVIDER_ROWS).map((r) => ({ title: r?.title, url: r?.url, snippet: r?.description })) };
  }
  if (Array.isArray(data.organic_results)) {
    return { rows: data.organic_results.slice(0, MAX_PROVIDER_ROWS).map((r) => ({ title: r?.title, url: r?.link, snippet: r?.snippet })) };
  }
  // SerpAPI omits organic_results when a query matched nothing, but it still returns
  // its search metadata. That is a recognised empty answer, not a broken payload.
  if (data.search_information && typeof data.search_information === 'object') return { rows: [] };
  if (typeof data.error === 'string') return { unrecognised: `Provider reported: ${data.error}` };
  return { unrecognised: 'SerpAPI response had no organic_results array.' };
}

function clean(value, max) {
  const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}

/**
 * @param {object} args
 * @param {string} args.query
 * @param {number} [args.limit]
 * @param {object} [args.env]
 * @param {Function} [args.fetchImpl]   injected in tests; no live call is made without one
 * @param {number} [args.timeoutMs]
 * @param {string[]} [args.allowHosts]  override allowlist, same semantics as the fetcher
 * @returns {Promise<{status:string, provider:string|null, query:string, attemptedAt:string,
 *   elapsedMs:number, results:Array<{title:string|null,url:string,snippet:string|null,domain:string}>,
 *   totalResults:number, providerReturned:number, droppedDisallowed:number,
 *   droppedDuplicate:number, droppedUnusable:number, droppedOverLimit:number,
 *   uniqueDomains:number, error?:object}>}
 */
export async function searchPublicRecords({
  query, limit = 5, env = process.env, fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS, allowHosts,
} = {}) {
  const startedAt = Date.now();
  const attemptedAt = new Date().toISOString();
  const cleanQuery = String(query == null ? '' : query).trim();
  const cap = Math.min(20, Math.max(1, Number(limit) || 1));

  const base = (status, provider, extra = {}) => ({
    status,
    provider,
    query: cleanQuery,
    attemptedAt,
    elapsedMs: Date.now() - startedAt,
    results: [],
    totalResults: 0,
    providerReturned: 0,
    droppedDisallowed: 0,
    droppedDuplicate: 0,
    droppedUnusable: 0,
    droppedOverLimit: 0,
    uniqueDomains: 0,
    ...extra,
  });

  const config = getSearchProviderConfig(env);
  if (!config.configured) {
    // No provider means no results. Not an empty guess, not a synthesised link.
    return base('not_configured', null, { error: { code: 'NOT_CONFIGURED', message: config.reason } });
  }
  if (!cleanQuery) {
    return base('failed', config.provider, { error: { code: 'EMPTY_QUERY', message: 'Search was called without a query.' } });
  }

  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') {
    return base('failed', config.provider, { error: { code: 'NO_FETCH', message: 'No fetch implementation is available in this runtime.' } });
  }

  const apiKey = String(env.ROOTS_SEARCH_API_KEY || '').trim();
  const { url, init } = buildRequest(config.provider, { query: cleanQuery, limit: cap, apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    const httpStatus = Number(response?.status ?? 200);

    if ([401, 403].includes(httpStatus)) {
      return base('blocked', config.provider, { error: { code: `HTTP_${httpStatus}`, message: `Provider refused the key (HTTP ${httpStatus}). Not worked around.` } });
    }
    if (httpStatus === 429) {
      return base('blocked', config.provider, { error: { code: 'HTTP_429', message: 'Provider rate limited this search.' } });
    }
    if (httpStatus < 200 || httpStatus >= 300) {
      return base('failed', config.provider, { error: { code: `HTTP_${httpStatus}`, message: `Provider returned HTTP ${httpStatus}.` } });
    }

    let body;
    try {
      body = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
    } catch (e) {
      return base('failed', config.provider, { error: { code: 'BODY_READ_FAILED', message: `Could not read the provider response: ${e.message}` } });
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return base('failed', config.provider, { error: { code: 'BAD_JSON', message: 'Provider response was not JSON.' } });
    }

    const parsed = parsePayload(config.provider, data);
    if (parsed.unrecognised) {
      return base('failed', config.provider, { error: { code: 'UNEXPECTED_SHAPE', message: parsed.unrecognised } });
    }

    const rows = parsed.rows;
    const seen = new Set();
    const kept = [];
    let droppedDisallowed = 0;
    let droppedDuplicate = 0;
    let droppedUnusable = 0;

    for (const row of rows) {
      const key = normalizeUrlKey(row.url);
      if (!key) { droppedUnusable += 1; continue; } // no URL means no lead; nothing is filled in for it
      const domain = new URL(key).hostname;
      if (!isHostAllowed(domain, allowHosts)) { droppedDisallowed += 1; continue; }
      if (seen.has(key)) { droppedDuplicate += 1; continue; }
      seen.add(key);
      kept.push({ title: clean(row.title, MAX_TITLE), url: key, snippet: clean(row.snippet, MAX_SNIPPET), domain });
    }

    const results = kept.slice(0, cap);
    const status = results.length ? 'ok' : 'no_match';
    return {
      ...base(status, config.provider),
      elapsedMs: Date.now() - startedAt,
      results,
      totalResults: results.length,
      providerReturned: rows.length,
      droppedDisallowed,
      droppedDuplicate,
      droppedUnusable,
      droppedOverLimit: kept.length - results.length,
      uniqueDomains: new Set(results.map((r) => r.domain)).size,
    };
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.code === 'ABORT_ERR')) {
      return base('timeout', config.provider, { error: { code: 'TIMEOUT', message: `Provider did not answer within ${timeoutMs} ms.` } });
    }
    return base('failed', config.provider, { error: { code: 'NETWORK_ERROR', message: `${e.code || e.name || 'Error'}: ${e.message}` } });
  } finally {
    clearTimeout(timer);
  }
}
