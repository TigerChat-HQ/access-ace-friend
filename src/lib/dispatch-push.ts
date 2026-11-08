import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Push delivery is best-effort: a push provider outage must never break
 * message delivery or WebRTC call setup.
 */
export async function dispatchPush(conversationId: string, callId?: string) {
  try {
    const { error } = await supabase.functions.invoke("dispatch-push", {
      body: { kind: callId ? "call" : "message", conversationId, callId },
    });

    if (error) {
      const detail = error instanceof FunctionsHttpError
        ? await error.context.text()
        : error.message;
      console.warn("Push notification failed:", detail);
    }
  } catch (error) {
    console.warn("Push notification could not be dispatched:", error);
  }
}
