/* sw.js — House Designer Service Worker for Complete Offline & Standalone App Support */
const CACHE_NAME = 'housedesigner-v1.3.13';
const ASSETS = [
  './',
  './index.html',
  './play3d.html',
  './style.css',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './lib/three.min.js',
  './lib/peerjs.min.js',
  './src/grid.js',
  './src/catalog.js',
  './src/sprites.js',
  './src/rooms.js',
  './src/tools.js',
  './src/presets.js',
  './src/save.js',
  './src/default-house.js',
  './src/walk.js',
  './src/input.js',
  './src/ui.js',
  './src/main.js',
  './src/sync.js',
  './src/geom3d.js',
  './src/graphics3d.js',
  './src/cull3d.js',
  './src/sky3d.js',
  './src/furniture3d.js',
  './src/life3d.js',
  './src/sound3d.js',
  './src/world3d.js',
  './src/walk3d.js',
  './src/sync3d.js',
  './src/play3d-inpage.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of ASSETS) {
        try {
          const res = await fetch(url, { cache: 'reload' });
          if (res && res.status === 200) await cache.put(url, res);
        } catch (e) {}
      }
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Always fetch version.json fresh from network for instant update verification
  if (event.request.url.includes('version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => {
        return new Response(JSON.stringify({ version: '1.1.0', offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  if (event.request.method === 'HEAD') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return new Response(null, { status: 200, statusText: 'OK', headers: cached.headers });
        return new Response(null, { status: 404, statusText: 'Not Found' });
      })
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  const isNav = event.request.mode === 'navigate';
  const fetchOpts = isNav ? { cache: 'no-cache' } : {};

  event.respondWith(
    fetch(event.request, fetchOpts)
      .then(response => {
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then(cached => {
          if (cached) return cached;
          if (isNav) {
            return caches.match('./index.html');
          }
          return new Response('Offline and not cached', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
