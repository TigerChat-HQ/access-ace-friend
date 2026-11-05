import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
type Profile = Tables<"profiles">;

export const useMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<(Message & { sender_profile?: Profile })[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { messages, loading, refetch: fetchMessages };
};

export const useSendMessage = () => {
  const { user } = useAuth();

  const sendMessage = async (conversationId: string, content: string, type = "text") => {
    if (!user) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      message_type: type,
    });
    return { error };
  };

  return { sendMessage };
};

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!memberData?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convoIds = memberData.map((m) => m.conversation_id);

    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convoIds)
      .order("updated_at", { ascending: false });

    // Fetch latest message and other member profile for each
    const enriched = await Promise.all(
      (convos || []).map(async (convo) => {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", convo.id)
          .neq("user_id", user.id);

        let otherProfile: Profile | null = null;
        if (members?.length) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", members[0].user_id)
            .single();
          otherProfile = profile;
        }

        const { count: unreadCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", convo.id)
          .eq("is_read", false)
          .neq("sender_id", user.id);

        return {
          ...convo,
          lastMessage: lastMsg,
          otherProfile,
          unreadCount: unreadCount || 0,
        };
      })
    );

    setConversations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Subscribe to real-time message changes to keep unread badges and last messages in sync
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conversations-messages:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
};

export const useCreateConversation = () => {
  const { user } = useAuth();

  const createDirectConversation = async (otherUserId: string) => {
    if (!user) return null;
    const { data, error } = await supabase.rpc("create_direct_conversation", {
      _other_user_id: otherUserId,
    });
    if (error || !data) {
      console.error("create_direct_conversation failed", error);
      return null;
    }
    return { id: data as string };
  };

  return { createDirectConversation };
};
