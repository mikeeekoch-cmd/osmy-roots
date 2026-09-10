# Claude Code Mike: ingestion, retrieval and export

Owner: Claude Code Mike. Branch: `codex/data-export`. Modules: `server/ingestion`, `server/research`, `server/export`.

- T0 / shared deadline: read from the lead. T0 16:27:53 UTC, **T+90 deadline 17:57:53 UTC / 13:57:53 EDT**. I have not started a separate clock.
- Base commit: `4d1c86a` (main). Latest code commit: this branch head.
- P0 status: **complete and verified**, except the notes under "Gaps" below.

## Run it

```
node --test "tests/**/*.test.mjs"     # 55 tests, all passing, no install step
```

Zero runtime dependencies. Plain ESM, stock Node. Nothing to add to the lockfile.

## Exported functions

```js
import { importPreparedFamily, ingestContribution } from './server/ingestion/index.mjs';
import { searchLocalSources, fetchPublicRecord, websiteCountDelta } from './server/research/index.mjs';
import { buildFamilyBundle } from './server/export/index.mjs';

await importPreparedFamily({ seedJson, mediaFiles, sourceDocuments, sourceLabel });
await ingestContribution({ text, files, targetPersonId, knownHashes });
await searchLocalSources({ query, sources, limit });          // limit defaults to 5
await fetchPublicRecord({ url, timeoutMs, maxBytes, allowHosts });
await buildFamilyBundle({ snapshot, passages, resolveAsset, options });
```

`options` for `buildFamilyBundle`: `{ focusPersonId, branchRootId, generations, title, dedication, projectName, includeAssets }`.
`focusPersonId` is the chapter subject; `branchRootId` is the person the printed branch is drawn from (usually the youngest). `includeAssets` is `'branch'` (default), `'all'` or `'none'`.

### Sample return: `ingestContribution`

```jsonc
{
  "schemaVersion": "roots-export-1",
  "sources": [{
    "id": "SRC_44b3456a74_001",
    "kind": "family_memory",
    "originalLocator": "pasted-text-44b3456a.txt#L1",
    "contentHash": "44b3456a746fdbea650d3a72e51ba5d557f79dbe2beee7b1eb1b8f8fc16968dc",
    "origin": "live",
    "author": null,                 // unknown stays null
    "messageTimestamp": null,       // a wall-clock time is NOT a message time
    "originalText": "He repaired watches at a bench in the back room.",
    "mediaType": "text/plain",
    "targetPersonId": "P004",
    "segments": [{ "index": 1, "startLine": 1, "endLine": 1, "locator": "pasted-text-44b3456a.txt#L1", "text": "…" }],
    "bytes": "<Buffer>"             // persist these; storageKey is opaque
  }],
  "assets": [{ "id": "A_c740f0ec5a_002", "originalName": "chat.zip", "mediaType": "application/zip",
               "contentHash": "c740f0ec5a…", "storageKey": "assets/A_c740f0ec5a_002.zip", "bytes": "<Buffer>" }],
  "duplicateHashes": [],
  "files": [{ "uploadId": "U002", "originalName": "chat.zip", "status": "stored_only",
              "sourceIds": [], "assetIds": ["A_c740f0ec5a_002"],
              "reason": "Archive stored without extraction. Native chat-export parsing is not implemented; no compatibility is claimed." }]
}
```

`searchLocalSources` returns `{status: 'hit'|'no_match'|'invalid_query', hits: [{sourceId, locator, snippet, score, origin}], searchedSources, totalMatches}`.
`fetchPublicRecord` returns `{status: 'ok'|'timeout'|'blocked'|'not_allowed'|'unavailable', source?, finalUrl, retrievedAt, elapsedMs, truncated, error?}`.
`buildFamilyBundle` returns `{bytes, filename, mimeType: 'application/zip', manifest}`.

## Checks actually run

Real private packet (93 people, 3 source documents, 183 photographs):

- Import: 93 people, 142 relationships, 383 claims, 44 stories. Two real discrepancies surfaced rather than swallowed: the seed's `meta.total_persons` says 91 while the array holds 93, and one duplicate `parent_child` edge was collapsed. Chronology and ancestry-cycle checks found no violations.
- A relationship with a missing endpoint is excluded from the graph **and** returned as a warning plus a structured issue.
- Source confidence is mapped, never upgraded: `подтверждено` -> `accepted`, `вероятно` -> `proposed`. 23 of the 143 edges legitimately stay candidates.
- Ingestion outcomes: `.txt`/`.json`/`.md`/`.csv` -> `parsed` with `file#L3` locators; `.zip`, `.jpg`, `.m4a` -> `stored_only` with an explicit reason. A PNG renamed `.txt` is still detected as an image. Non-UTF-8 bytes are stored, not decoded.
- Local search verified for hit, no-match, invalid query, Cyrillic, and that different queries return different segments (it is not a prerecorded list).
- **Live fetch check PASSED.** Real request to `https://www.loc.gov/search/?q=Chelyabinsk&fo=json`: HTTP 200, 221,627 bytes, 6.2 s, content hash and exact locator recorded. Timeout, byte cap, HTTP 403, sign-in/CAPTCHA walls and redirect-to-off-allowlist all verified as distinct, honest failures.
- SSRF refused for `127.0.0.1`, `10/8`, `172.16/12`, `192.168/16`, `169.254.169.254`, CGNAT, `::1`, `fe80::`, `::ffff:127.0.0.1`, `file://` and any host off the allowlist. Every redirect hop is re-validated. No network call is made for a refused target.
- Export: four-page PDF, rendered and **visually inspected page by page**. Cyrillic originals print beside English text; photo aspect ratios are preserved; the branch chart follows real `parent_child` edges; source markers resolve to the numbered source list.
- Before/after acceptance: project version 1 -> 2, the new attributed story and the lead's cited passage appear, the bundle bytes differ. A passage stamped with an older `acceptedStateVersion` is excluded and reported as stale. An `unresolved` story does not reach the biography. A passage with no claim or source locator is rejected.
- ZIP verified with system `unzip -t` and by an independent reader in tests that checks every CRC and size. Bundled originals are byte-identical to the inputs and re-hashed; a mismatch or unresolved attachment is flagged in the manifest.
- No absolute host path, and no real family name, appears in any tracked file.

