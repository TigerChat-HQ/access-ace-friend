import { useEffect, useState } from "react";
import { ArrowLeft, Building2, CloudSun, Gamepad2, Globe2, HardHat, Map, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function TigerCity3D() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [username, setUsername] = useState<string>("Player");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("username, display_name").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      setUsername(data?.username || data?.display_name || user.user_metadata?.username || user.email?.split("@")[0] || "Player");
      setLoading(false);
    };
    void loadProfile();
    return () => { active = false; };
  }, [user]);

  return (
    <main className="min-h-full overflow-y-auto bg-[#07101b] pb-24 text-white">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#07101b]/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => nav("/games")} aria-label="Back to Games" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.25em] text-amber-300">TIGERCHAT GAMES</p><h1 className="truncate text-base font-black">TIGER CITY 3D</h1></div>
      </header>

      <section className="relative isolate mx-auto mt-4 max-w-5xl overflow-hidden px-4 sm:mt-6">
        <div className="relative min-h-[260px] overflow-hidden rounded-[28px] border border-amber-200/20 bg-gradient-to-br from-[#1d3b54] via-[#14263b] to-[#090f1c] sm:min-h-[390px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_18%,rgba(251,191,36,.38),transparent_30%),radial-gradient(ellipse_at_75%_22%,rgba(56,189,248,.25),transparent_38%),linear-gradient(180deg,transparent_30%,rgba(3,8,16,.92))]" />
          <div className="absolute inset-x-0 bottom-0 flex h-[66%] items-end justify-center gap-1 px-3 opacity-70" aria-hidden="true">
            {[34,58,44,78,54,92,62,48,84,56,72,42,66,88,52].map((height, index) => <div key={index} style={{ height: height + "%" }} className="relative w-full max-w-10 rounded-t-sm border border-sky-100/15 bg-gradient-to-b from-sky-200/30 to-slate-950 shadow-[0_0_22px_rgba(56,189,248,.12)]"><div className="absolute inset-1 bg-[repeating-linear-gradient(90deg,rgba(253,230,138,.45)_0_2px,transparent_2px_8px)] opacity-60" /></div>)}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#050a12] to-transparent" />
          <div className="relative flex min-h-[260px] flex-col items-center justify-end px-4 pb-7 text-center sm:min-h-[390px] sm:pb-10">
            <span className="rounded-full border border-amber-200/30 bg-black/35 px-3 py-1 text-[9px] font-black tracking-[.25em] text-amber-200">ULTRA REALISTIC · CINEMATIC 3D</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">TIGER <span className="text-amber-300">CITY 3D</span></h2>
            <p className="mt-2 max-w-xl text-xs text-slate-200 sm:text-sm">Jenga jiji lako. Simamia barabara, makazi, biashara na ukuaji wa mji wako.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-5xl space-y-4 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-200"><Gamepad2 className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">TigerChat account</p><p className="truncate text-sm font-black">{loading ? "Inapakia akaunti..." : "@" + username}</p></div>
          <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[9px] font-bold text-emerald-200">SIGNED IN</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[{ icon: Building2, label: "Majengo na makazi" }, { icon: Map, label: "Barabara na ramani" }, { icon: CloudSun, label: "Mchana, usiku na hali ya hewa" }, { icon: Globe2, label: "Offline kwanza · Online baadaye" }].map(({ icon: Icon, label }) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><Icon className="mb-2 h-5 w-5 text-amber-200" /><p className="text-[11px] font-semibold leading-4 text-slate-200">{label}</p></div>)}
        </div>

        <div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4">
          <div className="flex items-center gap-2 text-amber-200"><HardHat className="h-5 w-5" /><h3 className="text-sm font-black">Ujenzi wa game unaendelea</h3></div>
          <p className="mt-2 text-xs leading-5 text-slate-300">Akaunti yako ya TigerChat imetambuliwa. Unity prototype bado inahitaji scene kamili, assets za 3D na build ya Android/Web kabla ya mchezo kuchezwa hapa. Hatutakuonyesha kitufe cha Play kinachodai kufanya kazi wakati build haipo.</p>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-amber-100"><Sparkles className="h-4 w-4" /> Lengo: ultra-realistic cinematic 3D</div>
        </div>
      </section>
    </main>
  );
}
