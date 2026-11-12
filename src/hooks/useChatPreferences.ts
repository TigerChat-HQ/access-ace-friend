import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { loadGlobalChatPreferences } from "@/lib/chat-global-preferences";

export interface ChatPrefs {
  wallpaper: string | null;
  bubble_color: string | null;
  font_size: "small" | "medium" | "large";
  theme: string;
  muted_until: string | null;
}

const db = supabase as unknown as SupabaseClient;
const DEFAULT: ChatPrefs = { wallpaper: null, bubble_color: null, font_size: "medium", theme: "default", muted_until: null };

export const useChatPreferences = (conversationId: string | null) => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<ChatPrefs>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user || !conversationId) {
      setPrefs(DEFAULT);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    Promise.all([
      supabase
        .from("chat_preferences")
        .select("*")
        .eq("user_id", user.id)
        .eq("conversation_id", conversationId)
        .maybeSingle(),
      loadGlobalChatPreferences(user.id),
    ]).then(([{ data }, globalDefaults]) => {
      if (!active) return;
      setPrefs({ ...DEFAULT, ...globalDefaults, ...(data as unknown as Partial<ChatPrefs> | null) });
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setPrefs({ ...DEFAULT, ...loadLocalFallback(user.id) });
      setLoading(false);
    });

    return () => { active = false; };
  }, [user?.id, conversationId]);

  const save = async (next: Partial<ChatPrefs>) => {
    if (!user || !conversationId) return { error: new Error("A conversation must be open.") };
    const merged = { ...prefs, ...next };
    const { error } = await db.from("chat_preferences").upsert(
      {
        user_id: user.id,
        conversation_id: conversationId,
        ...merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,conversation_id" }
    );
    if (!error) setPrefs(merged);
    return { error };
  };

  return { prefs, loading, save };
};

const loadLocalFallback = (userId: string) => {
  try {
    const raw = localStorage.getItem(`tigerchats:chat-defaults:${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
