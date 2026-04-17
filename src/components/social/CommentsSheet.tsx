import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { username: string | null; display_name: string | null; avatar_url: string | null };
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

  const load = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (!data) return;
    const userIds = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", userIds);
    const pm = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    setComments(data.map((c) => ({ ...c, profile: pm.get(c.user_id) as any })));
  };

  useEffect(() => {
    if (open) load();
  }, [open, postId]);

  const submit = async () => {
    if (!text.trim() || !user) return;
    const content = text.trim();
    setText("");
    await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content });
    await load();
    onChange?.();
  };

  const remove = async (id: string) => {
    await supabase.from("post_comments").delete().eq("id", id);
    await load();
    onChange?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border/50">
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No comments yet — be the first.</p>
          ) : (
            comments.map((c) => {
              const initials = (c.profile?.display_name || "U").slice(0, 2).toUpperCase();
              const canDelete = user?.id === c.user_id || isAdmin;
              return (
                <div key={c.id} className="flex gap-2.5 group">
                  {c.profile?.avatar_url ? (
                    <img src={c.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => remove(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
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
            placeholder="Add a comment..."
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
