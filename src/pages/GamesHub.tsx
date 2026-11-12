import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Coins, Medal, Gamepad2, Radio, ChevronRight, ChevronDown, Sparkles, Clock3, Users, Swords, Brain, Puzzle, Crown } from "lucide-react";

const liveGames = [
  { title: "Draughts Arena", subtitle: "Mkakati wa jadi · Tiger AI · PvP", tag: "INACHEZWA", path: "/draughts", art: "from-emerald-950 via-emerald-900 to-slate-950", icon: "♟", accent: "text-emerald-300", players: "AI na marafiki" },
  { title: "Tiger Quiz Arena", subtitle: "Maswali · Raundi za muda · Trophies", tag: "QUIZ", path: "/game", art: "from-amber-950 via-orange-950 to-slate-950", icon: "🧠", accent: "text-amber-300", players: "Jipime maarifa" },
];

const comingSoon = [
  { title: "Chess Arena", subtitle: "Chess dhidi ya AI na marafiki", icon: "♛", tone: "border-sky-400/20 bg-sky-400/5", label: "Mkakati" },
  { title: "Connect Four", subtitle: "Unganisha nne kabla ya mpinzani", icon: "🔴", tone: "border-rose-400/20 bg-rose-400/5", label: "PvP" },
  { title: "Word Puzzle", subtitle: "Maneno, lugha na changamoto za akili", icon: "🔤", tone: "border-violet-400/20 bg-violet-400/5", label: "Puzzle" },
  { title: "Snake Rush", subtitle: "Mchezo wa kasi na alama nyingi", icon: "🐍", tone: "border-lime-400/20 bg-lime-400/5", label: "Arcade" },
];

export default function GamesHub() {
  const nav = useNavigate();
  return <main className="min-h-full overflow-y-auto overscroll-contain bg-background pb-28">
    <header className="tiger-page-header sticky top-0 z-20">
      <button onClick={() => nav(-1)} className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.24em] text-primary">TigerChat</p><h1 className="text-base font-black">Games Arena</h1></div>
      <button onClick={() => nav("/draughts/rewards")} className="rounded-xl bg-amber-500/10 p-2 text-amber-500" aria-label="Rewards"><Coins className="h-5 w-5"/></button>
    </header>

    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-primary/25 bg-gradient-to-br from-card via-card to-primary/15 p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-10 -z-10 h-52 w-52 rounded-full bg-primary/15 blur-3xl"/>
        <div className="pointer-events-none absolute -bottom-20 right-24 -z-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl"/>
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><Sparkles className="h-3 w-3"/> Play · Compete · Win</span>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Chagua mchezo.<br/><span className="text-primary">Anza ushindi.</span></h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Cheza dhidi ya Tiger AI au marafiki, kusanya ushindi na panda kwenye rankings za TigerChat.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => nav("/draughts")} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Cheza Draughts <ChevronRight className="ml-1 inline h-4 w-4"/></button>
            <a href="#more-games" className="rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-bold text-foreground">Gundua michezo <ChevronDown className="ml-1 inline h-4 w-4"/></a>
          </div>
        </div>
        <div className="absolute bottom-4 right-5 hidden select-none text-[112px] opacity-10 sm:block">🎮</div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[{label:"Michezo hai",value:"2",icon:Gamepad2},{label:"Mashindano",value:"Live",icon:Trophy},{label:"Zawadi",value:"XP",icon:Crown}].map(({label,value,icon:Icon})=><div key={label} className="rounded-2xl border border-border bg-card/80 p-3"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-lg font-black">{value}</p><p className="text-[10px] leading-4 text-muted-foreground">{label}</p></div>)}
      </section>

      <section id="available-games" className="scroll-mt-20 space-y-4">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Cheza sasa</p><h2 className="text-xl font-black sm:text-2xl">Michezo inayopatikana</h2><p className="mt-1 text-xs text-muted-foreground">Chagua mchezo kuingia moja kwa moja.</p></div><span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-500">2 LIVE</span></div>
        <div className="grid gap-4 md:grid-cols-2">
          {liveGames.map((game) => <button key={game.path} onClick={() => nav(game.path)} className={`group relative min-h-[238px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${game.art} p-5 text-left shadow-lg transition duration-300 hover:-translate-y-1 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
            <div className="absolute -right-7 -top-9 text-[156px] opacity-[.12] transition-transform duration-500 group-hover:scale-110">{game.icon}</div>
            <div className="relative flex min-h-[198px] flex-col justify-between">
              <div className="flex items-center justify-between"><span className={`text-5xl ${game.accent}`}>{game.icon}</span><span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[9px] font-black tracking-wider text-white">{game.tag}</span></div>
              <div><h3 className="text-2xl font-black text-white">{game.title}</h3><p className="mt-1 text-xs text-white/75">{game.subtitle}</p><div className="mt-3 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[11px] text-white/65"><Users className="h-3.5 w-3.5"/>{game.players}</span><span className="inline-flex items-center gap-1 text-xs font-bold text-white">Ingia <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/></span></div></div>
            </div>
          </button>)}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{label:"Tournaments",icon:Trophy,path:"/draughts/tournaments"},{label:"Rewards",icon:Coins,path:"/draughts/rewards"},{label:"Watch Live",icon:Radio,path:"/draughts/watch"},{label:"My Draughts",icon:Medal,path:"/draughts"}].map(({label,icon:Icon,path})=><button key={label} onClick={()=>nav(path)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/50"><Icon className="h-5 w-5 shrink-0 text-primary"/><span className="text-xs font-bold">{label}</span><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground"/></button>)}
      </section>

      <section id="more-games" className="scroll-mt-20 space-y-4">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Inayofuata</p><h2 className="text-xl font-black sm:text-2xl">Michezo zaidi inakuja</h2><p className="mt-1 text-xs text-muted-foreground">Pendekezo la michezo itakayoongezwa kwenye TigerChat.</p></div><span className="shrink-0 rounded-full border border-border px-3 py-1 text-[10px] font-semibold text-muted-foreground">COMING SOON</span></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {comingSoon.map((game) => <article key={game.title} className={`flex items-center gap-4 rounded-2xl border p-4 ${game.tone}`}>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-background/70 text-3xl">{game.icon}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{game.title}</h3><span className="rounded-full bg-background/70 px-2 py-0.5 text-[9px] font-bold text-muted-foreground">{game.label}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{game.subtitle}</p></div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5"/> Soon</span>
          </article>)}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2"><Gamepad2 className="h-5 w-5 text-primary"/><h3 className="font-bold">Wasifu wa mchezaji</h3></div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Tunapendekeza kuongeza ukurasa mmoja wa gaming profile unaokusanya kiwango cha mchezaji, ushindi, historia ya mechi, marafiki na badges kutoka michezo yote.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-muted-foreground"><span className="rounded-full bg-muted px-2.5 py-1">Rankings</span><span className="rounded-full bg-muted px-2.5 py-1">Achievements</span><span className="rounded-full bg-muted px-2.5 py-1">Match history</span><span className="rounded-full bg-muted px-2.5 py-1">Friend challenges</span></div>
      </section>
    </div>
  </main>;
}
