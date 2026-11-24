import "./setup.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const workerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/javascript/sw-worker.js");
const workerSource = fs.readFileSync(workerPath, "utf8");
const origin = "https://unisearch.test";

class TestResponse {
  constructor(body, { status = 200, type = "basic", headers = {} } = {}) {
    this.body = body;
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.type = type;
    this.headers = { get: (name) => headers[name.toLowerCase()] || null };
  }

  clone() {
    return new TestResponse(this.body, { status: this.status, type: this.type });
  }

  async text() {
    return this.body;
  }
}

function loadWorker(fetchImpl = async () => new TestResponse("network"), { search = "" } = {}) {
  const listeners = new Map();
  const data = new Map();
  let skippedWaiting = 0;
  let claimedClients = 0;
  const caches = {
    async open(name) {
      if (!data.has(name)) data.set(name, new Map());
      const entries = data.get(name);
      return {
        async match(request) { return entries.get(request.url); },
        async put(request, response) { entries.set(request.url, response.clone()); },
        async keys() { return [...entries.keys()].map((url) => ({ url })); },
        async delete(request) { return entries.delete(request.url); },
      };
    },
    async keys() { return [...data.keys()]; },
    async delete(name) { return data.delete(name); },
  };
  const self = {
    location: { origin, search },
    clients: { claim: async () => { claimedClients += 1; } },
    skipWaiting: async () => { skippedWaiting += 1; },
    addEventListener(type, listener) { listeners.set(type, listener); },
  };

  new vm.Script(workerSource, { filename: workerPath }).runInNewContext({ self, caches, fetch: fetchImpl, Response: TestResponse, URL, URLSearchParams });
  return {
    listeners,
    cacheNames: () => caches.keys(),
    seedCache: async (name) => { await caches.open(name); },
    cached: (name, url) => data.get(name)?.get(url),
    lifecycle: async (type) => {
      let pending;
      listeners.get(type)({ waitUntil(value) { pending = Promise.resolve(value); } });
      await pending;
    },
    dispatchFetch: async (request) => {
      let response;
      const pending = [];
      listeners.get("fetch")({
        request,
        respondWith(value) { response = Promise.resolve(value); },
        waitUntil(value) { pending.push(Promise.resolve(value)); },
      });
      return {
        response: response ? await response : undefined,
        settled: () => Promise.all(pending),
      };
    },
    lifecycleCounts: () => ({ skippedWaiting, claimedClients }),
  };
}

function request(pathname, options = {}) {
  const headerEntries = Object.entries(options.headers || {}).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = value;
    return acc;
  }, {});
  return {
    url: new URL(pathname, origin).href,
    method: options.method || "GET",
    mode: options.mode || "cors",
    destination: options.destination || "",
    headers: { get: (name) => headerEntries[String(name).toLowerCase()] || null },
  };
}

test("activating the worker removes old UniSearch caches and claims clients", async () => {
  const worker = loadWorker();
  const currentCache = "unisearch-api-2026-11-24-2";
  await worker.seedCache("unisearch-api-old");
  await worker.seedCache(currentCache);
  await worker.seedCache("unrelated-cache");
  await worker.lifecycle("install");
  await worker.lifecycle("activate");

  assert.deepEqual(worker.lifecycleCounts(), { skippedWaiting: 1, claimedClients: 1 });
  assert.deepEqual(await worker.cacheNames(), [currentCache, "unrelated-cache"]);
});

test("API GETs serve a cached copy offline while HTML navigations and other requests pass through", async () => {
  let online = true;
  const worker = loadWorker(async () => {
    if (!online) throw new Error("offline");
    return new TestResponse("latest university data", { headers: { "content-type": "application/json" } });
  });
  const apiRequest = request("/universities/mit-usa-cambridge", { headers: { Accept: "application/json" } });

  const onlineResult = await worker.dispatchFetch(apiRequest);
  assert.equal(await onlineResult.response.text(), "latest university data");
  online = false;
  const offlineResult = await worker.dispatchFetch(apiRequest);
  assert.equal(await offlineResult.response.text(), "latest university data");
  await offlineResult.settled();

  assert.equal((await worker.dispatchFetch(request("/universities/mit-usa-cambridge", { mode: "navigate", destination: "document" }))).response, undefined);
  assert.equal((await worker.dispatchFetch(request("/universities/mit-usa-cambridge", { destination: "document" }))).response, undefined);
  assert.equal((await worker.dispatchFetch(request("/universities/mit-usa-cambridge", { headers: { Accept: "text/html" } }))).response, undefined);
  assert.equal((await worker.dispatchFetch(request("/unknown"))).response, undefined);
  assert.equal((await worker.dispatchFetch(request("/universities", { method: "POST" }))).response, undefined);
  assert.equal((await worker.dispatchFetch({ ...apiRequest, url: "https://other.test/universities" })).response, undefined);
});

test("API cache never stores unexpected text/html responses", async () => {
  const worker = loadWorker(async () => new TestResponse("<!DOCTYPE html>", { headers: { "content-type": "text/html; charset=utf-8" } }));
  const htmlFallbackRequest = request("/universities/mit-usa-cambridge");

  const result = await worker.dispatchFetch(htmlFallbackRequest);
  assert.equal(await result.response.text(), "<!DOCTYPE html>");
  assert.equal(worker.cached("unisearch-api-2026-11-24-2", htmlFallbackRequest.url), undefined);
});

