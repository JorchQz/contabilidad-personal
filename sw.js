const CACHE_NAME = 'jm-finance-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/js/app.js',
  '/js/router.js',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/onboarding.js',
  '/js/balance.js',
  '/js/cuentas.js',
  '/js/gastos.js',
  '/js/ingresos.js',
  '/js/deudas.js',
  '/js/metas.js',
  '/js/presupuestos.js',
  '/js/graficas.js',
  '/js/lucide.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
];

const SUPABASE_ORIGIN = 'https://rzanhkfmwvbngbpjefec.supabase.co';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
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
  const url = new URL(request.url);

  if (url.origin === SUPABASE_ORIGIN) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
