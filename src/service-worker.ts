/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = "bpsync-" + version;
// adapter-static writes the SPA fallback as /index.html; it is not in `files`, so add it.
const FALLBACK = "/index.html";
const ASSETS = [...build, ...files, FALLBACK];

sw.addEventListener("install", (event) => {
  // No skipWaiting: do not swap versions under an editing session.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) {
          await caches.delete(key);
        }
      }
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) {
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
      try {
        return await fetch(request);
      } catch (error) {
        if (request.mode === "navigate") {
          const fallback = await cache.match(FALLBACK);
          if (fallback) {
            return fallback;
          }
        }
        throw error;
      }
    })(),
  );
});
