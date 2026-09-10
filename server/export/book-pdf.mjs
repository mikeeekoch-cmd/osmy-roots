/**
 * Osmy Roots: four-page illustrated English book.
 *
 * Page 1  branding, cover portrait, dedication
 * Page 2  legible main branch, then the full selected family register
 * Page 3  the reviewed source-backed story with its selected photographs
 * Page 4  numbered sources with exact locators, and what is still open
 *
 * Layout is prepared; every fact comes from current accepted state. Four guards
 * run while rendering and fail loudly rather than printing something misleading:
 * clipped text, page overflow, raw object prose and unresolved citation markers.
 */

import { PdfDocument, A4 } from './pdf/document.mjs';
import { selectFont } from './pdf/ttf.mjs';
import { partitionPassages, partitionStories, acceptedClaimsFor, openQuestionsFrom, claimText, displayText } from './select.mjs';
import { hasNonLatinScript } from './english.mjs';
import { UNKNOWN_LABEL } from '../contracts/types.mjs';

const INK = [0.11, 0.11, 0.13];
const MUTED = [0.42, 0.42, 0.47];
const FAINT = [0.58, 0.58, 0.62];
const RULE = [0.83, 0.81, 0.77];
const ACCENT = [0.35, 0.24, 0.16];
const CARD = [0.97, 0.96, 0.94];
const FOCUS_FILL = [0.94, 0.91, 0.86];

const MARGIN = 52;
const FOOTER_RESERVE = 52;

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
  return { serif: selectFont(SERIF_CANDIDATES, mustCover), sans: selectFont(SANS_CANDIDATES, mustCover) };
}

const personLabel = (p) => p?.displayNameEn || p?.originalName || p?.id || UNKNOWN_LABEL;
const yearsLabel = (p) => p?.lifeYears?.label || UNKNOWN_LABEL;

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

/** Draw the Osmy Roots mark: a small rooted stem, then the wordmark. */
function drawBranding(page, x, y, scale = 1) {
  const s = scale;
  page.setStroke(ACCENT).setLineWidth(1.3 * s);
  page.line(x + 6 * s, y, x + 6 * s, y + 13 * s);
  page.line(x + 6 * s, y + 5 * s, x + 1 * s, y + 1 * s);
  page.line(x + 6 * s, y + 5 * s, x + 11 * s, y + 1 * s);
  page.line(x + 6 * s, y + 13 * s, x + 2 * s, y + 17 * s);
  page.line(x + 6 * s, y + 13 * s, x + 10 * s, y + 17 * s);
  return page.text({ x: x + 18 * s, y: y + 14 * s, text: 'Osmy Roots', font: 'sans', size: 10.5 * s, color: ACCENT }) + 18 * s;
}

function footer(page, text, pageNumber) {
  const y = page.height - 30;
  page.setStroke(RULE).setLineWidth(0.5).line(MARGIN, y - 13, page.width - MARGIN, y - 13);
  page.text({ x: MARGIN, y, text, font: 'sans', size: 7.5, color: FAINT });
  page.text({ x: page.width - MARGIN, y, text: `${pageNumber}`, font: 'sans', size: 7.5, color: FAINT, align: 'right' });
}

/**
 * @returns {{bytes:Buffer, pages:number, warnings:string[], guardFailures:string[], cuts:string[], sourceRegister:Map}}
 */
