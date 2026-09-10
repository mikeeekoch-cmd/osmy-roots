# Runtime packet parser compatibility

The app calls `parseFamilyPacket` from `server/ingestion/index.mjs`. It returns normalized `roots-v1` people, relationships, claims, sources, assets and asset bytes. It is the tested parser for the frozen round-two packet.

Run without a model or network call:

```sh
node scripts/check-packet.mjs <01-upload directory> --manifest <DEMO_MANIFEST.json>
```

The command exits unsuccessfully on parsing errors, changed file hashes/bytes, roster or relationship mismatch, unresolved question supports, unsafe batch dependencies or missing staged relationships. It validates the supplied manifest schedule; it never substitutes an invented branch or schedule.

The v1 packet supports `Family_Register.csv`, `Family_Relationships.csv`, `Family_Overview.pdf`, `Family_Recollections.txt`, `Photo_Captions.txt`, original images and three chat ZIPs. CSV quoting/newlines and stable IDs are preserved. Caption TXT contains the agreed JSON annotation array. Undated and dated reconstructed chat messages are parsed, with per-message evidence roots and actual attribution retained separately from synthetic speaker/time scaffolding. PDF extraction is actual bounded Poppler extraction, with original bytes retained.

The frozen v1 private packet was checked locally: 35 people, 56 relationships, 8 photo annotations and all 12 chat messages. Its source text remains private. The separate public fictional twin exercises the same runtime schemas.

The external owner's `ingestDemoPacket` remains available from `server/ingestion/raw-packet.mjs` and as a named compatibility export of `packet.mjs`. Its raw-schema format is documented in `RAW-PARSER-COMPATIBILITY.md`; it is not the production intake path and its dated-chat/paragraph-caption assumptions are not a certificate for canonical packet compatibility. Its independent tests and archive/PDF/staging modules are preserved. The raw export adapter is also optional; `server/agent/bundle.ts` remains the strict live export boundary.

A later prose-only packet revision is being specified with Product. V1 remains preserved until the new bytes pass the same runtime checks. No parser result establishes live Astra or browser rehearsal readiness.
