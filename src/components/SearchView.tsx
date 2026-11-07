/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Fragment, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, Search } from "lucide-react";
import type { SearchFilter, SearchResult } from "../types";
import { toArabicIndic } from "../lib/arabic";
import { ListSkeleton } from "./Skeletons";

export type SearchState =
  | { status: "idle" }
  | { status: "loading"; stage: "index" | "search" }
  | { status: "error"; message: string }
  | {
      status: "done";
      query: string;
      filter: SearchFilter;
      results: SearchResult[];
      wordsFallback: boolean;
    };

const PAGE_SIZE = 30;

interface SearchViewProps {
  state: SearchState;
  onSelect: (surahNumber: number, ayahNumber?: number) => void;
  onRetry: () => void;
}

function Highlighted({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([s, e], i) => {
    if (s > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, s)}</Fragment>);
    parts.push(
      <mark className="hl" key={`m${i}`}>
        {text.slice(s, e)}
      </mark>
    );
    cursor = e;
  });
  if (cursor < text.length) parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}

function Results({ state, onSelect }: { state: Extract<SearchState, { status: "done" }>; onSelect: SearchViewProps["onSelect"] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { results, query, filter, wordsFallback } = state;

  if (results.length === 0) {
    return (
      <div className="empty" style={{ marginTop: "1.5rem" }}>
        <Search className="empty__icon" size={40} aria-hidden="true" />
        <h3>لا توجد نتائج</h3>
        <p>
          لم نجد ما يطابق «{query}».{" "}
          {filter === "exact"
            ? "جرّب «الكل» أو «بحث جزئي» لتشمل الكلمات المتصلة بحروف أخرى."
            : "تأكد من الكتابة أو جرّب كلمة أقصر."}
        </p>
      </div>
    );
  }

  const shown = results.slice(0, visible);
  return (
    <div>
      <div className="results__meta">
        <span>
          نتائج «<strong>{query}</strong>»
          {wordsFallback && " — آيات تحتوي على كل الكلمات (ليست عبارة متصلة)"}
        </span>
        <span>{toArabicIndic(results.length)} نتيجة</span>
      </div>
      <div role="list">
        {shown.map((r, i) =>
          r.kind === "surah" ? (
            <button
              key={`s${r.surah.number}`}
              role="listitem"
              type="button"
              className="result"
              onClick={() => onSelect(r.surah.number)}
            >
              <span>
                <span className="result__head">
                  <span className="result__surah">{r.surah.name}</span>
                  <span className="pill">{toArabicIndic(r.surah.numberOfAyahs)} آية</span>
                  <span className="pill">{r.surah.revelationType === "Meccan" ? "مكية" : "مدنية"}</span>
                </span>
              </span>
              <ChevronLeft className="result__arrow" size={20} aria-hidden="true" />
            </button>
          ) : (
            <button
              key={`a${r.surahNumber}:${r.ayahNumber}:${i}`}
              role="listitem"
              type="button"
              className="result"
              onClick={() => onSelect(r.surahNumber, r.ayahNumber)}
              aria-label={`${r.surahName}، الآية ${toArabicIndic(r.ayahNumber)}`}
            >
              <span>
                <span className="result__head">
                  <span className="result__surah">{r.surahName}</span>
                  <span className="pill">الآية {toArabicIndic(r.ayahNumber)}</span>
                </span>
                <span className="result__text" style={{ display: "block" }}>
                  <Highlighted text={r.text} ranges={r.ranges} />
                </span>
              </span>
              <ChevronLeft className="result__arrow" size={20} aria-hidden="true" />
            </button>
          )
        )}
      </div>
      {visible < results.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
          <button type="button" className="btn btn--ghost" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            عرض المزيد ({toArabicIndic(results.length - visible)})
          </button>
        </div>
      )}
    </div>
  );
}

export function SearchView({ state, onSelect, onRetry }: SearchViewProps) {
  if (state.status === "idle") {
    return (
      <div className="empty" style={{ marginTop: "1.5rem" }}>
        <Search className="empty__icon" size={40} aria-hidden="true" />
        <h3>ابحث في آيات الذكر الحكيم</h3>
        <p>اكتب كلمة أو عبارة بدون تشكيل، أو اسم سورة أو رقمها. البحث يتجاهل التشكيل وأشكال الهمزة.</p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div style={{ marginTop: "1.5rem" }}>
        <p className="hint" role="status">
          {state.stage === "index"
            ? "جارٍ تجهيز فهرس البحث (يتم مرة واحدة ثم يُحفظ على جهازك)…"
            : "جارٍ البحث…"}
        </p>
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="error-box" style={{ marginTop: "1.5rem" }} role="alert">
        <AlertTriangle size={32} aria-hidden="true" />
        <h3>تعذّر إتمام البحث</h3>
        <p>{state.message}</p>
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // `key` resets pagination whenever a new search finishes.
  return <Results key={`${state.query}|${state.filter}|${state.results.length}`} state={state} onSelect={onSelect} />;
}
