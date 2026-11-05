import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Tracks authenticated sessions over Supabase Realtime Presence. */
export const usePresence = (trackSelf = false) => {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setOnlineUserIds([]);
      return;
    }

    const channel = supabase.channel("global-presence", {
      config: { presence: { key: user.id } },
    });

    const syncPresence = () => {
      const state = channel.presenceState<{ userId?: string }>();
      const ids = [...new Set(
        Object.values(state).flat().map((presence) => presence.userId).filter((id): id is string => Boolean(id))
      )].sort();
      setOnlineUserIds(ids);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (trackSelf && !document.hidden) {
          void channel.track({ userId: user.id, onlineAt: new Date().toISOString() });
        }
        syncPresence();
      });

    const onVisibilityChange = () => {
      if (!trackSelf) return;
      if (document.hidden) {
        void channel.untrack();
      } else {
        void channel.track({ userId: user.id, onlineAt: new Date().toISOString() });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (trackSelf) void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [user, trackSelf]);

  return { onlineUserIds: new Set(onlineUserIds) };
};
