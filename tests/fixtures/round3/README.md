# Round-3 fictional twin

Six invented people, seven relationships, eight invented photographs (four of them made to
look old), four aligned enhanced derivatives, three chat archives, an archive-findings note,
a chronology CSV and an eleven-chapter English book excerpt. Every name, place, date and
memory here is invented, and the generator reads no private source.

The twin exists so the round-3 rules stay covered in public: six initial checks with three
distinct photographs, a passing aligned pair for every declared old photograph, portraits
backed by a real span, chapter and question spans that resolve to actual source text, and a
book edition and export bundle that account for every input file.

From the repository root:

```sh
python3 tests/fixtures/round3/build_fixture.py
node --import tsx tests/fixtures/round3/build_manifest.mjs
node --import tsx scripts/check-packet.mjs tests/fixtures/round3/packet/01-upload \
  --manifest tests/fixtures/round3/packet/DEMO_MANIFEST.json \
  --media tests/fixtures/round3/packet/02-media/enhanced
```

Generation needs Pillow, NumPy and SciPy. The enhanced derivatives use the same
luminance-only pass as the real packet, so their dimensions match their originals exactly and
no registration step is involved. `tests/data-export/round3-fixture.test.mjs` runs the checks
as part of the suite.

This twin is smaller than the private packet on purpose. It has less material than a 35-page
edition needs, and the renderer is expected to report that as a short edition rather than pad
it. It does not prove a browser rehearsal, a live model call or the private packet's own
media and book QA.
