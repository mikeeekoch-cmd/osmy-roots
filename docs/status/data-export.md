# Round 3 data/export and content status, September 10, 2026

Owner: Claude Code Mike. This round I also carry the former Product content role; there is no
fourth content agent. Round-3 execution start recorded by the lead: 2026-09-10T20:08:05Z.
Round-2 evidence below the separator is historical and unchanged.

Merged `origin/codex/engineering` at `0eea05b` (which contains `a7d50ab` and `fc93d39`) into
`codex/data-export` as a merge commit. No history was reset and no branch was force-pushed.

## First handoff: inventory, book source, chapters, old photos, pairs

Delivered as facts, from actual file inspection. Private names, paths, hashes and family text
stay in the ignored v3 packet; only counts and structure appear here.

**Input inventory.** One new private packet `demo-artefacts-v3` is being frozen; v1 and v2 are
preserved untouched. The selection is 33 files: 9 parsed documents and 24 original photographs.
19 files carry over byte-identical from v2. Totals: about 11.4 MB, largest single file
2,041,455 bytes. That is 33 of the 40-file limit, ~11.4 MB of 100 MB, and well inside the
25 MB per-file cap, so no shared limit change is requested. Counted separately: 24 original
photographs, 0 uploaded derivatives, 3 chat containers holding 12 extracted messages.
The v2 numbers were 20 files / 6 documents / 14 photographs; 35 remains a person count.

**Controlling book source.** The current 112-page Russian reference is selected as the
controlling edition, verified page count and SHA-256 recorded, together with its editable
`.docx` master. The 99-page print layout and the older 147-page draft are recorded as
alternatives and explicitly NOT selected: the trailing numeral in Mike's message is ambiguous
and is not treated as permission to replace the latest book. Audit result: no complete English
long edition exists in any bounded location. The English 35-40-page edition is therefore a new
derivative with per-chapter source page and paragraph lineage. The reference PDF is larger than
the per-file cap, so it is not uploaded; it enters the input set only as a bounded English
excerpt document.

**Chapter plan.** 16 prepared English chapters mapped to the source's Contents, Preface,
Parts I-III and appendices, budgeted at 38-40 pages: 4 front matter, 1 places, 9 narrative
and archive chapters, 16 profile and register pages, 6 story pages, 6 photo/document exhibit
pages, 3 source pages, 2 open-question pages. Actual pagination is reported by the renderer;
no blank, duplicated or filler pages. All 35 selected people appear in the register, all 24
originals get a readable placement, every document gets a source entry with excerpts while its
complete original stays in the ZIP.

**Old photographs and pair readiness.** The old-photo subset is declared explicitly: 12 of the
24 originals, 8 carried from v2 and 4 newly selected. Pair completion is currently 0 of 12.
The two pre-existing curated derivative candidates were inspected side by side with their
originals and are REJECTED: both are reframed reinterpretations with changed detail, so they
prove nothing about slider readiness. Other AI-style variants in the private library are
rejected on the same ground. Pairs will be prepared with a pixel-geometry-preserving tone,
contrast, denoise and unsharp pass, so the enhanced file has identical dimensions to its
original and alignment is exact by construction rather than by registration. No inpainting,
colourisation, upscaling, rotation, cropping or content change. Each pair records parent hash,
evidence root, tool and method, preparation time, alignment mode and an actual visual QA
verdict. A missing pair stays an explicit incomplete requirement.

**Portraits.** Unique source-annotated solo portraits now exist for 12 people, which is why
four of the ten new photographs are modern solo portraits: it removes the repeated group
portrait on the map. One group photograph supports one reviewed crop because its caption states
the position explicitly. Everyone else falls back to initials or an honestly labelled group
image. No face recognition, and folder membership is never treated as identity.

**Retrieval access.** Local search and permitted public fetch exist. A general search provider
adapter and a bounded crawl executor do not, and are mine to add. Provider credentials remain
Mike's dependency; an unconfigured provider reports `configured:false` and a real
blocked/no-match outcome, never an invented result.

**Schema needs against the published round-3 contracts.** The published `DemoManifestV3Schema`,
`PhotoPairV3Schema`, `PortraitSchema`, `BookPlanSchema` and `BookEditionSchema` cover this
content as published; no contract change is requested. Two state-side warnings for the lead:
no-answer photo pairs are auto-attached today and should not promote v3 pairs, and there is no
general reopen-time validation that a pair's parent original is present.

---

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

Final output QA completed on tested application code a627436. Two actual browser rehearsals produced separate current books using live Astra analysis and passage generation. Browser receipts were measured at 104.174 seconds and 104.747 seconds after Submit; the second included a refresh and resume. All eight rendered PDF pages were visually inspected with no overlap or clipping. Both PDFs contain all 35 names, the current accepted passage, source citations, per-message narrator attribution, unknown values and uncertain dates. Each portable project retains all 56 relationships and the full exact recollection quote. Each HTML edition contains all 14 original photos with supplied captions and review labels: 13 unreviewed, one confirmed. All 23 saved asset hashes validate, and all 20 uploaded originals are byte-identical to the frozen packet. The archive-wrapper attribution issue was fixed and verified in both final outputs. The lead's isolated-store reopen, edit and book-invalidation checks also passed. Private screenshots, PDF renders, timing receipts and exact QA reports remain in ignored local storage; no private source text or photographs are included in this public status.

The data/export gates are complete. The four-page PDF intentionally summarizes source and open-question lists; the complete register and remaining material are preserved in HTML and portable JSON. Standalone editable HTML map remains deferred as recorded by the lead.

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
