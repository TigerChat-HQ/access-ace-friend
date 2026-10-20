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
    const { messages, mode, image_prompt, edit_image_url, hq, video_prompt, video_id } = await req.json();
    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const GW = "https://ai.gateway.lovable.dev/v1/videos";
    const KEY = Deno.env.get("LOVABLE_API_KEY");

    // ----- Video: create job (Lovable AI, Gemini Omni) -----
    if (video_prompt) {
      if (!KEY) return json({ error: "AI not configured." }, 500);
      const r = await fetch(GW, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-omni-1.1-flash",
          input: `${String(video_prompt).slice(0, 1000)}. Cinematic, single continuous shot, consider micro-detail and timing; fitting ambient soundtrack.`,
          response_format: { type: "video", resolution: "720p", duration: "5s", aspect_ratio: "9:16" },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("video create", r.status, d);
        return json({ error: d?.error?.message || d?.message || "Video request failed." }, r.status);
      }
      return json({ video_id: d.id, status: d.status });
    }

    // ----- Video: poll job, store MP4 on completion -----
    if (video_id) {
      if (!KEY) return json({ error: "AI not configured." }, 500);
      const id = String(video_id).replace(/[^a-zA-Z0-9_-]/g, "");
      const r = await fetch(`${GW}/${id}`, { headers: { Authorization: `Bearer ${KEY}` } });
      const job = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: job?.error?.message || "Status check failed." }, r.status);
      if (job.status === "failed") return json({ status: "failed", error: job.error?.message || "Video generation failed." });
      if (job.status !== "completed") return json({ status: job.status, progress: job.progress ?? null });

      const { createClient } = await import("npm:@supabase/supabase-js@2");
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const path = `${id}.mp4`;
      await admin.storage.createBucket("ai-videos", { public: false }).catch(() => {});
      const { data: existing } = await admin.storage.from("ai-videos").list("", { search: path });
      if (!existing?.some((f) => f.name === path)) {
        const c = await fetch(`${GW}/${id}/content`, { headers: { Authorization: `Bearer ${KEY}` } });
        if (!c.ok) return json({ error: "Could not download video." }, 502);
        const bytes = new Uint8Array(await c.arrayBuffer());
        const up = await admin.storage.from("ai-videos").upload(path, bytes, { contentType: "video/mp4", upsert: true });
        if (up.error) return json({ error: up.error.message }, 500);
      }
      const { data: signed } = await admin.storage.from("ai-videos").createSignedUrl(path, 60 * 60 * 24 * 7);
      return json({ status: "completed", video_url: signed?.signedUrl, text: "Here's your clip 🐯🎬" });
    }

    // ----- Image generation / editing branch (non-streaming) -----
    if (image_prompt || edit_image_url) {
      const model = hq
        ? "google/gemini-3-pro-image-preview"
        : "google/gemini-3.1-flash-image-preview";
      const userContent: any[] = [
        { type: "text", text: String(image_prompt || "Edit this image") },
      ];
      if (edit_image_url) {
        userContent.push({ type: "image_url", image_url: { url: String(edit_image_url) } });
      }
      const r = await callGateway(
        {
          model,
          messages: [{ role: "user", content: userContent }],
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
