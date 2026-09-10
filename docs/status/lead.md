## Active implementation checkpoint

Contracts 0eea05b pushed at approximately T+3 minutes. Core round-3 runtime and routes now implemented locally: explicit cycle state/actions, persisted Astra plans/jobs, intake analysis, later bank answers, atomic graph review, authoritative metrics, provider OAuth/read boundary, autofill drafts and immutable current-book wrapper. Typecheck passes. Tests and integrated candidate are next; no runtime acceptance claimed yet.

User update: mock Google Drive/Gmail connections using prepared copies are now explicitly selected for this demo. mode=demo is published in ConnectionStatus. Real Astra work remains required; actual OAuth credentials/read acceptance is superseded for this presentation. Natalia should render Demo beside the connected state and use prepared-copy details. Claude retains single private packet ownership.

# Round 3 execution checkpoint

Started 2026-09-10T20:08:05Z on codex/engineering at a7d50ab. Origin fetched. Round-2 production on 3200 remains untouched; round-3 candidate will use 3300 and an isolated build directory. Actual versioned contracts and API examples published in packages/contracts/round3.ts and docs/round-3/API.md. Natalia and Claude retain their ownership; no replacement agents.

Access: Astra key configured; no Google OAuth client in the application environment. User requested to configure GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET with callback http://127.0.0.1:3300/api/connections/callback. Real successful read remains required. Estimate after contracts: 60-90 minutes for runtime and integration, then media/book readiness and two full rehearsals; provider authorization and Claude packet determine the final acceptance time. No new deadline or readiness claim.

# Codex Mike status

## Round 3 planning handoff, 2026-09-10

The user's next revision is specified in docs/round-3 and prompts 09-11. Exactly three owners: Mike handles contracts/Astra/connections/state/integration, Natalia UI, and Claude private content/media/retrieval/full-book export. The new flow has six initial checks with at least three large photos, one initial research cycle and two explicit deeper cycles, a later question bank, actual metric growth, all selected-old-photo sliders and a current 35-40-page English book. The user replaced the total 120-second ceiling with about 20 seconds of visible actual work per research click before progressive results.

Read-only code/content audits and a live intake inspection informed the plan. Current input is 20 files/35 people, current PDF is four pages, actual Gmail/Drive authorization and general research cycles do not exist yet, and the old-photo pair set needs preparation. These are next-round implementation requirements. No application code, private packet, provider state or live project changed. No new engineering clock or implementation run started. Safe prompts, ownership and acceptance are published for launch; the private source handoff remains ignored/local. Earlier readiness below applies only to round 2.

## Final round 2 handoff, 2026-09-10

- Integrated-demo-ready locally: application a627436, production http://127.0.0.1:3200. Two fresh Chrome rehearsals passed with actual file receipt at 104.174 and 104.747 seconds; the second refreshed/resumed. Both current PDFs passed full visual review. Safe details: docs/READINESS.md and docs/round-2/ACCEPTANCE.json.
- Original round-2 T0 18:18:15 UTC and deadline 19:48:15 UTC retained. Contracts published T+4:28. Actual API route integrated/exported T+54:31; corrected browser acceptance followed. Application code froze at 19:18:20, before T+70. Later changes are status/documentation only.
- Exact final input: 20 ordinary files, 35 people, 56 sourced relationships, 14 unchanged original photographs, three reconstructed English chat archives. No visible CSV/technical IDs, enhanced photos or hidden graph injection. Product's latest Desktop upload copy matches the frozen files. Earlier packet versions and original source narrative are preserved.
- Lead contracts/Astra/state/route changes, Natalia's final UI history and Claude's parser/export history are integrated. Codex helpers added regression checks, fictional fixtures and source/visual QA. The Product task remained sole owner of actual private facts, files and presenter cues. The shared manifest is schema-normalized and hash checked; its contents and outputs stay private.
- 171 tests, typecheck and production webpack build pass. Both actual downloads preserve all 23 asset hashes, full English evidence and review state; each reopens in an empty store, permits edits and invalidates its previous book on change. Source-matched narrator, exact quote, uncertainty and current Astra passage pass in both outputs.
- Prepared family records, source derivatives, reconstructed dialogue and release cadence remain distinct from live Astra interpretation and book generation. No live website discovery, hosting, arbitrary archive importer, OCR/restoration or standalone editable HTML map is claimed. Final packet uses original photos; optional older photo pairs remain supported.
- Private output and presenter instructions are delivered locally. Default-branch publication remains restricted to a separately approved exact commit; routine engineering-branch publication is authorized. One optional internal Product status message was rejected by automatic approval review and was not sent. It did not block the code or local output delivery.

