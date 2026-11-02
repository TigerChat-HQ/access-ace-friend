import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: "like" | "comment" | "follow" | "mention" | "reply" | "comment_like" | "report_reply";
  post_id: string | null;
  comment_id: string | null;
  report_id?: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const useNotificationsFeed = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) {
      setItems([]);
      setLoading(false);
      return;
    }
    const actorIds = [...new Set(data.map((n) => n.actor_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", actorIds);
    const map = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    setItems(
      data.map((n) => ({ ...n, actor: map.get(n.actor_id) })) as AppNotification[]
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => fetchItems()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchItems]);

  const unreadCount = items.filter((i) => !i.is_read).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    fetchItems();
  };

  return { items, loading, unreadCount, refetch: fetchItems, markAllRead };
};
