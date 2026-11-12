import { supabase } from "@/integrations/supabase/client";
import type { ChatPrefs } from "@/hooks/useChatPreferences";

export const globalChatPreferencesKey = (userId: string) =>
  `tigerchats:chat-defaults:${userId}`;

const sanitize = (value: Partial<ChatPrefs>): Partial<ChatPrefs> => ({
  ...(typeof value.wallpaper === "string" ? { wallpaper: value.wallpaper } : {}),
  ...(typeof value.bubble_color === "string" ? { bubble_color: value.bubble_color } : {}),
  ...(value.font_size === "small" || value.font_size === "medium" || value.font_size === "large"
    ? { font_size: value.font_size } : {}),
});

export const getGlobalChatPreferences = (userId: string): Partial<ChatPrefs> => {
  try {
    const raw = localStorage.getItem(globalChatPreferencesKey(userId));
    return raw ? sanitize(JSON.parse(raw) as Partial<ChatPrefs>) : {};
  } catch {
    return {};
  }
};

const cache = (userId: string, preferences: Partial<ChatPrefs>) => {
  try {
    localStorage.setItem(globalChatPreferencesKey(userId), JSON.stringify(preferences));
  } catch {
    // Local cache is optional; Supabase remains the source of truth.
  }
};

export const loadGlobalChatPreferences = async (userId: string): Promise<Partial<ChatPrefs>> => {
  const fallback = getGlobalChatPreferences(userId);
  const { data, error } = await supabase
    .from("user_chat_defaults")
    .select("wallpaper,bubble_color,font_size")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return fallback;
  const remote = sanitize(data as Partial<ChatPrefs>);
  cache(userId, remote);
  return remote;
};

export const saveGlobalChatPreferences = (userId: string, preferences: Partial<ChatPrefs>) => {
  const next = { ...getGlobalChatPreferences(userId), ...sanitize(preferences) };
  cache(userId, next);
  return next;
};

export const persistGlobalChatPreferences = async (userId: string, preferences: Partial<ChatPrefs>) => {
  const next = saveGlobalChatPreferences(userId, preferences);
  const { error } = await supabase.from("user_chat_defaults").upsert(
    {
      user_id: userId,
      wallpaper: next.wallpaper ?? "default",
      bubble_color: next.bubble_color ?? "primary",
      font_size: next.font_size ?? "medium",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return { error, preferences: next };
};

export const resetGlobalChatPreferences = (userId: string) => {
  try {
    localStorage.removeItem(globalChatPreferencesKey(userId));
  } catch {
    // Ignore unavailable storage.
  }
};

export const deleteGlobalChatPreferences = async (userId: string) => {
  resetGlobalChatPreferences(userId);
  const { error } = await supabase.from("user_chat_defaults").delete().eq("user_id", userId);
  return { error };
};
