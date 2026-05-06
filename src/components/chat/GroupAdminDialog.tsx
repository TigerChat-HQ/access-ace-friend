import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, ShieldPlus, ShieldMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GroupAdminDialogProps {
  conversationId: string;
}

export const GroupAdminDialog = ({ conversationId }: GroupAdminDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      // Get members
      const { data: memberData } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (memberData) {
        const userIds = memberData.map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        setMembers(profiles || []);
      }

      // Get admins
      const { data: admins } = await supabase
        .from("group_admins")
        .select("user_id")
        .eq("conversation_id", conversationId);

      const ids = new Set((admins || []).map((a) => a.user_id));
      setAdminIds(ids);
      setIsAdmin(ids.has(user.id) || ids.size === 0);
    };
    load();
  }, [open, user, conversationId]);

  const toggleAdmin = async (userId: string) => {
    if (!user) return;
    setLoading(true);

    if (adminIds.has(userId)) {
      // Remove admin
      await supabase.from("group_admins").delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      setAdminIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      toast({ title: "Admin removed" });
    } else {
      // Add admin
      const { error } = await supabase.from("group_admins").insert({
        conversation_id: conversationId,
        user_id: userId,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setAdminIds((prev) => new Set(prev).add(userId));
        toast({ title: "Admin added! 🛡️" });
      }
    }
    setLoading(false);
  };

  // Make yourself admin if no admins exist
  useEffect(() => {
    if (open && user && adminIds.size === 0 && members.length > 0) {
      supabase.from("group_admins").insert({
        conversation_id: conversationId,
        user_id: user.id,
      }).then(({ error }) => {
        if (!error) setAdminIds(new Set([user.id]));
      });
    }
  }, [open, user, adminIds.size, members.length, conversationId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary" title="Manage admins">
          <Shield className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Group Admins</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover transition-colors">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                {(m.display_name || "U").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  {m.display_name || "User"}
                  {m.user_id === user?.id && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
                </p>
                {adminIds.has(m.user_id) && (
                  <p className="text-[10px] text-primary font-medium">Admin</p>
                )}
              </div>
              {isAdmin && m.user_id !== user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={loading}
                  onClick={() => toggleAdmin(m.user_id)}
                  className="shrink-0"
                >
                  {adminIds.has(m.user_id) ? (
                    <ShieldMinus className="w-4 h-4 text-destructive" />
                  ) : (
                    <ShieldPlus className="w-4 h-4 text-primary" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
