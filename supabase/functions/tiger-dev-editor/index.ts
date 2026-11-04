import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.11";
import { checkCode } from "./policy.ts";

const REPO = "TigerChat-HQ/access-ace-friend";
const OWNER = "tiger_ai";
const schema = z.object({
  action: z.enum(["files", "read", "propose", "apply"]),
  path: z.string().max(240).optional(),
  task_id: z.string().uuid().optional(),
  proposal_id: z.string().uuid().optional(),
  content: z.string().max(60000).optional(),
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function github(path: string, method = "GET", body?: unknown) {
  const key = Deno.env.get("GITHUB_API_KEY");
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  if (!key || !lovable) throw new Error("GitHub connection is not configured");
  const response = await fetch(`https://connector-gateway.lovable.dev/github/repos/${REPO}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": key,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GitHub [${response.status}]: ${await response.text()}`);
  return response.status === 204 ? {} : response.json();
}

async function audit(db: ReturnType<typeof createClient>, event: string, details: Record<string, unknown>, taskId?: string | null) {
  const { error } = await db.from("dev_audit_log").insert({ task_id: taskId || null, actor: OWNER, action: event, details });
  if (error) throw error;
}

async function readFile(path: string) {
  if (!checkCode(path, "").allowed) throw new Error("This file is outside the authorized editor scope");
  const file = await github(`contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=main`);
  if (file.type !== "file" || file.size > 60000) throw new Error("Select a text file smaller than 60 KB");
  const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, "")), (c) => c.charCodeAt(0));
  return { path, sha: file.sha, content: new TextDecoder().decode(bytes) };
}

async function waitForChecks(sha: string, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let last: Array<Record<string, unknown>> = [];
  while (Date.now() < deadline) {
    const result = await github(`commits/${encodeURIComponent(sha)}/check-runs`);
    last = result.check_runs || [];
    if (last.length && last.every((check) => ["success", "neutral", "skipped"].includes(check.conclusion))) return { ok: true, checks: last };
    if (last.some((check) => ["failure", "cancelled", "timed_out", "action_required"].includes(check.conclusion))) return { ok: false, checks: last };
    await sleep(5000);
  }
  return { ok: false, timedOut: true, checks: last };
}

