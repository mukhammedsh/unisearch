import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { costFact, coveredRequirementFactIds, deadlineFact, englishRecommendationItem, englishStatus, fundingFact, minimumChecklist, renderAdmissionsKeyFacts, renderTabAnswers, requirementsFact } = await import("../../frontend/javascript/pages/university/admissions-key-facts.js");
await initI18n();
setLanguage("eng", { emit: false });

const NOW = new Date(2026, 10, 9, 12, 0);
const events = list => ({ id: "dates", value: {}, topic: "deadlines", source_ids: ["official"], publication_status: "published",
  review_status: "verified", normalized_status: { publication: "published", review: "verified" },
  scope: { option_ids: ["cs"], route_ids: [], levels: ["undergraduate"], applicant_categories: [] }, attributes: { deadline_events: list } });
const context = (extra = {}) => ({
  institution_id: "university", context: {}, selected_option: { id: "cs", title: "Computer Science", levels: ["undergraduate"] },
  selected_route: { id: "first-year", title: "First-year admission", shared_policy_context_ids: [] }, facts: [], fact_groups: {},
  sources: [{ id: "official", url: "https://example.edu/apply" }], available_routes: [], ...extra,
});
const withRows = rows => context({ facts: rows, fact_groups: { deadlines: rows.map(row => row.id) } });
const withDates = list => withRows([events(list)]);
// Runs `run` with the reader's currency settings stored as the settings page stores them.
const withCurrencySettings = (currency, mode, run) => {
  const original = global.localStorage;
  global.localStorage = { getItem: key => key === "unisearch_settings_cache_v1" ? JSON.stringify([
    { key: "preferred_currency", value: currency }, { key: "currency_display_mode", value: mode },
  ]) : null, setItem() {}, removeItem() {} };
  try { run(); } finally { global.localStorage = original; }
};
const quote = extra => ({ min: 15000, max: 15000, currency: "USD", period: "2026-2027", billing_period: "academic_year",
  annual_comparable: true, fee_statuses: [], fee_status_match: "not_required", usd: { min: 15000, max: 15000 }, ...extra });

test("the next date counts days to the nearest action date and ignores decisions and earlier-cycle references", () => {
  const decisions = { ...events([]), id: "rounds", attributes: {}, value: { windows: [{ name: "Regular", application_due: "2027-01-13", decision: "2026-11-20" }] } };
  const fact = deadlineFact(withRows([events([
    { date: "2026-11-01", deadline_type: "application", publication_status: "published" },
    { date: "2026-11-15", deadline_type: "application", publication_status: "published_dated_reference" },
  ]), decisions]), NOW);
  assert.equal(fact.status, "upcoming");
  assert.equal(fact.days, 65);
  assert.match(fact.text, /in 65 days/);
});

test("passed dates are flagged and a path without dated deadlines says so instead of guessing a year", () => {
  const passed = deadlineFact(withDates([{ date: "2026-11-01", deadline_type: "application", publication_status: "published" }]), NOW);
  assert.equal(passed.status, "passed");
  assert.equal(passed.tone, "danger");
  assert.match(passed.text, /have passed/);
  const described = deadlineFact(withDates([{ date: "November 1", deadline_type: "application", publication_status: "published" }]), NOW);
  assert.equal(described.status, "described");
  assert.match(described.text, /Dates tab/);
  assert.equal(deadlineFact(context(), NOW).status, "none");
});

test("yearless rounds and application periods are shown as published without a countdown", () => {
  const rounds = { ...events([]), id: "rounds", attributes: {}, value: { windows: [
    { name: "Early Action", application_due: "November 1", decision: "mid-December" },
    { name: "Regular Action", application_due: "January 4" }] } };
  const yearless = deadlineFact(withRows([rounds]), NOW);
  assert.equal(yearless.status, "yearless");
  assert.match(yearless.text, /without a year: Early application \(Early Action\): November 1; Regular application \(Regular Action\): January 4/);
  assert.equal(yearless.days, undefined);
  const period = { ...events([]), id: "window", attributes: {}, normalized_status: { publication: "partially_published", review: "verified" },
    value: { application_period: "October 2026–August 2027", submission: "rolling basis" } };
  assert.match(deadlineFact(withRows([period]), NOW).text, /Application period: October 2026–August 2027/);
});

const recurringRounds = (label = "Recurring first-year dates; page does not specify entry year", kind = "yearless_policy") => ({
  ...events([]), id: "rounds", attributes: {}, period: { kind, label },
  value: { windows: [{ name: "Early Action", application_due: "November 1" }, { name: "Regular Action", application_due: "January 4" }] } });

test("yearless dates the record describes as recurring get their next calendar occurrence with a countdown", () => {
  const today = new Date(2026, 10, 10, 12, 0);
  const fact = deadlineFact(withRows([recurringRounds()]), today);
  assert.equal(fact.status, "recurring");
  assert.equal(fact.days, 55);
  assert.equal(fact.text, "January 4 — Regular application (Regular Action), in about 55 days");
  assert.deepEqual(fact.terms, ["regular_action"]);
  assert.equal(fact.passedWindows.length, 1);
  // Before the first round nothing has passed; after the last one the next occurrence is the following year's first round.
  const beforeEarly = deadlineFact(withRows([recurringRounds()]), new Date(2026, 9, 1, 12, 0));
  assert.equal(beforeEarly.text, "November 1 — Early application (Early Action), in about 31 days");
  const afterRegular = deadlineFact(withRows([recurringRounds()]), new Date(2027, 0, 10, 12, 0));
  assert.equal(afterRegular.text, "November 1 — Early application (Early Action), in about 295 days");
  assert.equal(deadlineFact(withRows([recurringRounds()]), new Date(2027, 0, 4, 12, 0)).text, "January 4 — Regular application (Regular Action), today");
  setLanguage("rus", { emit: false });
  assert.equal(deadlineFact(withRows([recurringRounds()]), today).text, "4 января — Обычная подача (Regular Action), примерно через 55 дн.");
  setLanguage("eng", { emit: false });
});

