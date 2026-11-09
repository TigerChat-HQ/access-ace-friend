import { getApps, initializeApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const deviceKey = (userId: string) => `tiger-push:${userId}`;
export const isPushEnabled = (userId: string) =>
  typeof Notification !== "undefined" && Notification.permission === "granted" && !!localStorage.getItem(deviceKey(userId));

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
  const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID;
  const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY;
  const config = { apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY, projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID, appId, messagingSenderId: appId?.split(":")[1] ?? "" };
  if (!config.apiKey || !config.projectId || !appId || !vapidKey || !config.messagingSenderId) return "Update the Firebase connection and select Include web push.";
  if (!("Notification" in window) || !await isSupported()) return "Push notifications are not supported by this browser.";
  if (window.top !== window.self) return "Open TIGERCHATS in its own tab to enable notifications.";
  if ((Notification.permission === "granted" ? "granted" : await Notification.requestPermission()) !== "granted") return "Allow notifications in your browser’s site settings.";
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${new URLSearchParams(config).toString()}`);
  const app = getApps().find(app => app.name === "tiger-push") || initializeApp(config, "tiger-push");
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return "No notification registration was returned. Try again.";
  const { error } = await supabase.from("device_push_tokens").upsert({ user_id: userId, token }, { onConflict: "user_id,token" });
  if (error) throw error;
  localStorage.setItem(deviceKey(userId), token);
  return "Background notifications enabled. Sound follows your phone and browser settings.";
}