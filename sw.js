// Service Worker — Non Quality Drop AI
self.addEventListener('install', function(e) {
    self.skipWaiting();
});
self.addEventListener('activate', function(e) {
    e.waitUntil(clients.claim());
});
// Intercept all fetch requests — don't cache anything (prevents Sources tab caching)
self.addEventListener('fetch', function(e) {
    e.respondWith(fetch(e.request));
});
