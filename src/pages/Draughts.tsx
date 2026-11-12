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
  winner,
} from "@/lib/draughts";

type Mode = "menu" | "ai" | "pvp";

type MatchRow = Omit<Tables<"draft_matches">, "board" | "last_move" | "current_turn"> & {
  board: Board;
  current_turn: Color;
  last_move: Move | null;
  draw_offer_by: string | null;
  initial_clock_seconds?: number | null;
  increment_seconds?: number | null;
  white_clock_ms?: number | null;
  black_clock_ms?: number | null;
  clock_started_at?: string | null;
};


const queueRpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const emoteFrom = supabase.from as unknown as (table: string) => {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        limit: (count: number) => Promise<{ data: unknown[] | null }>;
      };
    };
  };
  insert: (values: Record<string, string>) => Promise<{ error: { message: string } | null }>;
};
const queueTable = supabase.from as unknown as (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status: string; match_id: string | null } | null; error: { message: string } | null }> } } };

const Draughts = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme, pieceStyle, setPieceStyle, scale, setScale, depth, setDepth, boardStyle, boardSizeStyle, board3dStyle } = useDraughtsAppearance();
  const [mode, setMode] = useState<Mode>("menu");
  const [match, setMatch] = useState<MatchRow | null>(null);
  const showBrandedPieces = true; // Coca-Cola and Pepsi caps are available to every player.
  const [selected, setSelected] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [openMatches, setOpenMatches] = useState<MatchRow[]>([]);
  const [queueTicket, setQueueTicket] = useState<string | null>(null);
  const [queueSearching, setQueueSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "expert">("medium");
  const [flipBoard, setFlipBoard] = useState<boolean | null>(null);
  const [tigerSupervisorEnabled, setTigerSupervisorEnabled] = useState(true);
  const [matchEmotes, setMatchEmotes] = useState<Array<{id:string;user_id:string;emote_key:string;created_at:string}>>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting"|"live"|"reconnecting">("connecting");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const timeoutClaimed = useRef<string | null>(null);
  useEffect(() => {
    if (!match || match.status !== "active" || !match.initial_clock_seconds || !match.clock_started_at) return;
    const base = match.current_turn === "w" ? match.white_clock_ms : match.black_clock_ms;
    if (base == null) return;
    const remaining = base - Math.max(0, Date.now() - new Date(match.clock_started_at).getTime());
    const key = `${match.id}:${match.revision}`;
    if (remaining > 0 || timeoutClaimed.current === key) return;
    timeoutClaimed.current = key;
    void queueRpc("claim_draughts_timeout", { p_id: match.id }).then(({ data, error }) => {
      if (error) {
        window.setTimeout(() => {
          if (timeoutClaimed.current === key) timeoutClaimed.current = null;
          setClockNow(Date.now());
        }, 2500);
        return;
      }
      if (data) setMatch(data as MatchRow);
    });
  }, [clockNow, match?.id, match?.revision, match?.status, match?.current_turn, match?.clock_started_at, match?.white_clock_ms, match?.black_clock_ms, match?.initial_clock_seconds]);
  useEffect(() => {
    if (!match || match.status !== "active" || !match.initial_clock_seconds) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [match?.id, match?.status, match?.initial_clock_seconds]);
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
    const { data, error } = await supabase
      .from("draft_matches")
      .select("*")
      .eq("status", "waiting")
      .eq("vs_ai", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setOpenMatches([]);
      toast({ title: "Could not load online matches", description: error.message, variant: "destructive" });
      return;
    }
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

  useEffect(() => {
    if (!match || match.status !== "active" || !user) { setMatchEmotes([]); return; }
    let alive = true;
    const load = async () => {
      const { data } = await emoteFrom("draughts_match_emotes")
        .select("id,user_id,emote_key,created_at").eq("match_id", match.id)
        .order("created_at", { ascending: false }).limit(8);
      if (alive) setMatchEmotes((data ?? []) as unknown as typeof matchEmotes);
    };
    void load();
    const channel = supabase.channel(`draughts-emotes:${match.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "draughts_match_emotes", filter: `match_id=eq.${match.id}` },
        payload => setMatchEmotes(current => [payload.new as typeof current[number], ...current].slice(0, 8)))
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [match?.id, match?.status, user?.id]);

  const sendMatchEmote = async (emoteKey: string) => {
    if (!match || !user || match.status !== "active") return;
    const { error } = await emoteFrom("draughts_match_emotes")
      .insert({ match_id: match.id, user_id: user.id, emote_key: emoteKey });
    if (error) toast({ title: "Reaction not sent", description: error.message, variant: "destructive" });
  };

  const myColor: Color | null = useMemo(() => {
    if (!match || !user) return null;
    if (match.player_white === user.id) return "w";
    if (match.player_black === user.id) return "b";
    return null;
  }, [match, user]);

  const isMyTurn = match && myColor && match.current_turn === myColor && match.status === "active";



  // AI move is calculated and committed by the trusted Edge Function.
  // The browser never submits an AI-side move or an asserted board.
  useEffect(() => {
    if (!match || !match.vs_ai || match.status !== "active" || match.current_turn !== "b" || !user) return;
    const key = `${match.id}:${match.revision}`;
    if (aiMoveInFlight.current === key) return;
    setAiThinking(true);
    const t = window.setTimeout(async () => {
      aiMoveInFlight.current = key;
      try {
        const { data, error } = await supabase.functions.invoke("draughts-ai-turn", {
          body: { match_id: match.id, revision: match.revision, difficulty: aiDifficulty },
        });
        if (error) throw error;
        if (data?.match) {
          const saved = data.match as MatchRow;
          setMatch((current) => !current || saved.revision >= current.revision ? saved : current);
          const move = data.move as Move | null;
          if (move && soundEnabled) playDraughtsSound(move.promote ? "king" : move.captures?.length ? "capture" : "move", soundVolume);
        }
      } catch (error) {
        toast({ title: "AI move could not be completed", description: error instanceof Error ? error.message : "Please retry.", variant: "destructive" });
      } finally {
        if (aiMoveInFlight.current === key) aiMoveInFlight.current = null;
        setAiThinking(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [match?.id, match?.current_turn, match?.vs_ai, match?.status, match?.revision, user?.id, aiDifficulty, soundEnabled, soundVolume, toast]);

  const startAI = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_draft_match", { p_vs_ai: true });
      if (error || !data) {
        toast({ title: "Could not start Draughts", description: error?.message || "The match could not be created. Check your connection and try again.", variant: "destructive" });
        return;
      }
      setMatch(data as unknown as MatchRow);
      setMode("ai");
    } catch (error) {
      toast({ title: "Draughts could not open", description: error instanceof Error ? error.message : "Network error. Please try again.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const createPvP = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_draft_match", { p_vs_ai: false });
      if (error || !data) {
        toast({ title: "Could not create match", description: error?.message || "The lobby could not be created. Check your connection and try again.", variant: "destructive" });
        return;
      }
      setMatch(data as unknown as MatchRow);
      setMode("pvp");
      toast({ title: "Waiting for opponent", description: "Share the lobby — others can join." });
    } catch (error) {
      toast({ title: "Draughts lobby could not open", description: error instanceof Error ? error.message : "Network error. Please try again.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const quickMatch = async () => {
    if (!user || creating || queueSearching) return;
    setQueueSearching(true);
    try {
      const { data, error } = await queueRpc("enqueue_draughts_match", {
        p_rating: 1000, p_clock_seconds: 600, p_increment_seconds: 5, p_region: null,
      });
      if (error) throw error;
      const result = data as { status?: string; queue_id?: string; match_id?: string };
      if (result.status === "matched" && result.match_id) {
        const { data: joined, error: loadError } = await supabase.from("draft_matches").select("*").eq("id", result.match_id).single();
        if (loadError || !joined) throw loadError ?? new Error("Matched game could not be loaded");
        setMatch(joined as unknown as MatchRow);
        setMode("pvp");
        toast({ title: "Opponent found", description: "Your 10+5 rated Draughts match is ready." });
      } else if (result.status === "queued" && result.queue_id) {
        setQueueTicket(result.queue_id);
        toast({ title: "Searching for opponent", description: "We are matching you with a player near your rating." });
      } else {
        throw new Error("Unexpected matchmaking response");
      }
    } catch (error) {
      toast({
        title: "Matchmaking is not ready",
        description: error instanceof Error ? error.message : "Could not enter the queue. You can still create or join an open room.",
        variant: "destructive",
      });
      // Keep the existing lobby flow available if the matchmaking RPC is not deployed yet.
      const candidate = openMatches.find((item) => item.player_white !== user.id && !item.player_black);
      if (candidate) await joinMatch(candidate);
      else await createPvP();
    } finally {
      setQueueSearching(false);
    }
  };

  const cancelQueue = async () => {
    const { error } = await queueRpc("cancel_draughts_match_queue", {});
    if (error) {
      toast({ title: "Could not cancel search", description: error.message, variant: "destructive" });
      return;
    }
    setQueueTicket(null);
    toast({ title: "Match search cancelled" });
  };

  useEffect(() => {
    if (!queueTicket || !user) return;
    let alive = true;
    const poll = async () => {
      const { data, error } = await queueTable("draughts_match_queue")
        .select("status,match_id").eq("id", queueTicket).maybeSingle();
      if (!alive || error || !data) return;
      if (data.status === "matched" && data.match_id) {
        const { data: row } = await supabase.from("draft_matches").select("*").eq("id", data.match_id).maybeSingle();
        if (alive && row) {
          setMatch(row as unknown as MatchRow);
          setMode("pvp");
          setQueueTicket(null);
          toast({ title: "Opponent found", description: "Your Draughts match is ready." });
        }
      } else if (data.status === "expired" || data.status === "cancelled") {
        setQueueTicket(null);
        toast({ title: "Match search ended", description: "No opponent was found. Try again." });
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => { alive = false; window.clearInterval(timer); };
  }, [queueTicket, user?.id]);

  const joinMatch = async (m: MatchRow) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc("join_draft_match", { p_match_id: m.id });
      if (error || !data) {
        toast({ title: "Could not join match", description: error?.message || "This match may already be full. Refresh the lobby and try again.", variant: "destructive" });
        return;
      }
      setMatch(data as unknown as MatchRow);
      setMode("pvp");
    } catch (error) {
      toast({ title: "Could not open match", description: error instanceof Error ? error.message : "Network error. Please try again.", variant: "destructive" });
    }
  };

  const [codeInput, setCodeInput] = useState("");
  const joinByCode = async () => {
    const code = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 8) { toast({ title: "Enter the 8-character match code", variant: "destructive" }); return; }
    try {
      const { data, error } = await supabase.rpc("join_draft_match", { p_code: code });
      if (error || !data) { toast({ title: "Could not join with that code", description: error?.message || "Check the code and try again.", variant: "destructive" }); return; }
      setMatch(data as unknown as MatchRow);
      setMode("pvp");
    } catch (error) {
      toast({ title: "Could not open match", description: error instanceof Error ? error.message : "Network error. Please try again.", variant: "destructive" });
    }
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
    if (match && match.status !== "finished" && !window.confirm("Una uhakika unataka kutoka kwenye mechi ya Draughts? Chagua Cancel ili uendelee na mechi.")) return;
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
        <header className="tiger-page-header">
          <button onClick={() => nav("/games")} className="tiger-header-action hover:bg-surface-hover" aria-label="Back to Games Arena">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold text-foreground">Draughts Arena</h1>
          <div className="flex shrink-0 items-center gap-1"><button onClick={() => nav("/games")} className="rounded-lg bg-primary/10 px-2 py-2 text-[11px] font-bold text-primary">Games</button><button onClick={() => nav("/draughts/rewards")} className="rounded-lg bg-amber-500/10 px-2 py-2 text-[11px] font-bold text-amber-500">Rewards</button><button onClick={() => nav("/draughts/watch")} className="rounded-lg bg-emerald-500/10 px-2 py-2 text-[11px] font-bold text-emerald-500">Watch</button><button onClick={() => nav("/draughts/tournaments")} className="rounded-lg bg-primary/10 px-2 py-2 text-[11px] font-bold text-primary">Tournaments</button></div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mode === "menu" && (
            <>
              <div className="rounded-xl border border-border bg-card p-3">
                <label htmlFor="draughts-ai-level" className="mb-2 block text-xs font-bold text-muted-foreground">TIGER AI DIFFICULTY</label>
                <select id="draughts-ai-level" value={aiDifficulty} onChange={(event) => setAiDifficulty(event.target.value as typeof aiDifficulty)} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground">
                  <option value="easy">Easy · Beginner</option><option value="medium">Medium · Balanced</option><option value="hard">Hard · Advanced</option><option value="expert">Expert · Challenge</option>
                </select>
                <p className="mt-2 text-[10px] text-muted-foreground">Kiwango hiki hubadilisha kina cha uchambuzi wa Tiger AI kabla ya kuanza mechi.</p>
              </div>
              <button
                onClick={startAI}
                disabled={creating}
                className="w-full p-4 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/40 flex items-center gap-3 hover:scale-[1.01] transition-transform"
              >
                <Bot className="w-7 h-7 text-primary" />
                <div className="text-left">
                  <p className="font-bold text-foreground">Play vs AI</p>
                  <p className="text-xs text-muted-foreground">Tiger AI · White moves first · {aiDifficulty.toUpperCase()}</p>
                </div>
              </button>
              <button
                onClick={() => nav("/tanzanian-draft-game")}
                className="w-full p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center gap-3 hover:bg-emerald-500/15 transition-colors"
              >
                <Bot className="w-7 h-7 text-emerald-500" />
                <div className="text-left">
                  <p className="font-bold text-foreground">Play Offline vs Tiger AI</p>
                  <p className="text-xs text-muted-foreground">Local AI · No internet needed after first load</p>
                </div>
              </button>
              <button
                onClick={() => setMode("pvp")}
                className="w-full p-4 rounded-xl bg-card border border-border/50 flex items-center gap-3 hover:bg-surface-hover transition-colors"
              >
                <Users className="w-7 h-7 text-primary" />
                <div className="text-left">
                  <p className="font-bold text-foreground">Play Online vs Player</p>
                  <p className="text-xs text-muted-foreground">Requires internet · Realtime matches</p>
                </div>
              </button>
            </>
          )}
          {mode === "pvp" && !match && (
            <>
              <Button onClick={quickMatch} disabled={creating || queueSearching || !!queueTicket} className="w-full">{queueSearching ? "Joining matchmaking…" : queueTicket ? "Searching for opponent…" : "Quick Match · Find opponent"}</Button>
              {queueTicket && <Button onClick={() => void cancelQueue()} variant="outline" className="w-full">Cancel opponent search</Button>}
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

  const rematch = async () => {
    if (!match || !user || creating) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_draft_match", { p_vs_ai: match.vs_ai });
      if (error || !data) throw error ?? new Error("Could not create the rematch.");
      setMatch(data as unknown as MatchRow);
      setSelected(null);
      setFlipBoard(null);
      setMode(match.vs_ai ? "ai" : "pvp");
      toast({
        title: match.vs_ai ? "New AI match ready" : "Rematch room created",
        description: match.vs_ai ? "A fresh game against Tiger AI has started." : "Share the new room code with your previous opponent to play again.",
      });
    } catch (error) {
      toast({ title: "Rematch unavailable", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
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
      <header className="tiger-page-header">
        <button onClick={exitMatch} className="tiger-header-action hover:bg-surface-hover" aria-label="Exit match">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="min-w-0 flex-1">
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
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exitMatch}>Menu</Button>
            <Button size="sm" onClick={rematch} disabled={creating}>
              <RotateCw className="w-3.5 h-3.5 mr-1" /> {creating ? "Preparing…" : "Rematch"}
            </Button>
          </div>
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

      <div className="flex items-center justify-end px-4 pt-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${realtimeStatus==="live"?"bg-emerald-500/10 text-emerald-600":"bg-amber-500/10 text-amber-600"}`}>
          {realtimeStatus==="live"?"● Live · synced":realtimeStatus==="connecting"?"Connecting…":"Reconnecting · syncing board"}
        </span>
      </div>

      {match.status === "active" && match.initial_clock_seconds != null && (
        <section className="grid grid-cols-2 gap-2 px-3 pt-2" aria-label="Match clocks">
          {(["w", "b"] as const).map((side) => {
            const base = side === "w" ? (match.white_clock_ms ?? match.initial_clock_seconds! * 1000) : (match.black_clock_ms ?? match.initial_clock_seconds! * 1000);
            const running = match.current_turn === side && !!match.clock_started_at;
            const elapsed = running ? Math.max(0, clockNow - new Date(match.clock_started_at!).getTime()) : 0;
            const remaining = Math.max(0, base - elapsed);
            const seconds = Math.ceil(remaining / 1000);
            return (
              <div key={side} className={`rounded-xl border p-2 text-center ${running ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <p className="text-[10px] text-muted-foreground">{side === "w" ? "White clock" : "Black clock"}</p>
                <p className={`font-mono text-xl font-black tabular-nums ${seconds <= 10 ? "text-destructive" : "text-foreground"}`}>
                  {Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}
                </p>
                <p className="text-[9px] text-muted-foreground">{running ? "Running" : "Paused"}</p>
              </div>
            );
          })}
        </section>
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

      {match.status === "active" && myColor && !match.vs_ai && (
        <section className="mx-3 mt-3 rounded-xl border border-border bg-card/80 p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold">Live match reactions</p><span className="text-[10px] text-muted-foreground">Opponent can see these</span></div>
          <div className="flex flex-wrap gap-2">
            {[["gg","👏"],["well_played","💯"],["thinking","🤔"],["wow","😮"],["oops","😅"],["clap","🙌"],["tiger","🐯"],["laugh","😂"]].map(([key,emoji]) => (
              <button key={key} type="button" onClick={() => void sendMatchEmote(key)} className="rounded-lg border border-border bg-background px-3 py-2 text-lg transition hover:border-primary/60 hover:bg-primary/5" aria-label={key}>{emoji}</button>
            ))}
          </div>
          {matchEmotes.length > 0 && <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">{matchEmotes.slice(0,5).map(item => <span key={item.id} className="rounded-full bg-muted px-2 py-1 text-xs">{({gg:"👏",well_played:"💯",thinking:"🤔",wow:"😮",oops:"😅",clap:"🙌",tiger:"🐯",laugh:"😂"} as Record<string,string>)[item.emote_key] ?? "✨"} {item.user_id===user?.id?"You":"Opponent"}</span>)}</div>}
        </section>
      )}

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
        <div style={{ ...boardStyle, ...boardSizeStyle, ...board3dStyle }} className="draught-frame draught-board-polished w-full max-w-none rounded-[22px] p-2 sm:p-3 shadow-[0_22px_45px_-16px_rgba(0,0,0,0.85),inset_0_2px_3px_rgba(255,255,255,0.55),inset_0_-5px_10px_rgba(0,0,0,0.65)] ring-1 ring-white/30">
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
                    <div className={`relative z-[1] h-[90%] w-[90%] aspect-square transition-transform duration-150 ${sel ? "scale-110 -translate-y-1" : ""}`}>
                      {showBrandedPieces ? (
                        <>
                          <div
                            aria-hidden="true"
                            className={`absolute inset-[5%] rounded-full border shadow-[inset_0_3px_5px_rgba(255,255,255,.35),0_3px_5px_rgba(0,0,0,.55)] ${piece.c === "w" ? "border-zinc-300 bg-gradient-to-br from-white via-zinc-200 to-zinc-500" : "border-sky-950 bg-gradient-to-br from-sky-500 via-blue-700 to-blue-950"}`}
                          />
                          <img
                            src={piece.c === "w" ? "/assets/coca-cola-cap.png" : "/assets/pepsi-cap.png"}
                            alt=""
                            draggable={false}
                            loading="eager"
                            decoding="async"
                            onError={(event) => { event.currentTarget.style.display = "none"; }}
                            className="pointer-events-none relative z-[1] h-full w-full select-none object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.65)]"
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-[5%] z-[2] rounded-full opacity-80"
                            style={{ background: "linear-gradient(145deg, rgba(255,255,255,.58) 0%, rgba(255,255,255,.18) 17%, transparent 38%, transparent 72%, rgba(0,0,0,.24) 100%)", mixBlendMode: "screen" }}
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
