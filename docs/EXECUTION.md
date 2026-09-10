# Engineering execution

The user requested repository preparation before starting real development. This document is an executable work plan, not a record of completed application features. Reconcile new private context before dependent changes.

## First milestone: one complete slice

Target a 45–60 minute implementation milestone once credentials and input are ready; this is a planning estimate.

1. Read refreshed context, verify the baseline commit and agree file ownership.
2. Scaffold the Next.js application in this repository, preserving the existing docs and history. One owner installs/pins dependencies and updates the lockfile.
3. Define the minimum shared source, proposal, story and run schemas. Create Supabase migrations/private storage and ownership policies.
4. Send one small real Astra Responses request and record model, request ID, result and usage without private payloads or secrets.
5. Upload two permitted sample images and paste one memory. Extract and validate proposed people/links plus an attributed story.
6. Display the result with source inspection, persist it, refresh and show the same saved result. Mark it as proposed.
7. Deploy that slice and verify the hosted flow. Record the deployed commit and URL.

Completion means a real request, durable data and working UI—not separate mock screens. If DB or API access fails, expose that dependency and keep an explicitly labelled local fixture for UI work.

## Then add in this order

1. One real archive retrieval with a same-name distractor and visible conflict.
2. Authenticated review of a relationship, with stable identities and idempotency.
3. A cited chapter using reviewed claims and attributed memories.
4. A corrected source that marks dependent edges/paragraphs and updates the chapter after review.
5. End-to-end validation, export, rehearsal and submission evidence.

Cut extra providers, native chat parsers, voice, live steering and visual polish before cutting source inspection or correction semantics. Do not attempt a general crawler for the event.

## Two laptops

Proposed ownership pending kickoff reconciliation:

| Owner | Paths and responsibility |
| --- | --- |
| Integration owner | Shared contracts, package files/lockfile, migrations, app config, production deploy, merging |
| Experience branch `codex/experience` | UI components/pages after the shared baseline; no backend or migration changes without coordination |
| Evidence branch `codex/evidence` | `src/server/`, agreed route handlers, archive adapters and logic checks |

Assign human/laptop owners explicitly before simultaneous edits. Older context proposes another role split; do not combine overlapping assignments. Each laptop uses its own clone, credentials and environment. Share small commits and handoffs; never overwrite another clone's work.

Handoff fields: branch, commit, owned paths, behavior completed, checks run, contract changes, blocker and next action. Private findings belong in Drive; public handoffs must not include family data or keys.

## Ready-to-use kickoff prompt

> Read AGENTS.md and every document linked in README. Refresh private Drive context and reconcile new decisions. Inspect the current branch and worktree. Begin the first milestone from docs/EXECUTION.md: scaffold the agreed Next.js/Supabase/Astra stack, validate one real small model request, then persist two images and one memory as a source-backed proposed map and attributed story. Implement ownership checks and source references from the start. Keep private evidence out of Git. One owner controls contracts, dependencies and migrations. Record checks and actual Astra usage in BUILD-LOG. Do not claim deployment until the hosted workflow is verified.

## Experience prompt (after baseline)

> Work in your separate clone on codex/experience. Read the shared contract and handoff. Own only the assigned UI paths. Build mixed intake, per-file progress, proposed graph, story shelf, evidence inspection and review states. Preserve unknowns and visibly distinguish saved, proposed and accepted content. Consume the agreed server contract. Use labelled synthetic fixtures only when the endpoint is unavailable. Include loading, partial failure and reload behavior. Commit a small coherent slice and hand off exact paths/checks.

## Evidence prompt (after baseline)

> Work in your separate clone on codex/evidence. Own agreed server paths and logic checks. Implement bounded Astra extraction/reconciliation, actual source retrieval, proposal persistence and source references. Keep candidate IDs separate, validate all references, preserve memories and reject stale writes. Model output cannot bypass authenticated review. Return explicit partial/unavailable results. Coordinate migration and contract changes with the integration owner. Log actual tests, model usage and remaining limits.

## Review prompt

> Review the integrated slice against PRODUCT acceptance criteria. Exercise a namesake, conflicting date, unsupported assertion, missing attachment, source failure, double-submit and correction. Verify isolation between two users. Open citations and check actual evidence. Do not edit another owner's paths without agreement. Report reproducible failures and the exact tested commit.

These prompts are prepared assignments; no agent tasks are launched by this document.
