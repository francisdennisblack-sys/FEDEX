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
  if (VERBOSE_SW) console.log('[Service Worker] Now controlling all clients');
});

// 🌐 FETCH: Serve from cache, update from network
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Firebase endpoints: network first, cache fallback
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('firestore') ||
      event.request.url.includes('storage.googleapis')) {
    
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache Firebase responses for offline
          if (response.ok && event.request.url.includes('/posts')) {
            const responseToCache = response.clone();
            caches.open(POSTS_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If Firebase fails, try cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Static assets: cache first, network fallback
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
            if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          });
      })
      .catch(() => {
                // Offline fallback: prefer cached index.html (SPA) so app still loads
        return caches.match('/index.html').then((cached) => {
          if (cached) return cached;
          // Fallback to plain text when nothing cached
          return new Response('Content not available offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
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
