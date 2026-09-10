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
