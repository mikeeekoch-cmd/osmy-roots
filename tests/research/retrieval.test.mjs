import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLocalSources, fetchPublicRecord, isPrivateAddress, htmlToText, websiteCountDelta } from '../../server/research/index.mjs';
import { ingestContribution } from '../../server/ingestion/index.mjs';

const sourcesFor = async (text) => (await ingestContribution({ text })).sources;

test('local search finds a real phrase and returns its exact locator', async () => {
  const sources = await sourcesFor('I remember my grandfather Alex Morgan repairing watches in his workshop.');
  const r = await searchLocalSources({ query: 'Alex Morgan watches', sources });
  assert.equal(r.status, 'hit');
  assert.ok(r.hits[0].snippet.includes('Alex Morgan'));
  assert.match(r.hits[0].locator, /#L1/);
  assert.equal(r.hits[0].sourceId, sources[0].id);
});

test('local search reports no_match instead of returning something plausible', async () => {
  const sources = await sourcesFor('I remember my grandfather Alex Morgan repairing watches.');
  const r = await searchLocalSources({ query: 'Zhulanovo parish register 1889', sources });
  assert.equal(r.status, 'no_match');
  assert.equal(r.hits.length, 0);
});

test('local search is driven by the query, not a prerecorded list', async () => {
  const sources = await sourcesFor('Alpha paragraph about boats.\n\nBeta paragraph about horses.');
  const boats = await searchLocalSources({ query: 'boats', sources });
  const horses = await searchLocalSources({ query: 'horses', sources });
  assert.notEqual(boats.hits[0].locator, horses.hits[0].locator);
});

test('an empty query is rejected rather than matching everything', async () => {
  const sources = await sourcesFor('Some text.');
  assert.equal((await searchLocalSources({ query: '   ', sources })).status, 'invalid_query');
});

test('local search over Cyrillic source text works', async () => {
  const sources = await sourcesFor('Иван Герасимович делал кожаную упряжь для лошадей.');
  const r = await searchLocalSources({ query: 'упряжь', sources });
  assert.equal(r.status, 'hit');
});

test('private and reserved addresses are refused', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateAddress(ip), true, `${ip} must be blocked`);
  }
  for (const ip of ['8.8.8.8', '93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be allowed`);
  }
});

test('non-http schemes and off-allowlist hosts are refused before any request', async () => {
  let called = false;
  const spy = async () => { called = true; throw new Error('should not be reached'); };
  assert.equal((await fetchPublicRecord({ url: 'file:///etc/passwd', fetchImpl: spy })).error.code, 'BAD_SCHEME');
  assert.equal((await fetchPublicRecord({ url: 'http://localhost:9000/', fetchImpl: spy })).error.code, 'HOST_NOT_ALLOWED');
  assert.equal((await fetchPublicRecord({ url: 'https://evil.example.org/', fetchImpl: spy })).error.code, 'HOST_NOT_ALLOWED');
  assert.equal((await fetchPublicRecord({ url: 'not a url', fetchImpl: spy })).error.code, 'BAD_URL');
  assert.equal(called, false, 'no network call may be made for a refused target');
});

test('a redirect to an off-allowlist host is refused at the hop', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('loc.gov')) {
      return { status: 302, ok: false, headers: new Map([['location', 'https://evil.example.org/x']]), arrayBuffer: async () => new ArrayBuffer(0) };
    }
    throw new Error('followed a redirect it should have refused');
  };
  const r = await fetchPublicRecord({ url: 'https://www.loc.gov/item/1', fetchImpl: (u, o) => fetchImpl(u, o).then((x) => ({ ...x, headers: { get: (k) => x.headers.get(k) } })) });
  assert.equal(r.status, 'not_allowed');
  assert.equal(r.error.code, 'HOST_NOT_ALLOWED');
});

