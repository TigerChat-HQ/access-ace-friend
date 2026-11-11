import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";

type Props = { postId: string; open: boolean; onOpenChange: (open: boolean) => void };
const db = supabase as any;
export const PostInsightsDialog = ({ postId, open, onOpenChange }: Props) => {
  const [counts, setCounts] = useState({ likes: 0, comments: 0, saves: 0, shares: 0 });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void Promise.all([
      supabase.from("post_likes").select("id", { count: "exact", head: true }).eq("post_id", postId),
      supabase.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", postId),
      db.from("post_saves").select("post_id", { count: "exact", head: true }).eq("post_id", postId),
      db.from("post_shares").select("id", { count: "exact", head: true }).eq("post_id", postId),
    ]).then(([likes, comments, saves, shares]) => {
      if (active) setCounts({ likes: likes.count || 0, comments: comments.count || 0, saves: saves.count || 0, shares: shares.count || 0 });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, postId]);
  const metrics = [
    { label: "Likes", value: counts.likes, icon: Heart },
    { label: "Comments", value: counts.comments, icon: MessageCircle },
    { label: "Saves", value: counts.saves, icon: Bookmark },
    { label: "Shares", value: counts.shares, icon: Share2 },
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Post insights</DialogTitle></DialogHeader><p className="text-xs text-muted-foreground">Available engagement totals for this post. Views and reach are not reported unless separately measured.</p>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading insights…</p> : <div className="grid grid-cols-2 gap-3">{metrics.map(({label,value,icon:Icon})=><div key={label} className="rounded-xl border border-border p-4"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4"/><span className="text-xs">{label}</span></div><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p></div>)}</div>}</DialogContent></Dialog>;
};
