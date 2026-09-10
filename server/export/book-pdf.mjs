/**
 * Four-page illustrated English mini-book.
 *
 * Page 1 cover/dedication + original portrait
 * Page 2 selected family branch, names, life years, source markers
 * Page 3 the person's photographs and their latest attributed story + cited passage
 * Page 4 numbered sources with exact locators, and what is still unresolved
 *
 * Narrative comes from CURRENT accepted state. The layout is prepared; the facts are not.
 * If the four-page layout cannot be produced, the caller falls back to a shorter PDF
 * carrying the same essential content, and records the cut.
 */

import { PdfDocument, A4 } from './pdf/document.mjs';
import { selectFont } from './pdf/ttf.mjs';
import { partitionPassages, partitionStories, acceptedClaimsFor, openQuestionsFrom, claimText } from './select.mjs';
import { UNKNOWN_LABEL } from '../contracts/types.mjs';

const INK = [0.11, 0.11, 0.13];
const MUTED = [0.42, 0.42, 0.47];
const RULE = [0.82, 0.80, 0.76];
const ACCENT = [0.35, 0.24, 0.16];
const CARD = [0.97, 0.96, 0.94];

const MARGIN = 56;

/** macOS system fonts that permit embedding and cover Cyrillic. */
const SERIF_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
  '/System/Library/Fonts/Supplemental/Georgia.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Geneva.ttf',
];
const SANS_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Verdana.ttf',
  '/System/Library/Fonts/Geneva.ttf',
];

export function loadBookFonts(mustCover = 'Roots') {
  const serif = selectFont(SERIF_CANDIDATES, mustCover);
  const sans = selectFont(SANS_CANDIDATES, mustCover);
  return { serif, sans };
}

const personLabel = (p) => p?.displayNameEn || p?.originalName || p?.id || UNKNOWN_LABEL;
const yearsLabel = (p) => (p?.lifeYears?.label ? p.lifeYears.label : UNKNOWN_LABEL);

/** Number every source once so the book can cite it as [n]. */
function buildSourceRegister(sources) {
  const register = new Map();
  let n = 0;
  for (const s of sources) {
    if (register.has(s.id)) continue;
    n += 1;
    register.set(s.id, { number: n, source: s });
  }
  return register;
}

function markersFor(ids, register) {
  const nums = [...new Set((ids || []).map((id) => register.get(id)?.number).filter(Boolean))];
  return nums.length ? `[${nums.join(',')}]` : '';
}

function footer(page, doc, text, pageNumber) {
  const y = page.height - 34;
  page.setStroke(RULE).setLineWidth(0.5).line(MARGIN, y - 14, page.width - MARGIN, y - 14);
  page.text({ x: MARGIN, y, text, font: 'sans', size: 8, color: MUTED });
  page.text({ x: page.width - MARGIN, y, text: String(pageNumber), font: 'sans', size: 8, color: MUTED, align: 'right' });
}

/**
 * @param {object} args
 * @param {object} args.snapshot
 * @param {Array} args.passages   current book passages supplied by the lead
 * @param {Function} args.getImage (assetId) -> {bytes, mediaType}|null
 * @param {object} args.branch     from selectBranch()
 * @param {object} [args.options]
 * @returns {{bytes:Buffer, pages:number, warnings:string[], staleFlagged:Array, cuts:string[]}}
 */
