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

const GITHUB_REPO = Deno.env.get("GITHUB_REPOSITORY") || "TigerChat-HQ/access-ace-friend";

async function readGitHubChecks(prUrl: string) {
  const match = /^https:\/\/github\.com\/TigerChat-HQ\/access-ace-friend\/pull\/(\d+)(?:\/)?$/.exec(prUrl);
  if (!match) throw new Error("Stored pull request URL is not a valid TIGERCHAT GitHub PR URL");
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "TIGERCHAT-Command-Center",
  };
  const prResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/pulls/${match[1]}`, { headers });
  if (!prResponse.ok) throw new Error(`GitHub PR lookup failed [${prResponse.status}]`);
  const pr = await prResponse.json();
  const sha = pr?.head?.sha;
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/i.test(sha)) {
    throw new Error("GitHub did not return a valid pull request head commit");
  }
  const checksResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/commits/${sha}/check-runs?per_page=100`,
    { headers },
  );
  if (!checksResponse.ok) throw new Error(`GitHub check-runs lookup failed [${checksResponse.status}]`);
  const checksData = await checksResponse.json();
  const checkRuns = Array.isArray(checksData?.check_runs) ? checksData.check_runs : [];
  const completed = checkRuns.filter((c: { status?: string }) => c.status === "completed");
  const pending = checkRuns.filter((c: { status?: string }) => c.status !== "completed");
  const failed = completed.filter((c: { conclusion?: string | null }) =>
    !["success", "neutral", "skipped"].includes(c.conclusion ?? ""),
  );
  const passed = completed.filter((c: { conclusion?: string | null }) => c.conclusion === "success");
  const verdict = checkRuns.length === 0 ? "no_runs" : pending.length > 0 ? "running" : failed.length > 0 ? "failed" : "passed";
  return {
    sha,
    total: checkRuns.length,
    completed: completed.length,
    passed: passed.length,
    failed: failed.length,
    pending: pending.length,
    runs: checkRuns.map((c: { name?: string; status?: string; conclusion?: string | null; html_url?: string }) => ({
      name: c.name ?? "Unnamed check",
      status: c.status ?? "unknown",
      conclusion: c.conclusion ?? null,
      url: c.html_url ?? null,
    })),
    verdict,
    checked_at: new Date().toISOString(),
    source: "GitHub Actions check-runs API",
  };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles || []).some((r) => ["admin", "superior_admin"].includes(r.role)))
      return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));

    if (body.action === "set_status") {
      if (typeof body.id !== "string" || !STATUSES.includes(body.status)) return json({ error: "Invalid input" }, 400);
      const { error } = await sb.from("dev_tasks").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.id);
      if (error) return json({ error: error.message }, 500);
      await sb.from("dev_audit_log").insert({ task_id: body.id, actor: u.user.id, action: `status:${body.status}` });
      return json({ ok: true });
    }


    if (body.action === "check_status") {
      if (typeof body.id !== "string") return json({ error: "Invalid input" }, 400);
      const { data: task, error: taskError } = await sb.from("dev_tasks").select("*").eq("id", body.id).single();
      if (taskError || !task) return json({ error: "Task not found" }, 404);
      const prUrl = task.plan?.pr?.url;
      if (typeof prUrl !== "string" || !prUrl) return json({ error: "No GitHub pull request is linked to this task yet" }, 400);
      try {
        const checks = await readGitHubChecks(prUrl);
        const nextPlan = { ...(task.plan || {}), checks };
        const { error: updateError } = await sb.from("dev_tasks").update({
          plan: nextPlan,
          updated_at: new Date().toISOString(),
        }).eq("id", task.id);
        if (updateError) return json({ error: `GitHub checks were read but task status could not be saved: ${updateError.message}` }, 500);
        await sb.from("dev_audit_log").insert({
          task_id: task.id,
          actor: "tiger_ai",
          action: `checks:${checks.verdict}`,
          details: { title: task.title, sha: checks.sha, passed: checks.passed, failed: checks.failed, pending: checks.pending, total: checks.total },
        });
        return json({ checks });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Failed to read GitHub Actions checks" }, 502);
      }
    }

    if (body.action === "propose_code") {
      return json({ error: "Automatic code drafting is disabled until a GitHub-native, non-Lovable write integration is configured. Use GitHub to create and review the PR." }, 501);
    }

    if (body.action === "create_task") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const summary = typeof body.summary === "string" ? body.summary.trim() : "";
      const allowedCategories = ["bug", "feature", "ux", "performance", "security"];
      if (!title || title.length > 200) return json({ error: "Task title is required (max 200 characters)" }, 400);
      if (summary.length > 2000) return json({ error: "Task summary is too long" }, 400);
      const category = allowedCategories.includes(body.category) ? body.category : "feature";
      const risk = PROTECTED.test(title + " " + summary) ? "high" : "medium";
      const { data: task, error } = await sb.from("dev_tasks").insert({
        title, summary: summary || null, category, priority: "medium", risk,
        status: "planned", plan: { steps: [], areas: [], tests: [] }, created_by: u.user.id,
      }).select("id, title").single();
      if (error) return json({ error: error.message }, 500);
      await sb.from("dev_audit_log").insert({
        task_id: task.id, actor: u.user.id, action: "task_created",
        details: { title: task.title, category },
      });
      return json({ ok: true, task });
    }

    if (body.action !== "triage") return json({ error: "Unknown action" }, 400);

    const { data: existing } = await sb.from("dev_tasks").select("source_report_id").not("source_report_id", "is", null);
    const done = new Set((existing || []).map((t) => t.source_report_id));
    const { data: reports } = await sb.from("reports").select("id, reason, target_type, contact_subject, created_at")
      .in("target_type", ["feedback", "recommendation"]).order("created_at", { ascending: false }).limit(40);
    const fresh = (reports || []).filter((r) => !done.has(r.id)).slice(0, 10);
    if (!fresh.length) return json({ created: 0 });

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) return json({ error: "AI triage is not configured. Add OPENAI_API_KEY to Supabase Edge Function secrets." }, 503);

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-6.1-sol",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are Tiger AI's development planner for TIGERCHATS, a React + Supabase messaging app (chats, stories, calls, draughts, Tiger AI, Developer Panel). For each user feedback item return a dev task. Respond as JSON: {\"tasks\":[{\"report_id\":string,\"title\":string,\"summary\":string,\"category\":\"bug\"|\"feature\"|\"ux\"|\"performance\"|\"security\",\"priority\":\"low\"|\"medium\"|\"high\"|\"critical\",\"risk\":\"low\"|\"medium\"|\"high\",\"steps\":string[],\"areas\":string[],\"tests\":string[]}]}. Mark risk high for anything touching data deletion, payments, sign-in, permissions or private data. Skip spam by omitting it." },
          { role: "user", content: JSON.stringify(fresh.map((r) => ({ report_id: r.id, type: r.target_type, subject: r.contact_subject, text: r.reason }))) },
        ],
      }),
    });
    if (!aiRes.ok) return json({ error: `AI error ${aiRes.status}`, details: await aiRes.text() }, aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502);
    const ai = await aiRes.json();
    let tasks: Array<Record<string, unknown>> = [];
    try { tasks = JSON.parse(ai.choices?.[0]?.message?.content || "{}").tasks || []; } catch { tasks = []; }

    const ids = new Set(fresh.map((r) => r.id));
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
    await sb.from("dev_audit_log").insert((inserted || []).map((t) => ({
      task_id: t.id, actor: "tiger_ai", action: "task_planned", details: { title: t.title },
    })));
    return json({ created: inserted?.length || 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
