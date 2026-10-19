// OFFL-1: the app opens without signal. Hashed build files are cache-first (precached at install so even the first
// visit is covered); pages are network-first with the cached shell as fallback. API calls (Supabase, Photon) always go to
// the network: offline data comes from the last snapshot on the device and writes wait in the IndexedDB outbox.
// Map tiles are not cached (opaque cross-origin responses cost ~7 MB of quota each in Chrome); the text lists still work.
// shortcut: old hashed assets stay in the cache until CACHE is bumped; add cleanup if the cache grows noticeably.
const CACHE = 'evacfit-v1'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.png', '/brand/evacfit-logo.webp', '/brand/evacfit-mark.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(SHELL)
    // The shell lists the hashed JS/CSS it needs; store those too.
    const html = await (await cache.match('/')).text()
    await cache.addAll([...new Set(html.match(/\/assets\/[^"']+\.(?:js|css)/g) ?? [])])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    })),
  )
})
