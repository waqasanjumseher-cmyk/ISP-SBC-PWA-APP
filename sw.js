// Minimal service worker — mainly here to satisfy the "installable PWA"
// requirement (Chrome/PWABuilder expect an active SW with a fetch handler)
// and give basic offline fallback for the app shell itself. The app's real
// data lives in Firebase + localStorage, not in this cache, so this stays
// deliberately simple: cache the app shell on install, serve it from cache
// first, and always try the network first for everything so a bump to
// index.html on GitHub Pages shows up on next load instead of being stuck
// on a stale cached copy.
const CACHE_NAME = 'sbc-erp-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('SW install cache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests — everything else (Firebase,
  // Google Fonts, gstatic SDK scripts, etc.) passes straight through to
  // the network untouched.
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
