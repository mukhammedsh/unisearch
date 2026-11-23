import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFilterResetPatch } from "../../frontend/javascript/pages/universities/filter-reset.js";

const defaults = { fundingType: "any", limits: { min: 0, max: 90000 }, onlySaved: false };

test("resetting filters clears the search and filters but keeps the chosen order", () => {
  const patch = buildFilterResetPatch({ sort: "uni_ai", q: "robotics", country: "US", only_reviewed: true }, defaults);
  assert.equal(patch.sort, "uni_ai");
  assert.equal(patch.q, "");
  assert.equal(patch.country, "");
  assert.equal(patch.only_reviewed, false);
  assert.equal(patch.min_tuition, 0);
  assert.equal(patch.max_tuition, 90000);
  assert.equal(patch.page, 1);
  // The UniFit sliders tune the kept order, so a reset does not touch them.
  assert.equal("practice_vs_science" in patch, false);
});

test("the relevance order belongs to the cleared search and falls back to the name order", () => {
  assert.equal(buildFilterResetPatch({ sort: "relevance" }, defaults).sort, "name_asc");
  assert.equal(buildFilterResetPatch({}, defaults).sort, "name_asc");
  assert.equal(buildFilterResetPatch({ sort: "rank_asc" }, { ...defaults, onlySaved: true }).only_saved, true);
});
