/** Bounded ordinary-prose intake. All facts come from supplied headings/sentences.
 * identityKeys maps readable labels to stable IDs only; it cannot add a record.
 */
import { ingestContribution } from './index.mjs';
import { sha256 } from './hash.mjs';

const fixedSource = (name) => ({ 'about my family.pdf': 'about-family', 'family notes.txt': 'family-notes', 'photo notes.txt': 'photo-notes' })[name.toLowerCase()];
const stable = (kind, label) => `${kind}-${sha256(label).slice(0, 18)}`;
const unknown = (s) => !s || /^(unknown|not known|not recorded|unsure)$/i.test(s.trim());
const keyFor = (keys, label, kind) => {
  const id = keys?.[label] || stable(kind, label);
  if (typeof id !== 'string' || !id || id.length > 160) throw new Error(`Invalid ${kind} identity key`);
  return id;
};
function sections(text) {
  const headings = [...text.matchAll(/^##\s+(.+?)\s*$/gm)];
  return headings.map((m, i) => {
    const start = m.index, end = headings[i + 1]?.index ?? text.length;
    return { heading: m[1].trim(), start, end, raw: text.slice(start, end), body: text.slice(start + m[0].length, end).trim() };
  });
}
function lifeDate(body, word) {
  const candidates = [...body.matchAll(new RegExp(`\\b${word}\\s*:?\\s+(?:(around|about|approximately|on|in)\\s+)?([^.;\\n]+)`, 'gi'))];
  // A location sentence such as "He died in Miass" is not a date.
  const match = candidates.find(m => /^(?:\d{4}\b|\d{1,2}\s+[A-Za-z]+\s+\d{4}\b)/.test(m[2].trim()));
  const raw = match?.[2]?.trim();
  if (unknown(raw)) return { value: null, precision: 'unknown' };
  const approximate = ['around','about','approximately'].includes(match[1]?.toLowerCase());
  const conflicted = /\bor\b|unresolved|disputed/i.test(raw);
  let value = raw.replace(/\s*\(?(?:unresolved|disputed)\)?\s*$/i, '').trim();
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const human = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(value);
  if (human && !conflicted) {
    const month = monthNames.indexOf(human[2].toLowerCase()) + 1, day = Number(human[1]), year = Number(human[3]);
    const checked = new Date(Date.UTC(year, month - 1, day));
    if (!month || checked.getUTCMonth() !== month - 1 || checked.getUTCDate() !== day) throw new Error('Family notes contain an invalid calendar date');
    value = `${human[3]}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  const precision = conflicted ? 'unknown' : approximate ? 'approximate' : /^\d{4}$/.test(value) ? 'year' : /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'day' : /^\d{4}-\d{2}$/.test(value) ? 'month' : 'approximate';
  return { value, precision };
}
const support = (source, segment) => [{ sourceId: source.id, locator: source.originalLocator, quote: segment.raw, start: segment.start, end: segment.end }];

export async function parseFamilyNotesPacket({ files = [], identityKeys = {} } = {}) {
  if (files.length > 40 || files.reduce((n, f) => n + f.bytes.length, 0) > 100_000_000 || files.some(f => f.bytes.length > 25_000_000)) throw new Error('Upload limit: 40 files, 25 MB per file, 100 MB total');
  const raw = await ingestContribution({ files }), changes = new Map();
  for (const s of raw.sources) { const id = fixedSource(s.title || ''); if (id) { changes.set(s.id, id); s.id = id; } }
  const sources = raw.sources, assets = [], assetBytes = [], outcomes = raw.files.map(f => ({ ...f, sourceIds: f.sourceIds.map(id => changes.get(id) || id), warnings: [...f.warnings, ...(f.reason ? [f.reason] : [])] }));
  for (const a of raw.assets) {
    const id = keyFor(identityKeys.assets, a.originalName, 'asset'), sourceId = changes.get(a.sourceId) || a.sourceId || `source-${id}`;
    if (!sources.some(s => s.id === sourceId)) sources.push({ id: sourceId, kind: 'stored_file', originalLocator: a.originalName, contentHash: a.contentHash, originalText: '', origin: 'live', author: null, messageTimestamp: null, parentAttachmentId: null, title: a.originalName });
    assets.push({ ...a, id, sourceId, storageKey: `assets/${id}` }); assetBytes.push({ assetId: id, bytes: a.bytes });
    for (const f of outcomes) f.assetIds = f.assetIds.map(old => old === a.id ? id : old);
    for (const s of sources) if (s.parentAttachmentId === a.id) s.parentAttachmentId = id;
  }
  for (const s of sources) if (s.bytes) {
    const id = `original-${s.id}`, originalName = s.kind?.includes('chat') ? `${s.id}.txt` : s.title;
    assets.push({ id, sourceId: s.id, originalName, mediaType: s.mediaType || 'text/plain', byteLength: s.bytes.length, contentHash: sha256(s.bytes), storageKey: `assets/${id}` }); assetBytes.push({ assetId: id, bytes: s.bytes });
  }
  const notes = sources.find(s => s.id === 'family-notes');
  if (!notes) throw new Error('Supply Family notes.txt with person headings and family connections');
  const blocks = sections(notes.originalText), peopleBlocks = blocks.filter(b => b.heading !== 'Family connections');
  if (!peopleBlocks.length || peopleBlocks.length > 1000) throw new Error('Family notes require 1 to 1000 person headings');
  const byHeading = new Map(), personIds = new Set(), people = [], claims = [], relationships = [], reconciliation = [];
  for (const b of peopleBlocks) {
    if (byHeading.has(b.heading)) throw new Error(`Duplicate person heading: ${b.heading}`);
    const id = keyFor(identityKeys.people, b.heading, 'person');
    if (personIds.has(id)) throw new Error(`Duplicate mapped person ID: ${id}`);
    byHeading.set(b.heading, id); personIds.add(id);
    const disputed = /this record contains an unresolved discrepancy/i.test(b.body), tentative = /this identification remains tentative/i.test(b.body);
    const state = disputed ? 'disputed' : tentative ? 'proposed' : 'accepted', claimId = `import-person-${id}`;
    people.push({ id, displayNameEn: b.heading, originalName: b.heading, lifeYears: { birth: lifeDate(b.body, 'Born'), death: lifeDate(b.body, 'Died') }, photoIds: [], claimIds: [claimId], storyIds: [], recordStatus: disputed ? 'disputed' : tentative ? 'candidate' : 'reported' });
    claims.push({ id: claimId, subjectId: id, predicate: 'supplied_family_record', value: `${b.heading}. ${b.body}`, sourceIds: [notes.id], spans: support(notes, b), status: state, evidenceType: 'family_document', version: 1 });
  }
  for (const heading of Object.keys(identityKeys.people || {})) if (!byHeading.has(heading)) throw new Error(`Person identity key has no uploaded heading: ${heading}`);
  const connections = blocks.filter(b => b.heading === 'Family connections');
  if (connections.length > 1) throw new Error('Family notes allow at most one Family connections section');
  const mentions = [];
  for (const block of connections) for (const rawLine of block.body.split(/\r\n|\r|\n/)) {
    const sentence = rawLine.replace(/^\s*[-*]\s*/, '').trim(); if (!sentence) continue;
    const match = /^(.+?)\s+(is recorded as|may be)\s+the\s+(parent|spouse|partner|sibling)\s+of\s+(.+?)\.$/.exec(sentence);
    if (!match) throw new Error(`Unrecognized family connection sentence: ${sentence}`);
    mentions.push({ sentence, heading: null, fromName: match[1], toName: match[4], relation: match[3], state: match[2] === 'may be' ? 'proposed' : 'accepted', block });
  }
  const relativePattern = /\b(?:His|Her|Their) (?:father|mother|wife|husband|spouse|partner|brother|sister|sibling)\b[^.!?\n]*(?:[.!?]|$)/g;
  for (const block of peopleBlocks) for (const found of block.body.matchAll(relativePattern)) {
    const sentence = found[0].trim();
    const match = /^(?:His|Her|Their) (father|mother|wife|husband|spouse|partner|brother|sister|sibling) (was|may have been) (.+)\.$/.exec(sentence);
    if (!match) throw new Error(`Unrecognized family connection sentence: ${sentence}`);
    const isParent = ['father','mother'].includes(match[1]);
    const relation = isParent ? 'parent' : ['brother','sister','sibling'].includes(match[1]) ? 'sibling' : match[1] === 'partner' ? 'partner' : 'spouse';
    mentions.push({ sentence, heading: block.heading, fromName: isParent ? match[3] : block.heading, toName: isParent ? block.heading : match[3], relation, state: match[2] === 'may have been' ? 'proposed' : 'accepted', block });
  }
  const frequencies = new Map(); for (const m of mentions) frequencies.set(m.sentence, (frequencies.get(m.sentence) || 0) + 1);
  const usedIdentityKeys = new Set(), relationIds = new Map(), relationKeys = new Map();
  for (const m of mentions) {
    const from = byHeading.get(m.fromName), to = byHeading.get(m.toName), type = m.relation === 'spouse' ? 'partner' : m.relation;
    if (!from || !to || from === to) throw new Error('Family connection has an absent or self-referencing person heading');
    const scopedKey = m.heading ? `${m.heading}\n${m.sentence}` : m.sentence;
    const identityKey = Object.hasOwn(identityKeys.relationships || {}, scopedKey) ? scopedKey : m.sentence;
    if (identityKey === m.sentence && Object.hasOwn(identityKeys.relationships || {}, identityKey) && frequencies.get(m.sentence) > 1 && m.heading) throw new Error('Ambiguous unscoped relationship identity key; include its person heading');
    if (Object.hasOwn(identityKeys.relationships || {}, identityKey)) usedIdentityKeys.add(identityKey);
    const pairKey = type === 'parent' ? `${type}|${from}|${to}` : `${type}|${[from,to].sort().join('|')}`;
    const id = identityKeys.relationships?.[identityKey] || stable('relationship', pairKey);
    if (typeof id !== 'string' || !id || id.length > 160) throw new Error('Invalid relationship identity key');
    if (relationIds.has(id) && relationIds.get(id) !== pairKey) throw new Error(`Duplicate relationship identity: ${id}`);
    relationIds.set(id, pairKey);
    const start = notes.originalText.indexOf(m.sentence, m.block.start);
    const spans = m.heading ? support(notes, m.block) : [{ sourceId: notes.id, locator: notes.originalLocator, quote: m.sentence, start, end: start + m.sentence.length }];
    if (relationKeys.has(pairKey)) {
      const retained = relationKeys.get(pairKey), claim = claims.find(c => c.id === `import-relationship-${retained.id}`);
      claim.spans.push(...spans);
      if (retained.status !== m.state) { retained.status = 'disputed'; claim.status = 'disputed'; }
      reconciliation.push({ id, action: 'merged_duplicate', retainedId: retained.id }); continue;
    }
    const claimId = `import-relationship-${id}`;
    claims.push({ id: claimId, subjectId: from, predicate: `relationship_${m.relation === 'parent' ? 'parent_child' : m.relation}`, value: JSON.stringify({ from, to }), sourceIds: [notes.id], spans, status: m.state, evidenceType: 'family_document', version: 1 });
    const relationship = { id, fromPersonId: from, toPersonId: to, type, claimIds: [claimId], status: m.state };
    relationships.push(relationship); relationKeys.set(pairKey, relationship); reconciliation.push({ id, action: 'retained' });
  }
  for (const sentence of Object.keys(identityKeys.relationships || {})) if (!usedIdentityKeys.has(sentence)) throw new Error('Relationship identity key has no exact uploaded sentence');
  const parents = new Map(people.map(p => [p.id, []]));
  for (const r of relationships) if (r.type === 'parent') parents.get(r.fromPersonId).push(r.toPersonId);
  const visited = new Set(), active = new Set();
  function visit(id) { if (active.has(id)) throw new Error('Family notes contain a parent cycle'); if (visited.has(id)) return; active.add(id); for (const next of parents.get(id)) visit(next); active.delete(id); visited.add(id); }
  for (const id of personIds) visit(id);
  const photoNotes = sources.find(s => s.id === 'photo-notes'), photoAnnotations = [];
  if (photoNotes) for (const b of sections(photoNotes.originalText)) {
    const asset = assets.find(a => a.originalName === b.heading && a.mediaType.startsWith('image/'));
    if (!asset) throw new Error(`Photo heading has no uploaded image: ${b.heading}`);
    const names = /^People named in the caption:[ \t]*([^\n]+?)(?:\.[ \t]*$|$)/im.exec(b.body)?.[1]?.split(';').map(s => s.trim()) || [];
    const ordered = /^Left to right:[ \t]*([^\n]+?)(?:\.[ \t]*$|$)/im.exec(b.body)?.[1]?.split(';').map(s => s.trim()) || [];
    // Caption labels outside the selected roster remain unresolved annotations.
    // They never create a person or borrow a same-name identity.
    const labelList = ordered;
    const positions = labelList.map((label, i) => ({ position: i + 1, personId: byHeading.get(label) || null, label, status: byHeading.has(label) ? 'proposed' : 'unresolved' }));
    asset.caption = b.body;
    photoAnnotations.push({ assetId: asset.id, file: asset.originalName, positions, depictedPersonIds: [...new Set(names.map(name => byHeading.get(name)).filter(Boolean))], caption: b.body, support: support(photoNotes, b) });
  }
  const suppliedNames = new Set(files.map(f => f.originalName));
  for (const filename of Object.keys(identityKeys.assets || {})) if (!suppliedNames.has(filename)) throw new Error(`Asset identity key has no uploaded file: ${filename}`);
  if (new Set(assets.map(a => a.id)).size !== assets.length) throw new Error('Duplicate mapped asset IDs');
  for (const s of sources) { delete s.bytes; s.language = 'en'; s.evidenceRootId ||= s.contentHash; }
  for (const a of assets) delete a.bytes;
  for (const f of outcomes) { const matches = assets.filter(a => a.originalName === f.originalName || f.sourceIds.includes(a.sourceId)); f.assetIds = [...new Set([...f.assetIds,...matches.map(a => a.id)])]; f.sourceIds = [...new Set([...f.sourceIds,...matches.map(a => a.sourceId)])]; }
  return { schemaVersion: 'roots-v1', people, relationships, claims, stories: [], sources, assets, assetBytes, files: outcomes, issues: outcomes.filter(f => f.status === 'failed').map(f => `${f.originalName}: ${f.reason}`), warnings: [], history: [], layout: {}, photoAnnotations, relationshipReconciliation: reconciliation, counts: { people: people.length, relationships: relationships.length, sources: sources.length, assets: assets.length } };
}
