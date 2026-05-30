import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.window = globalThis.window || {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  setTimeout,
  clearTimeout,
};
globalThis.document = globalThis.document || {
  documentElement: { setAttribute() {} },
};
if (!globalThis.navigator?.languages) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { languages: ["en-US"], language: "en-US" },
  });
}
globalThis.localStorage = globalThis.localStorage || {
  getItem() { return null; },
  setItem() {},
};

const { fetchCompareProfiles } = await import("../../frontend/javascript/pages/universities/compare-helpers.js");

function response(body, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test("fetchCompareProfiles maps batch chances and rois", async () => {
  const calls = [];
  const result = await fetchCompareProfiles([" u-a ", "u-b"], {
    apiBase: "/api",
    loadProfileForApi: () => ({ gpa: 91 }),
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      assert.equal(url, "/api/universities/compare-profiles");
      return response({
        "u-a": { uniChance: { overallChance: 70 }, roi: { roi_value: 1.2 } },
        "u-b": { uniChance: { overallChance: 40 }, roi: { roi_value: 0.8 } },
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { university_ids: ["u-a", "u-b"], profile: { gpa: 91 } });
  assert.equal(result.chances.get("u-a").overallChance, 70);
  assert.equal(result.rois.get("u-b").roi_value, 0.8);
});

test("fetchCompareProfiles keeps nulls for missing batch rows", async () => {
  const result = await fetchCompareProfiles(["u-a", "missing"], {
    apiBase: "/api",
    loadProfileForApi: () => ({}),
    fetchImpl: async () => response({
      "u-a": { uniChance: { overallChance: 70 }, roi: { roi_value: 1.2 } },
      missing: null,
    }),
  });

  assert.equal(result.chances.get("u-a").overallChance, 70);
  assert.equal(result.chances.get("missing"), null);
  assert.equal(result.rois.get("missing"), null);
});

test("fetchCompareProfiles falls back to individual endpoints when batch fails", async () => {
  const urls = [];
  const result = await fetchCompareProfiles(["u-a", "u-b"], {
    apiBase: "/api",
    loadProfileForApi: () => ({ budget: 20000 }),
    fetchImpl: async (url) => {
      urls.push(url);
      if (url === "/api/universities/compare-profiles") return response({}, false, 500);
      if (url === "/api/universities/u-a/uni-chance") return response({ overallChance: 80 });
      if (url === "/api/universities/u-a/roi") return response({ roi_value: 1.4 });
      if (url === "/api/universities/u-b/uni-chance") return response({ overallChance: 35 });
      if (url === "/api/universities/u-b/roi") return response({ roi_value: 0.7 });
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.deepEqual(urls, [
    "/api/universities/compare-profiles",
    "/api/universities/u-a/uni-chance",
    "/api/universities/u-a/roi",
    "/api/universities/u-b/uni-chance",
    "/api/universities/u-b/roi",
  ]);
  assert.equal(result.chances.get("u-a").overallChance, 80);
  assert.equal(result.rois.get("u-b").roi_value, 0.7);
});
