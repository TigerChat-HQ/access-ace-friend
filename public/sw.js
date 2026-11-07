// TIGERCHATS push notification service worker
// Registered only on production hosts, never inside the editor preview iframe.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const showAppNotification = (payload = {}) => {
  const { title, body, url, tag, icon } = payload;
  return self.registration.showNotification(title || "TIGERCHATS", {
    body: body || "",
    icon: icon || "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    tag: tag || "tigerchats",
    data: { url: url || "/" },
    renotify: true,
  });
};

// Notifications posted by an open page appear as system notifications too.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "show-notification") return;
  event.waitUntil(showAppNotification(data.payload));
});

// Real Web Push can wake this worker when every app tab is closed.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "You have a new notification." };
  }
  event.waitUntil(showAppNotification(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if ("focus" in client) {
          await client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })
  );
});
