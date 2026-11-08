import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bot, Sparkles, GitPullRequest, ShieldCheck, Loader2, Rocket, RotateCcw, ExternalLink, GitBranch, RefreshCw, Send, Trash2, Terminal, Code2, FileCode, Check, Copy } from "lucide-react";

type TaskPlan = {
  steps?: string[];
  tests?: string[];
  areas?: string[];
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  inspected_file?: string | null;
};

export const TigerCommandCenter = () => {
  const { toast } = useToast();
  // Tiger AI Dev Interactive Chat State
  const [devMessages, setDevMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("tiger_dev_chat_history");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "intro",
        role: "assistant",
        content: "Habari Bosi Maximo! 🐯🛠️\n\nMimi ni Tiger AI Dev Assistant wako hapa Command Center. Niko tayari kukusaidia kukagua kodi za TIGERCHAT, kuelekeza mabadiliko ya GitHub, kutatua bugs (kama WebRTC calls au Drafts game), na kuandika code diffs.\n\nNiambie unahitaji nisaidie nini leo?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });
  const [inputPrompt, setInputPrompt] = useState("");
  const [inspectFile, setInspectFile] = useState<string>("");
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("tiger_dev_chat_history", JSON.stringify(devMessages));
    } catch {}
  }, [devMessages]);

  const sendDevMessage = async (customText?: string) => {
    const textToSend = (customText ?? inputPrompt).trim();
    if (!textToSend || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextMessages = [...devMessages, userMsg];
    setDevMessages(nextMessages);
    if (!customText) setInputPrompt("");
    setChatLoading(true);

    try {
      const payload: Record<string, unknown> = {
        action: "dev_chat",
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      };
      if (inspectFile.trim()) {
        payload.inspect_file = inspectFile.trim();
      }

      const { data, error } = await supabase.functions.invoke("tiger-dev-planner", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply || "Nimepokea maelekezo yako.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        inspected_file: data.inspected_file,
      };
      setDevMessages([...nextMessages, assistantMsg]);
    } catch (err: unknown) {
      const errMessage = getErrorMessage(err);
      toast({ title: "Tiger AI error", description: errMessage, variant: "destructive" });
      const errReply: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Samahani Bosi Maximo, nimekutana na hitilafu: ${errMessage}. Tafadhali jaribu tena.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setDevMessages([...nextMessages, errReply]);
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    const reset: ChatMessage[] = [
      {
        id: "intro",
        role: "assistant",
        content: "Mazungumzo yamefutwa. Nipo tayari kwa kazi mpya, Bosi Maximo! 🐯",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
    setDevMessages(reset);
    localStorage.removeItem("tiger_dev_chat_history");
  };

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [githubWriteEnabled, setGithubWriteEnabled] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [githubUpdatedAt, setGithubUpdatedAt] = useState<string | null>(null);
  const [fileTargets, setFileTargets] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [{ data: taskData, error: taskError }, { data: auditData, error: auditError }] = await Promise.all([
        supabase.from("dev_tasks").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("dev_audit_log").select("*").order("created_at", { ascending: false }).limit(15),
      ]);
      if (taskError || auditError) throw new Error(taskError?.message ?? auditError?.message ?? "Database refresh failed");
      setTasks((taskData as Task[] | null) ?? []);
      setAudit((auditData as AuditEntry[] | null) ?? []);
    } catch (error: unknown) {
      toast({ title: "Could not refresh command center", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const call = useCallback(async (body: Record<string, unknown>): Promise<PlannerResponse> => {
    const { data, error } = await supabase.functions.invoke("tiger-dev-planner", { body });
    if (error) {
      const context = (error as { context?: unknown }).context;
      let detail = error.message;
      if (context instanceof Response) {
        const payload = await context.clone().json().catch(() => null) as {
          error?: string;
          message?: string;
          received_action?: string | null;
          normalized_action?: string | null;
          supported_actions?: string[];
        } | null;
        const actionDetail = payload?.received_action
          ? ` (received action: "${payload.received_action}"${payload.normalized_action ? `, normalized: "${payload.normalized_action}"` : ""})`
          : "";
        const supportedDetail = payload?.supported_actions?.length
          ? ` Supported actions: ${payload.supported_actions.join(", ")}.`
          : "";
        detail = `${payload?.error || payload?.message || `Edge Function returned HTTP ${context.status}`}${actionDetail}${supportedDetail}`;
      }
      throw new Error(detail);
    }
    return (data ?? {}) as PlannerResponse;
  }, []);

  const refreshGitHub = useCallback(async () => {
    setGithubLoading(true);
    try {
      const result = await call({ action: "github_list_prs" });
      if (result.error) throw new Error(result.error);
      if (!Array.isArray(result.pull_requests)) throw new Error("GitHub returned an invalid pull-request response.");
      setPullRequests(result.pull_requests);
      setGithubWriteEnabled(Boolean(result.write_enabled));
      setGithubError(null);
      setGithubUpdatedAt(new Date().toISOString());
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setGithubError(message);
      toast({ title: "GitHub refresh failed", description: message, variant: "destructive" });
    } finally {
      setGithubLoading(false);
    }
  }, [call, toast]);

  useEffect(() => { void refreshGitHub(); }, [refreshGitHub]);

  // One refresh action must update every Command Center data source, not only GitHub.
  const refreshAll = useCallback(async () => {
    await Promise.all([load(), refreshGitHub()]);
  }, [load, refreshGitHub]);

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
  const saveTargetFiles = async (id: string) => {
    const files = (fileTargets[id] ?? "").split(",").map((path) => path.trim()).filter(Boolean);
    try {
      await call({ action: "set_task_files", id, files });
      setFileTargets((current) => ({ ...current, [id]: files.join(", ") }));
      toast({ title: "GitHub source files saved", description: "Tiger AI will only edit these selected files." });
      await load();
    } catch (error: unknown) {
      toast({ title: "Could not save source files", description: getErrorMessage(error), variant: "destructive" });
    }
  };

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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refreshAll} disabled={refreshing || githubLoading}>
            {(refreshing || githubLoading) ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {(refreshing || githubLoading) ? "Refreshing…" : "Refresh all"}
          </Button>
          <Button size="sm" onClick={triage} disabled={busy}>
            <Sparkles className="w-3.5 h-3.5 mr-1" /> {busy ? "Planning…" : "Plan from feedback"}
          </Button>
        </div>
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


      {/* Tiger AI Dev Console & Interactive Chat */}
      <div className="bg-card border-2 border-primary/40 rounded-xl overflow-hidden shadow-lg space-y-0">
        <div className="bg-gradient-to-r from-primary/20 via-card to-primary/10 px-4 py-3 border-b border-border/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-primary font-bold text-sm">
              🐯
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Tiger AI Dev Assistant</h3>
                <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Kagua kodi, elekeza GitHub updates & fanya planning moja kwa moja</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={clearChat} title="Futa mazungumzo" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick file inspector selector */}
        <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5 text-primary" /> Kagua faili:
          </span>
          {[
            "src/hooks/useWebRTC.ts",
            "src/pages/Draughts.tsx",
            "src/lib/draughts.ts",
            "supabase/functions/tiger-ai/index.ts",
          ].map((f) => (
            <button
              key={f}
              onClick={() => setInspectFile(inspectFile === f ? "" : f)}
              className={`px-2 py-0.5 rounded-md text-[10px] transition-colors border ${
                inspectFile === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground hover:text-foreground border-border/50"
              }`}
            >
              {f.split("/").pop()}
            </button>
          ))}
          {inspectFile && (
            <span className="text-[10px] text-primary font-mono ml-auto truncate max-w-[200px]">
              Active: {inspectFile}
            </span>
          )}
        </div>

        {/* Message Thread */}
        <div className="p-3 max-h-[380px] min-h-[180px] overflow-y-auto space-y-3 bg-gradient-to-b from-background to-card/60">
          {devMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-surface/90 border border-border/60 text-foreground shadow-sm font-sans"
                }`}
              >
                {msg.inspected_file && (
                  <div className="mb-1.5 pb-1 border-b border-border/40 text-[10px] text-primary font-mono flex items-center gap-1">
                    <FileCode className="w-3 h-3" /> Inspected: {msg.inspected_file}
                  </div>
                )}
                {msg.content}
              </div>
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <span className="text-[9px] text-muted-foreground">{msg.timestamp}</span>
                {msg.role === "assistant" && (
                  <button
                    onClick={() => copyText(msg.id, msg.content)}
                    className="text-[9px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Tiger AI inafikiria & inachambua kodi…</span>
            </div>
          )}
        </div>

        {/* Quick prompt suggestions */}
        <div className="p-2 border-t border-border/40 bg-card/40 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {[
            "📞 Kagua kodi za WebRTC calling",
            "♟️ Boresha mfumo wa game ya Drafti",
            "🔍 Kagua open GitHub PRs & CI",
            "💡 Pendekeza feature mpya",
          ].map((promptText) => (
            <button
              key={promptText}
              disabled={chatLoading}
              onClick={() => sendDevMessage(promptText)}
              className="shrink-0 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-[11px] text-secondary-foreground border border-border/50 transition-colors"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendDevMessage();
          }}
          className="p-2.5 border-t border-border/60 bg-card flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={inspectFile ? `Uliza kuhusu ${inspectFile}...` : "Andika hapa kuelekeza kodi, kuomba ushauri au kupanga kazi na Tiger AI..."}
              disabled={chatLoading}
              className="w-full h-10 px-3 pr-8 rounded-lg bg-background border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {inspectFile && (
              <span className="absolute right-2 top-2.5 text-[9px] text-primary bg-primary/10 px-1 rounded">
                File active
              </span>
            )}
          </div>
          <Button type="submit" size="sm" disabled={!inputPrompt.trim() || chatLoading} className="h-10 px-4">
            {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>

      <div className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> GitHub — access-ace-friend</h3>
          <Button size="sm" variant="outline" onClick={refreshGitHub} disabled={githubLoading}>
            {githubLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Refresh
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Badge variant="secondary">Repository: TigerChat-HQ/access-ace-friend</Badge>
          {githubUpdatedAt && <Badge variant="outline">Updated {new Date(githubUpdatedAt).toLocaleTimeString()}</Badge>}
          <Badge variant={githubWriteEnabled ? "default" : "outline"}>{githubWriteEnabled ? "GITHUB_TOKEN configured" : "Read-only — write token missing"}</Badge>
        </div>
        {!githubWriteEnabled && <p className="text-[11px] text-muted-foreground">TIGERCHAT can read open pull requests and CI status. To let Tiger AI prepare code-fix branches and draft PRs, configure the GITHUB_TOKEN Edge Function secret with Contents and Pull requests read/write permissions. The token stays server-side.</p>}
        {githubError && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">GitHub data could not be refreshed: {githubError}. Showing the last successfully loaded results, if any.</div>}
        {!githubError && pullRequests.length === 0 ? <p className="text-xs text-muted-foreground">GitHub connected successfully. There are currently no open pull requests.</p> : null}
        {pullRequests.length > 0 && (
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
                <div className="space-y-1">
                  <label className="text-foreground" htmlFor={`target-files-${task.id}`}>GitHub source files (comma-separated, 1–3 existing src/ paths)</label>
                  <Input id={`target-files-${task.id}`} value={fileTargets[task.id] ?? (task.plan?.areas ?? []).join(", ")} onChange={(event) => setFileTargets((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="src/components/Example.tsx" />
                  <Button size="sm" variant="outline" onClick={() => saveTargetFiles(task.id)}>Save target files</Button>
                </div>
                {task.risk === "high" && <p className="text-destructive">Protected change — needs your explicit approval; AI code drafting is blocked.</p>}
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
              {["approved", "in_progress"].includes(task.status) && task.risk !== "high" && githubWriteEnabled && !task.plan?.pr?.url && (
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
