/**
 * Dependency-safe staged release planning.
 *
 * The lead owns the clock. This module owns WHAT is in each batch and proves the
 * order is safe: a person is never released before someone they connect to, so
 * the map never shows a floating card or an edge with a missing endpoint.
 *
 * There are no timers here and no hardcoded family values. Offsets come from the
 * manifest; people, links and evidence come from the ingested packet.
 */

const PARENT_CHILD = 'parent_child';

/** Nominal offsets from the narrative contract, overridable by the manifest. */
export const DEFAULT_RELEASE_OFFSETS = Object.freeze([44, 53, 62, 71, 80, 89]);

function edgesOf(snapshot) {
  return (snapshot.relationships || []).filter((r) => r.status !== 'rejected' && r.status !== 'superseded');
}

/**
 * Choose the initial coherent branch: the focus person plus the shortest ancestor
 * line that reaches `size` people, so the first map reads as one family, not a scatter.
 */
export function planInitialBranch(snapshot, { focusPersonId, size = 5 } = {}) {
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  const edges = edgesOf(snapshot);
  const parentsOf = new Map();
  for (const e of edges) {
    if (e.type !== PARENT_CHILD) continue;
    if (!parentsOf.has(e.toPersonId)) parentsOf.set(e.toPersonId, []);
    parentsOf.get(e.toPersonId).push(e.fromPersonId);
  }
  const start = focusPersonId && people.has(focusPersonId)
    ? focusPersonId
    : [...people.keys()].find((id) => (parentsOf.get(id) || []).length) || [...people.keys()][0];
  if (!start) return { personIds: [], focusPersonId: null };

  const chosen = [start];
  const seen = new Set(chosen);
  let frontier = [start];
  while (chosen.length < size && frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const parent of parentsOf.get(id) || []) {
        if (seen.has(parent) || !people.has(parent)) continue;
        seen.add(parent); chosen.push(parent); next.push(parent);
        if (chosen.length >= size) break;
      }
      if (chosen.length >= size) break;
    }
    if (!next.length) break;
    frontier = next;
  }
  return { personIds: chosen.slice(0, size), focusPersonId: start };
}

/**
 * Split the remaining roster into dependency-safe batches.
 *
 * @param {object} args
 * @param {object} args.snapshot          ingested packet
 * @param {string[]} args.releasedIds     already visible (the initial branch)
 * @param {number[]} [args.offsets]       release offsets in seconds, from the manifest
 * @param {object} [args.manifest]        optional explicit batches to honour
 * @returns {{batches: Array, warnings: string[], unreachable: string[]}}
 */
export function planStagedBatches({ snapshot, releasedIds = [], offsets = DEFAULT_RELEASE_OFFSETS, manifest = null } = {}) {
  const warnings = [];
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  const edges = edgesOf(snapshot);

  const neighbours = new Map([...people.keys()].map((id) => [id, new Set()]));
  for (const e of edges) {
    if (!neighbours.has(e.fromPersonId) || !neighbours.has(e.toPersonId)) continue;
    neighbours.get(e.fromPersonId).add(e.toPersonId);
    neighbours.get(e.toPersonId).add(e.fromPersonId);
  }

  const released = new Set(releasedIds.filter((id) => people.has(id)));
  const remaining = [...people.keys()].filter((id) => !released.has(id));

  // An explicit manifest plan is honoured, then verified rather than trusted.
  if (manifest && Array.isArray(manifest.batches) && manifest.batches.length) {
    const batches = manifest.batches.map((b, i) => ({
      index: i + 1,
      offsetSeconds: b.offsetSeconds ?? offsets[i] ?? null,
      personIds: (b.personIds || []).filter((id) => people.has(id)),
      declaredPersonIds: b.personIds || [],
      source: 'manifest',
    }));
    const check = validateBatchPlan({ snapshot, releasedIds: [...released], batches });
    warnings.push(...check.problems);
    for (const b of batches) b.evidence = evidenceFor(snapshot, b.personIds);
    return { batches, warnings, unreachable: check.unreachable };
  }

  // Otherwise grow outward from what is already visible, so every new card
  // attaches to something on screen.
  const count = offsets.length;
  const perBatch = Math.ceil(remaining.length / count);
  const batches = [];
  const pending = new Set(remaining);

  for (let i = 0; i < count; i += 1) {
    const picks = [];
    const target = i === count - 1 ? pending.size : Math.min(perBatch, pending.size);
    // Prefer people connected to something already released.
    while (picks.length < target) {
      let pick = null;
      for (const id of pending) {
        const linked = [...(neighbours.get(id) || [])].some((n) => released.has(n) || picks.includes(n));
        if (linked) { pick = id; break; }
      }
      if (!pick) {
        // Nothing attaches yet; take the best-connected remaining person and say so.
        pick = [...pending].sort((a, b) => (neighbours.get(b)?.size || 0) - (neighbours.get(a)?.size || 0))[0];
        if (!pick) break;
        warnings.push(`${pick} was released without a link to an already visible person; the map will show it unattached until a later batch.`);
      }
      pending.delete(pick);
      picks.push(pick);
      released.add(pick);
    }
    batches.push({
      index: i + 1,
      offsetSeconds: offsets[i] ?? null,
      personIds: picks,
      cumulativeTotal: released.size,
      evidence: evidenceFor(snapshot, picks),
      source: 'derived',
    });
  }

  if (pending.size) warnings.push(`${pending.size} person(s) did not fit the batch plan: ${[...pending].join(', ')}.`);
  return { batches, warnings, unreachable: [...pending] };
}

