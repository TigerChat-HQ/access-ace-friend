import { createClient } from "npm:@supabase/supabase-js@2";
import { createInitialPoolState, simulatePoolShot, type PoolMode, type PoolState } from "../_shared/pool-engine.ts";
const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});}
function uuid(value:unknown):value is string{return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
  const authorization=req.headers.get("Authorization")??"",token=authorization.replace(/^Bearer\\s+/i,"");
  if(!token||token===authorization)return reply({error:"Sign in required"},401);
  const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  if(!url||!anon||!secret)return reply({error:"Pool server is not configured"},503);
  const auth=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await auth.auth.getUser(token);
  if(userError||!userData.user)return reply({error:"Invalid session"},401);
  const actor=userData.user.id,admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json(),matchId=body?.matchId,action=body?.action;
  if(!uuid(matchId))return reply({error:"Invalid match id"},400);
  const {data:match,error:readError}=await admin.from("pool_matches").select("*").eq("id",matchId).maybeSingle();
  if(readError)throw readError;
  if(!match)return reply({error:"Match not found"},404);
  if(match.player_one!==actor&&match.player_two!==actor)return reply({error:"Not a match participant"},403);
  if(action==="state"){
   if(match.status==="active"&&(!match.state||Object.keys(match.state).length===0)){
    const initial=createInitialPoolState(match.mode as PoolMode,match.player_one,match.player_two);
    const {error}=await admin.rpc("pool_initialize_match",{p_match_id:match.id,p_actor_id:actor,p_state:initial});
    if(error)throw error;
   }
   const {data:current,error}=await admin.from("pool_matches").select("*").eq("id",matchId).single();
   if(error)throw error;
   return reply({match:current,state:current.state});
  }
  if(action!=="shot")return reply({error:"Unsupported action"},400);
  if(match.status!=="active"||!match.player_two)return reply({error:"Match is not active"},409);
  if(match.current_turn!==actor)return reply({error:"It is not your turn"},403);
  if(match.revision!==body.expectedRevision)return reply({error:"Stale match revision",revision:match.revision,state:match.state},409);
  const source=(match.state&&Array.isArray(match.state.balls)&&match.state.balls.length>1?match.state:createInitialPoolState(match.mode as PoolMode,match.player_one,match.player_two)) as PoolState;
  const requestId=typeof body.requestId==="string"?body.requestId:"";
  const opponent=actor===match.player_one?match.player_two:match.player_one;
  const result=simulatePoolShot(source,actor,opponent,{angle:Number(body.angle),power:Number(body.power),cuePosition:body.cuePosition&&typeof body.cuePosition==="object"?body.cuePosition:undefined,requestId});
  const event={request_id:requestId,actor_id:actor,angle:Number(body.angle),power:Number(body.power),first_contact:result.firstContact,pocketed:result.pocketed,foul:result.foul,foul_reason:result.foulReason,rails_after_contact:result.railsAfterContact,winner_id:result.winnerId,engine_version:1};
  const {data:committed,error:commitError}=await admin.rpc("pool_commit_server_shot",{
   p_match_id:matchId,p_actor_id:actor,p_expected_revision:match.revision,p_state:result.state,
   p_next_turn:result.nextTurn,p_status:result.status,p_winner_id:result.winnerId,
   p_event_type:result.foul?"foul":"shot",p_event:event
  });
  if(commitError){
   const {data:latest}=await admin.from("pool_matches").select("*").eq("id",matchId).maybeSingle();
   return reply({error:commitError.message,match:latest,state:latest?.state},409);
  }
  return reply({match:committed,state:committed.state,result:{foul:result.foul,foulReason:result.foulReason,pocketed:result.pocketed,firstContact:result.firstContact}});
 }catch(error){
  return reply({error:error instanceof Error?error.message:"Unexpected Pool server error"},400);
 }
});