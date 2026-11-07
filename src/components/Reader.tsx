import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowRight, BookMarked, Bookmark, Copy, Minus, Moon, Plus, Sun, Type } from "lucide-react";
import type { AudioRef, LastRead, ReaderAyah, ReaderMode, ReaderRequest, Surah } from "../types";
import { describeError, isAbortError, loadAudio, loadJuzText, loadSurahList, loadSurahText, readStoredSurahList } from "../lib/api";
import { BASMALA, displayAyahText, surahHasBasmalaHeading, toArabicIndic } from "../lib/arabic";
import { checkAudioMatchesText } from "../lib/parse";
import { reciterName } from "../lib/reciters";
import { copyText } from "../lib/clipboard";
import { STORAGE_KEYS, readNumber, writeString } from "../lib/storage";
import { prefersReducedMotion } from "../hooks/useOnline";
import { AudioPlayer } from "./AudioPlayer";
import { ReaderSkeleton } from "./Skeletons";
import { TafsirPanel } from "./TafsirPanel";

const MIN_FONT = 22;
const MAX_FONT = 52;

interface ReaderProps {
  request: ReaderRequest;
  reciterId: string;
  onReciterChange: (id: string) => void;
  bookmarkKeys: Set<string>;
  onToggleBookmark: (ayah: ReaderAyah) => void;
  onPosition: (pos: LastRead) => void;
  onClose: () => void;
  onOpen: (req: Omit<ReaderRequest, "nonce">) => void;
  notify: (msg: string) => void;
  dark: boolean;
  onToggleTheme: () => void;
}

interface Loaded {
  mode: ReaderMode;
  number: number;
  ayahs: ReaderAyah[];
  title: string;
  surah?: Surah;
}

type TextState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Loaded };
type AudioState = { key: string; status: "loading" | "ready" | "error"; map?: Map<number, AudioRef>; message?: string };

const bmKey = (s: number, a: number) => `${s}:${a}`;

interface AyahSpanProps {
  ayah: ReaderAyah;
  index: number;
  active: boolean;
  marked: boolean;
  onSelect: (index: number) => void;
  onKey: (e: KeyboardEvent<HTMLSpanElement>, index: number) => void;
}

const AyahSpan = memo(function AyahSpan({ ayah, index, active, marked, onSelect, onKey }: AyahSpanProps) {
  const text = displayAyahText(ayah.surahNumber, ayah.numberInSurah, ayah.text);
  return (
    <>
      <span
        id={`ayah-${index}`}
        data-ayah-index={index}
        className={active ? "ayah ayah--active" : "ayah"}
        role="button"
        tabIndex={active ? 0 : -1}
        aria-current={active ? "true" : undefined}
        aria-label={`${ayah.surahName}، الآية ${toArabicIndic(ayah.numberInSurah)}${marked ? "، محفوظة" : ""}`}
        onClick={() => onSelect(index)}
        onKeyDown={(e) => onKey(e, index)}
      >
        {text}
        <span className="ayah-marker" aria-hidden="true" data-len={String(ayah.numberInSurah).length >= 3 ? 3 : 2}>
          {toArabicIndic(ayah.numberInSurah)}
        </span>
        {marked && <span className="ayah-flag" aria-hidden="true" />}
      </span>{" "}
    </>
  );
});

