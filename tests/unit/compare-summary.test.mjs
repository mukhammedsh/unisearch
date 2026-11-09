import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { renderReviewedComparison } = await import("../../frontend/javascript/pages/universities/compare-summary.js");
await initI18n();
window.location.href = "http://127.0.0.1/compare.html";

const universities = [{ id: "imperial", name: "Imperial College London" }, { id: "mit", name: "Massachusetts Institute of Technology" }];
const fact = (id, value) => ({ id, value, publication_status: "published", review_status: "reviewed",
  normalized_status: { publication: "published", review: "verified" }, source_ids: ["official"],
  scope: { option_ids: ["computing"], route_ids: [] } });
function state(currency, amount, period) {
  const facts = [fact("program", { duration: "4 years", mode: "Full-time", course_page_tuition_fees: {
    "Overseas fee": [{ panel_status: "published", cycle: period, amounts_and_periods: [`${amount} ${currency} per year`] }],
  } }), fact("date", { other_course_equal_consideration: { date: "2027-01-13", time: "18:00", timezone: "Europe/London" } })];
  return { status: "ready", context: { study_option_id: "computing", application_route_id: "ucas", study_level: "undergraduate", intended_entry_cycle: "2027 entry" },
    resolved: { selected_option: { id: "computing", title: "Computing", awards: ["MEng"], levels: ["undergraduate"] },
      selected_route: { id: "ucas", title: "UCAS" }, sources: [{ id: "official", url: "https://example.edu/fees" }], facts,
      fact_groups: { study: ["program"], costs: ["program"], deadlines: ["date"] } } };
}

