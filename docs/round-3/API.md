# Round 3 published contracts

Execution started 2026-09-10T20:08:05Z. The actual Zod schemas are packages/contracts/round3.ts and additive exports in packages/contracts/index.ts. Existing roots-v1 snapshots and v2 manifests remain supported. Runtime implementation follows this publication; the schemas are available now for both owners.

Snapshot.research is roots-research-v3. Existing snapshot.run.questions and run.answers hold the six initial checks so existing answer/photo components can be adapted. Later questions live only in research.questionBank. UI consumes authoritative research.metrics, research.cycles and research.jobs. Jobs have one mutable status; do not independently interpret the event log as counters.

| Action | Route and payload |
| --- | --- |
| Draft autofill, no project/model | POST /api/intake/autofill multipart input JSON + files; returns AutofillDraft |
| Continue, persist intake | POST /api/projects multipart input with researchMode: round3 + files; returns snapshot immediately; logged intake analysis resumes on GET |
| Provider state | GET /api/connections returns ConnectionStatus[] |
| Connect | POST /api/connections/{drive,gmail}/connect returns {url}; browser follows OAuth |
| OAuth callback | GET /api/connections/callback; server-only state/code exchange |
| Verify selected scope | POST /api/connections/{provider}/verify {selectedScope: string[]} |
| Disconnect | POST /api/connections/{provider}/disconnect |
| Import selected IDs | POST /api/projects/{id}/imports {provider,selectedIds,baseVersion} |
| Initial or deeper | POST /api/projects/{id}/cycles {action: initial or deeper,requestId,baseVersion} |
| Retry/pause/resume/cancel | Same route, action and cycleId; retry retains ID |
| Initial check | Existing /answers; confirm/correct/unknown/skip plus requestId/baseVersion |
| Bank answer | POST /api/projects/{id}/questions {questionId,action,text?,baseVersion,requestId} |
| Graph review | POST /api/projects/{id}/graph-proposals {proposalId,action: accept or reject or unknown,baseVersion,requestId} |
| Book | Existing /book, /book/preview, /download; research.bookEdition supplies version, status and actual page count |

Example cycle request: {"action":"deeper","requestId":"click-2","baseVersion":12}. Duplicate clicks are coalesced; stale writes return 409. Refresh never starts an additional cycle.

Claude: freeze roots-demo-v3 with DemoManifestV3Schema. Six questions require photoAssetId/photoEra (one modern, two old), a live recollection and conflict. Preserve effect.photoAssetId for older UI compatibility. BookPlan contains prepared English chapter text, exact support, source-book locators and coverage. PhotoPairV3 requires aligned composition, evidence root, preparation timestamp and QA. Do not promote associations because a pair exists. researchSources assigns eligible local source IDs and optional provider/public locators to ordinals 1-3; these are search scope, never forced model answers. Every root/chapter/asset stays private except fictional twin.

Natalia: consume optional RootsApi methods already published. Set input.researchMode round3 for new flow. Render six questions from run; render later questions separately. Research clicks call researchCycle explicitly. File selection/autofill performs no model call. Render connections from server state only. Book status beside main Download reads research.bookEdition.

## User-directed provider change, 20:17 UTC

Mike explicitly chose mock provider connections for the current demo. Use ConnectionStatus.mode = demo, recognizable logos, a connect action and prepared local document/correspondence copies. A connected demo state does not claim OAuth or live provider reads; show a small Demo label and prepared-copy detail. Real Astra analysis, questions, graph and book updates remain required. ROOTS_DEMO_CONNECTIONS=true selects this server-backed demonstration mode. Actual OAuth implementation remains available with this flag disabled; OAuth credentials are no longer an acceptance blocker for the requested demo.

Book adapter receives options.bookPlan and options.bookEdition and compactChapter=false for round 3. Claude's long renderer must consume BookPlan.chapters; lead enforces actual 35-40 pages before a current edition can be previewed/downloaded. All runtime routes in the table are now wired. Engine consumes readStage plus existing local/public adapters; local query results queue actual record analysis. Pending public-search adapter handoff should export a bounded search API from server/research/index.mjs and preserve actual attempt/cache metadata.

## Prepared derivative byte handoff

Additive preparedAssets is now available in DemoManifestV3: [{assetId,path,sha256,bytes,mediaType,originalName}], with safe packet-relative paths such as 02-media/enhanced-photo.jpg. These are the prepared enhanced files, kept separate from the 33 selected original uploads in files. Each assetId must equal a PhotoPairV3 enhancedAssetId and its hash must match. The runtime verifies and privately persists these bytes against the original parent before allowing comparisons; derivatives never inflate received-original/file metrics. This supports 33 originals plus 12 derivative assets without bypassing upload limits or requiring 45 uploaded files.

Autofill accepts a blank starting name in its draft-only route now. Existing manual fields are preserved. The live fictional Astra check returned two source-backed new people and one relationship in 15.057 seconds across plan plus analysis. This is API verification on fictional evidence, not private demo acceptance.
