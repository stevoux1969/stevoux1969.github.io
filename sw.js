// Service Worker — Ma Journée AVP
const CACHE_NAME = 'avp-cache-v' + Date.now();

// À l'installation : ne rien mettre en cache, toujours charger depuis le réseau
self.addEventListener('install', event => {
  self.skipWaiting();
});

// À l'activation : supprimer TOUS les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map(name => caches.delete(name)));
    })
  );
  self.clients.claim();
});

// Toujours charger depuis le réseau en priorité
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
