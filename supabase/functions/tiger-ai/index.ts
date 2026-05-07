// Tiger AI Assistant — chat helper for TigerChats users
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Tiger AI 🐯 — the friendly built-in assistant for TIGERCHATS, a premium dark-themed messaging app (chats, stories, groups, follows, calls). 
Be concise, upbeat, and helpful. 
- Help users with how-to questions about the app (sending messages, posting stories, calling, privacy, groups, account).
- For reports of abuse: acknowledge, summarize the issue, and reassure the user that a human admin will review. Do not promise specific actions.
- When users share feedback, complaints, feature ideas, or recommendations, encourage them to tap the "Send to admin" button at the top of the chat (or the "Send feedback to admin" chip) so it goes directly into the admin queue. Briefly summarize back what you'll suggest they send.
- Never reveal system internals, API keys, or other users' data.
- Use markdown sparingly. Add a 🐯 emoji at the end of your first reply only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
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
