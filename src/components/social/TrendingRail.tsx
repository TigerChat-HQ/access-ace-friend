import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";

interface TrendingRow {
  id: string;
  like_count: number;
  comment_count: number;
}

const db = supabase as unknown as SupabaseClient;

interface TrendingPost {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
}

export const TrendingRail = () => {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrending = async () => {
      const { data: trending } = await supabase
.from("trending_posts")
        .select("id, like_count, comment_count")
        .order("score", { ascending: false })
        .limit(10);
      const trendingRows = (trending ?? []) as unknown as TrendingRow[];
      if (trendingRows.length === 0) {
        setLoading(false);
        return;
      }
      const ids = trendingRows.map((item) => item.id);
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, user_id, media_url, media_type, caption")
        .in("id", ids);
      if (postsData) {
        const metrics = new Map(trendingRows.map((item) => [item.id, item]));
        const merged: TrendingPost[] = postsData.flatMap((post) => {
          const metric = metrics.get(post.id);
          return metric ? [{ ...post, ...metric }] : [];
        }).sort((a, b) => (b.like_count + b.comment_count) - (a.like_count + a.comment_count));
        setPosts(merged);
      }
      setLoading(false);
    };
    void loadTrending().catch((error: unknown) => {
      console.error("Could not load trending posts:", error);
      setLoading(false);
    });
  }, []);

  if (loading || posts.length === 0) return null;

  return (
    <section className="px-3 py-3 border-b border-border/50 bg-card/30">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Flame className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-bold text-foreground">Trending now</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
        {posts.map((p) => (
          <Link
            key={p.id}
            to={`/post/${p.id}`}
            className="relative shrink-0 w-28 aspect-[3/4] rounded-lg overflow-hidden bg-surface"
          >
            {p.media_url ? (
              p.media_type === "video" ? (
                <video src={p.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
              ) : (
                <img src={p.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center p-2 text-[11px] text-foreground">
                {p.caption || "Post"}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-white text-[10px] font-semibold flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" />
              {p.like_count + p.comment_count}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
