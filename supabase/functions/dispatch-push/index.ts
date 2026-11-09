import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";

const schema = z.object({
  kind: z.enum(["message", "call"]),
  conversationId: z.string().uuid(),
  callId: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !anonKey || !serviceKey) return reply({ error: "Supabase function configuration is incomplete" }, 503);

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return reply({ error: "Sign in required" }, 401);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return reply({ error: "Invalid notification request" }, 400);
    const { kind, conversationId, callId } = parsed.data;

    const { data: profile } = await caller
      .from("profiles")
      .select("display_name,username")
      .eq("user_id", user.id)
      .maybeSingle();
    const senderName = profile?.display_name || profile?.username || "Someone";

    let recipients: string[] = [];
    let title = "TIGERCHATS";
    let body = "You have a new message";
    const path = `/chats?c=${conversationId}`;
    let tag = `message-${conversationId}`;

    if (kind === "call") {
      if (!callId) return reply({ error: "Call required" }, 400);
      const { data: signal } = await caller
        .from("call_signals")
        .select("callee_id")
        .eq("caller_id", user.id)
        .eq("conversation_id", conversationId)
        .eq("signal_type", "offer")
        .eq("status", "pending")
        .eq("signal_data->>callId", callId)
        .gte("created_at", new Date(Date.now() - 45000).toISOString())
        .limit(1)
        .maybeSingle();
      if (!signal) return reply({ error: "Active call not found" }, 403);
      recipients = [signal.callee_id];
      title = "Incoming call";
      body = `${senderName} is calling you`;
      tag = `call-${callId}`;
    } else {
      const { data: message } = await caller
        .from("messages")
        .select("id,reply_to_id,content,message_type")
        .eq("sender_id", user.id)
        .eq("conversation_id", conversationId)
        .gte("created_at", new Date(Date.now() - 15000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!message) return reply({ error: "Recent sent message required" }, 403);

      const { data: members, error: membersError } = await caller
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id);
      if (membersError) throw membersError;
      recipients = (members || []).map((member) => member.user_id);

      if (message.reply_to_id) {
        const { data: parent } = await caller
          .from("messages")
          .select("id,sender_id,conversation_id")
          .eq("id", message.reply_to_id)
          .eq("conversation_id", conversationId)
          .maybeSingle();
        if (parent) {
          title = "Chat thread reply";
          body = `${senderName} replied to ${parent.sender_id === user.id ? "your" : "a"} message: ${(message.content || "replied").slice(0, 100)}`;
          tag = `thread-${parent.id}`;
        } else {
          body = `${senderName} sent you a message`;
        }
      } else {
        body = message.message_type === "voice"
          ? `${senderName} sent a voice message`
          : message.message_type === "image"
          ? `${senderName} sent a photo`
          : message.message_type === "file"
          ? `${senderName} sent a file`
          : `${senderName}: ${(message.content || "New message").slice(0, 120)}`;
      }
    }

    if (!recipients.length) return reply({ sent: 0, reason: "No other chat members" });

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: devices, error: deviceError } = await admin
      .from("device_push_tokens")
      .select("id,token")
      .in("user_id", recipients);
    if (deviceError) throw deviceError;
    if (!devices?.length) return reply({ sent: 0, reason: "Recipients have no registered push devices" });

    const gatewayKey = Deno.env.get("LOVABLE_API_KEY");
    const firebaseConnection = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
    if (!gatewayKey || !firebaseConnection) {
      return reply({ error: "Firebase messaging connection is not configured in Supabase secrets" }, 503);
    }

    let sent = 0;
    for (const device of devices) {
      const response = await fetch(
        "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gatewayKey}`,
            "X-Connection-Api-Key": firebaseConnection,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              data: { title, body, kind, path, tag },
              webpush: { headers: { Urgency: kind === "call" ? "high" : "normal", TTL: kind === "call" ? "45" : "300" } },
            },
          }),
        },
      );
      if (!response.ok) {
        const details = await response.text();
        console.error("Firebase push failed", response.status, details);
        if (response.status === 404 && details.includes("UNREGISTERED")) {
          await admin.from("device_push_tokens").delete().eq("id", device.id);
          continue;
        }
        return reply({ error: "Notification provider failed", status: response.status }, 502);
      }
      sent++;
    }

    return reply({
      sent,
      recipientDevices: devices.length,
      notificationType: kind === "message" && title === "Chat thread reply" ? "thread_reply" : kind,
    });
  } catch (error) {
    console.error("dispatch-push error", error);
    return reply({ error: error instanceof Error ? error.message : "Notification failed" }, 500);
  }
});
