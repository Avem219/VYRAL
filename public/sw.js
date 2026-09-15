const CACHE = "vyral-shell-v2";
const SAFE_SHELL = new Set(["/", "/login", "/register", "/manifest.webmanifest"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...SAFE_SHELL])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Only cache explicitly public shell documents. Static assets may be cached
  // normally, but personalized/private HTML must always come from the server.
  if (SAFE_SHELL.has(url.pathname)) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
  }
});
