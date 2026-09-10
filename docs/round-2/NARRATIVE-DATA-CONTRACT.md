# Osmy Roots: narrative and input contract

Status: execution handoff, not an implemented feature. This contract and DEMO-READY-SCOPE.md control the four round-2 assignments. The current request replaces the former 180-second interaction budget with 120 seconds.

## One narrative, two clocks

Use the active private 01_demo_script.md, revision 2, titled "Roots: a promise to my dad". Preserve the opening promise, distance from family, family fragments, human confirmation, tree/book reveal and dedication. The private reference handoff identifies the actual script, selected records, book, recollection and photo manifest. Do not use the archived revision or invent a new family narrative.

Stage time and application time are separate. Mike may tell the opening before Submit and finish the dedication after the download. The application clock starts on the intake Submit/Start action and ends on Mike's Download family book click, at most 120 seconds in each normal rehearsal. Aim for a valid ready bundle by second 108 and a click by second 115. Also measure delivery of the real file; target receipt by second 120. Report both click and receipt timings, and any failure separately.

The earlier three-minute stage script needs a revised cue sheet: seven checks replace two or three; selected English derivative sources replace the visible Russian source; supported reconstructed chat ZIPs replace the old text-only limitation. Use Osmy Roots in product references. If Telegram is not actually supplied, change that line to "family chats". Give Mike an exact wording-change list and a separate revised script. Preserve the existing canonical script.

## Coverage and the meaning of growth

The selected private input currently contains 35 distinct people and 57 raw relationship entries. The prior normalized project has 56 relationships. The content owner must reconcile the duplicate/normalization difference and record every retained, merged or excluded row. Preserve the stable selected IDs, source status and uncertainty. Do not add people to reach an arbitrary target, silently drop someone, or promote unresolved links into confirmed ancestry.

The starting file selection must contain enough supported material for all 35 people and the final intended relationships, photos and stories. A readable one-pager supplies the narrative overview. A complete human-readable family register and relationship register supply the larger structure. No hidden server seed or internal project JSON is required from Mike.

The finished tree represents supplied family records assembled and reviewed during this session. It does not mean Astra discovered 35 previously unknown relatives. After seven explicit answers, reveal a coherent five-person branch. Then commit six eligible saved batches, nominally five people each, to reach the supplied 35. Put actual IDs and dependencies in the private manifest. If the audited data requires unequal batch sizes, preserve the cadence and final coverage. A photo or story is an evidence update, not an extra person.

Prior supplied records remain attributed to those records. New model interpretations stay proposals until reviewed. Timed arrivals can add sourced imported records or unresolved proposals, but never accept a new factual assertion on behalf of Mike. Unknown dates remain unresolved in both graph and book.

## The 120-second run

| App elapsed                | Data and state                                                                    | What Mike sees or does                                              |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Before 0                   | Files selected and preflight checked; no ingestion, model call or scheduled run   | Personal details, upload selection, source cards                    |
| 0-8 sec                    | Persist run; bounded parse; start actual relevant Astra request                   | Immediate loader and concise real activity                          |
| 8-35 sec                   | Seven source-backed answers, each saved explicitly; parsing continues             | Recommended answer, Edit, I don't know; about 3-4 seconds per check |
| 35 sec                     | Commit initial coherent five-person branch                                        | First map appears, with source/review states                        |
| 44, 53, 62, 71, 80, 89 sec | Six dependency-safe graph/evidence batches; nominal totals 10, 15, 20, 25, 30, 35 | Tree grows evenly; photo/story/source cards arrive; Mike explores   |
| 90-108 sec                 | Finish eligible analysis; prepare current cited English book and bundle           | Full family, reviewed story, actual book preview and ready state    |
| 108-120 sec                | Mike clicks Download; atomically seal matching state version and deliver bundle   | Download closes the run; no later scheduled additions               |

These are measured rehearsal targets. Human pauses and slow services must remain visible. No auto-confirming answers, skipping a source validation, or labeling a cached result live to meet a timer. Recommendations may be derived from prepared evidence; a real model-derived answer requires a completed validated response. Keep request status separate from staged source-release status.

The reviewed craft/recollection beat must pass through an actual Astra interpretation, source check, human decision and current English book passage in the integrated live rehearsal. Include its source in the initial upload packet but exclude its prepared answer from the overview and model input. Keep this story unaccepted in the starting state. This replaces the old instruction to upload the source only midway through the demonstration. Its early analysis supports one of the seven questions; its saved result can be highlighted again during map exploration.

## Private content packet

The product/content agent owns the bytes and factual content under the ignored .roots-data/demo-artefacts directory. The three engineers consume its frozen handoff. Use this structure:

    00-START-HERE.md
    01-upload/
      Family_Overview.pdf
      Family_Register.csv
      Family_Relationships.csv
      Family_Recollections.txt
      Photo_Captions.txt
      WhatsApp_Mom.zip
      WhatsApp_Dad.zip
      WhatsApp_Family.zip
      01__Person_Name.jpg
      ... 6-10 selected English-named photo copies
    02-background/
      saved-family-folder/
      saved-family-correspondence/
    03-output/
    80-presenter/
      SCRIPT_120_SECONDS.md
      SCRIPT_CHANGES.md
      SEVEN_ANSWERS.md
      NARRATIVE_MAP.csv
      EXPECTED_OUTCOME.json
    90-private-provenance/
      original-source-index.json
      translation-map.json
      photo-rename-map.json
      relationship-reconciliation.csv
    DEMO_MANIFEST.json

