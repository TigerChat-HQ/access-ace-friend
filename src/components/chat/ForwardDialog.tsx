import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useChat";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ForwardDialogProps {
  open: boolean;
  onClose: () => void;
  messageContent: string;
  messageType: string;
  mediaUrl?: string;
}

export const ForwardDialog = ({ open, onClose, messageContent, messageType, mediaUrl }: ForwardDialogProps) => {
  const { user } = useAuth();
  const { conversations } = useConversations();
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  const filtered = conversations.filter((c) => {
    const name = c.otherProfile?.display_name || c.name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleForward = async (conversationId: string) => {
    if (!user) return;
    setSending(true);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: messageContent ? `↪ ${messageContent}` : messageContent,
      message_type: messageType,
      media_url: mediaUrl || null,
    });
    setSending(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Forward Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => handleForward(c.id)}
                disabled={sending}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-hover transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                  {(c.otherProfile?.display_name || c.name || "C").slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-medium text-foreground truncate">
                  {c.otherProfile?.display_name || c.name || "Chat"}
                </p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No conversations</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
