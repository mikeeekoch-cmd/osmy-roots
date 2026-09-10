/**
 * Preserved raw-schema importer from the external data/export owner.
 * The live app and canonical frozen-packet validator use parseFamilyPacket in
 * packet.mjs. This importer supports its separate raw fixture formats; it is not
 * a compatibility certificate for the canonical JSON captions/undated chats.
 *
 * A normal intake of the 01-upload folder must reconstruct the whole supported
 * roster with no internal project JSON. Everything here comes from the supplied
 * documents: the one-page PDF, the two registers, the recollections and caption
 * files, the photographs and the three reconstructed chat archives.
 *
 * Rules enforced:
 *  - stable supplied IDs are preserved; nothing is renumbered
 *  - direction and uncertainty survive; unknown stays unknown
 *  - duplicate, missing and dangling references are reported, never silently fixed
 *  - the raw-to-normalized relationship reconciliation is audited row by row
 *  - repeated adaptations of one passage share an evidence root, so corroboration
 *    cannot be inflated by copying the same memory into three archives
 */

import { sha256 } from './hash.mjs';
import { parseCsvRecords, pick } from './csv.mjs';
import { readArchive, ArchiveError, UPLOAD_POLICY } from './archive.mjs';
import { parseChatTranscript, findChatEntry } from './chat.mjs';
import { extractPdfText } from './pdf-text.mjs';
import { detectMediaType, isImage } from './media-type.mjs';
import { decodeUtf8, segmentText, lineLocator } from './parse-text.mjs';
import { displayNameFromFullName } from './translit.mjs';
import {
  ORIGIN, CLAIM_STATUS, EVIDENCE_TYPE, RELATIONSHIP_TYPE, FILE_STATUS,
  SCHEMA_VERSION, lifeYearsLabel,
} from '../contracts/types.mjs';

/** Exact filenames this parser understands, for Product's compatibility report. */
export const SUPPORTED_INPUTS = Object.freeze({
  overviewPdf: { pattern: /^Family_Overview\.pdf$/i, role: 'one-page narrative overview', required: false },
  overviewSidecar: { pattern: /^Family_Overview(\.pdf)?\.txt$/i, role: 'hash-bound PDF text sidecar', required: false },
  register: { pattern: /^Family_Register\.csv$/i, role: 'one row per person', required: true },
  relationships: { pattern: /^Family_Relationships\.csv$/i, role: 'one row per relationship', required: true },
  recollections: { pattern: /^Family_Recollections\.txt$/i, role: 'English evidence passages with source IDs', required: false },
  captions: { pattern: /^Photo_Captions\.txt$/i, role: 'photo annotations', required: false },
  chatArchive: { pattern: /^WhatsApp_[A-Za-z0-9_-]+\.zip$/i, role: 'reconstructed chat archive with _chat.txt', required: false },
  photo: { pattern: /\.(jpe?g|png)$/i, role: 'original photograph copy', required: false },
});

const REL_TYPE_IN = {
  parent: RELATIONSHIP_TYPE.PARENT_CHILD, parent_child: RELATIONSHIP_TYPE.PARENT_CHILD,
  father: RELATIONSHIP_TYPE.PARENT_CHILD, mother: RELATIONSHIP_TYPE.PARENT_CHILD,
  child: RELATIONSHIP_TYPE.PARENT_CHILD,
  spouse: RELATIONSHIP_TYPE.SPOUSE, partner: RELATIONSHIP_TYPE.SPOUSE, married: RELATIONSHIP_TYPE.SPOUSE,
  sibling: RELATIONSHIP_TYPE.SIBLING, brother: RELATIONSHIP_TYPE.SIBLING, sister: RELATIONSHIP_TYPE.SIBLING,
};
const STATUS_IN = {
  confirmed: CLAIM_STATUS.ACCEPTED, accepted: CLAIM_STATUS.ACCEPTED, verified: CLAIM_STATUS.ACCEPTED,
  candidate: CLAIM_STATUS.PROPOSED, proposed: CLAIM_STATUS.PROPOSED, probable: CLAIM_STATUS.PROPOSED,
  unresolved: CLAIM_STATUS.UNRESOLVED, unknown: CLAIM_STATUS.UNRESOLVED,
  disputed: CLAIM_STATUS.DISPUTED, conflict: CLAIM_STATUS.DISPUTED,
};
const PRECISION_IN = {
  exact: 'exact', day: 'exact', full: 'exact',
  year: 'year_only', year_only: 'year_only',
  approximate: 'approximate', approx: 'approximate', circa: 'approximate', about: 'approximate',
  unknown: 'unknown', '': 'unknown',
};

