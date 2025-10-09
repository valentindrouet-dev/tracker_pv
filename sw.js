
// Simple service worker for PV Tracker PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open('pv-tracker-v1').then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './manifest.webmanifest'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => !['pv-tracker-v1'].includes(k)).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Avoid caching Firebase and Google CDN requests to prevent auth/db issues
const shouldBypass = (url) => {
  return /(googleapis\.com|gstatic\.com|firebaseio\.com|google-analytics\.com|analytics\.google\.com)/.test(url);
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || shouldBypass(url.hostname)) return;

  // Cache-first for same-origin files; network-first for HTML
  if (url.origin === self.location.origin) {
    if (req.headers.get('accept')?.includes('text/html')) {
      event.respondWith((async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open('pv-tracker-v1');
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          return cached || caches.match('./index.html');
        }
      })());
      return;
    }

    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(response => {
        const copy = response.clone();
        caches.open('pv-tracker-v1').then(cache => cache.put(req, copy));
        return response;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
