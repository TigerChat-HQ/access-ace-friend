import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * One shared presence channel per signed-in user. Supabase returns the same
 * channel object for a repeated topic, so callbacks must be registered once
 * before subscribe(); every hook instance listens through this shared hub.
 */
type Hub = {
  userId: string;
  channel: RealtimeChannel;
  listeners: Set<(ids: string[]) => void>;
  trackers: number;
  subscribed: boolean;
  ids: string[];
};

let hub: Hub | null = null;

const payload = (userId: string) => ({ userId, onlineAt: new Date().toISOString() });

const updateTracking = (h: Hub) => {
  if (!h.subscribed) return;
  if (h.trackers > 0 && !document.hidden) void h.channel.track(payload(h.userId));
  else void h.channel.untrack();
};

const onVisibility = () => { if (hub) updateTracking(hub); };

const getHub = (userId: string): Hub => {
  if (hub && hub.userId === userId) return hub;
  if (hub) {
    document.removeEventListener("visibilitychange", onVisibility);
    void supabase.removeChannel(hub.channel);
  }
  const channel = supabase.channel("global-presence", { config: { presence: { key: userId } } });
  const h: Hub = { userId, channel, listeners: new Set(), trackers: 0, subscribed: false, ids: [] };
  const sync = () => {
    const state = channel.presenceState<{ userId?: string }>();
    h.ids = [...new Set(Object.values(state).flat().map((p) => p.userId).filter((id): id is string => Boolean(id)))].sort();
    h.listeners.forEach((l) => l(h.ids));
  };
  channel
    .on("presence", { event: "sync" }, sync)
    .on("presence", { event: "join" }, sync)
    .on("presence", { event: "leave" }, sync)
    .subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      h.subscribed = true;
      updateTracking(h);
      sync();
    });
  document.addEventListener("visibilitychange", onVisibility);
  hub = h;
  return h;
};

const release = (h: Hub) => {
  if (h.listeners.size > 0 || hub !== h) return;
  document.removeEventListener("visibilitychange", onVisibility);
  void supabase.removeChannel(h.channel);
  hub = null;
};

/** Tracks authenticated sessions over Supabase Realtime Presence. */
export const usePresence = (trackSelf = false) => {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setOnlineUserIds([]);
      return;
    }
    const h = getHub(user.id);
    const listener = (ids: string[]) => setOnlineUserIds(ids);
    h.listeners.add(listener);
    setOnlineUserIds(h.ids);
    if (trackSelf) { h.trackers += 1; updateTracking(h); }

    return () => {
      h.listeners.delete(listener);
      if (trackSelf) { h.trackers -= 1; updateTracking(h); }
      release(h);
    };
  }, [user, trackSelf]);

  return { onlineUserIds: new Set(onlineUserIds) };
};
