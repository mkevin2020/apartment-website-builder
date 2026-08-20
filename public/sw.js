// Cielo Vista service worker.
// Strategy: network-first for navigations (always show fresh content when online,
// fall back to a cached page/offline shell when the network is unavailable),
// cache-first for static assets. Kept intentionally simple.
// Bumped to v3: the activate handler deletes every cache whose name does not
// match, which is what evicts authenticated pages cached by the old version.
const CACHE = "cielo-vista-v3"
const OFFLINE_URL = "/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event

  // Only handle GET; let the browser handle POST/PUT (API calls, payments, etc.)
  if (request.method !== "GET") return

  const url = new URL(request.url)

  // Never cache API/auth traffic, and never cache Next.js build chunks
  // (`/_next/`) — those are versioned and change on every edit/build, so
  // caching them serves stale JavaScript and breaks hydration. Always network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return

  // Never cache an authenticated page.
  //
  // Navigations were cached indiscriminately, so a signed-in visit to
  // /tenant/dashboard or /admin left that page in Cache Storage. On a shared
  // phone the next person could be served it from cache after the session had
  // ended. These paths are always fetched from the network, and a signed-out
  // user simply gets the login redirect.
  const PRIVATE_PREFIXES = ["/admin", "/manager", "/employee", "/tenant", "/receipt", "/verify"]
  if (PRIVATE_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) {
    return
  }

  // Navigations: network-first, fall back to cache, then offline shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached || caches.match(OFFLINE_URL)
        }),
    )
    return
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
