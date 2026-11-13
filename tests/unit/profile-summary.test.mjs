import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  buildProfileSummary,
  buildSectionFillStates,
  buildSummarySentence,
  parseSummaryBudget,
} = await import("../../frontend/javascript/components/profile/profile-summary.js");

// Keys stand in for localized text so the assertions stay independent of copy edits.
const ctx = {
  t: (key) => key,
  tFormat: (key, params) => `${key}:${JSON.stringify(params)}`,
  formatMoney: (amount, currency) => `${amount} ${currency}`,
  majorLabel: (major) => `major(${major})`,
};

const byId = (rows) => Object.fromEntries(rows.map((row) => [row.id, row]));

test("an empty profile leaves every summary row unused", () => {
  const rows = buildProfileSummary({}, ctx);
  assert.deepEqual(rows.map((row) => row.id), ["level", "subject", "budget", "format", "requirements", "context"]);
  assert.ok(rows.every((row) => row.state === "not_used"));
  assert.equal(buildSummarySentence(rows, ctx), "profile.ux2.summary.sentence_none");
});

test("study level, subject and budget rows react to the draft", () => {
  const rows = byId(buildProfileSummary({
    studyLevel: "Master",
    major: "Computer Science",
    budget: "25000",
    budgetCurrency: "USD",
  }, ctx));
  assert.equal(rows.level.state, "used");
  assert.equal(rows.level.value, "profile.option.study_level_master");
  assert.equal(rows.subject.state, "used");
  assert.equal(rows.subject.value, "major(Computer Science)");
  assert.equal(rows.budget.state, "used");
  assert.match(rows.budget.value, /25000 USD/);
});

test("interests alone count as subject input without claiming a major", () => {
  const rows = byId(buildProfileSummary({ interests: "robotics, ai" }, ctx));
  assert.equal(rows.subject.state, "used");
  assert.equal(rows.subject.value, "profile.ux2.summary.subject.interests_value");
  assert.equal(rows.subject.detail, "profile.ux2.summary.subject.interests");
});

test("a budget of zero or an unparseable budget is not used, matching the ranking", () => {
  assert.equal(parseSummaryBudget({ budget: "0" }).state, "zero");
  assert.equal(parseSummaryBudget({ budget: "12.5" }).state, "empty");
  assert.equal(parseSummaryBudget({ budget: "20 000" }).amount, 20000);
  assert.equal(parseSummaryBudget({ budget: 150 }).state, "set");
  const rows = byId(buildProfileSummary({ budget: "0" }, ctx));
  assert.equal(rows.budget.state, "not_used");
  assert.equal(rows.budget.detail, "profile.ux2.summary.budget.zero");
});

test("study format needs a budget to be fully used and funding type is always used", () => {
  let rows = byId(buildProfileSummary({ studyMode: "Online", budget: "9000" }, ctx));
  assert.equal(rows.format.state, "used");
  assert.match(rows.format.detail, /summary\.format\.mode$/);

  rows = byId(buildProfileSummary({ studyMode: "Online" }, ctx));
  assert.equal(rows.format.state, "partial");
  assert.match(rows.format.detail, /mode_no_budget/);

  rows = byId(buildProfileSummary({ fundingType: "grant" }, ctx));
  assert.equal(rows.format.state, "used");
  assert.match(rows.format.detail, /summary\.format\.funding/);
  assert.equal(rows.format.value, "profile.option.funding_grant");

  rows = byId(buildProfileSummary({ fundingType: "paid", studyMode: "Online" }, ctx));
  assert.equal(rows.format.state, "partial");
});

test("requirements row lists the evidence that exists", () => {
  const rows = byId(buildProfileSummary({
    gpa: "3.8",
    exams: [{ exam: "SAT", score: 1400 }],
    languages: [{ code: "en", kind: "native" }],
  }, ctx));
  assert.equal(rows.requirements.state, "used");
  assert.equal(rows.requirements.value, [
    "profile.ux2.summary.requirements.gpa 3.8 / 4",
    "SAT 1400",
    "profile.ux2.summary.requirements.languages",
  ].join(", "));
});

test("requirements row echoes the GPA scale and language test results", () => {
  const rows = byId(buildProfileSummary({
    gpa: "4.6",
    gpaScale: 5,
    languages: [{ code: "en", kind: "exam", exam: "IELTS", score: 6.5 }],
  }, ctx));
  assert.equal(rows.requirements.value, "profile.ux2.summary.requirements.gpa 4.6 / 5, IELTS 6.5");
});

test("start year and fee status mark the context row as used", () => {
  const rows = byId(buildProfileSummary({
    intendedEntryCycle: "2027 Fall",
    feeStatusContext: "self_reported_international_overseas",
  }, ctx));
  assert.equal(rows.context.state, "used");
  assert.equal(rows.context.value, "2027 Fall, profile.ux2.summary.context.fee_international");
  assert.equal(byId(buildProfileSummary({ feeStatusContext: "unknown" }, ctx)).context.state, "not_used");
});

test("the live sentence counts used and partly used groups", () => {
  const rows = buildProfileSummary({ studyLevel: "Bachelor", fundingType: "paid", studyMode: "Online" }, ctx);
  assert.equal(buildSummarySentence(rows, ctx), 'profile.ux2.summary.sentence:{"used":"2","total":"6"}');
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
  assert.equal(buildSectionFillStates({ intendedEntryCycle: "2027" }).preferences, true);
});
