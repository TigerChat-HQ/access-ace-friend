import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Settings2, Trophy, Zap, Camera, Users, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pool3DTable from "@/components/pool/Pool3DTable";

type Ball = { id:number; x:number; y:number; vx:number; vy:number; color:string; label:string; group:"solid"|"stripe"|"cue"|"eight"; pocketed:boolean };
type Mode = "practice"|"eight"|"nine";
const COLORS = ["#facc15","#2563eb","#dc2626","#7c3aed","#ea580c","#16a34a","#991b1b","#111827","#facc15","#2563eb","#dc2626","#7c3aed","#ea580c","#16a34a","#991b1b"];
const rack = (mode: Mode = "eight"): Ball[] => {
  const balls:Ball[]=[{id:0,x:.22,y:.5,vx:0,vy:0,color:"#f8fafc",label:"",group:"cue",pocketed:false}];
  const eightSpots=[[.68,.5],[.72,.475],[.72,.525],[.76,.45],[.76,.5],[.76,.55],[.80,.425],[.80,.475],[.80,.525],[.80,.575],[.84,.40],[.84,.45],[.84,.50],[.84,.55],[.84,.60]];
  const nineSpots=[[.68,.5],[.72,.475],[.72,.525],[.76,.45],[.76,.5],[.76,.55],[.80,.425],[.80,.475],[.80,.525]];
  const spots=mode==="nine"?nineSpots:eightSpots;
  const ids=mode==="nine"?[1,2,3,4,9,5,6,7,8]:[1,2,3,4,8,5,6,7,9,10,11,12,13,14,15];
  spots.forEach(([x,y],i)=>{const id=ids[i];balls.push({id,x,y,vx:0,vy:0,color:id===8&&mode!=="nine"?"#111827":COLORS[id-1],label:String(id),group:mode!=="nine"&&id===8?"eight":id<8?"solid":"stripe",pocketed:false});});
  return balls;
};
const pockets=[[.035,.075],[.5,.075],[.965,.075],[.035,.925],[.5,.925],[.965,.925]];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

const playPoolTone=(frequency:number)=>{const AudioContextCtor=window.AudioContext;if(!AudioContextCtor)return;const context=new AudioContextCtor();const oscillator=context.createOscillator();const gain=context.createGain();oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.035,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.12);oscillator.connect(gain);gain.connect(context.destination);oscillator.onended=()=>{void context.close();};oscillator.start();oscillator.stop(context.currentTime+.13);};

