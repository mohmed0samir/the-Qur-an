/**
 * Local Quran search over the validated Uthmani text.
 *
 * Filters:
 *  - all     : the query occurs anywhere in the ayah (whole word or inside a word)
 *  - exact   : the query occurs as complete word(s)
 *  - partial : the query occurs inside longer words (e.g. "رحم" in "الرحمن")
 *  - surah   : surah names / numbers (see searchSurahs)
 *
 * Matching ignores diacritics and spelling variants (see lib/arabic.ts).
 */
import type { AyahMatch, Surah, SurahMatch } from "../types";
import {
  displayAyahText,
  normalizeArabic,
  normalizeWithMap,
  toAsciiDigits,
  toOriginalRange
} from "./arabic";
import type { QuranIndexSource } from "./parse";

export interface IndexedAyah {
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  /** Display text (leading Basmala hidden for ayah 1, otherwise exactly as received). */
  text: string;
  /** Normalized search text for `text`. */
  norm: string;
}

export function buildIndex(source: QuranIndexSource): IndexedAyah[] {
  const names = new Map(source.surahs.map((s) => [s.number, s.name]));
  return source.ayahs.map((a) => {
    const text = displayAyahText(a.surahNumber, a.ayahNumber, a.text);
    return {
      surahNumber: a.surahNumber,
      ayahNumber: a.ayahNumber,
      surahName: names.get(a.surahNumber) ?? "",
      text,
      norm: normalizeArabic(text)
    };
  });
}

interface Occurrence {
  start: number;
  end: number;
  whole: boolean;
}

export function findOccurrences(norm: string, query: string): Occurrence[] {
  const found: Occurrence[] = [];
  if (!query) return found;
  let from = 0;
  for (;;) {
    const i = norm.indexOf(query, from);
    if (i === -1) break;
    const end = i + query.length;
    const whole = (i === 0 || norm[i - 1] === " ") && (end === norm.length || norm[end] === " ");
    found.push({ start: i, end, whole });
    from = end;
  }
  return found;
}

export type AyahFilter = "all" | "exact" | "partial";

export interface AyahSearchOutcome {
  matches: AyahMatch[];
  /** True when no phrase match existed and ayahs containing all the words were returned instead. */
  wordsFallback: boolean;
}

function toMatch(entry: IndexedAyah, normRanges: Array<[number, number]>): AyahMatch {
  const { map } = normalizeWithMap(entry.text);
  const ranges: Array<[number, number]> = normRanges.map(([s, e]) => toOriginalRange(entry.text, map, s, e));
  return {
    kind: "ayah",
    surahNumber: entry.surahNumber,
    surahName: entry.surahName,
    ayahNumber: entry.ayahNumber,
    text: entry.text,
    ranges
  };
}

export function searchAyahs(index: IndexedAyah[], rawQuery: string, filter: AyahFilter): AyahSearchOutcome {
  const query = normalizeArabic(rawQuery);
  if (!query) return { matches: [], wordsFallback: false };

  const matches: AyahMatch[] = [];
  for (const entry of index) {
    const occ = findOccurrences(entry.norm, query);
    if (occ.length === 0) continue;
    const used =
      filter === "exact" ? occ.filter((o) => o.whole) : filter === "partial" ? occ.filter((o) => !o.whole) : occ;
    if (used.length === 0) continue;
    matches.push(toMatch(entry, used.map((o) => [o.start, o.end] as [number, number])));
  }

  const words = query.split(" ").filter(Boolean);
  if (matches.length === 0 && filter === "all" && words.length > 1) {
    for (const entry of index) {
      if (!words.every((w) => entry.norm.includes(w))) continue;
      const ranges: Array<[number, number]> = [];
      for (const w of words) {
        for (const o of findOccurrences(entry.norm, w)) ranges.push([o.start, o.end]);
      }
      ranges.sort((a, b) => a[0] - b[0]);
      matches.push(toMatch(entry, ranges));
    }
    return { matches, wordsFallback: matches.length > 0 };
  }

  return { matches, wordsFallback: false };
}

export function searchSurahs(surahs: Surah[], rawQuery: string): SurahMatch[] {
  const asciiQuery = toAsciiDigits(rawQuery).trim();
  if (!asciiQuery) return [];

  if (/^\d{1,3}$/.test(asciiQuery)) {
    const n = Number(asciiQuery);
    return surahs.filter((s) => s.number === n).map((surah) => ({ kind: "surah" as const, surah }));
  }

  const q = normalizeArabic(rawQuery).replace(/^سوره\s+/, "");
  const latin = rawQuery.trim().toLowerCase();
  return surahs
    .filter((s) => {
      const arabic = normalizeArabic(s.name).replace(/^سوره\s+/, "");
      const arabicNoArticle = arabic.replace(/^ال/, "");
      const qNoArticle = q.replace(/^ال/, "");
      if (q && (arabic.includes(q) || (qNoArticle.length > 0 && arabicNoArticle.includes(qNoArticle)))) return true;
      if (/[a-z]/.test(latin)) {
        return (
          s.englishName.toLowerCase().includes(latin) || s.englishNameTranslation.toLowerCase().includes(latin)
        );
      }
      return false;
    })
    .map((surah) => ({ kind: "surah" as const, surah }));
}
