# Osmy Roots: round 2 demo specification

Status: implementation brief, not a delivered feature claim. This is the controlling specification for the next round, based on Mike's feedback after round 1. It overrides conflicting earlier intake, staging, language and scope requirements. It preserves evidence integrity, human review and the existing working prototype.

## Verified starting point

Fetch origin/codex/engineering and include code baseline 556953f or a descendant. Main was last verified at a5de7c4; starting from main alone misses the final integrated fixes. On September 10 the lead reran typecheck, all 74 tests and the production build successfully at 556953f. Two dynamic filesystem tracing warnings remain. Three real Astra source-to-book round trips passed during round 1; they were not rerun merely to write this brief.

Working P0: actual Astra interpretation, exact source spans, review/correction/unknown, local persistence and undo, editable graph/photos, bounded retrieval, current PDF/HTML/ZIP and portable reopen. Working partial P1: source-to-person saved-decision animation, branch selection and accessible photo paging. Preserve these behaviors.

New work is required for ordinary uploaded files to produce new people, seven setup questions, staged graph growth, supported chat ZIPs, an English demo pack and an English-only display/export projection. The existing model function can only select existing person IDs; adding a loader alone cannot implement the requested journey.

The three-minute target is the presenter journey, not an engineering deadline. Begin round 2 only when the owner prompts are executed. The lead records its start and checkpoints; do not reuse or silently reset the expired round-1 deadline. Publish round-2 interfaces within ten minutes of actual execution, integrate the first file-to-question-to-map path before polishing, and freeze features before final rehearsals.

## The product Mike will present

The product name is Osmy Roots everywhere: header, browser title, accessible logo name, loading states, PDF/HTML cover and export prefix. Natalia creates a small original SVG mark combining a family and branching roots. Use the existing visual system, not a redesign of every component.

Keep two screens: a compact intake and one research workspace. The workspace has preparation, questions, map/review and export states. Loading and questions are states of this workspace, not extra permanent screens. Do not display a blank graph containing only the starting person while initialization runs.

The intake asks for Your full name and Family location, with I don't know. Optional personal details must have an explicit meaning, such as Your birth year. Remove the generic Approximate years field, redundant English-only language selector, and unnecessary optional fields from the demo intake. Approximate dates in family evidence must still retain their uncertainty.

All context arrives through files. Remove these existing intake elements: A memory or a little context; Use the prepared example family (synthetic); the prepared-project-JSON instruction; Optional connections; Google Drive unavailable; Email unavailable. Keep free-text and file contributions inside the research workspace. Reopening an exported project remains supported through a separate unobtrusive Open saved project control.

Use this photo instruction: "Name the people in each photo from left to right. Example: 01__Alex_Morgan__Jamie_Morgan.jpg. If you are unsure, use Unknown. You can confirm the names after starting."

The LLM does not identify a person by facial appearance. Parse filename labels as supplied annotations, then save ordered photo-person links after confirmation: asset ID, one-based left-to-right position, person ID or unresolved label, annotation source and review state. A filename is a hint, not proof of identity or kinship. Same-name people stay separate. Do not invent ordered names for an unlabelled group photo. Confirmed individual portraits are preferable to ambiguous group scenes.

## Connections and prepared material

Mike does not want a global Demo mode banner or a presenter speech about implementation. Keep the interface clean while retaining ordinary source provenance. Cards may say From your family book, Uploaded chat, Saved correspondence or Saved family folder. Inspection details retain whether correspondence is reconstructed and whether retrieval was prepared, cached or live.

Use Google Drive and Email source cards with "Saved family folder" and "Saved family correspondence" when using local prepared copies. Do not show a green Connected state, fake OAuth success, scanned mailbox counts or Found online for those copies. Those labels require actual verified application operations. No real OAuth work is required for this round. Mock connection controls must not request credentials or send messages.

The fixture chats are reconstructed examples based on supplied book facts, not authentic messages from family members. State this inside the file and source details. Do not fabricate a sender/date attribution as historical evidence. Three reconstructions of one book passage share the same evidence root and do not become three independent corroborating sources.

