import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
type Cell = 0 | 1 | 2;
type Board = Cell[][];
const emptyBoard = (): Board => Array.from({length:6},()=>Array<Cell>(7).fill(0));
function hasWon(board:Board,row:number,col:number,player:Cell) {
 const dirs:number[][]=[[0,1],[1,0],[1,1],[1,-1]];
 return dirs.some(([dr,dc])=>{
  let count=1;
  for(const sign of [-1,1]) { let r=row+dr*sign,c=col+dc*sign; while(r>=0&&r<6&&c>=0&&c<7&&board[r][c]===player){count++;r+=dr*sign;c+=dc*sign;} }
  return count>=4;
 });
}
export default function ConnectFour(){
 const [board,setBoard]=useState<Board>(emptyBoard); const [turn,setTurn]=useState<Cell>(1); const [winner,setWinner]=useState<Cell>(0); const [draw,setDraw]=useState(false); const [moves,setMoves]=useState(0);
 const play=(col:number)=>{if(winner||draw||board[0][col]!==0)return;let row=5;while(row>=0&&board[row][col]!==0)row--;if(row<0)return;const next=board.map(r=>r.slice()) as Board;next[row][col]=turn;setBoard(next);setMoves(m=>m+1);if(hasWon(next,row,col,turn))setWinner(turn);else if(moves===41)setDraw(true);else setTurn(turn===1?2:1);};
 const reset=()=>{setBoard(emptyBoard());setTurn(1);setWinner(0);setDraw(false);setMoves(0);};
 return <main className="min-h-full overflow-y-auto bg-background px-3 pb-24 pt-4"><div className="mx-auto max-w-lg space-y-5">
 <header className="flex items-center justify-between"><Link to="/games" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/> Games Arena</Link><button onClick={reset} className="rounded-xl border border-border p-2" aria-label="Restart"><RotateCcw className="h-4 w-4"/></button></header>
 <section className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-card p-4 text-center"><p className="text-xs font-bold uppercase tracking-widest text-rose-500">Wachezaji wawili · Kifaa kimoja</p><h1 className="mt-1 text-3xl font-black">Connect Four</h1><p className="mt-2 text-sm text-muted-foreground">Unganisha diski nne mlalo, wima au diagonal kabla ya mpinzani.</p></section>
 <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"><span className={"flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-bold "+(turn===1&&!winner&&!draw?"bg-rose-500/10":"")}><i className="h-4 w-4 rounded-full bg-rose-500"/> Mchezaji 1</span><span className="text-xs font-bold text-muted-foreground">VS</span><span className={"flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-bold "+(turn===2&&!winner&&!draw?"bg-amber-400/10":"")}><i className="h-4 w-4 rounded-full bg-amber-400"/> Mchezaji 2</span></div>
 <div className="rounded-2xl bg-blue-700 p-2 shadow-xl sm:p-3"><div className="grid grid-cols-7 gap-1.5 sm:gap-2">{Array.from({length:7},(_,c)=><button key={c} onClick={()=>play(c)} disabled={!!winner||draw||board[0][c]!==0} aria-label={"Weka diski safu "+(c+1)} className="rounded-lg bg-blue-900/60 py-2 text-xs font-bold text-white disabled:opacity-40">{c+1}</button>)}</div><div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">{board.map((row,r)=>row.map((cell,c)=><button key={r+"-"+c} onClick={()=>play(c)} disabled={!!winner||draw||board[0][c]!==0} aria-label={"Safu "+(c+1)+", mstari "+(r+1)} className="aspect-square rounded-full bg-blue-950/80 p-1 shadow-inner disabled:cursor-default"><span className={"block h-full w-full rounded-full "+(cell===1?"bg-rose-500":cell===2?"bg-amber-400":"bg-slate-950/80")}/></button>))}</div></div>
 <div className="rounded-2xl border border-border bg-card p-4 text-center" aria-live="polite">{winner?<p className="text-lg font-black text-primary">🎉 Mchezaji {winner} ameshinda!</p>:draw?<p className="text-lg font-black">🤝 Sare!</p>:<p className="text-sm font-semibold">Zamu ya Mchezaji {turn} · Chagua safu</p>}<button onClick={reset} className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Mchezo mpya</button></div>
 <p className="text-center text-xs text-muted-foreground">Toleo hili ni local pass-and-play. Multiplayer ya mtandaoni na leaderboard vitaongezwa tofauti.</p></div></main>;
}
