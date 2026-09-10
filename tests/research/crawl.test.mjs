import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crawlLinkedPages, extractLinks, clearCrawlCache, retrievalCountDelta } from '../../server/research/index.mjs';

// Adapter unit tests. Both network layers are controlled: no live DNS, no live fetch.
const START = 'https://www.loc.gov/start';
const RECORD_HTML = '<html><head><title>Record page</title></head><body><p>Kochnev, Zhulanovo, 1889.</p></body></html>';

const PAGES = {
  [START]: `<html><head><title>Index</title></head><body>
    <p>Family index.</p>
    <a href="/item/1">One</a>
    <a href="item/2">Two</a>
    <a href="#top">Top of page</a>
    <a href="mailto:archive@example.com">Mail</a>
    <a href="javascript:void(0)">Script</a>
    <a href="https://en.wikipedia.org/wiki/Perm">Context</a>
    <a href="https://evil.example.org/x">Off allowlist</a>
  </body></html>`,
  // Two distinct URLs carrying the same text, so duplicate detection has something to find.
  'https://www.loc.gov/item/1': RECORD_HTML,
  'https://www.loc.gov/item/2': RECORD_HTML,
  'https://en.wikipedia.org/wiki/Perm': '<html><head><title>Perm</title></head><body><p>Governorate.</p></body></html>',
};

