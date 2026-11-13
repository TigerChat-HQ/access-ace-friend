import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Color, PieceSymbol, Square } from "chess.js";
import {
  ArrowLeft,
  Bot,
  Check,
  CircleHelp,
  Copy,
  Flag,
  RotateCcw,
  RotateCw,
  Sparkles,
  Timer,
  Trophy,
  Undo2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChessPiece3D } from "@/components/games/ChessPiece3D";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { pickChessMove, type ChessDifficulty } from "@/lib/chess-ai";

const GAME_KEY = "tiger-chess-arena-v1";
const STATS_KEY = "tiger-chess-stats-v1";
const FILES = "abcdefgh";
const PIECE_GLYPHS: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const PIECE_NAMES: Record<PieceSymbol, string> = {
  k: "King",
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
};
const PIECE_POINTS: Record<PieceSymbol, number> = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };

type GameMode = "ai" | "local" | "online";
type Screen = "menu" | "board";
type LocalStats = { wins: number; losses: number; draws: number; games: number };
type ManualEnd = { reason: "resign" | "time"; winner: Color };
type SavedGame = {
  pgn?: string;
  fen?: string;
  mode?: GameMode;
  screen?: Screen;
  difficulty?: ChessDifficulty;
  humanColor?: Color;
  timeControl?: number;
  clocks?: { w: number; b: number };
  flipped?: boolean;
  manualEnd?: ManualEnd | null;
};

const EMPTY_STATS: LocalStats = { wins: 0, losses: 0, draws: 0, games: 0 };

const formatClock = (seconds: number) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
};

const playMoveSound = (capture: boolean) => {
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = capture ? 360 : 560;
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.11);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.onended = () => void context.close();
  } catch {
    // Sound is an optional browser enhancement.
  }
};

