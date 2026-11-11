import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, X } from "lucide-react";

type Collaborator = { id: string; invitee_id: string; status: string; profile?: { username: string | null; display_name: string | null } };
const db = supabase as any;
export const PostCollaborationDialog = ({ postId, open, onOpenChange }: { postId: string; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const load = useCallback(async () => {
    const { data } = await db.from("post_collaborators").select("id,invitee_id,status").eq("post_id", postId).order("created_at", { ascending: true });
    const rows = (data || []) as Collaborator[];
    const ids = rows.map(row => row.invitee_id);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("user_id,username,display_name").in("user_id", ids) : { data: [] };
    const byId = new Map((profiles || []).map(profile => [profile.user_id, profile]));
    setCollaborators(rows.map(row => ({ ...row, profile: byId.get(row.invitee_id) })));
  }, [postId]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !username.trim() || busy) return;
    setBusy(true);
    const handle = username.trim().replace(/^@/, "");
    const { data: profile } = await supabase.from("profiles").select("user_id,username").ilike("username", handle).maybeSingle();
    if (!profile) { toast({ title: "Account not found", description: "Check the username and try again.", variant: "destructive" }); setBusy(false); return; }
    if (profile.user_id === user.id) { toast({ title: "You cannot invite yourself", variant: "destructive" }); setBusy(false); return; }
    const { error } = await db.from("post_collaborators").insert({ post_id: postId, inviter_id: user.id, invitee_id: profile.user_id });
    if (error) toast({ title: "Invitation could not be sent", description: error.code === "23505" ? "This account has already been invited." : error.message, variant: "destructive" });
    else {
      const { error: notificationError } = await supabase.from("notifications").insert({
        recipient_id: profile.user_id,
        actor_id: user.id,
        type: "collaboration_invite",
        post_id: postId,
      });
      if (notificationError) console.warn("Collaboration invitation notification could not be created", notificationError);
      toast({ title: "Collaboration invitation sent" });
      setUsername("");
      await load();
    }
    setBusy(false);
  };
  const cancel = async (id: string) => {
    const { error } = await db.from("post_collaborators").delete().eq("id", id);
    if (error) toast({ title: "Could not remove invitation", description: error.message, variant: "destructive" });
    else await load();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Invite collaborators</DialogTitle></DialogHeader><p className="text-xs text-muted-foreground">Invite another TigerChat account to appear as a collaborator on this post. They must accept before the invitation becomes active.</p><form onSubmit={invite} className="flex gap-2"><Input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username" maxLength={40}/><Button type="submit" disabled={!username.trim()||busy}><UserPlus className="h-4 w-4"/></Button></form><div className="space-y-2">{collaborators.map(c=><div key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">@{c.profile?.username || "user"}</p><p className="text-[10px] capitalize text-muted-foreground">{c.status}</p></div>{c.status==="pending"&&<button onClick={()=>void cancel(c.id)} aria-label="Cancel invitation" className="p-2 text-muted-foreground hover:text-destructive"><X className="h-4 w-4"/></button>}</div>)}</div></DialogContent></Dialog>;
};
