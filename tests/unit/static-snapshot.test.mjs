import "./setup.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  profileRequiresServerCatalogCosts,
  queryStaticCatalog,
  queryStaticMapPoints,
  queryStaticNavbarSearch,
  queryStaticStudyOptions,
} from "../../frontend/javascript/pages/universities/snapshot-filter.js";
import {
  hasStaticSnapshotAssets,
  loadStaticCatalog,
  loadStaticSnapshotManifest,
  resetStaticSnapshotCache,
  staticSnapshotAssetUrl,
} from "../../frontend/javascript/utils/static-snapshot.js";
import { createUniversitiesApiState, fetchUniversitiesList } from "../../frontend/javascript/pages/universities/api-client.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  window.APP_STATIC_SNAPSHOT = false;
  resetStaticSnapshotCache();
});

const SAMPLE_CATALOG = {
  schema_version: "static-snapshot-1.0",
  lang: "eng",
  total: 3,
  items: [
    {
      card: {
        id: "mit-usa-cambridge",
        name: "Massachusetts Institute of Technology",
        rank: 1,
        location: { country: "United States", city: "Cambridge", state: "Massachusetts" },
        coordinates: { lat: 42.3601, lon: -71.0942 },
        search_aliases: ["mit", "мти"],
        abbreviations: ["mit"],
        admissions_catalog: { availability: "reviewed" },
        catalog_costs: {
          annual_total: { min: 92760, max: 92760, currency: "USD", annual_comparable: true },
          tuition: { min: 66720, max: 66720, currency: "USD", annual_comparable: true },
        },
        cover_available: true,
      },
      map_label: "MIT",
      costs_by_level: {
        masters: {
          annual_total: { min: 98000, max: 98000, currency: "USD", annual_comparable: true },
          tuition: { min: 68000, max: 68000, currency: "USD", annual_comparable: true },
        },
      },
      meta: {
        country: "united states",
        city: "cambridge",
        state: "massachusetts",
        study_levels: ["undergraduate", "masters", "doctoral"],
        formats: ["on-campus"],
        has_grant: null,
        has_paid: null,
        rank_num: 1,
        acceptance_rate: 4.5,
        search: {
          names: ["massachusetts institute of technology", "массачусетский технологический институт"],
          cities: ["cambridge", "кембридж"],
          countries: ["united states", "сша"],
          states: ["massachusetts"],
          tags: ["stem"],
          majors: ["computer science"],
          programs: ["computer science and engineering"],
        },
      },
    },
    {
      card: {
        id: "nu-kaz-astana",
        name: "Nazarbayev University",
        rank: 401,
        location: { country: "Kazakhstan", city: "Astana", state: "" },
        coordinates: { lat: 51.0906, lon: 71.3984 },
        search_aliases: ["nu", "ну"],
        abbreviations: ["nu"],
        admissions_catalog: { availability: "reviewed" },
        catalog_costs: {
          annual_total: null,
          tuition: { min: 15000, max: 15000, currency: "USD", annual_comparable: true },
        },
        cover_available: true,
      },
      map_label: "NU",
      meta: {
        country: "kazakhstan",
        city: "astana",
        state: "",
        study_levels: ["preparation", "undergraduate", "masters"],
        formats: [],
        has_grant: null,
        has_paid: null,
        rank_num: 401,
        acceptance_rate: null,
        search: {
          names: ["nazarbayev university", "назарбаев университет"],
          cities: ["astana", "астана"],
          countries: ["kazakhstan", "казахстан"],
          states: [],
          tags: ["research"],
          majors: ["computer science"],
          programs: ["bachelor of science in computer science"],
        },
      },
    },
    {
      card: {
        id: "oxford-uk",
        name: "University of Oxford",
        rank: 3,
        location: { country: "United Kingdom", city: "Oxford", state: "" },
        coordinates: { lat: 51.7548, lon: -1.2544 },
        search_aliases: ["oxford"],
        abbreviations: [],
        admissions_catalog: { availability: "legacy_unreviewed" },
        catalog_costs: {
          annual_total: { min: 45000, max: 55000, currency: "GBP", annual_comparable: true },
          tuition: { min: 35000, max: 45000, currency: "GBP", annual_comparable: true },
        },
        cover_available: true,
      },
      map_label: "Oxford",
      meta: {
        country: "united kingdom",
        city: "oxford",
        state: "",
        study_levels: ["bachelor", "master"],
        formats: ["on-campus"],
        has_grant: false,
        has_paid: true,
        rank_num: 3,
        acceptance_rate: 16.5,
        search: {
          names: ["university of oxford"],
          cities: ["oxford"],
          countries: ["united kingdom"],
          states: [],
          tags: ["historic"],
          majors: ["law"],
          programs: ["computer science"],
        },
      },
    },
  ],
};

const convertToUsd = (amount, currency) => (currency === "GBP" ? amount * 1.25 : amount);

test("profileRequiresServerCatalogCosts keeps anonymous browsing on static snapshot", () => {
  assert.equal(profileRequiresServerCatalogCosts({}, {}), false);
  assert.equal(profileRequiresServerCatalogCosts({ budget: 30000, fundingType: "grant" }, { country: "Kazakhstan" }), false);
  assert.equal(profileRequiresServerCatalogCosts({ major: "Computer Science" }, {}), true);
  assert.equal(profileRequiresServerCatalogCosts({ studyLevel: "masters" }, {}), true);
  assert.equal(profileRequiresServerCatalogCosts({ selectedAdmissionChoices: { mit: { studyOptionId: "opt-1" } } }, {}), true);
  assert.equal(profileRequiresServerCatalogCosts({}, { major: "Engineering" }), true);
});

