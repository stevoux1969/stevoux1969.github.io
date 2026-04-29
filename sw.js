// Service Worker — Ma Journée AVP
// Gère le cache hors ligne

const CACHE_NAME = 'avp-cache-v1';

// Fichiers à mettre en cache pour le mode hors ligne
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
];

// Installation : mise en cache des ressources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('AVP: Cache ouvert');
      // On cache ce qu'on peut, on ignore les erreurs pour les externes
      return Promise.allSettled(
        URLS_TO_CACHE.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  // Pour Firebase et les APIs externes : toujours réseau d'abord
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('onesignal.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('docs.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si pas internet, retourner une réponse vide propre
        return new Response(JSON.stringify({offline: true}), {
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }

  // Pour les autres ressources : cache d'abord, réseau ensuite
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(response => {
        // Mettre en cache la nouvelle ressource
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Hors ligne et pas en cache : retourner la page principale
        return caches.match('/index.html');
      });
    })
  );
});
