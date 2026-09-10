/**
 * Normalize the prior private family project into the shared schema.
 *
 * Hard rules enforced here:
 *  - Original IDs are preserved. An imported record is `origin: prepared`, never a discovery.
 *  - A relationship whose endpoint is missing is NEVER silently dropped: it is excluded
 *    from the graph and reported as a warning + issue.
 *  - Source confidence is mapped, not upgraded. "вероятно" stays a candidate.
 *  - Layout is derived separately from genealogy and must not be read back as fact.
 */

import { displayNameFromFullName, hasCyrillic } from './translit.mjs';
import {
  CLAIM_STATUS, EVIDENCE_TYPE, ORIGIN, RELATIONSHIP_TYPE, UNKNOWN_LABEL, lifeYearsLabel,
} from '../contracts/types.mjs';

/** Source-system confidence tokens -> claim status. Never upgrades evidence. */
const CONFIDENCE_TO_STATUS = {
  'подтверждено': CLAIM_STATUS.ACCEPTED,
  'высокий': CLAIM_STATUS.ACCEPTED,
  'вероятно': CLAIM_STATUS.PROPOSED,
  'средний': CLAIM_STATUS.PROPOSED,
  'низкий': CLAIM_STATUS.UNRESOLVED,
  'предположительно': CLAIM_STATUS.PROPOSED,
};

const DATE_PRECISION = {
  'точно': 'exact',
  'приблизительно': 'approximate',
  'примерно': 'approximate',
  'год известен': 'year_only',
  'неизвестно': 'unknown',
};

const REL_TYPE = {
  parent_child: RELATIONSHIP_TYPE.PARENT_CHILD,
  spouse: RELATIONSHIP_TYPE.SPOUSE,
  sibling: RELATIONSHIP_TYPE.SIBLING,
};

/** Map a source ref token to an evidence type. Unknown refs stay the weakest kind. */
function evidenceTypeForSource(sourceId) {
  const s = String(sourceId || '').toLowerCase();
  if (s.includes('pamyat') || s.includes('archive') || /^https?:/.test(s)) return EVIDENCE_TYPE.ARCHIVE_RECORD;
  return EVIDENCE_TYPE.FAMILY_RECOLLECTION;
}

/**
 * Parse a source date string without inventing precision.
 * @returns {import('../contracts/types.mjs').DatePart}
 */
export function parseDate(raw, confidenceToken) {
  const originalConfidence = confidenceToken == null ? undefined : String(confidenceToken);
  const token = String(confidenceToken || '').trim();
  const value = raw == null || raw === '' ? null : String(raw);

  if (value == null) {
    return { value: null, year: null, precision: DATE_PRECISION[token] || 'unknown', originalConfidence };
  }
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const yearOnly = /^(\d{4})$/.exec(value);
  const year = full ? Number(full[1]) : yearOnly ? Number(yearOnly[1]) : null;

  let precision = DATE_PRECISION[token];
  if (!precision) precision = full ? 'exact' : yearOnly ? 'year_only' : 'approximate';
  // A bare year is never "exact" regardless of what the source system claimed.
  if (precision === 'exact' && !full) precision = 'year_only';

  return { value, year, precision, originalConfidence };
}

function isLiving(person) {
  return String(person.death_date_confidence || '').startsWith('жив');
}

/**
 * @param {object} seedJson  the prior project's family_tree.json
 * @param {object} [options]
 * @param {string} [options.sourceLabel] human label for the packet, used in locators
 * @returns {object} normalized graph pieces + warnings/issues
 */