const ChessArena = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { language } = useLanguage();
  const gameStorageKey = `${GAME_KEY}:${user?.id ?? "anonymous"}`;
  const statsStorageKey = `${STATS_KEY}:${user?.id ?? "anonymous"}`;
  const t = useMemo(() => {
    const sw = language === "sw";
    return {
      title: "Chess Arena",
      subtitle: sw ? "Cheza chess dhidi ya Tiger AI au rafiki kwenye kifaa kimoja." : "Play chess against Tiger AI or a friend on one device.",
      back: sw ? "Games Arena" : "Games Arena",
      againstAi: sw ? "Dhidi ya Tiger AI" : "Vs Tiger AI",
      local: sw ? "Kifaa kimoja" : "Same device",
      chooseMode: sw ? "Chagua jinsi ya kucheza" : "Choose how to play",
      aiDesc: sw ? "Cheza dhidi ya AI yenye viwango vitatu." : "Challenge the AI across three difficulty levels.",
      localDesc: sw ? "Wachezaji wawili wanatumia kifaa kimoja." : "Two players share one device and take turns.",
      difficulty: sw ? "Kiwango cha AI" : "AI difficulty",
      side: sw ? "Chagua rangi yako" : "Choose your side",
      time: sw ? "Muda wa mchezo" : "Time control",
      noClock: sw ? "Bila saa" : "No clock",
      minutes: sw ? "dakika" : "min",
      start: sw ? "Anza mchezo" : "Start game",
      online: sw ? "Cheza online" : "Play online",
      onlineDesc: sw ? "Cheza na mpinzani kwenye simu tofauti kwa code." : "Play an opponent on another device using a room code.",
      createRoom: sw ? "Tengeneza chumba" : "Create room",
      joinRoom: sw ? "Jiunge na chumba" : "Join room",
      roomCode: sw ? "Code ya chumba" : "Room code",
      waiting: sw ? "Unasubiri mpinzani ajiunge…" : "Waiting for an opponent to join…",
      copyInvite: sw ? "Nakili link ya mwaliko" : "Copy invite link",
      how: sw ? "Sheria za mchezo" : "How to play",
      rules: sw
        ? ["White huanza. Gusa kipande kisha gusa mraba wa kwenda.", "Gusa kipande ili kuona hatua zake halali.", "Promotion, castling na en passant vinafuata sheria za chess.", "Mchezo huisha kwa checkmate, sare au muda kuisha."]
        : ["White moves first. Tap a piece, then tap a destination square.", "Select a piece to see all legal moves.", "Promotion, castling and en passant follow standard chess rules.", "Games end by checkmate, draw, resignation or timeout."],
      yourStats: sw ? "Matokeo yako dhidi ya AI" : "Your AI record",
      wins: sw ? "Ushindi" : "Wins",
      losses: sw ? "Hasara" : "Losses",
      draws: sw ? "Sare" : "Draws",
      white: sw ? "Mweupe" : "White",
      black: sw ? "Mweusi" : "Black",
      you: sw ? "Wewe" : "You",
      tiger: "Tiger AI",
      player: sw ? "Mchezaji" : "Player",
      moveHistory: sw ? "Historia ya hatua" : "Move history",
      moves: sw ? "hatua" : "moves",
      captures: sw ? "Kula" : "Took",
      noMoves: sw ? "Hatua zitaonekana hapa." : "Moves will appear here.",
      undo: sw ? "Rudisha hatua" : "Undo move",
      flip: sw ? "Geuza ubao" : "Flip board",
      sound: sw ? "Washa/zima sauti" : "Toggle sound",
      pgn: sw ? "Nakili PGN" : "Copy PGN",
      resign: sw ? "Jisalimishe" : "Resign",
      newGame: sw ? "Mchezo mpya" : "New game",
      thinking: sw ? "Tiger AI anafikiria…" : "Tiger AI is thinking…",
      check: sw ? "Check!" : "Check!",
      yourTurn: sw ? "Zamu yako" : "Your turn",
      thinkingTurn: sw ? "Zamu ya Tiger AI" : "Tiger AI's turn",
      winsByMate: sw ? "ameshinda kwa checkmate!" : "wins by checkmate!",
      stalemate: sw ? "Sare kwa stalemate." : "Draw by stalemate.",
      draw: sw ? "Mchezo ni sare." : "The game is a draw.",
      resignWin: sw ? "ameshinda—mpinzani amejisalimisha." : "wins—opponent resigned.",
      timeWin: sw ? "ameshinda kwa muda kuisha." : "wins on time.",
      copied: sw ? "PGN imenakiliwa." : "PGN copied.",
      copyFailed: sw ? "Imeshindikana kunakili PGN." : "Could not copy PGN.",
      confirmExit: sw ? "Uondoke kwenye mchezo huu? Mchezo unaweza kuendelea ukirudi." : "Leave this game? You can resume it later.",
      promote: sw ? "Chagua kipande cha promotion" : "Choose a promotion piece",
      easy: sw ? "Rahisi" : "Easy",
      medium: sw ? "Wastani" : "Medium",
      hard: sw ? "Ngumu" : "Hard",
      casual: sw ? "Cheza kwa starehe" : "Casual play",
      strategy: sw ? "Mkakati" : "Strategy",
      gamesPlayed: sw ? "Mechi" : "Games",
      checkmate: sw ? "Checkmate" : "Checkmate",
      aiStarts: sw ? "Tiger AI anaanza" : "Tiger AI moves first",
      selectionHint: sw ? "Chagua kipande cha kuhamisha." : "Select a piece to move.",
    };
  }, [language]);

  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) gameRef.current = new Chess();
  const game = gameRef.current;
  const [fen, setFen] = useState(game.fen());
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<ChessDifficulty>("medium");
  const [humanColor, setHumanColor] = useState<Color>("w");
  const [timeControl, setTimeControl] = useState(0);
  const [clocks, setClocks] = useState({ w: 0, b: 0 });
  const clockRef = useRef({ w: 0, b: 0 });
  const lastTickRef = useRef(Date.now());
  const timeoutHandledRef = useRef(false);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; color: Color } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [manualEnd, setManualEnd] = useState<ManualEnd | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [sound, setSound] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const [stats, setStats] = useState<LocalStats>(EMPTY_STATS);
  const statsRef = useRef<LocalStats>(EMPTY_STATS);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<string | null>(null);
  const [onlineRole, setOnlineRole] = useState<"host" | "guest" | null>(null);
  const [onlineRoomInput, setOnlineRoomInput] = useState("");
  const [onlineReady, setOnlineReady] = useState(false);
  const onlineChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    setHydratedKey(null);
    const fresh = new Chess();
    gameRef.current = fresh;
    setFen(fresh.fen());
    setScreen("menu");
    setMode("ai");
    setDifficulty("medium");
    setHumanColor("w");
    setTimeControl(0);
    setManualEnd(null);
    setLastMove(null);
    setFlipped(false);
    timeoutHandledRef.current = false;
    const initialClocks = { w: 0, b: 0 };
    clockRef.current = initialClocks;
    setClocks(initialClocks);
    statsRef.current = EMPTY_STATS;
    setStats(EMPTY_STATS);
    try {
      const rawGame = localStorage.getItem(gameStorageKey);
      if (rawGame) {
        const saved = JSON.parse(rawGame) as SavedGame;
        const restored = new Chess();
        if (saved.pgn) restored.loadPgn(saved.pgn);
        else if (saved.fen) restored.load(saved.fen);
        gameRef.current = restored;
        setFen(restored.fen());
        setMode(saved.mode === "local" ? "local" : "ai");
        if (saved.difficulty === "easy" || saved.difficulty === "medium" || saved.difficulty === "hard") setDifficulty(saved.difficulty);
        if (saved.humanColor === "b" || saved.humanColor === "w") setHumanColor(saved.humanColor);
        if (typeof saved.timeControl === "number") setTimeControl(saved.timeControl);
        if (saved.clocks && typeof saved.clocks.w === "number" && typeof saved.clocks.b === "number") {
          clockRef.current = saved.clocks;
          setClocks(saved.clocks);
        }
        if (saved.manualEnd && (saved.manualEnd.reason === "resign" || saved.manualEnd.reason === "time") && (saved.manualEnd.winner === "w" || saved.manualEnd.winner === "b")) setManualEnd(saved.manualEnd);
        if (typeof saved.flipped === "boolean") setFlipped(saved.flipped);
        setScreen(saved.screen === "board" ? "board" : "menu");
      }
      const rawStats = localStorage.getItem(statsStorageKey);
      if (rawStats) {
        const parsed = JSON.parse(rawStats) as Partial<LocalStats>;
        const restoredStats = {
          wins: Number(parsed.wins) || 0,
          losses: Number(parsed.losses) || 0,
          draws: Number(parsed.draws) || 0,
          games: Number(parsed.games) || 0,
        };
        statsRef.current = restoredStats;
        setStats(restoredStats);
      }
    } catch {
      // Ignore damaged or unavailable browser storage and start a clean session.
    } finally {
      setHydratedKey(gameStorageKey);
    }
  }, [gameStorageKey, statsStorageKey]);

  useEffect(() => {
    if (hydratedKey !== gameStorageKey) return;
    try {
      localStorage.setItem(gameStorageKey, JSON.stringify({
        pgn: game.pgn(),
        fen,
        mode,
        screen,
        difficulty,
        humanColor,
        timeControl,
        clocks,
        flipped,
        manualEnd,
      } satisfies SavedGame));
    } catch {
      // Saving a local practice game is optional when storage is blocked.
    }
  }, [fen, mode, screen, difficulty, humanColor, timeControl, clocks, flipped, manualEnd, hydratedKey, gameStorageKey, game]);

  const recordResult = useCallback((winner: Color | null, isDraw = false) => {
    if (mode !== "ai") return;
    const next = { ...statsRef.current, games: statsRef.current.games + 1 };
    if (isDraw || winner === null) next.draws += 1;
    else if (winner === humanColor) next.wins += 1;
    else next.losses += 1;
    statsRef.current = next;
    setStats(next);
    try {
      localStorage.setItem(statsStorageKey, JSON.stringify(next));
    } catch {
      // Local stats are optional when browser storage is unavailable.
    }
  }, [mode, humanColor, statsStorageKey]);

  const finishByClock = useCallback((loser: Color) => {
    if (timeoutHandledRef.current) return;
    timeoutHandledRef.current = true;
    const winner = loser === "w" ? "b" : "w";
    setManualEnd({ reason: "time", winner });
    recordResult(winner);
  }, [recordResult]);

  const applyMove = useCallback((from: Square, to: Square, promotion: PieceSymbol = "q") => {
    const current = gameRef.current;
    if (!current || current.isGameOver() || manualEnd) return;
    if (timeControl > 0) {
      const now = Date.now();
      const active = current.turn();
      const remaining = Math.max(0, clockRef.current[active] - (now - lastTickRef.current) / 1000);
      const nextClocks = { ...clockRef.current, [active]: remaining };
      clockRef.current = nextClocks;
      setClocks(nextClocks);
      lastTickRef.current = now;
      if (remaining <= 0) {
        finishByClock(active);
        return;
      }
    }
    try {
      const move = current.move({ from, to, promotion });
      setFen(current.fen());
      setLastMove({ from: move.from, to: move.to });
      setSelected(null);
      setPendingPromotion(null);
      if (sound) playMoveSound(Boolean(move.captured));
      if (mode === "online" && onlineChannelRef.current) {
        void onlineChannelRef.current.send({ type: "broadcast", event: "state", payload: { fen: current.fen(), pgn: current.pgn() } });
      }
      if (current.isGameOver()) {
        if (current.isCheckmate()) recordResult(current.turn() === "w" ? "b" : "w");
        else recordResult(null, true);
      }
    } catch {
      // chess.js rejects illegal moves; the board remains unchanged.
    }
  }, [manualEnd, recordResult, sound, timeControl, finishByClock, mode]);

  useEffect(() => {
    if (hydratedKey !== gameStorageKey || screen !== "board" || !timeControl || manualEnd || game.isGameOver()) return;
    lastTickRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      const active = gameRef.current?.turn() ?? "w";
      const next = { ...clockRef.current, [active]: Math.max(0, clockRef.current[active] - elapsed) };
      clockRef.current = next;
      setClocks(next);
      if (next[active] <= 0) finishByClock(active);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hydratedKey, gameStorageKey, screen, fen, timeControl, manualEnd, finishByClock, game]);

  useEffect(() => {
    if (hydratedKey !== gameStorageKey || screen !== "board" || mode !== "ai" || manualEnd || game.isGameOver() || game.turn() === humanColor) {
      setAiThinking(false);
      return;
    }
    setAiThinking(true);
    const timer = window.setTimeout(() => {
      const current = gameRef.current;
      if (current && !current.isGameOver()) {
        const move = pickChessMove(current, difficulty);
        if (move) applyMove(move.from, move.to, move.promotion ?? "q");
      }
      setAiThinking(false);
    }, 420);
    return () => {
      window.clearTimeout(timer);
      setAiThinking(false);
    };
  }, [hydratedKey, gameStorageKey, screen, mode, fen, humanColor, difficulty, manualEnd, game, applyMove]);

  const history = game.history({ verbose: true });
  const last = history[history.length - 1];
  const visibleLastMove = lastMove ?? (last ? { from: last.from, to: last.to } : null);
  const possibleMoves = selected ? game.moves({ square: selected, verbose: true }) : [];
  const legalTargets = new Set(possibleMoves.map((move) => move.to));
  const checkSquare = (() => {
    if (!game.isCheck()) return null;
    const rows = game.board();
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = rows[row][col];
        if (piece?.type === "k" && piece.color === game.turn()) return `${FILES[col]}${8 - row}` as Square;
      }
    }
    return null;
  })();
  const finished = Boolean(manualEnd) || game.isGameOver();
  const playerName = (color: Color) => {
    if (mode === "ai") return color === humanColor ? t.you : t.tiger;
    if (mode === "online") return color === (onlineRole === "host" ? "w" : "b") ? t.you : "Online opponent";
    return `${t.player} ${color === "w" ? "1" : "2"} · ${color === "w" ? t.white : t.black}`;
  };
  const activeName = playerName(game.turn());
  const status = manualEnd
    ? manualEnd.reason === "time" ? `${playerName(manualEnd.winner)} ${t.timeWin}` : `${playerName(manualEnd.winner)} ${t.resignWin}`
    : game.isCheckmate() ? `${playerName(game.turn() === "w" ? "b" : "w")} ${t.winsByMate}`
      : game.isStalemate() ? t.stalemate
        : game.isThreefoldRepetition() || game.isInsufficientMaterial() || game.isDraw() ? t.draw
          : aiThinking ? t.thinking
            : game.isCheck() ? `${activeName} · ${t.check}`
              : mode === "ai" && game.turn() !== humanColor ? t.thinkingTurn
                : mode === "online" && game.turn() !== (onlineRole === "host" ? "w" : "b") ? (language === "sw" ? "Zamu ya mpinzani" : "Opponent’s turn")
                  : `${activeName} · ${t.yourTurn}`;

  const handleSquare = (square: Square) => {
    const myOnlineColor = onlineRole === "host" ? "w" : "b";
    if (screen !== "board" || finished || aiThinking || (mode === "ai" && game.turn() !== humanColor) || (mode === "online" && (!onlineReady || game.turn() !== myOnlineColor))) return;
    const piece = game.get(square);
    if (selected) {
      const candidates = game.moves({ square: selected, verbose: true }).filter((move) => move.to === square);
      if (candidates.length > 0) {
        const movingPiece = game.get(selected);
        if (movingPiece?.type === "p" && candidates.some((move) => Boolean(move.promotion))) {
          setPendingPromotion({ from: selected, to: square, color: movingPiece.color });
          return;
        }
        applyMove(selected, square);
        return;
      }
    }
    if (piece && piece.color === game.turn()) setSelected(square);
    else setSelected(null);
  };

  const startGame = (nextMode: GameMode) => {
    const fresh = new Chess();
    gameRef.current = fresh;
    setFen(fresh.fen());
    setMode(nextMode);
    setScreen("board");
    setManualEnd(null);
    setSelected(null);
    setPendingPromotion(null);
    setLastMove(null);
    timeoutHandledRef.current = false;
    const startingClock = timeControl ? timeControl * 60 : 0;
    const startingClocks = { w: startingClock, b: startingClock };
    clockRef.current = startingClocks;
    setClocks(startingClocks);
    const orientation = (nextMode === "ai" && humanColor === "b") || (nextMode === "online" && onlineRole === "guest");
    setFlipped(orientation);
    lastTickRef.current = Date.now();
  };

  const newGame = () => {
    if (!finished && !window.confirm(t.confirmExit)) return;
    setScreen("menu");
    setManualEnd(null);
    setSelected(null);
    setPendingPromotion(null);
    setAiThinking(false);
  };

  const undoMove = () => {
    const current = gameRef.current;
    if (!current || finished || aiThinking || current.history().length === 0) return;
    current.undo();
    if (mode === "ai" && current.turn() !== humanColor && current.history().length > 0) current.undo();
    setManualEnd(null);
    setSelected(null);
    setPendingPromotion(null);
    setFen(current.fen());
    const previousMove = current.history({ verbose: true })[current.history().length - 1];
    setLastMove(previousMove ? { from: previousMove.from, to: previousMove.to } : null);
    timeoutHandledRef.current = false;
    lastTickRef.current = Date.now();
  };

  const resign = () => {
    if (finished) return;
    const loser = mode === "ai" ? humanColor : game.turn();
    const winner = loser === "w" ? "b" : "w";
    setManualEnd({ reason: "resign", winner });
    recordResult(winner);
  };

  const copyPgn = async () => {
    const pgn = game.pgn() || "[Event \"TigerChat Chess Arena\"]\n\n*";
    try {
      await navigator.clipboard.writeText(pgn);
      toast({ title: t.copied });
    } catch {
      toast({ title: t.copyFailed, variant: "destructive" });
    }
  };

  const orientation = flipped ? "b" : "w";
  const rowIndexes = orientation === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const fileIndexes = orientation === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const whiteCaptured = history.filter((move) => move.color === "w" && move.captured).map((move) => move.captured!);
  const blackCaptured = history.filter((move) => move.color === "b" && move.captured).map((move) => move.captured!);
  const moveRows = Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => ({
    number: index + 1,
    white: history[index * 2],
    black: history[index * 2 + 1],
  }));


  const publishRoomState = useCallback(() => {
    const channel = onlineChannelRef.current;
    const current = gameRef.current;
    if (channel && current) void channel.send({ type: "broadcast", event: "state", payload: { fen: current.fen(), pgn: current.pgn() } });
  }, []);

  useEffect(() => {
    if (!onlineRoom || mode !== "online") return;
    setOnlineReady(false);
    const channel = supabase.channel(`tiger-chess-room:${onlineRoom}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "state" }, ({ payload }) => {
        if (typeof payload?.fen !== "string") return;
        try {
          const restored = new Chess(payload.fen);
          gameRef.current = restored;
          setFen(restored.fen());
          setLastMove(null);
          setOnlineReady(true);
        } catch { /* Ignore malformed or incompatible remote positions. */ }
      })
      .on("broadcast", { event: "state_request" }, () => {
        if (onlineRole === "host") publishRoomState();
      })
      .on("broadcast", { event: "player_joined" }, () => {
        setOnlineReady(true);
        if (onlineRole === "host") publishRoomState();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (onlineRole === "guest") void channel.send({ type: "broadcast", event: "player_joined", payload: {} });
          else publishRoomState();
        }
      });
    onlineChannelRef.current = channel;
    return () => {
      onlineChannelRef.current = null;
      void supabase.removeChannel(channel);
      setOnlineReady(false);
    };
  }, [onlineRoom, mode, onlineRole, publishRoomState]);

  const createOnlineRoom = () => {
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
    setOnlineRole("host");
    setOnlineRoom(code);
    setMode("online");
    startGame("online");
    window.history.replaceState({}, "", `/games/chess?chessRoom=${code}`);
  };

  const joinOnlineRoom = () => {
    const code = onlineRoomInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    if (code.length < 6) {
      toast({ title: t.roomCode, description: "Enter a valid 6–8 character room code.", variant: "destructive" });
      return;
    }
    const fresh = new Chess();
    gameRef.current = fresh;
    setFen(fresh.fen());
    setOnlineRole("guest");
    setOnlineRoom(code);
    setMode("online");
    setScreen("board");
    setFlipped(true);
    setManualEnd(null);
    setLastMove(null);
    setSelected(null);
    setPendingPromotion(null);
    window.history.replaceState({}, "", `/games/chess?chessRoom=${code}`);
  };

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("chessRoom");
    if (code && /^[A-Z0-9]{6,12}$/i.test(code)) {
      setOnlineRoom(code.toUpperCase());
      setOnlineRole("guest");
      setMode("online");
      setScreen("board");
      setFlipped(true);
    }
  }, []);

  const copyOnlineInvite = async () => {
    if (!onlineRoom) return;
    const link = `${window.location.origin}/games/chess?chessRoom=${onlineRoom}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: t.copyInvite });
    } catch {
      toast({ title: "Could not copy invite link", variant: "destructive" });
    }
  };

  const exitToGames = () => {
    if (screen === "board" && !finished && !window.confirm(t.confirmExit)) return;
    if (onlineChannelRef.current) { void supabase.removeChannel(onlineChannelRef.current); onlineChannelRef.current = null; }
    navigate("/games", { replace: false });
  };

  if (hydratedKey !== gameStorageKey) {
    return <main className="min-h-full bg-background p-6 text-center text-sm text-muted-foreground" role="status">{language === "sw" ? "Inapakia Chess Arena…" : "Loading Chess Arena…"}</main>;
  }

  return (
    <main className="min-h-full overflow-y-auto bg-background px-3 pb-28 pt-4 sm:px-5">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2"><button onClick={exitToGames} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-2 text-sm font-semibold transition hover:border-primary/40" aria-label={t.back}><ArrowLeft className="h-4 w-4" /> {t.back}</button>{screen === "board" && <button onClick={() => { if (!finished && !window.confirm(t.confirmExit)) return; if (onlineChannelRef.current) { void supabase.removeChannel(onlineChannelRef.current); onlineChannelRef.current = null; } setOnlineRoom(null); setOnlineRole(null); setOnlineReady(false); setMode("ai"); setScreen("menu"); window.history.replaceState({}, "", "/games/chess"); }} className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">{language === "sw" ? "Rudi kwenye menyu" : "Back to chess menu"}</button>}</div>
          <button onClick={() => setSound((value) => !value)} className="rounded-xl border border-border bg-card/70 p-2.5" aria-label={t.sound} title={t.sound}>
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </header>

        <section className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-card to-emerald-500/5 p-4 text-center shadow-[0_12px_42px_rgba(2,132,199,.10)] sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[.24em] text-sky-400">TIGERCHAT ARENA</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">♛ {t.title}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{t.subtitle}</p>
        </section>

        {screen === "menu" ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <section className="space-y-4 rounded-3xl border border-border bg-card/80 p-4 sm:p-6">
              <div>
                <h2 className="text-lg font-black">{t.chooseMode}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <button onClick={() => setMode("ai")} className={`rounded-2xl border p-4 text-left transition ${mode === "ai" ? "border-primary/50 bg-primary/10 shadow-[0_0_26px_hsl(var(--primary)/.10)]" : "border-border bg-background/50 hover:border-primary/30"}`}>
                  <Bot className="h-7 w-7 text-primary" />
                  <p className="mt-3 font-black">{t.againstAi}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.aiDesc}</p>
                </button>
                <button onClick={() => setMode("local")} className={`rounded-2xl border p-4 text-left transition ${mode === "local" ? "border-primary/50 bg-primary/10 shadow-[0_0_26px_hsl(var(--primary)/.10)]" : "border-border bg-background/50 hover:border-primary/30"}`}>
                  <Users className="h-7 w-7 text-primary" />
                  <p className="mt-3 font-black">{t.local}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.localDesc}</p>
                </button>
                <button onClick={() => setMode("online")} className={`rounded-2xl border p-4 text-left transition ${mode === "online" ? "border-primary/50 bg-primary/10 shadow-[0_0_26px_hsl(var(--primary)/.10)]" : "border-border bg-background/50 hover:border-primary/30"}`}>
                  <Users className="h-7 w-7 text-emerald-500" />
                  <p className="mt-3 font-black">{t.online}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.onlineDesc}</p>
                </button>
              </div>

              {mode === "online" && (
                <div className="space-y-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <button onClick={createOnlineRoom} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white">{t.createRoom}</button>
                  <div className="flex gap-2"><input value={onlineRoomInput} onChange={(event) => setOnlineRoomInput(event.target.value.toUpperCase())} maxLength={12} placeholder={t.roomCode} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-3 text-sm uppercase tracking-[.2em]" /><button onClick={joinOnlineRoom} className="rounded-xl border border-emerald-500/40 px-4 text-sm font-bold text-emerald-600">{t.joinRoom}</button></div>
                </div>
              )}

              {mode === "ai" && (
                <div className="space-y-4 rounded-2xl border border-border/70 bg-background/50 p-4">
                  <div>
                    <p className="mb-2 text-xs font-bold text-muted-foreground">{t.difficulty}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["easy", "medium", "hard"] as const).map((level) => <button key={level} onClick={() => setDifficulty(level)} className={`rounded-xl border px-2 py-2.5 text-xs font-bold capitalize ${difficulty === level ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"}`}>{t[level]}</button>)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-muted-foreground">{t.side}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["w", "b"] as const).map((color) => <button key={color} onClick={() => setHumanColor(color)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${humanColor === color ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"}`}>{color === "w" ? `♔ ${t.white}` : `♚ ${t.black}`}</button>)}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-bold text-muted-foreground"><Timer className="h-4 w-4" /> {t.time}</p>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 3, 5, 10].map((minutes) => <button key={minutes} onClick={() => setTimeControl(minutes)} className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${timeControl === minutes ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-background/50 text-muted-foreground"}`}>{minutes === 0 ? t.noClock : `${minutes} ${t.minutes}`}</button>)}
                </div>
              </div>

              {mode !== "online" && <button onClick={() => startGame(mode)} className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-black text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/.22)] transition hover:opacity-90 active:scale-[.99]">
                <Sparkles className="mr-2 inline h-4 w-4" /> {t.start}
              </button>}
            </section>

            <div className="space-y-4">
              <section className="rounded-3xl border border-border bg-card/80 p-4 sm:p-6">
                <h2 className="flex items-center gap-2 font-black"><CircleHelp className="h-5 w-5 text-primary" /> {t.how}</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {t.rules.map((rule) => <li key={rule} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{rule}</li>)}
                </ul>
              </section>
              <section className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-card p-4 sm:p-6">
                <h2 className="flex items-center gap-2 font-black"><Trophy className="h-5 w-5 text-amber-500" /> {t.yourStats}</h2>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[[t.wins, stats.wins], [t.losses, stats.losses], [t.draws, stats.draws], [t.gamesPlayed, stats.games]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border/60 bg-background/60 p-2"><p className="text-xl font-black">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>)}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card/80 p-3">
                <div className={`min-w-0 rounded-xl px-3 py-2 ${game.turn() === "b" && !finished ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
                  <p className="truncate text-xs font-bold">♚ {playerName("b")}</p>
                  {timeControl > 0 && <p className={`mt-1 font-mono text-lg font-black ${game.turn() === "b" && !finished ? "text-primary" : "text-muted-foreground"}`}>{formatClock(clocks.b)}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">{t.black}</p>
                </div>
                <span className="text-[10px] font-black tracking-widest text-muted-foreground">VS</span>
                <div className={`min-w-0 rounded-xl px-3 py-2 text-right ${game.turn() === "w" && !finished ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
                  <p className="truncate text-xs font-bold">♔ {playerName("w")}</p>
                  {timeControl > 0 && <p className={`mt-1 font-mono text-lg font-black ${game.turn() === "w" && !finished ? "text-primary" : "text-muted-foreground"}`}>{formatClock(clocks.w)}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">{t.white}</p>
                </div>
              </div>

              <div className="rounded-[22px] border border-amber-100/20 bg-[linear-gradient(145deg,#f5d99c_0%,#95632f_24%,#382016_52%,#b98545_76%,#25150e_100%)] p-2 shadow-[0_24px_50px_rgba(0,0,0,.62),inset_0_2px_4px_rgba(255,255,255,.55),inset_0_-7px_12px_rgba(0,0,0,.65)] sm:p-3">
                <div className="grid aspect-square grid-cols-8 grid-rows-8 overflow-hidden rounded-lg ring-1 ring-black/50 shadow-[inset_0_8px_20px_rgba(0,0,0,.32)]" style={{ transform: "perspective(1400px) rotateX(2deg)", transformOrigin: "center bottom" }}>
                  {rowIndexes.flatMap((rankIndex) => fileIndexes.map((fileIndex) => {
                    const square = `${FILES[fileIndex]}${rankIndex + 1}` as Square;
                    const piece = game.get(square);
                    const isLight = (fileIndex + rankIndex) % 2 === 1;
                    const isSelected = selected === square;
                    const isTarget = legalTargets.has(square);
                    const isLast = visibleLastMove?.from === square || visibleLastMove?.to === square;
                    const isCheck = checkSquare === square;
                    const fileLabel = FILES[fileIndex];
                    const rankLabel = rankIndex + 1;
                    return <button
                      key={square}
                      onClick={() => handleSquare(square)}
                      disabled={finished || aiThinking || (mode === "ai" && game.turn() !== humanColor)}
                      aria-label={`${fileLabel}${rankLabel}${piece ? ` ${piece.color === "w" ? t.white : t.black} ${PIECE_NAMES[piece.type]}` : ""}${isTarget ? ", legal move" : ""}`}
                      className={`relative flex min-w-0 items-center justify-center overflow-hidden transition duration-150 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary disabled:cursor-default ${isLight ? "bg-[linear-gradient(145deg,#f3e7c7,#c6ad7d_72%,#a98a58)] text-[#15211a]" : "bg-[linear-gradient(145deg,#566b62,#243c36_72%,#152720)] text-white"} ${isLast ? "!bg-amber-300/80" : ""} ${isSelected ? "!bg-sky-300 ring-4 ring-inset ring-sky-500/70" : ""} ${isCheck ? "!bg-rose-500/80" : ""}`}
                    >
                      {fileIndex === (orientation === "w" ? 0 : 7) && <span className="pointer-events-none absolute left-1 top-0.5 text-[8px] font-black opacity-60 sm:text-[10px]">{rankLabel}</span>}
                      {rankIndex === (orientation === "w" ? 0 : 7) && <span className="pointer-events-none absolute bottom-0 right-1 text-[8px] font-black opacity-60 sm:text-[10px]">{fileLabel}</span>}
                      {isTarget && !piece && <span className="pointer-events-none absolute h-[22%] w-[22%] rounded-full bg-black/25" />}
                      {isTarget && piece && <span className="pointer-events-none absolute inset-[5%] rounded-full border-[3px] border-black/25" />}
                      {piece && <ChessPiece3D color={piece.color} type={piece.type} className="relative z-[1] drop-shadow-[0_5px_4px_rgba(0,0,0,.55)] transition-transform duration-200" />}
                    </button>;
                  }))}
                </div>
              </div>

              {mode === "online" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3"><div><p className="text-xs font-black text-emerald-600">{onlineReady ? "Opponent connected" : t.waiting}</p><p className="font-mono text-xs tracking-[.2em] text-muted-foreground">{onlineRoom}</p></div><button onClick={copyOnlineInvite} className="rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-600"><Copy className="mr-1 inline h-4 w-4" />{t.copyInvite}</button></div>}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/80 p-3">
                <p className="min-w-0 flex-1 text-sm font-bold" aria-live="polite">{status}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={undoMove} disabled={finished || aiThinking || game.history().length === 0} className="rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-40" aria-label={t.undo}><Undo2 className="mr-1 inline h-4 w-4" />{t.undo}</button>
                  <button onClick={() => setFlipped((value) => !value)} className="rounded-xl border border-border px-3 py-2 text-xs font-bold" aria-label={t.flip}><RotateCw className="mr-1 inline h-4 w-4" />{t.flip}</button>
                </div>
              </div>

              {finished && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center"><p className="text-lg font-black">{status}</p><button onClick={() => setScreen("menu")} className="mt-3 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">{t.newGame}</button></div>}
            </section>

            <aside className="space-y-3">
              <section className="rounded-2xl border border-border bg-card/80 p-4">
                <div className="flex items-center justify-between gap-2"><h2 className="font-black">{t.moveHistory}</h2><span className="text-[10px] text-muted-foreground">{history.length} {t.moves ?? ""}</span></div>
                <div className="mt-3 max-h-64 min-h-24 overflow-y-auto rounded-xl border border-border/70 bg-background/50 p-2">
                  {moveRows.length === 0 ? <p className="p-4 text-center text-xs text-muted-foreground">{t.noMoves}</p> : <div className="space-y-1">
                    {moveRows.map((row) => <div key={row.number} className="grid grid-cols-[2rem_1fr_1fr] rounded-lg px-2 py-1.5 text-sm odd:bg-muted/40"><span className="text-xs text-muted-foreground">{row.number}.</span><span className="font-mono font-semibold">{row.white?.san ?? ""}</span><span className="font-mono font-semibold">{row.black?.san ?? ""}</span></div>)}
                  </div>}
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex min-h-6 items-center gap-1"><span className="w-12 font-semibold text-muted-foreground">♔ {t.captures ?? (language === "sw" ? "Kula" : "Took")}</span>{whiteCaptured.map((piece, index) => <span key={`${piece}-${index}`} className="text-lg" aria-label={PIECE_NAMES[piece]}>{PIECE_GLYPHS.b[piece]}</span>)}</div>
                  <div className="flex min-h-6 items-center gap-1"><span className="w-12 font-semibold text-muted-foreground">♚ {t.captures ?? (language === "sw" ? "Kula" : "Took")}</span>{blackCaptured.map((piece, index) => <span key={`${piece}-${index}`} className="text-lg" aria-label={PIECE_NAMES[piece]}>{PIECE_GLYPHS.w[piece]}</span>)}</div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/80 p-4">
                <h2 className="mb-3 font-black">{t.strategy}</h2>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={copyPgn} className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold"><Copy className="mr-1 inline h-4 w-4" />{t.pgn}</button>
                  <button onClick={resign} disabled={finished || (mode === "ai" && (aiThinking || game.turn() !== humanColor))} className="rounded-xl border border-rose-500/30 px-3 py-2.5 text-xs font-bold text-rose-500 disabled:opacity-40"><Flag className="mr-1 inline h-4 w-4" />{t.resign}</button>
                  <button onClick={newGame} className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold"><RotateCcw className="mr-1 inline h-4 w-4" />{t.newGame}</button>
                </div>
                {aiThinking && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Bot className="h-4 w-4 animate-pulse text-primary" />{t.thinking}</p>}
              </section>
            </aside>
          </div>
        )}

        {pendingPromotion && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={t.promote}>
          <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"><h2 className="text-center font-black">{t.promote}</h2><div className="mt-4 grid grid-cols-4 gap-2">{(["q", "r", "b", "n"] as const).map((piece) => <button key={piece} onClick={() => applyMove(pendingPromotion.from, pendingPromotion.to, piece)} className="rounded-xl border border-border bg-background p-3 text-4xl transition hover:border-primary/50" aria-label={PIECE_NAMES[piece]}>{PIECE_GLYPHS[pendingPromotion.color][piece]}</button>)}</div></section>
        </div>}
      </div>
    </main>
  );
};

export default ChessArena;
