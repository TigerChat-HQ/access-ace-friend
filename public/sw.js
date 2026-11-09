// TIGERCHATS push notification & PWA offline cache service worker
const CACHE_NAME = "tigerchats-cache-v3";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/placeholder.svg",
];

// Pre-cache core shell resources on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch((err) => console.warn("Pre-cache warning:", err)))
      .then(() => self.skipWaiting())
  );
});

// Clean up old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch handler with offline resilience
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip browser extensions or non-http protocols
  if (!url.protocol.startsWith("http")) return;

  // Do not cache live backend API calls (auth, realtime, rest, functions)
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/rest/v1") ||
    url.pathname.startsWith("/auth/v1") ||
    url.pathname.startsWith("/realtime/v1") ||
    url.pathname.startsWith("/functions/v1")
  ) {
    return;
  }

  // 1. Navigation requests (HTML pages) -> Network first, fall back to cached index.html / shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const indexCached = await caches.match("/index.html");
          if (indexCached) return indexCached;
          return caches.match("/");
        })
    );
    return;
  }

  // 2. Static assets (JS, CSS, images, fonts, icons) -> Stale While Revalidate
  const isStaticAsset =
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?|mp3|ogg)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
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

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "show-notification") return;
  event.waitUntil(showAppNotification(data.payload));
});

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