export function normalizeSeed(seedJson, options = {}) {
  const sourceLabel = options.sourceLabel || 'family_tree.json';
  const warnings = [];
  const issues = [];
  const people = [];
  const relationships = [];
  const claims = [];
  const stories = [];
  const history = [];

  const persons = Array.isArray(seedJson?.persons) ? seedJson.persons
    : Array.isArray(seedJson?.people) ? seedJson.people : [];
  const rawRels = Array.isArray(seedJson?.relationships) ? seedJson.relationships : [];
  const meta = seedJson?.meta || {};

  if (!persons.length) {
    issues.push({ code: 'empty_seed', message: 'Seed contains no persons array.', severity: 'error' });
    return { people, relationships, claims, stories, history, layout: { generations: {}, positions: {} }, warnings, issues, meta };
  }

  // Declared vs actual counts are a real, checkable import discrepancy.
  if (meta.total_persons != null && Number(meta.total_persons) !== persons.length) {
    const w = `Seed meta.total_persons is ${meta.total_persons} but the persons array holds ${persons.length}. Imported the actual ${persons.length} records.`;
    warnings.push(w);
    issues.push({ code: 'meta_count_mismatch', message: w, severity: 'warning', declared: Number(meta.total_persons), actual: persons.length });
  }

  const byId = new Map();
  const seen = new Set();
  let claimSeq = 0;
  const nextClaimId = () => `C${String(++claimSeq).padStart(4, '0')}`;
  let storySeq = 0;
  const nextStoryId = () => `ST${String(++storySeq).padStart(4, '0')}`;

  for (const p of persons) {
    const id = String(p.id || '').trim();
    if (!id) {
      issues.push({ code: 'person_missing_id', message: `Person without an id skipped: ${p.full_name || '(no name)'}`, severity: 'error' });
      continue;
    }
    if (seen.has(id)) {
      const w = `Duplicate person id ${id} in seed. Kept the first record.`;
      warnings.push(w);
      issues.push({ code: 'duplicate_person_id', message: w, severity: 'warning', personId: id });
      continue;
    }
    seen.add(id);

    const birth = parseDate(p.birth_date, p.birth_date_confidence);
    const death = isLiving(p)
      ? { value: null, year: null, precision: 'unknown', originalConfidence: p.death_date_confidence }
      : parseDate(p.death_date, p.death_date_confidence);

    const sourceIds = Array.isArray(p.source_refs) ? p.source_refs.map(String) : [];
    const personStatus = CONFIDENCE_TO_STATUS[String(p.confidence_level || '').trim()] || CLAIM_STATUS.PROPOSED;

    const person = {
      id,
      displayNameEn: displayNameFromFullName(p.full_name) || id,
      originalName: String(p.full_name || '').trim(),
      lifeYears: { birth, death, label: lifeYearsLabel(birth, death) },
      claimIds: [],
      photoIds: [],
      storyIds: [],
      gender: p.gender === 'М' ? 'male' : p.gender === 'Ж' ? 'female' : undefined,
      maidenName: p.maiden_name ? String(p.maiden_name) : undefined,
      nameVariants: [
        ...(Array.isArray(p.name_variants) ? p.name_variants : []),
        ...(Array.isArray(p.alternate_names) ? p.alternate_names : []),
      ].map(String).filter(Boolean),
      birthPlace: p.birth_place ? String(p.birth_place) : undefined,
      deathPlace: p.death_place ? String(p.death_place) : undefined,
      notes: p.notes ? String(p.notes) : undefined,
      isLiving: isLiving(p),
      importedFrom: sourceLabel,
    };

    // Field-level claims keep their own evidence instead of collapsing into the card.
    const addClaim = (predicate, value, extra = {}) => {
      if (value == null || value === '' ) return;
      const claim = {
        id: nextClaimId(),
        subjectId: id,
        predicate,
        value,
        sourceIds,
        status: extra.status || personStatus,
        evidenceType: sourceIds.length ? evidenceTypeForSource(sourceIds[0]) : EVIDENCE_TYPE.FAMILY_RECOLLECTION,
        scope: 'imported_existing_record',
        reason: extra.reason || `Imported from ${sourceLabel}`,
        version: 1,
        ...extra,
      };
      claims.push(claim);
      person.claimIds.push(claim.id);
    };

    if (birth.value) addClaim('birth_date', birth.value, { precision: birth.precision });
    if (person.birthPlace) addClaim('birth_place', person.birthPlace);
    if (death.value) addClaim('death_date', death.value, { precision: death.precision });
    if (person.deathPlace) addClaim('death_place', person.deathPlace);
    if (p.maiden_name) addClaim('maiden_name', String(p.maiden_name));
    for (const occ of Array.isArray(p.occupations) ? p.occupations : []) addClaim('occupation', String(occ));
    for (const res of Array.isArray(p.residences) ? p.residences : []) {
      if (res && res.place) addClaim('residence', `${res.place}${res.period ? ` (${res.period})` : ''}`);
    }
    if (p.military_service) addClaim('military_service', String(p.military_service));
    if (p.education) addClaim('education', String(p.education));
    for (const award of Array.isArray(p.awards) ? p.awards : []) addClaim('award', String(award));

    // Stories stay first-class records: they can be true and still prove no relationship.
    const rawStories = []
      .concat(Array.isArray(p.notable_stories) ? p.notable_stories : p.notable_stories ? [p.notable_stories] : [])
      .concat(Array.isArray(p.character_traits) ? [] : []);
    for (const text of rawStories) {
      if (!text) continue;
      const story = {
        id: nextStoryId(),
        subjectId: id,
        text: String(text),
        sourceIds,
        evidenceType: sourceIds.length ? evidenceTypeForSource(sourceIds[0]) : EVIDENCE_TYPE.FAMILY_RECOLLECTION,
        attributedTo: null,
        status: CLAIM_STATUS.ACCEPTED,
        scope: 'imported_existing_record',
      };
      stories.push(story);
      person.storyIds.push(story.id);
    }

    people.push(person);
    byId.set(id, person);
  }

  // Relationships: an absent endpoint is reported, never quietly discarded.
  let relSeq = 0;
  const relKeys = new Set();
  for (const r of rawRels) {
    relSeq += 1;
    const from = String(r.person_1_id || r.fromPersonId || '').trim();
    const to = String(r.person_2_id || r.toPersonId || '').trim();
    const rawType = String(r.type || '').trim();
    const type = REL_TYPE[rawType] || rawType || RELATIONSHIP_TYPE.PARENT_CHILD;

    const missing = [];
    if (!byId.has(from)) missing.push(from || '(blank)');
    if (!byId.has(to)) missing.push(to || '(blank)');
    if (missing.length) {
      const w = `Relationship ${relSeq} (${rawType} ${from}->${to}) references missing person id(s): ${missing.join(', ')}. Excluded from the graph and retained as an issue.`;
      warnings.push(w);
      issues.push({
        code: 'relationship_missing_endpoint', message: w, severity: 'warning',
        index: relSeq, fromPersonId: from, toPersonId: to, type: rawType, missing,
      });
      continue;
    }
    if (from === to) {
      const w = `Relationship ${relSeq} links ${from} to itself. Excluded.`;
      warnings.push(w);
      issues.push({ code: 'self_relationship', message: w, severity: 'warning', personId: from });
      continue;
    }

    const key = `${type}:${type === RELATIONSHIP_TYPE.PARENT_CHILD ? `${from}>${to}` : [from, to].sort().join('~')}`;
    if (relKeys.has(key)) {
      warnings.push(`Duplicate ${type} relationship ${from}-${to} collapsed.`);
      continue;
    }
    relKeys.add(key);

    const sourceIds = Array.isArray(r.source_refs) ? r.source_refs.map(String) : [];
    const status = CONFIDENCE_TO_STATUS[String(r.confidence || '').trim()] || CLAIM_STATUS.PROPOSED;
    const claim = {
      id: nextClaimId(),
      subjectId: from,
      predicate: `relationship_${type}`,
      value: { from, to, subtype: r.subtype ? String(r.subtype) : undefined },
      sourceIds,
      status,
      evidenceType: sourceIds.length ? evidenceTypeForSource(sourceIds[0]) : EVIDENCE_TYPE.FAMILY_RECOLLECTION,
      scope: 'imported_existing_record',
      reason: `Imported from ${sourceLabel}`,
      version: 1,
    };
    claims.push(claim);

    relationships.push({
      id: `R${String(relSeq).padStart(4, '0')}`,
      fromPersonId: from,
      toPersonId: to,
      type,
      claimIds: [claim.id],
      status,
      subtype: r.subtype ? String(r.subtype) : undefined,
      originalSubtype: r.subtype ? String(r.subtype) : undefined,
      originalConfidence: r.confidence ? String(r.confidence) : undefined,
    });
  }

  const layout = deriveLayout(people, relationships);
  const chronology = checkChronology(people, relationships, byId);
  issues.push(...chronology.issues);
  warnings.push(...chronology.warnings);

  history.push({
    eventId: 'H0001',
    at: new Date().toISOString(),
    actor: 'import',
    action: 'import_prepared_family',
    before: null,
    after: { people: people.length, relationships: relationships.length, claims: claims.length, stories: stories.length },
    origin: ORIGIN.PREPARED,
    note: `Imported existing family records from ${sourceLabel}. Existing evidence, not a new discovery.`,
  });

  return { people, relationships, claims, stories, history, layout, warnings, issues, meta };
}

