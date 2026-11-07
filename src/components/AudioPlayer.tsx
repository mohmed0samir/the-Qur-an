/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Loader2, Pause, Play, RotateCcw, SkipBack, SkipForward, SlidersHorizontal } from "lucide-react";
import { RECITERS } from "../lib/reciters";
import { STORAGE_KEYS, readBoolean, readNumber, writeString } from "../lib/storage";
import { toArabicIndic } from "../lib/arabic";

export { RECITERS };

const SPEEDS = [0.75, 1, 1.25, 1.5];

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AudioPlayerProps {
  /** Candidate URLs (primary first) for the active ayah; empty while unavailable. */
  sources: string[];
  nextSource?: string;
  audioStatus: "loading" | "ready" | "error";
  audioMessage?: string;
  onRetryAudio: () => void;
  title: string;
  subtitle: string;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  reciterId: string;
  onReciterChange: (id: string) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  extraControls?: ReactNode;
}

export function AudioPlayer(props: AudioPlayerProps) {
  const {
    sources, nextSource, audioStatus, audioMessage, onRetryAudio, title, subtitle,
    hasNext, hasPrevious, onNext, onPrevious, reciterId, onReciterChange,
    isPlaying, setIsPlaying, extraControls
  } = props;

  const audioRef = useRef<HTMLAudioElement>(null);
  const switching = useRef(false);
  const sourcesKey = sources.join("|");
  const [fallback, setFallback] = useState({ key: "", index: 0 });
  const [failedKey, setFailedKey] = useState("");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [open, setOpen] = useState(false);
  const [autoNext, setAutoNext] = useState(() => readBoolean(STORAGE_KEYS.autoPlayNext, true));
  const [speed, setSpeed] = useState(() => readNumber(STORAGE_KEYS.speed, 1, 0.5, 2));
  const [volume, setVolume] = useState(() => readNumber(STORAGE_KEYS.volume, 1, 0, 1));
  const [volumeAdjustable, setVolumeAdjustable] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const index = fallback.key === sourcesKey ? fallback.index : 0;
  const src = sources[index];
  const failed = failedKey === sourcesKey && sourcesKey !== "";

  // Latest callbacks for use inside media events (avoids stale closures).
  const cb = useRef({ onNext, autoNext, hasNext });
  cb.current = { onNext, autoNext, hasNext };

  // iOS Safari ignores programmatic volume; hide the slider there.
  useEffect(() => {
    const a = new Audio();
    a.volume = 0.5;
    setVolumeAdjustable(a.volume === 0.5);
  }, []);

  // Apply the source.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!src) {
      el.pause();
      if (el.getAttribute("src")) {
        el.removeAttribute("src");
        el.load();
      }
      setTime(0);
      setDuration(0);
      return;
    }
    if (el.getAttribute("src") !== src) {
      switching.current = true;
      el.src = src;
      el.load();
    }
  }, [src]);

  // Playback intent. AbortError (source changed mid-request) is expected and ignored.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src || failed) return;
    if (isPlaying) {
      const p = el.play();
      if (p) {
        p.catch((err: unknown) => {
          const name = err instanceof DOMException ? err.name : "";
          if (name === "AbortError") return;
          setIsPlaying(false);
        });
      }
    } else {
      el.pause();
    }
  }, [isPlaying, src, failed, setIsPlaying]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.defaultPlaybackRate = speed;
    el.playbackRate = speed;
    el.volume = volume;
  }, [speed, volume, src]);

  // Warm up the next ayah so auto-advance has no gap.
  useEffect(() => {
    if (!autoNext || !nextSource) return;
    let pre: HTMLAudioElement | null = null;
    const t = window.setTimeout(() => {
      pre = new Audio();
      pre.preload = "auto";
      pre.src = nextSource;
    }, 500);
    return () => {
      window.clearTimeout(t);
      if (pre) pre.src = "";
    };
  }, [nextSource, autoNext]);

  // Lock-screen / headset controls.
  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: subtitle, album: "القرآن الكريم" });
    const set = (a: MediaSessionAction, h: (() => void) | null) => {
      try {
        navigator.mediaSession.setActionHandler(a, h);
      } catch {
        /* unsupported action */
      }
    };
    set("play", () => setIsPlaying(true));
    set("pause", () => setIsPlaying(false));
    set("nexttrack", hasNext ? onNext : null);
    set("previoustrack", hasPrevious ? onPrevious : null);
    return () => {
      (["play", "pause", "nexttrack", "previoustrack"] as MediaSessionAction[]).forEach((a) => set(a, null));
    };
  }, [title, subtitle, hasNext, hasPrevious, onNext, onPrevious, setIsPlaying]);

  // Close the settings panel on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const unavailable = !src || failed;
  const loading = audioStatus === "loading" || (!!src && buffering && isPlaying);
  const statusText = useMemo(() => {
    if (audioStatus === "error") return audioMessage || "تعذّر تحميل التلاوة";
    if (failed) return "تعذّر تشغيل هذا المقطع";
    if (audioStatus === "loading") return "جارٍ تحميل التلاوة…";
    if (loading) return "جارٍ التحميل…";
    return subtitle;
  }, [audioStatus, audioMessage, failed, loading, subtitle]);
  const isError = audioStatus === "error" || failed;

  const toggle = () => {
    if (failed) {
      setFailedKey("");
      setFallback({ key: sourcesKey, index: 0 });
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="player" ref={panelRef}>
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        onLoadStart={() => {
          setTime(0);
          setBuffering(true);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) ? d : 0);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) ? d : 0);
        }}
        onCanPlay={() => {
          switching.current = false;
          setBuffering(false);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => {
          switching.current = false;
          setBuffering(false);
          if (!isPlaying) setIsPlaying(true);
        }}
        onPause={(e) => {
          const el = e.currentTarget;
          if (!el.ended && !switching.current && !el.seeking) setIsPlaying(false);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={() => {
          const { autoNext: auto, hasNext: next, onNext: go } = cb.current;
          if (auto && next) go();
          else setIsPlaying(false);
        }}
        onError={() => {
          if (!src) return;
          if (index + 1 < sources.length) {
            setFallback({ key: sourcesKey, index: index + 1 });
          } else {
            setFailedKey(sourcesKey);
            setBuffering(false);
            setIsPlaying(false);
          }
        }}
      />

      <div className="player__seek">
        <span className="num">{fmt(time)}</span>
        <input
          type="range"
          className="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          disabled={unavailable || !duration}
          aria-label="موضع التشغيل"
          onChange={(e) => {
            const v = Number(e.target.value);
            setTime(v);
            if (audioRef.current) audioRef.current.currentTime = v;
          }}
        />
        <span className="num">{fmt(duration)}</span>
      </div>

      <div className="player__row">
        <div className="player__meta">
          <strong>{title}</strong>
          <span className={isError ? "player__status--error" : loading ? "player__status" : undefined} role="status">
            {statusText}
          </span>
        </div>

        <div className="player__transport">
          {/* RTL: "previous" sits on the right and points right, "next" on the left and points left. */}
          <button type="button" className="icon-btn" onClick={onPrevious} disabled={!hasPrevious} aria-label="الآية السابقة">
            <SkipForward size={22} aria-hidden="true" />
          </button>
          {isError ? (
            <button type="button" className="player__play" onClick={() => { onRetryAudio(); toggle(); }} aria-label="إعادة محاولة التلاوة">
              {audioStatus === "error" ? <AlertCircle size={24} aria-hidden="true" /> : <RotateCcw size={24} aria-hidden="true" />}
            </button>
          ) : (
            <button
              type="button"
              className="player__play"
              onClick={toggle}
              disabled={!src && audioStatus !== "loading"}
              aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
              aria-pressed={isPlaying}
            >
              {loading && isPlaying ? (
                <Loader2 className="spin" size={24} aria-hidden="true" />
              ) : isPlaying ? (
                <Pause size={24} aria-hidden="true" />
              ) : (
                <Play size={24} aria-hidden="true" />
              )}
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onNext} disabled={!hasNext} aria-label="الآية التالية">
            <SkipBack size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="player__extra">
          {extraControls}
          <button
            type="button"
            className="icon-btn"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="إعدادات التلاوة"
            onClick={() => setOpen((v) => !v)}
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div className="popover popover--dock" role="dialog" aria-label="إعدادات التلاوة">
          <div className="field">
            <label className="field__label" htmlFor="reciter-select">القارئ</label>
            <select id="reciter-select" className="select" value={reciterId} onChange={(e) => onReciterChange(e.target.value)}>
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field__label">سرعة التشغيل</span>
            <div className="seg" role="group" aria-label="سرعة التشغيل">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="seg__btn"
                  aria-pressed={speed === s}
                  onClick={() => {
                    setSpeed(s);
                    writeString(STORAGE_KEYS.speed, String(s));
                  }}
                >
                  <span className="num">{toArabicIndic(s).replace(".", "٫")}×</span>
                </button>
              ))}
            </div>
          </div>
          {volumeAdjustable && (
            <div className="field">
              <label className="field__label" htmlFor="volume-range">مستوى الصوت</label>
              <input
                id="volume-range"
                type="range"
                className="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  writeString(STORAGE_KEYS.volume, String(v));
                }}
              />
            </div>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={autoNext}
            className="switch"
            onClick={() => {
              setAutoNext(!autoNext);
              writeString(STORAGE_KEYS.autoPlayNext, autoNext ? "0" : "1");
            }}
          >
            <span>تشغيل الآية التالية تلقائياً</span>
            <span className="switch__track" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
