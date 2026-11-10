import { getApps, initializeApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const deviceKey = (userId: string) => `tiger-push:${userId}`;
export const isPushEnabled = (userId: string) =>
  typeof Notification !== "undefined" && Notification.permission === "granted" && !!localStorage.getItem(deviceKey(userId));

const firebaseConfig = () => {
  const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID ||
    import.meta.env.VITE_FIREBASE_APP_ID;
  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY ||
    import.meta.env.VITE_FIREBASE_VAPID_KEY;
  const messagingSenderId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_SENDER_ID ||
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    appId?.match(/^\d+:(\d+):/)?.[1] || "";

  return {
    config: { apiKey, projectId, appId, messagingSenderId },
    vapidKey,
    missing: [
      !apiKey && "Firebase Web API key",
      !projectId && "Firebase project ID",
      !appId && "Firebase app ID",
      !messagingSenderId && "Firebase messaging sender ID",
      !vapidKey && "Firebase Web Push VAPID key",
    ].filter(Boolean) as string[],
  };
};

export async function disablePush(userId: string): Promise<void> {
  const token = localStorage.getItem(deviceKey(userId));
  if (!token) return;
  const { error } = await supabase.from("device_push_tokens").delete().eq("user_id", userId).eq("token", token);
  if (error) throw error;
  localStorage.removeItem(deviceKey(userId));
  const app = getApps().find(app => app.name === "tiger-push");
  if (app && await isSupported()) await deleteToken(getMessaging(app));
}

export async function enablePush(userId: string): Promise<string> {
  const { config, vapidKey, missing } = firebaseConfig();
  if (missing.length) {
    return `Background notifications need Firebase Web Push setup. Missing: ${missing.join(", ")}. Add the matching VITE_FIREBASE_* values (or Lovable connector values) to the Render service, then redeploy.`;
  }
  if (!("Notification" in window) || !await isSupported()) return "Push notifications are not supported by this browser.";
  if (window.top !== window.self) return "Open TIGERCHATS in its own tab to enable notifications.";
  if ((Notification.permission === "granted" ? "granted" : await Notification.requestPermission()) !== "granted") return "Allow notifications in your browser’s site settings.";

  const app = getApps().find(app => app.name === "tiger-push") || initializeApp(config, "tiger-push");
  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${new URLSearchParams(config).toString()}`,
  );
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return "No notification registration was returned. Check Firebase Web Push and try again.";
  const { error } = await supabase.from("device_push_tokens").upsert({ user_id: userId, token }, { onConflict: "user_id,token" });
  if (error) throw error;
  localStorage.setItem(deviceKey(userId), token);
  return "Background notifications enabled. Sound follows your phone and browser settings.";
}
