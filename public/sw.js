// TIGERCHATS push notification service worker
// This is only registered on installed PWAs / production — never inside the editor preview iframe.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Show notifications when posted from the page (postMessage) so they appear as
// system bubbles even when the tab is in the background.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "show-notification") return;
  const { title, body, url, tag, icon } = data.payload || {};
  self.registration.showNotification(title || "TIGERCHATS", {
    body: body || "",
    icon: icon || "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    tag: tag || "tigerchats",
    data: { url: url || "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
