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

export async function reportDiagnostic(input: DiagnosticInput) {
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
    if (now - (recent.get(key) || 0) < 15000) return;
    recent.set(key, now);
    if (recent.size > 250) recent.clear();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Database-side upsert is atomic across browser tabs and devices.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC is defined by the diagnostics deduplication migration.
    const { data: rows, error: insertError } = await (supabase as any).rpc("report_app_diagnostic", {
      p_record: record,
      p_signature: signature,
    });
    const inserted = Array.isArray(rows) ? rows[0] : rows;
    if (insertError) {
      console.warn("Diagnostics report could not be saved:", insertError.message);
    } else if (inserted?.id && inserted.ai_status === "queued") {
      // Supabase Functions returns invocation failures in { error }, not always as a rejected Promise.
      const { data: aiResult, error: automationError } = await supabase.functions.invoke("tiger-dev-planner", {
        body: { action: "process_diagnostic", diagnostic_id: inserted.id },
      });
      if (automationError || aiResult?.error || aiResult?.ok === false) {
        console.warn("Tiger AI diagnostics handoff failed:", automationError?.message || aiResult?.error || "Unknown Edge Function response");
      }
    }
  } catch (reportError) {
    console.warn("Diagnostics reporter failed:", reportError);
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
  window.addEventListener("error", (event) => {
    void reportDiagnostic({
      source: "browser", severity: "high", category: "javascript",
      title: event.message || "Uncaught browser error", message: event.message || "Unknown JavaScript error",
      action: Date.now() - lastActionAt < 10000 ? lastAction : undefined,
      error: event.error,
      metadata: { filename: event.filename, line: event.lineno, column: event.colno },
    });
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
