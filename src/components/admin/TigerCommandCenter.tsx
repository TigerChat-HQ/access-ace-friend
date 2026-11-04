import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, Sparkles, RefreshCw, ListTodo, History, Code2, Plus, ChevronDown, ChevronUp, ShieldCheck, ExternalLink, Upload } from "lucide-react";
import { TigerDeveloperEditor } from "./TigerDeveloperEditor";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";

type TaskPlan = { steps?: string[]; tests?: string[] };
type Task = Tables<"dev_tasks"> & { plan: TaskPlan | null };
type Audit = Tables<"dev_audit_log">;

const NEXT: Record<string, string[]> = {
  planned: ["approved", "rejected"], approved: ["in_progress", "rejected"],
  in_progress: ["done"], done: [], rejected: ["planned"],
};

export const TigerCommandCenter = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"tasks" | "audit" | "developer">("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("feature");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t, error: te }, { data: a, error: ae }] = await Promise.all([
      supabase.from("dev_tasks").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("dev_audit_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (te || ae) {
      const description = te?.message || ae?.message || "Command Center tables are not available yet.";
      toast({ title: "Command Center unavailable", description, variant: "destructive" });
    }
    setTasks((t as Task[]) || []);
    setAudit((a as Audit[]) || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("tiger-dev-planner", { body });
    if (error) {
      const detail = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const createTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await call({ action: "create_task", title: title.trim(), summary: summary.trim(), category });
      setTitle(""); setSummary(""); setCategory("feature"); setShowCreate(false);
      toast({ title: "Task created", description: "Task added to the development plan." });
      await load();
    } catch (err: unknown) {
      toast({ title: "Task creation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const triage = async () => {
    setBusy(true);
    try {
      const r = await call({ action: "triage" });
      toast({ title: r.created ? `Tiger AI planned ${r.created} new task(s)` : "No new feedback to plan" });
      await load();
    } catch (err: unknown) { toast({ title: "Planning failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await call({ action: "set_status", id, status }); await load(); }
    catch (err: unknown) { toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }); }
  };

  const openGitHub = (path = "") => {
    window.open(`https://github.com/TigerChat-HQ/access-ace-friend${path}`, "_blank", "noopener,noreferrer");
  };

  const riskVariant = (risk: string): "destructive" | "secondary" | "outline" => risk === "high" ? "destructive" : risk === "medium" ? "secondary" : "outline";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Tiger AI Command Center</h2>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => setTab("tasks")} className="rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex items-center gap-2 text-sm font-medium"><ListTodo className="w-4 h-4 text-primary" /> Task manager & planner</span>
          <span className="mt-1 block text-xs text-muted-foreground">Create, review, and move development tasks through their workflow.</span>
        </button>
        <button type="button" onClick={() => setTab("audit")} className="rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex items-center gap-2 text-sm font-medium"><History className="w-4 h-4 text-primary" /> Audit history</span>
          <span className="mt-1 block text-xs text-muted-foreground">Open the recent activity log for Command Center actions.</span>
        </button>
        <button type="button" onClick={() => openGitHub()} className="rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex items-center gap-2 text-sm font-medium"><Code2 className="w-4 h-4 text-primary" /> Code connection <ExternalLink className="w-3.5 h-3.5 ml-auto" /></span>
          <span className="mt-1 block text-xs text-muted-foreground">Open the connected TigerChat-HQ GitHub repository.</span>
        </button>
        <button type="button" onClick={() => openGitHub("/actions")} className="rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="w-4 h-4 text-primary" /> Tests & security checks <ExternalLink className="w-3.5 h-3.5 ml-auto" /></span>
          <span className="mt-1 block text-xs text-muted-foreground">Open GitHub Actions to run and inspect repository checks.</span>
        </button>
        <button type="button" onClick={() => openGitHub("/releases")} className="rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:col-span-2">
          <span className="flex items-center gap-2 text-sm font-medium"><Upload className="w-4 h-4 text-primary" /> Publishing & undo <ExternalLink className="w-3.5 h-3.5 ml-auto" /></span>
          <span className="mt-1 block text-xs text-muted-foreground">Open GitHub releases to publish or review versions and rollback options.</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant={tab === "tasks" ? "default" : "outline"} onClick={() => setTab("tasks")}><ListTodo className="w-4 h-4 mr-1" /> Tasks ({tasks.length})</Button>
        <Button size="sm" variant={tab === "audit" ? "default" : "outline"} onClick={() => setTab("audit")}><History className="w-4 h-4 mr-1" /> Audit</Button>
        <Button size="sm" variant={tab === "developer" ? "default" : "outline"} onClick={() => setTab("developer")}><Code2 className="w-4 h-4 mr-1" /> Developer</Button>
      </div>

      {tab === "tasks" && <>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowCreate(v => !v)}><Plus className="w-4 h-4 mr-1" /> New task</Button>
          <Button size="sm" variant="secondary" onClick={() => void triage()} disabled={busy}><Sparkles className="w-4 h-4 mr-1" /> {busy ? "Working…" : "Plan from feedback"}</Button>
        </div>
        {showCreate && <form onSubmit={createTask} className="rounded-lg border border-border p-3 space-y-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" maxLength={200} required />
          <Textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="Describe what needs to be done" maxLength={2000} />
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="feature">Feature</option><option value="bug">Bug</option><option value="ux">User experience</option><option value="performance">Performance</option><option value="security">Security</option>
          </select>
          <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Create task"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button></div>
        </form>}
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet. Create a task or plan from user feedback.</p>}
        <div className="space-y-2">
          {tasks.map(task => <article key={task.id} className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
            <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen(open === task.id ? null : task.id)}>
              <span className="min-w-0"><span className="block text-sm font-medium">{task.title}</span><span className="mt-1 flex flex-wrap gap-1"><Badge variant="outline">{task.category}</Badge><Badge variant="secondary">{task.priority}</Badge><Badge variant={riskVariant(task.risk)}>risk: {task.risk}</Badge><Badge>{task.status.replace("_", " ")}</Badge></span></span>
              {open === task.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {open === task.id && <div className="space-y-2 text-xs text-muted-foreground">
              {task.summary && <p>{task.summary}</p>}
              {task.plan?.steps?.length > 0 && <ol className="list-decimal pl-4 space-y-1">{task.plan.steps.map((step: string, i: number) => <li key={i}>{step}</li>)}</ol>}
              {task.plan?.tests?.length > 0 && <p><strong className="text-foreground">Suggested tests:</strong> {task.plan.tests.join("; ")}</p>}
              {task.risk === "high" && <p className="text-destructive">High-risk change: requires explicit human review.</p>}
            </div>}
            <div className="flex flex-wrap gap-1">{(NEXT[task.status] || []).map(status => <Button key={status} size="sm" variant={status === "rejected" ? "outline" : "secondary"} onClick={() => void setStatus(task.id, status)}>{status.replace("_", " ")}</Button>)}</div>
          </article>)}
        </div>
      </>}

      {tab === "audit" && <div className="space-y-2">
        <h3 className="text-sm font-medium">Recent activity</h3>
        {audit.length === 0 && <p className="text-sm text-muted-foreground">No audit events yet.</p>}
        {audit.map(item => <div key={item.id} className="rounded-md border border-border/60 p-2 text-xs">
          <p className="font-medium">{item.action.replace(/_/g, " ")}</p>
          <p className="text-muted-foreground">{item.details?.title || "Command Center event"} · {item.actor === "tiger_ai" ? "Tiger AI" : "Admin"} · {new Date(item.created_at).toLocaleString()}</p>
        </div>)}
      </div>}

      {tab === "developer" && <TigerDeveloperEditor tasks={tasks} onChanged={load} />}
    </section>
  );
};
