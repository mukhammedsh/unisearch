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

function loadWorker(fetchImpl = async () => new TestResponse("network")) {
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
    location: { origin },
    clients: { claim: async () => { claimedClients += 1; } },
    skipWaiting: async () => { skippedWaiting += 1; },
    addEventListener(type, listener) { listeners.set(type, listener); },
  };

  new vm.Script(workerSource, { filename: workerPath }).runInNewContext({ self, caches, fetch: fetchImpl, Response: TestResponse, URL });
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
  return { url: new URL(pathname, origin).href, method: options.method || "GET", destination: options.destination || "" };
}

test("activating the worker removes old UniSearch caches and claims clients", async () => {
  const worker = loadWorker();
  const currentCache = "unisearch-api-2026-05-05-1";
  await worker.seedCache("unisearch-api-old");
  await worker.seedCache(currentCache);
  await worker.seedCache("unrelated-cache");
  await worker.lifecycle("install");
  await worker.lifecycle("activate");

  assert.deepEqual(worker.lifecycleCounts(), { skippedWaiting: 1, claimedClients: 1 });
  assert.deepEqual(await worker.cacheNames(), [currentCache, "unrelated-cache"]);
});

test("API GETs serve a cached copy offline while other requests pass through", async () => {
  let online = true;
  const worker = loadWorker(async () => {
    if (!online) throw new Error("offline");
    return new TestResponse("latest university data");
  });
  const apiRequest = request("/universities/mit-usa-cambridge");

  const onlineResult = await worker.dispatchFetch(apiRequest);
  assert.equal(await onlineResult.response.text(), "latest university data");
  online = false;
  const offlineResult = await worker.dispatchFetch(apiRequest);
  assert.equal(await offlineResult.response.text(), "latest university data");
  await offlineResult.settled();

  assert.equal((await worker.dispatchFetch(request("/unknown"))).response, undefined);
  assert.equal((await worker.dispatchFetch(request("/universities", { method: "POST" }))).response, undefined);
  assert.equal((await worker.dispatchFetch({ ...apiRequest, url: "https://other.test/universities" })).response, undefined);
});

test("university assets try the network first and fall back to their cached copy", async () => {
  let online = true;
  const worker = loadWorker(async () => {
    if (!online) throw new Error("offline");
    return new TestResponse("university logo");
  });
  const logo = request("/universities/assets/logos/mit.png");

  assert.equal(await (await worker.dispatchFetch(logo)).response.text(), "university logo");
  online = false;
  assert.equal(await (await worker.dispatchFetch(logo)).response.text(), "university logo");
});

test("localization cache ignores failed and no-store responses", async () => {
  let response = new TestResponse("unavailable", { status: 503 });
  const worker = loadWorker(async () => response);
  const failedRequest = request("/Localization/eng");

  assert.equal((await worker.dispatchFetch(failedRequest)).response.status, 503);
  assert.equal(worker.cached("unisearch-static-2026-05-05-1", failedRequest.url), undefined);

  response = new TestResponse("private", { headers: { "cache-control": "no-store" } });
  const privateRequest = request("/Localization/ru");
  await worker.dispatchFetch(privateRequest);
  assert.equal(worker.cached("unisearch-static-2026-05-05-1", privateRequest.url), undefined);
});

test("image cache evicts the oldest entry when it exceeds its configured limit", async () => {
  const worker = loadWorker();
  const firstUrl = request("/universities/assets/logos/0.png").url;
  let lastUrl;
  for (let index = 0; index <= 260; index += 1) {
    const image = request(`/universities/assets/logos/${index}.png`);
    lastUrl = image.url;
    await worker.dispatchFetch(image);
  }

  const keys = await worker.cacheNames();
  const imageCache = "unisearch-images-2026-05-05-1";
  assert.equal(keys.includes(imageCache), true);
  assert.equal(worker.cached(imageCache, firstUrl), undefined);
  assert.equal(worker.cached(imageCache, lastUrl).body, "network");
});
