import { useEffect, useRef, useState } from "react";

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


// Real human recording, released into the public domain by its author (ezwa).
const LAUGH_AUDIO_URL = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Laughter.ogg";
// Tiger roar recording by Bilberryerer, CC BY-SA 4.0 (Wikimedia Commons).
const TIGER_ROAR_AUDIO_URL = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Tiger_Mad.ogg";

export function playReactionSound(emoji: string, volume = 0.65) {
  if (volume <= 0 || emoji !== "😂") return;
  const audio = new Audio(LAUGH_AUDIO_URL);
  audio.volume = Math.max(0, Math.min(1, volume));
  void audio.play().catch(() => {});
}

export function DraughtsGameEffects({
  matchId, isWinner, isLoser, isFinished, soundEnabled, soundVolume, reactionVolume,
}: {
  matchId: string; isWinner: boolean; isLoser: boolean; isFinished: boolean;
  soundEnabled: boolean; soundVolume: number; reactionVolume: number;
}) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
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
    const roar = new Audio(TIGER_ROAR_AUDIO_URL);
    roar.volume = Math.max(0, Math.min(1, soundVolume));
    void roar.play().catch(() => {});
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
      <div className="flex items-center justify-center gap-2 border-t border-border/50 bg-card/70 px-3 py-2">
        <div className="flex items-center gap-1.5" aria-label="Live reactions">
          {EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => void sendReaction(emoji)} disabled={isFinished} aria-label={`Send ${emoji} reaction`} className="rounded-lg p-2 text-lg transition hover:-translate-y-1 hover:scale-110 hover:bg-primary/15 active:scale-90 disabled:opacity-40">{emoji}</button>)}
        </div>

      </div>
      {isFinished && (isWinner || isLoser) && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-5 backdrop-blur-md ${isWinner ? "draught-win-overlay bg-slate-950/85" : "bg-slate-950/90"}`} role="dialog" aria-modal="true" aria-label={isWinner ? "Victory celebration" : "Defeat"}>
          {isWinner && <div className="draught-win-confetti" aria-hidden="true">🎉 ✨ 🏆 🎊 ⭐ 🎉</div>}
          <div className={`relative w-full max-w-sm rounded-[2rem] border p-1 text-center shadow-2xl ${isWinner ? "draught-win-card border-amber-300/50 bg-gradient-to-br from-amber-200 via-yellow-500 to-orange-600 shadow-[0_0_90px_rgba(245,158,11,.45)]" : "border-slate-400/30 bg-gradient-to-br from-slate-400 via-slate-600 to-slate-800"}`}>
            <div className="rounded-[1.8rem] bg-slate-950/95 px-6 py-8 text-white">
              <div className={`mx-auto mb-3 text-7xl ${isWinner ? "draught-tiger-celebrate" : "draught-tiger-sad"}`} role="img" aria-label={isWinner ? "Tiger celebrating with trophy" : "Sad tiger after losing"}>{isWinner ? "🐯🏆" : "🐯😿"}</div>
              <p className={`text-xs font-black uppercase tracking-[.35em] ${isWinner ? "text-amber-300" : "text-slate-300"}`}>{isWinner ? "Tiger Champion" : "Tiger Comeback"}</p>
              <h2 className="mt-2 text-3xl font-black">{isWinner ? "YOU WIN!" : "YOU LOST"}</h2>
              <p className="mt-2 text-sm text-slate-300">{isWinner ? "Amazing moves! The Tiger celebrates your victory!" : "The Tiger is sad, but every champion gets back up. Try again!"}</p>
              <div className="mt-4 text-2xl" aria-hidden="true">{isWinner ? "🎊 🥇 🎉" : "💔 🌧️ 🐾"}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
