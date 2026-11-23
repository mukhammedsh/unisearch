import "./setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  abortUniversitiesApiRequests,
  createUniversitiesApiState,
  fetchUniversitiesAiSort,
  fetchUniversitiesList,
} from "../../frontend/javascript/pages/universities/api-client.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("abortUniversitiesApiRequests aborts active list and AI controllers and clears refs", () => {
  const apiState = createUniversitiesApiState({ cacheTtlMs: 30000 });
  const listController = new AbortController();
  const aiController = new AbortController();
  apiState.listFetchController = listController;
  apiState.aiFetchController = aiController;

  abortUniversitiesApiRequests(apiState);
  assert.equal(listController.signal.aborted, true);
  assert.equal(aiController.signal.aborted, true);
  assert.equal(apiState.listFetchController, null);
  assert.equal(apiState.aiFetchController, null);
  assert.doesNotThrow(() => abortUniversitiesApiRequests(null));
});

test("fetchUniversitiesList caches responses, falls back on 404/405, and returns marker on AbortError", async () => {
  const apiState = createUniversitiesApiState({ cacheTtlMs: 30000 });
  const calls = [];

  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET" });
    if (String(url).includes("/universities/profiled")) {
      return { ok: false, status: 405, async json() { return {}; } };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return { items: [{ id: "mit-usa-cambridge" }], total: 1 };
      },
    };
  };

  const first = await fetchUniversitiesList(new URLSearchParams("lang=eng&page=1"), { apiState });
  assert.deepEqual(first, { items: [{ id: "mit-usa-cambridge" }], total: 1 });
  assert.deepEqual(calls.map((c) => c.method), ["POST", "GET"]);
  assert.ok(apiState.profiledEndpointUnavailableUntil > Date.now());

  const second = await fetchUniversitiesList(new URLSearchParams("lang=eng&page=1"), { apiState });
  assert.deepEqual(second, first);
  assert.equal(calls.length, 2);

  global.fetch = async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    throw abortError;
  };
  const aborted = await fetchUniversitiesList(new URLSearchParams("lang=eng&page=2"), { apiState });
  assert.deepEqual(aborted, { items: [], total: 0, __aborted: true });

  global.fetch = async () => ({ ok: false, status: 500, async json() { return {}; } });
  await assert.rejects(
    () => fetchUniversitiesList(new URLSearchParams("lang=eng&page=3"), { apiState }),
    /API Error/,
  );
});

test("fetchUniversitiesAiSort caches responses, handles AbortError, and rejects on backend failure", async () => {
  const apiState = createUniversitiesApiState({ cacheTtlMs: 30000 });
  let fetchCount = 0;

  global.fetch = async (url, init = {}) => {
    fetchCount += 1;
    assert.match(String(url), /\/universities\/ai-sort$/);
    assert.equal(init.method, "POST");
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          items: [{ id: "stanford-usa", matchData: { mlApplied: true } }],
          total: 1,
          warnings: ["ok"],
        };
      },
    };
  };

  const payload = { lang: "eng", profile: { interests: "computer science" }, page: 1 };
  const first = await fetchUniversitiesAiSort(payload, { apiState });
  assert.equal(first.total, 1);
  assert.deepEqual(first.warnings, ["ok"]);
  assert.equal(fetchCount, 1);

  const cached = await fetchUniversitiesAiSort(payload, { apiState });
  assert.deepEqual(cached, first);
  assert.equal(fetchCount, 1);

  global.fetch = async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    throw abortError;
  };
  const aborted = await fetchUniversitiesAiSort({ lang: "eng", page: 2 }, { apiState });
  assert.deepEqual(aborted, { items: [], total: 0, __aborted: true });

  global.fetch = async () => ({ ok: false, status: 503, async json() { return {}; } });
  await assert.rejects(
    () => fetchUniversitiesAiSort({ lang: "eng", page: 3 }, { apiState }),
    /AI sort API Error/,
  );
});