export default function PoolArena(){
 const nav=useNavigate(); const [balls,setBalls]=useState<Ball[]>(rack); const ballsRef=useRef(balls); const [mode,setMode]=useState<Mode>("eight"); const [power,setPower]=useState(48); const [angle,setAngle]=useState(0); const [moving,setMoving]=useState(false);  const [shots,setShots]=useState(0); const [pocketed,setPocketed]=useState<number[]>([]); const [sound,setSound]=useState(true); const [camera,setCamera]=useState<"top"|"angle">("angle"); const [message,setMessage]=useState("Panga cue direction kisha bonyeza SHOOT."); const [aim,setAim]=useState({x:.22,y:.5}); const [showRules,setShowRules]=useState(false); const [ballInHand,setBallInHand]=useState(false); const [opponent,setOpponent]=useState<"practice"|"ai">("practice"); const [playerTurn,setPlayerTurn]=useState(true); const aiShotRef=useRef(false);
 useEffect(()=>{ballsRef.current=balls;},[balls]);
 const reset=useCallback((nextMode:Mode=mode)=>{const next=rack(nextMode);ballsRef.current=next;setBalls(next);setMoving(false);setShots(0);setPocketed([]);setAngle(0);setBallInHand(false);setPlayerTurn(true);aiShotRef.current=false;setMessage("Meza imeandaliwa. Wewe unaanza.");},[mode]);
 const shoot=(shotAngle=angle,shotPower=power,byAI=false)=>{
  if(moving||(ballInHand&&!byAI)||(opponent==="ai"&&!playerTurn&&!byAI))return;
  aiShotRef.current=byAI;
  if(sound)playPoolTone(170);
  const next=ballsRef.current.map(b=>({...b}));
  const cue=next.find(b=>b.id===0);if(!cue||cue.pocketed)return;
  const speed=shotPower/100*.026;cue.vx=Math.cos(shotAngle)*speed;cue.vy=Math.sin(shotAngle)*speed;
  ballsRef.current=next;setBalls(next);setMoving(true);setShots(s=>s+1);setMessage("Shot inachezwa…");
 };
 useEffect(()=>{
  if(!moving)return;
  let frame=0;let raf=0;let last=performance.now();
  const tick=(now:number)=>{
   const dt=Math.min((now-last)/16.667,2);last=now;let active=false;const next=ballsRef.current.map(b=>({...b}));
   for(const b of next){if(b.pocketed)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=Math.pow(.986,dt);b.vy*=Math.pow(.986,dt);
    if(Math.hypot(b.vx,b.vy)>.00018)active=true;else{b.vx=0;b.vy=0;}
    if(b.x<.055||b.x>.945){b.x=clamp(b.x,.055,.945);b.vx*=-.88;}
    if(b.y<.105||b.y>.895){b.y=clamp(b.y,.105,.895);b.vy*=-.88;}
   }
   for(let i=0;i<next.length;i++){const a=next[i];if(a.pocketed)continue;for(let j=i+1;j<next.length;j++){const b=next[j];if(b.pocketed)continue;const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),min=.027;if(dist>0&&dist<min){const nx=dx/dist,ny=dy/dist,overlap=(min-dist)/2;a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(rel>0){a.vx-=rel*nx*.96;a.vy-=rel*ny*.96;b.vx+=rel*nx*.96;b.vy+=rel*ny*.96;}}}}
   const newly:number[]=[];
   for(const b of next){if(b.pocketed)continue;const hole=pockets.find(([x,y])=>Math.hypot(b.x-x,b.y-y)<.041);if(hole){if(b.id===0){b.pocketed=true;newly.push(0);}else{b.pocketed=true;newly.push(b.id);}}}
   if(newly.length){if(sound&&newly.some(n=>n!==0))playPoolTone(520);setPocketed(p=>[...p,...newly.filter(n=>n!==0)]);if(newly.includes(0)){const cue=next.find(b=>b.id===0)!;cue.pocketed=false;cue.x=.22;cue.y=.5;cue.vx=0;cue.vy=0;setBallInHand(true);setMessage("FOUL: Scratch! Gusa sehemu tupu ya meza kuweka cue ball (Ball-in-Hand).");}}
   ballsRef.current=next;setBalls(next);frame++;
   if(active&&frame<1200){raf=requestAnimationFrame(tick);}else{setMoving(false);if(aiShotRef.current){aiShotRef.current=false;setPlayerTurn(true);setMessage("Tiger AI amemaliza zamu. Ni zamu yako.");}else if(opponent==="ai"){setPlayerTurn(false);setMessage("Tiger AI anachagua shot…");}else if(!newly.includes(0)&&newly.some(n=>n!==0))setMessage("Mpira umeingia! Endelea na shot inayofuata.");else if(!newly.length)setMessage("Zamu yako. Rekebisha angle na power.");}
  };
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[moving,sound,opponent]);
 useEffect(()=>{
  if(opponent!=="ai"||playerTurn||moving)return;
  const timer=window.setTimeout(()=>{
   let live=ballsRef.current.map(b=>({...b}));
   let cue=live.find(b=>b.id===0);
   if(!cue){setPlayerTurn(true);return;}
   if(ballInHand){
    const spots:Array<[number,number]>=[[.18,.5],[.15,.35],[.15,.65],[.25,.5]];
    const spot=spots.find(([x,y])=>live.every(b=>b.id===0||b.pocketed||Math.hypot(b.x-x,b.y-y)>.04))??[.18,.5];
    live=live.map(b=>b.id===0?{...b,x:spot[0],y:spot[1],vx:0,vy:0,pocketed:false}:b);
    ballsRef.current=live;setBalls(live);setBallInHand(false);cue=live.find(b=>b.id===0);
   }
   const targets=live.filter(b=>b.id!==0&&!b.pocketed).sort((a,b)=>mode==="nine"?a.id-b.id:Math.hypot(a.x-(cue?.x??.22),a.y-(cue?.y??.5))-Math.hypot(b.x-(cue?.x??.22),b.y-(cue?.y??.5)));
   const target=targets[0];
   if(!cue||!target){setPlayerTurn(true);setMessage("Tiger AI amemaliza mchezo wa mazoezi.");return;}
   const shotAngle=Math.atan2(target.y-cue.y,target.x-cue.x);
   setAngle(shotAngle);setPower(58);setMessage("Tiger AI anapiga…");shoot(shotAngle,58,true);
  },850);
  return()=>window.clearTimeout(timer);
 },[opponent,playerTurn,moving,ballInHand,mode]);
 const setAimFromPointer=(event:PointerEvent<HTMLDivElement>|MouseEvent<HTMLDivElement>)=>{const rect=event.currentTarget.getBoundingClientRect();const x=clamp((event.clientX-rect.left)/rect.width,.07,.93),y=clamp((event.clientY-rect.top)/rect.height,.12,.88);const cue=ballsRef.current.find(b=>b.id===0);if(!cue||moving)return;if(ballInHand&&event.type==="click"){const blocked=ballsRef.current.some(b=>b.id!==0&&!b.pocketed&&Math.hypot(b.x-x,b.y-y)<.032);if(blocked){setMessage("Eneo hilo limezibwa. Chagua sehemu tupu ya meza.");return;}const next=ballsRef.current.map(b=>b.id===0?{...b,x,y,vx:0,vy:0,pocketed:false}:b);ballsRef.current=next;setBalls(next);setBallInHand(false);setAim({x,y});setMessage("Cue ball imewekwa. Chagua mwelekeo kisha piga SHOOT.");return;}if(!ballInHand){setAngle(Math.atan2(y-cue.y,x-cue.x));setAim({x,y});}};
 const cue=balls.find(b=>b.id===0);const remaining=balls.filter(b=>b.id!==0&&!b.pocketed).length;
 return <main className="min-h-full overflow-y-auto bg-background pb-24">
  <header className="tiger-page-header"><button onClick={()=>nav("/games")} className="tiger-header-action" aria-label="Back to games"><ArrowLeft className="h-5 w-5"/></button><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">TigerChat Sports</p><h1 className="text-base font-black">4D Pool Arena</h1></div><button onClick={()=>setShowRules(v=>!v)} className="rounded-lg p-2 hover:bg-muted" aria-label="Rules"><CircleHelp className="h-5 w-5"/></button></header>
  <section className="mx-auto max-w-5xl space-y-4 p-3 sm:p-5">
   <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black">Premium Pool Table</h2><p className="text-xs text-muted-foreground">WebGL 3D renderer · local physics preview · touch controls</p></div><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-500">PRACTICE MODE</span></div>
   <div className="grid grid-cols-3 gap-2 sm:grid-cols-4"><button onClick={()=>{setMode("practice");reset("practice");}} className={`rounded-xl border p-2 text-xs font-bold ${mode==="practice"?"border-primary bg-primary/10 text-primary":"border-border bg-card"}`}>Practice</button><button onClick={()=>{setMode("eight");reset("eight");}} className={`rounded-xl border p-2 text-xs font-bold ${mode==="eight"?"border-primary bg-primary/10 text-primary":"border-border bg-card"}`}>8-Ball</button><button onClick={()=>{setMode("nine");reset("nine");}} className={`rounded-xl border p-2 text-xs font-bold ${mode==="nine"?"border-primary bg-primary/10 text-primary":"border-border bg-card"}`}>9-Ball</button><button onClick={()=>setCamera(c=>c==="angle"?"top":"angle")} className="rounded-xl border border-border bg-card p-2 text-xs font-bold"><Camera className="mr-1 inline h-3.5 w-3.5"/> {camera==="angle"?"Top view":"3D view"}</button></div>
   <div className="rounded-[28px] border border-amber-900/70 bg-gradient-to-br from-amber-700 via-amber-950 to-black p-3 shadow-2xl sm:p-5">
    <Pool3DTable balls={balls} camera={camera} angle={angle} aim={aim} ballInHand={ballInHand} onPointerMove={setAimFromPointer} onClick={setAimFromPointer}/>
   </div>
   <div className="grid grid-cols-3 gap-2"><div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Shots</p><p className="text-xl font-black">{shots}</p></div><div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Balls left</p><p className="text-xl font-black">{remaining}</p></div><div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Pocketed</p><p className="text-xl font-black">{pocketed.length}</p></div></div>
   <div className="rounded-2xl border border-border bg-card p-4 space-y-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-bold">Shot controls</span><span className="text-xs text-muted-foreground">{opponent==="ai"?(playerTurn?"Your turn":"Tiger AI turn"):"Practice"} · {Math.round(angle*180/Math.PI)}°</span></div><label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">Opponent<select className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground" value={opponent} onChange={e=>{setOpponent(e.target.value as "practice"|"ai");setPlayerTurn(true);aiShotRef.current=false;setMessage(e.target.value==="ai"?"Tiger AI amejiunga. Anacheza baada ya zamu yako.":"Practice mode.");}}><option value="practice">Practice · no opponent</option><option value="ai">Tiger AI · local opponent</option></select></label><label className="block text-xs text-muted-foreground">Power · {power}%<input className="mt-2 w-full accent-primary" type="range" min="5" max="100" value={power} onChange={e=>setPower(Number(e.target.value))} disabled={moving}/></label><div className="grid grid-cols-2 gap-2"><Button onClick={()=>shoot()} disabled={moving||ballInHand||(opponent==="ai"&&!playerTurn)}><Zap className="mr-2 h-4 w-4"/>SHOOT</Button><Button variant="outline" onClick={() => reset()} disabled={moving}><RotateCcw className="mr-2 h-4 w-4"/>Rack again</Button></div><p className="text-xs text-muted-foreground" aria-live="polite">{message}</p>{ballInHand&&<p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs font-semibold text-amber-600">BALL-IN-HAND: gusa sehemu tupu ya meza kuweka cue ball.</p>}<div className="flex flex-wrap gap-2"><button onClick={()=>setSound(v=>!v)} className="rounded-lg border border-border px-3 py-2 text-xs">{sound?<Volume2 className="mr-1 inline h-3.5 w-3.5"/>:<VolumeX className="mr-1 inline h-3.5 w-3.5"/>}Sound {sound?"On":"Off"}</button><button onClick={()=>setShowRules(v=>!v)} className="rounded-lg border border-border px-3 py-2 text-xs"><Settings2 className="mr-1 inline h-3.5 w-3.5"/>Game rules</button></div></div>
   {showRules&&<div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground"><h3 className="mb-2 font-bold text-foreground">Pool controls & rules</h3><p>Gusa eneo la meza kuelekeza shot, chagua nguvu ya cue kisha bonyeza SHOOT. Mipira hugongana, hurudi kwenye rails na huingia kwenye pockets. 8-Ball na 9-Ball hapa zina rack tofauti za mipira; sheria kamili za ushindani, foul adjudication, AI opponent na online multiplayer bado zinahitaji engine ya mechi na uthibitishaji wa server.</p><p className="mt-2">Meza ya mfano ina uwiano wa 2:1 unaofanana na meza ya 9-foot; si kipimo halisi cha kifaa cha kuchezea.</p></div>}
   <div className="grid grid-cols-2 gap-2"><button onClick={()=>nav("/draughts/tournaments")} className="rounded-xl border border-border bg-card p-3 text-left"><Trophy className="mb-2 h-5 w-5 text-primary"/><b className="block text-xs">Draughts tournaments</b><span className="text-[10px] text-muted-foreground">Current live competitions</span></button><button onClick={()=>nav("/games")} className="rounded-xl border border-border bg-card p-3 text-left"><Users className="mb-2 h-5 w-5 text-primary"/><b className="block text-xs">More games</b><span className="text-[10px] text-muted-foreground">Back to Games Hub</span></button></div>
  </section>
 </main>;
}
