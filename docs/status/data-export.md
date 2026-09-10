# Round 2 data/export status, September 10, 2026

Execution owner: Codex data/export subagent covering the Claude assignment. No claim of execution in Claude Code. Lead integrates changes on codex/engineering; the original codex/data-export history is preserved.

Engineering T0: 18:18:15 UTC. Contracts: 18:28:15. P0: 19:13:15. Freeze: 19:28:15. Final deadline: 19:48:15.

Implemented and verified during the engineering window:

- Ordinary PDF/CSV/TXT/photo/three-chat-ZIP packet parsing reconstructs the actual selected 35 people and 56 normalized relationships from the supplied files. No internal JSON seed is used.
- Actual PDF extraction uses local Poppler pdftotext (10 seconds, 2 MB extracted-text cap, at most 10 pages), with original PDF bytes retained. Images remain stored assets without OCR or face recognition.
- CSV quotes, embedded newlines, exact offsets, source references, same-name IDs, candidate relationships, uncertain dates, duplicate normalization, missing endpoints and parent-cycle rejection are covered.
- Chat ZIPs validate central and local directories, CRC/size, safe paths, no symlinks, no nested/executable content, 200 entries, 100 MB total expansion and ratio <=200. UTF-8 undated or dated scaffolding is parsed; actual recollection attribution, per-message roots, original hashes and reconstruction metadata remain separate.
- Canonical private packet: 16 selected files; 35 people; 56 relationships; 16 sources; 19 retained original/extracted assets; 8 photo annotations; zero parser issues. Actual PDF and 3 ZIPs parsed in 130 ms. No private filenames, hashes or source text appear in this status.
- Fictional twin: same shared schemas and 35/56 coverage. Both actual and twin results pass ProjectSnapshotSchema and validateSnapshot with exact imported claim spans.
- Export keeps the strict lead bundle adapter untouched. Four-page PDF now includes a small branch and the entire 35-person register; HTML includes all supplied photos and accepted recollections. All photo and source bytes remain hash-verifiable. Current data layout generation took 151 ms for a roughly 9 MB bundle.
- Visual inspection of all four initial-layout pages found and fixed long open-question overflow into the footer; the corrected page 4 was rendered and inspected again. The initial layout intentionally contains no unreviewed story. Final integrated current-book visual QA remains required after real Astra review.
- Merge checkpoint: 118 focused ingestion/export/research tests passed across both owners. The runtime parseFamilyPacket is retained; optional ingestDemoPacket is preserved in raw-packet.mjs with its own raw-format tests. The canonical checker validates actual manifest hashes, seven exact supports and the supplied batch schedule; it does not invent a plan. The PDF retains the already visually checked full-register layout, plus source guard reporting and the external ToUnicode text-extraction fix.
- Earlier 54 focused ingestion/export/research tests passed. Mocked retrieval unit tests now inject DNS as well as HTTP and retain an explicit private-DNS rejection case; production DNS checks are unchanged.

V2 prose checkpoint: parseFamilyNotesPacket({files,identityKeys}) now reads ordinary person headings, human-readable dates, relative/partner sentences and photo notes. Actual private v2 passes parser, ProjectSnapshotSchema, validateSnapshot, every photo span, exact app startRound2 photo comparison, manifest hashes, all seven question supports and full staged coverage: 20 uploads, 35 people, 56 relationships (42 accepted, 14 proposed), 14 original photo annotations and all 12 reconstructed chat messages. Identity mappings cannot add hidden facts. Unsupported graph grammar fails. Date conflicts retain both values with unknown precision; missing dates remain unknown. Only explicit left-to-right lines create photo positions. Four fictional-prose tests cover graph reconstruction, extra identity rejection, unpositioned group photos, unknown labels, relative direction, scoped identities, partner meaning and date qualifiers. All 122 focused data/export/research tests and TypeScript checks pass after this change. V1 is preserved.

Interfaces: parseFamilyPacket({files}) and parseFamilyNotesPacket({files,identityKeys}) from server/ingestion/index.mjs return roots-v1 graph/sources/assets plus assetBytes, files, photoAnnotations, relationshipReconciliation and counts. prepareManifestBatches and readSavedSourceJob in server/research validate supplied staging without timers or new facts. Lead currently owns active batch execution.

Photo renderer follow-up: HTML includes every resolved original image, its supplied caption, explicit identity-review label and exact citation. PDF uses a caption-associated fallback only when the selected chapter person has no confirmed photo, clearly labels the unreviewed identity and cites its source. It never mutates person.photoIds or revives an unresolved ordered identity. Synthetic cover/chapter renders were visually checked; the new regression verifies all 14 gallery photos and extracted PDF evidence labels. All 123 focused data/export/research tests and TypeScript checks pass.

Pending integration gates: full current-book export after actual review, two real-browser Submit-to-Download rehearsals, portable reopen, actual download timing and final shared regression gate. Do not interpret this parser/export status as integrated demo readiness.

---

## Preserved round 1 data/export handoff

# Claude Code Mike: ingestion, retrieval and export

Owner: Claude Code Mike. Branch: `codex/data-export`. Modules: `server/ingestion`, `server/research`, `server/export`.

## Round 2 status

Merged `origin/codex/engineering` (through `d10eb59`) into this branch, preserving local work. The lead's strict `buildRuntimeBundle` adapter is kept; my `contract-adapter.mjs` remains available but the lead's boundary is authoritative.