function datePart(value, precisionToken) {
  const raw = String(value ?? '').trim();
  const token = String(precisionToken ?? '').trim().toLowerCase();
  if (!raw || /^(unknown|n\/a|-)$/i.test(raw)) {
    return { value: null, year: null, precision: 'unknown', originalConfidence: precisionToken || null };
  }
  const circa = /^(c\.|ca\.|approx\.?|about|~)/i.test(raw);
  const yearM = /(\d{4})/.exec(raw);
  const full = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  let precision = PRECISION_IN[token] || (full ? 'exact' : yearM ? 'year_only' : 'approximate');
  if (circa) precision = 'approximate';
  if (precision === 'exact' && !full) precision = 'year_only';
  return { value: raw, year: yearM ? Number(yearM[1]) : null, precision, originalConfidence: precisionToken || null };
}

const splitList = (s) => String(s || '').split(/[;,|]/).map((x) => x.trim()).filter(Boolean);

function classify(name) {
  for (const [key, spec] of Object.entries(SUPPORTED_INPUTS)) {
    if (key === 'photo') continue;
    if (spec.pattern.test(name)) return key;
  }
  if (SUPPORTED_INPUTS.photo.pattern.test(name)) return 'photo';
  return null;
}

/**
 * @param {object} args
 * @param {Array<{originalName:string,bytes:Buffer}>} args.files  the user-selected upload set
 * @param {object} [args.manifest]  optional DEMO_MANIFEST for expected counts
 * @returns {Promise<object>} ImportResult plus report{}
 */
