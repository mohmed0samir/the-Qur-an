/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: "Meccan" | "Medinan" | string;
  ayahs?: Ayah[];
}

export interface Ayah {
  number: number;
  audio?: string;
  audioSecondary?: string[];
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | any;
  surah?: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
    numberOfAyahs: number;
  };
}

export interface Reciter {
  id: string;
  name: string;
  englishName: string;
}

export interface Bookmark {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  text: string;
  timestamp: string;
}

export interface SearchMatch {
  text: string;
  numberInSurah: number;
  surahNumber?: number;
  surah: {
    number: number;
    name: string;
    englishName: string;
    revelationType: string;
    numberOfAyahs: number;
  };
}

export type ActiveTab = "surahs" | "juz" | "bookmarks" | "search";

export type SearchFilter = "all" | "exact" | "partial" | "surah";
