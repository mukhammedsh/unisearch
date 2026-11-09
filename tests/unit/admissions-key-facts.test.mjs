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
  assert.equal(measured.note, "Conditions to check against the official rules: 1");
  const unavailable = requirementsFact(context({ assessment: { chancePercent: null, reason: "missing_evidence", activeChoice: { details: { checks: [] } } } }));
  assert.equal(unavailable.text, "Required applicant evidence is missing.");
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
