import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bookmark, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard } from "@/components/social/PostCard";
import { FeedPost } from "@/hooks/usePosts";

const SavedPosts = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: saves } = await (supabase.from("post_saves" as any).select("post_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }) as any);
    const ids = (saves || []).map((row: { post_id: string }) => row.post_id);
    if (!ids.length) { setPosts([]); setLoading(false); return; }
    const { data } = await supabase.from("posts").select("*").in("id", ids).is("archived_at", null);
    const visible = data || [];
    if (!visible.length) { setPosts([]); setLoading(false); return; }
    const postIds = visible.map((post) => post.id);
    const userIds = [...new Set(visible.map((post) => post.user_id))];
    const [{ data: profiles }, { data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
      supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", user.id),
    ]);
    const profileMap = new Map(profiles?.map((profile) => [profile.user_id, profile]) || []);
    const count = (rows: { post_id: string }[] | null) => {
      const map = new Map<string, number>();
      rows?.forEach((row) => map.set(row.post_id, (map.get(row.post_id) || 0) + 1));
      return map;
    };
    const likeCounts = count(likes), commentCounts = count(comments);
    const liked = new Set(myLikes?.map((row) => row.post_id) || []);
    setPosts(visible.map((post) => ({ ...post, profile: profileMap.get(post.user_id), like_count: likeCounts.get(post.id) || 0, comment_count: commentCounts.get(post.id) || 0, liked_by_me: liked.has(post.id) })) as FeedPost[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  return <div className="flex h-full flex-col bg-background">
    <header className="tiger-page-header gap-3"><Link to="/" className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link><h1 className="flex-1 text-sm font-semibold">Saved posts</h1><Link to="/saved/collections" className="tiger-header-action" aria-label="Saved collections"><FolderOpen className="h-5 w-5" /></Link></header>
    <div className="flex-1 overflow-y-auto">{loading ? <div className="py-20 text-center text-sm text-muted-foreground">Loading saved posts…</div> : posts.length ? posts.map((post) => <PostCard key={post.id} post={post} onChanged={load} />) : <div className="px-6 py-20 text-center"><Bookmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-semibold">No saved posts yet</p><p className="mt-1 text-sm text-muted-foreground">Tap the bookmark icon on a post to keep it here.</p></div>}</div>
  </div>;
};
export default SavedPosts;
