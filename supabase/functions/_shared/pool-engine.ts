export type PoolMode = "eight_ball" | "nine_ball";
export type PoolBall = { id:number; x:number; y:number; vx:number; vy:number; color:string; label:string; group:"solid"|"stripe"|"cue"|"eight"; pocketed:boolean };
export type PoolState = {
  version:1; mode:PoolMode; balls:PoolBall[];
  groups:Record<string,"solids"|"stripes"|null>;
  breakPending:boolean; ballInHandFor:string|null; currentTurn:string;
  winnerId:string|null; lastShot:Record<string,unknown>|null;
};
export type PoolShotInput = { angle:number; power:number; cuePosition?:{x:number;y:number}; requestId:string };
export type PoolShotResult = {
  state:PoolState; nextTurn:string; winnerId:string|null; status:"active"|"finished";
  foul:boolean; foulReason:string|null; pocketed:number[]; firstContact:number|null;
  railsAfterContact:number; requestId:string;
};
const COLORS=["#facc15","#2563eb","#dc2626","#7c3aed","#ea580c","#16a34a","#991b1b","#111827","#facc15","#2563eb","#dc2626","#7c3aed","#ea580c","#16a34a","#991b1b"];
const POCKETS=[[.035,.075],[.5,.075],[.965,.075],[.035,.925],[.5,.925],[.965,.925]] as const;
const R=.0135, POCKET_R=.041;
function validate(input:PoolShotInput){
 if(!Number.isFinite(input.angle)||input.angle < -Math.PI*2||input.angle>Math.PI*2)throw new Error("Invalid cue angle");
 if(!Number.isFinite(input.power)||input.power<5||input.power>100)throw new Error("Power must be between 5 and 100");
 if(!input.requestId||input.requestId.length>80)throw new Error("Invalid shot request id");
}
function ballGroup(ball:PoolBall):"solids"|"stripes"|null{
 if(ball.group==="solid")return "solids";
 if(ball.group==="stripe")return "stripes";
 return null;
}
export function createInitialPoolState(mode:PoolMode,p1:string,p2:string):PoolState{
 const balls:PoolBall[]=[{id:0,x:.22,y:.5,vx:0,vy:0,color:"#f8fafc",label:"",group:"cue",pocketed:false}];
 const eight=[[.68,.5],[.72,.475],[.72,.525],[.76,.45],[.76,.5],[.76,.55],[.8,.425],[.8,.475],[.8,.525],[.8,.575],[.84,.4],[.84,.45],[.84,.5],[.84,.55],[.84,.6]];
 const nine=[[.68,.5],[.72,.475],[.72,.525],[.76,.45],[.76,.5],[.76,.55],[.8,.425],[.8,.475],[.8,.525]];
 const ids=mode==="nine_ball"?[1,2,3,4,9,5,6,7,8]:[1,2,3,4,8,5,6,7,9,10,11,12,13,14,15];
 (mode==="nine_ball"?nine:eight).forEach(([x,y],i)=>{
  const id=ids[i];
  balls.push({id,x,y,vx:0,vy:0,color:id===8&&mode==="eight_ball"?"#111827":COLORS[id-1],label:String(id),group:mode==="eight_ball"&&id===8?"eight":id<8?"solid":"stripe",pocketed:false});
 });
 return {version:1,mode,balls,groups:{[p1]:null,[p2]:null},breakPending:true,ballInHandFor:null,currentTurn:p1,winnerId:null,lastShot:null};
}
export function simulatePoolShot(source:PoolState,actorId:string,opponentId:string,input:PoolShotInput):PoolShotResult{
 validate(input);
 if(source.winnerId)throw new Error("Match is already finished");
 if(source.currentTurn!==actorId)throw new Error("It is not your turn");
 const state:PoolState={...source,balls:source.balls.map(b=>({...b,vx:0,vy:0})),groups:{...source.groups},lastShot:source.lastShot?{...source.lastShot}:null};
 const cue=state.balls.find(b=>b.id===0);
 if(!cue||cue.pocketed)throw new Error("Cue ball is unavailable");
 if(state.ballInHandFor===actorId){
  if(!input.cuePosition)throw new Error("Place the cue ball before shooting");
  const x=input.cuePosition.x,y=input.cuePosition.y;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<.07||x>.93||y<.12||y>.88)throw new Error("Cue ball placement is outside the legal table area");
  if(state.balls.some(b=>b.id!==0&&!b.pocketed&&Math.hypot(b.x-x,b.y-y)<R*2.15))throw new Error("Cue ball placement overlaps another ball");
  cue.x=x;cue.y=y;cue.pocketed=false;state.ballInHandFor=null;
 }else if(input.cuePosition)throw new Error("Cue ball placement is not currently allowed");
 const original=source.balls.map(b=>({...b}));
 const remaining=original.filter(b=>b.id!==0&&!b.pocketed);
 cue.vx=Math.cos(input.angle)*(input.power/100*1.65);
 cue.vy=Math.sin(input.angle)*(input.power/100*1.65);
 let firstContact:number|null=null,railsAfterContact=0,totalRails=0,scratch=false;
 const pocketed:number[]=[];
 const dt=1/120,friction=Math.pow(.986,.5),stop=.012;
 for(let step=0;step<2400;step++){
  let moving=false;
  for(const ball of state.balls){
   if(ball.pocketed)continue;
   ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
   const hole=POCKETS.find(([px,py])=>Math.hypot(ball.x-px,ball.y-py)<=POCKET_R);
   if(hole){ball.pocketed=true;ball.vx=0;ball.vy=0;if(ball.id===0)scratch=true;else pocketed.push(ball.id);continue;}
   const corner=(ball.x<.12||ball.x>.88)&&(ball.y<.17||ball.y>.83);
   const side=Math.abs(ball.x-.5)<.065&&(ball.y<.16||ball.y>.84);
   if(ball.x<.055&&!corner){ball.x=.055;ball.vx=Math.abs(ball.vx)*.88;totalRails++;if(firstContact!==null)railsAfterContact++;}
   else if(ball.x>.945&&!corner){ball.x=.945;ball.vx=-Math.abs(ball.vx)*.88;totalRails++;if(firstContact!==null)railsAfterContact++;}
   if(ball.y<.105&&!side&&!corner){ball.y=.105;ball.vy=Math.abs(ball.vy)*.88;totalRails++;if(firstContact!==null)railsAfterContact++;}
   else if(ball.y>.895&&!side&&!corner){ball.y=.895;ball.vy=-Math.abs(ball.vy)*.88;totalRails++;if(firstContact!==null)railsAfterContact++;}
   ball.vx*=friction;ball.vy*=friction;
   if(Math.hypot(ball.vx,ball.vy)<stop){ball.vx=0;ball.vy=0;}else moving=true;
  }
  for(let i=0;i<state.balls.length;i++){
   const a=state.balls[i];if(a.pocketed)continue;
   for(let j=i+1;j<state.balls.length;j++){
    const b=state.balls[j];if(b.pocketed)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=R*2;
    if(d<=0||d>=min)continue;
    const nx=dx/d,ny=dy/d,overlap=(min-d)/2;
    a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
    const relative=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(relative>0){
     if(firstContact===null&&(a.id===0||b.id===0))firstContact=a.id===0?b.id:a.id;
     a.vx-=relative*nx*.96;a.vy-=relative*ny*.96;
     b.vx+=relative*nx*.96;b.vy+=relative*ny*.96;moving=true;
    }
   }
  }
  for(const ball of state.balls){
   if(ball.pocketed)continue;
   if(POCKETS.some(([px,py])=>Math.hypot(ball.x-px,ball.y-py)<=POCKET_R)){
    ball.pocketed=true;ball.vx=0;ball.vy=0;if(ball.id===0)scratch=true;else pocketed.push(ball.id);
   }
  }
  if(!moving&&state.balls.every(b=>b.pocketed||Math.hypot(b.vx,b.vy)===0))break;
 }
 const firstBall=firstContact===null?null:remaining.find(b=>b.id===firstContact)??null;
 let foulReason:string|null=null;
 if(scratch)foulReason="scratch";
 else if(firstContact===null)foulReason="no_contact";
 else if(state.mode==="nine_ball"){
  const lowest=remaining.reduce((n,b)=>Math.min(n,b.id),99);
  if(firstContact!==lowest)foulReason="wrong_first_contact";
 }else{
  const assigned=state.groups[actorId],hit=firstBall?ballGroup(firstBall):null;
  if(firstContact===8&&assigned&&remaining.some(b=>ballGroup(b)===assigned))foulReason="eight_ball_too_early";
  else if(assigned&&hit&&hit!==assigned)foulReason="wrong_first_contact";
 }
 if(!foulReason&&firstContact!==null&&pocketed.length===0&&railsAfterContact===0)foulReason="no_rail_or_pocket";
 if(state.breakPending&&pocketed.length===0&&totalRails<4&&!foulReason)foulReason="illegal_break";
 const eightPocketed=state.mode==="eight_ball"&&pocketed.includes(8);
 if(eightPocketed&&state.breakPending){
  const eight=state.balls.find(b=>b.id===8);
  if(eight){eight.pocketed=false;eight.x=.5;eight.y=.5;}
  pocketed.splice(pocketed.indexOf(8),1);
 }
 if(!foulReason&&state.mode==="eight_ball"&&!state.groups[actorId]){
  const firstGroup=pocketed.map(id=>state.balls.find(b=>b.id===id)).find(b=>!!b&&!!ballGroup(b));
  const group=firstGroup?ballGroup(firstGroup):null;
  if(group){state.groups[actorId]=group;state.groups[opponentId]=group==="solids"?"stripes":"solids";}
 }
 let winnerId:string|null=null;
 if(eightPocketed&&!state.breakPending){
  const assigned=source.groups[actorId];
  const ownBefore=assigned?remaining.filter(b=>ballGroup(b)===assigned).length:0;
  winnerId=!foulReason&&assigned&&ownBefore===0?actorId:opponentId;
 }
 if(state.mode==="nine_ball"&&pocketed.includes(9)&&!foulReason)winnerId=actorId;
 const foul=!!foulReason;
 const retain=!foul&&!winnerId&&(state.breakPending?pocketed.length>0:state.mode==="nine_ball"?pocketed.length>0:pocketed.some(id=>ballGroup(state.balls.find(b=>b.id===id)!)===state.groups[actorId]));
 const nextTurn=winnerId?actorId:foul||!retain?opponentId:actorId;
 if(scratch){cue.pocketed=false;cue.x=.22;cue.y=.5;cue.vx=0;cue.vy=0;}
 if(foul)state.ballInHandFor=opponentId;
 state.breakPending=false;state.currentTurn=nextTurn;state.winnerId=winnerId;
 state.lastShot={actorId,angle:input.angle,power:input.power,firstContact,pocketed:[...pocketed],foul,foulReason,railsAfterContact,totalRails};
 return {state,nextTurn,winnerId,status:winnerId?"finished":"active",foul,foulReason,pocketed,firstContact,railsAfterContact,requestId:input.requestId};
}