export function renderBookPdf({ snapshot, passages = [], getImage, branch, options = {} }) {
  const warnings = [];
  const cuts = [];
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  const sources = snapshot.sources || [];
  const register = buildSourceRegister(sources);

  const focusId = options.focusPersonId || branch?.focusPersonId || (snapshot.people || [])[0]?.id;
  const focus = people.get(focusId);
  const dedication = options.dedication || 'For Dad.';
  const title = options.title || 'Roots: The Family Book';

  // Fonts must cover every character we intend to print.
  const coverSample = [title, dedication, ...[...people.values()].map((p) => `${p.displayNameEn} ${p.originalName}`)]
    .join(' ').slice(0, 4000);
  const { serif, sans } = loadBookFonts(coverSample);
  if (!serif.font || !sans.font) {
    const err = new Error(`No embeddable font covering the book text. Tried: ${[...serif.tried, ...sans.tried].join('; ')}`);
    err.code = 'NO_FONT';
    throw err;
  }
  if (options.fontNote !== false) {
    warnings.push(`Embedded fonts: ${serif.font.name} (body), ${sans.font.name} (headings).`);
  }

  const doc = new PdfDocument({
    size: A4,
    info: { title, author: options.author || 'Osmy Roots', subject: 'Family history, generated from reviewed evidence' },
  });
  doc.addFont('serif', serif.font);
  doc.addFont('sans', sans.font);

  const { current: currentPassages, stale, invalid } = partitionPassages(passages, snapshot.version);
  for (const s of stale) warnings.push(`STALE PASSAGE EXCLUDED: ${s.reason}`);
  for (const i of invalid) warnings.push(`INVALID PASSAGE EXCLUDED: ${i.reason}`);

  const imageCache = new Map();
  const putImage = (assetId) => {
    if (!assetId) return null;
    if (imageCache.has(assetId)) return imageCache.get(assetId);
    let record = null;
    try {
      const resolved = getImage ? getImage(assetId) : null;
      if (resolved && resolved.bytes) record = doc.addImage(assetId, resolved.bytes, resolved.mediaType);
      else warnings.push(`Photo ${assetId} could not be resolved and was left out of the book.`);
    } catch (e) {
      warnings.push(`Photo ${assetId} failed to embed: ${e.message}`);
    }
    imageCache.set(assetId, record);
    return record;
  };

  // ---------------------------------------------------------------- page 1
  const p1 = doc.addPage();
  p1.setFill([0.99, 0.985, 0.975]).rect(0, 0, p1.width, p1.height);
  p1.setStroke(ACCENT).setLineWidth(1.2).line(MARGIN, 92, p1.width - MARGIN, 92);
  p1.text({ x: MARGIN, y: 80, text: title, font: 'sans', size: 26, color: INK });

  const portraitId = (focus?.photoIds || [])[0];
  const portrait = putImage(portraitId);
  let cursor = 132;
  if (portrait) {
    const box = p1.image(portrait, { x: MARGIN, y: cursor, width: p1.width - MARGIN * 2, height: 380 });
    cursor = (box ? box.y + box.h : cursor + 380) + 26;
  } else {
    p1.setFill(CARD).rect(MARGIN, cursor, p1.width - MARGIN * 2, 150);
    p1.text({ x: p1.width / 2, y: cursor + 80, text: 'No portrait supplied for this person', font: 'sans', size: 10, color: MUTED, align: 'center' });
    warnings.push(`No portrait available for ${personLabel(focus)}; cover shows a placeholder.`);
    cursor += 176;
  }

  if (focus) {
    p1.text({ x: MARGIN, y: cursor, text: personLabel(focus), font: 'serif', size: 20, color: INK });
    cursor += 24;
    if (focus.originalName && focus.originalName !== focus.displayNameEn) {
      p1.text({ x: MARGIN, y: cursor, text: focus.originalName, font: 'serif', size: 13, color: MUTED });
      cursor += 20;
    }
    p1.text({ x: MARGIN, y: cursor, text: yearsLabel(focus), font: 'sans', size: 11, color: MUTED });
    cursor += 34;
  }

  p1.setStroke(RULE).setLineWidth(0.5).line(MARGIN, cursor, MARGIN + 90, cursor);
  cursor += 26;
  p1.text({ x: MARGIN, y: cursor, text: dedication, font: 'serif', size: 15, color: ACCENT });
  cursor += 30;
  if (options.dedicationNote) {
    p1.paragraph({ x: MARGIN, y: cursor, maxWidth: p1.width - MARGIN * 2, font: 'serif', size: 10.5, color: MUTED, text: options.dedicationNote });
  }
  footer(p1, doc, `Generated ${new Date().toISOString().slice(0, 10)} from reviewed family evidence. Project version ${snapshot.version}.`, 1);

  // ---------------------------------------------------------------- page 2
  const p2 = doc.addPage();
  p2.text({ x: MARGIN, y: 70, text: 'The family branch', font: 'sans', size: 17, color: INK });
  p2.setStroke(RULE).setLineWidth(0.5).line(MARGIN, 82, p2.width - MARGIN, 82);
  p2.paragraph({
    x: MARGIN, y: 102, maxWidth: p2.width - MARGIN * 2, font: 'serif', size: 9.5, color: MUTED,
    text: 'Each card carries the English name, the original name and known life years. A bracketed number cites the source that supports the person. Unknown values are shown as Unknown rather than filled in.',
  });

  const levels = branch?.levels || new Map();
  const byLevel = new Map();
  for (const [id, lvl] of levels.entries()) {
    if (!people.has(id)) continue;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(id);
  }
  const orderedLevels = [...byLevel.keys()].sort((a, b) => b - a); // oldest generation first

  const chartTop = 150;
  const chartBottom = p2.height - 90;
  const rows = Math.max(1, orderedLevels.length);
  const rowHeight = Math.min(96, (chartBottom - chartTop) / rows);
  const cardH = Math.min(58, rowHeight - 22);
  const centres = new Map();

  orderedLevels.forEach((lvl, rowIndex) => {
    const ids = byLevel.get(lvl);
    const y = chartTop + rowIndex * rowHeight;
    const usable = p2.width - MARGIN * 2;
    const cardW = Math.min(150, (usable - (ids.length - 1) * 10) / Math.max(1, ids.length));
    const totalW = ids.length * cardW + (ids.length - 1) * 10;
    let x = MARGIN + (usable - totalW) / 2;
    for (const id of ids) {
      const person = people.get(id);
      centres.set(id, { x: x + cardW / 2, top: y, bottom: y + cardH });
      p2.setFill(id === focusId ? [0.94, 0.91, 0.86] : CARD).rect(x, y, cardW, cardH);
      p2.setStroke(id === focusId ? ACCENT : RULE).setLineWidth(id === focusId ? 1 : 0.5).rect(x, y, cardW, cardH, 'S');

      const marker = markersFor(person?.claimIds?.length ? [] : [], register);
      const claimSources = new Set();
      for (const c of snapshot.claims || []) {
        if (c.subjectId === id) (c.sourceIds || []).forEach((s) => claimSources.add(s));
      }
      const cite = markersFor([...claimSources], register) || marker;

      const nameLines = doc.wrap('sans', personLabel(person), 8.5, cardW - 12);
      let ty = y + 15;
      for (const line of nameLines.slice(0, 2)) {
        p2.text({ x: x + cardW / 2, y: ty, text: line, font: 'sans', size: 8.5, color: INK, align: 'center' });
        ty += 11;
      }
      p2.text({ x: x + cardW / 2, y: ty + 1, text: yearsLabel(person), font: 'serif', size: 8, color: MUTED, align: 'center' });
      if (cite) p2.text({ x: x + cardW - 6, y: y + cardH - 5, text: cite.slice(0, 14), font: 'sans', size: 6, color: MUTED, align: 'right' });
      x += cardW + 10;
    }
  });

  // Connectors follow real parent_child edges only.
  p2.setStroke([0.6, 0.58, 0.55]).setLineWidth(0.7);
  for (const e of branch?.edges || []) {
    if (e.type !== 'parent_child') continue;
    const a = centres.get(e.fromPersonId);
    const b = centres.get(e.toPersonId);
    if (!a || !b) continue;
    const mid = (a.bottom + b.top) / 2;
    p2.line(a.x, a.bottom, a.x, mid);
    p2.line(a.x, mid, b.x, mid);
    p2.line(b.x, mid, b.x, b.top);
  }
  footer(p2, doc, `${centres.size} people shown from the selected branch. The full project retains ${(snapshot.people || []).length}.`, 2);

  // ---------------------------------------------------------------- page 3
  const p3 = doc.addPage();
  p3.text({ x: MARGIN, y: 70, text: personLabel(focus), font: 'sans', size: 17, color: INK });
  p3.setStroke(RULE).setLineWidth(0.5).line(MARGIN, 82, p3.width - MARGIN, 82);
  if (focus?.originalName) p3.text({ x: MARGIN, y: 100, text: `${focus.originalName} · ${yearsLabel(focus)}`, font: 'serif', size: 10.5, color: MUTED });

  let y3 = 124;
  const photoIds = (focus?.photoIds || []).slice(0, 3);
  if (photoIds.length) {
    const gap = 10;
    const boxW = (p3.width - MARGIN * 2 - gap * (photoIds.length - 1)) / photoIds.length;
    let px = MARGIN;
    let maxBottom = y3;
    for (const pid of photoIds) {
      const rec = putImage(pid);
      if (rec) {
        const box = p3.image(rec, { x: px, y: y3, width: boxW, height: 190 });
        if (box) maxBottom = Math.max(maxBottom, box.y + box.h);
      } else {
        p3.setFill(CARD).rect(px, y3, boxW, 120);
        p3.text({ x: px + boxW / 2, y: y3 + 64, text: 'Photo unavailable', font: 'sans', size: 8, color: MUTED, align: 'center' });
        maxBottom = Math.max(maxBottom, y3 + 120);
      }
      px += boxW + gap;
    }
    y3 = maxBottom + 24;
  } else {
    warnings.push(`No photographs available for ${personLabel(focus)}.`);
  }

  // Facts, each keeping its evidence marker.
  const facts = options.compactChapter ? [] : acceptedClaimsFor(snapshot.claims, focusId);
  if (facts.length) {
    p3.text({ x: MARGIN, y: y3, text: 'What the evidence supports', font: 'sans', size: 11, color: INK });
    y3 += 17;
    for (const c of facts.slice(0, 8)) {
      const line = `${claimText(c, people)} ${markersFor(c.sourceIds, register)}`;
      y3 = p3.paragraph({ x: MARGIN + 10, y: y3, maxWidth: p3.width - MARGIN * 2 - 10, font: 'serif', size: 9.5, color: INK, text: line, leading: 13 });
    }
    y3 += 10;
  }

  // The lead's current cited passage. Never a canned paragraph.
  const focusPassages = currentPassages.filter((p) => !p.personId || p.personId === focusId);
  if (focusPassages.length) {
    p3.text({ x: MARGIN, y: y3, text: 'From the family record', font: 'sans', size: 11, color: INK });
    y3 += 18;
    for (const passage of focusPassages.slice(0, 3)) {
      p3.setFill([0.98, 0.97, 0.95]).rect(MARGIN, y3 - 12, p3.width - MARGIN * 2, 6);
      const end = p3.paragraph({
        x: MARGIN, y: y3, maxWidth: p3.width - MARGIN * 2, font: 'serif', size: 11, color: INK,
        text: passage.text, leading: 16,
      });
      const cite = (passage.sourceLocators || []).join('; ');
      y3 = end + 4;
      if (cite) {
        y3 = p3.paragraph({ x: MARGIN, y: y3, maxWidth: p3.width - MARGIN * 2, font: 'sans', size: 8, color: MUTED, text: `Source: ${cite}`, leading: 11 }) + 10;
      }
    }
  }

  // Attributed recollections stay labelled as recollections.
  const { accepted: acceptedStories, notes } = partitionStories(snapshot.stories, focusId);
  if (!options.compactChapter && acceptedStories.length && y3 < p3.height - 150) {
    p3.text({ x: MARGIN, y: y3, text: 'Family recollections', font: 'sans', size: 11, color: INK });
    y3 += 17;
    for (const s of acceptedStories.slice(0, 3)) {
      if (y3 > p3.height - 110) break;
      const who = s.attributedTo ? `Remembered by ${s.attributedTo}. ` : 'Family recollection. ';
      y3 = p3.paragraph({
        x: MARGIN + 10, y: y3, maxWidth: p3.width - MARGIN * 2 - 10, font: 'serif', size: 10, color: INK,
        text: `${who}${s.text} ${markersFor(s.sourceIds, register)}`, leading: 14,
      }) + 8;
    }
  }
  if (notes.length) warnings.push(`${notes.length} unreviewed note(s) for ${personLabel(focus)} were kept out of the biography.`);
  if (options.compactChapter) {
    cuts.push('compact_chapter_current_passage');
    p3.paragraph({ x: MARGIN, y: Math.min(y3 + 14, p3.height - 100), maxWidth: p3.width - MARGIN * 2, font: 'sans', size: 8, color: MUTED,
      text: 'The HTML edition contains the other recorded facts and recollections. Exact quotations remain in project.json; the complete numbered source register is in book.html.', leading: 11 });
  }
  footer(p3, doc, 'A recollection is evidence of memory. It is not independent archival proof.', 3);

  // ---------------------------------------------------------------- page 4
  const p4 = doc.addPage();
  p4.text({ x: MARGIN, y: 70, text: 'Sources', font: 'sans', size: 17, color: INK });
  p4.setStroke(RULE).setLineWidth(0.5).line(MARGIN, 82, p4.width - MARGIN, 82);
  let y4 = p4.paragraph({ x: MARGIN, y: 104, maxWidth: p4.width - MARGIN * 2, font: 'sans', size: 8.5, color: MUTED,
    text: 'Selected entries below. Every numbered citation resolves in the complete Sources section of book.html. Original text and exact locators are preserved in sources.json and project.json.', leading: 12 }) + 14;
  const used = [...register.values()].sort((a, b) => a.number - b.number);
  for (const { number, source } of used) {
    if (y4 > p4.height - 250) { warnings.push('Source list truncated to fit the four-page layout; the complete numbered register is in book.html.'); cuts.push('source_list_truncated'); break; }
    const origin = source.origin ? ` · ${source.origin}` : '';
    const kind = source.kind ? source.kind.replace(/_/g, ' ') : 'source';
    const head = `[${number}] ${source.title || source.originalLocator || source.id}`;
    y4 = p4.paragraph({ x: MARGIN, y: y4, maxWidth: p4.width - MARGIN * 2, font: 'serif', size: 9.5, color: INK, text: head, leading: 12.5 });
    const detail = `${kind}${origin}${source.originalLocator ? ` · ${source.originalLocator}` : ''}${source.unresolved ? ' · original document not supplied' : ''}`;
    y4 = p4.paragraph({ x: MARGIN + 12, y: y4, maxWidth: p4.width - MARGIN * 2 - 12, font: 'sans', size: 8, color: MUTED, text: detail, leading: 10.5 }) + 6;
  }

  const open = openQuestionsFrom(snapshot);
  if (y4 < p4.height - 180) {
    y4 += 12;
    p4.text({ x: MARGIN, y: y4, text: 'Still to discover', font: 'sans', size: 12, color: INK });
    y4 += 18;
    if (!open.length) {
      p4.text({ x: MARGIN, y: y4, text: 'No unresolved items were recorded at export time.', font: 'serif', size: 9.5, color: MUTED });
    } else {
      for (const q of open.slice(0, 12)) {
        if (y4 > p4.height - 70) { warnings.push('Open-question list truncated to fit the page.'); break; }
        y4 = p4.paragraph({
          x: MARGIN + 10, y: y4, maxWidth: p4.width - MARGIN * 2 - 10, font: 'serif', size: 9, color: INK,
          text: `${q.status === 'error' ? '!' : '-'} ${q.text}`, leading: 12,
        }) + 3;
      }
      if (open.length > 12) {
        p4.text({ x: MARGIN + 10, y: y4 + 4, text: `... and ${open.length - 12} more in research-notes.json.`, font: 'sans', size: 8, color: MUTED });
      }
    }
  }
  footer(p4, doc, 'Roots prototype. Imported records are supplied family evidence, not new archive discoveries.', 4);

  const bytes = doc.toBuffer();
  warnings.push(...doc.warnings);
  return { bytes, pages: doc.pages.length, warnings, staleFlagged: stale, invalidPassages: invalid, cuts, sourceRegister: register };
}
