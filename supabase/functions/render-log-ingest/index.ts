import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const cors = {
  "Access-Control-Allow-Origin": "https://tigerchat-hq.onrender.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type RenderEvent = { id: string; timestamp: string; type: string; details?: Record<string, unknown> };
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
    // Render explicitly does not emit logs for Static Sites. Use its supported
    // service Events API instead of querying the Logs API with an unsupported resource.
    const url = new URL(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/events`);
    url.searchParams.set("startTime", start.toISOString());
    url.searchParams.set("endTime", end.toISOString());
    url.searchParams.set("limit", "100");
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${renderApiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const detail = response.status === 401 || response.status === 403
        ? "Render API key haina ruhusa ya kusoma events za workspace hii."
        : `Render Events API imerudisha HTTP ${response.status}.`;
      throw new Error(detail);
    }
    const payload = await response.json();
    const events = (Array.isArray(payload) ? payload : [])
      .map((item: { event?: RenderEvent }) => item.event)
      .filter((event: RenderEvent | undefined): event is RenderEvent => Boolean(event?.id));

    const failedEvents = events.filter((event) => {
      const details = event.details || {};
      if (event.type === "server_failed" || event.type === "server_hardware_failure" || event.type === "image_pull_failed" || event.type === "artifact_fetch_failed") return true;
      if (event.type === "build_ended") return String(details.buildStatus || "").toLowerCase() !== "succeeded";
      if (event.type === "deploy_ended") return String(details.deployStatus || "").toLowerCase() !== "succeeded";
      return false;
    });

    let ingested = 0;
    let failed = 0;
    for (const event of failedEvents) {
      try {
        const details = event.details || {};
        const detailText = redact(JSON.stringify(details));
        const signature = await sha256(`render:event:${event.id}`);
        const severity = ["server_failed", "server_hardware_failure"].includes(event.type) ? "critical" : "high";
        const { error } = await adminClient.rpc("ingest_render_server_diagnostic", {
          p_record: {
            source: "render_server",
            severity,
            category: `render_${event.type}`,
            title: `Render hosting event failed: ${event.type}`,
            message: detailText,
            component_name: "Render deployment / hosting",
            action_label: event.type,
            suggestion: "Kagua maelezo ya event na deploy history kwenye Render. Static Site haina runtime logs.",
            metadata: { platform: "render", renderEventId: event.id, resourceId: serviceId, eventType: event.type, timestamp: event.timestamp, details },
          },
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
      serviceType: "static_site",
      runtimeServerLogsAvailable: false,
      buildLogsAvailable: false,
      fetchedHostingEvents: events.length,
      failedHostingEvents: failedEvents.length,
      ingested,
      failed,
      windowMinutes: minutes,
      checkedAt: end.toISOString(),
      note: "Render Static Sites do not emit runtime or build logs through the Logs API. This collector captures failed build/deploy/hosting events only; deploy log details remain available in the Render Dashboard.",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Render event collection failed" }, 502);
  }
});
