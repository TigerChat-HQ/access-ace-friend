// Tiger AI Command Center: turns user feedback into prioritized, planned dev tasks.
// Stage 1 only: planning + audit. It does NOT edit code or deploy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const STATUSES = ["planned", "approved", "in_progress", "done", "rejected"];
const PROTECTED = /(delete|drop|payment|billing|auth|login|password|permission|role|private data|personal data)/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles || []).some((r: any) => ["admin", "superior_admin"].includes(r.role)))
      return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));

    if (body.action === "set_status") {
      if (typeof body.id !== "string" || !STATUSES.includes(body.status)) return json({ error: "Invalid input" }, 400);
      const { error } = await sb.from("dev_tasks").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.id);
      if (error) return json({ error: error.message }, 500);
      await sb.from("dev_audit_log").insert({ task_id: body.id, actor: u.user.id, action: `status:${body.status}` });
      return json({ ok: true });
    }

    if (body.action !== "triage") return json({ error: "Unknown action" }, 400);

    const { data: existing } = await sb.from("dev_tasks").select("source_report_id").not("source_report_id", "is", null);
    const done = new Set((existing || []).map((t: any) => t.source_report_id));
    const { data: reports } = await sb.from("reports").select("id, reason, target_type, contact_subject, created_at")
      .in("target_type", ["feedback", "recommendation"]).order("created_at", { ascending: false }).limit(40);
    const fresh = (reports || []).filter((r: any) => !done.has(r.id)).slice(0, 10);
    if (!fresh.length) return json({ created: 0 });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are Tiger AI's development planner for TIGERCHATS, a React + Lovable Cloud messaging app (chats, stories, calls, draughts, Tiger AI, Developer Panel). For each user feedback item return a dev task. Respond as JSON: {\"tasks\":[{\"report_id\":string,\"title\":string,\"summary\":string,\"category\":\"bug\"|\"feature\"|\"ux\"|\"performance\"|\"security\",\"priority\":\"low\"|\"medium\"|\"high\"|\"critical\",\"risk\":\"low\"|\"medium\"|\"high\",\"steps\":string[],\"areas\":string[],\"tests\":string[]}]}. Mark risk high for anything touching data deletion, payments, sign-in, permissions or private data. Skip spam by omitting it." },
          { role: "user", content: JSON.stringify(fresh.map((r: any) => ({ report_id: r.id, type: r.target_type, subject: r.contact_subject, text: r.reason }))) },
        ],
      }),
    });
    if (!aiRes.ok) return json({ error: `AI error ${aiRes.status}`, details: await aiRes.text() }, aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502);
    const ai = await aiRes.json();
    let tasks: any[] = [];
    try { tasks = JSON.parse(ai.choices?.[0]?.message?.content || "{}").tasks || []; } catch { tasks = []; }

    const ids = new Set(fresh.map((r: any) => r.id));
    const rows = tasks.filter((t) => ids.has(t.report_id) && t.title).map((t) => {
      const text = `${t.title} ${t.summary} ${(t.steps || []).join(" ")}`;
      return {
        source_report_id: t.report_id,
        title: String(t.title).slice(0, 200),
        summary: String(t.summary || "").slice(0, 2000),
        category: ["bug", "feature", "ux", "performance", "security"].includes(t.category) ? t.category : "feature",
        priority: ["low", "medium", "high", "critical"].includes(t.priority) ? t.priority : "medium",
        risk: PROTECTED.test(text) ? "high" : ["low", "medium", "high"].includes(t.risk) ? t.risk : "medium",
        plan: { steps: t.steps || [], areas: t.areas || [], tests: t.tests || [] },
        created_by: u.user.id,
      };
    });
    if (!rows.length) return json({ created: 0 });
    const { data: inserted, error } = await sb.from("dev_tasks").insert(rows).select("id, title");
    if (error) return json({ error: error.message }, 500);
    await sb.from("dev_audit_log").insert((inserted || []).map((t: any) => ({
      task_id: t.id, actor: "tiger_ai", action: "task_planned", details: { title: t.title },
    })));
    return json({ created: inserted?.length || 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