test("university assets try the network first and fall back to their cached copy", async () => {
  let online = true;
  const worker = loadWorker(async () => {
    if (!online) throw new Error("offline");
    return new TestResponse("campus thumbnail");
  });
  const thumbnail = request("/universities/assets/thumbnails/mit-usa-cambridge.webp");

  assert.equal(await (await worker.dispatchFetch(thumbnail)).response.text(), "campus thumbnail");
  online = false;
  assert.equal(await (await worker.dispatchFetch(thumbnail)).response.text(), "campus thumbnail");
});

test("localization cache ignores failed and no-store responses", async () => {
  let response = new TestResponse("unavailable", { status: 503 });
  const worker = loadWorker(async () => response);
  const failedRequest = request("/Localization/eng");

  assert.equal((await worker.dispatchFetch(failedRequest)).response.status, 503);
  assert.equal(worker.cached("unisearch-static-2026-11-24-2", failedRequest.url), undefined);

  response = new TestResponse("private", { headers: { "cache-control": "no-store" } });
  const privateRequest = request("/Localization/ru");
  await worker.dispatchFetch(privateRequest);
  assert.equal(worker.cached("unisearch-static-2026-11-24-2", privateRequest.url), undefined);
});

test("image cache evicts the oldest entry when it exceeds its configured limit", async () => {
  const worker = loadWorker();
  const firstUrl = request("/universities/assets/thumbnails/0.jpg").url;
  let lastUrl;
  for (let index = 0; index <= 260; index += 1) {
    const image = request(`/universities/assets/thumbnails/${index}.jpg`);
    lastUrl = image.url;
    await worker.dispatchFetch(image);
  }

  const keys = await worker.cacheNames();
  const imageCache = "unisearch-images-2026-11-24-2";
  assert.equal(keys.includes(imageCache), true);
  assert.equal(worker.cached(imageCache, firstUrl), undefined);
  assert.equal(worker.cached(imageCache, lastUrl).body, "network");
});

test("a backend on another origin is cached when the page registers the worker with its origin", async () => {
  const backend = "https://api.unisearch.test";
  let online = true;
  const worker = loadWorker(async () => {
    if (!online) throw new Error("offline");
    return new TestResponse("catalog page", { type: "cors", headers: { "content-type": "application/json" } });
  }, { search: `?api=${encodeURIComponent(backend)}&v=10.8.0` });
  const catalog = request(`${backend}/universities?limit=24&lang=en`);

  assert.equal(await (await worker.dispatchFetch(catalog)).response.text(), "catalog page");
  online = false;
  const offline = await worker.dispatchFetch(catalog);
  assert.equal(await offline.response.text(), "catalog page");
  await offline.settled();
  assert.equal(worker.cached("unisearch-api-2026-11-24-2-10.8.0", catalog.url).body, "catalog page");

  assert.equal((await worker.dispatchFetch(request(`${backend}/universities`, { method: "POST" }))).response, undefined);
  assert.equal((await worker.dispatchFetch(request("https://other.test/universities"))).response, undefined);
  assert.equal((await worker.dispatchFetch(request(`${backend}/health`))).response, undefined);
});

test("a cross-origin backend is ignored when the registration names no usable origin", async () => {
  for (const search of ["", "?api=not-a-url", "?api=ftp%3A%2F%2Fapi.unisearch.test"]) {
    const worker = loadWorker(undefined, { search });
    const result = await worker.dispatchFetch(request("https://api.unisearch.test/universities"));
    assert.equal(result.response, undefined, `search ${JSON.stringify(search)} must not enable cross-origin caching`);
  }
});

test("each app version gets its own caches and activation drops the previous release", async () => {
  const worker = loadWorker(undefined, { search: "?v=10.9.0" });
  await worker.seedCache("unisearch-api-2026-11-24-2-10.8.0");
  await worker.seedCache("unisearch-api-2026-11-24-2-10.9.0");
  await worker.lifecycle("activate");

  assert.deepEqual(await worker.cacheNames(), ["unisearch-api-2026-11-24-2-10.9.0"]);
});

test("static snapshot JSON and campus assets use the static and image caches", async () => {
  let online = true;
  const worker = loadWorker(async (req) => {
    if (!online) throw new Error("offline");
    if (req.url.includes("/snapshot/assets/")) {
      return new TestResponse("snapshot-webp", { headers: { "content-type": "image/webp" } });
    }
    return new TestResponse('{"items":[]}', { headers: { "content-type": "application/json" } });
  });

  const catalogReq = request("/snapshot/catalog/eng.json");
  const assetReq = request("/snapshot/assets/thumbnails-small/mit-usa-cambridge.webp");

  assert.equal(await (await worker.dispatchFetch(catalogReq)).response.text(), '{"items":[]}');
  assert.equal(await (await worker.dispatchFetch(assetReq)).response.text(), "snapshot-webp");
  assert.equal(worker.cached("unisearch-static-2026-11-24-2", catalogReq.url).body, '{"items":[]}');
  assert.equal(worker.cached("unisearch-images-2026-11-24-2", assetReq.url).body, "snapshot-webp");

  online = false;
  assert.equal(await (await worker.dispatchFetch(catalogReq)).response.text(), '{"items":[]}');
  assert.equal(await (await worker.dispatchFetch(assetReq)).response.text(), "snapshot-webp");
});
