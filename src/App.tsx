/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Moon,
  Sun,
  Bookmark,
  BookOpen,
  Compass,
  ArrowRight,
  Heart,
  Volume2,
  RefreshCw,
  Clock,
  Sparkles,
  MapPin,
  Check,
  AlertTriangle
} from "lucide-react";
import { Surah, Ayah, Bookmark as BookmarkType, SearchMatch, SearchFilter, ActiveTab } from "./types";
import { SurahCard } from "./components/SurahCard";
import { AudioPlayer, RECITERS } from "./components/AudioPlayer";
import { SearchView } from "./components/SearchView";
import { BookmarkList } from "./components/BookmarkList";

export default function App() {
  // Theme & App State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("quran_theme") === "night";
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>("surahs");

  // Core Data
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [isLoadingSurahs, setIsLoadingSurahs] = useState<boolean>(true);
  const [errorSurahs, setErrorSurahs] = useState<string | null>(null);

  // Search States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Reader States
  const [readerOpen, setReaderOpen] = useState<boolean>(false);
  const [readerMode, setReaderMode] = useState<"surah" | "juz">("surah");
  const [readerTitle, setReaderTitle] = useState<string>("");
  const [readerAyahs, setReaderAyahs] = useState<Ayah[]>([]);
  const [currentAyahIndex, setCurrentAyahIndex] = useState<number>(0);
  const [isLoadingReader, setIsLoadingReader] = useState<boolean>(false);
  const [errorReader, setErrorReader] = useState<string | null>(null);
  
  // Virtual "currently loaded metadata" for audio reference
  const [activeSurahNumber, setActiveSurahNumber] = useState<number>(1);
  const [activeJuzNumber, setActiveJuzNumber] = useState<number | null>(null);

  // Audio Control
  const [reciter, setReciter] = useState<string>(() => {
    return localStorage.getItem("quran_reciter") || "ar.alafasy";
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("quran_bookmarks") || "[]");
    } catch {
      return [];
    }
  });

  // Last Read tracker
  const [lastRead, setLastRead] = useState<BookmarkType | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("quran_last_read") || "null");
    } catch {
      return null;
    }
  });

  // Track page return source
  const readerOrigin = useRef<ActiveTab>("surahs");

  // Tafseer States
  const [selectedTafseerBook, setSelectedTafseerBook] = useState<number>(1);
  const [tafseerText, setTafseerText] = useState<string>("");
  const [isLoadingTafseer, setIsLoadingTafseer] = useState<boolean>(false);
  const [showTafseerPanel, setShowTafseerPanel] = useState<boolean>(true);

  // Dark mode class sync
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("quran_theme", darkMode ? "night" : "day");
  }, [darkMode]);

  // Fetch Surah list on mount
  useEffect(() => {
    const fetchSurahs = async () => {
      setIsLoadingSurahs(true);
      setErrorSurahs(null);
      try {
        const response = await fetch("https://api.alquran.cloud/v1/surah");
        if (!response.ok) throw new Error("فشل الاتصال بالخادم لتحميل السور");
        const data = await response.json();
        if (data.code === 200) {
          setSurahs(data.data);
        } else {
          throw new Error(data.message || "فشل تحميل قائمة السور");
        }
      } catch (err: any) {
        setErrorSurahs(err.message || "حدث خطأ غير متوقع أثناء تحميل السور.");
      } finally {
        setIsLoadingSurahs(false);
      }
    };

    fetchSurahs();
  }, []);

  // Sync reciter preference to localStorage
  useEffect(() => {
    localStorage.setItem("quran_reciter", reciter);
  }, [reciter]);

  // Sync bookmarks to localStorage
  useEffect(() => {
    localStorage.setItem("quran_bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks]);

  // Sync last read to localStorage
  useEffect(() => {
    if (lastRead) {
      localStorage.setItem("quran_last_read", JSON.stringify(lastRead));
    }
  }, [lastRead]);

  // Listen to keyboard shortcut Ctrl+D to bookmark current Ayah
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "d" && readerOpen && readerAyahs.length > 0) {
        e.preventDefault();
        toggleBookmarkCurrentAyah();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readerOpen, readerAyahs, currentAyahIndex, activeSurahNumber, readerTitle]);

  // Smooth scroll to active ayah
  useEffect(() => {
    if (readerOpen) {
      const activeElement = document.getElementById(`ayah-node-${currentAyahIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentAyahIndex, readerOpen]);

  // Fetch Tafseer of the active Ayah
  useEffect(() => {
    if (!readerOpen || readerAyahs.length === 0 || !showTafseerPanel) return;

    const activeAyah = readerAyahs[currentAyahIndex];
    if (!activeAyah) return;

    // Determine correct Surah and Ayah numbers for Tafseer query
    const sNum = activeSurahNumber || (activeAyah.surah ? activeAyah.surah.number : 1);
    const aNum = activeAyah.numberInSurah;

    const fetchTafseer = async () => {
      setIsLoadingTafseer(true);
      setTafseerText("");
      try {
        const response = await fetch(`https://api.quran-tafseer.com/tafseer/${selectedTafseerBook}/${sNum}/${aNum}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        setTafseerText(data.text || "لا يوجد تفسير متاح لهذه الآية حالياً.");
      } catch (err) {
        setTafseerText("تعذر تحميل التفسير حالياً، يرجى المحاولة مرة أخرى.");
      } finally {
        setIsLoadingTafseer(false);
      }
    };

    fetchTafseer();
  }, [currentAyahIndex, readerOpen, selectedTafseerBook, showTafseerPanel, readerAyahs, activeSurahNumber]);

  // Load Reader Content (Surah or Juz)
  const loadReader = async (
    type: "surah" | "juz",
    number: number,
    targetAyahNumber?: number,
    autoPlayImmediately: boolean = false
  ) => {
    setIsLoadingReader(true);
    setErrorReader(null);
    setIsPlaying(false);
    setReaderOpen(true);
    setReaderMode(type);

    try {
      if (type === "surah") {
        setActiveSurahNumber(number);
        setActiveJuzNumber(null);
        
        // Parallel fetch for Uthmani Text and chosen Reciter's audio
        const [textRes, audioRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${number}/ar.uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${number}/${reciter}`)
        ]);

        if (!textRes.ok || !audioRes.ok) throw new Error("فشل تحميل بيانات السورة. يرجى التحقق من اتصالك بالإنترنت.");

        const textData = await textRes.json();
        const audioData = await audioRes.json();

        if (textData.code === 200 && audioData.code === 200) {
          const combined: Ayah[] = textData.data.ayahs.map((ayah: Ayah, index: number) => ({
            ...ayah,
            audio: audioData.data.ayahs[index].audio,
            audioSecondary: audioData.data.ayahs[index].audioSecondary
          }));

          setReaderTitle(textData.data.name);
          setReaderAyahs(combined);

          // Find exact ayah index if targeted
          let targetIndex = 0;
          if (targetAyahNumber) {
            const foundIdx = combined.findIndex((a) => a.numberInSurah === targetAyahNumber);
            if (foundIdx !== -1) targetIndex = foundIdx;
          }

          setCurrentAyahIndex(targetIndex);
          if (autoPlayImmediately) {
            setTimeout(() => setIsPlaying(true), 400);
          }

          // Save last read position
          setLastRead({
            surahNumber: number,
            surahName: textData.data.name,
            ayahNumber: combined[targetIndex].numberInSurah,
            text: combined[targetIndex].text,
            timestamp: new Date().toISOString()
          });
        } else {
          throw new Error("خطأ في معالجة السورة من المزود.");
        }
      } else {
        // Juz mode
        setActiveJuzNumber(number);
        
        const [textRes, audioRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/juz/${number}/ar.uthmani`),
          fetch(`https://api.alquran.cloud/v1/juz/${number}/${reciter}`)
        ]);

        if (!textRes.ok || !audioRes.ok) throw new Error("فشل تحميل بيانات الجزء. يرجى التحقق من اتصالك بالإنترنت.");

        const textData = await textRes.json();
        const audioData = await audioRes.json();

        if (textData.code === 200 && audioData.code === 200) {
          const combined: Ayah[] = textData.data.ayahs.map((ayah: any, index: number) => ({
            ...ayah,
            audio: audioData.data.ayahs[index].audio,
            audioSecondary: audioData.data.ayahs[index].audioSecondary
          }));

          setReaderTitle(`الجزء ${number}`);
          setReaderAyahs(combined);

          let targetIndex = 0;
          if (targetAyahNumber) {
            const foundIdx = combined.findIndex(
              (a) => a.surah?.number === activeSurahNumber && a.numberInSurah === targetAyahNumber
            );
            if (foundIdx !== -1) targetIndex = foundIdx;
          }

          setCurrentAyahIndex(targetIndex);
          if (autoPlayImmediately) {
            setTimeout(() => setIsPlaying(true), 400);
          }
        } else {
          throw new Error("خطأ في معالجة الجزء من المزود.");
        }
      }
    } catch (err: any) {
      setErrorReader(err.message || "حدث خطأ أثناء تحميل محتوى القراءة.");
    } finally {
      setIsLoadingReader(false);
    }
  };

  // Switch Reciter Dynamically
  const changeReciter = async (newReciterId: string) => {
    setReciter(newReciterId);
    if (!readerOpen || readerAyahs.length === 0) return;

    // Fetch new audio for the current reader session
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    setIsLoadingReader(true);

    try {
      if (readerMode === "surah") {
        const audioRes = await fetch(`https://api.alquran.cloud/v1/surah/${activeSurahNumber}/${newReciterId}`);
        if (!audioRes.ok) throw new Error("فشل تحميل تلاوة القارئ الجديد");
        const audioData = await audioRes.json();

        if (audioData.code === 200) {
          setReaderAyahs((prev) =>
            prev.map((ayah, index) => ({
              ...ayah,
              audio: audioData.data.ayahs[index].audio,
              audioSecondary: audioData.data.ayahs[index].audioSecondary
            }))
          );
        }
      } else if (readerMode === "juz" && activeJuzNumber) {
        const audioRes = await fetch(`https://api.alquran.cloud/v1/juz/${activeJuzNumber}/${newReciterId}`);
        if (!audioRes.ok) throw new Error("فشل تحميل تلاوة القارئ الجديد لهذا الجزء");
        const audioData = await audioRes.json();

        if (audioData.code === 200) {
          setReaderAyahs((prev) =>
            prev.map((ayah, index) => ({
              ...ayah,
              audio: audioData.data.ayahs[index].audio,
              audioSecondary: audioData.data.ayahs[index].audioSecondary
            }))
          );
        }
      }
      
      // Resume playing if it was active
      if (wasPlaying) {
        setTimeout(() => setIsPlaying(true), 250);
      }
    } catch (err: any) {
      alert("تعذر تحميل تلاوة القارئ المختار حالياً.");
    } finally {
      setIsLoadingReader(false);
    }
  };

  // Perform Quran Text Search
  const performSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setActiveTab("search");
    setReaderOpen(false);

    try {
      if (searchFilter === "surah") {
        // Search in local surah names list
        const filteredSurahs = surahs.filter(
          (s) => s.name.includes(query) || s.englishName.toLowerCase().includes(query.toLowerCase())
        );
        const matches: SearchMatch[] = filteredSurahs.map((s) => ({
          text: `سورة ${s.name}`,
          numberInSurah: 1,
          surah: {
            number: s.number,
            name: s.name,
            englishName: s.englishName,
            revelationType: s.revelationType,
            numberOfAyahs: s.numberOfAyahs
          }
        }));
        setSearchResults(matches);
      } else {
        // Advanced Uthmani search API
        const response = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/ar`);
        if (!response.ok) throw new Error("حدث خطأ في الاتصال بخادم البحث");
        const data = await response.json();

        if (data.code === 200) {
          let matches: SearchMatch[] = data.data.matches || [];

          // Custom Filters
          if (searchFilter === "exact") {
            // Filter where word is a complete standalone word
            matches = matches.filter((m) => {
              const words = (m.text || "").split(/[\s،.,؛:!؟?]+/);
              return words.includes(query);
            });
          }
          setSearchResults(matches);
        } else {
          setSearchResults([]);
        }
      }
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Bookmark Toggle
  const toggleBookmark = (ayah: Ayah, surahNum: number, surahName: string) => {
    const key = `${surahNum}-${ayah.numberInSurah}`;
    const exists = bookmarks.some((b) => b.surahNumber === surahNum && b.ayahNumber === ayah.numberInSurah);

    if (exists) {
      setBookmarks((prev) => prev.filter((b) => !(b.surahNumber === surahNum && b.ayahNumber === ayah.numberInSurah)));
    } else {
      const newBookmark: BookmarkType = {
        surahNumber: surahNum,
        surahName: surahName,
        ayahNumber: ayah.numberInSurah,
        text: ayah.text,
        timestamp: new Date().toISOString()
      };
      setBookmarks((prev) => [...prev, newBookmark]);
    }
  };

  const toggleBookmarkCurrentAyah = () => {
    if (readerAyahs.length === 0) return;
    const currentAyah = readerAyahs[currentAyahIndex];
    // Find surah info
    let sNum = activeSurahNumber;
    let sName = readerTitle;
    if (readerMode === "juz" && currentAyah.surah) {
      sNum = currentAyah.surah.number;
      sName = currentAyah.surah.name;
    }
    toggleBookmark(currentAyah, sNum, sName);
  };

  const removeBookmarkDirect = (surahNumber: number, ayahNumber: number) => {
    setBookmarks((prev) => prev.filter((b) => !(b.surahNumber === surahNumber && b.ayahNumber === ayahNumber)));
  };

  // Close reader and return safely
  const handleCloseReader = () => {
    setReaderOpen(false);
    setIsPlaying(false);
    setActiveTab(readerOrigin.current);
  };

  const currentAyahObj = readerAyahs[currentAyahIndex];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-emerald-950/20 text-slate-800 dark:text-emerald-100 font-amiri transition-colors duration-300">
      
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-50 bg-gradient-to-l from-emerald-800 to-emerald-900 text-white shadow-md border-b border-emerald-700/50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl text-amber-400">
              ☪️
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-scheherazade tracking-wider text-amber-300">
                القرآن الكريم
              </h1>
              <p className="text-[10px] md:text-xs text-emerald-200 font-sans tracking-wide">
                المصحف المجود والتلاوات العطرة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-full hover:bg-emerald-700/50 text-emerald-100 hover:text-amber-300 transition-all border border-transparent hover:border-emerald-700"
              title={darkMode ? "الوضع النهاري" : "الوضع الليلي"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 pb-24">
        
        {/* Dynamic Header Hero or Quick Resume Card */}
        {!readerOpen && (
          <div className="mb-8 grid gap-4 grid-cols-1 md:grid-cols-12">
            {/* Elegant Daily Quran Quote / Welcome banner */}
            <div className="md:col-span-8 bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 rounded-3xl p-6 text-white shadow-sm border border-emerald-800 flex flex-col justify-between min-h-[160px] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-xl" />
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full filter blur-2xl" />
              
              <div className="flex items-center gap-2 text-amber-300 text-xs font-sans font-bold">
                <Sparkles size={14} />
                <span>ذكر وتدبر</span>
              </div>
              <div className="my-3 text-right">
                <p className="font-scheherazade text-xl md:text-2xl text-amber-100/95 leading-relaxed font-bold">
                  "إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ"
                </p>
                <p className="text-xs text-emerald-300 font-sans mt-1">سورة الإسراء - الآية 9</p>
              </div>
              <p className="text-[11px] text-emerald-200/70 font-sans leading-relaxed">
                مرحبًا بك في منصة القرآن الكريم. تصفح السور، الأجزاء، أو ابحث في الآيات الكريمات واستمع بأصوات نخبة القراء.
              </p>
            </div>

            {/* Resume last read */}
            <div className="md:col-span-4 bg-white dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[160px]">
              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-emerald-400 font-sans">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-amber-500" />
                  <span>متابعة القراءة</span>
                </div>
                {lastRead && <span className="text-[10px]">منذ قليل</span>}
              </div>

              {lastRead ? (
                <div className="my-3 text-right">
                  <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-md font-mono">
                    سورة {lastRead.surahName} - آية {lastRead.ayahNumber}
                  </span>
                  <p className="font-scheherazade text-base text-gray-700 dark:text-gray-200 mt-2 line-clamp-1 font-medium">
                    {lastRead.text}
                  </p>
                </div>
              ) : (
                <div className="my-3 text-right text-gray-400 dark:text-emerald-500 text-sm">
                  لا يوجد نشاط قراءة سابق مسجل بعد. ابدأ بفتح سورة للبدء!
                </div>
              )}

              <button
                disabled={!lastRead}
                onClick={() => lastRead && loadReader("surah", lastRead.surahNumber, lastRead.ayahNumber)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-emerald-950 font-bold text-xs font-sans flex items-center justify-center gap-2 disabled:opacity-40 transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              >
                <span>واصل من حيث توقفت</span>
                <ArrowRight size={14} className="rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* Global Tabs & Search Controls */}
        {!readerOpen && (
          <div className="bg-white dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 rounded-3xl p-4 shadow-sm mb-8">
            <form onSubmit={performSearch} className="flex flex-col md:flex-row gap-3 items-stretch">
              
              {/* Search Inputs */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في القرآن الكريم (مثال: رحمة، العليم، قل هو الله أحد)..."
                  className="w-full py-3.5 pr-12 pl-4 rounded-2xl bg-slate-50 dark:bg-emerald-900/20 text-slate-800 dark:text-emerald-100 border-2 border-slate-100 dark:border-emerald-900 focus:outline-none focus:border-emerald-600 dark:focus:border-amber-500/60 font-sans text-sm transition-all"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-emerald-500" size={18} />
              </div>

              {/* Filters & Submit */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-slate-50 dark:bg-emerald-900/10 p-1.5 rounded-2xl flex gap-1 border border-slate-100 dark:border-emerald-900/40">
                  {(["all", "exact", "partial", "surah"] as SearchFilter[]).map((f) => {
                    const label = {
                      all: "الكل",
                      exact: "تطابق تام",
                      partial: "بحث جزئي",
                      surah: "أسماء السور"
                    }[f];
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setSearchFilter(f)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer ${
                          searchFilter === f
                            ? "bg-emerald-600 dark:bg-amber-500 text-white dark:text-emerald-950 shadow-sm"
                            : "text-gray-500 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-emerald-900/30"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  disabled={!searchQuery.trim()}
                  className="px-5 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-emerald-950 font-bold text-sm font-sans flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                >
                  <Search size={16} />
                  <span>ابحث</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Views and Reading Pane */}
        <AnimatePresence mode="wait">
          {!readerOpen ? (
            <motion.div
              key="main-tabs"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {/* Tab Toggles */}
              <div className="flex border-b border-gray-200 dark:border-emerald-900/60 mb-6 pb-2 gap-4">
                {(["surahs", "juz", "bookmarks", "search"] as ActiveTab[]).map((t) => {
                  const label = {
                    surahs: "📖 السور الشريفة",
                    juz: "📚 الأجزاء الثلاثون",
                    bookmarks: "🔖 آياتي المحفوظة",
                    search: "🔍 نتائج البحث"
                  }[t];
                  
                  // Hide search result tab unless there are results
                  if (t === "search" && searchResults.length === 0 && !isSearching) return null;

                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setActiveTab(t);
                        readerOrigin.current = t;
                      }}
                      className={`pb-3 text-sm md:text-base font-bold font-sans transition-all relative cursor-pointer ${
                        activeTab === t
                          ? "text-emerald-800 dark:text-amber-400"
                          : "text-gray-400 dark:text-emerald-500 hover:text-emerald-700"
                      }`}
                    >
                      <span>{label}</span>
                      {activeTab === t && (
                        <motion.div
                          layoutId="activeTabUnderline"
                          className="absolute bottom-0 right-0 left-0 h-0.5 bg-emerald-700 dark:bg-amber-500"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* View Components */}
              <div className="min-h-[300px]">
                {activeTab === "surahs" && (
                  <div>
                    {isLoadingSurahs ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full mb-4"
                        />
                        <p className="text-gray-500 dark:text-emerald-400 font-sans text-sm">جاري تحميل قائمة السور...</p>
                      </div>
                    ) : errorSurahs ? (
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 text-center text-red-700 dark:text-red-400 flex flex-col items-center gap-3">
                        <AlertTriangle size={32} />
                        <h4 className="font-bold">عذراً، فشل تحميل البيانات</h4>
                        <p className="text-xs font-sans max-w-md leading-relaxed">{errorSurahs}</p>
                        <button
                          onClick={() => window.location.reload()}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-sans font-bold flex items-center gap-1.5 shadow"
                        >
                          <RefreshCw size={12} />
                          <span>إعادة المحاولة</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {surahs.map((surah) => (
                          <SurahCard
                            key={surah.number}
                            surah={surah}
                            onClick={() => {
                              readerOrigin.current = "surahs";
                              loadReader("surah", surah.number);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "juz" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNum) => (
                      <motion.div
                        key={juzNum}
                        onClick={() => {
                          readerOrigin.current = "juz";
                          loadReader("juz", juzNum);
                        }}
                        className="relative overflow-hidden bg-white dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 group flex items-center gap-4 justify-start text-right"
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
                        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center border border-amber-100 dark:border-amber-900/30 font-sans shadow-inner">
                          {juzNum}
                        </div>
                        <div>
                          <h3 className="font-sans text-base font-bold text-emerald-800 dark:text-emerald-200">
                            الجزء {juzNum}
                          </h3>
                          <p className="text-xs text-gray-400 dark:text-emerald-500 mt-1 font-sans">
                            اضغط لتلاوة وتدبر آيات الجزء
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {activeTab === "bookmarks" && (
                  <BookmarkList
                    bookmarks={bookmarks}
                    onSelectBookmark={(surahNum, ayahNum) => {
                      readerOrigin.current = "bookmarks";
                      loadReader("surah", surahNum, ayahNum);
                    }}
                    onRemoveBookmark={removeBookmarkDirect}
                  />
                )}

                {activeTab === "search" && (
                  <SearchView
                    results={searchResults}
                    query={searchQuery}
                    filter={searchFilter}
                    isLoading={isSearching}
                    onSelectResult={(surahNum, ayahNum) => {
                      readerOrigin.current = "search";
                      loadReader("surah", surahNum, ayahNum, true);
                    }}
                  />
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="reader-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="bg-white dark:bg-emerald-950/80 border border-emerald-100 dark:border-emerald-900 rounded-[32px] p-6 md:p-10 shadow-sm relative overflow-hidden"
            >
              {/* Back Button */}
              <button
                onClick={handleCloseReader}
                className="absolute top-6 left-6 md:top-8 md:left-8 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-800/80 border border-slate-200 dark:border-emerald-800 text-xs text-slate-600 dark:text-emerald-200 font-bold font-sans flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <ArrowRight size={14} />
                <span>العودة للقائمة</span>
              </button>

              {/* Reader Header */}
              {isLoadingReader ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mb-4"
                  />
                  <h3 className="font-bold text-lg text-emerald-800 dark:text-amber-400">جاري تحميل الآيات الكريمة...</h3>
                  <p className="text-xs text-gray-400 dark:text-emerald-500 mt-1">يرجى الانتظار قليلاً لتنزيل الخط العثماني والتلاوات الصوتية</p>
                </div>
              ) : errorReader ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-red-600 dark:text-red-400">
                  <AlertTriangle size={48} className="mb-4" />
                  <h3 className="text-xl font-bold">خطأ في تحميل القارئ</h3>
                  <p className="text-sm font-sans mt-2 max-w-md">{errorReader}</p>
                  <button
                    onClick={() => loadReader(readerMode, activeSurahNumber)}
                    className="mt-4 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-sans font-bold shadow active:scale-95 transition-all"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-center pb-8 border-b border-emerald-100 dark:border-emerald-900/60 mb-8 mt-10 md:mt-2">
                    <h2 className="font-scheherazade text-4xl md:text-5xl font-bold text-emerald-800 dark:text-amber-300">
                      {readerTitle}
                    </h2>
                    
                    {readerMode === "surah" ? (
                      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500 dark:text-emerald-400 font-sans font-bold flex-row-reverse">
                        <span className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100/50 dark:border-emerald-800/20 px-3 py-1 rounded-full flex items-center gap-1">
                          <MapPin size={12} className="text-amber-500" />
                          <span>{readerAyahs[0]?.juz ? `الجزء ${readerAyahs[0]?.juz}` : ""}</span>
                        </span>
                        <span className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100/50 dark:border-emerald-800/20 px-3 py-1 rounded-full flex items-center gap-1">
                          <BookOpen size={12} className="text-amber-500" />
                          <span>{readerAyahs.length} آية</span>
                        </span>
                        <span className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100/50 dark:border-emerald-800/20 px-3 py-1 rounded-full flex items-center gap-1">
                          <span>الصفحة {readerAyahs[0]?.page || "-"}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-amber-600 dark:text-amber-400 font-sans font-bold">
                        <span>قراءة الجزء الكامل ({readerAyahs.length} آية)</span>
                      </div>
                    )}
                  </div>

                  {/* Basmala decoration for Surahs except Al-Fatihah and At-Tawbah */}
                  {readerMode === "surah" && activeSurahNumber !== 1 && activeSurahNumber !== 9 && (
                    <div className="text-center font-scheherazade text-2xl md:text-3xl text-emerald-900 dark:text-amber-100/90 py-4 mb-6">
                      بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </div>
                  )}

                  {/* Ayahs text container in fluid paragraph format */}
                  <div className="text-right leading-[3.2] font-scheherazade text-2xl md:text-3xl lg:text-4xl text-gray-800 dark:text-gray-100 tracking-wide select-none">
                    {readerAyahs.map((ayah, index) => {
                      // Detect Surah transitions inside Juz view
                      const isFirstAyahInJuzSurah =
                        readerMode === "juz" &&
                        ayah.surah &&
                        (index === 0 || readerAyahs[index - 1]?.surah?.number !== ayah.surah.number);

                      const isCurrentPlaying = index === currentAyahIndex;
                      const isBookmarked = bookmarks.some(
                        (b) => b.surahNumber === (ayah.surah?.number || activeSurahNumber) && b.ayahNumber === ayah.numberInSurah
                      );

                      return (
                        <span key={ayah.number} className="inline">
                          {isFirstAyahInJuzSurah && (
                            <div className="w-full block my-8 py-4 border-y border-dashed border-amber-200/50 dark:border-amber-900/30 text-center text-lg md:text-xl font-bold text-amber-600 dark:text-amber-400 font-sans flex items-center justify-center gap-2">
                              <span>سُورَةُ {ayah.surah?.name}</span>
                              <span className="text-xs bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full font-sans">
                                {ayah.surah?.numberOfAyahs} آية
                              </span>
                            </div>
                          )}

                          <span
                            id={`ayah-node-${index}`}
                            onClick={() => {
                              setCurrentAyahIndex(index);
                              setIsPlaying(true);
                              // Record last read position on manual click
                              setLastRead({
                                surahNumber: ayah.surah?.number || activeSurahNumber,
                                surahName: ayah.surah?.name || readerTitle,
                                ayahNumber: ayah.numberInSurah,
                                text: ayah.text,
                                timestamp: new Date().toISOString()
                              });
                            }}
                            className={`inline relative px-1 py-1 rounded-xl cursor-pointer transition-all duration-300 ${
                              isCurrentPlaying
                                ? "bg-amber-100/60 dark:bg-amber-500/25 text-emerald-950 dark:text-amber-100 font-bold shadow-sm ring-1 ring-amber-300 dark:ring-amber-500/40"
                                : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            }`}
                          >
                            <span>{ayah.text}</span>
                            
                            {/* Unified End of Ayah circular badge */}
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-emerald-700/40 dark:border-amber-500/40 bg-emerald-50/20 dark:bg-emerald-950 text-xs font-bold font-sans text-emerald-800 dark:text-amber-400 mx-2 select-none align-middle relative group/badge">
                              {ayah.numberInSurah}
                              
                              {/* Hover action toolbar */}
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-emerald-900 dark:bg-emerald-950 text-white border border-emerald-700/40 text-[10px] rounded-xl py-1 px-2.5 flex items-center gap-2 shadow-lg scale-0 group-hover/badge:scale-100 transition-all origin-bottom pointer-events-auto z-10 font-sans whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleBookmark(
                                      ayah,
                                      ayah.surah?.number || activeSurahNumber,
                                      ayah.surah?.name || readerTitle
                                    );
                                  }}
                                  className="hover:text-amber-400 transition-colors flex items-center gap-0.5"
                                >
                                  <Bookmark size={10} className={isBookmarked ? "text-amber-400 fill-amber-400" : ""} />
                                  <span>{isBookmarked ? "محفوظة" : "حفظ"}</span>
                                </button>
                                <span className="w-px h-2 bg-emerald-700" />
                                <span>انقر لتشغيل التلاوة</span>
                              </span>
                            </span>
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Collapsible Tafseer Panel */}
                  <div className="mt-8 border-t border-emerald-100 dark:border-emerald-900/60 pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <button
                        type="button"
                        onClick={() => setShowTafseerPanel(!showTafseerPanel)}
                        className="flex items-center gap-2 text-emerald-800 dark:text-amber-400 font-bold hover:opacity-85 transition-all cursor-pointer text-right"
                      >
                        <BookOpen size={18} />
                        <span className="font-sans text-sm">
                          {showTafseerPanel ? "إخفاء تفسير الآية الكريمة" : "إظهار تفسير الآية الكريمة"}
                        </span>
                      </button>

                      {showTafseerPanel && (
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="text-xs text-gray-500 dark:text-emerald-400 font-sans font-medium">كتاب التفسير:</span>
                          <select
                            value={selectedTafseerBook}
                            onChange={(e) => setSelectedTafseerBook(parseInt(e.target.value))}
                            className="text-xs bg-slate-50 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-amber-500 cursor-pointer shadow-sm font-sans font-bold"
                          >
                            <option value={1}>التفسير الميسر</option>
                            <option value={3}>تفسير السعدي</option>
                            <option value={2}>تفسير الجلالين</option>
                            <option value={4}>تفسير ابن كثير</option>
                            <option value={5}>تفسير القرطبي</option>
                            <option value={7}>تفسير الطبري</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {showTafseerPanel && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-amber-50/40 dark:bg-emerald-900/10 border border-amber-100/50 dark:border-emerald-800/30 rounded-2xl p-5 relative mb-4">
                            {/* Header indicating active ayah details */}
                            <div className="flex items-center justify-between mb-3 border-b border-dashed border-amber-200/40 dark:border-emerald-800/20 pb-2 flex-row-reverse">
                              <span className="text-xs font-sans text-amber-800 dark:text-amber-400 font-bold">
                                تفسير الآية {currentAyahObj?.numberInSurah} من {currentAyahObj?.surah?.name || readerTitle}
                              </span>
                              <span className="text-[10px] font-sans text-gray-400 dark:text-emerald-500">
                                المصدر: تفسير دوت كوم
                              </span>
                            </div>

                            {isLoadingTafseer ? (
                              <div className="flex items-center gap-2 justify-center py-6 text-xs text-emerald-700 dark:text-amber-400 font-sans">
                                <RefreshCw size={14} className="animate-spin" />
                                <span>جاري تحميل التفسير...</span>
                              </div>
                            ) : (
                              <p className="font-sans text-sm md:text-base text-gray-700 dark:text-gray-200 leading-relaxed text-right font-medium">
                                {tafseerText}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Floating Footer Audio Player Panel */}
                  <div className="sticky bottom-0 left-0 right-0 pt-10 z-30">
                    <AudioPlayer
                      audioUrl={currentAyahObj?.audio}
                      ayahText={currentAyahObj?.text}
                      surahName={currentAyahObj?.surah?.name || readerTitle}
                      ayahNumber={currentAyahObj?.numberInSurah}
                      onNext={() => {
                        if (currentAyahIndex < readerAyahs.length - 1) {
                          setCurrentAyahIndex((prev) => prev + 1);
                        }
                      }}
                      onPrevious={() => {
                        if (currentAyahIndex > 0) {
                          setCurrentAyahIndex((prev) => prev - 1);
                        }
                      }}
                      hasNext={currentAyahIndex < readerAyahs.length - 1}
                      hasPrevious={currentAyahIndex > 0}
                      currentReciter={reciter}
                      onReciterChange={changeReciter}
                      isPlaying={isPlaying}
                      setIsPlaying={setIsPlaying}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
