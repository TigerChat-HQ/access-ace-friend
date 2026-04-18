import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface NewGroupDialogProps {
  onCreated: () => void;
}

export const NewGroupDialog = ({ onCreated }: NewGroupDialogProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, avatar_url")
        .neq("user_id", user.id);
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, [open, user]);

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedIds.length === 0 || !user) return;
    setLoading(true);

    const { data: convoId, error } = await supabase.rpc("create_group_conversation", {
      _name: groupName,
      _member_ids: selectedIds,
    });

    if (error || !convoId) {
      toast({ title: "Error", description: error?.message || "Failed to create group", variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: `Group "${groupName}" created! 🎉` });
    setOpen(false);
    setGroupName("");
    setSelectedIds([]);
    setLoading(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary" aria-label="New group">
          <Users className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">{t("newGroup")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t("groupName")}
            className="bg-surface border-border/50"
          />
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t("addMembers")}</p>
            <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-thin">
              {profiles.map((p) => (
                <label
                  key={p.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.includes(p.user_id)}
                    onCheckedChange={() => toggleUser(p.user_id)}
                  />
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                    {(p.display_name || "U").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-foreground">{p.display_name || "User"}</span>
                </label>
              ))}
              {profiles.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
              )}
            </div>
          </div>
          <Button
            onClick={handleCreate}
            disabled={loading || !groupName.trim() || selectedIds.length === 0}
            className="w-full neon-glow"
          >
            {loading ? "Creating..." : t("createGroup")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
