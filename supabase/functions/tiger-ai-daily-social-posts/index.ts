import { createClient } from "npm:@supabase/supabase-js@2";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
});
const themes = new Set(["sunset", "ocean", "forest", "royal"]);
type Draft = { status?: { title?: string; body?: string; theme?: string }; post?: { title?: string; body?: string; theme?: string } };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!url || !serviceKey || !aiKey) return json({ error: "Daily AI publisher is not configured." }, 503);
    const body = await req.json().catch(() => ({}));
    const db = createClient(url, serviceKey);
    const { data: config } = await db.from("tiger_ai_social_card_config")
      .select("cron_token,enabled").eq("id", true).single();
    if (!config?.enabled || !config.cron_token || body?.token !== config.cron_token) {
      return json({ error: "Unauthorized" }, 401);
    }

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
    const dateKey = `${get("year")}-${get("month")}-${get("day")}`;

    await db.from("tiger_ai_social_cards").delete().lte("expires_at", new Date().toISOString());
    const { data: existing, error: readError } = await db.from("tiger_ai_social_cards")
      .select("card_type").eq("date_key", dateKey);
    if (readError) throw readError;
    const already = new Set((existing || []).map((x: { card_type: string }) => x.card_type));
    if (already.has("status") && already.has("post")) {
      return json({ success: true, already_published: true, date: dateKey });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Wewe ni Tiger AI wa mtandao wa kijamii wa Kiswahili. Tengeneza mawazo mapya, yenye manufaa, yenye heshima na yasiyorudia. Usibuni habari, nukuu, takwimu, au madai ya ukweli. Toa JSON halali pekee.",
          },
          {
            role: "user",
            content: "Tengeneza machapisho mawili ya leo kwa Kiswahili fasaha. status: ujumbe mfupi wa kutia moyo/kuanzisha mazungumzo, title fupi na body ya maneno 20-45. post: chapisho la kawaida lenye wazo la maana, kichwa na body ya maneno 70-120, liwe na mwanzo unaovutia, maelezo yenye thamani na swali la kuhamasisha maoni. Usitumie hashtags nyingi wala emoji zaidi ya 2. Chagua theme moja kati ya sunset, ocean, forest, royal. Rudisha JSON {status:{title,body,theme},post:{title,body,theme}}.",
          },
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Tiger AI social card generation failed", response.status, detail);
      return json({ error: response.status === 402 ? "AI credits exhausted" : "AI generation failed" }, 502);
    }
    const result = await response.json();
    const raw = String(result.choices?.[0]?.message?.content || "").trim();
    const draft = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as Draft;

    const candidates = [
      { card_type: "status", value: draft.status },
      { card_type: "post", value: draft.post },
    ].filter((item) => !already.has(item.card_type));
    const rows = candidates.map(({ card_type, value }) => {
      const title = String(value?.title || "").trim().slice(0, 120);
      const text = String(value?.body || "").trim().slice(0, card_type === "status" ? 600 : 2200);
      const theme = String(value?.theme || "sunset");
      if (title.length < 3 || text.length < (card_type === "status" ? 20 : 60)) {
        throw new Error(`AI returned incomplete ${card_type} content.`);
      }
      return {
        date_key: dateKey,
        card_type,
        title,
        body: text,
        theme: themes.has(theme) ? theme : "sunset",
      };
    });
    if (!rows.length) return json({ success: true, already_published: true, date: dateKey });
    const { data: inserted, error: insertError } = await db.from("tiger_ai_social_cards")
      .insert(rows).select("id,card_type,expires_at");
    if (insertError) throw insertError;
    return json({ success: true, published: inserted?.length || 0, date: dateKey, cards: inserted });
  } catch (error) {
    console.error("Tiger AI daily social publisher", error);
    return json({ error: error instanceof Error ? error.message : "Daily publishing failed" }, 500);
  }
});