test("yearless dates are not turned into annual dates unless the record says they recur", () => {
  // The same dates in a record without a recurring description keep the published wording and have no countdown.
  for (const row of [recurringRounds("Current published policy; cycle not specified"), recurringRounds("Recurring first-year dates", "named"),
    { ...recurringRounds(), period: null }]) {
    const fact = deadlineFact(withRows([row]), NOW);
    assert.equal(fact.status, "yearless");
    assert.equal(fact.days, undefined);
  }
  // A recurring record keeps a date with a published year, an unparseable date and a prose-only record out of the annual rule.
  const withYear = { ...recurringRounds(), value: { windows: [{ name: "Regular Action", application_due: "January 4, 2027" }, { name: "Early Action", application_due: "early November" }] } };
  assert.notEqual(deadlineFact(withRows([withYear]), NOW).status, "recurring");
  const prose = { ...events([]), id: "prose", attributes: {}, period: null,
    value: "REA Common Application deadline is November 1; RD deadline is January 5. The page lists recurring month/day deadlines without an explicit entry year." };
  const described = deadlineFact(withRows([prose]), NOW);
  assert.equal(described.status, "described");
  assert.equal(described.days, undefined);
});

// Stanford keeps its published prose record and adds a structured companion with the same standing month/day dates.
const stanfordProse = { ...events([]), id: "rounds-prose", attributes: {}, period: null,
  value: "REA Common Application deadline is November 1; RD deadline is January 5. The reviewed page lists recurring month/day deadlines without an explicit entry year." };
const stanfordWindows = (windows, label) => ({ ...events([]), id: "rounds-windows", attributes: {},
  period: { kind: "yearless_policy", label }, value: { windows } });
const stanfordFirstYear = stanfordWindows([
  { name: "Restrictive Early Action", application_due: "November 1", aid_due: "November 15", decision: "mid-December" },
  { name: "Regular Decision", application_due: "January 5", aid_due: "February 15", decision: "early April" }], "Recurring first-year dates; page does not specify entry year");
const stanfordTransfer = stanfordWindows([{ name: "Transfer application", application_due: "March 15", aid_due: "March 15", decision: "mid-May" }],
  "Recurring transfer deadline; page does not label a calendar year");

test("Stanford's recurring first-year and transfer windows get the next calendar occurrence while the prose alone does not", () => {
  const today = new Date(2026, 10, 10, 12, 0);
  assert.equal(deadlineFact(withRows([stanfordProse]), today).status, "described");
  const firstYear = deadlineFact(withRows([stanfordProse, stanfordFirstYear]), today);
  assert.equal(firstYear.status, "recurring");
  assert.equal(firstYear.days, 56);
  assert.equal(firstYear.text, "January 5 — Regular application (Regular Decision), in about 56 days");
  assert.deepEqual(firstYear.terms, ["regular_decision"]);
  // After Regular Decision the following year's Restrictive Early Action date leads.
  assert.equal(deadlineFact(withRows([stanfordProse, stanfordFirstYear]), new Date(2027, 0, 10, 12, 0)).text, "November 1 — Early application with limits (Restrictive Early Action), in about 295 days");
  const transfer = deadlineFact(withRows([stanfordProse, stanfordTransfer]), today);
  assert.equal(transfer.status, "recurring");
  assert.equal(transfer.days, 125);
  assert.equal(transfer.text, "March 15 — Transfer application, in about 125 days");
  // The window names follow the interface language.
  setLanguage("rus", { emit: false });
  assert.equal(deadlineFact(withRows([stanfordProse, stanfordFirstYear]), today).text, "5 января — Обычная подача (Regular Decision), примерно через 56 дн.");
  assert.equal(deadlineFact(withRows([stanfordTransfer]), today).text, "15 марта — Подача на перевод, примерно через 125 дн.");
  setLanguage("eng", { emit: false });
});

test("the application deadline is the headline and a nearer test or booking date is shown beneath it", () => {
  const list = [
    { date: "2026-12-21", deadline_type: "test_date", label: "TMUA", publication_status: "published" },
    { date: "2027-01-13", deadline_type: "application", publication_status: "published" },
    { date: "2027-02-05", deadline_type: "aid_application", publication_status: "published" }];
  const fact = deadlineFact(withDates(list), new Date(2026, 10, 10, 12, 0));
  assert.equal(fact.days, 64);
  assert.match(fact.text, /^Application deadline: January 13, 2027, in 64 days$/);
  assert.equal(fact.notes.length, 1);
  assert.match(fact.notes[0], /^Before that, first: .*TMUA.*December 21, 2026, in 41 days$/);
  // Once the application deadline is behind, the nearest remaining date leads and nothing precedes it.
  const late = deadlineFact(withDates(list), new Date(2027, 0, 20, 12, 0));
  assert.match(late.text, /February 5, 2027/);
  assert.deepEqual(late.notes, []);
  // Without a nearer test date there is no second line.
  assert.deepEqual(deadlineFact(withDates(list.slice(1)), new Date(2026, 10, 10, 12, 0)).notes, []);
});

