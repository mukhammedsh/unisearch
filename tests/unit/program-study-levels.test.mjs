import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { getProgramLevelKeys } from "../../frontend/javascript/pages/university/render-content.js";

test("MBA programs get a dedicated level while unrelated master programs stay master's", () => {
  assert.deepEqual(getProgramLevelKeys({
    name: "Full-Time MBA (Master in Business Administration)",
    study_levels: ["Master"],
  }), ["mba"]);
  assert.deepEqual(getProgramLevelKeys({
    name: "Master of Business Analytics (MBAn)",
    study_levels: ["Master"],
  }), ["master"]);
  assert.deepEqual(getProgramLevelKeys({
    name: "MBA for Executives",
    study_levels: ["Master", "Professional"],
  }), ["mba"]);
});

test("unknown and missing study levels are not inferred as bachelor's", () => {
  assert.deepEqual(getProgramLevelKeys({
    name: "Pilot Future Credential",
    study_levels: ["Future Credential"],
  }), ["future credential"]);
  assert.deepEqual(getProgramLevelKeys({ name: "Unscoped Program" }), []);
});
