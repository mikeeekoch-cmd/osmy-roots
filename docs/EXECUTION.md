# Roots: 90-minute local prototype

Current execution plan. Supersedes V3 ownership, earlier absolute engineering milestones and any preparation-only hold. The product remains the two-screen experience in docs/PRODUCT.md. The team is Codex (Mike), Codex (Natalia) and Claude Code (Mike). Gemini is not on this sprint's critical path.

## Final P0 and next-scope contract

Read [SCOPE-PRIORITIES.md](SCOPE-PRIORITIES.md). Codex Natalia owns UI and animations; Claude owns files, search/retrieval and export. This replaces the previous assignments. P0 must be checked and integrated before P1. Local evidence search and one bounded public fetch adapter are P0; multi-query discovery and crawling are P1. Conditional external access failures stay visible.

## Objective and deadline

We cannot deliver a fully functioning, production-ready application in 90 minutes. Deliver a convincing local prototype with one reliable, demonstrable journey. Optimize for jury comprehension, visible human contribution and an emotional family-book finish. Cut scope when needed and record the cut. Do not claim we will win or that a prepared result is live.

T0 is when the lead starts execution. Record T0 and T0+90 minutes in UTC and local time in docs/status/lead.md. Everyone uses this same deadline; each worker must not start a separate 90-minute clock. Mike is available to provide context, credentials, files and quick decisions. Ask a focused question when blocked for more than five minutes, while continuing independent work. Routine reversible choices and necessary scope cuts are authorized.

## Ownership

| Owner / branch | Owns | Does not own |
| --- | --- | --- |
| Codex Mike / codex/engineering | packages/contracts, server/agent, server/state, server/events, src/app integration, package/config/lockfiles, integration-tests, docs/status/lead.md | Worker modules before agreed handoff |
| Claude Code Mike / codex/data-export | server/ingestion, server/research, server/export, tests/data-export, tests/research, docs/status/data-export.md | Astra orchestration, application routes, UI, shared contracts or lockfile |
| Codex Natalia / codex/ui | src/ui, UI tests, animations, docs/status/ui.md | Backend, routing wrappers, shared contracts or lockfile |

Use separate clones across laptops and a separate worktree for simultaneous chats on the same laptop. You are not alone in the codebase. Preserve other edits. Never use destructive reset, force-push shared branches or edit another worker's module without coordination. Only the lead integrates worker commits into codex/engineering and merges the checked result into main. Workers hand off a remote branch and commit, not an assumed shared local file.

## Shared source of truth

GitHub committed code, docs, contracts, decisions and per-owner status are the engineering source of truth. Read AGENTS.md, docs/PRODUCT.md, docs/EXECUTION.md, docs/ARCHITECTURE.md, docs/CONTRACT-V3.json, docs/READINESS.md and the latest remote status. Use the newest user-approved scope for the intended experience; this plan controls the 90-minute tradeoffs and staffing. A scoped local-storage mode overrides the earlier Supabase/hosting dependency for this sprint.

Refresh the latest private scope Doc and its Engineering handoff tab, then only the necessary current mockup/inputs. Copy safe requirements into repository docs and record source/version and unresolved differences. Do not spend the sprint recursively recrawling the entire family archive. If Drive is unavailable, use the repository's sanitized requirements and prepared local inputs; report the unread references. Resolve material conflicts with Mike.

Commit and push safe code, changed requirements, scope cuts, tests and handoffs at meaningful checkpoints, about every 15 minutes. Routine commits and pushes to this named repository are authorized. Every worker owns one status file: base commit, branch, latest code commit, implemented behavior, checks, next step and blocker. The lead owns the shared plan and dependency files. Fetch before integration. A chat update without a pushed commit is not a cross-laptop handoff.

This repository is public. Keep actual family data/photos/chats, raw model payloads, credentials, private Drive links and private rendered books outside Git. Use ignored local inputs and a rights-safe synthetic fixture in GitHub. Code/docs/status live here; private evidence stays in the private context folder. This split is required even though GitHub is the engineering ground truth.

## Timeline and exits

