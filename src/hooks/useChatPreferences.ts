import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getGlobalChatPreferences } from "@/lib/chat-global-preferences";

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
    if (!user || !conversationId) {
      setPrefs(DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("chat_preferences")
      .select("*")
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId)
      .maybeSingle()
      .then(({ data }) => {
        const globalDefaults = getGlobalChatPreferences(user.id);
        setPrefs({ ...DEFAULT, ...globalDefaults, ...(data as unknown as Partial<ChatPrefs> | null) });
        setLoading(false);
      });
  }, [user, conversationId]);

  const save = async (next: Partial<ChatPrefs>) => {
    if (!user || !conversationId) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    await db.from("chat_preferences").upsert(
      {
        user_id: user.id,
        conversation_id: conversationId,
        ...merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,conversation_id" }
    );
  };

  return { prefs, loading, save };
};