## Historical round-1 and intermediate execution records

- Shared T0: 2026-09-10 16:27:53 UTC / 12:27:53 EDT.
- Contracts due T+10: 16:37:53 UTC / 12:37:53 EDT.
- Integrated P0 due T+55: 17:22:53 UTC / 13:22:53 EDT.
- Feature freeze T+70: 17:37:53 UTC / 13:37:53 EDT.
- Shared deadline T+90: 17:57:53 UTC / 13:57:53 EDT. No worker resets this clock.
- Branch: codex/engineering. Base: 4d1c86a (latest main at fetch).
- Contracts: packages/contracts/index.ts; worker module signatures and RootsApi included. Schema version roots-v1.
- Dependency choices: Next.js, React, Zod, official OpenAI SDK; pure async worker functions with Uint8Array bytes. Lead pins versions in lockfile.
- Run: pnpm install; copy .env.example to .env.local and configure server key; pnpm dev.
- Working: contract/scaffold implementation underway; no end-to-end pass claimed yet.
- Blocked: no application OPENAI_API_KEY in environment at kickoff; requested local configuration from Mike. Private scope refresh pending.
- Worker handoff: Natalia exports RootsApp from src/ui/index.tsx; Claude exports modules from server/ingestion/index.ts, server/research/index.ts and server/export/index.ts. Please consume published types without editing them; request additive changes here.
- Scope: local single-user storage; text/JSON/photos first; prepared/synthetic sources always labeled. OAuth, cloud, universal chat imports, broad crawling, restoration and standalone editable HTML map deferred.
- P1 gate: CLOSED until integrated P0 has passed; fix integration first.

## 16:40 UTC checkpoint

- Contracts published: e838039 on codex/engineering, before T+10. Worker handoff details: docs/CONTRACT-HANDOFF.md. Automatic approval review blocked a direct scaffold push to main; continue consuming codex/engineering.
- Scaffold verified: pnpm dev served HTTP 200 on 127.0.0.1:3000. Typecheck passed.
- Implemented: serialized atomic local persistence; citation/reference/cycle checks; accepted/unknown/rejected/corrected decisions; fixed-ID idempotent review; manual graph edits and one-level undo; real-event counters; official Astra structured analysis and passage adapter; HTTP/RootsApi integration wrappers.
- Tests: 10 consequential state tests passed (node --import tsx --test integration-tests/state.test.ts). Worker modules are still behind an explicit unavailable boundary; no full app pass claimed.
- Actual inference attempt: gpt-6-astra, 2095 ms, HTTP 429, credit_balance_exhausted. No live proposal generated. Server key configured locally without exposing it. Mike asked to apply credits or use a funded project.
- Private Scope Review and Engineering handoff refreshed at version 16:24:37 UTC. Current scope agrees with repo. Private material remains excluded.
- Both external workers confirmed running. UI branch is now visible; first data/export branch not yet pushed.
- Next: integrate worker modules, test source-to-review/book transitions and model failures, resolve credited model access. P1 remains closed.

## Early UI integration

- Integrated Natalia's 1c356f2 into codex/engineering; src/app/page.tsx mounts RootsApp with the real adapter. Browser input validation and initial rendering observed. Full route awaits data modules and credits.
- Natalia next-pass requests: polling currently skips while active.current, hiding actual in-flight model events; allow snapshot polling during contributions. The global busy gate also blocks a second contribution while one runs; support adding clues during analysis without stale UI overwrite. The backend already serializes short writes and preserves accepted state during model calls.
- Input screenshot at 1106px wide showed the right intake column clipped horizontally; check responsive width/box sizing. Prepared-packet copy should say synthetic example when no private packet is configured. Remove em dash characters in newly authored UI copy to match Mike's instruction.
- Preserve graph status sent by the editor: lead is adjusting backend relationship edits to respect unresolved/disputed/rejected rather than forcing accepted.
- State/orchestration suite: 16 PASS. Two source-to-book runs use explicitly injected TEST_ONLY model/package adapters, not a PDF/live-model pass.

