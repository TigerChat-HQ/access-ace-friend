import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const base64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey) {
      return reply({ error: "Sign in required" }, 401);
    }

    // Verify the caller's JWT; never trust a user ID supplied in the request body.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return reply({ error: "Sign in required" }, 401);

    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
      return reply({ error: "A valid conversation is required" }, 400);
    }
    const { data: membership, error: membershipError } = await userClient
      .from("conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError || !membership) return reply({ error: "Conversation access denied" }, 403);

    const sharedSecret = Deno.env.get("TURN_SHARED_SECRET");
    const rawUrls = Deno.env.get("TURN_URLS") || "";
    if (!sharedSecret || new TextEncoder().encode(sharedSecret).length < 32) {
      console.error("TURN_SHARED_SECRET is missing or too short.");
      return reply({ error: "Secure call relay is not configured" }, 503);
    }

    const urls = rawUrls.split(/[\s,]+/).map((url) => url.trim()).filter(Boolean);
    if (!urls.length || urls.some((url) => !/^turns?:[^\s]+$/i.test(url))) {
      console.error("TURN_URLS must contain one or more TURN/TURNS URLs.");
      return reply({ error: "Secure call relay is not configured" }, 503);
    }

    const configuredTtl = Number(Deno.env.get("TURN_CREDENTIAL_TTL_SECONDS") || "600");
    const ttlSeconds = Number.isFinite(configuredTtl)
      ? Math.min(3600, Math.max(300, Math.floor(configuredTtl)))
      : 600;
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    // coturn REST API format: timestamp:opaque-user-id, signed with the shared secret.
    const username = `${expiresAt}:${user.id}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(sharedSecret),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username));
    const credential = base64(new Uint8Array(signature));

    return reply({
      iceServers: [{ urls, username, credential }],
      expiresAt,
    });
  } catch (error) {
    console.error("TURN credential generation failed:", error);
    return reply({ error: "Could not prepare secure call relay" }, 500);
  }
});
