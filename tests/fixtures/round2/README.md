# Round-2 fictional fixture

The packet contains 35 invented people, 56 distinct relationships, a 57-row raw audit, seven questions, six saved graph batches, three reconstructed chat ZIPs and six generated illustrations. Every name, location, date and memory is fictional. No private family source is read by the generator.

Select the 14 files inside `packet/01-upload` in the normal intake. Use Rowan Vale and geography Willowford and Harbourfield. Keep the manifest, presenter answers and expected outcomes outside model input.

From the repository root:

```sh
node --import tsx tests/fixtures/round2/validate.mjs
python3 tests/fixtures/round2/build_fixture.py
```

Generation requires Pillow and reportlab. The bundled artifact Python includes both. PDF generation and ZIP member timestamps are deterministic; the synthetic ZIP file timestamps do not describe message dates. Chat text contains no timestamps.

The validator exercises the production parser and shared Zod schema, ordinary-file roster coverage, actual ZIP extraction, duplicate reconciliation, source quotes, image bytes, candidate/unknown states, same-name separation and dependency-safe releases. It does not prove a browser rehearsal or a live Astra interpretation. The actual private packet remains a separate owner deliverable.