| Time | Exit criterion |
| --- | --- |
| T+0 to 10 | Lead publishes scaffold, a working dev command, shared types and sample source/event/review/book payloads. Confirm API readiness immediately. Claude builds pure import/export/retrieval modules; Natalia builds the shell with a marked fixture adapter in parallel. |
| T+10 to 35 | Each worker pushes a callable first version. UI displays the local family seed and a contribution. Data/export modules accept the agreed DTOs. Lead gets one real source-linked Astra proposal or reports the exact dependency blocking it. |
| T+35 to 55 | Integrate the first source → proposal → human review → persisted graph change → book passage → PDF/ZIP route. Do not defer first integration until minute 80. |
| T+55 to 70 | Fix core failures. Verify unknown, citation integrity, duplicate input, edit persistence/reopen and download contents. Apply the cut list to anything threatening the route. |
| T+70 to 90 | Freeze features. Run the complete local journey twice in under three minutes. Leave the server running, a reproducible setup command, tested commit and a truthful readiness report. A quick backup screen capture is useful; polished submission video is a later task. |

## Keep, prepare, cut

KEEP: compact required form; automatic internal plan; one workspace with progress left, generational map center and distinct human Q&A right; photos; clickable person/edge evidence; accept/correct/unknown; one source-backed change; saved state; one illustrated English PDF and editable project JSON in a ZIP. Include source register and available originals. Preserve history; protect human edits from stale model updates.

MODEL: one real bounded Astra analysis and one cited passage based on current accepted claims. Keys stay server-side. Use existing SDK/config, verify the exact configured model and API with a small real request, and record its actual success/failure. If credentials are missing, ask Mike to configure the local environment immediately; continue with a clearly labeled fixture adapter. A fixture run is not a successful live-model exit.

PREPARED: selected 35-person seed, photo thumbnails, source excerpts, OCR, translated text, layout, cached retrieval. Show the main family branch first. Existing-reference import must remain labeled. The reference has 93 people; adding all of them is optional and is not a new discovery.

CUT FIRST: OAuth, Supabase/Auth/cloud setup, broad crawling, universal ZIP parsers, video/audio processing, restoration, localization, multiuser operation and deployment. Use local single-user persistence bound to localhost and support the exact text/JSON/photo input path first. Store unsupported files with a clear not-processed state. Add an actual chat parser only when a real example is available and it does not delay the core route. Do not make compatibility claims from fictional exports.

CUT NEXT IF NEEDED: live archive search becomes an explicitly labeled cached/source example; auto-layout becomes fixed generation positions; PDF uses a prepared layout with one genuinely updated passage; portable standalone HTML-map export can wait if project JSON reopens correctly in the app. Record each cut in docs/status/lead.md and tell Mike. Never cut truthful origin labels, source citations or real edit/download behavior.

## Demo and acceptance

The user brings a few clues, sees a focused branch, contributes a message, reviews its source-linked interpretation, then sees the person card and book change. Choose the source-backed example in the private scope; do not promise a new ancestor. Show concise action summaries, sources and findings, not private chain-of-thought.

At T+90 the app runs locally from documented commands; the two screens work; one reviewed source changes saved family state and the book; person/relationship evidence and a discrepancy can be inspected; PDF/ZIP opens and JSON reimports with edits intact; real operation counters are honest, including zero external websites when none were fetched. Run the journey twice. Separate implemented, prepared, cut and blocked in the final status. Video, publishing family assets and event submission remain separate steps.

## Concrete build specifications

Read [PROTOTYPE-CONTRACT.md](PROTOTYPE-CONTRACT.md) for shared state, Claude module signatures, the UI adapter and the same acceptance scenario for all three owners. Each prompt below is now an executable task specification with exact deliverables and verification, not only a role assignment.

## Launch prompts

Run docs/prompts/01_CODEX_MIKE.md first, then start docs/prompts/02_CODEX_NATALIA.md and docs/prompts/03_CLAUDE_MIKE.md immediately. They can work on independent modules during the first ten minutes and integrate against the lead's frozen contract. No agent is dispatched by storing these files.
