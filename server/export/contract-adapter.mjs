/**
 * Adapter from the lead's published contract (packages/contracts) to this module's
 * renderers, so `DataModules.buildFamilyBundle` can be satisfied with one import.
 *
 * The lead's runtime shapes differ from the internal ones in five places:
 *   relationship.type   parent | partner | sibling      -> parent_child | spouse | sibling
 *   story.personId / story.attribution                  -> subjectId / attributedTo
 *   person.lifeYears    {birth,death} with no label     -> label and numeric year derived
 *   claim.value         string                          -> passed through unchanged
 *   passage.sourceLocators  SourceSpan[]                -> display strings, quotes kept
 * plus an async `resolveAsset(assetId) => Promise<Uint8Array>` instead of a sync lookup.
 *
 * Nothing here rewrites a lead-owned module; it only translates at the boundary.
 */

import { buildFamilyBundle } from './index.mjs';
import { lifeYearsLabel } from '../contracts/types.mjs';

const REL_TYPE_IN = { parent: 'parent_child', partner: 'spouse', sibling: 'sibling' };
const PRECISION_IN = { day: 'exact', month: 'approximate', year: 'year_only', approximate: 'approximate', unknown: 'unknown' };

function toDatePart(d) {
  if (!d) return { value: null, year: null, precision: 'unknown' };
  if (typeof d === 'string') {
    const y = /^(\d{4})/.exec(d);
    return { value: d, year: y ? Number(y[1]) : null, precision: /^\d{4}-\d{2}-\d{2}$/.test(d) ? 'exact' : 'year_only' };
  }
  if (d.year != null && d.precision && d.label !== undefined) return d;  // already internal
  const value = d.value ?? null;
  const y = value ? /(\d{4})/.exec(String(value)) : null;
  return {
    value,
    year: d.year != null ? d.year : y ? Number(y[1]) : null,
    precision: PRECISION_IN[d.precision] || d.precision || 'unknown',
    originalConfidence: d.precision,
  };
}

function adaptPerson(p) {
  const birth = toDatePart(p.lifeYears?.birth);
  const death = toDatePart(p.lifeYears?.death);
  return {
    ...p,
    lifeYears: { birth, death, label: p.lifeYears?.label || lifeYearsLabel(birth, death) },
    claimIds: p.claimIds || [],
    photoIds: p.photoIds || [],
    storyIds: p.storyIds || [],
  };
}

/** SourceSpan[] or string[] -> readable locator strings, keeping the quote when present. */
export function flattenLocators(locators) {
  return (locators || []).map((l) => {
    if (typeof l === 'string') return l;
    if (!l) return '';
    const quote = l.quote ? ` "${String(l.quote).slice(0, 160)}"` : '';
    return `${l.locator || l.sourceId || ''}${quote}`.trim();
  }).filter(Boolean);
}

/** Normalize a contract ProjectSnapshot into the shape the renderers expect. */
export function adaptSnapshot(snapshot) {
  const s = snapshot || {};
  const layout = s.layout && s.layout.positions
    ? s.layout
    : { positions: normalizePositions(s.layout), generations: {}, note: 'Layout is display metadata.' };

  return {
    ...s,
    people: (s.people || []).map(adaptPerson),
    relationships: (s.relationships || []).map((r) => ({
      ...r,
      type: REL_TYPE_IN[r.type] || r.type,
      claimIds: r.claimIds || [],
    })),
    stories: (s.stories || []).map((st) => ({
      ...st,
      subjectId: st.subjectId || st.personId,
      attributedTo: st.attributedTo !== undefined ? st.attributedTo : (st.attribution || null),
    })),
    claims: (s.claims || []).map((c) => ({ ...c, sourceIds: c.sourceIds || [] })),
    sources: (s.sources || []).map((src) => ({
      ...src,
      originalLocator: src.originalLocator || src.url || src.id,
    })),
    assets: s.assets || [],
    // The contract carries issues as strings; the renderers want {message, severity}.
    issues: (s.issues || []).map((i) => (typeof i === 'string'
      ? { code: 'import_issue', message: i, severity: 'warning' }
      : i)),
    layout,
  };
}

function normalizePositions(layout) {
  const out = {};
  for (const [id, pos] of Object.entries(layout || {})) {
    if (pos && typeof pos === 'object') out[id] = { x: pos.x ?? 0, y: pos.y ?? 0, generation: pos.generation ?? 0 };
  }
  return out;
}

export function adaptPassages(passages) {
  return (passages || []).map((p) => ({
    ...p,
    sourceLocators: flattenLocators(p.sourceLocators),
    personId: p.personId || undefined,
  }));
}

/**
 * Satisfies `DataModules.buildFamilyBundle(input): Promise<BundleResult>`.
 *
 * Usage in server/agent/data-modules.ts:
 *   import { buildFamilyBundleFromContract } from "../export/contract-adapter.mjs";
 *   // ...
 *   buildFamilyBundle: (input) => buildFamilyBundleFromContract(input, { title, dedication }),
 *
 * @param {{snapshot: object, passages: Array, resolveAsset: (id: string) => Promise<Uint8Array>}} input
 * @param {object} [options] focusPersonId, branchRootId, title, dedication, projectName, includeAssets
 * @returns {Promise<{bytes: Uint8Array, filename: string, mimeType: string, manifest: object}>}
 */
export async function buildFamilyBundleFromContract(input, options = {}) {
  const { snapshot, passages = [], resolveAsset } = input || {};
  if (!snapshot) throw new TypeError('buildFamilyBundleFromContract requires input.snapshot');
  if (typeof resolveAsset !== 'function') throw new TypeError('buildFamilyBundleFromContract requires input.resolveAsset');

  const adapted = adaptSnapshot(snapshot);

  // The contract resolver is async and returns bytes only, so pre-resolve once and
  // carry the media type from the snapshot metadata. A failure is recorded as a
  // missing attachment rather than aborting the whole download.
  const resolved = new Map();
  await Promise.all((adapted.assets || []).map(async (asset) => {
    try {
      const bytes = await resolveAsset(asset.id);
      if (bytes && bytes.length) {
        resolved.set(asset.id, {
          bytes: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
          mediaType: asset.mediaType,
          originalName: asset.originalName,
        });
      }
    } catch {
      // left unresolved on purpose; buildFamilyBundle reports it in missingAssets
    }
  }));

  const out = await buildFamilyBundle({
    snapshot: adapted,
    passages: adaptPassages(passages),
    resolveAsset: (assetId) => resolved.get(assetId) || null,
    options,
  });
  return { bytes: out.bytes, filename: out.filename, mimeType: out.mimeType, manifest: out.manifest };
}
