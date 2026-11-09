export type NotificationPreferences = {
  enabled: boolean;
  chat: boolean;
  social: boolean;
  sound: boolean;
  vibration: boolean;
  floatingBubble: boolean;
};

const defaults: NotificationPreferences = {
  enabled: true,
  chat: true,
  social: true,
  sound: true,
  vibration: true,
  floatingBubble: true,
};

const storageKey = (userId?: string) => `tiger-notification-preferences:${userId || "guest"}`;

export function getNotificationPreferences(userId?: string): NotificationPreferences {
  if (typeof window === "undefined") return defaults;
  try {
    const stored = localStorage.getItem(storageKey(userId));
    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveNotificationPreferences(userId: string | undefined, patch: Partial<NotificationPreferences>): NotificationPreferences {
  const next = { ...getNotificationPreferences(userId), ...patch };
  if (typeof window !== "undefined") localStorage.setItem(storageKey(userId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("tiger:notification-preferences-changed", { detail: next }));
  return next;
}