/**
 * Generation index from parent_child edges. Layout only: never read back as genealogy.
 */
export function deriveLayout(people, relationships) {
  const parents = new Map();
  for (const p of people) parents.set(p.id, []);
  for (const r of relationships) {
    if (r.type !== RELATIONSHIP_TYPE.PARENT_CHILD) continue;
    if (parents.has(r.toPersonId)) parents.get(r.toPersonId).push(r.fromPersonId);
  }

  const generations = {};
  const visiting = new Set();
  const depthOf = (id) => {
    if (generations[id] != null) return generations[id];
    if (visiting.has(id)) return 0; // cycle guard; the cycle itself is reported by checkChronology
    visiting.add(id);
    const ps = parents.get(id) || [];
    const d = ps.length ? Math.max(...ps.map(depthOf)) + 1 : 0;
    visiting.delete(id);
    generations[id] = d;
    return d;
  };
  for (const p of people) depthOf(p.id);

  const rows = new Map();
  const positions = {};
  for (const p of people) {
    const g = generations[p.id] || 0;
    const col = rows.get(g) || 0;
    rows.set(g, col + 1);
    positions[p.id] = { x: col * 240, y: g * 180, generation: g };
  }
  return { generations, positions, note: 'Layout is display metadata. It carries no genealogical meaning.' };
}

