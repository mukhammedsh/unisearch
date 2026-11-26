import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSectionFillStates, parseSummaryBudget } from "../../frontend/javascript/components/profile/profile-summary.js";

test("budget parsing distinguishes missing, zero and positive values", () => {
  assert.equal(parseSummaryBudget({ budget: "" }).state, "empty");
  assert.equal(parseSummaryBudget({ budget: "0" }).state, "zero");
  assert.deepEqual(parseSummaryBudget({ budget: "30000" }), { state: "set", amount: 30000 });
});

test("outline markers follow the section that holds each answer", () => {
  assert.deepEqual(buildSectionFillStates({}), {
    basics: false, preferences: false, scores: false, languages: false, specific: false,
  });
  assert.deepEqual(buildSectionFillStates({
    studyMode: "Online",
    fundingType: "grant",
    gpa: "4",
    languages: [{ code: "ru", kind: "native" }],
    languageEvidence: [{ kind: "primary_language", language: "en" }],
  }), { basics: true, preferences: true, scores: true, languages: true, specific: true });
});
