/**
 * server/export - Claude Code Mike
 *
 * Exports:
 *   buildFamilyBundle({snapshot, passages, resolveAsset, options}) -> {bytes, filename, mimeType, manifest}
 *
 * The bundle is built from the CURRENT snapshot and the CURRENT passages the lead
 * supplies. It is never a download of an unchanged earlier book.
 *
 * @see docs/PROTOTYPE-CONTRACT.md
 */

import { createZip } from './zip.mjs';
import { renderBookPdf } from './book-pdf.mjs';
import { renderBookEdition } from './book-edition.mjs';
import { renderBookHtml } from './book-html.mjs';
import { selectBranch, deepestLineFocus } from './branch.mjs';
import { partitionPassages, openQuestionsFrom } from './select.mjs';
import { selectEnglishSources, checkEnglishText, isEnglishFilename } from './english.mjs';
import { preparationKey } from './preparation.mjs';
import { SCHEMA_VERSION } from '../contracts/types.mjs';
import { sha256 } from '../ingestion/hash.mjs';

export { renderBookPdf } from './book-pdf.mjs';
export { renderBookEdition, TARGET_MIN_PAGES, TARGET_MAX_PAGES } from './book-edition.mjs';
export { renderBookHtml } from './book-html.mjs';
export { selectBranch, deepestLineFocus } from './branch.mjs';
export { createZip } from './zip.mjs';
export { partitionPassages } from './select.mjs';
export { preparationKey, isPreparedStillCurrent, PreparedBundleCache } from './preparation.mjs';
export { selectEnglishSources, hasNonLatinScript } from './english.mjs';
export { buildFamilyBundleFromContract } from './contract-adapter.mjs';

const extFor = (mediaType, originalName) => {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(originalName || ''));
  if (m) return m[1].toLowerCase();
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'text/plain': 'txt', 'application/json': 'json' };
  return map[mediaType] || 'bin';
};

/** Portable, collision-free relative path. Never derived from a client-supplied path. */
function bundlePath(folder, asset) {
  return `${folder}/${asset.id}.${extFor(asset.mediaType, asset.originalName)}`;
}

/**
 * @param {object} args
 * @param {object} args.snapshot                current ProjectSnapshot
 * @param {Array}  [args.passages]              current BookPassages from the lead
 * @param {Function} args.resolveAsset          (assetId) => {bytes, mediaType, originalName} | null
 * @param {object} [args.options]               {focusPersonId, title, dedication, projectName}
 * @returns {Promise<{bytes:Buffer, filename:string, mimeType:string, manifest:object}>}
 */
