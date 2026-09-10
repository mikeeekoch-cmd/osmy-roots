# Round 3 acceptance contract

This scope is grounded in Mike's latest feedback and timing reply. It governs the next implementation. English remains the product language. The running previous build is preserved until the new candidate passes.

## Intake

Remove the entire sentence beginning "For group photographs, list people from left to right" including its Unknown instruction. Remove "Family memories stay distinct from archival evidence." from the page. Preserve uncertainty and attribution in actual source and review records without this footer. Remove Other names or spellings and Current place.

The main form contains starting person's full name, birthplace and birth date. Keep the name required; birthplace/date are optional and accept unknown/partial precision. Family geography can be derived from supplied places and retained as optional context without another mandatory field.

An optional expandable section contains four relative cards: father, mother, grandfather and grandmother. Each has full name, birthplace and birth year. Grandparent side is optional and can remain unknown; never silently choose maternal or paternal ancestry. Do not ask for exact birth dates when only years are supplied.

Provide one "Fill my family details" button beneath the optional section. It fills all source-supported fields from the selected family files or an explicitly loaded private saved profile, with a compact reviewable indication of source. Preserve manual edits, expose conflicts, and leave unknown fields blank. Do not hardcode this family in public UI or call missing facts known. This explicit draft-reading action may parse selected files, but it does not submit a project or start model research in the background. All optional fields may remain empty and the user can continue.

Replace the two generic saved-copy tiles with recognizable Google Drive and Gmail logos, concise provider labels and connection controls. Implement real read-only connection/import for a selected folder and selected correspondence. "Connected" requires server-verified access and a successful read, with account and last successful check available in details. Distinguish disconnected, connecting, connected, expired and error. A connector available to Codex is not automatically connected to this application. File copies remain labeled as copies when no application connection exists. Do not set a green badge from a manifest, a hardcoded flag or a successful file upload. Connect accounts before the timed presentation where practical so Mike can truthfully say he connected them.

## Six initial checks

Exactly six initial questions replace the seven-question flow. They are separate from later research questions and retain explicit confirm/correct/unknown/skip decisions and source support. They must survive refresh and revisiting an answer.

At least three distinct questions show large photographs: one modern family photograph and two older, visibly aged photographs. Use a reviewed source-based identity recommendation only where one exists; otherwise ask who is pictured with unknown/candidate options. Do not recognize faces to assign identities. Keep at least one actual Astra interpretation of the selected family recollection and one genuine unresolved date or identity conflict.

A workable editorial allocation is: (1) modern family photo, (2) older portrait, (3) older group photograph/relationship, (4) one coherent place or life-history check, (5) the live family recollection, (6) the real uncertainty/conflict. Move remaining useful topics to the research question bank instead of combining unrelated questions into one long prompt. Claude selects exact photos, text and spans in the private manifest; these examples are not fabricated family facts.

At desktop size, the photo should occupy a substantial part of the question card, approximately 480-640px wide where space permits, with full-view/zoom access and a contained responsive mobile layout. Original is the evidence view. An enhanced comparison is optional here but must not answer identity from generated detail. Six source-grounded recommendations and their unknown behavior belong in a separate presenter sheet, excluded from model input.

## Research flow and timing

Flow: select sources/details -> explicit Continue and six checks -> research workspace -> Start research -> first map/results -> Research deeper -> second results -> Research deeper -> third results -> current book preview/download. An initial draft can show already parsed source/photo totals before research, while people and claims remain in their true supplied/candidate/reviewed states.

Continue explicitly persists/parses the selected inputs, creates the six checks and executes the logged intake recollection check. Autofill never invokes Astra. Intake preparation is a distinct job stage whose completed work carries into metrics. Start research creates the initial research cycle after the six checks. Each later click creates one deeper cycle using current evidence, open questions and reviewed state, up to two deeper cycles in this scoped session. Disable or coalesce duplicate starts while a cycle is active. Failed-cycle retry retains the same cycle ID; a repeated initial start or third deeper request cannot create extra work. Refresh resumes the same cycle; it cannot start another cycle or reset counters. Completed cycles remain inspectable.

After each research click, show useful activity immediately. Target about 20 seconds of actual planning, retrieval and first analyses before or while publishing the first validated results. This is a responsiveness target, not a fake minimum thinking delay or an overall 120-second deadline. If a task finishes early, mark it completed; queued presentation is distinct from a running model. If a source is slow, blocked or empty, show that outcome and continue eligible work. Do not invent a successful discovery to fill a timed animation.

