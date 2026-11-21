/* Bump VERSION whenever any application asset or book data changes. */
const VERSION = '2026-11-21-giacngu-v1-final';
const PREFIX = 'giac-ngu-2013-';
const SHELL = `${PREFIX}shell-${VERSION}`;
const SOURCE = '/source/Giac_Ngu_Nguon.docx';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/lib/search.mjs',
  '/lib/storage.mjs', '/data/book.json', '/manifest.webmanifest', '/icons/icon.svg',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png', '/icons/favicon-32.png', SOURCE];
const PATHS = new Set(ASSETS);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed = await caches.has(SHELL);
    const cache = await caches.open(SHELL);
    try {
      await cache.addAll(ASSETS.map(path => new Request(path, {cache:'reload', credentials:'same-origin'})));
    } catch (error) {
      if (!existed) await caches.delete(SHELL);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== SHELL).map(name => caches.delete(name)));
    await self.clients.claim();
    for (const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) {
      client.postMessage({type:'CACHE_READY',version:VERSION});
    }
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const key = url.pathname === '/' ? '/index.html' : url.pathname;
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && response.status === 200 && response.type === 'basic') {
      try { await cache.put(key, response.clone()); } catch { /* Keep a successful read available. */ }
    }
    return response;
  })());
});

async function getStatus() {
  const cache = await caches.open(SHELL);
  const results = await Promise.all(ASSETS.map(path => cache.match(path)));
  return {type:'CACHE_STATUS',version:VERSION,offlineReady:results.every(Boolean),
    sourceDocxCached:Boolean(await cache.match(SOURCE))};
}

self.addEventListener('message', event => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  const recipient = event.ports?.[0] || event.source;
  if (data.type === 'GET_CACHE_STATUS') {
    event.waitUntil((async () => {
      let status;
      try { status = await getStatus(); }
      catch { status = {type:'CACHE_STATUS',version:VERSION,offlineReady:false,sourceDocxCached:false,error:'storage-unavailable'}; }
      recipient?.postMessage({...status,requestId:data.requestId ?? null});
    })());
  }
  if (data.type === 'CACHE_SOURCE') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(SHELL);
        await cache.add(new Request(SOURCE,{cache:'reload',credentials:'same-origin'}));
        recipient?.postMessage({type:'CACHE_SOURCE_RESULT',success:true});
      } catch {
        recipient?.postMessage({type:'CACHE_SOURCE_RESULT',success:false,error:'Chưa tải được tài liệu gốc. Hãy kiểm tra mạng hoặc dung lượng lưu trữ.'});
      }
    })());
  }
});