Actual Astra requests may be labelled Astra analyzing while they run. Prepared source release is labelled as reading/adding supplied evidence. Keep live request IDs/latency private and report actual outcomes. Do not show fabricated reasoning traces, external searches, discoveries or infinite ongoing model activity.

## Seven questions before the first map

After Start, show an immediate loader with a short action summary, then seven concise questions, one at a time or in a compact sequence. Each has Recommended when supported by a specific file/locator, an editable answer, I don't know, and Back. A skip counts as an explicit unresolved answer. Do not silently accept recommendations on a timer.

Question topics, populated from the actual selected packet:

1. Photo identity: confirm the people from left to right in one selected photo.
2. Kinship: confirm how the selected ancestor connects to the starting person.
3. Origins: confirm the ancestor's birthplace or home village.
4. Time: confirm a source-supported lifespan or residence period, with approximate years clearly qualified.
5. Movement: confirm which relative moved between two places and when. Do not turn travel for work into migration or transfer one person's move to another.
6. Personal story: confirm a source-backed occupation, craft or family recollection.
7. Conflicting evidence: choose how to handle an actual discrepancy, with Keep unresolved recommended when the source cannot settle it. If the packet has no discrepancy, ask which sourced story should lead the book instead of inventing a conflict.

Do not hardcode real family answers in public code. The seven questions must span these distinct categories. Give short suggested answers and a source link rather than making Mike type a narrative seven times. The question being answered must match what its Confirm action saves. Preserve the exact original and a separate human correction record. A memory stays a memory after acceptance.

When all seven questions are confirmed, corrected or explicitly skipped, reveal a coherent initial branch from saved state. Unresolved answers must not block showing the rest of the family. Unsupported relatives and relationships can appear as proposals with their review state; they cannot become verified facts on a timer.

## Three-minute progression

Target timings for the normal presenter script, measured from Start to a successfully received ZIP:

| Elapsed         | Observable state                                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before Start    | File selection and size checks only. No model requests, ingestion run, discovery queue or progress counters start.                                                                                                                                                                          |
| 0-10 seconds    | Upload/parse activity and immediate loader. No empty one-person graph. First available question appears promptly.                                                                                                                                                                           |
| 10-55 seconds   | Seven varied questions with concise suggested answers. Parsing/analysis can continue in parallel. Budget roughly 5-6 seconds per recommended answer.                                                                                                                                        |
| 55-140 seconds  | Show the initial reviewed branch, then release roughly 8 meaningful batches at 8-12 second intervals as eligible source work completes. Grow toward the supplied 35-person project where evidence supports it. Each batch can add people, links, photos, stories or an unresolved proposal. |
| 140-180 seconds | Book ready for review; Mike clicks Download family book, receives a current PDF/HTML/project ZIP, and the session enters Completed.                                                                                                                                                         |

These are presentation targets, not permission to fabricate results or answer for the user. Human pauses may extend elapsed time. Never advance a dependent batch before its data is parsed, validated and permitted by review state. If a real model call is slow, show that state or an explicit prepared-source fallback; do not relabel cached output as live.

The server owns a persisted run ID, sequence cursor, queue and phase. New facts appear through actual saved transactions. Do not load all 35 people into the visible snapshot and hide them with CSS while incrementing fake counters. Parsed but unreleased material can live in a staging queue with its provenance. The UI animates the resulting saved deltas without changing their meaning.

Distribute arrivals across the map phase instead of one giant burst. Keep existing nodes stable, highlight only the affected branch, and avoid auto-fit/camera jumps while Mike is dragging or examining a person. Respect reduced motion. Scrolling the feed must not steal focus from questions or the map.

During map review, Mike can pan, zoom, inspect photos/stories, edit relationships and add another clue. A fresh clue actually enters ingestion/Astra processing and produces a reviewable update. Late analysis must not overwrite a human correction. When the queue is empty, show "Up to date. Add another clue while you review." Do not imply a model is still working when no request is running.

Download is the finishing action. Seal the current run, stop admitting new scheduled demo batches, safely finish or cancel in-flight work, and export one consistent accepted-state version. A successful download marks Completed; a failed export remains retryable and must not claim completion. Clicking early can export the current reviewed state with unresolved/pending work disclosed. Nothing should mutate the sealed state after the exported version was chosen. Repeated clicks must not start duplicate export jobs.

