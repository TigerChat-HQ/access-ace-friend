import { beforeEach, describe, expect, it } from "vitest";
import { getNotificationPreferences, saveNotificationPreferences } from "./notification-preferences";

describe("floating chat bubble preferences", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to a compact bubble docked on the right near the bottom", () => {
    const preferences = getNotificationPreferences("user-a");
    expect(preferences.floatingBubble).toBe(true);
    expect(preferences.floatingBubbleSize).toBe("small");
    expect(preferences.floatingBubblePosition).toEqual({ side: "right", verticalOffset: 1 });
  });

  it("saves bubble customization per signed-in account", () => {
    saveNotificationPreferences("user-a", {
      floatingBubbleSize: "large",
      floatingBubblePosition: { side: "left", verticalOffset: 0.4 },
    });

    expect(getNotificationPreferences("user-a").floatingBubbleSize).toBe("large");
    expect(getNotificationPreferences("user-a").floatingBubblePosition).toEqual({ side: "left", verticalOffset: 0.4 });
    expect(getNotificationPreferences("user-b").floatingBubblePosition).toEqual({ side: "right", verticalOffset: 1 });
  });

  it("falls back to a safe size and clamps stored vertical position", () => {
    localStorage.setItem("tiger-notification-preferences:user-a", JSON.stringify({
      floatingBubbleSize: "giant",
      floatingBubblePosition: { side: "left", verticalOffset: 4 },
    }));

    const preferences = getNotificationPreferences("user-a");
    expect(preferences.floatingBubbleSize).toBe("small");
    expect(preferences.floatingBubblePosition).toEqual({ side: "left", verticalOffset: 1 });
  });
});
