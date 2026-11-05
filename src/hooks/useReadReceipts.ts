import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Marks incoming messages in a conversation as delivered (always)
 * and as read when the chat is open + tab visible.
 */
export const useReadReceipts = (conversationId: string | null, isActive: boolean) => {
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
          if (m.sender_id === user.id) return;

          // If the conversation is currently open and visible, mark as delivered AND read immediately
          const isCurrentlyViewing = isActive && conversationId === m.conversation_id && !document.hidden;
          const now = new Date().toISOString();

          // Only mark if I'm a member of that conversation
          const { data: member } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", m.conversation_id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!member) return;

          if (isCurrentlyViewing) {
            await supabase
              .from("messages")
              .update({ delivered_at: now, read_at: now, is_read: true } as any)
              .eq("id", m.id)
              .is("read_at", null);
          } else if (!m.delivered_at) {
            await supabase
              .from("messages")
              .update({ delivered_at: now } as any)
              .eq("id", m.id)
              .is("delivered_at", null);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversationId, isActive]);

  // Mark all unread+undelivered as delivered/read when chat is open
  useEffect(() => {
    if (!user || !conversationId || !isActive) return;
    const markAll = async () => {
      if (document.hidden) return;
      const now = new Date().toISOString();
      await supabase
        .from("messages")
        .update({ delivered_at: now, read_at: now, is_read: true } as any)
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("read_at", null);
    };
    markAll();
    const onVis = () => {
      if (!document.hidden) markAll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user, conversationId, isActive]);
};
