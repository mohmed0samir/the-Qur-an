/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Bookmark } from "../types";
import { Bookmark as BookmarkIcon, Trash2, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

interface BookmarkListProps {
  bookmarks: Bookmark[];
  onSelectBookmark: (surahNumber: number, ayahNumber: number) => void;
  onRemoveBookmark: (surahNumber: number, ayahNumber: number) => void;
}

export const BookmarkList: React.FC<BookmarkListProps> = ({
  bookmarks,
  onSelectBookmark,
  onRemoveBookmark
}) => {
  if (bookmarks.length === 0) {
    return (
      <div className="bg-white dark:bg-emerald-950/20 border border-dashed border-emerald-200 dark:border-emerald-900/60 rounded-3xl p-12 text-center text-gray-400 dark:text-emerald-400/40">
        <BookmarkIcon className="mx-auto mb-4 opacity-50 text-amber-500" size={48} />
        <h3 className="text-lg font-bold">المحفوظات فارغة</h3>
        <p className="text-xs mt-1">يمكنك إضافة الآيات للمحفوظات بالضغط على علامة المرجعية 🔖 بجانب الآية في القارئ أو بالضغط على Ctrl+D</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-emerald-500">
        <span>الآيات المحفوظة في مفضلتك</span>
        <span>{bookmarks.length} آية محفوظة</span>
      </div>

      <div className="grid gap-3">
        {bookmarks.map((bookmark, idx) => (
          <motion.div
            key={`${bookmark.surahNumber}-${bookmark.ayahNumber}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.05, 0.5) }}
            className="bg-white dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900/60 hover:border-emerald-300 dark:hover:border-amber-500/40 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 group flex items-center justify-between"
          >
            <div
              onClick={() => onSelectBookmark(bookmark.surahNumber, bookmark.ayahNumber)}
              className="flex-1 text-right"
            >
              <div className="flex items-center gap-2 mb-2 flex-row-reverse justify-end">
                <h4 className="font-scheherazade text-lg font-bold text-emerald-800 dark:text-amber-300 group-hover:text-emerald-600 dark:group-hover:text-amber-400 transition-colors">
                  سورة {bookmark.surahName}
                </h4>
                <span className="text-xs bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 px-2 py-0.5 rounded-md font-bold font-mono">
                  الآية {bookmark.ayahNumber}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-emerald-500 font-mono">
                  {new Date(bookmark.timestamp).toLocaleDateString("ar-EG")}
                </span>
              </div>

              <p className="font-scheherazade text-xl text-gray-800 dark:text-gray-100 leading-relaxed font-medium">
                {bookmark.text}
              </p>
            </div>

            <div className="flex items-center gap-3 mr-4">
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Don't trigger card click
                  onRemoveBookmark(bookmark.surahNumber, bookmark.ayahNumber);
                }}
                className="p-2 text-gray-400 hover:text-rose-500 dark:text-emerald-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                title="حذف من المحفوظات"
              >
                <Trash2 size={18} />
              </button>

              <div
                onClick={() => onSelectBookmark(bookmark.surahNumber, bookmark.ayahNumber)}
                className="text-emerald-700 dark:text-amber-400 group-hover:translate-x-[-4px] transition-transform"
              >
                <ArrowLeft size={18} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
