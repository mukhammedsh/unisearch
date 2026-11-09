import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { costFact, deadlineFact, fundingFact, renderAdmissionsKeyFacts, requirementsFact } = await import("../../frontend/javascript/pages/university/admissions-key-facts.js");
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
  assert.match(yearless.text, /without a year: Early Action[^:]*: November 1; Regular Action[^:]*: January 4/);
  assert.equal(yearless.days, undefined);
  const period = { ...events([]), id: "window", attributes: {}, normalized_status: { publication: "partially_published", review: "verified" },
    value: { application_period: "October 2026–August 2027", submission: "rolling basis" } };
  assert.match(deadlineFact(withRows([period]), NOW).text, /Application period: October 2026–August 2027/);
});

const recurringRounds = (label = "Recurring first-year dates; page does not specify entry year", kind = "yearless_policy") => ({
  ...events([]), id: "rounds", attributes: {}, period: { kind, label },
  value: { windows: [{ name: "Early Action", application_due: "November 1" }, { name: "Regular Action", application_due: "January 4" }] } });

test("yearless dates the record describes as recurring get their next calendar occurrence with a countdown and an annual-date warning", () => {
  const today = new Date(2026, 10, 10, 12, 0);
  const fact = deadlineFact(withRows([recurringRounds()]), today);
  assert.equal(fact.status, "recurring");
  assert.equal(fact.days, 55);
  assert.match(fact.text, /^Early Action[^:]*: November 1 has passed\. Next: Regular Action[^—]*— January 4, 2027, in 55 days \(annual date; confirm the year on the official page\)$/);
  assert.deepEqual(fact.terms, ["early_action", "regular_action"]);
  // Before the first round nothing has passed; after the last one the next occurrence is the following year's first round.
  const beforeEarly = deadlineFact(withRows([recurringRounds()]), new Date(2026, 9, 1, 12, 0));
  assert.match(beforeEarly.text, /^Next: Early Action[^—]*— November 1, 2026, in 31 days/);
  const afterRegular = deadlineFact(withRows([recurringRounds()]), new Date(2027, 0, 10, 12, 0));
  assert.match(afterRegular.text, /^Next: Early Action[^—]*— November 1, 2027, in 295 days/);
  assert.match(deadlineFact(withRows([recurringRounds()]), new Date(2027, 0, 4, 12, 0)).text, /^Next: Regular Action[^—]*— January 4, 2027, today /);
  setLanguage("rus", { emit: false });
  assert.match(deadlineFact(withRows([recurringRounds()]), today).text, /ежегодная дата; год уточните на официальной странице/);
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

test("the application deadline is the headline and a nearer test or booking date is shown beneath it", () => {
  const list = [
    { date: "2026-12-21", deadline_type: "test_date", label: "TMUA", publication_status: "published" },
    { date: "2027-01-13", deadline_type: "application", publication_status: "published" },
    { date: "2027-02-05", deadline_type: "aid_application", publication_status: "published" }];
  const fact = deadlineFact(withDates(list), new Date(2026, 10, 10, 12, 0));
  assert.equal(fact.days, 64);
  assert.match(fact.text, /^Application deadline: January 13, 2027, in 64 days$/);
  assert.equal(fact.notes.length, 1);
  assert.match(fact.notes[0], /^Earlier: .*TMUA.*December 21, 2026, in 41 days$/);
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
  assert.match(over.text, /Published budget: \$92,760/);
  assert.equal(over.flag.tone, "danger");
  assert.match(over.flag.text, /Above your budget of \$10,000/);
});

test("fee-status ranges, missing budgets, non-annual prices and missing prices stay explicit", () => {
  const range = costFact(context({ selected_costs: { tuition: quote({ min: 10050, max: 47800, currency: "GBP", fee_statuses: ["Home fee", "Overseas fee"],
    fee_status_match: "unknown", usd: { min: 13429, max: 63872 } }) } }), 0);
  assert.equal(range.status, "no_budget");
  assert.match(range.text, /£10,050–£47,800 \(≈ \$13,429–\$63,872\)/);
  assert.match(range.notes.join(" "), /Depends on fee status/);
  assert.match(range.notes.join(" "), /Add a yearly budget/);
  const program = costFact(context({ selected_costs: { tuition: quote({ billing_period: "whole_program", annual_comparable: false, usd: null }) } }), 20000);
  assert.equal(program.status, "not_annual");
  assert.equal(costFact(context({ selected_costs: { annual_total: null, tuition: null } }), 20000).status, "unknown");
});

test("requirements summarise measurable checks and fall back to the published reason", () => {
  const measured = requirementsFact(context({ assessment: { chancePercent: 50, reason: "requirements_not_met", activeChoice: { details: { checks: [
    { measurable: true, status: "met" }, { measurable: true, status: "unmet" }, { status: "unassessed" }] } } } }));
  assert.match(measured.text, /1 of 2 measurable minimums met \(50%\)/);
  assert.equal(measured.tone, "warning");
  assert.deepEqual(measured.notes, ["Conditions to check against the official rules: 1"]);
  const unavailable = requirementsFact(context({ assessment: { chancePercent: null, reason: "missing_evidence", activeChoice: { details: { checks: [] } } } }));
  assert.equal(unavailable.text, "Required applicant evidence is missing.");
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
  assert.equal(fact.text, "Required applicant evidence is missing.");
  assert.equal(fact.tone, "");
  assert.deepEqual(fact.notes, [
    "Academic requirement: add any one of: UNT (Kazakhstan) section scores; SAT test date",
    "English requirement: add IELTS Academic test date and section scores",
    "Required test: add TMUA result",
    "Required test: add any one of: SAT result; ACT result",
    // Only the overall score is named; the met IELTS Writing section is not a met requirement.
    "Overall score already meets the published minimum: UNT (Kazakhstan), IELTS Academic",
    "Conditions to check against the official rules: 1",
  ]);
  // A check without nameable inputs adds no instruction, and a resolved assessment adds none either.
  const unnamed = requirementsFact(context({ assessment: { chancePercent: null, reason: "missing_evidence",
    activeChoice: { details: { checks: [{ kind: "scoped_gpa", status: "missing" }] } } } }));
  assert.deepEqual(unnamed.notes, []);
  assert.deepEqual(requirementsFact(context({ assessment: { chancePercent: 100, reason: "", activeChoice: { details: { checks: [{ ...academic, status: "met" }] } } } })).notes, []);
  setLanguage("rus", { emit: false });
  assert.match(requirementsFact(context({ assessment: { chancePercent: null, reason: "missing_evidence", activeChoice: { details: { checks: [academic] } } } })).notes[0],
    /^Академическое требование: добавьте что-то одно из: баллы .* по разделам; дату сдачи SAT$/);
  setLanguage("eng", { emit: false });
});

test("funding names a separate support application before counting records", () => {
  const support = fundingFact(context({ available_routes: [{ id: "support", title: "Financial support selection", classification: "financial_support_application" }],
    fact_groups: { funding: ["a"] } }));
  assert.match(support.text, /Applied for separately: Financial support selection/);
  assert.match(fundingFact(context({ fact_groups: { funding: ["a", "b"] } })).text, /Funding records for this path: 2/);
  assert.match(fundingFact(context()).text, /No funding is catalogued/);
});

test("the block appears only for a selected route and links to the dates and cost tabs", () => {
  assert.equal(renderAdmissionsKeyFacts(context({ selected_route: null })), "");
  const html = renderAdmissionsKeyFacts(withDates([]), { budgetUsd: 10000, now: NOW });
  for (const key of ["requirements", "deadline", "cost", "funding"]) assert.match(html, new RegExp(`data-key-fact="${key}"`));
  assert.match(html, /data-open-tab="tab-deadlines"/);
  assert.match(html, /data-open-tab="tab-finance"/);
  setLanguage("rus", { emit: false });
  assert.match(renderAdmissionsKeyFacts(withDates([]), { now: NOW }), /Главное по этому пути/);
  setLanguage("eng", { emit: false });
});

test("a cycle-scoped requirement offers the profile entry cycle or the entry-year field", () => {
  const blocked = context({ assessment: { chancePercent: null, reason: "entry_cycle_required", activeChoice: { details: { checks: [] } } } });
  assert.match(requirementsFact(blocked).text, /Choose your entry year/);
  const withProfile = renderAdmissionsKeyFacts(blocked, { profileCycle: "Fall 2027", now: NOW });
  assert.match(withProfile, /data-key-facts-cycle="apply"/);
  const withoutProfile = renderAdmissionsKeyFacts(blocked, { now: NOW });
  assert.match(withoutProfile, /data-key-facts-cycle="edit"[^>]*>Set entry year</);
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
  assert.equal(policy.text, "Published policy: MIT meets full demonstrated need using same consideration process");
  assert.match(policy.notes[0], /not an award offered to you\. Funding records for this path: 2/);
  setLanguage("rus", { emit: false });
  assert.match(fundingFact(withAid(aid())).text, /^Опубликованная политика вуза: /);
  setLanguage("eng", { emit: false });
  // Facts for another route, an unreviewed fact, and facts without the policy field never produce a policy.
  assert.match(fundingFact(withAid(aid({ applicability: { route: "mismatched", status: "mismatched" } }))).text, /Funding records for this path: 2/);
  assert.match(fundingFact(withAid(aid({ applicability: { route: "unknown", status: "conditional" } }))).text, /Funding records for this path: 2/);
  assert.match(fundingFact(withAid(aid({ normalized_status: { publication: "published", review: "needs_resolution" } }))).text, /Funding records for this path: 2/);
  assert.match(fundingFact(withAid(reviewedFact("aid", "funding", { summary: "Aid exists" }))).text, /Funding records for this path: 2/);
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
