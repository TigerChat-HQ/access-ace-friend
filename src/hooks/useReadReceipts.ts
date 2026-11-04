import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Marks incoming messages in a conversation as delivered (always)
 * and as read when the chat is open + tab visible.
 */
export const useReadReceipts = (
  conversationId: string | null,
  isActive: boolean,
  onMarkedRead?: () => void,
) => {
  const { user } = useAuth();

  // Mark delivered on any incoming message in any of my conversations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`deliver:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as any;
          if (m.sender_id === user.id || m.delivered_at) return;
          // Only mark if I'm a member of that conversation
          const { data: member } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", m.conversation_id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!member) return;
          await supabase
            .from("messages")
            .update({ delivered_at: new Date().toISOString() } as any)
            .eq("id", m.id)
            .is("delivered_at", null);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Mark all incoming messages as delivered/read when chat is open.
  // Refresh the conversation list immediately so its unread badge disappears.
  useEffect(() => {
    if (!user || !conversationId || !isActive) return;
    const markAll = async () => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("messages")
        .update({ delivered_at: now, read_at: now, is_read: true } as any)
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id);
      if (!error) onMarkedRead?.();
    };
    markAll();
    const onVis = () => {
      if (!document.hidden) markAll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user, conversationId, isActive, onMarkedRead]);
};
