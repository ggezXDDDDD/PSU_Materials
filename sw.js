// PSU Materials Portal - Service Worker
const CACHE_NAME = 'psu-materials-v10-portal-liquid';

const STATIC_ASSETS = [
  './',
  './index.html',
  './tasks.html',
  './calendar.html',
  './manifest.json',
  './assets/css/ios_minimal_theme.css',
  './assets/css/portal-liquid.css?v=20260915_02',
  './assets/js/ios_motion.js',
  './assets/css/liquid-workspace.css?v=1',
  './assets/js/liquid-workspace.js?v=1',
  './assets/js/fuse.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.svg'
];

// Install: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Always bypass cache for auth & login
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // Never intercept API requests
  if (url.pathname.includes('/api/')) return;

  // Always fetch auth.js and login.html live from network (NO CACHE)
  if (url.pathname.endsWith('auth.js') || url.pathname.endsWith('login.html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match(req))
    );
    return;
  }

  // HTML pages: Network First, fallback to cache
  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Static assets: Cache First, fallback to network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      });
    })
  );
});
