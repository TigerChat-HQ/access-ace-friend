export type FloatingBubbleSize = "small" | "medium" | "large";
export type FloatingBubbleSide = "left" | "right";

export type FloatingBubblePosition = {
  side: FloatingBubbleSide;
  /** Normalized vertical position within the space above the bottom navigation. */
  verticalOffset: number;
};

export type NotificationPreferences = {
  enabled: boolean;
  chat: boolean;
  social: boolean;
  sound: boolean;
  vibration: boolean;
  floatingBubble: boolean;
  floatingBubbleSize: FloatingBubbleSize;
  floatingBubblePosition: FloatingBubblePosition;
};

const defaults: NotificationPreferences = {
  enabled: true,
  chat: true,
  social: true,
  sound: true,
  vibration: true,
  floatingBubble: false,
  floatingBubbleSize: "small",
  floatingBubblePosition: { side: "right", verticalOffset: 1 },
};

const storageKey = (userId?: string) => `tiger-notification-preferences:${userId || "guest"}`;

const isBubbleSize = (value: unknown): value is FloatingBubbleSize =>
  value === "small" || value === "medium" || value === "large";

const isBubbleSide = (value: unknown): value is FloatingBubbleSide =>
  value === "left" || value === "right";

const normalizePreferences = (value: unknown): NotificationPreferences => {
  const stored = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<NotificationPreferences>
    : {};
  const storedPosition = stored.floatingBubblePosition;
  const rawOffset = storedPosition?.verticalOffset;

  return {
    ...defaults,
    ...stored,
    floatingBubble: false,
    floatingBubbleSize: isBubbleSize(stored.floatingBubbleSize)
      ? stored.floatingBubbleSize
      : defaults.floatingBubbleSize,
    floatingBubblePosition: {
      side: isBubbleSide(storedPosition?.side)
        ? storedPosition.side
        : defaults.floatingBubblePosition.side,
      verticalOffset: typeof rawOffset === "number" && Number.isFinite(rawOffset)
        ? Math.min(1, Math.max(0, rawOffset))
        : defaults.floatingBubblePosition.verticalOffset,
    },
  };
};

export function getNotificationPreferences(userId?: string): NotificationPreferences {
  if (typeof window === "undefined") return normalizePreferences(defaults);
  try {
    const stored = localStorage.getItem(storageKey(userId));
    return stored ? normalizePreferences(JSON.parse(stored)) : normalizePreferences(defaults);
  } catch {
    return normalizePreferences(defaults);
  }
}

export function saveNotificationPreferences(userId: string | undefined, patch: Partial<NotificationPreferences>): NotificationPreferences {
  const next = normalizePreferences({ ...getNotificationPreferences(userId), ...patch });
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      // Storage may be unavailable in a private or restricted browser context.
    }
    window.dispatchEvent(new CustomEvent("tiger:notification-preferences-changed", { detail: next }));
  }
  return next;
}
