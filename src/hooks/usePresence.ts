import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ChatPresence = {
  user_id: string;
  is_online: boolean;
  last_seen_at: string | null;
  show_last_seen: boolean;
  show_online_status: boolean;
};

/**
 * Presence is read only through an authenticated RPC. The database returns
 * only users who share a conversation with the current user; no global
 * Realtime Presence topic exposes the full user directory.
 */
export const usePresence = (trackSelf = false) => {
  const { user } = useAuth();
  const [presence, setPresence] = useState<ChatPresence[]>([]);

  useEffect(() => {
    if (!user) {
      setPresence([]);
      return;
    }

    let active = true;
    const refresh = async () => {
      const { data, error } = await (supabase as any).rpc("get_chat_presence");
      if (active && !error && Array.isArray(data)) setPresence(data as ChatPresence[]);
    };
    const touch = async () => {
      if (!document.hidden) {
        await (supabase as any).rpc("touch_my_chat_presence");
      }
    };

    void refresh();
    const refreshTimer = window.setInterval(() => { void refresh(); }, 30_000);
    let heartbeat: number | undefined;
    const onVisibilityChange = () => {
      if (document.hidden) return;
      if (trackSelf) void touch();
      void refresh();
    };
    const onPageHide = () => { if (trackSelf) void (supabase as any).rpc("touch_my_chat_presence"); };

    if (trackSelf) {
      void touch();
      heartbeat = window.setInterval(() => { void touch(); }, 60_000);
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("pagehide", onPageHide);
    }

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      if (heartbeat !== undefined) window.clearInterval(heartbeat);
      if (trackSelf) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
      }
    };
  }, [user, trackSelf]);

  const presenceByUserId = new Map(presence.map((entry) => [entry.user_id, entry]));
  const onlineUserIds = new Set(presence.filter((entry) => entry.is_online && entry.show_online_status).map((entry) => entry.user_id));

  return { onlineUserIds, presenceByUserId };
};
