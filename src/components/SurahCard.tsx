/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { BookOpen, MapPin } from "lucide-react";
import { Surah } from "../types";

interface SurahCardProps {
  surah: Surah;
  onClick: () => void;
}

export const SurahCard: React.FC<SurahCardProps> = ({ surah, onClick }) => {
  const isMeccan = surah.revelationType === "Meccan" || surah.revelationType === "Mecca";

  return (
    <motion.div
      id={`surah-card-${surah.number}`}
      onClick={onClick}
      className="relative overflow-hidden bg-white dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 group flex flex-col justify-between"
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Visual Gold Line at the top of the card */}
      <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-l from-emerald-600 to-amber-500" />

      <div className="flex items-start justify-between mb-4">
        {/* Number Badge */}
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-amber-400 font-bold flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60 font-mono text-sm shadow-inner">
          {surah.number}
        </div>

        {/* Revelation Type Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100/50 dark:border-emerald-800/40">
          <MapPin size={12} className={isMeccan ? "text-amber-500" : "text-emerald-500"} />
          <span>{isMeccan ? "مكية" : "مدنية"}</span>
        </div>
      </div>

      <div className="text-right mb-4">
        <h3 className="font-scheherazade text-2xl font-bold text-emerald-800 dark:text-amber-200 group-hover:text-emerald-600 dark:group-hover:text-amber-400 transition-colors">
          {surah.name}
        </h3>
        <p className="text-xs text-gray-400 dark:text-emerald-400/60 font-mono mt-1" dir="ltr">
          {surah.englishName}
        </p>
      </div>

      <div className="border-t border-dashed border-gray-100 dark:border-emerald-900/60 pt-3 mt-auto flex items-center justify-between text-xs text-gray-500 dark:text-emerald-300/80">
        <div className="flex items-center gap-1 font-mono">
          <BookOpen size={14} className="text-amber-500" />
          <span>{surah.numberOfAyahs} آية</span>
        </div>
        <span className="text-gray-400 dark:text-emerald-400/50 text-[10px]">
          {surah.englishNameTranslation}
        </span>
      </div>
    </motion.div>
  );
};
