import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useNotifications = () => {
  const { user } = useAuth();

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  const showNotification = useCallback((title: string, body: string, icon?: string) => {
    if (Notification.permission !== "granted") return;
    // Only show if tab is not focused
    if (!document.hidden) return;
    const n = new Notification(title, {
      body,
      icon: icon || "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      tag: "tigerchats-msg",
    } as NotificationOptions);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }, []);

  // Listen for new messages in real-time
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;

          // Fetch sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", msg.sender_id)
            .single();

          const senderName = profile?.display_name || "Someone";
          const body = msg.message_type === "voice"
            ? "🎤 Voice message"
            : msg.message_type === "image"
            ? "📷 Image"
            : msg.message_type === "file"
            ? "📎 File"
            : msg.content || "New message";

          showNotification(senderName, body);
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
