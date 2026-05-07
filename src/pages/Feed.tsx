import { useEffect, useState } from "react";
import { useFeed } from "@/hooks/usePosts";
import { useNotifications } from "@/hooks/useNotifications";
import { PostCard } from "@/components/social/PostCard";
import { TrendingRail } from "@/components/social/TrendingRail";
import { Link } from "react-router-dom";
import { Bell, PlusSquare, Search, Settings as SettingsIcon, Sparkles } from "lucide-react";
import tigerLogo from "@/assets/tigerchats-logo.png";
import { supabase } from "@/integrations/supabase/client";

const Feed = () => {
  const [tab, setTab] = useState<"following" | "discover">("following");
  const { posts, loading, refetch } = useFeed(tab);
  // Activate global notification listener (likes/comments/follows + new chat msgs)
  useNotifications();

  // AI-ranked order for Discover
  const [aiOrder, setAiOrder] = useState<string[] | null>(null);
  useEffect(() => {
    if (tab !== "discover") {
      setAiOrder(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("recommend-posts");
        if (cancelled || error) return;
        const ids = (data?.post_ids as string[]) || [];
        if (ids.length) setAiOrder(ids);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, posts.length]);

  const display = (() => {
    if (tab !== "discover" || !aiOrder) return posts;
    const map = new Map(posts.map((p) => [p.id, p]));
    const ordered = aiOrder.map((id) => map.get(id)).filter(Boolean) as typeof posts;
    const seen = new Set(ordered.map((p) => p.id));
    return [...ordered, ...posts.filter((p) => !seen.has(p.id))];
  })();

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img src={tigerLogo} alt="" className="w-7 h-7" />
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            TIGER<span className="text-primary">CHATS</span>
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/search" className="p-2 text-muted-foreground hover:text-primary">
            <Search className="w-5 h-5" />
          </Link>
          <Link to="/create" className="p-2 text-muted-foreground hover:text-primary">
            <PlusSquare className="w-5 h-5" />
          </Link>
          <Link to="/notifications" className="p-2 text-muted-foreground hover:text-primary">
            <Bell className="w-5 h-5" />
          </Link>
          <Link to="/settings" className="p-2 text-muted-foreground hover:text-primary">
            <SettingsIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <div className="flex border-b border-border/50 bg-card/50">
        {(["following", "discover"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {t === "discover" ? "Discover ✨" : t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <TrendingRail />
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : display.length === 0 ? (
          <div className="text-center py-20 px-6">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold mb-1">No posts yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              {tab === "following"
                ? "Follow people or create your first post."
                : "Be the first to share something."}
            </p>
            <Link
              to="/create"
              className="inline-block bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-semibold"
            >
              Create a post
            </Link>
          </div>
        ) : (
          display.map((p) => <PostCard key={p.id} post={p} onChanged={refetch} />)
        )}
      </div>
    </div>
  );
};

export default Feed;
