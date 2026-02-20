// Service Worker para PWA - Cache offline básico
const CACHE_NAME = 'lab512-v2'
const urlsToCache = [
  '/',
  '/chat',
  '/manifest.json'
]

// Instala e faz cache dos assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

// Ativa e limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Estratégia: Network first, fallback para cache
self.addEventListener('fetch', event => {
  // Ignora requests não-GET e de outras origens
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone para cache
        const responseToCache = response.clone()
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseToCache))
        return response
      })
      .catch(() => {
        // Se offline, tenta cache
        return caches.match(event.request)
      })
  )
})
