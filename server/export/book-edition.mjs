/**
 * The full English family edition, 35 to 40 paginated pages.
 *
 * This replaces the fixed four-page layout for the current demo. The four-page
 * renderer stays available for older packets and for the compact fallback.
 *
 * What is prepared and what is current are kept apart on purpose:
 *   * prepared chapters come from the supplied family book and carry its locators
 *   * people, life years, photographs, reviewed decisions and open questions come
 *     from the CURRENT snapshot, so an answer changed a minute ago changes the book
 *   * accepted Astra passages are printed in their own marked block with citations
 * A prepared chapter never overrides a current reviewed value, and the renderer
 * never writes a fact that has no source.
 *
 * Pagination is real: content flows, sections start where they start, and the
 * contents page is produced from a first pass so its page numbers are the actual
 * ones. No blank, duplicated or filler page is emitted to reach a page count.
 */

import { PdfDocument, A4 } from './pdf/document.mjs';
import { loadBookFonts } from './book-pdf.mjs';
import { partitionPassages, openQuestionsFrom, claimText, photoReviewLabel } from './select.mjs';
import { UNKNOWN_LABEL } from '../contracts/types.mjs';
import { hasNonLatinScript } from './english.mjs';

const INK = [0.11, 0.11, 0.13];
const MUTED = [0.42, 0.42, 0.47];
const RULE = [0.82, 0.80, 0.76];
const ACCENT = [0.35, 0.24, 0.16];
const CARD = [0.97, 0.96, 0.94];

const MARGIN = 62;
export const TARGET_MIN_PAGES = 35;
export const TARGET_MAX_PAGES = 40;

/** Layout densities tried in order until the edition lands inside the page range. */
const DENSITIES = [
  { id: 'roomy', exhibitsPerPage: 2, bodySize: 11, leading: 16.5, registerColumns: 2 },
  { id: 'standard', exhibitsPerPage: 3, bodySize: 10.5, leading: 15.5, registerColumns: 2 },
  { id: 'tight', exhibitsPerPage: 4, bodySize: 10, leading: 14.5, registerColumns: 3 },
  { id: 'compact', exhibitsPerPage: 5, bodySize: 9.5, leading: 13.6, registerColumns: 3 },
];

const personLabel = (p) => p?.displayNameEn || p?.originalName || p?.id || UNKNOWN_LABEL;
const yearsLabel = (p) => (p?.lifeYears?.label ? p.lifeYears.label : UNKNOWN_LABEL);

/**
 * Page flow with running footer and section bookkeeping.
 * Y is measured from the top, matching PageContext.
 */
class Flow {
  constructor(doc, { footerText }) {
    this.doc = doc;
    this.footerText = footerText;
    this.page = null;
    this.pageNo = 0;
    this.y = 0;
    this.sections = [];
    this.current = null;
    this.width = A4.width - MARGIN * 2;
    this.bottom = A4.height - 66;
  }

  newPage() {
    if (this.page) this._footer();
    this.page = this.doc.addPage();
    this.pageNo += 1;
    this.y = MARGIN + 8;
    return this.page;
  }

  _footer() {
    const fy = A4.height - 40;
    this.page.setStroke(RULE).setLineWidth(0.5).line(MARGIN, fy - 12, A4.width - MARGIN, fy - 12);
    this.page.text({ x: MARGIN, y: fy, text: this.footerText, font: 'sans', size: 7.5, color: MUTED });
    this.page.text({ x: A4.width - MARGIN, y: fy, text: String(this.pageNo), font: 'sans', size: 7.5, color: MUTED, align: 'right' });
  }

  finish() { if (this.page) this._footer(); }

  /** Start a new page when `need` points do not fit below the cursor. */
  ensure(need) {
    if (this.y + need > this.bottom) this.newPage();
  }

  section(id, title, { newPage = false } = {}) {
    if (newPage || this.pageNo === 0) this.newPage();
    else this.ensure(120);
    this.current = { id, title, startPage: this.pageNo, endPage: this.pageNo };
    this.sections.push(this.current);
    return this.current;
  }