test('a redirect loop is bounded', async () => {
  const fetchImpl = async () => ({
    status: 302, ok: false,
    headers: { get: (k) => (k === 'location' ? 'https://www.loc.gov/next' : null) },
    arrayBuffer: async () => new ArrayBuffer(0),
  });
  const r = await fetchPublicRecord({ url: 'https://www.loc.gov/a', fetchImpl, maxRedirects: 2 });
  assert.equal(r.error.code, 'TOO_MANY_REDIRECTS');
});

test('a sign-in or CAPTCHA wall is reported, never bypassed', async () => {
  const body = Buffer.from('<html><body>Please log in to continue</body></html>');
  const fetchImpl = async () => ({
    status: 200, ok: true,
    headers: { get: (k) => (k === 'content-type' ? 'text/html' : null) },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
  const r = await fetchPublicRecord({ url: 'https://www.loc.gov/item/1', fetchImpl });
  assert.equal(r.status, 'blocked');
  assert.equal(r.error.code, 'ACCESS_BARRIER');
  assert.match(r.error.message, /Not bypassed/);
});

test('HTTP 403 is surfaced as blocked', async () => {
  const body = Buffer.from('nope');
  const fetchImpl = async () => ({
    status: 403, ok: false,
    headers: { get: () => 'text/plain' },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
  const r = await fetchPublicRecord({ url: 'https://www.loc.gov/item/1', fetchImpl });
  assert.equal(r.status, 'blocked');
  assert.equal(r.error.code, 'HTTP_403');
});

test('the byte cap truncates instead of buffering without limit', async () => {
  const big = Buffer.alloc(50_000, 0x61);
  const fetchImpl = async () => ({
    status: 200, ok: true,
    headers: { get: (k) => (k === 'content-type' ? 'text/plain' : null) },
    arrayBuffer: async () => big.buffer.slice(big.byteOffset, big.byteOffset + big.byteLength),
  });
  const r = await fetchPublicRecord({ url: 'https://www.loc.gov/big', fetchImpl, maxBytes: 1000 });
  assert.equal(r.status, 'ok');
  assert.equal(r.truncated, true);
  assert.equal(r.source.byteLength, 1000);
});

test('a successful fetch yields a citable source envelope', async () => {
  const html = Buffer.from('<html><head><title>Record 42</title></head><body><p>Ivan Kochnev, 1889.</p></body></html>');
  const fetchImpl = async () => ({
    status: 200, ok: true,
    headers: { get: (k) => (k === 'content-type' ? 'text/html; charset=utf-8' : null) },
    arrayBuffer: async () => html.buffer.slice(html.byteOffset, html.byteOffset + html.byteLength),
  });
  const r = await fetchPublicRecord({ url: 'https://www.loc.gov/item/42', fetchImpl });
  assert.equal(r.status, 'ok');
  assert.equal(r.source.title, 'Record 42');
  assert.equal(r.source.origin, 'live');
  assert.ok(r.source.contentHash);
  assert.ok(r.source.retrievedAt);
  assert.match(r.source.originalLocator, /^https:\/\/www\.loc\.gov\/item\/42#chars:/);
  assert.ok(r.source.originalText.includes('Ivan Kochnev'));
  assert.equal(r.source.publicUseApproved, false);
});

test('only a real successful retrieval may increment the website counter', async () => {
  assert.equal(websiteCountDelta({ status: 'ok', source: { origin: 'live' } }), 1);
  assert.equal(websiteCountDelta({ status: 'ok', source: { origin: 'cached' } }), 0);
  assert.equal(websiteCountDelta({ status: 'timeout' }), 0);
  assert.equal(websiteCountDelta({ status: 'blocked' }), 0);
  assert.equal(websiteCountDelta(null), 0);
});

test('html to text drops scripts and keeps readable order', () => {
  const out = htmlToText('<html><script>bad()</script><h1>Title</h1><p>One</p><p>Two &amp; three</p></html>');
  assert.equal(out.includes('bad()'), false);
  assert.match(out, /Title/);
  assert.match(out, /Two & three/);
});