test("a test date is not the headline when the profile holds another test of the same requirement", () => {
  const support = { application_category: "financial_support", cycle: "2027/28", deadline_type: "test_date", publication_status: "published" };
  const list = [{ ...support, date: "2026-11-28", exam_id: "ACT", label: "Last ACT test date" }, { ...support, date: "2026-12-05", exam_id: "SAT", label: "Last SAT test date" }];
  const today = new Date(2026, 10, 10, 12, 0);
  const sat = deadlineFact(withDates(list), today, { profileExamIds: ["SAT", "IELTS"] });
  assert.equal(sat.days, 25);
  assert.match(sat.text, /December 5, 2026/);
  assert.doesNotMatch(sat.text, /November 28/);
  // With the other alternative entered the matching date still leads, and without a relevant test both dates remain candidates.
  assert.match(deadlineFact(withDates(list), today, { profileExamIds: ["ACT"] }).text, /November 28, 2026/);
  assert.match(deadlineFact(withDates(list), today, { profileExamIds: ["IELTS"] }).text, /November 28, 2026/);
  assert.match(deadlineFact(withDates(list), today).text, /November 28, 2026/);
  // The profile carries through the rendered block.
  assert.match(renderAdmissionsKeyFacts(withDates(list), { now: today, profileExamIds: ["SAT"] }), /December 5, 2026/);
});

test("tuition-only prices never look like a full budget", () => {
  const within = costFact(context({ selected_costs: { annual_total: null, tuition: quote({ exclusions: ["living"] }) } }), 20000);
  assert.equal(within.status, "tuition_within");
  assert.equal(within.tone, "");
  assert.equal(within.flag.tone, "warning");
  assert.match(within.text, /Tuition: \$15,000\. Living costs are not included/);
  assert.match(within.flag.text, /living costs are extra/);
  const over = costFact(context({ selected_costs: { annual_total: quote({ min: 92760, max: 92760, usd: { min: 92760, max: 92760 } }), tuition: quote() } }), 10000);
  assert.equal(over.status, "over");
  assert.match(over.text, /Yearly budget: \$92,760/);
  // A published budget names the tuition it includes.
  assert.match(over.referenceNote, /Of this, tuition is \$15,000; the rest is housing, meals and other costs\./);
  assert.equal(over.flag.tone, "danger");
  assert.match(over.flag.text, /Above your budget of \$10,000/);
});

test("fee-status ranges, missing budgets, non-annual prices and missing prices stay explicit", () => {
  const range = costFact(context({ selected_costs: { tuition: quote({ min: 10050, max: 47800, currency: "GBP", fee_statuses: ["Home fee", "Overseas fee"],
    fee_status_match: "unknown", usd: { min: 13429, max: 63872 } }) } }), 0);
  assert.equal(range.status, "no_budget");
  // The range follows the reader's currency setting (USD by default), disclosing the original pounds in notes; "both" mode keeps them inline without repeating the note.
  assert.match(range.text, /Tuition: ≈ \$[\d,]+ – \$[\d,]+\./);
  assert.equal(range.originalPriceNote, "In original currency: £10,050 – £47,800");
  assert.ok(range.notes.includes("In original currency: £10,050 – £47,800"));
  withCurrencySettings("KZT", "both", () => {
    const both = costFact(context({ selected_costs: { tuition: quote({ min: 10050, max: 47800, currency: "GBP", usd: { min: 13429, max: 63872 } }) } }), 0);
    // Millions of tenge are written compactly; the published pounds stay exact.
    assert.match(both.text, /≈ ₸\d+(?:\.\d)?M – ₸\d+M \(£10,050 – £47,800\)/);
    assert.equal(both.originalPriceNote, "");
  });
  assert.match(range.notes.join(" "), /Depends on fee status/);
  assert.match(range.notes.join(" "), /Add a yearly budget/);
  // A converted calculated total carries a single "≈", in the total and in the living part.
  const estimate = costFact(context({ selected_costs: { tuition: quote({ min: 10050, max: 47800, currency: "GBP", usd: { min: 13429, max: 63872 } }),
    annual_total: quote({ min: 26050, max: 64300, currency: "GBP", calculation: "tuition_plus_living_range", living_min: 16000, living_max: 16500,
      usd: { min: 34800, max: 85900 } }) } }), 0);
  assert.doesNotMatch(`${estimate.text} ${estimate.notes.join(" ")}`, /≈\s*≈/);
  assert.match(estimate.text, /≈ \$/);
  const program = costFact(context({ selected_costs: { tuition: quote({ billing_period: "whole_program", annual_comparable: false, usd: null }) } }), 20000);
  assert.equal(program.status, "not_annual");
  assert.equal(costFact(context({ selected_costs: { annual_total: null, tuition: null } }), 20000).status, "unknown");
});

