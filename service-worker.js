// 🔄 SERVICE WORKER: Handles background sync and offline persistence
// This allows the website to continue syncing data even when the tab is closed

const CACHE_NAME = 'wifi-content-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/firebase-config.js',
  '/firebase-db.js'
];

// 📦 INSTALL: Cache essential files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching essential files');
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('[Service Worker] Some files could not be cached:', err);
        // Don't fail installation if some files are missing
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting(); // Activate immediately
});

// 🚀 ACTIVATE: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

// 🌐 FETCH: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Firebase requests - always use network
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('firestore') ||
      event.request.url.includes('storage.googleapis')) {
    return; // Let Firebase handle its own requests
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request)
          .then((response) => {
            return response || new Response('Offline - content unavailable', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// 🔄 BACKGROUND SYNC: Sync when connection restored
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);
  
  if (event.tag === 'firebase-sync') {
    event.waitUntil(
      (async () => {
        try {
          // Attempt to sync with Firebase
          // This runs even if the tab is closed
          const clients = await self.clients.matchAll();
          
          if (clients.length > 0) {
            // Send message to first client to trigger sync
            clients[0].postMessage({
              type: 'BACKGROUND_SYNC',
              timestamp: new Date().toISOString()
            });
            console.log('[Service Worker] Sent sync message to client');
          } else {
            console.log('[Service Worker] No clients available for sync');
          }
          
          return Promise.resolve();
        } catch (err) {
          console.error('[Service Worker] Background sync failed:', err);
          throw err; // Retry sync
        }
      })()
    );
  }
});

// 💬 MESSAGE: Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 📢 PUSH NOTIFICATIONS: (Optional - for future use)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'WiFi Content';
  const options = {
    body: data.body || 'New content available',
    icon: '/favicon.ico',
    badge: '/favicon.ico'
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 📝 PERIODIC SYNC: Sync every 12 hours (if browser supports it)
// Note: Limited browser support, but worth trying
if ('periodicSync' in self.registration) {
  console.log('[Service Worker] Periodic sync available');
}

console.log('[Service Worker] Loaded and ready for background persistence');
