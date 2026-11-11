import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Settings2, Trophy, Zap, Camera, Users, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pool3DTable from "@/components/pool/Pool3DTable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
type PoolRoom = { id: string; room_code: string | null; mode: string; status: string; player_one: string; player_two: string | null; current_turn?: string | null; revision?: number; state?: { balls?: Ball[]; ballInHandFor?: string | null; winnerId?: string | null } };
type PoolTrajectoryFrame = { t: number; balls: Array<{ id:number; x:number; y:number; pocketed:boolean }> };
type PoolServerResponse = { match?: PoolRoom; state?: PoolRoom["state"]; result?: { foul?: boolean; foulReason?: string | null; trajectory?: PoolTrajectoryFrame[]; progressionPending?: boolean } };
type PoolRealtimeChannel = { on: (type:"postgres_changes", filter:{event:"UPDATE"|"INSERT";schema:"public";table:"pool_matches"|"pool_match_events";filter:string}, callback:(payload:{new:unknown})=>void) => PoolRealtimeChannel; subscribe:()=>unknown };
type PoolTournament = { id:string; title:string; mode:string; status:string; max_players:number; entry_fee:number; prize_pool:number; owner_id:string };
type PoolTournamentMatch = { id:string; tournament_id:string; round_no:number; match_no:number; player_one:string; player_two:string; match_id:string; winner_id:string|null; status:string };
const poolRpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const poolQueueFrom = supabase.from as unknown as (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> } } };
const poolRealtime = supabase as unknown as {
 channel: (name: string) => PoolRealtimeChannel;
 removeChannel: (channel: unknown) => Promise<unknown>;
};
const poolTournamentList = supabase.from as unknown as (table:string)=>{select:(columns:string)=>{order:(column:string,options:{ascending:boolean})=>{limit:(count:number)=>Promise<{data:unknown;error:{message:string}|null}>}}};
const poolTournamentMatchList = supabase.from as unknown as (table:string)=>{select:(columns:string)=>{eq:(column:string,value:string)=>{order:(column:string,options:{ascending:boolean})=>Promise<{data:unknown;error:{message:string}|null}>}}};


const playPoolTone=(frequency:number)=>{const AudioContextCtor=window.AudioContext;if(!AudioContextCtor)return;const context=new AudioContextCtor();const oscillator=context.createOscillator();const gain=context.createGain();oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.035,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.12);oscillator.connect(gain);gain.connect(context.destination);oscillator.onended=()=>{void context.close();};oscillator.start();oscillator.stop(context.currentTime+.13);};

