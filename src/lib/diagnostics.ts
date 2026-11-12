import { supabase } from "@/integrations/supabase/client";

type DiagnosticInput = {
  title: string;
  error?: unknown;
  message?: string;
  category?: string;
  source?: string;
  severity?: "critical" | "high" | "medium" | "low";
  component?: string;
  action?: string;
  suggestion?: string;
  metadata?: Record<string, unknown>;
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
const safeText = (value: string, max = 8000) => value.replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]").replace(/(access_token|refresh_token|password|authorization)(\s*[:=]\s*)[^&\s,]+/gi, "$1$2[REDACTED]").slice(0, max);

export async function reportDiagnostic(input: DiagnosticInput): Promise<boolean> {
  try {
    const error = input.error;
    const message = safeText(input.message || (error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error ?? "Unknown error")));
    const stack = error instanceof Error && error.stack ? safeText(error.stack) : null;
    const record = {
      source: input.source || "feature_handler",
      severity: input.severity || "high",
      category: input.category || "runtime",
      title: safeText(input.title, 240),
      message,
      route: typeof window !== "undefined" ? window.location.pathname : null,
      component_name: input.component || null,
      action_label: input.action || null,
      stack,
      suggestion: input.suggestion || null,
      metadata: input.metadata || {},
    };
    const signature = await diagnosticSignature(record);
    const key = signature;
    const now = Date.now();
    if (now - (recent.get(key) || 0) < 15000) return true;
    recent.set(key, now);
    if (recent.size > 250) recent.clear();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    // Database-side upsert is atomic across browser tabs and devices.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC is defined by the diagnostics deduplication migration.
    const { data: rows, error: insertError } = await (supabase as any).rpc("report_app_diagnostic", {
      p_record: record,
      p_signature: signature,
    });
    const inserted = Array.isArray(rows) ? rows[0] : rows;
    if (insertError) {
      console.warn("Diagnostics report could not be saved:", insertError.message);
      return false;
    } else if (inserted?.id && inserted.ai_status === "queued") {
      // Supabase Functions returns invocation failures in { error }, not always as a rejected Promise.
      const { data: aiResult, error: automationError } = await supabase.functions.invoke("tiger-dev-planner", {
        body: { action: "process_diagnostic", diagnostic_id: inserted.id },
      });
      if (automationError || aiResult?.error || aiResult?.ok === false) {
        console.warn("Tiger AI diagnostics handoff failed:", automationError?.message || aiResult?.error || "Unknown Edge Function response");
      }
    }
    return true;
  } catch (reportError) {
    console.warn("Diagnostics reporter failed:", reportError);
    return false;
  }
}

