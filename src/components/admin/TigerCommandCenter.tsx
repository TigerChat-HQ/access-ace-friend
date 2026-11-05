import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bot, Sparkles, Lock } from "lucide-react";

type Task = {
  id: string; title: string; summary: string | null; category: string; priority: string;
  risk: string; status: string; plan: any; created_at: string;
};

const NEXT: Record<string, string[]> = {
  planned: ["approved", "rejected"], approved: ["in_progress", "rejected"], in_progress: ["done"], done: [], rejected: ["planned"],
};

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
          ["Code connection", false], ["Tests & security checks", false],
          ["Publishing & undo", false],
        ].map(([n, on]) => (
          <div key={n as string} className="bg-card border border-border/50 rounded-lg p-2 flex items-center gap-1.5">
            {on ? <span className="w-2 h-2 rounded-full bg-primary" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
            <span className={on ? "text-foreground" : "text-muted-foreground"}>{n as string}{on ? "" : " — needs GitHub"}</span>
          </div>
        ))}
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
            <div className="flex flex-wrap gap-1">
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
              <li key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.actor === "tiger_ai" ? "Tiger AI" : "Admin"} · {a.action}{a.details?.title ? ` — ${a.details.title}` : ""}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
