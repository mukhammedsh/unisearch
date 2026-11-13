import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  catalogStudyLevelFromProfile,
  describeRankingProfile,
  legacyWhyReasons,
  orderWhyReasons,
  reviewedWhyReasons,
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

test("missing exams are named and an over-budget card says by how much", () => {
  const reasons = legacyWhyReasons({ conditionalExam: true, missingExamNames: ["UNT"], overBudget: true, overBudgetBy: "$200" }, t, tFormat);
  assert.deepEqual(reasons.map((reason) => reason.label), [
    'universities.ux2.why.exam_needed_named:{"exams":"UNT"}',
    'universities.ux2.why.over_budget_by:{"amount":"$200"}',
  ]);
});

test("reasons are ordered negative, unknown, positive, deduplicated and capped at three", () => {
  const reasons = [
    { kind: "subject", sentiment: "positive", label: "subject" },
    { kind: "requirements", sentiment: "negative", label: "requirements" },
    { kind: "budget", sentiment: "unknown", label: "budget" },
    { kind: "budget", sentiment: "negative", label: "duplicate budget" },
    { kind: "vibe", sentiment: "positive", label: "fourth" },
  ];
  assert.deepEqual(orderWhyReasons(reasons).map((reason) => reason.label), ["requirements", "budget", "subject"]);
  assert.deepEqual(orderWhyReasons(null), []);
});

test("legacy reasons reuse the badge labels and add the positive states the data proves", () => {
  const labels = (flags) => legacyWhyReasons(flags, t).map((reason) => reason.label);
  assert.deepEqual(labels({ missingProgram: true, offersSubject: false }), ["universities.badge.no_matching_program"]);
  assert.deepEqual(labels({ offersSubject: true, meetsRequirements: true, withinBudget: true }),
    ["universities.ux2.why.offers_subject", "universities.badge.requirements_met", "universities.ux2.why.within_budget"]);
  assert.deepEqual(labels({ overBudget: true, overBudgetAid: true }), ["universities.badge.over_budget_aid"]);
  assert.deepEqual(labels({ priceUnknown: true }), ["universities.ux2.why.price_unknown"]);
  assert.deepEqual(labels({ belowRequirements: true, conditionalExam: true }), ["universities.badge.below_requirements"]);
  // Missing exam evidence is an unknown to resolve, not a failed requirement.
  const missing = legacyWhyReasons({ conditionalExam: true }, t);
  assert.deepEqual(missing.map((reason) => [reason.label, reason.sentiment]), [["universities.ux2.why.exam_needed", "unknown"]]);
  assert.deepEqual(labels({}), []);
});

test("reviewed reasons come from the card indicators and flag a budget without a comparable price", () => {
  const indicators = [
    { kind: "subject", sentiment: "positive", label: "Your subject is offered" },
    { kind: "vibe", sentiment: "positive", label: "Your vibe" },
    { kind: "requirements", sentiment: "negative", label: "Minimum requirements match: 50%", counts: { met: 1, total: 2 } },
  ];
  const reasons = reviewedWhyReasons(indicators, { finalScore: 0.4 }, 20000, t, tFormat);
  assert.deepEqual(reasons.map((reason) => reason.kind), ["subject", "requirements", "budget"]);
  assert.equal(reasons[0].label, "universities.ux2.why.offers_subject");
  assert.equal(reasons[1].label, 'universities.ux2.why.minimums_partial:{"met":1,"total":2}');
  assert.equal(reasons[2].sentiment, "unknown");
  // Without a budget, or without a score, there is nothing to say about the price.
  assert.equal(reviewedWhyReasons([], { finalScore: 0.4 }, null, t, tFormat).length, 0);
  assert.equal(reviewedWhyReasons([], {}, 20000, t, tFormat).length, 0);
  const allMet = reviewedWhyReasons([{ kind: "requirements", sentiment: "positive", counts: { met: 2, total: 2 } },
    { kind: "budget", sentiment: "positive", label: "Within your budget" }], { finalScore: 0.4 }, 20000, t, tFormat);
  assert.deepEqual(allMet.map((reason) => reason.label), ["universities.ux2.why.minimums_met", "Within your budget"]);
});
