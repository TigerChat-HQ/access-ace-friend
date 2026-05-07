import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const tryShowSwNotification = async (payload: { title: string; body: string; url: string; tag: string }) => {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.active) {
      reg.active.postMessage({ type: "show-notification", payload });
      return true;
    }
  } catch {}
  return false;
};

export const useNotifications = () => {
  const { user } = useAuth();

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  const showNotification = useCallback(
    async (title: string, body: string, opts?: { url?: string; tag?: string; icon?: string; force?: boolean }) => {
      if (Notification.permission !== "granted") return;
      if (!opts?.force && !document.hidden) return;
      const payload = {
        title,
        body,
        url: opts?.url || "/",
        tag: opts?.tag || "tigerchats",
        icon: opts?.icon || "/pwa-icon-192.png",
      };
      // Prefer SW so it persists as a bubble; fall back to page Notification
      const ok = await tryShowSwNotification(payload);
      if (!ok) {
        const n = new Notification(title, {
          body,
          icon: payload.icon,
          badge: "/pwa-icon-192.png",
          tag: payload.tag,
        } as NotificationOptions);
        n.onclick = () => {
          window.focus();
          if (payload.url) window.location.assign(payload.url);
          n.close();
        };
      }
    },
    []
  );

  // Listen for new chat messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-msg")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", msg.sender_id)
            .single();

          const senderName = profile?.display_name || "Someone";
          const body =
            msg.message_type === "voice"
              ? "🎤 Voice message"
              : msg.message_type === "image"
              ? "📷 Image"
              : msg.message_type === "file"
              ? "📎 File"
              : msg.content || "New message";

          showNotification(senderName, body, {
            url: `/chats?c=${msg.conversation_id}`,
            tag: `msg-${msg.conversation_id}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification]);

  // Listen for social notifications (likes, comments, follows)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`social-notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        async (payload) => {
          const n = payload.new as any;
          const { data: actor } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("user_id", n.actor_id)
            .single();
          const name = actor?.display_name || actor?.username || "Someone";
          const body =
            n.type === "like"
              ? `${name} liked your post`
              : n.type === "comment"
              ? `${name} commented on your post`
              : n.type === "follow"
              ? `${name} started following you`
              : n.type === "reply"
              ? `${name} replied to your comment`
              : n.type === "comment_like"
              ? `${name} liked your comment`
              : `${name} mentioned you`;
          const url = n.post_id ? `/post/${n.post_id}` : `/u/${n.actor_id}`;
          showNotification("TIGERCHATS", body, { url, tag: `social-${n.id}` });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification]);

  // Request permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return { requestPermission, showNotification };
};