  heading(text, size = 15) {
    this.ensure(size + 26);
    this.page.text({ x: MARGIN, y: this.y, text, font: 'serif', size, color: INK });
    this.y += size + 6;
    this.page.setStroke(RULE).setLineWidth(0.6).line(MARGIN, this.y, MARGIN + 110, this.y);
    this.y += 16;
    if (this.current) this.current.endPage = this.pageNo;
  }

  note(text, size = 8) {
    const lines = this.doc.wrap('sans', text, size, this.width);
    const leading = size + 3.5;
    for (const line of lines) {
      if (this.y + leading > this.bottom) this.newPage();
      if (line) this.page.text({ x: MARGIN, y: this.y, text: line, font: 'sans', size, color: MUTED });
      this.y += leading;
    }
    this.y += 4;
    if (this.current) this.current.endPage = this.pageNo;
  }

  /**
   * Flow a paragraph line by line so it can break across pages without clipping.
   * Returns the number of pages the paragraph touched.
   */
  para(text, { size, leading, font = 'serif', color = INK, indentX = MARGIN, maxWidth = null } = {}) {
    const width = maxWidth ?? this.width - (indentX - MARGIN);
    const lines = this.doc.wrap(font, text, size, width);
    for (const line of lines) {
      if (this.y + leading > this.bottom) this.newPage();
      if (line) this.page.text({ x: indentX, y: this.y, text: line, font, size, color });
      this.y += leading;
    }
    this.y += Math.round(leading * 0.35);
    if (this.current) this.current.endPage = this.pageNo;
  }

  gap(n) { this.y += n; }
}

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

const markersFor = (ids, register) => {
  const nums = [...new Set((ids || []).map((id) => register.get(id)?.number).filter(Boolean))];
  return nums.length ? `[${nums.join(',')}]` : '';
};

/**
 * @param {object} args
 * @param {object} args.snapshot          current project snapshot
 * @param {object} args.bookPlan          prepared English chapters and coverage
 * @param {Array}  [args.passages]        current accepted Astra passages
 * @param {Function} args.getImage        (assetId) -> {bytes, mediaType} | null
 * @param {Array}  [args.photoPairs]      PhotoPairV3 records for old photographs
 * @param {Array}  [args.portraits]       reviewed portrait assignments
 * @param {object} [args.options]
 * @returns {{bytes:Buffer, pages:number, sections:Array, coverage:Array, warnings:string[], cuts:string[], density:string}}
 */
export function renderBookEdition({ snapshot, bookPlan, passages = [], getImage, photoPairs = [], portraits = [], options = {} }) {
  const attempts = [];
  let last = null;
  for (const density of DENSITIES) {
    last = renderOnce({ snapshot, bookPlan, passages, getImage, photoPairs, portraits, options, density });
    attempts.push({ density: density.id, pages: last.pages });
    if (last.pages >= TARGET_MIN_PAGES && last.pages <= TARGET_MAX_PAGES) {
      last.attempts = attempts;
      return last;
    }
    // Over the ceiling: try a denser layout. Under the floor: a rooomier one is
    // earlier in the list, so nothing more can be done without inventing pages.
    if (last.pages < TARGET_MIN_PAGES) break;
  }
  last.attempts = attempts;
  last.cuts.push(`Edition is ${last.pages} pages, outside the ${TARGET_MIN_PAGES}-${TARGET_MAX_PAGES} target. Content was not padded or truncated to reach the range.`);
  return last;
}

function renderOnce({ snapshot, bookPlan, passages, getImage, photoPairs, portraits, options, density }) {
  // First pass discovers the real page numbers; the second prints the contents.
  const first = buildDocument({ snapshot, bookPlan, passages, getImage, photoPairs, portraits, options, density, contents: null });
  const contents = first.sections.filter((s) => s.inContents);
  const second = buildDocument({ snapshot, bookPlan, passages, getImage, photoPairs, portraits, options, density, contents });
  return second;
}

