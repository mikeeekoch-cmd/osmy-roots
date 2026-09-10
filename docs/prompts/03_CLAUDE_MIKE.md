# Final assignment: Claude Code Mike, files, search and export

Repository: https://github.com/mikeeekoch-cmd/osmy-roots

We are building Roots with three concurrent workers: Codex on Mike's account, Codex on Natalia's account/other laptop, and Claude Code on Mike's account. The goal is a convincing LOCAL prototype within 90 minutes of the lead's recorded T0. We cannot deliver a full production app in this time. Make documented scope tradeoffs to protect the demonstrated route. Mike is here to help; ask a concise question for missing input, credentials or a blocker over five minutes and keep doing independent work.

Start by fetching the repository and reading AGENTS.md, docs/EXECUTION.md, docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/CONTRACT-V3.json, docs/READINESS.md and docs/status/*.md. Read the latest private scope/engineering tab and HTML reference available through Mike's configured private context or local download. Report inaccessible references; the safe repository scope is sufficient to start independent work. The current 90-minute plan supersedes V3 staffing and full-platform dependencies. GitHub is the engineering ground truth: commit/push your safe code, tests, decisions and owner status at meaningful checkpoints, about every 15 minutes. Routine commits/pushes are authorized. Private family assets, Drive URLs, credentials and raw model traces stay outside this public repo.

You are not alone in the codebase. Use your assigned branch in a separate clone/worktree, preserve others' changes and never force-push/reset shared work. The lead owns contracts, dependency/lockfiles and integration. Hand off branch + commit + commands + checks + remaining gaps. All workers use the lead's shared T0+90 deadline. Start work now; do not stop after proposing another plan.


Final ownership override: Codex Mike leads agent/state/integration; Codex Natalia owns UI/map/animations; Claude Code Mike owns ingestion/retrieval/export. P0 comes first. Start the next scope only after your P0 passes checks and the lead confirms integrated P0; stop adding features at T+70. Read docs/SCOPE-PRIORITIES.md for the exact live/prepared/mock boundary. Record the actual contribution of each coding/model tool honestly.

## Your finished deliverable

Three callable backend modules: ingestion turns the supplied seed/text/photos into source-backed records; retrieval searches actual local sources and fetches a bounded public page; export turns CURRENT accepted family state into an illustrated PDF and complete ZIP. The lead imports your functions; the UI uses them through his routes. A translated document or standalone static book alone does not satisfy this assignment.

Work on codex/data-export in your own clone. Own server/ingestion, server/research, server/export, tests/data-export, tests/research and docs/status/data-export.md. Read docs/PROTOTYPE-CONTRACT.md. Start pure modules immediately; adopt the lead's published runtime contract by T+10. Request needed libraries through your status/Mike; only the lead edits package/lockfiles. Do not create another API server, database or model orchestration layer.

## Exact tasks

1. **Select and normalize the demo inputs.** Locate the current private review packet/Family Tree on this laptop. Inspect the 35-person seed, its source register, relevant original photos and one real text/message source. Produce importPreparedFamily: normalize old person/relationship fields into the agreed schema while retaining original IDs, English and original names, date precision, citations, stories, discrepancies and photo references. Do not silently drop a relationship whose endpoint is absent; return a warning. Prepared import never becomes a newly discovered family.
2. **Implement the small real ingestion path.** ingestContribution accepts pasted text or UTF-8 TXT/JSON plus selected image files. Preserve original bytes/name/hash and exact text locator. Return parsed sources, asset metadata and per-file outcomes. Missing author/message time stays unknown. Image upload is storage/preview, not facial identification. Unknown ZIP/audio/video formats return stored_only with a clear reason; do not fake parsing. Actual Telegram/WhatsApp support is optional until a real export is provided. Return duplicate hashes for the lead's deduplication.
3. **Define export selection from current state.** Build from the ProjectSnapshot and current BookPassages passed by the lead, not the original fixture. Include the selected five-generation branch and its sources; retain all current people/edges in project.json. Refuse or clearly flag a stale passage whose acceptedStateVersion no longer matches. Unreviewed contributions remain notes, not facts in the biography. Resolve originals through the supplied asset resolver, never arbitrary client paths.
4. **Render a four-page English mini-book.** Page 1: cover/dedication and original portrait. Page 2: readable selected family branch with names/life years and source markers. Page 3: the selected person's photographs and latest attributed family story, including the lead's generated cited passage. Page 4: numbered sources with exact filenames/message/paragraph locators and unresolved questions. Preserve photo aspect ratios and Unicode. Use a prepared layout; factual narrative comes from current state. Label missing dates and missing photos gracefully. If four pages threatens the deadline, ship a clean shorter PDF with the same essential content and record the cut.
5. **Return the real ZIP.** buildFamilyBundle returns bytes, filename, MIME type and manifest. Include book.pdf, book.html, project.json, sources.json, research-notes.json, starting-context.json and available original images/files. Use portable relative paths and schemaVersion. Include a README explaining how to reimport into the local app. Standalone editable HTML-map export is optional after core PDF/JSON works. Do not make it a download of an unchanged old book.
6. **Verify your output against two states.** Before/after acceptance must produce a changed story/passages section and version in the exported project. Check PDF opens without clipping, expected quote/citation is present, ZIP passes integrity checks, originals match hashes and imported JSON retains edits/history. Check unknown/rejected contributions do not become book facts, Unicode survives and a missing attachment is explicitly reported. Coordinate the final reimport test with the lead.

## Concrete handoff and timing

By T+35 push callable import/export modules, a synthetic test fixture and example invocations to your branch. Supply exact exported function names and one sample return object. By T+55 help the lead connect them; do not wait for a polished book to share the first working PDF. After T+70 fix core failures only.

Deliver a real sample PDF/ZIP using private inputs locally, the code commit, tests and docs/status/data-export.md. Private output files go to the configured private folder or local ignored exports; GitHub receives only code and synthetic fixtures. State whether a real native chat export was tested. If private inputs are missing, ask Mike and proceed with the explicitly synthetic acceptance example. Use the lead's shared deadline, not a new 90-minute timer.

## P0 additions: local search and bounded public retrieval

Implement these async functions in server/research, independent of UI and model calls:

1. searchLocalSources({query, sources, limit: 5}) returns exact source IDs, snippets, original locators and an explicit no-match result. Search the actual parsed packet with simple normalized name/token matching; a vector database is unnecessary. Do not return a hidden prerecorded list regardless of input.
2. fetchPublicRecord({url, timeoutMs, maxBytes}) returns actual fetched content, final URL, retrieval timestamp, content hash, title, source kind and exact excerpt locator, or a structured timeout/blocked/unavailable error. Restrict to approved public sources, validate redirects, block local/private targets and cap bytes/time (default 8 seconds and 2 MB per page). Pick one concrete permitted record/page from the private playbook or ask Mike for its URL. No paywall/login/CAPTCHA bypass.
3. These functions return events or result metadata that the lead persists. They never edit the family graph. Only actual successful retrieval can increment website counts. Keep cached documents labeled cached. A fetched page is a candidate source, not proof of kinship.

Share a callable local-search function early, then the bounded fetch adapter. P0 testing includes a known local phrase hit, a no-match, a successful public response when available, a timeout/blocked response, correct original locator and export integrity. If external access fails, provide the exact failure plus an explicitly cached fixture; do not claim the live-fetch check passed. The offline model/review/book route can still be delivered.

## After validated P0

After the lead confirms the integrated P0 and before T+70: first parse one real supplied Telegram/WhatsApp export (skip if no sample), then implement searchWeb({query, limit: 3}) using an already configured provider and fetch its results. Next, crawlSource({startUrl, maxPages: 3}) follows only approved same-site links with deduplication and provenance. Do not invent search results or configure multiple new services. PDF/DOCX extraction and on-demand OCR are subsequent optional tasks coordinated with the lead.

## Explicit mock boundary

Allowed: prepared seed, thumbnails, extracted/OCR text with origin, deterministic PDF layout and a cached source for fallback. Required real: supported input parsing, hashes/locators, local source search, current-state PDF/ZIP bytes. Live network calls must be actual calls or explicit errors. Native ZIP/audio/video files not parsed remain stored_only. Never synthesize relatives or manufacture a fresh archive match. The changed narrative comes from the lead's current accepted BookPassage, not a hardcoded old book.
