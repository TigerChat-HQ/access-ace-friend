import { beforeEach, describe, expect, it } from "vitest";
import { getNotificationPreferences, saveNotificationPreferences } from "./notification-preferences";

describe("notification preferences", () => {
  beforeEach(() => localStorage.clear());

  it("keeps floating chat bubble disabled by default", () => {
    const preferences = getNotificationPreferences("user-a");
    expect(preferences.floatingBubble).toBe(false);
  });

  it("does not allow stored bubble preferences to re-enable the bubble", () => {
    saveNotificationPreferences("user-a", { floatingBubble: true });

    expect(getNotificationPreferences("user-a").floatingBubble).toBe(false);
    expect(getNotificationPreferences("user-b").floatingBubble).toBe(false);
  });

  it("keeps legacy saved bubble preferences disabled", () => {
    localStorage.setItem("tiger-notification-preferences:user-a", JSON.stringify({
      floatingBubbleSize: "giant",
      floatingBubblePosition: { side: "left", verticalOffset: 4 },
    }));

    const preferences = getNotificationPreferences("user-a");
    expect(preferences.floatingBubble).toBe(false);
  });
});
