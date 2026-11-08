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
  if(!url||!key)return json({error:"Daily history service is not configured.",configured:{url:!!url,service_role:!!key,ai:!!aiKey}},500);
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
  // Build short summaries directly from Wikimedia's dated historical records.
  // This keeps the daily publisher self-contained and does not depend on an unconfigured AI API secret.
  const positiveWords = /independence|liberat|peace|treaty|discover|invent|founded|establish|launch|opened|first|elected|victory|award|won|rights|reform|success|agreement|united|freedom|abolish|rescue|saved|cure|vaccine|mission|democracy|constitution|ratified|created|completed/i;
  const negativeWords = /war|attack|bomb|massacre|killed|death|died|disaster|earthquake|tsunami|flood|fire|crash|explosion|assassin|murder|invasion|genocide|terror|hurricane|plague|epidemic|pandemic|battle|riot|collapse|sank|execution|slavery|famine|tragedy/i;
  const makeSummary = (item: WikiItem) => String(item.text || "Tukio limerekodiwa katika historia.").trim().slice(0, 240);
  const score = (item: WikiItem, pattern: RegExp) => (makeSummary(item).match(new RegExp(pattern.source, "gi")) || []).length;
  const rankedPositive = events.map((v,i)=>({v,i,s:score(v,positiveWords)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  const rankedNegative = events.map((v,i)=>({v,i,s:score(v,negativeWords)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  const used = new Set<number>();
  const positive = rankedPositive.filter(x=>{if(used.has(x.i))return false;used.add(x.i);return true;}).slice(0,5).map(x=>({year:x.v.year??null,title:page(x.v).title||x.v.text||"Tukio la kihistoria",summary:makeSummary(x.v),source_url:page(x.v).content_urls?.desktop?.page||"https://en.wikipedia.org/wiki/Portal:Current_events"}));
  const negative = rankedNegative.filter(x=>!used.has(x.i)).slice(0,5).map(x=>({year:x.v.year??null,title:page(x.v).title||x.v.text||"Tukio la kihistoria",summary:makeSummary(x.v),source_url:page(x.v).content_urls?.desktop?.page||"https://en.wikipedia.org/wiki/Portal:Current_events"}));
  const born = births.slice(0,5).map(v=>({year:v.year??null,title:page(v).title||v.text||"Mtu maarufu",summary:makeSummary(v),source_url:page(v).content_urls?.desktop?.page||"https://en.wikipedia.org/wiki/Main_Page"}));
  if(positive.length!==5||negative.length!==5||born.length<3)throw new Error("Chanzo hakina matukio ya kutosha ya aina zote; post haijachapishwa ili kuepuka kubuni taarifa.");
  const content={positive_events:positive,negative_events:negative,births:born};
  const source_urls=[...new Set([...positive,...negative,...born].map(x=>x.source_url))];
  const {error}=await db.from("tiger_ai_daily_posts").insert({date_key:dateKey,title:`Leo katika historia — ${dateKey}`,content,source_urls});
  if(error){if(error.code==="23505")return json({success:true,already_published:true,date:dateKey});throw error;}
  return json({success:true,published:true,date:dateKey,positive:positive.length,negative:negative.length,births:born.length});
 }catch(e){console.error("Tiger AI daily history",e);return json({error:e instanceof Error?e.message:"Daily history failed"},500);}
});