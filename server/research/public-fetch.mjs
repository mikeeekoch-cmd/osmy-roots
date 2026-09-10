/**
 * One bounded public-record fetch.
 *
 * Safety rules enforced here, not left to the caller:
 *  - HTTPS/HTTP only, host must be on the approved public-source allowlist.
 *  - Every hop (including redirects) is re-validated against the allowlist.
 *  - DNS is resolved and private/loopback/link-local/CGNAT targets are refused (SSRF).
 *  - Hard caps: 8 s and 2 MB by default; the body is truncated, not buffered unbounded.
 *  - Login, paywall and CAPTCHA responses are reported, never bypassed.
 *
 * A successful fetch is a candidate source. It is never proof of kinship.
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { sha256 } from '../ingestion/hash.mjs';
import { ORIGIN } from '../contracts/types.mjs';

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

/** Approved public genealogy/reference sources from the private research playbook. */
export const ALLOWED_HOSTS = Object.freeze([
  'loc.gov', 'www.loc.gov',
  'archives.gov', 'www.archives.gov',
  'catalog.archives.gov',
  'pamyat-naroda.ru', 'www.pamyat-naroda.ru',
  'obd-memorial.ru', 'www.obd-memorial.ru',
  'archive74.ru', 'www.archive74.ru',
  'szukajwarchiwach.gov.pl', 'www.szukajwarchiwach.gov.pl',
  'yandex.ru', 'ya.ru',
  'familysearch.org', 'www.familysearch.org',
  'en.wikipedia.org', 'ru.wikipedia.org',
  'example.com', 'www.example.com',
]);

function hostAllowed(hostname, allowHosts) {
  const h = String(hostname || '').toLowerCase();
  return (allowHosts || ALLOWED_HOSTS).some((a) => h === a || h.endsWith(`.${a}`));
}

/** True for loopback, private, link-local, CGNAT, multicast and reserved space. */
export function isPrivateAddress(ip) {
  if (!ip) return true;
  const addr = String(ip);
  if (net.isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(addr)) {
    const l = addr.toLowerCase();
    if (l === '::' || l === '::1') return true;
    if (l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd')) return true;
    if (l.startsWith('ff')) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

/** Resolve and refuse any host that points at private space. */
async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw Object.assign(new Error(`Refused private address ${hostname}`), { code: 'BLOCKED_PRIVATE' });
    return [hostname];
  }
  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (e) {
    throw Object.assign(new Error(`DNS lookup failed for ${hostname}: ${e.code || e.message}`), { code: 'DNS_FAILED' });
  }
  if (!records.length) throw Object.assign(new Error(`No DNS records for ${hostname}`), { code: 'DNS_FAILED' });
  for (const r of records) {
    if (isPrivateAddress(r.address)) {
      throw Object.assign(new Error(`Refused ${hostname}: resolves to private address ${r.address}`), { code: 'BLOCKED_PRIVATE' });
    }
  }
  return records.map((r) => r.address);
}

/** Minimal, dependency-free HTML to text. Keeps readable order, drops scripts/styles. */
export function htmlToText(html) {
  let s = String(html);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|br)\s*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').split('\n').map((l) => l.trim()).join('\n').trim();
}

export function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html));
  return m ? htmlToText(m[1]).slice(0, 300) : null;
}

/** Responses that mean "you are not allowed", which we report rather than work around. */
function accessBarrier(status, text) {
  if (status === 401 || status === 403) return `HTTP ${status}: access requires authorisation. Not bypassed.`;
  if (status === 429) return 'HTTP 429: rate limited by the source.';
  if (status === 451) return 'HTTP 451: unavailable for legal reasons.';
  const t = String(text || '').slice(0, 4000).toLowerCase();
  if (/captcha|recaptcha|are you a robot|подтвердите, что вы не робот/.test(t)) return 'Response contains a CAPTCHA challenge. Not bypassed.';
  if (/sign in to continue|please log in|войдите в аккаунт/.test(t)) return 'Response requires sign-in. Not bypassed.';
  return null;
}

/**
 * @param {object} args
 * @param {string} args.url
 * @param {number} [args.timeoutMs]
 * @param {number} [args.maxBytes]
 * @param {string[]} [args.allowHosts]  override allowlist (Mike can supply a specific record host)
 * @param {number} [args.maxRedirects]
 * @returns {Promise<{status:string, source?:object, finalUrl?:string, retrievedAt?:string, error?:object}>}
 */