## File pack and English-only boundary

Claude owns the private artifact pack in an ignored local demo-artefacts folder. Suggested structure:

```text
demo-artefacts/
  00-START-HERE.md
  01-upload/
    01__Person_Name.jpg        # 6-10 selected photos, English filenames
    Family_Overview.pdf        # a readable one-page English summary
    Family_Recollections.txt   # concise source-backed English context
    WhatsApp_Mom.zip
    WhatsApp_Dad.zip
    WhatsApp_Family.zip
  02-background/
    saved-family-folder/
    saved-family-correspondence/
    staged-sources.json
  03-output/
  90-private-provenance/
```

Keep all upload files directly inside 01-upload so Mike can select them together with Select all. The illustrated photo filename is a pattern, not a real person's name. Do not require directory-upload support. Do not ask him to upload an internal project JSON, the full old book, output ZIPs, provenance files or the entire archive. The finished pack should total at most 20 MB and use at most 20 user-selected files. The background folder contains selected English derivatives loaded in the staged run, not files claimed to be found online.

All visible strings are English: filenames, names/transliterations, captions, buttons, questions, answers, tool summaries, sources, warnings, history summaries, previews and PDF/HTML. Rename copies of Cyrillic filenames; preserve the original private masters. Select photos without prominent readable Cyrillic inscriptions for this demo instead of altering the evidence image to conceal text.

Translate the selected Russian book material into new English derivative sources. Preserve original Russian bytes, original locators and hashes in 90-private-provenance, outside the demo UI and public repository. The English project cites exact spans in the English derivative and records translation lineage and original hashes. Do not replace an original quotation in place while keeping its old hash. Do not label a translation as an original English family message.

The demo's PDF, HTML, ZIP filenames and exported project/source text must be English-only. The English project contains its own complete derivative sources, reviewed state and the English-named original photo bytes. Original Russian evidence belongs to the separate private audit archive and is not bundled into the English demo download. Preserve the existing general-purpose raw project export behavior for older projects; do not destructively rewrite them into English. Document this demo export distinction and validate both routes.

For the three WhatsApp-style ZIPs, create real archive structures with UTF-8 _chat.txt, several short English messages and only selected attachments if needed. The sender/timestamp/dialogue structure is explicitly reconstructed in the file metadata and source details. Every factual sentence maps to a genuine book/document locator, translation and evidence root. Unknown facts remain unknown. Include no real phone numbers, email addresses or invented personal claims.

The app must actually extract the supported supplied ZIP format, preserve message/attachment locators and report missing attachments. A fixture parser pass proves compatibility with these fixtures only, not universal WhatsApp support. Add bounded processing for the supplied PDF summary; a text sidecar fallback must be labelled as a prepared extraction, not a successful PDF parse. DOCX and general OCR are optional, not required for these two supplied documents.

Upload policy: publish one shared configuration used by UI and server. Target 100 MB total, 25 MB per file, at most 40 files, with a bounded request body before formData allocation and appropriate multipart overhead. Show total/per-file sizes and an actionable filename-specific message before Start. Reject invalid payloads without losing the selected files. Bound archive extraction separately: no absolute/traversal paths, symlinks, nested archive expansion or execution; at most 200 entries and 100 MB expanded per run, plus a compression-ratio bound. Do not solve the current 30 MB error by removing limits.

## Shared implementation contracts

The lead publishes actual TypeScript/Zod interfaces first. The following responsibilities are required; exact type names can be finalized once without competing definitions:

- Run state: run ID, startedAt, phase, next sequence, answered question IDs, pending jobs, staged batches, release eligibility, cancellation/seal and export version.
- Setup question and answer: category, English question/recommendation, source spans, answer/correction/unknown, version and idempotency key.
- Photo annotation: asset ID, ordered positions, candidate/confirmed person IDs, display label, source and review state.
- Proposed graph batch: new provisional people/relationships/stories, exact support, origin, dependency IDs and stable staging IDs. Convert IDs transactionally on commit; names alone are not deduplication keys.
- Source presentation/translation lineage: English display fields and derivative provenance, separate from untouched private originals.
- Connection/source state: saved bundle versus real verified connection, and what source job is actually executing.
- API: start returns promptly with a persisted run; polling after sequence or SSE delivers actual deltas; answer setup questions; add clue; seal/download. Extend existing RootsApi without duplicating state in UI.

