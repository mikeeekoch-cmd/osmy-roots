/**
 * server/ingestion - Claude Code Mike
 *
 * Exports:
 *   importPreparedFamily({seedJson, mediaFiles, sourceDocuments}) -> ImportResult
 *   ingestContribution({text, files, targetPersonId}) -> IngestionResult
 *
 * Neither function calls a model and neither commits a graph edit. They return
 * typed objects and bytes; the lead persists them and runs Astra on the text.
 *
 * @see docs/PROTOTYPE-CONTRACT.md "Claude exports these functions"
 */

import { sha256, shortHash } from './hash.mjs';
import { normalizeSeed } from './normalize-seed.mjs';
import { detectMediaType, extensionOf, isImage, isAudioOrVideo } from './media-type.mjs';
import { decodeUtf8, segmentText, lineLocator, parseJsonSafely } from './parse-text.mjs';
import { ORIGIN, FILE_STATUS, PARSEABLE_TEXT_TYPES, SCHEMA_VERSION } from '../contracts/types.mjs';
import { extractPdfTextWithPages, MAX_PDF_PAGES } from './pdf.mjs';
import { readUploadZip, parseChatText } from './zip.mjs';

export { normalizeSeed, parseDate } from './normalize-seed.mjs';
export { searchableTextOf } from './searchable.mjs';
export { parseFamilyPacket } from './packet.mjs';
export { parseFamilyNotesPacket } from './family-notes.mjs';
export { parseCsvWithSpans as parseCsv } from './csv.mjs';
export { readUploadZip, parseChatText } from './zip.mjs';

const toBuffer = (b) => (Buffer.isBuffer(b) ? b : Buffer.from(b));

function assetIdFor(hash, seq) { return `A_${shortHash(hash, 10)}_${String(seq).padStart(3, '0')}`; }
function sourceIdFor(hash, seq) { return `SRC_${shortHash(hash, 10)}_${String(seq).padStart(3, '0')}`; }

/** Opaque private storage key. Never an absolute host path, never a public URL. */
function storageKeyFor(assetId, originalName) {
  const ext = extensionOf(originalName);
  return `assets/${assetId}${ext ? `.${ext}` : ''}`;
}

/**
 * Person id hint from a media path such as "photo to use/P005_Ivan/portrait.jpg".
 * Returns null when the path carries no explicit person id: we never infer a
 * person from image content.
 */
export function personIdFromPath(pathOrName) {
  const m = /(?:^|[\\/])(P\d{3,4})(?:[_\-\/]|$)/.exec(String(pathOrName || ''));
  return m ? m[1] : null;
}

/**
 * Normalize the prior private family project.
 *
 * @param {object} args
 * @param {object} args.seedJson                  prior family_tree.json
 * @param {Array<{originalName:string,bytes:Buffer,path?:string,personId?:string,caption?:string,mediaType?:string}>} [args.mediaFiles]
 * @param {Array<{id?:string,originalName:string,bytes:Buffer,kind?:string,author?:string,rightsNote?:string}>} [args.sourceDocuments]
 *        The actual source register files (e.g. S001_whatsapp_*.md). Their text is
 *        preserved verbatim so citations and local search resolve to real content.
 * @param {string} [args.sourceLabel]
 * @returns {Promise<object>} ImportResult
 */
