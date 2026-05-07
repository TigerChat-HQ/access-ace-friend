import { useEffect, useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Trash2, Heart, MessageSquare } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profile?: { username: string | null; display_name: string | null; avatar_url: string | null };
  likeCount: number;
  likedByMe: boolean;
}

interface Props {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange?: () => void;
}

export const CommentsSheet = ({ postId, open, onOpenChange, onChange }: Props) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (!data) return;
    const ids = data.map((c) => c.id);
    const userIds = [...new Set(data.map((c) => c.user_id))];
    const [{ data: profiles }, { data: likes }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds),
      supabase.from("comment_likes" as any).select("comment_id, user_id").in("comment_id", ids),
    ]);
    const pm = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const likeMap = new Map<string, { count: number; mine: boolean }>();
    (likes || []).forEach((l: any) => {
      const cur = likeMap.get(l.comment_id) || { count: 0, mine: false };
      cur.count += 1;
      if (l.user_id === user?.id) cur.mine = true;
      likeMap.set(l.comment_id, cur);
    });
    setComments(
      data.map((c: any) => {
        const lk = likeMap.get(c.id) || { count: 0, mine: false };
        return {
          ...c,
          profile: pm.get(c.user_id) as any,
          likeCount: lk.count,
          likedByMe: lk.mine,
        };
      })
    );
  };

  useEffect(() => {
    if (open) load();
  }, [open, postId]);

  const submit = async () => {
    if (!text.trim() || !user) return;
    const content = text.trim();
    const parent_id = replyTo?.id || null;
    setText("");
    setReplyTo(null);
    await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content, parent_id } as any);
    if (parent_id) setExpanded((s) => new Set(s).add(parent_id));
    await load();
    onChange?.();
  };

  const remove = async (id: string) => {
    await supabase.from("post_comments").delete().eq("id", id);
    await load();
    onChange?.();
  };

  const toggleLike = async (c: Comment) => {
    if (!user) return;
    if (c.likedByMe) {
      await supabase.from("comment_likes" as any).delete().eq("comment_id", c.id).eq("user_id", user.id);
    } else {
      await supabase.from("comment_likes" as any).insert({ comment_id: c.id, user_id: user.id });
    }
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, likedByMe: !x.likedByMe, likeCount: x.likeCount + (x.likedByMe ? -1 : 1) } : x
      )
    );
  };

  const { roots, childrenMap } = useMemo(() => {
    const roots: Comment[] = [];
    const childrenMap = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.parent_id) {
        const arr = childrenMap.get(c.parent_id) || [];
        arr.push(c);
        childrenMap.set(c.parent_id, arr);
      } else {
        roots.push(c);
      }
    }
    return { roots, childrenMap };
  }, [comments]);

  const renderComment = (c: Comment, depth = 0) => {
    const initials = (c.profile?.display_name || "U").slice(0, 2).toUpperCase();
    const canDelete = user?.id === c.user_id || isAdmin;
    const replies = childrenMap.get(c.id) || [];
    const isExpanded = expanded.has(c.id);
    return (
      <div key={c.id} className={cn("animate-fade-in", depth > 0 && "ml-9 mt-2")}>
        <div className="flex gap-2.5 group">
          {c.profile?.avatar_url ? (
            <img src={c.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">
              <span className="font-semibold mr-1.5">{c.profile?.username || "user"}</span>
              {c.content}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[10px] text-muted-foreground">
                {new Date(c.created_at).toLocaleString()}
              </p>
              <button
                onClick={() => setReplyTo(c)}
                className="text-[11px] font-medium text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" /> Reply
              </button>
              {c.likeCount > 0 && (
                <span className="text-[11px] text-muted-foreground">{c.likeCount} likes</span>
              )}
            </div>
            {replies.length > 0 && (
              <button
                onClick={() =>
                  setExpanded((s) => {
                    const n = new Set(s);
                    n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                    return n;
                  })
                }
                className="mt-1 text-[11px] font-medium text-primary hover:underline"
              >
                {isExpanded ? "Hide" : "View"} {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button onClick={() => toggleLike(c)} className="transition-transform active:scale-125">
              <Heart
                className={cn("w-4 h-4", c.likedByMe ? "fill-red-500 text-red-500" : "text-muted-foreground")}
              />
            </button>
            {canDelete && (
              <button
                onClick={() => remove(c.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {isExpanded && replies.map((r) => renderComment(r, depth + 1))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border/50">
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {roots.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No comments yet — be the first.</p>
          ) : (
            roots.map((c) => renderComment(c))
          )}
        </div>
        {replyTo && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-surface text-xs">
            <span className="text-muted-foreground truncate">
              Replying to <span className="text-primary">@{replyTo.profile?.username || "user"}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 px-4 py-3 border-t border-border/50 bg-card"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `Reply to @${replyTo.profile?.username || "user"}...` : "Add a comment..."}
            className="flex-1 bg-surface rounded-full px-4 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button type="submit" disabled={!text.trim()} className="text-primary disabled:opacity-30">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
};
