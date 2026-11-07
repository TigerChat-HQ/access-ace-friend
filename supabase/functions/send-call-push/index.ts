import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-call-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const webhookSecret = Deno.env.get("CALL_PUSH_WEBHOOK_SECRET");
  if (!webhookSecret || request.headers.get("x-call-push-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!publicKey || !privateKey || !subject || !supabaseUrl || !serviceRoleKey) {
    console.error("Call push is missing required environment secrets.");
    return new Response("Push is not configured", { status: 500, headers: corsHeaders });
  }

  try {
    const { signal_id: signalId } = await request.json();
    if (typeof signalId !== "string") return new Response("Invalid signal id", { status: 400, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: signal, error: signalError } = await admin
      .from("call_signals")
      .select("id, caller_id, callee_id, conversation_id, call_type, signal_type, signal_data, status")
      .eq("id", signalId)
      .maybeSingle();
    if (signalError || !signal || signal.signal_type !== "offer" || signal.status !== "pending") {
      return new Response("Call offer not found", { status: 404, headers: corsHeaders });
    }

    const [{ data: caller }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
      admin.from("profiles").select("display_name, username").eq("user_id", signal.caller_id).maybeSingle(),
      admin.from("push_subscriptions").select("id, endpoint, subscription").eq("user_id", signal.callee_id),
    ]);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return new Response("No push subscriptions", { status: 200, headers: corsHeaders });

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const callerName = caller?.display_name || caller?.username || "Someone";
    const callLabel = signal.call_type === "video" ? "video call" : "voice call";
    const payload = JSON.stringify({
      title: `Incoming ${callLabel}`,
      body: `${callerName} is calling you`,
      url: `/chats?c=${encodeURIComponent(signal.conversation_id || "")}`,
      tag: `call-${signal.signal_data?.callId || signal.id}`,
      icon: "/pwa-icon-192.png",
    });

    await Promise.all(subscriptions.map(async (row: { id: string; subscription: webpush.PushSubscription }) => {
      try {
        await webpush.sendNotification(row.subscription, payload, { TTL: 60, urgency: "high" });
      } catch (error: any) {
        // Browsers report expired/uninstalled push endpoints with 404 or 410.
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          return;
        }
        console.error("Could not send call push:", error?.statusCode || error);
      }
    }));

    return new Response("Call push processed", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Call push failed:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
