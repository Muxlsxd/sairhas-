const CACHE_NAME = 'sairhas-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
];
const CACHE_STRATEGIES = {
  static: 'cache-first',
  api: 'network-first',
  fonts: 'cache-first'
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests - network first with cache fallback
  if (url.origin === 'https://script.google.com' || url.pathname.includes('/macros/')) {
    event.respondWith(networkFirstThenCache(request));
    return;
  }

  // Fonts - cache first
  if (url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://fonts.googleapis.com') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Static assets - cache first
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstThenCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ ok: false, error: 'Offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sairhas-sync') {
    event.waitUntil(processSyncQueue());
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'sync') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: 'process-sync' });
  }
}