test("requirements summarise measurable checks and fall back to the published reason", () => {
  const measured = requirementsFact(context({ assessment: { chancePercent: 50, reason: "requirements_not_met", activeChoice: { details: { checks: [
    { measurable: true, status: "met" }, { measurable: true, status: "unmet" }, { status: "unassessed" }] } } } }));
  assert.match(measured.text, /1 of 2 measurable minimums met \(50%\)/);
  assert.equal(measured.tone, "warning");
  assert.deepEqual(measured.notes, []);
  const unavailable = requirementsFact(context({ assessment: { chancePercent: null, reason: "missing_evidence", activeChoice: { details: { checks: [] } } } }));
  assert.equal(unavailable.text, "Add your results to your profile to compare them with the minimums.");
});

test("missing requirement evidence names what to add and which overall scores already meet a minimum, never as a pass or fail", () => {
  const academic = { kind: "academic_requirement", status: "missing", measurable: true,
    rule: { alternatives: [{ exam_id: "UNT", minimum: 85 }, { exam_id: "SAT", minimum: 1240 }] },
    provided: { exam: "UNT", minimum_checks: [{ exam: "UNT", status: "met" }, { exam: "UNT_READING_LITERACY", status: "missing" }] },
    missingInputs: [{ exam: "UNT", needs: ["components"] }, { exam: "SAT", needs: ["taken_on"] }] };
  const english = { kind: "language_requirement", status: "missing", measurable: true, rule: { alternatives: [{ exam_id: "IELTS" }] },
    provided: { exam: "IELTS", minimum_checks: [{ exam: "IELTS", status: "met" }, { exam: "IELTS_WRITING", status: "met" }] },
    missingInputs: [{ exam: "IELTS", needs: ["taken_on", "components"] }] };
  const tmua = { kind: "exam_alternatives", status: "missing", missingInputs: [{ exam: "TMUA", needs: ["result"] }] };
  const presence = { kind: "required_exam_presence", status: "missing", examIds: ["SAT", "ACT"] };
  const fact = requirementsFact(context({ assessment: { chancePercent: null, reason: "missing_evidence",
    activeChoice: { details: { checks: [academic, english, tmua, presence, { status: "unassessed" }] } } } }));
  assert.equal(fact.text, "Add your results to your profile to compare them with the minimums.");
  assert.equal(fact.tone, "");
  // The checklist names each published minimum and what to add, so no generic note repeats them.
  assert.deepEqual(fact.notes, []);
  const resolved = context({ assessment: { chancePercent: null, reason: "missing_evidence",
    activeChoice: { details: { checks: [academic, english, tmua, presence, { status: "unassessed" }] } } } });
  assert.deepEqual(minimumChecklist(resolved).map(({ kind, mark, text, note }) => ({ kind, mark, text, note })), [
    { kind: "academic", mark: "partial", text: "Academic result, one of: UNT (Kazakhstan) 85, SAT 1240", note: "Add: UNT (Kazakhstan) section scores, SAT test date" },
    { kind: "language", mark: "partial", text: "English: IELTS Academic", note: "Add: IELTS Academic test date and section scores" },
    // A required test known only from what to add is still named.
    { kind: "exam", mark: "todo", text: "Required test: TMUA", note: "Add: TMUA result" },
    { kind: "exam", mark: "todo", text: "Required test, one of: SAT, ACT", note: "" },
  ]);
  // A language check links directly to that test in the profile; other missing checks link to the profile editor.
  assert.deepEqual(minimumChecklist(resolved).map(item => item.href || ""), ["/profile.html", "/profile.html?language_exam=IELTS", "/profile.html", ""]);
  assert.match(renderAdmissionsKeyFacts(resolved, { now: NOW }), /<a class="admissions-key-facts__checklist-note" href="\/profile.html\?language_exam=IELTS" data-route="profile">Add: IELTS Academic test date and section scores<\/a>/);
  // Met and unmet checks state the applicant's own result; IELTS bands keep one decimal and scores no digit grouping.
  const ielts = { kind: "language_requirement", status: "unmet", rule: { alternatives: [{ exam_id: "IELTS", minimum: 6 }] }, provided: { exam: "IELTS", score: 5.5 } };
  const sat = { kind: "academic_requirement", status: "met", rule: { alternatives: [{ profile_field: "gpa", minimum: 4, scale: 5 }, { exam_id: "SAT", minimum: 1240 }] }, provided: { exam: "SAT", score: 1300 } };
  assert.deepEqual(minimumChecklist(context({ assessment: { activeChoice: { details: { checks: [ielts, sat] } } } })).map(({ mark, text, note }) => ({ mark, text, note })), [
    { mark: "below", text: "English: IELTS Academic 6.0", note: "You have: IELTS Academic 5.5, below the minimum" },
    { mark: "met", text: "Academic result, one of: GPA 4 of 5, SAT 1240", note: "You have: SAT 1300" },
  ]);
  // A met GPA alternative names the profile GPA and its scale.
  const gpa = { kind: "academic_requirement", status: "met", rule: { alternatives: [{ profile_field: "gpa", minimum: 4, scale: 5 }] }, provided: { gpa: 4.6, gpa_scale: 5 } };
  assert.equal(minimumChecklist(context({ assessment: { activeChoice: { details: { checks: [gpa] } } } }))[0].note, "You have: GPA 4.6 of 5");
  // A section below its minimum is named; the overall score that meets the minimum does not hide it.
  const lowWriting = { kind: "language_requirement", status: "unmet", rule: { alternatives: [{ exam_id: "IELTS", minimum: 6, component_minimums: { IELTS_WRITING: 6 } }] },
    provided: { exam: "IELTS", score: 6, minimum_checks: [{ exam: "IELTS", minimum: 6, provided: 6, status: "met" },
      { exam: "IELTS_WRITING", minimum: 6, provided: 5.5, status: "unmet" }, { exam: "IELTS_READING", minimum: 5.5, provided: 6, status: "met" }] } };
  assert.deepEqual(minimumChecklist(context({ assessment: { activeChoice: { details: { checks: [lowWriting] } } } })).map(({ mark, note }) => ({ mark, note })),
    [{ mark: "below", note: "You have: IELTS Academic 6.0. Below the minimum: Writing 5.5 (at least 6.0 needed)" }]);
  // Total UNT without section scores is checked in part and says what to add, never "met".
  const untTotal = { kind: "academic_requirement", status: "missing", rule: { alternatives: [{ exam_id: "UNT", minimum: 85, component_minimums: { UNT_MATHEMATICAL_LITERACY: 8, UNT_READING_LITERACY: 8 } }] },
    missingInputs: [{ exam: "UNT", needs: ["components"] }],
    provided: { exam: "UNT", score: 110, minimum_checks: [{ exam: "UNT", minimum: 85, provided: 110, status: "met" }] } };
  const untNote = minimumChecklist(context({ assessment: { activeChoice: { details: { checks: [untTotal] } } } }))[0];
  assert.equal(untNote.mark, "partial");
  assert.match(untNote.note, /^Partly checked\. You have: UNT \(Kazakhstan\) 110; the overall score meets the minimum\. To finish the check, add: /);
  // A result the check could not count is named without being presented as met.
  const uncounted = { ...sat, status: "missing", missingInputs: [] };
  assert.equal(minimumChecklist(context({ assessment: { activeChoice: { details: { checks: [uncounted] } } } }))[0].note,
    "You have: SAT 1300; whether it counts depends on the conditions below");
  // An entered result stays visible beside what is still missing, and an overall score that meets the minimum says so.
  const partial = { kind: "language_requirement", status: "missing", rule: { alternatives: [{ exam_id: "IELTS", minimum: 6 }] },
    missingInputs: [{ exam: "IELTS", needs: ["components", "taken_on"] }],
    provided: { exam: "IELTS", score: 6.5, minimum_checks: [{ exam: "IELTS", minimum: 6, provided: 6.5, status: "met" }] } };
  const partialResolved = context({ assessment: { chancePercent: null, reason: "missing_evidence", activeChoice: { details: { checks: [partial] } } } });
  assert.equal(minimumChecklist(partialResolved)[0].note,
    "Partly checked. You have: IELTS Academic 6.5; the overall score meets the minimum. To finish the check, add: IELTS Academic test date and section scores");
  // With a checklist, the requirements row introduces it instead of asking to add results that are already there.
  assert.doesNotMatch(renderAdmissionsKeyFacts(partialResolved, { now: NOW }), /Add your results to your profile/);
  // A check without nameable inputs adds no instruction, and a resolved assessment adds none either.
  const unnamed = requirementsFact(context({ assessment: { chancePercent: null, reason: "missing_evidence",
    activeChoice: { details: { checks: [{ kind: "scoped_gpa", status: "missing" }] } } } }));
  assert.deepEqual(unnamed.notes, []);
  assert.deepEqual(requirementsFact(context({ assessment: { chancePercent: 100, reason: "", activeChoice: { details: { checks: [{ ...academic, status: "met" }] } } } })).notes, []);
  setLanguage("rus", { emit: false });
  assert.equal(minimumChecklist(context({ assessment: { activeChoice: { details: { checks: [academic] } } } }))[0].text, "Академический результат, одно из: ЕНТ 85, SAT 1240");
  setLanguage("eng", { emit: false });
});
test("funding names a separate support application before counting records", () => {
  const support = fundingFact(context({ available_routes: [{ id: "support", title: "Financial support selection", classification: "financial_support_application" }],
    fact_groups: { funding: ["a"] } }));
  assert.match(support.text, /Applied for separately: Financial support selection/);
  assert.match(fundingFact(context({ fact_groups: { funding: ["a", "b"] } })).text, /Funding records are in the official sources on the Costs and funding tab/);
  assert.match(fundingFact(context()).text, /No funding is catalogued/);
});

