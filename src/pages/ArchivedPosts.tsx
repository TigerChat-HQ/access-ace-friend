import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard } from "@/components/social/PostCard";
import type { FeedPost } from "@/hooks/usePosts";

const ArchivedPosts = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) { setPosts([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("posts").select("*").eq("user_id", user.id).not("archived_at", "is", null).order("archived_at", { ascending: false });
    if (error || !data?.length) { setPosts([]); setLoading(false); return; }
    const ids = data.map((post) => post.id);
    const [{ data: profiles }, { data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, display_name, avatar_url").eq("user_id", user.id),
      supabase.from("post_likes").select("post_id").in("post_id", ids),
      supabase.from("post_comments").select("post_id").in("post_id", ids),
      supabase.from("post_likes").select("post_id").in("post_id", ids).eq("user_id", user.id),
    ]);
    const counts = (rows: { post_id: string }[] | null) => {
      const map = new Map<string, number>();
      rows?.forEach((row) => map.set(row.post_id, (map.get(row.post_id) || 0) + 1));
      return map;
    };
    const likeCounts = counts(likes), commentCounts = counts(comments);
    const liked = new Set(myLikes?.map((row) => row.post_id) || []);
    const profile = profiles?.[0];
    setPosts(data.map((post) => ({ ...post, profile, like_count: likeCounts.get(post.id) || 0, comment_count: commentCounts.get(post.id) || 0, liked_by_me: liked.has(post.id) })) as FeedPost[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  return <div className="flex h-full flex-col bg-background">
    <header className="tiger-page-header gap-3"><Link to="/" className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link><h1 className="text-sm font-semibold">Archived posts</h1></header>
    <div className="flex-1 overflow-y-auto">{loading ? <div className="py-20 text-center text-sm text-muted-foreground">Loading archive…</div> : posts.length ? posts.map((post) => <PostCard key={post.id} post={post} onChanged={load} />) : <div className="px-6 py-20 text-center"><Archive className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-semibold">Your archive is empty</p><p className="mt-1 text-sm text-muted-foreground">Posts you archive will appear here and remain hidden from other people.</p></div>}</div>
  </div>;
};
export default ArchivedPosts;
