/**
 * Network layer: timeouts, abort support, one retry for transient failures,
 * payload validation and small in-memory caches.
 * No API keys are used anywhere; both services are public.
 */
import type { AudioRef, ReaderAyah, Surah } from "../types";
import {
  FormatError,
  parseAudio,
  parseFullQuran,
  parseJuzText,
  parseSurahList,
  parseSurahListData,
  parseSurahText,
  parseTafsirAyah,
  parseTafsirBooks,
  type ParsedSurahText,
  type QuranIndexSource,
  type TafsirAyahResponse,
  type TafsirBookInfo
} from "./parse";
import { STORAGE_KEYS, readJson, writeJson } from "./storage";

export const QURAN_API = "https://api.alquran.cloud/v1";
export const TAFSIR_API = "https://api.quran-tafseer.com";
/** Edition identifier of the Uthmani text on alquran.cloud. */
export const TEXT_EDITION = "quran-uthmani";

export type ApiErrorKind = "network" | "offline" | "timeout" | "http" | "aborted";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  constructor(kind: ApiErrorKind, status?: number) {
    super(kind);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function isAbortError(e: unknown): boolean {
  return (
    (e instanceof ApiError && e.kind === "aborted") ||
    (e instanceof DOMException && e.name === "AbortError")
  );
}

/** User-facing Arabic message for any error thrown by this module. */
export function describeError(e: unknown, what = "البيانات"): string {
  if (e instanceof ApiError) {
    switch (e.kind) {
      case "offline":
        return "لا يوجد اتصال بالإنترنت. تحقق من الاتصال ثم أعد المحاولة.";
      case "timeout":
        return `استغرق تحميل ${what} وقتاً طويلاً. أعد المحاولة.`;
      case "http":
        return `تعذّر تحميل ${what} (رمز الخادم ${e.status ?? "؟"}). أعد المحاولة لاحقاً.`;
      case "network":
        return `تعذّر الوصول إلى الخادم لتحميل ${what}. تحقق من الاتصال.`;
      default:
        return "";
    }
  }
  if (e instanceof FormatError) {
    return `وصلت ${what} بصيغة غير صحيحة، لذلك لم تُعرض حفاظاً على سلامة النص. (${e.message})`;
  }
  return `حدث خطأ غير متوقع أثناء تحميل ${what}.`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError("aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new ApiError("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function fetchOnce(url: string, signal: AbortSignal | undefined, timeoutMs: number): Promise<unknown> {
  if (signal?.aborted) throw new ApiError("aborted");
  const ctrl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    } catch {
      if (timedOut) throw new ApiError("timeout");
      if (signal?.aborted) throw new ApiError("aborted");
      throw new ApiError(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network");
    }
    if (!res.ok) throw new ApiError("http", res.status);
    try {
      return await res.json();
    } catch {
      if (timedOut) throw new ApiError("timeout");
      if (signal?.aborted) throw new ApiError("aborted");
      throw new FormatError("تعذّر قراءة استجابة الخادم");
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** GET JSON with timeout and a single retry for network errors, timeouts and 5xx responses. */
export async function fetchJson(
  url: string,
  options: { signal?: AbortSignal; timeoutMs?: number; retries?: number } = {}
): Promise<unknown> {
  const { signal, timeoutMs = 20000, retries = 1 } = options;
  let attempt = 0;
  for (;;) {
    try {
      return await fetchOnce(url, signal, timeoutMs);
    } catch (e) {
      const transient =
        e instanceof ApiError &&
        (e.kind === "network" || e.kind === "timeout" || (e.kind === "http" && (e.status ?? 0) >= 500));
      if (!transient || attempt >= retries) throw e;
      attempt++;
      await sleep(600 * attempt, signal);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Caches                                                              */
/* ------------------------------------------------------------------ */

class LruCache<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly limit: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
}

const surahTextCache = new LruCache<ParsedSurahText>(12);
const juzTextCache = new LruCache<ReaderAyah[]>(6);
const audioCache = new LruCache<Map<number, AudioRef>>(24);
const tafsirCache = new LruCache<TafsirAyahResponse>(200);

/* ------------------------------------------------------------------ */
/* Surah list                                                          */
/* ------------------------------------------------------------------ */

let surahListMemo: Surah[] | null = null;

/** Cached copy of the surah list (static data) so the home screen works offline. */
export function readStoredSurahList(): Surah[] | null {
  const stored = readJson(STORAGE_KEYS.surahList);
  if (stored === undefined) return null;
  try {
    return parseSurahListData(stored);
  } catch {
    return null;
  }
}

export async function loadSurahList(signal?: AbortSignal): Promise<Surah[]> {
  if (surahListMemo) return surahListMemo;
  const raw = await fetchJson(`${QURAN_API}/surah`, { signal });
  const list = parseSurahList(raw);
  surahListMemo = list;
  writeJson(STORAGE_KEYS.surahList, list);
  return list;
}

/* ------------------------------------------------------------------ */
/* Reader content                                                      */
/* ------------------------------------------------------------------ */

export async function loadSurahText(number: number, signal?: AbortSignal): Promise<ParsedSurahText> {
  const key = String(number);
  const hit = surahTextCache.get(key);
  if (hit) return hit;
  const raw = await fetchJson(`${QURAN_API}/surah/${number}/${TEXT_EDITION}`, { signal });
  const parsed = parseSurahText(raw, number);
  surahTextCache.set(key, parsed);
  return parsed;
}

export async function loadJuzText(number: number, signal?: AbortSignal): Promise<ReaderAyah[]> {
  const key = String(number);
  const hit = juzTextCache.get(key);
  if (hit) return hit;
  const raw = await fetchJson(`${QURAN_API}/juz/${number}/${TEXT_EDITION}`, { signal });
  const parsed = parseJuzText(raw, number);
  juzTextCache.set(key, parsed);
  return parsed;
}

export async function loadAudio(
  mode: "surah" | "juz",
  number: number,
  reciter: string,
  signal?: AbortSignal
): Promise<Map<number, AudioRef>> {
  const key = `${mode}:${number}:${reciter}`;
  const hit = audioCache.get(key);
  if (hit) return hit;
  const raw = await fetchJson(`${QURAN_API}/${mode}/${number}/${reciter}`, { signal });
  const parsed = parseAudio(raw);
  audioCache.set(key, parsed);
  return parsed;
}

/* ------------------------------------------------------------------ */
/* Full text (local search)                                            */
/* ------------------------------------------------------------------ */

const FULL_QURAN_URL = `${QURAN_API}/quran/${TEXT_EDITION}`;
const FULL_CACHE_NAME = "quran-data-v1";
let fullQuranMemo: QuranIndexSource | null = null;

async function readFullFromCacheStorage(): Promise<QuranIndexSource | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(FULL_CACHE_NAME);
    const res = await cache.match(FULL_QURAN_URL);
    if (!res) return null;
    return parseFullQuran(await res.json());
  } catch {
    return null;
  }
}

async function writeFullToCacheStorage(raw: unknown): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(FULL_CACHE_NAME);
    await cache.put(
      FULL_QURAN_URL,
      new Response(JSON.stringify(raw), { headers: { "Content-Type": "application/json" } })
    );
  } catch {
    /* caching is best effort */
  }
}

/**
 * The complete Uthmani text. Downloaded once, validated (114 surahs / 6236 ayahs)
 * and kept in the browser's Cache Storage so searching works offline afterwards.
 */
export async function loadFullQuran(signal?: AbortSignal): Promise<QuranIndexSource> {
  if (fullQuranMemo) return fullQuranMemo;
  const stored = await readFullFromCacheStorage();
  if (stored) {
    fullQuranMemo = stored;
    return stored;
  }
  const raw = await fetchJson(FULL_QURAN_URL, { signal, timeoutMs: 60000 });
  const parsed = parseFullQuran(raw);
  fullQuranMemo = parsed;
  void writeFullToCacheStorage(raw);
  return parsed;
}

/* ------------------------------------------------------------------ */
/* Tafsir                                                              */
/* ------------------------------------------------------------------ */

let tafsirBooksMemo: TafsirBookInfo[] | null = null;

export async function loadTafsirBooks(signal?: AbortSignal): Promise<TafsirBookInfo[]> {
  if (tafsirBooksMemo) return tafsirBooksMemo;
  const raw = await fetchJson(`${TAFSIR_API}/tafseer/`, { signal, timeoutMs: 12000 });
  const books = parseTafsirBooks(raw);
  tafsirBooksMemo = books;
  return books;
}

/** Tafsir text is requested by the ayah's own surah number (never by view state). */
export async function loadTafsirAyah(
  bookId: number,
  surahNumber: number,
  ayahNumber: number,
  signal?: AbortSignal
): Promise<TafsirAyahResponse> {
  const key = `${bookId}:${surahNumber}:${ayahNumber}`;
  const hit = tafsirCache.get(key);
  if (hit) return hit;
  const raw = await fetchJson(`${TAFSIR_API}/tafseer/${bookId}/${surahNumber}/${ayahNumber}`, {
    signal,
    timeoutMs: 15000
  });
  const parsed = parseTafsirAyah(raw);
  tafsirCache.set(key, parsed);
  return parsed;
}
