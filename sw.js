/* sw.js — House Designer Service Worker for Instant Loading & Standalone App Mode */
const CACHE_NAME = 'housedesigner-v1';
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
  './src/sync.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {});
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
  if (event.request.method !== 'GET') return;
  // Network first, falling back to cache
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
