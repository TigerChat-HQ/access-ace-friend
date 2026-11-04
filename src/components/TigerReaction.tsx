import { useEffect, useState } from "react";
import tiger from "@/assets/tiger-reaction.png";

interface TigerBurst {
  id: string;
  left: number;
  rotation: number;
}

interface TigerReactionLayerProps {
  /** Increment to trigger a new burst */
  trigger: number;
}

const playRoar = () => {
  try {
    const ctx = new (window.AudioContext || (window as never).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch (error) { console.debug("Non-critical operation failed", error); }
};

export const TigerReactionLayer = ({ trigger }: TigerReactionLayerProps) => {
  const [bursts, setBursts] = useState<TigerBurst[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const id = `${Date.now()}-${Math.random()}`;
    const b: TigerBurst = {
      id,
      left: 20 + Math.random() * 60,
      rotation: -20 + Math.random() * 40,
    };
    setBursts((bs) => [...bs, b]);
    playRoar();
    setTimeout(() => setBursts((bs) => bs.filter((x) => x.id !== id)), 2400);
  }, [trigger]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
      {bursts.map((b) => (
        <img
          key={b.id}
          src={tiger}
          alt=""
          className="absolute bottom-20 w-32 h-32 animate-tiger-pop"
          style={{
            left: `${b.left}%`,
            transform: `rotate(${b.rotation}deg)`,
            filter: "drop-shadow(0 0 16px hsl(160 100% 45% / 0.7))",
          }}
        />
      ))}
    </div>
  );
};
