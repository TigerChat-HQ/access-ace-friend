import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Search, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface NewGroupDialogProps {
  onCreated: (id?: string) => void;
  trigger?: React.ReactNode;
}

export const NewGroupDialog = ({ onCreated, trigger }: NewGroupDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("profiles")
      .select("id, user_id, display_name, username, avatar_url")
      .neq("user_id", user.id)
      .order("display_name", { ascending: true })
      .limit(200)
      .then(({ data }) => setProfiles((data as Profile[]) || []));
  }, [open, user]);

  const toggle = (p: Profile) => {
    setSelected((prev) =>
      prev.find((x) => x.user_id === p.user_id) ? prev.filter((x) => x.user_id !== p.user_id) : [...prev, p]
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.display_name || "").toLowerCase().includes(q) ||
        (p.username || "").toLowerCase().includes(q)
    );
  }, [profiles, query]);

  const autoName = () => {
    if (selected.length === 0) return "New group";
    const names = selected.slice(0, 3).map((p) => p.display_name || p.username || "User");
    return names.join(", ") + (selected.length > 3 ? ` +${selected.length - 3}` : "");
  };

  const handleCreate = async () => {
    if (selected.length === 0 || !user) return;
    setLoading(true);
    const name = groupName.trim() || autoName();
    const memberIds = selected.map((s) => s.user_id);

    const { data: convoId, error } = await supabase.rpc("create_group_conversation", {
      _name: name,
      _member_ids: memberIds,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Make creator first admin
    if (convoId) {
      await supabase.from("group_admins").insert({ conversation_id: convoId as string, user_id: user.id });
    }

    toast({ title: `Group "${name}" created 🎉` });
    setOpen(false);
    setGroupName("");
    setSelected([]);
    setQuery("");
    setLoading(false);
    onCreated(convoId as string | undefined);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button
            className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary"
            aria-label="New group"
          >
            <Users className="w-5 h-5" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">New group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={`Group name (or leave blank for "${autoName()}")`}
            className="bg-surface border-border/50"
          />

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => toggle(p)}
                  className="flex items-center gap-1 bg-primary/15 text-primary text-xs px-2 py-1 rounded-full"
                >
                  {p.display_name || p.username || "User"}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people..."
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-56 overflow-y-auto scrollbar-thin -mx-2">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No users found</p>
            ) : (
              filtered.map((p) => {
                const checked = !!selected.find((x) => x.user_id === p.user_id);
                return (
                  <button
                    key={p.user_id}
                    onClick={() => toggle(p)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-left"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                        {(p.display_name || p.username || "U").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{p.display_name || "User"}</p>
                      {p.username && <p className="text-[11px] text-muted-foreground truncate">@{p.username}</p>}
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        checked ? "bg-primary border-primary" : "border-border"
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading || selected.length === 0}
            className="w-full neon-glow"
          >
            {loading ? "Creating..." : `Create group${selected.length ? ` (${selected.length})` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
