import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playRingtone } from "@/lib/ringtones";

const tryShowSwNotification = async (payload: { title: string; body: string; url: string; tag: string }) => {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.active) {
      reg.active.postMessage({ type: "show-notification", payload });
      return true;
    }
  } catch (error) {
    console.warn("Could not show service-worker notification:", error);
  }
  return false;
};

const decodeApplicationServerKey = (key: string) => {
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
};

type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  subscription: PushSubscriptionJSON;
};

type PushSubscriptionsWriter = {
  from: (table: "push_subscriptions") => {
    upsert: (
      values: PushSubscriptionRow,
      options: { onConflict: "endpoint" },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

type IncomingMessageRow = {
  sender_id: string;
  message_type: string;
  content: string | null;
  conversation_id: string;
};

type SocialNotificationRow = {
  actor_id: string;
  type: string;
  post_id: string | null;
  id: string;
};

export const useNotifications = () => {
  const { user } = useAuth();

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window) || !user) return false;
    const permission = Notification.permission === "granted"
      ? "granted"
      : Notification.permission === "denied"
      ? "denied"
      : await Notification.requestPermission();
    if (permission !== "granted") return false;

    const applicationServerKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
    if (!applicationServerKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return true;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(applicationServerKey),
        });
      }
      const pushSubscriptions = supabase as unknown as PushSubscriptionsWriter;
      const { error } = await pushSubscriptions.from("push_subscriptions").upsert(
        { user_id: user.id, endpoint: subscription.endpoint, subscription: subscription.toJSON() },
        { onConflict: "endpoint" },
      );
      if (error) console.warn("Could not save push subscription:", error.message);
    } catch (error) {
      // Notifications remain available in an open tab even if Web Push setup is unavailable.
      console.warn("Web Push subscription failed:", error);
    }
    return true;
  }, [user]);

  const showNotification = useCallback(
    async (title: string, body: string, opts?: { url?: string; tag?: string; icon?: string; force?: boolean }) => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      if (!opts?.force && !document.hidden) return;
      const payload = {
        title,
        body,
        url: opts?.url || "/",
        tag: opts?.tag || "tigerchats",
        icon: opts?.icon || "/pwa-icon-192.png",
      };
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
      .channel(`notifications-msg-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as unknown as IncomingMessageRow;
          if (msg.sender_id === user.id) return;
          const stop = playRingtone("incoming_sms");
          window.setTimeout(stop, 1500);

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
      .channel(`social-notif:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        async (payload) => {
          const n = payload.new as unknown as SocialNotificationRow;
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

  return { requestPermission, showNotification };
};
