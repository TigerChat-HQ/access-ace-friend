import { createClient } from "npm:@supabase/supabase-js@2";
type WikiPage={title?:string;content_urls?:{desktop?:{page?:string}}};
type WikiItem={year?:number;text?:string;pages?:WikiPage[]};
type Pick={index:number;summary:string};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
const page=(v:WikiItem)=>v.pages?.[0]||{};
function mapPicks(raw:unknown, source:WikiItem[], max=5){
 if(!Array.isArray(raw)) return [];
 const used=new Set<number>();
 return raw.flatMap((p)=>{const i=Number((p as Pick)?.index),summary=String((p as Pick)?.summary||"").trim();
  if(!Number.isInteger(i)||i<0||i>=source.length||used.has(i)||!summary)return [];
  used.add(i);const v=source[i],pg=page(v),title=pg.title||v.text||"Tukio la kihistoria";
  return [{year:v.year??null,title,summary:summary.slice(0,260),source_url:pg.content_urls?.desktop?.page||(pg.title?`https://en.wikipedia.org/wiki/${encodeURIComponent(pg.title.replaceAll(" ","_"))}`:"https://en.wikipedia.org/wiki/Main_Page")}];
 }).slice(0,max);
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:{"Access-Control-Allow-Origin":"*"}});
 try{
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),aiKey=Deno.env.get("LOVABLE_API_KEY");
  if(!url||!key||!aiKey)return json({error:"Daily history service is not configured."},500);
  const body=await req.json().catch(()=>({}));
  const db=createClient(url,key);
  const {data:cfg}=await db.from("tiger_ai_daily_config").select("cron_token,enabled").eq("id",true).single();
  if(!cfg?.enabled||!cfg.cron_token||body?.token!==cfg.cron_token)return json({error:"Unauthorized"},401);
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Dar_es_Salaam",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=(t:string)=>parts.find(p=>p.type===t)?.value||"";
  const dateKey=`${part("year")}-${part("month")}-${part("day")}`;
  const {data:existing}=await db.from("tiger_ai_daily_posts").select("id").eq("date_key",dateKey).maybeSingle();
  if(existing)return json({success:true,already_published:true,date:dateKey});
  const h={"User-Agent":"TigerChat/1.0 daily-history feature","Accept":"application/json"};
  const [er,br]=await Promise.all([
   fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${part("month")}/${part("day")}`,{headers:h}),
   fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/${part("month")}/${part("day")}`,{headers:h})
  ]);
  if(!er.ok||!br.ok)throw new Error("Wikipedia On This Day haikupatikana kwa sasa.");
  const [ed,bd]=await Promise.all([er.json(),br.json()]);
  const events:WikiItem[]=(ed?.events||[]).slice(0,45),births:WikiItem[]=(bd?.births||[]).slice(0,35);
  if(events.length<10||births.length<5)throw new Error("Vyanzo havina taarifa za kutosha; post haijachapishwa.");
  const eventInput=events.map((v,index)=>({index,year:v.year,event:v.text,title:page(v).title,source_url:page(v).content_urls?.desktop?.page}));
  const birthInput=births.map((v,index)=>({index,year:v.year,person:v.text,title:page(v).title,source_url:page(v).content_urls?.desktop?.page}));
  const ai=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${aiKey}`,"Content-Type":"application/json"},body:JSON.stringify({
   model:"google/gemini-3-flash-preview",stream:false,response_format:{type:"json_object"},
   messages:[
    {role:"system",content:"Wewe ni mhariri wa historia wa TigerChat. Andika Kiswahili fasaha na kifupi. Tumia data iliyotolewa pekee; usibuni tukio, mwaka, mtu wala maelezo. Chagua matukio 5 yenye matokeo mazuri/maendeleo chanya na matukio 5 mabaya/ya kusikitisha kutoka orodha ya matukio; pia watu 5 maarufu waliozaliwa tarehe hii. Usirudie. Kwa kila kipengele toa index halisi ya chanzo na summary ya sentensi moja. Rudisha JSON tu yenye arrays positive_events, negative_events, births; kila item {index,summary}."},
    {role:"user",content:`Tarehe Tanzania: ${dateKey}. Matukio: ${JSON.stringify(eventInput)}. Waliozaliwa: ${JSON.stringify(birthInput)}. Toa vipengele 5 kwa kila kundi.`}
   ]
  })});
  if(!ai.ok)throw new Error(`AI generation failed: ${ai.status}`);
  const aiData=await ai.json(),raw=aiData.choices?.[0]?.message?.content;
  const result=typeof raw==="string"?JSON.parse(raw):raw;
  const good=mapPicks(result?.positive_events,events),bad=mapPicks(result?.negative_events,events),born=mapPicks(result?.births,births);
  if(good.length!==5||bad.length!==5||born.length<3)throw new Error("AI haikupata vipengele vya kutosha vyenye vyanzo; hakuna kilichochapishwa.");
  const content={positive_events:good,negative_events:bad,births:born};
  const source_urls=[...new Set([...good,...bad,...born].map(x=>x.source_url))];
  const {error}=await db.from("tiger_ai_daily_posts").insert({date_key:dateKey,title:`Leo katika historia — ${dateKey}`,content,source_urls});
  if(error){if(error.code==="23505")return json({success:true,already_published:true,date:dateKey});throw error;}
  return json({success:true,published:true,date:dateKey,positive:good.length,negative:bad.length,births:born.length});
 }catch(e){console.error("Tiger AI daily history",e);return json({error:e instanceof Error?e.message:"Daily history failed"},500);}
});