type FetchErrorRecord = {
  source: string;
  severity: "critical" | "high" | "medium";
  category: string;
  title: string;
  message: string;
  route: string | null;
  action_label: string | null;
  metadata: Record<string, unknown>;
};

const recent = new Map<string, number>();
const signaturePart = (value: string) => value
  .toLowerCase()
  .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":uuid")
  .replace(/0x[0-9a-f]+/gi, ":hex")
  .replace(/\b[0-9]{4,}\b/g, ":number")
  .replace(/([?&](?:token|code|id|session)=)[^&\s]+/gi, "$1[redacted]")
  .replace(/\s+/g, " ")
  .trim();
const diagnosticSignature = async (record: Record<string, unknown>) => {
  const stack = typeof record.stack === "string"
    ? record.stack.split("\n").slice(0, 5).map((line) => line.replace(/:\d+:\d+/g, ":#:#")).join("\n")
    : "";
  const route = typeof record.route === "string" ? record.route.replace(/\/[0-9a-f-]{8,}/gi, "/:id").replace(/\/\d+(?=\/|$)/g, "/:id") : "";
  const canonical = [
    record.source, record.category, record.title, record.component_name,
    route, record.message, stack,
  ].map((value) => signaturePart(String(value ?? ""))).join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return "sha256:" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
let lastAction = "";
let lastActionAt = 0;

const redact = (value: string) => value
  .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
  .replace(/(access_token|refresh_token|password|authorization)(\s*[:=]\s*)[^&\s,]+/gi, "$1$2[REDACTED]")
  .slice(0, 6000);

export function createDiagnosticsFetch(
  supabaseUrl: string,
  publishableKey: string,
  originalFetch: typeof fetch,
): typeof fetch {
  const baseUrl = supabaseUrl.replace(/\/$/, "");

  const saveFailure = async (record: FetchErrorRecord, authorization: string) => {
    try {
      const payload = { ...record };
      const signature = await diagnosticSignature(payload);
      const key = signature;
      const now = Date.now();
      if (now - (recent.get(key) || 0) < 15000) return;
      recent.set(key, now);
      if (recent.size > 300) recent.clear();
      const headers = {
        apikey: publishableKey,
        Authorization: authorization,
        "Content-Type": "application/json",
      };
      const response = await originalFetch(`${baseUrl}/rest/v1/rpc/report_app_diagnostic`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_record: payload, p_signature: signature }),
      });
      if (!response.ok) return;
      const result = await response.json().catch(() => null);
      const row = Array.isArray(result) ? result[0] : result;
      if (row?.id && row.ai_status === "queued") {
        void originalFetch(`${baseUrl}/functions/v1/tiger-dev-planner`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "process_diagnostic", diagnostic_id: row.id }),
        }).catch(() => undefined);
      }
    } catch {
      // Diagnostics must never break the original app request.
    }
  };

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const authorization = headers.get("Authorization") || "";
    let parsedUrl: URL | null = null;
    try { parsedUrl = new URL(requestUrl); } catch { /* non-URL request */ }

    const isSupabaseApi = Boolean(
      parsedUrl &&
      parsedUrl.origin === baseUrl &&
      (/^\/rest\/v1\//.test(parsedUrl.pathname) ||
       /^\/storage\/v1\//.test(parsedUrl.pathname) ||
       /^\/functions\/v1\//.test(parsedUrl.pathname) ||
       /^\/graphql\/v1\//.test(parsedUrl.pathname)) &&
      !parsedUrl.pathname.startsWith("/rest/v1/app_diagnostics")
    );

    try {
      const response = await originalFetch(input, init);
      if (isSupabaseApi && authorization && !response.ok) {
        const detail = redact(await response.clone().text().catch(() => ""));
        const path = parsedUrl?.pathname || "unknown";
        const category = path.startsWith("/storage/") ? "storage" : path.startsWith("/functions/") ? "edge_function" : path.startsWith("/graphql/") ? "graphql" : "database_api";
        void saveFailure({
          source: "supabase_http",
          severity: response.status >= 500 ? "critical" : response.status === 403 ? "high" : "medium",
          category,
          title: `${(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()} ${path} failed (${response.status})`,
          message: detail || response.statusText || "Supabase request failed",
          route: typeof window !== "undefined" ? window.location.pathname : null,
          action_label: Date.now() - lastActionAt < 10000 ? lastAction : null,
          metadata: { status: response.status, statusText: response.statusText, method: (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase(), path },
        }, authorization);
      }
      return response;
    } catch (error) {
      if (isSupabaseApi && authorization) {
        const path = parsedUrl?.pathname || "unknown";
        void saveFailure({
          source: "supabase_network",
          severity: "high",
          category: "network",
          title: `Network request failed: ${path}`,
          message: redact(error instanceof Error ? error.message : String(error)),
          route: typeof window !== "undefined" ? window.location.pathname : null,
          action_label: Date.now() - lastActionAt < 10000 ? lastAction : null,
          metadata: { method: (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase(), path },
        }, authorization);
      }
      throw error;
    }
  };
}

export function installDiagnosticsFetch() {
  if (typeof window === "undefined" || (window as Window & { __tigerDiagnosticsFetch?: boolean }).__tigerDiagnosticsFetch) return;
  const env = import.meta.env as { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string };
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = createDiagnosticsFetch(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, originalFetch);
  (window as Window & { __tigerDiagnosticsFetch?: boolean }).__tigerDiagnosticsFetch = true;

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const control = target?.closest("button,a,[role='button'],input[type='submit']") as HTMLElement | null;
    if (!control) return;
    lastAction = (control.getAttribute("aria-label") || control.getAttribute("title") || control.innerText || control.textContent || control.tagName).trim().slice(0, 160);
    lastActionAt = Date.now();
  }, true);
}