**Round-2 engineering is implemented and tested against a fictional twin. It has not been run against Product's real packet, which is not on this machine.**

## Run it

```
node --test "tests/**/*.test.mjs"                       # 106 tests, no install step
node scripts/make-test-packet.mjs /tmp/twin             # fictional twin packet
node scripts/check-packet.mjs /tmp/twin/01-upload       # validator Product can run
node scripts/demo-round2.mjs --packet /tmp/twin/01-upload
```

## New in round 2

Four formats round 1 explicitly deferred are now real parsers, not prepared extractions.

- `server/ingestion/archive.mjs` reads supplied ZIPs under hard limits: traversal, absolute and drive-letter paths, symlinks, executable content, encrypted entries, unsupported compression and Zip64 are all refused; nested archives are listed but never expanded; 200 entries, 25 MB per entry, 100 MB expanded per run, 200:1 ratio bound.
- `server/ingestion/pdf-text.mjs` extracts a real text layer, including objects packed in object streams, and maps codes through `/ToUnicode`. Verified against our own writer **and** a CUPS-produced PDF. Too little text is reported as a failure requiring a hash-bound sidecar, which is then labelled `prepared_sidecar` rather than called extraction.
- `server/ingestion/csv.mjs` is full RFC 4180. `server/ingestion/chat.mjs` handles iOS and Android transcripts, multi-line messages, system notices and attachments.
- `server/ingestion/packet.mjs` assembles the entire upload set into the roster with **no internal project JSON**, auditing the raw-to-normalized relationship reconciliation row by row.
- `server/research/staged.mjs` plans the initial branch and six dependency-safe batches from manifest offsets, and proves nobody is released before a relative is visible. No timers live in these modules.
- `server/export/preparation.mjs` gives the lead a preparation key over version, book status, language, packet version, accepted claims and stories, and every asset hash. Any correction changes the key, so a prepared bundle cannot be served after the family changes.
- `server/export/english.mjs` enforces English-only demo output. `mode: 'raw'` preserves the older general-purpose export unchanged.

## Measured on the twin

| Step | Time |
| --- | --- |
| Ingest packet (PDF, 2 CSVs, 2 text files, 8 photos, 3 archives) | 18 ms |
| Plan initial branch and six batches | 1 ms |
| Local evidence search | 10 ms |
| Prepare current English book and bundle | 58 ms |
| **Total** | **87 ms** |

Book and bundle preparation is 58 ms, so readiness by second 108 is not in doubt from this side. Coverage: 35 people, 53 raw relationship rows reconciled to 52 with the merged row named, real PDF text layer, 3 archives parsed, 20 sources, 8 photos, 17 evidence roots, 0 errors. Six batches run 5 -> 10 -> 15 -> 20 -> 25 -> 30 -> 35 across 45 seconds, dependency-safe.

The four-page PDF was rendered and **every page inspected**. Page 1 branding, portrait and dedication; page 2 the legible main line plus the full 35-person register; page 3 the reviewed story with photographs; page 4 numbered sources and open questions. Layout guards for clipped names, page overflow, raw object prose and unresolved citation targets all pass.

## Defects found and fixed while verifying

1. **The PDF object scanner walked into binary stream payloads.** An embedded font contains byte sequences that look like `12 0 obj`, so a false match could shadow a real object. Now the scanner skips past stream data and the first definition wins.
2. **Our own book PDF mapped the space glyph to U+00A0.** Several code points share one glyph, and the last one won. Text copied out of the delivered book carried non-breaking spaces, which breaks search and matching. The lowest code point now wins.
3. Internal directives (`evidence_root:`, `original_source:`) were printing as prose in the book. They are still parsed and still stored verbatim in `sources.json`, but the rendered text is clean.
4. A truncated source list could drop the very sources the book cites. Cited sources are now ordered first.

## For Product

`docs/PARSER-COMPATIBILITY.md` lists exact supported filenames, accepted column names, date and status vocabularies, caption rules, chat directives and archive limits. Run `node scripts/check-packet.mjs <01-upload>` before freezing a packet version; it exits non-zero on any error and prints every file outcome, the reconciliation, photo identity mapping and the staged-release check.

Two things worth knowing early:

- Supplied recollections are ingested as **proposed**, never pre-accepted, so the key story beat is a real decision on stage.
- A caption naming two or more people without the phrase "left to right" leaves positions unknown by design. That is reported, not guessed.

## Gaps and what I need

- **Product's frozen packet is not on this machine.** Every number above comes from the fictional twin. Send me the path to `.roots-data/demo-artefacts/01-upload` and I will confirm against the exact bytes and report against your packet version.
- No `DEMO_MANIFEST.json` yet, so manifest cross-checks (roster count, expected normalized relationships, explicit batch IDs) are implemented and tested but unexercised against real values.
- DOCX, OCR, audio and video stay unsupported and are reported as such.
- Integration with the lead's routes for the staged releases and the preparation key is not wired on his side yet; the functions are pushed and ready.

## Tool contribution, recorded honestly

Everything in `server/ingestion`, `server/research`, `server/export`, `tests/` and `scripts/` on this branch was written by Claude Code (Opus 5). No Astra call is made from these modules by design; the lead owns model orchestration. The two parser defects above were found by round-tripping our own PDF through our own extractor and by rendering every page, not by reading the code.
