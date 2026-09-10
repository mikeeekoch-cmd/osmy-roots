# Codex Natalia — UI and animations

- Shared clock from lead e838039: T0 2026-09-10 16:27:53 UTC / 12:27:53 EDT; integrated P0 17:22:53 UTC; freeze 17:37:53 UTC; deadline 17:57:53 UTC / 13:57:53 EDT. No clock reset.
- Branch: codex/ui. Separate worktree. Main baseline 4d1c86a; incorporated lead scaffold e838039.
- First code checkpoint: this commit. Only src/ui and this owner status changed. Lead contracts/routes/dependencies preserved.
- Export: `RootsApp({api, initialProjectId?, mode?})` from src/ui/index.tsx. RootsApi and every DTO import the published packages/contracts types. `mode="replay"` visibly labels development use; live is default.
- Implemented: compact validated input; drag/drop/select/remove files with actual thumbnails; source support caveats; responsive three-column research workspace; generational parent/partner graph with pan/zoom/fit/search; source/person/relationship drawers; original photo gallery; source quotations, uncertainty, stories and history; graph add/edit/undo via adapter; contribution and accept/correct/reject/unknown via adapter; versioned writes, response-driven highlight and reduced-motion CSS; real Blob download with failure states; server snapshot polling and reopen by project ID.
- Checks: pnpm install --frozen-lockfile; pnpm typecheck PASS; git diff --check PASS. Browser checks next. No live adapter, model, persistence or export pass claimed yet.
- P0 next: mount against the lead adapter when published, browser validation, duplicate/unknown/edit/reopen/download route. Development harness will be visibly labeled and cannot substitute for connected acceptance.
- P1 gate: CLOSED pending connected P0 and lead confirmation.
- Context: current repository instructions read. Authenticated private root refreshed; relevant execution folder browser accessibility failed to return its contents. Used previously reviewed V3 local scope/reference plus current sanitized repository contract. No complete fresh private sync claimed; no private evidence copied into public source.
- Tool attribution: UI implementation and validation by Codex (GPT-6 Astra). No prior app/mockup code or family photos reused. App model execution belongs to lead; UI does not invoke OpenAI directly.
- Lead integration: import RootsApp and pass your client adapter from a client component. CSS is included by src/ui/index.tsx. Additional packages are not required.

## 16:43 UTC validation checkpoint

- First pushed UI commit: 1c356f2. Added a labeled development harness in tests/ui; it refuses fake PDF/ZIP export and is never imported by production.
- Browser intake checks passed: missing name, missing geography, explicit unknown, missing material, valid context → workspace. Desktop 1440×960 screenshot visually inspected.
- Fixed focused branch selection to include five generations through a middle-generation seed. Added backend file outcomes and source inspection.
- Five UI logic tests pass: required material/geography, duplicate-hash/retry counters, cached/failed website exclusion, approximate/unknown dates, five-generation layout and bounded malformed-cycle layout. Typecheck passes.
- Lead backend checkpoint 2e6dd71 is now available and will be incorporated for connected testing. Lead reports Astra credit_balance_exhausted; live-model acceptance remains blocked, not simulated.

## Connected adapter checkpoint

- Real RootsApi + Next HTTP routes tested locally: browser selected fictional-family.json; createProject imported 5 supplied people; unknown saved version 3, retained 5 people and no accepted story. This is real persistence of a prepared test proposal, not a live Astra pass.
- Fixed lead-requested polling: getSnapshot continues during contribution/model requests. Separate background contributions allow a new clue while another analyzes; pending cards retain failed drafts for retry. Version guards prevent older snapshots replacing newer ones.
- Fixed focused five-generation readability on a 720px-high desktop: compact original-photo/name/date rows; full-map cards retain larger galleries. ResizeObserver refits when available space changes.
- Prepared checkbox explicitly says synthetic example. Own-family JSON upload is separately explained. Removed em dash characters from authored UI. Added min-width protection to intake columns.
- Book passage text and exact source locators are visible inside workspace once backend returns passages.
- Graph editor status/claim controls temporarily removed because backend 2e6dd71 ignores them. I saw the lead is fixing status preservation; will restore status controls on consuming that change. Graph edits remain real recorded human contributions.
- P0 still incomplete: data modules and successful live-model/book route required. P1 remains closed.
