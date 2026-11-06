import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bot, Sparkles, GitPullRequest, ShieldCheck, Loader2, Rocket, RotateCcw, ExternalLink } from "lucide-react";

type Task = {
  id: string; title: string; summary: string | null; category: string; priority: string;
  risk: string; status: string; plan: any; created_at: string;
};

const NEXT: Record<string, string[]> = {
  planned: ["approved", "rejected"], approved: ["in_progress", "rejected"], in_progress: ["done"], done: [], rejected: ["planned"],
};

const REPO_ACTIONS = "https://github.com/TigerChat-HQ/access-ace-friend/actions";

export const TigerCommandCenter = () => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from("dev_tasks").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("dev_audit_log").select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    setTasks((t as Task[]) || []);
    setAudit(a || []);
  };
  useEffect(() => { load(); }, []);

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("tiger-dev-planner", { body });
    if (error) {
      const d = (error as any).context?.text ? await (error as any).context.text() : error.message;
      throw new Error(d);
    }
    return data;
  };

  const triage = async () => {
    setBusy(true);
    try {
      const r = await call({ action: "triage" });
      toast({ title: r.created ? `Tiger AI planned ${r.created} new task(s)` : "No new feedback to plan" });
      load();
    } catch (e: any) { toast({ title: "Planning failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await call({ action: "set_status", id, status }); load(); }
    catch (e: any) { toast({ title: "Update failed", description: e.message, variant: "destructive" }); }
  };

  const [drafting, setDrafting] = useState<string | null>(null);
  const proposeCode = async (id: string) => {
    setDrafting(id);
    try {
      const r = await call({ action: "propose_code", id });
      toast({ title: "Suggested update ready", description: "Review it on GitHub before merging." });
      if (r?.pr?.url) window.open(r.pr.url, "_blank", "noopener");
      load();
    } catch (e: any) { toast({ title: "Tiger AI couldn't draft the change", description: e.message, variant: "destructive" }); }
    finally { setDrafting(null); }
  };

  const [checking, setChecking] = useState<string | null>(null);
  const checkStatus = async (id: string) => {
    setChecking(id);
    try {
      const r = await call({ action: "check_status", id });
      const v = r?.checks?.verdict;
      const msg = v === "passed" ? "All tests and security checks passed."
        : v === "failed" ? "Some checks failed — open the update on GitHub for details."
        : v === "running" ? "Checks are still running on GitHub."
        : "No checks have run yet — they start when the update is opened on GitHub.";
      toast({ title: "Check status", description: msg, variant: v === "failed" ? "destructive" : "default" });
      load();
    } catch (e: any) { toast({ title: "Couldn't read check status", description: e.message, variant: "destructive" }); }
    finally { setChecking(null); }
  };

  const riskVariant = (r: string) => (r === "high" ? "destructive" : r === "medium" ? "secondary" : "outline") as any;

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
          ["Task manager & planner", true], ["Audit history", true],
          ["Code connection", true], ["Tests & security checks", true],
          ["Publishing & undo", true],
        ].map(([n, on]) => (
          <div key={n as string} className="bg-card border border-border/50 rounded-lg p-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-foreground">{n as string}</span>
          </div>
        ))}
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
        {tasks.map((t) => (
          <div key={t.id} className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
            <button className="w-full text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline">{t.category}</Badge>
                <Badge variant="secondary">{t.priority}</Badge>
                <Badge variant={riskVariant(t.risk)}>risk: {t.risk}</Badge>
                <Badge>{t.status.replace("_", " ")}</Badge>
              </div>
            </button>
            {open === t.id && (
              <div className="text-xs text-muted-foreground space-y-2">
                {t.summary && <p>{t.summary}</p>}
                {t.plan?.steps?.length > 0 && (
                  <ol className="list-decimal pl-4 space-y-0.5">{t.plan.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
                )}
                {t.plan?.tests?.length > 0 && <p><span className="text-foreground">Tests:</span> {t.plan.tests.join("; ")}</p>}
                {t.risk === "high" && <p className="text-destructive">Protected change — needs your explicit approval.</p>}
              </div>
            )}
            {t.plan?.pr?.url && (
              <a href={t.plan.pr.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
                <GitPullRequest className="w-3.5 h-3.5" /> Review suggested update #{t.plan.pr.number} ({t.plan.pr.files?.length || 0} files)
              </a>
            )}
            {t.plan?.checks && (
              <div className="text-xs flex items-center gap-1.5">
                <ShieldCheck className={`w-3.5 h-3.5 ${t.plan.checks.verdict === "passed" ? "text-primary" : t.plan.checks.verdict === "failed" ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-muted-foreground">
                  Checks: {t.plan.checks.verdict === "no_runs" ? "not run yet" : t.plan.checks.verdict}
                  {t.plan.checks.total > 0 && ` · ${t.plan.checks.passed}/${t.plan.checks.total} passed`}
                  {t.plan.checks.checked_at && ` · ${new Date(t.plan.checks.checked_at).toLocaleString()}`}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {["approved", "in_progress"].includes(t.status) && !t.plan?.pr?.url && (
                <Button size="sm" onClick={() => proposeCode(t.id)} disabled={drafting !== null}>
                  <GitPullRequest className="w-3.5 h-3.5 mr-1" /> {drafting === t.id ? "Writing code…" : "Draft code change"}
                </Button>
              )}
              {t.plan?.pr?.url && (
                <Button size="sm" variant="outline" onClick={() => checkStatus(t.id)} disabled={checking !== null}>
                  {checking === t.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1" />}
                  {checking === t.id ? "Checking…" : "Check tests"}
                </Button>
              )}
              {NEXT[t.status]?.map((s) => (
                <Button key={s} size="sm" variant={s === "rejected" ? "outline" : "secondary"} onClick={() => setStatus(t.id, s)}>
                  {s.replace("_", " ")}
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
            {audit.map((a) => (
              <li key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.actor === "tiger_ai" ? "Tiger AI" : "Admin"} · {a.action}{a.details?.title ? ` — ${a.details.title}` : ""}{a.details?.url && <> · <a className="text-primary underline" href={a.details.url} target="_blank" rel="noopener noreferrer">view</a></>}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
