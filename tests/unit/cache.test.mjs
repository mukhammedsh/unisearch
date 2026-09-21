import "./setup.mjs";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

let localValues = {};
let sessionValues = {};

function storage(values) {
  return {
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => { values[key] = String(value); },
    removeItem: (key) => { delete values[key]; },
  };
}

window.localStorage = storage(localValues);
window.sessionStorage = storage(sessionValues);
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;

const cache = await import("../../frontend/javascript/pages/shared/cache.js");
const { SETTINGS_CACHE_KEY, SETTING_STORE_RECENT_UNIVERSITIES } = await import("../../frontend/javascript/settings.js");

beforeEach(() => {
  localValues = {};
  sessionValues = {};
  window.localStorage = storage(localValues);
  window.sessionStorage = storage(sessionValues);
  global.localStorage = window.localStorage;
  global.sessionStorage = window.sessionStorage;
});

test("guide listeners replace prior handlers instead of accumulating duplicates", () => {
  const added = [];
  const removed = [];
  const originalAdd = window.addEventListener;
  const originalRemove = window.removeEventListener;
  window.addEventListener = (type, handler) => added.push([type, handler]);
  window.removeEventListener = (type, handler) => removed.push([type, handler]);
  try {
    const first = () => {};
    const second = () => {};
    cache.bindGuideExternalUpdates(first);
    cache.bindGuideExternalUpdates(second);
    assert.deepEqual(added.slice(0, 3).map(([type]) => type), ["languageChanged", "examConfigLoaded", "languageConfigLoaded"]);
    assert.deepEqual(removed.slice(-3).map(([type, handler]) => [type, handler === first]), [
      ["languageChanged", true], ["examConfigLoaded", true], ["languageConfigLoaded", true],
    ]);

    cache.bindGuideHashChange(first);
    cache.bindGuideHashChange(second);
    assert.equal(removed.at(-1)[0], "hashchange");
    assert.equal(removed.at(-1)[1], first);
  } finally {
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
  }
});

test("tour state validates resume steps and clears session state", () => {
  assert.equal(cache.hasSeenUniversitiesTour(), false);
  cache.markUniversitiesTourSeen();
  assert.equal(cache.hasSeenUniversitiesTour(), true);

  assert.equal(cache.readUniversitiesTourResumeStep(), 0);
  cache.saveUniversitiesTourResumeStep("3");
  assert.equal(cache.readUniversitiesTourResumeStep(), 3);
  assert.equal(cache.hasUniversitiesTourResumeStep(), true);
  cache.saveUniversitiesTourResumeStep(-1);
  cache.saveUniversitiesTourResumeStep("invalid");
  assert.equal(cache.readUniversitiesTourResumeStep(), 3);
  cache.clearUniversitiesTourResumeStep();
  assert.equal(cache.hasUniversitiesTourResumeStep(), false);
});

test("ID list storage normalizes, deduplicates, and rejects non-arrays", () => {
  cache.writeIdListStorage("ids", [" one ", "", null, "one", 2]);
  assert.deepEqual(cache.readIdListStorage("ids"), ["one", "2"]);
  localValues.ids = JSON.stringify({ id: "not-a-list" });
  assert.deepEqual(cache.readIdListStorage("ids"), []);
  cache.writeIdListStorage("ids", null);
  assert.deepEqual(cache.readIdListStorage("ids"), []);
});

test("recent universities are ordered, bounded, and respect privacy settings", () => {
  for (let index = 0; index < 15; index += 1) cache.rememberRecentUniversity(`u-${index}`);
  let ids = cache.readIdListStorage(cache.RECENT_UNIVERSITIES_KEY);
  assert.equal(ids.length, cache.MAX_RECENT_UNIVERSITIES);
  assert.equal(ids[0], "u-14");
  assert.equal(ids.at(-1), "u-3");
  cache.rememberRecentUniversity("u-8");
  ids = cache.readIdListStorage(cache.RECENT_UNIVERSITIES_KEY);
  assert.equal(ids[0], "u-8");
  assert.equal(ids.filter((id) => id === "u-8").length, 1);
  cache.rememberRecentUniversity("  ");
  assert.equal(cache.readIdListStorage(cache.RECENT_UNIVERSITIES_KEY).length, 12);

  localValues[SETTINGS_CACHE_KEY] = JSON.stringify([{ key: SETTING_STORE_RECENT_UNIVERSITIES, value: true }]);
  cache.rememberRecentUniversity("private");
  assert.equal(cache.readIdListStorage(cache.RECENT_UNIVERSITIES_KEY).includes("private"), false);
});

