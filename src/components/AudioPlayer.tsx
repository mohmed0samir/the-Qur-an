/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2, Settings, RefreshCw } from "lucide-react";
import { Reciter } from "../types";

export const RECITERS: Reciter[] = [
  { id: "ar.alafasy", name: "مشاري بن راشد العفاسي", englishName: "Mishary Alafasy" },
  { id: "ar.abdurrahmaansudais", name: "عبد الرحمن السديس", englishName: "Abdurrahman Al-Sudais" },
  { id: "ar.husary", name: "محمود خليل الحصري", englishName: "Mahmoud Al-Husary" },
  { id: "ar.minshawi", name: "محمد صديق المنشاوي", englishName: "Muhammad Al-Minshawi" },
  { id: "ar.ahmedajamy", name: "أحمد بن علي العجمي", englishName: "Ahmed Al-Ajamy" }
];

interface AudioPlayerProps {
  audioUrl: string | undefined;
  ayahText: string;
  surahName: string;
  ayahNumber: number;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  currentReciter: string;
  onReciterChange: (reciterId: string) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  ayahText,
  surahName,
  ayahNumber,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  currentReciter,
  onReciterChange,
  isPlaying,
  setIsPlaying
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Sync isPlaying with native audio element
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, audioUrl]);

  // Sync speed and volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      audioRef.current.volume = volume;
    }
  }, [speed, volume, audioUrl]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    if (audioRef.current.duration) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (autoPlayNext && hasNext) {
      // Delay slightly before playing next
      setTimeout(() => {
        onNext();
        // Give time for state update to load new audio, then play
        setTimeout(() => {
          setIsPlaying(true);
        }, 150);
      }, 600);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !duration) return;
    const newPercentage = parseFloat(e.target.value);
    const newTime = (newPercentage / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(newPercentage);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800/40 rounded-3xl p-5 shadow-sm mt-6 relative overflow-hidden">
      {/* Hidden native audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      {/* Header / Info bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-100/60 dark:border-emerald-800/20 pb-4 mb-4">
        <div className="text-right">
          <div className="flex items-center gap-2 justify-start md:justify-end flex-row-reverse">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/50 dark:border-amber-900/40 px-2 py-0.5 rounded-md">
              الآية {ayahNumber}
            </span>
            <h4 className="font-scheherazade text-xl font-bold text-emerald-900 dark:text-amber-100">
              {surahName}
            </h4>
          </div>
          <p className="text-sm text-gray-500 dark:text-emerald-300/70 line-clamp-1 mt-1 font-scheherazade">
            {ayahText || "اختر آية للبدء في الاستماع"}
          </p>
        </div>

        {/* Reciter Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 dark:text-emerald-400 font-sans">القارئ:</label>
          <select
            value={currentReciter}
            onChange={(e) => onReciterChange(e.target.value)}
            className="text-xs bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-amber-500 cursor-pointer shadow-sm font-sans"
          >
            {RECITERS.map((reciter) => (
              <option key={reciter.id} value={reciter.id}>
                {reciter.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress slider */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-mono text-gray-400 dark:text-emerald-400/60">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleProgressChange}
          className="flex-1 h-1 bg-emerald-200 dark:bg-emerald-800/40 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-amber-400"
        />
        <span className="text-xs font-mono text-gray-400 dark:text-emerald-400/60">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls panel */}
      <div className="flex items-center justify-between">
        {/* Left features (Speed, Autoplay) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-all border ${
              showSettings
                ? "bg-emerald-100 dark:bg-emerald-800 border-emerald-300"
                : "hover:bg-emerald-100/50 dark:hover:bg-emerald-800/30 border-transparent text-emerald-700 dark:text-emerald-300"
            }`}
            title="الإعدادات"
          >
            <Settings size={18} />
          </button>

          <button
            onClick={() => setAutoPlayNext(!autoPlayNext)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all border ${
              autoPlayNext
                ? "bg-emerald-100 dark:bg-emerald-800/40 border-emerald-200 text-emerald-800 dark:text-amber-400"
                : "hover:bg-emerald-100/50 dark:hover:bg-emerald-800/30 border-transparent text-gray-400 dark:text-emerald-400/60"
            }`}
            title="التشغيل التلقائي للآية التالية"
          >
            <RefreshCw size={14} className={autoPlayNext ? "animate-spin-slow" : ""} />
            <span className="font-sans hidden sm:inline">تلقائي</span>
          </button>
        </div>

        {/* Center player controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40 hover:bg-emerald-100/60 dark:hover:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200"
            title="الآية السابقة"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={togglePlay}
            disabled={!audioUrl}
            className="w-14 h-14 rounded-full bg-emerald-600 dark:bg-amber-500 text-white dark:text-emerald-950 flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="mr-0.5" />}
          </button>

          <button
            onClick={onNext}
            disabled={!hasNext}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40 hover:bg-emerald-100/60 dark:hover:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200"
            title="الآية التالية"
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Right volume controls */}
        <div className="flex items-center gap-2">
          <Volume2 size={16} className="text-emerald-700 dark:text-emerald-300" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1 bg-emerald-200 dark:bg-emerald-800/40 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-amber-400"
            title="مستوى الصوت"
          />
        </div>
      </div>

      {/* Expanded settings drawer */}
      {showSettings && (
        <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-800/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-emerald-400">سرعة القراءة:</span>
            {[0.75, 1, 1.25, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-all border ${
                  speed === s
                    ? "bg-emerald-600 dark:bg-amber-500 text-white dark:text-emerald-950 border-emerald-600 dark:border-amber-500"
                    : "bg-white dark:bg-emerald-950 hover:bg-emerald-50 dark:hover:bg-emerald-900 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-emerald-500">
            * اضغط على الكلمات لتشغيل الآية المقابلة فورياً.
          </div>
        </div>
      )}
    </div>
  );
};