export function renderBookPdf({ snapshot, passages = [], getImage, branch, options = {} }) {
  const warnings = [];
  const guardFailures = [];
  const cuts = [];
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  const sources = snapshot.sources || [];
  const register = buildSourceRegister(sources);
  const englishOnly = options.englishOnly !== false;

  const focusId = options.focusPersonId || branch?.focusPersonId || (snapshot.people || [])[0]?.id;
  const focus = people.get(focusId);
  const dedication = options.dedication || 'For Dad.';
  const title = options.title || 'Roots: The Family Book';

  /** Every marker must resolve to a numbered entry, or the citation is a lie. */
  const markersFor = (ids, where) => {
    const nums = [];
    for (const id of new Set(ids || [])) {
      const entry = register.get(id);
      if (!entry) {
        guardFailures.push(`Citation target "${id}" referenced by ${where} is not in the source register.`);
        continue;
      }
      nums.push(entry.number);
    }
    return nums.length ? `[${nums.sort((a, b) => a - b).join(',')}]` : '';
  };

  const coverSample = [title, dedication, 'Osmy Roots', ...[...people.values()].map((p) => `${p.displayNameEn} ${p.originalName}`)]
    .join(' ').slice(0, 6000);
  const { serif, sans } = loadBookFonts(coverSample);
  if (!serif.font || !sans.font) {
    const err = new Error(`No embeddable font covering the book text. Tried: ${[...serif.tried, ...sans.tried].join('; ')}`);
    err.code = 'NO_FONT';
    throw err;
  }

  const doc = new PdfDocument({
    size: A4,
    info: { title, author: options.author || 'Osmy Roots', subject: 'Family history assembled from reviewed family records' },
  });
  doc.addFont('serif', serif.font);
  doc.addFont('sans', sans.font);

  /** Shorten to fit, and record it, so a name is never silently cut off. */
  const fit = (text, fontKey, size, maxWidth, where) => {
    const s = String(text ?? '');
    if (doc.widthOf(fontKey, s, size) <= maxWidth) return s;
    let out = s;
    while (out.length > 1 && doc.widthOf(fontKey, `${out}...`, size) > maxWidth) out = out.slice(0, -1);
    warnings.push(`Shortened "${s}" to fit ${where}.`);
    return `${out}...`;
  };

  const { current: currentPassages, stale, invalid } = partitionPassages(passages, snapshot.version);
  for (const s of stale) warnings.push(`STALE PASSAGE EXCLUDED: ${s.reason}`);
  for (const i of invalid) warnings.push(`INVALID PASSAGE EXCLUDED: ${i.reason}`);

  if (englishOnly) {
    for (const p of currentPassages) {
      if (hasNonLatinScript(p.text)) guardFailures.push(`Passage ${p.id} contains non-English text; the demo bundle is English only.`);
    }
  }

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

  // ------------------------------------------------------------------ page 1
  const p1 = doc.addPage();
  p1.setFill([0.99, 0.985, 0.976]).rect(0, 0, p1.width, p1.height);
  drawBranding(p1, MARGIN, 44, 1.15);
  p1.setStroke(ACCENT).setLineWidth(1.2).line(MARGIN, 84, p1.width - MARGIN, 84);
  p1.text({ x: MARGIN, y: 116, text: title, font: 'sans', size: 25, color: INK });

  let y1 = 146;
  const portrait = putImage((focus?.photoIds || [])[0]);
  if (portrait) {
    const box = p1.image(portrait, { x: MARGIN, y: y1, width: p1.width - MARGIN * 2, height: 372 });
    y1 = (box ? box.y + box.h : y1 + 372) + 28;
  } else {
    p1.setFill(CARD).rect(MARGIN, y1, p1.width - MARGIN * 2, 130);
    p1.text({ x: p1.width / 2, y: y1 + 70, text: 'No portrait was supplied for this person', font: 'sans', size: 9.5, color: MUTED, align: 'center' });
    warnings.push(`No portrait available for ${personLabel(focus)}; the cover shows a placeholder.`);
    y1 += 158;
  }

  if (focus) {
    p1.text({ x: MARGIN, y: y1, text: fit(personLabel(focus), 'serif', 20, p1.width - MARGIN * 2, 'the cover'), font: 'serif', size: 20, color: INK });
    y1 += 25;
    if (focus.originalName && focus.originalName !== focus.displayNameEn && !(englishOnly && hasNonLatinScript(focus.originalName))) {
      p1.text({ x: MARGIN, y: y1, text: focus.originalName, font: 'serif', size: 12.5, color: MUTED });
      y1 += 19;
    }
    p1.text({ x: MARGIN, y: y1, text: yearsLabel(focus), font: 'sans', size: 10.5, color: MUTED });
    y1 += 32;
  }
  p1.setStroke(RULE).setLineWidth(0.5).line(MARGIN, y1, MARGIN + 84, y1);
  y1 += 26;
  p1.text({ x: MARGIN, y: y1, text: dedication, font: 'serif', size: 15, color: ACCENT });
  y1 += 28;
  if (options.dedicationNote) {
    y1 = p1.paragraph({ x: MARGIN, y: y1, maxWidth: p1.width - MARGIN * 2, font: 'serif', size: 10, color: MUTED, text: options.dedicationNote, leading: 14 });
  }
  if (y1 > p1.height - FOOTER_RESERVE) guardFailures.push('Cover content overflows page 1.');
  footer(p1, `Assembled ${new Date().toISOString().slice(0, 10)} from reviewed family records. Project version ${snapshot.version}.`, 1);

  // ------------------------------------------------------------------ page 2
  const p2 = doc.addPage();
  drawBranding(p2, MARGIN, 34, 0.85);
  p2.text({ x: MARGIN, y: 76, text: 'The family', font: 'sans', size: 16, color: INK });
  p2.setStroke(RULE).setLineWidth(0.5).line(MARGIN, 86, p2.width - MARGIN, 86);
  p2.paragraph({
    x: MARGIN, y: 104, maxWidth: p2.width - MARGIN * 2, font: 'serif', size: 9, color: MUTED, leading: 12,
    text: 'The main line is drawn below. Every person in the project is listed in the register that follows, with known life years and the source that supports the record. A bracketed number cites that source. Unknown values are shown as Unknown.',
  });

  // Main branch, kept small enough to stay legible.
  const levels = branch?.levels || new Map();
  const byLevel = new Map();
  for (const [id, lvl] of levels.entries()) {
    if (!people.has(id)) continue;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(id);
  }
  const orderedLevels = [...byLevel.keys()].sort((a, b) => b - a);
  const MAX_PER_ROW = 4;
  const chartTop = 138;
  const rowHeight = 66;
  const cardH = 46;
  const centres = new Map();
  let chartBottom = chartTop;

  orderedLevels.forEach((lvl, rowIndex) => {
    let ids = byLevel.get(lvl);
    if (ids.length > MAX_PER_ROW) {
      warnings.push(`Generation ${lvl} has ${ids.length} people; the compact page shows ${MAX_PER_ROW}. The full list is in the register below and in book.html.`);
      cuts.push(`branch_row_${lvl}_trimmed`);
      ids = ids.slice(0, MAX_PER_ROW);
    }
    const y = chartTop + rowIndex * rowHeight;
    chartBottom = y + cardH;
    const usable = p2.width - MARGIN * 2;
    const cardW = Math.min(126, (usable - (ids.length - 1) * 12) / Math.max(1, ids.length));
    const totalW = ids.length * cardW + (ids.length - 1) * 12;
    let x = MARGIN + (usable - totalW) / 2;
    for (const id of ids) {
      const person = people.get(id);
      centres.set(id, { x: x + cardW / 2, top: y, bottom: y + cardH });
      p2.setFill(id === focusId ? FOCUS_FILL : CARD).rect(x, y, cardW, cardH);
      p2.setStroke(id === focusId ? ACCENT : RULE).setLineWidth(id === focusId ? 1 : 0.5).rect(x, y, cardW, cardH, 'S');

      const nameLines = doc.wrap('sans', personLabel(person), 8, cardW - 10);
      let ty = y + 14;
      for (const line of nameLines.slice(0, 2)) {
        p2.text({ x: x + cardW / 2, y: ty, text: fit(line, 'sans', 8, cardW - 10, 'a branch card'), font: 'sans', size: 8, color: INK, align: 'center' });
        ty += 10;
      }
      if (nameLines.length > 2) warnings.push(`Name "${personLabel(person)}" needed more than two lines on the branch card.`);
      p2.text({ x: x + cardW / 2, y: ty + 1, text: yearsLabel(person), font: 'serif', size: 7.5, color: MUTED, align: 'center' });
      x += cardW + 12;
    }
  });

  p2.setStroke([0.62, 0.6, 0.57]).setLineWidth(0.7);
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

  // Full selected family register, two columns.
  let ry = Math.max(chartBottom + 26, 300);
  p2.text({ x: MARGIN, y: ry, text: `Family register: ${(snapshot.people || []).length} people`, font: 'sans', size: 10.5, color: INK });
  ry += 6;
  p2.setStroke(RULE).setLineWidth(0.5).line(MARGIN, ry, p2.width - MARGIN, ry);
  ry += 13;

  const roster = [...(snapshot.people || [])].sort((a, b) => {
    const ga = snapshot.layout?.positions?.[a.id]?.generation ?? 0;
    const gb = snapshot.layout?.positions?.[b.id]?.generation ?? 0;
    return ga - gb || personLabel(a).localeCompare(personLabel(b));
  });
  const colGap = 18;
  const colW = (p2.width - MARGIN * 2 - colGap) / 2;
  const lineH = 10.4;
  const available = p2.height - FOOTER_RESERVE - ry;
  const maxPerCol = Math.max(1, Math.floor(available / lineH));
  const capacity = maxPerCol * 2;
  const shown = roster.slice(0, capacity);
  // Split evenly rather than filling column one to the bottom first.
  const perCol = Math.min(maxPerCol, Math.ceil(shown.length / 2));
  if (roster.length > capacity) {
    warnings.push(`The compact register lists ${capacity} of ${roster.length} people. The complete register is in book.html and project.json.`);
    cuts.push('register_truncated');
  }

  shown.forEach((person, i) => {
    const col = i < perCol ? 0 : 1;
    const x = MARGIN + col * (colW + colGap);
    const y = ry + (i % perCol) * lineH;
    const claimSources = new Set();
    for (const c of snapshot.claims || []) if (c.subjectId === person.id) (c.sourceIds || []).forEach((s) => claimSources.add(s));
    const cite = markersFor([...claimSources], `the register row for ${person.id}`);
    const years = yearsLabel(person);
    const citeW = cite ? doc.widthOf('sans', cite, 6.5) + 4 : 0;
    const yearsW = doc.widthOf('serif', years, 7.2) + 6;
    const nameW = colW - yearsW - citeW - 4;
    p2.text({ x, y, text: fit(personLabel(person), 'serif', 8, nameW, 'the register'), font: 'serif', size: 8, color: INK });
    p2.text({ x: x + colW - citeW, y, text: years, font: 'serif', size: 7.2, color: MUTED, align: 'right' });
    if (cite) p2.text({ x: x + colW, y, text: cite, font: 'sans', size: 6.5, color: FAINT, align: 'right' });
  });
  const registerBottom = ry + Math.min(perCol, shown.length) * lineH;
  if (registerBottom > p2.height - FOOTER_RESERVE) guardFailures.push('The family register overflows page 2.');
  footer(p2, `${centres.size} people drawn in the main line; ${(snapshot.people || []).length} in the full project.`, 2);

  // ------------------------------------------------------------------ page 3
  const p3 = doc.addPage();
  drawBranding(p3, MARGIN, 34, 0.85);
  p3.text({ x: MARGIN, y: 76, text: fit(personLabel(focus), 'sans', 16, p3.width - MARGIN * 2, 'the chapter heading'), font: 'sans', size: 16, color: INK });
  p3.setStroke(RULE).setLineWidth(0.5).line(MARGIN, 86, p3.width - MARGIN, 86);
  if (focus) p3.text({ x: MARGIN, y: 103, text: yearsLabel(focus), font: 'serif', size: 10, color: MUTED });

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
        const box = p3.image(rec, { x: px, y: y3, width: boxW, height: 176 });
        if (box) maxBottom = Math.max(maxBottom, box.y + box.h);
      } else {
        p3.setFill(CARD).rect(px, y3, boxW, 110);
        p3.text({ x: px + boxW / 2, y: y3 + 58, text: 'Photograph unavailable', font: 'sans', size: 8, color: MUTED, align: 'center' });
        maxBottom = Math.max(maxBottom, y3 + 110);
      }
      px += boxW + gap;
    }
    y3 = maxBottom + 22;
    const total = (focus?.photoIds || []).length;
    if (total > photoIds.length) warnings.push(`${total - photoIds.length} further photograph(s) of ${personLabel(focus)} are in book.html and the project bundle.`);
  } else {
    warnings.push(`No photographs are available for ${personLabel(focus)}.`);
  }

  const room = () => p3.height - FOOTER_RESERVE - y3;

  const facts = acceptedClaimsFor(snapshot.claims, focusId);
  if (facts.length && room() > 60) {
    p3.text({ x: MARGIN, y: y3, text: 'What the records support', font: 'sans', size: 10.5, color: INK });
    y3 += 16;
    for (const c of facts) {
      if (room() < 22) { warnings.push('The supported-facts list was trimmed to fit page 3; the full set is in book.html.'); cuts.push('facts_trimmed'); break; }
      const body = claimText(c, people);
      if (/[{}[\]"]/.test(body) && /":/.test(body)) guardFailures.push(`Claim ${c.id} would print raw object text on page 3.`);
      y3 = p3.paragraph({ x: MARGIN + 9, y: y3, maxWidth: p3.width - MARGIN * 2 - 9, font: 'serif', size: 9.3, color: INK, leading: 12.6, text: `${body} ${markersFor(c.sourceIds, `claim ${c.id}`)}` });
    }
    y3 += 8;
  }

  const focusPassages = currentPassages.filter((p) => !p.personId || p.personId === focusId);
  if (focusPassages.length && room() > 60) {
    p3.text({ x: MARGIN, y: y3, text: 'The reviewed story', font: 'sans', size: 10.5, color: INK });
    y3 += 17;
    for (const passage of focusPassages) {
      if (room() < 50) { warnings.push('A reviewed passage did not fit page 3 and is in book.html.'); cuts.push('passage_trimmed'); break; }
      p3.setFill([0.98, 0.97, 0.95]).rect(MARGIN, y3 - 11, p3.width - MARGIN * 2, 5);
      y3 = p3.paragraph({ x: MARGIN, y: y3, maxWidth: p3.width - MARGIN * 2, font: 'serif', size: 10.8, color: INK, leading: 15.4, text: passage.text }) + 3;
      const cite = (passage.sourceLocators || []).join('; ');
      if (cite) {
        y3 = p3.paragraph({ x: MARGIN, y: y3, maxWidth: p3.width - MARGIN * 2, font: 'sans', size: 7.6, color: MUTED, leading: 10, text: `Source: ${cite}` }) + 9;
      }
    }
  }

  const { accepted: acceptedStories, notes } = partitionStories(snapshot.stories, focusId);
  if (acceptedStories.length && room() > 50) {
    p3.text({ x: MARGIN, y: y3, text: 'Family recollections', font: 'sans', size: 10.5, color: INK });
    y3 += 16;
    for (const s of acceptedStories) {
      if (room() < 30) { warnings.push('Recollections were trimmed to fit page 3; the full set is in book.html.'); cuts.push('recollections_trimmed'); break; }
      if (englishOnly && hasNonLatinScript(s.text)) {
        guardFailures.push(`Story ${s.id} contains non-English text; the demo bundle is English only.`);
        continue;
      }
      const who = s.attributedTo ? `Remembered by ${s.attributedTo}. ` : 'Family recollection. ';
      y3 = p3.paragraph({ x: MARGIN + 9, y: y3, maxWidth: p3.width - MARGIN * 2 - 9, font: 'serif', size: 9.6, color: INK, leading: 13.4, text: `${who}${displayText(s.text)} ${markersFor(s.sourceIds, `story ${s.id}`)}` }) + 7;
    }
  }
  if (notes.length) warnings.push(`${notes.length} unreviewed note(s) for ${personLabel(focus)} were kept out of the biography.`);
  if (y3 > p3.height - FOOTER_RESERVE) guardFailures.push('Chapter content overflows page 3.');
  footer(p3, 'A recollection is evidence of memory. It is not independent archival proof.', 3);

  // ------------------------------------------------------------------ page 4
  const p4 = doc.addPage();
  drawBranding(p4, MARGIN, 34, 0.85);
  p4.text({ x: MARGIN, y: 76, text: 'Sources', font: 'sans', size: 16, color: INK });
  p4.setStroke(RULE).setLineWidth(0.5).line(MARGIN, 86, p4.width - MARGIN, 86);
  let y4 = 106;
  // Sources actually cited by the printed pages come first, so a truncated list
  // never drops the evidence the book relies on.
  const citedIds = new Set();
  for (const c of acceptedClaimsFor(snapshot.claims, focusId)) (c.sourceIds || []).forEach((i) => citedIds.add(i));
  for (const s of partitionStories(snapshot.stories, focusId).accepted) (s.sourceIds || []).forEach((i) => citedIds.add(i));
  for (const p of currentPassages) (p.sourceIds || []).forEach((i) => citedIds.add(i));
  const used = [...register.values()].sort((a, b) => {
    const ca = citedIds.has(a.source.id) ? 0 : 1;
    const cb = citedIds.has(b.source.id) ? 0 : 1;
    return ca - cb || a.number - b.number;
  });
  const openList = openQuestionsFrom(snapshot);
  const openLines = Math.min(openList.length, 14);
  const reserveForOpen = 34 + openLines * 12.2 + (openList.length > openLines ? 12 : 0);

  for (const { number, source } of used) {
    if (y4 > p4.height - FOOTER_RESERVE - reserveForOpen) {
      warnings.push(`The printed source list shows ${number - 1} of ${used.length} entries. The complete numbered register is in book.html and sources.json.`);
      cuts.push('source_list_truncated');
      break;
    }
    const head = `[${number}] ${source.title || source.originalLocator || source.id}`;
    y4 = p4.paragraph({ x: MARGIN, y: y4, maxWidth: p4.width - MARGIN * 2, font: 'serif', size: 9.2, color: INK, leading: 12, text: head });
    const bits = [
      (source.kind || 'source').replace(/_/g, ' '),
      source.origin,
      source.originalLocator,
      source.reconstruction?.reconstructed ? 'reconstructed chat format' : null,
      source.textWithheld ? 'English derivative; original text held privately' : null,
      source.unresolved ? 'original document not supplied' : null,
    ].filter(Boolean).join(' · ');
    y4 = p4.paragraph({ x: MARGIN + 11, y: y4, maxWidth: p4.width - MARGIN * 2 - 11, font: 'sans', size: 7.6, color: MUTED, leading: 10, text: bits }) + 5;
  }

  y4 += 10;
  p4.text({ x: MARGIN, y: y4, text: 'Still to discover', font: 'sans', size: 11.5, color: INK });
  y4 += 17;
  if (!openList.length) {
    p4.text({ x: MARGIN, y: y4, text: 'No unresolved items were recorded at export time.', font: 'serif', size: 9.2, color: MUTED });
  } else {
    let printed = 0;
    for (const q of openList) {
      if (y4 > p4.height - FOOTER_RESERVE - 14) break;
      y4 = p4.paragraph({ x: MARGIN + 9, y: y4, maxWidth: p4.width - MARGIN * 2 - 9, font: 'serif', size: 8.8, color: INK, leading: 11.6, text: `${q.status === 'error' ? '!' : '-'} ${displayText(q.text)}` }) + 2;
      printed += 1;
    }
    if (printed < openList.length) {
      p4.text({ x: MARGIN + 9, y: y4 + 3, text: `... and ${openList.length - printed} more in research-notes.json.`, font: 'sans', size: 7.6, color: MUTED });
    }
  }
  if (y4 > p4.height - FOOTER_RESERVE + 12) guardFailures.push('Source and open-question content overflows page 4.');
  footer(p4, 'Osmy Roots. Supplied family records assembled and reviewed in this session, not new archive discoveries.', 4);

  const bytes = doc.toBuffer();
  warnings.push(...doc.warnings);
  return {
    bytes, pages: doc.pages.length, warnings, guardFailures,
    staleFlagged: stale, invalidPassages: invalid, cuts, sourceRegister: register,
    fonts: { body: serif.font.name, headings: sans.font.name },
  };
}
