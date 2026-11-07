/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bookmark, BookOpen, Home, Layers, Moon, Search, Sun } from "lucide-react";
import type {
  ActiveTab, Bookmark as BookmarkT, LastRead, ReaderAyah, ReaderMode, ReaderRequest, SearchFilter, Surah
} from "./types";
import { describeError, isAbortError, loadFullQuran, loadSurahList, readStoredSurahList } from "./lib/api";
import { displayAyahText, toArabicIndic } from "./lib/arabic";
import { DEFAULT_RECITER, isKnownReciter } from "./lib/reciters";
import { buildIndex, searchAyahs, searchSurahs, type IndexedAyah } from "./lib/search";
import { STORAGE_KEYS, readJson, readString, removeKey, writeJson, writeString } from "./lib/storage";
import { useOnline } from "./hooks/useOnline";
import { BrandMark } from "./components/Ornaments";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ListSkeleton } from "./components/Skeletons";
import { SurahCard } from "./components/SurahCard";
import { HomeView } from "./components/HomeView";
import { SearchBar } from "./components/SearchBar";
import { SearchView, type SearchState } from "./components/SearchView";
import { BookmarkList } from "./components/BookmarkList";

const Reader = lazy(() => import("./components/Reader").then((m) => ({ default: m.Reader })));

/* ---------- validated persistence ---------- */

function isPos(v: unknown): v is BookmarkT {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    Number.isInteger(o.surahNumber) && (o.surahNumber as number) >= 1 && (o.surahNumber as number) <= 114 &&
    Number.isInteger(o.ayahNumber) && (o.ayahNumber as number) >= 1 && (o.ayahNumber as number) <= 286 &&
    typeof o.surahName === "string" && typeof o.text === "string"
  );
}

function withStamp<T extends BookmarkT>(v: T): T {
  return typeof v.timestamp === "string" ? v : { ...v, timestamp: new Date(0).toISOString() };
}

