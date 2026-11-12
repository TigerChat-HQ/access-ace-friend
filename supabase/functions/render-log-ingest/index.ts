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

    const fetchLogs = async (filters: Record<string, string[]>) => {
      const url = new URL(base);
      for (const [key, values] of Object.entries(filters)) for (const value of values) url.searchParams.append(key, value);
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

    const [appLogs, requestLogs] = await Promise.all([
      fetchLogs({ type: ["app"], level: ["warning", "error", "critical", "alert", "emergency"] }),
      fetchLogs({ type: ["request"], statusCode: ["400", "401", "403", "404", "429", "500", "502", "503", "504"] }),
    ]);
    const unique = new Map<string, RenderLog>();
    for (const log of [...appLogs, ...requestLogs]) if (log?.id && log.message) unique.set(log.id, log);

    let ingested = 0;
    let failed = 0;
    for (const log of unique.values()) {
      const labels = labelMap(log);
      const status = Number(labels.statusCode || 0);
      const level = (labels.level || "error").toLowerCase();
      const path = (labels.path || "").split("?")[0].slice(0, 500);
      const method = (labels.method || "").slice(0, 12);
      const isHttpFailure = status >= 400;
      const severity = status >= 500 || ["critical", "alert", "emergency"].includes(level)
        ? "critical" : status >= 400 || level === "error" ? "high" : "medium";
      const category = status === 404 ? "render_http_404" : status >= 500
        ? "render_http_5xx" : isHttpFailure ? "render_http_4xx" : "render_application_log";
      const title = status
        ? `Render HTTP ${status}: ${method || "REQUEST"} ${path || "request"}`.slice(0, 240)
        : `Render server ${level}: ${redact(log.message).slice(0, 170)}`;
      const record = {
        source: "render_server",
        severity,
        category,
        title,
        message: redact(log.message),
        route: path || null,
        component_name: "Render web service",
        action_label: status ? `${method} ${path} → HTTP ${status}`.slice(0, 240) : "Render runtime log",
        suggestion: status === 404
          ? "Kagua API route, frontend endpoint na resource ID. Linganisha request hii na Browser/Bubble Chat diagnostic."
          : status >= 500
          ? "Kagua Render application logs, stack trace, service health, database connectivity na deploy iliyokuwa active wakati wa request."
          : isHttpFailure
          ? "Kagua route, authentication, authorization na request parameters."
          : "Chunguza stack trace na mazingira ya Render service ili kubaini chanzo cha runtime warning/error.",
        metadata: {
          platform: "render",
          renderLogId: log.id,
          resourceId: serviceId,
          instance: labels.instance || null,
          level,
          type: labels.type || null,
          statusCode: status || null,
          method: method || null,
          path: path || null,
          host: labels.host || null,
          timestamp: log.timestamp,
        },
      };
      try {
        const signature = await sha256(`render:${log.id}`);
        const { error } = await adminClient.rpc("ingest_render_server_diagnostic", {
          p_record: record,
          p_signature: signature,
        });
        if (error) throw error;
        ingested += 1;
      } catch {
        failed += 1;
      }
    }

    return json({
      ok: true,
      fetched: unique.size,
      ingested,
      failed,
      windowMinutes: minutes,
      checkedAt: end.toISOString(),
      source: "Render Logs API",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Render log collection failed" }, 502);
  }
});
