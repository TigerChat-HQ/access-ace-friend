import { useEffect, useRef, useState } from "react";
import { Settings2, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Reaction = { id: string; emoji: string; sender: string; createdAt: number };
const EMOJIS = ["🔥", "😂", "😮", "👏", "😎", "💪", "❤️", "🐯"];

export function playDraughtsSound(kind: "move" | "capture" | "win", volume = 0.65) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const notes = kind === "win" ? [523.25, 659.25, 783.99, 1046.5] : kind === "capture" ? [260, 390] : [440];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = kind === "win" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * (kind === "win" ? 0.16 : 0.045));
      gain.gain.setValueAtTime(0.0001, now + index * (kind === "win" ? 0.16 : 0.045));
      gain.gain.exponentialRampToValueAtTime((kind === "win" ? 0.11 : 0.055) * Math.max(0, Math.min(1, volume)), now + index * (kind === "win" ? 0.16 : 0.045) + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * (kind === "win" ? 0.16 : 0.045) + (kind === "win" ? 0.22 : 0.11));
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(now + index * (kind === "win" ? 0.16 : 0.045));
      oscillator.stop(now + index * (kind === "win" ? 0.16 : 0.045) + (kind === "win" ? 0.24 : 0.13));
    });
    window.setTimeout(() => { void ctx.close(); }, kind === "win" ? 1200 : 400);
  } catch { /* Audio is optional; the game remains playable without it. */ }
}


export function playReactionSound(emoji: string, volume = 0.65) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass || volume <= 0) return;
    const ctx = new AudioContextClass();
    void ctx.resume();
    const now = ctx.currentTime;
    const patterns: Record<string, number[]> = {
      "😂": [440, 330, 440, 330, 523, 392],
      "❤️": [523, 659, 784], "👏": [260, 260], "😮": [330, 494, 659],
      "🔥": [180, 260, 390], "😎": [392, 494, 587], "💪": [130, 196, 260], "🐯": [110, 145, 110],
    };
    (patterns[emoji] ?? [440, 554]).forEach((frequency, index) => {
      const start = now + index * (emoji === "😂" ? 0.105 : 0.075);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = emoji === "🐯" || emoji === "💪" ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(frequency, start);
      if (emoji === "😂") osc.frequency.exponentialRampToValueAtTime(frequency * 0.78, start + 0.075);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.075 * Math.max(0, Math.min(1, volume)), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.1);
    });
    window.setTimeout(() => { void ctx.close(); }, 1100);
  } catch { /* Audio is optional. */ }
}

