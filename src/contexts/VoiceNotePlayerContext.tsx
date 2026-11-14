import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";

export interface VoiceNoteItem {
  id: string;
  src: string;
  label: string;
}

interface VoiceNotePlayerValue {
  activeVoiceNoteId: string | null;
  isVoiceNotePlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  registerVoiceNote: (item: VoiceNoteItem) => () => void;
  playVoiceNote: (id: string) => void;
  togglePlayback: () => void;
  seekTo: (seconds: number) => void;
  cyclePlaybackRate: () => void;
}

const VoiceNotePlayerContext = createContext<VoiceNotePlayerValue | null>(null);

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
};

export const VoiceNotePlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const registryRef = useRef(new Map<string, VoiceNoteItem>());
  const queueRef = useRef<VoiceNoteItem[]>([]);
  const [active, setActive] = useState<VoiceNoteItem | null>(null);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const registerVoiceNote = useCallback((item: VoiceNoteItem) => {
    registryRef.current.set(item.id, item);
    return () => {
      if (registryRef.current.get(item.id)?.src === item.src) registryRef.current.delete(item.id);
    };
  }, []);

  const playVoiceNote = useCallback((id: string) => {
    const item = registryRef.current.get(id);
    if (!item) return;
    const items = Array.from(registryRef.current.values());
    if (!items.some((entry) => entry.id === id)) items.push(item);
    queueRef.current = items;
    setQueueIndex(Math.max(0, items.findIndex((entry) => entry.id === id)));
    setCurrentTime(0);
    setDuration(0);
    setActive(item);
    const audio = audioRef.current;
    if (audio) {
      audio.src = item.src;
      audio.currentTime = 0;
      audio.playbackRate = playbackRate;
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !active) return;
    if (audio.paused) void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    else { audio.pause(); setIsPlaying(false); }
  }, [active]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(audio.duration) ? audio.duration : seconds));
    setCurrentTime(audio.currentTime);
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((current) => {
      const next = current === 1 ? 1.5 : current === 1.5 ? 2 : 1;
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const handleEnded = useCallback(() => {
    const nextIndex = queueIndex + 1;
    const next = queueRef.current[nextIndex];
    if (next) {
      setQueueIndex(nextIndex);
      setCurrentTime(0);
      setDuration(0);
      setActive(next);
      const audio = audioRef.current;
      if (audio) {
        audio.src = next.src;
        audio.currentTime = 0;
        audio.playbackRate = playbackRate;
        void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      } else {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [queueIndex, playbackRate]);

  const value = useMemo<VoiceNotePlayerValue>(() => ({
    activeVoiceNoteId: active?.id ?? null,
    isVoiceNotePlaying: isPlaying,
    currentTime,
    duration,
    playbackRate,
    registerVoiceNote,
    playVoiceNote,
    togglePlayback,
    seekTo,
    cyclePlaybackRate,
  }), [active?.id, isPlaying, currentTime, duration, playbackRate, registerVoiceNote, playVoiceNote, togglePlayback, seekTo, cyclePlaybackRate]);

  return (
    <VoiceNotePlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          setCurrentTime(time);
          if (active) {
            try { localStorage.setItem(`tigerchat:voice-position:${active.id}`, String(time)); } catch { /* storage may be unavailable */ }
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        className="hidden"
      />
      {active && (
        <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[90] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-3 py-2 shadow-2xl backdrop-blur-xl lg:bottom-4">
          <button type="button" onClick={togglePlayback} aria-label={isPlaying ? "Pause voice note" : "Play voice note"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">Voice note · {active.label}</p>
            <input aria-label="Seek current voice note" type="range" min={0} max={duration || 0} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(event) => seekTo(Number(event.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          </div>
          <button type="button" onClick={cyclePlaybackRate} className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">{playbackRate}×</button>
          <button type="button" onClick={() => { audioRef.current?.pause(); setActive(null); setIsPlaying(false); }} aria-label="Close mini player" className="rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      )}
    </VoiceNotePlayerContext.Provider>
  );
};

export const useVoiceNotePlayer = () => {
  const value = useContext(VoiceNotePlayerContext);
  if (!value) throw new Error("useVoiceNotePlayer must be used within VoiceNotePlayerProvider");
  return value;
};
