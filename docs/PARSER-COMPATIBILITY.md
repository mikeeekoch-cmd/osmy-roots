# Packet parser compatibility

Owner: Claude Code Mike (`server/ingestion`, `server/research`, `server/export`).
Audience: Product, who owns the packet bytes and facts.

Run this against a candidate packet before freezing it. It uses the production
parsers, so it tells you what the app will actually do. A generic `unzip` or a
spreadsheet preview does not.

```bash
node scripts/check-packet.mjs <path to 01-upload> [--manifest DEMO_MANIFEST.json]
```

Exit code 0 means no errors. It prints every file outcome, the roster and
relationship reconciliation, photo identity mapping, and whether the roster can be
released in six dependency-safe batches.

## Supported inputs, by exact filename

| File | Parsed as | Notes |
| --- | --- | --- |
| `Family_Register.csv` | **required** one row per person | Header names are flexible: `person_id`/`id`, `full_name_en`/`full_name`/`name`, `birth_date`, `birth_precision`, `death_date`, `death_precision`, `birth_place`, `places`, `aliases`, `maiden_name`, `occupation`, `source_refs`, `record_status`, `notes` |
| `Family_Relationships.csv` | **required** one row per relationship | `relationship_id`, `from_person_id`, `to_person_id`, `relationship_type`, `subtype`, `source_refs`, `status`, `notes` |
| `Family_Overview.pdf` | one-page narrative, real text extraction | See "PDF" below |
| `Family_Overview.pdf.txt` or `Family_Overview.txt` | hash-bound text sidecar | Only used if the PDF has no usable text layer, and only if it contains the PDF's sha256 |
| `Family_Recollections.txt` | English evidence passages | Blank-line separated. A paragraph may start `[SRC_R01]` to fix its source ID |
| `Photo_Captions.txt` | photo annotations | Blank-line separated, one paragraph per photo |
| `WhatsApp_*.zip` | reconstructed chat archive | Needs a UTF-8 `_chat.txt` |
| `*.jpg` `*.jpeg` `*.png` | original photographs | Bytes are stored unchanged |

Anything else is stored with a visible "not a recognised packet input" outcome. It
is never silently parsed or silently dropped.

## Field values we understand

- **Dates.** `1953-04-02`, `1953`, `c. 1953`, `about 1953`, `unknown`, or empty.
  `birth_precision` accepts `exact`/`day`, `year`, `approximate`/`circa`/`about`,
  `unknown`. A bare year is never recorded as exact even if the column says so.
  Empty and `unknown` both stay unresolved; nothing is filled in.
- **Status.** `confirmed`/`accepted`/`verified` become accepted;
  `candidate`/`proposed`/`probable` stay candidates; `disputed`/`conflict` stay
  disputed; `unresolved`/`unknown` stay unresolved. Status is never upgraded.
- **Relationship types.** `parent`, `parent_child`, `father`, `mother`, `child`
  map to parent-to-child, with `from` as the parent. `spouse`/`partner`/`married`
  and `sibling`/`brother`/`sister` are also understood. An unrecognised type is
  kept verbatim and reported.
- **Lists** in `aliases`, `places`, `source_refs` may be separated by `;` `,` or `|`.
- **CSV** is full RFC 4180: quoted commas, doubled quotes and embedded newlines all
  survive. An unterminated quoted field is an error, not a silent truncation.

## Photographs and captions

A caption paragraph is matched to a photo by naming its **exact filename**. Person
identity comes only from person IDs written in the caption, never from the image.

- `order: 3` sets the display order.
- Two or more person IDs plus the words "left to right" records the order.
- Two or more person IDs **without** that phrase leaves positions unknown, and says so.
- A caption naming a photo that was not uploaded is an issue you will see in the report.
- A photo with no caption is reported; identity and order stay unknown.

## Chat archives

Each `WhatsApp_*.zip` needs a UTF-8 `_chat.txt`. Both layouts parse:

```
[12/03/2024, 10:04:11] Mom: message text
12/03/2024, 10:04 - Mom: message text
```

Multi-line messages, system notices without a sender, and `<attached: NAME>` or
`NAME (file attached)` references all work. A referenced attachment that is not in
the archive is reported with its message locator.

Two optional inline directives are read out of message and paragraph text, then
kept out of the printed book:

- `evidence_root: EV_WORKSHOP` ties repeated adaptations of one passage to a single
  root, so copying the same memory into three archives does not read as three
  independent corroborations.
- `original_source: <name>` records the real attribution. **The filename role
  (Mom / Dad / Family) is never treated as authorship.**

Archive limits, enforced and non-negotiable: no absolute paths, `..` traversal,
drive letters, symlinks or executable content; nested archives are listed but never
expanded; encrypted archives and compression methods other than store/deflate are
refused; Zip64 is refused; at most 200 entries, 25 MB per entry, 100 MB expanded
per run, and a 200:1 compression-ratio bound.

Upload policy: **100 MB total, 25 MB per file, 40 files.**

## PDF

`Family_Overview.pdf` goes through real text extraction: indirect objects including
those inside object streams, content-stream decoding, and `/ToUnicode` mapping.
Verified against our own writer and against a CUPS-produced PDF.

If fewer than five words come back, the report says extraction failed and asks for a
sidecar. It will **never** claim the PDF parsed. A sidecar is only accepted when its
text contains the sha256 of the PDF it describes, and the result is then labelled
`prepared_sidecar`, not `pdf_text_layer`. Please put the hash in the sidecar like:

```
sha256: <64 hex characters of Family_Overview.pdf>
```

## What we report rather than repair

Duplicate person IDs, duplicate relationship IDs, relationships pointing at an
unknown person, self-referencing relationships, declared-versus-actual count
mismatches against your manifest, captions naming absent photos, missing chat
attachments, and cited source IDs that no supplied file defines. Every one carries
its exact `file#row:N` or `archive!_chat.txt#msg:N` locator.

Relationship normalization is audited row by row: the report lists which row merged
into which, and which was excluded and why, so the raw-to-normalized difference is
never a bare number.

## What stays unaccepted

Supplied recollections are ingested as **proposed**, not accepted. The live Astra
review decides. That is deliberate, so the key story beat is a real decision on
stage rather than a value that was already true before Submit.

## Current gaps

- The real private packet is not on this machine, so every measurement above comes
  from the fictional twin in `scripts/make-test-packet.mjs`. Point
  `check-packet.mjs` at the real folder and I will confirm against the exact bytes.
- DOCX, OCR, audio and video remain unsupported and are reported as such.
- The twin exercises the merge path with one duplicate row. Your real packet is
  documented as 57 raw rows to 56 normalized; the same audit will list that row.
