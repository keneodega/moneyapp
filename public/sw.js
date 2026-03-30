// Minimal service worker for PWA installability
// No caching strategy — Vercel handles caching at the edge
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
