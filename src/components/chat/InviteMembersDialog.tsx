import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteMembersDialogProps {
  conversationId: string;
  existingMemberIds: string[];
  onInvited: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export const InviteMembersDialog = ({ conversationId, existingMemberIds, onInvited, open: controlledOpen, onOpenChange, hideTrigger = false }: InviteMembersDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [profiles, setProfiles] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .not("user_id", "in", `(${existingMemberIds.join(",")})`);
      if (data) setProfiles(data);
    };
    fetch();
  }, [open, user, existingMemberIds]);

  const toggle = (uid: string) => {
    setSelectedIds((p) => (p.includes(uid) ? p.filter((i) => i !== uid) : [...p, uid]));
  };

  const handleInvite = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    const members = selectedIds.map((uid) => ({ conversation_id: conversationId, user_id: uid }));
    await supabase.from("conversation_members").insert(members);
    toast({ title: `${selectedIds.length} member(s) invited! 🎉` });
    setOpen(false);
    setSelectedIds([]);
    setLoading(false);
    onInvited();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && <DialogTrigger asChild>
        <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary">
          <UserPlus className="w-4 h-4" />
        </button>
      </DialogTrigger>}
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Invite Members</DialogTitle>
        </DialogHeader>
        <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
          {profiles.map((p) => (
            <label key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors">
              <Checkbox checked={selectedIds.includes(p.user_id)} onCheckedChange={() => toggle(p.user_id)} />
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                {(p.display_name || "U").slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm text-foreground">{p.display_name || "User"}</span>
            </label>
          ))}
          {profiles.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No users to invite</p>}
        </div>
        <Button onClick={handleInvite} disabled={loading || selectedIds.length === 0} className="w-full neon-glow">
          {loading ? "Inviting..." : `Invite ${selectedIds.length} member(s)`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