## Data/research first handoff integrated

- Integrated Claude 67e1350 and Natalia e3b5967 into the engineering branch. Claude's pure ESM modules use the preparation DTOs; lead-owned server/agent/data-modules.ts adapts them to the published runtime schemas without rewriting worker code.
- Actual ingestion now preserves original text/file bytes, opaque assets, hashes and parsed/stored-only outcomes. Shared snapshot and legacy seed imports validate. Legacy assertions are explicitly sourced to supplied tree JSON when primary references are absent; no independent archive verification is inferred.
- Integrated public fetch verified: Library of Congress permitted URL returned status ok, 221627 text characters and SHA-256 e313072e3a2d2bd5ee2c28acf107312507e17c84d003191da676b3cd1d478bf9 in 227 ms. This is retrieval, not a family identity match.
- Claude: T0/contracts have been published since e838039 on codex/engineering. Main remains unchanged because automatic approval review blocked the default-branch push. Please fetch codex/engineering and read packages/contracts plus CONTRACT-HANDOFF.md; no restart of your clock. Export is the remaining module handoff; I will adapt DTOs in the lead boundary as needed.
- UI and state tests: 21 pass. API inference credit issue is being retried after Mike added API Platform credit; no successful inference claimed until observed.

## Live Astra and browser checkpoint

- API Platform credit is now configured. A validated gpt-6-astra proposal completed in 5316 ms; the first successful API response had a candidate-list inconsistency and was rejected before state exposure. The tightened request passed IDs, source locator and exact-quote checks.
- Actual browser route observed: new pasted synthetic source -> live Astra proposal (3886 ms server analysis) -> Accept -> persisted v6 story and exact source. The two birth-year claims remain disputed. People count remains 5; analyzed records 1; websites 0.
- Actual generated book passage completed in 3581 ms and is saved as current v8 with live model attribution and valid claim/source references. Export still returns the explicit module-not-integrated error until Claude's bundle arrives; no PDF download success claimed yet.
- Added a fictional five-generation runtime example with cited relationships, two conflicting birth years and an original code-generated placeholder portrait. Initial development fixture remains explicitly separate.
- Real private 93-person seed passed the lead runtime validator: 142 relationships, 427 normalized claims, 44 stories, 5 reported issues. Private contents were not committed. Normalized extraction and original uploaded JSON bytes are retained separately.
- Natalia 5a08ca1 integrated: live polling and mid-run contributions, responsive intake fixes, synthetic labeling and book text in workspace. P1 remains closed until actual ZIP/PDF/reopen validation.

## 17:03 UTC integrated P0 checkpoint

- Worker commits integrated: Natalia cab71b8; Claude 1ff9020. Export adapter committed as 47a9a51. Current branch contains both owners' changes intact.
- Integrated live source -> actual Astra proposal -> accept -> saved story -> current passage -> real PDF/HTML/ZIP -> JSON reopen passed twice (9284 ms, 7402 ms). Four PDF pages rendered and visually inspected.
- Browser: actual ZIP download passed. A second new live interpretation was marked unknown, survived refresh without changing the book, then was revisited and accepted; accepted state became stale until regeneration.
- Cross-machine reopen fixed and tested: originals match content hashes even when ZIP filenames are opaque asset IDs; no model call is made to restore a reviewed project. Complete sources, proposals, events and history survive roots-v1 export.
- Validation: typecheck PASS, 71 tests PASS, production build PASS with two local-store tracing warnings. No P1 feature was started before these checks.
- Shared deadline remains 17:57:53 UTC / 13:57:53 EDT. This checkpoint is before the T+55 integration target.
- Natalia/Claude: consume codex/engineering, not unchanged main. T0 and contracts have been published there since e838039. Main push was rejected by automatic approval review; final checked publication needs Mike's explicit approval.
- P0 route is validated. P1 gate opens only for bounded work on this integrated base; prioritize any integration defect first. Native chat parser is skipped without a real sample. No search provider is configured, so do not spend this sprint on provider onboarding.
- Next: final browser reimport/checkpoint, private-input local rehearsal if practical, and safe final handoff. Cloud, OCR, broad crawling and editable HTML map remain cut.

## 17:25 UTC final integration checkpoint

