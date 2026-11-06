// AI-powered post recommendations using Lovable AI
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? supabaseKey;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Build user interest signals: posts they liked + their own captions/hashtags
    const { data: liked } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .limit(30);
    const likedIds = (liked || []).map((l) => l.post_id);

    const { data: likedPosts } = likedIds.length
      ? await supabase.from("posts").select("caption, hashtags").in("id", likedIds)
      : { data: [] as { caption: string | null; hashtags: string[] | null }[] };

    const interestText = (likedPosts || [])
      .map((p) => `${p.caption || ""} ${(p.hashtags || []).join(" ")}`)
      .join(" | ")
      .slice(0, 1500);

    // 2) Candidate pool: recent popular posts not by self
    const { data: candidates } = await supabase
      .from("posts")
      .select("id, user_id, caption, hashtags, created_at")
      .neq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ post_ids: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter blocked
    const [{ data: blocksA }, { data: blocksB }] = await Promise.all([
      supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
      supabase.from("blocks").select("blocker_id").eq("blocked_id", user.id),
    ]);
    const blocked = new Set<string>([
      ...(blocksA || []).map((block) => block.blocked_id),
      ...(blocksB || []).map((block) => block.blocker_id),
    ]);
    const filtered = candidates.filter((c) => !blocked.has(c.user_id));

    // If no interest signal, return latest
    if (!interestText.trim()) {
      return new Response(JSON.stringify({ post_ids: filtered.slice(0, 20).map((p) => p.id) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Ask Lovable AI to rank
    const candidateText = filtered
      .map((c, i) => `[${i}] ${c.caption || "(no caption)"} ${(c.hashtags || []).join(" ")}`)
      .join("\n")
      .slice(0, 6000);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You rank social media posts by relevance to a user's interests. Return only a JSON tool call with the indices of the most relevant posts in best order.",
          },
          {
            role: "user",
            content: `User interests:\n${interestText}\n\nCandidate posts:\n${candidateText}\n\nReturn the indices of the 15 most relevant posts in order, best first.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_posts",
              description: "Return ranked post indices",
              parameters: {
                type: "object",
                properties: {
                  indices: { type: "array", items: { type: "integer" } },
                },
                required: ["indices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recommend_posts" } },
      }),
    });

    if (aiResp.status === 429 || aiResp.status === 402) {
      // Fall back to recency
      return new Response(JSON.stringify({ post_ids: filtered.slice(0, 15).map((p) => p.id) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ post_ids: filtered.slice(0, 15).map((p) => p.id) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let indices: number[] = [];
    try {
      indices = JSON.parse(args || "{}").indices || [];
    } catch {
      indices = [];
    }
    const ordered = indices
      .filter((i) => i >= 0 && i < filtered.length)
      .map((i) => filtered[i].id);

    return new Response(JSON.stringify({ post_ids: ordered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
