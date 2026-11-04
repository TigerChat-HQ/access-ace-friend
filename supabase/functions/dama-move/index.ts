import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { legalMoves, applyMove, winner, pickAIMove, type Board, type Color } from '../_shared/draughts.ts';
const bodySchema = z.object({ id: z.string().uuid(), revision: z.number().int().nonnegative(), from: z.number().int().min(0).max(63).optional(), to: z.number().int().min(0).max(63).optional(), captures: z.array(z.number().int().min(0).max(63)).max(24).optional(), ai: z.boolean().optional() });
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 try {
  const url=Deno.env.get('SUPABASE_URL'); const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url || !key) return json({error:'Game service unavailable'},503);
  const db=createClient(url,key);
  const {data:auth,error:authError}=await db.auth.getUser((req.headers.get('Authorization')||'').replace(/^Bearer /i,''));
  if(authError || !auth.user) return json({error:'Sign in to play'},401);
  const p=bodySchema.safeParse(await req.json()); if(!p.success) return json({error:'Invalid move'},400);
  const {data:m,error}=await db.from('draft_matches').select('*').eq('id',p.data.id).single();
  if(error || !m) return json({error:'Match not found'},404);
  const color:Color=m.current_turn==='b' || m.current_turn==='black'?'b':'w';
  const owner=color==='w'?m.player_white:m.player_black;
  if(m.status!=='active' || m.revision!==p.data.revision) return json({error:'Match changed; refresh before moving'},409);
  if(p.data.ai ? !m.vs_ai || color!=='b' || auth.user.id!==m.player_white : owner!==auth.user.id) return json({error:'It is not your turn'},403);
  const board=m.board as Board;
  const move=p.data.ai?pickAIMove(board,color,4):legalMoves(board,color).find(move=>move.from===p.data.from && move.to===p.data.to && JSON.stringify(move.captures)===JSON.stringify(p.data.captures||[]));
  if(!move) return json({error:'Illegal move'},400);
  const next:Color=color==='w'?'b':'w'; const newBoard=applyMove(board,move); const win=winner(newBoard,next);
  const {data:result,error:saveError}=await db.rpc('commit_draft_move',{p_id:m.id,p_revision:p.data.revision,p_board:newBoard,p_turn:next,p_move:move,p_status:win?'finished':'active',p_winner:win==='w'?'white':win==='b'?'black':null});
  return saveError?json({error:saveError.message},409):json({match:result});
 }catch {return json({error:'Could not process move'},500);}
});