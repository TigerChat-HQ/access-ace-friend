import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useTypingIndicator = (conversationId: string | null) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Broadcast typing
  const sendTyping = useCallback(() => {
    if (!conversationId || !user) return;
    const channel = supabase.channel(`typing:${conversationId}`);
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id },
    });
  }, [conversationId, user]);

  // Listen for typing
  useEffect(() => {
    if (!conversationId || !user) return;

    const timers: Record<string, ReturnType<typeof setTimeout>> = {};

    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === user.id) return;

        setTypingUsers((prev) => {
          if (!prev.includes(payload.userId)) return [...prev, payload.userId];
          return prev;
        });

        // Clear after 3s
        if (timers[payload.userId]) clearTimeout(timers[payload.userId]);
        timers[payload.userId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== payload.userId));
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [conversationId, user]);

  // Throttled typing sender
  const notifyTyping = useCallback(() => {
    if (timeoutRef.current) return;
    sendTyping();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = undefined;
    }, 2000);
  }, [sendTyping]);

  return { typingUsers, notifyTyping };
};
