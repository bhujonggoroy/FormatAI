// FormatAI PWA Service Worker
const CACHE_NAME = 'formatai-pwa-v1';

// Precached static shell assets only (never dynamic APIs or user content)
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('PWA precache notice:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: NEVER cache API routes, AI endpoints, exports, auth, or mutations
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/convert') ||
    url.pathname.startsWith('/export') ||
    url.pathname.includes('websocket') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('/@fs/')
  ) {
    // Always pass directly to the network
    return;
  }

  // Network-First strategy to ensure updates are always fresh and never cause stale deployments
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache static shell files if successfully retrieved
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname === '/' ||
           url.pathname === '/manifest.json' ||
           url.pathname.endsWith('.svg') ||
           url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.js'))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback to cache when offline
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Return offline root fallback for navigation requests
        if (event.request.mode === 'navigate') {
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
        }

        return new Response('FormatAI is running offline.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});