function loadBookmarks(): BookmarkT[] {
  const raw = readJson(STORAGE_KEYS.bookmarks);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: BookmarkT[] = [];
  for (const item of raw) {
    if (!isPos(item)) continue;
    const k = `${item.surahNumber}:${item.ayahNumber}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(withStamp(item));
  }
  return out;
}

function sanitizePos(v: unknown): LastRead | null {
  if (!isPos(v)) return null;
  const o = v as LastRead;
  const mode = o.mode === "juz" || o.mode === "surah" ? o.mode : undefined;
  const juz = Number.isInteger(o.juz) && (o.juz as number) >= 1 && (o.juz as number) <= 30 ? o.juz : undefined;
  return { ...withStamp(o), mode, juz: mode === "juz" ? juz : undefined };
}

function loadLastRead(): LastRead | null {
  return sanitizePos(readJson(STORAGE_KEYS.lastRead));
}

function loadRecent(): LastRead[] {
  const raw = readJson(STORAGE_KEYS.recent);
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizePos).filter((x): x is LastRead => x !== null).slice(0, 8);
}

function initialDark(): boolean {
  const t = readString(STORAGE_KEYS.theme);
  if (t) return t === "night";
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const NAV: Array<{ tab: ActiveTab; label: string; icon: typeof Home }> = [
  { tab: "home", label: "الرئيسية", icon: Home },
  { tab: "surahs", label: "السور", icon: BookOpen },
  { tab: "juz", label: "الأجزاء", icon: Layers },
  { tab: "search", label: "البحث", icon: Search },
  { tab: "bookmarks", label: "محفوظاتي", icon: Bookmark }
];

export default function App() {
  const [dark, setDark] = useState(initialDark);
  const [tab, setTab] = useState<ActiveTab>("home");
  const [surahs, setSurahs] = useState<Surah[]>(() => readStoredSurahList() ?? []);
  const [surahsError, setSurahsError] = useState<string | null>(null);
  const [surahsLoading, setSurahsLoading] = useState(surahs.length === 0);
  const [surahsRetry, setSurahsRetry] = useState(0);
  const [bookmarks, setBookmarks] = useState<BookmarkT[]>(loadBookmarks);
  const [lastRead, setLastRead] = useState<LastRead | null>(loadLastRead);
  const [recent, setRecent] = useState<LastRead[]>(loadRecent);
  const [reciter, setReciter] = useState(() => {
    const r = readString(STORAGE_KEYS.reciter);
    return isKnownReciter(r) ? r : DEFAULT_RECITER;
  });
  const [reader, setReader] = useState<ReaderRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const online = useOnline();

  const nonce = useRef(0);
  const readerOpen = useRef(false);
  readerOpen.current = reader !== null;
  const indexRef = useRef<IndexedAyah[] | null>(null);
  const searchSeq = useRef(0);
  const searchCtrl = useRef<AbortController | null>(null);
  const toastTimer = useRef(0);

  /* ---------- theme ---------- */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0C1915" : "#F4EFE3");
    writeString(STORAGE_KEYS.theme, dark ? "night" : "day");
  }, [dark]);
  const toggleTheme = useCallback(() => setDark((d) => !d), []);

  /* ---------- persistence ---------- */
  useEffect(() => { writeJson(STORAGE_KEYS.bookmarks, bookmarks); }, [bookmarks]);
  useEffect(() => {
    if (lastRead) writeJson(STORAGE_KEYS.lastRead, lastRead);
    else removeKey(STORAGE_KEYS.lastRead);
  }, [lastRead]);
  useEffect(() => { writeJson(STORAGE_KEYS.recent, recent); }, [recent]);
  useEffect(() => { writeString(STORAGE_KEYS.reciter, reciter); }, [reciter]);

  /* ---------- surah list ---------- */
  useEffect(() => {
    const ctrl = new AbortController();
    setSurahsError(null);
    setSurahsLoading(true);
    loadSurahList(ctrl.signal)
      .then((list) => { setSurahs(list); setSurahsLoading(false); })
      .catch((e: unknown) => {
        if (isAbortError(e)) return;
        setSurahsLoading(false);
        setSurahsError(describeError(e, "قائمة السور"));
      });
    return () => ctrl.abort();
  }, [surahsRetry]);

  /* ---------- toast ---------- */
  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  /* ---------- reader open/close, wired to the browser history (swipe-back on iOS) ---------- */
  useEffect(() => {
    if (window.history.state?.quranReader) window.history.replaceState(null, "");
    const onPop = () => { if (!window.history.state?.quranReader) setReader(null); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openReader = useCallback((req: Omit<ReaderRequest, "nonce">) => {
    nonce.current += 1;
    if (!readerOpen.current) window.history.pushState({ quranReader: true }, "");
    setReader({ ...req, nonce: nonce.current });
    window.scrollTo(0, 0);
  }, []);

  const closeReader = useCallback(() => {
    if (window.history.state?.quranReader) window.history.back();
    else setReader(null);
  }, []);

  /** Opens a surah at an ayah. Always passes explicit numbers, never view state. */
  const openSurah = useCallback((surahNumber: number, ayahNumber?: number, autoPlay = false) => {
    openReader({
      mode: "surah", number: surahNumber, autoPlay,
      target: ayahNumber ? { surahNumber, ayahNumber } : undefined
    });
  }, [openReader]);

  const openSaved = useCallback((p: LastRead) => {
    const mode: ReaderMode = p.mode === "juz" && p.juz ? "juz" : "surah";
    openReader({
      mode, number: mode === "juz" ? (p.juz as number) : p.surahNumber,
      target: { surahNumber: p.surahNumber, ayahNumber: p.ayahNumber }
    });
  }, [openReader]);

  const recordPosition = useCallback((pos: LastRead) => {
    setLastRead(pos);
    setRecent((prev) => [pos, ...prev.filter((r) => r.surahNumber !== pos.surahNumber)].slice(0, 8));
  }, []);

  /* ---------- bookmarks ---------- */
  const bookmarkKeys = useMemo(() => new Set(bookmarks.map((b) => `${b.surahNumber}:${b.ayahNumber}`)), [bookmarks]);

  const toggleBookmark = useCallback((a: ReaderAyah) => {
    const key = `${a.surahNumber}:${a.numberInSurah}`;
    setBookmarks((prev) => {
      if (prev.some((b) => `${b.surahNumber}:${b.ayahNumber}` === key)) return prev.filter((b) => `${b.surahNumber}:${b.ayahNumber}` !== key);
      return [...prev, {
        surahNumber: a.surahNumber, surahName: a.surahName, ayahNumber: a.numberInSurah,
        text: displayAyahText(a.surahNumber, a.numberInSurah, a.text), timestamp: new Date().toISOString()
      }];
    });
    notify(bookmarkKeys.has(key) ? "أُزيلت الآية من المحفوظات" : "حُفظت الآية");
  }, [bookmarkKeys, notify]);

  const removeBookmark = useCallback((s: number, a: number) => {
    setBookmarks((prev) => prev.filter((b) => !(b.surahNumber === s && b.ayahNumber === a)));
  }, []);

  /* ---------- search (local, validated text; overlapping searches are cancelled) ---------- */
  const runSearch = useCallback(async (q: string, f: SearchFilter) => {
    const text = q.trim();
    searchCtrl.current?.abort();
    const seq = ++searchSeq.current;
    if (!text) { setSearch({ status: "idle" }); return; }
    const ctrl = new AbortController();
    searchCtrl.current = ctrl;
    try {
      if (f === "surah") {
        let list = surahs;
        if (list.length === 0) list = await loadSurahList(ctrl.signal);
        if (seq !== searchSeq.current) return;
        setSearch({ status: "done", query: text, filter: f, results: searchSurahs(list, text), wordsFallback: false });
        return;
      }
      if (!indexRef.current) {
        setSearch({ status: "loading", stage: "index" });
        const full = await loadFullQuran(ctrl.signal);
        if (seq !== searchSeq.current) return;
        indexRef.current = buildIndex(full);
      }
      setSearch({ status: "loading", stage: "search" });
      await new Promise((r) => setTimeout(r, 0));
      if (seq !== searchSeq.current) return;
      const out = searchAyahs(indexRef.current, text, f);
      setSearch({ status: "done", query: text, filter: f, results: out.matches, wordsFallback: out.wordsFallback });
    } catch (e) {
      if (isAbortError(e) || seq !== searchSeq.current) return;
      setSearch({ status: "error", message: describeError(e, "بيانات البحث") });
    }
  }, [surahs]);

  const warmIndex = useCallback(() => {
    if (indexRef.current) return;
    loadFullQuran().then((full) => { indexRef.current ??= buildIndex(full); }).catch(() => undefined);
  }, []);

  const submitSearch = useCallback(() => {
    setTab("search");
    void runSearch(query, filter);
  }, [query, filter, runSearch]);

  const changeFilter = useCallback((f: SearchFilter) => {
    setFilter(f);
    if (query.trim() && search.status !== "idle") void runSearch(query, f);
  }, [query, search.status, runSearch]);

  const changeQuery = useCallback((q: string) => {
    setQuery(q);
    if (!q.trim()) { searchCtrl.current?.abort(); searchSeq.current++; setSearch({ status: "idle" }); }
  }, []);

  const searchProps = { query, filter, onQueryChange: changeQuery, onFilterChange: changeFilter, onSubmit: submitSearch, onIntent: warmIndex };

  /* ---------- reader screen ---------- */
  if (reader) {
    return (
      <ErrorBoundary title="تعذّر عرض القارئ" onReset={closeReader}>
        <Suspense fallback={<div className="reader"><div className="container" style={{ paddingTop: "3rem" }}><ListSkeleton rows={4} /></div></div>}>
          <Reader
            request={reader}
            reciterId={reciter}
            onReciterChange={setReciter}
            bookmarkKeys={bookmarkKeys}
            onToggleBookmark={toggleBookmark}
            onPosition={recordPosition}
            onClose={closeReader}
            onOpen={(req) => openReader(req)}
            notify={notify}
            dark={dark}
            onToggleTheme={toggleTheme}
          />
        </Suspense>
        {toast && <div className="toast" role="status">{toast}</div>}
      </ErrorBoundary>
    );
  }

  const listState = surahsLoading && surahs.length === 0
    ? <ListSkeleton rows={12} />
    : surahsError && surahs.length === 0
      ? (
        <div className="error-box" role="alert">
          <AlertTriangle size={32} aria-hidden="true" />
          <h3>تعذّر تحميل السور</h3>
          <p>{surahsError}</p>
          <button type="button" className="btn btn--primary" onClick={() => setSurahsRetry((n) => n + 1)}>إعادة المحاولة</button>
        </div>
      )
      : null;

  return (
    <div className="app">
      {!online && <div className="offline-banner" role="status">أنت غير متصل بالإنترنت — المحتوى المحمّل مسبقاً متاح، وقد لا تعمل التلاوة والتفسير.</div>}
      <header className="topbar">
        <div className="container topbar__inner">
          <button type="button" className="brand" onClick={() => setTab("home")} aria-label="الصفحة الرئيسية">
            <BrandMark className="brand__mark" />
            <span>
              <span className="brand__name">المصحف</span>
              <span className="brand__tag">القرآن الكريم</span>
            </span>
          </button>
          <nav className="topnav" aria-label="التنقل الرئيسي">
            {NAV.map((n) => (
              <button key={n.tab} type="button" className="topnav__link" aria-current={tab === n.tab ? "page" : undefined} onClick={() => setTab(n.tab)}>
                {n.label}
              </button>
            ))}
          </nav>
          <span className="topbar__spacer" />
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={dark ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي"}>
            {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="main">
        <ErrorBoundary>
          {tab === "home" && (
            <HomeView
              lastRead={lastRead}
              recent={recent}
              bookmarkCount={bookmarks.length}
              surahCount={surahs.length || 114}
              onContinue={() => lastRead && openSaved(lastRead)}
              onClearLastRead={() => setLastRead(null)}
              onOpenRecent={openSaved}
              onNavigate={setTab}
              search={searchProps}
            />
          )}

          {tab === "surahs" && (
            <div className="container page">
              <div className="page__head">
                <div className="eyebrow">الفهرس</div>
                <h1 className="section-title">سور القرآن الكريم</h1>
                <p className="page__sub">{toArabicIndic(114)} سورة — اختر سورة لبدء القراءة.</p>
              </div>
              {listState ?? (
                <div className="list-grid">
                  {surahs.map((s) => <SurahCard key={s.number} surah={s} onClick={() => openSurah(s.number)} />)}
                </div>
              )}
            </div>
          )}

          {tab === "juz" && (
            <div className="container page">
              <div className="page__head">
                <div className="eyebrow">التقسيم</div>
                <h1 className="section-title">أجزاء القرآن الكريم</h1>
                <p className="page__sub">{toArabicIndic(30)} جزءاً — للقراءة المتتابعة وفق الورد اليومي.</p>
              </div>
              <div className="list-grid list-grid--3">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" className="juz-item" onClick={() => openReader({ mode: "juz", number: n })} aria-label={`الجزء ${toArabicIndic(n)}`}>
                    <span className="badge-star num" aria-hidden="true">{toArabicIndic(n)}</span>
                    <span>
                      <span className="juz-item__name" style={{ display: "block" }}>الجزء {toArabicIndic(n)}</span>
                      <span className="juz-item__sub">من {toArabicIndic(30)} جزءاً</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "search" && (
            <div className="container page search-page">
              <div className="page__head">
                <div className="eyebrow">البحث</div>
                <h1 className="section-title">البحث في الآيات والسور</h1>
              </div>
              <SearchBar variant="page" inputId="page-search" {...searchProps} />
              <p className="hint">
                «تطابق تام» يطابق الكلمة كاملة، و«بحث جزئي» يجد الكلمة داخل كلمات أطول (مثل «رحم» في «الرحمن»).
              </p>
              <SearchView
                state={search}
                onSelect={(s, a) => openSurah(s, a, a !== undefined)}
                onRetry={() => void runSearch(query, filter)}
              />
            </div>
          )}

          {tab === "bookmarks" && (
            <div className="container page">
              <div className="page__head">
                <div className="eyebrow">المحفوظات</div>
                <h1 className="section-title">الآيات المحفوظة</h1>
              </div>
              <BookmarkList
                bookmarks={bookmarks}
                onSelectBookmark={(s, a) => openSurah(s, a)}
                onRemoveBookmark={removeBookmark}
              />
            </div>
          )}
        </ErrorBoundary>
      </main>

      <nav className="bottomnav" aria-label="التنقل">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <button key={n.tab} type="button" className="bottomnav__item" aria-current={tab === n.tab ? "page" : undefined} onClick={() => setTab(n.tab)}>
              <Icon size={22} aria-hidden="true" />
              <span>{n.label}</span>
            </button>
          );
        })}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
