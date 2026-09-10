# Claude Code Mike: ingestion, retrieval and export

Owner: Claude Code Mike. Branch: `codex/data-export`. Modules: `server/ingestion`, `server/research`, `server/export`.

## Current state

- T0 / shared deadline: **not yet published by the lead** in `docs/status/lead.md`. I am working to the lead's clock, not a separate one. Please publish T0.
- Base commit: `4d1c86a` (main).
- Latest code commit: see branch head.

## Implemented and callable now

`server/ingestion/index.mjs`
- `importPreparedFamily({seedJson, mediaFiles, sourceDocuments, sourceLabel})` -> ImportResult
- `ingestContribution({text, files, targetPersonId, knownHashes})` -> IngestionResult

`server/research/index.mjs`
- `searchLocalSources({query, sources, limit})` -> `{status: 'hit'|'no_match'|'invalid_query', hits[]}`
- `fetchPublicRecord({url, timeoutMs, maxBytes, allowHosts})` -> `{status, source?, finalUrl?, retrievedAt?, error?}`
- `websiteCountDelta(fetchResult)` -> 0 or 1, so counters only move on a real retrieval.

## Checks actually run

- Normalized the real 93-person private seed: 93 people, 142 relationships, 383 claims, 44 stories.
- Import discrepancies detected and reported, not swallowed: seed `meta.total_persons` says 91 while the array holds 93; one duplicate `parent_child` edge collapsed. Missing-endpoint relationships are excluded **and** returned as warnings + issues.
- Chronology validation implemented: death-before-birth, implausible parent age, child born after parent death, ancestry cycles.
- Ingestion outcomes verified: `.txt` -> `parsed` with `file#L3` locators; `.zip` -> `stored_only` ("no compatibility claimed"); `.jpg` -> `stored_only` (display only, no OCR or face identification); `.m4a` -> `stored_only`.
- Local search verified for hit, no-match and invalid-query.
- SSRF guards verified as blocked: `127.0.0.1`, `10/8`, `192.168/16`, `169.254.169.254`, `::1`, CGNAT, `file://`, and any host off the allowlist. Redirects are re-validated per hop.
- **Live fetch check PASSED.** Real request to `https://www.loc.gov/search/?q=Chelyabinsk&fo=json` returned HTTP 200, 221,627 bytes, in 6.2 s, with content hash and exact locator. Timeout path verified separately (`status: timeout`).

## Decisions the lead should know about

1. **Zero runtime dependencies, plain ESM `.mjs`.** `pnpm` is not installed on this laptop and `package.json` pins `node >=24 <25` while local Node is 25.8.1. Rather than block on the lockfile I do not own, every module is dependency-free and runs on stock Node. PDF and ZIP writers are implemented in-module over `node:zlib`. If you want TypeScript under `packages/contracts`, say so and I will convert; JSDoc typedefs are already in `server/contracts/types.mjs`.
2. `server/contracts/types.mjs` mirrors `docs/CONTRACT-V3.json` field names verbatim. It is a placeholder until you publish the real contract; I have not invented competing names.
3. Ingestion returns asset/source `bytes` in-memory for you to persist. `storageKey` is opaque (`assets/<id>.<ext>`); no absolute host path reaches an export.

## Gaps and blockers

- No native Telegram/WhatsApp export has been supplied, so **no chat-export compatibility is claimed or tested**. The private packet contains fictional format fixtures only. P1 parser is skipped unless a real sample arrives.
- Export (`buildFamilyBundle`, PDF/ZIP) is in progress, next commit.
- Waiting on: lead's T0, and the published runtime contract commit.

## Next step

Finish `server/export`: four-page English PDF, book.html, project.json, sources.json, research-notes.json, starting-context.json, originals, README; then before/after acceptance verification and reimport test with the lead.
