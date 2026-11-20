import { describe, expect, it } from "vitest";
import {
  movePinnedConversation,
  sortBubbleConversations,
  togglePinnedConversation,
} from "./floating-bubble-conversations";

describe("floating bubble conversation ordering", () => {
  const conversations = [
    { id: "older", created_at: "2026-01-01T00:00:00Z" },
    { id: "newer", created_at: "2026-01-03T00:00:00Z" },
    { id: "middle", created_at: "2026-01-02T00:00:00Z" },
  ];

  it("keeps pinned order and sorts unpinned chats newest-first", () => {
    expect(sortBubbleConversations(conversations, ["older", "middle"]).map((chat) => chat.id))
      .toEqual(["older", "middle", "newer"]);
  });

  it("uses last message time before conversation timestamps", () => {
    const items = [
      { id: "a", updated_at: "2026-01-10T00:00:00Z", lastMessage: { created_at: "2026-01-01T00:00:00Z" } },
      { id: "b", updated_at: "2026-01-02T00:00:00Z", lastMessage: { created_at: "2026-01-03T00:00:00Z" } },
    ];
    expect(sortBubbleConversations(items, []).map((chat) => chat.id)).toEqual(["b", "a"]);
  });

  it("toggles a pinned chat without duplicating ids", () => {
    expect(togglePinnedConversation(["a"], "b")).toEqual(["a", "b"]);
    expect(togglePinnedConversation(["a", "b"], "a")).toEqual(["b"]);
  });

  it("moves pinned chats within bounds", () => {
    expect(movePinnedConversation(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(movePinnedConversation(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
  });
});
