# Round 2 runtime contract

Engineering T0: 2026-09-10 18:18:15 UTC / 14:18:15 EDT. Contracts due 18:28:15 UTC; P0 integration due 19:13:15 UTC; freeze 19:28:15 UTC; shared deadline 19:48:15 UTC. No owner resets this clock.

Canonical runtime manifest: `packages/contracts/round2.ts`, `DemoManifestSchema`. Product alone populates private `.roots-data/demo-artefacts/DEMO_MANIFEST.json`; its file hashes identify an initial upload selection. Never upload the manifest/presenter answers to the model. The manifest schedules and describes evidence; every record comes from the uploaded files. Fictional twin uses the same schema and parser.

`ProjectSnapshot.run` is optional for roots-v1 compatibility. UI renders its phase, seven questions and saved answers, actual batches, model status and book status. Parsed unreleased graph lives in private staging, outside the visible snapshot. Each poll resumes bounded pending work and saves eligible deltas. Initial graph requires all seven explicit answers and the release offset. Prepared source release is separate from completed live Astra interpretation.

Additive RootsApi: `answerSetupQuestion(projectId, {questionId, action: confirm|correct|unknown, text?, baseVersion, requestId})`; `prepareFamilyBook(projectId)`; `cancelRun(projectId)`. Existing `getSnapshot` resumes work, `downloadFamilyBook` seals a current bundle and `createProject` remains the ordinary multipart intake and roots-v1 reopen entry. No manifest argument is needed in the UI. Back is UI navigation to an existing question; a changed answer is a new versioned correction.

Data module: `parseFamilyPacket({files})` in `server/ingestion/index.mjs` returns roots-v1 graph, sources, assets, assetBytes, files, issues, warnings and layout. Stable IDs come from CSV registers. Lead validates/normalizes and stages this result. Exact source locator and quote must resolve to normalized sources. Parsers retain English derivative/evidence-root lineage and original uploaded bytes.

All owners use `UPLOAD_LIMITS` (100 MB total, 25 MB/file, 40 files; 1 MB multipart overhead; 200 archive entries; 100 MB expansion; ratio 200). Server reads a bounded body before formData. No global demo banner, fake OAuth, facial identity inference or expected-answer model input.

Bundle cache keys include graph, claims, stories, answers, packet, language and asset hashes. Corrections invalidate output. Seal blocks later mutations; only a successful matching ZIP marks completion. Failures retain a retryable sealed version.

## Ordinary family notes, additive v2 packet

The user's revised packet uses a personal PDF, `Family notes.txt`, `Photo notes.txt`, reconstructed chat ZIPs and original photographs. `inputFormat: "family_notes"` selects `parseFamilyNotesPacket({files, identityKeys})`. The optional `identityKeys` maps uploaded person headings, exact relationship sentences scoped by heading, and photograph filenames to stable IDs. It contains no hidden dates, ancestry or story answers. Every mapped heading and relationship must occur in the uploaded notes; unsupported prose is rejected instead of silently creating facts. The register parser remains available for earlier packets.

Photo identities and order must match parsed uploaded captions, with valid exact source spans. The final ordinary packet has no enhanced photos, no photo pairs and no saved-source jobs. Original/Enhanced comparison remains optional for earlier projects with supported pairs.

The held-out Astra call receives the actual English evidence excerpt and parsed roster, without a prepared person hint, expected recommendation, arbitrary archive metadata or presenter text. Its response uses the exact provided source span, and its interpretation, question, person selection and uncertainty are generated live. Uncertainty remains in the explicit reviewed answer and accepted story/book input.

The runtime fingerprint is SHA-256 of `JSON.stringify(DemoManifestSchema.parse(rawManifest))`; record the manifest file hash separately. Defaults such as empty photo pairs must be normalized before comparing a runtime fingerprint.

Recollection attribution resolves a single per-message speaker only when every selected quote exactly matches message metadata and the uploaded source's speaker/text pair. Missing or conflicting support stays `Family contributor`. Archive-level reconstruction descriptions are retained as provenance and never used as the narrator. The same source-backed speaker is used for the live interpretation and accepted story.

Final application revision: `a627436`. Final content and engineering acceptance: [ACCEPTANCE.json](ACCEPTANCE.json). Application code froze at 19:18:20 UTC; the two final browser runs and both PDF inspections passed without subsequent application changes.
