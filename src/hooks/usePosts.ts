/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types do not yet include the pending PR migrations; any casts are isolated to the database boundary. */
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
  audience?: string;
  allow_comments?: boolean;
  location_name?: string | null;
  tagged_user_ids?: string[] | null;
  alt_text?: string | null;
  post_audio_url?: string | null;
  post_audio_title?: string | null;
  post_cover_url?: string | null;
  is_draft?: boolean;
  scheduled_at?: string | null;
  archived_at?: string | null;
  pinned_at?: string | null;
  hide_like_count?: boolean;
  media_items?: unknown;
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
  is_collaboration?: boolean;
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
    const visiblePosts = (rawPosts as Array<(typeof rawPosts)[number] & { archived_at?: string | null }>).filter((p) => !blocked.has(p.user_id) && !p.archived_at);

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
    const refreshTimer = window.setInterval(() => { void fetchPosts(); }, 60_000);
    const channel = supabase
      .channel("posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => fetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => fetchPosts())
      .subscribe();
    return () => {
      window.clearInterval(refreshTimer);
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
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: collaborations } = await supabase.rpc("get_profile_collaboration_post_ids" as any, { _profile_id: userId } as any) as any;
    const collaborationIds = (collaborations || []).map((row: { post_id: string }) => row.post_id);
    const [ownedResult, collaborativeResult] = await Promise.all([
      supabase.from("posts").select("*").eq("user_id", userId),
      collaborationIds.length ? supabase.from("posts").select("*").in("id", collaborationIds).is("archived_at", null) : Promise.resolve({ data: [] as any[] }),
    ]);
    const ownedPosts = ownedResult.data || [];
    const collaborativePosts = (collaborativeResult.data || []).filter((post: any) => post.user_id !== userId);
    const byId = new Map<string, any>();
    [...ownedPosts, ...collaborativePosts].forEach((post: any) => byId.set(post.id, post));
    const data = [...byId.values()].sort((a: any, b: any) => {
      const pinA = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
      const pinB = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
      return pinB - pinA || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    if (!data.length) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const postIds = data.map((post: any) => post.id);
    const ownerIds = [...new Set(data.map((post: any) => post.user_id))];
    const [{ data: profiles }, { data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", ownerIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
      user ? supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);
    const profileMap = new Map(profiles?.map((profile) => [profile.user_id, profile]) || []);
    const likeCountMap = new Map<string, number>();
    likes?.forEach((like) => likeCountMap.set(like.post_id, (likeCountMap.get(like.post_id) || 0) + 1));
    const commentCountMap = new Map<string, number>();
    comments?.forEach((comment) => commentCountMap.set(comment.post_id, (commentCountMap.get(comment.post_id) || 0) + 1));
    const likedSet = new Set(((myLikes || []) as { post_id: string }[]).map((like) => like.post_id));
    setPosts(data.map((post: any) => ({
      ...post,
      profile: profileMap.get(post.user_id),
      like_count: likeCountMap.get(post.id) || 0,
      comment_count: commentCountMap.get(post.id) || 0,
      liked_by_me: likedSet.has(post.id),
      is_collaboration: post.user_id !== userId,
    })) as FeedPost[]);
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