test("detail cache validates entries, isolates languages, and updates timestamps", () => {
  assert.deepEqual(cache.readDetailCache(), {});
  cache.writeDetailCache(null);
  assert.deepEqual(cache.readDetailCache(), {});
  assert.equal(cache.getDetailCacheEntry("", "eng"), null);

  const originalNow = Date.now;
  let now = 100;
  Date.now = () => now;
  try {
    cache.setDetailCacheEntry(" uni ", { name: "English" }, "etag-eng", "ENG");
    cache.setDetailCacheEntry("uni", { name: "Russian" }, "etag-rus", "rus");
    assert.deepEqual(cache.getDetailCacheEntry("uni", "eng"), {
      key: "uni::eng", data: { name: "English" }, etag: "etag-eng", ts: 100,
    });
    assert.equal(cache.getDetailCacheEntry("uni", "de"), null);

    now = 250;
    cache.touchDetailCacheEntry("uni", "eng");
    assert.equal(cache.getDetailCacheEntry("uni", "eng").ts, 250);
    cache.touchDetailCacheEntry("missing", "eng");
    cache.touchDetailCacheEntry("", "eng");
    cache.setDetailCacheEntry("", { ignored: true });
    cache.setDetailCacheEntry("ignored", null);
  } finally {
    Date.now = originalNow;
  }
});

test("detail cache evicts the oldest records at its size bound", () => {
  const originalNow = Date.now;
  let now = 0;
  Date.now = () => ++now;
  try {
    for (let index = 0; index <= cache.DETAIL_CACHE_MAX_ITEMS; index += 1) {
      cache.setDetailCacheEntry(`u-${index}`, { index }, "", "eng");
    }
    const stored = cache.readDetailCache();
    assert.equal(Object.keys(stored).length, cache.DETAIL_CACHE_MAX_ITEMS);
    assert.equal(stored["u-0::eng"], undefined);
    assert.equal(stored["u-24::eng"].data.index, 24);
  } finally {
    Date.now = originalNow;
  }
});

function response({ ok = true, status = 200, body = {}, etag = "" } = {}) {
  return {
    ok,
    status,
    headers: { get: (name) => (name === "ETag" ? etag : "") },
    json: async () => body,
  };
}

test("detail fetch returns fresh cache without a request", async () => {
  cache.setDetailCacheEntry("fresh", { name: "Fresh" }, "v1", "eng");
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("fetch should not run"); };
  try {
    assert.deepEqual(await cache.fetchUniversityDetailCached("fresh"), { name: "Fresh" });
  } finally {
    global.fetch = originalFetch;
  }
});

test("detail fetch revalidates stale cache with ETag and handles 304", async () => {
  const originalNow = Date.now;
  Date.now = () => 1;
  cache.setDetailCacheEntry("stale", { name: "Cached" }, "v1", "eng");
  Date.now = () => cache.DETAIL_CACHE_TTL_MS + 10;
  const originalFetch = global.fetch;
  let options;
  global.fetch = async (_url, nextOptions) => {
    options = nextOptions;
    return response({ ok: false, status: 304 });
  };
  try {
    assert.deepEqual(await cache.fetchUniversityDetailCached("stale"), { name: "Cached" });
    assert.equal(options.headers["If-None-Match"], "v1");
    assert.equal(cache.getDetailCacheEntry("stale", "eng").ts, cache.DETAIL_CACHE_TTL_MS + 10);
  } finally {
    Date.now = originalNow;
    global.fetch = originalFetch;
  }
});

test("detail fetch stores successful responses and retries transient failures", async () => {
  const originalFetch = global.fetch;
  const originalTimeout = global.setTimeout;
  let attempts = 0;
  global.setTimeout = (callback) => { callback(); return 1; };
  global.fetch = async (url, options) => {
    attempts += 1;
    assert.match(String(url), /\/universities\/a%2Fb\?lang=eng$/);
    assert.deepEqual(options.headers, {});
    if (attempts === 1) throw new Error("temporary network failure");
    return response({ body: { id: "a/b" }, etag: "v2" });
  };
  try {
    assert.deepEqual(await cache.fetchUniversityDetailCached("a/b"), { id: "a/b" });
    assert.equal(attempts, 2);
    assert.equal(cache.getDetailCacheEntry("a/b", "eng").etag, "v2");
  } finally {
    global.fetch = originalFetch;
    global.setTimeout = originalTimeout;
  }
});

test("detail fetch falls back to stale data and otherwise exposes the final error", async () => {
  const originalNow = Date.now;
  const originalFetch = global.fetch;
  const originalTimeout = global.setTimeout;
  Date.now = () => 1;
  cache.setDetailCacheEntry("cached", { id: "cached" }, "", "eng");
  Date.now = () => cache.DETAIL_CACHE_TTL_MS + 50;
  global.setTimeout = (callback) => { callback(); return 1; };
  global.fetch = async () => response({ ok: false, status: 503 });
  try {
    assert.deepEqual(await cache.fetchUniversityDetailCached("cached"), { id: "cached" });
    await assert.rejects(cache.fetchUniversityDetailCached("missing"), /Backend error/);
    await assert.rejects(cache.fetchUniversityDetailCached("  "), /University ID is required/);
  } finally {
    Date.now = originalNow;
    global.fetch = originalFetch;
    global.setTimeout = originalTimeout;
  }
});
