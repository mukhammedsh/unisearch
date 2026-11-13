import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { costFact, deadlineFact } = await import("../../frontend/javascript/pages/university/admissions-key-facts.js");
const {
  checklistItems, costCard, deadlineCard, firstYearSharedRoute, legacyCards, legacyCostCard, legacyNeedsItems, peopleItems, renderSummary, reviewedCards,
} = await import("../../frontend/javascript/pages/university/overview-summary.js");
await initI18n();
setLanguage("eng", { emit: false });

const NOW = new Date(2026, 10, 13, 12, 0);
const route = (id, applicant_route, levels, option_ids) => ({ id, applicant_route, levels, option_ids });

test("the summary reads the first-year route shared by every major and skips routes that cannot describe all majors", () => {
  const mit = [route("first-year", "first_year", ["undergraduate"], ["a", "b"]), route("transfer", "transfer", ["undergraduate"], ["a", "b"])];
  assert.equal(firstYearSharedRoute(mit).id, "first-year");
  // A mid-year intake without programs (Nazarbayev) must not stand for all undergraduate majors.
  assert.equal(firstYearSharedRoute([route("midyear", "first_year", ["undergraduate"], [])]), null);
  assert.equal(firstYearSharedRoute([route("masters", "first_year", ["masters"], ["a"])]), null);
  assert.equal(firstYearSharedRoute([]), null);
  assert.equal(firstYearSharedRoute(undefined), null);
});

const published = { publication: "published", review: "verified" };
const fact = (id, topic, value, extra = {}) => ({ id, topic, value, normalized_status: published, applicability: { status: "conditional" }, ...extra });
const resolvedWith = (facts, checks = [], extra = {}) => ({
  reading_scope: "institution_route", selected_route: { id: "first-year", title: "First-year admission", shared_policy_context_ids: [] },
  context_applicability: {}, facts, fact_groups: { requirements: facts.map(row => row.id), application: facts.map(row => row.id) },
  assessment: { activeChoice: { details: { checks } } }, sources: [], available_routes: [], ...extra,
});
const mitFacts = () => [
  fact("tests", "academic_tests", { presence: "required", alternatives: ["SAT", "ACT"], cutoff: null }),
  fact("english", "language_tests", { presence: "strongly_recommended", minima_and_recommendations: [{ exam: "TOEFL iBT", minimum: 90 }] }),
  fact("documents", "documents", { required: ["MIT application including essays/activities/academics", "Two teacher recommendations", "SAT or ACT", "Portfolio of work"] }),
];

test("the checklist names tests, the English test and documents, and drops a document that repeats the test", () => {
  const items = checklistItems(resolvedWith(mitFacts()));
  assert.deepEqual(items.map(item => item.text), [
    "Test: SAT or ACT",
    "English test: strongly recommended for some applicants",
    "MIT application with essays, activities and academic information",
    "Two teacher recommendations",
    "Portfolio of work",
  ]);
  assert.ok(items.every(item => item.mark === "todo"));
});

test("checklist marks follow the applicant's evidence: met, to add, or below a published minimum", () => {
  const checks = [{ factId: "tests", status: "met" }, { factId: "english", status: "unmet" }, { factId: "documents", status: "unassessed" }];
  const marks = Object.fromEntries(checklistItems(resolvedWith(mitFacts(), checks)).map(item => [item.factId, item.mark]));
  assert.deepEqual(marks, { tests: "met", english: "below", documents: "todo" });
  assert.equal(checklistItems(resolvedWith(mitFacts(), [{ factId: "tests", status: "missing" }]))[0].mark, "todo");
});

test("a university that publishes tests and documents as sentences keeps its own wording, and unpublished or mismatched facts are ignored", () => {
  const prose = [
    fact("tests", "standardized_tests", "ACT or SAT is required for first-year applicants."),
    fact("documents", "application_documents", "Required components include the Common Application and a school report."),
    fact("draft", "academic_tests", { presence: "required", alternatives: ["GRE"] }, { normalized_status: { publication: "not_yet_published", review: "verified" } }),
    fact("other", "academic_tests", { presence: "required", alternatives: ["LSAT"] }, { applicability: { status: "mismatched" } }),
  ];
  const items = checklistItems(resolvedWith(prose));
  assert.deepEqual(items.map(item => [item.kind, item.text, item.prose]), [
    ["tests", "ACT or SAT is required for first-year applicants.", true],
    ["documents", "Required components include the Common Application and a school report.", true],
  ]);
  assert.deepEqual(checklistItems(resolvedWith([])), []);
});

test("without a shared route one card says the answers depend on the program and no answer is invented", () => {
  const cards = reviewedCards({ resolved: null, university: {}, now: NOW });
  assert.deepEqual(cards.map(card => [card.id, card.state, card.link.tab]), [["program", "choose", "tab-programs"]]);
  assert.equal(cards[0].headline, "Depends on the program");
});

