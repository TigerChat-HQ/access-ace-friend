import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
type Profile = Tables<"profiles">;
type ConversationItem = Tables<"conversations"> & {
  lastMessage: Message | null;
  otherProfile: Profile | null;
  unreadCount: number;
};

export const useMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<(Message & { sender_profile?: Profile })[]>([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  const fetchMessages = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (requestId === requestRef.current) setMessages(data || []);
    } catch (error) {
      console.error("Failed to load chat messages:", error);
      if (requestId === requestRef.current) setMessages([]);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void fetchMessages();
    return () => { requestRef.current += 1; };
  }, [fetchMessages]);

  const deleteMessage = useCallback(async (messageId: string, mode: "me" | "everyone" = "everyone") => {
    if (mode === "me") {
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
      return { error: null };
    }

    const { error } = await supabase.from("messages").delete().eq("id", messageId);
    if (!error) {
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
    }
    return { error };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}:${crypto.randomUUID()}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const incoming = payload.new as Message;
        setMessages((prev) => prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((message) => message.id === updated.id ? { ...message, ...updated } : message));
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const deletedId = (payload.old as { id?: string })?.id;
        if (deletedId) setMessages((prev) => prev.filter((message) => message.id !== deletedId));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);

  return { messages, loading, refetch: fetchMessages, deleteMessage };
};

export const useSendMessage = () => {
  const { user } = useAuth();
  const sendMessage = async (conversationId: string, content: string, type = "text") => {
    if (!user) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: user.id, content, message_type: type,
    });
    return { error };
  };
  return { sendMessage };
};

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: memberData, error: memberError } = await supabase
        .from("conversation_members").select("conversation_id").eq("user_id", user.id);
      if (memberError) throw memberError;

      if (!memberData?.length) {
        setConversations([]);
        return;
      }

      const convoIds = memberData.map((member) => member.conversation_id);
      const { data: convos, error: convosError } = await supabase
        .from("conversations").select("*").in("id", convoIds).order("updated_at", { ascending: false });
      if (convosError) throw convosError;

      const enriched: ConversationItem[] = await Promise.all((convos || []).map(async (convo) => {
        const [
          { data: lastMsg, error: lastMsgError },
          { data: members, error: membersError },
          { count: unreadCount, error: unreadError },
        ] = await Promise.all([
          supabase.from("messages").select("*")
            .eq("conversation_id", convo.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("conversation_members").select("user_id")
            .eq("conversation_id", convo.id).neq("user_id", user.id),
          supabase.from("messages").select("*", { count: "exact", head: true })
            .eq("conversation_id", convo.id).eq("is_read", false).is("read_at", null).neq("sender_id", user.id),
        ]);
        if (lastMsgError) throw lastMsgError;
        if (membersError) throw membersError;
        if (unreadError) throw unreadError;

        let otherProfile: Profile | null = null;
        if (members?.length) {
          const { data: profile, error: profileError } = await supabase.from("profiles").select("*")
            .eq("user_id", members[0].user_id).maybeSingle();
          if (profileError) throw profileError;
          otherProfile = profile;
        }

        return { ...convo, lastMessage: lastMsg, otherProfile, unreadCount: unreadCount || 0 };
      }));

      enriched.sort((a, b) => {
        const timeA = new Date(a.lastMessage?.created_at || a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.lastMessage?.created_at || b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setConversations(enriched);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void fetchConversations(); }, 120);
    };
    const channel = supabase
      .channel(`conversations-messages:${user.id}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
};

export const useCreateConversation = () => {
  const { user } = useAuth();
  const createDirectConversation = async (otherUserId: string) => {
    if (!user) return null;
    const { data, error } = await supabase.rpc("create_direct_conversation", { _other_user_id: otherUserId });
    if (error || !data) {
      console.error("create_direct_conversation failed", error);
      return null;
    }
    return { id: data as string };
  };
  return { createDirectConversation };
};