- Main a5de7c4 was pushed and verified after Mike approved that exact tested commit. No force push or existing commit removal occurred.
- Integrated Natalia c08ff3d, including c78696c: saved-source connection motion, branch selection and accessible gallery paging. Her P1 work followed the 17:03 integrated P0 gate. Claude's ingestion/retrieval/export through 1ff9020 remains in use. His later afb4250 is an alternative adapter, preserved on codex/data-export; the runtime uses the lead's stricter portable-state adapter instead.
- Corrected review decisions now retain a separate human-edit source as well as the original quotation. Book selection follows the latest reviewed person, including corrections to an older story. English model text keeps source quotations in their original language.
- Selected private rehearsal: 35 imported people, ten original photos, actual source hash/paragraph verification and an English live proposal. The new proposal remains pending Mike's decision. Its baseline book is generated from existing accepted material. No new archive discovery is claimed.
- Private rendering exposed source-quote overflow and raw relationship values. The adapter now prints compact numbered locators, qualifies approximate dates and renders relationship values as prose. The compact PDF chapter uses current English model prose; other recorded stories and the complete numbered source register remain in HTML/JSON. A small optional compactChapter setting in Claude's already-delivered renderer fixes this integration issue without replacing his module.
- All four revised private PDF pages rendered and visually inspected. The ZIP includes all 13 original files with matching hashes and no omitted assets. Private files, scripts and screenshots remain ignored and local.
- Current checks: typecheck PASS, 74 tests PASS, production build PASS (two known local-store tracing warnings). Third complete real Astra synthetic round trip PASS, 8762 ms, 1,667,269-byte ZIP. Automatic review initially misclassified that synthetic test as private; inspection proved it uses only the public fictional fixture and the authorized retry passed.
- Public source/credential scan and UI screenshot review found no private evidence or secrets. Contract deadline and P0 integration target were met; shared freeze 17:37:53 and final deadline 17:57:53 UTC remain unchanged.
- Next: publish this checked integration checkpoint on codex/engineering, retain the private pending decision for Mike, and finish local handoff. Further new features are frozen early.

## Round-2 prompt handoff, not execution

- Mike requested three new owner prompts after reviewing the intake and workspace. The controlling new brief is docs/round-2/DEMO-READY-SCOPE.md; launch links are in docs/round-2/README.md. No agent was dispatched by writing these files, and no new engineering clock was started.
- Baseline 556953f was rechecked: typecheck PASS, all 74 tests PASS, production build PASS with the same two filesystem tracing warnings. Main remains a5de7c4; workers must fetch the engineering branch to retain all final P0/partial P1 fixes.
- New requirements: files-only intake, English demo artifact pack, supported reconstructed chat ZIPs, seven varied sourced questions with recommended/editable/unknown answers, immediate loader before the map, staged saved graph growth, English-only presentation and demo export, and a run sealed by successful download.
- Mike chose seven questions and no global Demo mode banner. Ordinary source provenance remains available; simulated source bundles cannot produce false Connected or Found online claims. Real model work is separate from staged prepared material.
- Ownership is unchanged except Natalia explicitly owns the small SVG logo asset; the lead wires metadata/favicon. Claude creates the private artifacts and English evidence lineage; the lead owns the resumable run and final integration. Required demo-ready exit is two fresh actual browser journeys under 180 seconds with the specified data, review, English, export and regression gates passing. These new features are not yet implemented.

## Revised four-owner handoff: 120-second interaction

