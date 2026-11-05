importScripts('./offline-assets.js');
const PREFIX = 'bible-pilot-release-';
const CACHE = PREFIX + self.OFFLINE_RELEASE.id;
const files = self.OFFLINE_RELEASE.urls.map(path => ({
  url: new URL(path, self.registration.scope).href,
  integrity: self.OFFLINE_RELEASE.integrity[path],
}));
const marker = new URL('./offline-ready', self.registration.scope).href;
function isPage(file) {
  return file.url === self.registration.scope || new URL(file.url).pathname.endsWith('/index.html');
}
async function fetchPage(file) {
  const response = await fetch(new Request(file.url, { cache: 'reload' }));
  const html = await response.clone().text();
  // Hosting may append its own scripts; verify our release stamp and hashed entrypoints instead of HTML bytes.
  if (!response.ok || !html.includes(`<meta name="bible-release" content="${self.OFFLINE_RELEASE.id}">`) ||
      !self.OFFLINE_RELEASE.entrypoints.every(path => html.includes(`"${path}"`))) {
    throw new Error('Wrong HTML release');
  }
  return response;
}

async function complete() {
  if (!(await caches.has(CACHE))) return false;
  const cache = await caches.open(CACHE);
  return (await Promise.all(files.map(file => cache.match(file.url, { ignoreVary: true })))).every(Boolean);
}
async function saved() {
  return !!(await caches.match(marker, { cacheName: CACHE })) && await complete();
}
async function download() {
  const cache = await caches.open(CACHE);
  // Integrity prevents a deployment changing midway from producing a mixed release.
  await cache.addAll(files.filter(file => !isPage(file)).map(file => new Request(file.url, { cache: 'reload', integrity: file.integrity })));
  for (const file of files.filter(isPage)) await cache.put(file.url, await fetchPage(file));
  if (!(await complete())) throw new Error('Incomplete release');
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const keys = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
      const hadSavedRelease = (await Promise.all(keys.map(async key => (await caches.open(key)).match(marker)))).some(Boolean);
      await download();
      if (hadSavedRelease) await (await caches.open(CACHE)).put(marker, new Response('ready'));
      // Updates wait for the reader; the initial installation can take control immediately.
      if (!self.registration.active) await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep one previous release until older tabs have reloaded.
    const older = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    await Promise.all(older.slice(0, -1).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  const port = event.ports[0];
  if (!port || !['STATUS', 'DOWNLOAD'].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'DOWNLOAD') {
        if (!(await complete())) await download();
        await (await caches.open(CACHE)).put(marker, new Response('ready'));
      }
      port.postMessage({ saved: await saved() });
    } catch {
      port.postMessage({ saved: false, error: 'Не удалось сохранить выпуск. Проверьте соединение и свободное место, затем попробуйте ещё раз.' });
    }
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Worker scripts and their release manifest must always reach the network update check.
  const file = files.find(file => file.url === event.request.url ||
    (event.request.mode === 'navigate' && new URL(file.url).pathname === new URL(event.request.url).pathname));
  if (!file) return;
  event.respondWith((async () => {
    const cached = await caches.match(file.url, { cacheName: CACHE, ignoreVary: true });
    if (cached) return cached;
    return isPage(file) ? fetchPage(file) : fetch(new Request(file.url, { integrity: file.integrity, cache: 'no-cache' }));
  })());
});