test("queryStaticCatalog filters, searches (including layout flip), converts tuition, and sorts", () => {
  const byCountry = queryStaticCatalog(SAMPLE_CATALOG, { country: "Kazakhstan" }, { convertToUsd });
  assert.deepEqual(byCountry.items.map((u) => u.id), ["nu-kaz-astana"]);

  // Grant filter excludes explicit false (Oxford) while keeping reviewed unknown (null).
  const grants = queryStaticCatalog(SAMPLE_CATALOG, { funding_type: "grant", sort: "rank_asc" }, { convertToUsd });
  assert.deepEqual(grants.items.map((u) => u.id), ["mit-usa-cambridge", "nu-kaz-astana"]);

  // Keyboard layout flip: "ьше" -> "mit"
  const flipped = queryStaticCatalog(SAMPLE_CATALOG, { q: "ьше", sort: "relevance" }, { convertToUsd });
  assert.equal(flipped.items[0].id, "mit-usa-cambridge");

  // Tuition filter with reviewed annual_total -> tuition partial fallback for NU ($15k) and GBP conversion for Oxford.
  const affordable = queryStaticCatalog(SAMPLE_CATALOG, { max_tuition: "20000", cost_basis: "annual_total" }, { convertToUsd });
  assert.deepEqual(affordable.items.map((u) => u.id), ["nu-kaz-astana"]);
  assert.equal(affordable.items[0].catalog_costs.tuition.filter_match, "partial");

  // Scoped costs_by_level applies when study_level is selected.
  const masters = queryStaticCatalog(SAMPLE_CATALOG, { study_level: "masters", sort: "tuition_desc" }, { convertToUsd });
  const mitMaster = masters.items.find((u) => u.id === "mit-usa-cambridge");
  assert.equal(mitMaster.catalog_costs.annual_total.min, 98000);
});

test("queryStaticMapPoints applies viewport bounds and antimeridian wrap", () => {
  const europe = queryStaticMapPoints(
    SAMPLE_CATALOG,
    {},
    { west: -10, south: 45, east: 10, north: 60 },
    { convertToUsd },
  );
  assert.deepEqual(europe.items.map((u) => u.id), ["oxford-uk"]);
  assert.equal(europe.items[0].map_label, "Oxford");

  const wrapped = queryStaticMapPoints(
    SAMPLE_CATALOG,
    {},
    { west: 60, south: 35, east: -60, north: 60 },
    { convertToUsd },
  );
  assert.deepEqual(wrapped.items.map((u) => u.id), ["mit-usa-cambridge", "nu-kaz-astana"]);
});

test("queryStaticNavbarSearch and queryStaticStudyOptions filter locally", () => {
  const nav = queryStaticNavbarSearch(SAMPLE_CATALOG, "astana", 5);
  assert.deepEqual(nav.map((u) => u.id), ["nu-kaz-astana"]);

  const studyPayload = {
    institution_id: "mit-usa-cambridge",
    revision: "rev-1",
    shared_routes: [{ id: "first-year" }],
    preparation_entries: [{ id: "prep-1" }],
    items: [
      { id: "cs-bs", title: "Computer Science", levels: ["undergraduate"], awards: ["SB"], major_tags: ["computer science"] },
      { id: "mba", title: "MBA", levels: ["masters"], awards: ["MBA"], major_tags: ["business"] },
    ],
  };
  const ug = queryStaticStudyOptions(studyPayload, { major: "Computer Science", study_level: "undergraduate" });
  assert.deepEqual(ug.items.map((o) => o.id), ["cs-bs"]);
  assert.equal("major_tags" in ug.items[0], false);
  assert.equal(ug.shared_routes.length, 1);

  const grad = queryStaticStudyOptions(studyPayload, { search: "mba", study_level: "masters" });
  assert.deepEqual(grad.items.map((o) => o.id), ["mba"]);
  assert.deepEqual(grad.shared_routes, []);
});

test("fetchUniversitiesList serves static snapshot with zero backend API calls when enabled", async () => {
  window.APP_STATIC_SNAPSHOT = true;
  const fetchedUrls = [];
  global.fetch = async (url) => {
    const u = String(url);
    fetchedUrls.push(u);
    if (u.endsWith("/snapshot/manifest.json")) {
      return {
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        async json() {
          return { schema_version: "static-snapshot-1.0", assets_included: true, reviewed_ids: ["mit-usa-cambridge"] };
        },
      };
    }
    if (u.endsWith("/snapshot/catalog/eng.json")) {
      return {
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        async json() {
          return SAMPLE_CATALOG;
        },
      };
    }
    throw new Error(`Unexpected backend call: ${u}`);
  };

  const manifest = await loadStaticSnapshotManifest();
  assert.equal(manifest.assets_included, true);
  assert.equal(hasStaticSnapshotAssets(), true);
  assert.equal(staticSnapshotAssetUrl("thumbnails-small/mit.webp"), "/snapshot/assets/thumbnails-small/mit.webp");

  const apiState = createUniversitiesApiState({ cacheTtlMs: 30000 });
  const result = await fetchUniversitiesList(new URLSearchParams("lang=eng&sort=rank_asc&page=1&limit=24"), { apiState });
  assert.deepEqual(result.items.map((u) => u.id), ["mit-usa-cambridge", "oxford-uk", "nu-kaz-astana"]);
  assert.equal(result.total, 3);
  assert.equal(fetchedUrls.some((u) => u.includes("/universities")), false);
  assert.ok(await loadStaticCatalog("eng"));
});
