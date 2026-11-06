import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bot, Sparkles, GitPullRequest, ShieldCheck, Loader2, Rocket, RotateCcw, ExternalLink, GitBranch, RefreshCw } from "lucide-react";

type TaskPlan = {
  steps?: string[];
  tests?: string[];
  pr?: { url?: string; number?: number; files?: string[] };
  checks?: {
    verdict?: "passed" | "failed" | "running" | "no_runs" | string;
    total?: number;
    passed?: number;
    failed?: number;
    pending?: number;
    checked_at?: string;
    runs?: Array<{ name: string; status: string; conclusion?: string | null; url?: string | null }>;
  };
};

type Task = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  priority: string;
  risk: string;
  status: string;
  plan: TaskPlan | null;
  created_at: string;
};

type AuditEntry = {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  details: { title?: string; url?: string } | null;
};

type GitHubPullRequest = { number: number; title: string; url: string; draft: boolean; head_branch: string; updated_at: string; user?: string; };
type PlannerResponse = {
  created?: number;
  pr?: { url?: string; number?: number; files?: string[] };
  checks?: { verdict?: string };
  pull_requests?: GitHubPullRequest[];
  write_enabled?: boolean;
  default_branch?: string;
  error?: string;
};

const NEXT: Record<string, string[]> = {
  planned: ["approved", "rejected"],
  approved: ["in_progress", "rejected"],
  in_progress: ["done"],
  done: [],
  rejected: ["planned"],
};

const REPO_ACTIONS = "https://github.com/TigerChat-HQ/access-ace-friend/actions";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "An unexpected error occurred.";

