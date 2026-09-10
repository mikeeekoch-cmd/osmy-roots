/**
 * English-only demo output.
 *
 * Every visible string and every exported source in the demo bundle must be
 * English. Russian originals and audit notes stay private. A derivative keeps a
 * link back to the private original's hash and locator so the lineage survives
 * without exposing the original text.
 */

const NON_LATIN = /[Ѐ-ӿԀ-ԯͰ-Ͽ֐-׿؀-ۿ一-鿿]/;

export function hasNonLatinScript(text) {
  return NON_LATIN.test(String(text || ''));
}

/** A source is private when it is a raw original or an internal audit record. */
export function isPrivateSource(source) {
  if (!source) return true;
  if (source.private === true || source.auditOnly === true) return true;
  if (source.kind === 'audit_note' || source.kind === 'private_original') return true;
  return false;
}

/**
 * Keep English derivatives; drop private originals; report anything that would
 * have printed non-Latin text so Product can supply a derivative.
 */
export function selectEnglishSources(sources = []) {
  const kept = [];
  const excluded = [];
  const needsDerivative = [];
  for (const s of sources) {
    if (isPrivateSource(s)) { excluded.push({ id: s.id, reason: 'private original or audit note' }); continue; }
    if (hasNonLatinScript(s.originalText)) {
      needsDerivative.push({ id: s.id, locator: s.originalLocator });
      // Retain the record and its lineage, but never print the untranslated body.
      kept.push({
        ...s,
        originalText: '',
        textWithheld: true,
        withheldReason: 'Non-English source text is not included in the English demo bundle. The English derivative and the original locator carry the evidence.',
        derivedFrom: s.derivedFrom || { contentHash: s.contentHash, locator: s.originalLocator },
      });
      continue;
    }
    kept.push(s);
  }
  return { sources: kept, excluded, needsDerivative };
}

/** Stories and passages must already be English; anything else is reported. */
export function checkEnglishText(records = [], label = 'record') {
  const problems = [];
  for (const r of records) {
    const text = r?.text ?? '';
    if (hasNonLatinScript(text)) {
      problems.push(`${label} ${r.id || '(unnamed)'} contains non-English text and cannot appear in the English bundle.`);
    }
  }
  return problems;
}

/** Bundle filenames must be English and portable. */
export function isEnglishFilename(name) {
  return /^[A-Za-z0-9._\-/ ]+$/.test(String(name || ''));
}
