import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bug, RefreshCw, Loader2, Send, Database, CheckCircle2, AlertTriangle, Copy } from "lucide-react";

type Diagnostic = {
  id: string; source: string; severity: string; category: string; title: string;
  message: string | null; route: string | null; component_name: string | null;
  action_label: string | null; suggestion: string | null; status: string; created_at: string;
  stack?: string | null; metadata?: Record<string, unknown> | null;
};
const EXPECTED_TABLES = [
  "profiles","conversations","conversation_members","messages","stories","story_views",
  "posts","post_likes","post_comments","post_drafts","follows","reports","user_roles",
  "notifications","call_signals","call_logs","chat_preferences","chat_polls","chat_poll_options",
  "chat_poll_votes","message_reactions","pinned_messages","blocks","group_admins",
  "group_join_requests","announcements","announcement_dismissals","device_push_tokens",
  "push_subscriptions","comment_likes","post_analytics_events","reel_drafts",
  "draughts_admin_settings","draughts_badge_types","draughts_seasons","draughts_player_stats",
  "draughts_player_badges","draughts_match_results","draughts_match_moves","draughts_match_queue",
  "draughts_friend_challenges","draughts_match_emotes","draughts_clubs","draughts_club_members",
  "draughts_cosmetics","draughts_user_cosmetics","draughts_coin_ledger","draughts_wallets",
  "draughts_mission_catalog","draughts_mission_progress","draughts_pass_claims",
  "draughts_tournaments","draughts_tournament_entries","draughts_tournament_matches",
  "draughts_tournament_awards","draughts_achievement_catalog","draughts_user_achievements",
  "game_questions","game_attempts","quiz_question_history","tiger_ai_daily_posts",
  "tiger_ai_daily_post_likes","tiger_ai_daily_comments","tiger_ai_daily_comment_likes",
  "dev_tasks","dev_audit_log","trophies","user_trophies"
];

