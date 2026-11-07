/**
 * Arabic text helpers.
 *
 * IMPORTANT: nothing in here ever rewrites Quran text that is shown to the
 * reader. `normalizeWithMap` produces a separate, search-only representation
 * and a map back to the original characters (used for highlighting).
 * `stripBasmalaPrefix` only *hides* a leading Basmala that some data sources
 * prepend to the first ayah of a surah, and only if it is exactly the Basmala.
 */

/** Standard Uthmani Basmala (used as a heading, never inside ayah text). */
export const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
const BASMALA_NORMALIZED = "بسم الله الرحمن الرحيم";

const DAGGER_ALEF = 0x0670;
const FATHA = 0x064e;

/** Diacritics, Quranic annotation marks, tatweel and invisible formatting chars. */
function isIgnorable(code: number): boolean {
  return (
    (code >= 0x064b && code <= 0x065f) ||
    code === DAGGER_ALEF ||
    (code >= 0x0610 && code <= 0x061a) ||
    (code >= 0x06d6 && code <= 0x06ed) ||
    (code >= 0x08d3 && code <= 0x08ff) ||
    code === 0x0640 ||
    (code >= 0x200b && code <= 0x200f) ||
    code === 0x061c ||
    code === 0xfeff
  );
}

const LETTER_MAP: Record<string, string> = {
  أ: "ا",
  إ: "ا",
  آ: "ا",
  ٱ: "ا",
  ى: "ي",
  ی: "ي",
  ة: "ه",
  ؤ: "و",
  ئ: "ي",
  ک: "ك"
};

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export function toArabicIndic(n: number): string {
  return String(n).replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]);
}

/** Converts Arabic-Indic / Persian digits in free text to ASCII digits. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a >= 0) return String(a);
    return String(EXTENDED_INDIC.indexOf(ch));
  });
}

export interface NormalizedText {
  /** Search-only representation. */
  norm: string;
  /** map[i] = index in the original string of normalized char i. */
  map: number[];
}

/**
 * Builds a diacritic-free, orthography-insensitive form of `s` for matching.
 * - removes tashkeel, Quranic marks, tatweel
 * - unifies alef forms, alef maqsura/yeh, teh marbuta/heh, hamza carriers
 * - "وٰ" (waw + dagger alef, e.g. ٱلصَّلَوٰةَ) becomes alef so it matches "الصلاة"
 * - word-initial "يَٰ" (vocative, written joined in the Uthmani script) becomes "يا "
 */
export function normalizeWithMap(s: string): NormalizedText {
  const out: string[] = [];
  const map: number[] = [];
  let pendingSpace = false;

  const push = (ch: string, index: number) => {
    out.push(ch);
    map.push(index);
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);

    if (isIgnorable(code)) continue;

    if (/\s/.test(ch)) {
      if (out.length > 0 && out[out.length - 1] !== " ") push(" ", i);
      pendingSpace = false;
      continue;
    }

    if (pendingSpace && out.length > 0 && out[out.length - 1] !== " ") {
      push(" ", i);
    }
    pendingSpace = false;

    const atWordStart = out.length === 0 || out[out.length - 1] === " ";

    if (ch === "و" && s.charCodeAt(i + 1) === DAGGER_ALEF) {
      push("ا", i);
      continue;
    }

    if (ch === "ي" && atWordStart) {
      let j = i + 1;
      if (s.charCodeAt(j) === FATHA) j++;
      if (s.charCodeAt(j) === DAGGER_ALEF) {
        push("ي", i);
        push("ا", i);
        pendingSpace = true;
        continue;
      }
    }

    push(LETTER_MAP[ch] ?? ch, i);
  }

  while (out.length > 0 && out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }

  return { norm: out.join(""), map };
}

export function normalizeArabic(s: string): string {
  return normalizeWithMap(s).norm;
}

/**
 * Converts a [start, end) range of normalized indices into a range of the
 * original string, extending the end over trailing diacritics so highlighted
 * words keep their marks.
 */
export function toOriginalRange(
  original: string,
  map: number[],
  normStart: number,
  normEnd: number
): [number, number] {
  const start = map[normStart];
  let end = map[normEnd - 1] + 1;
  while (end < original.length && isIgnorable(original.charCodeAt(end))) end++;
  return [start, end];
}

/**
 * If `text` starts with exactly the four words of the Basmala, returns the
 * remainder. Otherwise returns `text` unchanged.
 */
export function stripBasmalaPrefix(text: string): string {
  const re = /\S+/g;
  const words: string[] = [];
  let endIndex = 0;
  let m: RegExpExecArray | null;
  while (words.length < 4 && (m = re.exec(text)) !== null) {
    words.push(m[0]);
    endIndex = m.index + m[0].length;
  }
  if (words.length < 4) return text;
  if (normalizeArabic(words.join(" ")) !== BASMALA_NORMALIZED) return text;
  return text.slice(endIndex).trimStart();
}

/** Whether a surah is preceded by a Basmala heading (all except Al-Fatihah and At-Tawbah). */
export function surahHasBasmalaHeading(surahNumber: number): boolean {
  return surahNumber !== 1 && surahNumber !== 9;
}

/**
 * Text to display for an ayah. In Al-Fatihah the Basmala *is* ayah 1 and stays;
 * for other surahs a Basmala glued to ayah 1 by the data source is hidden because
 * the reader shows it as a heading.
 */
export function displayAyahText(surahNumber: number, numberInSurah: number, text: string): string {
  if (numberInSurah === 1 && surahHasBasmalaHeading(surahNumber)) {
    return stripBasmalaPrefix(text);
  }
  return text;
}
