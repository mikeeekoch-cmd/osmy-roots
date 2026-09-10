# Architecture V3

Proposed stack: Next.js App Router, React/TypeScript, Node 24, Tailwind, React Flow/elkjs, Zod, the official OpenAI SDK and Supabase Postgres/private Storage. Pin compatible versions at scaffold. Render is a proposed Node hosting target; no service is provisioned. These are implementation decisions for the first milestone, not claims of installed dependencies.

Keep the two-screen UI in `src/ui`, shared schemas in `packages/contracts`, and ingestion, AI, events, persistence and export in `server`. Thin `src/app` wrappers expose routes and pages. One lead owns dependencies, integration and migrations.

## Core data and provenance

The preparation contract is [CONTRACT-V3.json](CONTRACT-V3.json). At kickoff freeze runnable Zod schemas and inferred TypeScript types for ProjectInput, SourceAsset, ExtractedClaim (the JSON's claim object), Person, Relationship, ReviewDecision, ResearchEvent and BookPassage.

SourceAsset retains project ID, source/message ID, kind, original locator, hash, language, original text/file, extraction derivative, known author/time, parent attachment, origin, retrieval time and reuse/access notes. A filename date does not substitute for an unknown message timestamp. Store media as private objects rather than embedding base64 in graph rows.

Claims retain source IDs and exact spans/locators, evidence type, status, competing values and version. Narrator-attributed story text remains separate from genealogy assertions. Keep original names, date wording and precision; unknown stays null. Every relationship has its own claim references. Runtime validation checks that source IDs and locators actually exist in this project.

Minimal persistence: projects (owner/version), sources, persons, relationships, claims, stories, runs, research_events, review_decisions and book_passages. Original imported records live in source data with their old IDs. Import adapters convert prior review schemas into this contract; importing is not model discovery. Old confidence labels do not become verified facts.

## Execution and progress

Start validates input and immediately runs an internal bounded plan. Actual operations emit persisted ResearchEvent envelopes. The UI consumes events using a sequence cursor and can poll durable snapshots. Mid-run contributions append sources and queue work without replacing the accepted state. Unknown blocks only the dependent candidate.

A request performs one bounded step under a lease, then saves its result. Do not leave untracked background promises after the response. Persist the run and completed work; durable processing while the browser is closed requires a worker. Use idempotency keys and version checks for writes and retry.

Count distinct normalized hostnames only after successfully retrieving a page; count records only after parsing and analysis; count files after successful parsing of a distinct hash. Replayed/duplicate events cannot increment totals twice. Count people from persisted active records. Keep cached/prepared counts separate, and show planned/failed/blocked work honestly.

Initial run budget proposal: at most eight discovery queries, ten retrieved records, three displayed candidates and six model stages. Measure latency and cost before adjusting. Start with supplied material plus one geographically relevant archive route; a general web crawler is unnecessary for the first demo.

## AI and retrieval

Use server-side Responses requests with `model: gpt-6-astra`, structured outputs and runtime validation. Astra supports text and images; audio requires a separate transcription stage. Sources are untrusted data. Models propose changes; authenticated application transactions commit them. [Official model](https://developers.openai.com/api/docs/models/gpt-6-astra), [Astra guide](https://developers.openai.com/api/docs/guides/latest-model).

Search results are leads until retrieved content supports a comparison. Provider adapters return exact record/page locators, retrieval time, quotes and access failures. Historical place aliases and dates constrain queries. OpenList known-record revision retrieval and LoC JSON search worked during preparation; OpenList API text/title search was disabled. Those technical checks do not establish relevance or an ancestral match. The private research handoff selects the family's actual source routes.

Keep fetch targets bounded, validate redirects and response size, and block local/private network destinations. Preserve downloaded originals independently of extracted text and summaries.

## Review, corrections and export

ReviewDecision carries actor, action and baseVersion. Reject stale overwrites. In one transaction save the new version and audit event, validate identity/graph changes, increment project version and invalidate dependent decisions and passages. Reject self-parent links and ancestry cycles. Undo emits a new event and retains earlier values.

BookPassage carries acceptedStateVersion, claim IDs and original source locators. A corrected or disputed claim marks dependent prose stale; regenerate from current accepted state. The four-page English target contains dedication, selected branch, sourced chapter and sources/open questions.

One export action produces `book.pdf`, `book.html`, `editable-family-map.html`, `project.json`, `sources.json`, `research-notes.json`, `starting-context.json`, `photos/` and `uploads/`. Include a schema version, hashes and media references. Plan a maintained PDF-generation library and ZIP library; choose/pin them at scaffold and verify the resulting four pages and reopen behavior. Do not copy the review mockup's PDF implementation. Preserve original aspect ratios, Unicode names and source text; generated restorations remain separate labeled assets.

## Access and deployment

Supabase project ownership/RLS and private buckets protect uploaded material. Browser publishable keys are not privileged server keys; privileged operations still require explicit owner checks. Test two-user isolation. Keep durable data outside the web host's filesystem and use temporary signed media URLs. A successful local server or dashboard login does not prove database access or deployment.

## Planned layout

```text
packages/contracts/     # lead-owned Zod schemas and inferred types
server/                 # ingestion, Astra, events, storage, review, export
src/app/                # lead-owned thin Next.js integration wrappers
src/ui/                 # UI owner: only Input and Research workspace
supabase/migrations/    # lead-owned schema and policies
integration-tests/      # lead-owned consequential flow verification
research/               # source research handoff; private findings excluded
```

These directories are planned. Preparation does not include an application scaffold.