Astra creates a persisted plan with short user-readable objectives, relevant source/query choices and the next tasks. Execute bounded local retrieval, authorized Drive/Gmail reads, public search and permitted linked-page crawling. The plan should explain the next investigatory action, not expose hidden model reasoning. Jobs need source links, started/completed state, actual tool identity and result summaries. Cached pages and prepared family material retain their origin.

Research must support new-to-project person and relationship candidates, exact evidence spans, same-name alternatives, duplicate detection and explicit review. A retrieved page or matching name is not automatically a confirmed relative. For the curated demo, choose source-supported additional records that can produce useful graph additions across the deeper cycles. Imported existing family records are labeled as such. Expected demo milestones may assert what source files contain, but cannot force model answers or simulated online discoveries.

Each cycle can produce immediate questions and save lower-priority questions in a persistent question bank. Record source/cycle, subject, uncertainty, answer history and open/answered/skipped/superseded status. New questions must not reopen or invalidate the initial six-question completion gate. Reviewing a later answer updates dependent claims, the map and affected book sections.

## Activity and metrics

Replace the reverse event dump and static "Up to date" emphasis with a compact current-work view: Now, Next, and Completed. Show the active research round and meaningful actions such as checking a family record, searching an archive, comparing two candidates, extracting photo metadata or drafting a cited passage. Group attempts and transitions so the same job is not simultaneously shown as running and completed. Completed history is chronological within its round, with new saved results visible as they arrive.

All counters derive from authoritative stored results, not frontend timers or desired presentation numbers. Show both totals and round deltas where useful:

| Metric | Counting rule |
| --- | --- |
| People on map | Distinct saved people, with candidate/reviewed distinction |
| Sources processed | Distinct uploaded/imported source files successfully decoded, indexed or explicitly inspected, out of selected total; distinguish failed and queued |
| Documents read | Actual parsed document/chat files, excluding photographs |
| Photos received / indexed | Distinct original image hashes; successful decode/metadata/index operations; derivatives do not count as new original photos |
| Enhanced photos ready | Validated derivatives with an original parent and passing alignment/visual QA, out of selected old-photo total |
| Evidence checked | Distinct supported records/spans with a stored validation outcome; distinguish deterministic checks from Astra analyses |
| Searches / pages retrieved | Actual attempts and successful distinct URLs; cached results and unique domains shown separately |
| New findings / questions | Saved source-backed proposals, reviewed additions and unresolved follow-up questions |

At workspace entry the verified received-file and photo totals can already be substantial because those files were actually processed during intake. Carry them forward; do not reset to 6/1/0 to hide prior work or increase them without operations. If no page has been retrieved yet, use a neutral planned-search state or show zero accurately. At least several genuine record analyses should run in the new workflow, rather than relabeling one model call as many analyses. Duplicate retries and copies with the same evidence root do not inflate results.

## Map, evidence and photographs

Remove the large book-ready section and duplicate bottom Download control. Keep the map's area available. Put a compact current-book status/info control beside the main Download button, with preview, page count, current/stale/preparing/error status and retry in a popover or drawer. The PDF preview opens the actual current full edition.

Every uploaded/imported item appears in the source inventory with processing state. Every person-linked photo and document is reachable from that person's preview/card. A photo need not be a face thumbnail to remain visible as evidence. Unassociated files remain in the library and question bank, rather than disappearing.

Prefer a distinct source-annotated solo portrait for each person where available. Use an explicitly reviewed per-person crop of a group image only when the bounding box/identity is supported; preserve the full original. If there is no unique supported portrait, use initials or an honestly labeled group image. Never generate a guessed person, silently assign a face or make the same group photograph look like three distinct solo portraits.

Reproduce the reported full-photo failure. Check the actual asset response, type, byte hash and decode result, plus the lightbox's layout, scroll, stacking and error state. The current thumbnail and full viewer use the same asset URL; a different full-resolution endpoint is not yet an established cause. Portal the modal if necessary, scope close-button CSS, preserve retry and constrain both desktop/mobile viewports. Verify all selected originals, not only one example.

All old photographs selected for the new demo require an enhanced version and a working Original/Enhanced slider. Modern photographs keep an ordinary gallery. Inventory and declare the old-photo subset explicitly. Reuse sound existing derivatives; prepare missing ones conservatively, keeping the original intact. Existing unaligned pairs are insufficient for the mandatory slider: produce same-composition aligned derivatives or validated registration/display transforms. Reject changed identities, inscriptions, objects or material historical details. Record parent hash, tool/method, preparation time, alignment and review result. Enhancement occurs before the presentation unless actual live processing is deliberately performed and measured. It adds no independent genealogical evidence.

