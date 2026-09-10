# Round-2 UI verification

This report separates the actual application from the isolated contract harness. The harness is not the Product owner's fictional twin and does not prove parsing, live Astra, sealing or a two-minute rehearsal.

## Run

- Actual app: `pnpm dev --port 3100`.
- Isolated UI: `ROOTS_UI_ROUND2=1 node tests/ui/serve.mjs`, then open `http://127.0.0.1:3103`. This imports production components, consumes the lead's fictional contract example and explicitly labels every test as a replay. No real ZIP is generated.
- Typecheck: `pnpm typecheck`. Regression suite: `pnpm test`.

## Browser checks performed

- Actual app: separate Open saved project restored a fictional roots-v1 project and both original PNGs through the real API. Unknown review survived a browser refresh. No live-model pass was attempted by this check.
- Desktop 1440 × 900 and mobile 390 × 844: compact intake, photo naming guidance, source questions and original/enhanced viewer. Mobile document width was 390 px without horizontal overflow.
- Harness: seven explicit question saves across all seven categories; sourced recommendation detail; Unknown; Back to the saved Unknown; a distinct correction; navigation to the next unanswered question. Keeping a saved correction resubmits the saved action/text, not the old recommendation.
- Harness: no family map before initialSavedAt, including after all seven answers. A manually released initial branch and subsequent snapshots produced the map. From ten to fifteen people, every pre-existing node retained its coordinates and the camera transform remained exactly `translate(25px, 37.8998px) scale(0.688745)`. This is saved-snapshot UI validation, not the six-batch timing gate.
- Harness: holding createProject displayed preparation immediately. Deliberately failing that promise restored the intact name, unknown-location selection and selected file. No file needed re-selection.
- Harness: deliberate download failure displayed retry and never displayed completion or generated a pretend ZIP.
- Harness: the saved photo arrival linked directly to its actual fixture source; opening that link showed the matching source quotation. Unrelated sources are excluded by the saved-delta regression check.
- Comparison: two distinct code-generated placeholder pairs (portrait and landscape), full-original/50–50/full-enhanced, Home/End, next-photo reset, unpaired ordinary gallery, unaligned side-by-side, and missing-enhanced original fallback.
- Mobile pointer: dragging the 44 px divider handle changed the native range from 50% to 78% without paging or moving the map; the original aspect ratio was preserved.
- Gallery keyboard: slider arrows did not page the gallery; Escape closed the lightbox and restored focus to Compare photos. The focus trap includes range inputs. Enlarging/closing and comparison only change local view state.

## Integration still required

- Wire the optional run methods in the lead-owned browser adapter and exercise the actual server.
- Supply the Product twin/frozen packet. Do not substitute this harness for its evidence, source mappings or timing.
- Publish optional validated photo-pair/alignment metadata. `OriginalPhotos` accepts a render-only `comparisonFor(originalAssetId)` adapter with `{ enhancedUrl, aligned }`; no persistence schema is defined in UI. `PhotoComparison` treats unaligned or mismatched-aspect pairs as side-by-side. Bind this adapter only to validated shared metadata, never a filename/name inference.
- Check real ordered photo annotations, English projection, late Astra clue/review/book, early and normal sealed download, hashes/reopen and two complete <=120-second rehearsals on the exact packet.

Production contains no elapsed session timer or countdown. The source/people/question counters describe actual snapshot data. Comparison percentages describe the divider only.
