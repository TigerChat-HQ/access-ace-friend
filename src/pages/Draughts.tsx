import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Users, Crown, Loader2, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Board, Color, Move, applyMove, initialBoard, isDark, legalMoves,
  pickAIMove, winner,
} from "@/lib/draughts";

type Mode = "menu" | "ai" | "pvp";

interface MatchRow {
  id: string;
  player_white: string;
  player_black: string | null;
  vs_ai: boolean;
  board: Board;
  current_turn: Color;
  status: string;
  winner: string | null;
}

const Draughts = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("menu");
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [openMatches, setOpenMatches] = useState<MatchRow[]>([]);
  const [creating, setCreating] = useState(false);
  const channelRef = useRef<any>(null);

  // Load joinable matches
  const loadOpen = async () => {
    const { data } = await supabase
      .from("draft_matches")
      .select("*")
      .eq("status", "waiting")
      .eq("vs_ai", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setOpenMatches((data as any) || []);
  };

  useEffect(() => {
    if (mode === "pvp" && !match) loadOpen();
  }, [mode, match]);

  // Subscribe to match updates
  useEffect(() => {
    if (!match) return;
    const ch = supabase
      .channel(`draft:${match.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "draft_matches", filter: `id=eq.${match.id}` },
        (payload) => setMatch(payload.new as MatchRow),
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [match?.id]);

  const myColor: Color | null = useMemo(() => {
    if (!match || !user) return null;
    if (match.player_white === user.id) return "w";
    if (match.player_black === user.id) return "b";
    return null;
  }, [match, user]);

  const isMyTurn = match && myColor && match.current_turn === myColor && match.status === "active";

  // AI move trigger
  useEffect(() => {
    if (!match || !match.vs_ai) return;
    if (match.status !== "active") return;
    if (match.current_turn !== "b") return; // AI plays black
    setAiThinking(true);
    const t = setTimeout(async () => {
      const aiMove = pickAIMove(match.board, "b", 4);
      if (!aiMove) {
        await supabase.from("draft_matches").update({
          status: "finished",
          winner: "white",
        }).eq("id", match.id);
        setAiThinking(false);
        return;
      }
      const newBoard = applyMove(match.board, aiMove);
      const w = winner(newBoard, "w");
      await supabase.from("draft_matches").update({
        board: newBoard as any,
        current_turn: "w",
        last_move: aiMove as any,
        status: w ? "finished" : "active",
        winner: w === "w" ? "white" : w === "b" ? "black" : null,
      }).eq("id", match.id);
      setAiThinking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [match?.id, match?.current_turn, match?.vs_ai, match?.status]);

  const startAI = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.from("draft_matches").insert({
      player_white: user.id,
      vs_ai: true,
      board: initialBoard() as any,
      current_turn: "w",
      status: "active",
    }).select().single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Could not start", description: error?.message, variant: "destructive" });
      return;
    }
    setMatch(data as any);
    setMode("ai");
  };

  const createPvP = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.from("draft_matches").insert({
      player_white: user.id,
      vs_ai: false,
      board: initialBoard() as any,
      current_turn: "w",
      status: "waiting",
    }).select().single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Could not create", description: error?.message, variant: "destructive" });
      return;
    }
    setMatch(data as any);
    setMode("pvp");
    toast({ title: "Waiting for opponent", description: "Share the lobby — others can join." });
  };

  const joinMatch = async (m: MatchRow) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("draft_matches")
      .update({ player_black: user.id, status: "active" })
      .eq("id", m.id)
      .eq("status", "waiting")
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Could not join", variant: "destructive" });
      return;
    }
    setMatch(data as any);
    setMode("pvp");
  };

  const moves: Move[] = useMemo(() => {
    if (!match || !isMyTurn) return [];
    return legalMoves(match.board, match.current_turn);
  }, [match, isMyTurn]);

  const movesForSelected = useMemo(
    () => (selected == null ? [] : moves.filter((m) => m.from === selected)),
    [moves, selected],
  );

  const onCellClick = async (i: number) => {
    if (!match || !isMyTurn || !myColor) return;
    const piece = match.board[i];
    if (piece && piece.c === myColor) {
      setSelected(i);
      return;
    }
    if (selected == null) return;
    const move = movesForSelected.find((m) => m.to === i);
    if (!move) return;
    const newBoard = applyMove(match.board, move);
    const next: Color = myColor === "w" ? "b" : "w";
    const w = winner(newBoard, next);
    setSelected(null);
    await supabase.from("draft_matches").update({
      board: newBoard as any,
      current_turn: next,
      last_move: move as any,
      status: w ? "finished" : "active",
      winner: w === "w" ? "white" : w === "b" ? "black" : null,
    }).eq("id", match.id);
  };

  const exitMatch = () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    setMatch(null);
    setSelected(null);
    setMode("menu");
  };

  // ---- Render ----
  if (mode === "menu" || !match) {
    return (
      <div className="h-full flex flex-col bg-background">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <button onClick={() => nav(-1)} className="p-1 hover:bg-surface-hover rounded-full">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">Tanzanian Draughts</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mode === "menu" && (
            <>
              <button
                onClick={startAI}
                disabled={creating}
                className="w-full p-4 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/40 flex items-center gap-3 hover:scale-[1.01] transition-transform"
              >
                <Bot className="w-7 h-7 text-primary" />
                <div className="text-left">
                  <p className="font-bold text-foreground">Play vs AI</p>
                  <p className="text-xs text-muted-foreground">Minimax depth 4 — you play white</p>
                </div>
              </button>
              <button
                onClick={() => setMode("pvp")}
                className="w-full p-4 rounded-xl bg-card border border-border/50 flex items-center gap-3 hover:bg-surface-hover transition-colors"
              >
                <Users className="w-7 h-7 text-primary" />
                <div className="text-left">
                  <p className="font-bold text-foreground">Play vs Player</p>
                  <p className="text-xs text-muted-foreground">Realtime online matches</p>
                </div>
              </button>
            </>
          )}
          {mode === "pvp" && !match && (
            <>
              <Button onClick={createPvP} disabled={creating} className="w-full">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create new match"}
              </Button>
              <Button onClick={() => setMode("menu")} variant="outline" className="w-full">Back</Button>
              <p className="text-xs font-semibold text-muted-foreground mt-4">Open matches</p>
              {openMatches.length === 0 && (
                <p className="text-xs text-muted-foreground">No open matches. Create one!</p>
              )}
              {openMatches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => joinMatch(m)}
                  disabled={m.player_white === user?.id}
                  className="w-full p-3 rounded-lg bg-card border border-border/50 flex items-center justify-between text-sm disabled:opacity-50"
                >
                  <span className="text-foreground">Match {m.id.slice(0, 6)}</span>
                  <span className="text-primary text-xs font-semibold">
                    {m.player_white === user?.id ? "Yours" : "Join"}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // Game view
  const validDest = new Set(movesForSelected.map((m) => m.to));
  const turnLabel = match.status === "finished"
    ? `Winner: ${match.winner}`
    : match.current_turn === myColor
      ? "Your turn"
      : aiThinking ? "AI thinking…" : "Opponent's turn";

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <button onClick={exitMatch} className="p-1 hover:bg-surface-hover rounded-full">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">
            {match.vs_ai ? "vs AI" : "Online match"}
          </h1>
          <p className="text-[10px] text-primary">{turnLabel}</p>
        </div>
        {match.status === "finished" && (
          <Button size="sm" onClick={exitMatch}>
            <RotateCw className="w-3.5 h-3.5 mr-1" /> New game
          </Button>
        )}
      </header>

      <div className="flex-1 flex items-center justify-center p-3 bg-gradient-to-br from-background to-surface">
        <div className="aspect-square w-full max-w-[440px] grid grid-cols-8 rounded-lg overflow-hidden shadow-2xl ring-1 ring-primary/30">
          {Array.from({ length: 64 }).map((_, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            const dark = isDark(r, c);
            const piece = match.board[i];
            const sel = selected === i;
            const dest = validDest.has(i);
            return (
              <button
                key={i}
                onClick={() => onCellClick(i)}
                className={`relative flex items-center justify-center transition-colors ${
                  dark ? "bg-amber-900/70" : "bg-amber-100/80"
                } ${sel ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                {piece && (
                  <div
                    className={`w-[78%] h-[78%] rounded-full border-[3px] flex items-center justify-center shadow-lg ${
                      piece.c === "w"
                        ? "bg-gradient-to-br from-white to-zinc-300 border-zinc-400"
                        : "bg-gradient-to-br from-zinc-800 to-black border-zinc-700"
                    }`}
                  >
                    {piece.k && <Crown className={`w-1/2 h-1/2 ${piece.c === "w" ? "text-amber-600" : "text-amber-400"}`} />}
                  </div>
                )}
                {dest && (
                  <span className="absolute w-3 h-3 rounded-full bg-primary/70 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-2 text-[11px] text-center text-muted-foreground border-t border-border/50">
        Forced captures · multi-jump chains · king on last row
      </div>
    </div>
  );
};

export default Draughts;
