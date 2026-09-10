# Three-owner integration handoff

These are proposed interfaces for the next implementation, not schemas already present in the app. Mike owns the actual Zod/types and API publication. All owners consume those types; changes are additive/versioned so existing roots-v1 projects and round-2 packets still reopen.

## Ownership

| Owner | Files and responsibility |
| --- | --- |
| Mike | packages/contracts; server/agent; server/state; server/events; new server/connectors authorization/session boundary; src/app routes and adapters; dependencies/config; integration-tests; scripts/browser-rehearsal.mjs; lead status and final acceptance |
| Natalia | src/ui; UI assets/official provider marks; tests/ui; UI status. No second schema or UI-owned truth counters |
| Claude | server/ingestion; server/research including source retrieval adapters; server/export; tests/data-export and tests/research; tests/fixtures/round3/packet fictional twin; scripts/check-packet.mjs and private content builders; parser compatibility and data/export status; ignored private content/book/photo preparation |

Everyone is working alongside others. Do not revert their changes, reset shared history or force-push. Preserve current worktrees/branches, publish safe commits and consume owner handoffs early. Mike merges engineering; default-branch publication retains its separate restriction. No fourth content owner is required.

## Contracts to publish first

| Contract | Required contents |
| --- | --- |
| IntakeProfile / AutofillDraft | Self and four relatives, date precision, optional family side, field-level source spans/conflicts, explicit draft apply behavior; no public private values |
| ConnectionStatus | Provider, opaque connection ID, account display, verified state/time, selected scope; no tokens in browser/project export |
| IntakePreparation / InitialChecks | Explicit Continue action persists/parses selected inputs, creates exactly six stable question IDs and runs the logged recollection check; photo/source IDs, recommendation origin and answer history. Intake jobs are distinct from research cycles; autofill never invokes Astra. Later QuestionBank is independent |
| ResearchCycle / Plan / Job | One initial cycle and at most two deeper cycles per session; ordinal, idempotency key, input fingerprint, objective summaries, source scope, actual query/tool jobs, leases/retries, statuses, timestamps and result references. A retry retains the failed cycle ID; a third deeper request or repeated initial start cannot create another cycle |
| QuestionBank | Stable ID, originating cycle, source spans, person/candidates, uncertainty, priority, status and versioned answers |
| GraphChangeProposal | Existing/new person identities, proposed relationships, source spans, alternatives, deduplication keys and human review. Atomic validated apply, no name-only merge |
| ResearchMetrics | Counts derived centrally from persisted successful/failed/cached operations; file/photo/evidence/page units and cycle deltas explicit |
| Asset / PhotoPair / Portrait | Original or derivative role, original parent/hash, evidence root, reviewed person associations/crop, pair hashes/alignment/preparation QA. Pair availability cannot confirm identity |
| BookPlan / BookEdition | Source-book sections and locators, prepared English chapters, review dependencies, selected people/photos/exhibits, requested page range, actual page coverage, edition fingerprint/status |

Expected actions: parse/apply autofill draft; connect/verify/disconnect providers; import selected sources; Continue/prepare intake; save initial answers; start initial cycle; request deeper cycle; pause/cancel/retry a job or cycle; answer a bank question; review graph changes; prepare/preview/download an edition. Final route names follow the published lead API. Refresh only resumes; it never generates a new deeper-cycle action. Carry completed intake jobs into the aggregate metrics without presenting them as research-cycle jobs.

Existing code points needing coordinated changes: seven-question schema/gates and timed batches; existing-person-only Astra output; model-independent identity review; source-job restriction to initial evidence; adapter fields that discard retrieval/search metadata; global sealing after Download; content fingerprint lacking new sources/plans/chapters; fixed four-page PDF and compactChapter mode. Retain the reviewed narrator fix and exact source validation.

## One private manifest

Claude creates a new version under the private demo-artefacts-v3 folder, preserving v1/v2 and the original book. The private reference handoff gives its absolute location. Public examples use invented people and images only.

The manifest/index binds: packet version and original hashes; selected upload/import inventory; stable IDs and evidence roots; optional autofill source spans; six questions and three distinct photos; old-photo inventory; every derivative/pair/alignment and portrait association; book-source identity, chapters and page coverage; authorized selected source locators; research narrative anchors; presenter cues; and readiness checks. Credentials and OAuth tokens never enter it. Expected outcomes are test assertions, not model answer keys or forced web discoveries.

The initial content handoff must include: exact input count/bytes; proposed book plan and coverage ledger; verified versus unresolved portrait associations; old-photo count and pair completion; which selected sources are accessible through actual connectors; which extra records can support deeper investigation. Freeze hashes only after both the runtime parser and photo/book validators pass.

## Meaningful milestones

1. **Schema and access:** Mike publishes contracts within ten minutes of actual execution start; verifies provider configuration and the authorization path. Claude returns the source/media/book inventory. Natalia returns the revised screen structure against fictional data.
2. **First integrated cycle:** six checks, at least three large photos, current plan/tasks, actual retrieval/analysis, one reviewed graph delta and one saved later question work together. Server-derived counters agree with source data.
3. **Complete experience:** two independent deeper cycles, the complete selected-old-photo comparison set, all source galleries and the 35-40-page current book work against the one frozen packet.
4. **Candidate freeze and acceptance:** no feature additions while running final checks. Both complete browser runs use the same application candidate, packet hash and book plan. A subsequent material app or content change requires revalidating the affected acceptance evidence.

Each owner updates status with implemented/prepared/verified/blocked facts and exact commits. No implementation clock starts during this planning turn. Record execution timing separately from the ~20-second per-cycle experience target.

## Review matrix

| Feedback | Required owner outcome |
| --- | --- |
| Remove helper/footer copy and irrelevant fields | Natalia removes exact strings/fields; Mike adds optional structured profile |
| Provider logos and Connected | Natalia renders actual status; Mike supplies real authorization and verified read; Claude supplies selected-source ingestion |
| One-click family details | Claude supplies source-backed values; Mike draft/apply semantics; Natalia editable review |
| Six questions / at least three larger photos | Claude curated checks/assets; Mike six-check persistence; Natalia layout/full view |
| Book missing expected material / 35-40 pages | Claude expanded English chapters and coverage ledger; Mike current-edition cache; Natalia real preview |
| Reverse opaque activity | Mike actual plans/jobs/cycles; Natalia Now/Next/chronological completion |
| Low/misleading counters | Claude retains operation metadata; Mike central metrics; Natalia meaningful units and deltas |
| Start and two deeper rounds / later questions | Mike cycle executor, evidence-backed graph proposals and bank; Claude actual adapters; Natalia controls/progress |
| Bottom book section blocks map | Natalia removes it and moves info/preview beside Download |
| Missing photos/docs / repeated group portraits | Claude full associations and supported unique portraits; Mike validation; Natalia complete evidence galleries |
| Broken full images / all old-photo sliders | Natalia viewer repair; Claude all aligned derivatives; Mike portable pair validation without identity promotion |
| Complete current English book download | All three integrate current edition, every-page visual QA, asset hashes and two real browser journeys |
