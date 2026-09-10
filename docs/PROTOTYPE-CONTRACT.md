# Prototype handoff contract

This is a build specification, not implemented functionality. It makes the three assignments concrete. The lead publishes the runtime TypeScript/Zod equivalents within the first ten minutes, preserving these behavior boundaries. Follow the existing contract's evidence rules. Prefer these small module boundaries over new infrastructure. Any change is recorded once by the lead and consumed by both workers.

## One state shared by all three workers

`ProjectSnapshot`: schemaVersion, projectId, version, input, people, relationships, claims, stories, sources, assets, proposals, researchEvents, history, bookPassages, bookStatus.

- A person has a stable ID, English display name, original name, birth/death with precision/unknown, photo asset IDs and claim/story IDs. Store layout positions separately from family facts.
- A relationship has stable ID, from/to person IDs, type, source-backed claim IDs and review state. Do not derive genealogy from layout positions.
- A source retains ID, original filename/message locator, hash, original text, known author/time and origin. A cited quote must resolve to the actual text. A source can be a family recollection without being independently verified.
- An asset retains ID, source ID, original name, media type, byte length and private storage key. Runtime URLs/absolute machine paths do not go into portable exports.
- A proposal contains ID, source IDs, candidate person IDs, proposed claims/story, exact source spans, one human question and status. A proposal is not an accepted fact.
- History records event ID, timestamp, actor, before/after values, source/claim IDs and project version. Preserve accepted/unknown/rejected and corrected states. Avoid stale overwrites.
- A book passage contains text, claim/source IDs and acceptedStateVersion. An affected correction marks it stale until regenerated. A factual passage without a valid source is rejected by validation.

## Natalia exports these functions

1. `importPreparedFamily({seedJson, mediaFiles}) -> ImportResult`: normalize the prior private seed, preserve original IDs, return normalized records and warnings. Do not infer new people from photographs.
2. `ingestContribution({text?, files?, targetPersonId?}) -> IngestionResult`: return parsed sources, original assets and per-file outcomes (`parsed`, `stored_only`, `failed`). Return duplicate hashes so the lead can deduplicate against saved sources. Do not invoke the LLM or commit graph edits.
3. `buildFamilyBundle({snapshot, passages, resolveAsset}) -> {bytes, filename, mimeType, manifest}`: render the current accepted text and selected family branch, package PDF/HTML, editable project JSON, sources, notes/context and original assets. `resolveAsset(assetId)` is supplied by the lead and returns bytes, never an arbitrary filesystem path supplied by the browser.

`ImportResult` contains people, relationships, claims, stories, sources, assets, history, issues, layout and warnings. `IngestionResult` contains sources, assets, duplicateHashes and files; each file outcome contains uploadId, originalName, status, sourceIds, assetIds and warnings. Asset bytes are returned to the lead for private storage; metadata contains no public URL. The lead adds projectId/version and persists the result.

Choose async functions. Pass ordinary typed objects and bytes. No database, server port, OAuth or framework-specific request objects inside these modules. Natalia may split these across server/ingestion and server/export. The lead owns persistence and the route wrappers.

## Claude consumes one RootsApi adapter

- `createProject(input, files) -> ProjectSnapshot`: validate the compact form, import prepared data or supplied input, start internal processing and open the workspace.
- `getSnapshot(projectId, afterSequence?) -> ProjectSnapshot`: current graph, proposals, concise events/counters and book state. Simple polling while a run is active is sufficient; SSE is optional.
- `addContribution(projectId, {text?, files?, targetPersonId?}) -> ProjectSnapshot`: ingest, run bounded model analysis, produce a pending proposal. The existing accepted graph remains usable during analysis.
- `reviewProposal(projectId, {proposalId, action, baseVersion, corrections?}) -> ProjectSnapshot`: accept/correct/reject/unknown with saved history and conflict handling.
- `mutateGraph(projectId, {operation, entityId?, values?, baseVersion}) -> ProjectSnapshot`: add/edit a person or relationship; one-level undo is sufficient for the prototype. Reject self-parent links/cycles. Edits persist, rather than only moving UI labels.
- `downloadFamilyBook(projectId) -> Blob`: lead regenerates any required current passage, then invokes Natalia's bundle builder. Return a real ZIP or a visible error.
- `assetUrl(projectId, assetId) -> string`: read-only URL scoped to an asset in this project. No path traversal or raw server path exposure.

The lead implements the adapter and thin Next.js routes; Claude exports `RootsApp({api})` from src/ui/index.tsx. Claude never calls Natalia's modules or the OpenAI SDK directly. Natalia never reaches into React components. Route spellings can be chosen by the lead, but method names and payloads must be published in the contract handoff. This avoids parallel incompatible API design.

## Source of visible state

Input validation and file parsing emit actual events. Model request start/success/failure emit actual events. Display a completed count only after its operation succeeds, deduplicated by event/source IDs. A no-search run legitimately shows zero websites. Prepared import, cached retrieval, live model analysis and replay are distinct origins. Browser loading indicators may animate; completion counts cannot advance on a cosmetic timer.

## Shared synthetic acceptance example

This is a fictional coding fixture, not Mike's family. Seed a small five-generation family including Alex Morgan, with one safe placeholder portrait, cited relationships and one unresolved birth-year discrepancy. Supply this text as a new source: “I remember my grandfather Alex Morgan repairing watches in his workshop.” The filename/locator, not an invented message date, identifies its source.

Expected run: a real model may propose the watch-repair recollection for Alex, cite the exact sentence and ask the user to confirm the intended person. The pending story does not enter the accepted biography/book. Accepting it adds an attributed family recollection, source and history event to the selected person. The book includes an attributed sentence with the same source locator. It must not invent a birthplace, date, archive match or new parent.

Unknown leaves the proposal unresolved and keeps the accepted book unchanged. Correcting the person/name/value creates a human correction while preserving the original quotation. A repeated contribution/review cannot duplicate the person/story or counters. Existing date discrepancies remain visible. Reopen exported JSON and verify the accepted story, evidence and history remain.

Use the supplied private family branch and real message for the local personal demo when available. Imported existing evidence is not a new external discovery. Synthetic fixtures can test code, but cannot prove a real family/archive finding or native Telegram/WhatsApp support.
