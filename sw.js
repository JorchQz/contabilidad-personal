const CACHE_NAME = 'jm-finance-v4';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/main.css',
  './js/app.js',
  './manifest.json',
];

const CDN_PREFIXES = [
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://unpkg.com',
];

const SUPABASE_ORIGIN = 'https://rzanhkfmwvbngbpjefec.supabase.co';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase: nunca interceptar
  if (url.origin === SUPABASE_ORIGIN) return;

  // CDN externos: cache-first (cambian raramente)
  if (CDN_PREFIXES.some(p => request.url.startsWith(p))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Archivos locales: network-first con timeout 3s → fallback a caché
  const networkWithTimeout = Promise.race([
    fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
      }
      return response;
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
  ]);

  event.respondWith(
    networkWithTimeout.catch(() => caches.match(request))
  );
});
