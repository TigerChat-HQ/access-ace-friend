import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Coins, Medal, Gamepad2, Radio, ChevronRight, Sparkles, Clock3, Users, Crown, Search, Zap, Puzzle, Brain, Star, LockKeyhole } from "lucide-react";

const liveGames = [
  { title: "Draughts Arena", subtitle: "Strategy · AI / PvP", detail: "Mkakati wa jadi · Tiger AI · PvP", tag: "ONLINE", path: "/draughts", icon: "♟", players: "AI na marafiki", category: "Strategy", art: "from-blue-600/50 via-indigo-950 to-[#080d1b]", accent: "text-cyan-200", artwork: "♟" },
  { title: "Tiger Quiz", subtitle: "Quiz · AI / Multiplayer", detail: "Maswali · Raundi za muda · Trophies", tag: "ONLINE", path: "/game", icon: "?", players: "Jipime maarifa", category: "Quiz", art: "from-fuchsia-600/50 via-violet-950 to-[#10091d]", accent: "text-violet-200", artwork: "?" },
  { title: "Connect Four", subtitle: "Strategy · Multiplayer", detail: "Unganisha nne · Online PvP · Tiger AI", tag: "ONLINE", path: "/games/connect-four", icon: "●", players: "AI na marafiki", category: "Strategy", art: "from-sky-500/50 via-blue-950 to-[#080d1b]", accent: "text-sky-200", artwork: "🔴" },
  { title: "Block Puzzle", subtitle: "Puzzle · Solo", detail: "Panga blocks · Pata alama nyingi", tag: "NEW", path: "/games/block-puzzle", icon: "🧩", players: "Single player", category: "Puzzle", art: "from-amber-500/50 via-orange-950 to-[#120b1b]", accent: "text-amber-200", artwork: "🟩🟪🟨" },
  { title: "Unblock", subtitle: "Puzzle · Progressive Levels", detail: "Telezesha vipande vya mbao · Fungua njia", tag: "POPULAR", path: "/games/unblock", icon: "🪵", players: "Puzzle ya akili", category: "Puzzle", art: "from-amber-700/50 via-stone-900 to-[#0b101b]", accent: "text-amber-100", artwork: "🪵" },
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
    return categoryMatch && (!query || (game.title + " " + game.subtitle + " " + game.detail).toLowerCase().includes(query));
  }), [category, search]);

  return <main className="relative h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y bg-[#080d19] pb-28 text-white" style={{ WebkitOverflowScrolling: "touch" }}>
    <div className="pointer-events-none fixed inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_15%_0%,rgba(16,185,129,.16),transparent_42%),radial-gradient(ellipse_at_90%_8%,rgba(139,92,246,.18),transparent_40%)]" />
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.07] bg-[#080d19]/90 px-4 py-3 backdrop-blur-2xl">
      <button onClick={() => nav(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-emerald-400/40 hover:text-emerald-300" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-emerald-700 text-[#07120f] shadow-[0_0_24px_rgba(16,185,129,.25)]"><Gamepad2 className="h-6 w-6" /></div>
      <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.28em] text-emerald-300">TIGERCHAT UNIVERSE</p><h1 className="truncate text-base font-black tracking-tight">Games Arena</h1></div>
      <button onClick={() => nav("/draughts/rewards")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-300 transition hover:bg-amber-300/20" aria-label="Rewards"><Coins className="h-5 w-5" /></button>
    </header>

    <div className="relative z-10 mx-auto max-w-6xl space-y-5 p-3 sm:space-y-7 sm:p-6">
      <section className="relative isolate min-h-[164px] overflow-hidden rounded-[26px] border border-emerald-300/30 bg-[#10152b] shadow-[0_14px_48px_rgba(0,0,0,.38)] sm:min-h-[220px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_80%,rgba(16,220,174,.42),transparent_34%),radial-gradient(circle_at_82%_35%,rgba(124,58,237,.52),transparent_36%),linear-gradient(110deg,#07172b,#10142d_54%,#21113b)]" />
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle,rgba(255,255,255,.8) 1px,transparent 1.5px)", backgroundSize: "34px 34px" }} />
        <div className="absolute -left-5 top-5 text-6xl drop-shadow-[0_0_18px_rgba(34,211,238,.8)] sm:left-5 sm:text-8xl">🎮</div>
        <div className="absolute -right-2 top-3 text-6xl drop-shadow-[0_0_22px_rgba(251,191,36,.8)] sm:right-6 sm:text-8xl">🏆</div>
        <div className="relative flex min-h-[164px] flex-col items-center justify-center px-16 py-4 text-center sm:min-h-[220px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-950/70 px-3 py-1 text-[10px] font-black tracking-wide text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,.35)]"><Crown className="h-3.5 w-3.5" /> GAMING ARENA</span>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Tiger <span className="bg-gradient-to-r from-emerald-200 to-green-400 bg-clip-text text-transparent">Games</span></h2>
          <p className="mt-1 text-sm font-bold text-white sm:text-lg">Play · Compete · Win</p>
          <p className="mt-2 rounded-full bg-black/45 px-3 py-1 text-[10px] font-semibold text-white sm:text-sm">Cheza na Tiger AI au washindane na marafiki</p>
          <div className="mt-2 flex gap-1.5"><span className="h-2 w-6 rounded-full bg-emerald-400" /><span className="h-2 w-2 rounded-full bg-white/40" /><span className="h-2 w-2 rounded-full bg-white/40" /><span className="h-2 w-2 rounded-full bg-white/40" /></div>
        </div>
      </section>

      <label className="flex min-w-0 items-center gap-3 rounded-full border border-white/10 bg-[#141b2b] px-4 py-3 text-slate-400 shadow-inner focus-within:border-emerald-300/40">
        <Search className="h-5 w-5 shrink-0" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tafuta mchezo..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition ${category === item ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,.22)]" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-white"}`}>{item}</button>)}
      </div>

      <section id="available-games" className="scroll-mt-24 space-y-3">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-300">EXPLORE GAMES</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Choose Your Arena</h2><p className="mt-1 text-xs text-slate-400">Chagua mchezo na anza kucheza</p></div><button onClick={() => { setCategory("All Games"); setSearch(""); }} className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-[10px] font-black text-emerald-200">VIEW ALL <ChevronRight className="ml-1 inline h-3 w-3" /></button></div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {filteredGames.filter((game) => game.path !== "/games/unblock").map((game) => <button key={game.path} onClick={() => nav(game.path)} className="group relative min-w-0 overflow-hidden rounded-[22px] border border-emerald-300/25 bg-[#101827] text-left shadow-[0_12px_32px_rgba(0,0,0,.3)] transition hover:-translate-y-1 hover:border-emerald-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
            <div className={`relative flex h-[112px] items-center justify-center overflow-hidden bg-gradient-to-br ${game.art} sm:h-40`}><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.22),transparent_42%)]" /><span className="relative text-7xl font-black drop-shadow-[0_8px_18px_rgba(0,0,0,.65)] sm:text-8xl">{game.artwork}</span><span className="absolute right-2 top-2 rounded-full border border-emerald-300/30 bg-emerald-950/85 px-2 py-1 text-[8px] font-black text-emerald-200"><Users className="mr-1 inline h-3 w-3" />{game.tag}</span></div>
            <div className="space-y-2 p-3"><h3 className="truncate text-sm font-black text-white sm:text-lg">{game.title}</h3><p className="truncate text-[10px] text-slate-300 sm:text-xs">{game.subtitle}</p><span className="flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-green-500 px-2 py-2 text-[10px] font-black text-[#06130e] shadow-[0_4px_14px_rgba(16,185,129,.25)]">PLAY NOW <ChevronRight className="ml-1 inline h-3.5 w-3.5" /></span></div>
          </button>)}
        </div>
        {filteredGames.filter((game) => game.path === "/games/unblock").map((game) => <button key={game.path} onClick={() => nav(game.path)} className="group flex w-full items-center gap-3 overflow-hidden rounded-[22px] border border-emerald-300/35 bg-gradient-to-r from-[#172331] to-[#111827] p-2 text-left shadow-[0_12px_32px_rgba(0,0,0,.28)] transition hover:border-emerald-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
          <div className={`flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${game.art} text-5xl drop-shadow-lg sm:h-28 sm:w-36 sm:text-6xl`}>{game.artwork}</div><div className="min-w-0 flex-1"><span className="rounded-full bg-amber-400/15 px-2 py-1 text-[8px] font-black text-amber-200">★ POPULAR</span><h3 className="mt-1 truncate text-base font-black">{game.title}</h3><p className="text-[10px] text-slate-300">{game.subtitle}</p></div><span className="shrink-0 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 px-3 py-2 text-[9px] font-black text-[#06130e]">PLAY <ChevronRight className="inline h-3 w-3" /></span>
        </button>)}
        {filteredGames.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center text-sm text-slate-400">Hakuna mchezo unaolingana na utafutaji wako.</div>}
      </section>

      <section className="grid grid-cols-[1fr_auto] gap-3">
        <button onClick={() => nav("/draughts/rewards")} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-[#121b2a] p-3 text-left"><Trophy className="h-8 w-8 shrink-0 text-amber-300" /><span className="min-w-0"><strong className="block text-sm">Your Gaming Progress</strong><span className="text-[10px] text-slate-400">XP & Rewards · Rankings · Achievements</span></span></button>
        <button onClick={() => nav("/draughts/rewards")} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#121b2a] px-3 py-3 text-left"><Star className="h-6 w-6 text-amber-300" /><span><strong className="block text-xs">Rewards</strong><span className="text-[9px] text-slate-400">View XP</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></button>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ label: "Tournaments", icon: Trophy, path: "/draughts/tournaments", tone: "text-amber-300" }, { label: "Rewards", icon: Coins, path: "/draughts/rewards", tone: "text-emerald-300" }, { label: "Watch Live", icon: Radio, path: "/draughts/watch", tone: "text-rose-300" }, { label: "My Draughts", icon: Medal, path: "/draughts", tone: "text-violet-300" }].map(({ label, icon: Icon, path, tone }) => <button key={label} onClick={() => nav(path)} className="group flex min-h-16 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075]"><Icon className={`h-5 w-5 shrink-0 ${tone}`} /><span className="text-xs font-bold text-white">{label}</span><ChevronRight className="ml-auto h-4 w-4 text-slate-500" /></button>)}
      </section>

      <section id="more-games" className="scroll-mt-24 space-y-3">
        <div><p className="text-[9px] font-black uppercase tracking-[.25em] text-violet-300">COMING NEXT</p><h2 className="mt-1 text-xl font-black sm:text-2xl">More worlds are coming</h2><p className="mt-1 text-xs text-slate-400">Michezo mipya inayopangwa kuongezwa.</p></div>
        <div className="grid gap-3 sm:grid-cols-3">{comingSoon.map((game) => <article key={game.title} className={`flex items-center gap-3 rounded-2xl border p-3 backdrop-blur-xl ${game.tone}`}><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/20 text-3xl">{game.icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-white">{game.title}</h3><span className="rounded-full bg-black/20 px-2 py-0.5 text-[8px] font-black text-white/60">{game.label}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-400">{game.subtitle}</p></div><Clock3 className="h-4 w-4 shrink-0 text-slate-500" /></article>)}</div>
      </section>
    </div>
  </main>;
}
