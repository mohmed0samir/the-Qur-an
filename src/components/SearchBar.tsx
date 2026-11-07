import type { FormEvent } from "react";
import { Search, X } from "lucide-react";
import type { SearchFilter } from "../types";

export const FILTER_LABELS: Record<SearchFilter, string> = {
  all: "الكل",
  exact: "تطابق تام",
  partial: "بحث جزئي",
  surah: "أسماء السور"
};

const FILTERS: SearchFilter[] = ["all", "exact", "partial", "surah"];

interface SearchBarProps {
  query: string;
  filter: SearchFilter;
  onQueryChange: (q: string) => void;
  onFilterChange: (f: SearchFilter) => void;
  onSubmit: () => void;
  /** Called when the field receives focus (used to warm up the search index). */
  onIntent?: () => void;
  variant: "hero" | "page";
  inputId: string;
}

export function SearchBar({
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onSubmit,
  onIntent,
  variant,
  inputId
}: SearchBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} role="search" aria-label="البحث في القرآن الكريم">
      <div className="searchbar__field">
        <Search className="searchbar__icon" size={20} aria-hidden="true" />
        <label htmlFor={inputId} className="sr-only">
          ابحث في القرآن الكريم
        </label>
        <input
          id={inputId}
          className="searchbar__input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          dir="rtl"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={onIntent}
          placeholder={filter === "surah" ? "اسم السورة أو رقمها…" : "ابحث بكلمة أو عبارة من الآيات…"}
        />
        {query && (
          <button type="button" className="searchbar__clear" aria-label="مسح النص" onClick={() => onQueryChange("")}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="searchbar__submit" disabled={!query.trim()}>
          بحث
        </button>
      </div>
      <div className="searchbar__filters" role="group" aria-label="نوع البحث">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={variant === "hero" ? "chip" : "chip chip--on-paper"}
            aria-pressed={filter === f}
            onClick={() => onFilterChange(f)}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>
    </form>
  );
}
