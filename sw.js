const CACHE_NAME = 'jm-finance-v7';

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

self.addEventListener('push', event => {
  let data = { title: 'JM Finance', body: 'Tienes pagos pendientes hoy.' };
  try { data = event.data.json(); } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: data.tag || 'jm-finance-pago',
      data: { url: data.url || '/' },
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
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