function buildDocument({ snapshot, bookPlan, passages, getImage, photoPairs, portraits, options, density, contents }) {
  const warnings = [];
  const cuts = [];
  const guardFailures = [];
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  const sources = snapshot.sources || [];
  const register = buildSourceRegister(sources);
  const chapters = bookPlan?.chapters || [];

  const { current: currentPassages, stale, invalid } = partitionPassages(passages, snapshot.version);
  for (const s of stale) warnings.push(`STALE PASSAGE EXCLUDED: ${s.reason}`);
  for (const i of invalid) warnings.push(`INVALID PASSAGE EXCLUDED: ${i.reason}`);

  const title = options.title || 'Our family: history, people, roots';
  const dedication = options.dedication || 'For Dad.';
  const coverSample = [title, dedication, ...chapters.map((c) => `${c.title} ${c.text}`), ...[...people.values()].map((p) => `${p.displayNameEn} ${p.originalName}`)]
    .join(' ').slice(0, 8000);
  const { serif, sans } = loadBookFonts(coverSample);
  if (!serif.font || !sans.font) {
    const err = new Error(`No embeddable font covering the book text. Tried: ${[...serif.tried, ...sans.tried].join('; ')}`);
    err.code = 'NO_FONT';
    throw err;
  }
  const doc = new PdfDocument({ size: A4, info: { title, author: options.author || 'Osmy Roots', subject: 'Family history, assembled from reviewed evidence' } });
  doc.addFont('serif', serif.font);
  doc.addFont('sans', sans.font);

  if (options.englishOnly !== false) {
    for (const passage of currentPassages) if (hasNonLatinScript(passage.text)) guardFailures.push(`Passage ${passage.id} contains non-English text.`);
    for (const c of chapters) if (hasNonLatinScript(c.text)) guardFailures.push(`Prepared chapter ${c.id} contains non-English text.`);
  }
  for (const record of [...(snapshot.claims || []), ...(snapshot.stories || []), ...currentPassages]) {
    for (const id of record.sourceIds || []) if (!register.has(id)) guardFailures.push(`Citation target ${id} is absent from the source register.`);
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

  const annotationFor = (assetId) => (snapshot.photoAnnotations || []).find((a) => a.assetId === assetId) || null;
  const pairByOriginal = new Map(photoPairs.map((p) => [p.originalAssetId, p]));
  const portraitByPerson = new Map(portraits.map((p) => [p.personId, p]));

  const captionFor = (assetId, limit) => {
    const a = annotationFor(assetId);
    const cite = [...new Set((a?.support || []).map((s) => `${markersFor([s.sourceId], register)} ${s.locator}`))].join('; ');
    const review = photoReviewLabel(snapshot, assetId);
    return { text: readableCaption(a?.caption, limit), review, cite };
  };

  const flow = new Flow(doc, { footerText: `${title}. Project version ${snapshot.version}.` });
  const body = { size: density.bodySize, leading: density.leading };
  const coverage = [];

  // ------------------------------------------------------------------ cover
  flow.newPage();
  flow.current = { id: 'cover', title: 'Cover', startPage: 1, endPage: 1, inContents: false };
  flow.sections.push(flow.current);
  flow.page.setFill([0.99, 0.985, 0.975]).rect(0, 0, A4.width, A4.height);
  flow.page.setStroke(ACCENT).setLineWidth(1.2).line(MARGIN, 96, A4.width - MARGIN, 96);
  flow.page.text({ x: MARGIN, y: 82, text: 'Osmy Roots', font: 'sans', size: 11, color: ACCENT });
  flow.page.text({ x: A4.width / 2, y: 250, text: 'Our family', font: 'serif', size: 34, color: INK, align: 'center' });
  flow.page.text({ x: A4.width / 2, y: 292, text: 'History, people, roots', font: 'serif', size: 17, color: MUTED, align: 'center' });

  const coverAssetId = options.coverAssetId || bookPlan?.coverAssetId || (snapshot.photoAnnotations || [])[0]?.assetId;
  const coverImage = putImage(coverAssetId);
  let coverBottom = 340;
  if (coverImage) {
    const box = flow.page.image(coverImage, { x: MARGIN + 90, y: 330, width: A4.width - (MARGIN + 90) * 2, height: 290 });
    const cap = captionFor(coverAssetId, 200);
    coverBottom = flow.page.paragraph({
      x: MARGIN + 70, y: (box ? box.y + box.h : 620) + 18, maxWidth: A4.width - (MARGIN + 70) * 2,
      font: 'sans', size: 8, color: MUTED, text: `${cap.text} ${cap.review}`, leading: 11, align: 'center',
    });
  }
  flow.page.text({
    x: A4.width / 2, y: Math.min(Math.max(coverBottom + 26, 690), A4.height - 96),
    text: `English edition, project version ${snapshot.version}`, font: 'sans', size: 9.5, color: MUTED, align: 'center',
  });

  // ------------------------------------------------------------- dedication
  flow.section('dedication', 'For Dad', { newPage: true });
  flow.current.inContents = true;
  const dedicationChapter = chapters.find((c) => c.id === 'ch-dedication');
  flow.gap(140);
  flow.page.text({ x: A4.width / 2, y: flow.y, text: dedication, font: 'serif', size: 20, color: ACCENT, align: 'center' });
  flow.y += 46;
  if (dedicationChapter) {
    for (const p of dedicationChapter.text.split(/\n\n+/)) {
      flow.para(p, { ...body, indentX: MARGIN + 60, maxWidth: flow.width - 120 });
    }
    coverage.push({ chapterId: dedicationChapter.id, section: 'dedication' });
  }

  // ---------------------------------------------------------------- contents
  flow.section('contents', 'Contents', { newPage: true });
  flow.current.inContents = false;
  flow.heading('Contents', 17);
  if (contents) {
    for (const s of contents) {
      flow.ensure(16);
      flow.page.text({ x: MARGIN, y: flow.y, text: s.title, font: 'serif', size: 11, color: INK });
      flow.page.text({ x: A4.width - MARGIN, y: flow.y, text: String(s.startPage), font: 'sans', size: 10, color: MUTED, align: 'right' });
      flow.page.setStroke([0.9, 0.89, 0.87]).setLineWidth(0.4).line(MARGIN + 220, flow.y - 3, A4.width - MARGIN - 22, flow.y - 3);
      flow.y += 16;
    }
  }

  // -------------------------------------------------- prepared chapter flow
  const skipInFlow = new Set(['ch-dedication', 'ch-open-questions', 'ch-sources']);
  let currentPart = null;
  for (const chapter of chapters) {
    if (skipInFlow.has(chapter.id)) continue;
    const partChanged = chapter.part && chapter.part !== currentPart;
    flow.section(`chapter:${chapter.id}`, chapter.title, { newPage: partChanged });
    flow.current.inContents = true;
    if (partChanged) {
      currentPart = chapter.part;
      flow.page.text({ x: MARGIN, y: flow.y, text: currentPart, font: 'sans', size: 10, color: ACCENT });
      flow.y += 22;
    }
    flow.heading(chapter.title, 15);
    const locators = compressLocators(chapter.sourceLocators || []);
    if (locators) flow.note(`Supplied family book ${markersFor([chapter.support?.[0]?.sourceId].filter(Boolean), register)} ${locators}`);
    for (const p of chapter.text.split(/\n\n+/)) flow.para(p, body);

    // Photographs attached to this chapter sit with their text.
    for (const assetId of chapter.assetIds || []) {
      const image = putImage(assetId);
      if (!image) continue;
      flow.ensure(230);
      const box = flow.page.image(image, { x: MARGIN, y: flow.y, width: flow.width, height: 200 });
      flow.y = (box ? box.y + box.h : flow.y + 200) + 8;
      const cap = captionFor(assetId);
      flow.para(`${cap.text} ${cap.review}${cap.cite ? ` Source: ${cap.cite}` : ''}`, { size: 8, leading: 11, font: 'sans', color: MUTED });
    }

    // Current reviewed values for the people this chapter is about.
    const chapterPeople = (chapter.personIds || []).map((id) => people.get(id)).filter(Boolean);
    if (chapterPeople.length) {
      flow.ensure(30 + chapterPeople.length * 13);
      flow.note('Current record in this project');
      for (const person of chapterPeople) {
        flow.ensure(14);
        const status = person.recordStatus && person.recordStatus !== 'reported' ? ` (${person.recordStatus})` : '';
        flow.page.text({ x: MARGIN + 10, y: flow.y, text: `${personLabel(person)}, ${yearsLabel(person)}${status}`, font: 'sans', size: 8.5, color: MUTED });
        flow.y += 13;
      }
      flow.gap(6);
    }
    coverage.push({
      chapterId: chapter.id,
      pages: rangeOf(flow.current),
      personIds: chapter.personIds || [],
      assetIds: chapter.assetIds || [],
      sourceLocators: chapter.sourceLocators || [],
    });
  }

  // ---------------------------------------------- current accepted passages
  flow.section('current-passages', 'What this project added', { newPage: true });
  flow.current.inContents = true;
  flow.heading('What this project added', 15);
  flow.note('Written during research from reviewed evidence, not part of the supplied family book.');
  if (!currentPassages.length) {
    flow.para('Nothing has been accepted yet in this project beyond the supplied material. This section fills as passages are reviewed and accepted.', { ...body, color: MUTED });
  } else {
    for (const passage of currentPassages) {
      const subject = passage.personId ? personLabel(people.get(passage.personId)) : 'The family';
      flow.ensure(50);
      flow.page.text({ x: MARGIN, y: flow.y, text: subject, font: 'sans', size: 10, color: ACCENT });
      flow.y += 16;
      flow.para(passage.text, body);
      flow.note(`${markersFor(passage.sourceIds, register)} ${(passage.spans || []).map((s) => s.locator).join('; ')}`);
      if (passage.uncertainty) flow.note(`Still uncertain: ${passage.uncertainty}`);
      flow.gap(6);
    }
  }

  // -------------------------------------------------------- people register
  flow.section('register', 'Everyone in this book', { newPage: true });
  flow.current.inContents = true;
  flow.heading('Everyone in this book', 15);
  flow.note(`${people.size} people. Life years come from the current project record. Unknown means the family has no date, not that the person has none.`);
  const cols = density.registerColumns;
  const colWidth = (flow.width - (cols - 1) * 14) / cols;
  const roster = [...people.values()].sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
  let col = 0;
  // Every column on a page starts below whatever heading that page already carries,
  // otherwise column two would be printed over the introduction.
  let columnTop = flow.y;
  let rowTop = columnTop;
  for (const person of roster) {
    const lineHeight = 26;
    if (rowTop + lineHeight > flow.bottom) {
      col += 1;
      if (col >= cols) { flow.newPage(); col = 0; columnTop = MARGIN + 8; }
      rowTop = columnTop;
    }
    const x = MARGIN + col * (colWidth + 14);
    const claims = (snapshot.claims || []).filter((c) => c.subjectId === person.id);
    const marker = markersFor(claims.flatMap((c) => c.sourceIds || []), register);
    flow.page.text({ x, y: rowTop, text: personLabel(person), font: 'serif', size: 9.5, color: INK });
    flow.page.text({ x, y: rowTop + 11, text: `${yearsLabel(person)} ${marker}`.trim(), font: 'sans', size: 7.5, color: MUTED });
    rowTop += lineHeight;
    flow.y = Math.max(flow.y, rowTop);
    flow.current.endPage = flow.pageNo;
  }
  flow.y = flow.bottom - 4;

  // ------------------------------------------------------------- exhibits
  flow.section('exhibits', 'Photographs and documents', { newPage: true });
  flow.current.inContents = true;
  flow.heading('Photographs and documents', 15);
  flow.note('Every photograph received by this project appears here. Where an enhanced version exists, both are shown and labelled. An enhanced picture is a readability aid; it is never evidence of who is in the frame.');

  const annotations = snapshot.photoAnnotations || [];
  const perPage = density.exhibitsPerPage;
  const slotHeight = Math.floor((flow.bottom - MARGIN - 60) / perPage);
  let inPage = 0;
  for (const annotation of annotations) {
    const pair = pairByOriginal.get(annotation.assetId);
    const needed = slotHeight;
    if (inPage >= perPage || flow.y + needed > flow.bottom) { flow.newPage(); inPage = 0; }
    const top = flow.y;
    const imageHeight = slotHeight - 68;
    const original = putImage(annotation.assetId);
    if (pair) {
      const half = (flow.width - 16) / 2;
      const enhanced = putImage(pair.enhancedAssetId);
      if (original) flow.page.image(original, { x: MARGIN, y: top, width: half, height: imageHeight });
      if (enhanced) flow.page.image(enhanced, { x: MARGIN + half + 16, y: top, width: half, height: imageHeight });
      flow.page.text({ x: MARGIN, y: top + imageHeight + 11, text: pair.originalLabel || 'Original', font: 'sans', size: 8, color: ACCENT });
      flow.page.text({ x: MARGIN + half + 16, y: top + imageHeight + 11, text: pair.enhancedLabel || 'Enhanced', font: 'sans', size: 8, color: ACCENT });
      if (!enhanced) warnings.push(`Enhanced version of ${annotation.assetId} is missing; the exhibit shows the original alone.`);
    } else if (original) {
      flow.page.image(original, { x: MARGIN, y: top, width: flow.width, height: imageHeight });
      flow.page.text({ x: MARGIN, y: top + imageHeight + 11, text: 'Original', font: 'sans', size: 8, color: ACCENT });
    } else {
      flow.page.setFill(CARD).rect(MARGIN, top, flow.width, imageHeight);
      flow.page.text({ x: A4.width / 2, y: top + imageHeight / 2, text: 'Original bytes are missing from this project', font: 'sans', size: 9, color: MUTED, align: 'center' });
    }
    const cap = captionFor(annotation.assetId, 240);
    flow.y = top + imageHeight + 22;
    flow.para(`${cap.text}`, { size: 8.5, leading: 11, font: 'serif', color: INK });
    // The full preparation method lives in the pair record and the HTML edition; the
    // printed exhibit keeps one short line so it cannot run into the next exhibit.
    flow.para(`${cap.review}${cap.cite ? ` Source: ${cap.cite}` : ''}${pair ? ' Enhanced version: luminance-only tone and detail pass, chroma preserved.' : ''}`, { size: 7.5, leading: 10, font: 'sans', color: MUTED });
    flow.y = Math.max(flow.y + 6, top + slotHeight);
    if (flow.y > flow.bottom) { flow.newPage(); inPage = 0; } else inPage += 1;
    coverage.push({ assetId: annotation.assetId, pages: [flow.pageNo], paired: Boolean(pair) });
    flow.current.endPage = flow.pageNo;
  }

  // -------------------------------------------------------------- sources
  flow.section('sources', 'Sources', { newPage: true });
  flow.current.inContents = true;
  flow.heading('Sources', 15);
  flow.note('Every file this project received, numbered. Citations in the text use these numbers. Complete originals are preserved in the project archive.');
  const sourcesChapter = chapters.find((c) => c.id === 'ch-sources');
  if (sourcesChapter) {
    for (const p of sourcesChapter.text.split(/\n\n+/)) flow.para(p, { ...body, size: body.size - 0.5 });
    flow.gap(6);
    coverage.push({ chapterId: sourcesChapter.id, pages: rangeOf(flow.current) });
  }
  for (const { number, source } of [...register.values()].sort((a, b) => a.number - b.number)) {
    flow.ensure(34);
    flow.page.text({ x: MARGIN, y: flow.y, text: `[${number}]`, font: 'sans', size: 9, color: ACCENT });
    flow.page.text({ x: MARGIN + 30, y: flow.y, text: source.title || source.originalLocator || source.id, font: 'serif', size: 9.5, color: INK });
    flow.y += 12;
    const meta = [source.kind, source.contentHash ? `sha256 ${String(source.contentHash).slice(0, 16)}` : null].filter(Boolean).join(', ');
    flow.page.text({ x: MARGIN + 30, y: flow.y, text: meta, font: 'sans', size: 7.5, color: MUTED });
    flow.y += 11;
    const excerpt = String(source.originalText || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    if (excerpt) flow.para(`"${excerpt}${source.originalText.length > 220 ? '...' : ''}"`, { size: 8, leading: 10.5, font: 'serif', color: MUTED, indentX: MARGIN + 30 });
    else flow.para('Stored original, no extractable text.', { size: 8, leading: 10.5, font: 'sans', color: MUTED, indentX: MARGIN + 30 });
    coverage.push({ sourceId: source.id, pages: [flow.pageNo] });
  }

  // ------------------------------------------------------- open questions
  flow.section('open-questions', 'What is still open', { newPage: true });
  flow.current.inContents = true;
  flow.heading('What is still open', 15);
  const openChapter = chapters.find((c) => c.id === 'ch-open-questions');
  if (openChapter) for (const p of openChapter.text.split(/\n\n+/)) flow.para(p, body);
  const live = openQuestionsFrom(snapshot) || [];
  if (live.length) {
    flow.gap(8);
    flow.note('Raised or still unanswered in this project');
    for (const q of live) {
      flow.ensure(24);
      flow.para(`${q.text || q.prompt || q.uncertainty || 'Unresolved'}`, { size: 9, leading: 12.5, font: 'serif', color: INK, indentX: MARGIN + 10 });
      if (q.sourceIds?.length) flow.note(`${markersFor(q.sourceIds, register)}`);
    }
  }

  flow.finish();

  if (guardFailures.length) {
    const err = new Error(`Book edition guard failed: ${guardFailures.join(' ')}`);
    err.code = 'BOOK_GUARD';
    throw err;
  }

  const bytes = doc.toBuffer();
  for (const w of doc.warnings) warnings.push(w);
  return {
    bytes,
    pages: flow.pageNo,
    sections: flow.sections,
    coverage,
    warnings,
    cuts,
    density: density.id,
  };
}

/**
 * A photo note section carries the family's sentence first, then machine-readable
 * "People named" and "Left to right" lines. The book prints the sentence; the exact
 * section text stays available through the citation.
 */
/**
 * "file p.13", "file p.14", "file p.15" is the same statement three times. Print the
 * file once and collapse consecutive pages into a range so the line stays readable.
 */
export function compressLocators(locators) {
  const byFile = new Map();
  const plain = [];
  for (const raw of locators) {
    const m = /^(.*?)\s+p\.(\d+)$/.exec(String(raw).trim());
    if (!m) { plain.push(String(raw)); continue; }
    if (!byFile.has(m[1])) byFile.set(m[1], []);
    byFile.get(m[1]).push(Number(m[2]));
  }
  const parts = [];
  for (const [file, pages] of byFile) {
    const sorted = [...new Set(pages)].sort((a, b) => a - b);
    const runs = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (const page of sorted.slice(1)) {
      if (page === prev + 1) { prev = page; continue; }
      runs.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = page; prev = page;
    }
    runs.push(start === prev ? `${start}` : `${start}-${prev}`);
    parts.push(`${file} p.${runs.join(', ')}`);
  }
  return [...parts, ...plain].join('; ');
}

export function readableCaption(caption, limit = 320) {
  const raw = String(caption || '').trim();
  if (!raw) return 'No caption was supplied with this photograph.';
  const cut = raw.split(/\n\s*(?:People named in the caption:|Left to right:)/i)[0].trim();
  const text = (cut || raw).replace(/\s+/g, ' ');
  return text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;
}

function rangeOf(section) {
  const out = [];
  for (let p = section.startPage; p <= section.endPage; p += 1) out.push(p);
  return out;
}
