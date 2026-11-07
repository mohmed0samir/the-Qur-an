/**
 * Tafsir books of api.quran-tafseer.com.
 *
 * The id → name pairing is taken from the service's own book list at runtime
 * (`loadTafsirBooks`), so a label can never point at the wrong book. The
 * static list below is only used for the selector until/unless that list
 * loads, and follows the service's published order.
 *
 * NOTE: earlier versions of this app labelled id 5 as "القرطبي" and id 7 as
 * "الطبري". In the service's list id 5 is "الوسيط" (Tantawi), 7 is "القرطبي"
 * and 8 is "الطبري".
 */
import type { TafsirBookInfo } from "./parse";

export const FALLBACK_TAFSIR_BOOKS: TafsirBookInfo[] = [
  { id: 1, name: "التفسير الميسر", language: "ar" },
  { id: 3, name: "تفسير السعدي", language: "ar" },
  { id: 4, name: "تفسير ابن كثير", language: "ar" },
  { id: 2, name: "تفسير الجلالين", language: "ar" },
  { id: 5, name: "تفسير الوسيط لطنطاوي", language: "ar" },
  { id: 6, name: "تفسير البغوي", language: "ar" },
  { id: 7, name: "تفسير القرطبي", language: "ar" },
  { id: 8, name: "تفسير الطبري", language: "ar" }
];

export const DEFAULT_TAFSIR_BOOK = 1;

/** Arabic books only (the service also lists English/Dutch translations). */
export function arabicBooks(books: TafsirBookInfo[]): TafsirBookInfo[] {
  const ar = books.filter((b) => b.language === "ar" || b.language === "");
  return ar.length > 0 ? ar : books;
}

/** Converts the service's HTML-ish text to plain text safely (no markup is ever injected). */
export function tafsirToPlainText(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n");
  if (typeof DOMParser === "undefined") return withBreaks.replace(/<[^>]*>/g, "").trim();
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  return (doc.body.textContent ?? "").trim();
}
