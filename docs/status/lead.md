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
