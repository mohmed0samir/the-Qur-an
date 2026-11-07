/**
 * Safe wrappers around localStorage. Storage can throw (private mode, quota,
 * blocked site data) or contain corrupt data, so every access is guarded and
 * the app must render correctly when it fails.
 *
 * Existing keys are preserved so saved data keeps working.
 */

export const STORAGE_KEYS = {
  theme: "quran_theme",
  reciter: "quran_reciter",
  bookmarks: "quran_bookmarks",
  lastRead: "quran_last_read",
  recent: "quran_recent",
  fontSize: "quran_font_size",
  autoPlayNext: "quran_autoplay_next",
  speed: "quran_speed",
  volume: "quran_volume",
  tafsirBook: "quran_tafsir_book",
  tafsirOpen: "quran_tafsir_open",
  surahList: "quran_surah_list_v1"
} as const;

export function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Returns parsed JSON or `undefined` when missing/corrupt. Callers validate the shape. */
export function readJson(key: string): unknown {
  const raw = readString(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeString(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function readNumber(key: string, fallback: number, min: number, max: number): number {
  const raw = readString(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function readBoolean(key: string, fallback: boolean): boolean {
  const raw = readString(key);
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fallback;
}
