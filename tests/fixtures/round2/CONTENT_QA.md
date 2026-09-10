# Fictional fixture QA

Checked 2026-09-10 at 18:31 UTC. Fixture status: content-ready for engineering tests. It does not establish integrated demo readiness.

Frozen version: `fictional-v2.3`.
Manifest SHA-256: `b462765eff849b291f388ad5ddd0fb6509970a063e655dee59e10198f3902366`.

- The normal selection contains 14 files, 178,722 bytes: eight documents/archives and six generated illustrations. No JSON seed or presenter answer file is selected.
- The production parser reads 35 unique people and 56 relationships, with no issues or warnings. Substituting the 57-row raw audit produces the same 56 relationships and records `FR046` as a duplicate of `FR039`.
- All seven question supports and all photo supports pass `ProjectSnapshotSchema`, `validateSnapshot` and exact `validateSpans` checks against a fresh parse. Canonical locators come from the production parser. Narrative section IDs remain in the presenter map.
- Each manifest file hash and byte length matches. Each photo matches its parsed asset bytes. The two optional saved-copy files are separately inventoried and retain their original fictional evidence roots.
- The source-backed five-person initial branch and six batches cover every person exactly once and all 56 links. Each link's endpoints are available at release. Six arrivals span 45 seconds at 44, 53, 62, 71, 80 and 89 seconds.
- The three actual ZIPs extract through the production parser. Each contains `_chat.txt` and `metadata.json`, three undated reconstructed messages, explicit origin and per-message source details. ZIP integrity checks pass.
- The recollection starts unaccepted and is present canonically in the Family chat. It is absent from the overview. Matching names remain distinct; approximate dates, unknown group positions, the proposed label, unresolved birth year and candidate links survive parsing.
- The 319-word PDF has one page. The rendered page was inspected for clipping and readability. Every generated illustration was visually inspected; each explicitly says no real person is pictured.
- All reachable fixture source text, expanded ZIP text and PDF extraction is English. A public-boundary scan found no real-family names, account names, private source paths or real-source hashes in the deliverable.
- `node --import tsx tests/fixtures/round2/validate.mjs` passes.
- `node --import tsx --test integration-tests/round2.test.ts` passes all three tests, including fresh `startRound2`, seven explicit answers, gradual saved state, resume/cancel behavior and sealed export. The model responses in these tests are stubs, not live Astra evidence.

The private family packet and two actual browser rehearsals remain separate required checks. Do not use this fixture report as proof that those checks have passed.
