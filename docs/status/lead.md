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
