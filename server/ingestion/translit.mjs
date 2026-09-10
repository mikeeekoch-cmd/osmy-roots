/**
 * Cyrillic to Latin transliteration for English display names.
 *
 * The book is English, but the ORIGINAL name is always preserved alongside the
 * transliteration (contract: person.displayNameEn + person.originalName).
 * This is a rendering aid, never a source of fact, and never a name match.
 */

const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
};

function translitWord(word) {
  if (!word) return '';
  // Common Russian name endings read better collapsed than letter-by-letter.
  let w = word.toLowerCase();
  w = w.replace(/ий$/, 'y').replace(/ый$/, 'y').replace(/ья$/, 'ya');
  let out = '';
  for (const ch of w) {
    out += Object.prototype.hasOwnProperty.call(MAP, ch) ? MAP[ch] : ch;
  }
  // Word-initial iotated vowels.
  out = out.replace(/^e/, 'ye');
  if (!out) return '';
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Transliterate an arbitrary string, preserving separators. */
export function transliterate(text) {
  if (!text) return '';
  return String(text)
    .split(/(\s+|-)/)
    .map((part) => (/^\s+$/.test(part) || part === '-' ? part : translitWord(part)))
    .join('');
}

/** True when the string contains any Cyrillic character. */
export function hasCyrillic(text) {
  return /[Ѐ-ӿ]/.test(String(text || ''));
}

/**
 * Build an English display name from a "Surname Given Patronymic" source string.
 * Returns given-patronymic-surname order, which reads naturally in English prose.
 * If the input is already Latin it is returned unchanged.
 */
export function displayNameFromFullName(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return '';
  if (!hasCyrillic(raw)) return raw;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return transliterate(parts[0]);
  const [surname, ...rest] = parts;
  return [...rest.map(transliterate), transliterate(surname)].join(' ');
}
