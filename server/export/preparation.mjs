/**
 * Version-safe book preparation keys.
 *
 * The lead may prepare a bundle before Mike clicks Download. The key below binds
 * the prepared artifact to the exact state that produced it: project version,
 * book status, language, packet version and every included asset hash. Any
 * correction changes the key, which invalidates the prepared output, so Download
 * can never serve an older book while a current one is pending.
 */

import { createHash } from 'node:crypto';

/**
 * @param {object} args
 * @param {object} args.snapshot
 * @param {Array} [args.passages]
 * @param {object} [args.options] language, packetVersion, includeAssets, focus ids
 * @returns {{key: string, parts: object}}
 */
export function preparationKey({ snapshot, passages = [], options = {} } = {}) {
  const parts = {
    schemaVersion: snapshot?.schemaVersion ?? null,
    projectId: snapshot?.projectId ?? null,
    version: snapshot?.version ?? null,
    bookStatus: snapshot?.bookStatus ?? null,
    language: options.language || 'en',
    packetVersion: options.packetVersion || snapshot?.packetVersion || null,
    includeAssets: options.includeAssets || 'branch',
    focusPersonId: options.focusPersonId || snapshot?.focusPersonId || null,
    branchRootId: options.branchRootId || null,
    // Passage identity AND the state each was written against.
    passages: passages.map((p) => `${p.id}:${p.acceptedStateVersion}:${hashText(p.text)}`).sort(),
    // Accepted graph content, so an accepted or corrected claim moves the key.
    claims: (snapshot?.claims || []).filter((c) => c.status === 'accepted').map((c) => `${c.id}:${c.version ?? 1}`).sort(),
    stories: (snapshot?.stories || []).filter((s) => s.status === 'accepted').map((s) => `${s.id}:${hashText(s.text)}`).sort(),
    people: (snapshot?.people || []).map((p) => p.id).sort(),
    relationships: (snapshot?.relationships || []).map((r) => `${r.id}:${r.status}`).sort(),
    assets: (snapshot?.assets || []).map((a) => `${a.id}:${a.contentHash || a.byteLength}`).sort(),
  };
  const key = createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  return { key, parts };
}

function hashText(text) {
  return createHash('sha256').update(String(text ?? '')).digest('hex').slice(0, 16);
}

/**
 * Is a prepared artifact still valid for the current state?
 * @returns {{valid: boolean, reason?: string, currentKey: string}}
 */
export function isPreparedStillCurrent({ prepared, snapshot, passages, options }) {
  const { key } = preparationKey({ snapshot, passages, options });
  if (!prepared || !prepared.key) return { valid: false, reason: 'No prepared artifact.', currentKey: key };
  if (prepared.key !== key) {
    return { valid: false, reason: 'The family or the book changed after this bundle was prepared. Regenerate before serving it.', currentKey: key };
  }
  return { valid: true, currentKey: key };
}

/** Small helper the lead can use as a cache. Prepared entries are never mutated. */
export class PreparedBundleCache {
  constructor(limit = 4) { this.limit = limit; this.map = new Map(); }
  put(key, value) {
    this.map.set(key, { key, value, at: Date.now() });
    while (this.map.size > this.limit) this.map.delete(this.map.keys().next().value);
  }
  get(key) { return this.map.get(key) || null; }
  invalidateAllExcept(key) {
    for (const k of [...this.map.keys()]) if (k !== key) this.map.delete(k);
  }
  clear() { this.map.clear(); }
}
