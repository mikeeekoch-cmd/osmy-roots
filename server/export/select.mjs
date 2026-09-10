/**
 * Decide what the book is allowed to state.
 *
 * Two rules do the real work here:
 *  - A passage whose acceptedStateVersion no longer matches the snapshot is STALE
 *    and is flagged, never quietly printed as current.
 *  - Unreviewed / unknown / rejected material stays in "notes", never in the biography.
 */

const ACCEPTED = 'accepted';

/**
 * Inline directives that ingestion reads out of supplied text (evidence roots,
 * attribution overrides, photo order). They are real metadata, kept verbatim in
 * sources.json and project.json, but they must not print as prose in the book.
 */
const INLINE_DIRECTIVE = /\s*\b(?:evidence[_-]?root|original[_-]?(?:source|speaker|attribution)|order)\s*[:=]\s*[^\n;]+;?/gi;
const LEADING_ID = /^\[?((?:SRC|EV|REC|CAP)[A-Z0-9_-]*)\]?[:.]?\s+/i;

/** Readable form of supplied text. The stored original is never modified. */
export function displayText(text) {
  return String(text ?? '')
    .replace(LEADING_ID, '')
    .replace(INLINE_DIRECTIVE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

export function isAccepted(record) { return record && record.status === ACCEPTED; }

const REL_WORD = {
  partner: 'partner of',
  parent_child: 'parent of',
  spouse: 'married to',
  sibling: 'sibling of',
};

/**
 * Render one claim as a readable sentence instead of a raw value dump.
 * @param {object} claim
 * @param {Map<string,object>} people  id -> person, for naming the other party
 */
export function claimText(claim, people = new Map()) {
  const name = (id) => people.get(id)?.displayNameEn || id;
  const relMatch = /^relationship_(.+)$/.exec(claim.predicate || '');
  if (relMatch && claim.value && typeof claim.value === 'object') {
    const { from, to, subtype } = claim.value;
    const word = REL_WORD[relMatch[1]] || relMatch[1].replace(/_/g, ' ');
    const detail = subtype ? ` (${subtype})` : '';
    return `${name(from)} is ${word} ${name(to)}${detail}`;
  }
  const label = String(claim.predicate || '').replace(/_/g, ' ');
  const value = claim.value && typeof claim.value === 'object'
    ? Object.entries(claim.value).filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`).join(', ')
    : String(claim.value ?? '');
  return `${label}: ${value}`;
}

/**
 * @returns {{current: Array, stale: Array, invalid: Array}}
 */
export function partitionPassages(passages = [], snapshotVersion) {
  const current = [];
  const stale = [];
  const invalid = [];
  for (const p of passages) {
    if (!p || typeof p.text !== 'string' || !p.text.trim()) {
      invalid.push({ passage: p, reason: 'Passage has no text.' });
      continue;
    }
    const hasSupport = (Array.isArray(p.claimIds) && p.claimIds.length)
      || (Array.isArray(p.sourceLocators) && p.sourceLocators.length);
    if (!hasSupport) {
      invalid.push({ passage: p, reason: 'Factual passage carries no claim or source locator.' });
      continue;
    }
    if (p.acceptedStateVersion == null || Number(p.acceptedStateVersion) !== Number(snapshotVersion)) {
      stale.push({
        passage: p,
        reason: `Passage acceptedStateVersion ${p.acceptedStateVersion} does not match project version ${snapshotVersion}. Regenerate before printing it as current.`,
      });
      continue;
    }
    current.push(p);
  }
  return { current, stale, invalid };
}

/**
 * Split a person's stories into printable biography material and notes.
 * An accepted recollection is printable but stays labelled a recollection.
 */
export function partitionStories(stories = [], personId) {
  const mine = stories.filter((s) => s.subjectId === personId);
  return {
    accepted: mine.filter(isAccepted),
    notes: mine.filter((s) => !isAccepted(s)),
  };
}

/** Claims that may appear as facts, with their evidence type preserved. */
export function acceptedClaimsFor(claims = [], personId) {
  return claims.filter((c) => c.subjectId === personId && isAccepted(c));
}

/** Everything still open, for the "Still to discover" section. */
export function openQuestionsFrom(snapshot) {
  const out = [];
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  for (const c of snapshot.claims || []) {
    if (['proposed', 'disputed', 'unresolved'].includes(c.status)) {
      const who = people.get(c.subjectId)?.displayNameEn || c.subjectId;
      const body = claimText(c, people);
      // A relationship sentence already names both people.
      out.push({
        kind: 'claim', id: c.id, subjectId: c.subjectId, status: c.status,
        text: /^relationship_/.test(c.predicate || '') ? body : `${who} - ${body}`,
        sourceIds: c.sourceIds || [],
      });
    }
  }
  for (const issue of snapshot.issues || []) {
    if (issue.severity === 'warning' || issue.severity === 'error') {
      out.push({ kind: 'issue', id: issue.code, text: issue.message, status: issue.severity });
    }
  }
  for (const p of snapshot.proposals || []) {
    if (p.status && p.status !== 'accepted' && p.status !== 'rejected') {
      out.push({ kind: 'proposal', id: p.id, status: p.status, text: p.question || p.proposedStory || 'Pending proposal', sourceIds: p.sourceIds || [] });
    }
  }
  return out;
}
