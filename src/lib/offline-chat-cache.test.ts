import { describe, it, expect, beforeEach } from "vitest";
import { readOfflineData, writeOfflineData, clearOfflineDataForUser } from "./offline-chat-cache";

describe("offline chat cache", () => {
  beforeEach(() => localStorage.clear());

  it("stores and restores data scoped to a user and conversation", () => {
    const messages = [{ id: "m1", content: "Saved offline" }];
    writeOfflineData("user-a", "messages", messages, "conversation-a");
    expect(readOfflineData("user-a", "messages", "conversation-a")).toEqual(messages);
    expect(readOfflineData("user-b", "messages", "conversation-a")).toBeNull();
    expect(readOfflineData("user-a", "messages", "conversation-b")).toBeNull();
  });

  it("clears only the selected user's cached data", () => {
    writeOfflineData("user-a", "conversations", [{ id: "a" }]);
    writeOfflineData("user-b", "conversations", [{ id: "b" }]);
    clearOfflineDataForUser("user-a");
    expect(readOfflineData("user-a", "conversations")).toBeNull();
    expect(readOfflineData("user-b", "conversations")).toEqual([{ id: "b" }]);
  });

  it("handles missing and malformed cache entries safely", () => {
    expect(readOfflineData("user-a", "messages")).toBeNull();
    localStorage.setItem("tigerchats:offline-data:v1:user-a:messages:all", "{bad json");
    expect(readOfflineData("user-a", "messages")).toBeNull();
  });
});
