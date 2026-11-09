import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { quizSchema, isFreshBatch } from "../_shared/quiz-validation.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-20b";

Deno.serve(async (req) => {
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) return reply({ error: "Tiger Developer Assistant's Groq connection is not configured. Add GROQ_API_KEY to Supabase Edge Function secrets." }, 503);

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ error: "Sign in required" }, 401);

    const { data: history, error: historyError } = await caller
      .from("quiz_question_history")
      .select("question")
      .order("created_at", { ascending: false })
      .limit(200);
    if (historyError) throw historyError;
    const previous = (history || []).map((row) => row.question);

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are Tiger Developer Assistant acting as a careful Tanzanian quiz question writer. Generate accurate, unambiguous educational multiple-choice questions. Never invent facts. Return JSON only.",
          },
          {
            role: "user",
            content: `Return JSON with exactly 10 fresh multiple-choice questions about Tanzania, covering history, culture, geography, sport and science. Use natural Swahili for the questions, options and explanations. Each question must have: category, difficulty (easy/medium/hard), question, exactly 4 distinct options, correct_index (0-3), and a factual explanation. Vary the position of correct answers. Do not repeat or paraphrase these previously served questions: ${JSON.stringify(previous)}. Batch seed: ${crypto.randomUUID()}. Return exactly { "questions": [...] }.`,
          },
        ],
      }),
    });

    const payload = await groqResponse.json().catch(() => ({}));
    if (!groqResponse.ok) {
      console.error("Groq quiz generation error", groqResponse.status, payload);
      if (groqResponse.status === 429) {
        return reply({ error: "Groq Free Plan imefikia kikomo cha matumizi kwa sasa. Subiri kikomo kijirejeshe kisha jaribu tena." }, 429);
      }
      return reply({ error: payload?.error?.message || "Tiger AI imeshindwa kutengeneza maswali. Jaribu tena." }, groqResponse.status >= 400 && groqResponse.status < 600 ? groqResponse.status : 502);
    }

    const rawText = payload?.choices?.[0]?.message?.content;
    if (typeof rawText !== "string" || !rawText.trim()) {
      return reply({ error: "Tiger AI haikurudisha maswali. Jaribu tena." }, 502);
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      return reply({ error: "Tiger AI imerudisha muundo usio sahihi wa maswali. Jaribu tena." }, 502);
    }
    const parsed = quizSchema.safeParse(parsedJson);
    if (!parsed.success || !isFreshBatch(parsed.data.questions, previous)) {
      return reply({ error: "Tiger AI imerudisha maswali yanayojirudia au yasiyo sahihi. Jaribu tena." }, 502);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertError } = await admin
      .from("quiz_question_history")
      .insert(parsed.data.questions.map((q) => ({ user_id: user.id, question: q.question })));
    if (insertError) throw insertError;

    return reply({
      questions: parsed.data.questions.map((q) => ({ ...q, id: crypto.randomUUID() })),
      provider: "groq",
      model: GROQ_MODEL,
    });
  } catch (error) {
    console.error("Quiz generation failed", error);
    return reply({ error: error instanceof Error ? error.message : "Question generation failed" }, 500);
  }
});
