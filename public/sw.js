/* ═══════════════════════════════════════════
   CleanMap Service Worker
   - App shell: cache-first (instant load, works offline)
   - CDN libs: stale-while-revalidate
   - API calls: network-only (fresh data wins)
   ═══════════════════════════════════════════ */
const SHELL_CACHE = 'cleanmap-shell-v1';
const CDN_CACHE = 'cleanmap-cdn-v1';

const SHELL_ASSETS = [
  '/',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
      ).then(() => self.clients.claim())
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API: always live (offline queueing is handled by the app, not the SW)
  if (url.pathname.startsWith('/api/')) return;

  // CDN libraries: stale-while-revalidate
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.open(CDN_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then(res => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // App shell: cache-first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(res => {
        return caches.open(SHELL_CACHE).then(cache => {
          cache.put(event.request, res.clone());
          return res;
        });
      }).catch(() => caches.match('/'));
    })
  );
});