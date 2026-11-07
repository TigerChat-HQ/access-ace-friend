import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";
const schema = z.object({ kind: z.enum(["message", "call"]), conversationId: z.string().uuid(), callId: z.string().uuid().optional() });
Deno.serve(async req => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ error: "Sign in required" }, 401);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return reply({ error: "Invalid notification request" }, 400);
    const { kind, conversationId, callId } = parsed.data;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data: profile } = await caller.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    let recipients: string[] = [];
    if (kind === "call") {
      if (!callId) return reply({ error: "Call required" }, 400);
      const { data: signal } = await caller.from("call_signals").select("callee_id").eq("caller_id", user.id).eq("conversation_id", conversationId).eq("signal_type", "offer").eq("status", "pending").eq("signal_data->>callId", callId).gte("created_at", new Date(Date.now() - 45000).toISOString()).limit(1).maybeSingle();
      if (!signal) return reply({ error: "Active call not found" }, 403);
      recipients = [signal.callee_id];
    } else {
      const { data: message } = await caller.from("messages").select("id").eq("sender_id", user.id).eq("conversation_id", conversationId).gte("created_at", new Date(Date.now() - 10000).toISOString()).limit(1).maybeSingle();
      if (!message) return reply({ error: "Recent sent message required" }, 403);
      const { data: members } = await caller.from("conversation_members").select("user_id").eq("conversation_id", conversationId).neq("user_id", user.id);
      recipients = (members || []).map(m => m.user_id);
    }
    if (!recipients.length) return reply({ sent: 0 });
    const { data: devices, error } = await admin.from("device_push_tokens").select("id,token").in("user_id", recipients);
    if (error) throw error;
    const key = Deno.env.get("LOVABLE_API_KEY"); const connection = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
    if (!key || !connection) return reply({ error: "Firebase connection unavailable" }, 503);
    let sent = 0;
    for (const device of devices || []) {
      const response = await fetch("https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send", { method: "POST", headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": connection, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token: device.token, data: { title: kind === "call" ? "Incoming call" : "TIGERCHATS", body: `${profile?.display_name || "Someone"} ${kind === "call" ? "is calling you" : "sent you a message"}`, kind, path: `/chats?c=${conversationId}`, tag: `${kind}-${callId || conversationId}` }, webpush: { headers: { Urgency: "high", TTL: kind === "call" ? "45" : "300" } } } }) });
      if (!response.ok) {
        const details = await response.text();
        console.error("Firebase push failed", response.status, details);
        if (response.status === 404 && details.includes("UNREGISTERED")) { await admin.from("device_push_tokens").delete().eq("id", device.id); continue; }
        return reply({ error: "Notification provider failed", status: response.status, details }, response.status);
      }
      sent++;
    }
    return reply({ sent });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Notification failed" }, 500); }
});