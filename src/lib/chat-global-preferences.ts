import type { ChatPrefs } from "@/hooks/useChatPreferences";

export const globalChatPreferencesKey = (userId: string) =>
  `tigerchats:chat-defaults:${userId}`;

export const getGlobalChatPreferences = (userId: string): Partial<ChatPrefs> => {
  try {
    const raw = localStorage.getItem(globalChatPreferencesKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<ChatPrefs>;
    return {
      ...(typeof parsed.wallpaper === "string" ? { wallpaper: parsed.wallpaper } : {}),
      ...(typeof parsed.bubble_color === "string" ? { bubble_color: parsed.bubble_color } : {}),
      ...(parsed.font_size === "small" || parsed.font_size === "medium" || parsed.font_size === "large"
        ? { font_size: parsed.font_size } : {}),
    };
  } catch {
    return {};
  }
};

export const saveGlobalChatPreferences = (userId: string, preferences: Partial<ChatPrefs>) => {
  const next = { ...getGlobalChatPreferences(userId), ...preferences };
  try {
    localStorage.setItem(globalChatPreferencesKey(userId), JSON.stringify(next));
  } catch {
    // Private browsing or storage limits should not break Settings.
  }
  return next;
};

export const resetGlobalChatPreferences = (userId: string) => {
  try {
    localStorage.removeItem(globalChatPreferencesKey(userId));
  } catch {
    // Ignore unavailable storage.
  }
};
