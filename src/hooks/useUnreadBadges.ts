import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/hooks/usePresence";

/** Returns live unread message and notification counts for navigation badges. */
export const useUnreadBadges = () => {
  const { user } = useAuth();
  usePresence(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    if (!user) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }

    const [{ data: members }, { count: notificationCount }] = await Promise.all([
      supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id),
      supabase.from("notifications").select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id).eq("is_read", false),
    ]);
    if (request !== requestId.current) return;
    setUnreadNotifications(notificationCount || 0);

    const conversationIds = (members || []).map((member) => member.conversation_id);
    if (!conversationIds.length) {
      setUnreadMessages(0);
      return;
    }

    const { count } = await supabase.from("messages").select("*", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_id", user.id)
      .eq("is_read", false)
      .is("read_at", null);
    if (request === requestId.current) setUnreadMessages(count || 0);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 100);
    };
    const channel = supabase
      .channel(`badges:${user.id}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` }, scheduleRefresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { unreadMessages, unreadNotifications, refresh };
};
