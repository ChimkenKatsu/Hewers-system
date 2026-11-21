const CACHE = __OFFLINE_CACHE__;
const FILES = __OFFLINE_FILES__;
const FILE_PATHS = new Set(FILES);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(file => new Request(file, {cache:'reload', credentials:'omit'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('hewers-shell-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/login')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.status < 500) return response;
        const cached = await (await caches.open(CACHE)).match('/');
        return cached || response;
      } catch {
        return await (await caches.open(CACHE)).match('/') || Response.error();
      }
    })());
  } else if (FILE_PATHS.has(url.pathname) && url.pathname !== '/' && !url.search) {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE)).match(request);
      return cached || fetch(request);
    })());
  }
});
