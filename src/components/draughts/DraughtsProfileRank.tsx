import { useCallback, useEffect, useState } from "react";
import { Award, Crown, Medal, Swords, TrendingUp } from "lucide-react";
import { appDatabase as supabase } from "@/lib/app-database";

type StatRow = { season_id: string; user_id: string; rating_points: number; wins: number; losses: number; draws: number };
type BadgeRow = { id: string; season_id: string; rank: number | null; badge_name: string; show_on_profile: boolean; badge_type?: { emoji?: string; description?: string } | null };
const divisionFor = (p: number) => p >= 600 ? "Division 1" : p >= 401 ? "Division 2" : p >= 300 ? "Division 3" : "Unranked";
const tone = (d: string) => d === "Division 1" ? "text-amber-500" : d === "Division 2" ? "text-sky-500" : d === "Division 3" ? "text-emerald-500" : "text-muted-foreground";

export function DraughtsProfileRank({ userId, isMe }: { userId: string; isMe: boolean }) {
 const [season,setSeason] = useState<{id:string;name:string}|null>(null);
 const [stats,setStats] = useState<StatRow|null>(null);
 const [rank,setRank] = useState<number|null>(null);
 const [badges,setBadges] = useState<BadgeRow[]>([]);
 const [loading,setLoading] = useState(true);
 const load = useCallback(async () => {
  const {data:active} = await supabase.from("draughts_seasons").select("id,name").eq("is_active",true).maybeSingle();
  if (!active) { setSeason(null);setStats(null);setRank(null);setBadges([]);setLoading(false);return; }
  setSeason(active);
  const {data:all} = await supabase.from("draughts_player_stats").select("season_id,user_id,rating_points,wins,losses,draws").eq("season_id",active.id).order("rating_points",{ascending:false}).order("wins",{ascending:false}).order("losses",{ascending:true}).limit(2000);
  const rows = all || [];
  setStats(rows.find((r)=>r.user_id===userId)||null);
  const position=rows.findIndex((r)=>r.user_id===userId);
  setRank(position>=0?position+1:null);
  const {data:earned} = await supabase.from("draughts_player_badges")
    .select("id,season_id,rank,badge_name,show_on_profile,badge_type:draughts_badge_types(emoji,description)")
    .eq("user_id",userId).order("awarded_at",{ascending:false}).limit(20);
  setBadges(earned||[]);
  setLoading(false);
 },[userId]);
 useEffect(()=>{
  setLoading(true);void load();
  const channel=supabase.channel("draughts-profile-rank:"+userId)
   .on("postgres_changes",{event:"*",schema:"public",table:"draughts_player_stats"},()=>{void load();})
   .on("postgres_changes",{event:"*",schema:"public",table:"draughts_player_badges",filter:"user_id=eq."+userId},()=>{void load();})
   .on("postgres_changes",{event:"*",schema:"public",table:"draughts_seasons"},()=>{void load();}).subscribe();
  return ()=>{void supabase.removeChannel(channel);};
 },[load,userId]);
 const points=stats?.rating_points??300;
 const division=divisionFor(points);
 const toggleBadge=async(badge:BadgeRow)=>{
  if(!isMe)return;
  const next=!badge.show_on_profile;
  const {error}=await supabase.from("draughts_player_badges").update({show_on_profile:next}).eq("id",badge.id).eq("user_id",userId);
  if(!error)setBadges(current=>current.map(b=>b.id===badge.id?{...b,show_on_profile:next}:b));
 };
 if(loading)return <div className="rounded-2xl border border-border/50 p-4 text-xs text-muted-foreground">Loading Draughts ranking…</div>;
 return <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
  <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Swords className="h-5 w-5"/></span><div><h2 className="text-sm font-bold text-foreground">Tanzanian Draughts</h2><p className="text-[11px] text-muted-foreground">{season?.name||"No active season"} · Live ranking</p></div></div>{rank&&<span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">#{rank} Rank</span>}</div>
  <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rating points</p><p className="mt-1 text-2xl font-black tabular-nums text-foreground">{points}</p><p className={"mt-1 text-xs font-semibold "+tone(division)}>{division}</p></div>
   <div className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Match record</p><div className="mt-2 flex items-center justify-between text-xs"><span className="text-emerald-600">Wins</span><b>{stats?.wins??0}</b></div><div className="mt-1 flex items-center justify-between text-xs"><span className="text-rose-500">Losses</span><b>{stats?.losses??0}</b></div><div className="mt-1 flex items-center justify-between text-xs"><span className="text-sky-500">Draws</span><b>{stats?.draws??0}</b></div></div></div>
  <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><TrendingUp className="h-3.5 w-3.5"/>Win +30 · Loss −25 · Draw +10</div>
  <div className="rounded-xl border border-border/50 p-3"><p className="mb-2 text-xs font-semibold text-foreground">Division levels</p><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-emerald-500/10 p-2"><p className="text-[10px] text-emerald-600">DIVISION 3</p><p className="text-xs font-bold">300–400</p></div><div className="rounded-lg bg-sky-500/10 p-2"><p className="text-[10px] text-sky-600">DIVISION 2</p><p className="text-xs font-bold">401–599</p></div><div className="rounded-lg bg-amber-500/10 p-2"><p className="text-[10px] text-amber-600">DIVISION 1</p><p className="text-xs font-bold">600+</p></div></div></div>
  {badges.filter(b=>isMe||b.show_on_profile).map(b=><div key={b.id} className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><span className="rounded-full bg-amber-500/15 p-2 text-amber-500 text-lg">{b.badge_type?.emoji||"🏅"}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground"><Medal className="mr-1 inline h-4 w-4 text-amber-500"/>{b.badge_name}</p><p className="text-[11px] text-muted-foreground">{b.badge_type?.description|| (b.rank ? "Season ranking award" : "Season achievement")}{b.rank ? " · Rank #"+b.rank : ""}</p></div>{isMe&&<button onClick={()=>void toggleBadge(b)} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold">{b.show_on_profile?"Hide":"Add to profile"}</button>}{!isMe&&b.show_on_profile&&<Award className="h-4 w-4 text-amber-500"/>}</div>)}
  {!rank&&<p className="text-[11px] text-muted-foreground">Starting position · Division 3 with 300 points. Your live rank appears after your first completed online player match.</p>}
 </section>;
}