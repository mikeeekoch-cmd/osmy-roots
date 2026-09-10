import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSearchProviderConfig, searchPublicRecords, retrievalCountDelta } from '../../server/research/index.mjs';

// Adapter unit tests. No live provider is contacted: every case injects fetchImpl,
// and a test that must prove nothing was requested asserts the spy was never called.
const BRAVE_ENV = { ROOTS_SEARCH_PROVIDER: 'brave', ROOTS_SEARCH_API_KEY: 'test-key' };
const SERP_ENV = { ROOTS_SEARCH_PROVIDER: 'serpapi', ROOTS_SEARCH_API_KEY: 'test-key' };

const respondWith = (payload, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => 'application/json' },
  text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
});

/** Records the request so a test can check the endpoint, key placement and query. */
function spyFetch(payload, status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return respondWith(payload, status);
  };
  return { fetchImpl, calls };
}

const braveBody = (results) => ({ type: 'search', web: { type: 'search', results } });

test('with no provider configured the adapter reports it and returns nothing', async () => {
  let called = false;
  const spy = async () => { called = true; throw new Error('no provider may be contacted'); };
  const config = getSearchProviderConfig({});
  assert.equal(config.configured, false);
  assert.equal(config.provider, null);
  assert.match(config.reason, /ROOTS_SEARCH_PROVIDER/);

  const r = await searchPublicRecords({ query: 'Kochnev 1889 Zhulanovo', env: {}, fetchImpl: spy });
  assert.equal(r.status, 'not_configured');
  assert.equal(r.provider, null);
  assert.deepEqual(r.results, []);
  assert.equal(r.totalResults, 0);
  assert.equal(called, false, 'nothing may be requested without a provider');
  // The rule that matters most: no URL is invented to fill an empty result.
  assert.equal(JSON.stringify(r).includes('http'), false);
});

test('a provider without a key, an unknown provider and "none" all stay unconfigured', async () => {
  assert.equal(getSearchProviderConfig({ ROOTS_SEARCH_PROVIDER: 'brave' }).configured, false);
  assert.match(getSearchProviderConfig({ ROOTS_SEARCH_PROVIDER: 'brave' }).reason, /ROOTS_SEARCH_API_KEY/);
  assert.equal(getSearchProviderConfig({ ROOTS_SEARCH_PROVIDER: 'none', ROOTS_SEARCH_API_KEY: 'k' }).configured, false);
  assert.match(getSearchProviderConfig({ ROOTS_SEARCH_PROVIDER: 'bing', ROOTS_SEARCH_API_KEY: 'k' }).reason, /Unsupported/);

  const r = await searchPublicRecords({ query: 'x', env: { ROOTS_SEARCH_PROVIDER: 'brave' }, fetchImpl: async () => { throw new Error('unreachable'); } });
  assert.equal(r.status, 'not_configured');
  assert.equal(r.results.length, 0);
});

test('a configured Brave search returns parsed, deduplicated, allowlisted results', async () => {
  const { fetchImpl, calls } = spyFetch(braveBody([
    { title: 'Record 1', url: 'https://www.loc.gov/item/1', description: 'Kochnev, 1889' },
    { title: 'Record 1 again', url: 'https://www.loc.gov/item/1/#top', description: 'same page' },
    { title: 'Wiki', url: 'https://en.wikipedia.org/wiki/Perm', description: 'Perm governorate' },
  ]));
  const r = await searchPublicRecords({ query: 'Kochnev 1889', limit: 5, env: BRAVE_ENV, fetchImpl });

  assert.equal(r.status, 'ok');
  assert.equal(r.provider, 'brave');
  assert.equal(r.results.length, 2);
  assert.equal(r.totalResults, 2);
  assert.equal(r.providerReturned, 3);
  assert.equal(r.droppedDuplicate, 1);
  assert.equal(r.uniqueDomains, 2);
  assert.deepEqual(r.results.map((x) => x.url), ['https://www.loc.gov/item/1', 'https://en.wikipedia.org/wiki/Perm']);
  assert.deepEqual(r.results.map((x) => x.domain), ['www.loc.gov', 'en.wikipedia.org']);
  assert.equal(r.results[0].snippet, 'Kochnev, 1889');
  assert.ok(r.attemptedAt);

  const sent = new URL(calls[0].url);
  assert.equal(sent.origin + sent.pathname, 'https://api.search.brave.com/res/v1/web/search');
  assert.equal(sent.searchParams.get('q'), 'Kochnev 1889');
  assert.equal(sent.searchParams.get('count'), '5');
  assert.equal(calls[0].init.headers['X-Subscription-Token'], 'test-key');
});

