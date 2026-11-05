import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Marks incoming messages delivered and read as soon as the active conversation is open.
 * Keeps sender-side ticks in sync with the real database state so blue checks are accurate.
 */
export const useReadReceipts = (conversationId: string | null, isActive: boolean) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`deliver:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const message = payload.new as any;
          if (message.sender_id === user.id) return;

          const { data: membership } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", message.conversation_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!membership) return;

          const now = new Date().toISOString();
          const viewingNow = isActive && conversationId === message.conversation_id && !document.hidden;

          if (viewingNow) {
            await supabase
              .from("messages")
              .update({ delivered_at: now, read_at: now, is_read: true } as any)
              .eq("id", message.id)
              .eq("is_read", false);
          } else if (!message.delivered_at && !message.is_read && !message.read_at) {
            await supabase
              .from("messages")
              .update({ delivered_at: now } as any)
              .eq("id", message.id)
              .is("delivered_at", null);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, conversationId, isActive]);

  useEffect(() => {
    if (!user || !conversationId || !isActive) return;

    const markAllRead = async () => {
      if (document.hidden) return;
      const now = new Date().toISOString();
      await supabase
        .from("messages")
        .update({ delivered_at: now, read_at: now, is_read: true } as any)
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .eq("is_read", false);
    };

    void markAllRead();

    const onVisibilityChange = () => {
      if (!document.hidden) void markAllRead();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [user, conversationId, isActive]);
};
