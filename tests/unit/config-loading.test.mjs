import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("configuration loaders fetch once, replace defaults, cache payloads, and emit readiness", async () => {
  const localValues = {};
  global.localStorage = window.localStorage = {
    getItem: (key) => localValues[key] ?? null,
    setItem: (key, value) => { localValues[key] = String(value); },
    removeItem: (key) => { delete localValues[key]; },
  };
  const originalFetch = global.fetch;
  const originalDispatch = window.dispatchEvent;
  const events = [];
  const calls = [];
  window.dispatchEvent = (event) => events.push(event.type);
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/exams/config")) {
      return { ok: true, json: async () => ({ exams: { CUSTOM: { label: "Custom", type: "int", min: 1, max: 9 } } }) };
    }
    if (String(url).endsWith("/languages/config")) {
      return { ok: true, json: async () => ({ language_exams: { en: [{ id: "CUSTOM_LANG", min: 1, max: 5 }] } }) };
    }
    if (String(url).endsWith("/locations")) {
      return { ok: true, json: async () => ({ Testland: ["Alpha", "Beta"] }) };
    }
    throw new Error(`unexpected URL ${url}`);
  };

  try {
    const config = await import("../../frontend/javascript/utils/config.js?loading-success");
    const exams = await config.ensureExamConfig();
    const languages = await config.ensureLanguageConfig();
    const cities = await config.ensureCityDatabase();
    assert.equal(exams.CUSTOM.label, "Custom");
    assert.equal(exams.SAT, undefined, "server config replaces rather than mixes with defaults");
    assert.equal(languages.language_exams.en[0].id, "CUSTOM_LANG");
    assert.deepEqual(cities.Testland, ["Alpha", "Beta"]);
    assert.deepEqual(events, ["examConfigLoaded", "languageConfigLoaded", "citiesLoaded"]);
    assert.equal(calls.length, 3);
    assert.ok(Object.keys(localValues).filter((key) => key.startsWith("unisearch_config_cache_v2:")).length >= 3);

    assert.equal(await config.ensureExamConfig(), exams);
    assert.equal(await config.ensureLanguageConfig(), languages);
    assert.equal(await config.ensureCityDatabase(), cities);
    assert.equal(calls.length, 3, "resolved loader promises are reused");
  } finally {
    global.fetch = originalFetch;
    window.dispatchEvent = originalDispatch;
  }
});

test("exam helpers canonicalize aliases and expose band metadata", async () => {
  const config = await import("../../frontend/javascript/utils/config.js?exam-helper-contracts");
  assert.equal(config.canonicalizeExamId("sat"), "SAT");
  assert.equal(config.canonicalizeExamId("HKDSE weighted total"), "HKDSE_WEIGHTED_TOTAL");
  assert.equal(config.canonicalizeExamId("unknown exam"), "UNKNOWN EXAM");
  assert.equal(config.getExamConfig(""), null);
  assert.equal(config.getExamInputMode("SWISS_MATURITY_CERT"), "flag");
  assert.equal(config.getExamInputMode("SAT"), "number");
  assert.equal(config.getExamBandShortLabel("HKDSE_LEVEL", 6), "5*");
  assert.equal(config.getExamBandShortLabel("HKDSE_LEVEL", "bad"), "");
  assert.deepEqual(config.getExamLevelBands("unknown"), []);
});
