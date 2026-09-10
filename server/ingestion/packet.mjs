import { ingestContribution } from './index.mjs';
import { parseCsv } from './csv.mjs';
import { sha256 } from './hash.mjs';

const sourceName = (name) => ({ 'family_register.csv': 'family-register', 'family_relationships.csv': 'family-relationships', 'family_recollections.txt': 'family-recollections', 'photo_captions.txt': 'photo-captions', 'family_overview.pdf': 'family-overview' })[name.toLowerCase()];
const split = (v) => String(v || '').split(/[;|]/).map((x) => x.trim()).filter(Boolean);
const value = (row, ...keys) => keys.map((key) => row[key]).find((x) => x !== undefined && x !== '') || '';
const status = (s) => ({ reported: 'accepted', confirmed: 'accepted', accepted: 'accepted', candidate: 'proposed', probable: 'proposed', proposed: 'proposed', disputed: 'disputed', unresolved: 'unresolved', unknown: 'unresolved' })[String(s).toLowerCase()] || 'unresolved';
function date(raw, precision) {
  if (!raw || /^(unknown|null|not known)$/i.test(raw)) return { value: null, precision: 'unknown' };
  const p = ({ exact: 'day', year_only: 'year', year: 'year', day: 'day', month: 'month', approximate: 'approximate', unknown: 'unknown', unresolved: 'unknown' })[precision];
  return { value: String(raw), precision: p || (/^\d{4}$/.test(raw) ? 'year' : /^\d{4}-\d{2}-\d{2}$/.test(raw) ? 'day' : 'approximate') };
}
/** Ordinary files reconstruct a source-cited graph. No manifest or hidden seed supplies facts. */
export async function parseFamilyPacket({ files = [] } = {}) {
  if (files.length > 40 || files.reduce((n, f) => n + f.bytes.length, 0) > 100_000_000 || files.some((f) => f.bytes.length > 25_000_000)) throw new Error('Upload limit: 40 files, 25 MB per file, 100 MB total');
  const raw = await ingestContribution({ files }), issues = [], warnings = [];
  const idChanges = new Map();
  for (const s of raw.sources) { const fixed = sourceName(s.title || ''); if (fixed) { idChanges.set(s.id, fixed); s.id = fixed; } }
  const sources = raw.sources.map((s) => ({ ...s, language: 'en', evidenceRootId: s.evidenceRootId || s.contentHash }));
  const assets = [], assetBytes = [];
  for (const a of raw.assets) {
    const sourceId = idChanges.get(a.sourceId) || a.sourceId || `source-${a.id}`;
    if (!sources.some((s) => s.id === sourceId)) sources.push({ id: sourceId, kind: 'stored_file', originalLocator: a.originalName, contentHash: a.contentHash, originalText: '', origin: 'live', author: null, messageTimestamp: null, parentAttachmentId: null, title: a.originalName, language: 'en', evidenceRootId: a.contentHash });
    assets.push({ ...a, sourceId, storageKey: `assets/${a.id}` }); assetBytes.push({ assetId: a.id, bytes: a.bytes });
  }
  for (const s of sources) if (s.bytes) {
    const id = `original-${s.id}`, originalName = s.kind?.includes('chat') ? `${s.id}.txt` : s.title;
    assets.push({ id, sourceId: s.id, originalName, mediaType: s.mediaType || 'text/plain', byteLength: s.bytes.length, contentHash: sha256(s.bytes), storageKey: `assets/${id}` }); assetBytes.push({ assetId: id, bytes: s.bytes });
  }
  const outcomes = raw.files.map((f) => ({ ...f, sourceIds: f.sourceIds.map((id) => idChanges.get(id) || id), warnings: [...f.warnings, ...(f.reason ? [f.reason] : [])] }));
  const find = (id) => sources.find((s) => s.id === id);
  const register = find('family-register'), links = find('family-relationships');
  if (!register || !links) throw new Error('Supply Family_Register.csv and Family_Relationships.csv to reconstruct the family');
  for (const f of outcomes) if (f.status === 'failed') issues.push(`${f.originalName}: ${f.reason}`);
  const people = [], relationships = [], claims = [], stories = [], relationshipReconciliation = [];
  const ids = new Set();
  const span = (source, row) => ({ sourceId: source.id, locator: source.originalLocator, quote: row.raw, start: row.start, end: row.end });
  for (const row of parseCsv(register.originalText)) {
    const r = row.values, id = value(r, 'person_id', 'id'), name = value(r, 'full_name', 'display_name_en', 'name');
    if (!id || !name || ids.has(id)) throw new Error(`Missing/duplicate person ID or name at register line ${row.startLine}`);
    ids.add(id); const claimId = `import-person-${id}`;
    const birth = date(value(r, 'birth', 'birth_date'), value(r, 'birth_precision')), death = date(value(r, 'death', 'death_date'), value(r, 'death_precision'));
    const notes = value(r, 'notes'), places = value(r, 'places', 'birth_place');
    const summary = `${name}. ${birth.value ? `Birth: ${birth.precision === 'approximate' ? 'approximately ' : ''}${birth.value}. ` : ''}${death.value ? `Death: ${death.precision === 'approximate' ? 'approximately ' : ''}${death.value}. ` : ''}${places ? `Places: ${places}. ` : ''}${notes}`.trim();
    const support = [span(register, row)];
    people.push({ id, displayNameEn: name, originalName: name, lifeYears: { birth, death }, photoIds: [], claimIds: [claimId], storyIds: [], aliases: split(r.aliases), recordStatus: r.status || 'unknown', importedSourceRefs: split(r.source_refs) });
    claims.push({ id: claimId, subjectId: id, predicate: 'supplied_family_record', value: summary, sourceIds: [register.id], spans: support, status: status(r.status), evidenceType: 'family_document', version: 1 });
  }
  const relIds = new Set(), relKeys = new Map(), parentEdges = new Map();
  for (const row of parseCsv(links.originalText)) {
    const r = row.values, id = value(r, 'relationship_id', 'id'), from = value(r, 'from_person_id', 'frompersonid', 'from'), to = value(r, 'to_person_id', 'topersonid', 'to');
    const type = ({ parent_child: 'parent', parent: 'parent', spouse: 'partner', partner: 'partner', sibling: 'sibling' })[r.type];
    if (!id || relIds.has(id)) throw new Error(`Missing/duplicate relationship ID at line ${row.startLine}`);
    relIds.add(id);
    if (!ids.has(from) || !ids.has(to) || from === to || !type) throw new Error(`Invalid relationship ${id}: missing endpoint, self-link or unsupported type`);
    const key = type === 'parent' ? `${type}|${from}|${to}` : `${type}|${[from, to].sort().join('|')}`;
    if (relKeys.has(key)) { relationshipReconciliation.push({ id, action: 'merged_duplicate', retainedId: relKeys.get(key), locator: span(links, row).locator }); continue; }
    relKeys.set(key, id);
    if (type === 'parent') { const seen = new Set(), visit = (p) => { if (p === from) return true; if (seen.has(p)) return false; seen.add(p); return [...(parentEdges.get(p) || [])].some(visit); }; if (visit(to)) throw new Error(`Relationship ${id} creates a parent cycle`); if (!parentEdges.has(from)) parentEdges.set(from, new Set()); parentEdges.get(from).add(to); }
    const claimId = `import-relationship-${id}`;
    claims.push({ id: claimId, subjectId: from, predicate: `relationship_${type === 'parent' ? 'parent_child' : type === 'partner' ? 'spouse' : type}`, value: JSON.stringify({ from, to }), sourceIds: [links.id], spans: [span(links, row)], status: status(r.status), evidenceType: 'family_document', version: 1 });
    relationships.push({ id, fromPersonId: from, toPersonId: to, type, claimIds: [claimId], status: status(r.status) });
    relationshipReconciliation.push({ id, action: 'retained', locator: span(links, row).locator });
  }
  let photoAnnotations = [];
  const captionSource = find('photo-captions');
  if (captionSource) {
    try { photoAnnotations = JSON.parse(captionSource.originalText); if (!Array.isArray(photoAnnotations)) throw new Error('Expected JSON array'); }
    catch (e) { throw new Error(`Photo_Captions.txt must contain the agreed JSON annotation array: ${e.message}`); }
    for (const annotation of photoAnnotations) {
      const asset = assets.find((a) => a.originalName === annotation.file);
      if (!asset) throw new Error(`Photo caption file is missing: ${annotation.file}`);
      if (annotation.sha256 && annotation.sha256 !== asset.contentHash) throw new Error(`Photo caption hash mismatch: ${annotation.file}`);
      const previousId = asset.id, newId = annotation.assetId || previousId;
      if (assets.some((a) => a !== asset && a.id === newId)) throw new Error(`Duplicate annotated asset ID: ${newId}`);
      asset.id = newId; asset.storageKey = `assets/${newId}`;
      assetBytes.find((a) => a.assetId === previousId).assetId = newId;
      for (const outcome of outcomes) outcome.assetIds = outcome.assetIds.map((id) => id === previousId ? newId : id);
      annotation.assetId = newId; asset.caption = annotation.caption;
      for (const pos of annotation.positions || []) {
        if (pos.personId && !ids.has(pos.personId)) throw new Error(`Unknown photo person: ${pos.personId}`);
        if (!Number.isInteger(pos.position) || pos.position < 1) throw new Error('Photo positions must be positive integers');
        // Supplied annotations remain separate; the lead saves the explicit photo review.
      }
    }
  }
  for (const s of sources) delete s.bytes;
  for (const a of assets) delete a.bytes;
  for (const outcome of outcomes) {
    const matching = assets.filter((a) => a.originalName === outcome.originalName || outcome.sourceIds.includes(a.sourceId));
    outcome.assetIds = [...new Set([...outcome.assetIds, ...matching.map((a) => a.id)])];
    outcome.sourceIds = [...new Set([...outcome.sourceIds, ...matching.map((a) => a.sourceId)])];
  }
  return { schemaVersion: 'roots-v1', people, relationships, claims, stories, sources, assets, assetBytes, files: outcomes, issues, warnings, history: [], layout: {}, photoAnnotations, relationshipReconciliation, counts: { people: people.length, relationships: relationships.length, sources: sources.length, assets: assets.length } };
}
