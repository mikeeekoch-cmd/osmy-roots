# Final assignment: Codex Natalia, UI and animations

Repository: https://github.com/mikeeekoch-cmd/osmy-roots

We are building Roots with three concurrent workers: Codex on Mike's account, Codex on Natalia's account/other laptop, and Claude Code on Mike's account. The goal is a convincing LOCAL prototype within 90 minutes of the lead's recorded T0. We cannot deliver a full production app in this time. Make documented scope tradeoffs to protect the demonstrated route. Mike is here to help; ask a concise question for missing input, credentials or a blocker over five minutes and keep doing independent work.

Start by fetching the repository and reading AGENTS.md, docs/EXECUTION.md, docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/CONTRACT-V3.json, docs/READINESS.md and docs/status/*.md. Read the latest private scope/engineering tab and HTML reference available through Mike's configured private context or local download. Report inaccessible references; the safe repository scope is sufficient to start independent work. The current 90-minute plan supersedes V3 staffing and full-platform dependencies. GitHub is the engineering ground truth: commit/push your safe code, tests, decisions and owner status at meaningful checkpoints, about every 15 minutes. Routine commits/pushes are authorized. Private family assets, Drive URLs, credentials and raw model traces stay outside this public repo.

You are not alone in the codebase. Use your assigned branch in a separate clone/worktree, preserve others' changes and never force-push/reset shared work. The lead owns contracts, dependency/lockfiles and integration. Hand off branch + commit + commands + checks + remaining gaps. All workers use the lead's shared T0+90 deadline. Start work now; do not stop after proposing another plan.


Final ownership override: Codex Mike leads agent/state/integration; Codex Natalia owns UI/map/animations; Claude Code Mike owns ingestion/retrieval/export. P0 comes first. Start the next scope only after your P0 passes checks and the lead confirms integrated P0; stop adding features at T+70. Read docs/SCOPE-PRIORITIES.md for the exact live/prepared/mock boundary. Record the actual contribution of each coding/model tool honestly.

## Your finished deliverable

A clean, usable two-screen React experience in which Mike can drop family material, watch actual progress, inspect a generational map, contribute a clue, review a proposed story and download the resulting book. It must be easy to follow on a projected screen. A Figma design, collection of mock screenshots or disconnected components does not satisfy this assignment.

Work on codex/ui in a separate worktree. Own src/ui, UI tests and docs/status/ui.md. Read docs/PROTOTYPE-CONTRACT.md and the latest private HTML reference. Export `RootsApp({api})` from src/ui/index.tsx. The lead mounts it and provides RootsApi; Claude owns parser/search/export modules. Start with a labeled fixture adapter immediately; swap to the real adapter as soon as available. Do not edit backend/routes, shared schemas or lockfiles.

## Exact screens and interactions

1. **InputScreen.** Warm, calm introduction, a compact drop area and short form. Required: starting person/family name; family geography or explicit unknown; at least files, context or prepared packet. Optional fields collapse: birthplace/current place, family places with periods, approximate years, aliases and book language. Show chosen files as small removable chips/thumbnails with type/status; list photo, TXT/JSON, document and chat-export support honestly. Display connections separately as optional unavailable/preview controls. Start the search calls createProject, shows real loading/error, then opens the workspace. Do not add a plan approval page.
2. **ResearchWorkspace.** At desktop widths, aim for 22% left progress, 56% center canvas, 22% right human contribution; retain readable minimum widths and let the canvas pan. One top bar with family name, connection/run state and Download family book. No plan/book/build tabs. At narrow widths, put side panels in drawers. Do not hide meaningful errors or a pending question behind decorative animation.
3. **ResearchProgress.** Display concise current action, processing/paused/completed/failed state, latest useful finding and counts derived from api events. Show file/source details on click. Distinguish prepared import, cached source, live model response and replay. A loading animation can run while waiting, but website/record totals must not rise without completed events. If no website was fetched, show zero or hide that metric. This panel explains work through actions/results, not private chain-of-thought.
4. **FamilyCanvas.** Default to the selected five-generation branch, with View all for the supplied 35-person seed. Parents above children, partners side by side, connectors visually distinct. Cards show an original photo/placeholder, English name, life years or unknown, plus a small uncertainty/discrepancy marker. Support pan, zoom, fit, person search and click selection. Drag positions may be locally persisted as layout; they must not change genealogy. Fixed generation coordinates are allowed if automatic layout is slow.
5. **PersonDrawer and RelationshipDrawer.** A person opens a readable card with full English/original name, dates, original photo gallery, facts, attributed family stories, exact source excerpts/locators, unresolved discrepancies and chronological changes. A relationship opens its own type, evidence and review status. Provide a small edit form and Add person/Add relationship controls through mutateGraph, not fake local labels. Preserve unknowns and show errors for invalid graph edits. Include one-level undo via the API. Keep the human Q&A reachable when the drawer is open.
6. **HumanContributionPanel.** Make this visibly different from the machine progress panel, using a warm tint, clear Your turn label and one focused question. Show the proposed person/story and the original quote that motivated it. Buttons: Accept, Correct, Reject, I do not know. Correct opens a short form; unknown leaves it unresolved. Let Mike paste another memory or drop a file at any time, optionally attaching it to the selected person. Pending input remains visibly pending. After acceptance, update the canvas/person story/source count from the returned saved snapshot and briefly highlight the affected card.
7. **Download and book state.** The workspace button calls downloadFamilyBook and saves its returned ZIP. Show generating, ready or a specific error; do not download a static prebuilt file while claiming it reflects current edits. Briefly explain that the ZIP contains the illustrated PDF and editable project. Mark stale book state after a correction and let the lead regenerate. No separate book page is required.
8. **Connect and verify.** Push the shell by T+25, connect the first real adapter by T+45 and support the full route by T+55. Verify form validation, selected files, map fit/search, person/edge evidence, photo proportions, new contribution, accept/unknown/correction, persisted refresh and successful download with the lead. Capture real browser screenshots using safe fixture data; report any unverified interaction. At T+70 freeze extras and fix readability/core defects.

## Suggested file outputs

src/ui/index.tsx, InputScreen.tsx, ResearchWorkspace.tsx, ResearchProgress.tsx, FamilyCanvas.tsx, PersonDrawer.tsx, RelationshipDrawer.tsx, HumanContributionPanel.tsx, shared styles and UI tests. File splitting is flexible; these observable behaviors and the exported RootsApp interface are the acceptance target.

Hand off your pushed branch/commit, local screenshot or browser verification evidence, adapter integration requirements and docs/status/ui.md. Keep actual family screenshots private. Ask Mike when missing references or unclear visual choices block you; use the source-backed two-screen scope to continue. Do not spend the sprint recreating a design system, adding new screens or building a separate backend.

## P0 additions: animations and visible file/research work

You own every product animation. Keep motion tied to actual state:
- Drag/drop hover and removable upload thumbnails; each file displays queued, parsing, parsed, stored-only or failed from backend outcomes.
- A loading indicator during actual parsing/model/fetch work. List the actual current action and latest result, with source links and live/cached/prepared/replay labels.
- A short card enter transition when a saved person arrives, smooth focus/pan and a brief highlight of the person/story changed by an accepted review.
- An unresolved proposal stays visually distinct. Choosing unknown must not animate an accepted ancestor or add a confirmed edge.

Build these subtle transitions in P0 with CSS or the existing library; ask the lead before adding dependencies. They must not delay a usable UI or increase completion counters. Respect reduced-motion preferences. For the screen demonstration, make the selected branch fit and the right human panel clearly distinguishable from machine progress.

Search/crawling runs in Claude's server/research and is orchestrated by Mike. Your left panel consumes their events. Show local-source results, one public-fetch success or failure, and an honest count. While developing alone, a labeled fixture adapter may provide events; replace it with RootsApi for P0 acceptance. Connection buttons can remain disabled/preview-only. Do not build a fake browsing video and imply it is live.

## After validated P0

Once the real adapter, editable tree and download pass the lead's integrated P0: add a source-to-person path animation, improve branch filters/layout and polish gallery navigation, in that order. Stop at T+70. P1 progress must remain evidence-driven; rendering the additional existing reference is explicitly an import.

## Explicit mock boundary

Allowed: prepared 35-person graph, fixed generational coordinates, original prepared photos and a development-only fixture adapter. Core interactions are real: file selection, editable cards/edges, source inspection, review submission, response-driven updates and download. Do not use fake counters, simulated accepted changes or a static download. A label must identify replay or unavailable connectors.