test("the block appears only for a selected route and links to the dates and cost tabs", () => {
  assert.equal(renderAdmissionsKeyFacts(context({ selected_route: null })), "");
  const html = renderAdmissionsKeyFacts(withDates([]), { budgetUsd: 10000, now: NOW });
  for (const key of ["requirements", "deadline", "cost", "funding"]) assert.match(html, new RegExp(`data-key-fact="${key}"`));
  assert.match(html, /data-open-tab="tab-deadlines"/);
  assert.match(html, /data-open-tab="tab-finance"/);
  setLanguage("rus", { emit: false });
  assert.match(renderAdmissionsKeyFacts(withDates([]), { now: NOW }), /Главное для поступления/);
  setLanguage("eng", { emit: false });
});

test("a cycle-scoped requirement opens the entry-year field of this university's selection", () => {
  const blocked = context({ assessment: { chancePercent: null, reason: "entry_cycle_required", activeChoice: { details: { checks: [] } } } });
  assert.match(requirementsFact(blocked).text, /Choose your entry year/);
  // The general profile holds no entry cycle, so the action never offers to copy one.
  const html = renderAdmissionsKeyFacts(blocked, { now: NOW });
  assert.match(html, /data-key-facts-cycle="edit"[^>]*>Set entry year</);
  assert.doesNotMatch(html, /data-key-facts-cycle="apply"/);
  assert.doesNotMatch(renderAdmissionsKeyFacts(context(), { now: NOW }), /data-key-facts-cycle/);
});

