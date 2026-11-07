/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Surah metadata as returned by alquran.cloud (no ayahs). */
export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: "Meccan" | "Medinan" | string;
}

/** Optional audio reference for one ayah (matched by global ayah number). */
export interface AudioRef {
  audio: string;
  audioSecondary: string[];
}

/**
 * One ayah as used by the reader. `text` is the Uthmani text exactly as
 * delivered by the API; it is never edited. (A leading Basmala in the first
 * ayah of a surah is only hidden at display time, see lib/arabic.ts.)
 */
export interface ReaderAyah {
  /** Global ayah number, 1..6236. Used to match audio. */
  number: number;
  numberInSurah: number;
  text: string;
  surahNumber: number;
  surahName: string;
  juz: number;
  page: number;
  sajda: boolean;
}

export type ReaderMode = "surah" | "juz";

/** A request to open the reader. `nonce` forces a reload for identical requests. */
export interface ReaderRequest {
  mode: ReaderMode;
  number: number;
  /** Position to open at. In Juz mode both fields are required to be unambiguous. */
  target?: { surahNumber: number; ayahNumber: number };
  autoPlay?: boolean;
  nonce: number;
}

export interface Reciter {
  id: string;
  name: string;
  englishName: string;
}

/** Saved ayah. Shape is unchanged from earlier versions (localStorage compatible). */
export interface Bookmark {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  text: string;
  timestamp: string;
}

/** Last read position. `mode`/`juz` are optional additions; older data lacks them. */
export interface LastRead extends Bookmark {
  mode?: ReaderMode;
  juz?: number;
}

export interface SurahMatch {
  kind: "surah";
  surah: Surah;
}

export interface AyahMatch {
  kind: "ayah";
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  /** Display text (Basmala prefix hidden for first ayahs, otherwise untouched). */
  text: string;
  /** Highlight ranges as [start, end) indices into `text`. */
  ranges: Array<[number, number]>;
}

export type SearchResult = SurahMatch | AyahMatch;

export type ActiveTab = "home" | "surahs" | "juz" | "bookmarks" | "search";

export type SearchFilter = "all" | "exact" | "partial" | "surah";
