import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Eye, Heart, MessageCircle, PlusSquare, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface CreatorPost {
  id: string;
  caption: string | null;
  created_at: string;
  likes: number;
  comments: number;
}

const ProfessionalDashboard = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    const [postResult, followerResult] = await Promise.all([
      supabase.from("posts").select("id, caption, created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user.id),
    ]);
    if (postResult.error || followerResult.error) {
      setError(postResult.error?.message || followerResult.error?.message || "Could not load analytics.");
      setLoading(false);
      return;
    }
    const rows = postResult.data || [];
    setPostCount(postResult.count || 0);
    setFollowerCount(followerResult.count || 0);
    if (!rows.length) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const ids = rows.map((post) => post.id);
    const [likesResult, commentsResult] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", ids),
      supabase.from("post_comments").select("post_id").in("post_id", ids),
    ]);
    if (likesResult.error || commentsResult.error) {
      setError(likesResult.error?.message || commentsResult.error?.message || "Could not load post interactions.");
      setLoading(false);
      return;
    }
    const likes = new Map<string, number>();
    const comments = new Map<string, number>();
    likesResult.data?.forEach((row) => likes.set(row.post_id, (likes.get(row.post_id) || 0) + 1));
    commentsResult.data?.forEach((row) => comments.set(row.post_id, (comments.get(row.post_id) || 0) + 1));
    setPosts(rows.map((post) => ({
      ...post,
      likes: likes.get(post.id) || 0,
      comments: comments.get(post.id) || 0,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const totalLikes = posts.reduce((sum, post) => sum + post.likes, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.comments, 0);
  const interactions = totalLikes + totalComments;
  const recentPosts = posts.filter((post) => Date.now() - new Date(post.created_at).getTime() <= 30 * 86400000).length;
  const topPosts = [...posts].sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments)).slice(0, 5);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card/90 px-4 py-3 backdrop-blur">
        <Link to="/" aria-label="Back to Feed" className="rounded-full p-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="text-center"><h1 className="text-base font-bold text-foreground">Professional dashboard</h1><p className="text-[11px] text-muted-foreground">Creator insights</p></div>
        <Link to="/create" aria-label="Create post" className="rounded-full p-2 text-primary"><PlusSquare className="h-5 w-5" /></Link>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-4">
        <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-4">
          <div className="flex items-center gap-2 text-primary"><BarChart3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Your creator overview</span></div>
          <h2 className="mt-2 text-xl font-bold text-foreground">Grow your audience with insight</h2>
          <p className="mt-1 text-sm text-muted-foreground">Track how people respond to your posts and discover what resonates.</p>
        </section>

        {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading creator insights…</div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3">
              <Metric icon={<Users className="h-4 w-4" />} label="Followers" value={followerCount} />
              <Metric icon={<PlusSquare className="h-4 w-4" />} label="Total posts" value={postCount} />
              <Metric icon={<Heart className="h-4 w-4" />} label="Likes · latest 100 posts" value={totalLikes} />
              <Metric icon={<MessageCircle className="h-4 w-4" />} label="Comments · latest 100 posts" value={totalComments} />
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><h2 className="font-semibold text-foreground">Audience activity</h2></div>
              <div className="flex items-end justify-between gap-3">
                <div><p className="text-3xl font-bold tabular-nums text-foreground">{interactions.toLocaleString()}</p><p className="text-xs text-muted-foreground">Likes + comments on your latest 100 posts</p></div>
                <div className="text-right"><p className="text-2xl font-bold tabular-nums text-foreground">{recentPosts}</p><p className="text-xs text-muted-foreground">Posts in last 30 days</p></div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">Views, reach, watch time and revenue are not yet measured; this dashboard only reports interactions available in TigerChat today.</p>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-foreground">Top performing posts</h2><span className="text-[11px] text-muted-foreground">By likes + comments</span></div>
              {topPosts.length ? <div className="space-y-3">{topPosts.map((post, index) => (
                <Link key={post.id} to={`/post/${post.id}`} className="flex items-center gap-3 rounded-xl bg-surface/70 p-3 hover:bg-surface">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{post.caption || "Media post"}</span><span className="text-[11px] text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">♥ {post.likes} · comments {post.comments}</span>
                </Link>
              ))}</div> : <p className="py-6 text-center text-sm text-muted-foreground">Create your first post to see creator insights here.</p>}
            </section>
            <Link to="/create" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><PlusSquare className="h-4 w-4" /> Create a post</Link>
          </>
        )}
      </main>
    </div>
  );
};

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="rounded-2xl border border-border/60 bg-card p-4">
    <div className="mb-2 flex items-center gap-2 text-primary">{icon}<span className="text-[11px] font-medium text-muted-foreground">{label}</span></div>
    <p className="text-2xl font-bold tabular-nums text-foreground">{value.toLocaleString()}</p>
  </div>
);

export default ProfessionalDashboard;
