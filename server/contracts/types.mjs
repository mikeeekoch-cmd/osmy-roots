/**
 * Shared runtime shapes used by server/ingestion, server/research and server/export.
 *
 * Owner: Claude Code Mike (ingestion / retrieval / export).
 *
 * This is a LOCAL MIRROR of docs/CONTRACT-V3.json field names so the three modules
 * are callable before the lead publishes packages/contracts. When the lead publishes
 * the authoritative TypeScript/Zod types, this file should be replaced by a re-export
 * from packages/contracts. Field NAMES here are taken verbatim from CONTRACT-V3.json
 * and must not be renamed unilaterally.
 *
 * @see docs/PROTOTYPE-CONTRACT.md
 * @see docs/CONTRACT-V3.json
 */

export const SCHEMA_VERSION = 'roots-export-1';

/** Source origin. A cached page is never reported as live. */
export const ORIGIN = Object.freeze({
  LIVE: 'live',
  CACHED: 'cached',
  PREPARED: 'prepared',
  REPLAY: 'replay',
});

/** Claim lifecycle. `accepted` is a review decision, not independent proof. */
export const CLAIM_STATUS = Object.freeze({
  PROPOSED: 'proposed',
  ACCEPTED: 'accepted',
  DISPUTED: 'disputed',
  UNRESOLVED: 'unresolved',
  SUPERSEDED: 'superseded',
});

/** How a claim is supported. Human review never upgrades a recollection to a record. */
export const EVIDENCE_TYPE = Object.freeze({
  FAMILY_RECOLLECTION: 'family_recollection',
  FAMILY_DOCUMENT: 'family_document',
  ARCHIVE_RECORD: 'archive_record',
  USER_CORRECTION: 'user_correction',
});

/** Per-file ingestion outcome. `stored_only` means bytes kept, no text extracted. */
export const FILE_STATUS = Object.freeze({
  PARSED: 'parsed',
  STORED_ONLY: 'stored_only',
  FAILED: 'failed',
});

export const RELATIONSHIP_TYPE = Object.freeze({
  PARENT_CHILD: 'parent_child',
  SPOUSE: 'spouse',
  SIBLING: 'sibling',
});

/** Text media types we actually extract text from. Everything else is stored_only. */
export const PARSEABLE_TEXT_TYPES = Object.freeze([
  'text/plain',
  'application/json',
  'text/markdown',
  'text/csv',
]);

/**
 * @typedef {Object} SourceRecord
 * @property {string} id
 * @property {string} kind                 family_document | family_memory | archive_record | context | synthetic_fixture | public_record
 * @property {string} originalLocator      filename#L12, paragraph:163, or an absolute URL + excerpt span
 * @property {string} contentHash          sha256 of the ORIGINAL bytes
 * @property {'live'|'cached'|'prepared'|'replay'} origin
 * @property {string|null} author          null when genuinely unknown
 * @property {string|null} messageTimestamp ISO-8601, or null. A file mtime is NOT a message time.
 * @property {string|null} parentAttachmentId
 * @property {string} originalText         exact text as it appeared in the source
 * @property {string} [title]
 * @property {string} [language]
 * @property {string} [rightsNote]
 * @property {boolean} [publicUseApproved] defaults false
 */

/**
 * @typedef {Object} AssetRecord
 * @property {string} id
 * @property {string|null} sourceId
 * @property {string} originalName
 * @property {string} mediaType
 * @property {number} byteLength
 * @property {string} contentHash
 * @property {string} storageKey   private, opaque. Never an absolute host path in an export.
 * @property {string} [caption]
 * @property {string} [captionOrigin] where the caption text came from (e.g. supplied filename)
 */

/**
 * @typedef {Object} PersonRecord
 * @property {string} id
 * @property {string} displayNameEn
 * @property {string} originalName
 * @property {{birth: DatePart, death: DatePart, label: string}} lifeYears
 * @property {string[]} claimIds
 * @property {string[]} photoIds
 * @property {string[]} [storyIds]
 * @property {string} [gender]
 * @property {string} [maidenName]
 * @property {string[]} [nameVariants]
 * @property {string} [birthPlace]
 * @property {string} [deathPlace]
 * @property {string} [notes]
 */

/**
 * @typedef {Object} DatePart
 * @property {string|null} value      ISO-ish original string, or null when unknown
 * @property {number|null} year
 * @property {'exact'|'approximate'|'year_only'|'unknown'} precision
 * @property {string} [originalConfidence] untranslated confidence token from the source system
 */

/**
 * @typedef {Object} RelationshipRecord
 * @property {string} id
 * @property {string} fromPersonId   parent for parent_child
 * @property {string} toPersonId     child for parent_child
 * @property {string} type
 * @property {string[]} claimIds
 * @property {string} status
 * @property {string} [subtype]
 * @property {string} [originalSubtype]
 */

/**
 * @typedef {Object} ClaimRecord
 * @property {string} id
 * @property {string} subjectId
 * @property {string} predicate
 * @property {*} value
 * @property {string[]} sourceIds
 * @property {string} status
 * @property {string} evidenceType
 * @property {string} [scope]
 * @property {string} [reason]
 * @property {number} [version]
 */

/**
 * @typedef {Object} StoryRecord   A first-class attributed recollection. Proves no relationship by itself.
 * @property {string} id
 * @property {string} subjectId
 * @property {string} text
 * @property {string[]} sourceIds
 * @property {string} evidenceType
 * @property {string|null} attributedTo
 * @property {string} status
 */

/**
 * @typedef {Object} BookPassage
 * @property {string} id
 * @property {string} text
 * @property {string[]} claimIds
 * @property {string[]} sourceLocators
 * @property {number} acceptedStateVersion
 * @property {string} [personId]
 * @property {string} [title]
 */

/** Stable, readable, collision-checked id factory. */
export function makeIdFactory(prefix) {
  let n = 0;
  const used = new Set();
  return function nextId(hint) {
    let base = hint ? `${prefix}_${String(hint).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)}` : null;
    if (!base || used.has(base)) {
      n += 1;
      base = `${prefix}_${String(n).padStart(4, '0')}`;
      while (used.has(base)) {
        n += 1;
        base = `${prefix}_${String(n).padStart(4, '0')}`;
      }
    }
    used.add(base);
    return base;
  };
}

/** Unknown dates render as the literal label the contract requires. */
export const UNKNOWN_LABEL = 'Unknown';

/**
 * Format a life-years label without inventing precision.
 * @param {DatePart} birth
 * @param {DatePart} death
 */
export function lifeYearsLabel(birth, death) {
  const b = birth && birth.year != null ? String(birth.year) : UNKNOWN_LABEL;
  const d = death && death.year != null ? String(death.year) : null;
  const approx = (p) => (p && (p.precision === 'approximate') ? 'c. ' : '');
  if (d) return `${approx(birth)}${b} - ${approx(death)}${d}`;
  if (death && death.precision === 'unknown' && birth && birth.year != null) return `b. ${approx(birth)}${b}`;
  return b === UNKNOWN_LABEL ? UNKNOWN_LABEL : `b. ${approx(birth)}${b}`;
}
