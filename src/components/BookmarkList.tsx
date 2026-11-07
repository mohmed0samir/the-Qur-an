/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Bookmark as BookmarkIcon, ChevronLeft, Trash2 } from "lucide-react";
import type { Bookmark } from "../types";
import { displayAyahText, toArabicIndic } from "../lib/arabic";

interface BookmarkListProps {
  bookmarks: Bookmark[];
  onSelectBookmark: (surahNumber: number, ayahNumber: number) => void;
  onRemoveBookmark: (surahNumber: number, ayahNumber: number) => void;
}

export function BookmarkList({ bookmarks, onSelectBookmark, onRemoveBookmark }: BookmarkListProps) {
  if (bookmarks.length === 0) {
    return (
      <div className="empty">
        <BookmarkIcon className="empty__icon" size={40} aria-hidden="true" />
        <h3>لا توجد آيات محفوظة بعد</h3>
        <p>
          أثناء القراءة اختر آية ثم اضغط على علامة الحفظ في شريط التلاوة (أو Ctrl+D) لتجدها هنا وتعود إليها
          بنقرة واحدة.
        </p>
      </div>
    );
  }

  const sorted = [...bookmarks].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return (
    <div>
      <p className="results__meta" style={{ marginTop: 0 }}>
        <span>الأحدث أولاً</span>
        <span>{toArabicIndic(bookmarks.length)} آية محفوظة</span>
      </p>
      <div role="list">
        {sorted.map((b) => (
          <div className="bookmark" role="listitem" key={`${b.surahNumber}:${b.ayahNumber}`}>
            <button
              type="button"
              className="bookmark__main"
              onClick={() => onSelectBookmark(b.surahNumber, b.ayahNumber)}
              aria-label={`افتح ${b.surahName}، الآية ${toArabicIndic(b.ayahNumber)}`}
            >
              <span className="result__head">
                <span className="result__surah">{b.surahName}</span>
                <span className="pill">الآية {toArabicIndic(b.ayahNumber)}</span>
                <ChevronLeft size={16} aria-hidden="true" style={{ color: "var(--gold-ink)" }} />
              </span>
              <span className="result__text" style={{ display: "block" }}>
                {displayAyahText(b.surahNumber, b.ayahNumber, b.text)}
              </span>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onRemoveBookmark(b.surahNumber, b.ayahNumber)}
              aria-label={`حذف ${b.surahName} الآية ${toArabicIndic(b.ayahNumber)} من المحفوظات`}
              title="حذف من المحفوظات"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