export async function fetchPublicRecord({
  url, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES,
  allowHosts, maxRedirects = 3, fetchImpl,
} = {}) {
  const startedAt = Date.now();
  const fail = (status, code, message, extra = {}) => ({
    status, finalUrl: extra.finalUrl || null, retrievedAt: new Date().toISOString(),
    error: { code, message }, elapsedMs: Date.now() - startedAt, requestedUrl: url || null,
  });

  let current;
  try {
    current = new URL(String(url));
  } catch {
    return fail('unavailable', 'BAD_URL', `Not a valid URL: ${url}`);
  }
  if (!['http:', 'https:'].includes(current.protocol)) {
    return fail('blocked', 'BAD_SCHEME', `Refused scheme ${current.protocol}. Only http and https are fetched.`);
  }

  const doFetch = fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    let hops = 0;
    for (;;) {
      if (!hostAllowed(current.hostname, allowHosts)) {
        return fail('not_allowed', 'HOST_NOT_ALLOWED',
          `${current.hostname} is not on the approved public-source list. Ask Mike to approve the exact record host.`,
          { finalUrl: current.toString() });
      }
      try {
        await assertPublicHost(current.hostname);
      } catch (e) {
        return fail(e.code === 'DNS_FAILED' ? 'unavailable' : 'blocked', e.code, e.message, { finalUrl: current.toString() });
      }

      response = await doFetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'osmy-roots-prototype/0.1 (hackathon research prototype; contact via repository)',
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'accept-language': 'en,ru;q=0.8',
        },
      });

      const location = response.headers.get('location');
      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        hops += 1;
        if (hops > maxRedirects) {
          return fail('unavailable', 'TOO_MANY_REDIRECTS', `More than ${maxRedirects} redirects from ${url}.`, { finalUrl: current.toString() });
        }
        current = new URL(location, current); // re-validated at the top of the loop
        continue;
      }
      break;
    }

    const finalUrl = current.toString();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Read with a hard byte cap instead of buffering whatever arrives.
    const chunks = [];
    let total = 0;
    let truncated = false;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          chunks.push(Buffer.from(value.buffer, value.byteOffset, Math.max(0, value.byteLength - (total - maxBytes))));
          truncated = true;
          try { await reader.cancel(); } catch { /* already closed */ }
          break;
        }
        chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
      }
    } else {
      const ab = await response.arrayBuffer();
      const buf = Buffer.from(ab);
      truncated = buf.length > maxBytes;
      chunks.push(truncated ? buf.subarray(0, maxBytes) : buf);
    }
    const bytes = Buffer.concat(chunks);

    if (!response.ok) {
      const barrier = accessBarrier(response.status, bytes.toString('utf8'));
      return fail(response.status === 404 ? 'unavailable' : 'blocked', `HTTP_${response.status}`,
        barrier || `HTTP ${response.status} from ${finalUrl}`, { finalUrl });
    }

    const rawText = bytes.toString('utf8');
    const barrier = accessBarrier(response.status, rawText);
    if (barrier) return fail('blocked', 'ACCESS_BARRIER', barrier, { finalUrl });

    const isHtml = /text\/html|application\/xhtml/i.test(contentType);
    const text = isHtml ? htmlToText(rawText) : rawText;
    const title = isHtml ? extractTitle(rawText) : null;
    const contentHash = sha256(bytes);
    const retrievedAt = new Date().toISOString();

    return {
      status: 'ok',
      finalUrl,
      retrievedAt,
      elapsedMs: Date.now() - startedAt,
      truncated,
      source: {
        id: `SRC_WEB_${contentHash.slice(0, 10)}`,
        kind: 'archive_record',
        originalLocator: `${finalUrl}#chars:0-${text.length}`,
        contentHash,
        origin: ORIGIN.LIVE,
        author: null,
        messageTimestamp: null,
        parentAttachmentId: null,
        originalText: text,
        title: title || finalUrl,
        mediaType: contentType.split(';')[0].trim(),
        byteLength: bytes.length,
        retrievedAt,
        finalUrl,
        httpStatus: response.status,
        truncated,
        publicUseApproved: false,
        rightsNote: 'Retrieved public page. Check the source’s own terms before reproducing content.',
        note: 'A retrieved page is a candidate source. It does not establish a family relationship.',
        segments: text ? [{ index: 1, startLine: 1, endLine: text.split('\n').length, locator: `${finalUrl}#chars:0-${text.length}`, text }] : [],
      },
    };
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.code === 'ABORT_ERR')) {
      return fail('timeout', 'TIMEOUT', `No response within ${timeoutMs} ms.`, { finalUrl: current?.toString() });
    }
    return fail('unavailable', 'NETWORK_ERROR', `${e.code || e.name || 'Error'}: ${e.message}`, { finalUrl: current?.toString() });
  } finally {
    clearTimeout(timer);
  }
}
