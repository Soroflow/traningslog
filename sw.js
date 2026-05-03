// Service Worker — Træningslog
// Strategi:
//   - App shell (HTML/CSS/JS, eksterne libs):  cache-first med baggrunds-revalidering
//   - Supabase API-kald:                       network-first med fallback til cache
//   - Andet:                                   network-first

const CACHE_VERSION = 'v3';
const APP_CACHE = `traeningslog-app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `traeningslog-runtime-${CACHE_VERSION}`;

// App-shell der precached ved install
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdn-icons-png.flaticon.com/512/10545/10545153.png',
  'https://cdn-icons-png.flaticon.com/192/10545/10545153.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => {
      // Tillad delvis fejl (CDN'er skal ikke kunne blokere installation)
      return Promise.allSettled(APP_SHELL.map(url => cache.add(url).catch(() => null)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(k => k !== APP_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isSupabaseRequest(url){
  return url.hostname.endsWith('supabase.co');
}

function isAppShellRequest(url){
  if(url.origin === self.location.origin) return true;
  // CDN'er
  return url.hostname === 'unpkg.com'
      || url.hostname === 'cdnjs.cloudflare.com'
      || url.hostname === 'cdn-icons-png.flaticon.com';
}

self.addEventListener('fetch', event => {
  const req = event.request;

  // Service workers kan ikke håndtere POST/PUT/DELETE meningsfuldt — slip dem igennem
  if(req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Supabase: network-first (med stale-fallback til cache hvis offline)
  if(isSupabaseRequest(url)){
    event.respondWith(
      fetch(req).then(response => {
        // Cache kun GETs der lykkedes
        if(response.ok){
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
        }
        return response;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 2. App shell: cache-first med revalidering i baggrunden
  if(isAppShellRequest(url)){
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(response => {
          if(response.ok){
            const copy = response.clone();
            caches.open(APP_CACHE).then(c => c.put(req, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // 3. Alt andet: network-first med fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Tillad siden at trigge en aktivering uden reload
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
