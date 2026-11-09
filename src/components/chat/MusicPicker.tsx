import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Music, Play, Pause, Check, X } from "lucide-react";
import { FREE_TRACKS, FreeTrack } from "@/data/freeMusic";

interface MusicPickerProps {
  trigger?: React.ReactNode;
  value?: { url: string; title: string; start: number; end: number } | null;
  onChange: (v: { url: string; title: string; start: number; end: number } | null) => void;
  /** Max clip length (seconds). Default 15. */
  maxClip?: number;
}

const MAX_DEFAULT = 15;

export const MusicPicker = ({ trigger, value, onChange, maxClip = MAX_DEFAULT }: MusicPickerProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FreeTrack | null>(null);
  const [range, setRange] = useState<[number, number]>([0, maxClip]);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [moodFilter, setMoodFilter] = useState("All");
  const [audioError, setAudioError] = useState(false);
  const [trackDuration, setTrackDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!selected) return;
    setTrackDuration(0);
    setRange([0, Math.min(maxClip, selected.duration)]);
    setPos(0);
    setAudioError(false);
    setPlaying(false);
  }, [selected, maxClip]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tick = () => {
      setPos(a.currentTime);
      if (a.currentTime >= range[1]) {
        a.pause();
        a.currentTime = range[0];
        setPlaying(false);
      }
    };
    a.addEventListener("timeupdate", tick);
    return () => a.removeEventListener("timeupdate", tick);
  }, [range]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      if (a.currentTime < range[0] || a.currentTime >= range[1]) a.currentTime = range[0];
      a.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setAudioError(true); });
    }
  };

  const confirm = () => {
    if (!selected) return;
    onChange({ url: selected.url, title: `${selected.title} — ${selected.artist}`, start: range[0], end: range[1] });
    setOpen(false);
    audioRef.current?.pause();
    setPlaying(false);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { audioRef.current?.pause(); setPlaying(false); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg hover:bg-surface-hover transition-colors flex-1 text-left">
            <Music className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground truncate flex-1">
              {value ? value.title : "Add background music"}
            </span>
            {value && (
              <X
                className="w-4 h-4 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null); }}
              />
            )}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" /> Pick a track
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {["All", "Happy", "Sad", "Love", "Motivation"].map((mood) => (
              <button key={mood} type="button" onClick={() => setMoodFilter(mood)} className={`rounded-full px-3 py-1 text-xs ${moodFilter === mood ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}>{mood === "Love" ? "Love / Romantic" : mood}</button>
            ))}
          </div>
          <div className="max-h-56 overflow-y-auto scrollbar-thin space-y-1 -mx-2 px-2">
            {FREE_TRACKS.filter((track) => moodFilter === "All" || track.mood === moodFilter).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-lg transition-colors text-left ${
                  selected?.id === t.id ? "bg-primary/15 ring-1 ring-primary/40" : "bg-surface hover:bg-surface-hover"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{t.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.artist} · {t.mood} · {t.kind}</p>
                </div>
                {selected?.id === t.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>

          {selected && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <audio ref={audioRef} src={selected.url} preload="metadata" onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; if (Number.isFinite(duration) && duration > 0) { setTrackDuration(duration); setRange([0, Math.min(maxClip, duration)]); } }} onError={() => { setAudioError(true); setPlaying(false); }} />
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-full bg-primary text-primary-foreground"
                  type="button"
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <div className="flex-1 text-xs text-muted-foreground">
                  Trim · {fmt(range[0])} → {fmt(range[1])} ({fmt(range[1] - range[0])})
                </div>
              </div>
              <Slider
                min={0}
                max={trackDuration || selected.duration}
                step={0.5}
                value={range}
                onValueChange={(v) => {
                  const [start, end] = v as [number, number];
                  const adjustedEnd = end - start > maxClip ? start + maxClip : end;
                  setRange([start, adjustedEnd]);
                }}
              />
              <p className="text-[10px] text-muted-foreground">Max clip: {maxClip}s</p>
              {audioError && <p role="alert" className="text-xs text-destructive">This track could not be loaded. Try another track or choose audio from your phone.</p>}
              <Button onClick={confirm} className="w-full neon-glow">Use this clip</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
