const SW_VERSION = "2026-11-24-1";
const CACHE_PREFIX = "unisearch";

// The page registers this worker as sw.js?api=<backend origin>&v=<app version>.
// `api` lets the worker cache a backend hosted on another origin (production uses one);
// `v` gives every release its own caches, so a stale response never outlives the frontend that expects it.
const REGISTRATION_PARAMS = new URLSearchParams(String(self.location?.search || ""));
const API_ORIGIN = parseHttpOrigin(REGISTRATION_PARAMS.get("api"));
const CACHE_VERSION = [SW_VERSION, REGISTRATION_PARAMS.get("v")]
  .filter(Boolean)
  .join("-")
  .replace(/[^\w.-]/g, "_");

const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;

const MAX_IMAGE_ENTRIES = 260;
const MAX_API_ENTRIES = 90;
const MAX_STATIC_ENTRIES = 80;

const API_PATH_PREFIXES = [
  "/universities",
  "/locations",
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
        .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !key.endsWith(`-${CACHE_VERSION}`))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function parseHttpOrigin(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol) ? parsed.origin : "";
  } catch {
    // A malformed registration parameter only disables cross-origin API caching.
    return "";
  }
}

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

function isUniversityAssetRequest(url) {
  return normalizeApiPath(url.pathname.toLowerCase()).startsWith("/universities/assets/");
}

function isDocumentOrHtmlRequest(request) {
  if (!request) return false;
  if (request.mode === "navigate" || request.destination === "document") return true;
  const accept = typeof request.headers?.get === "function"
    ? String(request.headers.get("accept") || "").toLowerCase()
    : "";
  return accept.includes("text/html");
}

function isApiRequest(request, url) {
  if (request.method !== "GET") return false;
  if (!/^https?:$/i.test(url.protocol)) return false;
  if (url.origin !== self.location.origin && url.origin !== API_ORIGIN) return false;
  if (isDocumentOrHtmlRequest(request)) return false;
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

  if (isUniversityAssetRequest(url)) {
    event.respondWith(networkFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

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
  const rejectHtml = cacheName === API_CACHE;

  const networkUpdate = fetch(request)
    .then(async (response) => {
      if (response && isCacheableResponse(response, { rejectHtml })) {
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

async function networkFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && isCacheableResponse(response)) {
      await cache.put(request, response.clone());
      await trimCache(cacheName, maxEntries);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

function isCacheableResponse(response, { rejectHtml = false } = {}) {
  if (!response) return false;
  if (!(response.ok || response.type === "opaque")) return false;
  const cacheControl = String(response.headers?.get?.("Cache-Control") || "").toLowerCase();
  if (cacheControl.includes("no-store")) return false;
  if (rejectHtml) {
    const contentType = String(response.headers?.get?.("Content-Type") || "").toLowerCase();
    if (contentType.includes("text/html")) return false;
  }
  return true;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  const overflow = keys.length - maxEntries;
  const toDelete = keys.slice(0, overflow);
  await Promise.all(toDelete.map((key) => cache.delete(key)));
}
