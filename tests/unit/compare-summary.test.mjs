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
const fact = (id, value) => ({ id, value, publication_status: "published", review_status: "reviewed", source_ids: ["official"],
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
  assert.match(html, /https:\/\/example.edu\/fees/);
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

test("comparison identifies a published scholarship exclusion without promising aid", () => {
  setLanguage("eng", { emit: false });
  const selected = state("GBP", 81000, "September 2027");
  selected.resolved.facts.push(fact("funding", { funding_program: "Imperial Inspires", availability: "excluded_by_published_course_rules" }));
  selected.resolved.fact_groups.funding = ["funding"];
  const html = renderReviewedComparison([universities[0]], new Map([["imperial", selected]]));
  assert.match(html, /excluded from this scholarship/);
  assert.doesNotMatch(html, /not a confirmed award/);
});
