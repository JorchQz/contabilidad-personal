const CACHE_NAME = 'jm-finance-v6';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './js/app.js',
  './js/router.js',
  './js/auth.js',
  './js/supabase.js',
  './js/balance.js',
  './js/cuentas.js',
  './js/deudas.js',
  './js/metas.js',
  './js/gastos.js',
  './js/ingresos.js',
  './js/onboarding.js',
  './js/presupuestos.js',
  './js/graficas.js',
  './js/export.js',
  './js/distribucion.js',
  './js/lucide.min.js',
];

const SUPABASE_ORIGIN = 'https://rzanhkfmwvbngbpjefec.supabase.co';

const CDN_PREFIXES = [
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://unpkg.com',
];

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

  // Supabase: nunca interceptar — siempre necesita red
  if (url.origin === SUPABASE_ORIGIN) return;

  // CDN: cache-first (cambian raramente, se actualiza tras precache upgrade)
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

  // Archivos locales (app shell): cache-first — ya están precacheados
  // Si no están en caché (ej. URL desconocida), intenta red y guarda
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
