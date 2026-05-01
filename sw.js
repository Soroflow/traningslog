const CACHE_NAME = 'soroflow-v3.1';

// Aktiverne der skal caches for offline brug
const ASSETS = [
  './',
  './index.html',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// 1. Install: Opret cachen og hent alle assets
self.addEventListener('install', e => {
  // Tving den nye service worker til at blive aktiv med det samme
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching assets');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activate: Ryd op i gamle caches fra tidligere versioner
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
});

// 3. Fetch: Stale-while-revalidate strategi
// Leverer indhold fra cache med det samme, men opdaterer i baggrunden
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(e.request).then(cachedResponse => {
        const fetchPromise = fetch(e.request).then(networkResponse => {
          // Gem den nye version i cachen til næste gang
          if (networkResponse.ok) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Hvis netværket fejler (offline), returneres den cachede version
          return cachedResponse;
        });

        // Returner cachen med det samme hvis den findes, ellers vent på netværk
        return cachedResponse || fetchPromise;
      });
    })
  );
});