const reviewedFact = (id, topic, value, extra = {}) => ({ id, topic, value, source_ids: ["fees"], normalized_status: { publication: "published", review: "verified" },
  applicability: { route: "matched", status: "conditional" }, scope: {}, ...extra });

test("a price that depends on fee status explains Home and Overseas and links the catalog's official fee-status source", () => {
  const prices = { selected_costs: { tuition: quote({ min: 10050, max: 47800, currency: "GBP", fee_statuses: ["Home fee", "Overseas fee"],
    fee_status_match: "unknown", usd: { min: 13429, max: 63872 } }) } };
  const page = "https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/fee-status/";
  const withSource = facts => context({ ...prices, sources: [{ id: "fees", url: page }], facts });
  const linked = costFact(withSource([reviewedFact("imperial-fee-status", "fee_status", "Imperial assesses Home/Overseas status after application.")]), 0);
  assert.match(linked.notes.join(" "), /Home fees generally apply to UK residents and some other categories/);
  assert.match(linked.notes.join(" "), /the university decides the classification/);
  assert.deepEqual(linked.links, [{ url: page, label: "Official fee-status page" }]);
  const html = renderAdmissionsKeyFacts(withSource([reviewedFact("imperial-fee-status", "fee_status", "text")]), { now: NOW });
  assert.match(html, /<a class="admissions-key-facts__source" href="https:\/\/www\.imperial\.ac\.uk\/study\/fees-and-funding\/tuition-fees\/fee-status\/" target="_blank" rel="noopener noreferrer">/);
  // No fee-status source in the data means no link, and an unreviewed fact is not a source.
  assert.deepEqual(costFact(context(prices), 0).links, []);
  const unreviewed = reviewedFact("imperial-fee-status", "fee_status", "text", { normalized_status: { publication: "published", review: "needs_resolution" } });
  assert.deepEqual(costFact(withSource([unreviewed]), 0).links, []);
  // A price that does not depend on fee status shows neither the explanation nor a link.
  const flat = costFact(context({ sources: [{ id: "fees", url: page }], facts: [reviewedFact("f", "fee_status", "text")], selected_costs: { tuition: quote() } }), 0);
  assert.deepEqual(flat.links, []);
  assert.doesNotMatch(flat.notes.join(" "), /Home fees/);
});

test("funding shows one published need policy for the selected route as policy, never as an award", () => {
  const aid = (extra = {}) => reviewedFact("aid", "funding", { international_need: "MIT meets full demonstrated need using same consideration process", css_code: "3514" }, extra);
  const withAid = row => context({ facts: [row], fact_groups: { funding: ["aid", "other"] } });
  const policy = fundingFact(withAid(aid()));
  assert.equal(policy.text, "MIT meets full demonstrated need using same consideration process");
  assert.equal(policy.notes, undefined);
  setLanguage("rus", { emit: false });
  assert.equal(fundingFact(withAid(aid())).text, "MIT meets full demonstrated need using same consideration process");
  setLanguage("eng", { emit: false });
  // Facts for another route, an unreviewed fact, and facts without the policy field never produce a policy.
  assert.match(fundingFact(withAid(aid({ applicability: { route: "mismatched", status: "mismatched" } }))).text, /Funding records are in the official sources on the Costs and funding tab/);
  assert.match(fundingFact(withAid(aid({ applicability: { route: "unknown", status: "conditional" } }))).text, /Funding records are in the official sources on the Costs and funding tab/);
  assert.match(fundingFact(withAid(aid({ normalized_status: { publication: "published", review: "needs_resolution" } }))).text, /Funding records are in the official sources on the Costs and funding tab/);
  assert.match(fundingFact(withAid(reviewedFact("aid", "funding", { summary: "Aid exists" }))).text, /Funding records are in the official sources on the Costs and funding tab/);
});

test("funding and deadline rows name the terms the applicant sees without relying on translated text", () => {
  const css = reviewedFact("process", "funding", { required: ["CSS Profile", "Parental tax/income documentation through IDOC"] });
  const funding = fundingFact(context({ facts: [css], fact_groups: { funding: ["process"] } }));
  assert.deepEqual(funding.terms, ["css_profile"]);
  const rounds = { ...events([]), id: "rounds", attributes: {}, value: { windows: [{ name: "Early Action", application_due: "November 1" }, { name: "Regular Action", application_due: "January 4" }] } };
  assert.deepEqual(deadlineFact(withRows([rounds]), NOW).terms, ["early_action", "regular_action"]);
  const early = { ...events([]), id: "dated-rounds", attributes: {}, value: { windows: [{ name: "Early Action", application_due: "2026-12-01" }] } };
  const dated = deadlineFact(withRows([early]), NOW);
  assert.equal(dated.status, "upcoming");
  assert.ok(dated.terms.includes("early_action"));
  assert.match(renderAdmissionsKeyFacts(withRows([rounds]), { now: NOW }), /data-term="early_action"/);
  setLanguage("rus", { emit: false });
  assert.match(renderAdmissionsKeyFacts(withRows([rounds]), { now: NOW }), /data-term="early_action"/);
  setLanguage("eng", { emit: false });
});

