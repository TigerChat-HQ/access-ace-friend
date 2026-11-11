/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types do not yet include the pending PR migrations; any casts are isolated to the database boundary. */
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playRingtone } from "@/lib/ringtones";
import { enablePush } from "@/lib/firebase-push";
import { getNotificationPreferences } from "@/lib/notification-preferences";

const tryShowSwNotification = async (payload: { title: string; body: string; url: string; tag: string }) => {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.active) {
      await reg.showNotification(payload.title, { body: payload.body, icon: "/pwa-icon-192.png", tag: payload.tag, silent: false, data: { url: payload.url } });
      return true;
    }
  } catch (error) {
    console.warn("Could not show service-worker notification:", error);
  }
  return false;
};

type IncomingMessageRow = {
  sender_id: string;
  message_type: string;
  content: string | null;
  conversation_id: string;
  reply_to_id?: string | null;
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
    if (!user) return false;
    return (await enablePush(user.id)).startsWith("Background notifications enabled");
  }, [user]);

  const showNotification = useCallback(
    async (title: string, body: string, opts?: { url?: string; tag?: string; icon?: string; force?: boolean; kind?: "chat" | "social" }) => {
      const preferences = getNotificationPreferences(user?.id);
      if (!preferences.enabled) return;
      if (opts?.kind === "chat" && !preferences.chat) return;
      if (opts?.kind === "social" && !preferences.social) return;
      if (!document.hidden && opts?.kind) {
        window.dispatchEvent(new CustomEvent("tiger:notification", { detail: { title, body, url: opts.url || "/", tag: opts.tag || "tigerchats", kind: opts.kind, icon: opts.icon || "" } }));
        if (preferences.vibration && typeof navigator.vibrate === "function") navigator.vibrate(120);
      }
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
    [user]
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
          const { data: chatPreference } = await (supabase as any).from("chat_preferences")
            .select("muted_until").eq("user_id", user.id).eq("conversation_id", msg.conversation_id).maybeSingle();
          if (chatPreference?.muted_until && new Date(chatPreference.muted_until).getTime() > Date.now()) return;
          const preferences = getNotificationPreferences(user.id);
          if (preferences.enabled && preferences.chat && preferences.sound) {
            const stop = playRingtone("incoming_sms");
            window.setTimeout(stop, 1500);
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name,avatar_url")
            .eq("user_id", msg.sender_id)
            .single();

          const senderName = profile?.display_name || "Someone";
          let title = senderName;
          let body =
            msg.message_type === "voice"
              ? "🎤 Voice message"
              : msg.message_type === "image"
              ? "📷 Image"
              : msg.message_type === "file"
              ? "📎 File"
              : msg.content || "New message";

          if (msg.reply_to_id) {
            const { data: parent } = await supabase
              .from("messages")
              .select("sender_id")
              .eq("id", msg.reply_to_id)
              .eq("conversation_id", msg.conversation_id)
              .maybeSingle();
            title = parent?.sender_id === user.id ? `${senderName} replied to your message` : `${senderName} replied in chat`;
            body = `↪ ${msg.content || body}`;
          }

          showNotification(title, body, {
            url: `/chats?c=${msg.conversation_id}`,
            tag: msg.reply_to_id ? `thread-${msg.reply_to_id}` : `msg-${msg.conversation_id}`,
            kind: "chat",
            icon: profile?.avatar_url || undefined,
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
            .select("display_name, username, avatar_url")
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
              : n.type === "collaboration_invite"
              ? `${name} invited you to collaborate on a post`
              : n.type === "collaboration_accepted"
              ? `${name} accepted your post collaboration invitation`
              : `${name} mentioned you`;
          const url = n.type === "collaboration_invite" ? "/collaborations" : n.post_id ? `/post/${n.post_id}` : `/u/${n.actor_id}`;
          showNotification("TIGERCHATS", body, { url, tag: `social-${n.id}`, kind: "social", icon: actor?.avatar_url || undefined });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification]);

  return { requestPermission, showNotification };
};
