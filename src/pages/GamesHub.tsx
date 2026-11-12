import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Coins, Medal, Gamepad2, Radio, ChevronRight, Sparkles, Clock3, Users, Crown, Search, Zap } from "lucide-react";

const liveGames = [
  { title: "Draughts Arena", subtitle: "Mkakati wa jadi · Tiger AI · PvP", tag: "POPULAR", path: "/draughts", icon: "♟", players: "AI na marafiki", category: "Strategy", glow: "from-emerald-400/30 via-emerald-950 to-[#080d1b]", accent: "text-emerald-300", border: "hover:border-emerald-400/60" },
  { title: "Tiger Quiz Arena", subtitle: "Maswali · Raundi za muda · Trophies", tag: "QUIZ", path: "/game", icon: "🧠", players: "Jipime maarifa", category: "Quiz", glow: "from-amber-400/30 via-orange-950 to-[#120b1b]", accent: "text-amber-300", border: "hover:border-amber-400/60" },
  { title: "Connect Four", subtitle: "Unganisha nne · Online PvP · Tiger AI", tag: "ONLINE PvP", path: "/games/connect-four", icon: "🔴", players: "AI na marafiki", category: "Strategy", glow: "from-rose-400/30 via-red-950 to-[#100b1b]", accent: "text-rose-300", border: "hover:border-rose-400/60" },
  { title: "Block Puzzle", subtitle: "Panga blocks · Pata alama nyingi", tag: "PUZZLE", path: "/games/block-puzzle", icon: "🧩", players: "Single player", category: "Puzzle", glow: "from-violet-400/30 via-indigo-950 to-[#0a0b1b]", accent: "text-violet-300", border: "hover:border-violet-400/60" },
  { title: "Unblock Wooden Puzzle", subtitle: "Telezesha vipande vya mbao · Fungua njia", tag: "BRAIN GAME", path: "/games/unblock", icon: "🪵", players: "Puzzle ya akili", category: "Puzzle", glow: "from-orange-300/30 via-amber-950 to-[#100b1b]", accent: "text-orange-200", border: "hover:border-orange-300/60" },
];

const categories = ["All Games", "Strategy", "Quiz", "Puzzle"];
const comingSoon = [
  { title: "Chess Arena", subtitle: "Chess dhidi ya AI na marafiki", icon: "♛", label: "Strategy", tone: "border-sky-400/20 bg-sky-400/5" },
  { title: "Word Puzzle", subtitle: "Maneno, lugha na changamoto za akili", icon: "🔤", label: "Puzzle", tone: "border-violet-400/20 bg-violet-400/5" },
  { title: "Snake Rush", subtitle: "Mchezo wa kasi na alama nyingi", icon: "🐍", label: "Arcade", tone: "border-lime-400/20 bg-lime-400/5" },
];

