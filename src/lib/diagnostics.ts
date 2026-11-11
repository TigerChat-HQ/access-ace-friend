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
const safeText = (value: string, max = 8000) => value.replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]").replace(/(access_token|refresh_token|password|authorization)(\s*[:=]\s*)[^&\s,]+/gi, "$1$2[REDACTED]").slice(0, max);

export async function reportDiagnostic(input: DiagnosticInput) {
  try {
    const error = input.error;
    const message = safeText(input.message || (error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error ?? "Unknown error")));
    const stack = error instanceof Error && error.stack ? safeText(error.stack) : null;
    const key = [input.source || "feature", input.component || "", input.title, message].join("|");
    const now = Date.now();
    if (now - (recent.get(key) || 0) < 15000) return;
    recent.set(key, now);
    if (recent.size > 250) recent.clear();
    const { data: { user } } = await supabase.auth.getUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- app_diagnostics exists in production; generated Supabase types are not refreshed.
    const { error: insertError } = await (supabase as any).from("app_diagnostics").insert({
      reporter_id: user?.id ?? null,
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
    });
    if (insertError) console.warn("Diagnostics report could not be saved:", insertError.message);
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
