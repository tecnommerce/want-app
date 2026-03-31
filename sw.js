// ===================================================
// WANT - Service Worker (PWA)
// ===================================================

const CACHE_NAME = 'want-v1';

// Archivos a cachear (los más importantes)
const urlsToCache = [
  '/',
  '/index.html',
  '/tienda.html',
  '/admin.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/home.js',
  '/js/tienda.js',
  '/js/admin.js',
  '/manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('📦 Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📁 Cacheando archivos...');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('❌ Error al cachear:', error);
      })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Eliminando caché viejo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones y servir desde caché si está disponible
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, devolverlo
        if (response) {
          return response;
        }
        // Si no, buscar en la red
        return fetch(event.request)
          .then(networkResponse => {
            // No cachear peticiones de API para no tener datos obsoletos
            if (event.request.url.includes('/exec?action=')) {
              return networkResponse;
            }
            // Cachear archivos estáticos
            if (event.request.url.match(/\.(css|js|html|png|jpg|svg)$/)) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          });
      })
  );
});