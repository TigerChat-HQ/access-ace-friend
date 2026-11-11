import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Invite = { id: string; post_id: string; inviter_id: string; status: string; post?: { id: string; caption: string | null; media_url: string | null }; profile?: { username: string | null; display_name: string | null } };
const db = supabase as any;
const PostCollaborations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await db.from("post_collaborators").select("id,post_id,inviter_id,status").eq("invitee_id", user.id).order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load invitations", description: error.message, variant: "destructive" });
    const rows = (data || []) as Invite[];
    const inviterIds = [...new Set(rows.map(row=>row.inviter_id))];
    const postIds = [...new Set(rows.map(row=>row.post_id))];
    const [{ data: profiles }, { data: posts }] = await Promise.all([
      inviterIds.length ? supabase.from("profiles").select("user_id,username,display_name").in("user_id",inviterIds) : Promise.resolve({data:[]}),
      postIds.length ? supabase.from("posts").select("id,caption,media_url").in("id",postIds) : Promise.resolve({data:[]}),
    ]);
    const profileMap = new Map((profiles||[]).map(p=>[p.user_id,p]));
    const postMap = new Map((posts||[]).map(p=>[p.id,p]));
    setInvites(rows.map(row=>({...row,profile:profileMap.get(row.inviter_id),post:postMap.get(row.post_id)})));
    setLoading(false);
  }, [user, toast]);
  useEffect(()=>{void load();},[load]);
  const respond = async (invite: Invite, status: "accepted"|"declined") => {
    const { error } = await db.from("post_collaborators").update({status,updated_at:new Date().toISOString()}).eq("id",invite.id).eq("invitee_id",user?.id);
    if (error) toast({title:"Could not update invitation",description:error.message,variant:"destructive"});
    else {
      if (status === "accepted" && user?.id) {
        const { error: notificationError } = await supabase.from("notifications").insert({
          recipient_id: invite.inviter_id,
          actor_id: user.id,
          type: "collaboration_accepted",
          post_id: invite.post_id,
        });
        if (notificationError) console.warn("Collaboration response notification could not be created", notificationError);
      }
      toast({title:status==="accepted"?"Collaboration accepted":"Invitation declined"});
      await load();
    }
  };
  const pending=invites.filter(i=>i.status==="pending");
  const history=invites.filter(i=>i.status!=="pending");
  return <div className="flex h-full flex-col bg-background"><header className="tiger-page-header gap-3"><Link to="/" className="tiger-header-action" aria-label="Back"><ArrowLeft className="h-5 w-5"/></Link><h1 className="text-sm font-semibold">Post collaborations</h1></header><div className="flex-1 space-y-4 overflow-y-auto p-4">{loading?<p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>:pending.length===0&&history.length===0?<div className="py-16 text-center"><Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><p className="font-semibold">No collaboration invitations</p><p className="mt-1 text-sm text-muted-foreground">Invitations you receive will appear here.</p></div>:<><section className="space-y-2"><h2 className="text-xs font-semibold text-muted-foreground">PENDING</h2>{pending.map(invite=><div key={invite.id} className="flex gap-3 rounded-xl border border-border p-3">{invite.post?.media_url&&<img src={invite.post.media_url} alt="" className="h-16 w-16 rounded-lg object-cover"/>}<div className="min-w-0 flex-1"><p className="text-sm"><strong>@{invite.profile?.username||"user"}</strong> invited you to collaborate</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{invite.post?.caption||"A TigerChat post"}</p><div className="mt-2 flex gap-2"><Button size="sm" onClick={()=>void respond(invite,"accepted")}><Check className="mr-1 h-3 w-3"/>Accept</Button><Button size="sm" variant="outline" onClick={()=>void respond(invite,"declined")}><X className="mr-1 h-3 w-3"/>Decline</Button></div></div></div>)}</section><section className="space-y-2"><h2 className="text-xs font-semibold text-muted-foreground">HISTORY</h2>{history.map(invite=><div key={invite.id} className="rounded-lg border border-border p-3 text-xs"><span className="font-medium">@{invite.profile?.username||"user"}</span> · <span className="capitalize text-muted-foreground">{invite.status}</span></div>)}</section></>}</div></div>;
};
export default PostCollaborations;
