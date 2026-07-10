/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { SearchMatch, SearchFilter } from "../types";
import { Search, MapPin, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

interface SearchViewProps {
  results: SearchMatch[];
  query: string;
  filter: SearchFilter;
  onSelectResult: (surahNumber: number, ayahNumber?: number) => void;
  isLoading: boolean;
}

export const SearchView: React.FC<SearchViewProps> = ({
  results,
  query,
  filter,
  onSelectResult,
  isLoading
}) => {
  // Helper to highlight matching text cleanly
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm || filter === "surah") return text;
    
    // Escape regex characters
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <span
              key={index}
              className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-1 py-0.5 rounded font-bold"
            >
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full mb-4"
        />
        <p className="text-gray-500 dark:text-emerald-400 font-medium">جاري البحث في آيات وسور القرآن...</p>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="bg-white dark:bg-emerald-950/20 border border-dashed border-emerald-200 dark:border-emerald-900/60 rounded-3xl p-10 text-center text-gray-400 dark:text-emerald-400/40">
        <Search className="mx-auto mb-4 opacity-50" size={48} />
        <h3 className="text-lg font-bold">ابدأ بالبحث في آيات وسور الذكر الحكيم</h3>
        <p className="text-xs mt-1">اكتب أي كلمة، آية، أو جزء من آية، أو اسم سورة</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-white dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-3xl p-10 text-center">
        <p className="text-gray-500 dark:text-emerald-400/60 font-medium">لا توجد نتائج مطابقة لبحثك عن: "{query}"</p>
        <p className="text-xs text-gray-400 dark:text-emerald-500/50 mt-1">تأكد من كتابة الكلمات بشكل صحيح أو جرب تغيير نوع الفلتر</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-emerald-500">
        <span>نتائج البحث عن: <strong className="text-emerald-800 dark:text-amber-400">"{query}"</strong></span>
        <span>عثرنا على {results.length} نتيجة</span>
      </div>

      <div className="grid gap-3">
        {results.map((result, idx) => {
          const surahName = result.surah?.name || "سورة مجهولة";
          const isMeccan = result.surah?.revelationType === "Meccan";
          const isSurahSearch = filter === "surah";

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.5) }}
              onClick={() => onSelectResult(result.surah.number, isSurahSearch ? undefined : result.numberInSurah)}
              className="bg-white dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900/60 hover:border-emerald-300 dark:hover:border-amber-500/40 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 group flex justify-between items-center"
            >
              <div className="flex-1 text-right">
                <div className="flex items-center gap-2 mb-2 flex-row-reverse justify-end">
                  <h4 className="font-scheherazade text-lg font-bold text-emerald-800 dark:text-amber-300 group-hover:text-emerald-600 dark:group-hover:text-amber-400 transition-colors">
                    سورة {surahName}
                  </h4>
                  {!isSurahSearch && (
                    <span className="text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold">
                      الآية {result.numberInSurah}
                    </span>
                  )}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-gray-50 dark:bg-emerald-900/20 text-gray-500 dark:text-emerald-400">
                    <MapPin size={10} className={isMeccan ? "text-amber-500" : "text-emerald-500"} />
                    <span>{isMeccan ? "مكية" : "مدنية"}</span>
                  </div>
                </div>

                <p className="font-scheherazade text-xl text-gray-800 dark:text-gray-100 leading-relaxed font-medium">
                  {isSurahSearch ? `انتقل إلى سورة ${surahName} (${result.surah.numberOfAyahs} آية)` : highlightText(result.text, query)}
                </p>
              </div>

              <div className="mr-4 text-emerald-700 dark:text-amber-400 group-hover:translate-x-[-4px] transition-transform">
                <ArrowLeft size={18} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
