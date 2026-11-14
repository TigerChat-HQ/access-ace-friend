import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tigerchat-hq.onrender.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Sign in required" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !publishableKey) return reply({ error: "Server authentication is not configured" }, 503);
    if (!geminiKey) return reply({ error: "Transcription service is not configured. Add GEMINI_API_KEY to Supabase Edge Function secrets." }, 503);

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply({ error: "Session is invalid or expired" }, 401);

    const form = await req.formData();
    const messageId = String(form.get("messageId") ?? "").trim();
    const audio = form.get("audio");
    if (!/^[0-9a-f-]{36}$/i.test(messageId)) return reply({ error: "Invalid voice note ID" }, 400);
    if (!(audio instanceof File)) return reply({ error: "Voice note audio is required" }, 400);
    if (audio.size <= 0 || audio.size > 8 * 1024 * 1024) {
      return reply({ error: "Voice note must be between 1 byte and 8 MB" }, 413);
    }

    const mimeType = (audio.type || "audio/mp4").split(";")[0].toLowerCase();
    if (!["audio/mp4", "audio/m4a", "audio/webm", "audio/ogg", "audio/mpeg", "audio/wav", "audio/aac"].includes(mimeType)) {
      return reply({ error: "Unsupported voice note audio format" }, 415);
    }

    // RLS ensures the caller can only read messages in conversations they belong to.
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, message_type")
      .eq("id", messageId)
      .maybeSingle();
    if (messageError || !message) return reply({ error: "Voice note not found or access denied" }, 404);
    if (message.message_type !== "voice") return reply({ error: "Only voice notes can be transcribed" }, 400);

    const base64Audio = toBase64(new Uint8Array(await audio.arrayBuffer()));
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: "Transcribe the attached voice note verbatim in the original spoken language. Preserve the speaker's words and natural punctuation. Do not translate, summarize, explain, add speaker names, or invent words. If there is no intelligible speech, return an empty response." },
              { inline_data: { mime_type: mimeType, data: base64Audio } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096 },
        }),
      },
    );

    const providerPayload = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      console.error("Voice transcription provider failed", geminiResponse.status);
      return reply({ error: "Transcription service could not process this voice note. Try again later." }, 502);
    }

    const transcript = (providerPayload?.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim()
      .slice(0, 12000);
    if (!transcript) return reply({ error: "No clear speech was detected in this voice note" }, 422);

    // Save only the text, never the audio. RLS makes this transcript private to the requesting user.
    const { data: saved, error: saveError } = await supabase
      .from("voice_note_transcripts")
      .upsert({
        message_id: message.id,
        conversation_id: message.conversation_id,
        transcriber_id: user.id,
        transcript,
        language: null,
        provider: "gemini-3.5-flash-lite",
      }, { onConflict: "message_id,transcriber_id" })
      .select("transcript, language, created_at")
      .single();

    if (saveError || !saved) {
      console.error("Voice transcript save failed", saveError?.code ?? "unknown");
      return reply({ error: "Transcription completed but could not be saved securely" }, 500);
    }

    return reply({ transcript: saved.transcript, language: saved.language, savedAt: saved.created_at });
  } catch (error) {
    console.error("Voice transcription failed", error instanceof Error ? error.message : "unknown error");
    return reply({ error: "Could not transcribe this voice note" }, 500);
  }
});
