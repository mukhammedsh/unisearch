import "./setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { getFilterLimits } from "../../frontend/javascript/currency.js";
import { initI18n, setLanguage } from "../../frontend/javascript/i18n.js";
import { saveProfile } from "../../frontend/javascript/utils/persistence.js";
import {
  applyUrlParamsToState,
  buildCatalogAiSortPayload,
  buildCatalogParams,
  buildFallbackListParams,
  buildSectionUrlParams,
  clampPercent,
  clampTuition,
  countActiveFilters,
  createInitialCatalogState,
  hasProfileEvidence,
  normalizeCompareIdList,
  parseCompareIds,
  readPageParams,
} from "../../frontend/javascript/pages/universities/query-state.js";

const previousFetch = global.fetch;
global.fetch = async (url) => {
  const target = String(url || "").split("?")[0];
  if (target.endsWith("Localization/eng")) {
    return {
      ok: true,
      async text() {
        return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8");
      },
    };
  }
  return { ok: false, async text() { return ""; } };
};
await initI18n();
global.fetch = previousFetch;

let savedLocalStorage;
let savedWindowLocalStorage;
let savedWindowLocation;
let storageMap;

beforeEach(() => {
  savedLocalStorage = global.localStorage;
  savedWindowLocalStorage = global.window.localStorage;
  savedWindowLocation = global.window.location;
  storageMap = new Map();
  global.localStorage = {
    getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, value) => storageMap.set(key, String(value)),
    removeItem: (key) => storageMap.delete(key),
  };
  global.window.localStorage = global.localStorage;
  global.window.location = { protocol: "http:", hostname: "localhost", pathname: "/", search: "", href: "http://localhost/" };
  setLanguage("eng", { persist: false, emit: false });
});

afterEach(() => {
  global.localStorage = savedLocalStorage;
  global.window.localStorage = savedWindowLocalStorage;
  global.window.location = savedWindowLocation;
});

test("clampPercent, clampTuition, hasProfileEvidence, and compare ID list helpers enforce bounds and deduplication", () => {
  assert.equal(clampPercent(120), 100);
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent("not-a-number", 42), 42);
  assert.equal(clampPercent(37.6), 38);

  const limits = getFilterLimits("USD");
  assert.equal(clampTuition(-100, limits), limits.min);
  assert.equal(clampTuition(limits.max + 5000, limits), limits.max);
  assert.equal(clampTuition("abc", limits, 12000), 12000);

  assert.equal(hasProfileEvidence({ exams: [], languages: [] }), false);
  assert.equal(hasProfileEvidence({ exams: [{ id: "SAT", score: 1500 }], languages: [] }), true);
  assert.equal(hasProfileEvidence({ exams: [], languages: [{ code: "en", level: "C1" }] }), true);

  assert.deepEqual(normalizeCompareIdList([" mit ", "", "mit", "stanford", "harvard"]), ["mit", "stanford"]);
  assert.deepEqual(parseCompareIds(" mit, ,oxford , mit, cambridge "), ["mit", "oxford"]);
});

test("createInitialCatalogState resolves defaults, query-triggered relevance sort, saved currency bounds, and minRangeGap", () => {
  const usdLimits = getFilterLimits("USD");
  saveProfile({ fundingType: "grant", exams: [{ id: "SAT", score: 1450 }] });

  const withProfile = createInitialCatalogState({
    pageParams: new URLSearchParams(""),
    savedState: {},
    currentCurrency: "USD",
    currentLimits: usdLimits,
  });
  assert.equal(withProfile.defaultSortMode, "uni_ai");
  assert.equal(withProfile.state.sort, "uni_ai");
  assert.equal(withProfile.state.funding_type, "grant");
  assert.equal(withProfile.state.min_tuition, usdLimits.min);
  assert.equal(withProfile.state.max_tuition, usdLimits.max);

  const kztLimits = getFilterLimits("KZT");
  const withSearchAndConvertedBounds = createInitialCatalogState({
    pageParams: new URLSearchParams("?q=%20MIT%20&tab=compare&ids=mit,stanford"),
    savedState: {
      currency: "USD",
      min_tuition: 10000,
      max_tuition: 999999,
      sort: "name_asc",
      only_saved: "1",
    },
    currentCurrency: "KZT",
    currentLimits: kztLimits,
  });
  assert.deepEqual(withSearchAndConvertedBounds.initialCompareIds, ["mit", "stanford"]);
  assert.equal(withSearchAndConvertedBounds.state.activeTab, "compare");
  assert.equal(withSearchAndConvertedBounds.state.q, "MIT");
  assert.equal(withSearchAndConvertedBounds.state.sort, "relevance");
  assert.equal(withSearchAndConvertedBounds.state.only_saved, true);
  assert.equal(withSearchAndConvertedBounds.state.max_tuition, kztLimits.max);
  assert.ok(withSearchAndConvertedBounds.state.min_tuition >= kztLimits.min);
  assert.ok(withSearchAndConvertedBounds.state.max_tuition >= withSearchAndConvertedBounds.state.min_tuition + kztLimits.step);
});

