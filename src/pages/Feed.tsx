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
import { BarChart3, Bell, Bookmark, ChevronDown, ChevronUp, Clapperboard, PlusSquare, Search, Settings as SettingsIcon, Sparkles } from "lucide-react";
import tigerLogo from "@/assets/tigerchats-logo.png";
import tigerAI from "@/assets/tiger-reaction.png";
import { supabase } from "@/integrations/supabase/client";

const Feed = () => {
  const [tab, setTab] = useState<"following" | "discover">("following");
  const { posts, loading, refetch } = useFeed(tab);
  useNotifications();
  const [aiOrder, setAiOrder] = useState<string[] | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false);

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
        <section className="relative isolate mx-3 my-3 overflow-hidden rounded-3xl border border-violet-400/25 bg-gradient-to-br from-[#101b39] via-[#211044] to-[#090d1d] shadow-[0_12px_38px_rgba(59,55,190,0.24)]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="relative flex items-center gap-3 p-3.5">
            <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl border border-blue-300/30 bg-gradient-to-br from-[#242e77] via-[#51319a] to-[#171338] shadow-[0_0_26px_rgba(80,105,255,0.35)]">
              <img src={tigerAI} alt="Tiger AI" className="h-[60px] w-[60px] object-contain drop-shadow-[0_0_12px_rgba(95,160,255,0.75)]" />
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#211044] bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-cyan-200"><Sparkles className="h-3.5 w-3.5" /> Tiger AI</div>
              <h2 className="mt-0.5 text-base font-black leading-tight text-white">Tiger AI Daily Hub</h2>
              <p className="mt-1 text-[11px] leading-4 text-blue-100/75">Status · Posts · Maarifa ya kila siku</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to="/tiger-ai" state={{ from: "/" }} className="rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-3 py-1.5 text-[10px] font-extrabold text-white shadow-lg shadow-blue-950/30">Fungua Tiger AI</Link>
                <button type="button" onClick={() => setAiExpanded((value) => !value)} aria-expanded={aiExpanded} className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-white/15">
                  {aiExpanded ? "Ficha maudhui" : "Maudhui ya leo"} {aiExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
          {aiExpanded && <div className="relative border-t border-white/10 bg-black/15 pb-1">
            <TigerAiDailyCards />
            <TigerSmartCards />
            <TigerDailyHistory />
          </div>}
        </section>
        <StoryFeedRail />
        {loading ? <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          : display.length === 0 ? <div className="text-center py-16 px-6"><Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-foreground font-semibold mb-1">No posts yet</p><p className="text-sm text-muted-foreground mb-4">{tab === "following" ? "Follow people or create your first post." : "Be the first to share something."}</p><Link to="/create" className="inline-block bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-semibold">Create a post</Link></div></>
          : <>{display.map((p) => <div key={p.id}><PostCard post={p} onChanged={refetch} /></div>)}<TrendingRail /></>}
      </div>
      <Link to="/tiger-ai" state={{ from: "/" }} className="fixed bottom-20 right-4 z-20 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform" aria-label="Fungua Tiger AI — msaidizi wa app nzima" title="Tiger AI — Msaada wa TigerChats">
        <img src={tigerAI} alt="" className="w-10 h-10" /><span className="absolute inset-0 rounded-full animate-pulse-ring border-2 border-primary" />
      </Link>
    </div>
  );
};
export default Feed;