const asBody = (s) => {
  const b = Buffer.from(s, 'utf8');
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

const htmlResponse = (html) => ({
  status: 200,
  ok: true,
  headers: { get: (k) => (k === 'content-type' ? 'text/html; charset=utf-8' : null) },
  arrayBuffer: async () => asBody(html),
});

/** Fresh spy per test: the cache is process-wide, so state never leaks between cases. */
function makeFetch(overrides = {}) {
  const calls = [];
  const pages = { ...PAGES, ...overrides };
  const fetchImpl = async (url) => {
    calls.push(url);
    const entry = pages[url];
    if (typeof entry === 'function') return entry();
    if (entry == null) {
      return { status: 404, ok: false, headers: { get: () => 'text/plain' }, arrayBuffer: async () => asBody('not found') };
    }
    return htmlResponse(entry);
  };
  return { fetchImpl, calls };
}

const dnsImpl = async () => [{ address: '93.184.216.34', family: 4 }];

test('extractLinks resolves relative URLs and skips what is not a page', () => {
  const links = extractLinks(PAGES[START], START);
  assert.deepEqual(links, [
    'https://www.loc.gov/item/1',
    'https://www.loc.gov/item/2',
    'https://en.wikipedia.org/wiki/Perm',
    'https://evil.example.org/x',
  ]);
  assert.deepEqual(extractLinks('<a href="/a">x</a><a href="/a/">again</a>', START), ['https://www.loc.gov/a']);
  assert.deepEqual(extractLinks('<p>no links</p>', START), []);
});

test('the crawl never exceeds maxPages', async () => {
  clearCrawlCache();
  const { fetchImpl, calls } = makeFetch();
  const r = await crawlLinkedPages({ startUrl: START, maxPages: 2, maxDepth: 1, fetchImpl, dnsImpl });

  assert.equal(r.status, 'ok');
  assert.equal(r.pages.length, 2);
  assert.equal(r.visitedCount, 2);
  assert.equal(calls.length, 2, 'the page budget bounds actual fetches');
  assert.equal(r.pages[0].url, START);
  assert.equal(r.pages[0].title, 'Index');
  assert.equal(r.pages[0].depth, 0);
  assert.equal(r.pages[1].depth, 1);
});

test('maxDepth 0 keeps the crawl on the start page', async () => {
  clearCrawlCache();
  const { fetchImpl, calls } = makeFetch();
  const r = await crawlLinkedPages({ startUrl: START, maxPages: 5, maxDepth: 0, fetchImpl, dnsImpl });

  assert.equal(r.pages.length, 1);
  assert.deepEqual(calls, [START]);
  assert.equal(r.blocked.length, 0, 'links beyond the depth limit are not even considered');
});

test('sameHostOnly keeps the crawl on the host it started from', async () => {
  clearCrawlCache();
  const { fetchImpl, calls } = makeFetch();
  const r = await crawlLinkedPages({ startUrl: START, maxPages: 5, maxDepth: 1, sameHostOnly: true, fetchImpl, dnsImpl });

  assert.equal(r.pages.length, 3);
  assert.deepEqual(r.pages.map((p) => p.url), [START, 'https://www.loc.gov/item/1', 'https://www.loc.gov/item/2']);
  assert.equal(r.uniqueDomains, 1);
  const wiki = r.blocked.find((b) => b.url.includes('en.wikipedia.org'));
  assert.equal(wiki.reason, 'different_host');
  assert.equal(calls.some((u) => u.includes('en.wikipedia.org')), false, 'a cross-host link is never requested');
});

test('a disallowed host is recorded with the reason the fetch returned, never followed', async () => {
  clearCrawlCache();
  const { fetchImpl, calls } = makeFetch();
  const r = await crawlLinkedPages({ startUrl: START, maxPages: 6, maxDepth: 1, sameHostOnly: false, fetchImpl, dnsImpl });

  const refused = r.blocked.find((b) => b.url.includes('evil.example.org'));
  assert.equal(refused.reason, 'HOST_NOT_ALLOWED');
  assert.match(refused.message, /not on the approved public-source list/);
  assert.equal(calls.some((u) => u.includes('evil.example.org')), false, 'a refused host is never requested');
  assert.equal(r.pages.some((p) => p.url.includes('evil.example.org')), false);
  // With sameHostOnly off, the allowlisted cross-host link is legitimate work.
  assert.ok(r.pages.some((p) => p.url === 'https://en.wikipedia.org/wiki/Perm'));
  assert.equal(r.uniqueDomains, 2);
});

test('a refused start URL fails the crawl instead of retrieving anything', async () => {
  clearCrawlCache();
  const { fetchImpl, calls } = makeFetch();
  const r = await crawlLinkedPages({ startUrl: 'https://evil.example.org/x', fetchImpl, dnsImpl });

  assert.equal(r.status, 'blocked');
  assert.equal(r.pages.length, 0);
  assert.equal(r.blocked[0].reason, 'HOST_NOT_ALLOWED');
  assert.equal(calls.length, 0);

  const bad = await crawlLinkedPages({ startUrl: 'file:///etc/passwd', fetchImpl, dnsImpl });
  assert.equal(bad.status, 'failed');
  assert.equal(bad.error.code, 'BAD_URL');
  assert.equal(calls.length, 0);
});

test('a second crawl in the same run is served from cache and retrieves nothing new', async () => {
  clearCrawlCache();
  const { fetchImpl, calls } = makeFetch();
  const args = { startUrl: START, maxPages: 5, maxDepth: 1, fetchImpl, dnsImpl };

  const first = await crawlLinkedPages(args);
  const fetchesAfterFirst = calls.length;
  assert.equal(first.cachedCount, 0);
  assert.equal(first.pages.every((p) => p.fromCache === false), true);

  const second = await crawlLinkedPages(args);
  assert.equal(calls.length, fetchesAfterFirst, 'a cached crawl makes no new request');
  assert.equal(second.pages.length, first.pages.length);
  assert.equal(second.cachedCount, second.pages.length);
  assert.equal(second.pages.every((p) => p.fromCache === true), true);
  assert.deepEqual(second.pages.map((p) => p.fetchedAt), first.pages.map((p) => p.fetchedAt), 'a cache hit keeps the original retrieval time');

  const firstDelta = retrievalCountDelta(first);
  const secondDelta = retrievalCountDelta(second);
  assert.equal(firstDelta.pagesRetrieved, 3);
  assert.equal(firstDelta.uniqueDomains, 1);
  assert.equal(secondDelta.pagesRetrieved, 0, 'a cache hit is not a retrieval');
  assert.equal(secondDelta.cachedPages, 3);
  assert.equal(secondDelta.uniqueDomains, 0);
  assert.equal(retrievalCountDelta([first, second]).pagesRetrieved, 3, 'the same page twice is still one page');
});

test('the same text under two URLs is reported as a duplicate evidence root', async () => {
  clearCrawlCache();
  const { fetchImpl } = makeFetch();
  const r = await crawlLinkedPages({ startUrl: START, maxPages: 5, maxDepth: 1, fetchImpl, dnsImpl });

  const one = r.pages.find((p) => p.url.endsWith('/item/1'));
  const two = r.pages.find((p) => p.url.endsWith('/item/2'));
  assert.equal(one.textHash, two.textHash);
  assert.notEqual(one.url, two.url);
  assert.equal(r.duplicateTextRoots, 1);
  assert.ok(one.textLength > 0 && one.bytes > 0);
});

test('a page that times out is recorded as an attempt and counts as nothing retrieved', async () => {
  clearCrawlCache();
  const { fetchImpl } = makeFetch({
    'https://www.loc.gov/item/2': () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); },
  });
  const r = await crawlLinkedPages({ startUrl: START, maxPages: 5, maxDepth: 1, fetchImpl, dnsImpl });

  const failed = r.pages.find((p) => p.url.endsWith('/item/2'));
  assert.equal(failed.status, 'timeout');
  assert.equal(failed.textHash, null);
  assert.equal(r.status, 'ok', 'one bad link does not fail the whole crawl');
  assert.equal(retrievalCountDelta(r).pagesRetrieved, 2);
  assert.equal(r.uniqueDomains, 1);
});

test('a start page whose own fetch fails reports the failure', async () => {
  clearCrawlCache();
  const { fetchImpl } = makeFetch({ [START]: null });
  const r = await crawlLinkedPages({ startUrl: START, fetchImpl, dnsImpl });
  assert.equal(r.status, 'failed');
  assert.equal(r.error.code, 'HTTP_404');
  assert.equal(r.pages[0].status, 'unavailable');
  assert.equal(retrievalCountDelta(r).pagesRetrieved, 0);
});
