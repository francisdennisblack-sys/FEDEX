// Legacy SW cleanup shim.
// If old clients still reference /sw.js, this worker clears stale caches and
// unregisters itself so the app can move to the latest runtime path.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all((cacheNames || []).map((name) => caches.delete(name)));
    } catch (err) {}

    try {
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((c) => {
        try { c.postMessage({ type: 'LEGACY_SW_CLEANED' }); } catch (e) {}
      });
    } catch (err) {}

    try {
      await self.registration.unregister();
    } catch (err) {}
  })());
});

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      const r = indexedDB.open('fedex-userdb', 1);
      r.onupgradeneeded = function(evt) {
        const db = evt.target.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      r.onsuccess = function(evt) { resolve(evt.target.result); };
      r.onerror = function(err) { reject(err); };
    } catch (e) { reject(e); }
  });
}

async function saveLocationToIDB(obj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      store.put(obj, 'location');
      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => reject(err);
    } catch (e) { reject(e); }
  });
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (!data || !data.type) return;
  if (data.type === 'updateLocation') {
    const payload = { lat: Number(data.lat), lon: Number(data.lon), label: data.label || '', ts: Date.now(), source: 'sw' };
    saveLocationToIDB(payload).then(() => {
      // Notify all clients about success
      self.clients.matchAll().then(clients => {
        clients.forEach(c => {
          try { c.postMessage({ type: 'locationUpdated', payload }); } catch (e) {}
        });
      });
    }).catch(err => {
      self.clients.matchAll().then(clients => {
        clients.forEach(c => { try { c.postMessage({ type: 'locationUpdateFailed', error: String(err) }); } catch (e){} });
      });
    });
  }
});
