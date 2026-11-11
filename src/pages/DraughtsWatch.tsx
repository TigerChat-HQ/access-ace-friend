import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Radio, Eye, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Board, type Color } from "@/lib/draughts";

type LiveMatch = { id:string; player_white:string; player_black:string|null; board:Board; current_turn:Color; status:string; winner:string|null; vs_ai:boolean; revision:number; updated_at:string };
type PlayerProfile = { user_id:string; display_name:string|null; username:string|null };

export default function DraughtsWatch() {
 const { matchId } = useParams();
 const nav = useNavigate();
 const [matches,setMatches] = useState<LiveMatch[]>([]);
 const [match,setMatch] = useState<LiveMatch|null>(null);
 const [profiles,setProfiles] = useState<Record<string,string>>({});
 const [loading,setLoading] = useState(true);
 const loadMatches = useCallback(async () => {
  const {data} = await supabase.from("draft_matches").select("id,player_white,player_black,board,current_turn,status,winner,vs_ai,revision,updated_at").eq("status","active").order("updated_at",{ascending:false}).limit(30);
  const rows=(data??[]) as unknown as LiveMatch[];
  setMatches(rows);
  const ids=Array.from(new Set(rows.flatMap(row=>[row.player_white,row.player_black].filter(Boolean) as string[])));
  if(ids.length){const {data:people}=await supabase.from("profiles").select("user_id,display_name,username").in("user_id",ids);setProfiles(Object.fromEntries(((people??[]) as PlayerProfile[]).map(person=>[person.user_id,person.display_name||person.username||"Player"])));}
  setLoading(false);
 },[]);
 useEffect(()=>{void loadMatches();},[loadMatches]);
 useEffect(()=>{
  if(!matchId){setMatch(null);return;}
  let alive=true;
  const fetchMatch=async()=>{const {data}=await supabase.from("draft_matches").select("id,player_white,player_black,board,current_turn,status,winner,vs_ai,revision,updated_at").eq("id",matchId).maybeSingle();if(alive)setMatch(data as unknown as LiveMatch|null);};
  void fetchMatch();
  const channel=supabase.channel(`draughts-watch-${matchId}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"draft_matches",filter:`id=eq.${matchId}`},payload=>setMatch(payload.new as LiveMatch)).subscribe();
  return()=>{alive=false;void supabase.removeChannel(channel);};
 },[matchId]);
 if(matchId && match) return <div className="min-h-full bg-background">
  <header className="tiger-page-header"><button onClick={()=>nav("/draughts/watch")} className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5"/></button><div className="min-w-0 flex-1"><h1 className="truncate text-base font-bold">Live Spectator</h1><p className="text-[10px] text-primary">Read-only · Move {match.revision}</p></div><Radio className="h-5 w-5 text-emerald-500"/></header>
  <main className="mx-auto flex max-w-xl flex-col gap-3 p-4 pb-24">
   <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">White</p><p className="truncate text-sm font-bold">{profiles[match.player_white]||"Player"}</p></div><div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Black</p><p className="truncate text-sm font-bold">{match.vs_ai?"Tiger AI":profiles[match.player_black||""]||"Player"}</p></div></div>
   <div className="rounded-2xl border border-border bg-card p-3"><div className="mx-auto grid aspect-square w-full max-w-[480px] grid-cols-8 overflow-hidden rounded-lg border-4 border-amber-950/70">{match.board.map((piece,index)=>{const dark=(Math.floor(index/8)+index%8)%2===1;return <div key={index} className={`flex items-center justify-center ${dark?"bg-[#87502e]":"bg-[#e7c99f]"}`}>{piece&&<div className={`relative h-[82%] w-[82%] rounded-full border-2 shadow-lg ${piece.c==="w"?"border-zinc-300 bg-gradient-to-br from-white to-zinc-400":"border-slate-950 bg-gradient-to-br from-slate-600 to-black"}`}>{piece.k&&<span className="absolute inset-0 flex items-center justify-center text-base font-black text-amber-300">♛</span>}</div>}</div>;})}</div></div>
   <p className="text-center text-xs text-muted-foreground">{match.status==="active"?(match.current_turn==="w"?"White to move":"Black to move"):`Match finished · ${match.winner||"Result pending"}`}</p>
   <Button variant="outline" onClick={()=>nav("/draughts/watch")}>Back to live games</Button>
  </main>
 </div>;
 return <div className="min-h-full bg-background"><header className="tiger-page-header"><button onClick={()=>nav("/draughts")} className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5"/></button><h1 className="flex-1 text-base font-bold">Watch Live Draughts</h1><button onClick={()=>void loadMatches()} className="rounded-lg p-2 hover:bg-surface-hover" aria-label="Refresh"><RefreshCw className="h-4 w-4"/></button></header><main className="mx-auto max-w-2xl space-y-3 p-4 pb-24"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground"><Eye className="mr-2 inline h-4 w-4 text-emerald-500"/>Watch public active matches live. Spectators cannot move pieces or affect match results.</div>{matches.map(item=><button key={item.id} onClick={()=>nav(`/draughts/watch/${item.id}`)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"><span className="rounded-full bg-emerald-500/10 p-2"><Radio className="h-4 w-4 text-emerald-500"/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{profiles[item.player_white]||"Player"} vs {item.vs_ai?"Tiger AI":profiles[item.player_black||""]||"Player"}</span><span className="text-[10px] text-muted-foreground">Move {item.revision} · {item.current_turn==="w"?"White":"Black"} to move</span></span><span className="text-xs font-bold text-primary">Watch</span></button>)}{!loading&&matches.length===0&&<p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No live matches right now. Come back later.</p>}</main></div>;
}
