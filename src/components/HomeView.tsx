import { ArrowLeft, Bookmark, BookOpen, Layers } from "lucide-react";
import type { ActiveTab, LastRead, SearchFilter } from "../types";
import { BASMALA, displayAyahText, toArabicIndic } from "../lib/arabic";
import { ArchOrnament } from "./Ornaments";
import { SearchBar } from "./SearchBar";

interface HomeViewProps {
  lastRead: LastRead | null;
  recent: LastRead[];
  bookmarkCount: number;
  surahCount: number;
  onContinue: () => void;
  onClearLastRead: () => void;
  onOpenRecent: (entry: LastRead) => void;
  onNavigate: (tab: ActiveTab) => void;
  search: {
    query: string;
    filter: SearchFilter;
    onQueryChange: (q: string) => void;
    onFilterChange: (f: SearchFilter) => void;
    onSubmit: () => void;
    onIntent: () => void;
  };
}

export function HomeView({
  lastRead,
  recent,
  bookmarkCount,
  surahCount,
  onContinue,
  onClearLastRead,
  onOpenRecent,
  onNavigate,
  search
}: HomeViewProps) {
  const others = recent.filter((r) => !lastRead || r.surahNumber !== lastRead.surahNumber).slice(0, 6);

  return (
    <div>
      <section className="hero" aria-labelledby="hero-title">
        <ArchOrnament className="hero__arch" />
        <div className="container hero__inner">
          <p className="hero__basmala" lang="ar">
            {BASMALA}
          </p>
          <h1 className="hero__title" id="hero-title">
            القرآن الكريم
          </h1>
          <p className="hero__sub">مصحفٌ هادئ للقراءة والاستماع والتدبّر، بالرسم العثماني وتلاوات نخبة من القرّاء.</p>
          <div className="hero__search">
            <SearchBar
              variant="hero"
              inputId="home-search"
              query={search.query}
              filter={search.filter}
              onQueryChange={search.onQueryChange}
              onFilterChange={search.onFilterChange}
              onSubmit={search.onSubmit}
              onIntent={search.onIntent}
            />
          </div>
        </div>
      </section>

      <div className="container">
        <div className="resume-wrap">
          <section className="resume" aria-label="متابعة القراءة">
            <div className="resume__label">
              <span>متابعة القراءة</span>
              {lastRead && (
                <button type="button" className="link-btn" onClick={onClearLastRead}>
                  مسح الموضع
                </button>
              )}
            </div>
            {lastRead ? (
              <>
                <h2 className="resume__place">
                  {lastRead.surahName}
                  <small>
                    الآية {toArabicIndic(lastRead.ayahNumber)}
                    {lastRead.mode === "juz" && lastRead.juz ? ` · الجزء ${toArabicIndic(lastRead.juz)}` : ""}
                  </small>
                </h2>
                <p className="resume__text">{displayAyahText(lastRead.surahNumber, lastRead.ayahNumber, lastRead.text)}</p>
                <div className="resume__actions">
                  <button type="button" className="btn btn--primary" onClick={onContinue}>
                    واصل من حيث توقفت
                    <ArrowLeft size={18} aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="resume__empty">لا يوجد موضع قراءة محفوظ بعد. افتح أي سورة وسنحفظ لك موضعك تلقائياً.</p>
                <div className="resume__actions">
                  <button type="button" className="btn btn--primary" onClick={() => onNavigate("surahs")}>
                    تصفّح السور
                    <ArrowLeft size={18} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <nav className="quick" aria-label="وصول سريع">
          <button type="button" className="quick__tile" onClick={() => onNavigate("surahs")}>
            <BookOpen className="quick__icon" size={22} aria-hidden="true" />
            <span className="quick__title">السور</span>
            <span className="quick__count">{toArabicIndic(surahCount)} سورة</span>
          </button>
          <button type="button" className="quick__tile" onClick={() => onNavigate("juz")}>
            <Layers className="quick__icon" size={22} aria-hidden="true" />
            <span className="quick__title">الأجزاء</span>
            <span className="quick__count">{toArabicIndic(30)} جزءاً</span>
          </button>
          <button type="button" className="quick__tile" onClick={() => onNavigate("bookmarks")}>
            <Bookmark className="quick__icon" size={22} aria-hidden="true" />
            <span className="quick__title">محفوظاتي</span>
            <span className="quick__count">{toArabicIndic(bookmarkCount)} آية</span>
          </button>
        </nav>

        {others.length > 0 && (
          <section className="block" aria-label="قُرئ مؤخراً">
            <div className="block__head">
              <div className="eyebrow">قُرئ مؤخراً</div>
            </div>
            <div className="recent">
              {others.map((r) => (
                <button
                  type="button"
                  key={r.surahNumber}
                  className="recent__item"
                  onClick={() => onOpenRecent(r)}
                  aria-label={`${r.surahName}، الآية ${toArabicIndic(r.ayahNumber)}`}
                >
                  <div className="recent__name">{r.surahName}</div>
                  <div className="recent__meta">الآية {toArabicIndic(r.ayahNumber)}</div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