test("the Dates and Costs tabs open with the same plain answers as the key facts, without record detail", () => {
  const resolved = { ...withRows([events([{ date: "2026-12-01", deadline_type: "application", publication_status: "published" }])]),
    selected_costs: { tuition: quote() }, available_routes: [{ id: "aid", title: "Funding selection", classification: "financial_support_application" }] };
  const dates = renderTabAnswers(resolved, "deadlines", { now: NOW });
  assert.match(dates, /data-tab-answers="deadlines"/);
  assert.match(dates, /data-key-fact="deadline"/);
  assert.doesNotMatch(dates, /data-key-fact="(?:cost|funding|requirements)"/);
  const costs = renderTabAnswers(resolved, "finance", { now: NOW });
  assert.match(costs, /data-key-fact="cost"[\s\S]*data-key-fact="funding"/);
  // A separate funding application is opened from the answer, as in the key facts.
  assert.match(costs, /data-key-facts-route="aid"/);
  assert.equal(renderTabAnswers({ ...resolved, selected_route: null }, "finance"), "");
  // On the Costs tab the funding answer points below instead of at the tab the reader is on.
  const records = { ...resolved, available_routes: [], fact_groups: { ...resolved.fact_groups, funding: ["grant"] } };
  assert.match(renderTabAnswers(records, "finance"), /official sources under “Sources” below/);
  assert.doesNotMatch(renderTabAnswers(records, "finance"), /Costs and funding/);
});

// MIT's published English-test recommendation, as the catalog stores it.
const englishRecommendation = (extra = {}) => ({ id: "ug-english-recommendation", topic: "language_tests", source_ids: ["official"],
  publication_status: "published", review_status: "verified", normalized_status: { publication: "published", review: "verified" },
  applicability: { status: "matched" }, scope: { option_ids: [], route_ids: ["first-year"], levels: ["undergraduate"] },
  value: { presence: "strongly_recommended", minima_and_recommendations: [
    { exam: "TOEFL iBT", scale: "0-120", minimum: 90, recommended: 100 }, { exam: "IELTS Academic", minimum: 7, recommended: 7.5 },
    { exam: "Duolingo English Test", minimum: 120, recommended: 125 }] },
  conditions: [{ when: "Non-native English speaker AND (using English for fewer than five years OR not speaking English at home or school)" }], ...extra });
const withRecommendation = row => context({ facts: [row], fact_groups: { requirements: [row.id] } });