Mouse, touch, keyboard, Home/End, Escape and focus restoration must work. Arrow keys on the slider cannot page the gallery. Test original-only, 50/50 and enhanced-only views, rapid person changes, reopen, missing bytes and retries. No stale image from another person. Every required old-photo pair must pass before declaring this revised demo ready; a missing pair remains an explicit incomplete requirement.

## The 35-40-page English book

Replace the fixed four-page layout and one 100-word passage with a paginated 35-40-page edition. Use a source-checked shortened English adaptation of the existing full family book, preserving its narrative, portraits, stories and dedication. The bounded audit verified a 112-page Russian reference and an older 147-page variant, not a completed English long edition. Claude selects the controlling edition, records hashes and source-page/paragraph mappings, and prepares the English derivative. Do not interpret an ambiguous filename/version as permission to replace the latest book silently.

Prepare reusable source-backed chapters before the demo. At runtime, assemble the current edition from those chapters plus the current reviewed people, decisions, photographs, uncertainties and newly accepted Astra passages. Show prior family-book chapters as supplied material in source details. Do not claim Astra wrote a pre-existing 40-page book during a 20-second research cycle. Conversely, do not serve an old static book as the current edition after an answer changes.

A proposed 40-page content budget is 5 pages for cover/dedication/contents/maps, 16 for family profiles, 8 for documented stories, 6 for photo/document exhibits, 3 for sources and 2 for open questions. Claude adjusts this to actual material and pagination within 35-40 pages; no blank, duplicated or filler pages. All selected people appear in the register and relevant family sections. All selected original photos receive a readable exhibit or profile placement, with captions and original/enhanced distinction. Every document has a source entry and relevant excerpts/page references; complete original files stay in the ZIP rather than printing every raw archive byte.

Publish a coverage ledger: input file/hash -> source/people/claims -> book chapter/pages or gallery -> preserved ZIP path, with any omission explained. Separate original counts, derivative counts and container/extracted attachment counts. Audit the desired expanded 30-35-file selection; do not call the current 20 files 35. Keep the existing 40-file, 100 MB total and 25 MB/file runtime limits unless Mike changes the shared policy after a concrete inventory shows the need. A full reference PDF larger than a per-file cap must be prepared as a bounded English excerpt or handled through the agreed authorized source adapter, not silently bypass limits.

Preview and Download must reference the same current immutable edition. Cache unchanged chapters by their evidence/review/assets fingerprints and rebuild affected sections after corrections. Download seals an exact version and stops or explicitly records unfinished jobs. Continuing after a sealed download creates an editable successor; it cannot mutate delivered bytes. Preserve full ZIP/HTML/JSON and both photo versions with exact hashes and portable reopen.

## Acceptance before the new demo-ready claim

- Preserve the 171-test baseline, supported earlier projects, version checks, review/unknown/correction/undo, source validation, limits, cancellation and export retry. Add meaningful tests for the new behavior, then typecheck and production build.
- Exercise optional blank form, reviewed autofill without overwriting manual values, expired/disconnected providers and successful real selected-source imports. A real Connected state is required for the requested connection claim.
- Exactly six initial checks, at least three large distinct photos, and a separate persistent later question bank. Verify skipped/unknown answers and actual recollection interpretation.
- Initial research plus two explicit deeper cycles execute real bounded jobs, produce source-backed graph or evidence changes and preserve job state on refresh. Test duplicate clicks, stale model results, same-name candidates, no-match, blocked sources and recovery.
- Verify metric reconciliation against actual unique files, image hashes, sources, jobs, URLs and graph state after each round. Source copies, retries and derivatives cannot inflate counts.
- Inspect every selected photo in card and full view, every required old-photo slider and each selected portrait assignment. Broken or missing originals/derivatives block this revised media acceptance.
- Render and visually inspect every one of the 35-40 PDF pages. Verify English text, chapter/source coverage, captions, original bytes, current reviewed changes, PDF/HTML parity and ZIP reopening in an empty store.
- Two actual browser rehearsals on the same final candidate and frozen packet, including all three cycles, a later question answer, photo sliders, current full-book preview and actual ZIP receipt. One must refresh/resume. Record each click, first useful activity/result, completed jobs, source-backed additions and total time. The previous 104-second runs prove round 2 only.

Only safe code/status enters Git. Private books, photos, selected email contents, personal field values and source URLs stay in the ignored packet/handoff. Existing scoped OpenAI authorization is retained; it does not establish application OAuth access or authorize unrelated private photo/book transmissions. At execution, request only genuinely missing access for a concrete operation and continue independent work.
