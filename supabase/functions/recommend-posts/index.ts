import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const words = (value: string) => new Set(
  value.toLowerCase().match(/[a-z0-9_]{3,}/g)?.filter((word) => !["the", "and", "for", "with", "this", "that", "from", "you", "your"].includes(word)) || [],
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "Recommendation service is not configured" }, 500);

    const admin = createClient(url, serviceKey);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const [likedResult, commentedResult, followsResult, blocksAResult, blocksBResult] = await Promise.all([
      admin.from("post_likes").select("post_id").eq("user_id", user.id).limit(100),
      admin.from("post_comments").select("post_id").eq("user_id", user.id).limit(100),
      admin.from("follows").select("following_id").eq("follower_id", user.id),
      admin.from("blocks").select("blocked_id").eq("blocker_id", user.id),
      admin.from("blocks").select("blocker_id").eq("blocked_id", user.id),
    ]);

    const interactedIds = [...new Set([
      ...(likedResult.data || []).map((row) => row.post_id),
      ...(commentedResult.data || []).map((row) => row.post_id),
    ])];
    const followedIds = new Set((followsResult.data || []).map((row) => row.following_id));
    const blockedIds = new Set([
      ...(blocksAResult.data || []).map((row) => row.blocked_id),
      ...(blocksBResult.data || []).map((row) => row.blocker_id),
    ]);

    const [interestResult, candidateResult] = await Promise.all([
      interactedIds.length
        ? admin.from("posts").select("caption, hashtags").in("id", interactedIds)
        : Promise.resolve({ data: [] as { caption: string | null; hashtags: string[] | null }[] }),
      admin.from("posts").select("id, user_id, caption, hashtags, created_at")
        .neq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (candidateResult.error) return json({ error: "Could not load recommendations" }, 500);
    const candidates = candidateResult.data || [];
    if (!candidates.length) return json({ post_ids: [] });

    const candidateIds = candidates.map((post) => post.id);
    const authorIds = [...new Set(candidates.map((post) => post.user_id))];
    const [profilesResult, likesResult, commentsResult] = await Promise.all([
      admin.from("profiles").select("user_id, is_private").in("user_id", authorIds),
      admin.from("post_likes").select("post_id").in("post_id", candidateIds),
      admin.from("post_comments").select("post_id").in("post_id", candidateIds),
    ]);

    const profiles = new Map((profilesResult.data || []).map((profile) => [profile.user_id, profile]));
    const likeCounts = new Map<string, number>();
    const commentCounts = new Map<string, number>();
    (likesResult.data || []).forEach((row) => likeCounts.set(row.post_id, (likeCounts.get(row.post_id) || 0) + 1));
    (commentsResult.data || []).forEach((row) => commentCounts.set(row.post_id, (commentCounts.get(row.post_id) || 0) + 1));

    const interestWords = new Set<string>();
    const interestTags = new Set<string>();
    (interestResult.data || []).forEach((post) => {
      words(post.caption || "").forEach((word) => interestWords.add(word));
      (post.hashtags || []).forEach((tag) => interestTags.add(tag.toLowerCase()));
    });

    const now = Date.now();
    const scored = candidates
      .filter((post) => {
        if (blockedIds.has(post.user_id)) return false;
        const profile = profiles.get(post.user_id);
        return !profile?.is_private || followedIds.has(post.user_id);
      })
      .map((post) => {
        const captionWords = words(post.caption || "");
        const wordMatches = [...captionWords].filter((word) => interestWords.has(word)).length;
        const tagMatches = (post.hashtags || []).filter((tag) => interestTags.has(tag.toLowerCase())).length;
        const ageHours = Math.max(0, (now - new Date(post.created_at).getTime()) / 3600000);
        const recency = Math.exp(-ageHours / 96);
        const likes = likeCounts.get(post.id) || 0;
        const comments = commentCounts.get(post.id) || 0;
        const engagement = Math.log1p(likes) * 0.8 + Math.log1p(comments) * 1.35;
        const relevance = Math.min(wordMatches, 8) * 0.28 + Math.min(tagMatches, 5) * 1.1;
        const network = followedIds.has(post.user_id) ? 2.4 : 0;
        const score = recency * (1 + engagement) + relevance + network;
        return { id: post.id, author: post.user_id, score, createdAt: post.created_at };
      })
      .sort((a, b) => b.score - a.score);

    // Diversity guard: avoid letting one creator dominate a personalized feed.
    const selected: typeof scored = [];
    const authorCounts = new Map<string, number>();
    for (const post of scored) {
      const count = authorCounts.get(post.author) || 0;
      if (count >= 2) continue;
      selected.push(post);
      authorCounts.set(post.author, count + 1);
      if (selected.length === 30) break;
    }

    return json({ post_ids: selected.map((post) => post.id), algorithm: "hybrid-v1" });
  } catch (error) {
    console.error("recommend-posts failed:", error);
    return json({ error: "Recommendation service failed" }, 500);
  }
});
