import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Expand, Gamepad2, LoaderCircle, RotateCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function TigerCity3D() {
  const nav = useNavigate();
  const { user } = useAuth();
  const gameFrame = useRef<HTMLIFrameElement>(null);
  const [username, setUsername] = useState("Player");
  const [profileLoading, setProfileLoading] = useState(true);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [gameError, setGameError] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!user) { setProfileLoading(false); return; }
      const { data } = await supabase.from("profiles").select("username, display_name").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      setUsername(data?.username || data?.display_name || user.user_metadata?.username || user.email?.split("@")[0] || "Player");
      setProfileLoading(false);
    };
    void loadProfile();
    return () => { active = false; };
  }, [user]);

  const enterFullscreen = async () => {
    const frame = gameFrame.current;
    if (!frame) return;
    try {
      if (frame.requestFullscreen) await frame.requestFullscreen();
    } catch {
      setGameError(true);
    }
  };

  return (
    <main className="flex min-h-full flex-col overflow-y-auto bg-[#07101b] pb-24 text-white">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#07101b]/95 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => nav("/games")} aria-label="Back to Games" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.25em] text-amber-300">TIGERCHAT GAMES</p><h1 className="truncate text-base font-black">TIGER CITY 3D</h1></div>
        <button onClick={enterFullscreen} className="flex h-10 items-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 text-xs font-bold text-amber-100" aria-label="Play fullscreen"><Expand className="h-4 w-4" /><span className="hidden sm:inline">Fullscreen</span></button>
      </header>

      <section className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <Gamepad2 className="h-5 w-5 shrink-0 text-amber-200" />
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TigerChat player</p><p className="truncate text-xs font-black">{profileLoading ? "Inapakia akaunti..." : "@" + username}</p></div>
          <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[9px] font-bold text-emerald-200">SIGNED IN</span>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-amber-200/20 bg-black shadow-2xl">
          {!gameLoaded && !gameError && <div className="absolute inset-0 z-10 flex min-h-[55vh] flex-col items-center justify-center gap-3 bg-[#081321] text-center"><LoaderCircle className="h-8 w-8 animate-spin text-amber-300" /><p className="text-sm font-bold">Inafungua TIGER CITY 3D...</p><p className="max-w-xs px-4 text-xs text-slate-400">Mchezo unapakiwa ndani ya TigerChat.</p></div>}
          {gameError && <div className="absolute inset-0 z-20 flex min-h-[55vh] flex-col items-center justify-center gap-3 bg-[#081321] px-6 text-center"><p className="text-sm font-bold text-amber-200">Game haikuweza kufunguka.</p><p className="text-xs text-slate-400">Jaribu tena baada ya kuhakikisha toleo la Web limejengwa na kuchapishwa.</p><button onClick={() => { setGameError(false); setGameLoaded(false); if (gameFrame.current) gameFrame.current.src = "/games/tiger-city-3d/index.html"; }} className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-black text-slate-950">Jaribu tena</button></div>}
          <iframe
            ref={gameFrame}
            title="TIGER CITY 3D game"
            src="/games/tiger-city-3d/index.html"
            className="block h-[72vh] min-h-[460px] w-full border-0 sm:h-[78vh]"
            allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope"
            allowFullScreen
            onLoad={() => { setGameLoaded(true); setGameError(false); }}
            onError={() => { setGameError(true); setGameLoaded(false); }}
          />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-200/10 bg-sky-200/[0.05] p-3 text-xs leading-5 text-slate-300">
          <RotateCw className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
          <p>Geuza simu iwe mlalo kwa eneo kubwa la kuchezea. Hii ni prototype ya mwanzo: jiji la 3D, ujenzi wa majengo, rasilimali na kampeni ya kuteka maeneo. Michoro ya kiwango cha ultra-realistic na vita vya muda halisi bado vinaendelea kutengenezwa.</p>
        </div>
      </section>
    </main>
  );
}
