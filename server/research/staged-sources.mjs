import { sha256 } from '../ingestion/hash.mjs';
import { decodeUtf8 } from '../ingestion/parse-text.mjs';

/** Bind a schedule to parsed evidence without introducing people or running timers. */
export function prepareManifestBatches({ manifest, packet }) {
  const people = new Map(packet.people.map((p) => [p.id, p])), relationships = new Map(packet.relationships.map((r) => [r.id, r]));
  const selected = new Set(manifest.selectedPersonIds);
  if (selected.size !== people.size || [...people.keys()].some((id) => !selected.has(id))) throw new Error('Manifest roster does not match the supplied family register');
  if (manifest.expectedRelationshipCount !== relationships.size) throw new Error('Manifest relationship count does not match the reconciled register');
  const available = new Set(), used = new Set(), completed = new Set();
  const initial = { id: 'initial', personIds: manifest.initialBranchIds, relationshipIds: [], dependencyIds: [], releaseOffsetSeconds: manifest.initialReleaseOffsetSeconds };
  const batches = [initial, ...manifest.batches].map((batch) => {
    for (const dep of batch.dependencyIds) if (!completed.has(dep)) throw new Error(`Batch ${batch.id} has an unavailable dependency`);
    for (const id of batch.personIds) { if (!people.has(id) || used.has(id)) throw new Error(`Batch ${batch.id} has an absent or duplicate person`); available.add(id); used.add(id); }
    const included = batch.id === 'initial' ? [...relationships.values()].filter((r) => available.has(r.fromPersonId) && available.has(r.toPersonId)).map((r) => r.id) : batch.relationshipIds;
    for (const id of included) { const r = relationships.get(id); if (!r || !available.has(r.fromPersonId) || !available.has(r.toPersonId)) throw new Error(`Batch ${batch.id} relationship ${id} has unavailable endpoints`); }
    completed.add(batch.id);
    return { ...batch, relationshipIds: included, people: batch.personIds.map((id) => people.get(id)), relationships: included.map((id) => relationships.get(id)), origin: 'prepared', operation: 'adding_supplied_evidence' };
  });
  if (used.size !== people.size) throw new Error('Batch schedule omits supplied people');
  return batches;
}

/** Read an explicitly supplied saved-source job, with a caller-owned byte resolver. */
export async function readSavedSourceJob({ job, existingSources, readFile }) {
  if (typeof readFile !== 'function') throw new Error('Saved-source jobs require a private file resolver');
  if (!['saved_folder', 'saved_correspondence'].includes(job.kind)) throw new Error('Unsupported saved-source job');
  if (!job.filePaths.length) return { status: 'empty', sources: [], newEvidenceRoots: 0, note: 'No saved files were supplied.' };
  const existingRoots = new Set(existingSources.map((s) => s.evidenceRootId || s.contentHash));
  if (job.evidenceRootIds.some((root) => !existingRoots.has(root))) throw new Error('Saved source adds an evidence root absent from the initial packet');
  const sources = [];
  for (let i = 0; i < job.filePaths.length; i++) {
    const path = job.filePaths[i];
    if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some((p) => p === '..' || p === '.') || !/\.(txt|md|csv)$/i.test(path)) throw new Error('Saved evidence requires safe relative English text paths');
    const bytes = Buffer.from(await readFile(path));
    if (bytes.length > 2_000_000) throw new Error('Saved source exceeds 2 MB text bound');
    const originalText = decodeUtf8(bytes);
    if (/[\u0400-\u04ff]/.test(originalText)) throw new Error('Saved demo evidence requires the supplied English derivative');
    sources.push({ id: `saved-${job.id}-${i + 1}`, kind: job.kind, originalLocator: path, contentHash: sha256(bytes), originalText, origin: 'prepared', author: null, messageTimestamp: null, parentAttachmentId: null, title: path.split('/').at(-1), language: 'en', extractionMethod: 'Read supplied local saved copy; no live Drive or email connection', evidenceRootId: job.evidenceRootIds[i] || job.evidenceRootIds[0] });
  }
  return { status: 'ok', sources, newEvidenceRoots: 0, note: 'Added saved copies of evidence already supplied at Start.' };
}
