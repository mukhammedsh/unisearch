import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { columnScope, renderReviewedComparisonPage } = await import("../../frontend/javascript/pages/universities/compare-reviewed.js");
const { soleCompatibleRoute } = await import("../../frontend/javascript/pages/universities/compare-helpers.js");
await initI18n();
window.location.href = "http://127.0.0.1/compare.html";

const fact = (id, value, extra = {}) => ({ id, value, publication_status: "published", review_status: "reviewed",
  normalized_status: { publication: "published", review: "verified" }, source_ids: ["official"], scope: { option_ids: [], route_ids: [] }, ...extra });
const quote = (currency, min, max, period, extra = {}) => ({ currency, min, max, period, annual_comparable: true, usd: currency === "USD" ? { min, max } : null, ...extra });
const university = (id, name, extra = {}) => ({ id, name, location: { city: "", country: "" }, admissions_catalog: { availability: "reviewed", study_levels: ["undergraduate", "masters"] }, ...extra });

function programColumn({ id = "imperial", name = "Imperial College London", costs = { tuition: quote("GBP", 47800, 47800, "2027 entry") }, facts = [], groups = {}, context = {}, resolved = {} } = {}) {
  return {
    id, university: university(id, name), sharedRoute: null, status: "ready",
    context: { study_option_id: "computing", application_route_id: "ucas", study_level: "undergraduate", intended_entry_cycle: "", fee_status_context: "unknown", ...context },
    resolved: { selected_option: { id: "computing", title: "Computing", awards: ["MEng"], levels: ["undergraduate"] },
      selected_route: { id: "ucas", title: "UCAS" }, available_routes: [{ id: "ucas" }], context_applicability: { option: "matched", route: "matched", level: "matched" },
      sources: [{ id: "official", url: "https://example.edu/source" }], facts, fact_groups: groups, selected_costs: costs, assessment: {}, ...resolved },
  };
}

function sharedColumn({ id = "mit", name = "Massachusetts Institute of Technology", costs = { annual_total: quote("USD", 92760, 92760, "2026-27") }, facts = [], groups = {}, extra = {} } = {}) {
  return {
    id, university: university(id, name, extra), sharedRoute: { id: `${id}-first-year` }, status: "ready",
    context: { study_option_id: "", application_route_id: "", study_level: "", intended_entry_cycle: "", fee_status_context: "unknown" },
    resolved: { selected_option: null, selected_route: { id: `${id}-first-year`, title: "First-year admission" }, reading_scope: "institution_route",
      context_applicability: { option: "not_required", route: "matched", level: "matched" }, sources: [], facts, fact_groups: groups, selected_costs: costs, assessment: {} },
  };
}

function chooseColumn(id = "imperial", name = "Imperial College London") {
  return { id, university: university(id, name), sharedRoute: null, status: "ready", resolved: null,
    context: { study_option_id: "", application_route_id: "", study_level: "", intended_entry_cycle: "", fee_status_context: "unknown" } };
}

const cell = (html, row, index) => html.split(`data-compare-row="${row}"`)[1]?.split("</div>")[0].split("<dd")[index + 1] || "";

