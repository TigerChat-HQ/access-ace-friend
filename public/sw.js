// TIGERCHATS offline-first app shell with incremental, content-hashed asset updates.
const CACHE_NAME = "tigerchats-offline-dev";
const PRECACHE_MANIFEST = "__PRECACHE_MANIFEST__";
const SHELL_ASSETS = [
  "/", "/index.html", "/manifest.json", "/favicon.ico",
  "/pwa-icon-192.png", "/pwa-icon-512.png", "/placeholder.svg",
];

const isContentHashedAsset = (asset) => /-[a-zA-Z0-9_-]{8,}\./.test(new URL(asset, self.location.origin).pathname);

async function copyUnchangedAsset(cache, asset, previousCacheNames) {
  if (!isContentHashedAsset(asset)) return false;
  for (const name of previousCacheNames) {
    const previous = await caches.open(name);
    const response = await previous.match(asset);
    if (response) {
      await cache.put(asset, response);
      return true;
    }
  }
  return false;
}

async function cacheAsset(cache, asset, previousCacheNames) {
  try {
    if (await copyUnchangedAsset(cache, asset, previousCacheNames)) return;
    const response = await fetch(asset, { cache: "reload" });
    if (response.ok || response.type === "opaque") await cache.put(asset, response);
  } catch (error) {
    console.warn("Offline asset could not be updated:", asset, error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const previousCacheNames = (await caches.keys())
      .filter((name) => name.startsWith("tigerchats-offline-") && name !== CACHE_NAME)
      .reverse();
    const cache = await caches.open(CACHE_NAME);
    // Refresh HTML, reuse unchanged fingerprinted files, and fetch only changed/new bundles.
    await Promise.all(SHELL_ASSETS.map((asset) => cacheAsset(cache, asset, previousCacheNames)));
    try {
      const manifestResponse = await fetch(PRECACHE_MANIFEST, { cache: "no-store" });
      if (manifestResponse.ok) {
        const files = await manifestResponse.json();
        if (Array.isArray(files)) {
          for (let index = 0; index < files.length; index += 40) {
            const batch = files.slice(index, index + 40).filter((file) => typeof file === "string");
            await Promise.all(batch.map((file) => cacheAsset(cache, file, previousCacheNames)));
          }
        }
      }
    } catch (error) {
      console.warn("Incremental precache manifest unavailable; shell cache remains active.", error);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("tigerchats-offline-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const isSupabaseStorageMedia = url.hostname.endsWith(".supabase.co") &&
    url.pathname.startsWith("/storage/v1/object/") && ["image", "audio", "video"].includes(request.destination);
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
    /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico|mp3|ogg)$/i.test(url.pathname);
  if (isAppAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
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
  }
});

const showAppNotification = (payload = {}) => {
  const { title, body, url, tag, icon } = payload;
  return self.registration.showNotification(title || "TIGERCHATS", {
    body: body || "", icon: icon || "/pwa-icon-192.png", badge: "/pwa-icon-192.png",
    tag: tag || "tigerchats", data: { url: url || "/" }, renotify: true,
  });
};
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type === "show-notification") event.waitUntil(showAppNotification(data.payload));
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
        if ("navigate" in client) await client.navigate(targetUrl).catch(() => {});
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
  }));
});
