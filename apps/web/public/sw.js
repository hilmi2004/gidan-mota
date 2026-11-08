/**
 * AutoDey PWA Service Worker
 *
 * Designed for Nigerian mobile network realities (3G/4G packet loss, intermittent offline transitions):
 * 1. Pre-caches the application shell (`/`, `/index.html`, `/manifest.webmanifest`).
 * 2. Uses Network-First with Cache Fallback for GET `/api/v1/listings` and `/api/v1/auctions` browse queries
 *    so buyers can still view recently browsed cars when signal drops.
 * 3. Never caches mutation requests or live bid endpoints.
 */
const SHELL_CACHE = 'autodey-shell-v1';
const API_BROWSE_CACHE = 'autodey-browse-api-v1';

const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== API_BROWSE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Network-first with cached fallback for read-only browse endpoints
  if (
    url.pathname.startsWith('/api/v1/listings') ||
    url.pathname.startsWith('/api/v1/dealers') ||
    url.pathname.startsWith('/api/v1/pricing/config')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_BROWSE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // SPA navigation fallback to cached index.html when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => cached || caches.match('/')),
      ),
    );
  }
});