const recurring = () => fact("rounds", "application_windows", { windows: [
  { name: "Early Action", application_due: "November 1" }, { name: "Regular Action", application_due: "January 4" }] },
{ period: { kind: "yearless_policy", label: "Recurring first-year dates; page does not state entry year" } });

test("the date card leads with the next date and its countdown, and says that the early round has closed", () => {
  const resolved = resolvedWith([recurring()], [], { fact_groups: { deadlines: ["rounds"] } });
  const card = deadlineCard(deadlineFact(resolved, NOW));
  assert.equal(card.headline, "By January 4, 2027 · in 52 days");
  assert.equal(card.lines[0], "Regular Action · regular application");
  assert.match(card.lines[1], /^Early Action · early application \(November 1\) has already closed\. The year is assumed/);
  // A date with a year and a nearer deadline within 30 days is flagged.
  const soon = deadlineCard(deadlineFact(resolvedWith([recurring()], [], { fact_groups: { deadlines: ["rounds"] } }), new Date(2026, 11, 20, 12, 0)));
  assert.equal(soon.tone, "warning");
  assert.equal(deadlineCard(deadlineFact(resolvedWith([], [], { fact_groups: {} }), NOW)).answerKind, "text");
});

const quote = extra => ({ min: 92760, max: 92760, currency: "USD", period: "2026-2027", billing_period: "academic_year", annual_comparable: true,
  fee_statuses: [], fee_status_match: "not_required", usd: { min: 92760, max: 92760 }, ...extra });

test("the cost card states the price before aid, names tuition-only prices and compares with the budget without calling aid an award", () => {
  const resolved = { selected_costs: { annual_total: quote() } };
  const card = costCard(costFact(resolved, 50000), "MIT meets full demonstrated need");
  assert.match(card.headline, /^\$92,760 a year$/);
  assert.match(card.lines[0], /^Before financial aid\. Source period: 2026.2027$/);
  assert.deepEqual(card.aside.map(line => line.tone), ["danger", undefined]);
  assert.match(card.aside[1].text, /^Published policy: MIT meets full demonstrated need$/);
  const tuition = costCard(costFact({ selected_costs: { tuition: quote({ min: 66720, max: 66720, usd: { min: 66720, max: 66720 } }) } }, undefined));
  assert.match(tuition.headline, /a year, tuition only$/);
  assert.ok(tuition.lines.includes("Housing and living costs are not included."));
  assert.equal(tuition.aside[0].text, "Add a yearly budget to your profile to compare");
  // No published price: the honest sentence replaces the figure.
  assert.equal(costCard(costFact({ selected_costs: {} }, 1)).headline, "No price is published for this selection");
});

const enrollment = { census_year: "2024-2025", undergraduate_count: 4535, undergraduate_international_count: 529, undergraduate_international_percent: 11.66,
  source: "MIT Facts", source_url: "https://facts.mit.edu/" };

test("who studies here lists only published figures with their sources and is empty when nothing is published", () => {
  const university = { enrollment_breakdown: enrollment, housing: { undergraduate_guarantee_years: 4, source_url: "https://example.edu/housing" },
    outcomes: { early_career_salary_usd: 98741 },
    fact_provenance: { facts: { early_career_salary: { source: "MIT Graduating Student Survey 2019", source_url: "https://example.edu/survey.pdf" } } } };
  const items = peopleItems(university);
  assert.deepEqual(items.map(item => item.text), [
    "12% international · 529 of 4,535 undergraduates", "Housing guaranteed for 4 years", "Early-career salary: about $98,741 a year"]);
  assert.equal(items[0].source.url, "https://facts.mit.edu/");
  assert.equal(items[0].source.label, "MIT Facts · 2024-2025");
  assert.equal(items[1].source.unnamed, true);
  assert.equal(items[2].source.label, "MIT Graduating Student Survey 2019");
  assert.deepEqual(peopleItems({}), []);
  assert.deepEqual(peopleItems({ enrollment_breakdown: { undergraduate_count: 4535 }, housing: { undergraduate_guarantee_years: 0 } }), []);
  // A figure with no source link is not shown: the salary needs its provenance.
  assert.deepEqual(peopleItems({ outcomes: { early_career_salary_usd: 98741 } }), []);
  assert.equal(peopleItems({ housing: { undergraduate_guarantee_years: 1 } })[0].text, "Housing guaranteed for 1 year");
  assert.equal(reviewedCards({ resolved: null, university: {}, now: NOW }).length, 1);
  assert.equal(reviewedCards({ resolved: null, university, now: NOW }).at(-1).id, "people");
});

