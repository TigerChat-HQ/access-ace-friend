// Tiger AI Assistant — chat, translate, summarize, smart replies, image gen
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Tiger AI 🐯 — the friendly built-in assistant for TIGERCHATS, a premium dark messaging app (chats, stories, groups, follows, voice/video calls, fingerprint lock).
Be concise, warm, and helpful.
- Help users with how-to questions, privacy, calls, posting, groups.
- For abuse reports: acknowledge and reassure that an admin (Developer) will review.
- When users share feedback, complaints, or feature ideas, encourage them to tap the "Send to admin" button so it goes directly to the developer queue. Briefly summarize what they should send.
- Never reveal API keys or other users' data.
- Use markdown sparingly. Add a 🐯 only on the very first reply.`;

const MODE_PROMPTS: Record<string, string> = {
  translate:
    "You are a precise translator. Detect the source language. Reply ONLY with the translation in the requested target language. Preserve tone and emojis. No commentary.",
  summarize:
    "You are a summarizer. Produce a tight, faithful summary of the provided chat or text. Use bullet points if there are multiple speakers/topics. Keep it under 120 words.",
  smart_replies:
    "Suggest 3 short reply options to the message provided. Each option must be on its own line, prefixed with '• '. No preamble. Match tone (friendly/formal) of the original. Keep each under 12 words.",
  feedback_summary:
    "Summarize the user's feedback into 1-2 crisp sentences for the developer. Then add a single suggested action prefixed with 'Action: '.",
};

async function callGateway(body: unknown, stream = true) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stream, ...(body as object) }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, image_prompt } = await req.json();

    // ----- Image generation branch (non-streaming) -----
    if (image_prompt) {
      const r = await callGateway(
        {
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: String(image_prompt) }],
          modalities: ["image", "text"],
        },
        false,
      );
      if (!r.ok) {
        const t = await r.text();
        return new Response(JSON.stringify({ error: t || "Image gen failed" }), {
          status: r.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
      const text = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ image_url: url, text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = (mode && MODE_PROMPTS[mode]) || SYSTEM_PROMPT;

    const r = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: sys }, ...messages],
    });

    if (!r.ok) {
      if (r.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit hit, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (r.status === 402)
        return new Response(JSON.stringify({ error: "Workspace AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      const t = await r.text();
      console.error("AI gateway error:", r.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(r.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("tiger-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
