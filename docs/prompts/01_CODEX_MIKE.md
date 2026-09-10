# Execute: Codex Mike, integration and Astra

Repository: https://github.com/mikeeekoch-cmd/osmy-roots

We are building Roots with three concurrent workers: Codex on Mike's account, Codex on Natalia's account/other laptop, and Claude Code on Mike's account. The goal is a convincing LOCAL prototype within 90 minutes of the lead's recorded T0. We cannot deliver a full production app in this time. Make documented scope tradeoffs to protect the demonstrated route. Mike is here to help; ask a concise question for missing input, credentials or a blocker over five minutes and keep doing independent work.

Start by fetching the repository and reading AGENTS.md, docs/EXECUTION.md, docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/CONTRACT-V3.json, docs/READINESS.md and docs/status/*.md. Read the latest private scope/engineering tab and HTML reference available through Mike's configured private context or local download. Report inaccessible references; the safe repository scope is sufficient to start independent work. The current 90-minute plan supersedes V3 staffing and full-platform dependencies. GitHub is the engineering ground truth: commit/push your safe code, tests, decisions and owner status at meaningful checkpoints, about every 15 minutes. Routine commits/pushes are authorized. Private family assets, Drive URLs, credentials and raw model traces stay outside this public repo.

You are not alone in the codebase. Use your assigned branch in a separate clone/worktree, preserve others' changes and never force-push/reset shared work. The lead owns contracts, dependency/lockfiles and integration. Hand off branch + commit + commands + checks + remaining gaps. All workers use the lead's shared T0+90 deadline. Start work now; do not stop after proposing another plan.


## Your finished deliverable

A local app, started with a documented `pnpm dev` command, in which a newly added source produces a real source-linked Astra proposal; a human decision changes persisted family state; and Download family book returns the current illustrated book/project package. You own the behavior connecting the other two workers. A scaffold, API description or success log alone does not satisfy this assignment.

Read docs/PROTOTYPE-CONTRACT.md and all three detailed prompts first. Work on codex/engineering. Own packages/contracts, server/agent, server/state, server/events, src/app route/integration wrappers, dependency/config/lockfiles and integration-tests. Natalia owns server/ingestion and server/export; Claude owns src/ui. Never rewrite their modules while they are building them.

## Exact tasks, in execution order

1. **Bootstrap and shared interfaces, T+0 to 10.** Record T0/deadline and current commit. Make the existing Next.js/TypeScript plan runnable. Publish a working development command, local environment instructions, runtime schemas, the RootsApi interface and the three Natalia function signatures from PROTOTYPE-CONTRACT.md. Export a small synthetic snapshot/proposal/event fixture. The lead's src/app/page.tsx mounts Claude's `RootsApp({api})`; use a temporary placeholder only until her module is ready. Tell workers the contract commit and dependency choices.
2. **Private local state.** Implement load/save ProjectSnapshot with stable IDs and increasing version in an ignored local directory. Provide serialized writes and reject stale baseVersion. Keep originals/media private; serve assets by project/asset ID. Refreshing the browser must retain edits. This is single-user localhost; do not build Supabase/Auth or deployment first.
3. **Input and internal processing.** Implement createProject by calling Natalia's import/ingestion functions. Validate required name, geography-or-unknown and evidence/context. Preserve the prepared seed as imported existing data. Emit real import/parsing events and select a focused family branch. Keep unsupported files visible as not processed. A full LLM reanalysis of all 35 people is unnecessary.
4. **One real Astra investigation.** On addContribution, send the actual short source and relevant known people/claims to the configured server-side Astra model. Request structured output: candidate person IDs, proposed fact/story, exact supporting quote/locator, uncertainty and one focused question. Validate the schema, IDs and exact quotations against the source before exposing the proposal. Run one real request early; record model/request outcome privately. Missing credentials go to Mike as an immediate local-environment action, while other work continues.
5. **Review that actually changes state.** Implement accept, correct, reject and unknown. Pending/rejected/unknown claims must not silently become accepted facts. Accept commits a story/claim and its source to the person, increments version and records before/after history. Correct preserves the original evidence and records the human change. Add/edit person and relationship plus one-level undo; validate graph references and ancestry cycles. Idempotent retry must not duplicate records. Invalidate affected book passages after edits.
6. **Model-written, cited book passage.** Generate one short English passage from current accepted claims and attributed memories. Return text, claim/source locators and acceptedStateVersion. Validate its supporting references; omit or label unknown facts. Do not copy a canned paragraph and call it a live generation. Existing layout and other chapter text may be prepared. Do not serve stale book text as current after a correction.
7. **Glue UI, events and download.** Implement the RootsApi adapter and thin routes. Use simple snapshot polling if faster than streaming. Counters reflect actual completed actions; zero websites is valid. Call Natalia's buildFamilyBundle with current state, passages and an asset resolver. Return ZIP bytes to Claude's download button. Make failures visible without losing accepted work. No fake progress or untracked background job is needed.
8. **Integrate by T+55, verify by T+90.** Fetch worker branches and integrate their callable modules early. Run the shared acceptance scenario twice: new source, actual proposal, accept, visible story/source, generated passage, downloadable PDF/ZIP, JSON reopen. Also verify unknown, correction, duplicate source/review, stale version, refresh and a model failure. Use meaningful tests and one actual browser walkthrough; report any unperformed check. Freeze new features at T+70 and fix the route.

## What to hand to Mike

- Running local URL and exact setup/start commands; tested branch/commit pushed to GitHub.
- A 2-3 minute click script naming what to upload, what question appears, what to confirm and where the result changes.
- Actual model-call result, tests and observed latency, without secrets/private request bodies in Git.
- Clear list: working, prepared, cut, blocked. A mock-only AI route is an explicit gap.
- docs/status/lead.md with contract commit, worker commits integrated, T0/deadline and next action.

## Tradeoffs and help

Protect source → real proposal → human decision → saved map/story → current book download. Defer OAuth, broad archive search, cloud, universal imports and restoration. If an export layout is slow, use a simpler PDF with the current source-backed passage; preserve the editable JSON and evidence. Ask Mike for access, assets or a blocker over five minutes; keep independent work moving. Make routine scope cuts and commits without another planning round. Do not claim completion until the local route actually runs.