/** Chronology and structure checks that produce reviewable discrepancies. */
export function checkChronology(people, relationships, byId) {
  const warnings = [];
  const issues = [];
  const get = (id) => byId.get(id);

  for (const p of people) {
    const b = p.lifeYears.birth.year;
    const d = p.lifeYears.death.year;
    if (b != null && d != null && d < b) {
      const m = `${p.displayNameEn} (${p.id}) has death year ${d} before birth year ${b}.`;
      warnings.push(m);
      issues.push({ code: 'death_before_birth', message: m, severity: 'warning', personId: p.id });
    }
  }

  for (const r of relationships) {
    if (r.type !== RELATIONSHIP_TYPE.PARENT_CHILD) continue;
    const parent = get(r.fromPersonId);
    const child = get(r.toPersonId);
    if (!parent || !child) continue;
    const pb = parent.lifeYears.birth.year;
    const cb = child.lifeYears.birth.year;
    if (pb == null || cb == null) continue;
    const gap = cb - pb;
    if (gap < 12) {
      const m = `${parent.displayNameEn} (${parent.id}) would be ${gap} years old at the birth of ${child.displayNameEn} (${child.id}).`;
      warnings.push(m);
      issues.push({ code: 'implausible_parent_age', message: m, severity: 'warning', parentId: parent.id, childId: child.id, gap });
    }
    const pd = parent.lifeYears.death.year;
    if (pd != null && cb > pd + 1) {
      const m = `${child.displayNameEn} (${child.id}) born ${cb}, after parent ${parent.displayNameEn} (${parent.id}) died ${pd}.`;
      warnings.push(m);
      issues.push({ code: 'child_born_after_parent_death', message: m, severity: 'warning', parentId: parent.id, childId: child.id });
    }
  }

  // Ancestry cycle detection.
  const parentMap = new Map();
  for (const r of relationships) {
    if (r.type !== RELATIONSHIP_TYPE.PARENT_CHILD) continue;
    if (!parentMap.has(r.toPersonId)) parentMap.set(r.toPersonId, []);
    parentMap.get(r.toPersonId).push(r.fromPersonId);
  }
  const state = new Map();
  const walk = (id, stack) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'open') {
      const m = `Ancestry cycle detected involving ${[...stack, id].join(' -> ')}.`;
      warnings.push(m);
      issues.push({ code: 'ancestry_cycle', message: m, severity: 'error', path: [...stack, id] });
      return;
    }
    state.set(id, 'open');
    for (const p of parentMap.get(id) || []) walk(p, [...stack, id]);
    state.set(id, 'done');
  };
  for (const p of people) walk(p.id, []);

  return { warnings, issues };
}
