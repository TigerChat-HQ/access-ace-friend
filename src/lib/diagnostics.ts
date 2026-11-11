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

const safeText = (value: string, max = 8000) => value.replace(/(Bearer\\s+)[^\\s]+/gi, "$1[REDACTED]").replace(/(access_token|refresh_token|password|authorization)(\\s*[:=]\\s*)[^&\\s,]+/gi, "$1$2[REDACTED]").slice(0, max);

const normalizeForSignature = (value: string) => value
  .toLowerCase()
  .replace(/https?:\\/\\/\\S+/g, "[url]")
  .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[uuid]")
  .replace(/\\b0x[0-9a-f]+\\b/gi, "[hex]")
  .replace(/\\b\\d+\\b/g, "[n]")
  .replace(/\\s+/g, " ")
  .trim();

async function makeErrorSignature(parts: string[]) {
  const canonical = parts.map(normalizeForSignature).join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function reportDiagnostic(input: DiagnosticInput) {
  try {
    const error = input.error;
    const message = safeText(input.message || (error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error ?? "Unknown error")));
    const stack = error instanceof Error && error.stack ? safeText(error.stack) : null;
    const route = typeof window !== "undefined" ? window.location.pathname.replace(/\\b[0-9a-f]{8}-[0-9a-f-]{27,}\\b/gi, ":id").replace(/\\/\\d+(?=\\/|$)/g, "/:id") : "";
    const source = input.source || "feature_handler";
    const title = safeText(input.title, 240);
    const signature = await makeErrorSignature([source, input.category || "runtime", input.component || "", route, title, message]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- app_diagnostics RPC is added by the paired migration.
    const { data, error: insertError } = await (supabase as any).rpc("record_app_diagnostic", {
      p_error_signature: signature,
      p_source: source,
      p_severity: input.severity || "high",
      p_category: input.category || "runtime",
      p_title: title,
      p_message: message,
      p_route: route || null,
      p_component_name: input.component || null,
      p_action_label: input.action || null,
      p_stack: stack,
      p_suggestion: input.suggestion || null,
      p_metadata: input.metadata || {},
    });
    if (insertError) {
      console.warn("Diagnostics report could not be saved:", insertError.message);
      return;
    }
    const record = Array.isArray(data) ? data[0] : data;
    if (record?.diagnostic_id && record.should_process) {
      // Only a new or genuinely reopened diagnostic is handed to Tiger AI.
      // Repeated occurrences update the same row and never create duplicate repair tasks.
      void supabase.functions.invoke("tiger-dev-planner", {
        body: { action: "process_diagnostic", diagnostic_id: record.diagnostic_id },
      }).catch((automationError) => console.warn("Tiger AI diagnostics handoff failed:", automationError));
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
  window.addEventListener("unhandledrejection", (event) => {
    void reportDiagnostic({
      source: "browser", severity: "high", category: "promise",
      title: "Unhandled promise rejection", error: event.reason,
      message: event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Unknown rejection"),
      action: Date.now() - lastActionAt < 10000 ? lastAction : undefined,
    });
  });
}
