import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  catalogStudyLevelFromProfile,
  describeRankingProfile,
  legendEntries,
  missingExamNames,
} from "../../frontend/javascript/pages/universities/unifit-explanation.js";

const t = (key) => key;
const tFormat = (key, params = {}) => `${key}:${JSON.stringify(params)}`;
const ctx = { t, tFormat, formatMoney: (amount, currency) => `${amount} ${currency}`, majorLabel: (major) => major.toUpperCase() };

test("the catalog level filter takes the lower-case profile level and skips 'Any'", () => {
  assert.equal(catalogStudyLevelFromProfile({ studyLevel: "Bachelor" }), "bachelor");
  assert.equal(catalogStudyLevelFromProfile({ studyLevel: "MBA" }), "mba");
  assert.equal(catalogStudyLevelFromProfile({ studyLevel: "preparation" }), "preparation");
  assert.equal(catalogStudyLevelFromProfile({ studyLevel: "Any" }), "");
  assert.equal(catalogStudyLevelFromProfile({}), "");
});

test("the banner lists only the answers that are set", () => {
  assert.deepEqual(describeRankingProfile({}, ctx), []);
  assert.deepEqual(describeRankingProfile({ studyLevel: "Any", fundingType: "any", budget: "" }, ctx), []);
  assert.deepEqual(
    describeRankingProfile({ studyLevel: "Master", major: "physics", budget: "6000", budgetCurrency: "EUR", fundingType: "grant" }, ctx),
    ["profile.option.study_level_master", "PHYSICS", 'universities.ux2.banner.budget:{"amount":"6000 EUR"}', "profile.option.funding_grant"],
  );
  // A zero budget is ignored by the ranking, so it is not announced.
  assert.deepEqual(describeRankingProfile({ budget: "0" }, ctx), []);
  // GPA with its scale and each test name, once.
  assert.deepEqual(
    describeRankingProfile({ gpa: "4.6", gpaScale: 5, exams: [{ exam: "UNT" }], languages: [{ code: "en", exam: "IELTS" }, { code: "ru", kind: "native" }] },
      { ...ctx, examName: (id) => `name:${id}` }),
    ["GPA 4.6 / 5", "name:UNT", "name:IELTS"],
  );
});

test("the legend lists each icon meaning once, in a fixed order, and ignores unknown badges", () => {
  const entries = legendEntries([
    { key: "within_budget", icon: "banknotes", tone: "finance" },
    { key: "vibe", icon: "check-badge", tone: "match" },
    { key: "vibe", icon: "check-badge", tone: "match" },
    { key: "subject_missing", icon: "academic-cap", tone: "warning" },
    { key: "requirements_met", icon: "check-circle", tone: "requirements" },
    { key: "requirements_met", icon: "clipboard-document-list", tone: "finance" },
    { key: "unknown_thing", icon: "x", tone: "y" },
    { key: "aid", icon: "", tone: "aid" },
    null,
  ]);
  assert.deepEqual(entries.map((entry) => entry.key), ["subject_missing", "requirements_met", "requirements_met", "within_budget", "vibe"]);
  assert.equal(entries[0].labelKey, "universities.ux2.legend.subject_missing");
  // The same meaning drawn with a different icon is kept, so the legend matches what the cards show.
  assert.deepEqual(entries.filter((entry) => entry.key === "requirements_met").map((entry) => entry.icon), ["check-circle", "clipboard-document-list"]);
  assert.deepEqual(legendEntries(null), []);
  assert.deepEqual(legendEntries([]), []);
});

test("missing exams are named once, language alternatives as a language test, met or provided ones skipped", () => {
  const options = { examLabel: (id) => `name:${id}`, languageTest: "language test", joiner: "or" };
  const checks = [
    { examId: "UNT", provided: null, status: "missing" },
    { examId: "IELTS or TOEFL", mode: "any", provided: null, status: "missing" },
    { examId: "native or CEFR", mode: "any", provided: null, status: "missing" },
    { examId: "SAT or ACT", provided: null, status: "unassessed" },
    { examId: "GPA", provided: 3.5, status: "met" },
    { examId: "Math", provided: null, status: "met" },
  ];
  assert.deepEqual(missingExamNames(checks, options), ["name:UNT", "language test", "name:SAT or name:ACT"]);
  assert.deepEqual(missingExamNames([], options), []);
  assert.deepEqual(missingExamNames(null, options), []);
});
