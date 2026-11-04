import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatPrefs {
  wallpaper: string | null;
  bubble_color: string | null;
  font_size: "small" | "medium" | "large";
  theme: string;
}

const DEFAULT: ChatPrefs = { wallpaper: null, bubble_color: null, font_size: "medium", theme: "default" };

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
      .from("chat_preferences" as never)
      .select("*")
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs({ ...DEFAULT, ...(data as never) });
        else setPrefs(DEFAULT);
        setLoading(false);
      });
  }, [user, conversationId]);

  const save = async (next: Partial<ChatPrefs>) => {
    if (!user || !conversationId) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    await supabase.from("chat_preferences" as never).upsert(
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