test("two columns keep their own currency, period and university-page links", () => {
  setLanguage("eng", { emit: false });
  const html = renderReviewedComparisonPage([programColumn(), sharedColumn()], { budgetUsd: undefined });
  // A pound price follows the reader's currency, which is USD by default.
  assert.match(cell(html, "cost", 0), /≈ \$[\d,]+/);
  assert.match(cell(html, "cost", 0), /2027/);
  assert.match(cell(html, "cost", 1), /\$92,760/);
  assert.match(cell(html, "cost", 1), /2026/);
  assert.match(html, /admission_option=computing/);
  assert.match(html, /admission_application_route=mit-first-year/, "the shared route opens the page on that route");
  assert.match(html, /#tab-finance/);
  assert.doesNotMatch(html, /admission probability|chance of admission/i);
  // The missing budget is said once under the cost section, not in every column.
  assert.equal((html.match(/Add a yearly budget to your profile/g) || []).length, 1);
});

test("an incompatible or failed column never shows a stale price, and a published zero stays zero", () => {
  setLanguage("eng", { emit: false });
  const mismatched = programColumn({ resolved: { context_applicability: { route: "mismatched" } } });
  const failed = { ...sharedColumn(), status: "error" };
  const html = renderReviewedComparisonPage([mismatched, failed], {});
  assert.doesNotMatch(html, /47,800|92,760/);
  assert.equal(columnScope(mismatched), "mismatch");
  assert.match(html, /data-compare-retry="mit"/);
  const zero = programColumn({ costs: { annual_total: quote("USD", 0, 0, "2026-27") } });
  assert.match(cell(renderReviewedComparisonPage([zero, sharedColumn()], {}), "cost", 0), /\$0/);
});

test("a university that admits per program asks for a program instead of showing rows of unknowns", () => {
  setLanguage("eng", { emit: false });
  const html = renderReviewedComparisonPage([chooseColumn(), sharedColumn()], {});
  assert.equal(columnScope(chooseColumn()), "choose");
  for (const row of ["deadline", "needs", "cost", "funding"]) assert.match(cell(html, row, 0), /Depends on the program/, row);
  assert.match(html, /compare-reviewed__button--primary" data-compare-pick="imperial"/);
  assert.match(html, /First year, one shared application/);
  assert.doesNotMatch(html, /data-compare-section="program"/, "no program section while neither column has a program");
});

test("a chosen program asks for the route only where there are several, and says when none is published", () => {
  setLanguage("eng", { emit: false });
  const routes = programColumn({ resolved: { selected_route: null, available_routes: [{ id: "ucas" }, { id: "direct" }] } });
  assert.equal(columnScope(routes), "route");
  const html = renderReviewedComparisonPage([routes, sharedColumn()], {});
  assert.match(cell(html, "route", 0), /Choose how you apply to see this/);
  assert.match(cell(html, "cost", 0), /Choose how you apply to see this/);
  assert.match(html, /Choose how you apply<\/span>/);
  assert.match(html, /data-compare-section="program"/);
  const none = programColumn({ resolved: { selected_route: null, available_routes: [] } });
  assert.equal(columnScope(none), "no_route");
  assert.match(cell(renderReviewedComparisonPage([none, sharedColumn()], {}), "route", 0), /publishes no open application/);
});

test("section and row labels render in all three interface languages", () => {
  for (const [language, expected] of [["eng", "Cost and aid"], ["rus", "Стоимость и помощь"], ["kaz", "Құны және көмек"]]) {
    setLanguage(language, { emit: false });
    const html = renderReviewedComparisonPage([programColumn(), sharedColumn()], {});
    assert.ok(html.includes(expected), language);
    assert.doesNotMatch(html, /universities\.compare\.reviewed\./, `${language}: no raw keys`);
  }
  setLanguage("eng", { emit: false });
});

test("route names use the localized simple classification", () => {
  setLanguage("rus", { emit: false });
  const column = programColumn({ resolved: { selected_route: { id: "procedure-computing-meng", title: null, classification: "ucas_course_choice" } } });
  const html = renderReviewedComparisonPage([column, sharedColumn()], {});
  assert.match(cell(html, "route", 0), /Выбор программы через UCAS/);
  assert.doesNotMatch(html, /ucas_course_choice/);
  setLanguage("eng", { emit: false });
});

test("recurring windows without a year stay yearless", () => {
  setLanguage("eng", { emit: false });
  const windows = fact("windows", { windows: [{ name: "Restrictive Early Action", application_due: "November 1" }, { name: "Regular Decision", application_due: "January 5" }] },
    { topic: "application_windows", period: { kind: "fixed_dates", label: "First-year dates" } });
  const html = renderReviewedComparisonPage([sharedColumn({ id: "stanford", name: "Stanford University", facts: [windows], groups: { deadlines: ["windows"] } }), chooseColumn()], {});
  assert.match(cell(html, "deadline", 0), /November 1/);
  assert.doesNotMatch(cell(html, "deadline", 0), /November 1, 20\d{2}/);
});

test("named funding programs keep a published exclusion and never read as a promised award", () => {
  const exclusion = fact("inspires", { funding_program: "Imperial Inspires", availability: "excluded_by_published_course_rules" }, { topic: "funding" });
  const aid = fact("aid", { funding_program: "Need-based Aid", availability: "conditional" }, { topic: "funding" });
  const column = programColumn({ facts: [exclusion, aid], groups: { funding: ["inspires", "aid"] } });
  for (const [language, excluded, need] of [["eng", "excluded from this scholarship", "Need-based financial aid"], ["rus", "исключ", "Помощь по финансовой потребности"]]) {
    setLanguage(language, { emit: false });
    const funding = cell(renderReviewedComparisonPage([column, sharedColumn()], {}), "funding", 0);
    assert.ok(funding.toLowerCase().includes(excluded.toLowerCase()), language);
    assert.ok(funding.includes(need), language);
    assert.ok(!funding.includes("Need-based Aid:"), language);
  }
  setLanguage("eng", { emit: false });
});

test("the minimums row appears only when a column has a measurable result", () => {
  setLanguage("eng", { emit: false });
  assert.doesNotMatch(renderReviewedComparisonPage([programColumn(), sharedColumn()], {}), /data-compare-row="requirements"/);
  const checked = programColumn({ resolved: { assessment: { chancePercent: 50, activeChoice: { details: { checks: [
    { measurable: true, status: "met" }, { measurable: true, status: "unmet" }, { status: "unassessed" },
  ] } } } } });
  const html = renderReviewedComparisonPage([checked, sharedColumn()], {});
  assert.match(cell(html, "requirements", 0), /1 of 2 measurable minimums met \(50%\)/);
});

test("a price that depends on the fee status offers Home and Overseas, keeping the current choice pressed", () => {
  setLanguage("eng", { emit: false });
  const both = programColumn({ costs: { tuition: quote("GBP", 10050, 47800, "2027 entry", { fee_status_match: "unknown", fee_statuses: ["Home fee", "Overseas fee"] }) } });
  const html = renderReviewedComparisonPage([both, sharedColumn()], {});
  assert.match(cell(html, "cost", 0), /data-compare-fee="self_reported_international_overseas"[^>]*aria-pressed="false"/);
  assert.match(cell(html, "cost", 0), /data-compare-fee="unknown"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(cell(html, "cost", 1), /data-compare-fee/, "a single price has no switch");
  const overseas = programColumn({ context: { fee_status_context: "self_reported_international_overseas" }, costs: { tuition: quote("GBP", 47800, 47800, "2027 entry", { fee_status_match: "matched", fee_statuses: ["Overseas fee"] }) } });
  assert.match(cell(renderReviewedComparisonPage([overseas, sharedColumn()], {}), "cost", 0), /data-compare-fee="self_reported_international_overseas"[^>]*aria-pressed="true"/);
});

test("university rows show published figures with sources, mark missing ones and never show earnings", () => {
  setLanguage("eng", { emit: false });
  const mit = sharedColumn({ extra: {
    admission_statistics: { scope: "first_year_undergraduate", measure: "admitted", entry_year: 2025, applicants: 29281, admitted: 1334, rate_percent: 4.6, source: "MIT Admissions", source_url: "https://mitadmissions.org/stats" },
    enrollment_breakdown: { total_headcount: 11886, undergraduate_count: 4535, graduate_count: 7351, source: "MIT Registrar", source_url: "https://registrar.mit.edu", census_year: "2024-2025" },
    outcomes: { early_career_salary_usd: 120000 },
  } });
  const html = renderReviewedComparisonPage([mit, chooseColumn()], {});
  assert.match(cell(html, "selectivity", 0), /4\.6%/);
  assert.match(cell(html, "selectivity", 0), /mitadmissions\.org/);
  assert.match(cell(html, "students", 0), /11,886/);
  assert.match(cell(html, "students", 1), /Not published/);
  assert.doesNotMatch(html, /120,000|salary/i);
});

test("only the single route linked to a deliberately chosen program can be applied automatically", () => {
  const option = { id: "computing", levels: ["undergraduate"] };
  const route = { id: "ucas", levels: ["undergraduate"] };
  assert.equal(soleCompatibleRoute({ selected_option: option, available_routes: [route], context_applicability: {} }, { study_level: "undergraduate" }), route);
  assert.equal(soleCompatibleRoute({ selected_option: option, available_routes: [route, { id: "direct" }] }, {}), null, "several routes remain a choice");
  assert.equal(soleCompatibleRoute({ selected_option: option, available_routes: [] }, {}), null);
  assert.equal(soleCompatibleRoute({ selected_option: null, available_routes: [route] }, {}), null, "no program, no route");
  assert.equal(soleCompatibleRoute({ selected_option: option, selected_route: route, available_routes: [route] }, {}), null, "an existing route is kept");
  assert.equal(soleCompatibleRoute({ selected_option: option, available_routes: [route], context_applicability: { level: "mismatched" } }, {}), null);
  assert.equal(soleCompatibleRoute({ selected_option: option, available_routes: [{ id: "grad", levels: ["masters"] }] }, { study_level: "undergraduate" }), null);
});
