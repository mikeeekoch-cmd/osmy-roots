# UI validation

These are synthetic coding fixtures. The placeholder raster was drawn for aspect-ratio testing and represents no real person. No private family materials or model credentials are included.

## Reproduce

1. Install the lead's pinned dependencies: `pnpm install --frozen-lockfile`.
2. Run the mounted application: `pnpm dev --port 3100`.
3. Generate source fixtures: `pnpm exec tsx tests/ui/make-seed.ts`. Outputs are under ignored `.ui-preview/`.
4. Enter Alex Morgan, choose unknown geography, select fictional-family-with-photo.json plus fictional-placeholder.png, and start. JSON is an existing-record import; its question is explicitly prepared.
5. Inspect the person photo and edge evidence. Accept the prepared interpretation, correct it through the person's Reviewed interpretations, edit a name and refresh. Confirm the original quote is unchanged.
6. Add a relationship from the last generation to the first. Backend must reject the ancestry cycle. A valid edit can be undone once.
7. Add a new text clue. A configured server runs Astra; without a key the source is saved and the UI reports the actual failure. This failure is not a successful live-model check.
8. Download calls the real route. Missing model/export dependencies show an error. Never substitute a static ZIP and call it current.

UI logic: `pnpm exec tsx --test tests/ui/model.test.ts`.

Independent replay: `node tests/ui/serve.mjs` on 3101. Replay is labeled and intentionally refuses a fake book export. Connected harness: `ROOTS_UI_CONNECTED=1 node tests/ui/serve.mjs` on 3102 with the actual Next server on 3100. The production Next page already mounts RootsApp, so the harness is optional.

Browser observations and remaining gates are in docs/status/ui.md. Screenshots use the real mounted app and safe prepared input; they are not evidence of a live AI interpretation.