- This revision supersedes the preceding round-2 timing and content-ownership entries. Mike requested four executable prompts: lead integration, Natalia UI, Claude data/export, and a separate product/content owner. Prompts 04-07 and docs/round-2/NARRATIVE-DATA-CONTRACT.md now carry that split; AGENTS.md routes the next execution to the updated scope.
- The active private narrative is 01_demo_script.md revision 2. Its opening and dedication are preserved. A separate revised cue sheet must reconcile seven checks, English derivative sources, supported supplied chat ZIPs and Osmy Roots branding. The canonical private script was not overwritten.
- Verified selected input: 35 people, 57 raw relationship entries; the previous normalized project has 56 relationships. Product audits the difference. The initial ordinary upload files must cover all final intended people, links, photos and stories. No hidden project injection or expected-answer file is part of intake.
- New application budget: Submit/Start to Download click <=120 seconds. Targets: preparation 0-8, seven explicit answers 8-35, initial branch at 35, six saved batches at 44/53/62/71/80/89, current book/bundle ready by 108 and click by 115. Actual file receipt is measured separately and targeted by 120. Narration before Submit and after Download is outside this interaction clock.
- Product owns actual private files, manifest values, source/translation/photo lineage, complete coverage and presenter cues. Claude owns parsers/retrieval/export against the frozen packet; Natalia owns display/animations; Mike owns runtime schemas, model/state/run, integration and acceptance. Private source pointers are in an ignored local handoff, not Git.
- No engineering agents were dispatched, no new T0 started and no content packet was claimed complete in this documentation pass. Existing P0/partial P1 evidence remains the 556953f check: 74 tests, typecheck and build passed with two known tracing warnings. This pass changes instructions only; application tests were not rerun as if code changed.
- Required next execution: one shared T0+90 engineering deadline, contracts within ten minutes, P0 integration by T+55, freeze by T+70, then all shared checks and two real fresh <=120-second browser rehearsals. Status must distinguish content-ready, engineering-ready and integrated-demo-ready.

## Round 2 execution: shared engineering clock

- Actual T0: 2026-09-10 18:18:15 UTC / 14:18:15 EDT.
- Contracts due: 18:28:15 UTC / 14:28:15 EDT. P0 integration: 19:13:15 UTC / 15:13:15 EDT.
- Feature freeze: 19:28:15 UTC / 15:28:15 EDT. Shared engineering deadline: 19:48:15 UTC / 15:48:15 EDT.
- Baseline: fetched d10eb59, descendant of validated 556953f, in a separate engineering worktree; preserved the data/export checkout.
- Lead owns contracts, Astra, state, API and integration. Three Codex helpers support integration and QA. External Natalia and Claude owner branches are also active and are integrated without replacing their history. The existing Product task is the sole owner of the frozen private packet; the Product helper supplies its fictional twin and independent QA.
- Published schema: packages/contracts/round2.ts. API/module instructions: docs/round-2/CONTRACT-HANDOFF.md. Fictional structural example: docs/round-2/DEMO_MANIFEST.example.json; zero hashes are explicit example placeholders, not a frozen packet.
- Product is auditing the selected private inputs and building the single private manifest. No content-ready or integrated-demo-ready claim yet.
- Final gate: exact frozen packet, seven explicit answers, six saved arrivals across at least 45 seconds, current source-reviewed English book, and two actual <=120-second browser rehearsals. Timing and failures must be recorded.

## Round 2 integration checkpoint, 18:46 UTC

- Contracts were pushed at 18:22:43 UTC, T+4:28, in ea320f8. The original engineering clock remains unchanged.
- Private content is frozen by Product. Read-only runtime parsing validates 16 uploaded files, 35 people, 56 normalized relationships, exact source quotations and original/derivative hashes. The supplied 57-row audit retains its documented duplicate reconciliation. Public test files are a separate fictional twin.
- Implemented: bounded ordinary intake, seven versioned explicit decisions, actual Astra recollection interpretation, zero visible people before review, dependency-safe saved batches, saved-source provenance, current English book preparation, immutable export sealing, retry, cancellation, portable reopen and photo-pair preservation.
- Runtime edge-case checks caught and fixed unknown-photo reattachment, relationship-correction semantics, cancelled-book resurrection and undo replacing later batches. Independent tests also verified early export, failed sealed export retry and editable cross-store reopen.
- Baseline plus integration tests passed at the implementation checkpoint. Combined external-owner merges, production build and full browser acceptance remain in progress. Isolated checks are not demo readiness.
- A live fictional source-to-Astra-to-reviewed-passage-to-ZIP/reopen smoke test passed in 8.638 seconds. Private live dispatch is pending explicit payload approval after automatic approval review rejected sending the private roster/recollection to OpenAI without that review. No indirect private dispatch is permitted while approval is pending.
- P0 integration and two fresh browser rehearsals remain open. No integrated-demo-ready claim has been made.

## Round 2 ordinary-document candidate, 18:59 UTC

