import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useTypingIndicator = (conversationId: string | null) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!conversationId || !user) {
      setTypingUsers([]);
      return;
    }

    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    const channel = supabase.channel(`typing:${conversationId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload?.userId || payload.userId === user.id) return;
        setTypingUsers((prev) => prev.includes(payload.userId) ? prev : [...prev, payload.userId]);
        if (timers[payload.userId]) clearTimeout(timers[payload.userId]);
        timers[payload.userId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== payload.userId));
          delete timers[payload.userId];
        }, 3000);
      })
      .subscribe((status) => {
        subscribedRef.current = status === "SUBSCRIBED";
      });

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      setTypingUsers([]);
      Object.values(timers).forEach(clearTimeout);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const notifyTyping = useCallback(() => {
    if (!user || !conversationId || !subscribedRef.current || !channelRef.current) return;
    if (timeoutRef.current) return;
    void channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id },
    });
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = undefined;
    }, 1200);
  }, [conversationId, user]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { typingUsers, notifyTyping };
};