let installed = false;
export function installGlobalDiagnostics() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let lastAction = "";
  let lastActionAt = 0;
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const control = target?.closest("button,a,[role='button'],input[type='submit']") as HTMLElement | null;
    if (!control) return;
    lastAction = (control.getAttribute("aria-label") || control.getAttribute("title") || control.innerText || control.textContent || control.tagName).trim().slice(0, 160);
    lastActionAt = Date.now();
  }, true);
  window.addEventListener("error", (event: Event) => {
    const errorEvent = event as ErrorEvent;
    if (typeof errorEvent.message === "string" && errorEvent.message.length > 0) {
      void reportDiagnostic({
        source: "website", severity: "high", category: "javascript",
        title: errorEvent.message || "Uncaught browser error", message: errorEvent.message || "Unknown JavaScript error",
        action: Date.now() - lastActionAt < 10000 ? lastAction : undefined,
        error: errorEvent.error,
        metadata: { filename: errorEvent.filename, line: errorEvent.lineno, column: errorEvent.colno, platform: "web", userAgent: navigator.userAgent },
      });
      return;
    }
    const target = event.target;
    if (target instanceof HTMLScriptElement || target instanceof HTMLLinkElement || target instanceof HTMLImageElement || target instanceof HTMLVideoElement || target instanceof HTMLAudioElement) {
      const resourceUrl = "src" in target ? target.src : target.href;
      void reportDiagnostic({
        source: "website", severity: "medium", category: "asset_load",
        title: "Website resource failed to load", message: `Failed to load ${target.tagName.toLowerCase()} resource`,
        action: Date.now() - lastActionAt < 10000 ? lastAction : undefined,
        component: target.tagName.toLowerCase(),
        metadata: { resourceUrl: resourceUrl ? new URL(resourceUrl, location.href).pathname : null, platform: "web" },
      });
    }
  }, true);
  // Capture failed API responses (including chat/bubble 404s) even when the UI
  // handles the rejection and no browser-level exception is emitted.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    let response: Response;
    try {
      response = await originalFetch(input, init);
    } catch (error) {
      const path = (() => { try { return new URL(requestUrl, location.href).pathname; } catch { return "unknown"; } })();
      void reportDiagnostic({
        source: "website", severity: "high", category: "api_network",
        title: /bubble|chat|conversation/i.test(path) || /bubble|chat/i.test(lastAction) ? "Bubble Chat request failed" : "Website API request failed",
        message: error instanceof Error ? error.message : String(error),
        action: Date.now() - lastActionAt < 10000 ? lastAction : undefined,
        component: /bubble|chat|conversation/i.test(path) || /bubble|chat/i.test(lastAction) ? "Bubble Chat" : "fetch",
        suggestion: "Check the API endpoint, authentication, network connection and server logs for this request.",
        metadata: { platform: "web", method, endpoint: path, networkFailure: true },
      });
      throw error;
    }
    if (response.status >= 400) {
      const path = (() => { try { return new URL(requestUrl, location.href).pathname; } catch { return "unknown"; } })();
      const isBubbleChat = /bubble|chat|conversation/i.test(path) || /bubble|chat/i.test(lastAction);
      void reportDiagnostic({
        source: "website", severity: response.status >= 500 ? "critical" : "high",
        category: response.status === 404 ? (isBubbleChat ? "bubble_chat_not_found" : "api_not_found") : "api_http",
        title: isBubbleChat && response.status === 404 ? "Bubble Chat: Not Found (404)" : `Website API returned HTTP ${response.status}`,
        message: ` ${method} ${path} returned HTTP ${response.status} ${response.statusText}`.trim(),
        action: Date.now() - lastActionAt < 10000 ? lastAction : undefined,
        component: isBubbleChat ? "Bubble Chat" : "API request",
        suggestion: response.status === 404
          ? "Verify that the chat/bubble API route and requested conversation exist, and that the frontend uses the current endpoint. Check Render server logs for the matching 404."
          : "Inspect the API response and matching hosting logs; verify authentication, permissions and server health.",
        metadata: { platform: "web", method, endpoint: path, status: response.status, statusText: response.statusText },
      });
    }
    return response;
  };

  window.addEventListener("offline", () => {
    void reportDiagnostic({ source: "website", severity: "high", category: "network_offline", title: "Device lost network connection", message: "The browser reported that the device is offline.", metadata: { platform: "web" } });
  });
  window.addEventListener("online", () => {
    void reportDiagnostic({ source: "website", severity: "low", category: "network_restored", title: "Network connection restored", message: "The browser reported that the device is online again.", metadata: { platform: "web" } });
  });

  const flushNativeDiagnostics = async () => {
    const bridge = (window as Window & { TigerNative?: { getPendingDiagnostics?: () => string; acknowledgeDiagnostic?: (id: string) => void; getAppVersion?: () => string } }).TigerNative;
    if (!bridge?.getPendingDiagnostics || !bridge.acknowledgeDiagnostic) return;
    try {
      const pending = JSON.parse(bridge.getPendingDiagnostics()) as Array<{ id: string; source?: string; category?: string; title?: string; message?: string; severity?: "critical" | "high" | "medium" | "low"; metadata?: Record<string, unknown>; createdAt?: number }>;
      for (const item of pending) {
        const saved = await reportDiagnostic({
          source: item.source || "android_native", severity: item.severity || "high",
          category: item.category || "android_runtime", title: item.title || "Android app diagnostic",
          message: item.message || "Android reported a native application error.", component: "Android WebView / Native",
          metadata: { ...(item.metadata || {}), platform: "android", nativeDiagnosticId: item.id, nativeCreatedAt: item.createdAt, appVersion: bridge.getAppVersion?.() || "unknown" },
        });
        if (saved) bridge.acknowledgeDiagnostic(item.id);
      }
    } catch (error) {
      console.warn("Could not transfer Android diagnostics:", error);
    }
  };
  window.addEventListener("tiger:native-diagnostics-ready", () => { void flushNativeDiagnostics(); });
  void flushNativeDiagnostics();
  supabase.auth.onAuthStateChange(() => {
    window.setTimeout(() => { void flushNativeDiagnostics(); }, 0);
  });
  if (navigator.mediaDevices?.getUserMedia) {
    const mediaDevices = navigator.mediaDevices;
    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      try {
        return await originalGetUserMedia(constraints);
      } catch (error) {
        const mediaKind = constraints?.video ? "camera" : constraints?.audio ? "microphone" : "media";
        const errorName = error instanceof DOMException ? error.name : "UnknownError";
        void reportDiagnostic({
          source: "media_capture",
          severity: errorName === "NotAllowedError" || errorName === "SecurityError" ? "high" : "medium",
          category: mediaKind === "camera" ? "camera_permission" : mediaKind === "microphone" ? "microphone_permission" : "media_capture",
          title: `${mediaKind} capture failed: ${errorName}`,
          message: error instanceof Error ? error.message : String(error),
          component: "MediaDevices.getUserMedia",
          action: Date.now() - lastActionAt < 10000 ? lastAction : undefined,
          suggestion: "Check Android runtime permission, WebView PermissionRequest handling, secure context, device availability and whether capture was requested from the main Activity WebView.",
          metadata: {
            errorName,
            audioRequested: Boolean(constraints?.audio),
            videoRequested: Boolean(constraints?.video),
            secureContext: window.isSecureContext,
            mediaDevicesAvailable: Boolean(navigator.mediaDevices),
            userAgent: navigator.userAgent,
          },
        });
        throw error;
      }
    };
  }
  window.addEventListener("unhandledrejection", (event) => {
    void reportDiagnostic({
      source: "browser", severity: "high", category: "promise",
      title: "Unhandled promise rejection", error: event.reason,
      message: event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Unknown rejection"),
      action: Date.now() - lastActionAt < 10000 ? lastAction : undefined,
    });
  });
}