test("comparison keeps the two program contexts, currencies, periods and source links independent", () => {
  setLanguage("eng", { emit: false });
  const states = new Map([["imperial", state("GBP", 47800, "2027 entry")], ["mit", state("USD", 66720, "2026-27")]]);
  const before = structuredClone([...states]);
  const html = renderReviewedComparison(universities, states);
  assert.match(html, /47800 GBP/);
  assert.match(html, /66720 USD/);
  assert.match(html, /2026[-‑]27/);
  assert.match(html, /2027/);
  assert.ok([...html.matchAll(/\shref="([^"]*)"/g)].some(([, href]) => href === "https://example.edu/fees"));
  assert.match(html, /admission_option=computing/);
  assert.match(html, /#tab-deadlines/);
  assert.doesNotMatch(html, /%|admission probability|total net cost/i);
  assert.deepEqual([...states], before);
});

test("unresolved and incompatible contexts never display a stale price or turn missing values into zero", () => {
  const current = state("GBP", 47800, "2027 entry");
  current.resolved.context_applicability = { route: "mismatched" };
  const html = renderReviewedComparison(universities, new Map([["imperial", current], ["mit", { status: "error" }]]));
  assert.doesNotMatch(html, /47800|0 USD|0 GBP/);
  assert.match(html, /Not established/);
  current.resolved.context_applicability = {};
  current.resolved.facts[0].value.course_page_tuition_fees["Overseas fee"][0].amounts_and_periods = ["0 GBP per year"];
  assert.match(renderReviewedComparison(universities, new Map([["imperial", current]])), /0 GBP/);
});

test("comparison labels and dated-reference guidance render in all supported languages", () => {
  for (const [language, expected] of [["eng", "Published tuition"], ["rus", "Опубликованная стоимость обучения"], ["kaz", "Жарияланған оқу ақысы"]]) {
    setLanguage(language, { emit: false });
    assert.ok(renderReviewedComparison(universities, new Map()).includes(expected), language);
  }
});

test("shared undergraduate comparison reads route facts and prices without a selected major", () => {
  setLanguage("eng", { emit: false });
  const shared = state("USD", 66720, "2026-27");
  shared.context = { study_option_id: "", application_route_id: "mit-first-year", study_level: "undergraduate" };
  shared.resolved.selected_option = null;
  shared.resolved.selected_route = { id: "mit-first-year", title: "MIT undergraduate admission" };
  shared.resolved.reading_scope = "institution_route";
  shared.resolved.context_applicability = { option: "not_required", route: "matched", level: "matched" };
  shared.resolved.facts = [
    { ...fact("budget", { tuition: 66720, total_before_aid: 92760, currency: "USD", academic_year: "2026-27" }),
      scope: { option_ids: [], route_ids: ["mit-first-year"] } },
    { ...fact("date", { deadline: "2027-01-05" }), scope: { option_ids: [], route_ids: ["mit-first-year"] }, topic: "deadlines" },
    fact("other-program", { tuition: 1, currency: "USD" }),
  ];
  shared.resolved.fact_groups = { costs: ["budget", "other-program"], deadlines: ["date"] };
  const html = renderReviewedComparison([universities[1]], new Map([["mit", shared]]));
  assert.match(html, /University-wide application route/);
  assert.match(html, /66,720 USD/);
  assert.match(html, /92,760 USD/);
  assert.match(html, /January 5, 2027/);
  assert.doesNotMatch(html, /<div>1 USD/);
  shared.resolved.context_applicability.level = "mismatched";
  assert.doesNotMatch(renderReviewedComparison([universities[1]], new Map([["mit", shared]])), /66,720 USD|92,760 USD/);
});

test("comparison route labels use the localized simple classification when a route has no translation", () => {
  setLanguage("rus", { emit: false });
  const selected = state("GBP", 47800, "2027 entry");
  selected.resolved.selected_route = { id: "procedure-computing-meng", title: null, classification: "ucas_course_choice" };
  const html = renderReviewedComparison([universities[0]], new Map([["imperial", selected]]));
  assert.match(html, /Выбор программы через UCAS/);
  assert.doesNotMatch(html, /ucas_course_choice/);
});

test("comparison identifies a published scholarship exclusion without promising aid", () => {
  setLanguage("eng", { emit: false });
  const selected = state("GBP", 81000, "September 2027");
  selected.resolved.facts.push(fact("funding", { funding_program: "Imperial Inspires", availability: "excluded_by_published_course_rules" }));
  selected.resolved.fact_groups.funding = ["funding"];
  const html = renderReviewedComparison([universities[0]], new Map([["imperial", selected]]));
  assert.match(html, /excluded from this scholarship/);
  assert.doesNotMatch(html, /not a confirmed award/);
});

test("comparison preserves normalized whole-program tuition, campus and source period", () => {
  setLanguage("eng", { emit: false });
  const selected = state("USD", 24000, "2025-26");
  selected.resolved.facts = [{ ...fact("program-price", "The source quotes the complete program fee."), publication_status: "published_reference_amounts_year_unspecified", normalized_status: { publication: "published_with_limits", review: "verified" }, attributes: { catalog_costs: { quotes: [
    { basis: "tuition", amount: 24000, currency: "USD", period_label: "2025-26", source_year: "2025-26", billing_period: "whole_program", campus: "Astana" },
  ] } } }];
  selected.resolved.fact_groups = { costs: ["program-price"] };
  const html = renderReviewedComparison([universities[0]], new Map([["imperial", selected]]));
  for (const text of ["24,000", "USD", "for the whole program", "Astana", "2025"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /24,000[^<]*per year/);
  assert.equal((html.match(/24,000/g) || []).length, 1);
});

const { comparisonSelectionGap } = await import("../../frontend/javascript/pages/universities/compare-summary.js");
const { soleCompatibleRoute } = await import("../../frontend/javascript/pages/universities/compare-helpers.js");

function emptyState(extra = {}) {
  return { status: "ready", context: { study_option_id: "", application_route_id: "", study_level: "", intended_entry_cycle: "" },
    resolved: { selected_option: null, selected_route: null, available_routes: [], context_applicability: {}, facts: [], fact_groups: {}, ...extra } };
}

test("an unselected university shows one localized prompt instead of rows of unknown values", () => {
  for (const [language, expected] of [["eng", /Choose a study option or a university-wide application route for Imperial College London/], ["rus", /Imperial College London: выберите программу или общий маршрут подачи/], ["kaz", /Imperial College London үшін .* таңдаңыз/]]) {
    setLanguage(language, { emit: false });
    const html = renderReviewedComparison([universities[0], universities[1]], new Map([["imperial", emptyState()], ["mit", state("USD", 66720, "2026-27")]]));
    assert.match(html, expected, language);
    assert.equal((html.match(/data-selection-prompt="choose_program"/g) || []).length, 1, language);
    assert.equal((html.match(/rowspan="9"/g) || []).length, 1, language);
    assert.equal((html.match(/Not established|Для выбранного варианта не подтверждено|расталмаған/g) || []).length, 1, `${language}: only the fixture budget row of the selected university stays unknown`);
    assert.match(html, /data-action="choose-context"/);
  }
});

test("a chosen program without a route keeps its own rows and asks only for the application route", () => {
  setLanguage("eng", { emit: false });
  const withProgram = emptyState({ selected_option: { id: "computing", title: "Computing", awards: ["MEng"], levels: ["undergraduate"] },
    available_routes: [{ id: "ucas", title: "UCAS" }, { id: "direct", title: "Direct" }] });
  const html = renderReviewedComparison([universities[0]], new Map([["imperial", withProgram]]));
  assert.match(html, /data-selection-prompt="choose_route"/);
  assert.match(html, /Choose how you will apply to Imperial College London for Computing/);
  assert.match(html, /<strong>Computing<\/strong>/);
  assert.match(html, /rowspan="7"/);
  assert.equal((html.match(/Not established/g) || []).length, 1, "only the duration row stays unknown");
  withProgram.resolved.available_routes = [];
  assert.doesNotMatch(renderReviewedComparison([universities[0]], new Map([["imperial", withProgram]])), /data-selection-prompt/);
});

test("selection gaps cover incompatible, loading, failed and institution-route states", () => {
  assert.equal(comparisonSelectionGap(undefined), "");
  assert.equal(comparisonSelectionGap({ status: "loading", resolved: null }), "");
  assert.equal(comparisonSelectionGap({ status: "error" }), "");
  assert.equal(comparisonSelectionGap(emptyState({ context_applicability: { route: "mismatched" } })), "incompatible");
  assert.equal(comparisonSelectionGap(emptyState({ reading_scope: "institution_route", selected_route: { id: "shared" } })), "");
  assert.equal(comparisonSelectionGap(state("GBP", 1, "2027 entry")), "");
  setLanguage("eng", { emit: false });
  assert.match(renderReviewedComparison([universities[0]], new Map([["imperial", emptyState({ context_applicability: { route: "mismatched" } })]])), /do not match/);
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
