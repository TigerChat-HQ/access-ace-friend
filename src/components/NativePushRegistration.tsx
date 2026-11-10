import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

declare global {
  interface Window {
    TigerNative?: { getFcmToken?: () => string };
  }
}

export const NativePushRegistration = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const register = async (candidate?: string) => {
      const token = candidate || window.TigerNative?.getFcmToken?.();
      if (!token || cancelled) return;
      const { error } = await supabase
        .from("device_push_tokens")
        .upsert({ user_id: user.id, token }, { onConflict: "user_id,token" });
      if (error) console.warn("Native push registration failed:", error.message);
    };

    void register();
    const onToken = (event: Event) => {
      const token = (event as CustomEvent<string>).detail;
      if (typeof token === "string") void register(token);
    };
    window.addEventListener("tiger:native-fcm-token", onToken);
    return () => {
      cancelled = true;
      window.removeEventListener("tiger:native-fcm-token", onToken);
    };
  }, [user?.id]);

  return null;
};