- The user revised the visible input: a personal one-page PDF, natural family notes, photo notes, three reconstructed chat ZIPs and 14 unchanged original photographs. Product froze a new private packet separately; earlier frozen inputs are preserved. The new packet has 20 files, 35 people and 56 sourced relationships. No enhanced photographs or saved background arrivals are supplied in this packet.
- Added the bounded prose parser and stable identity-key contract. It derives parent/partner/sibling connections from actual uploaded sentences, retains tentative links and unknown dates, validates all manifest photo associations against parsed captions, and never imports a hidden register.
- Combined regression suite: 159 tests passed. Production build passed. Exact final packet intake, source spans, photo identities, and roster/link coverage passed with zero people visible before review. The one different date encoding expresses the same two unresolved birth-date alternatives as the reviewed roster.
- The first browser attempt exposed a harness fingerprint mismatch caused by an omitted default field; schema normalization fixes the measurement. The second stopped honestly on an invalid live model citation. The held-out response now constrains citations to the exact uploaded span while leaving person selection, interpretation, question and uncertainty live. No failed attempt counts as acceptance.
- Direct user approval for the scoped private OpenAI requests is now present in this task. Earlier automatic-review rejections of cross-task approval evidence remain recorded; the scope excludes photographs, presenter notes and the full archive.
- Final UI-owner commits are being incorporated before the two fresh private-packet rehearsals. P0 acceptance remains open until those integrated checks succeed.
## Additive photo comparison and invisible timing

- Mike is launching the four assignments. Continue them and their existing deadline. The 120-second budget is internal only: no countdown, elapsed session clock, seconds remaining or time-derived progress in any product screen/details. Actual activity and question/count progress remain visible.
- Added docs/round-2/PHOTO-COMPARE-ADDENDUM.md and prompt 08_CODEX_NATALIA_PHOTO_COMPARE.md. Natalia owns the person-card Original/Enhanced divider and normal gallery fallback; this is a follow-up to the existing UI owner. Product prepares all selected old-photo variants and the private library; Mike owns optional pair contracts/state; Claude preserves both versions and metadata in export/reopen.
- Read-only inspection located two existing private original/enhanced candidate pairs. Their filenames, hashes and alignment/provenance caveats are in an ignored local handoff. No new restoration was run and no private images entered Git. Different crop/geometry must be checked before a usable comparison is claimed.
- Important integration detail: the existing photo lightbox captures left/right arrows globally and traps focus on buttons. Natalia must make the range control keyboard-accessible without triggering gallery paging or escaping the focus trap.
- This is an additive instruction pass, not a feature implementation claim. Core P0 integration continues while content pairs are prepared; local restoration belongs before the timed demo. Final rehearsal includes a brief comparison within the existing map-review segment.

## Integration requests after 32191ee

Natalia UI 1523329 is merged into engineering. Five additional cycle/graph/provider tests pass (fixture model, not live acceptance). Preserve the UI owner changes. Current UI ProviderConnections still requires verifiedAt/connectionId for Connected; please consume the user's new mode=demo contract and display Demo connection state without a fabricated verified read. For demo connect, the server returns a same-origin URL and persists the mock connection; refresh the status in place instead of opening a second app tab. Hide OAuth ID/verify/import controls in this mode; selected prepared copies remain normal source files. User chose this explicitly after the original assignment.

Claude: the edition wrapper now passes options.bookPlan and options.bookEdition to buildFamilyBundle and disables compactChapter for research snapshots. The resulting book.pdf must contain 35-40 real pages or preparation stays error. Please publish callable renderer/packet handoff as soon as available. Need actual public search adapter signature and private v3 manifest when frozen. Runtime continues on source-grounded local searches meanwhile.

## 20:27 UTC verified checkpoint

The integrated intake is running at 3300 with webpack; Turbopack rejected the pre-existing cross-worktree dependency symlink, so the running 3200 baseline and installed dependencies were retained. Actual isolated Chrome verified both Drive/Gmail demo connect actions and persisted Demo/Connected display with no page errors. No OAuth read is claimed.

All 180 baseline/UI/cycle tests passed before one further cancellation test, which also passes. The actual fictional gpt-6-astra plan plus analysis returned two new people and one relationship in 15.057 seconds. Private content acceptance awaits Claude's frozen v3 manifest and callable long-book renderer. Book preview/download now use identical PDF bytes; sealed downloads preserve immutable delivered ZIP bytes and record stopped jobs. Later confirmed/corrected bank answers update their dependent saved claim, while explicit graph review remains separate.

