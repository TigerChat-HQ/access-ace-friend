import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FeedPost {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string;
  hashtags: string[] | null;
  created_at: string;
  profile?: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  score?: number;
}

const getBlockedSet = async (userId: string): Promise<Set<string>> => {
  const [a, b] = await Promise.all([
    supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
  ]);
  const set = new Set<string>();
  a.data?.forEach((r) => set.add(r.blocked_id));
  b.data?.forEach((r) => set.add(r.blocker_id));
  return set;
};

export const useFeed = (mode: "following" | "discover" = "following") => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const blocked = await getBlockedSet(user.id);

    let userIdsForFeed: string[] | null = null;
    if (mode === "following") {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      userIdsForFeed = [...(follows?.map((f) => f.following_id) || []), user.id];
    }

    let query = supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(100);
    if (userIdsForFeed) query = query.in("user_id", userIdsForFeed);

    const { data: rawPosts } = await query;
    if (!rawPosts) {
      setPosts([]);
      setLoading(false);
      return;
    }

    // Filter blocked users (both directions)
    const visiblePosts = rawPosts.filter((p) => !blocked.has(p.user_id));

    const postIds = visiblePosts.map((p) => p.id);
    const userIds = [...new Set(visiblePosts.map((p) => p.user_id))];

    if (postIds.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const [{ data: profiles }, { data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id),
    ]);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const likeCountMap = new Map<string, number>();
    likes?.forEach((l) => likeCountMap.set(l.post_id, (likeCountMap.get(l.post_id) || 0) + 1));
    const commentCountMap = new Map<string, number>();
    comments?.forEach((c) => commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1));
    const myLikeSet = new Set(myLikes?.map((l) => l.post_id) || []);

    let enriched: FeedPost[] = visiblePosts.map((p) => ({
      ...p,
      profile: profileMap.get(p.user_id),
      like_count: likeCountMap.get(p.id) || 0,
      comment_count: commentCountMap.get(p.id) || 0,
      liked_by_me: myLikeSet.has(p.id),
    })) as FeedPost[];

    // Discover: rank by engagement + recency
    if (mode === "discover") {
      const now = Date.now();
      enriched = enriched
        .map((p) => {
          const ageH = (now - new Date(p.created_at).getTime()) / 3_600_000;
          const score = (p.like_count * 2 + p.comment_count * 3) / Math.pow(ageH + 2, 1.5);
          return { ...p, score };
        })
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 50);
    } else {
      enriched = enriched.slice(0, 50);
    }

    setPosts(enriched);
    setLoading(false);
  }, [user, mode]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => fetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => fetchPosts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  return { posts, loading, refetch: fetchPosts };
};

export const useUserPosts = (userId: string | undefined) => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!data) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const postIds = data.map((p) => p.id);
    if (postIds.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const [{ data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
      user ? supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);
    const likeCountMap = new Map<string, number>();
    likes?.forEach((l) => likeCountMap.set(l.post_id, (likeCountMap.get(l.post_id) || 0) + 1));
    const commentCountMap = new Map<string, number>();
    comments?.forEach((c) => commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1));
    const myLikeRows = (myLikes ?? []) as { post_id: string }[];
    const myLikeSet = new Set(myLikeRows.map((like) => like.post_id));
    setPosts(
      data.map((p) => ({
        ...p,
        like_count: likeCountMap.get(p.id) || 0,
        comment_count: commentCountMap.get(p.id) || 0,
        liked_by_me: myLikeSet.has(p.id),
      })) as FeedPost[]
    );
    setLoading(false);
  }, [userId, user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { posts, loading, refetch: fetch };
};

export const toggleLike = async (postId: string, userId: string, currentlyLiked: boolean) => {
  if (currentlyLiked) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  }
};

export const deletePost = async (postId: string) => supabase.from("posts").delete().eq("id", postId);
