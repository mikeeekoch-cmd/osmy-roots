# Runtime packet parser compatibility

The app calls `parseFamilyPacket` for v1 or `parseFamilyNotesPacket` when the manifest declares `inputFormat: 'family_notes'`. Both are exported from `server/ingestion/index.mjs` and return normalized `roots-v1` people, relationships, claims, sources, assets and asset bytes. The checker selects the same parser from the manifest.

Run without a model or network call:

```sh
node scripts/check-packet.mjs <01-upload directory> --manifest <DEMO_MANIFEST.json>
```

The command exits unsuccessfully on parsing errors, changed file hashes/bytes, roster or relationship mismatch, unresolved question supports, unsafe batch dependencies or missing staged relationships. It validates the supplied manifest schedule; it never substitutes an invented branch or schedule.

The v1 packet supports `Family_Register.csv`, `Family_Relationships.csv`, `Family_Overview.pdf`, `Family_Recollections.txt`, `Photo_Captions.txt`, original images and three chat ZIPs. CSV quoting/newlines and stable IDs are preserved. Caption TXT contains the agreed JSON annotation array. Undated and dated reconstructed chat messages are parsed, with per-message evidence roots and actual attribution retained separately from synthetic speaker/time scaffolding. PDF extraction is actual bounded Poppler extraction, with original bytes retained.

The frozen v1 private packet was checked locally: 35 people, 56 relationships, 8 photo annotations and all 12 chat messages. Its source text remains private. The separate public fictional twin exercises the same runtime schemas.

The external owner's `ingestDemoPacket` remains available from `server/ingestion/raw-packet.mjs` and as a named compatibility export of `packet.mjs`. Its raw-schema format is documented in `RAW-PARSER-COMPATIBILITY.md`; it is not the production intake path and its dated-chat/paragraph-caption assumptions are not a certificate for canonical packet compatibility. Its independent tests and archive/PDF/staging modules are preserved. The raw export adapter is also optional; `server/agent/bundle.ts` remains the strict live export boundary.

The v2 ordinary-prose packet supports `About my family.pdf`, `Family notes.txt`, `Photo notes.txt`, original images and the same chat ZIP protocol. Private manifest `identityKeys` map exact readable headings, relationship sentences and filenames to stable IDs. They cannot add missing people, relationships or files. All facts and citation spans come from the uploaded prose. V1 remains available.

The supported prose grammar is deliberately bounded:

- Person sections begin with `## Exact full name`. Dates use `Born` or `Died`, optionally `on`, `in`, `around`, `about` or `approximately`, followed by an ISO date, year or full English date such as `23 August 1996`. Location-only sentences are not dates. Conflicting dates retain both supplied values with unknown precision. Missing dates remain unknown.
- Relationships inside a person section use `His`, `Her` or `Their`, then `father`, `mother`, `wife`, `husband`, `spouse`, `partner`, `brother`, `sister` or `sibling`, followed by `was NAME.` or `may have been NAME.`. Parents point to the person in the heading. Partner statements do not establish legal marriage. Tentative statements stay proposed. A relationship identity key uses `heading + '\n' + exactSentence`; a bare sentence is accepted only when unambiguous.
- An optional `## Family connections` section accepts one sentence per line: `NAME is recorded as the parent/spouse/partner/sibling of NAME.` or `NAME may be the parent/spouse/partner/sibling of NAME.` Unmatched relationship identity keys and malformed recognized relationship sentences fail validation.
- `This identification remains tentative.` preserves a candidate person; `This record contains an unresolved discrepancy.` preserves a disputed record.
- Photo sections begin with `## exact filename.jpg`. `People named in the caption: NAME; NAME.` preserves unordered associations. Only an explicit line beginning `Left to right: NAME; Unknown; NAME.` creates positions. A name outside the selected roster remains an unresolved label without creating a person. Photos remain unattached until review.

The current private v2 passed the runtime parser, full snapshot and exact citation validation, manifest file hashes, seven question supports, all batch coverage, and `startRound2` photo-annotation comparison: 20 files, 35 people, 56 relationships (14 tentative), 14 photo annotations and 12 chat messages. No parser result establishes live Astra or browser rehearsal readiness.
