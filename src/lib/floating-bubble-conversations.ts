export interface BubbleConversationOrderItem {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  lastMessage?: { created_at?: string | null } | null;
}

/** Pinned chats retain the user's manual order; the rest stay newest-first. */
export const sortBubbleConversations = <T extends BubbleConversationOrderItem>(
  conversations: readonly T[],
  pinnedIds: readonly string[],
): T[] => {
  const pinnedOrder = new Map(pinnedIds.map((id, index) => [id, index]));
  return [...conversations].sort((a, b) => {
    const aPinned = pinnedOrder.get(a.id);
    const bPinned = pinnedOrder.get(b.id);
    if (aPinned !== undefined && bPinned !== undefined) return aPinned - bPinned;
    if (aPinned !== undefined) return -1;
    if (bPinned !== undefined) return 1;
    const aTime = new Date(a.lastMessage?.created_at || a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.lastMessage?.created_at || b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
};

export const togglePinnedConversation = (pinnedIds: readonly string[], conversationId: string): string[] =>
  pinnedIds.includes(conversationId)
    ? pinnedIds.filter((id) => id !== conversationId)
    : [...pinnedIds, conversationId];

export const movePinnedConversation = (
  pinnedIds: readonly string[],
  conversationId: string,
  direction: -1 | 1,
): string[] => {
  const next = [...pinnedIds];
  const index = next.indexOf(conversationId);
  if (index < 0) return [...next, conversationId];
  const target = Math.max(0, Math.min(next.length - 1, index + direction));
  if (target !== index) [next[index], next[target]] = [next[target], next[index]];
  return next;
};