export async function importPreparedFamily({ seedJson, mediaFiles = [], sourceDocuments = [], sourceLabel = 'family_tree.json' } = {}) {
  if (!seedJson || typeof seedJson !== 'object') {
    throw new TypeError('importPreparedFamily requires seedJson');
  }

  const normalized = normalizeSeed(seedJson, { sourceLabel });
  const warnings = [...normalized.warnings];
  const issues = [...normalized.issues];
  const sources = [];
  const assets = [];
  const hashIndex = new Map();

  // 1. Preserve the real source register documents verbatim.
  let srcSeq = 0;
  for (const doc of sourceDocuments) {
    srcSeq += 1;
    const bytes = toBuffer(doc.bytes);
    const contentHash = sha256(bytes);
    const mediaType = detectMediaType(doc.originalName, bytes, doc.mediaType);
    let originalText = '';
    try {
      originalText = decodeUtf8(bytes);
    } catch {
      warnings.push(`Source document ${doc.originalName} is not UTF-8 text; retained as bytes only.`);
    }
    const id = doc.id ? String(doc.id) : sourceIdFor(contentHash, srcSeq);
    sources.push({
      id,
      kind: doc.kind || 'family_document',
      originalLocator: doc.originalName,
      contentHash,
      origin: ORIGIN.PREPARED,
      author: doc.author != null ? String(doc.author) : null,
      messageTimestamp: null,
      parentAttachmentId: null,
      originalText,
      title: doc.originalName,
      mediaType,
      byteLength: bytes.length,
      rightsNote: doc.rightsNote || 'Private family material. Not approved for public reproduction.',
      publicUseApproved: false,
      segments: originalText ? segmentText(originalText).map((s) => ({
        index: s.index, startLine: s.startLine, endLine: s.endLine,
        locator: lineLocator(doc.originalName, s.startLine, s.endLine), text: s.text,
      })) : [],
    });
  }

  // 2. Attach media as assets. A photo is storage and display, never identification.
  let assetSeq = 0;
  for (const file of mediaFiles) {
    assetSeq += 1;
    const bytes = toBuffer(file.bytes);
    const contentHash = sha256(bytes);
    const mediaType = detectMediaType(file.originalName, bytes, file.mediaType);
    const id = assetIdFor(contentHash, assetSeq);

    if (hashIndex.has(contentHash)) {
      warnings.push(`Duplicate media ${file.originalName} matches ${hashIndex.get(contentHash)} by hash; both retained with the same content hash.`);
    } else {
      hashIndex.set(contentHash, id);
    }

    const personId = file.personId || personIdFromPath(file.path || file.originalName);
    const asset = {
      id,
      sourceId: null,
      originalName: file.originalName,
      mediaType,
      byteLength: bytes.length,
      contentHash,
      storageKey: storageKeyFor(id, file.originalName),
      caption: file.caption != null ? String(file.caption) : undefined,
      captionOrigin: file.caption != null ? 'supplied' : undefined,
      personId: personId || undefined,
      origin: ORIGIN.PREPARED,
      bytes,
    };
    if (!isImage(mediaType)) {
      warnings.push(`Prepared media ${file.originalName} is ${mediaType}, not an image; stored without preview.`);
    }
    assets.push(asset);

    if (personId) {
      const person = normalized.people.find((p) => p.id === personId);
      if (person) person.photoIds.push(id);
      else {
        const w = `Media ${file.originalName} names person ${personId}, who is not in the seed. Asset kept unattached.`;
        warnings.push(w);
        issues.push({ code: 'media_missing_person', message: w, severity: 'warning', assetId: id, personId });
      }
    }
  }

  // 3. Claims cite source refs by their original token; surface any that have no document.
  const knownSourceIds = new Set(sources.map((s) => s.id));
  const citedButAbsent = new Set();
  for (const claim of normalized.claims) {
    for (const sid of claim.sourceIds) if (!knownSourceIds.has(sid)) citedButAbsent.add(sid);
  }
  for (const sid of citedButAbsent) {
    const w = `Claims cite source "${sid}" but no source document was supplied. Citation retained; text cannot be verified locally.`;
    warnings.push(w);
    issues.push({ code: 'cited_source_not_supplied', message: w, severity: 'warning', sourceId: sid });
    sources.push({
      id: sid,
      kind: /^https?:|pamyat|archive/i.test(sid) ? 'archive_record' : 'family_memory',
      originalLocator: sid,
      contentHash: null,
      origin: ORIGIN.PREPARED,
      author: null,
      messageTimestamp: null,
      parentAttachmentId: null,
      originalText: '',
      title: sid,
      unresolved: true,
      rightsNote: 'Referenced by imported claims. Original document not supplied to this import.',
      publicUseApproved: false,
      segments: [],
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    people: normalized.people,
    relationships: normalized.relationships,
    claims: normalized.claims,
    stories: normalized.stories,
    sources,
    assets,
    history: normalized.history,
    layout: normalized.layout,
    issues,
    warnings,
    counts: {
      people: normalized.people.length,
      relationships: normalized.relationships.length,
      claims: normalized.claims.length,
      stories: normalized.stories.length,
      sources: sources.length,
      assets: assets.length,
    },
    origin: ORIGIN.PREPARED,
    note: 'Imported existing family records. This is supplied evidence, not a new discovery.',
  };
}

/**
 * Ingest one human contribution: pasted text and/or selected files.
 *
 * @param {object} args
 * @param {string} [args.text]
 * @param {Array<{uploadId?:string,originalName:string,bytes:Buffer,mediaType?:string}>} [args.files]
 * @param {string} [args.targetPersonId]  attach hint only; no graph edit is made here
 * @param {string[]} [args.knownHashes]   hashes already saved, for the lead's dedup
 * @returns {Promise<object>} IngestionResult
 */
export async function ingestContribution({ text, files = [], targetPersonId, knownHashes = [] } = {}) {
  const sources = [];
  const assets = [];
  const fileOutcomes = [];
  const duplicateHashes = [];
  const known = new Set(knownHashes);
  const seenThisCall = new Map();
  let seq = 0;
  const zipBudget = { expandedBytes: 0 };

  const noteDuplicate = (hash, label) => {
    if (known.has(hash) || seenThisCall.has(hash)) {
      duplicateHashes.push({ contentHash: hash, originalName: label, previously: seenThisCall.get(hash) || 'saved_project' });
      return true;
    }
    return false;
  };

  // Pasted text becomes a first-class source with a resolvable locator.
  if (typeof text === 'string' && text.trim()) {
    seq += 1;
    const bytes = Buffer.from(text, 'utf8');
    const contentHash = sha256(bytes);
    const name = `pasted-text-${shortHash(contentHash, 8)}.txt`;
    const isDup = noteDuplicate(contentHash, name);
    seenThisCall.set(contentHash, name);
    const segments = segmentText(text).map((s) => ({
      index: s.index, startLine: s.startLine, endLine: s.endLine,
      locator: lineLocator(name, s.startLine, s.endLine), text: s.text,
    }));
    const id = sourceIdFor(contentHash, seq);
    sources.push({
      id,
      kind: 'family_memory',
      originalLocator: lineLocator(name, 1, String(text).split(/\r\n|\r|\n/).length),
      contentHash,
      origin: ORIGIN.LIVE,
      // No author or message time is known for pasted text, and a wall-clock
      // timestamp is not a substitute for one.
      author: null,
      messageTimestamp: null,
      parentAttachmentId: null,
      originalText: text,
      title: 'Pasted contribution',
      mediaType: 'text/plain',
      byteLength: bytes.length,
      targetPersonId: targetPersonId || null,
      segments,
      isDuplicate: isDup,
      bytes,
    });
  }

  for (const file of files) {
    seq += 1;
    const uploadId = file.uploadId || `U${String(seq).padStart(3, '0')}`;
    const originalName = String(file.originalName || `upload-${seq}`);
    const warnings = [];
    const sourceIds = [];
    const assetIds = [];

    let bytes;
    try {
      bytes = toBuffer(file.bytes);
    } catch (e) {
      fileOutcomes.push({ uploadId, originalName, status: FILE_STATUS.FAILED, sourceIds, assetIds, warnings, reason: `Unreadable upload: ${e.message}` });
      continue;
    }
    if (!bytes.length) {
      fileOutcomes.push({ uploadId, originalName, status: FILE_STATUS.FAILED, sourceIds, assetIds, warnings, reason: 'Empty file' });
      continue;
    }

    const contentHash = sha256(bytes);
    const mediaType = detectMediaType(originalName, bytes, file.mediaType);
    const isDup = noteDuplicate(contentHash, originalName);
    if (isDup) warnings.push('Content hash matches an already supplied file.');
    seenThisCall.set(contentHash, originalName);

    // The selected PDF and reconstructed chat formats are genuinely extracted.
    if (mediaType === 'application/pdf' || mediaType === 'application/zip') {
      const archiveAssetId = assetIdFor(contentHash, seq);
      const originalAsset = { id: archiveAssetId, sourceId: null, originalName, mediaType, byteLength: bytes.length, contentHash, storageKey: storageKeyFor(archiveAssetId, originalName), origin: ORIGIN.LIVE, bytes };
      assets.push(originalAsset); assetIds.push(archiveAssetId);
      try {
        if (mediaType === 'application/pdf') {
          // The locator states the pages actually read, so a citation into page 14 of an
          // excerpt is checkable and a truncated read is visible rather than implied.
          const extracted = await extractPdfTextWithPages(bytes), originalText = extracted.text, id = sourceIdFor(contentHash, seq);
          if (extracted.truncated) warnings.push(`${originalName} was read to the ${MAX_PDF_PAGES}-page limit; later pages are not searchable or citable.`);
          sources.push({ id, kind: 'family_document', originalLocator: `${originalName}#extracted-pages-1-${extracted.pages}`, contentHash, originalText, origin: ORIGIN.LIVE, author: null, messageTimestamp: null, parentAttachmentId: archiveAssetId, title: originalName, language: 'en', extractionMethod: `Poppler pdftotext: actual text extraction, up to ${MAX_PDF_PAGES} pages; no OCR`, segments: segmentText(originalText), mediaType });
          originalAsset.sourceId = id; sourceIds.push(id);
        } else {
          const entries = readUploadZip(bytes, zipBudget), chats = entries.filter((e) => /(?:^|\/)_chat\.txt$/i.test(e.name));
          if (chats.length !== 1) throw new Error('Chat ZIP must contain exactly one UTF-8 _chat.txt');
          const metadataEntry = entries.find((e) => /(?:^|\/)metadata\.json$/i.test(e.name));
          if (chats[0].bytes.length > 2_000_000 || (metadataEntry?.bytes.length || 0) > 512_000) throw new Error('Chat text or metadata exceeds its extraction limit');
          const metadata = metadataEntry ? JSON.parse(decodeUtf8(metadataEntry.bytes)) : {};
          const chat = chats[0], originalText = decodeUtf8(chat.bytes), id = typeof metadata.sourceId === 'string' ? metadata.sourceId : sourceIdFor(sha256(chat.bytes), seq);
          const reconstructed = metadata.reconstruction === true || metadata.reconstructed === true;
          const locator = `${originalName}/${chat.name}`;
          const messages = parseChatText(originalText, locator).map((message) => {
            const metadataMessages = metadata.messages || [];
            const zeroBased = metadataMessages.some((p) => p.index === 0);
            const provenance = metadataMessages.find((p) => p.ordinal === message.index || p.index === message.index - (zeroBased ? 1 : 0) || p.messageIndex === message.index);
            return { ...message, ...(provenance ? { evidenceRootId: provenance.evidenceRootId, originalLocator: provenance.originalLocator, attribution: provenance.attribution, sourceSpan: provenance.sourceSpan } : {}) };
          });
          sources.push({ id, kind: reconstructed ? 'reconstructed_chat' : 'uploaded_chat', originalLocator: locator, contentHash: sha256(chat.bytes), archiveHash: contentHash, originalText, origin: reconstructed ? ORIGIN.PREPARED : ORIGIN.LIVE, author: metadata.attribution || metadata.actualAuthor || null, messageTimestamp: null, parentAttachmentId: archiveAssetId, title: originalName, language: 'en', extractionMethod: reconstructed ? 'UTF-8 chat ZIP extraction; dialogue and timestamps are reconstructed scaffolding, not historical messages' : 'UTF-8 chat ZIP extraction', evidenceRootId: metadata.evidenceRootId || contentHash, lineage: metadata.lineage || [], reconstructionMetadata: metadata, segments: messages, bytes: chat.bytes, mediaType: 'text/plain' });
          originalAsset.sourceId = id; sourceIds.push(id);
          for (const entry of entries) {
            if (entry === chat || entry === metadataEntry) continue;
            const attachmentType = detectMediaType(entry.name, entry.bytes);
            if (!isImage(attachmentType) && !['text/plain', 'application/json'].includes(attachmentType)) { warnings.push(`Unsupported chat attachment ${entry.name} was not extracted.`); continue; }
            const attachmentHash = sha256(entry.bytes), attachmentId = `chat-${shortHash(contentHash, 8)}-${shortHash(attachmentHash, 10)}`;
            assets.push({ id: attachmentId, sourceId: id, originalName: entry.name.split('/').at(-1), mediaType: attachmentType, byteLength: entry.bytes.length, contentHash: attachmentHash, storageKey: `assets/${attachmentId}`, origin: ORIGIN.PREPARED, bytes: entry.bytes }); assetIds.push(attachmentId);
          }
          const attachmentRefs = [...originalText.matchAll(/(?:<attached:\s*([^>]+)>|([^\n]+?)\s*\(file attached\))/gi)].map((m) => (m[1] || m[2]).trim());
          for (const ref of attachmentRefs) if (!entries.some((e) => e.name === ref || e.name.endsWith(`/${ref}`))) warnings.push(`Chat attachment missing: ${ref}`);
          if (reconstructed) warnings.push('Reconstructed chat: source attribution and evidence roots remain distinct from speaker/time scaffolding.');
        }
        fileOutcomes.push({ uploadId, originalName, status: FILE_STATUS.PARSED, sourceIds, assetIds, warnings, mediaType, contentHash });
      } catch (e) { fileOutcomes.push({ uploadId, originalName, status: FILE_STATUS.FAILED, sourceIds: [], assetIds, warnings, mediaType, contentHash, reason: `Extraction failed: ${e.message}` }); }
      continue;
    }

    // Images: stored and displayable. No OCR, no face identification.
    if (isImage(mediaType)) {
      const id = assetIdFor(contentHash, seq);
      assets.push({
        id, sourceId: null, originalName, mediaType, byteLength: bytes.length, contentHash,
        storageKey: storageKeyFor(id, originalName),
        personId: targetPersonId || undefined, origin: ORIGIN.LIVE, bytes,
      });
      assetIds.push(id);
      warnings.push('Image stored for display. No text extraction, OCR or face identification was performed.');
      fileOutcomes.push({ uploadId, originalName, status: FILE_STATUS.STORED_ONLY, sourceIds, assetIds, warnings, mediaType, contentHash, reason: 'Image stored for display only.' });
      continue;
    }

    // Text formats we genuinely decode.
    if (PARSEABLE_TEXT_TYPES.includes(mediaType)) {
      let decoded;
      try {
        decoded = decodeUtf8(bytes);
      } catch {
        const id = assetIdFor(contentHash, seq);
        assets.push({ id, sourceId: null, originalName, mediaType, byteLength: bytes.length, contentHash, storageKey: storageKeyFor(id, originalName), origin: ORIGIN.LIVE, bytes });
        assetIds.push(id);
        warnings.push('File is not valid UTF-8 text; stored without extraction.');
        fileOutcomes.push({ uploadId, originalName, status: FILE_STATUS.STORED_ONLY, sourceIds, assetIds, warnings, mediaType, contentHash, reason: 'Not valid UTF-8.' });
        continue;
      }
      if (mediaType === 'application/json') {
        const parsed = parseJsonSafely(decoded);
        if (!parsed.ok) warnings.push(`JSON did not parse (${parsed.error}); original text retained and cited as text.`);
      }
      const id = sourceIdFor(contentHash, seq);
      const lines = decoded.split(/\r\n|\r|\n/).length;
      sources.push({
        id,
        kind: 'family_document',
        originalLocator: lineLocator(originalName, 1, lines),
        contentHash,
        origin: ORIGIN.LIVE,
        author: null,
        messageTimestamp: null,
        parentAttachmentId: null,
        originalText: decoded,
        title: originalName,
        mediaType,
        byteLength: bytes.length,
        targetPersonId: targetPersonId || null,
        segments: segmentText(decoded).map((s) => ({
          index: s.index, startLine: s.startLine, endLine: s.endLine,
          locator: lineLocator(originalName, s.startLine, s.endLine), text: s.text,
        })),
        isDuplicate: isDup,
        bytes,
      });
      sourceIds.push(id);
      fileOutcomes.push({ uploadId, originalName, status: FILE_STATUS.PARSED, sourceIds, assetIds, warnings, mediaType, contentHash });
      continue;
    }

    // Everything else is stored with an explicit, honest reason.
    const id = assetIdFor(contentHash, seq);
    assets.push({ id, sourceId: null, originalName, mediaType, byteLength: bytes.length, contentHash, storageKey: storageKeyFor(id, originalName), origin: ORIGIN.LIVE, bytes });
    assetIds.push(id);
    const reason = isAudioOrVideo(mediaType)
      ? `${mediaType} is not transcribed in this prototype; stored without extraction.`
      : mediaType === 'application/zip'
        ? 'Archive stored without extraction. Native chat-export parsing is not implemented; no compatibility is claimed.'
        : `${mediaType} is not parsed in this prototype; stored without extraction.`;
    warnings.push(reason);
    fileOutcomes.push({ uploadId, originalName, status: FILE_STATUS.STORED_ONLY, sourceIds, assetIds, warnings, mediaType, contentHash, reason });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    sources,
    assets,
    duplicateHashes,
    files: fileOutcomes,
    targetPersonId: targetPersonId || null,
  };
}
