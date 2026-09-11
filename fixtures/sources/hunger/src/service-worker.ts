/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE_PREFIX = 'learn-your-appetite-shell-';
const CACHE = `${CACHE_PREFIX}${version}`;
const PRECACHE = [...new Set([...build, ...files, ...prerendered])];

async function deleteObsoleteCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map((key) => caches.delete(key))
  );
}

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => worker.skipWaiting())
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    deleteObsoleteCaches()
      .then(() => worker.clients.claim())
  );
});

worker.addEventListener('message', (event) => {
  if (event.data?.type === 'hunger:activate-update') {
    event.waitUntil(deleteObsoleteCaches());
  }
});

worker.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== worker.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match(request)
        ?? await caches.match(new URL('./', worker.registration.scope).toString());
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
          return response;
        }
        return cached ?? response;
      } catch {
        return cached ?? Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