test("housing years use the Russian plural forms", () => {
  setLanguage("rus", { emit: false });
  const text = years => peopleItems({ housing: { undergraduate_guarantee_years: years } })[0].text;
  assert.equal(text(1), "Жильё гарантировано на 1 год");
  assert.equal(text(4), "Жильё гарантировано на 4 года");
  assert.equal(text(5), "Жильё гарантировано на 5 лет");
  assert.equal(text(12), "Жильё гарантировано на 12 лет");
  setLanguage("eng", { emit: false });
});

const yale = () => ({
  id: "yale", finance: { currency: "USD", total_cost_year_usd: 97985, costs_breakdown_status: "official_mandatory_breakdown", financial_aid: { need_based: true, merit_based: false } },
  academics: { admissions: { university_wide: { kind: "undergraduate_institution_wide" } } },
  admission_categories: [{ id: "first-year", study_levels: ["Bachelor"], language_requirements_mode: "any",
    language_requirements: [{ code: "en", requirements: { IELTS: 7 } }, { code: "en", requirements: { PTE: 70 } }],
    extra_requirements: ["Official transcripts", "Two teacher recommendations", "Test scores", "Fee", "Fifth item", "Sixth item"] }],
});

test("a university without a reviewed catalog shows its published cost, selectivity and a short requirements list", () => {
  const [deadline, cost, needs, people] = legacyCards({ university: yale(), minPrice: 97985, acceptanceRate: 3.87,
    acceptanceMeta: { source: "College Scorecard", source_url: "https://example.gov/scorecard" } });
  assert.equal(deadline.id, "deadline");
  assert.equal(deadline.answerKind, "text");
  assert.match(cost.headline, /^\$97,985 a year$/);
  assert.equal(cost.lines[0], "Published total of tuition, fees and living costs, before financial aid.");
  assert.match(cost.aside[0].text, /need-based aid; an award is decided individually/);
  assert.equal(needs.items.length, 5);
  assert.match(needs.items[0].text, /^English test, any one of: IELTS Academic 7, PTE Academic 70$/);
  assert.equal(people.items[0].text, "3.9% of undergraduate applicants were admitted");
  assert.equal(people.items[0].source.url, "https://example.gov/scorecard");
});

test("legacy prices say what they cover and never claim a figure the record lacks", () => {
  const tuitionOnly = { finance: { currency: "KZT", total_cost_year_usd: 1500000, costs_breakdown_status: "official_tuition_and_fees_only" } };
  assert.equal(legacyCostCard(tuitionOnly, 1500000).lines[0], "Tuition and fees only; housing and food are extra. Before financial aid.");
  // A lower price among several published options is a starting price, not the total.
  assert.match(legacyCostCard(yale(), 80000).headline, /^From /);
  assert.equal(legacyCostCard(yale(), null).headline, "No annual cost is published in the catalog yet.");
  assert.equal(legacyCostCard({ finance: { currency: "USD", total_cost_year_usd: 5, financial_aid: { need_based: false, merit_based: false } } }, 5).aside.length, 0);
  const full = { finance: { currency: "USD", total_cost_year_usd: 5, financial_aid: { meets_full_demonstrated_need: true, international_eligible: true } } };
  assert.match(legacyCostCard(full, 5).aside[0].text, /^Published policy: the university meets full demonstrated financial need, including for international students\./);
});

test("legacy requirements are listed only for a single undergraduate category", () => {
  const university = yale();
  assert.equal(legacyNeedsItems(university).length, 5);
  assert.equal(legacyNeedsItems({ ...university, admission_categories: [...university.admission_categories, { ...university.admission_categories[0], id: "second" }] }), null);
  assert.deepEqual(legacyNeedsItems({ admission_categories: [{ id: "masters", study_levels: ["Master"] }] }), []);
  assert.deepEqual(legacyNeedsItems({}), []);
  const varies = legacyCards({ university: { ...university, admission_categories: [...university.admission_categories, { ...university.admission_categories[0], id: "second" }] }, minPrice: 1 });
  assert.equal(varies[2].headline, "Requirements differ between undergraduate programs.");
});

test("the rendered block escapes published text, states the one footnote once and links each card to its tab", () => {
  const cards = reviewedCards({ resolved: resolvedWith([fact("tests", "standardized_tests", "<img src=x onerror=alert(1)> is required.")]), university: {}, now: NOW });
  const html = renderSummary(cards, "Intro");
  assert.ok(!html.includes("<img"));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; is required\./);
  assert.equal(html.split("A summary of official facts, not an admission decision.").length, 2);
  assert.deepEqual([...html.matchAll(/data-open-tab="([^"]+)"/g)].map(match => match[1]), ["tab-deadlines", "tab-finance", "tab-admission"]);
  assert.equal([...html.matchAll(/data-summary-card="/g)].length, 3);
});