## Small UI recovery request

Natalia: cancelled cycles currently fall through nextCycleAction to Research deeper, but the server correctly requires retry of the same cancelled cycle ID before any deeper cycle. Include cancelled in the active/recoverable cycle selector and show Retry this round (action retry) for failed/cancelled. Keep cancellation truth visible; do not silently start a new ordinal. This is a narrow recovery fix; preserve the current flow.

Runtime update: default intake metrics now include actual parsed file jobs and deterministic source-span checks before the first model result. Unknown/corrected/skipped photo answers revoke the corresponding reviewed portrait while retaining the original gallery and all pair bytes. Existing-person research answers update their dependent claim; family recollection provenance survives reviewed new-person/relationship application.

Content integration note for Claude: the per-section page budgets in the first private handoff sum to 46, although its target says 38-40. Please reconcile actual pagination with the binding 35-40 range while preserving supported coverage. The edition gate checks actual PDF pages, so the earlier budget is not treated as completed pagination. Prepared derivative assets are now supported explicitly through manifest.preparedAssets; the originals-only files count stays 33.

## Continuing integration after Natalia browser handoff

Natalia de351f9 is integrated, including cancelled-cycle recovery and her explicitly fictional browser matrix. The final private acceptance remains separate. The lead rehearsal now checks every original through its actual card/full viewer, all pair bytes, mouse/touch/keyboard controls, focus return, three real analysis rounds, and preview/download equality. The runtime plan receives selected source titles, bounded text excerpts and source queries instead of opaque IDs alone. Empty analyses save no-match outcomes without fabricated findings. Search result URLs do not count as retrieved pages.

Edition files now have unique edition IDs as well as content fingerprints, so a later rebuild cannot overwrite an earlier delivered artifact. The first edit preserves sealed edition metadata in history, and job bookkeeping alone does not mark an unchanged book stale. Interrupted seal receipts can recover from the saved PDF/portable metadata. The test cleanup now waits for remaining cycle workers before removing its store, addressing the asynchronous cleanup race reported by Natalia.

## Renderer/retrieval handoff received

Claude 588cf1f is merged. The private prepared PDF reports 40 actual pages at this first rendering checkpoint; integrated current-state book acceptance is still pending. Two precise remaining adapter needs: (1) buildFamilyBundle must route options.bookPlan to renderBookEdition and include those same prepared chapters/current decisions in book.html plus actual page coverage; its current index still selects the four-page renderer. (2) crawlLinkedPages currently discards result.source text and returns metadata only. Please include the retrieved Source on successful page rows (and mark cached copies origin=cached) so the lead can persist exact evidence and analyze it without fetching every page a second time. The lead is wiring public-search jobs now.

## First v3 manifest validation result

The first private v3 manifest is readable but does not yet pass the published schema. File lineage entries at indexes 3, 7 and 8 use kind/of/ofLocator/note; TranslationLineage requires originalHash, originalLocator, derivativeHash and language=en (method/reviewer optional). The corresponding file hash is the derivativeHash, and the existing of/ofLocator fields provide the original provenance. Also preparedAssets is absent/empty while twelve pairs reference external derivatives. Please emit those twelve explicit path/hash/bytes/mediaType/assetId rows; they were added to the contract in be235c0. No runtime guard has been relaxed. Research sources are present across all three ordinals.

The lead visually inspected all 40 pages of the first prepared English PDF and checked text bounds. No clipped text or broken images observed. The contents leader rules cross the longest titles slightly; please size/omit the rule after long titles if practical. This is preliminary content QA, not a current research edition or final acceptance.

A second manifest integration check found the initial branch plus all researchSources.personIds cover only 18 of the 35 selected people. Seventeen supplied people have no release scope. Please complete the source-supported import groups across the three ordinals, preserving source IDs and provenance. The runtime imports only requested people whose actual claim spans belong to retrieved sources; it does not fill this gap by forcing Astra outputs. The final browser harness now asserts all selected IDs are present after round 3.

Public-search integration is implemented with explicit selected queries, actual provider outcomes and at most two allowed returned leads per job. Unconfigured adapters record zero network attempts and no page credit. Completed no-match model calls count as analyses without adding findings. Latest complete combined suite passed 206 tests before the final source-count/response-summary refinement; focused verification follows.
