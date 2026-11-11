import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Coins, Medal, Gamepad2, Radio, Users, ChevronRight, Sparkles } from "lucide-react";

const games = [
  { title: "Draughts Arena", subtitle: "Classic strategy · AI · PvP", tag: "LIVE", path: "/draughts", art: "from-emerald-950 via-emerald-900 to-slate-950", icon: "♟", accent: "text-emerald-300" },
  { title: "4D Pool Arena", subtitle: "8-Ball · 9-Ball · Practice", tag: "PLAYABLE PREVIEW", path: "/pool", art: "from-blue-950 via-indigo-950 to-slate-950", icon: "🎱", accent: "text-sky-300" },
  { title: "Tiger Quiz Arena", subtitle: "Knowledge · Timed rounds · Trophies", tag: "QUIZ", path: "/game", art: "from-amber-950 via-orange-950 to-slate-950", icon: "🧠", accent: "text-amber-300" },
];

export default function GamesHub() {
  const nav = useNavigate();
  return <main className="min-h-full overflow-y-auto bg-background pb-24">
    <header className="tiger-page-header">
      <button onClick={() => nav(-1)} className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.24em] text-primary">TigerChat</p><h1 className="text-base font-black">Games Arena</h1></div>
      <button onClick={() => nav("/draughts/rewards")} className="rounded-xl bg-amber-500/10 p-2 text-amber-500" aria-label="Rewards"><Coins className="h-5 w-5"/></button>
    </header>
    <section className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="relative overflow-hidden rounded-[28px] border border-primary/25 bg-gradient-to-br from-card via-card to-primary/15 p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl"/>
        <div className="relative max-w-xl"><span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><Sparkles className="h-3 w-3"/> Play · Compete · Win</span>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Your next match<br/><span className="text-primary">starts here.</span></h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">Chagua mchezo, boresha ujuzi wako, shindana na marafiki na panda kwenye rankings.</p>
          <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => nav("/draughts")} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Play Draughts <ChevronRight className="ml-1 inline h-4 w-4"/></button><button onClick={() => nav("/pool")} className="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-bold">Try 4D Pool</button></div>
        </div>
      </div>
      <div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Game library</p><h2 className="text-xl font-black">Choose your arena</h2></div><span className="text-xs text-muted-foreground">2 games</span></div>
      <div className="grid gap-4 md:grid-cols-2">{games.map((game) => <button key={game.path} onClick={() => nav(game.path)} className={`group relative min-h-[230px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${game.art} p-5 text-left shadow-xl transition duration-300 hover:-translate-y-1 hover:border-primary/50`}>
        <div className="absolute -right-8 -top-8 text-[150px] opacity-[.12] transition-transform duration-500 group-hover:scale-110">{game.icon}</div>
        <div className="relative flex h-full min-h-[190px] flex-col justify-between"><div className="flex items-center justify-between"><span className={`text-5xl ${game.accent}`}>{game.icon}</span><span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[9px] font-black tracking-wider text-white">{game.tag}</span></div><div><h3 className="text-2xl font-black text-white">{game.title}</h3><p className="mt-1 text-xs text-white/70">{game.subtitle}</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white">Enter Arena <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/></span></div></div>
      </button>)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{label:"Tournaments",icon:Trophy,path:"/draughts/tournaments"},{label:"Rewards",icon:Coins,path:"/draughts/rewards"},{label:"Watch Live",icon:Radio,path:"/draughts/watch"},{label:"My Draughts",icon:Medal,path:"/draughts"}].map(({label,icon:Icon,path})=><button key={label} onClick={()=>nav(path)} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/50"><Icon className="h-5 w-5 text-primary"/><span className="text-xs font-bold">{label}</span></button>)}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2"><Gamepad2 className="h-5 w-5 text-primary"/><h3 className="font-bold">Gaming profile & community</h3></div><p className="mt-1 text-xs text-muted-foreground">Rankings, friends challenges, teams, achievements na cross-game profile zitaunganishwa katika hatua zinazofuata.</p></div>
    </section>
  </main>;
}
