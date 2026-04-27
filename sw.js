const CACHE_NAME = 'jm-finance-v3';

const CDN_PREFIXES = [
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://unpkg.com',
];

const SUPABASE_ORIGIN = 'https://rzanhkfmwvbngbpjefec.supabase.co';

self.addEventListener('install', event => {
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
  const url = new URL(request.url);

  // Supabase: nunca interceptar
  if (url.origin === SUPABASE_ORIGIN) return;

  // CDN externos: cache-first (cambian raramente)
  if (CDN_PREFIXES.some(p => request.url.startsWith(p))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Archivos locales (JS, CSS, HTML): network-first → siempre la versión más reciente
  event.respondWith(
    fetch(request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone));
      return response;
    }).catch(() => caches.match(request))
  );
});
