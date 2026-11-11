import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Trophy, Target, Flame, Medal, Gift, RefreshCw, Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type Mission = { mission_key: string; title: string; description: string; cadence: "daily" | "weekly"; target: number; reward_coins: number; reward_xp: number; progress?: number; claimed_at?: string | null; period_start?: string };
type Achievement = { id: string; achievement_key: string; awarded_at: string; catalog?: { title: string; description: string; emoji: string; reward_coins: number } };
type Stats = { rating_points: number; wins: number; losses: number; draws: number; xp?: number; current_streak?: number; best_streak?: number; user_id: string };
type RecentMatch = { id: string; vs_ai: boolean; winner: string | null; created_at: string };
const periodStart = (cadence: "daily" | "weekly") => {
  const now = new Date();
  if (cadence === "daily") return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(now);
  const day = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam" }));
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(day);
};

export default function DraughtsRewards() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ledger, setLedger] = useState<Array<{ id: string; amount: number; reason: string; created_at: string }>>([]);
  const [leaderboard, setLeaderboard] = useState<Stats[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: wallet } = await supabase.from("draughts_wallets" as any).select("balance,lifetime_earned").eq("user_id", user.id).maybeSingle();
    const walletRow = wallet as unknown as { balance: number; lifetime_earned: number } | null;
    setBalance(Number(walletRow?.balance ?? 0));
    setLifetime(Number(walletRow?.lifetime_earned ?? 0));
    const { data: season } = await supabase.from("draughts_seasons").select("id,name").eq("is_active", true).order("starts_at", { ascending: false }).limit(1).maybeSingle();
    if (season) {
      const { data: mine } = await supabase.from("draughts_player_stats").select("*").eq("season_id", season.id).eq("user_id", user.id).maybeSingle();
      setStats(mine as unknown as Stats | null);
      const { data: top } = await supabase.from("draughts_player_stats").select("user_id,rating_points,wins,losses,draws,xp,current_streak,best_streak").eq("season_id", season.id).order("rating_points", { ascending: false }).order("wins", { ascending: false }).limit(100);
      setLeaderboard((top as unknown as Stats[] | null) ?? []);
    } else { setStats(null); setLeaderboard([]); }

    const { data: catalog } = await supabase.from("draughts_mission_catalog" as any).select("*").eq("is_enabled", true).order("cadence");
    const { data: progress } = await supabase.from("draughts_mission_progress" as any).select("*").eq("user_id", user.id);
    const today = periodStart("daily");
    const week = periodStart("weekly");
    const progressRows = (progress ?? []) as unknown as Array<{ mission_key: string; period_start: string; progress: number; claimed_at: string | null }>;
    setMissions(((catalog ?? []) as unknown as Mission[]).map((mission) => {
      const row = progressRows.find((item) => item.mission_key === mission.mission_key && item.period_start === (mission.cadence === "daily" ? today : week));
      return { ...mission, progress: row?.progress ?? 0, claimed_at: row?.claimed_at ?? null, period_start: mission.cadence === "daily" ? today : week };
    }));
    const { data: earned } = await supabase.from("draughts_user_achievements" as any).select("id,achievement_key,awarded_at").eq("user_id", user.id).order("awarded_at", { ascending: false });
    const { data: achievementCatalog } = await supabase.from("draughts_achievement_catalog" as any).select("*");
    const earnedRows = (earned ?? []) as unknown as Achievement[];
    const catalogRows = (achievementCatalog ?? []) as unknown as Array<{ achievement_key: string; title: string; description: string; emoji: string; reward_coins: number }>;
    setAchievements(earnedRows.map((item) => ({ ...item, catalog: catalogRows.find((c) => c.achievement_key === item.achievement_key) })));
    const { data: recent } = await supabase.from("draughts_coin_ledger" as any).select("id,amount,reason,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12);
    const { data: matches } = await supabase.from("draft_matches").select("id,vs_ai,winner,created_at").eq("status", "finished").or(`player_white.eq.${user.id},player_black.eq.${user.id}`).order("created_at", { ascending: false }).limit(10);
    setRecentMatches((matches as RecentMatch[] | null) ?? []);
    setLedger((recent as unknown as typeof ledger) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const claim = async (missionKey: string) => {
    const { data, error } = await supabase.rpc("claim_draughts_mission" as any, { p_mission_key: missionKey });
    if (error) { toast({ title: "Reward not claimed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Reward claimed!", description: `${data?.coins ?? 0} DC · ${data?.xp ?? 0} XP` });
    await load();
  };

  const division = (points: number) => points >= 600 ? "Division 1" : points >= 401 ? "Division 2" : points >= 300 ? "Division 3" : "Unranked";
  const winRate = stats && stats.wins + stats.losses + stats.draws > 0 ? Math.round(stats.wins / (stats.wins + stats.losses + stats.draws) * 100) : 0;

  return <div className="min-h-full bg-background">
    <header className="tiger-page-header">
      <button onClick={() => nav(-1)} className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
      <h1 className="flex-1 truncate text-base font-bold">Draughts Arena · Rewards</h1>
      <button onClick={() => void load()} className="rounded-lg p-2 hover:bg-surface-hover" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
    </header>
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <section className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-card to-primary/10 p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Your Draughts wallet</p><p className="mt-1 text-3xl font-black text-foreground">{balance.toLocaleString()} <span className="text-sm text-amber-500">DC</span></p><p className="text-xs text-muted-foreground">Lifetime earned: {lifetime.toLocaleString()} DC</p></div>
          <div className="rounded-2xl bg-amber-400/15 p-3"><Coins className="h-9 w-9 text-amber-500" /></div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Draughts Coins ni sarafu ya ndani ya mchezo; si pesa taslimu na haiwezi kutolewa kama fedha.</p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Division</p><p className="mt-1 font-bold">{division(stats?.rating_points ?? 0)}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Win rate</p><p className="mt-1 font-bold">{winRate}%</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">XP</p><p className="mt-1 font-bold">{(stats?.xp ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Best streak</p><p className="mt-1 font-bold">{stats?.best_streak ?? 0} 🔥</p></div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><Target className="h-5 w-5 text-primary" /><h2 className="font-bold">Daily & Weekly Missions</h2></div>
        <div className="space-y-3">
          {missions.map((mission) => {
            const complete = (mission.progress ?? 0) >= mission.target;
            return <div key={mission.mission_key} className="rounded-xl border border-border/70 p-3">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-sm">{mission.title}</p><p className="text-xs text-muted-foreground">{mission.description}</p></div><span className="whitespace-nowrap text-xs font-bold text-amber-500">+{mission.reward_coins} DC</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (mission.progress ?? 0) / mission.target * 100)}%` }} /></div>
              <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[11px] text-muted-foreground">{mission.cadence === "daily" ? "Daily" : "Weekly"} · {mission.progress ?? 0}/{mission.target} · +{mission.reward_xp} XP</p>
                {mission.claimed_at ? <span className="text-xs text-emerald-500">Claimed</span> : <Button size="sm" variant={complete ? "default" : "outline"} disabled={!complete} onClick={() => void claim(mission.mission_key)}>{complete ? "Claim reward" : "In progress"}</Button>}
              </div>
            </div>;
          })}
          {missions.length === 0 && <p className="text-sm text-muted-foreground">Missions hazijapatikana. Jaribu refresh.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><Medal className="h-5 w-5 text-primary" /><h2 className="font-bold">Achievements</h2></div>
        <div className="grid grid-cols-2 gap-2">
          {achievements.map((item) => <div key={item.id} className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-2xl">{item.catalog?.emoji ?? "🏅"}</p><p className="text-sm font-bold">{item.catalog?.title ?? item.achievement_key}</p><p className="text-[11px] text-muted-foreground">{item.catalog?.description ?? "Achievement unlocked"}</p><p className="mt-1 text-xs font-semibold text-amber-500">+{item.catalog?.reward_coins ?? 0} DC</p></div>)}
          {achievements.length === 0 && <p className="col-span-2 text-sm text-muted-foreground">Play online to unlock your first achievement.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" /><h2 className="font-bold">Season Top 100</h2></div>
        <div className="space-y-2">
          {leaderboard.slice(0, 10).map((player, index) => <div key={player.user_id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
            <span className="w-7 text-sm font-black text-amber-500">#{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs">{player.user_id === user?.id ? "You" : `Player ${player.user_id.slice(0, 6)}`}</span><span className="text-xs font-bold">{player.rating_points} RP</span><span className="text-[10px] text-muted-foreground">{division(player.rating_points)}</span>
          </div>)}
          {leaderboard.length === 0 && <p className="text-sm text-muted-foreground">No ranked players yet this season.</p>}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Top 100 ya msimu itaendelea kutumia rating points na kanuni zilizopo.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /><h2 className="font-bold">Recent Rewards</h2></div>
        <div className="space-y-2">
          {ledger.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate">{item.reason}</span><span className={item.amount >= 0 ? "font-bold text-emerald-500" : "font-bold text-destructive"}>{item.amount > 0 ? "+" : ""}{item.amount} DC</span></div>)}
          {ledger.length === 0 && <p className="text-sm text-muted-foreground">Zawadi zako zitaonekana hapa baada ya mechi au mission.</p>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => nav("/draughts")} className="w-full"><Trophy className="mr-2 h-4 w-4" /> Play Draughts</Button>
        <Button onClick={() => nav("/draughts/tournaments")} variant="outline" className="w-full"><Flame className="mr-2 h-4 w-4" /> Tournaments</Button>
      </div>
    </main>
  </div>;
}
