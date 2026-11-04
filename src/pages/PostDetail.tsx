/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/social/PostCard";
import { FeedPost } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!postId) return;
    const { data } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
    if (!data) {
      setLoading(false);
      return;
    }
    const [{ data: profile }, { count: lc }, { count: cc }, { data: myLike }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, display_name, avatar_url").eq("user_id", data.user_id).maybeSingle(),
      supabase.from("post_likes").select("*", { count: "exact", head: true }).eq("post_id", postId),
      supabase.from("post_comments").select("*", { count: "exact", head: true }).eq("post_id", postId),
      user
        ? supabase.from("post_likes").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null as { id: string } | null }),
    ]);
    setPost({
      ...data,
      profile: profile || undefined,
      like_count: lc || 0,
      comment_count: cc || 0,
      liked_by_me: !!myLike,
    } as FeedPost);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [postId, user]);

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">Post</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : post ? (
          <PostCard post={post} onChanged={load} />
        ) : (
          <p className="text-center text-muted-foreground py-12">Post not found.</p>
        )}
      </div>
    </div>
  );
};

export default PostDetail;
