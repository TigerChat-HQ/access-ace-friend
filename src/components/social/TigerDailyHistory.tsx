import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, ExternalLink, Sparkles, Trophy, Cake, ChevronDown, Heart, MessageCircle, Share2, Send, Reply, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type HistoryItem = { year: number | null; title: string; summary: string; source_url: string };
type DailyHistory = { positive_events: HistoryItem[]; negative_events: HistoryItem[]; births: HistoryItem[] };
type DailyPost = { id: string; date_key: string; title: string; content: DailyHistory; source_urls: string[] };
type Comment = { id: string; post_id: string; parent_id: string | null; user_id: string | null; body: string; is_tiger_ai: boolean; ai_liked: boolean; created_at: string; liked_by_me: boolean; like_count: number };
const db = supabase;

const HistoryList = ({ items }: { items: HistoryItem[] }) => <ol className="space-y-3">{items.map((item, i) => <li key={item.title + i} className="text-sm"><p className="font-semibold text-foreground">{item.year ? item.year + " — " : ""}{item.title}</p><p className="mt-0.5 text-muted-foreground leading-relaxed">{item.summary}</p><a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline">Chanzo <ExternalLink className="w-3 h-3" /></a></li>)}</ol>;

export const TigerDailyHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [post, setPost] = useState<DailyPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const loadComments = async (postId: string) => {
    const { data, error } = await db.from("tiger_ai_daily_comments").select("*").eq("post_id", postId).order("created_at");
    if (error) { console.error(error); return; }
    const rows = (data || []) as Comment[], ids = rows.map(x => x.id);
    const [{ data: likes }, { data: mine }] = await Promise.all([
      ids.length ? db.from("tiger_ai_daily_comment_likes").select("comment_id").in("comment_id", ids) : Promise.resolve({ data: [] }),
      user && ids.length ? db.from("tiger_ai_daily_comment_likes").select("comment_id").in("comment_id", ids).eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    const counts = new Map<string, number>(); (likes || []).forEach((x) => counts.set(x.comment_id, (counts.get(x.comment_id) || 0) + 1));
    const mineSet = new Set((mine || []).map((x) => x.comment_id));
    setComments(rows.map(x => ({ ...x, like_count: counts.get(x.id) || 0, liked_by_me: mineSet.has(x.id) })));
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await db.from("tiger_ai_daily_posts").select("*").order("date_key", { ascending: false }).limit(1).maybeSingle();
      if (!active) return;
      if (data) {
        setPost({ ...data, content: data.content as unknown as DailyHistory });
        const [{ count }, { data: mine }] = await Promise.all([
          db.from("tiger_ai_daily_post_likes").select("*", { count: "exact", head: true }).eq("post_id", data.id),
          user ? db.from("tiger_ai_daily_post_likes").select("post_id").eq("post_id", data.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (active) { setLikeCount(count || 0); setLiked(!!mine); }
      }
      if (active) setLoading(false);
    };
    void load();
    const ch = supabase.channel("tiger-ai-daily-history-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tiger_ai_daily_posts" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tiger_ai_daily_comments" }, () => { if (post) void loadComments(post.id); })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(ch); };
  }, [user?.id, post?.id]);

  useEffect(() => { if (commentsOpen && post) void loadComments(post.id); }, [commentsOpen, post?.id, user?.id]);
  if (loading || !post) return null;
  const dateLabel = new Date(post.date_key + "T12:00:00").toLocaleDateString("sw-TZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const toggleLike = async () => {
    if (!user) { toast({ title: "Ingia kwanza", description: "Ingia ili uweke Like." }); return; }
    const next = !liked; setLiked(next); setLikeCount(n => n + (next ? 1 : -1));
    const r = next ? await db.from("tiger_ai_daily_post_likes").insert({ post_id: post.id, user_id: user.id }) : await db.from("tiger_ai_daily_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    if (r.error) { setLiked(!next); setLikeCount(n => n + (next ? -1 : 1)); toast({ title: "Like haikuhifadhiwa", description: r.error.message, variant: "destructive" }); }
  };
  const share = async () => {
    const url = window.location.href.split("#")[0] + "#tiger-ai-daily-history";
    try { if (navigator.share) await navigator.share({ title: post.title, text: "Historia ya leo kutoka Tiger AI", url }); else { await navigator.clipboard.writeText(url); toast({ title: "Kiungo kimenakiliwa" }); } }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) toast({ title: "Imeshindikana kushare", variant: "destructive" }); }
  };
  const sendComment = async () => {
    if (!user) { toast({ title: "Ingia kwanza" }); return; }
    const body = commentText.trim(); if (!body || sending) return;
    setSending(true);
    const { data, error } = await db.from("tiger_ai_daily_comments").insert({ post_id: post.id, parent_id: replyTo?.id || null, user_id: user.id, body }).select("id").single();
    if (error) toast({ title: "Maoni hayakuhifadhiwa", description: error.message, variant: "destructive" });
    else {
      setCommentText(""); setReplyTo(null); await loadComments(post.id);
      if (!replyTo) { const { error: aiError } = await supabase.functions.invoke("tiger-history-comment-reply", { body: { comment_id: data.id } }); if (aiError) console.warn("Tiger AI reply unavailable", aiError); }
    }
    setSending(false);
  };
  const toggleCommentLike = async (c: Comment) => {
    if (!user) { toast({ title: "Ingia kwanza" }); return; }
    const next = !c.liked_by_me;
    setComments(old => old.map(x => x.id === c.id ? { ...x, liked_by_me: next, like_count: x.like_count + (next ? 1 : -1) } : x));
    const r = next ? await db.from("tiger_ai_daily_comment_likes").insert({ comment_id: c.id, user_id: user.id }) : await db.from("tiger_ai_daily_comment_likes").delete().eq("comment_id", c.id).eq("user_id", user.id);
    if (r.error) { await loadComments(post.id); toast({ title: "Like haikuhifadhiwa", variant: "destructive" }); }
  };
  const roots = comments.filter(c => !c.parent_id);
  return <article id="tiger-ai-daily-history" className="mx-3 my-3 overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-sm">
    <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="w-full text-left bg-gradient-to-r from-primary/15 via-primary/5 to-accent/15 px-4 py-4">
      <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider"><Sparkles className="w-4 h-4" /> Tiger AI • Historia ya leo</div>
      <div className="mt-1 flex items-center gap-2"><h2 className="flex-1 text-lg font-extrabold text-foreground">{post.title}</h2><ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} /></div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="w-3.5 h-3.5" /> {dateLabel}</p>
      {!expanded && <p className="mt-2 text-xs text-muted-foreground">Bonyeza kichwa kufungua historia yote.</p>}
    </button>
    {expanded && <div className="space-y-5 p-4">
      <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-600"><Trophy className="w-4 h-4" /> Mambo 5 mazuri yaliyotokea</h3><HistoryList items={post.content.positive_events || []} /></section>
      <div className="border-t border-border/60" />
      <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-destructive"><AlertTriangle className="w-4 h-4" /> Mambo 5 mabaya yaliyotokea</h3><HistoryList items={post.content.negative_events || []} /></section>
      <div className="border-t border-border/60" />
      <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary"><Cake className="w-4 h-4" /> Watu maarufu waliozaliwa leo</h3><HistoryList items={post.content.births || []} /></section>
    </div>}
    <div className="flex items-center gap-5 border-t border-border/60 px-4 py-3">
      <button onClick={toggleLike} className={`inline-flex items-center gap-1.5 text-sm ${liked ? "text-primary" : "text-foreground"}`}><Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} /> {likeCount}</button>
      <button onClick={() => setCommentsOpen(v => !v)} className="inline-flex items-center gap-1.5 text-sm text-foreground"><MessageCircle className="w-5 h-5" /> {comments.length}</button>
      <button onClick={share} className="ml-auto inline-flex items-center gap-1.5 text-sm text-foreground"><Share2 className="w-5 h-5" /> Share</button>
    </div>
    {commentsOpen && <div className="border-t border-border/60 p-4 space-y-3">
      <h3 className="text-sm font-bold text-foreground">Maoni ({comments.length})</h3>
      {comments.map(c => <div key={c.id} className={c.parent_id ? "ml-5 space-y-2" : "space-y-2"}>
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="flex items-center gap-2"><span className="text-xs font-bold text-foreground">{c.is_tiger_ai ? "Tiger AI 🐯" : "Mwanachama"}</span>{c.ai_liked && <span className="text-[10px] text-primary">♥ Tiger AI amependa</span>}</div>
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
          <div className="mt-2 flex gap-4">{!c.is_tiger_ai && <button onClick={() => toggleCommentLike(c)} className={`text-xs inline-flex items-center gap-1 ${c.liked_by_me ? "text-primary" : "text-muted-foreground"}`}><Heart className={`w-3.5 h-3.5 ${c.liked_by_me ? "fill-current" : ""}`} /> {c.like_count}</button>}<button onClick={() => setReplyTo(c)} className="text-xs text-muted-foreground inline-flex items-center gap-1"><Reply className="w-3.5 h-3.5" /> Jibu</button></div>
        </div>
      </div>)}
      {replyTo && <div className="text-xs text-primary">Unajibu maoni <button onClick={() => setReplyTo(null)} className="underline">Ghairi</button></div>}
      <div className="flex gap-2"><input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendComment()} placeholder={replyTo ? "Andika jibu..." : "Andika maoni..."} className="min-w-0 flex-1 rounded-full bg-muted px-4 py-2 text-sm outline-none" /><button onClick={sendComment} disabled={sending || !commentText.trim()} className="rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div>
    </div>}
    <p className="border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground">Taarifa zimekusanywa kutoka Wikipedia On This Day. Fungua “Chanzo” kuthibitisha kila kipengele.</p>
  </article>;
};