## ACTION FOR THE LEAD: the download is currently a 503

`server/agent/data-modules.ts` still ends with a stub:

```ts
async buildFamilyBundle() {
  throw new AppError("The current-state export module is awaiting Claude's handoff.", 503, "EXPORT_NOT_INTEGRATED");
}
```

My export module is merged into `codex/engineering`, so this is the only thing standing
between the UI's Download button and a real ZIP. I have not edited your file. Apply this:

```ts
import { buildFamilyBundleFromContract } from "../export/contract-adapter.mjs";
// ...replace the stub with:
buildFamilyBundle: (input) =>
  buildFamilyBundleFromContract(input, {
    branchRootId: "<youngest person id>",   // root of the printed branch
    focusPersonId: "<chapter subject id>",  // person the chapter is about
    title: "Roots: The Family Book",
    dedication: "Dad, this is for you.",
  }),
```

`server/export/contract-adapter.mjs` translates your published shapes to my renderers and
matches `DataModules.buildFamilyBundle` exactly. It handles the five differences between
our shapes: `relationship.type` parent/partner, `story.personId`/`attribution`,
`lifeYears` without a label, `claim.value` as a string, and `sourceLocators` as
`SourceSpan[]`. It also adapts your async `resolveAsset(id) => Promise<Uint8Array>`.
A resolver that throws produces a reported missing attachment, not a failed download.
Eight tests in `tests/data-export/contract-adapter.test.mjs` cover this boundary.
Both options are optional; sensible defaults are chosen if you omit them.

## Decisions the lead should know about

1. **Zero runtime dependencies, plain ESM `.mjs`.** `pnpm` is not installed on this laptop and `package.json` pins `node >=24 <25` while local Node is 25.8.1. Rather than block on files I do not own, PDF, ZIP, TrueType embedding and image handling are implemented in-module over `node:zlib`. Say the word if you want TypeScript under `packages/contracts`; JSDoc typedefs are already in `server/contracts/types.mjs` and conversion is mechanical.
2. `server/contracts/types.mjs` mirrors `docs/CONTRACT-V3.json` field names verbatim. It is a placeholder until you publish the real contract. I have not invented competing names.
3. Ingestion returns `bytes` in memory for you to persist. `storageKey` is opaque (`assets/<id>.<ext>`). `buildFamilyBundle` reaches originals **only** through the `resolveAsset(assetId)` you supply, and throws if it is missing.
4. Bundled originals default to the printed branch (`includeAssets: 'branch'`), which took a real export from 175 MB to 104 MB. `project.json` still lists every asset, and omitted ones are named in `research-notes.json`. Pass `'all'` for the complete archive.
5. **Please add a test script.** You own `package.json`; I did not touch it. Suggested: `"test": "node --test \"tests/**/*.test.mjs\""`.

## Gaps and blockers

- **No native Telegram or WhatsApp export has been supplied.** The private packet contains fictional format fixtures only. No chat-export compatibility is claimed or tested, and the P1 parser is skipped until a real sample exists. This is the one input format most likely to be assumed working; it is not.
- The public-fetch allowlist covers Library of Congress, NARA, Pamyat Naroda, Yandex Archive, Szukaj w Archiwach, Chelyabinsk archive, FamilySearch and Wikipedia. **A specific record URL for the demo has not been chosen.** If you want a live retrieval on stage, give me the exact URL and I will verify it end to end; otherwise local search carries the route and the website counter honestly shows zero.
- PDF/DOCX text extraction and OCR are not implemented (explicitly next-scope).
- Waiting on: your T0, and the published runtime contract commit.

## Tool contribution, recorded honestly

Every line in `server/ingestion`, `server/research`, `server/export`, `tests/` and `fixtures/public/` was written by Claude Code (Opus 5) in this session. No Astra call is made from any of my modules by design: the lead owns model orchestration. The four-page PDF was rendered and visually checked against the real packet, and three rendering defects found that way were fixed (parenthetical maiden names ordered as an English suffix, relationship claims rendered as prose instead of raw JSON, and open questions naming their subject). Worth reflecting in `docs/BUILD-LOG.md`, which you own.

## Next step

Available now to connect these functions into your routes. On your signal I will take the next-scope items in order: a real chat parser if a sample arrives, otherwise `searchWeb({query, limit: 3})` against an already configured provider, then `crawlSource({startUrl, maxPages: 3})` restricted to permitted same-site links.