export function Reader(props: ReaderProps) {
  const { request, reciterId, onReciterChange, bookmarkKeys, onToggleBookmark, onPosition, onClose, onOpen, notify, dark, onToggleTheme } = props;

  const [text, setText] = useState<TextState>({ status: "loading" });
  const [audio, setAudio] = useState<AudioState>({ key: "", status: "loading" });
  const [active, setActive] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tafsirOpen, setTafsirOpen] = useState(() => readNumber(STORAGE_KEYS.tafsirOpen, 0, 0, 1) === 1);
  const [fontSize, setFontSize] = useState(() => readNumber(STORAGE_KEYS.fontSize, 32, MIN_FONT, MAX_FONT));
  const [menuOpen, setMenuOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState("");
  const [textRetry, setTextRetry] = useState(0);
  const [audioRetry, setAudioRetry] = useState(0);
  const [surahNames, setSurahNames] = useState<Surah[] | null>(() => readStoredSurahList());

  const dockRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingAutoPlay = useRef(false);
  const lastScrollAt = useRef(0);
  const visible = useRef<Set<number>>(new Set());
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

  const loaded = text.status === "ready" ? text.data : null;
  const ayahs = loaded?.ayahs;

  /* ---------- load text (request-scoped; cancelled when the request changes) ---------- */
  useEffect(() => {
    const ctrl = new AbortController();
    setText({ status: "loading" });
    setIsPlaying(false);
    setMenuOpen(false);
    visible.current.clear();
    pendingAutoPlay.current = !!request.autoPlay;

    (async () => {
      try {
        let data: Loaded;
        if (request.mode === "surah") {
          const parsed = await loadSurahText(request.number, ctrl.signal);
          data = { mode: "surah", number: request.number, ayahs: parsed.ayahs, title: parsed.surah.name, surah: parsed.surah };
        } else {
          const list = await loadJuzText(request.number, ctrl.signal);
          data = { mode: "juz", number: request.number, ayahs: list, title: `الجزء ${toArabicIndic(request.number)}` };
        }
        if (ctrl.signal.aborted) return;
        let idx = 0;
        if (request.target) {
          const t = request.target;
          const found = data.ayahs.findIndex((a) => a.surahNumber === t.surahNumber && a.numberInSurah === t.ayahNumber);
          if (found >= 0) idx = found;
        }
        setActive(idx);
        setText({ status: "ready", data });
        const a = data.ayahs[idx];
        onPosition(toPosition(a, data.mode, data.mode === "juz" ? data.number : a.juz));
      } catch (e) {
        if (isAbortError(e) || ctrl.signal.aborted) return;
        setText({ status: "error", message: describeError(e, request.mode === "juz" ? "الجزء" : "السورة") });
      }
    })();
    return () => ctrl.abort();
    // onPosition is stable (App-level callback); request + retry define the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, textRetry]);

  /* ---------- surah names (only needed to label Juz headings; static data) ---------- */
  useEffect(() => {
    if (surahNames) return;
    const ctrl = new AbortController();
    loadSurahList(ctrl.signal).then(setSurahNames).catch(() => undefined);
    return () => ctrl.abort();
  }, [surahNames]);

  /* ---------- load audio for the selected reciter (independent of text) ---------- */
  const audioKey = `${request.mode}:${request.number}:${reciterId}`;
  useEffect(() => {
    const ctrl = new AbortController();
    setAudio({ key: audioKey, status: "loading" });
    loadAudio(request.mode, request.number, reciterId, ctrl.signal)
      .then((map) => {
        if (!ctrl.signal.aborted) setAudio({ key: audioKey, status: "ready", map });
      })
      .catch((e: unknown) => {
        if (isAbortError(e) || ctrl.signal.aborted) return;
        setAudio({ key: audioKey, status: "error", message: describeError(e, "التلاوة") });
      });
    return () => ctrl.abort();
  }, [audioKey, request.mode, request.number, reciterId, audioRetry]);

  /** Audio is only usable if it is for this reciter/request AND matches the ayahs one-to-one. */
  const audioView = useMemo(() => {
    if (audio.key !== audioKey) return { status: "loading" as const };
    if (audio.status !== "ready" || !audio.map || !ayahs) {
      return audio.status === "error" ? { status: "error" as const, message: audio.message } : { status: "loading" as const };
    }
    const problem = checkAudioMatchesText(ayahs, audio.map);
    if (problem) return { status: "error" as const, message: problem };
    return { status: "ready" as const, map: audio.map };
  }, [audio, audioKey, ayahs]);

  const current = ayahs?.[active];
  const nextAyah = ayahs?.[active + 1];
  const refFor = (a: ReaderAyah | undefined) => (a && audioView.status === "ready" ? audioView.map.get(a.number) : undefined);
  const curRef = refFor(current);
  const sources = curRef ? [curRef.audio, ...curRef.audioSecondary] : [];
  const nextSource = refFor(nextAyah)?.audio;

  // Autoplay requested by the caller (e.g. search result): start once audio is ready.
  useEffect(() => {
    if (pendingAutoPlay.current && audioView.status === "ready") {
      pendingAutoPlay.current = false;
      setIsPlaying(true);
    }
  }, [audioView.status]);

  /* ---------- selection / navigation ---------- */
  const select = useCallback(
    (index: number) => {
      if (!ayahs || index < 0 || index >= ayahs.length) return;
      setActive(index);
      onPosition(toPosition(ayahs[index], request.mode, request.mode === "juz" ? request.number : ayahs[index].juz));
    },
    [ayahs, onPosition, request.mode, request.number]
  );

  const onAyahClick = useCallback(
    (index: number) => {
      if (index === active) setIsPlaying((p) => !p);
      else select(index);
    },
    [active, select]
  );

  const onAyahKey = useCallback(
    (e: KeyboardEvent<HTMLSpanElement>, index: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onAyahClick(index);
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        select(index + 1);
        document.getElementById(`ayah-${index + 1}`)?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        select(index - 1);
        document.getElementById(`ayah-${index - 1}`)?.focus();
      }
    },
    [onAyahClick, select]
  );

  const goNext = useCallback(() => select(active + 1), [select, active]);
  const goPrev = useCallback(() => select(active - 1), [select, active]);

  /* ---------- keep the active ayah visible between the bar and the dock ---------- */
  useEffect(() => {
    if (!loaded) return;
    const el = document.getElementById(`ayah-${active}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dockH = dockRef.current?.offsetHeight ?? 0;
    const top = 70;
    if (rect.top < top || rect.bottom > window.innerHeight - dockH - 16) {
      lastScrollAt.current = Date.now();
      el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }, [active, loaded]);

  /* ---------- reading progress from scrolling (not while audio drives the position) ---------- */
  useEffect(() => {
    if (!loaded) return;
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const i = Number((en.target as HTMLElement).dataset.ayahIndex);
          if (en.isIntersecting) visible.current.add(i);
          else visible.current.delete(i);
        }
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (isPlayingRef.current || Date.now() - lastScrollAt.current < 1200 || visible.current.size === 0) return;
          const first = Math.min(...visible.current);
          const a = loaded.ayahs[first];
          if (a) onPosition(toPosition(a, loaded.mode, loaded.mode === "juz" ? loaded.number : a.juz));
        }, 700);
      },
      { rootMargin: "-80px 0px -55% 0px" }
    );
    document.querySelectorAll("[data-ayah-index]").forEach((n) => io.observe(n));
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [loaded, onPosition]);

  /* ---------- dock height → CSS variable (used for padding and toast position) ---------- */
  useEffect(() => {
    const el = dockRef.current;
    const root = document.documentElement;
    if (!el) return;
    const apply = () => root.style.setProperty("--dock-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--dock-h", "0px");
    };
  }, [loaded, tafsirOpen]);

  /* ---------- menu outside click + shortcuts ---------- */
  useEffect(() => {
    if (!menuOpen) return;
    const down = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
    };
  }, [menuOpen]);

  const toggleBookmark = useCallback(() => {
    if (current) onToggleBookmark(current);
  }, [current, onToggleBookmark]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else if (tafsirOpen) setTafsirOpen(false);
        else onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        toggleBookmark();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, tafsirOpen, onClose, toggleBookmark]);

  const changeFont = (delta: number) => {
    const next = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize + delta));
    setFontSize(next);
    writeString(STORAGE_KEYS.fontSize, String(next));
  };

  const copyCurrent = async () => {
    if (!current) return;
    const body = displayAyahText(current.surahNumber, current.numberInSurah, current.text);
    const ok = await copyText(`﴿ ${body} ﴾\n[${current.surahName} : ${toArabicIndic(current.numberInSurah)}]`);
    notify(ok ? "تم نسخ الآية" : "تعذّر النسخ، حدّد النص يدوياً");
  };

  const toggleTafsir = () => {
    const next = !tafsirOpen;
    setTafsirOpen(next);
    writeString(STORAGE_KEYS.tafsirOpen, next ? "1" : "0");
  };

  const goToAyah = () => {
    if (!ayahs || request.mode !== "surah") return;
    const n = Number(gotoValue);
    if (Number.isInteger(n) && n >= 1 && n <= ayahs.length) {
      select(n - 1);
      setMenuOpen(false);
      setGotoValue("");
    } else {
      notify(`أدخل رقماً من ١ إلى ${toArabicIndic(ayahs.length)}`);
    }
  };

  /* ---------- derived structure: one block per surah segment ---------- */
  const blocks = useMemo(() => {
    if (!ayahs) return [];
    const out: Array<{ surahNumber: number; surahName: string; start: number; indexes: number[] }> = [];
    ayahs.forEach((a, i) => {
      const last = out[out.length - 1];
      if (last && last.surahNumber === a.surahNumber) last.indexes.push(i);
      else out.push({ surahNumber: a.surahNumber, surahName: a.surahName, start: a.numberInSurah, indexes: [i] });
    });
    return out;
  }, [ayahs]);

  const surahMeta = (n: number) => surahNames?.find((s) => s.number === n) ?? (loaded?.surah?.number === n ? loaded.surah : undefined);
  const total = ayahs?.length ?? 0;
  const progress = total > 0 ? (active + 1) / total : 0;
  const barTitle = loaded ? (loaded.mode === "surah" ? loaded.title : current?.surahName ?? loaded.title) : "…";
  const barSub = loaded && current
    ? loaded.mode === "surah"
      ? `الآية ${toArabicIndic(current.numberInSurah)} من ${toArabicIndic(total)}`
      : `${loaded.title} · الآية ${toArabicIndic(current.numberInSurah)}`
    : "جارٍ التحميل";

  const nextTarget = loaded
    ? loaded.mode === "surah"
      ? loaded.number < 114 ? { mode: "surah" as const, number: loaded.number + 1, label: "السورة التالية" } : null
      : loaded.number < 30 ? { mode: "juz" as const, number: loaded.number + 1, label: "الجزء التالي" } : null
    : null;
  const prevTarget = loaded
    ? loaded.mode === "surah"
      ? loaded.number > 1 ? { mode: "surah" as const, number: loaded.number - 1, label: "السورة السابقة" } : null
      : loaded.number > 1 ? { mode: "juz" as const, number: loaded.number - 1, label: "الجزء السابق" } : null
    : null;

  const marked = current ? bookmarkKeys.has(bmKey(current.surahNumber, current.numberInSurah)) : false;

  return (
    <div className="reader" style={{ ["--quran-size" as string]: `${fontSize}px` }}>
      <header className="reader-bar">
        <div className="reader-bar__inner" style={{ position: "relative" }} ref={menuRef}>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="رجوع">
            <ArrowRight size={22} aria-hidden="true" />
          </button>
          <div className="reader-bar__title">
            <strong>{barTitle}</strong>
            <span>{barSub}</span>
          </div>
          <button type="button" className="icon-btn" onClick={onToggleTheme} aria-label={dark ? "وضع النهار" : "وضع القراءة الليلي"}>
            {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-label="إعدادات العرض"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Type size={20} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="popover popover--bar" role="dialog" aria-label="إعدادات العرض">
              <div className="field">
                <span className="field__label">
                  حجم الخط <span className="num">{toArabicIndic(fontSize)}</span>
                </span>
                <div className="row">
                  <button type="button" className="icon-btn" onClick={() => changeFont(-2)} disabled={fontSize <= MIN_FONT} aria-label="تصغير الخط">
                    <Minus size={18} aria-hidden="true" />
                  </button>
                  <input
                    type="range"
                    className="range"
                    min={MIN_FONT}
                    max={MAX_FONT}
                    step={1}
                    value={fontSize}
                    aria-label="حجم الخط"
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setFontSize(v);
                      writeString(STORAGE_KEYS.fontSize, String(v));
                    }}
                  />
                  <button type="button" className="icon-btn" onClick={() => changeFont(2)} disabled={fontSize >= MAX_FONT} aria-label="تكبير الخط">
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {request.mode === "surah" && loaded && (
                <div className="field">
                  <label className="field__label" htmlFor="goto-ayah">انتقل إلى آية</label>
                  <form
                    className="row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      goToAyah();
                    }}
                  >
                    <input
                      id="goto-ayah"
                      className="number-input"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={`1–${total}`}
                      value={gotoValue}
                      onChange={(e) => setGotoValue(e.target.value.replace(/\D/g, ""))}
                    />
                    <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }}>انتقال</button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="reader-progress" role="progressbar" aria-label="تقدّم القراءة" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="reader-progress__fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <main className="reader-main">
        {text.status === "loading" && <ReaderSkeleton />}

        {text.status === "error" && (
          <div className="error-box" style={{ margin: "2rem 1rem" }} role="alert">
            <AlertTriangle size={32} aria-hidden="true" />
            <h3>تعذّر تحميل {request.mode === "juz" ? "الجزء" : "السورة"}</h3>
            <p>{text.message}</p>
            <div className="row">
              {/* Retry reloads exactly the same request: same mode, number and target position. */}
              <button type="button" className="btn btn--primary" onClick={() => setTextRetry((n) => n + 1)}>إعادة المحاولة</button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>رجوع</button>
            </div>
          </div>
        )}

        {loaded && (
          <article className="paper" aria-label={loaded.title}>
            {blocks.map((b) => {
              const meta = surahMeta(b.surahNumber);
              const startsSurah = b.start === 1;
              return (
                <section key={`${b.surahNumber}-${b.start}`} aria-label={b.surahName}>
                  {startsSurah ? (
                    <>
                      <div className="surah-heading">
                        <h2 className="surah-heading__name">{b.surahName}</h2>
                        {meta && (
                          <div className="surah-heading__meta">
                            <span>{meta.revelationType === "Meccan" ? "مكية" : "مدنية"}</span>
                            <span>{toArabicIndic(meta.numberOfAyahs)} آية</span>
                            <span>ترتيبها {toArabicIndic(meta.number)}</span>
                          </div>
                        )}
                      </div>
                      {surahHasBasmalaHeading(b.surahNumber) && <p className="basmala">{BASMALA}</p>}
                    </>
                  ) : (
                    loaded.mode === "juz" && (
                      <div className="surah-heading surah-heading--cont">
                        <h2 className="surah-heading__name">تتمة {b.surahName}</h2>
                      </div>
                    )
                  )}
                  <p className="mushaf-text">
                    {b.indexes.map((i) => (
                      <AyahSpan
                        key={ayahs![i].number}
                        ayah={ayahs![i]}
                        index={i}
                        active={i === active}
                        marked={bookmarkKeys.has(bmKey(ayahs![i].surahNumber, ayahs![i].numberInSurah))}
                        onSelect={onAyahClick}
                        onKey={onAyahKey}
                      />
                    ))}
                  </p>
                </section>
              );
            })}
          </article>
        )}

        {loaded && (prevTarget || nextTarget) && (
          <nav className="reader-nav" aria-label="التنقل">
            {nextTarget ? (
              <button type="button" className="btn btn--ghost" onClick={() => onOpen(nextTarget)}>{nextTarget.label}</button>
            ) : <span />}
            {prevTarget ? (
              <button type="button" className="btn btn--ghost" onClick={() => onOpen(prevTarget)}>{prevTarget.label}</button>
            ) : <span />}
          </nav>
        )}
      </main>

      {loaded && current && (
        <div className="dock" ref={dockRef}>
          {tafsirOpen && <TafsirPanel ayah={current} />}
          <AudioPlayer
            sources={sources}
            nextSource={nextSource}
            audioStatus={audioView.status}
            audioMessage={audioView.status === "error" ? audioView.message : undefined}
            onRetryAudio={() => setAudioRetry((n) => n + 1)}
            title={current.surahName}
            subtitle={`الآية ${toArabicIndic(current.numberInSurah)} · ${reciterName(reciterId)}`}
            hasNext={active < total - 1}
            hasPrevious={active > 0}
            onNext={goNext}
            onPrevious={goPrev}
            reciterId={reciterId}
            onReciterChange={onReciterChange}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            extraControls={
              <>
                <button type="button" className="icon-btn" onClick={toggleBookmark} aria-pressed={marked} aria-label={marked ? "إزالة الآية من المحفوظات" : "حفظ الآية"} title="حفظ (Ctrl+D)">
                  <Bookmark size={20} fill={marked ? "currentColor" : "none"} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn" onClick={copyCurrent} aria-label="نسخ الآية">
                  <Copy size={20} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn" onClick={toggleTafsir} aria-pressed={tafsirOpen} aria-label="التفسير">
                  <BookMarked size={20} aria-hidden="true" />
                </button>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}

function toPosition(a: ReaderAyah, mode: ReaderMode, juz: number): LastRead {
  return {
    surahNumber: a.surahNumber,
    surahName: a.surahName,
    ayahNumber: a.numberInSurah,
    text: displayAyahText(a.surahNumber, a.numberInSurah, a.text),
    timestamp: new Date().toISOString(),
    mode,
    juz: juz || undefined
  };
}
