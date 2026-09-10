# Codex Natalia: Original / Enhanced inside a person's card

Continue your current Osmy Roots assignment in https://github.com/mikeeekoch-cmd/osmy-roots on codex/ui. Fetch and incorporate the latest origin/codex/engineering while preserving your work. Read AGENTS.md, docs/round-2/PHOTO-COMPARE-ADDENDUM.md, docs/round-2/NARRATIVE-DATA-CONTRACT.md and your existing prompt 05.

This is a follow-up for the existing UI owner, not a new competing UI agent. Keep the same shared engineering deadline. Complete the core intake/questions/map/download path first, then integrate this bounded photo feature before final rehearsal. Product can prepare files in parallel. The addendum does not block the other four assignments.

The 120-second runtime budget is internal only. Do not show a timer, countdown, elapsed duration, deadline, remaining seconds or time-derived percentage anywhere in the product. Display actual work, sources, questions and results. Keep duration measurements in private logs/tests. Seven-question progress is allowed.

Implement a real original/enhanced comparison inside the selected person's detail card and photo viewer:

1. A validated pair exposes "Compare photos". Show the original on the left and enhanced version on the right with a vertical draggable divider initially at 50%. Use English labels "Original" and "Enhanced". Keep a full-original view, and leave modern/unpaired photographs in the ordinary gallery.
2. Both images share a stable viewport and documented alignment. Preserve aspect ratio, avoid independent stretching and do not crop away evidence from the stored original. Existing source and enhanced files can differ in crop/geometry; use Product's alignment settings. Provide side-by-side fallback for a poorly aligned pair and use suitable pairs for the main divider demonstration.
3. Support mouse, touch and a labelled keyboard range control with arrow/Home/End keys, focus indication and a generous handle hit area. Fix the existing OriginalPhotos lightbox keyboard behavior so slider arrows do not change photographs. Include the slider in focus trapping. Escape closes and restores focus.
4. Handle image loading/error, absent derivatives, person/photo changes and rapid navigation. Never display another person's stale pair. Keep gallery paging and reduced-motion support. Moving the divider must not change research state, person links, review decisions or export freshness.
5. Use real asset URLs and pair metadata from Mike's shared API. No family filenames or photos hardcoded in public components. Do not add a competing schema or edit contracts/dependencies yourself. A fictional development pair is acceptable for isolated UI work; final acceptance needs real integrated pairs.
6. Product owns the actual originals, prepared enhancements, missing-image restoration, English names, hash/parent links and pairing/alignment checks. Ask Product for at least two distinct pairs across 2-3 selected people first, then support all selected old-photo pairs. Mike owns optional contracts/state; Claude owns ingestion/export/reopen. You are not alone in the codebase. Preserve all owners' changes and never force-push.
7. Restoration runs before the demo. Existing prepared variants must not appear as a fake live Astra enhancement. Show normal provenance in source details; use "AI-enhanced" only where supported. Enhanced colors/details never become historical evidence.
8. Add the comparison to the existing map-exploration segment without creating another setup step or eighth required question. It must not delay the current book or download. No automatic dragging or long animation that prevents Mike from using the handle.

Your ownership: src/ui/OriginalPhotos.tsx, a PhotoComparison component if useful, current person-card integration, styles, relevant UI checks and docs/status/ui.md. Preserve the existing source-to-person animation, branch selection, gallery paging and all baseline behavior.

Test two distinct valid pairs, unpaired photos, missing enhanced file, group-photo associations, aligned display, mobile touch, keyboard/focus, rapid person changes and refresh. Verify that comparison changes no persisted family state or book version. With Mike/Claude, verify both asset hashes and pair metadata after portable reopen. Inspect all reachable product states for visible timers.

Deliver small safe commits, the exact tested integration, private pair references through Product, QA outcomes and remaining gaps. Continue core work when a pair is unavailable; report that gap. Do not claim live image generation or finished end-to-end readiness unless actually demonstrated.