test("countActiveFilters, buildCatalogParams, buildSectionUrlParams, buildCatalogAiSortPayload, and buildFallbackListParams match API and URL contracts", () => {
  const limits = getFilterLimits("USD");
  saveProfile({ fundingType: "any", interests: "artificial intelligence", budget: 25000 });

  const defaultState = {
    q: "",
    country: "",
    region: "",
    city: "",
    study_level: "",
    funding_type: "any",
    min_tuition: limits.min,
    max_tuition: limits.max,
    cost_basis: "annual_total",
    sort: "name_asc",
    only_saved: false,
    practice_vs_science: 50,
    social_vs_hardcore: 50,
    budget_vs_prestige: 50,
    city_vs_campus: 50,
    activeTab: "catalog",
    viewMode: "list",
    page: 2,
    limit: 24,
  };
  assert.equal(countActiveFilters(defaultState, limits), 0);

  const searchRelevanceState = { ...defaultState, q: "MIT", sort: "relevance" };
  assert.equal(countActiveFilters(searchRelevanceState, limits), 1);

  const aiState = {
    ...defaultState,
    q: "Robotics",
    country: "United States",
    region: "Massachusetts",
    city: "Cambridge",
    min_tuition: 5000,
    max_tuition: 50000,
    cost_basis: "tuition",
    sort: "uni_ai",
    activeTab: "compare",
    only_saved: true,
  };
  assert.equal(countActiveFilters(aiState, limits), 7);

  const apiParams = buildCatalogParams(aiState, {
    forApi: true,
    currentCurrency: "USD",
    currentLimits: limits,
    focusUniId: "mit-usa-cambridge",
  });
  assert.equal(apiParams.get("fields"), "card");
  assert.equal(apiParams.get("sort"), "name_asc");
  assert.equal(apiParams.get("limit"), "2000");
  assert.equal(apiParams.get("page"), "1");
  assert.equal(apiParams.get("cost_basis"), "tuition");
  assert.equal(apiParams.get("focus_uni"), null);

  const fallbackParams = buildFallbackListParams(apiParams, { ...aiState, q: "", only_saved: false, page: 3, limit: 24 });
  assert.equal(fallbackParams.get("sort"), "name_asc");
  assert.equal(fallbackParams.get("page"), "3");
  assert.equal(fallbackParams.get("limit"), "24");

  const sectionParams = buildSectionUrlParams(aiState, {
    currentCurrency: "USD",
    currentLimits: limits,
    focusUniId: "mit-usa-cambridge",
  });
  assert.equal(sectionParams.get("tab"), "compare");
  assert.equal(sectionParams.get("sort"), "uni_ai");
  assert.equal(sectionParams.get("only_saved"), "1");
  assert.equal(sectionParams.get("focus_uni"), "mit-usa-cambridge");
  assert.equal(sectionParams.get("compare"), null);
  assert.equal(sectionParams.get("ids"), null);

  let debugStage = "";
  const aiPayload = buildCatalogAiSortPayload(
    { ...aiState, only_saved: false, viewMode: "map" },
    {
      currentCurrency: "USD",
      currentLimits: limits,
      logTranslationDebug: (stage) => {
        debugStage = stage;
      },
    },
  );
  assert.equal(debugStage, "ai-sort payload");
  assert.equal(aiPayload.limit, 200);
  assert.equal(aiPayload.page, 1);
  assert.equal(aiPayload.cost_basis, "tuition");
  assert.equal(aiPayload.min_tuition, 4999);
  assert.equal(aiPayload.max_tuition, 50001);
});

test("readPageParams and applyUrlParamsToState hydrate URL parameters and focus_uni safely", () => {
  const limits = getFilterLimits("USD");
  global.window.location = {
    protocol: "http:",
    hostname: "localhost",
    pathname: "/",
    search: "?q=Oxford&view=map&page=4&only_saved=true&focus_uni=oxford-uk",
    href: "http://localhost/?q=Oxford&view=map&page=4&only_saved=true&focus_uni=oxford-uk&min_tuition=10000&max_tuition=50000&cost_basis=tuition",
  };

  assert.equal(readPageParams().get("focus_uni"), "oxford-uk");
  const state = {
    q: "",
    sort: "name_asc",
    country: "",
    region: "",
    city: "",
    study_level: "",
    cost_basis: "annual_total",
    min_tuition: limits.min,
    max_tuition: limits.max,
    only_saved: false,
    page: 1,
    viewMode: "list",
  };
  const { focusUniId } = applyUrlParamsToState(state, {
    currentCurrency: "USD",
    currentLimits: limits,
  });
  assert.equal(focusUniId, "oxford-uk");
  assert.equal(state.q, "Oxford");
  assert.equal(state.sort, "relevance");
  assert.equal(state.viewMode, "map");
  assert.equal(state.page, 4);
  assert.equal(state.only_saved, true);
  assert.equal(state.cost_basis, "tuition");
  assert.equal(state.min_tuition, 10000);
  assert.equal(state.max_tuition, 50000);
});
