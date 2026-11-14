import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  budgetTooltip,
  catalogStudyLevelFromProfile,
  closePreferenceLabels,
  describeRankingProfile,
  legendEntries,
  missingExamNames,
  reviewedMissingInputs,
  unmetMinimums,
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

test("the preference tooltip names only the sliders the university is close to", () => {
  const match = {
    userPreferences: { practice_vs_science: 0.5, social_vs_hardcore: 0.5, city_vs_campus: 0.9, budget_vs_prestige: 0.2 },
    factors: { practice_vs_science: 0.6, social_vs_hardcore: 0.95, city_vs_campus: 0.9, budget_vs_prestige: 0.36 },
  };
  // Focus is close too, but a centred slider means "doesn't matter", so only location is named.
  assert.deepEqual(closePreferenceLabels(match), ["location"]);
  assert.deepEqual(closePreferenceLabels({ ...match, userPreferences: { ...match.userPreferences, practice_vs_science: 0.55 } }), ["focus", "location"]);
  assert.deepEqual(closePreferenceLabels({ userPreferences: { practice_vs_science: 0.8 }, factors: { practice_vs_science: null } }), []);
  assert.deepEqual(closePreferenceLabels(null), []);
});

test("reviewed missing inputs join alternatives per check and skip checks without inputs", () => {
  const options = { examLabel: (id) => `name:${id}`, joiner: "or" };
  const checks = [
    { status: "missing", missingInputs: [{ exam: "SAT", needs: ["result"] }, { exam: "ACT", needs: ["result"] }] },
    { status: "missing", missingInputs: [{ field: "gpa", needs: ["result"] }, { exam: "IB", needs: ["result"] }] },
    { status: "missing", missingInputs: [{ exam: "SAT", needs: ["result"] }, { exam: "ACT", needs: ["result"] }] },
    { status: "missing" },
    { status: "unassessed", missingInputs: [{ exam: "TOEFL", needs: ["result"] }] },
    { status: "met", missingInputs: [{ exam: "IELTS" }] },
  ];
  assert.deepEqual(reviewedMissingInputs(checks, options), ["name:SAT or name:ACT", "GPA or name:IB"]);
  assert.deepEqual(reviewedMissingInputs(undefined, options), []);
});

test("unmet minimums carry the exam, the published minimum and the applicant value", () => {
  const options = { examLabel: (id) => `name:${id}`, joiner: "or", formatValue: (exam, value, context) => `${value}/${context}` };
  const checks = [
    { examId: "IELTS", minimum: 6.5, provided: 6, status: "unmet" },
    { examId: "SAT", minimum: 1300, provided: 1400, status: "met" },
    { examId: "UNT", minimum: 60, provided: null, status: "unmet" },
  ];
  assert.deepEqual(unmetMinimums(checks, options), [{ exam: "name:IELTS", minimum: "6.5/requirement", provided: "6/profile" }]);
  assert.deepEqual(unmetMinimums(null, options), []);
});

test("the budget tooltip states the price against the budget in one or two short sentences", () => {
  const helpers = { money: (value) => `$${value}`, tr: (key) => key, trf: (key, params) => `${key}:${JSON.stringify(params)}` };
  assert.equal(budgetTooltip({ status: "over", costMin: 92760, budget: 30000 }, helpers),
    'universities.tip.budget_over:{"cost":"$92760","gap":"$62760"} universities.tip.before_aid');
  assert.equal(budgetTooltip({ status: "within", costMin: 15000, budget: 30000, tuitionOnly: true }, helpers),
    'universities.tip.budget_within:{"cost":"$15000","budget":"$30000"} universities.tip.tuition_only');
  assert.equal(budgetTooltip({ status: "within", costMin: 10000, costMax: 20000, budget: 30000 }, helpers),
    'universities.tip.budget_within:{"cost":"$10000 – $20000","budget":"$30000"}');
  assert.equal(budgetTooltip({ status: "fee_status", costMin: 13000, costMax: 63000, budget: 30000 }, helpers),
    'universities.tip.budget_fee_status:{"min":"$13000","max":"$63000"}');
  // Nothing to compare without a budget or a price, and no sentence for an unknown status.
  assert.equal(budgetTooltip({ status: "over", costMin: 92760, budget: 0 }, helpers), "");
  assert.equal(budgetTooltip({ status: "within", costMin: null, budget: 30000 }, helpers), "");
  assert.equal(budgetTooltip({ status: "unknown", costMin: 1, budget: 30000 }, helpers), "");
});
