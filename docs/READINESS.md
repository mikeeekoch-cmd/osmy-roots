# Readiness, September 10, 2026

Scope update: Mike has requested the changes specified in [round-3/README.md](round-3/README.md). That revision is planned, not implemented or accepted. The measured readiness below applies to round 2 only; it does not establish live Gmail/Drive connections, repeated deeper research, all-old-photo comparisons or a 35-40-page book.

Round 2 is demo-ready locally on application commit `a627436`, on `codex/engineering`. Two fresh browser journeys delivered current ZIPs within 120 seconds, and both actual PDFs passed visual review. The production app runs at http://127.0.0.1:3200. Earlier evidence is preserved in [archive/READINESS-round1.md](archive/READINESS-round1.md).

| Acceptance check | Verified result |
| --- | --- |
| Exact ordinary input | 20 files, 8,426,238 bytes: personal PDF, family notes, photo notes, three reconstructed English chat ZIPs and 14 unchanged originals |
| Source coverage | 35 people, 56 normalized relationships; tentative links and uncertain dates retained; earlier 57-row duplicate reconciliation preserved |
| Seven checks | Photo identity, kinship, origin, lifespan/residence, movement, recollection and conflict; each explicitly reviewed, with the final conflict answered unknown |
| Start and persistence | No project/model request before Submit; zero visible people before all seven answers; initial five-person branch saved at about 35 seconds |
| Growth | Six actual saved batches in each run, spanning 50.008 and 50.067 seconds; all 35 people and 56 relationships present at completion |
| Astra | Actual gpt-6-astra interpretation, exact source validation, human review and current cited English passage generation in both runs |
| Photo evidence | All 14 originals retained; caption associations remain distinct from confirmed identity/order; reviewed group-photo positions survive arrivals |
| Browser behavior | Actual installed Chrome, fresh isolated contexts, seven clicks, person card, original photo, native PDF preview and download; second run includes refresh/resume |
| Portable output | Both ZIPs reopen in an empty local store with all 23 original asset hashes; history, relationships, story and annotations preserved; editing invalidates the book |
| English and provenance | English scan passed; exact source quotations retained; source-matched message narrator and uncertainty verified |
| PDF inspection | Both actual four-page PDFs rendered and visually inspected; all 35 names, current passage, citations, original photos and uncertainty passed |
| State and failures | Version checks, idempotency, candidate separation, graph validation, corrections, unknown, undo preserving later arrivals, cancellation, immutable sealing and retry checks pass |
| Automated checks | 171 tests pass; TypeScript passes; production webpack build passes |

Measured browser evidence is in [round-2/ACCEPTANCE.json](round-2/ACCEPTANCE.json). Private screenshots, snapshots, request timing and actual ZIPs remain in the ignored local rehearsal folder. These measurements used browser automation, including explicit review-button clicks. Model and network latency can vary.

| Final browser run | Seven answers | Initial branch | Book ready | Download click | Actual receipt |
| --- | ---: | ---: | ---: | ---: | ---: |
| v2-final-3 | 29.051 s | 35.326 s | 102.378 s | 103.603 s | 104.174 s |
| v2-final-4, refresh/resume | 29.055 s | 35.347 s | 103.012 s | 104.326 s | 104.747 s |

The shared engineering clock began at 18:18:15 UTC (14:18:15 EDT), with a 19:48:15 UTC deadline. Contracts were published at 18:22:43, T+4:28. The actual API route produced its reviewed current ZIP at 19:12:46.071, T+54:31, before the T+55 integration target. Application code froze at 19:18:20, before T+70. Both corrected browser runs then completed at 2026-09-10T19:20:06.982Z and 2026-09-10T19:22:17.805Z. Full browser acceptance followed the API integration checkpoint; it was not claimed at T+55.

Frozen runtime packet fingerprint: `ede0e0ddff7bca9e23f6c1e70c759347654e8b2dae8bcdb54cea684a0e5496fb`. This is SHA-256 of the schema-normalized manifest. Manifest-file SHA-256: `fd9e2c6930a355fef5230c499f4851a17573f6903a9c76de690d33f460eb27f1`. The Desktop latest upload folder matches every selected file byte for byte. Revised English presenter cues are separate from uploaded evidence.

Prepared material comprises the supplied family records, English derivatives, reconstructed dialogue, captions, prior research, original photographs and release schedule. Astra interpretation and passage generation are live; websites remain zero for this packet. The held-out request receives the reviewed roster and actual recollection excerpt, excluding presenter answers, prepared identity hints, photo bytes and the full archive. Explicit direct user approval covers these private OpenAI calls. Accepted recollections remain family memories.

The four-page PDF is a compact illustrated book. HTML and portable JSON retain the complete source register, other recorded material and exact quotes. The final packet uses original photos only, following the user's revised direction; optional original/enhanced pairs remain supported for older packets. Deployment, cloud accounts, OCR, restoration, arbitrary chat/archive formats, general external discovery and a standalone editable HTML map remain outside this local demo. Complete project ZIPs must be extracted before reopening their JSON and originals.

Earlier diagnostic attempts caught a harness manifest-normalization mismatch, an invalid live citation, a prepared-answer version race, native PDF viewer response handling and archive-wrapper narrator attribution. They remain recorded as diagnostics and do not count toward the two final rehearsals. No public deployment or default-branch publication is claimed. Safe code and status belong on the engineering branch; private inputs and outputs stay local.
