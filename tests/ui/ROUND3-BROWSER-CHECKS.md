# Round 3 UI browser record — 2026-09-10

Owner: Codex Natalia, GPT-6 Astra. Branch `codex/ui`; engineering through `5f3136f` incorporated by merge with all UI history preserved. This record covers UI and local HTTP integration, not final private-family or live-model acceptance.

## Environments and evidence

- Actual in-app Chromium browser: 1280×720 desktop; 390×844 narrow viewport. Additional 390×844 iframe runs the same fictional UI. Native pointer and keyboard actions, DOM image decode/geometry checks, screenshots and real HTTP persistence were inspected.
- `tests/ui/round3-preview.tsx`, port 3104: explicitly labeled fictional contract harness with generated SVG evidence, synthetic snapshots and controllable round outcomes. It does not call Astra, OAuth or return a fake downloadable book.
- `tests/ui/connected.tsx`, port 3105 → Next port 3400: actual RootsApi, HTTP routes and isolated saved project. `tests/ui/make-round3-project.ts` parses the public fictional round-2 packet with a test-only injected intake interpretation. This seed is not Claude's round-3 packet, nor a live model result.
- Production `pnpm build --webpack` / `pnpm start --port 3400`: actual intake, autofill and explicitly enabled server demo connections. Provider statuses are returned by the server; both cards say Demo/prepared local copies. Actual OAuth was not claimed.
- Screenshots: `screenshots/round3-large-question.jpg`, `round3-portrait-comparison.jpg`, `round3-mobile-book.jpg`. All evidence in these images is fictional. The mobile book screenshot includes the actual HTTP error and Retry inside the dialog.

## Per-photo matrix

The six selected JPEGs below are **fictional illustrated archive cards**, not photographs of real relatives. Each returned HTTP 200, image/jpeg, matched selected original bytes, decoded at 720×540, and was opened in the full viewer in the actual browser.

| Original | Bytes | Browser path checked | Result |
| --- | ---: | --- | --- |
| F-PHOTO-01 / 01__Alder_Vale.jpg | 25069 | Large first check → full original | Pass |
| F-PHOTO-02 / 02__Ellis_and_Clara.jpg | 28232 | Large second check → full original | Pass |
| F-PHOTO-03 / 03__Martin_Vale.jpg | 25252 | Large third check → full original | Pass |
| F-PHOTO-04 / 04__Jonah_Vale.jpg | 25221 | Source inventory → evidence → full original, 390×844 | Pass |
| F-PHOTO-05 / 05__Rowan_Vale.jpg | 25317 | Source inventory → evidence → full original, 390×844 | Pass |
| F-PHOTO-06 / 06__Rowan_and_Jonah.jpg | 28791 | Source inventory → evidence → full original, 390×844 | Pass |

| Synthetic comparator fixture | Decoded geometry | Actual browser checks | Result |
| --- | --- | --- | --- |
| modern.svg | 800×480 | Ordinary original, zoom 100→150%, Fit, gallery | Pass |
| portrait.svg + portrait-enhanced.svg | 480×640 each | Original 100%, half 50%, enhanced 0%; Home/End, arrows; no gallery paging from range; reopen/reset; focus trap/Escape/return | Pass |
| group.svg + group-enhanced.svg | 800×480 each | Three presets; native pointer drag 100→23%; narrow layout; original view/paging; pair switch resets 50% | Pass |
| Missing portrait derivative | Original available; derivative deliberately 404 | Original remains visible; Retry does not claim success; restoring valid URL and reopening restores comparison at 50% | Pass |

The comparator uses the original's cropped aspect ratio and validates both ratios before overlay. Incompatible framing uses a labeled side-by-side view. The old broad lightbox-button positioning rule is scoped to Close, and portals keep the viewer outside transformed/scrolling drawers. The exact private broken-photo case cannot be reproduced on this laptop without its original bytes; this record does not assert otherwise.

## Interaction checks