export async function ingestDemoPacket({ files = [], manifest = null } = {}) {
  const warnings = [];
  const issues = [];
  const fileOutcomes = [];
  const sources = [];
  const assets = [];
  const people = [];
  const relationships = [];
  const claims = [];
  const stories = [];
  const byId = new Map();
  const evidenceRoots = new Map();     // rootId -> [sourceId]
  let expandedBudget = 100 * 1024 * 1024;
  let claimSeq = 0;
  const nextClaimId = () => `C${String(++claimSeq).padStart(4, '0')}`;

  // ---- upload policy -------------------------------------------------------
  const totalBytes = files.reduce((n, f) => n + (f.bytes?.length || 0), 0);
  if (files.length > UPLOAD_POLICY.maxFiles) {
    issues.push({ code: 'too_many_files', severity: 'error', message: `${files.length} files selected; the limit is ${UPLOAD_POLICY.maxFiles}.` });
  }
  if (totalBytes > UPLOAD_POLICY.maxTotalBytes) {
    issues.push({ code: 'upload_too_large', severity: 'error', message: `Selection is ${totalBytes} bytes; the limit is ${UPLOAD_POLICY.maxTotalBytes}.` });
  }

  const buckets = { register: [], relationships: [], recollections: [], captions: [], chatArchive: [], photo: [], overviewPdf: [], overviewSidecar: [], unsupported: [] };
  for (const f of files) {
    const name = String(f.originalName || '');
    const bytes = Buffer.isBuffer(f.bytes) ? f.bytes : Buffer.from(f.bytes || []);
    if (bytes.length > UPLOAD_POLICY.maxFileBytes) {
      issues.push({ code: 'file_too_large', severity: 'error', message: `${name} is ${bytes.length} bytes; the per-file limit is ${UPLOAD_POLICY.maxFileBytes}.` });
      fileOutcomes.push({ originalName: name, status: FILE_STATUS.FAILED, reason: 'Exceeds the per-file upload limit.' });
      continue;
    }
    const kind = classify(name);
    if (!kind) {
      buckets.unsupported.push({ name, bytes });
      continue;
    }
    buckets[kind].push({ name, bytes });
  }

  const addSource = (src) => {
    sources.push(src);
    const root = src.evidenceRootId || src.id;
    if (!evidenceRoots.has(root)) evidenceRoots.set(root, []);
    evidenceRoots.get(root).push(src.id);
    return src;
  };

  // ---- the one-page overview ----------------------------------------------
  let overview = null;
  for (const f of buckets.overviewPdf) {
    const contentHash = sha256(f.bytes);
    const result = extractPdfText(f.bytes);
    const sidecar = buckets.overviewSidecar[0] || null;
    let text = result.text;
    let extractionMode = 'pdf_text_layer';

    if (!result.ok) {
      warnings.push(`${f.name}: ${result.reason}`);
      if (sidecar) {
        // A sidecar is only trusted when it names the exact PDF hash it describes.
        const sideText = decodeUtf8(sidecar.bytes);
        const bound = sideText.includes(contentHash) || sideText.includes(contentHash.slice(0, 16));
        if (!bound) {
          issues.push({
            code: 'sidecar_not_hash_bound', severity: 'error',
            message: `${sidecar.name} does not reference the sha256 of ${f.name}. A prepared extraction must be hash-bound to the PDF it describes.`,
          });
          fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.STORED_ONLY, reason: result.reason });
          continue;
        }
        text = sideText;
        extractionMode = 'prepared_sidecar';
        warnings.push(`${f.name}: using the hash-bound prepared sidecar ${sidecar.name}. This is NOT successful PDF extraction.`);
      } else {
        fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.STORED_ONLY, reason: result.reason });
        continue;
      }
    }

    overview = addSource({
      id: 'SRC_OVERVIEW',
      kind: 'family_document',
      originalLocator: `${f.name}#page:1`,
      contentHash,
      origin: ORIGIN.PREPARED,
      author: null, messageTimestamp: null, parentAttachmentId: null,
      originalText: text,
      title: f.name,
      mediaType: 'application/pdf',
      byteLength: f.bytes.length,
      extractionMode,
      pdfPages: result.pages,
      segments: segmentText(text).map((s) => ({ index: s.index, startLine: s.startLine, endLine: s.endLine, locator: lineLocator(f.name, s.startLine, s.endLine), text: s.text })),
      publicUseApproved: false,
    });
    fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.PARSED, sourceIds: ['SRC_OVERVIEW'], extractionMode, words: result.words || 0 });
  }
  if (!buckets.overviewPdf.length && buckets.overviewSidecar.length) {
    warnings.push('A PDF text sidecar was supplied without its Family_Overview.pdf; the sidecar alone is not treated as the overview.');
  }

  // ---- text evidence: recollections and captions ---------------------------
  const textSources = new Map();
  for (const f of [...buckets.recollections, ...buckets.captions]) {
    let text;
    try { text = decodeUtf8(f.bytes); } catch {
      fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.STORED_ONLY, reason: 'Not valid UTF-8 text.' });
      continue;
    }
    const contentHash = sha256(f.bytes);
    const segments = segmentText(text);
    const created = [];
    for (const seg of segments) {
      // A paragraph may declare its own stable source ID: `[SRC_R12] text…`
      const idM = /^\[?((?:SRC|EV|REC|CAP)[A-Z0-9_\-]*)\]?[:.]?\s+/i.exec(seg.text);
      const id = idM ? idM[1].toUpperCase() : `SRC_${f.name.replace(/\W+/g, '').slice(0, 10).toUpperCase()}_${seg.index}`;
      const body = idM ? seg.text.slice(idM[0].length) : seg.text;
      const rootM = /\bevidence[_-]?root[:=]\s*([A-Z0-9_\-]+)/i.exec(seg.text);
      const src = addSource({
        id,
        kind: /caption/i.test(f.name) ? 'family_document' : 'family_memory',
        originalLocator: lineLocator(f.name, seg.startLine, seg.endLine),
        contentHash,
        origin: ORIGIN.PREPARED,
        author: null, messageTimestamp: null, parentAttachmentId: null,
        originalText: body,
        title: `${f.name} paragraph ${seg.index}`,
        mediaType: 'text/plain',
        byteLength: Buffer.byteLength(body, 'utf8'),
        evidenceRootId: rootM ? rootM[1].toUpperCase() : id,
        segments: [{ index: 1, startLine: seg.startLine, endLine: seg.endLine, locator: lineLocator(f.name, seg.startLine, seg.endLine), text: body }],
        publicUseApproved: false,
      });
      textSources.set(id, src);
      created.push(id);
    }
    fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.PARSED, sourceIds: created, segments: segments.length });
  }

  // ---- photographs ---------------------------------------------------------
  const photoByName = new Map();
  for (const f of buckets.photo) {
    const mediaType = detectMediaType(f.name, f.bytes);
    if (!isImage(mediaType)) {
      fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.STORED_ONLY, reason: `Detected ${mediaType}, not an image.` });
      continue;
    }
    const contentHash = sha256(f.bytes);
    const id = `A_${contentHash.slice(0, 10)}`;
    if (photoByName.has(f.name)) {
      warnings.push(`Duplicate photo filename ${f.name}; the later copy was ignored.`);
      continue;
    }
    const asset = {
      id, sourceId: null, originalName: f.name, mediaType,
      byteLength: f.bytes.length, contentHash,
      storageKey: `assets/${id}.${mediaType === 'image/png' ? 'png' : 'jpg'}`,
      origin: ORIGIN.PREPARED, personIds: [], order: null, bytes: f.bytes,
    };
    assets.push(asset);
    photoByName.set(f.name, asset);
    fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.STORED_ONLY, reason: 'Original photograph stored unmodified. No OCR and no face identification.', assetIds: [id] });
  }

  // ---- chat archives -------------------------------------------------------
  for (const f of buckets.chatArchive) {
    const archiveHash = sha256(f.bytes);
    let archive;
    try {
      archive = readArchive(f.bytes, { budgetBytes: expandedBudget });
    } catch (e) {
      const code = e instanceof ArchiveError ? e.code : 'ARCHIVE_ERROR';
      issues.push({ code: `archive_${String(code).toLowerCase()}`, severity: 'error', message: `${f.name}: ${e.message}` });
      fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.FAILED, reason: e.message });
      continue;
    }
    expandedBudget -= archive.expandedBytes;
    warnings.push(...archive.warnings.map((w) => `${f.name}: ${w}`));

    const chatEntry = findChatEntry(archive.entries);
    if (!chatEntry) {
      issues.push({ code: 'archive_no_transcript', severity: 'error', message: `${f.name} contains no _chat.txt transcript.` });
      fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.STORED_ONLY, reason: 'No transcript entry found.' });
      continue;
    }
    let transcript;
    try { transcript = decodeUtf8(chatEntry.bytes); } catch {
      issues.push({ code: 'archive_transcript_not_utf8', severity: 'error', message: `${f.name}: ${chatEntry.name} is not valid UTF-8.` });
      fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.STORED_ONLY, reason: 'Transcript is not UTF-8.' });
      continue;
    }

    const parsed = parseChatTranscript(transcript, { archiveName: f.name, chatEntryName: chatEntry.name });
    warnings.push(...parsed.warnings.map((w) => `${f.name}: ${w}`));

    // Attachments referenced by the transcript must actually be present.
    const present = new Set(archive.entries.filter((e) => e.status === 'extracted').map((e) => e.name.split('/').pop()));
    const created = [];
    for (const msg of parsed.messages) {
      if (msg.isSystemNotice) continue;
      const rootM = /\bevidence[_-]?root[:=]\s*([A-Z0-9_\-]+)/i.exec(msg.text);
      const attribM = /\boriginal[_-]?(?:source|speaker|attribution)[:=]\s*([^\n;]+)/i.exec(msg.text);
      const id = `SRC_${f.name.replace(/\W+/g, '').slice(0, 12).toUpperCase()}_M${msg.index}`;
      const src = addSource({
        id,
        kind: 'family_memory',
        originalLocator: msg.locator,
        contentHash: chatEntry.contentHash,
        archiveHash,
        origin: ORIGIN.PREPARED,
        // The filename role is a reconstruction artefact, not a verified author.
        author: attribM ? attribM[1].trim() : null,
        speakerRole: msg.speakerRole,
        messageTimestamp: null,
        parentAttachmentId: null,
        originalText: msg.text,
        title: `${f.name} message ${msg.index}`,
        mediaType: 'text/plain',
        byteLength: Buffer.byteLength(msg.text, 'utf8'),
        evidenceRootId: rootM ? rootM[1].toUpperCase() : id,
        reconstruction: {
          reconstructed: true,
          note: 'Reconstructed chat format. The speaker role and displayed time are scaffolding; the underlying recollection keeps its own attribution.',
          declaredDate: msg.declaredDate,
          declaredTime: msg.declaredTime,
          archive: f.name,
          transcriptEntry: chatEntry.name,
        },
        segments: [{ index: 1, startLine: 1, endLine: msg.lineCount, locator: msg.locator, text: msg.text }],
        publicUseApproved: false,
      });
      created.push(src.id);

      if (msg.attachmentName) {
        if (present.has(msg.attachmentName)) {
          const entry = archive.entries.find((e) => e.name.split('/').pop() === msg.attachmentName);
          const mediaType = detectMediaType(entry.name, entry.bytes);
          const aid = `A_${entry.contentHash.slice(0, 10)}`;
          if (!assets.some((a) => a.id === aid)) {
            assets.push({
              id: aid, sourceId: src.id, originalName: msg.attachmentName, mediaType,
              byteLength: entry.byteLength, contentHash: entry.contentHash,
              storageKey: `assets/${aid}.${mediaType === 'image/png' ? 'png' : 'jpg'}`,
              origin: ORIGIN.PREPARED, personIds: [], order: null, bytes: entry.bytes,
            });
          }
          src.parentAttachmentId = aid;
        } else {
          warnings.push(`${f.name} message ${msg.index} references attachment "${msg.attachmentName}", which is not in the archive.`);
          issues.push({ code: 'missing_attachment', severity: 'warning', message: `${f.name}: attachment "${msg.attachmentName}" referenced at ${msg.locator} is missing.`, locator: msg.locator });
          src.missingAttachment = msg.attachmentName;
        }
      }
    }
    fileOutcomes.push({
      originalName: f.name, status: FILE_STATUS.PARSED, sourceIds: created,
      format: parsed.format, messages: parsed.messages.length,
      entries: archive.entryCount, expandedBytes: archive.expandedBytes,
    });
  }

  // ---- register: people ----------------------------------------------------
  for (const f of buckets.register) {
    let text;
    try { text = decodeUtf8(f.bytes); } catch {
      issues.push({ code: 'register_not_utf8', severity: 'error', message: `${f.name} is not valid UTF-8.` });
      continue;
    }
    let parsed;
    try { parsed = parseCsvRecords(text); } catch (e) {
      issues.push({ code: 'register_malformed', severity: 'error', message: `${f.name}: ${e.message}` });
      fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.FAILED, reason: e.message });
      continue;
    }
    warnings.push(...parsed.warnings.map((w) => `${f.name}: ${w}`));

    for (const rec of parsed.records) {
      const id = pick(rec, 'person_id', 'id', 'personid');
      const locator = `${f.name}#row:${rec.__row}`;
      if (!id) {
        issues.push({ code: 'person_missing_id', severity: 'error', message: `${locator}: row has no person ID.`, locator });
        continue;
      }
      if (byId.has(id)) {
        issues.push({ code: 'duplicate_person_id', severity: 'error', message: `${locator}: person ID ${id} already appeared at ${byId.get(id).sourceRow}. Kept the first row.`, locator, personId: id });
        continue;
      }
      const fullName = pick(rec, 'full_name_en', 'english_full_name', 'full_name', 'name');
      const birth = datePart(pick(rec, 'birth_date', 'birth', 'born'), pick(rec, 'birth_precision', 'birth_date_precision'));
      const death = datePart(pick(rec, 'death_date', 'death', 'died'), pick(rec, 'death_precision', 'death_date_precision'));
      const sourceRefs = splitList(pick(rec, 'source_refs', 'sources', 'source'));
      const status = STATUS_IN[String(pick(rec, 'record_status', 'status')).toLowerCase()] || CLAIM_STATUS.ACCEPTED;

      const person = {
        id,
        displayNameEn: fullName || displayNameFromFullName(pick(rec, 'original_name')) || id,
        originalName: pick(rec, 'original_name', 'name_original') || fullName || id,
        lifeYears: { birth, death, label: lifeYearsLabel(birth, death) },
        claimIds: [], photoIds: [], storyIds: [],
        gender: pick(rec, 'gender') || undefined,
        maidenName: pick(rec, 'maiden_name') || undefined,
        nameVariants: splitList(pick(rec, 'aliases', 'name_variants', 'alias')),
        birthPlace: pick(rec, 'birth_place', 'birthplace') || undefined,
        deathPlace: pick(rec, 'death_place') || undefined,
        notes: pick(rec, 'notes', 'note') || undefined,
        recordStatus: status,
        sourceRow: locator,
        importedFrom: f.name,
      };

      const addClaim = (predicate, value, extra = {}) => {
        if (value == null || value === '') return;
        const claim = {
          id: nextClaimId(), subjectId: id, predicate, value,
          sourceIds: sourceRefs, status: extra.status || status,
          evidenceType: EVIDENCE_TYPE.FAMILY_DOCUMENT,
          scope: 'supplied_register', reason: `Supplied in ${locator}`, version: 1,
          locator, ...extra,
        };
        claims.push(claim);
        person.claimIds.push(claim.id);
      };
      if (birth.value) addClaim('birth_date', birth.value, { precision: birth.precision, status: birth.precision === 'unknown' ? CLAIM_STATUS.UNRESOLVED : status });
      if (person.birthPlace) addClaim('birth_place', person.birthPlace);
      if (death.value) addClaim('death_date', death.value, { precision: death.precision });
      if (person.deathPlace) addClaim('death_place', person.deathPlace);
      for (const p of splitList(pick(rec, 'places', 'residence', 'residences'))) addClaim('residence', p);
      for (const o of splitList(pick(rec, 'occupation', 'occupations'))) addClaim('occupation', o);
      if (person.maidenName) addClaim('maiden_name', person.maidenName);

      people.push(person);
      byId.set(id, person);
    }
    fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.PARSED, rows: parsed.records.length, people: people.length });
  }

  // ---- relationship register + reconciliation ------------------------------
  const reconciliation = { rawRows: 0, retained: 0, merged: [], excluded: [] };
  for (const f of buckets.relationships) {
    let text;
    try { text = decodeUtf8(f.bytes); } catch {
      issues.push({ code: 'relationships_not_utf8', severity: 'error', message: `${f.name} is not valid UTF-8.` });
      continue;
    }
    let parsed;
    try { parsed = parseCsvRecords(text); } catch (e) {
      issues.push({ code: 'relationships_malformed', severity: 'error', message: `${f.name}: ${e.message}` });
      fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.FAILED, reason: e.message });
      continue;
    }
    warnings.push(...parsed.warnings.map((w) => `${f.name}: ${w}`));
    reconciliation.rawRows += parsed.records.length;

    const seenKey = new Map();
    const seenRelId = new Set();
    for (const rec of parsed.records) {
      const locator = `${f.name}#row:${rec.__row}`;
      const relId = pick(rec, 'relationship_id', 'rel_id', 'id') || `R${String(rec.__row).padStart(4, '0')}`;
      const from = pick(rec, 'from_person_id', 'from', 'person_1_id', 'parent_id');
      const to = pick(rec, 'to_person_id', 'to', 'person_2_id', 'child_id');
      const rawType = String(pick(rec, 'relationship_type', 'type')).toLowerCase().replace(/[\s-]+/g, '_');
      const type = REL_TYPE_IN[rawType] || rawType;
      const status = STATUS_IN[String(pick(rec, 'status', 'record_status')).toLowerCase()] || CLAIM_STATUS.PROPOSED;
      const sourceRefs = splitList(pick(rec, 'source_refs', 'sources', 'source'));

      if (seenRelId.has(relId)) {
        issues.push({ code: 'duplicate_relationship_id', severity: 'error', message: `${locator}: relationship ID ${relId} is reused.`, locator });
        reconciliation.excluded.push({ relationshipId: relId, locator, reason: 'duplicate relationship ID' });
        continue;
      }
      seenRelId.add(relId);

      const missing = [];
      if (!byId.has(from)) missing.push(from || '(blank)');
      if (!byId.has(to)) missing.push(to || '(blank)');
      if (missing.length) {
        issues.push({ code: 'relationship_missing_endpoint', severity: 'error', message: `${locator}: relationship ${relId} references unknown person ID(s) ${missing.join(', ')}. Excluded from the graph and retained as an issue.`, locator, relationshipId: relId, missing });
        reconciliation.excluded.push({ relationshipId: relId, locator, reason: `dangling reference to ${missing.join(', ')}` });
        continue;
      }
      if (from === to) {
        issues.push({ code: 'self_relationship', severity: 'error', message: `${locator}: relationship ${relId} links ${from} to itself.`, locator });
        reconciliation.excluded.push({ relationshipId: relId, locator, reason: 'self reference' });
        continue;
      }
      if (!REL_TYPE_IN[rawType]) {
        warnings.push(`${locator}: unrecognised relationship type "${rawType}" retained verbatim.`);
      }

      const key = type === RELATIONSHIP_TYPE.PARENT_CHILD ? `${type}:${from}>${to}` : `${type}:${[from, to].sort().join('~')}`;
      if (seenKey.has(key)) {
        const kept = seenKey.get(key);
        reconciliation.merged.push({ relationshipId: relId, mergedInto: kept, locator, reason: 'same pair, direction and type' });
        warnings.push(`${locator}: relationship ${relId} duplicates ${kept}; merged and recorded in the reconciliation.`);
        const existing = relationships.find((r) => r.id === kept);
        if (existing) existing.mergedFrom = [...(existing.mergedFrom || []), relId];
        continue;
      }
      seenKey.set(key, relId);

      const claim = {
        id: nextClaimId(), subjectId: from, predicate: `relationship_${type}`,
        value: { from, to, subtype: pick(rec, 'subtype', 'direction') || undefined },
        sourceIds: sourceRefs, status,
        evidenceType: EVIDENCE_TYPE.FAMILY_DOCUMENT,
        scope: 'supplied_register', reason: `Supplied in ${locator}`, version: 1, locator,
      };
      claims.push(claim);
      relationships.push({
        id: relId, fromPersonId: from, toPersonId: to, type,
        claimIds: [claim.id], status,
        subtype: pick(rec, 'subtype', 'direction') || undefined,
        sourceRow: locator,
      });
      reconciliation.retained += 1;
    }
    fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.PARSED, rows: parsed.records.length, retained: reconciliation.retained });
  }

  // ---- captions attach photos to people -----------------------------------
  for (const [id, src] of textSources) {
    if (!/caption/i.test(src.originalLocator)) continue;
    const fileM = /\b([\w\-. ]+\.(?:jpe?g|png))\b/i.exec(src.originalText);
    if (!fileM) continue;
    const asset = photoByName.get(fileM[1]);
    if (!asset) {
      warnings.push(`Caption ${src.originalLocator} names "${fileM[1]}", which was not uploaded.`);
      issues.push({ code: 'caption_photo_missing', severity: 'warning', message: `Caption at ${src.originalLocator} names photo "${fileM[1]}", which is not in the upload set.`, locator: src.originalLocator });
      continue;
    }
    asset.sourceId = id;
    asset.caption = src.originalText;
    asset.captionOrigin = src.originalLocator;
    const orderM = /\border[:=]\s*(\d+)/i.exec(src.originalText);
    if (orderM) asset.order = Number(orderM[1]);
    // Person links come only from the supplied annotation, never from the image.
    const ids = [...src.originalText.matchAll(/\b(P\d{2,4})\b/g)].map((m) => m[1]);
    const leftToRight = /left[\s-]?to[\s-]?right/i.test(src.originalText);
    for (const pid of ids) {
      if (!byId.has(pid)) {
        warnings.push(`Caption ${src.originalLocator} names unknown person ${pid}.`);
        continue;
      }
      asset.personIds.push(pid);
      const person = byId.get(pid);
      if (!person.photoIds.includes(asset.id)) person.photoIds.push(asset.id);
    }
    asset.orderIsSupplied = leftToRight && ids.length > 1;
    if (ids.length > 1 && !leftToRight) {
      asset.positionsUnknown = true;
      warnings.push(`Caption ${src.originalLocator} names ${ids.length} people without a left-to-right note; positions stay unknown.`);
    }
  }
  for (const asset of assets) {
    if (!asset.caption) warnings.push(`Photo ${asset.originalName} has no caption; identity and order stay unknown.`);
  }

  // ---- recollections become stories on their subject ----------------------
  for (const [id, src] of textSources) {
    if (/caption/i.test(src.originalLocator)) continue;
    const ids = [...src.originalText.matchAll(/\b(P\d{2,4})\b/g)].map((m) => m[1]).filter((p) => byId.has(p));
    if (!ids.length) continue;
    const subject = ids[0];
    const story = {
      id: `ST_${id}`,
      subjectId: subject,
      text: src.originalText,
      sourceIds: [id],
      evidenceRootId: src.evidenceRootId || id,
      evidenceType: EVIDENCE_TYPE.FAMILY_RECOLLECTION,
      attributedTo: src.author || null,
      // Supplied evidence is uploaded, not pre-accepted. The live review decides.
      status: CLAIM_STATUS.PROPOSED,
      locator: src.originalLocator,
    };
    stories.push(story);
    byId.get(subject).storyIds.push(story.id);
  }

  // ---- required inputs and cross-file checks ------------------------------
  for (const [key, spec] of Object.entries(SUPPORTED_INPUTS)) {
    if (spec.required && !buckets[key]?.length) {
      issues.push({ code: `missing_${key}`, severity: 'error', message: `Required input matching ${spec.pattern} was not supplied.` });
    }
  }
  for (const f of buckets.unsupported) {
    fileOutcomes.push({ originalName: f.name, status: FILE_STATUS.STORED_ONLY, reason: 'Filename does not match a supported packet input. Stored without parsing.' });
    warnings.push(`${f.name} is not a recognised packet input and was not parsed.`);
  }

  const citedSources = new Set();
  for (const c of claims) for (const s of c.sourceIds) citedSources.add(s);
  const knownSourceIds = new Set(sources.map((s) => s.id));
  for (const sid of citedSources) {
    if (!knownSourceIds.has(sid)) {
      issues.push({ code: 'cited_source_not_supplied', severity: 'warning', message: `Registers cite source "${sid}", which no supplied file defines.`, sourceId: sid });
    }
  }

  // Evidence roots: repeated copies of one memory must not read as corroboration.
  const inflated = [...evidenceRoots.entries()].filter(([, ids]) => ids.length > 1);
  for (const [root, ids] of inflated) {
    warnings.push(`Evidence root ${root} appears in ${ids.length} sources (${ids.join(', ')}). Counted once for corroboration.`);
  }

  const layout = deriveLayout(people, relationships);

  const report = {
    schemaVersion: SCHEMA_VERSION,
    filesSeen: files.length,
    totalBytes,
    recognised: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
    counts: {
      people: people.length,
      relationships: relationships.length,
      claims: claims.length,
      stories: stories.length,
      sources: sources.length,
      assets: assets.length,
      evidenceRoots: evidenceRoots.size,
    },
    reconciliation: {
      rawRows: reconciliation.rawRows,
      normalized: reconciliation.retained,
      mergedCount: reconciliation.merged.length,
      excludedCount: reconciliation.excluded.length,
      merged: reconciliation.merged,
      excluded: reconciliation.excluded,
    },
    pdfExtraction: overview ? { mode: overview.extractionMode, pages: overview.pdfPages } : null,
    errors: issues.filter((i) => i.severity === 'error').length,
  };

  if (manifest) {
    const expectPeople = manifest.selectedPersonIds?.length ?? manifest.expectedPeople;
    if (expectPeople != null && expectPeople !== people.length) {
      issues.push({ code: 'roster_mismatch', severity: 'error', message: `Manifest expects ${expectPeople} people; the packet produced ${people.length}.` });
    }
    const expectRels = manifest.expectedNormalizedRelationships;
    if (expectRels != null && expectRels !== reconciliation.retained) {
      issues.push({ code: 'relationship_count_mismatch', severity: 'error', message: `Manifest expects ${expectRels} normalized relationships; the packet produced ${reconciliation.retained}.` });
    }
    report.manifestChecked = true;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    people, relationships, claims, stories, sources, assets,
    history: [{
      eventId: 'H0001', at: new Date().toISOString(), actor: 'import',
      action: 'ingest_demo_packet', before: null,
      after: report.counts, origin: ORIGIN.PREPARED,
      note: 'Assembled from supplied family records. Reviewed during this session, not discovered.',
    }],
    layout, issues, warnings, files: fileOutcomes,
    evidenceRoots: Object.fromEntries(evidenceRoots),
    report,
    origin: ORIGIN.PREPARED,
  };
}

function deriveLayout(people, relationships) {
  const parents = new Map(people.map((p) => [p.id, []]));
  for (const r of relationships) {
    if (r.type !== RELATIONSHIP_TYPE.PARENT_CHILD) continue;
    if (parents.has(r.toPersonId)) parents.get(r.toPersonId).push(r.fromPersonId);
  }
  const generations = {};
  const visiting = new Set();
  const depth = (id) => {
    if (generations[id] != null) return generations[id];
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const ps = parents.get(id) || [];
    const d = ps.length ? Math.max(...ps.map(depth)) + 1 : 0;
    visiting.delete(id);
    generations[id] = d;
    return d;
  };
  for (const p of people) depth(p.id);
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
