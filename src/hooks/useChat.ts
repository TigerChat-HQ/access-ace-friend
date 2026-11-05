import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/hooks/usePresence";
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

  useEffect(() => { void fetchMessages(); }, [fetchMessages]);

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
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);

  return { messages, loading, refetch: fetchMessages };
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
  const { onlineUserIds } = usePresence(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data: memberData } = await supabase
      .from("conversation_members").select("conversation_id").eq("user_id", user.id);
    if (!memberData?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convoIds = memberData.map((member) => member.conversation_id);
    const { data: convos } = await supabase
      .from("conversations").select("*").in("id", convoIds).order("updated_at", { ascending: false });

    const enriched = await Promise.all((convos || []).map(async (convo) => {
      const { data: lastMsg } = await supabase.from("messages").select("*")
        .eq("conversation_id", convo.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: members } = await supabase.from("conversation_members").select("user_id")
        .eq("conversation_id", convo.id).neq("user_id", user.id);

      let otherProfile: Profile | null = null;
      if (members?.length) {
        const { data: profile } = await supabase.from("profiles").select("*")
          .eq("user_id", members[0].user_id).maybeSingle();
        otherProfile = profile;
      }

      const { count: unreadCount } = await supabase.from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", convo.id)
        .eq("is_read", false)
        .is("read_at", null)
        .neq("sender_id", user.id);

      return { ...convo, lastMessage: lastMsg, otherProfile, unreadCount: unreadCount || 0 };
    }));

    // Sort by the newest actual message so a newly active chat always rises to the top.
    enriched.sort((a, b) => {
      const aTime = new Date(a.lastMessage?.created_at || a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.lastMessage?.created_at || b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });
    setConversations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setConversations((prev) => prev.map((convo) => {
      if (!convo.otherProfile) return convo;
      return { ...convo, otherProfile: { ...convo.otherProfile, is_online: onlineUserIds.has(convo.otherProfile.user_id) } };
    }));
  }, [onlineUserIds]);

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