/** Real source and photo evidence that arrives with a batch. Never invented. */
function evidenceFor(snapshot, personIds) {
  const ids = new Set(personIds);
  const sourceIds = new Set();
  const photoIds = [];
  const storyIds = [];
  for (const c of snapshot.claims || []) {
    if (ids.has(c.subjectId)) for (const s of c.sourceIds || []) sourceIds.add(s);
  }
  for (const s of snapshot.stories || []) if (ids.has(s.subjectId)) storyIds.push(s.id);
  for (const a of snapshot.assets || []) {
    if ((a.personIds || []).some((p) => ids.has(p))) photoIds.push(a.id);
  }
  return { sourceIds: [...sourceIds], photoIds, storyIds };
}

/**
 * Prove a plan is safe before it is used.
 * @returns {{ok: boolean, problems: string[], unreachable: string[]}}
 */
export function validateBatchPlan({ snapshot, releasedIds = [], batches = [] }) {
  const problems = [];
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  const edges = edgesOf(snapshot);
  const neighbours = new Map([...people.keys()].map((id) => [id, new Set()]));
  for (const e of edges) {
    if (!neighbours.has(e.fromPersonId) || !neighbours.has(e.toPersonId)) continue;
    neighbours.get(e.fromPersonId).add(e.toPersonId);
    neighbours.get(e.toPersonId).add(e.fromPersonId);
  }

  const visible = new Set(releasedIds);
  const seenSomewhere = new Set(releasedIds);
  let lastOffset = -Infinity;

  for (const batch of batches) {
    if (batch.offsetSeconds != null) {
      if (batch.offsetSeconds <= lastOffset) problems.push(`Batch ${batch.index} offset ${batch.offsetSeconds}s is not after the previous batch.`);
      lastOffset = batch.offsetSeconds;
    }
    for (const id of batch.personIds) {
      if (!people.has(id)) { problems.push(`Batch ${batch.index} releases unknown person ${id}.`); continue; }
      if (seenSomewhere.has(id)) problems.push(`Person ${id} is released more than once (batch ${batch.index}).`);
      seenSomewhere.add(id);
    }
    for (const id of batch.personIds) {
      const linked = [...(neighbours.get(id) || [])].some((n) => visible.has(n) || batch.personIds.includes(n));
      if (!linked && (neighbours.get(id) || []).size) {
        problems.push(`Batch ${batch.index} releases ${id} before any of its relatives are visible.`);
      }
    }
    for (const id of batch.personIds) visible.add(id);
  }

  const unreachable = [...people.keys()].filter((id) => !seenSomewhere.has(id));
  return { ok: problems.length === 0, problems, unreachable };
}

/**
 * Background copies may add visible evidence but must never introduce a person or
 * an essential fact that the initial upload set did not already support.
 */
export function checkBackgroundArrival({ snapshot, arrival }) {
  const known = new Set((snapshot.people || []).map((p) => p.id));
  const knownRoots = new Set((snapshot.sources || []).map((s) => s.evidenceRootId || s.id));
  const rejected = [];
  const accepted = [];
  for (const item of arrival?.items || []) {
    if (item.personId && !known.has(item.personId)) {
      rejected.push({ item, reason: `Introduces person ${item.personId}, who is absent from the initial packet.` });
      continue;
    }
    accepted.push({
      ...item,
      countsAsNewSource: !knownRoots.has(item.evidenceRootId),
      // A saved copy is not an online discovery, whatever its folder is called.
      isOnlineDiscovery: false,
      origin: 'prepared',
    });
  }
  return { accepted, rejected };
}