test('a provider host outside the allowlist is dropped and counted', async () => {
  const { fetchImpl } = spyFetch(braveBody([
    { title: 'Approved', url: 'https://www.archives.gov/record/7', description: 'ok' },
    { title: 'Not approved', url: 'https://evil.example.org/x', description: 'no' },
    { title: 'Also not approved', url: 'http://192.168.0.5/admin', description: 'no' },
  ]));
  const r = await searchPublicRecords({ query: 'archive', env: BRAVE_ENV, fetchImpl });

  assert.equal(r.status, 'ok');
  assert.equal(r.droppedDisallowed, 2);
  assert.deepEqual(r.results.map((x) => x.url), ['https://www.archives.gov/record/7']);
  assert.equal(JSON.stringify(r.results).includes('evil.example.org'), false);
});

test('a row without a usable URL is dropped rather than completed with a guess', async () => {
  const { fetchImpl } = spyFetch(braveBody([
    { title: 'Looks relevant', description: 'no link at all' },
    { title: 'Bad scheme', url: 'javascript:alert(1)', description: 'no' },
  ]));
  const r = await searchPublicRecords({ query: 'Kochnev', env: BRAVE_ENV, fetchImpl });
  assert.equal(r.status, 'no_match');
  assert.equal(r.droppedUnusable, 2);
  assert.deepEqual(r.results, []);
});

test('SerpAPI organic results are parsed and the limit is honoured', async () => {
  const { fetchImpl, calls } = spyFetch({
    search_metadata: { status: 'Success' },
    search_information: { total_results: 4 },
    organic_results: [
      { title: 'A', link: 'https://www.loc.gov/a', snippet: 'a' },
      { title: 'B', link: 'https://www.archives.gov/b', snippet: 'b' },
      { title: 'C', link: 'https://ru.wikipedia.org/c', snippet: 'c' },
    ],
  });
  const r = await searchPublicRecords({ query: 'parish register', limit: 2, env: SERP_ENV, fetchImpl });

  assert.equal(r.status, 'ok');
  assert.equal(r.provider, 'serpapi');
  assert.equal(r.results.length, 2);
  assert.equal(r.droppedOverLimit, 1);
  assert.equal(r.uniqueDomains, 2);

  const sent = new URL(calls[0].url);
  assert.equal(sent.origin + sent.pathname, 'https://serpapi.com/search.json');
  assert.equal(sent.searchParams.get('engine'), 'google');
  assert.equal(sent.searchParams.get('api_key'), 'test-key');
  assert.equal(sent.searchParams.get('num'), '2');
});

test('an empty provider answer is no_match, not an empty guess', async () => {
  const brave = await searchPublicRecords({ query: 'nothing here', env: BRAVE_ENV, fetchImpl: spyFetch(braveBody([])).fetchImpl });
  assert.equal(brave.status, 'no_match');
  assert.equal(brave.results.length, 0);
  assert.equal(brave.providerReturned, 0);

  const serp = await searchPublicRecords({ query: 'nothing here', env: SERP_ENV, fetchImpl: spyFetch({ search_information: { total_results: 0 } }).fetchImpl });
  assert.equal(serp.status, 'no_match');
  assert.equal(serp.results.length, 0);
});

