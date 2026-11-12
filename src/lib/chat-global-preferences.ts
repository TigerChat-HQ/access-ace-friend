import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatPrefs } from "@/hooks/useChatPreferences";

const db = supabase as unknown as SupabaseClient;

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
  const { data, error } = await db
    .from("profiles")
    .select("chat_defaults")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.chat_defaults) return fallback;
  const remote = sanitize(data.chat_defaults as Partial<ChatPrefs>);
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
  const chatDefaults = {
    wallpaper: next.wallpaper ?? "default",
    bubble_color: next.bubble_color ?? "primary",
    font_size: next.font_size ?? "medium",
  };
  const { data, error: updateError } = await db
    .from("profiles")
    .update({ chat_defaults: chatDefaults, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (updateError) return { error: updateError, preferences: next };
  if (!data) {
    const { error: insertError } = await db.from("profiles").insert({
      user_id: userId,
      chat_defaults: chatDefaults,
    });
    return { error: insertError, preferences: next };
  }
  return { error: null, preferences: next };
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
  const { error } = await db
    .from("profiles")
    .update({ chat_defaults: { wallpaper: "default", bubble_color: "primary", font_size: "medium" } })
    .eq("user_id", userId);
  return { error };
};
