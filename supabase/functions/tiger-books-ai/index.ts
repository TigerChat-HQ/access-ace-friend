import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type BooksDatabase = {
  public: {
    Tables: {
      books_daily_chapters: {
        Row: { id: string; story_id: string; episode_number: number; publish_date: string; title: string; body: string; recap: string; created_at: string };
        Insert: { id?: string; story_id: string; episode_number: number; publish_date: string; title: string; body: string; recap: string; created_at?: string };
        Update: Partial<{ story_id: string; episode_number: number; publish_date: string; title: string; body: string; recap: string }>;
        Relationships: [];
      };
      tiger_ai_smart_cards: {
        Row: { id: string; publish_date: string; placement: "post" | "status"; category: "sheria" | "elimu" | "historia" | "afya" | "maarifa"; source_key: string; title: string; hook: string; body: string; source_title: string; source_reference: string | null; source_url: string; jurisdiction: string | null; read_more_url: string; verified: boolean; is_active: boolean; created_at: string };
        Insert: { id?: string; publish_date: string; placement: "post" | "status"; category: "sheria" | "elimu" | "historia" | "afya" | "maarifa"; source_key: string; title: string; hook: string; body: string; source_title: string; source_reference?: string | null; source_url: string; jurisdiction?: string | null; read_more_url: string; verified?: boolean; is_active?: boolean; created_at?: string };
        Update: Partial<{ publish_date: string; placement: "post" | "status"; category: "sheria" | "elimu" | "historia" | "afya" | "maarifa"; source_key: string; title: string; hook: string; body: string; source_title: string; source_reference: string | null; source_url: string; jurisdiction: string | null; read_more_url: string; verified: boolean; is_active: boolean }>;
        Relationships: [];
      };
      tiger_books_ai_config: {
        Row: { id: boolean; cron_token: string; enabled: boolean; updated_at: string };
        Insert: { id?: boolean; cron_token: string; enabled?: boolean; updated_at?: string };
        Update: Partial<{ cron_token: string; enabled: boolean; updated_at: string }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
type AdminClient = SupabaseClient<BooksDatabase, "public", "public">;

type StorySpec = { id: string; title: string; premise: string };
type ApprovedSource = {
  key: string;
  category: "sheria" | "elimu";
  shortTitle: string;
  claim: string;
  sourceTitle: string;
  reference: string;
  sourceUrl: string;
  jurisdiction: string | null;
  readMoreUrl: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const stories: StorySpec[] = [
  { id: "mji-wa-siri", title: "Siri ya Mji wa Kale", premise: "Amani, mwanafunzi wa historia, anachunguza ramani ya babu yake na siri za mji wa pwani ya Afrika Mashariki. Hadithi ni ya kubuni; maeneo na matukio yasichukuliwe kama ushahidi wa kihistoria." },
  { id: "barua-usiku", title: "Barua Zinazokuja Usiku", premise: "Amina anapokea barua zisizo na mtumaji zinazofichua siri za familia na uhusiano wa zamani. Simulizi la mapenzi na fumbo, lote ni la kubuni." },
  { id: "kivuli-msituni", title: "Kivuli cha Msitu wa Mvua", premise: "Juma na marafiki zake wanapotea kwenye msitu wa kubuni wenye alama za ajabu na siri za urafiki. Simulizi la kusisimua na vitisho, lote ni la kubuni." },
];

const approvedSources: ApprovedSource[] = [
  {
    key: "law-child", category: "sheria", shortTitle: "Haki na ustawi wa mtoto",
    claim: "Kwa mujibu wa kifungu 8(1) cha Law of the Child Act, Cap. 13 R.E. 2023, wajibu wa kumtunza mtoto unajumuisha chakula, makazi, mavazi, matibabu na chanjo, elimu na mwongozo, uhuru, michezo na mapumziko.",
    sourceTitle: "Office of the Attorney General — OAG MIS",
    reference: "The Law of the Child Act, Cap. 13 R.E. 2023, section 8(1); OAG revised publication 25 Apr 2025",
    sourceUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/118",
    jurisdiction: "Tanzania Bara", readMoreUrl: "/books?book=law-child",
  },
  {
    key: "cybercrimes-act", category: "sheria", shortTitle: "Sheria za matumizi ya TEHAMA",
    claim: "Cybercrimes Act, 2015, Cap. 443, inahusu makosa yanayohusiana na mifumo ya kompyuta na TEHAMA, pamoja na uchunguzi na matumizi ya ushahidi wa kielektroniki.",
    sourceTitle: "Office of the Attorney General — OAG MIS",
    reference: "The Cybercrimes Act, 2015, Act No. 14 of 2015, Cap. 443; revised publication 25 Apr 2025",
    sourceUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/543",
    jurisdiction: "Tanzania Bara", readMoreUrl: "/books?book=cybercrimes-act",
  },
  {
    key: "employment-act", category: "sheria", shortTitle: "Haki za msingi kazini",
    claim: "Employment and Labour Relations Act, 2004, Cap. 366, inahusu haki za msingi za kazi, viwango vya ajira, majadiliano ya pamoja na mfumo wa kuzuia na kutatua migogoro.",
    sourceTitle: "Office of the Attorney General — OAG MIS",
    reference: "The Employment and Labour Relations Act, 2004, Act No. 6 of 2004, Cap. 366; revised publication 25 Apr 2025",
    sourceUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/570",
    jurisdiction: "Tanzania Bara", readMoreUrl: "/books?book=employment-act",
  },
  {
    key: "education-act", category: "elimu", shortTitle: "Sheria ya Elimu",
    claim: "The Education Act, Cap. 353, imeelezwa na Ofisi ya Mwanasheria Mkuu kuwa sheria inayolenga maendeleo bora ya mfumo wa elimu. Hati rasmi ndiyo rejea ya vifungu na masharti kamili.",
    sourceTitle: "Office of the Attorney General — OAG MIS",
    reference: "The Education Act, Cap. 353; revised publication 25 Apr 2025",
    sourceUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/457",
    jurisdiction: "Tanzania Bara", readMoreUrl: "/books?book=education-act",
  },
  {
    key: "learning-spacing", category: "elimu", shortTitle: "Kurudia somo kwa vipindi",
    claim: "Mapitio ya Nature Reviews Psychology yanaeleza ushahidi kuhusu kurudia kujifunza kwa vipindi tofauti na kujipima kwa kukumbuka taarifa. Matokeo hutegemea namna ya kutumia mbinu hizo na mazingira ya mwanafunzi.",
    sourceTitle: "Nature Reviews Psychology",
    reference: "Carpenter, Pan & Butler (2022), The science of effective learning with spacing and retrieval practice",
    sourceUrl: "https://www.nature.com/articles/s44159-022-00089-1",
    jurisdiction: null, readMoreUrl: "/books?book=learning-science",
  },
  {
    key: "copyright-act", category: "sheria", shortTitle: "Haki za tafsiri za vitabu",
    claim: "Kifungu 6(1)(a) cha Copyright and Neighbouring Rights Act, Cap. 218 R.E. 2023, kinataja tafsiri na marekebisho ya kazi za fasihi na sanaa kuwa kazi zinazoweza kulindwa kama kazi asilia. Hivyo, haki za tafsiri zinapaswa kuchunguzwa tofauti na haki za kitabu cha asili.",
    sourceTitle: "Office of the Attorney General — OAG MIS",
    reference: "Copyright and Neighbouring Rights Act, Cap. 218 R.E. 2023, section 6(1)(a); revised publication 25 Apr 2025",
    sourceUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/322",
    jurisdiction: "Tanzania", readMoreUrl: "/books?book=copyright-act",
  },
  {
    key: "learning-retrieval", category: "elimu", shortTitle: "Jipime kwa kukumbuka",
    claim: "Mwongozo wa Australian Education Research Organisation unaeleza kuwa kuomba mwanafunzi akumbuke alichojifunza na kurudia mazoezi kwa vipindi kunaweza kusaidia taarifa kubaki kwenye kumbukumbu kwa muda mrefu.",
    sourceTitle: "Australian Education Research Organisation",
    reference: "Spacing and retrieval practice guide",
    sourceUrl: "https://www.edresearch.edu.au/guides-resources/practice-guides/spacing-and-retrieval-practice-guide-full-publication",
    jurisdiction: null, readMoreUrl: "/books?book=learning-science",
  },
];

const parseJson = (raw: string) => {
  const cleaned = raw.trim().replace(/^\u0060\u0060\u0060(?:json)?\s*/i, "").replace(/\s*\u0060\u0060\u0060$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI response did not contain a JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1));
};

const callAI = async (system: string, prompt: string, maxTokens = 1500) => {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!geminiKey && !lovableKey) throw new Error("AI provider key is not configured for Tiger Books.");

  const endpoint = geminiKey
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${geminiKey || lovableKey}`,
    "Content-Type": "application/json",
  };
  const model = geminiKey ? "gemini-3.5-flash-lite" : "google/gemini-3.5-flash-lite";
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.72,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Tiger Books AI provider error", response.status, JSON.stringify(payload).slice(0, 900));
    throw new Error(`AI provider request failed (${response.status}).`);
  }
  const content = payload?.choices?.[0]?.message?.content;
  const raw = typeof content === "string"
    ? content
    : Array.isArray(content) ? content.map((part: { text?: string }) => part?.text || "").join("\n") : "";
  if (!raw.trim()) throw new Error("AI provider returned an empty response.");
  return parseJson(raw);
};

const dateInTanzania = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const safeText = (value: unknown, max: number, fallback: string) =>
  String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max) || fallback;

async function generateStoryChapter(admin: AdminClient, story: StorySpec, publishDate: string) {
  const { data: existing, error: existingError } = await admin
    .from("books_daily_chapters").select("id").eq("story_id", story.id).eq("publish_date", publishDate).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { story_id: story.id, already_published: true };

  const { data: previous, error: previousError } = await admin
    .from("books_daily_chapters").select("episode_number,title,body,recap")
    .eq("story_id", story.id).order("episode_number", { ascending: false }).limit(1).maybeSingle();
  if (previousError) throw previousError;

  const episode = (previous?.episode_number || 0) + 1;
  const result = await callAI(
    "Wewe ni mwandishi wa riwaya za kubuni kwa Kiswahili sanifu, chenye mtiririko wa kuvutia na mazungumzo ya asili. Usidai simulizi ni tukio halisi. Usinakili vitabu au waandishi wengine. Dumisha majina, tabia na mwendelezo.",
    JSON.stringify({
      task: "Andika sura mpya ya kila siku kwa hadithi hii.",
      story_title: story.title,
      premise: story.premise,
      episode_number: episode,
      previous_chapter_title: previous?.title || null,
      previous_recap: previous?.recap || "Hii ndiyo sura ya kwanza. Anzisha wahusika na fumbo kuu kwa utangulizi wenye mvuto.",
      previous_chapter_text: previous?.body?.slice(-2600) || null,
      requirements: [
        "Andika kwa Kiswahili sanifu, sentensi fupi na zinazoeleweka.",
        "Sura iwe na aya 5 hadi 8, takribani maneno 350 hadi 500.",
        "Endeleza moja kwa moja matukio ya sura iliyotangulia; usianze upya wala kurudia sura ileile.",
        "Ongeza tukio jipya, mazungumzo ya wahusika na maendeleo ya fumbo.",
        "Malizia kwa kishawishi cha kusubiri sura inayofuata, bila kutumia cliffhanger ileile kila mara.",
        "Hadithi ni ya kubuni; usiongeze madai ya kihistoria au kisheria kama ukweli.",
        "Rudisha JSON pekee yenye title, body na recap.",
      ],
      output_schema: { title: "Sura ya N: kichwa kifupi", body: "Aya 5-8 zikitenganishwa na mistari tupu", recap: "Muhtasari mfupi wa sura kwa mwandishi wa sura inayofuata" },
    }),
    1800,
  );

  const title = safeText(result.title, 160, `Sura ya ${episode}`);
  const body = safeText(result.body, 12000, "");
  const recap = safeText(result.recap, 1200, "");
  if (body.length < 300 || recap.length < 20) throw new Error(`AI chapter validation failed for ${story.id}.`);

  const { error: insertError } = await admin.from("books_daily_chapters").insert({
    story_id: story.id, episode_number: episode, publish_date: publishDate, title, body, recap,
  });
  if (insertError && insertError.code !== "23505") throw insertError;
  return { story_id: story.id, episode_number: episode, published: !insertError };
}

async function generateSmartCards(admin: ReturnType<typeof createClient>, publishDate: string) {
  const { count, error: countError } = await admin
    .from("tiger_ai_smart_cards").select("id", { count: "exact", head: true }).eq("publish_date", publishDate);
  if (countError) throw countError;
  if ((count || 0) >= 4) return { already_published: true, count };

  const dayNumber = Math.floor(new Date(`${publishDate}T00:00:00Z`).getTime() / 86_400_000);
  const start = dayNumber % approvedSources.length;
  const chosen = Array.from({ length: 4 }, (_, index) => approvedSources[(start + index) % approvedSources.length]);
  const generated = await callAI(
    "Wewe ni mhariri wa kadi fupi za elimu kwa Kiswahili. Unaruhusiwa kubuni vichwa vya kuvutia tu. Usiongeze ukweli, tarehe, namba za vifungu, adhabu, tafsiri ya sheria au ushauri ambao haupo kwenye chanzo kilichotolewa. Hifadhi maana ya mada. Jibu JSON pekee.",
    JSON.stringify({
      task: "Tengeneza hook na kichwa kifupi cha S-card kwa kila mada iliyoidhinishwa.",
      sources: chosen.map((source) => ({ source_key: source.key, category: source.category, approved_fact: source.claim, source_reference: source.reference })),
      requirements: [
        "Kila source_key itumike mara moja tu.",
        "title iwe fupi na ya Kiswahili, isizidi herufi 90.",
        "hook iwe sentensi moja ya kuvutia, isizidi herufi 140.",
        "Unaweza kutumia mtindo JE, WAJUA? lakini usitumie clickbait ya kutisha.",
        "Usiongeze madai mapya; body ya mwisho itatumia approved_fact kama ilivyo.",
      ],
      output_schema: { cards: [{ source_key: "exact source_key", title: "kichwa", hook: "hook fupi" }] },
    }),
    900,
  );

  const generatedCards = Array.isArray(generated.cards) ? generated.cards : [];
  const cardRows = chosen.map((source, index) => {
    const match = generatedCards.find((item: { source_key?: string }) => item?.source_key === source.key);
    const fallback = `JE, WAJUA? ${source.shortTitle}`;
    return {
      publish_date: publishDate,
      placement: index === 0 ? "post" : "status",
      category: source.category,
      source_key: source.key,
      title: safeText(match?.title, 140, source.shortTitle),
      hook: safeText(match?.hook, 220, fallback),
      body: source.claim,
      source_title: source.sourceTitle,
      source_reference: source.reference,
      source_url: source.sourceUrl,
      jurisdiction: source.jurisdiction,
      read_more_url: source.readMoreUrl,
      verified: true,
      is_active: true,
    };
  });

  const { error } = await admin.from("tiger_ai_smart_cards").upsert(cardRows, {
    onConflict: "publish_date,placement,source_key",
    ignoreDuplicates: true,
  });
  if (error) throw error;
  return { published: cardRows.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Books AI service is not configured." }, 500);

    const body = await req.json().catch(() => ({}));
    const admin: AdminClient = createClient<BooksDatabase>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: config, error: configError } = await admin
      .from("tiger_books_ai_config").select("cron_token,enabled").eq("id", true).single();
    if (configError || !config?.enabled || !config.cron_token || body?.token !== config.cron_token) {
      return json({ error: "Unauthorized scheduler request." }, 401);
    }

    const publishDate = dateInTanzania();
    const chapterResults = [];
    for (const story of stories) chapterResults.push(await generateStoryChapter(admin, story, publishDate));
    const cards = await generateSmartCards(admin, publishDate);
    return json({ success: true, publish_date: publishDate, chapters: chapterResults, smart_cards: cards });
  } catch (error) {
    console.error("Tiger Books AI daily publisher failed:", error);
    return json({ error: error instanceof Error ? error.message : "Daily publishing failed." }, 500);
  }
});
