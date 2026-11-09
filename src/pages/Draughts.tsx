import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Users, Crown, Loader2, RotateCw, Flag, Share2, Copy, ArrowUpDown, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { BoardAppearance, useDraughtsAppearance } from "@/components/draughts/BoardAppearance";
import { DraughtsGameEffects, playDraughtsSound } from "@/components/draughts/DraughtsGameEffects";
import {
  Board, Color, Move, applyMove, initialBoard, isDark, legalMoves,
  pickAIMove, winner,
} from "@/lib/draughts";

type Mode = "menu" | "ai" | "pvp";

type MatchRow = Omit<Tables<"draft_matches">, "board" | "last_move" | "current_turn"> & {
  board: Board;
  current_turn: Color;
  last_move: Move | null;
  draw_offer_by: string | null;
};

const Draughts = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme, pieceStyle, setPieceStyle, scale, setScale, depth, setDepth, boardStyle, boardSizeStyle, board3dStyle } = useDraughtsAppearance();
  const [mode, setMode] = useState<Mode>("menu");
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [isAdminOpponent, setIsAdminOpponent] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [openMatches, setOpenMatches] = useState<MatchRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [flipBoard, setFlipBoard] = useState<boolean | null>(null);
  const [tigerSupervisorEnabled, setTigerSupervisorEnabled] = useState(true);
  useEffect(() => {
    let alive = true;
    supabase.from("draughts_admin_settings").select("tiger_ai_supervisor_enabled").eq("id", true).maybeSingle()
      .then(({ data }: { data: { tiger_ai_supervisor_enabled?: boolean } | null }) => { if (alive && data) setTigerSupervisorEnabled(data.tiger_ai_supervisor_enabled !== false); });
    const settingsChannel = supabase.channel("draughts-supervisor-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "draughts_admin_settings" }, (payload) => {
        const row = payload.new as { tiger_ai_supervisor_enabled?: boolean };
        setTigerSupervisorEnabled(row.tiger_ai_supervisor_enabled !== false);
      }).subscribe();
    return () => { alive = false; void supabase.removeChannel(settingsChannel); };
  }, []);
  const [soundEnabled, setSoundEnabled] = useState(() => { try { return localStorage.getItem("tiger-draughts-sound") !== "off"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("tiger-draughts-sound", soundEnabled ? "on" : "off"); } catch { /* optional preference */ } }, [soundEnabled]);
  const [soundVolume, setSoundVolume] = useState(() => { try { return Number(localStorage.getItem("tiger-draughts-volume") ?? "0.65"); } catch { return 0.65; } });
  const [reactionVolume, setReactionVolume] = useState(() => { try { return Number(localStorage.getItem("tiger-draughts-reaction-volume") ?? "0.65"); } catch { return 0.65; } });
  useEffect(() => { try { localStorage.setItem("tiger-draughts-volume", String(soundVolume)); } catch { /* optional preference */ } }, [soundVolume]);
  useEffect(() => { try { localStorage.setItem("tiger-draughts-reaction-volume", String(reactionVolume)); } catch { /* optional preference */ } }, [reactionVolume]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const aiMoveInFlight = useRef<string | null>(null);

  // Load joinable matches
  const loadOpen = async () => {
    const { data } = await supabase
      .from("draft_matches")
      .select("*")
      .eq("status", "waiting")
      .eq("vs_ai", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setOpenMatches((data as unknown as MatchRow[] | null) ?? []);
  };

  // Keep the public waiting-room list live across different players' devices.
  useEffect(() => {
    if (mode !== "pvp" || match) return;
    void loadOpen();
    const lobby = supabase
      .channel("draft-lobby")
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_matches" }, () => {
        void loadOpen();
      })
      .subscribe();
    return () => { void supabase.removeChannel(lobby); };
  }, [mode, match?.id]);

  // Deep-link: open shared match
  useEffect(() => {
    const matchId = new URLSearchParams(window.location.search).get("match");
    if (!matchId || !user || match) return;
    (async () => {
      const { data } = await supabase.from("draft_matches").select("*").eq("id", matchId).maybeSingle();
      if (!data) return;
      const row = data as unknown as MatchRow;
      if (row.status === "waiting" && row.player_white !== user.id && !row.player_black && !row.vs_ai) {
        const { data: joined } = await supabase.rpc("join_draft_match", { p_match_id: matchId });
        if (joined) { setMatch(joined as unknown as MatchRow); setMode("pvp"); return; }
        const { data: latest } = await supabase.from("draft_matches").select("*").eq("id", matchId).maybeSingle();
        if (latest) { setMatch(latest as unknown as MatchRow); setMode("pvp"); return; }
      }
      setMatch(row); setMode(row.vs_ai ? "ai" : "pvp");
    })();
  }, [user]);

  // Subscribe to match updates
  useEffect(() => {
    if (!match) return;
    const ch = supabase
      .channel(`draft:${match.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "draft_matches", filter: `id=eq.${match.id}` },
        (payload) => {
          const incoming = payload.new as MatchRow;
          setMatch((current) => !current || incoming.revision >= current.revision ? incoming : current);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Fetch a snapshot after joining the channel so a move made during
          // the subscription handshake cannot leave this client behind.
          void supabase.from("draft_matches").select("*").eq("id", match.id).maybeSingle()
            .then(({ data }) => {
              if (data) {
                const incoming = data as unknown as MatchRow;
                setMatch((current) => !current || incoming.revision >= current.revision ? incoming : current);
              }
            });
        }
      });
    channelRef.current = ch;
    return () => { void supabase.removeChannel(ch); };
  }, [match?.id]);

  const myColor: Color | null = useMemo(() => {
    if (!match || !user) return null;
    if (match.player_white === user.id) return "w";
    if (match.player_black === user.id) return "b";
    return null;
  }, [match, user]);

  const isMyTurn = match && myColor && match.current_turn === myColor && match.status === "active";

  // Enable the branded bottle-cap board only when the opponent is an admin.
  useEffect(() => {
    let alive = true;
    setIsAdminOpponent(false);
    if (!match || match.vs_ai || !user || !match.player_black) return;
    const opponentId = match.player_white === user.id ? match.player_black : match.player_white;
    if (!opponentId || opponentId === user.id) return;
    supabase.from("user_roles").select("role").eq("user_id", opponentId)
      .then(({ data, error }) => {
        if (!alive || error) return;
        setIsAdminOpponent((data ?? []).some((row) => row.role === "admin" || row.role === "superior_admin"));
      });
    return () => { alive = false; };
  }, [match?.id, match?.player_white, match?.player_black, match?.vs_ai, user?.id]);

  // AI move trigger
  useEffect(() => {
    if (!match || !match.vs_ai) return;
    if (match.status !== "active") return;
    if (match.current_turn !== "b") return; // AI plays black
    setAiThinking(true);
    const t = setTimeout(async () => {
      if (aiMoveInFlight.current === match.id) return;
      aiMoveInFlight.current = match.id;
      const aiMove = pickAIMove(match.board, "b", 4);
      if (!aiMove) {
        await supabase.rpc("commit_draft_move", {
          p_id: match.id, p_revision: match.revision, p_board: match.board as unknown as Json,
          p_turn: "b", p_move: null as unknown as Json, p_status: "finished", p_winner: "white",
        });
        aiMoveInFlight.current = null;
        setAiThinking(false);
        return;
      }
      const newBoard = applyMove(match.board, aiMove);
      const w = winner(newBoard, "w");
      const { data: aiSaved } = await supabase.rpc("commit_draft_move", {
        p_id: match.id, p_revision: match.revision, p_board: newBoard as unknown as Json,
        p_turn: "w", p_move: aiMove as unknown as Json,
        p_status: w ? "finished" : "active",
        p_winner: (w === "w" ? "white" : w === "b" ? "black" : null) as string,
      });
      if (aiSaved) {
        if (soundEnabled && !w) playDraughtsSound(aiMove.promote ? "king" : aiMove.captures.length > 0 ? "capture" : "move", soundVolume);
        setMatch(aiSaved as unknown as MatchRow);
      }
      aiMoveInFlight.current = null;
      setAiThinking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [match?.id, match?.current_turn, match?.vs_ai, match?.status, match?.revision, match?.board, soundEnabled, soundVolume]);

  const startAI = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("create_draft_match", { p_vs_ai: true });
    setCreating(false);
    if (error || !data) {
      toast({ title: "Could not start", description: error?.message, variant: "destructive" });
      return;
    }
    setMatch(data as unknown as MatchRow);
    setMode("ai");
  };

  const createPvP = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("create_draft_match", { p_vs_ai: false });
    setCreating(false);
    if (error || !data) {
      toast({ title: "Could not create", description: error?.message, variant: "destructive" });
      return;
    }
    setMatch(data as unknown as MatchRow);
    setMode("pvp");
    toast({ title: "Waiting for opponent", description: "Share the lobby — others can join." });
  };

  const joinMatch = async (m: MatchRow) => {
    if (!user) return;
    const { data, error } = await supabase.rpc("join_draft_match", { p_match_id: m.id });
    if (error || !data) {
      toast({ title: "Could not join", description: error?.message, variant: "destructive" });
      return;
    }
    setMatch(data as unknown as MatchRow);
    setMode("pvp");
  };

  const [codeInput, setCodeInput] = useState("");
  const joinByCode = async () => {
    const code = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 8) { toast({ title: "Enter the 8-character match code", variant: "destructive" }); return; }
    const { data, error } = await supabase.rpc("join_draft_match", { p_code: code });
    if (error || !data) { toast({ title: "Could not join with that code", description: error?.message, variant: "destructive" }); return; }
    setMatch(data as unknown as MatchRow);
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
    const { data, error } = await supabase.rpc("commit_draft_move", {
      p_id: match.id, p_revision: match.revision, p_board: newBoard as unknown as Json,
      p_turn: next, p_move: move as unknown as Json,
      p_status: w ? "finished" : "active",
      p_winner: (w === "w" ? "white" : w === "b" ? "black" : null) as string,
    });
    if (error || !data) {
      toast({ title: "Move not saved", description: error?.message || "The board changed. Please wait for the latest move.", variant: "destructive" });
      const { data: latest } = await supabase.from("draft_matches").select("*").eq("id", match.id).maybeSingle();
      if (latest) setMatch(latest as unknown as MatchRow);
    } else {
      if (soundEnabled && !w) playDraughtsSound(move.promote ? "king" : move.captures.length > 0 ? "capture" : "move", soundVolume);
      setMatch(data as unknown as MatchRow);
    }
  };

  const exitMatch = () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    setMatch(null);
    setSelected(null);
    setFlipBoard(null);
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
          <h1 className="text-base font-bold text-foreground flex-1">Tanzanian Draughts</h1>
          <button onClick={() => nav("/draughts/tournaments")} className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary">Tournaments</button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mode === "menu" && (
            <>
              <button
                onClick={startAI}
                disabled={creating}
                className="w-full p-4 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/40 flex items-center gap-3 hover:scale-[1.01] transition-transform"
              >
                <Bot className="w-7 h-7 text-primary" />
                <div className="text-left">
                  <p className="font-bold text-foreground">Play vs AI</p>
                  <p className="text-xs text-muted-foreground">Tiger AI · White moves first</p>
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
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter match code (e.g. A1B2C3)"
                  aria-label="Match code"
                  maxLength={8}
                  className="flex-1 h-10 px-3 rounded-md bg-card border border-border/50 text-foreground text-sm tracking-widest uppercase"
                />
                <Button onClick={joinByCode}>Join</Button>
              </div>
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
                  <span className="text-foreground">Code <b className="tracking-widest">{m.join_code}</b></span>
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
  // When playing as Black, automatically orient board so black pieces are at the bottom unless manually toggled
  const isFlipped = flipBoard !== null ? flipBoard : myColor === "b";
  const validDest = new Set(movesForSelected.map((m) => m.to));
  const lastFrom = match.last_move?.from;
  const lastTo = match.last_move?.to;
  // Counts of pieces remaining
  let wCount = 0, bCount = 0;
  for (const p of match.board) { if (!p) continue; if (p.c === "w") wCount++; else bCount++; }
  const myCount = myColor === "w" ? wCount : bCount;
  const oppCount = myColor === "w" ? bCount : wCount;

  const winnerLabel = match.status === "finished"
    ? match.winner === "draw" ? "🤝 Draw!" : match.winner === (myColor === "w" ? "white" : "black") ? "🏆 You won!" : "💀 You lost"
    : null;

  const turnLabel = match.status === "finished"
    ? winnerLabel || `Winner: ${match.winner}`
    : !myColor
      ? `Spectating · ${match.current_turn === "w" ? "White" : "Black"} to move`
      : match.current_turn === myColor
        ? "Your turn"
        : aiThinking ? "AI thinking…" : "Opponent's turn";

  const resign = async () => {
    if (!match || !myColor || match.status !== "active") return;
    if (!confirm("Resign this match?")) return;
    const { data } = await supabase.rpc("resign_draft_match", { p_id: match.id });
    if (data) setMatch(data as unknown as MatchRow);
  };

  const offerOrAcceptDraw = async () => {
    if (!match || !myColor || match.status !== "active" || match.vs_ai) return;
    const accepting = !!match.draw_offer_by && match.draw_offer_by !== user?.id;
    const { data, error } = await supabase.rpc(accepting ? "accept_draft_draw" : "offer_draft_draw", { p_id: match.id });
    if (error || !data) {
      toast({ title: "Draw request failed", description: error?.message, variant: "destructive" });
      return;
    }
    setMatch(data as unknown as MatchRow);
    if (!accepting) toast({ title: "Draw offered", description: "Your opponent can accept the draw." });
  };

  const shareMatch = async () => {
    if (!match) return;
    const url = `${window.location.origin}/draughts?match=${match.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Join my draughts match", url });
      else { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); }
    } catch {/* cancelled */}
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <button onClick={exitMatch} className="p-1 hover:bg-surface-hover rounded-full">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-foreground truncate">
            {match.vs_ai ? "vs Tiger AI" : match.status === "waiting" ? "Waiting for opponent…" : "Online match"}
          </h1>
          <p className="text-[10px] text-primary">{turnLabel}</p>
        </div>
        <button
          onClick={() => setFlipBoard(!isFlipped)}
          className={`p-2 rounded-full transition-colors ${isFlipped ? "bg-primary/20 text-primary" : "hover:bg-surface-hover text-foreground"}`}
          title={isFlipped ? "Normal view (White at bottom)" : "Flip board (Black at bottom)"}
          aria-label="Flip board perspective"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
        {!match.vs_ai && match.status !== "finished" && (
          <button onClick={shareMatch} className="p-2 rounded-full hover:bg-surface-hover" title="Share match">
            <Share2 className="w-4 h-4 text-foreground" />
          </button>
        )}
        {match.status === "active" && myColor && !match.vs_ai && (
          <button onClick={offerOrAcceptDraw} disabled={!!match.draw_offer_by && match.draw_offer_by === user?.id}
            className="p-2 rounded-full hover:bg-primary/10 disabled:opacity-50"
            title={match.draw_offer_by && match.draw_offer_by !== user?.id ? "Accept draw" : match.draw_offer_by ? "Draw offered" : "Offer draw"}>
            <Handshake className="w-4 h-4 text-primary" />
          </button>
        )}
        {match.status === "active" && myColor && (
          <button onClick={resign} className="p-2 rounded-full hover:bg-destructive/20" title="Resign">
            <Flag className="w-4 h-4 text-destructive" />
          </button>
        )}
        {match.status === "finished" && (
          <Button size="sm" onClick={exitMatch}>
            <RotateCw className="w-3.5 h-3.5 mr-1" /> New game
          </Button>
        )}
      </header>

      {!match.vs_ai && match.status === "waiting" && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-primary/30 bg-primary/10">
          <div>
            <p className="text-[10px] text-muted-foreground">Share this code with your opponent</p>
            <p className="text-lg font-bold tracking-[0.3em] text-primary">{match.join_code}</p>
          </div>
          <Button size="sm" variant="outline" onClick={async () => {
            await navigator.clipboard.writeText(match.join_code);
            toast({ title: "Code copied" });
          }}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy
          </Button>
        </div>
      )}

      {/* Score bar */}
      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-border/50 bg-card/30">
        <div className={`flex items-center gap-2 p-2 rounded-lg ${match.current_turn === "w" && match.status === "active" ? "bg-primary/15 ring-1 ring-primary/40" : "bg-surface/40"}`}>
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-white to-zinc-300 border border-zinc-400 shadow" />
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground">{myColor === "w" ? "You (White)" : myColor === "b" ? "Opponent (White)" : "White"}</p>
            <p className="text-sm font-bold text-foreground">{wCount} <span className="text-[10px] font-normal text-muted-foreground">pieces</span></p>
          </div>
        </div>
        <div className={`flex items-center gap-2 p-2 rounded-lg ${match.current_turn === "b" && match.status === "active" ? "bg-primary/15 ring-1 ring-primary/40" : "bg-surface/40"}`}>
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-zinc-800 to-black border border-zinc-700 shadow" />
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground">{myColor === "b" ? "You (Black)" : myColor === "w" ? (match.vs_ai ? "Tiger AI" : "Opponent (Black)") : "Black"}</p>
            <p className="text-sm font-bold text-foreground">{bCount} <span className="text-[10px] font-normal text-muted-foreground">pieces</span></p>
          </div>
        </div>
      </div>

      {tigerSupervisorEnabled && (
        <div className="mx-3 mt-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold text-foreground">Tiger AI · Game Supervisor</p>
            <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">OBSERVING</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {match.status === "finished"
              ? match.winner === "draw" ? "Tiger AI acknowledges this game as a draw. The result is recorded in the match." : `Tiger AI acknowledges the result: ${match.winner === "white" ? "White" : "Black"} wins. The match result is recorded.`
              : match.status === "waiting" ? "Tiger AI acknowledges this match lobby and is waiting for both players." : `Tiger AI is supervising the live board · Move updates: ${match.revision}. It observes and acknowledges only; it does not control player moves or alter scores.`}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-4 pt-3"><p className="text-xs font-medium text-muted-foreground">Live board appearance</p><BoardAppearance theme={theme} setTheme={setTheme} pieceStyle={pieceStyle} setPieceStyle={setPieceStyle} scale={scale} setScale={setScale} depth={depth} setDepth={setDepth} soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} soundVolume={soundVolume} setSoundVolume={setSoundVolume} reactionVolume={reactionVolume} setReactionVolume={setReactionVolume} /></div>
      <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-3 sm:p-5 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.10),transparent_68%)]">
        <div style={{ ...boardStyle, ...boardSizeStyle, ...board3dStyle }} className="draught-frame w-full max-w-none rounded-[22px] p-2 sm:p-3 shadow-[0_22px_45px_-16px_rgba(0,0,0,0.85),inset_0_2px_3px_rgba(255,255,255,0.55),inset_0_-5px_10px_rgba(0,0,0,0.65)] ring-1 ring-white/30">
          <div className="aspect-square w-full grid grid-cols-8 overflow-hidden rounded-md border-[3px] border-black/50 shadow-[inset_0_4px_12px_rgba(0,0,0,0.55)]">
            {Array.from({ length: 64 }).map((_, gridIdx) => {
              const i = isFlipped ? 63 - gridIdx : gridIdx;
              const r = Math.floor(i / 8), c = i % 8;
              const dark = isDark(r, c);
              const piece = match.board[i];
              const sel = selected === i;
              const dest = validDest.has(i);
              const isLast = i === lastFrom || i === lastTo;
              return (
                <button
                  key={i}
                  aria-label={`Square ${i + 1}${piece ? ` ${piece.c === "w" ? "white" : "black"} piece` : " empty"}`}
                  onClick={() => onCellClick(i)}
                  className={`relative aspect-square flex items-center justify-center overflow-hidden transition-all duration-150 active:brightness-125 ${dark ? "draught-dark" : "draught-light"} ${sel ? "z-10 ring-2 ring-yellow-300 ring-inset brightness-125" : ""} ${isLast && !sel ? "ring-2 ring-yellow-200/70 ring-inset" : ""}`}
                >
                  {dest && <span className={`absolute z-0 rounded-full bg-primary/70 shadow-[0_0_12px_hsl(var(--primary)/0.8)] animate-pulse ${piece ? "inset-0 opacity-35 rounded-none" : "w-3 h-3 sm:w-4 sm:h-4"}`} />}
                  {piece && (
                    <div className={`relative z-[1] ${isAdminOpponent ? "w-[88%]" : "w-[82%]"} aspect-square transition-transform duration-150 ${sel ? "scale-110 -translate-y-1" : ""}`}>
                      {isAdminOpponent ? (
                        <>
                          <img
                            src={piece.c === "w" ? "/assets/coca-cola-cap.png" : "/assets/pepsi-cap.png"}
                            alt=""
                            draggable={false}
                            className="pointer-events-none h-full w-full select-none object-contain"
                          />
                          {piece.k && (
                            <span className="absolute right-[5%] top-[5%] z-[2] flex h-[30%] w-[30%] items-center justify-center rounded-full border border-amber-200 bg-gradient-to-br from-amber-100 via-yellow-400 to-amber-800 text-amber-950 shadow-md">
                              <Crown className="h-[78%] w-[78%] drop-shadow-sm" />
                            </span>
                          )}
                        </>
                      ) : (
                        <div className={`relative h-full w-full rounded-full flex items-center justify-center overflow-hidden ${piece.c === "w" ? "draught-piece-online-white" : "draught-piece-online-black"}`}>
                          <span className="absolute left-[18%] top-[12%] h-[15%] w-[30%] rounded-full bg-white/55 blur-[2px]" />
                          {piece.k && <span className="absolute inset-0 z-[2] flex items-center justify-center bg-black/10"><span className="flex h-[58%] w-[58%] items-center justify-center rounded-full border border-amber-300/90 bg-gradient-to-br from-amber-100 via-yellow-500 to-amber-900 shadow-[inset_0_1px_3px_rgba(255,255,255,.8),0_2px_4px_rgba(0,0,0,.65)]"><Crown className="h-[72%] w-[72%] text-amber-950 drop-shadow-sm" /></span></span>}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {match.status === "finished" && (
        <div className="px-4 py-3 text-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-t border-primary/30">
          <p className="text-base font-bold text-foreground">{winnerLabel || `Winner: ${match.winner}`}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Pieces left — White: {wCount} · Black: {bCount}</p>
        </div>
      )}

      <DraughtsGameEffects matchId={match.id} isFinished={match.status === "finished"} isWinner={Boolean(myColor && match.winner === (myColor === "w" ? "white" : "black"))} isLoser={Boolean(myColor && match.status === "finished" && match.winner !== (myColor === "w" ? "white" : "black"))} soundEnabled={soundEnabled} soundVolume={soundVolume} reactionVolume={reactionVolume} />

      {match.status !== "finished" && (
        <div className="px-4 py-2 text-[11px] text-center text-muted-foreground border-t border-border/50">
          Forced captures · multi-jump chains · king on last row
        </div>
      )}
    </div>
  );
};

export default Draughts;
