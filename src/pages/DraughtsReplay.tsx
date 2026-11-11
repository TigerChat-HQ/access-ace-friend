import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Board, initialBoard } from "@/lib/draughts";

type ReplayMove = { revision: number; move: { from: number; to: number; captures?: number[]; promote?: boolean }; board: Board; created_at: string };

export default function DraughtsReplay() {
  const { matchId = "" } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const [moves, setMoves] = useState<ReplayMove[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    supabase.from("draughts_match_moves" as any).select("revision,move,board,created_at").eq("match_id", matchId).order("revision")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast({ title: "Replay could not load", description: error.message, variant: "destructive" });
        setMoves((data ?? []) as ReplayMove[]);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [matchId, toast]);
  const board = useMemo(() => step === 0 ? initialBoard() : moves[step - 1]?.board ?? initialBoard(), [step, moves]);
  const current = moves[step - 1];
  return <div className="min-h-full bg-background">
    <header className="tiger-page-header">
      <button onClick={() => nav(-1)} className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
      <h1 className="flex-1 truncate text-base font-bold">Draughts · Match Replay</h1>
      <button onClick={() => { setStep(0); }} className="rounded-lg p-2 hover:bg-surface-hover" aria-label="Restart replay"><RefreshCw className="h-4 w-4" /></button>
    </header>
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-24">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mx-auto grid aspect-square w-full max-w-[480px] grid-cols-8 overflow-hidden rounded-lg border-4 border-amber-950/70 shadow-2xl">
          {board.map((piece, index) => {
            const dark = (Math.floor(index / 8) + index % 8) % 2 === 1;
            const last = current && (current.move.from === index || current.move.to === index);
            return <div key={index} className={`relative flex items-center justify-center ${dark ? "bg-[#87502e]" : "bg-[#e7c99f]"} ${last ? "ring-2 ring-inset ring-yellow-300" : ""}`}>
              {piece && <div className={`relative h-[82%] w-[82%] rounded-full border-2 shadow-lg ${piece.c === "w" ? "border-zinc-300 bg-gradient-to-br from-white to-zinc-400" : "border-slate-950 bg-gradient-to-br from-slate-600 to-black"}`}>
                {piece.k && <span className="absolute inset-0 flex items-center justify-center text-base font-black text-amber-300">♛</span>}
              </div>}
            </div>;
          })}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-sm font-bold">Move {step} / {moves.length}</p><p className="text-xs text-muted-foreground">{current ? `From ${current.move.from + 1} to ${current.move.to + 1}${current.move.promote ? " · King promotion" : ""}` : "Initial board"}</p></div>
          <div className="flex gap-2"><Button size="icon" variant="outline" disabled={step===0} onClick={()=>setStep(v=>Math.max(0,v-1))}><ChevronLeft className="h-4 w-4"/></Button><Button size="icon" disabled={step>=moves.length} onClick={()=>setStep(v=>Math.min(moves.length,v+1))}><ChevronRight className="h-4 w-4"/></Button></div>
        </div>
        <input aria-label="Replay move" className="mt-4 w-full accent-primary" type="range" min="0" max={Math.max(0,moves.length)} value={step} onChange={event=>setStep(Number(event.target.value))}/>
        {loading && <p className="mt-2 text-xs text-muted-foreground">Loading replay…</p>}
        {!loading && moves.length===0 && <p className="mt-2 text-xs text-muted-foreground">No replay moves found, or this match is not yours.</p>}
      </div>
      <Button variant="outline" onClick={()=>nav("/draughts/rewards")}>Back to Arena</Button>
    </main>
  </div>;
}