test('results that are all off-allowlist leave no_match rather than a usable-looking list', async () => {
  const { fetchImpl } = spyFetch(braveBody([{ title: 'X', url: 'https://evil.example.org/x', description: 'no' }]));
  const r = await searchPublicRecords({ query: 'x', env: BRAVE_ENV, fetchImpl });
  assert.equal(r.status, 'no_match');
  assert.equal(r.droppedDisallowed, 1);
  assert.deepEqual(r.results, []);
});

test('an aborted request is reported as a timeout', async () => {
  // The fetch resolves only when the adapter's own AbortController fires.
  const hanging = (url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const r = await searchPublicRecords({ query: 'slow', env: BRAVE_ENV, fetchImpl: hanging, timeoutMs: 15 });
  assert.equal(r.status, 'timeout');
  assert.equal(r.error.code, 'TIMEOUT');
  assert.deepEqual(r.results, []);
});

test('non-JSON and unrecognised shapes are failures, not guesses', async () => {
  const notJson = await searchPublicRecords({ query: 'x', env: BRAVE_ENV, fetchImpl: spyFetch('<html>rate limit page</html>').fetchImpl });
  assert.equal(notJson.status, 'failed');
  assert.equal(notJson.error.code, 'BAD_JSON');

  const wrongShape = await searchPublicRecords({ query: 'x', env: BRAVE_ENV, fetchImpl: spyFetch({ unexpected: true }).fetchImpl });
  assert.equal(wrongShape.status, 'failed');
  assert.equal(wrongShape.error.code, 'UNEXPECTED_SHAPE');
  assert.deepEqual(wrongShape.results, []);

  const serpShape = await searchPublicRecords({ query: 'x', env: SERP_ENV, fetchImpl: spyFetch({ nothing: 1 }).fetchImpl });
  assert.equal(serpShape.status, 'failed');
  assert.equal(serpShape.error.code, 'UNEXPECTED_SHAPE');
});

test('provider refusal and rate limiting are reported as blocked', async () => {
  const denied = await searchPublicRecords({ query: 'x', env: BRAVE_ENV, fetchImpl: spyFetch({ error: 'bad key' }, 401).fetchImpl });
  assert.equal(denied.status, 'blocked');
  assert.equal(denied.error.code, 'HTTP_401');

  const limited = await searchPublicRecords({ query: 'x', env: BRAVE_ENV, fetchImpl: spyFetch({}, 429).fetchImpl });
  assert.equal(limited.status, 'blocked');
  assert.equal(limited.error.code, 'HTTP_429');

  const broken = await searchPublicRecords({ query: 'x', env: BRAVE_ENV, fetchImpl: spyFetch({}, 500).fetchImpl });
  assert.equal(broken.status, 'failed');
  assert.equal(broken.error.code, 'HTTP_500');
});

test('only an answered search counts, and a repeat of the same query does not', async () => {
  const answered = await searchPublicRecords({ query: 'Kochnev', env: BRAVE_ENV, fetchImpl: spyFetch(braveBody([{ title: 'A', url: 'https://www.loc.gov/a', description: 'a' }])).fetchImpl });
  const repeat = await searchPublicRecords({ query: 'Kochnev', env: BRAVE_ENV, fetchImpl: spyFetch(braveBody([{ title: 'A', url: 'https://www.loc.gov/a', description: 'a' }])).fetchImpl });
  const timedOut = await searchPublicRecords({ query: 'other', env: BRAVE_ENV, fetchImpl: spyFetch({}, 429).fetchImpl });
  const unconfigured = await searchPublicRecords({ query: 'other', env: {}, fetchImpl: async () => { throw new Error('unreachable'); } });

  assert.equal(retrievalCountDelta(answered).searchAttempts, 1);
  assert.equal(retrievalCountDelta(answered).pagesRetrieved, 0, 'a search retrieves no page');
  assert.equal(retrievalCountDelta([answered, repeat]).searchAttempts, 1, 'a retry cannot inflate the counter');
  assert.equal(retrievalCountDelta(timedOut).searchAttempts, 0);
  assert.equal(retrievalCountDelta(unconfigured).searchAttempts, 0);
});
