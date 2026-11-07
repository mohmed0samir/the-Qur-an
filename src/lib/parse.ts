/**
 * Runtime validation of API payloads. Anything that does not look exactly as
 * expected is rejected with a FormatError instead of being rendered.
 */
import type { AudioRef, ReaderAyah, Surah } from "../types";

export class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormatError";
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Unwraps the `{ code: 200, data }` envelope used by alquran.cloud. */
export function unwrapEnvelope(raw: unknown): unknown {
  if (!isRecord(raw)) throw new FormatError("استجابة غير متوقعة من الخادم");
  if (raw.code !== 200 || !("data" in raw)) {
    throw new FormatError(typeof raw.data === "string" ? raw.data : "استجابة غير صالحة من الخادم");
  }
  return raw.data;
}

export function parseSurahMeta(raw: unknown): Surah {
  if (!isRecord(raw)) throw new FormatError("بيانات سورة غير صالحة");
  if (
    !isInt(raw.number, 1, 114) ||
    !isNonEmptyString(raw.name) ||
    !isInt(raw.numberOfAyahs, 1, 286)
  ) {
    throw new FormatError("بيانات سورة غير صالحة");
  }
  return {
    number: raw.number,
    name: raw.name,
    englishName: typeof raw.englishName === "string" ? raw.englishName : "",
    englishNameTranslation:
      typeof raw.englishNameTranslation === "string" ? raw.englishNameTranslation : "",
    numberOfAyahs: raw.numberOfAyahs,
    revelationType: typeof raw.revelationType === "string" ? raw.revelationType : ""
  };
}

export function parseSurahList(raw: unknown): Surah[] {
  const data = unwrapEnvelope(raw);
  if (!Array.isArray(data) || data.length !== 114) {
    throw new FormatError("قائمة السور غير مكتملة");
  }
  const list = data.map(parseSurahMeta);
  list.forEach((s, i) => {
    if (s.number !== i + 1) throw new FormatError("ترتيب السور غير صحيح");
  });
  return list;
}

/** Same as parseSurahList but for a payload that was already unwrapped / stored locally. */
export function parseSurahListData(data: unknown): Surah[] {
  return parseSurahList({ code: 200, data });
}

function readAyahBase(
  raw: unknown,
  surah: { number: number; name: string }
): ReaderAyah {
  if (!isRecord(raw)) throw new FormatError("آية غير صالحة");
  if (!isInt(raw.number, 1, 6236) || !isInt(raw.numberInSurah, 1, 286) || !isNonEmptyString(raw.text)) {
    throw new FormatError("آية غير صالحة");
  }
  return {
    number: raw.number,
    numberInSurah: raw.numberInSurah,
    text: raw.text,
    surahNumber: surah.number,
    surahName: surah.name,
    juz: isInt(raw.juz, 1, 30) ? raw.juz : 0,
    page: isInt(raw.page, 1, 604) ? raw.page : 0,
    sajda: !!raw.sajda
  };
}

export interface ParsedSurahText {
  surah: Surah;
  ayahs: ReaderAyah[];
}

/** Parses `/surah/{n}/quran-uthmani` and checks it really is surah `expected`. */
export function parseSurahText(raw: unknown, expected: number): ParsedSurahText {
  const data = unwrapEnvelope(raw);
  if (!isRecord(data)) throw new FormatError("بيانات السورة غير صالحة");
  const surah = parseSurahMeta(data);
  if (surah.number !== expected) throw new FormatError("السورة المستلمة لا تطابق المطلوبة");
  if (!Array.isArray(data.ayahs) || data.ayahs.length !== surah.numberOfAyahs) {
    throw new FormatError("عدد آيات السورة غير مكتمل");
  }
  const ayahs = data.ayahs.map((a) => readAyahBase(a, surah));
  ayahs.forEach((a, i) => {
    if (a.numberInSurah !== i + 1) throw new FormatError("ترقيم آيات السورة غير متسلسل");
  });
  return { surah, ayahs };
}

/** Parses `/juz/{n}/quran-uthmani`. Every ayah carries its own surah. */
export function parseJuzText(raw: unknown, expected: number): ReaderAyah[] {
  const data = unwrapEnvelope(raw);
  if (!isRecord(data)) throw new FormatError("بيانات الجزء غير صالحة");
  if (data.number !== expected) throw new FormatError("الجزء المستلم لا يطابق المطلوب");
  if (!Array.isArray(data.ayahs) || data.ayahs.length === 0) {
    throw new FormatError("الجزء لا يحتوي على آيات");
  }
  const ayahs = data.ayahs.map((a) => {
    if (!isRecord(a) || !isRecord(a.surah)) throw new FormatError("آية غير صالحة في الجزء");
    const s = a.surah;
    if (!isInt(s.number, 1, 114) || !isNonEmptyString(s.name)) {
      throw new FormatError("سورة غير صالحة في الجزء");
    }
    return readAyahBase(a, { number: s.number, name: s.name });
  });
  for (let i = 1; i < ayahs.length; i++) {
    if (ayahs[i].number <= ayahs[i - 1].number) throw new FormatError("ترتيب آيات الجزء غير صحيح");
  }
  return ayahs;
}