export async function buildFamilyBundle({ snapshot, passages = [], resolveAsset, options = {} } = {}) {
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('buildFamilyBundle requires a snapshot');
  if (typeof resolveAsset !== 'function') throw new TypeError('buildFamilyBundle requires resolveAsset(assetId)');

  const startedAt = Date.now();
  const warnings = [];
  const version = snapshot.version ?? 0;

  // The chapter subject and the root of the printed branch can differ: the branch is
  // usually drawn from the youngest person, while the chapter is about an ancestor.
  const focusPersonId = options.focusPersonId || snapshot.focusPersonId || deepestLineFocus(snapshot);
  const branchRootId = options.branchRootId || focusPersonId;
  const branch = selectBranch(snapshot, { focusPersonId: branchRootId, generations: options.generations || 5 });

  // Which originals travel in the bundle. Default is the printed branch, so a
  // download stays usable; project.json still lists every asset either way.
  // Pass includeAssets: 'all' to bundle the whole archive.
  const includeAssets = options.includeAssets || 'branch';
  const branchSet = new Set(branch.personIds);
  const inScope = (asset) => {
    if (includeAssets === 'all') return true;
    if (includeAssets === 'none') return false;
    if (!asset.personId) return true;                 // unattached uploads always travel
    return branchSet.has(asset.personId) || asset.personId === focusPersonId;
  };

  // Resolve every in-scope asset ONCE, through the lead's resolver only.
  const assetPaths = new Map();
  const resolvedAssets = new Map();
  const assetManifest = [];
  const missingAssets = [];
  const omittedAssets = [];
  for (const asset of snapshot.assets || []) {
    if (!inScope(asset)) {
      omittedAssets.push({ assetId: asset.id, originalName: asset.originalName, personId: asset.personId || null, reason: 'outside the selected branch' });
      continue;
    }
    let resolved = null;
    try {
      resolved = resolveAsset(asset.id);
    } catch (e) {
      warnings.push(`Asset ${asset.id} (${asset.originalName}) failed to resolve: ${e.message}`);
    }
    if (!resolved || !resolved.bytes) {
      missingAssets.push({ assetId: asset.id, originalName: asset.originalName, reason: 'not resolved by the asset resolver' });
      warnings.push(`Attachment missing from bundle: ${asset.originalName || asset.id} could not be resolved.`);
      continue;
    }
    const bytes = Buffer.isBuffer(resolved.bytes) ? resolved.bytes : Buffer.from(resolved.bytes);
    const mediaType = resolved.mediaType || asset.mediaType;
    const folder = String(mediaType || '').startsWith('image/') ? 'photos' : 'uploads';
    const rel = bundlePath(folder, { ...asset, mediaType });
    const actualHash = sha256(bytes);
    if (asset.contentHash && actualHash !== asset.contentHash) {
      warnings.push(`Asset ${asset.id} bytes do not match the recorded content hash. Bundled the resolved bytes and flagged the mismatch.`);
    }
    assetPaths.set(asset.id, rel);
    resolvedAssets.set(asset.id, { bytes, mediaType, path: rel });
    assetManifest.push({
      assetId: asset.id, path: rel, originalName: asset.originalName, mediaType,
      byteLength: bytes.length, contentHash: actualHash,
      hashMatchesProject: asset.contentHash ? actualHash === asset.contentHash : null,
      personId: asset.personId || null, caption: asset.caption || null,
    });
  }

  // English-only demo output. `raw` keeps the general-purpose behaviour intact.
  const englishOnly = options.englishOnly !== false && options.mode !== 'raw';
  const guardFailures = [];
  let exportSources = snapshot.sources || [];
  let withheldSources = [];
  let needsDerivative = [];
  if (englishOnly) {
    const picked = selectEnglishSources(exportSources);
    exportSources = picked.sources;
    withheldSources = picked.excluded;
    needsDerivative = picked.needsDerivative;
    for (const n of needsDerivative) {
      warnings.push(`Source ${n.id} (${n.locator}) is not English; its text is withheld from the bundle and only its locator and lineage travel. Supply an English derivative.`);
    }
    for (const e of withheldSources) warnings.push(`Source ${e.id} excluded from the English bundle: ${e.reason}.`);
    guardFailures.push(...checkEnglishText(snapshot.stories?.filter((x) => x.status === 'accepted') || [], 'Story'));
  }
  const exportSnapshot = englishOnly ? { ...snapshot, sources: exportSources } : snapshot;

  const { current: currentPassages, stale, invalid } = partitionPassages(passages, version);

  // --- book.pdf. With a book plan the download is the full paginated edition; the
  // four-page layout stays the fallback and the compact mode for older packets.
  let pdf;
  let edition = null;
  const cuts = [];
  const wantsEdition = Boolean(options.bookPlan) && options.edition !== 'compact';
  if (wantsEdition) {
    try {
      edition = renderBookEdition({
        snapshot: exportSnapshot, bookPlan: options.bookPlan, passages,
        photoPairs: options.photoPairs || [], portraits: options.portraits || [],
        options: { ...options, focusPersonId, englishOnly },
        getImage: (assetId) => resolvedAssets.get(assetId) || null,
      });
      pdf = { bytes: edition.bytes, pages: edition.pages, warnings: edition.warnings, cuts: edition.cuts };
    } catch (e) {
      warnings.push(`Full edition failed (${e.message}). Falling back to the four-page layout with the same evidence.`);
      cuts.push('full_edition');
      edition = null;
    }
  }
  if (!pdf) {
    try {
      pdf = renderBookPdf({
        snapshot: exportSnapshot, passages, branch, options: { ...options, focusPersonId, englishOnly },
        getImage: (assetId) => resolvedAssets.get(assetId) || null,
      });
    } catch (e) {
      warnings.push(`Four-page book layout failed (${e.message}). Falling back to a short PDF with the same essential content.`);
      cuts.push('four_page_layout');
      pdf = renderBookPdf({
        snapshot: { ...exportSnapshot, assets: [] }, passages, branch,
        options: { ...options, focusPersonId, englishOnly }, getImage: () => null,
      });
    }
  }
  warnings.push(...pdf.warnings);
  cuts.push(...(pdf.cuts || []));
  guardFailures.push(...(pdf.guardFailures || []));

  const bookHtml = renderBookHtml({ snapshot: exportSnapshot, passages, branch, assetPaths, options: { ...options, focusPersonId, photoPairs: options.photoPairs || [], bookPlan: edition ? options.bookPlan : null } });

  // --- project.json keeps ALL people and edges, not only the printed branch.
  const projectJson = {
    schemaVersion: SCHEMA_VERSION,
    projectId: snapshot.projectId || null,
    version,
    exportedAt: new Date().toISOString(),
    input: snapshot.input || null,
    focusPersonId,
    people: snapshot.people || [],
    relationships: snapshot.relationships || [],
    claims: snapshot.claims || [],
    stories: snapshot.stories || [],
    proposals: snapshot.proposals || [],
    history: snapshot.history || [],
    bookPassages: passages,
    bookStatus: {
      printedPassages: currentPassages.map((p) => p.id),
      stalePassages: stale.map((s) => ({ id: s.passage?.id, reason: s.reason })),
      invalidPassages: invalid.map((i) => ({ id: i.passage?.id, reason: i.reason })),
    },
    layout: snapshot.layout || null,
    branch: { rootPersonId: branchRootId, chapterPersonId: focusPersonId, personIds: branch.personIds, generations: options.generations || 5 },
    assets: (snapshot.assets || []).map((a) => ({
      id: a.id, originalName: a.originalName, mediaType: a.mediaType,
      byteLength: a.byteLength, contentHash: a.contentHash, personId: a.personId || null,
      caption: a.caption || null, path: assetPaths.get(a.id) || null,
    })),
    note: 'Portable project export. Reimport with the same schemaVersion. Imported records are supplied family evidence, not new discoveries.',
  };

  const sourcesJson = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    language: englishOnly ? 'en' : 'raw',
    count: exportSources.length,
    withheldPrivateSources: withheldSources.length,
    sources: exportSources.map((s) => ({
      id: s.id, kind: s.kind, title: s.title || null, originalLocator: s.originalLocator,
      contentHash: s.contentHash, origin: s.origin, author: s.author ?? null,
      messageTimestamp: s.messageTimestamp ?? null, mediaType: s.mediaType || null,
      byteLength: s.byteLength ?? null, finalUrl: s.finalUrl || null,
      retrievedAt: s.retrievedAt || null, unresolved: !!s.unresolved,
      publicUseApproved: s.publicUseApproved === true,
      rightsNote: s.rightsNote || null,
      evidenceRootId: s.evidenceRootId || s.id,
      reconstruction: s.reconstruction || null,
      derivedFrom: s.derivedFrom || null,
      textWithheld: s.textWithheld === true,
      originalText: s.originalText || '',
    })),
    note: 'Original text is retained so every citation can be checked against its source.',
  };

  const researchNotes = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    events: snapshot.researchEvents || [],
    counters: snapshot.counters || null,
    openQuestions: openQuestionsFrom(snapshot),
    importIssues: snapshot.issues || [],
    exportWarnings: warnings,
    guardFailures,
    missingAssets,
    omittedAssets,
    stalePassages: stale.map((s) => ({ id: s.passage?.id, reason: s.reason })),
    cuts,
    note: 'Counters reflect completed operations only. Zero retrieved websites is a valid result.',
  };

  const startingContext = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    input: snapshot.input || null,
    seedOrigin: snapshot.seedOrigin || 'prepared',
    focusPersonId,
    counts: {
      people: (snapshot.people || []).length,
      relationships: (snapshot.relationships || []).length,
      claims: (snapshot.claims || []).length,
      stories: (snapshot.stories || []).length,
      sources: (snapshot.sources || []).length,
      assets: (snapshot.assets || []).length,
      branchPeople: branch.personIds.length,
    },
    note: 'What the project started from, so a reader can tell supplied evidence from later additions.',
  };

  const coverageLedger = edition
    ? buildCoverageLedger({
      edition, snapshot: exportSnapshot, bookPlan: options.bookPlan, assetPaths,
      photoPairs: options.photoPairs || [], oldPhotoAssetIds: options.oldPhotoAssetIds || [],
    })
    : null;

  const readme = `# Roots family project export

Generated ${new Date().toISOString()} from project version ${version}.

## What is in this bundle

| File | Contents |
| --- | --- |
| book.pdf | Illustrated English book, ${pdf.pages} page(s)${edition ? `, ${edition.sections.length} sections` : ''} |${coverageLedger ? '\n| coverage.json | Every input file mapped to its sources, people, chapters, book pages and archive path |' : ''}
| book.html | The same book as a readable web page |
| project.json | Complete editable project: every person, relationship, claim, story and history entry |
| sources.json | Every source with its exact locator, hash and original text |
| research-notes.json | Research events, open questions, import issues and export warnings |
| starting-context.json | What the project started from |
| photos/ | Original photographs, unmodified |
| uploads/ | Other original files, unmodified |

Originals bundled: \`${includeAssets}\` scope (${assetManifest.length} of ${(snapshot.assets || []).length}).${omittedAssets.length ? ` ${omittedAssets.length} original(s) outside the printed branch are listed in project.json and research-notes.json but not copied here; re-export with includeAssets: 'all' for the complete archive.` : ''}

## Reimporting

Load \`project.json\` in the local Roots app. It carries \`schemaVersion: ${SCHEMA_VERSION}\`,
stable person and relationship ids, and full edit history, so accepted changes and
corrections survive a round trip. Paths in this bundle are relative; nothing points
back at the machine that produced it.

## How to read the evidence

- A bracketed number in the book cites the numbered source list on the last page.
- An accepted family recollection stays labelled a recollection. It is not archival proof.
- \`Unknown\` means the value is genuinely unknown; it is never filled in with a guess.
- Imported records from the prior family project are supplied evidence, not new discoveries.
${stale.length ? `\n**${stale.length} passage(s) were excluded as stale** and are listed in research-notes.json. They were written against an older project version.\n` : ''}${missingAssets.length ? `\n**${missingAssets.length} attachment(s) could not be resolved** and are listed in research-notes.json.\n` : ''}`;

  const editableMapHtml = renderEditableMap(snapshot, branch, assetPaths);

  const entries = [
    { path: 'book.pdf', bytes: pdf.bytes, store: true },
    { path: 'book.html', bytes: bookHtml },
    { path: 'editable-family-map.html', bytes: editableMapHtml },
    { path: 'project.json', bytes: JSON.stringify(projectJson, null, 2) },
    { path: 'sources.json', bytes: JSON.stringify(sourcesJson, null, 2) },
    { path: 'research-notes.json', bytes: JSON.stringify(researchNotes, null, 2) },
    { path: 'starting-context.json', bytes: JSON.stringify(startingContext, null, 2) },
    { path: 'README.md', bytes: readme },
  ];
  if (coverageLedger) entries.push({ path: 'coverage.json', bytes: JSON.stringify(coverageLedger, null, 2) });
  for (const [, resolved] of resolvedAssets) entries.push({ path: resolved.path, bytes: resolved.bytes, store: true });

  // English filenames only in the demo bundle.
  if (englishOnly) {
    for (const e of entries) {
      if (!isEnglishFilename(e.path)) guardFailures.push(`Bundle path "${e.path}" is not an English filename.`);
    }
  }

  const { key: prepKey, parts: prepParts } = preparationKey({ snapshot, passages, options: { ...options, language: englishOnly ? 'en' : 'raw' } });
  const bytes = createZip(entries);
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = String(options.projectName || 'osmy-roots-family-project').replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase();

  return {
    bytes,
    filename: `${safeName}-${stamp}-v${version}.zip`,
    mimeType: 'application/zip',
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      projectVersion: version,
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      byteLength: bytes.length,
      files: entries.map((e) => ({
        path: e.path,
        byteLength: Buffer.isBuffer(e.bytes) ? e.bytes.length : Buffer.byteLength(String(e.bytes)),
      })),
      assets: assetManifest,
      missingAssets,
      omittedAssets: omittedAssets.length,
      includeAssets,
      pdfPages: pdf.pages,
      printedPassages: currentPassages.length,
      stalePassages: stale.length,
      invalidPassages: invalid.length,
      branchPeople: branch.personIds.length,
      totalPeople: (snapshot.people || []).length,
      warnings,
      cuts,
      guardFailures,
      guardsPassed: guardFailures.length === 0,
      language: englishOnly ? 'en' : 'raw',
      preparationKey: prepKey,
      preparationParts: { version: prepParts.version, bookStatus: prepParts.bookStatus, language: prepParts.language, packetVersion: prepParts.packetVersion },
      sourcesWithheld: withheldSources.length,
      sourcesNeedingEnglishDerivative: needsDerivative.map((n) => n.id),
      fonts: pdf.fonts,
    },
  };
}

