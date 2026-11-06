// Tiger AI Command Center: turns user feedback into prioritized, planned dev tasks.
// Stage 1: planning + audit. Stage 2: code connection / PR proposal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const STATUSES = ["planned", "approved", "in_progress", "done", "rejected"];
const PROTECTED = /(delete|drop|payment|billing|auth|login|password|permission|role|private data|personal data)/i;
const ALLOWED_PATH = /^(src\/(pages|components|hooks|lib|data|types)\/[a-zA-Z0-9_./-]+\.(tsx?|css|json)|supabase\/migrations\/[a-zA-Z0-9_.-]+\.sql)$/;
const PROTECTED_PATH = /(auth|permission|role|supabase\/functions|integrations|generated|webRTC|CallContext|\.env|workflow|package-lock|bun\.lock|drizzle\/)/i;
const DANGEROUS_CONTENT = /(service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|BEGIN.*PRIVATE KEY|eval\s*\(|new Function\s*\(|dangerouslySetInnerHTML|document\.cookie|localStorage.*token|createClient\([^)]*SERVICE_ROLE|disable.*audit|drop\s+policy|alter\s+table.*disable\s+row level security)/is;

export function checkCode(path: string, content: string) {
  const findings: string[] = [];
  if (!ALLOWED_PATH.test(path) || path.includes("..") || PROTECTED_PATH.test(path)) {
    findings.push("Protected or unsupported file path");
  }
  if (DANGEROUS_CONTENT.test(content)) {
    findings.push("Sensitive credential, authorization, execution, or audit-bypass pattern");
  }
  return {
    allowed: findings.length === 0,
    findings,
    scope: "Autonomous policy screening only; protected security changes are blocked and all actions are audited.",
  };
}

async function github(path: string, method = "GET", body?: unknown) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connectionKey = Deno.env.get("GITHUB_API_KEY");
  if (!lovableKey || !connectionKey) {
    throw new Error("GitHub connection is not linked to this project (missing gateway credentials)");
  }
  const repo = Deno.env.get("GITHUB_REPOSITORY") || "TigerChat-HQ/access-ace-friend";
  const response = await fetch(`https://connector-gateway.lovable.dev/github/repos/${repo}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub [${response.status}]: ${errorText}`);
  }
  return response.status === 204 ? {} : response.json();
}

