import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { findEditedLanguageIndex } = await import("../../frontend/javascript/languages.js");
const { getConfigOrNull } = await import("../../frontend/javascript/components/profile/language-helpers.js");
const { LANG_CONFIG } = await import("../../frontend/javascript/utils.js");

const undated = { code: "en", kind: "exam", exam: "IELTS", score: 6.5 };
const other = { code: "en", kind: "exam", exam: "TOEFL_iBT_0_120", score: 95 };

test("editing a language test with a new date replaces the opened entry instead of adding a row", () => {
  const rows = [other, undated];
  assert.equal(findEditedLanguageIndex(rows, undated, { ...undated, taken_on: "2026-03-15" }), 1);
});

test("a new entry, or an edit that changes the test, is not treated as replacing the opened entry", () => {
  const rows = [other, undated];
  assert.equal(findEditedLanguageIndex(rows, null, undated), -1);
  assert.equal(findEditedLanguageIndex(rows, undated, { ...undated, exam: "PTE" }), -1);
  assert.equal(findEditedLanguageIndex(rows, undated, { ...undated, code: "de" }), -1);
  // An entry that is no longer saved (removed meanwhile) has nothing to replace.
  assert.equal(findEditedLanguageIndex([other], undated, { ...undated, taken_on: "2026-03-15" }), -1);
});

test("getConfigOrNull returns null until LANG_CONFIG has loaded keys", () => {
  const snapshot = { ...LANG_CONFIG };
  for (const key of Object.keys(LANG_CONFIG)) delete LANG_CONFIG[key];
  try {
    assert.equal(getConfigOrNull(), null);
    LANG_CONFIG.languages = [{ code: "en", name: "English" }];
    assert.equal(getConfigOrNull(), LANG_CONFIG);
  } finally {
    for (const key of Object.keys(LANG_CONFIG)) delete LANG_CONFIG[key];
    Object.assign(LANG_CONFIG, snapshot);
  }
});