export default function PoolArena(){
 const nav=useNavigate(); const {toast}=useToast(); const [poolRating,setPoolRating]=useState<{rating:number;wins:number;losses:number;games_played:number}|null>(null); const [poolCoins,setPoolCoins]=useState<number>(0); const [tournaments,setTournaments]=useState<PoolTournament[]>([]); const [tournamentTitle,setTournamentTitle]=useState(""); const [bracketTournamentId,setBracketTournamentId]=useState<string|null>(null); const [bracketMatches,setBracketMatches]=useState<PoolTournamentMatch[]>([]); const [onlineRoom,setOnlineRoom]=useState<PoolRoom|null>(null); const [onlinePlayerId,setOnlinePlayerId]=useState<string|null>(null); const [onlineCuePosition,setOnlineCuePosition]=useState<{x:number;y:number}|null>(null); const [onlineBusy,setOnlineBusy]=useState(false); const [joinRoomCode,setJoinRoomCode]=useState(""); const [queueTicket,setQueueTicket]=useState<string|null>(null); const [onlineNotice,setOnlineNotice]=useState(""); const [balls,setBalls]=useState<Ball[]>(rack); const ballsRef=useRef(balls); const animationRafRef=useRef<number|null>(null); const [mode,setMode]=useState<Mode>("eight"); const [power,setPower]=useState(48); const [angle,setAngle]=useState(0); const [moving,setMoving]=useState(false);  const [shots,setShots]=useState(0); const [pocketed,setPocketed]=useState<number[]>([]); const [sound,setSound]=useState(true); const [camera,setCamera]=useState<"top"|"angle">("angle"); const [message,setMessage]=useState("Panga cue direction kisha bonyeza SHOOT."); const [aim,setAim]=useState({x:.22,y:.5}); const [showRules,setShowRules]=useState(false); const [ballInHand,setBallInHand]=useState(false); const [opponent,setOpponent]=useState<"practice"|"ai">("practice"); const [playerTurn,setPlayerTurn]=useState(true); const aiShotRef=useRef(false);
 useEffect(()=>{ballsRef.current=balls;},[balls]);
 useEffect(()=>()=>{if(animationRafRef.current!==null)cancelAnimationFrame(animationRafRef.current);},[]);
 const animateTrajectory=useCallback((trajectory:PoolTrajectoryFrame[],finalBalls?:Ball[])=>{
  if(!Array.isArray(trajectory)||trajectory.length===0)return;
  if(animationRafRef.current!==null)cancelAnimationFrame(animationRafRef.current);
  setMoving(true);
  const frames=trajectory,started=performance.now(),duration=Math.max(1,(frames[frames.length-1].t-frames[0].t)*1000);
  const tick=(now:number)=>{
   const progress=Math.min(1,(now-started)/duration),targetTime=frames[0].t+progress*(frames[frames.length-1].t-frames[0].t);
   let right=frames.findIndex(frame=>frame.t>=targetTime);if(right<0)right=frames.length-1;
   const left=Math.max(0,right-1),a=frames[left],b=frames[right],span=Math.max(.0001,b.t-a.t),mix=Math.max(0,Math.min(1,(targetTime-a.t)/span));
   const previous=ballsRef.current;
   const next=previous.map(ball=>{const pa=a.balls.find(item=>item.id===ball.id),pb=b.balls.find(item=>item.id===ball.id);if(!pa||!pb)return ball;return {...ball,x:pa.x+(pb.x-pa.x)*mix,y:pa.y+(pb.y-pa.y)*mix,pocketed:mix>=.98?pb.pocketed:pa.pocketed};});
   ballsRef.current=next;setBalls(next);
   if(progress<1){animationRafRef.current=requestAnimationFrame(tick);}
   else{const final=finalBalls??next;ballsRef.current=final;setBalls(final);animationRafRef.current=null;setMoving(false);}
  };
  animationRafRef.current=requestAnimationFrame(tick);
 },[]);
 const loadPoolProfile=useCallback(async(userId:string)=>{
  const [rating,wallet]=await Promise.all([
   poolQueueFrom("pool_player_ratings").select("rating,wins,losses,games_played").eq("user_id",userId).maybeSingle(),
   poolQueueFrom("pool_wallets").select("balance").eq("user_id",userId).maybeSingle()
  ]);
  setPoolRating((rating.data as {rating:number;wins:number;losses:number;games_played:number}|null)??null);
  setPoolCoins(Number((wallet.data as {balance?:number}|null)?.balance??0));
 },[]);
 const loadTournaments=useCallback(async()=>{
  const {data,error}=await poolTournamentList("pool_tournaments").select("id,title,mode,status,max_players,entry_fee,prize_pool,owner_id").order("created_at",{ascending:false}).limit(6);
  if(!error&&Array.isArray(data))setTournaments(data as PoolTournament[]);
 },[]);
 const loadBracket=useCallback(async(tournamentId:string)=>{
  const {data,error}=await poolTournamentMatchList("pool_tournament_matches").select("id,tournament_id,round_no,match_no,player_one,player_two,match_id,winner_id,status").eq("tournament_id",tournamentId).order("round_no",{ascending:true});
  if(error){toast({title:"Bracket haijasomeka",description:error.message,variant:"destructive"});return;}
  setBracketTournamentId(tournamentId);setBracketMatches(Array.isArray(data)?data as PoolTournamentMatch[]:[]);
 },[toast]);

 useEffect(()=>{void supabase.auth.getUser().then(({data})=>{const id=data.user?.id??null;setOnlinePlayerId(id);if(id)void loadPoolProfile(id);});void loadTournaments();},[loadPoolProfile,loadTournaments]);
 useEffect(()=>{const poll=window.setInterval(()=>{void loadTournaments();if(bracketTournamentId)void loadBracket(bracketTournamentId);},15000);return()=>window.clearInterval(poll);},[loadTournaments,loadBracket,bracketTournamentId]);
 const refreshOnlineMatch=useCallback(async(matchId:string)=>{
  const {data,error}=await supabase.functions.invoke<PoolServerResponse>("pool-game",{body:{action:"state",matchId}});
  if(error){setOnlineNotice("Haiwezi kusoma hali ya mechi: "+error.message);return;}
  if(data?.match){setOnlineRoom(data.match);if(Array.isArray(data.state?.balls)&&animationRafRef.current===null){ballsRef.current=data.state.balls;setBalls(data.state.balls);}setOnlineCuePosition(null);if(animationRafRef.current===null)setMoving(false);}
 },[]);
 useEffect(()=>{
  if(!onlineRoom?.id)return;
  void refreshOnlineMatch(onlineRoom.id);
  const channel=poolRealtime.channel("pool-match-"+onlineRoom.id)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"pool_matches",filter:"id=eq."+onlineRoom.id},(payload)=>{
    const row=payload.new as PoolRoom;setOnlineRoom(row);
    if(Array.isArray(row.state?.balls)){if(animationRafRef.current===null){ballsRef.current=row.state.balls;setBalls(row.state.balls);}setOnlineCuePosition(null);}
    if(row.status==="finished"){setOnlineNotice(row.state?.winnerId===onlinePlayerId?"Umeshinda mechi!":"Mechi imekamilika.");if(onlinePlayerId)void loadPoolProfile(onlinePlayerId);}
    else if(row.status==="active")setOnlineNotice(row.current_turn===onlinePlayerId?"Zamu yako. Panga shot.":"Mpinzani anacheza…");
   })
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"pool_match_events",filter:"match_id=eq."+onlineRoom.id},(payload)=>{
    const event=payload.new as {actor_id?:string;payload?:{trajectory?:PoolTrajectoryFrame[]}};
    if(event.actor_id!==onlinePlayerId&&Array.isArray(event.payload?.trajectory))animateTrajectory(event.payload.trajectory,undefined);
   }).subscribe();
  const waitingPoll=onlineRoom.status==="waiting"?window.setInterval(()=>{void refreshOnlineMatch(onlineRoom.id);},2500):null;
  return()=>{if(waitingPoll!==null)window.clearInterval(waitingPoll);void poolRealtime.removeChannel(channel);};
 },[onlineRoom?.id,onlineRoom?.status,onlinePlayerId,refreshOnlineMatch,animateTrajectory,loadPoolProfile]);
 useEffect(()=>{
  if(!queueTicket)return;
  const poll=window.setInterval(async()=>{
   const {data}=await poolQueueFrom("pool_match_queue").select("status,match_id").eq("id",queueTicket).maybeSingle();
   const ticket=data as {status:string;match_id:string|null}|null;
   if(ticket?.status==="matched"&&ticket.match_id){setQueueTicket(null);setOnlineRoom({id:ticket.match_id,room_code:null,mode:mode==="nine"?"nine_ball":"eight_ball",status:"active",player_one:"",player_two:null});setOnlineNotice("Mpinzani amepatikana. Inaunganisha mechi…");}
   else if(ticket&&(ticket.status==="expired"||ticket.status==="cancelled")){setQueueTicket(null);setOnlineNotice("Utafutaji wa mpinzani umeisha.");}
  },1800);
  return()=>window.clearInterval(poll);
 },[queueTicket,mode]);
 const submitOnlineShot=useCallback(async(shotAngle:number,shotPower:number)=>{
  if(!onlineRoom||!onlinePlayerId||onlineRoom.status!=="active"||onlineBusy)return;
  if(onlineRoom.current_turn!==onlinePlayerId){setOnlineNotice("Subiri zamu ya mpinzani.");return;}
  const needsPlacement=onlineRoom.state?.ballInHandFor===onlinePlayerId;
  if(needsPlacement&&!onlineCuePosition){setOnlineNotice("Gusa sehemu tupu ya meza kuweka cue ball kwanza.");return;}
  setOnlineBusy(true);
  const requestId=typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
  const {data,error}=await supabase.functions.invoke<PoolServerResponse>("pool-game",{body:{action:"shot",matchId:onlineRoom.id,expectedRevision:onlineRoom.revision??0,angle:shotAngle,power:shotPower,requestId,cuePosition:onlineCuePosition??undefined}});
  setOnlineBusy(false);
  if(error){toast({title:"Shot haijakubaliwa",description:error.message,variant:"destructive"});await refreshOnlineMatch(onlineRoom.id);return;}
  if(data?.match){setOnlineRoom(data.match);if(Array.isArray(data.result?.trajectory))animateTrajectory(data.result.trajectory,data.state?.balls);else if(Array.isArray(data.state?.balls)){ballsRef.current=data.state.balls;setBalls(data.state.balls);}setOnlineCuePosition(null);setMessage(data.result?.foul?"FOUL: "+String(data.result.foulReason):"Shot imethibitishwa na server.");setOnlineNotice(data.result?.foul?"Foul imethibitishwa. Mpinzani ana Ball-in-Hand.":data.match.status==="finished"?"Mechi imekamilika.":"Shot inachezwa kwa usawazishaji wa server.");if(data.result?.progressionPending)setOnlineNotice("Mechi imeisha; zawadi na rating zinasawazishwa tena.");if(data.match.status==="finished"&&onlinePlayerId)void loadPoolProfile(onlinePlayerId);}
 },[onlineRoom,onlinePlayerId,onlineBusy,onlineCuePosition,toast,refreshOnlineMatch,animateTrajectory,loadPoolProfile]);
 const reset=useCallback((nextMode:Mode=mode)=>{const next=rack(nextMode);ballsRef.current=next;setBalls(next);setMoving(false);setShots(0);setPocketed([]);setAngle(0);setBallInHand(false);setPlayerTurn(true);aiShotRef.current=false;setMessage("Meza imeandaliwa. Wewe unaanza.");},[mode]);
 const shoot=useCallback((shotAngle=angle,shotPower=power,byAI=false)=>{
  if(onlineRoom){if(onlineRoom.status==="active")void submitOnlineShot(shotAngle,shotPower);else setMessage("Subiri mpinzani ajiunge au mechi imalizike.");return;}
  if(moving||(ballInHand&&!byAI)||(opponent==="ai"&&!playerTurn&&!byAI))return;
  aiShotRef.current=byAI;
  if(sound)playPoolTone(170);
  const next=ballsRef.current.map(b=>({...b}));
  const cue=next.find(b=>b.id===0);if(!cue||cue.pocketed)return;
  const speed=shotPower/100*.026;cue.vx=Math.cos(shotAngle)*speed;cue.vy=Math.sin(shotAngle)*speed;
  ballsRef.current=next;setBalls(next);setMoving(true);setShots(s=>s+1);setMessage("Shot inachezwa…");
 },[moving,ballInHand,opponent,playerTurn,sound,angle,power,onlineRoom,submitOnlineShot]);
 useEffect(()=>{
  if(!moving||onlineRoom?.status==="active")return;
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
 },[moving,sound,opponent,onlineRoom?.status]);
 useEffect(()=>{
  if(onlineRoom||opponent!=="ai"||playerTurn||moving)return;
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
 },[opponent,playerTurn,moving,ballInHand,mode,shoot,onlineRoom]);
 const setAimFromPointer=(event:PointerEvent<HTMLDivElement>|MouseEvent<HTMLDivElement>)=>{const rect=event.currentTarget.getBoundingClientRect();const x=clamp((event.clientX-rect.left)/rect.width,.07,.93),y=clamp((event.clientY-rect.top)/rect.height,.12,.88);const cue=ballsRef.current.find(b=>b.id===0);if(!cue||moving||onlineBusy)return;const onlineNeedsPlacement=onlineRoom?.status==="active"&&!!onlinePlayerId&&onlineRoom.state?.ballInHandFor===onlinePlayerId;const placing=onlineNeedsPlacement&&!onlineCuePosition?true:!onlineRoom?ballInHand:false;if(placing&&event.type==="click"){const blocked=ballsRef.current.some(b=>b.id!==0&&!b.pocketed&&Math.hypot(b.x-x,b.y-y)<.032);if(blocked){setMessage("Eneo hilo limezibwa. Chagua sehemu tupu ya meza.");return;}if(onlineRoom?.status==="active"){setOnlineCuePosition({x,y});setAim({x,y});setMessage("Cue ball placement imechaguliwa. Bonyeza SHOOT kuthibitisha.");return;}const next=ballsRef.current.map(b=>b.id===0?{...b,x,y,vx:0,vy:0,pocketed:false}:b);ballsRef.current=next;setBalls(next);setBallInHand(false);setAim({x,y});setMessage("Cue ball imewekwa. Chagua mwelekeo kisha piga SHOOT.");return;}if(!placing){const cueX=onlineCuePosition?.x??cue.x,cueY=onlineCuePosition?.y??cue.y;setAngle(Math.atan2(y-cueY,x-cueX));setAim({x,y});}};
 const createOnlineRoom=async()=>{
  const {data,error}=await poolRpc("create_pool_room",{p_mode:mode==="nine"?"nine_ball":"eight_ball",p_visibility:"private",p_clock_seconds:600});
  if(error){toast({title:"Room creation failed",description:error.message,variant:"destructive"});return;}
  const room=data as PoolRoom;setOnlineRoom(room);setOnlineNotice("Chumba kimeundwa. Mshirikishe mpinzani code; mechi itaanza baada ya kujiunga.");
 };
 const joinOnlineRoom=async()=>{
  const code=joinRoomCode.trim().toUpperCase();
  if(code.length!==8){toast({title:"Weka code yenye herufi/namba 8",variant:"destructive"});return;}
  const {data,error}=await poolRpc("join_pool_room_by_code",{p_room_code:code});
  if(error){toast({title:"Kujiunga kumeshindikana",description:error.message,variant:"destructive"});return;}
  setOnlineRoom(data as PoolRoom);setOnlineNotice("Umejiunga. Inaunganisha hali ya mechi na engine ya server…");
 };
 const findOnlineOpponent=async()=>{
  const {data,error}=await poolRpc("enqueue_pool_match",{p_mode:mode==="nine"?"nine_ball":"eight_ball",p_rating:poolRating?.rating??1000,p_clock_seconds:600});
  if(error){toast({title:"Matchmaking imeshindikana",description:error.message,variant:"destructive"});return;}
  const result=data as {status:string;queue_id?:string;match_id?:string};
  if(result.status==="matched"){setOnlineRoom({id:result.match_id??"",room_code:null,mode,status:"active",player_one:"",player_two:null});setOnlineNotice("Mpinzani amepatikana. Inaunganisha mechi…");}
  else {setQueueTicket(result.queue_id??null);setOnlineNotice("Unatafutiwa mpinzani. Mechi itaanza baada ya kuunganishwa.");}
 };
 const createPoolTournament=async()=>{const title=tournamentTitle.trim();if(title.length<3){toast({title:"Jina la mashindano liwe na herufi 3 au zaidi",variant:"destructive"});return;}const {error}=await poolRpc("create_pool_tournament",{p_title:title,p_mode:mode==="nine"?"nine_ball":"eight_ball",p_max_players:8,p_entry_fee:0});if(error){toast({title:"Tournament creation failed",description:error.message,variant:"destructive"});return;}setTournamentTitle("");await loadTournaments();toast({title:"Mashindano yameundwa",description:"Mashindano ya wachezaji 8 yako wazi kwa usajili."});};
 const joinPoolTournament=async(id:string)=>{const {error}=await poolRpc("join_pool_tournament",{p_tournament_id:id});if(error){toast({title:"Usajili umeshindikana",description:error.message,variant:"destructive"});return;}await loadTournaments();toast({title:"Umejisajili kwenye mashindano"});};
 const startPoolTournament=async(id:string)=>{const {error}=await poolRpc("start_pool_tournament",{p_tournament_id:id});if(error){toast({title:"Mashindano hayajaanza",description:error.message,variant:"destructive"});return;}await loadTournaments();toast({title:"Mashindano yameanza",description:"Ratiba ya hatua ya kwanza imeundwa."});};
 const cancelOnlineQueue=async()=>{
  const {error}=await poolRpc("cancel_pool_match_queue",{});
  if(error){toast({title:"Imeshindikana kusitisha matchmaking",description:error.message,variant:"destructive"});return;}
  setQueueTicket(null);setOnlineNotice("Utafutaji wa mpinzani umesitishwa.");
 };
 const cue=balls.find(b=>b.id===0);const remaining=balls.filter(b=>b.id!==0&&!b.pocketed).length;const onlineActive=onlineRoom?.status==="active";const onlineBallInHand=onlineActive&&!!onlinePlayerId&&onlineRoom?.state?.ballInHandFor===onlinePlayerId;const onlineMyTurn=onlineActive&&!!onlinePlayerId&&onlineRoom?.current_turn===onlinePlayerId;const shownShots=onlineActive?Math.max(0,(onlineRoom?.revision??1)-1):shots;const shownPocketed=onlineActive?balls.filter(b=>b.id!==0&&b.pocketed).length:pocketed.length;
 return <main className="min-h-full overflow-y-auto bg-background pb-24">
  <header className="tiger-page-header"><button onClick={()=>nav("/games")} className="tiger-header-action" aria-label="Back to games"><ArrowLeft className="h-5 w-5"/></button><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">TigerChat Sports</p><h1 className="text-base font-black">4D Pool Arena</h1></div><button onClick={()=>setShowRules(v=>!v)} className="rounded-lg p-2 hover:bg-muted" aria-label="Rules"><CircleHelp className="h-5 w-5"/></button></header>
  <section className="mx-auto max-w-5xl space-y-4 p-3 sm:p-5">
   <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black">Premium Pool Table</h2><p className="text-xs text-muted-foreground">WebGL 3D renderer · server-authoritative online physics · synchronized replay · touch controls</p></div><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-500">PRACTICE MODE</span></div>
   <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
    <div><h3 className="font-bold text-sm">Online PvP · Rooms & Matchmaking</h3><p className="text-[11px] text-muted-foreground">Unda chumba cha faragha, jiunge kwa code, au tafuta mpinzani.</p></div>
    <div className="grid grid-cols-2 gap-2"><Button size="sm" onClick={()=>void createOnlineRoom()}>Create private room</Button><Button size="sm" variant="outline" onClick={()=>void findOnlineOpponent()} disabled={!!queueTicket}>Quick Match</Button></div>
    <div className="flex gap-2"><input value={joinRoomCode} onChange={e=>setJoinRoomCode(e.target.value.toUpperCase().slice(0,8))} placeholder="Room code (8 characters)" maxLength={8} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs"/><Button size="sm" variant="outline" onClick={()=>void joinOnlineRoom()}>Join</Button></div>
    {queueTicket&&<Button size="sm" variant="ghost" onClick={()=>void cancelOnlineQueue()}>Cancel matchmaking</Button>}
    {onlineRoom&&<div className="rounded-lg border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Server room</p><p className="font-mono text-lg font-black tracking-widest">{onlineRoom.room_code??onlineRoom.id}</p><p className="text-[10px] text-muted-foreground">{onlineRoom.status.toUpperCase()} · {onlineRoom.mode}</p></div>}
    {onlineNotice&&<p className="text-xs text-muted-foreground" aria-live="polite">{onlineNotice}</p>}
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-3 text-center">
     <div><p className="text-[10px] text-muted-foreground">Elo rating</p><p className="text-lg font-black">{poolRating?.rating??1000}</p></div>
     <div><p className="text-[10px] text-muted-foreground">W / L</p><p className="text-lg font-black">{poolRating?.wins??0} / {poolRating?.losses??0}</p></div>
     <div><p className="text-[10px] text-muted-foreground">Pool coins</p><p className="text-lg font-black">{poolCoins}</p></div>
    </div>
   </div>
   <div className="grid grid-cols-3 gap-2 sm:grid-cols-4"><button onClick={()=>{setMode("practice");reset("practice");}} className={`rounded-xl border p-2 text-xs font-bold ${mode==="practice"?"border-primary bg-primary/10 text-primary":"border-border bg-card"}`}>Practice</button><button onClick={()=>{setMode("eight");reset("eight");}} className={`rounded-xl border p-2 text-xs font-bold ${mode==="eight"?"border-primary bg-primary/10 text-primary":"border-border bg-card"}`}>8-Ball</button><button onClick={()=>{setMode("nine");reset("nine");}} className={`rounded-xl border p-2 text-xs font-bold ${mode==="nine"?"border-primary bg-primary/10 text-primary":"border-border bg-card"}`}>9-Ball</button><button onClick={()=>setCamera(c=>c==="angle"?"top":"angle")} className="rounded-xl border border-border bg-card p-2 text-xs font-bold"><Camera className="mr-1 inline h-3.5 w-3.5"/> {camera==="angle"?"Top view":"3D view"}</button></div>
   <div className="rounded-[28px] border border-amber-900/70 bg-gradient-to-br from-amber-700 via-amber-950 to-black p-3 shadow-2xl sm:p-5">
    <Pool3DTable balls={balls} camera={camera} angle={angle} aim={aim} ballInHand={onlineActive?!!onlineBallInHand:ballInHand} onPointerMove={setAimFromPointer} onClick={setAimFromPointer}/>
   </div>
   <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div><h3 className="text-sm font-bold">Pool tournaments</h3><p className="text-[10px] text-muted-foreground">Single-elimination bracket · 8 players · free entry</p></div>
    <div className="flex gap-2"><input value={tournamentTitle} onChange={e=>setTournamentTitle(e.target.value.slice(0,64))} placeholder="Tournament name" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs"/><Button size="sm" onClick={()=>void createPoolTournament()}>Create</Button></div>
    {tournaments.map(t=><div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
      <div className="min-w-0"><p className="truncate text-xs font-bold">{t.title}</p><p className="text-[10px] text-muted-foreground">{t.mode.replace("_"," ")} · {t.status} · {t.max_players} players · prize {t.prize_pool}</p></div>
      <div className="flex shrink-0 gap-1">{t.status==="registration"&&<Button size="sm" variant="outline" onClick={()=>void joinPoolTournament(t.id)}>Join</Button>}{t.owner_id===onlinePlayerId&&t.status==="registration"&&<Button size="sm" onClick={()=>void startPoolTournament(t.id)}>Start</Button>}<Button size="sm" variant="ghost" onClick={()=>bracketTournamentId===t.id?setBracketTournamentId(null):void loadBracket(t.id)}>Bracket</Button></div>
     {bracketTournamentId===t.id&&<div className="mt-2 space-y-1 border-t border-border pt-2">{bracketMatches.length===0?<p className="text-[10px] text-muted-foreground">Bracket itatengenezwa baada ya mashindano kuanza.</p>:bracketMatches.map(m=><div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"><div className="min-w-0"><p className="text-[10px] font-bold">Round {m.round_no} · Match {m.match_no} · {m.status}</p><p className="truncate text-[9px] text-muted-foreground">{m.player_one.slice(0,8)} vs {m.player_two.slice(0,8)}{m.winner_id?" · Winner "+m.winner_id.slice(0,8):""}</p></div>{m.status==="active"&&(m.player_one===onlinePlayerId||m.player_two===onlinePlayerId)&&<Button size="sm" onClick={()=>void refreshOnlineMatch(m.match_id)}>Play</Button>}</div>)}</div>}
    </div>)}
    {!tournaments.length&&<p className="text-xs text-muted-foreground">Bado hakuna mashindano ya Pool yaliyoundwa.</p>}
   </div>
   <div className="grid grid-cols-3 gap-2"><div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Shots</p><p className="text-xl font-black">{shownShots}</p></div><div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Balls left</p><p className="text-xl font-black">{remaining}</p></div><div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">Pocketed</p><p className="text-xl font-black">{shownPocketed}</p></div></div>
   <div className="rounded-2xl border border-border bg-card p-4 space-y-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-bold">Shot controls</span><span className="text-xs text-muted-foreground">{onlineActive?(onlineMyTurn?"Your online turn":"Opponent turn"):opponent==="ai"?(playerTurn?"Your turn":"Tiger AI turn"):"Practice"} · {Math.round(angle*180/Math.PI)}°</span></div><label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">Opponent<select className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground" value={opponent} onChange={e=>{setOpponent(e.target.value as "practice"|"ai");setPlayerTurn(true);aiShotRef.current=false;setMessage(e.target.value==="ai"?"Tiger AI amejiunga. Anacheza baada ya zamu yako.":"Practice mode.");}}><option value="practice">Practice · no opponent</option><option value="ai">Tiger AI · local opponent</option></select></label><label className="block text-xs text-muted-foreground">Power · {power}%<input className="mt-2 w-full accent-primary" type="range" min="5" max="100" value={power} onChange={e=>setPower(Number(e.target.value))} disabled={moving}/></label><div className="grid grid-cols-2 gap-2"><Button onClick={()=>shoot()} disabled={onlineActive?(!onlineMyTurn||onlineBusy||moving||!!onlineBallInHand&&!onlineCuePosition):moving||ballInHand||(opponent==="ai"&&!playerTurn)}><Zap className="mr-2 h-4 w-4"/>SHOOT</Button><Button variant="outline" onClick={() => reset()} disabled={moving}><RotateCcw className="mr-2 h-4 w-4"/>Rack again</Button></div><p className="text-xs text-muted-foreground" aria-live="polite">{message}</p>{ballInHand&&<p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs font-semibold text-amber-600">BALL-IN-HAND: gusa sehemu tupu ya meza kuweka cue ball.</p>}<div className="flex flex-wrap gap-2"><button onClick={()=>setSound(v=>!v)} className="rounded-lg border border-border px-3 py-2 text-xs">{sound?<Volume2 className="mr-1 inline h-3.5 w-3.5"/>:<VolumeX className="mr-1 inline h-3.5 w-3.5"/>}Sound {sound?"On":"Off"}</button><button onClick={()=>setShowRules(v=>!v)} className="rounded-lg border border-border px-3 py-2 text-xs"><Settings2 className="mr-1 inline h-3.5 w-3.5"/>Game rules</button></div></div>
   {showRules&&<div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground"><h3 className="mb-2 font-bold text-foreground">Pool controls & rules</h3><p>Gusa eneo la meza kuelekeza shot, chagua nguvu ya cue kisha bonyeza SHOOT. Mipira hugongana, hurudi kwenye rails na huingia kwenye pockets. 8-Ball na 9-Ball hapa zina rack tofauti za mipira; Sheria za msingi za 8-Ball/9-Ball, fouls, break, Ball-in-Hand, bracket ya knockout na matokeo ya mashindano zinathibitishwa na server. Variants maalum za ligi/called-shot na push-out bado hazijawezeshwa.</p><p className="mt-2">Meza ya mfano ina uwiano wa 2:1 unaofanana na meza ya 9-foot; si kipimo halisi cha kifaa cha kuchezea.</p></div>}
   <div className="grid grid-cols-2 gap-2"><button onClick={()=>nav("/draughts/tournaments")} className="rounded-xl border border-border bg-card p-3 text-left"><Trophy className="mb-2 h-5 w-5 text-primary"/><b className="block text-xs">Draughts tournaments</b><span className="text-[10px] text-muted-foreground">Current live competitions</span></button><button onClick={()=>nav("/games")} className="rounded-xl border border-border bg-card p-3 text-left"><Users className="mb-2 h-5 w-5 text-primary"/><b className="block text-xs">More games</b><span className="text-[10px] text-muted-foreground">Back to Games Hub</span></button></div>
  </section>
 </main>;
}
