// 🔄 SERVICE WORKER: Offline-first, background sync, post caching
// Keeps website running in background, never kills processes, enables offline access

const CACHE_NAME = 'wifi-content-v2';
const POSTS_CACHE = 'posts-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/firebase-config.js',
  '/service-worker.js'
];

// Toggle verbose logs for service worker (keep false for production/cleanup)
const VERBOSE_SW = false;

// 📦 INSTALL: Cache essential files and skip waiting
self.addEventListener('install', (event) => {
  if (VERBOSE_SW) console.log('[Service Worker] Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        if (VERBOSE_SW) console.log('[Service Worker] Caching essential files');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('[Service Worker] Some files could not be cached:', err);
          return Promise.resolve();
        });
      }),
      // Initialize posts cache
      caches.open(POSTS_CACHE).then(() => {
        if (VERBOSE_SW) console.log('[Service Worker] Posts cache ready');
      })
    ])
  );
  self.skipWaiting(); // Activate immediately without waiting
});

// 🚀 ACTIVATE: Clean up old caches and take control
self.addEventListener('activate', (event) => {
  if (VERBOSE_SW) console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== POSTS_CACHE) {
            if (VERBOSE_SW) console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients immediately
  // Notify open clients that a new service worker version is active so they can refresh
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      clientList.forEach(client => {
        try { client.postMessage({ type: 'NEW_VERSION_AVAILABLE' }); } catch (e) {}
      });
    })
  );
  if (VERBOSE_SW) console.log('[Service Worker] Now controlling all clients (and notified clients of new version)');
});

// 🌐 FETCH: Network-first for navigations/index to ensure Visit shows latest deployment,
// and cache-first for other static assets for offline support.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Firebase endpoints: network first, cache fallback (keep previous behavior)
  if (event.request.url.includes('firebase') || event.request.url.includes('firestore') || event.request.url.includes('storage.googleapis')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.includes('/posts')) {
            const responseToCache = response.clone();
            caches.open(POSTS_CACHE).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Treat navigation requests (page loads) and requests for index.html as network-first so
  // the browser visits the live deployment rather than an old cached index.html.
  const isNavigation = event.request.mode === 'navigate' || requestUrl.pathname === '/' || requestUrl.pathname.endsWith('/index.html');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Update cache with fresh index.html/network response for offline fallback
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || new Response('Service Unavailable', { status: 503 })))
    );
    return;
  }

  // Static assets: cache-first, network fallback (unchanged)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) return response;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => caches.match('/index.html').then((cached) => cached || new Response('Service Unavailable', { status: 503 })));
      })
  );
});

// 💬 MESSAGE: Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_POSTS') {
    // Cache posts from main thread
    const posts = event.data.posts;
    if (posts && Array.isArray(posts)) {
      caches.open(POSTS_CACHE).then((cache) => {
        posts.forEach(post => {
          const response = new Response(JSON.stringify(post), {
            headers: { 'Content-Type': 'application/json' }
          });
          cache.put(`/api/post/${post.id}`, response);
        });
        if (VERBOSE_SW) console.log(`[Service Worker] Cached ${posts.length} posts`);
      });
    }
  }
});

// 🔄 BACKGROUND SYNC: Keep syncing even when tab is closed
self.addEventListener('sync', (event) => {
  if (VERBOSE_SW) console.log('[Service Worker] Background sync triggered:', event.tag);
  
  if (event.tag === 'firebase-sync' || event.tag === 'post-sync') {
    event.waitUntil(
      (async () => {
        try {
          const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
          });
          
            if (clients.length > 0) {
            clients.forEach(client => {
              client.postMessage({
                type: 'BACKGROUND_SYNC_TRIGGER',
                timestamp: new Date().toISOString(),
                tag: event.tag
              });
            });
            if (VERBOSE_SW) console.log('[Service Worker] Sent sync to', clients.length, 'clients');
          }
        } catch (err) {
          if (VERBOSE_SW) console.error('[Service Worker] Background sync error:', err);
        }
      })()
    );
  }
});

if (VERBOSE_SW) console.log('[Service Worker] Loaded - offline-first mode active, background sync enabled');
