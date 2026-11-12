import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/hooks/usePresence";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLastSeen } from "@/lib/chat-presence";
import { useCreateConversation, useConversations } from "@/hooks/useChat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MessageSquarePlus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean | null;
  last_seen: string | null;
  show_last_seen: boolean;
  show_online_status: boolean;
}

interface NewDmDialogProps {
  onStarted: (conversationId: string) => void;
}

export const NewDmDialog = ({ onStarted }: NewDmDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { onlineUserIds } = usePresence(false);
  const { language } = useLanguage();
  const { createDirectConversation } = useCreateConversation();
  const { conversations } = useConversations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, bio, is_online, last_seen, show_last_seen, show_online_status")
        .neq("user_id", user.id);
      if (data) setProfiles(data);
    };
    fetch();
  }, [open, user]);

  const filtered = profiles.filter((p) =>
    (p.display_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (otherUserId: string) => {
    // Check if DM already exists
    const existing = conversations.find(
      (c) => c.type === "direct" && c.otherProfile?.user_id === otherUserId
    );
    if (existing) {
      onStarted(existing.id);
      setOpen(false);
      return;
    }

    setLoading(true);
    const convo = await createDirectConversation(otherUserId);
    setLoading(false);
    if (convo) {
      onStarted(convo.id);
      setOpen(false);
      toast({ title: "Chat started! 💬" });
    } else {
      toast({ title: "Failed to start chat", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary" aria-label="New message">
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
            {filtered.map((p) => (
              <button
                key={p.user_id}
                onClick={() => handleSelect(p.user_id)}
                disabled={loading}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-hover transition-colors text-left"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                    {(p.display_name || "U").slice(0, 2).toUpperCase()}
                  </div>
                  {onlineUserIds.has(p.user_id) && p.show_online_status !== false && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.display_name || "User"}</p>
                  {p.bio && <p className="text-[11px] text-muted-foreground truncate">{p.bio}</p>}
                  <p className={onlineUserIds.has(p.user_id) && p.show_online_status !== false ? "text-[10px] font-medium text-emerald-500" : "text-[10px] text-muted-foreground"}>{onlineUserIds.has(p.user_id) && p.show_online_status !== false ? (language === "sw" ? "Mtandaoni" : "Online") : p.show_last_seen !== false ? formatLastSeen(p.last_seen, language) : (language === "sw" ? "Hajapatikana" : "Offline")}</p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No users found</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