export const AdminDiagnostics = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [title, setTitle] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [schemaResults, setSchemaResults] = useState<{name:string;status:"ok"|"missing"|"error";detail?:string}[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is added by this PR migration; generated Supabase types are not refreshed yet.
    const { data, error } = await (supabase as any).from("app_diagnostics")
      .select("*").order("created_at", { ascending: false }).limit(100);
    if (error) toast({ title: "Diagnostics load failed", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Diagnostic[]);
    setLoading(false);
  }, [toast]);

  const record = useCallback(async (payload: Record<string, unknown>) => {
    const { data: { user } } = await supabase.auth.getUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is added by this PR migration; generated Supabase types are not refreshed yet.
    const { error } = await (supabase as any).from("app_diagnostics").insert({
      reporter_id: user?.id ?? null, ...payload,
    });
    if (error) console.error("Could not save diagnostic event:", error.message);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runSchemaCheck = async () => {
    setChecking(true);
    const results = await Promise.all(EXPECTED_TABLES.map(async (name) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table names are required for the schema registry scan.
      const { error } = await (supabase as any).from(name).select("*", { head: true, count: "exact" });
      if (!error) return { name, status: "ok" as const };
      const code = String(error.code ?? "");
      const msg = String(error.message ?? "");
      if (code === "42P01" || code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(msg)) {
        return { name, status: "missing" as const, detail: msg };
      }
      return { name, status: "error" as const, detail: msg };
    }));
    setSchemaResults(results);
    const missing = results.filter(x => x.status === "missing");
    const failures = results.filter(x => x.status === "error");
    for (const item of [...missing, ...failures]) {
      await record({
        source: "schema_check", severity: item.status === "missing" ? "critical" : "medium",
        category: "database", title: item.status === "missing" ? `Missing table: ${item.name}` : `Table check failed: ${item.name}`,
        message: item.detail ?? "Table is accessible.", route: window.location.pathname,
        suggestion: item.status === "missing" ? "Check the migration history and apply the missing table migration after review." : "Check RLS policies, grants and database connectivity."
      });
    }
    setChecking(false);
    await load();
    toast({ title: "Database check complete", description: `${results.length - missing.length - failures.length} OK · ${missing.length} missing · ${failures.length} access/errors` });
  };

  const submitSuggestion = async () => {
    if (!title.trim()) return;
    await record({
      source: "admin_suggestion", severity: "low", category: "recommendation",
      title: title.trim(), suggestion: suggestion.trim() || null,
      message: "Suggestion submitted by an administrator.", route: window.location.pathname
    });
    setTitle(""); setSuggestion("");
    toast({ title: "Recommendation saved" });
    await load();
  };

  const updateStatus = async (id: string, status: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is added by this PR migration; generated Supabase types are not refreshed yet.
    const { error } = await (supabase as any).from("app_diagnostics").update({
      status, resolved_at: status === "fixed" || status === "ignored" ? new Date().toISOString() : null
    }).eq("id", id);
    if (error) toast({ title: "Could not update issue", description: error.message, variant: "destructive" });
    else await load();
  };

  const copyAllErrors = async () => {
    const payload = items.map((item, index) => [
      `ERROR #${index + 1}`,
      `Title: ${item.title}`,
      `Severity: ${item.severity} | Category: ${item.category} | Source: ${item.source}`,
      `Status: ${item.status}`,
      `Date: ${new Date(item.created_at).toISOString()}`,
      `Route: ${item.route || "unknown"}`,
      `Component: ${item.component_name || "unknown"}`,
      `Action: ${item.action_label || "unknown"}`,
      `Message: ${item.message || "none"}`,
      `Suggestion: ${item.suggestion || "none"}`,
      `Stack: ${item.stack || "not available"}`,
      `Metadata: ${JSON.stringify(item.metadata || {})}`,
    ].join("\\n")).join("\\n\\n----------------------------------------\\n\\n");
    const output = `TigerChat Diagnostics export | ${items.length} records\\nExported: ${new Date().toISOString()}\\n\\n${payload}`;
    try {
      await navigator.clipboard.writeText(output);
      toast({ title: "All diagnostics copied", description: `${items.length} records copied. Paste them into ChatGPT.` });
    } catch {
      toast({ title: "Copy failed", description: "Allow clipboard access and try again.", variant: "destructive" });
    }
  };

  const visible = statusFilter === "all" ? items : items.filter(x => x.status === statusFilter);
  const missingCount = schemaResults.filter(x => x.status === "missing").length;
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Bug className="h-4 w-4 text-primary"/><h3 className="text-sm font-semibold">Admin Diagnostics Center</h3></div>
      <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}/>Refresh</Button>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Recorded issues</p><p className="text-xl font-bold">{items.length}</p></div>
      <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Open issues</p><p className="text-xl font-bold">{items.filter(x=>x.status==="new"||x.status==="investigating").length}</p></div>
    </div>
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2"><Database className="h-4 w-4"/> Database schema check</h4>
      <p className="text-xs text-muted-foreground">Checks the app's registered tables. Permission/RLS failures are reported separately from missing tables.</p>
      <Button size="sm" onClick={() => void runSchemaCheck()} disabled={checking}>{checking ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Database className="mr-1 h-4 w-4"/>}Scan database tables</Button>
      {schemaResults.length > 0 && <div className="space-y-1 text-xs">
        <p className="text-muted-foreground">{schemaResults.length-missingCount-schemaResults.filter(x=>x.status==="error").length} passed · {missingCount} missing · {schemaResults.filter(x=>x.status==="error").length} access/errors</p>
        {schemaResults.filter(x=>x.status!=="ok").map(x=><div key={x.name} className="rounded border border-border p-2"><div className="flex justify-between gap-2"><span className="font-mono">{x.name}</span><Badge variant={x.status==="missing"?"destructive":"secondary"}>{x.status}</Badge></div>{x.detail && <p className="mt-1 break-words text-muted-foreground">{x.detail}</p>}</div>)}
      </div>}
      {schemaResults.length > 0 && missingCount === 0 && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>No missing tables detected in the registered table list.</p>}
    </div>
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h4 className="text-sm font-semibold">Add recommendation / report an issue</h4>
      <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Issue or recommendation title"/>
      <Textarea value={suggestion} onChange={e=>setSuggestion(e.target.value)} placeholder="Describe the problem or suggested fix..." rows={3}/>
      <Button size="sm" onClick={() => void submitSuggestion()} disabled={!title.trim()}><Send className="mr-1 h-3.5 w-3.5"/>Save report</Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold">Issue log ({visible.length})</h4><Button size="sm" variant="outline" onClick={() => void copyAllErrors()} disabled={items.length === 0}><Copy className="mr-1 h-3.5 w-3.5"/>Copy all errors ({items.length})</Button></div>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs"><option value="all">All statuses</option><option value="new">New</option><option value="investigating">Investigating</option><option value="fixed">Fixed</option><option value="ignored">Ignored</option></select>
    </div>
    {visible.map(item=><article key={item.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1"><Badge variant={item.severity==="critical"||item.severity==="high"?"destructive":"secondary"}>{item.severity}</Badge><Badge variant="outline">{item.category}</Badge><Badge>{item.status}</Badge></div>
      <p className="text-sm font-semibold">{item.title}</p>
      {item.message && <p className="text-xs text-muted-foreground break-words">{item.message}</p>}
      <p className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString()} · {item.route ?? "unknown route"}{item.action_label ? ` · Click: ${item.action_label}` : ""}</p>
      {item.component_name && <p className="text-xs">Component: {item.component_name}</p>}
      {item.suggestion && <p className="text-xs text-primary">Recommendation: {item.suggestion}</p>}
      <div className="flex flex-wrap gap-1">{["new","investigating","fixed","ignored"].filter(s=>s!==item.status).map(s=><Button key={s} size="sm" variant="outline" onClick={()=>void updateStatus(item.id,s)}>{s}</Button>)}</div>
    </article>)}
    {visible.length===0 && <p className="text-xs text-muted-foreground">{loading?"Loading diagnostics…":"No issues recorded for this filter."}</p>}
    <p className="text-[11px] text-muted-foreground flex items-start gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0"/>Global browser errors, rejected promises, and explicitly reported feature/API failures are collected across the app. Copy all errors exports the loaded diagnostics, including stack traces and safe metadata.</p>
  </section>;
};
