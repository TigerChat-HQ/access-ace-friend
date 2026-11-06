import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type MessageReceipt = Tables<"messages"> & { delivered_at?: string | null; read_at?: string | null; is_read?: boolean | null };
type MessageReceiptUpdate = { delivered_at?: string; read_at?: string; is_read?: boolean };
const db = supabase as unknown as SupabaseClient;

/** Marks messages delivered when they reach a member and read when that chat is open. */
export const useReadReceipts = (conversationId: string | null, isActive: boolean) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    const updateVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`deliver:${user.id}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const message = payload.new as unknown as MessageReceipt;
        if (message.sender_id === user.id) return;

        const { data: membership } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", message.conversation_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!membership) return;

        const now = new Date().toISOString();
        const viewingNow = isActive && visible && conversationId === message.conversation_id;
        const update = viewingNow
          ? { delivered_at: now, read_at: now, is_read: true }
          : { delivered_at: now };
        const query = db.from("messages").update(update as MessageReceiptUpdate).eq("id", message.id);
        if (viewingNow) await query.eq("is_read", false);
        else if (!message.delivered_at && !message.is_read && !message.read_at) await query.is("delivered_at", null);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, conversationId, isActive, visible]);

  useEffect(() => {
    if (!user || !conversationId || !isActive || !visible) return;

    const markAllRead = async () => {
      const now = new Date().toISOString();
      await supabase
        .from("messages")
        .update({ delivered_at: now, read_at: now, is_read: true } as MessageReceiptUpdate)
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
  }, [user, conversationId, isActive, visible]);
};
