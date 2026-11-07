import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.11";
import { quizSchema, isFreshBatch } from "../_shared/quiz-validation.ts";

Deno.serve(async req => {
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const caller = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ error: "Sign in required" }, 401);
    const { data: history, error: historyError } = await caller.from("quiz_question_history").select("question").order("created_at", { ascending: false }).limit(200);
    if (historyError) throw historyError;
    const previous = (history || []).map(row => row.question);
    const response = await generateResponse({ model: "openai/gpt-6-astra", input: `Return JSON with exactly 10 fresh multiple-choice questions about Tanzania: history, culture, geography, sport and science. Each has category, difficulty (easy/medium/hard), question, 4 distinct options, correct_index (0-3) and factual explanation. Vary topics and correct answer positions. Do not repeat or paraphrase these previously served questions: ${JSON.stringify(previous)}. Batch seed: ${crypto.randomUUID()}. Return {"questions":[...]}.`, text: { format: { type: "json_object" } } });
    const text = response.output.flatMap(item => item.type === "message" ? item.content.flatMap(content => content.type === "output_text" ? [content.text] : []) : []).join("");
    const parsed = quizSchema.safeParse(JSON.parse(text));
    if (!parsed.success || !isFreshBatch(parsed.data.questions, previous)) return reply({ error: "Tiger AI returned invalid or repeated questions. Please try again." }, 502);
    const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { error } = await admin.from("quiz_question_history").insert(parsed.data.questions.map(q => ({ user_id: user.id, question: q.question })));
    if (error) throw error;
    return reply({ questions: parsed.data.questions.map(q => ({ ...q, id: crypto.randomUUID() })) });
  } catch (error) {
    console.error("Quiz generation failed", error);
    return reply({ error: error instanceof Error ? error.message : "Question generation failed" }, error instanceof GatewayError ? error.httpStatus || 502 : 500);
  }
});