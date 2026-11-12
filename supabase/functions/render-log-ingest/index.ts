import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const cors = {
  "Access-Control-Allow-Origin": "https://tigerchat-hq.onrender.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type RenderLabel = { name: string; value: string };
type RenderLog = { id: string; message: string; timestamp: string; labels?: RenderLabel[] };
type RenderEvent = { id: string; timestamp: string; type: string; details?: Record<string, unknown> };
const labelMap = (log: RenderLog) => Object.fromEntries((log.labels || []).map(({ name, value }) => [name, value]));
const redact = (value: string) => value
  .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
  .replace(/(password|token|secret|authorization|api[_-]?key)(["']?\s*[:=]\s*["']?)[^&\s,"']+/gi, "$1$2[REDACTED]")
  .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi, "$1?[REDACTED]")
  .slice(0, 8000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return "sha256:" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const renderApiKey = Deno.env.get("RENDER_API_KEY");
    const ownerId = Deno.env.get("RENDER_WORKSPACE_ID") || "tea-dbp1th95efls7385nvag";
    const serviceId = Deno.env.get("RENDER_SERVICE_ID") || "srv-dbp21qajnfac7396gs60";
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Supabase server configuration is incomplete" }, 500);
    if (!renderApiKey) return json({ error: "RENDER_API_KEY haijawekwa kwenye Supabase Edge Function Secrets." }, 503);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: roles, error: roleError } = await adminClient
      .from("user_roles").select("role").eq("user_id", userData.user.id)
      .in("role", ["admin", "superior_admin"]).limit(1);
    if (roleError) return json({ error: "Admin authorization could not be verified" }, 500);
    if (!roles?.length) return json({ error: "Admin access required" }, 403);

    const requested = await req.json().catch(() => ({}));
    const minutes = Math.min(60, Math.max(5, Number(requested?.window_minutes) || 15));
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60_000);
    const base = new URL("https://api.render.com/v1/logs");
    base.searchParams.set("ownerId", ownerId);
    base.searchParams.append("resource", serviceId);
    base.searchParams.set("startTime", start.toISOString());
    base.searchParams.set("endTime", end.toISOString());
    base.searchParams.set("direction", "backward");
    base.searchParams.set("limit", "100");

    const fetchLogs = async () => {
      const url = new URL(base);
      url.searchParams.append("type", "build");
      const response = await fetch(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${renderApiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const detail = response.status === 401 || response.status === 403
          ? "Render API key haina ruhusa ya kusoma logs za workspace hii."
          : `Render Logs API imerudisha HTTP ${response.status}.`;
        throw new Error(detail);
      }
      const payload = await response.json();
      return (Array.isArray(payload?.logs) ? payload.logs : []) as RenderLog[];
    };

    const fetchEvents = async () => {
      const url = new URL(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/events`);
      url.searchParams.set("startTime", start.toISOString());
      url.searchParams.set("endTime", end.toISOString());
      url.searchParams.set("limit", "100");
      const response = await fetch(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${renderApiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Render Events API imerudisha HTTP ${response.status}.`);
      const payload = await response.json();
      return (Array.isArray(payload) ? payload : [])
        .map((item: { event?: RenderEvent }) => item.event)
        .filter((event: RenderEvent | undefined): event is RenderEvent => Boolean(event?.id));
    };

    const [logs, events] = await Promise.all([fetchLogs(), fetchEvents()]);
    const problematicLogs = logs.filter((log) => {
      const labels = labelMap(log);
      return labels.level && labels.level !== "info"
        || /\b(error|failed|failure|warning|warn|exception|out of memory|killed)\b|\(!\)/i.test(log.message || "");
    });
    const failedEvents = events.filter((event) => {
      const details = event.details || {};
      if (event.type === "server_failed" || event.type === "server_hardware_failure" || event.type === "image_pull_failed" || event.type === "artifact_fetch_failed") return true;
      if (event.type === "build_ended") return String(details.buildStatus || "").toLowerCase() !== "succeeded";
      if (event.type === "deploy_ended") return String(details.deployStatus || "").toLowerCase() !== "succeeded";
      return false;
    });

    let ingested = 0;
    let failed = 0;
    const save = async (record: Record<string, unknown>, sourceId: string) => {
      try {
        const signature = await sha256(`render:${sourceId}`);
        const { error } = await adminClient.rpc("ingest_render_server_diagnostic", {
          p_record: record,
          p_signature: signature,
        });
        if (error) throw error;
        ingested += 1;
      } catch {
        failed += 1;
      }
    };

    for (const log of problematicLogs) {
      const labels = labelMap(log);
      const level = (labels.level || "warning").toLowerCase();
      const severity = ["critical", "alert", "emergency", "error"].includes(level) ? "critical" : "medium";
      const message = redact(log.message || "Render build warning");
      await save({
        source: "render_server",
        severity,
        category: "render_build_log",
        title: `Render build ${level}: ${message.slice(0, 170)}`,
        message,
        component_name: "Render Static Site build",
        action_label: "Render build log",
        suggestion: "Kagua build command, dependency versions, Vite output na deploy iliyokuwa inaendelea wakati wa warning/error.",
        metadata: { platform: "render", renderLogId: log.id, resourceId: serviceId, level, type: labels.type || "build", timestamp: log.timestamp },
      }, `log:${log.id}`);
    }

    for (const event of failedEvents) {
      const details = event.details || {};
      const detailText = redact(JSON.stringify(details));
      const severity = ["server_failed", "server_hardware_failure"].includes(event.type) ? "critical" : "high";
      await save({
        source: "render_server",
        severity,
        category: `render_${event.type}`,
        title: `Render hosting event failed: ${event.type}`,
        message: detailText,
        component_name: "Render deployment / hosting",
        action_label: event.type,
        suggestion: "Kagua maelezo ya event, build logs, deploy history na service health kwenye Render.",
        metadata: { platform: "render", renderEventId: event.id, resourceId: serviceId, eventType: event.type, timestamp: event.timestamp, details },
      }, `event:${event.id}`);
    }

    return json({
      ok: true,
      serviceType: "static_site",
      runtimeServerLogsAvailable: false,
      fetchedBuildLogs: logs.length,
      matchedBuildIssues: problematicLogs.length,
      fetchedHostingEvents: events.length,
      failedHostingEvents: failedEvents.length,
      ingested,
      failed,
      windowMinutes: minutes,
      checkedAt: end.toISOString(),
      note: "Render Static Sites do not emit runtime server or HTTP request logs; this collector captures build logs and hosting/deploy failure events.",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Render log collection failed" }, 502);
  }
});
