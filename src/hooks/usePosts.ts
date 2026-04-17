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
}

export const useFeed = (mode: "following" | "discover" = "following") => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let userIdsForFeed: string[] | null = null;
    if (mode === "following") {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      userIdsForFeed = [...(follows?.map((f) => f.following_id) || []), user.id];
    }

    let query = supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
    if (userIdsForFeed) query = query.in("user_id", userIdsForFeed);

    const { data: rawPosts } = await query;
    if (!rawPosts) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postIds = rawPosts.map((p) => p.id);
    const userIds = [...new Set(rawPosts.map((p) => p.user_id))];

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

    setPosts(
      rawPosts.map((p) => ({
        ...p,
        profile: profileMap.get(p.user_id),
        like_count: likeCountMap.get(p.id) || 0,
        comment_count: commentCountMap.get(p.id) || 0,
        liked_by_me: myLikeSet.has(p.id),
      })) as FeedPost[]
    );
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
    const [{ data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
      user ? supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] as any[] }),
    ]);
    const likeCountMap = new Map<string, number>();
    likes?.forEach((l) => likeCountMap.set(l.post_id, (likeCountMap.get(l.post_id) || 0) + 1));
    const commentCountMap = new Map<string, number>();
    comments?.forEach((c) => commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1));
    const myLikeSet = new Set(myLikes?.map((l: any) => l.post_id) || []);
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
