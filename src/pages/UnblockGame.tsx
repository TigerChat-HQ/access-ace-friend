import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Home, Lightbulb, RotateCcw, Undo2, Trophy, MoveHorizontal, Volume2, VolumeX, Settings2 } from "lucide-react";

type Vehicle = { id:string; row:number; col:number; length:number; axis:"h"|"v"; target?:boolean };
type Puzzle = { name:string; vehicles:Vehicle[]; par:number };
type Snapshot = { vehicles:Vehicle[]; moves:number };
const puzzles:Puzzle[]=[
 {name:"Mwanzo wa mbao",par:4,vehicles:[
  {id:"A",row:0,col:0,length:2,axis:"v"},{id:"B",row:0,col:2,length:2,axis:"h"},
  {id:"C",row:0,col:4,length:3,axis:"v"},{id:"D",row:1,col:5,length:2,axis:"v"},
  {id:"X",row:2,col:1,length:2,axis:"h",target:true},{id:"E",row:3,col:0,length:2,axis:"h"},
  {id:"F",row:3,col:2,length:2,axis:"v"},{id:"G",row:4,col:0,length:2,axis:"h"},
  {id:"H",row:5,col:0,length:2,axis:"h"}
 ]},
 {name:"Njia nyembamba",par:5,vehicles:[
  {id:"A",row:1,col:0,length:2,axis:"v"},{id:"B",row:1,col:2,length:2,axis:"h"},
  {id:"C",row:0,col:4,length:3,axis:"v"},{id:"D",row:1,col:5,length:2,axis:"v"},
  {id:"X",row:2,col:1,length:2,axis:"h",target:true},{id:"E",row:3,col:0,length:2,axis:"h"},
  {id:"F",row:3,col:2,length:2,axis:"v"},{id:"G",row:4,col:0,length:2,axis:"h"},
  {id:"H",row:5,col:0,length:2,axis:"h"}
 ]},
 {name:"Mtaalamu",par:4,vehicles:[
  {id:"A",row:0,col:0,length:2,axis:"v"},{id:"B",row:0,col:2,length:2,axis:"h"},
  {id:"C",row:0,col:4,length:3,axis:"v"},{id:"D",row:1,col:5,length:2,axis:"v"},
  {id:"X",row:2,col:1,length:2,axis:"h",target:true},{id:"E",row:3,col:0,length:2,axis:"h"},
  {id:"F",row:3,col:2,length:2,axis:"v"},{id:"G",row:4,col:0,length:2,axis:"h"},
  {id:"H",row:5,col:2,length:2,axis:"h"}
 ]}
];
const copy=(v:Vehicle[])=>v.map(x=>({...x}));
const occupied=(vehicles:Vehicle[],ignore?:string)=>{const cells=new Set<string>();for(const v of vehicles){if(v.id===ignore)continue;for(let i=0;i<v.length;i++)cells.add((v.row+(v.axis==="v"?i:0))+":"+(v.col+(v.axis==="h"?i:0)));}return cells;};
const valid=(vehicles:Vehicle[],v:Vehicle)=>{if(v.row<0||v.col<0||v.row+(v.axis==="v"?v.length:1)>6||v.col+(v.axis==="h"?v.length:1)>6)return false;const used=occupied(vehicles,v.id);for(let i=0;i<v.length;i++)if(used.has((v.row+(v.axis==="v"?i:0))+":"+(v.col+(v.axis==="h"?i:0))))return false;return true;};
const solved=(vehicles:Vehicle[])=>{const x=vehicles.find(v=>v.target);return !!x&&x.col+x.length===6;};
const stateKey=(v:Vehicle[])=>v.map(x=>x.axis==="h"?x.col:x.row).join(",");
function buildLevels():Puzzle[]{
 const levels:Puzzle[]=[];
 const used=new Set<string>();
 let seed=100100;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let level=0;level<100;level++){
  const base=puzzles[level%puzzles.length];
  let chosen:Vehicle[]|null=null;
  for(let attempt=0;attempt<500&&!chosen;attempt++){
   const candidate=copy(base.vehicles);
   const steps=3+level+attempt%7;
   for(let step=0;step<steps;step++){
    const vehicle=candidate[Math.floor(random()*candidate.length)];
    const delta=random()<.5?-1:1;
    const trial=copy(candidate);
    const moving=trial.find(v=>v.id===vehicle.id)!;
    if(moving.axis==="h")moving.col+=delta;else moving.row+=delta;
    if(valid(candidate,moving)){vehicle.row=moving.row;vehicle.col=moving.col;}
   }
   const key=stateKey(candidate);
   if(!used.has(key)&&!solved(candidate)){used.add(key);chosen=candidate;}
  }
  const source=chosen??copy(puzzles[level%puzzles.length].vehicles);
  levels.push({name:level<20?"Mwanzo wa mbao":level<45?"Njia za kati":level<75?"Mtego wa mbao":"Changamoto ya bingwa",par:base.par+3+level,vehicles:source});
 }
 return levels;
}
const allLevels=buildLevels();
function findSolution(start:Vehicle[]){const queue:{v:Vehicle[];path:{id:string;delta:number}[]}[]=[{v:copy(start),path:[]}];const seen=new Set([stateKey(start)]);let head=0;while(head<queue.length&&head<12000){const cur=queue[head++];if(solved(cur.v))return cur.path;for(const vehicle of cur.v){for(const delta of [-1,1]){const next=copy(cur.v);const item=next.find(x=>x.id===vehicle.id)!;if(item.axis==="h")item.col+=delta;else item.row+=delta;if(!valid(cur.v,item))continue;const key=stateKey(next);if(seen.has(key))continue;seen.add(key);queue.push({v:next,path:[...cur.path,{id:item.id,delta}]});}}}return [] as {id:string;delta:number}[];}
export default function UnblockGame(){
 const [level,setLevel]=useState(0);const [vehicles,setVehicles]=useState(()=>copy(allLevels[0].vehicles));const [moves,setMoves]=useState(0);const [best,setBest]=useState(()=>{try{return Number(localStorage.getItem("tiger-unblock-best")||0)}catch{/* Storage may be unavailable in private browsing. */return 0}});const [history,setHistory]=useState<Snapshot[]>([]);const [hint,setHint]=useState<{id:string;delta:number}|null>(null);const [sound,setSound]=useState(true);const [customOpen,setCustomOpen]=useState(false);const [pieceStyle,setPieceStyle]=useState<"wood"|"cars"|"trucks"|"neon">("wood");const [boardTheme,setBoardTheme]=useState<"classic"|"midnight"|"light">("classic");const [drag,setDrag]=useState<{id:string;x:number;y:number}|null>(null);
 const puzzle=allLevels[level];const complete=solved(vehicles);const solution=useMemo(()=>findSolution(vehicles),[vehicles]);const board=useMemo(()=>{const a=Array.from({length:6},()=>Array(6).fill(""));for(const v of vehicles)for(let i=0;i<v.length;i++)a[v.row+(v.axis==="v"?i:0)][v.col+(v.axis==="h"?i:0)]=v.id;return a;},[vehicles]);
 const playSound=()=>{if(!sound)return;try{const AudioContextCtor=window.AudioContext??(window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioContextCtor)return;const ctx=new AudioContextCtor(),o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=430;g.gain.value=.035;o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.08);o.onended=()=>void ctx.close();}catch{ /* Audio is optional when browser audio is unavailable. */ void 0; }};
 const move=(id:string,delta:number)=>{if(complete)return;const old=copy(vehicles);const next=copy(vehicles);const v=next.find(x=>x.id===id);if(!v)return;const step=Math.sign(delta);for(let i=0;i<Math.abs(delta);i++){const trial={...v};if(v.axis==="h")trial.col+=step;else trial.row+=step;if(!valid(next,trial))break;v.row=trial.row;v.col=trial.col;}if(v.row===old.find(x=>x.id===id)?.row&&v.col===old.find(x=>x.id===id)?.col)return;setHistory(h=>[...h,{vehicles:old,moves}].slice(-100));setVehicles(next);setMoves(n=>n+Math.abs(v.axis==="h"?v.col-old.find(x=>x.id===id)!.col:v.row-old.find(x=>x.id===id)!.row));setHint(null);playSound();};
 const reset=()=>{setVehicles(copy(puzzle.vehicles));setMoves(0);setHistory([]);setHint(null);setDrag(null);};
 const undo=()=>{const prev=history[history.length-1];if(!prev)return;setVehicles(prev.vehicles);setMoves(prev.moves);setHistory(h=>h.slice(0,-1));setHint(null);};
 const nextLevel=()=>{const n=Math.min(allLevels.length-1,level+1);setLevel(n);setVehicles(copy(allLevels[n].vehicles));setMoves(0);setHistory([]);setHint(null);};
 const showHint=()=>{const step=solution[0];if(step)setHint(step);};
 const beginDrag=(e:React.PointerEvent<HTMLButtonElement>,v:Vehicle)=>{if(complete)return;e.currentTarget.setPointerCapture(e.pointerId);setDrag({id:v.id,x:e.clientX,y:e.clientY});};
 const endDrag=(e:React.PointerEvent<HTMLButtonElement>,v:Vehicle)=>{if(!drag||drag.id!==v.id)return;const delta=(v.axis==="h"?e.clientX-drag.x:e.clientY-drag.y)/ (e.currentTarget.parentElement?.getBoundingClientRect().width??300)*6;const cells=Math.round(delta);if(cells)move(v.id,cells);setDrag(null);};
 const color=(id:string)=>id==="X"?(pieceStyle==="neon"?"from-fuchsia-400 via-rose-500 to-purple-800":"from-red-500 via-orange-600 to-red-800"):pieceStyle==="neon"?"from-cyan-300 via-blue-500 to-indigo-800":pieceStyle==="cars"?"from-sky-200 via-blue-500 to-blue-800":pieceStyle==="trucks"?"from-emerald-200 via-green-600 to-green-900":"from-amber-200 via-amber-500 to-amber-700";
 const pieceEmoji=(v:Vehicle)=>v.target?"🚗":pieceStyle==="cars"?"🚙":pieceStyle==="trucks"?"🚚":pieceStyle==="neon"?"✦":"🪵";
 const boardClass=boardTheme==="midnight"?"bg-slate-950 border-slate-500":boardTheme==="light"?"bg-stone-200 border-stone-400":"bg-[#351305] border-[#6b3516]";
 const textClass=boardTheme==="light"?"text-stone-900":"text-[#fff1d2]";
 return <main className={"min-h-full overflow-y-auto px-3 pb-24 pt-3 "+(boardTheme==="light"?"bg-stone-100":"bg-[#160b06]")+" "+textClass}><div className="mx-auto max-w-lg space-y-3">
 <header className="flex items-center justify-between"><Link to="/games" onClick={(event)=>{if(moves>0&&!complete&&!window.confirm("Una uhakika unataka kutoka kwenye Unblock Puzzle? Ukitoka sasa, maendeleo ya level hii yatapotea."))event.preventDefault();}} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-950/60 px-3 py-2 text-sm font-bold text-amber-100"><ArrowLeft className="h-4 w-4"/> Games Arena</Link><div className="flex gap-2"><button aria-label="Badili sauti" onClick={()=>setSound(s=>!s)} className="rounded-xl border border-amber-300/30 bg-amber-950/60 p-2">{sound?<Volume2 className="h-4 w-4"/>:<VolumeX className="h-4 w-4"/>}</button><button aria-label="Customize game" onClick={()=>setCustomOpen(v=>!v)} className="rounded-xl border border-amber-300/30 bg-amber-950/60 p-2"><Settings2 className="h-4 w-4"/></button></div></header>
 <section className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-[#4a210c] to-[#1e0d05] p-3 text-center shadow-lg"><p className="text-[10px] font-black uppercase tracking-[.28em] text-amber-300">TigerChat Wooden Puzzle</p><h1 className="mt-1 text-3xl font-black tracking-wide text-amber-100">UNBLOCK</h1><p className="mt-1 text-xs text-amber-100/70">Telezesha vipande vya mbao. Toa kipande chekundu kupitia mlango wa kulia.</p></section>
 {customOpen&&<section className="rounded-2xl border border-amber-300/30 bg-[#261207] p-4 text-amber-50 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">Customize mchezo</h2><button onClick={()=>setCustomOpen(false)} className="text-xs text-amber-300">Funga</button></div><label className="mb-1 block text-xs font-bold text-amber-200">Muonekano wa vipande</label><div className="grid grid-cols-2 gap-2">{([{id:"wood",label:"Mbao 🪵"},{id:"cars",label:"Magari 🚙"},{id:"trucks",label:"Malori 🚚"},{id:"neon",label:"Neon ✦"}] as const).map(x=><button key={x.id} onClick={()=>setPieceStyle(x.id)} className={"rounded-xl border p-3 text-sm font-bold "+(pieceStyle===x.id?"border-amber-300 bg-amber-300/20":"border-white/15 bg-white/5")}>{x.label}</button>)}</div><label className="mb-1 mt-4 block text-xs font-bold text-amber-200">Mandhari ya ubao</label><div className="grid grid-cols-3 gap-2">{([{id:"classic",label:"Mbao"},{id:"midnight",label:"Usiku"},{id:"light",label:"Mwanga"}] as const).map(x=><button key={x.id} onClick={()=>setBoardTheme(x.id)} className={"rounded-xl border p-2 text-xs font-bold "+(boardTheme===x.id?"border-amber-300 bg-amber-300/20":"border-white/15 bg-white/5")}>{x.label}</button>)}</div><p className="mt-3 text-[10px] text-amber-200/70">Mabadiliko yanaonekana papo hapo. Unaweza kubadilisha wakati wowote.</p></section>}
 <div className="grid grid-cols-[1fr_1.5fr_1fr] gap-2 text-center"><div className="rounded-xl border border-amber-300/30 bg-[#3b1909] p-2"><p className="text-[10px] font-bold text-amber-200/70">MOVES</p><p className="text-xl font-black">{moves}</p></div><div className="rounded-xl border border-amber-300/40 bg-[#4a210c] p-2"><p className="text-[10px] font-bold text-amber-200/70">LEVEL</p><div className="flex items-center justify-center gap-3"><button disabled={level===0} onClick={()=>{setLevel(l=>l-1);setVehicles(copy(allLevels[Math.max(0,level-1)].vehicles));setMoves(0);setHistory([]);}}><ChevronLeft className="h-5 w-5"/></button><span className="text-xl font-black">{level+1}</span><button disabled={level===allLevels.length-1} onClick={()=>{setLevel(l=>l+1);setVehicles(copy(allLevels[Math.min(allLevels.length-1,level+1)].vehicles));setMoves(0);setHistory([]);}}><ChevronRight className="h-5 w-5"/></button></div></div><div className="rounded-xl border border-amber-300/30 bg-[#3b1909] p-2"><p className="text-[10px] font-bold text-amber-200/70">BEST</p><p className="text-xl font-black">{best||"—"}</p></div></div>
 <div className={"relative mx-auto aspect-square w-full rounded-[24px] border-[7px] p-1 shadow-[inset_0_0_20px_#120600,0_10px_25px_#0008] "+boardClass} style={{backgroundImage:"linear-gradient(90deg,transparent 99%,#8b4a2544 100%),linear-gradient(transparent 99%,#8b4a2544 100%)",backgroundSize:"16.6667% 16.6667%"}}>
 <div className={"absolute -right-3 top-[33.333%] z-0 h-[16.666%] w-4 rounded-r-md border-y-2 border-r-2 border-amber-300/70 "+(boardTheme==="light"?"bg-stone-100":"bg-[#160b06]")}/>
 <div className="relative grid h-full w-full grid-cols-6 grid-rows-6 gap-[3px]">
 {board.map((row,r)=>row.map((id,c)=><div key={r+"-"+c} className="rounded-sm border border-amber-900/30 bg-[#4a1c08]/70 shadow-inner"/>))}
 {vehicles.map(v=><button key={v.id} onPointerDown={e=>beginDrag(e,v)} onPointerUp={e=>endDrag(e,v)} onKeyDown={e=>{if(e.key==="ArrowRight"&&v.axis==="h"){e.preventDefault();move(v.id,1)}if(e.key==="ArrowLeft"&&v.axis==="h"){e.preventDefault();move(v.id,-1)}if(e.key==="ArrowDown"&&v.axis==="v"){e.preventDefault();move(v.id,1)}if(e.key==="ArrowUp"&&v.axis==="v"){e.preventDefault();move(v.id,-1)}}} className={"absolute z-10 flex select-none items-center justify-center rounded-xl border-2 border-[#7b3d17] bg-gradient-to-br "+color(v.id)+" shadow-[inset_0_2px_5px_#fff8,inset_0_-5px_8px_#54240c,0_4px_5px_#120600] active:brightness-110 "+(hint?.id===v.id?"ring-4 ring-yellow-300 ring-offset-2 ring-offset-[#351305]":"")} style={{left:(v.col*100/6)+"%",top:(v.row*100/6)+"%",width:((v.axis==="h"?v.length:1)*100/6)+"%",height:((v.axis==="v"?v.length:1)*100/6)+"%",padding:3,touchAction:"none"}} aria-label={"Kipande "+v.id+", "+(v.axis==="h"?"mlalo":"wima")}>
 <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl drop-shadow-md">{pieceEmoji(v)}</span><span className="pointer-events-none absolute inset-x-1 top-1 h-1 rounded-full bg-white/35"/>
 {v.target&&<span className="absolute text-lg font-black text-red-950 drop-shadow">★</span>}
 </button>)}
 </div>
 {complete&&<div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/65 p-4 text-center backdrop-blur-sm"><div className="rounded-2xl border border-amber-300/50 bg-[#4a210c] p-5 shadow-2xl"><Trophy className="mx-auto h-10 w-10 text-amber-300"/><h2 className="mt-2 text-2xl font-black">UMESHINDA!</h2><p className="mt-1 text-sm">Umefungua njia kwa moves {moves}.</p><button onClick={()=>{setBest(b=>{const n=!b||moves<b?moves:b;try{localStorage.setItem("tiger-unblock-best",String(n))}catch{/* Keep the in-memory score if storage is unavailable. */}return n;});nextLevel();}} className="mt-4 rounded-xl bg-amber-300 px-5 py-3 font-black text-amber-950">{level===allLevels.length-1?"Cheza tena":"Level inayofuata"}</button></div></div>}
 </div>
 <div className="flex items-center justify-center gap-3"><button onClick={()=>{setLevel(0);setVehicles(copy(allLevels[0].vehicles));setMoves(0);setHistory([]);setHint(null);setDrag(null);}} className="rounded-xl border border-amber-300/30 bg-[#4a210c] p-3"><Home className="h-6 w-6"/></button><button onClick={showHint} className="relative rounded-xl border border-amber-300/30 bg-[#4a210c] p-3"><Lightbulb className="h-6 w-6"/><span className="absolute -right-1 -top-1 rounded-full bg-amber-300 px-1 text-[9px] font-black text-amber-950">HINT</span></button><button onClick={undo} disabled={!history.length} className="rounded-xl border border-amber-300/30 bg-[#4a210c] p-3 disabled:opacity-30"><Undo2 className="h-6 w-6"/></button><button onClick={reset} className="rounded-xl border border-amber-300/30 bg-[#4a210c] p-3"><RotateCcw className="h-6 w-6"/></button></div>
 <p className="text-center text-[11px] text-amber-100/60"><MoveHorizontal className="mr-1 inline h-3 w-3"/> Buruta kipande upande wake, au tumia mishale ya keyboard. Kipande hakiwezi kuruka juu ya kingine.</p>
 </div></main>;
}
