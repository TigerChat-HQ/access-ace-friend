/* eslint-disable @typescript-eslint/no-explicit-any -- pending migration tables are isolated at this Supabase boundary. */
import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Send, Reply, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type CardComment = {
  id: string;
  parent_id: string | null;
  user_id: string | null;
  mentioned_user_id: string | null;
  body: string;
  is_tiger_ai: boolean;
  ai_liked: boolean;
  created_at: string;
  username?: string | null;
  display_name?: string | null;
};

const db = supabase as any;

export const TigerSmartCardEngagement = ({ cardId }: { cardId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<CardComment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CardComment | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [{ count }, { data: mine }, { data: rows }] = await Promise.all([
      db.from("tiger_ai_smart_card_likes").select("card_id", { count: "exact", head: true }).eq("card_id", cardId),
      user ? db.from("tiger_ai_smart_card_likes").select("card_id").eq("card_id", cardId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      db.from("tiger_ai_smart_card_comments").select("id,parent_id,user_id,mentioned_user_id,body,is_tiger_ai,ai_liked,created_at").eq("card_id", cardId).order("created_at", { ascending: true }).limit(100),
    ]);
    setLikeCount(count || 0);
    setLiked(Boolean(mine));
    const commentRows = (rows || []) as CardComment[];
    const ids = [...new Set(commentRows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("user_id,username,display_name").in("user_id", ids)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
    setComments(commentRows.map((row) => ({
      ...row,
      username: row.user_id ? profileMap.get(row.user_id)?.username : null,
      display_name: row.user_id ? profileMap.get(row.user_id)?.display_name : null,
    })));
  }, [cardId, user?.id]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(`tiger-smart-card-comments:${cardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tiger_ai_smart_card_comments", filter: `card_id=eq.${cardId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [cardId, load]);

  const toggleLike = async () => {
    if (!user) { toast({ title: "Ingia kwanza", description: "Ingia ili uweke Like." }); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount((count) => count + (next ? 1 : -1));
    const result = next
      ? await db.from("tiger_ai_smart_card_likes").insert({ card_id: cardId, user_id: user.id })
      : await db.from("tiger_ai_smart_card_likes").delete().eq("card_id", cardId).eq("user_id", user.id);
    if (result.error) { await load(); toast({ title: "Like haikuhifadhiwa", variant: "destructive" }); }
  };

  const sendComment = async () => {
    if (!user) { toast({ title: "Ingia kwanza", description: "Ingia ili uulize au utoe maoni." }); return; }
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await db.from("tiger_ai_smart_card_comments")
      .insert({ card_id: cardId, parent_id: replyTo?.id || null, user_id: user.id, body })
      .select("id").single();
    if (error) {
      toast({ title: "Maoni hayakuhifadhiwa", description: error.message, variant: "destructive" });
    } else {
      setDraft("");
      setReplyTo(null);
      await load();
      const { error: aiError } = await supabase.functions.invoke("tiger-ai-smart-card-reply", { body: { comment_id: data.id } });
      if (aiError) toast({ title: "Maoni yamehifadhiwa", description: "Tiger AI atashindwa kujibu kwa sasa; jaribu tena baadaye." });
    }
    setSending(false);
  };

  return (
    <div className="border-t border-border/60 px-3 py-2.5">
      <div className="flex items-center gap-4">
        <button onClick={toggleLike} className={`inline-flex items-center gap-1.5 text-xs ${liked ? "text-rose-500" : "text-muted-foreground"}`}>
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likeCount}
        </button>
        <button onClick={() => setCommentsOpen((value) => !value)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageCircle className="h-4 w-4" /> {comments.length} maoni
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-primary"><Sparkles className="h-3 w-3" /> Tiger AI hujibu</span>
      </div>
      {commentsOpen && <div className="mt-3 space-y-2.5">
        {comments.map((comment) => (
          <div key={comment.id} className={comment.parent_id ? "ml-5 rounded-lg border border-border/50 p-2" : "rounded-lg bg-muted/40 p-2"}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              {comment.is_tiger_ai ? <><Sparkles className="h-3 w-3 text-primary" /> Tiger AI 🐯</> : `@${comment.username || comment.display_name || "mwanachama"}`}
              {comment.ai_liked && <span className="font-medium text-rose-500">♥ Tiger AI amependa</span>}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{comment.body}</p>
            {!comment.is_tiger_ai && <button onClick={() => setReplyTo(comment)} className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary"><Reply className="h-3 w-3" /> Jibu</button>}
          </div>
        ))}
        {replyTo && <div className="flex items-center justify-between text-[10px] text-primary"><span>Unamjibu @{replyTo.username || "mwanachama"} · Tiger AI pia atajibu</span><button onClick={() => setReplyTo(null)}>Ghairi</button></div>}
        <form onSubmit={(event) => { event.preventDefault(); void sendComment(); }} className="flex items-center gap-2">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={replyTo ? "Andika jibu..." : "Uliza swali au toa maoni..."} maxLength={2000} className="min-w-0 flex-1 rounded-full bg-muted px-3 py-2 text-xs outline-none" />
          <button type="submit" disabled={!draft.trim() || sending} className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>}
    </div>
  );
};
