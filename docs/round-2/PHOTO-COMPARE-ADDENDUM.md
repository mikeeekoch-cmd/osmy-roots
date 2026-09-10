# Person-card photo comparison and invisible timing

This is an additive round-2 assignment. Continue the four existing assignments and their shared clock. Do not restart the sprint or block the core file/question/map/book integration while assembling photo pairs.

## No visible timer

The 120-second Submit-to-Download budget is an internal rehearsal and performance target. Never render a countdown, elapsed-session clock, seconds remaining, "120-second demo" badge, deadline, time ruler or timer-derived percentage in the product. Keep timing measurements in private logs and test reports. This includes preparation, questions, activity feed, person cards, tool details and export states.

Show real product activity instead: reading sources, checking a quotation, waiting for an answer, adding a photograph, preparing the book. Source/people counts and "Question 3 of 7" are allowed when based on actual state. Animation must not imply work that is not running. This requirement applies to all four prompts, including an already-running assignment.

## The interaction

Owner: Codex Natalia. Implement comparison inside the selected person's existing detail card/photo viewer. A person with a valid pair has a "Compare photos" control. Open a large photograph with a draggable vertical divider, initially centered. Show "Original" on the left and "Enhanced" on the right. Dragging reveals the two versions of the same source photograph. Keep full-original viewing available.

Support mouse, touch and keyboard. Provide a labelled range control with arrow/Home/End behavior, a visible focus indicator and at least a 44px handle hit area. The slider's arrows must not trigger the existing gallery's next/previous keyboard listener. Update the lightbox focus trap to include the slider; Escape closes and restores focus to the opener. Scrolling the person card and dragging the family map must not steal the gesture.

Keep both layers in one stable viewport with matched dimensions and a shared crop/transform. Do not independently stretch the two images. Existing derivatives can have different borders, crop or reconstructed geometry. Product supplies verified alignment metadata or derived display previews with lineage. Preserve the complete original file in the gallery and export. Use a side-by-side view when a pair cannot be aligned credibly, and choose aligned pairs for the primary slider demonstration.

Photo changes, person changes and missing/loading images reset comparison safely. Do not show a stale enhanced image from the previous person. Default to the original if the enhanced asset is missing; hide comparison for unpaired photos. People without selected old photos retain the ordinary gallery, without disabled enhancement controls on every card.

Comparison is a local viewing action. It must not start a new model call, reset research, alter relationships, change human decisions or invalidate the book simply because the divider moved. A paired image can become available through the existing staged source arrival, once its real assets are ready. No new wizard, third main screen or required eighth question.

## Assets and scope

Product owns the content preparation as an extension of prompt 07. Identify every old/damaged photograph selected for the demo packet, reuse existing enhanced versions where available, and prepare a conservative enhanced derivative for each remaining selected old photo. Prioritize 2-3 people with at least two distinct original/enhanced pairs for the first handoff, then complete the selected old-photo set. A group photo may be linked to multiple already-annotated people; do not invent face identities or positions.

This task does not request regeneration of the entire historical archive. Gather all available photos for the selected people into one private photo-library location with a mapping index; originals can be indexed/deduplicated by hash while retaining person associations. Modern photographs remain unchanged. Keep the upload selection small and coherent.

Use .roots-data/demo-artefacts/04-photo-library/originals and enhanced for this content library. Keep private master files untouched. Copy only the curated originals and corresponding derivatives into 01-upload, using English filenames such as 01__Person_Name__original.jpg and 01__Person_Name__enhanced.png. Both members of every demonstrated pair must be available to the run and portable export. Maintain the existing <=20 files/<=20 MB intake budget by choosing 6-8 originals and a small number of derivatives if necessary; never silently increase limits or delete original evidence to fit.

Image preparation happens before the timed run. Existing prepared derivatives can be displayed immediately after ingestion. Do not claim they were restored by a live Astra call. Use the normal "Enhanced" label; show "AI-enhanced" only where provenance establishes that fact. Keep the original as historical evidence. Generated color, texture and reconstructed details are a visual interpretation and cannot supply identity, medal, occupation, date or other genealogical claims.

For missing derivatives, use the available image-editing workflow after inspecting the original. Request conservative scratch/tear repair, restrained tonal cleanup and optional plausible color while preserving the source composition, facial structure, age, clothing, objects and inscriptions. Reject results with material invented or changed details. Record tool/model when known, preparation time and parent hash. Do not infer a historical color as certain. Never generate unrelated replacement portraits or use a person's name to request a guessed face. If acceptable enhancement is unavailable, keep the original and record that specific gap; it does not stop core integration.

## Shared data and export

Mike owns additive shared contracts/state/adapter changes. Extend the canonical manifest with photo variants/pairs. Required information: pair ID, person IDs from existing annotations, original asset ID/hash, enhanced asset ID/hash, preparation origin/method when known, original-versus-derivative role, English labels/caption and alignment/view settings. Stable asset IDs, not filenames, bind a pair. Validate both references, parent hash, media type, same-project access and matching person annotations. Do not treat an enhanced derivative as a second independent source. Older projects without this optional metadata keep their existing gallery behavior.

Claude owns ingestion/export changes. Preserve both versions and pair metadata through PDF/HTML/project ZIP and portable reopen. A compact PDF may show selected original/enhanced images with clear labels while HTML/gallery retains all included pairs. Never label derivatives as original files or silently replace the original photo in the book. Keep English filenames and hashes intact. Default photo selection remains source-aware.

Natalia owns src/ui/OriginalPhotos.tsx, a new PhotoComparison component if helpful, the existing person-card integration, styles and relevant UI checks. Mike alone owns packages/contracts and dependency changes; Claude alone owns ingestion/export; Product alone owns private content. Preserve each other's work and the existing P0/partial P1. Use the published shared types rather than a second schema.

## Completion checks

- At least two distinct validated pairs are reachable through the intended 2-3 person cards; all selected old photos have a prepared derivative or a specific recorded gap.
- Full original, 50/50, fully original and fully enhanced views work without image jumps or distortion; unpaired/modern photos keep normal paging.
- Mouse/touch/keyboard work, including range versus gallery arrows, focus trapping, Escape, rapid person changes and a missing derivative.
- No visible clock/countdown or timer-derived progress exists anywhere in the normal app, including source and export details.
- Opening/comparing photos leaves run state, graph, review decisions and book version unchanged. It does not delay Download or start restoration requests.
- Both files and metadata survive export/reopen with exact hashes; English labels distinguish originals and derivatives.
- Rehearse one brief comparison inside the existing map-exploration segment and retain both successful <=120-second core journeys. The internal timing remains invisible.

Record exact working pairs, prepared/generated/unavailable distinctions, checks and scope cuts in private content QA plus sanitized owner status. Do not claim the feature is implemented from this prompt alone.