/** Parses a surah/juz response for an audio edition into a map keyed by global ayah number. */
export function parseAudio(raw: unknown): Map<number, AudioRef> {
  const data = unwrapEnvelope(raw);
  if (!isRecord(data) || !Array.isArray(data.ayahs) || data.ayahs.length === 0) {
    throw new FormatError("بيانات التلاوة غير صالحة");
  }
  const map = new Map<number, AudioRef>();
  for (const a of data.ayahs) {
    if (!isRecord(a) || !isInt(a.number, 1, 6236) || typeof a.audio !== "string" || !/^https?:\/\//.test(a.audio)) {
      throw new FormatError("رابط تلاوة غير صالح");
    }
    const secondary = Array.isArray(a.audioSecondary)
      ? a.audioSecondary.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
      : [];
    map.set(a.number, { audio: a.audio, audioSecondary: secondary });
  }
  return map;
}

/**
 * Audio must correspond to exactly the same ayahs as the text, matched by the
 * global ayah number (never by array position). Returns null when it matches,
 * otherwise a message describing the problem.
 */
export function checkAudioMatchesText(ayahs: ReaderAyah[], audio: Map<number, AudioRef>): string | null {
  if (audio.size !== ayahs.length) return "عدد مقاطع التلاوة لا يطابق عدد الآيات";
  for (const a of ayahs) {
    if (!audio.has(a.number)) return "تلاوة هذه الآيات غير متوفرة بشكل مطابق";
  }
  return null;
}

export interface QuranIndexSource {
  surahs: Surah[];
  ayahs: Array<{ surahNumber: number; ayahNumber: number; text: string }>;
}

/** Parses `/quran/quran-uthmani` (the complete text) used for local search. */
export function parseFullQuran(raw: unknown): QuranIndexSource {
  const data = unwrapEnvelope(raw);
  if (!isRecord(data) || !Array.isArray(data.surahs) || data.surahs.length !== 114) {
    throw new FormatError("بيانات المصحف غير مكتملة");
  }
  const surahs: Surah[] = [];
  const ayahs: QuranIndexSource["ayahs"] = [];
  data.surahs.forEach((rawSurah, i) => {
    if (!isRecord(rawSurah) || !Array.isArray(rawSurah.ayahs) || rawSurah.ayahs.length === 0) {
      throw new FormatError("سورة غير صالحة");
    }
    // This endpoint does not include `numberOfAyahs` per surah, so it is derived from the ayahs.
    const meta = parseSurahMeta({ ...rawSurah, number: rawSurah.number, numberOfAyahs: rawSurah.ayahs.length });
    if (meta.number !== i + 1) throw new FormatError("ترتيب السور غير صحيح");
    rawSurah.ayahs.forEach((a, idx) => {
      if (!isRecord(a) || !isNonEmptyString(a.text)) throw new FormatError("آية غير صالحة");
      ayahs.push({ surahNumber: meta.number, ayahNumber: idx + 1, text: a.text });
    });
    surahs.push(meta);
  });
  if (ayahs.length !== 6236) throw new FormatError("عدد آيات المصحف غير صحيح");
  return { surahs, ayahs };
}

export interface TafsirAyahResponse {
  text: string;
  name: string | null;
}

/** Parses a quran-tafseer.com ayah response. */
export function parseTafsirAyah(raw: unknown): TafsirAyahResponse {
  if (!isRecord(raw) || typeof raw.text !== "string") throw new FormatError("استجابة التفسير غير صالحة");
  return { text: raw.text, name: typeof raw.tafseer_name === "string" ? raw.tafseer_name : null };
}

export interface TafsirBookInfo {
  id: number;
  name: string;
  language: string;
}

export function parseTafsirBooks(raw: unknown): TafsirBookInfo[] {
  if (!Array.isArray(raw)) throw new FormatError("قائمة كتب التفسير غير صالحة");
  const books: TafsirBookInfo[] = [];
  for (const b of raw) {
    if (isRecord(b) && isInt(b.id, 1, 1000) && isNonEmptyString(b.name)) {
      books.push({ id: b.id, name: b.name, language: typeof b.language === "string" ? b.language : "" });
    }
  }
  if (books.length === 0) throw new FormatError("لا توجد كتب تفسير");
  return books;
}