- Six API-supplied checks; first three distinct large images; correct/unknown/skip and Back/review; initial answers remain separate from later questions. Actual HTTP project saved five Unknown answers and one Skip, then reopened all six. No identity was inferred from a caption association.
- Clean fictional cycle sequence repeated after the double-click fix: Start → running → pause → refresh → same paused round → resume → complete; first Research deeper → complete; second Research deeper → complete; no fourth action. Double-clicks on all three start controls did not cancel or duplicate a cycle. A further Cancel → Retry browser check retained round 1 and never offered a deeper action for that cancelled round. Now/Next, plan and grouped chronological outcomes follow saved job state; third-round no-match is explicit.
- Actual HTTP Start persisted one failed cycle when the local model was unconfigured. Reopen displayed the saved failure and Retry, not preparing/success. Live progressive-research success remains the lead's acceptance responsibility.
- Persistent later question bank: correction/answer history, unknown, skip, saved filter and refresh; initial count stays six. Source spans and unresolved candidates remain inspectable. Shared graph reviews are offered only for pending proposals.
- Intake: optional fields can remain blank; grandfather/grandmother side can remain Unknown. One-click autofill uses current manual state, protects explicit clears and conflicts, leaves absent values blank. Production HTTP filled the blank starting name from the selected fictional manifest's supported source. Editing it manually and filling again preserved the edit and showed the exact conflicting value/quote/locator. With no files or an incomplete packet, actual API errors stay visible; no research starts from Fill.
- Production Drive and Gmail Demo Connect saved through real HTTP routes, refreshed in place and persisted on reload. Details explicitly say this is not live Google access. Unconfigured live mode stays disconnected; fictional expired/error presentation does not establish actual provider authorization.
- Person gallery includes explicit photo IDs, caption associations and linked original source assets. Reviewed supported solo/crop metadata controls map portraits; unsupported group identity falls back to initials. Originals/documents are reachable through person/source evidence. Unit regression verifies source-only and unreviewed-caption originals without mutating identity.
- Compact book control is beside the sole Download. At 390px the header, close button, content and Retry are accessible without horizontal overflow. Actual premature prepare returned “Start research before preparing the book.” in the open dialog; Escape restored focus to its opener. Current-edition PDF URL and page count consume API values; no full long-book preview success is claimed here.

## Checks and remaining acceptance

- `pnpm typecheck`; full `pnpm test` with local `ROOTS_PDFTOTEXT`; `pnpm build --webpack`; `git diff --check`.
- Two repeated suites on the prior engineering base encountered an upstream asynchronous test-cleanup ENOTEMPTY in `integration-tests/round3.test.ts`. The preceding full run passed 181 tests. After merging engineering `5f3136f`, the final full run passed all 182 tests; typecheck and production build also passed. No backend/test-owner code was altered to mask the race.
- Claude reports 33 selected original files, including 24 photos and 12 selected old photos, in the new private packet. None of that package was transferred to this laptop. **All 24 private originals, all 12 private aligned pairs, reviewed portrait crops, and the actual 35–40-page English book remain pending private validation on Mike's laptop.** These public fixtures cannot satisfy that gate.
- Native touch hardware/gesture dispatch was unavailable. Pointer, keyboard and narrow viewport checks passed; touch dragging remains a device acceptance check.
- Exact private photo reproduction, live research timing, two final full-packet rehearsals, long-book rendering/download and private-source coverage remain Mike/Claude integration acceptance. The UI does not declare the complete application ready.

## Reproduce local UI checks

Use the repository's configured Node/pnpm and a Poppler `pdftotext` path. Run `node --import tsx tests/ui/make-round3-project.ts` with `ROOTS_PDFTOTEXT` set; it prints a fictional project ID and writes a test manifest under `/private/tmp/osmy-natalia-round3-ui`. Start Next with that `ROOTS_DATA_DIR`; optionally set `ROOTS_ROUND3_MANIFEST` to the generated `FICTIONAL_UI_MANIFEST.json` and `ROOTS_DEMO_CONNECTIONS=true` for the demonstrated autofill/provider checks. Start `ROOTS_UI_CONNECTED=1 ROOTS_UI_PORT=3105 ROOTS_UI_API_PORT=3400 node tests/ui/serve.mjs`, then open its `?project=<printed ID>` URL. Separately, `ROOTS_UI_ROUND3=1 node tests/ui/serve.mjs` starts the visibly fictional comparator/cycle harness on 3104. Never use the injected intake interpretation as model-acceptance evidence.
