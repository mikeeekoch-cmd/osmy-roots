# Round 2 data/export status, September 10, 2026

Execution owner: Codex data/export subagent covering the Claude assignment. No claim of execution in Claude Code. Lead integrates changes on codex/engineering; the original codex/data-export history is preserved.

Engineering T0: 18:18:15 UTC. Contracts: 18:28:15. P0: 19:13:15. Freeze: 19:28:15. Final deadline: 19:48:15.

Working at 18:30 UTC:

- Ordinary PDF/CSV/TXT/photo/three-chat-ZIP packet parsing reconstructs the actual selected 35 people and 56 normalized relationships from the supplied files. No internal JSON seed is used.
- Actual PDF extraction uses local Poppler pdftotext (10 seconds, 2 MB extracted-text cap, at most 10 pages), with original PDF bytes retained. Images remain stored assets without OCR or face recognition.
- CSV quotes, embedded newlines, exact offsets, source references, same-name IDs, candidate relationships, uncertain dates, duplicate normalization, missing endpoints and parent-cycle rejection are covered.
- Chat ZIPs validate central and local directories, CRC/size, safe paths, no symlinks, no nested/executable content, 200 entries, 100 MB total expansion and ratio <=200. UTF-8 undated or dated scaffolding is parsed; actual recollection attribution, per-message roots, original hashes and reconstruction metadata remain separate.
- Canonical private packet: 16 selected files; 35 people; 56 relationships; 16 sources; 19 retained original/extracted assets; 8 photo annotations; zero parser issues. Actual PDF and 3 ZIPs parsed in 130 ms. No private filenames, hashes or source text appear in this status.
- Fictional twin: same shared schemas and 35/56 coverage. Both actual and twin results pass ProjectSnapshotSchema and validateSnapshot with exact imported claim spans.
- Export keeps the strict lead bundle adapter untouched. Four-page PDF now includes a small branch and the entire 35-person register; HTML includes all supplied photos and accepted recollections. All photo and source bytes remain hash-verifiable. Current data layout generation took 151 ms for a roughly 9 MB bundle.
- Visual inspection of all four initial-layout pages found and fixed long open-question overflow into the footer; the corrected page 4 was rendered and inspected again. The initial layout intentionally contains no unreviewed story. Final integrated current-book visual QA remains required after real Astra review.
- 54 focused ingestion/export/research tests passed. Mocked retrieval unit tests now inject DNS as well as HTTP and retain an explicit private-DNS rejection case; production DNS checks are unchanged.

Interfaces: parseFamilyPacket({files}) from server/ingestion/index.mjs returns roots-v1 graph/sources/assets plus assetBytes, files, photoAnnotations, relationshipReconciliation and counts. prepareManifestBatches and readSavedSourceJob in server/research validate supplied staging without timers or new facts. Lead currently owns active batch execution.

Pending integration gates: canonical frozen packet hash and full current-book export after actual review, two real-browser Submit-to-Download rehearsals, portable reopen, actual download timing and final shared regression gate. Do not interpret this parser/export status as integrated demo readiness.

---

## Preserved round 1 data/export handoff

# Claude Code Mike: ingestion, retrieval and export

Owner: Claude Code Mike. Branch: `codex/data-export`. Modules: `server/ingestion`, `server/research`, `server/export`.

- T0 / shared deadline: **still not published by the lead** in `docs/status/lead.md`. I am working to the lead's clock, not a separate one.
- Base commit: `4d1c86a` (main). Latest code commit: this branch head.
- P0 status: **complete and verified**, except the notes under "Gaps" below.

## Run it

```
node --test "tests/**/*.test.mjs"     # 47 tests, all passing, no install step
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
