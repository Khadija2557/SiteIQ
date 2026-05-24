const CACHE_NAME = "siteiq-worker-v1";
const OFFLINE_CACHE = "siteiq-offline-v1";

const PRECACHE_URLS = [
  "/worker",
  "/manifest.json",
];

const CACHE_PATTERNS = [
  /\/worker/,
  /\/manifest\.json/,
  /\.(?:js|css|woff2?|svg|png|ico)$/,
];

const NETWORK_ONLY = [
  /\/api\//,
  /\/socket\.io/,
];

// Install: precache shell
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
});

// Activate: clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== OFFLINE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== "GET") return;

  // Network-only for API / socket
  if (NETWORK_ONLY.some(p => p.test(url.pathname))) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Cache-first for static assets matching patterns
  if (CACHE_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached || new Response("Offline", { status: 503 }));
      })
    );
    return;
  }

  // Network-first with cache fallback for everything else
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request).then(c => c || new Response("Offline", { status: 503 })))
  );
});

// Background sync (if supported)
self.addEventListener("sync", event => {
  if (event.tag === "sync-offline-queue") {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Notify all clients to run their sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: "SYNC_QUEUE" }));
}
