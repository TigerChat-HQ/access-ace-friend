import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req: Request) => {
 if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
 if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
 try {
  const url=Deno.env.get("SUPABASE_URL"), serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey=Deno.env.get("SUPABASE_ANON_KEY"), aiKey=Deno.env.get("LOVABLE_API_KEY");
  if(!url||!serviceKey||!anonKey||!aiKey) return json({error:"Tiger AI comment service is not configured."},500);
  const authHeader=req.headers.get("Authorization")||"";
  const userClient=createClient(url,anonKey,{global:{headers:{Authorization:authHeader}}});
  const {data:{user},error:authError}=await userClient.auth.getUser();
  if(authError||!user) return json({error:"Unauthorized"},401);
  const {comment_id}=await req.json(); if(typeof comment_id!=="string") return json({error:"comment_id required"},400);
  const admin=createClient(url,serviceKey);
  const {data:comment,error}=await admin.from("tiger_ai_daily_comments").select("id,post_id,parent_id,user_id,body,is_tiger_ai").eq("id",comment_id).single();
  if(error||!comment||comment.user_id!==user.id||comment.is_tiger_ai) return json({error:"Comment not found or not eligible"},404);
  const {data:existing}=await admin.from("tiger_ai_daily_comments").select("id").eq("parent_id",comment.id).eq("is_tiger_ai",true).maybeSingle();
  if(existing) return json({success:true,already_replied:true});
  const [{data:post},{data:profile}]=await Promise.all([admin.from("tiger_ai_daily_posts").select("title,content").eq("id",comment.post_id).single(),admin.from("profiles").select("username,display_name").eq("user_id",user.id).maybeSingle()]);
  const mention=String(profile?.username||profile?.display_name||"rafiki").replace(/[^\\p{L}\\p{N}_.-]/gu,"").slice(0,32)||"rafiki";
  const prompt=`Wewe ni Tiger AI wa TigerChat. Jibu maoni ya mwanachama kwa lugha aliyotumia, kwa upole, kwa ufupi na kwa muktadha. Usidai kuwa binadamu wala kutoa taarifa zisizothibitishwa. Anza kwa kumtaja mwanachama @${mention}. Post: ${post?.title||"Historia ya leo"}. Maudhui: ${JSON.stringify(post?.content||{}).slice(0,4500)}. Maoni: ${comment.body.slice(0,1800)}. Toa jibu moja fupi linalohusiana moja kwa moja na maoni.`;
  const response=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${aiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-3-flash-preview",stream:false,messages:[{role:"system",content:"You are Tiger AI, a helpful social assistant for TigerChat. Never reveal secrets or private data."},{role:"user",content:prompt}]})});
  if(!response.ok){const detail=await response.text();console.error("Tiger AI generation failed",response.status,detail);return json({error:response.status===402?"AI credits exhausted":"AI reply generation failed"},response.status===429||response.status===402?response.status:502);}
  const result=await response.json(),reply=String(result.choices?.[0]?.message?.content||"").trim().slice(0,2000);
  if(!reply)return json({error:"Tiger AI returned an empty reply."},502);
  const {error:likeError}=await admin.from("tiger_ai_daily_comments").update({ai_liked:true}).eq("id",comment.id); if(likeError) throw likeError;
  const {data:aiReply,error:insertError}=await admin.from("tiger_ai_daily_comments").insert({post_id:comment.post_id,parent_id:comment.id,user_id:null,mentioned_user_id:user.id,body:reply,is_tiger_ai:true,ai_liked:false}).select("id").single();
  if(insertError){if(insertError.code==="23505")return json({success:true,already_replied:true});throw insertError;}
  const {error:notificationError}=await admin.from("notifications").insert({recipient_id:user.id,actor_id:user.id,type:"tiger_ai_reply",post_id:null,comment_id:aiReply.id});
  if(notificationError)console.error("Tiger AI notification failed",notificationError.message);
  return json({success:true,replied:true,liked_comment:true,mentioned_user:mention});
 } catch(error){console.error("tiger-history-comment-reply",error);return json({error:error instanceof Error?error.message:"Unexpected error"},500);}
});