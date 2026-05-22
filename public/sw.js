// public/sw.js — Service Worker for 大卫学中文 PWA
//
// AUTO-UPDATE STRATEGY
// ─────────────────────────────────────────────────────────────────────
// `__SW_VERSION__` is replaced at build time by scripts/stamp-sw.mjs with
// a fresh timestamp on every build. That changes sw.js bytes on every
// deploy, which is what triggers the browser to install the new SW.
//
// Combined with `skipWaiting()` + `clients.claim()`, the new SW takes over
// the moment install completes — no waiting for all tabs to close.
//
// Critically, navigation requests (the HTML shell) are now NETWORK-FIRST.
// Previously they were cache-first, which meant even after the new SW
// activated, the old cached /index.html (referencing the OLD hashed bundle)
// kept serving. Users would see stale UI for hours/days until they manually
// hard-refreshed. Network-first means each online navigation fetches the
// fresh shell with the new bundle hash. Cache is only used as offline
// fallback. The user never sees an "update available" prompt — silent
// auto-reload is the right default for short-session learning flows.

const CACHE_VERSION = '__SW_VERSION__';
const SHELL_CACHE   = `jgw-${CACHE_VERSION}-shell`;
const DATA_CACHE    = `jgw-${CACHE_VERSION}-data`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: precache the shell. skipWaiting() jumps the new SW past the
// "waiting" state so activation can happen as soon as install finishes.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// Activate: purge every cache from previous versions, then claim all open
// clients so they immediately route through this new SW.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('jgw-') && k !== SHELL_CACHE && k !== DATA_CACHE)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Fetch strategy:
//   navigation (HTML)    → network-first, cache fallback (offline)
//   Supabase / REST      → network-first, cache fallback
//   CDN libraries        → cache-first
//   hashed JS/CSS assets → cache-first (immutable, content-hashed by Vite)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Navigation requests — network-first. THIS is what makes deploys
  //    visible to existing PWA installs without a hard-refresh.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, clone));
        }
        return res;
      } catch {
        // Offline — fall back to whatever we have cached, then index.html.
        return (await caches.match(req)) || (await caches.match('/index.html'));
      }
    })());
    return;
  }

  // 2. Supabase / REST — network-first, cache for offline fallback.
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(DATA_CACHE).then(c => c.put(req, clone));
        }
        return res;
      } catch {
        return caches.match(req);
      }
    })());
    return;
  }

  // 3. CDN libraries (HanziWriter etc.) — cache-first.
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdnjs')) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(DATA_CACHE).then(c => c.put(req, clone));
      }
      return res;
    })());
    return;
  }

  // 4. Default (hashed assets, fonts, etc.) — cache-first, network on miss.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});

// Background sync: upload pending offline sessions when connectivity returns.
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
