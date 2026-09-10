import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareManifestBatches, readSavedSourceJob, searchLocalSources } from '../../server/research/index.mjs';

test('manifest staged batches require complete unique people and available endpoints', () => {
  const packet = { people: [{ id: 'P1' }, { id: 'P2' }], relationships: [{ id: 'R1', fromPersonId: 'P1', toPersonId: 'P2' }] };
  const manifest = { selectedPersonIds: ['P1','P2'], expectedRelationshipCount: 1, initialBranchIds: ['P1'], initialReleaseOffsetSeconds: 35, batches: [{ id: 'batch-1', personIds: ['P2'], relationshipIds: ['R1'], dependencyIds: ['initial'], releaseOffsetSeconds: 44 }] };
  assert.equal(prepareManifestBatches({ manifest, packet })[1].people[0].id, 'P2');
  assert.throws(() => prepareManifestBatches({ manifest: { ...manifest, initialBranchIds: ['P2'], batches: manifest.batches }, packet }), /duplicate/);
});
test('saved source copies perform actual reads and never count as new independent evidence', async () => {
  const existingSources = [{ id: 'original', evidenceRootId: 'root-a' }]; let reads = 0;
  const input = { job: { id: 'job-1', kind: 'saved_folder', filePaths: ['folder/english.txt'], evidenceRootIds: ['root-a'] }, existingSources, readFile: async () => { reads++; return Buffer.from('Actual saved English evidence.'); } };
  const result = await readSavedSourceJob(input);
  assert.equal(reads, 1); assert.equal(result.newEvidenceRoots, 0); assert.equal(result.sources[0].origin, 'prepared');
  await assert.rejects(readSavedSourceJob({ ...input, job: { ...input.job, evidenceRootIds: ['new-hidden-root'] } }), /absent from the initial/);
  assert.equal(reads, 1);
});
test('three repeated sources retain one independent evidence root in local search', async () => {
  const sources = ['a','b','c'].map(id => ({ id, originalText: 'The same supplied boat story.', originalLocator: id, evidenceRootId: 'same-memoir' }));
  const r = await searchLocalSources({ query: 'boat', sources }); assert.equal(r.totalMatches, 3); assert.equal(r.independentEvidenceRoots, 1);
});
