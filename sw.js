// Offline support. The page itself: network first (so updates show up on the next open),
// falling back to the cached copy when offline or after 3 s. Other files: cache first, refreshed in the background.
// Bump VERSION when releasing changes so old caches are cleared.
const VERSION = "traty-v1";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await Promise.race([
          fetch(req, { cache: "no-store" }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
        ]);
        if (res && res.ok) { cache.put("./", res.clone()); return res; }
      } catch (e) { /* offline or slow: use the cached copy */ }
      return (await cache.match("./")) || fetch(req);
    })());
    return;
  }

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const key = req.mode === "navigate" ? "./" : req;
      const hit = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) cache.put(key, res.clone());
          return res;
        })
        .catch(() => hit);
      if (hit) {
        event.waitUntil(fresh.catch(() => {}));
        return hit;
      }
      return fresh;
    })
  );
});
