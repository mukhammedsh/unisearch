import "./setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  STALE_LIST_MAX_AGE_MS,
  readStaleCatalogList,
  saveStaleCatalogList,
} from "../../frontend/javascript/pages/universities/stale-list-cache.js";
import {
  STALE_LIST_AFTER_MS,
  createUniversitiesApiState,
  fetchUniversitiesAiSort,
  fetchUniversitiesList,
} from "../../frontend/javascript/pages/universities/api-client.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

const payload = (id) => ({ items: [{ id }], total: 1 });
const originalFetch = global.fetch;

describe("stale-list-cache.js", () => {
  beforeEach(() => {
    window.localStorage = memoryStorage();
    window.APP_VERSION = "10.8.0";
  });

  afterEach(() => {
    delete window.localStorage;
    delete window.APP_VERSION;
    global.fetch = originalFetch;
    mock.timers.reset();
  });

  it("returns the saved list for the same request and nothing for another one", () => {
    assert.equal(saveStaleCatalogList('{"lang":"eng","page":"1"}', payload("mit")), true);
    assert.deepEqual(readStaleCatalogList('{"lang":"eng","page":"1"}'), payload("mit"));
    assert.equal(readStaleCatalogList('{"lang":"eng","page":"2"}'), null);
  });

  it("does not store the request key, which contains the visitor profile", () => {
    saveStaleCatalogList('{"profile":{"gpa":"3.9"}}', payload("mit"));
    const raw = window.localStorage.getItem("unisearch_catalog_last_lists_v1");
    assert.ok(raw);
    assert.equal(raw.includes("gpa"), false);
  });

  it("ignores lists from another app version and expired lists", () => {
    const now = 1_000_000;
    saveStaleCatalogList("request", payload("mit"), now);
    assert.deepEqual(readStaleCatalogList("request", now + 1000), payload("mit"));
    assert.equal(readStaleCatalogList("request", now + STALE_LIST_MAX_AGE_MS + 1), null);

    window.APP_VERSION = "10.9.0";
    assert.equal(readStaleCatalogList("request", now + 1000), null);
  });

  it("keeps only the four most recent requests", () => {
    for (let index = 0; index < 6; index += 1) saveStaleCatalogList(`request-${index}`, payload(`u${index}`));
    assert.equal(readStaleCatalogList("request-0"), null);
    assert.equal(readStaleCatalogList("request-1"), null);
    assert.deepEqual(readStaleCatalogList("request-5"), payload("u5"));
  });

  it("refuses empty or oversized results and survives unreadable storage", () => {
    assert.equal(saveStaleCatalogList("empty", { items: [], total: 0 }), false);
    assert.equal(saveStaleCatalogList("huge", { items: [{ text: "x".repeat(400_001) }], total: 1 }), false);

    window.localStorage.setItem("unisearch_catalog_last_lists_v1", "{not json");
    assert.equal(readStaleCatalogList("request"), null);
    assert.equal(saveStaleCatalogList("request", payload("mit")), true);
  });

  it("shows the last result while a slow request is pending, then returns the fresh one", async () => {
    const apiParams = new URLSearchParams("lang=eng&page=1");
    const apiState = createUniversitiesApiState();
    // A first visit stores the result under the key the client builds from the request and the stored profile.
    global.fetch = async () => ({ ok: true, status: 200, async json() { return payload("last-visit"); } });
    await fetchUniversitiesList(apiParams, { apiState: createUniversitiesApiState() });

    mock.timers.enable({ apis: ["setTimeout"] });
    let finish;
    global.fetch = () => new Promise((resolve) => {
      finish = () => resolve({ ok: true, status: 200, async json() { return payload("fresh"); } });
    });
    const shown = [];
    const pending = fetchUniversitiesList(apiParams, { apiState, onStale: (data) => shown.push(data) });

    mock.timers.tick(STALE_LIST_AFTER_MS - 1);
    assert.deepEqual(shown, []);
    mock.timers.tick(1);
    assert.deepEqual(shown, [payload("last-visit")]);

    finish();
    assert.deepEqual(await pending, payload("fresh"));
    assert.deepEqual(shown, [payload("last-visit")], "the stale callback fires once");
  });

  it("covers UniFit-sorted requests and leaves moment-specific warnings out of the saved copy", async () => {
    const request = { sort: "uni_ai", profile: { interests: "physics" } };
    global.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { ...payload("ranked"), warnings: ["Machine learning unavailable"] }; },
    });
    await fetchUniversitiesAiSort(request, { apiState: createUniversitiesApiState() });

    mock.timers.enable({ apis: ["setTimeout"] });
    let finish;
    global.fetch = () => new Promise((resolve) => {
      finish = () => resolve({ ok: true, status: 200, async json() { return { ...payload("fresh-ranked"), warnings: [] }; } });
    });
    const shown = [];
    const pending = fetchUniversitiesAiSort(request, { apiState: createUniversitiesApiState(), onStale: (data) => shown.push(data) });

    mock.timers.tick(STALE_LIST_AFTER_MS);
    assert.deepEqual(shown, [payload("ranked")]);
    finish();
    assert.deepEqual((await pending).items, payload("fresh-ranked").items);
    assert.equal(shown.length, 1);
  });

  it("does not offer a saved UniFit list to a different profile", async () => {
    global.fetch = async () => ({ ok: true, status: 200, async json() { return payload("ranked"); } });
    await fetchUniversitiesAiSort({ sort: "uni_ai", profile: { interests: "physics" } }, { apiState: createUniversitiesApiState() });

    mock.timers.enable({ apis: ["setTimeout"] });
    global.fetch = () => new Promise(() => {});
    const shown = [];
    fetchUniversitiesAiSort({ sort: "uni_ai", profile: { interests: "biology" } }, { apiState: createUniversitiesApiState(), onStale: (data) => shown.push(data) });
    mock.timers.tick(STALE_LIST_AFTER_MS * 2);

    assert.deepEqual(shown, []);
  });

  it("stays quiet when the backend answers before the slow-request threshold", async () => {
    const apiParams = new URLSearchParams("lang=eng&page=1");
    global.fetch = async () => ({ ok: true, status: 200, async json() { return payload("first"); } });
    await fetchUniversitiesList(apiParams, { apiState: createUniversitiesApiState() });

    mock.timers.enable({ apis: ["setTimeout"] });
    const shown = [];
    global.fetch = async () => ({ ok: true, status: 200, async json() { return payload("second"); } });
    const result = await fetchUniversitiesList(apiParams, { apiState: createUniversitiesApiState(), onStale: (data) => shown.push(data) });
    mock.timers.tick(STALE_LIST_AFTER_MS * 2);

    assert.deepEqual(result, payload("second"));
    assert.deepEqual(shown, []);
  });
});
