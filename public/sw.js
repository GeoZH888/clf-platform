// public/sw.js — Service Worker for 甲骨文描红 PWA
// Caches core app shell + character data for offline use

const CACHE_VERSION = 'jgw-v1';
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const DATA_CACHE    = `${CACHE_VERSION}-data`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('jgw-') && k !== SHELL_CACHE && k !== DATA_CACHE)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase / API → network first, cache fallback
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(DATA_CACHE).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // HanziWriter data → cache first
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdnjs')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then(cache => cache.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // App shell → cache first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// Background sync: upload pending sessions when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sessions') {
    event.waitUntil(syncPendingSessions());
  }
});

async function syncPendingSessions() {
  // Sessions saved to IndexedDB while offline will be synced here
  // Implementation: read from IDB, POST to Supabase, clear IDB
  console.log('[SW] Syncing pending sessions...');
}
