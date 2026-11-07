import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
export async function dispatchPush(conversationId: string, callId?: string) {
  const { error } = await supabase.functions.invoke("dispatch-push", { body: { kind: callId ? "call" : "message", conversationId, callId } });
  if (error) console.warn("Push notification failed:", error instanceof FunctionsHttpError ? await error.context.text() : error.message);
}