import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Returns realtime unread message count + notification count for badges. */
export const useUnreadBadges = () => {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: members }, { count: notifC }] = await Promise.all([
      supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id),
      supabase.from("notifications").select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id).eq("is_read", false),
    ]);
    setUnreadNotifications(notifC || 0);

    const ids = (members || []).map((m) => m.conversation_id);
    if (!ids.length) { setUnreadMessages(0); return; }
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", ids)
      .neq("sender_id", user.id)
      .is("read_at", null);
    setUnreadMessages(count || 0);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`badges:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  return { unreadMessages, unreadNotifications, refresh };
};
