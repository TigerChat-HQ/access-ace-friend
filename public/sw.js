// TIGERCHATS offline-first app shell and push notifications.
const CACHE_NAME = "tigerchats-offline-v4";
const SHELL_ASSETS = [
  "/", "/index.html", "/manifest.json", "/favicon.ico",
  "/pwa-icon-192.png", "/pwa-icon-512.png", "/placeholder.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_ASSETS.map(async (asset) => {
      try { await cache.add(asset); }
      catch (error) { console.warn("Offline shell asset was not cached:", asset, error); }
    }));
    try {
      const manifestResponse = await fetch("/precache-manifest.json", { cache: "no-store" });
      if (manifestResponse.ok) {
        const files = await manifestResponse.json();
        if (Array.isArray(files)) {
          // Cache every built route chunk and static asset so lazy-loaded pages
          // remain available after the device goes offline.
          for (let index = 0; index < files.length; index += 40) {
            const batch = files.slice(index, index + 40).filter((file) => typeof file === "string");
            await Promise.all(batch.map(async (file) => {
              try { await cache.add(file); }
              catch (error) { console.warn("Offline asset was not cached:", file, error); }
            }));
          }
        }
      }
    } catch (error) {
      console.warn("Offline precache manifest unavailable; shell cache remains active.", error);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("tigerchats-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const isSupabaseStorageMedia =
    url.hostname.endsWith(".supabase.co") &&
    url.pathname.startsWith("/storage/v1/object/") &&
    ["image", "audio", "video"].includes(request.destination);

  if (url.origin !== self.location.origin && !isSupabaseStorageMedia) return;

  // Supabase data, auth and realtime are never cached as HTTP responses.
  if (/^\/(?:rest\/v1|auth\/v1|realtime\/v1|functions\/v1)(?:\/|$)/.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/index.html", response.clone());
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(request) || await caches.match("/index.html") || await caches.match("/");
        return cached || new Response("TIGERCHATS offline shell is not cached yet. Connect once to prepare offline use.", {
          status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
    return;
  }

  const isAppAsset = isSupabaseStorageMedia || url.pathname.startsWith("/assets/") ||
    /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico|mp3|ogg)$/i.test(url.pathname) ||
    url.pathname === "/precache-manifest.json";

  if (isAppAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        // Revalidate quietly while continuing to serve the offline copy.
        void fetch(request).then((response) => {
          if (response.ok || response.type === "opaque") return cache.put(request, response.clone());
          return undefined;
        }).catch(() => undefined);
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
        return response;
      } catch {
        return new Response("", { status: 504, statusText: "Offline asset unavailable" });
      }
    })());
    return;
  }
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
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { body: event.data?.text() || "You have a new notification." }; }
  event.waitUntil(showAppNotification(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
    for (const client of list) {
      if ("focus" in client) {
        await client.navigate(targetUrl).catch(() => {});
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
  }));
});
