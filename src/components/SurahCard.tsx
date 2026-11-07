/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { memo } from "react";
import type { Surah } from "../types";
import { toArabicIndic } from "../lib/arabic";

interface SurahCardProps {
  surah: Surah;
  onClick: () => void;
}

/** One row of the surah index (kept under its original name for compatibility). */
export const SurahCard = memo(function SurahCard({ surah, onClick }: SurahCardProps) {
  const meccan = surah.revelationType === "Meccan" || surah.revelationType === "Mecca";
  return (
    <button
      type="button"
      className="surah-item"
      onClick={onClick}
      aria-label={`${surah.name}، ${toArabicIndic(surah.numberOfAyahs)} آية، ${meccan ? "مكية" : "مدنية"}`}
    >
      <span className="badge-star num" aria-hidden="true">
        {toArabicIndic(surah.number)}
      </span>
      <span>
        <span className="surah-item__name" style={{ display: "block" }}>
          {surah.name}
        </span>
        <span className="surah-item__sub" style={{ display: "block" }}>
          {surah.englishName}
        </span>
      </span>
      <span className="surah-item__meta">
        <strong>{meccan ? "مكية" : "مدنية"}</strong>
        <span>{toArabicIndic(surah.numberOfAyahs)} آية</span>
      </span>
    </button>
  );
});