Prefer an explicit, resumable pump driven by the existing polling path or a bounded local worker over an untracked fire-and-forget promise inside a route. Refresh must resume the same run and sequence, not restart the three-minute animation. Cancel/New project must stop the old run's pending work. Preserve old roots-v1 projects through optional defaults or a tested migration.

## Ownership and handoff

| Owner            | Round-2 responsibility                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Codex Mike       | contracts, API/run orchestration, seven questions and graph proposals, state/review/translation integration, server upload limits, export sealing, title/metadata wiring, dependencies, integration and final acceptance |
| Codex Natalia    | intake and naming guidance, logo, connection presentation, loader/question/map states, English-only rendering, progressive animations, user controls, client size checks and UI tests                                    |
| Claude Code Mike | private English demo pack and source mapping, ordered-photo manifest, three reconstructed chat archives, supported parsers, staged source/retrieval modules, English book/export projection and data/export tests        |

Work in separate clones on the existing owned branches. You are not alone in the codebase: preserve other owners' work and never force-push. Worker-owned modules are edited by their owners until handoff. Only Mike changes packages/contracts, package manifests and lockfiles. Natalia also owns assets/roots-mark.svg for this round; Mike owns src/app metadata/favicon integration. Coordinate through pushed commits and per-owner status, not assumed shared local files. Preserve the lead's strict portable-state adapter; an older alternative export adapter is not a replacement for it.

The private pack is handed to Mike locally. Natalia receives a public-safe fictional twin with the same shapes, sizes, seven categories and staged cadence. No family files or private Drive URLs go into public GitHub. Folder creation or prompt publication does not dispatch an agent or mean the round is implemented.

## Demo-ready release gate

Do not declare round 2 ready until the integrated candidate passes all of the following:

1. All 74 baseline tests still pass; add focused tests for new state, ZIP parsing, translations, limits and sequence behavior. Typecheck and production build pass.
2. Fresh start from just personal details and the exact 01-upload files. No manual JSON import, console command, hidden project injection or stale localStorage is needed to start the presenter journey.
3. No work before Start. Immediate loader, all seven sourced questions, edit/unknown/back, coherent first map, then at least six distinct saved graph/evidence batches across at least 60 seconds. No all-at-once population or fabricated live counters.
4. English-only scan of every reachable UI state, tool/error text, filenames and extracted PDF/HTML/project/source text. Visually inspect the selected photos and every PDF page; scan actual rendered content, not just static source strings.
5. The exact supplied ZIPs parse with message/attachment provenance. Malformed ZIP, traversal, expansion cap, missing attachment, duplicate source and a >30 MB but valid upload produce the specified results.
6. Verify confirmed photo order, unknown identity, same-name candidates and no face-based identification. Seven different question categories must be visible in the actual run.
7. A genuine new clue triggers a real Astra request, source-backed human decision, saved graph/story change and regenerated English passage. Prepared replay can support timing but cannot count as this live pass.
8. Refresh mid-run preserves progress. Correction during analysis survives late results. Unknown remains unresolved. No repeated source, decision or graph batch duplicates data or inflates counters. Retry and API failure remain usable and truthful.
9. Early and normal Download seal a consistent state. Verify current PDF/HTML, ZIP integrity, exact included asset hashes and portable English-project reopen. No scheduled updates arrive after completion. Failure remains retryable.
10. Run the normal complete presenter script twice in a real browser, from new projects, Start to received download in at most 180 seconds each. Record timings and real/prepared work separately. Slower manual exploration is not a failed timed run, but cannot be reported as a sub-three-minute rehearsal.

Deliver the running local URL, exact private input folder, final tested branch/commit, a one-page English presenter script with all seven recommended answers and source locations, optional locally saved backup recording, and a truthful release report. Retain an offline prepared fallback with provenance; record if it was used. Do not publish private demo assets or send external messages. Push safe code/status; default-branch publication follows any still-applicable explicit approval restriction. If a required gate fails, report the exact failure and continue fixing it rather than calling the product demo-ready.
