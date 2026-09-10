# Codex Mike status

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
- Lead owns contracts, Astra, state, API and integration. Three Codex subagents cover UI, data/export and product/content ownership for this execution. Existing Claude-authored modules remain preserved; this round does not claim new Claude execution.
- Published schema: packages/contracts/round2.ts. API/module instructions: docs/round-2/CONTRACT-HANDOFF.md. Fictional structural example: docs/round-2/DEMO_MANIFEST.example.json; zero hashes are explicit example placeholders, not a frozen packet.
- Product is auditing the selected private inputs and building the single private manifest. No content-ready or integrated-demo-ready claim yet.
- Final gate: exact frozen packet, seven explicit answers, six saved arrivals across at least 45 seconds, current source-reviewed English book, and two actual <=120-second browser rehearsals. Timing and failures must be recorded.
