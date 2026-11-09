import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface PinnedChatMessage {
  id: string;
  message_id: string;
  pinned_by: string;
  content: string | null;
  sender_id: string;
  message_type: string;
  created_at: string | null;
}

interface ChatReactionRow { message_id: string; user_id: string; emoji: string; }
interface PinnedMessageRow {
  id: string; message_id: string; pinned_by: string; created_at: string | null;
  messages?: { content: string | null; sender_id: string; message_type: string; created_at: string | null } | null;
}
interface ChatQueryResult<T> { data: T | null; error: { message?: string } | null; }
interface ChatQuery extends PromiseLike<ChatQueryResult<unknown>> {
  select(columns: string): ChatQuery;
  eq(column: string, value: string): ChatQuery;
  order(column: string, options?: { ascending?: boolean }): ChatQuery;
  maybeSingle(): Promise<ChatQueryResult<{ id: string }>>;
  delete(): ChatQuery;
  insert(values: Record<string, unknown>): Promise<ChatQueryResult<unknown>>;
  update(values: Record<string, unknown>): ChatQuery;
}
interface ChatFeaturesClient { from(table: string): ChatQuery; }

export const useChatMessageFeatures = (conversationId: string | null, userId?: string) => {
  const [reactions, setReactions] = useState<Record<string, ChatReactionSummary[]>>({});
  const [pinnedMessages, setPinnedMessages] = useState<PinnedChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setReactions({});
      setPinnedMessages([]);
      return;
    }
    setLoading(true);
    const client = supabase as unknown as ChatFeaturesClient;
    const [reactionResult, pinResult] = await Promise.all([
      client.from("message_reactions")
        .select("message_id,user_id,emoji,messages!inner(conversation_id)")
        .eq("messages.conversation_id", conversationId),
      client.from("pinned_messages")
        .select("id,message_id,pinned_by,created_at,messages!inner(content,sender_id,message_type,created_at)")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false }),
    ]);

    if (!reactionResult.error) {
      const grouped: Record<string, ChatReactionSummary[]> = {};
      for (const reaction of (reactionResult.data || []) as ChatReactionRow[]) {
        const list = grouped[reaction.message_id] || [];
        const existing = list.find((item) => item.emoji === reaction.emoji);
        if (existing) {
          existing.count += 1;
          existing.reactedByMe ||= reaction.user_id === userId;
        } else {
          list.push({ emoji: reaction.emoji, count: 1, reactedByMe: reaction.user_id === userId });
        }
        grouped[reaction.message_id] = list;
      }
      setReactions(grouped);
    }
    if (!pinResult.error) {
      setPinnedMessages(((pinResult.data || []) as PinnedMessageRow[]).map((item) => ({
        id: item.id,
        message_id: item.message_id,
        pinned_by: item.pinned_by,
        content: item.messages?.content ?? null,
        sender_id: item.messages?.sender_id ?? "",
        message_type: item.messages?.message_type ?? "text",
        created_at: item.messages?.created_at ?? null,
      })));
    }
    setLoading(false);
  }, [conversationId, userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`chat-features:${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "pinned_messages", filter: `conversation_id=eq.${conversationId}` }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, refresh]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return { error: new Error("Sign in to react") };
    const client = supabase as unknown as ChatFeaturesClient;
    const { data: existing, error: lookupError } = await client.from("message_reactions")
      .select("id").eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji).maybeSingle();
    if (lookupError) return { error: lookupError };
    const result = existing
      ? await client.from("message_reactions").delete().eq("id", existing.id)
      : await client.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
    if (!result.error) await refresh();
    return { error: result.error };
  }, [userId, refresh]);

  const togglePin = useCallback(async (messageId: string) => {
    if (!conversationId || !userId) return { error: new Error("Sign in to pin messages") };
    const client = supabase as unknown as ChatFeaturesClient;
    const { data: existing, error: lookupError } = await client.from("pinned_messages")
      .select("id").eq("conversation_id", conversationId).eq("message_id", messageId).maybeSingle();
    if (lookupError) return { error: lookupError };
    const result = existing
      ? await client.from("pinned_messages").delete().eq("id", existing.id)
      : await client.from("pinned_messages").insert({ conversation_id: conversationId, message_id: messageId, pinned_by: userId });
    if (!result.error) await refresh();
    return { error: result.error };
  }, [conversationId, userId, refresh]);

  const editMessage = useCallback(async (messageId: string, content: string) => {
    const result = await supabase.from("messages").update({ content: content.trim() }).eq("id", messageId).eq("sender_id", userId || "");
    if (!result.error) await refresh();
    return { error: result.error };
  }, [userId, refresh]);

  return { reactions, pinnedMessages, loading, refresh, toggleReaction, togglePin, editMessage };
};
