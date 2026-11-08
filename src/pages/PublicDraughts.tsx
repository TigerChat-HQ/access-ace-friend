import { useState } from "react";
import { BoardAppearance, useDraughtsAppearance } from "@/components/draughts/BoardAppearance";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Crown, RotateCcw, Users, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialBoard, legalMoves, applyMove, pickAIMove, winner, isDark } from "@/lib/draughts";
import logo from "@/assets/tigerchats-logo.png";

export default function PublicDraughts() {
  const { theme, setTheme, pieceStyle, setPieceStyle, scale, setScale, depth, setDepth, boardStyle, boardSizeStyle, board3dStyle } = useDraughtsAppearance();
  const [board, setBoard] = useState(initialBoard);
  const [selected, setSelected] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState("");
  const moves = result || thinking ? [] : legalMoves(board, "w");
  const destinations = moves.filter(m => m.from === selected);
  const play = (i: number) => {
    if (thinking || result) return;
    if (board[i]?.c === "w") { setSelected(i); return; }
    const move = destinations.find(m => m.to === i);
    if (!move) return;
    const next = applyMove(board, move);
    setBoard(next); setSelected(null);
    if (winner(next, "b")) { setResult("You won"); return; }
    setThinking(true);
    setTimeout(() => {
      const ai = pickAIMove(next, "b", 3);
      if (ai) { const updated = applyMove(next, ai); setBoard(updated); if (winner(updated, "w")) setResult("Tiger AI won"); }
      setThinking(false);
    }, 250);
  };
  return <div className="min-h-screen bg-background text-foreground">
    <Helmet><title>Tanzanian Draft Game — Play Draughts | TIGERCHATS</title><meta name="description" content="Play Tanzanian Draft Game with flying kings against Tiger AI. Sign in for online player-versus-player draughts and invite friends with a match code." /><link rel="canonical" href="https://access-ace-friend.lovable.app/tanzanian-draft-game" /><meta property="og:title" content="Tanzanian Draft Game | TIGERCHATS" /><meta property="og:url" content="https://access-ace-friend.lovable.app/tanzanian-draft-game" /></Helmet>
    <header className="border-b border-border px-5 py-3 flex justify-between items-center max-w-6xl mx-auto"><Link to="/" className="flex gap-2 items-center font-bold"><img src={logo} alt="" className="w-9 h-9" />TIGERCHATS</Link><Button asChild variant="ghost"><Link to="/contact"><Mail className="w-4 h-4 mr-2" />Contact</Link></Button></header>
    <main className="max-w-5xl mx-auto px-5 py-8"><h1 className="text-3xl font-bold">Tanzanian Draft Game</h1><div className="grid md:grid-cols-[1fr_320px] gap-8 mt-6 items-start">
      <div><div className="flex items-center justify-between mb-3 mt-1"><p className="text-xs text-muted-foreground">Live game board</p><BoardAppearance theme={theme} setTheme={setTheme} pieceStyle={pieceStyle} setPieceStyle={setPieceStyle} scale={scale} setScale={setScale} depth={depth} setDepth={setDepth} /></div><div className="flex items-center justify-between mb-3 mt-4"><p className="text-primary font-medium" role="status">{result || (thinking ? "Tiger AI thinking…" : "Your turn · White")}</p><Button variant="ghost" size="icon" aria-label="New game" title="New game" disabled={thinking} onClick={() => { setBoard(initialBoard()); setSelected(null); setResult(""); }}><RotateCcw className="w-5 h-5" /></Button></div>
      <div style={{ ...boardStyle, ...boardSizeStyle, ...board3dStyle }} className="grid grid-cols-8 aspect-square mx-auto overflow-hidden rounded-lg ring-1 ring-border shadow-2xl">{board.map((p, i) => <button key={i} aria-label={`Square ${i + 1}${p ? ` ${p.c === "w" ? "white" : "black"}${p.k ? " king" : " piece"}` : " empty"}`} onClick={() => play(i)} className={`relative aspect-square flex items-center justify-center ${isDark(Math.floor(i / 8), i % 8) ? "draught-dark" : "draught-light"} ${selected === i ? "ring-2 ring-primary ring-inset" : ""}`}>
        {p && <span className={`draught-piece ${p.c === "w" ? "draught-white" : "draught-black"}`}>{p.k && <Crown className="w-1/2 h-1/2" />}</span>}{destinations.some(m => m.to === i) && <span className="absolute w-3 h-3 rounded-full bg-primary" />}
      </button>)}</div></div>
      <section className="space-y-5 border-t md:border-t-0 md:border-l border-border pt-5 md:pt-0 md:pl-6"><h2 className="text-xl font-semibold">Online draughts</h2><p className="text-sm text-muted-foreground">Challenge a friend in a player-versus-player match, or practice against Tiger AI. Flying kings move across clear diagonals; captures and multi-jump chains are mandatory.</p><Button asChild className="w-full"><Link to="/draughts"><Users className="w-4 h-4 mr-2" />Play online</Link></Button><h2 className="font-semibold">Invite a friend</h2><p className="text-sm text-muted-foreground">Create an online match and share its code with your opponent.</p><Button asChild variant="outline" className="w-full"><Link to="/contact">Contact the team</Link></Button></section>
    </div></main>
  </div>;
}