test("an English-test recommendation for non-native speakers shows a neutral recommendation until scored, then marks met or below without a profile hint", () => {
  const resolved = withRecommendation(englishRecommendation());
  const ieltsBelow = { code: "en", kind: "exam", exam: "IELTS", score: 6.5 };
  const ieltsMet = { code: "en", kind: "exam", exam: "IELTS", score: 7.5 };
  assert.equal(englishStatus({ languages: [{ code: "en", kind: "native" }] }), "native");
  assert.equal(englishStatus({ languages: [{ code: "ru", kind: "native" }, ieltsBelow] }), "not_native");
  assert.equal(englishStatus({ languages: [ieltsBelow] }), "unknown");
  // English stated as native: no row at all.
  assert.equal(englishRecommendationItem(resolved, { languages: [{ code: "en", kind: "native" }, ieltsBelow] }), null);

  // Without an English test and unknown native language: neutral recommendation + language-profile hint.
  const noScoreUnknown = englishRecommendationItem(resolved, {});
  assert.deepEqual({ ...noScoreUnknown }, {
    kind: "language_recommendation",
    factId: "ug-english-recommendation",
    mark: "recommended",
    text: "English test (optional): IELTS Academic — minimum 7.0, recommended 7.5",
    note: "Strongly recommended if English is not your first language and you have used it for less than five years or do not speak it at home or at school.",
    condition: "if English is not your first language",
    hint: { text: "Add language details in profile", href: "/profile.html?language=en" },
  });

  // Without an English test and non-native language stated: neutral recommendation + add-test hint.
  const noScoreNotNative = englishRecommendationItem(resolved, { languages: [{ code: "ru", kind: "native" }] });
  assert.deepEqual({ ...noScoreNotNative }, {
    kind: "language_recommendation",
    factId: "ug-english-recommendation",
    mark: "recommended",
    text: "English test (optional): IELTS Academic — minimum 7.0, recommended 7.5",
    note: "Strongly recommended if you have used English for less than five years or do not speak it at home or at school.",
    hint: { text: "Add an English test", href: "/profile.html?language_exam=IELTS" },
  });

  // Entered IELTS >= 7.0 (with or without native language): green met mark, no profile hint.
  const metItem = englishRecommendationItem(resolved, { languages: [ieltsMet] });
  assert.equal(metItem.mark, "met");
  assert.equal(metItem.have, "You have: IELTS Academic 7.5");
  assert.equal(metItem.hint, undefined);
  assert.equal(englishRecommendationItem(resolved, { languages: [{ code: "ru", kind: "native" }, ieltsMet] }).mark, "met");

  // Entered IELTS < 7.0: below warning mark, no profile hint.
  const belowItem = englishRecommendationItem(resolved, { languages: [{ code: "ru", kind: "native" }, ieltsBelow] });
  assert.equal(belowItem.mark, "below");
  assert.equal(belowItem.have, "You have: IELTS Academic 6.5, below the minimum");
  assert.equal(belowItem.hint, undefined);

  // Entered DET < 120: applicant's own test leads with below mark.
  const detBelow = englishRecommendationItem(resolved, { languages: [{ code: "en", kind: "exam", exam: "DET", score: 115 }] });
  assert.equal(detBelow.mark, "below");
  assert.match(detBelow.text, /Duolingo.*minimum 120, recommended 125/);
  assert.equal(detBelow.have, "You have: Duolingo English Test (DET) 115, below the minimum");

  // Not a recommendation of this kind, or not reviewed: nothing.
  assert.equal(englishRecommendationItem(withRecommendation(englishRecommendation({ conditions: [] })), {}), null);
  assert.equal(englishRecommendationItem(withRecommendation(englishRecommendation({ value: { presence: "required", minima_and_recommendations: [] } })), {}), null);
  assert.equal(englishRecommendationItem(withRecommendation(englishRecommendation({ review_status: "unverified", normalized_status: { publication: "published", review: "unverified" } })), {}), null);

  const htmlUnknown = renderAdmissionsKeyFacts(resolved, { now: NOW, profile: {} });
  assert.match(htmlUnknown, /<li data-mark="recommended" data-recommendation>/);
  assert.match(htmlUnknown, /Recommendation, not a requirement/);
  assert.match(htmlUnknown, /href="\/profile\.html\?language=en" data-route="profile"/);

  const htmlMet = renderAdmissionsKeyFacts(resolved, { now: NOW, profile: { languages: [ieltsMet] } });
  assert.match(htmlMet, /<li data-mark="met" data-recommendation>/);
  assert.match(htmlMet, /You have: IELTS Academic 7\.5/);
  assert.doesNotMatch(htmlMet, /href="\/profile\.html\?language=en"/);

  const htmlBelow = renderAdmissionsKeyFacts(resolved, { now: NOW, profile: { languages: [ieltsBelow] } });
  assert.match(htmlBelow, /<li data-mark="below" data-recommendation>/);
  assert.match(htmlBelow, /You have: IELTS Academic 6\.5, below the minimum/);

  assert.doesNotMatch(renderAdmissionsKeyFacts(resolved, { now: NOW, profile: { languages: [{ code: "en", kind: "native" }] } }), /data-recommendation/);

  setLanguage("rus", { emit: false });
  assert.equal(englishRecommendationItem(resolved, { languages: [ieltsMet] }).text, "Тест по английскому (необязательно): IELTS Academic — минимум 7,0, рекомендуется 7,5");
  setLanguage("eng", { emit: false });

  // coveredRequirementFactIds collects both minimumChecklist and englishRecommendationItem fact ids,
  // and required_exam_presence with cutoff: null surfaces the no-passing-score detail in the checklist.
  const presenceFact = { id: "ug-sat-act", value: { presence: "required", alternatives: ["SAT", "ACT"], cutoff: null } };
  const both = context({
    facts: [presenceFact, englishRecommendation()],
    fact_groups: { requirements: ["ug-sat-act", "ug-english-recommendation"] },
    assessment: { activeChoice: { details: { checks: [{ kind: "required_exam_presence", factId: "ug-sat-act", status: "missing", examIds: ["SAT", "ACT"] }] } } },
  });
  const checklistWithCutoff = minimumChecklist(both);
  assert.equal(checklistWithCutoff[0].detail, "There is no passing score: you need a result, and the decision looks at your whole application.");
  assert.match(renderAdmissionsKeyFacts(both, { now: NOW }), /no passing score/);
  assert.deepEqual([...coveredRequirementFactIds(both, {})], ["ug-sat-act", "ug-english-recommendation"]);
  assert.deepEqual([...coveredRequirementFactIds(both, { languages: [{ code: "en", kind: "native" }] })], ["ug-sat-act"]);
});

test("a Kazakhstan document without a published ruling is answered at the top, a published one is not", async () => {
  const { kazakhstanCredentialFact } = await import("../../frontend/javascript/pages/university/admissions-key-facts.js");
  const note = { id: "kz", topic: "qualification_recognition", value: "Kazakhstan school-leaving qualifications are not listed.", source_ids: ["official"],
    normalized_status: { publication: "unknown", review: "verified" }, scope: { applicant_categories: [] } };
  const unlisted = kazakhstanCredentialFact(context({ facts: [note] }));
  assert.match(unlisted.text, /no decision on school or degree documents from Kazakhstan/);
  assert.deepEqual(unlisted.links, [{ url: "https://example.edu/apply", label: "Official guidance" }]);
  assert.match(renderAdmissionsKeyFacts(context({ facts: [note] }), { now: NOW }), /data-key-fact="credential"/);
  assert.equal(kazakhstanCredentialFact(context({ facts: [{ ...note, normalized_status: { publication: "published", review: "verified" } }] })), null);
  assert.equal(kazakhstanCredentialFact(context({ facts: [{ ...note, value: "Albania qualifications" }] })), null);
  assert.equal(kazakhstanCredentialFact(context({ facts: [{ ...note, applicability: { status: "mismatched" } }] })), null);
});