async function waitForDeployment(sha: string, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let runs: Array<Record<string, unknown>> = [];
  while (Date.now() < deadline) {
    const result = await github("actions/runs?branch=main&event=push&per_page=20");
    runs = (result.workflow_runs || []).filter((run) => run.head_sha === sha);
    const deploy = runs.find((run) => run.name === "Deploy TIGERCHATS Supabase");
    if (deploy && deploy.status === "completed") return { status: deploy.conclusion || "unknown", run: deploy };
    await sleep(5000);
  }
  return { status: runs.length ? "in_progress" : "not_found", run: runs[0] || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Editor service unavailable" }, 503);
    const db = createClient(url, serviceKey);
    const { data: user, error: authError } = await db.auth.getUser((req.headers.get("Authorization") || "").replace(/^Bearer /i, ""));
    if (authError || !user.user) return json({ error: "Sign in required" }, 401);
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", user.user.id);
    if (!roles?.some((r) => ["admin", "superior_admin"].includes(r.role))) return json({ error: "Administrator access required" }, 403);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid editor request" }, 400);
    const p = parsed.data;

    if (p.action === "files") {
      const tree = await github("git/trees/main?recursive=1");
      return json({ repo: REPO, autonomous: true, files: tree.tree.filter((f) => f.type === "blob" && checkCode(f.path, "").allowed).map((f) => f.path) });
    }
    if (p.action === "read") {
      if (!p.path) return json({ error: "File required" }, 400);
      const file = await readFile(p.path);
      await audit(db, "code_read", { path: p.path, sha: file.sha });
      return json(file);
    }
    if (p.action === "propose") {
      if (!p.task_id || !p.path) return json({ error: "Approved task and file required" }, 400);
      const { data: task } = await db.from("dev_tasks").select("*").eq("id", p.task_id).single();
      if (!task || !["approved", "in_progress"].includes(task.status)) return json({ error: "Approve this task before proposing code" }, 409);
      if (task.risk === "high") return json({ error: "High-risk changes require a separate reviewed engineering workflow" }, 403);
      const file = await readFile(p.path);
      let content = p.content;
      let summary = "Autonomous Tiger AI proposed change";
      if (content === undefined) {
        const result = await generateResponse({ model: "openai/gpt-6-astra", input: [
          { role: "system", content: "Propose a minimal change to the one authorized source file for the approved task. Preserve existing behavior. Never modify authentication, authorization, credentials, payment, deletion, private-data handling, audit controls, or deployment policy. Return JSON with exactly content (complete updated file string) and summary (short explanation). No markdown." },
          { role: "user", content: JSON.stringify({ task: { title: task.title, summary: task.summary, plan: task.plan }, file }) },
        ], text: { format: { type: "json_object" } } });
        const text = result.output.filter((item) => item.type === "message").flatMap((item) => item.content).filter((item) => item.type === "output_text").map((item) => item.text).join("");
        const generated = z.object({ content: z.string().max(60000), summary: z.string().max(2000) }).parse(JSON.parse(text));
        content = generated.content; summary = generated.summary;
      }
      if (content === file.content) return json({ error: "No code changes proposed" }, 400);
      const security = checkCode(p.path, content);
      if (!security.allowed) return json({ error: "Autonomous policy blocked this change", findings: security.findings }, 403);
      const { data: proposal, error } = await db.from("dev_code_proposals").insert({ task_id: task.id, path: p.path, base_sha: file.sha, original: file.content, proposed: content, summary, security, created_by: user.user.id }).select("*").single();
      if (error) throw error;
      await audit(db, "proposal_created", { proposal_id: proposal.id, path: p.path, summary }, task.id);
      return json({ proposal });
    }

    if (!p.proposal_id) return json({ error: "Proposal required" }, 400);
    const { data: proposal } = await db.from("dev_code_proposals").select("*").eq("id", p.proposal_id).single();
    if (!proposal) return json({ error: "Proposal not found" }, 404);
    const { data: task } = await db.from("dev_tasks").select("*").eq("id", proposal.task_id).single();
    if (!task || !["approved", "in_progress"].includes(task.status)) return json({ error: "Task approval is no longer valid" }, 409);
    if (task.risk === "high" || !checkCode(proposal.path, proposal.proposed).allowed) return json({ error: "Autonomous policy blocked this change" }, 403);
    const current = await readFile(proposal.path);
    if (current.sha !== proposal.base_sha) return json({ error: "Source changed; generate a new proposal" }, 409);
    const { data: claimed, error: claimError } = await db.from("dev_code_proposals").update({ status: "applying" }).eq("id", proposal.id).eq("status", "proposed").select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return json({ error: "Proposal already processed; inspect audit history" }, 409);

    const branch = `tiger-ai/${proposal.id}`;
    try {
      const ref = await github("git/ref/heads/main");
      await github("git/refs", "POST", { ref: `refs/heads/${branch}`, sha: ref.object.sha });
      const encoded = btoa(Array.from(new TextEncoder().encode(proposal.proposed), (byte) => String.fromCharCode(byte)).join(""));
      const commit = await github(`contents/${proposal.path}`, "PUT", { message: `Tiger AI: ${task.title}`, content: encoded, sha: proposal.base_sha, branch });
      const commitSha = commit.commit?.sha;
      await audit(db, "commit_created", { proposal_id: proposal.id, branch, commit_sha: commitSha, path: proposal.path }, task.id);
      const pr = await github("pulls", "POST", { title: `Tiger AI: ${task.title}`, head: branch, base: "main", draft: false, body: `Autonomous Tiger AI change.\n\nApproved task: ${task.id}\n\n${proposal.summary}\n\nPolicy screening passed. CI must pass before automatic merge.` });
      await db.from("dev_code_proposals").update({ branch, pr_url: pr.html_url, commit_sha: commitSha, pr_number: pr.number }).eq("id", proposal.id);
      await audit(db, "pull_request_opened", { proposal_id: proposal.id, pr_number: pr.number, pr_url: pr.html_url }, task.id);

      const checks = await waitForChecks(commitSha);
      await audit(db, "ci_completed", { proposal_id: proposal.id, commit_sha: commitSha, passed: checks.ok, timed_out: checks.timedOut || false, checks: checks.checks?.map((c) => ({ name: c.name, conclusion: c.conclusion })) }, task.id);
      if (!checks.ok) throw new Error(checks.timedOut ? "CI did not complete before the autonomous merge deadline" : "CI failed; autonomous merge was blocked");

      const merged = await github(`pulls/${pr.number}/merge`, "PUT", { merge_method: "squash", commit_title: `Tiger AI: ${task.title}` });
      if (!merged.merged) throw new Error(merged.message || "GitHub did not merge the pull request");
      await db.from("dev_code_proposals").update({ status: "merged", merged_at: new Date().toISOString(), merge_sha: merged.sha || null }).eq("id", proposal.id);
      await audit(db, "merged_to_main", { proposal_id: proposal.id, pr_number: pr.number, merge_sha: merged.sha || null }, task.id);

      const deployment = await waitForDeployment(merged.sha || commitSha);
      await db.from("dev_code_proposals").update({ deployment_status: deployment.status }).eq("id", proposal.id);
      await audit(db, "deployment_checked", { proposal_id: proposal.id, status: deployment.status, run_id: deployment.run?.id || null, run_url: deployment.run?.html_url || null }, task.id);
      await db.from("dev_tasks").update({ status: deployment.status === "failure" ? "in_progress" : "done", updated_at: new Date().toISOString() }).eq("id", task.id);
      return json({ autonomous: true, merged: true, pr_url: pr.html_url, branch, commit_sha: commitSha, merge_sha: merged.sha, deployment });
    } catch (error) {
      await db.from("dev_code_proposals").update({ status: "failed", branch }).eq("id", proposal.id);
      await audit(db, "autonomous_change_failed", { proposal_id: proposal.id, branch, error: error instanceof Error ? error.message : String(error) }, task.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof GatewayError) return json({ error: `AI suggestion failed: ${error.code}`, recovery: error.recovery }, error.httpStatus || 502);
    return json({ error: error instanceof Error ? error.message : "Editor failed" }, 500);
  }
});
