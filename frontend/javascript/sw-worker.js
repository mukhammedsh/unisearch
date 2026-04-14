const SW_VERSION = "2026-04-14-1";
const CACHE_PREFIX = "unisearch";

const IMAGE_CACHE = `${CACHE_PREFIX}-images-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${SW_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;

const MAX_IMAGE_ENTRIES = 140;
const MAX_API_ENTRIES = 90;
const MAX_STATIC_ENTRIES = 80;

const API_PATH_PREFIXES = [
  "/universities",
  "/locations",
  "/stats",
  "/exams/config",
  "/languages/config",
];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !key.endsWith(SW_VERSION))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function isImageRequest(request, url) {
  const path = url.pathname.toLowerCase();
  const normalizedPath = normalizeApiPath(path);

  if (normalizedPath.startsWith("/universities/assets/")) {
    return true;
  }

  if (url.origin !== self.location.origin) return false;

  if (request.destination === "image") {
    return path.includes("/images/");
  }
  return false;
}

function isApiRequest(request, url) {
  if (request.method !== "GET") return false;
  if (!/^https?:$/i.test(url.protocol)) return false;
  return isKnownApiPath(url.pathname);
}

function isKnownApiPath(pathname) {
  const normalized = normalizeApiPath(pathname);
  return API_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

function normalizeApiPath(pathname) {
  const path = String(pathname || "");
  if (path === "/api") return "/";
  if (path.startsWith("/api/")) return path.slice(4);
  return path;
}

function isStaticRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  // Keep localization packs cached for instant language switching,
  // but avoid caching core HTML/JS/CSS to reduce startup fragility.
  return url.pathname.startsWith("/Localization/") || url.pathname.startsWith("/frontend/Localization/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isImageRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(event, request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  if (isApiRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(event, request, API_CACHE, MAX_API_ENTRIES));
    return;
  }

  if (isStaticRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(event, request, STATIC_CACHE, MAX_STATIC_ENTRIES));
  }
});

async function staleWhileRevalidate(event, request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkUpdate = fetch(request)
    .then(async (response) => {
      if (response && isCacheableResponse(response)) {
        await cache.put(request, response.clone());
        await trimCache(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkUpdate);
    return cached;
  }

  const networkResponse = await networkUpdate;
  if (networkResponse) return networkResponse;

  return new Response("Offline", { status: 503, statusText: "Offline" });
}

function isCacheableResponse(response) {
  if (!response) return false;
  if (!(response.ok || response.type === "opaque")) return false;
  const cacheControl = String(response.headers.get("Cache-Control") || "").toLowerCase();
  return !cacheControl.includes("no-store");
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  const overflow = keys.length - maxEntries;
  const toDelete = keys.slice(0, overflow);
  await Promise.all(toDelete.map((key) => cache.delete(key)));
}
