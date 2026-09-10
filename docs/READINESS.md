# Readiness, September 10, 2026

Measured local prototype status. The shared sprint began at 16:27:53 UTC; final deadline is 17:57:53 UTC. The engineering branch contains the integrated application. Main publication remains subject to the resolved default-branch approval restriction recorded in lead status.

| Area                    | Verified result                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                 | pnpm dev serves the real two-screen app on 127.0.0.1:3000; Node 24/25 supported                                                   |
| Contracts               | roots-v1 TypeScript/Zod contracts published as e838039 within ten minutes                                                         |
| Astra                   | Funded API key works; actual gpt-6-astra source interpretation and cited book generation succeeded                                |
| Persistence             | Serialized atomic local writes, version checks, accepted/unknown/corrected history, duplicate protection, manual edits and undo   |
| Evidence                | Exact quote/locator checks, person/candidate separation, relationship references, self-parent and cycle rejection                 |
| UI                      | Actual routes, saved refresh, review, photo display, progress, download and responsive layouts checked                            |
| Data/retrieval          | Real parsing/original bytes, source hashes and local hit/no-match; permitted public fetch succeeded; private destinations blocked |
| Book/export             | Two real source-to-book runs passed; four-page PDF visually inspected; ZIP integrity and runtime-schema JSON reopen passed        |
| Portability             | Separate empty local-store import restored assets by content hash and preserved reviewed history                                  |
| Automated checks        | pnpm typecheck PASS; pnpm test 71 PASS; pnpm build PASS                                                                           |
| Live check times        | 9284 ms and 7402 ms for full analysis/generation/package/reopen checks, fictional input                                           |
| Private seed            | Runtime normalization validated 93 existing people and preserved unresolved data; no private material committed                   |
| External family finding | Not demonstrated; the successful public page fetch is an adapter check                                                            |
| Deployment              | Not performed; local single-user prototype only                                                                                   |

The production build emits two dynamic-filesystem tracing warnings because the private local store is resolved at runtime. This does not prevent local operation. Deployment needs an explicit data/storage and output-tracing review.

Prepared material includes the synthetic family, placeholder portrait, book layout and supplied family records. The regular orchestration tests inject labeled TEST_ONLY model responses; separate opt-in live runs prove actual API behavior. Earlier credit_balance_exhausted failures were real, preserved as failures, and resolved by API Platform credit.

Deferred: Supabase/Auth, hosting, OAuth, native Telegram/WhatsApp parsing, universal ZIP input, DOCX/PDF extraction, OCR, audio/video analysis, restoration, general web search/crawling and standalone editable HTML map. Portable JSON is editable; exported HTML is read-only. Original files must accompany portable imports; missing originals are reported and incomplete book exports fail visibly.

Worker and final commit details: status/lead.md. Run commands and local credential handling: SETUP.md. Demo: DEMO.md.
