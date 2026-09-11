/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const scopeName = new URL(self.registration.scope).pathname
  .replace(/^\/+|\/+$/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .toLowerCase() || 'root';
const cachePrefix = `sudoku-app-${scopeName}-`;
const cacheName = `${cachePrefix}${version}`;
const scopeUrl = new URL(self.registration.scope);
const versionUrl = new URL('version.json', scopeUrl);
const normalizePath = (pathname: string): string => pathname.replace(/\/+$/, '') || '/';
const assets = [...new Set([...build, ...files, ...prerendered])].filter((asset) => {
  const pathname = normalizePath(new URL(asset, scopeUrl).pathname);
  return pathname !== normalizePath(scopeUrl.pathname) && pathname !== normalizePath(versionUrl.pathname);
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(assets);

    const freshShellUrl = new URL(scopeUrl);
    freshShellUrl.searchParams.set('shell', version);
    const response = await fetch(new Request(freshShellUrl, { cache: 'reload' }));
    if (!response.ok) throw new Error(`Could not cache application shell: ${response.status}`);
    await cache.put(new Request(scopeUrl), response);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (normalizePath(url.pathname) === normalizePath(versionUrl.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(new Request(scopeUrl), response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(new Request(scopeUrl));
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  event.respondWith(
    caches.open(cacheName).then((cache) => {
      return cache.match(request).then((cached) => cached ?? fetch(request));
    })
  );
});