export default function GamesHub() {
  const nav = useNavigate();
  const [category, setCategory] = useState("All Games");
  const [search, setSearch] = useState("");
  const filteredGames = useMemo(() => liveGames.filter((game) => {
    const categoryMatch = category === "All Games" || game.category === category;
    const query = search.trim().toLowerCase();
    return categoryMatch && (!query || (game.title + " " + game.subtitle).toLowerCase().includes(query));
  }), [category, search]);

  return <main className="relative h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y bg-[#080d19] pb-28 text-white" style={{ WebkitOverflowScrolling: "touch" }}>
    <div className="pointer-events-none fixed inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(ellipse_at_15%_0%,rgba(16,185,129,.16),transparent_42%),radial-gradient(ellipse_at_90%_8%,rgba(139,92,246,.18),transparent_40%)]" />
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.07] bg-[#080d19]/85 px-4 py-3 backdrop-blur-2xl">
      <button onClick={() => nav(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-emerald-400/40 hover:text-emerald-300" aria-label="Back">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-emerald-700 text-[#07120f] shadow-[0_0_24px_rgba(16,185,129,.25)]">
        <Gamepad2 className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-[.28em] text-emerald-300">TIGERCHAT UNIVERSE</p>
        <h1 className="truncate text-base font-black tracking-tight">Games Arena</h1>
      </div>
      <button onClick={() => nav("/draughts/rewards")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-300 transition hover:bg-amber-300/20" aria-label="Rewards">
        <Coins className="h-5 w-5" />
      </button>
    </header>

    <div className="relative z-10 mx-auto max-w-6xl space-y-7 p-4 sm:space-y-9 sm:p-6">
      <section className="relative isolate min-h-[290px] overflow-hidden rounded-[30px] border border-emerald-300/20 bg-[#101b2c] shadow-[0_24px_80px_rgba(0,0,0,.38)] sm:min-h-[330px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_34%,rgba(16,185,129,.28),transparent_28%),radial-gradient(circle_at_92%_82%,rgba(99,102,241,.26),transparent_32%),linear-gradient(115deg,#101a2b_8%,#102a2a_55%,#11152c_100%)]" />
        <div className="absolute -right-8 top-2 hidden h-72 w-72 items-center justify-center rounded-full border border-emerald-200/10 bg-emerald-300/[0.04] shadow-[0_0_90px_rgba(16,185,129,.15)] sm:flex">
          <div className="flex h-52 w-52 items-center justify-center rounded-full border border-emerald-200/15 bg-black/20 text-[118px] drop-shadow-[0_0_32px_rgba(52,211,153,.45)]">🎮</div>
        </div>
        <div className="relative flex min-h-[290px] max-w-2xl flex-col justify-center p-6 sm:min-h-[330px] sm:p-9">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.22em] text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" /> PREMIUM GAMING EXPERIENCE
          </span>
          <h2 className="mt-5 text-4xl font-black leading-[1.02] tracking-[-.04em] sm:text-6xl">Enter the <span className="bg-gradient-to-r from-emerald-200 via-green-300 to-cyan-300 bg-clip-text text-transparent">Arena.</span></h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">Cheza dhidi ya Tiger AI au marafiki. Shinda mechi, kusanya zawadi na panda kwenye rankings za TigerChat.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => nav("/draughts")} className="rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 px-5 py-3 text-sm font-black text-[#06130e] shadow-[0_8px_28px_rgba(16,185,129,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(16,185,129,.35)]">
              <Zap className="mr-1.5 inline h-4 w-4" /> Play Now
            </button>
            <button onClick={() => nav("/draughts/rewards")} className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10">
              <Trophy className="mr-1.5 inline h-4 w-4 text-amber-300" /> Rewards & Rankings
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-semibold text-slate-400">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> Games available</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> AI & Multiplayer</span>
            <span className="inline-flex items-center gap-1.5"><Crown className="h-3.5 w-3.5" /> XP & Rewards</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {[{ label: "Available Games", value: String(liveGames.length), icon: Gamepad2, color: "text-emerald-300" }, { label: "Competitions", value: "Arena", icon: Trophy, color: "text-amber-300" }, { label: "Player Rewards", value: "XP", icon: Crown, color: "text-violet-300" }].map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] backdrop-blur-xl sm:p-4"><Icon className={`h-4 w-4 ${color}`} /><p className="mt-2 text-lg font-black tracking-tight sm:text-xl">{value}</p><p className="text-[9px] font-semibold text-slate-400 sm:text-[10px]">{label}</p></div>)}
      </section>

      <section id="available-games" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-300">Choose your game</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Choose Your Arena</h2><p className="mt-1 text-xs text-slate-400">Michezo yako yote sehemu moja.</p></div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[9px] font-black tracking-wider text-emerald-200">{liveGames.length} AVAILABLE</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-slate-400 focus-within:border-emerald-300/40">
            <Search className="h-4 w-4 shrink-0" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tafuta mchezo..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-xl border px-3 py-2.5 text-[10px] font-bold transition ${category === item ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,.1)]" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-white"}`}>{item}</button>)}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredGames.map((game) => <button key={game.path} onClick={() => nav(game.path)} className={`group relative min-h-[250px] overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br ${game.glow} p-5 text-left shadow-[0_18px_45px_rgba(0,0,0,.24)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_55px_rgba(0,0,0,.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${game.border}`}>
            <div className="pointer-events-none absolute -right-8 -top-10 flex h-48 w-48 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-[116px] opacity-80 drop-shadow-[0_0_26px_rgba(255,255,255,.12)] transition duration-500 group-hover:rotate-6 group-hover:scale-110">{game.icon}</div>
            <div className="relative flex min-h-[208px] flex-col justify-between">
              <div className="flex items-start justify-between"><div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-black/20 text-4xl shadow-[inset_0_1px_0_rgba(255,255,255,.12)] ${game.accent}`}>{game.icon}</div><span className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[8px] font-black tracking-[.16em] text-white/85 backdrop-blur">{game.tag}</span></div>
              <div><p className={`text-[9px] font-black uppercase tracking-[.22em] ${game.accent}`}>{game.category} ARENA</p><h3 className="mt-1 text-2xl font-black tracking-tight text-white">{game.title}</h3><p className="mt-1 text-xs text-white/65">{game.subtitle}</p><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3"><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/65"><Users className="h-3.5 w-3.5" />{game.players}</span><span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-[10px] font-black text-white transition group-hover:bg-emerald-300 group-hover:text-[#07120f]">PLAY <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span></div></div>
            </div>
          </button>)}
        </div>
        {filteredGames.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center text-sm text-slate-400">Hakuna mchezo unaolingana na utafutaji wako.</div>}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ label: "Tournaments", icon: Trophy, path: "/draughts/tournaments", tone: "text-amber-300" }, { label: "Rewards", icon: Coins, path: "/draughts/rewards", tone: "text-emerald-300" }, { label: "Watch Live", icon: Radio, path: "/draughts/watch", tone: "text-rose-300" }, { label: "My Draughts", icon: Medal, path: "/draughts", tone: "text-violet-300" }].map(({ label, icon: Icon, path, tone }) => <button key={label} onClick={() => nav(path)} className="group flex min-h-16 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075]"><Icon className={`h-5 w-5 shrink-0 ${tone}`} /><span className="text-xs font-bold text-white">{label}</span><ChevronRight className="ml-auto h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" /></button>)}
      </section>

      <section id="more-games" className="scroll-mt-24 space-y-4">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.25em] text-violet-300">Coming next</p><h2 className="mt-1 text-xl font-black sm:text-2xl">More worlds are coming</h2><p className="mt-1 text-xs text-slate-400">Michezo mipya inayopangwa kuongezwa.</p></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-bold text-slate-500">COMING SOON</span></div>
        <div className="grid gap-3 sm:grid-cols-3">
          {comingSoon.map((game) => <article key={game.title} className={`flex items-center gap-3 rounded-2xl border p-3 backdrop-blur-xl ${game.tone}`}><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/20 text-3xl">{game.icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-white">{game.title}</h3><span className="rounded-full bg-black/20 px-2 py-0.5 text-[8px] font-black text-white/60">{game.label}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-400">{game.subtitle}</p></div><Clock3 className="h-4 w-4 shrink-0 text-slate-500" /></article>)}
        </div>
      </section>
    </div>
  </main>;
}