async function proposeCode(task: { id: string; title: string; summary: string | null; risk: string; plan: { areas?: string[]; steps?: string[]; pr?: { url?: string; number?: number; files?: string[] } } | null }) {
  if (!Deno.env.get("LOVABLE_API_KEY") || !Deno.env.get("GITHUB_API_KEY")) {
    return { error: "GitHub connection is not linked to this project" };
  }

  if (task.risk === "high") {
    return { error: "High-risk changes require manual engineering and cannot be drafted automatically" };
  }

  // Determine target file from plan.areas or default to safe location
  const candidateFile = (task.plan?.areas || []).find((filePath) => ALLOWED_PATH.test(filePath) && !PROTECTED_PATH.test(filePath));
  const targetPath = candidateFile || "src/components/chat/TigerChatBackground.tsx";

  try {
    // 1. Fetch current file content from GitHub default branch
    const fileRes = await github(`contents/${encodeURIComponent(targetPath)}`);
    if (!fileRes?.sha || !fileRes?.content) {
      return { error: `Target source file not found or inaccessible on GitHub: ${targetPath}` };
    }
    const binary = atob(fileRes.content.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const originalContent = new TextDecoder().decode(bytes);

    // 2. Generate updated code via Lovable AI gateway or prompt
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    let proposedContent = originalContent;
    let summary = `Tiger AI proposed change for task: ${task.title}`;

    if (aiKey) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Propose a minimal change to the specified source file to address the approved task. Preserve existing behavior. Never touch auth, credentials, permissions, payment, deletion, or protected paths. Return JSON with exactly content (complete updated file string) and summary (short description).",
            },
            {
              role: "user",
              content: JSON.stringify({
                task: { title: task.title, summary: task.summary, steps: task.plan?.steps },
                path: targetPath,
                current_file_content: originalContent,
              }),
            },
          ],
        }),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text().catch(() => "");
        throw new Error(`AI code proposal failed [${aiRes.status}]: ${detail.slice(0, 500)}`);
      }

      const aiJson = await aiRes.json().catch(() => ({}));
      const rawContent = aiJson?.choices?.[0]?.message?.content;
      if (typeof rawContent !== "string" || !rawContent.trim()) {
        throw new Error("AI returned an empty code proposal");
      }

      let parsed: { content?: unknown; summary?: unknown };
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        throw new Error("AI returned invalid JSON for the code proposal");
      }

      if (typeof parsed.content !== "string" || !parsed.content.trim()) {
        throw new Error("AI response did not include complete updated file content");
      }
      proposedContent = parsed.content;
      if (typeof parsed.summary === "string" && parsed.summary.trim()) summary = parsed.summary;
    }

    if (proposedContent === originalContent) {
      throw new Error("AI proposal made no source changes; no branch or pull request was created");
    }

    const check = checkCode(targetPath, proposedContent);
    if (!check.allowed) {
      return { error: "Autonomous policy blocked this change: " + check.findings.join(", ") };
    }

    // 3. Create branch from main
    const branch = `tiger-ai/task-${task.id.slice(0, 8)}`;
    const mainRef = await github("git/ref/heads/main");
    const mainSha = mainRef.object.sha;

    try {
      await github("git/refs", "POST", { ref: `refs/heads/${branch}`, sha: mainSha });
    } catch (error: unknown) {
      // If branch already exists, proceed to update
      if (!(error instanceof Error) || !error.message.includes("already exists")) {
        throw error;
      }
    }

    // 4. Commit updated file
    const encoded = btoa(Array.from(new TextEncoder().encode(proposedContent), (b) => String.fromCharCode(b)).join(""));
    await github(`contents/${encodeURIComponent(targetPath)}`, "PUT", {
      message: `Tiger AI: ${task.title}`,
      content: encoded,
      sha: fileRes.sha,
      branch,
    });

    // 5. Open draft pull request for human review (never auto-merge per AGENTS.md)
    const pr = await github("pulls", "POST", {
      title: `Tiger AI: ${task.title}`,
      head: branch,
      base: "main",
      draft: true,
      body: `Tiger AI proposed code change for approved dev task: **${task.title}**\n\nTask ID: \`${task.id}\`\n\n### Summary\n${summary}\n\n### Policy Screening\nPolicy screening passed for \`${targetPath}\`.\n\n*Note: Code changes go through GitHub as draft pull requests for human review and are never merged autonomously.*`,
    });

    return {
      pr: {
        url: pr.html_url,
        number: pr.number,
        files: [targetPath],
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to propose code" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles || []).some((roleRow) => ["admin", "superior_admin"].includes(roleRow.role)))
      return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));

    if (body.action === "set_status") {
      if (typeof body.id !== "string" || !STATUSES.includes(body.status)) return json({ error: "Invalid input" }, 400);
      const { error } = await sb.from("dev_tasks").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.id);
      if (error) return json({ error: error.message }, 500);
      await sb.from("dev_audit_log").insert({ task_id: body.id, actor: u.user.id, action: `status:${body.status}` });
      return json({ ok: true });
    }

    if (body.action === "propose_code") {
      if (typeof body.id !== "string") return json({ error: "Invalid input" }, 400);
      const { data: task } = await sb.from("dev_tasks").select("*").eq("id", body.id).single();
      if (!task) return json({ error: "Task not found" }, 404);
      if (!["approved", "in_progress"].includes(task.status)) return json({ error: "Approve the task first" }, 400);
      if (task.plan?.pr?.url) return json({ pr: task.plan.pr });
      const r = await proposeCode(task);
      if ("error" in r) return json(r, 502);
      await sb.from("dev_tasks").update({ status: "in_progress", plan: { ...task.plan, pr: r.pr }, updated_at: new Date().toISOString() }).eq("id", task.id);
      await sb.from("dev_audit_log").insert({ task_id: task.id, actor: "tiger_ai", action: "pr_opened", details: { title: task.title, url: r.pr.url, files: r.pr.files } });
      return json({ pr: r.pr });
    }

    if (body.action === "check_status") {
      if (typeof body.id !== "string") return json({ error: "Invalid input" }, 400);
      const { data: task } = await sb.from("dev_tasks").select("*").eq("id", body.id).single();
      if (!task) return json({ error: "Task not found" }, 404);
      if (!task.plan?.pr?.url) return json({ error: "No suggested update exists for this task yet" }, 400);
      try {
        const branch = `tiger-ai/task-${task.id.slice(0, 8)}`;
        const runs = await github(`commits/${encodeURIComponent(branch)}/check-runs?per_page=20`);
        const list = runs?.check_runs || [];
        const summary = {
          total: list.length,
          completed: list.filter((check: { status: string; conclusion: string | null }) => check.status === "completed").length,
          passed: list.filter((check: { status: string; conclusion: string | null }) => check.status === "completed" && check.conclusion === "success").length,
          failed: list.filter((check: { status: string; conclusion: string | null }) => check.status === "completed" && ["failure", "timed_out", "action_required"].includes(check.conclusion ?? "")).length,
          pending: list.filter((check: { status: string; conclusion: string | null }) => check.status !== "completed").length,
          runs: list.map((check: { name: string; status: string; conclusion: string | null; html_url: string }) => ({ name: check.name, status: check.status, conclusion: check.conclusion, url: check.html_url })),
          checked_at: new Date().toISOString(),
        };
        const verdict = summary.total === 0 ? "no_runs" : summary.pending > 0 ? "running" : summary.failed > 0 ? "failed" : "passed";
        await sb.from("dev_tasks").update({ plan: { ...task.plan, checks: { ...summary, verdict } }, updated_at: new Date().toISOString() }).eq("id", task.id);
        await sb.from("dev_audit_log").insert({ task_id: task.id, actor: "tiger_ai", action: `checks:${verdict}`, details: { title: task.title, passed: summary.passed, failed: summary.failed, total: summary.total } });
        return json({ checks: { ...summary, verdict } });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed to read check status" }, 502);
      }
    }

    if (body.action !== "triage") return json({ error: "Unknown action" }, 400);

    const { data: existing } = await sb.from("dev_tasks").select("source_report_id").not("source_report_id", "is", null);
    const done = new Set((existing || []).map((taskRow) => taskRow.source_report_id));
    const { data: reports } = await sb.from("reports").select("id, reason, target_type, contact_subject, created_at")
      .in("target_type", ["feedback", "recommendation"]).order("created_at", { ascending: false }).limit(40);
    const fresh = (reports || []).filter((report) => !done.has(report.id)).slice(0, 10);
    if (!fresh.length) return json({ created: 0 });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are Tiger AI's development planner for TIGERCHATS, a React + Lovable Cloud messaging app (chats, stories, calls, draughts, Tiger AI, Developer Panel). For each user feedback item return a dev task. Respond as JSON: {\"tasks\":[{\"report_id\":string,\"title\":string,\"summary\":string,\"category\":\"bug\"|\"feature\"|\"ux\"|\"performance\"|\"security\",\"priority\":\"low\"|\"medium\"|\"high\"|\"critical\",\"risk\":\"low\"|\"medium\"|\"high\",\"steps\":string[],\"areas\":string[],\"tests\":string[]}]}. Mark risk high for anything touching data deletion, payments, sign-in, permissions or private data. Skip spam by omitting it." },
          { role: "user", content: JSON.stringify(fresh.map((report) => ({ report_id: report.id, type: report.target_type, subject: report.contact_subject, text: report.reason }))) },
        ],
      }),
    });
    if (!aiRes.ok) return json({ error: `AI error ${aiRes.status}`, details: await aiRes.text() }, aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502);
    const ai = await aiRes.json();
    let tasks: Array<{ report_id: string; title: string; summary?: string; category?: string; priority?: string; risk?: string; steps?: string[]; areas?: string[]; tests?: string[] }> = [];
    try { tasks = JSON.parse(ai.choices?.[0]?.message?.content || "{}").tasks || []; } catch { tasks = []; }

    const ids = new Set(fresh.map((report) => report.id));
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
    await sb.from("dev_audit_log").insert((inserted || []).map((taskRow) => ({
      task_id: taskRow.id, actor: "tiger_ai", action: "task_planned", details: { title: taskRow.title },
    })));
    return json({ created: inserted?.length || 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