/** Small standalone map so the tree can be read without the app. */
/**
 * Coverage ledger: one row per input file. Each row says which sources and people it
 * produced, which prepared chapter used it, the actual book pages it reached (as text,
 * as an exhibit, or both), and the path its complete original keeps in this archive.
 *
 * A file that reached no page keeps its bytes and carries an explicit omission reason,
 * so nothing disappears quietly. Originals, derivatives and container extracts are
 * counted separately: an enhanced photograph is not a second original, and a message
 * pulled out of a chat archive is not a second uploaded file.
 */
export function buildCoverageLedger({ edition, snapshot, bookPlan, assetPaths, photoPairs = [], oldPhotoAssetIds = [] }) {
  const pagesByChapter = new Map();
  const pagesByAsset = new Map();
  const pagesBySource = new Map();
  for (const row of edition.coverage || []) {
    if (row.chapterId) pagesByChapter.set(row.chapterId, row.pages || []);
    if (row.assetId) pagesByAsset.set(row.assetId, row.pages || []);
    if (row.sourceId) pagesBySource.set(row.sourceId, row.pages || []);
  }
  const annotations = new Map((snapshot.photoAnnotations || []).map((a) => [a.assetId, a]));
  const pairByOriginal = new Map(photoPairs.map((p) => [p.originalAssetId, p]));
  const assetByHash = new Map();
  for (const a of snapshot.assets || []) if (a.contentHash) assetByHash.set(a.contentHash, a);
  const sourceByHash = new Map();
  for (const src of snapshot.sources || []) if (src.contentHash) sourceByHash.set(src.contentHash, src);

  const union = (...lists) => [...new Set(lists.flat().filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);

  const rows = (bookPlan?.coverage || []).map((entry) => {
    const asset = assetByHash.get(entry.fileHash);
    const source = sourceByHash.get(entry.fileHash);
    const annotation = asset ? annotations.get(asset.id) : null;
    const pair = asset ? pairByOriginal.get(asset.id) : null;
    const chapterPages = (entry.chapterIds || []).flatMap((id) => pagesByChapter.get(id) || []);
    const exhibitPages = asset ? pagesByAsset.get(asset.id) || [] : [];
    const linkedSourceIds = new Set([...(entry.sourceIds || []), ...(source ? [source.id] : [])]);
    const sourcePages = [...linkedSourceIds].flatMap((id) => pagesBySource.get(id) || []);
    const pages = union(chapterPages, exhibitPages, sourcePages);
    return {
      ...entry,
      role: annotation ? 'original_photograph' : 'document',
      assetId: asset?.id || null,
      personIds: annotation ? annotation.depictedPersonIds || [] : entry.personIds || [],
      pages,
      chapterPages: union(chapterPages),
      exhibitPages: union(exhibitPages),
      sourceRegisterPages: union(sourcePages),
      zipPath: (asset && assetPaths.get(asset.id)) || (source && assetPaths.get(`original-${source.id}`)) || entry.zipPath,
      enhanced: pair
        ? { assetId: pair.enhancedAssetId, hash: pair.enhancedHash, parentHash: pair.originalHash, zipPath: assetPaths.get(pair.enhancedAssetId) || null, alignment: pair.alignment?.mode || null, qa: pair.qa?.status || null }
        : null,
      printed: pages.length > 0,
      omission: pages.length ? undefined : (entry.omission || 'This file reached no printed page. Its complete original and its record still travel in this archive.'),
    };
  });

  const originals = (snapshot.assets || []).filter((a) => annotations.has(a.id));
  // Only the declared old photographs need an enhanced version. A modern photograph
  // without a pair is the intended state, not a gap.
  const declaredOld = new Set(oldPhotoAssetIds);
  const missingPairs = [...declaredOld].filter((id) => !pairByOriginal.has(id));
  return {
    schemaVersion: 'roots-coverage-v1',
    generatedAt: new Date().toISOString(),
    pageCount: edition.pages,
    layoutDensity: edition.density,
    sections: edition.sections.map((sec) => ({ id: sec.id, title: sec.title, startPage: sec.startPage, endPage: sec.endPage })),
    counts: {
      inputFiles: rows.length,
      originalPhotographs: originals.length,
      derivatives: photoPairs.length,
      documents: rows.filter((r) => r.role === 'document').length,
      containerExtracts: (snapshot.sources || []).filter((s) => s.kind === 'reconstructed_chat').length,
      people: (snapshot.people || []).length,
      chapters: (bookPlan?.chapters || []).length,
      printedFiles: rows.filter((r) => r.printed).length,
      unprintedFiles: rows.filter((r) => !r.printed).length,
    },
    oldPhotographs: declaredOld.size,
    oldPhotographsWithoutAnEnhancedVersion: missingPairs,
    modernPhotographsWithoutAPair: originals.filter((a) => !declaredOld.has(a.id)).length,
    rows,
    note: 'Derivatives are never counted as originals. Every row keeps its complete original in this archive whether or not it reached a printed page.',
  };
}

function renderEditableMap(snapshot, branch, assetPaths) {
  const data = {
    people: (snapshot.people || []).map((p) => ({
      id: p.id, displayNameEn: p.displayNameEn, originalName: p.originalName,
      lifeYears: p.lifeYears?.label || 'Unknown', photo: (p.photoIds || []).map((id) => assetPaths.get(id)).filter(Boolean)[0] || null,
      generation: snapshot.layout?.positions?.[p.id]?.generation ?? 0,
    })),
    relationships: (snapshot.relationships || []).map((r) => ({ from: r.fromPersonId, to: r.toPersonId, type: r.type, status: r.status })),
    focusPersonId: branch.focusPersonId,
    branchPersonIds: branch.personIds,
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Osmy Roots family map</title>
<style>
 :root{--ink:#1b1b20;--muted:#6b6b76;--rule:#ddd8d0;--paper:#fbfaf8;--card:#f6f4f0;--accent:#5a3d28}
 @media (prefers-color-scheme:dark){:root{--ink:#eceaea;--muted:#a6a2a8;--rule:#3a3a40;--paper:#17171a;--card:#212127;--accent:#c8a582}}
 body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:24px}
 h1{font-size:20px;margin:0 0 4px} p.sub{color:var(--muted);margin:0 0 20px;font-size:13px}
 .gen{margin-bottom:18px}
 .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
 .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
 .p{background:var(--card);border:1px solid var(--rule);border-radius:5px;padding:8px 10px;min-width:160px}
 .p.f{border-color:var(--accent);border-width:1.5px}
 .n{font-weight:600} .o,.y{color:var(--muted);font-size:12px}
 img{width:100%;max-width:150px;border-radius:3px;margin-bottom:6px;display:block}
</style></head><body>
<h1>Osmy Roots family map</h1>
<p class="sub">Read-only export of the current project. Edit in Osmy Roots and export again; project.json is the editable record.</p>
<div id="tree"></div>
<script id="d" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>
 const d=JSON.parse(document.getElementById('d').textContent);
 const esc=(v)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const byGen={};for(const p of d.people){(byGen[p.generation] ||= []).push(p);}
 document.getElementById('tree').innerHTML=Object.keys(byGen).sort((a,b)=>a-b).map(g=>
  '<div class="gen"><span class="lbl">Generation '+esc(g)+'</span><div class="row">'+byGen[g].map(p=>
   '<div class="p'+(p.id===d.focusPersonId?' f':'')+'">'+(p.photo?'<img src="'+esc(p.photo)+'" alt="">':'')+
   '<div class="n">'+esc(p.displayNameEn)+'</div>'+(p.originalName&&p.originalName!==p.displayNameEn?'<div class="o">'+esc(p.originalName)+'</div>':'')+
   '<div class="y">'+esc(p.lifeYears)+'</div></div>').join('')+'</div></div>').join('');
</script></body></html>`;
}
