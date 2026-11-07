import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ReaderAyah } from "../types";
import { describeError, isAbortError, loadTafsirAyah, loadTafsirBooks } from "../lib/api";
import { toArabicIndic } from "../lib/arabic";
import { STORAGE_KEYS, readNumber, writeString } from "../lib/storage";
import { DEFAULT_TAFSIR_BOOK, FALLBACK_TAFSIR_BOOKS, arabicBooks, tafsirToPlainText } from "../lib/tafsir";
import type { TafsirBookInfo } from "../lib/parse";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; text: string; bookName: string };

/**
 * Tafsir for the active ayah. The request always uses the ayah's own surah and
 * ayah numbers (ayah.surahNumber), which is correct in both Surah and Juz modes.
 */
export function TafsirPanel({ ayah }: { ayah: ReaderAyah }) {
  const [books, setBooks] = useState<TafsirBookInfo[]>(FALLBACK_TAFSIR_BOOKS);
  const [bookId, setBookId] = useState(() => readNumber(STORAGE_KEYS.tafsirBook, DEFAULT_TAFSIR_BOOK, 1, 1000));
  const [state, setState] = useState<State>({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    loadTafsirBooks(ctrl.signal)
      .then((list) => setBooks(arabicBooks(list)))
      .catch(() => {
        /* keep the static list */
      });
    return () => ctrl.abort();
  }, []);

  const activeId = books.some((b) => b.id === bookId) ? bookId : DEFAULT_TAFSIR_BOOK;

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: "loading" });
    loadTafsirAyah(activeId, ayah.surahNumber, ayah.numberInSurah, ctrl.signal)
      .then((res) => {
        const text = tafsirToPlainText(res.text);
        if (!text) throw new Error("empty");
        const fallbackName = books.find((b) => b.id === activeId)?.name ?? "";
        setState({ status: "ready", text, bookName: res.name ?? fallbackName });
      })
      .catch((e: unknown) => {
        if (isAbortError(e) || ctrl.signal.aborted) return;
        const message =
          e instanceof Error && e.message === "empty"
            ? "لا يوجد نص تفسير لهذه الآية في هذا الكتاب."
            : describeError(e, "التفسير");
        setState({ status: "error", message });
      });
    return () => ctrl.abort();
    // `books` only supplies a fallback display name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, ayah.surahNumber, ayah.numberInSurah, retry]);

  return (
    <section className="tafsir" aria-label="التفسير" aria-live="polite">
      <div className="tafsir__head">
        <span className="tafsir__title">
          تفسير {ayah.surahName} · الآية {toArabicIndic(ayah.numberInSurah)}
        </span>
        <label className="sr-only" htmlFor="tafsir-book">كتاب التفسير</label>
        <select
          id="tafsir-book"
          className="tafsir__select"
          value={activeId}
          onChange={(e) => {
            const id = Number(e.target.value);
            setBookId(id);
            writeString(STORAGE_KEYS.tafsirBook, String(id));
          }}
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {state.status === "loading" && (
        <p className="tafsir__msg">
          <Loader2 className="spin" size={18} aria-hidden="true" /> جارٍ تحميل التفسير…
        </p>
      )}
      {state.status === "error" && (
        <p className="tafsir__msg" role="alert">
          {state.message}
          <button type="button" className="btn btn--ghost" style={{ minHeight: 36 }} onClick={() => setRetry((n) => n + 1)}>
            إعادة المحاولة
          </button>
        </p>
      )}
      {state.status === "ready" && (
        <>
          <div className="tafsir__body">{state.text}</div>
          <p className="tafsir__source">المصدر: {state.bookName} — عبر خدمة quran-tafseer.com (نص منقول وليس مُولَّداً).</p>
        </>
      )}
    </section>
  );
}