Keep 01-upload flat, <=20 files and <=20 MB total. Eight named document/archive files plus ten photos is eighteen files. If adding a necessary PDF text sidecar, remain within the same budget. Exclude presenter answers, manifests, raw originals, old full books and expected outputs from the user-selected files and Astra context.

All content visible in the demo and all exported source text must be English. Preserve Russian originals privately and hash-bind English derivatives to their source locators. Rename copies without altering original photo bytes. Use stable transliterations consistently across script, files, questions, graph and book.

Required coverage:

- Family_Overview.pdf: one visually checked page, roughly 300-400 words. Include supported facts about the presenter, family geography, the promise/book purpose, the main family line, the meaning of the supplied records and what remains uncertain. Keep the held-out recollection's answer out of this overview. Never invent a new phone call, exact age, birthplace or migration for narrative convenience.
- Family_Register.csv: every selected person ID exactly once; English full name, aliases, birth/death values with precision and uncertainty, places, source references and record status. Unknown values remain explicit. Older register assertions can cite the supplied prior register without pretending they were independently verified.
- Family_Relationships.csv: stable relationship ID, from/to person IDs, relationship type/direction, source references and status. Preserve unresolved/candidate links, avoid cycles and explain normalization from the raw count.
- Family_Recollections.txt: concise English evidence passages with stable source IDs and locators. Cover origin, time, movement and personal-story questions. Preserve attribution, transcription gaps and contradictions. Put the key held-out passage in one canonical uploaded source, such as the family chat ZIP, without duplicating its answer elsewhere.
- Photo_Captions.txt and image copies: asset ID/hash, English filename, depicted person IDs, left-to-right position only where actually supplied, date/place precision, caption and annotation provenance. Photos of graves or memorials do not identify the living people in the image. Select a confirmed portrait or leave identity/order unknown.
- Three actual ZIPs: bounded UTF-8 _chat.txt, short English dialogue and selected attachments if useful. Each factual sentence traces to a real book/document span. Mom/Dad/Family are reconstructed format roles, not proof of who wrote the underlying memory. Preserve the actual recollection attribution. Keep reconstruction metadata in source details and inside the archive. Share evidence-root IDs so repetitions do not inflate corroboration.
- Saved-folder/correspondence copies: English derivatives of supplied family material with source locators. They may add visible photos or passages over time. They must not introduce an essential person or fact absent from the initial packet. Repeated copies retain one evidence root. Empty optional folders cannot be shown as processed source collections.

The illustrated book must reflect the same roster, photographs, human answers and accepted recollection. Preserve the current four-page compact PDF, longer readable HTML and complete editable project ZIP. Design the four pages for cover/dedication, a legible main branch plus full 35-person family register, the reviewed story with selected photos, and sources/open questions. The full map and complete photo/story material remain available in HTML/project. Visually verify the result; do not squeeze an unreadable full graph into the compact PDF or imply every person has a portrait.

## Shared manifest and traceability

Mike publishes the runtime schema and fictional example within ten minutes of engineering execution. Product populates the private content; Claude checks parser compatibility. No second manifest or alternative person-ID system.

DEMO_MANIFEST.json must include packet/schema version, script fingerprint, selected person IDs, expected normalized relationship count, file paths/hashes/bytes, source/evidence-root IDs, English derivative lineage, ordered photo annotations, seven question definitions with support, initial branch IDs, six batches with dependencies and release offsets, saved-source jobs and required book sections. Keep machine-local paths out of public examples.

NARRATIVE_MAP.csv connects each spoken beat to app-relative time, person IDs, input file/source locator, photo ID, question ID, recommendation support, batch ID, expected saved change and final book section/citation. Every intended final person/link/story/photo must have a route from the initial upload set. List unsupported coverage explicitly and resolve it before freezing the pack.

The seven topics are photo identity, kinship, origin, lifespan/residence, movement, personal recollection and a real conflict or a sourced editorial choice. Each gets one short recommendation, its evidence link, exact save behavior and unknown alternative. Do not transfer one relative's move to another. Presenter expected answers and acceptance assertions are private test material, never instructions passed as evidence to Astra.

Freeze a packet version and hash before rehearsals. Content changes require a new packet version and review of affected narrative/question/book checks. Engineering changes must not silently rewrite names, facts or recommendations to make an assertion pass.

## Four owners and proof of completion

Product prepares actual private files, source coverage, seven-answer sheet, revised cue script, fictional twin and content QA. Claude implements ingestion, retrieval and export against those files. Natalia implements presentation against Mike's real API. Mike owns contracts, run/state/model integration, version-safe book preparation/sealing and final acceptance. Each owns its outputs without reverting another owner's work.

Book preparation may start before Download. Key caches to the exact reviewed-state version, language, packet and included asset hashes; any correction invalidates the affected output. On Download, seal and serve the matching artifact, or honestly regenerate. Never give Mike an old fixed book while a current one is still pending.

Final acceptance requires two fresh real-browser rehearsals using the exact frozen files, all seven explicit answers, six distinct saved batches spread across at least 45 seconds, final coverage reconciled to 35 people, a real source-to-review-to-passage call, and an actual current export. Record Submit, question completion, each batch, book ready, download click and receipt timestamps. Preserve baseline P0/partial P1, English-only checks, PDF visual inspection, ZIP integrity and portable reopen. Separate content-ready, engineering-ready and integrated-demo-ready status.
