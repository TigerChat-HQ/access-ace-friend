import { useEffect, useMemo, useState } from "react";
import { useFeed } from "@/hooks/usePosts";
import { useNotifications } from "@/hooks/useNotifications";
import { PostCard } from "@/components/social/PostCard";
import { TrendingRail } from "@/components/social/TrendingRail";
import { TigerDailyHistory } from "@/components/social/TigerDailyHistory";
import { TigerSmartCards } from "@/components/social/TigerSmartCards";
import { TigerAiDailyCards } from "@/components/social/TigerAiDailyCards";
import { StoryFeedRail } from "@/components/social/StoryFeedRail";
import { Link } from "react-router-dom";
import { BarChart3, Bell, Bookmark, Clapperboard, PlusSquare, Search, Settings as SettingsIcon, Sparkles } from "lucide-react";
import tigerLogo from "@/assets/tigerchats-logo.png";
import tigerAI from "@/assets/tiger-reaction.png";
import { supabase } from "@/integrations/supabase/client";

const Feed = () => {
  const [tab, setTab] = useState<"following" | "discover">("following");
  const { posts, loading, refetch } = useFeed(tab);
  useNotifications();
  const [aiOrder, setAiOrder] = useState<string[] | null>(null);

  useEffect(() => {
    if (tab !== "discover") { setAiOrder(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("recommend-posts");
        if (cancelled || error) return;
        const ids = (data?.post_ids as string[]) || [];
        if (ids.length) setAiOrder(ids);
      } catch (error: unknown) { console.warn("Could not load recommended feed order:", error); }
    })();
    return () => { cancelled = true; };
  }, [tab, posts.length]);

  const display = useMemo(() => {
    if (tab !== "discover" || !aiOrder) return posts;
    const map = new Map(posts.map((p) => [p.id, p]));
    const ordered = aiOrder.map((id) => map.get(id)).filter(Boolean) as typeof posts;
    const seen = new Set(ordered.map((p) => p.id));
    return [...ordered, ...posts.filter((p) => !seen.has(p.id))];
  }, [tab, aiOrder, posts]);

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="tiger-page-header feed-page-header sticky top-0 z-10 justify-between gap-2 bg-card/80 px-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-1"><img src={tigerLogo} alt="" className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" /><h1 className="min-w-0 truncate text-sm font-bold tracking-tight text-foreground sm:text-lg">TIGER<span className="text-primary">CHATS</span></h1></div>
        <div className="flex shrink-0 items-center gap-0 sm:gap-1">
          <Link to="/search" aria-label="Search" className="tiger-header-action-compact hover:text-primary"><Search className="w-5 h-5" /></Link>
          <Link to="/reels" aria-label="Tiger Reels" className="tiger-header-action-compact hover:text-primary"><Clapperboard className="w-5 h-5" /></Link>
          <Link to="/creator" aria-label="Professional dashboard" className="tiger-header-action-compact hover:text-primary"><BarChart3 className="w-5 h-5" /></Link>
          <Link to="/create" aria-label="Create post" className="tiger-header-action-compact hover:text-primary"><PlusSquare className="w-5 h-5" /></Link>
          <Link to="/saved" aria-label="Saved posts" className="tiger-header-action-compact hover:text-primary"><Bookmark className="w-5 h-5" /></Link>
          <Link to="/notifications" aria-label="Notifications" className="tiger-header-action-compact hover:text-primary"><Bell className="w-5 h-5" /></Link>
          <Link to="/settings" aria-label="Settings" className="tiger-header-action-compact hover:text-primary"><SettingsIcon className="w-5 h-5" /></Link>
        </div>
      </header>
      <div className="flex border-b border-border/50 bg-card/50">
        {(["following", "discover"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>{t === "discover" ? "Discover ✨" : t}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <StoryFeedRail />
        <TigerAiDailyCards />
        <TigerSmartCards />
        <TigerDailyHistory />
        <TrendingRail />
        {loading ? <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          : display.length === 0 ? <div className="text-center py-20 px-6"><Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-foreground font-semibold mb-1">No posts yet</p><p className="text-sm text-muted-foreground mb-4">{tab === "following" ? "Follow people or create your first post." : "Be the first to share something."}</p><Link to="/create" className="inline-block bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-semibold">Create a post</Link></div>
          : display.map((p) => <PostCard key={p.id} post={p} onChanged={refetch} />)}
      </div>
      <Link to="/tiger-ai" state={{ from: "/" }} className="fixed bottom-20 right-4 z-20 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform" aria-label="Fungua Tiger AI — msaidizi wa app nzima" title="Tiger AI — Msaada wa TigerChats">
        <img src={tigerAI} alt="" className="w-10 h-10" /><span className="absolute inset-0 rounded-full animate-pulse-ring border-2 border-primary" />
      </Link>
    </div>
  );
};
export default Feed;
