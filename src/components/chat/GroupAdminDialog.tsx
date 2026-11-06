import { useState, useEffect, useRef, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  ShieldPlus,
  ShieldMinus,
  Settings as SettingsIcon,
  Camera,
  UserMinus,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  conversationId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

interface Member {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}
const db = supabase as unknown as SupabaseClient;

interface JoinRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

export const GroupAdminDialog = ({ conversationId, open: controlledOpen, onOpenChange, hideTrigger = false }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [members, setMembers] = useState<Member[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: convo } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();
    if (convo) {
      setName(convo.name || "");
      setAvatarUrl(convo.avatar_url);
      setRequiresApproval((convo as unknown as { requires_approval?: boolean }).requires_approval ?? false);
    }

    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);
    if (memberData) {
      const ids = memberData.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);
      setMembers(profiles || []);
    }

    const { data: admins } = await supabase
      .from("group_admins")
      .select("user_id")
      .eq("conversation_id", conversationId);
    const aIds = new Set((admins || []).map((a) => a.user_id));
    setAdminIds(aIds);
    setIsAdmin(aIds.has(user.id) || aIds.size === 0);

    const { data: reqs } = await db
      .from("group_join_requests")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("status", "pending");
    const pendingRequests = (reqs ?? []) as unknown as JoinRequest[];
    if (pendingRequests.length > 0) {
      const uids = pendingRequests.map((request) => request.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", uids);
      const pm = new Map(profs?.map((p) => [p.user_id, p]) || []);
      setRequests(pendingRequests.map((request) => ({ ...request, profile: pm.get(request.user_id) })));
    } else {
      setRequests([]);
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Auto-promote first member if no admins exist
  useEffect(() => {
    if (open && user && adminIds.size === 0 && members.length > 0) {
      supabase.from("group_admins").insert({ conversation_id: conversationId, user_id: user.id }).then(({ error }) => {
        if (!error) {
          setAdminIds(new Set([user.id]));
          setIsAdmin(true);
        }
      });
    }
  }, [open, user, adminIds.size, members.length, conversationId]);

  const saveDetails = async () => {
    setBusy(true);
    const { error } = await db
      .from("conversations")
      .update({ name, requires_approval: requiresApproval })
      .eq("id", conversationId);
    setBusy(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Group updated" });
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setBusy(true);
    const ext = file.name.split(".").pop();
    const path = `group-${conversationId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file);
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      setBusy(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path);
    await supabase.from("conversations").update({ avatar_url: publicUrl }).eq("id", conversationId);
    setAvatarUrl(publicUrl);
    setBusy(false);
    toast({ title: "Group photo updated" });
  };

  const toggleAdmin = async (userId: string) => {
    if (adminIds.has(userId)) {
      await supabase.from("group_admins").delete().eq("conversation_id", conversationId).eq("user_id", userId);
      setAdminIds((p) => {
        const n = new Set(p);
        n.delete(userId);
        return n;
      });
    } else {
      const { error } = await supabase
        .from("group_admins")
        .insert({ conversation_id: conversationId, user_id: userId });
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
      setAdminIds((p) => new Set(p).add(userId));
    }
  };

  const removeMember = async (userId: string) => {
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    if (error) return toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    setMembers((m) => m.filter((x) => x.user_id !== userId));
    toast({ title: "Member removed" });
  };

  const handleRequest = async (reqId: string, userId: string, approve: boolean) => {
    if (approve) {
      await supabase.from("conversation_members").insert({ conversation_id: conversationId, user_id: userId });
    }
    await supabase
      .from("group_join_requests")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", reqId);
    setRequests((r) => r.filter((x) => x.id !== reqId));
    if (approve) await load();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && <DialogTrigger asChild>
        <button
          className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary"
          title="Group settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </DialogTrigger>}
      <DialogContent className="bg-card border-border/50 max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Group Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="requests">
              Requests {requests.length > 0 && <span className="ml-1 text-primary">({requests.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 pt-3">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => isAdmin && fileRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-secondary overflow-hidden flex items-center justify-center"
                disabled={!isAdmin}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-secondary-foreground">
                    {(name || "G").slice(0, 2).toUpperCase()}
                  </span>
                )}
                {isAdmin && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Group name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
                placeholder="Group name"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground font-medium">Require approval to join</p>
                <p className="text-xs text-muted-foreground">New members need admin approval</p>
              </div>
              <Switch
                checked={requiresApproval}
                onCheckedChange={setRequiresApproval}
                disabled={!isAdmin}
              />
            </div>

            {isAdmin && (
              <Button onClick={saveDetails} disabled={busy} className="w-full">
                Save changes
              </Button>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-1 pt-3 max-h-72 overflow-y-auto">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover"
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                    {(m.display_name || "U").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {m.display_name || "User"}
                    {m.user_id === user?.id && (
                      <span className="text-muted-foreground text-xs ml-1">(you)</span>
                    )}
                  </p>
                  {adminIds.has(m.user_id) && (
                    <p className="text-[10px] text-primary font-medium">Admin</p>
                  )}
                </div>
                {isAdmin && m.user_id !== user?.id && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => toggleAdmin(m.user_id)} title="Toggle admin">
                      {adminIds.has(m.user_id) ? (
                        <ShieldMinus className="w-4 h-4 text-destructive" />
                      ) : (
                        <ShieldPlus className="w-4 h-4 text-primary" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember(m.user_id)}
                      title="Remove member"
                    >
                      <UserMinus className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="requests" className="space-y-1 pt-3 max-h-72 overflow-y-auto">
            {requests.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No pending requests</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover">
                  {r.profile?.avatar_url ? (
                    <img src={r.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                      {(r.profile?.display_name || "U").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <p className="flex-1 text-sm text-foreground truncate">
                    {r.profile?.display_name || "User"}
                  </p>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRequest(r.id, r.user_id, true)}
                      >
                        <Check className="w-4 h-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRequest(r.id, r.user_id, false)}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