export const TigerCommandCenter = () => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [githubWriteEnabled, setGithubWriteEnabled] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const load = useCallback(async () => {
    const [{ data: taskData, error: taskError }, { data: auditData, error: auditError }] = await Promise.all([
      supabase.from("dev_tasks").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("dev_audit_log").select("*").order("created_at", { ascending: false }).limit(15),
    ]);

    if (taskError || auditError) {
      toast({
        title: "Could not refresh command center",
        description: taskError?.message ?? auditError?.message,
        variant: "destructive",
      });
      return;
    }

    setTasks((taskData as Task[] | null) ?? []);
    setAudit((auditData as AuditEntry[] | null) ?? []);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const call = async (body: Record<string, unknown>): Promise<PlannerResponse> => {
    const { data, error } = await supabase.functions.invoke("tiger-dev-planner", { body });
    if (error) throw new Error(error.message);
    return (data ?? {}) as PlannerResponse;
  };

  const refreshGitHub = useCallback(async () => {
    setGithubLoading(true);
    try {
      const result = await call({ action: "github_list_prs" });
      setPullRequests(result.pull_requests ?? []);
      setGithubWriteEnabled(Boolean(result.write_enabled));
    } catch (error: unknown) {
      toast({ title: "GitHub refresh failed", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setGithubLoading(false);
    }
  }, [toast]);

  useEffect(() => { void refreshGitHub(); }, [refreshGitHub]);

  const triage = async () => {
    setBusy(true);
    try {
      const result = await call({ action: "triage" });
      toast({ title: result.created ? `Tiger AI planned ${result.created} new task(s)` : "No new feedback to plan" });
      await load();
    } catch (error: unknown) {
      toast({ title: "Planning failed", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await call({ action: "set_status", id, status });
      await load();
    } catch (error: unknown) {
      toast({ title: "Update failed", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const [drafting, setDrafting] = useState<string | null>(null);
  const proposeCode = async (id: string) => {
    setDrafting(id);
    try {
      const result = await call({ action: "propose_code", id });
      toast({ title: "Suggested update ready", description: "Review it on GitHub before merging." });
      if (result.pr?.url) window.open(result.pr.url, "_blank", "noopener,noreferrer");
      await load();
    } catch (error: unknown) {
      toast({ title: "Tiger AI couldn't draft the change", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setDrafting(null);
    }
  };

  const [checking, setChecking] = useState<string | null>(null);
  const checkStatus = async (id: string) => {
    setChecking(id);
    try {
      const result = await call({ action: "check_status", id });
      const verdict = result.checks?.verdict;
      const message = verdict === "passed" ? "All tests and security checks passed."
        : verdict === "failed" ? "Some checks failed — open the update on GitHub for details."
        : verdict === "running" ? "Checks are still running on GitHub."
        : "No checks have run yet — they start when the update is opened on GitHub.";
      toast({ title: "Check status", description: message, variant: verdict === "failed" ? "destructive" : "default" });
      await load();
    } catch (error: unknown) {
      toast({ title: "Couldn't read check status", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setChecking(null);
    }
  };

  const riskVariant = (risk: string): "destructive" | "secondary" | "outline" =>
    risk === "high" ? "destructive" : risk === "medium" ? "secondary" : "outline";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-primary" /> Tiger AI Command Center
        </h2>
        <Button size="sm" onClick={triage} disabled={busy}>
          <Sparkles className="w-3.5 h-3.5 mr-1" /> {busy ? "Planning…" : "Plan from feedback"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          "Task manager & planner",
          "Audit history",
          "Code connection",
          "Tests & security checks",
          "Publishing & undo",
        ].map((name) => (
          <div key={name} className="bg-card border border-border/50 rounded-lg p-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-foreground">{name}</span>
          </div>
        ))}
      </div>


      <div className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> GitHub — access-ace-friend</h3>
          <Button size="sm" variant="outline" onClick={refreshGitHub} disabled={githubLoading}>
            {githubLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Refresh
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Badge variant="secondary">Live repository data</Badge>
          <Badge variant={githubWriteEnabled ? "default" : "outline"}>{githubWriteEnabled ? "GITHUB_TOKEN configured" : "Read-only — write token missing"}</Badge>
        </div>
        {!githubWriteEnabled && <p className="text-[11px] text-muted-foreground">TIGERCHAT can read open pull requests and CI status. To let Tiger AI prepare code-fix branches and draft PRs, configure the GITHUB_TOKEN Edge Function secret with Contents and Pull requests read/write permissions. The token stays server-side.</p>}
        {pullRequests.length === 0 ? <p className="text-xs text-muted-foreground">No open pull requests found, or refresh to retry.</p> : (
          <div className="space-y-1.5">{pullRequests.map((pr) => (
            <div key={pr.number} className="flex items-start justify-between gap-2 rounded-md border border-border/40 p-2">
              <div className="min-w-0"><p className="text-xs font-medium text-foreground">#{pr.number} · {pr.title}</p><p className="text-[10px] text-muted-foreground">{pr.head_branch} → main · {pr.draft ? "Draft" : "Ready for review"} · {new Date(pr.updated_at).toLocaleString()}</p></div>
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-primary underline">Open <ExternalLink className="inline w-3 h-3" /></a>
            </div>
          ))}</div>
        )}
      </div>
      <div className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
        <h3 className="text-xs font-semibold text-foreground">Publishing & undo</h3>
        <p className="text-xs text-muted-foreground">
          Prepare a verified draft release or a reviewed rollback pull request. Neither workflow merges code or deploys production.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`${REPO_ACTIONS}/workflows/prepare-publish.yml`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
            <Rocket className="w-3.5 h-3.5 mr-1" /> Prepare release <ExternalLink className="w-3 h-3 ml-1" />
          </a>
          <a href={`${REPO_ACTIONS}/workflows/prepare-rollback-pr.yml`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Prepare rollback <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Release workflow runs typecheck, tests, lint and production build before creating a draft GitHub release. An authorized maintainer must review and publish it. Rollback creates a separate revert PR for human review.
        </p>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet. Tap “Plan from feedback”.</p>}
        {tasks.map((task) => (
          <div key={task.id} className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
            <button className="w-full text-left" onClick={() => setOpen(open === task.id ? null : task.id)}>
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline">{task.category}</Badge>
                <Badge variant="secondary">{task.priority}</Badge>
                <Badge variant={riskVariant(task.risk)}>risk: {task.risk}</Badge>
                <Badge>{task.status.replace("_", " ")}</Badge>
              </div>
            </button>
            {open === task.id && (
              <div className="text-xs text-muted-foreground space-y-2">
                {task.summary && <p>{task.summary}</p>}
                {task.plan?.steps && task.plan.steps.length > 0 && (
                  <ol className="list-decimal pl-4 space-y-0.5">{task.plan.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                )}
                {task.plan?.tests && task.plan.tests.length > 0 && <p><span className="text-foreground">Tests:</span> {task.plan.tests.join("; ")}</p>}
                {task.risk === "high" && <p className="text-destructive">Protected change — needs your explicit approval.</p>}
              </div>
            )}
            {task.plan?.pr?.url && (
              <a href={task.plan.pr.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
                <GitPullRequest className="w-3.5 h-3.5" /> Review suggested update #{task.plan.pr.number} ({task.plan.pr.files?.length ?? 0} files)
              </a>
            )}
            {task.plan?.checks && (
              <div className="text-xs flex items-center gap-1.5">
                <ShieldCheck className={`w-3.5 h-3.5 ${task.plan.checks.verdict === "passed" ? "text-primary" : task.plan.checks.verdict === "failed" ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-muted-foreground">
                  Checks: {task.plan.checks.verdict === "no_runs" ? "not run yet" : task.plan.checks.verdict}
                  {(task.plan.checks.total ?? 0) > 0 && ` · ${task.plan.checks.passed ?? 0}/${task.plan.checks.total} passed`}
                  {task.plan.checks.checked_at && ` · ${new Date(task.plan.checks.checked_at).toLocaleString()}`}
                </span>
              </div>
            )}
            {task.plan?.checks?.runs && task.plan.checks.runs.length > 0 && (
              <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                {task.plan.checks.runs.map((run, index) => (
                  <li key={`${run.name}-${index}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">{run.name} · {run.status}{run.conclusion ? ` / ${run.conclusion}` : ""}</span>
                    {run.url && <a href={run.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary underline">Logs</a>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-1">
              {["approved", "in_progress"].includes(task.status) && !task.plan?.pr?.url && (
                <Button size="sm" onClick={() => proposeCode(task.id)} disabled={drafting !== null}>
                  <GitPullRequest className="w-3.5 h-3.5 mr-1" /> {drafting === task.id ? "Writing code…" : "Draft code change"}
                </Button>
              )}
              {task.plan?.pr?.url && (
                <Button size="sm" variant="outline" onClick={() => checkStatus(task.id)} disabled={checking !== null}>
                  {checking === task.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1" />}
                  {checking === task.id ? "Checking…" : "Check tests"}
                </Button>
              )}
              {NEXT[task.status]?.map((status) => (
                <Button key={status} size="sm" variant={status === "rejected" ? "outline" : "secondary"} onClick={() => setStatus(task.id, status)}>
                  {status.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {audit.length > 0 && (
        <div>
          <h3 className="text-xs text-muted-foreground font-semibold mb-1">Audit history</h3>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {audit.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.created_at).toLocaleString()} · {entry.actor === "tiger_ai" ? "Tiger AI" : "Admin"} · {entry.action}
                {entry.details?.title ? ` — ${entry.details.title}` : ""}
                {entry.details?.url && <> · <a className="text-primary underline" href={entry.details.url} target="_blank" rel="noopener noreferrer">view</a></>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