export function DraughtsGameEffects({
  matchId, isWinner, isFinished, soundEnabled, onSoundEnabledChange, soundVolume, onSoundVolumeChange, reactionVolume, onReactionVolumeChange,
}: {
  matchId: string; isWinner: boolean; isFinished: boolean;
  soundEnabled: boolean; onSoundEnabledChange: (enabled: boolean) => void;
  soundVolume: number; onSoundVolumeChange: (volume: number) => void;
  reactionVolume: number; onReactionVolumeChange: (volume: number) => void;
}) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const winnerSoundPlayed = useRef(false);

  useEffect(() => {
    const channel = supabase.channel(`draughts-reactions:${matchId}`);
    channel.on("broadcast", { event: "reaction" }, ({ payload }) => {
      const incoming = payload as Reaction;
      if (!incoming?.emoji || !incoming?.id) return;
      setReactions((current) => [...current.slice(-5), incoming]);
      if (soundEnabled) playReactionSound(incoming.emoji, reactionVolume);
      window.setTimeout(() => setReactions((current) => current.filter((item) => item.id !== incoming.id)), 3200);
    }).subscribe();
    channelRef.current = channel;
    return () => { channelRef.current = null; void supabase.removeChannel(channel); };
  }, [matchId, soundEnabled, reactionVolume]);

  useEffect(() => {
    if (!isFinished || !isWinner || !soundEnabled || winnerSoundPlayed.current) return;
    winnerSoundPlayed.current = true;
    playDraughtsSound("win", soundVolume);
  }, [isFinished, isWinner, soundEnabled, soundVolume]);

  const sendReaction = async (emoji: string) => {
    const reaction: Reaction = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, emoji, sender: "player", createdAt: Date.now() };
    setReactions((current) => [...current.slice(-5), reaction]);
    if (soundEnabled) playReactionSound(emoji, reactionVolume);
    window.setTimeout(() => setReactions((current) => current.filter((item) => item.id !== reaction.id)), 3200);
    await channelRef.current?.send({ type: "broadcast", event: "reaction", payload: reaction });
  };

  return (
    <>
      <div className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none" aria-live="polite">
        {reactions.map((reaction) => <div key={reaction.id} className="draught-reaction-pop rounded-full border border-white/20 bg-black/75 px-4 py-2 text-2xl shadow-2xl backdrop-blur-xl">{reaction.emoji}</div>)}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/50 bg-card/70 px-3 py-2">
        <div className="flex items-center gap-1.5" aria-label="Live reactions">
          {EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => void sendReaction(emoji)} disabled={isFinished} aria-label={`Send ${emoji} reaction`} className="rounded-lg p-2 text-lg transition hover:-translate-y-1 hover:scale-110 hover:bg-primary/15 active:scale-90 disabled:opacity-40">{emoji}</button>)}
        </div>
        <div className="relative shrink-0">
          <button type="button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} aria-label="Audio settings" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-foreground hover:bg-muted">
            <Settings2 className="h-4 w-4" /> Settings
          </button>
          {settingsOpen && (
            <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Audio settings</p>
                <button type="button" onClick={() => onSoundEnabledChange(!soundEnabled)} className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
                  {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
                  {soundEnabled ? "On" : "Off"}
                </button>
              </div>
              <label className="mb-1 flex justify-between text-xs"><span>Game volume</span><span>{Math.round(soundVolume * 100)}%</span></label>
              <input aria-label="Game volume" type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={(e) => onSoundVolumeChange(Number(e.target.value))} className="mb-3 w-full accent-primary" />
              <label className="mb-1 flex justify-between text-xs"><span>Emoji volume</span><span>{Math.round(reactionVolume * 100)}%</span></label>
              <input aria-label="Emoji volume" type="range" min="0" max="1" step="0.05" value={reactionVolume} onChange={(e) => onReactionVolumeChange(Number(e.target.value))} className="w-full accent-primary" />
              <p className="mt-2 text-[10px] text-muted-foreground">Emoji reactions have their own sounds, including a laugh for 😂.</p>
            </div>
          )}
        </div>
      </div>
      {isFinished && isWinner && (
        <div className="draught-win-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/85 p-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Victory celebration">
          <div className="draught-win-confetti" aria-hidden="true">🎉 ✨ 🏆 🎊 ⭐ 🎉</div>
          <div className="draught-win-card relative w-full max-w-sm rounded-[2rem] border border-amber-300/50 bg-gradient-to-br from-amber-200 via-yellow-500 to-orange-600 p-1 text-center shadow-[0_0_90px_rgba(245,158,11,.45)]">
            <div className="rounded-[1.8rem] bg-slate-950/95 px-6 py-8 text-white">
              <div className="draught-tiger-celebrate mx-auto mb-3 text-7xl" role="img" aria-label="Tiger celebrating with trophy">🐯🏆</div>
              <p className="text-xs font-black uppercase tracking-[.35em] text-amber-300">Tiger Champion</p>
              <h2 className="mt-2 text-3xl font-black">YOU WIN!</h2>
              <p className="mt-2 text-sm text-slate-300">Amazing moves! The Tiger celebrates your victory!</p>
              <div className="mt-4 text-2xl" aria-hidden="true">🎊 🥇 🎉</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
