/**
 * Branch selection for the book. Layout/selection only: this never changes genealogy.
 */

const PARENT_CHILD = 'parent_child';
const SPOUSE = 'spouse';

/** Only source-backed, non-rejected edges may shape the printed branch. */
function usableEdges(snapshot) {
  return (snapshot.relationships || []).filter((r) => r.status !== 'rejected' && r.status !== 'superseded');
}

/**
 * Ancestors of `focusPersonId` up to `generations` levels, plus their spouses.
 * @returns {{personIds:string[], edges:Array, levels:Map<string,number>, focusPersonId:string}}
 */
export function selectBranch(snapshot, { focusPersonId, generations = 5, includeSpouses = true } = {}) {
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  const edges = usableEdges(snapshot);
  const focus = focusPersonId && people.has(focusPersonId) ? focusPersonId : (snapshot.people || [])[0]?.id;
  if (!focus) return { personIds: [], edges: [], levels: new Map(), focusPersonId: null };

  const parentsOf = new Map();
  const spousesOf = new Map();
  for (const e of edges) {
    if (e.type === PARENT_CHILD) {
      if (!parentsOf.has(e.toPersonId)) parentsOf.set(e.toPersonId, []);
      parentsOf.get(e.toPersonId).push(e.fromPersonId);
    } else if (e.type === SPOUSE) {
      if (!spousesOf.has(e.fromPersonId)) spousesOf.set(e.fromPersonId, []);
      if (!spousesOf.has(e.toPersonId)) spousesOf.set(e.toPersonId, []);
      spousesOf.get(e.fromPersonId).push(e.toPersonId);
      spousesOf.get(e.toPersonId).push(e.fromPersonId);
    }
  }

  const levels = new Map([[focus, 0]]);
  let frontier = [focus];
  for (let depth = 1; depth < generations; depth += 1) {
    const next = [];
    for (const id of frontier) {
      for (const parent of parentsOf.get(id) || []) {
        if (levels.has(parent) || !people.has(parent)) continue;
        levels.set(parent, depth);
        next.push(parent);
      }
    }
    if (!next.length) break;
    frontier = next;
  }

  if (includeSpouses) {
    for (const [id, depth] of [...levels.entries()]) {
      for (const sp of spousesOf.get(id) || []) {
        if (!levels.has(sp) && people.has(sp)) levels.set(sp, depth);
      }
    }
  }

  const personIds = [...levels.keys()];
  const inBranch = new Set(personIds);
  const branchEdges = edges.filter((e) => inBranch.has(e.fromPersonId) && inBranch.has(e.toPersonId));
  return { personIds, edges: branchEdges, levels, focusPersonId: focus };
}

/**
 * Find the deepest ancestor line, used when no focus person is supplied.
 */
export function deepestLineFocus(snapshot) {
  const people = snapshot.people || [];
  let best = null;
  for (const p of people) {
    const b = selectBranch(snapshot, { focusPersonId: p.id, generations: 12, includeSpouses: false });
    const depth = Math.max(0, ...[...b.levels.values()]);
    if (!best || depth > best.depth) best = { id: p.id, depth };
  }
  return best?.id || people[0]?.id || null;
}
