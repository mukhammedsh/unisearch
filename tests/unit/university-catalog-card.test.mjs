import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { universityCardPriceInfo, renderUniversityCardCosts, reviewedCardIndicators } = await import("../../frontend/javascript/pages/universities.js");
await initI18n();

test("reviewed admissions cards do not reuse legacy finance or match prices", () => {
  const price = universityCardPriceInfo({
    admissions_catalog: { availability: "reviewed" },
    finance: { total_cost_year_usd: 80_000 },
    matchData: { finalPriceUSD: 70_000 },
  });

  assert.equal(price.amount, null);
  assert.equal(price.amountUSD, null);
});

test("legacy catalog cards keep their existing price resolution", () => {
  const price = universityCardPriceInfo({ finance: { total_cost_year_usd: 42_000 } });

  assert.equal(price.amount, 42_000);
  assert.equal(price.amountUSD, 42_000);
});

test("card uses the selected published reference price", () => {
  setLanguage("eng", { emit: false });
  const university = { admissions_catalog: { availability: "reviewed" }, catalog_costs: { reference: true,
    annual_total: { min: 92760, max: 92760, currency: "USD", period: "2026-2027", study_level: "undergraduate", exclusions: ["insurance"] },
    tuition: { min: 66720, max: 66720, currency: "USD", period: "2026-2027", study_level: "undergraduate" } } };
  assert.equal(universityCardPriceInfo(university).amount, 92760);
  assert.equal(universityCardPriceInfo(university).basis, "annual_total");
  assert.equal(universityCardPriceInfo(university, "tuition").amount, 66720);
  assert.equal(universityCardPriceInfo(university, "tuition").basis, "tuition");
  const tuition = renderUniversityCardCosts(university, "tuition");
  assert.match(tuition, /66,720/);
  assert.doesNotMatch(tuition, /92,760/);
  assert.match(tuition, /data-cost-basis="tuition"/);
  assert.match(tuition, /role="tooltip"/);
  assert.match(tuition, /2026[‑-]2027/);
  const annual = renderUniversityCardCosts(university);
  assert.match(annual, /92,760/);
  assert.doesNotMatch(annual, /66,720/);
  assert.match(annual, /Insurance is additional/);
});

test("card keeps an unavailable budget separate from a published tuition range", () => {
  const university = { admissions_catalog: { availability: "reviewed" }, catalog_costs: { tuition: { min: 10050, max: 47800, currency: "GBP", fee_statuses: ["Home fee", "Overseas fee"] } } };
  assert.equal(universityCardPriceInfo(university).amount, null);
  const html = renderUniversityCardCosts(university);
  assert.match(html, /data-cost-basis="tuition"/);
  assert.match(html, /class="uni-price-period">Tuition<\/span>/);
  assert.match(html, /class="uni-price-val">[^<]+ – [^<]+<\/span>/);
  assert.match(html, /No comparable full budget/);
  assert.doesNotMatch(html, /data-cost-basis="annual_total"/);
  const price = universityCardPriceInfo(university, "tuition");
  assert.equal(price.basis, "tuition");
  assert.equal(price.amount, 10050);
  assert.equal(price.min, 10050);
  assert.equal(price.max, 47800);
  assert.ok(Number.isFinite(price.amountUSD) && price.amountUSD > 0);
});

test("verified zero remains a price while missing values do not become free", () => {
  assert.equal(universityCardPriceInfo({ catalog_costs: { tuition: { min: 0, max: 0, currency: "USD" } } }, "tuition").amount, 0);
  assert.equal(universityCardPriceInfo({ catalog_costs: { tuition: { min: null, max: null, currency: "USD" } } }, "tuition").amount, null);
  assert.match(renderUniversityCardCosts({ catalog_costs: { tuition: { min: 0, max: 0, currency: "USD" } } }, "tuition"), /\$0/);
});

test("catalog price quotes keep level, source period and unresolved fee or cycle scope visible", () => {
  setLanguage("eng", { emit: false });
  const university = { admissions_catalog: { availability: "reviewed" }, catalog_costs: {
    tuition: { min: 10050, max: 47800, currency: "GBP", period: "2026-27", levels: ["undergraduate", "masters"],
      fee_statuses: ["Overseas fee"], cycle_status: "dated_reference", fee_status_match: "unknown", filter_match: "partial" },
  } };
  const html = renderUniversityCardCosts(university, "tuition");
  assert.match(html, /2026[‑-]27/);
  assert.match(html, /Undergraduate, Master/);
  const context = html.match(/<span class="uni-cost-context" data-cost-context>([^<]+)<\/span>/)?.[1] || "";
  assert.equal((html.match(/data-cost-context/g) || []).length, 1);
  assert.match(context, /Undergraduate, Master&#039;s · 2026[‑-]27 · Overseas fee · Dated reference; cycle unconfirmed · Fee category unconfirmed · Partial price match/);
  assert.doesNotMatch(html, /self-reported fee category|Only part of this published range/);
});

test("whole-program and per-credit tuition never claim to be an annual price", () => {
  setLanguage("eng", { emit: false });
  for (const [billingPeriod, expected] of [["whole_program", "for the whole program"], ["per_credit", "/ credit"]]) {
    const university = { catalog_costs: { tuition: { min: 24000, max: 24000, currency: "USD", period: "2025-26", billing_period: billingPeriod,
      annual_comparable: false, campuses: ["Astana"], source_year: "2025-26" } } };
    const html = renderUniversityCardCosts(university, "tuition");
    assert.ok(html.includes(expected), billingPeriod);
    assert.ok(html.match(/aria-label="([^"]+)"/)[1].includes(expected), billingPeriod);
    assert.match(html, /Astana/);
    assert.doesNotMatch(html, /class="uni-price-period">\/ year/);
    assert.doesNotMatch(html, /yearly price/);
  }
});

test("UniFit explains reference-only and tuition-only budget comparisons without claiming total affordability", () => {
  const university = { admissions_catalog: { availability: "reviewed" }, matchData: {
    budgetAssessment: { status: "over_budget", evidence: "dated_reference", basis: "tuition", full_budget: false },
  } };
  for (const [language, referenceText, tuitionText] of [
    ["eng", "This reference is above budget", "Tuition only"],
    ["rus", "Этот ориентир выше бюджета", "Только обучение"],
    ["kaz", "Бұл бағдар бюджеттен жоғары", "Тек оқу ақысы"],
  ]) {
    setLanguage(language, { emit: false });
    const html = renderUniversityCardCosts(university);
    assert.ok(html.includes(referenceText), language);
    assert.ok(html.includes(tuitionText), language);
  }
  university.matchData.budgetAssessment.status = "unknown_cost";
  setLanguage("eng", { emit: false });
  assert.doesNotMatch(renderUniversityCardCosts(university), /This reference is above budget/);
});

test("two currencies describe one price, with complete ranges grouped by currency", () => {
  setLanguage("eng", { emit: false });
  const originalStorage = global.localStorage;
  global.localStorage = { getItem: key => key === "unisearch_settings_cache_v1" ? JSON.stringify([
    { key: "preferred_currency", value: "USD" }, { key: "currency_display_mode", value: "both" },
  ]) : null };
  try {
    const html = renderUniversityCardCosts({ catalog_costs: { tuition: { min: 10050, max: 47800, currency: "GBP" } } }, "tuition");
    assert.equal((html.match(/data-cost-basis=/g) || []).length, 1);
    assert.match(html, /≈ \$[\d,]+ – \$[\d,]+/);
    assert.match(html, /class="uni-cost-secondary">\(£10,050 – £47,800\)/);
    assert.equal((html.match(/class="uni-cost-secondary"/g) || []).length, 1);
  } finally {
    global.localStorage = originalStorage;
  }
});

test("large converted card amounts use compact local notation without changing the source price", () => {
  const originalStorage = global.localStorage;
  global.localStorage = { getItem: key => key === "unisearch_settings_cache_v1" ? JSON.stringify([
    { key: "preferred_currency", value: "KZT" }, { key: "currency_display_mode", value: "both" },
  ]) : null };
  try {
    for (const [language, compactUnit] of [["eng", "M"], ["rus", "млн"], ["kaz", "млн"]]) {
      setLanguage(language, { emit: false });
      const html = renderUniversityCardCosts({ catalog_costs: { tuition: { min: 66720, max: 66720, currency: "USD" } } }, "tuition");
      assert.ok(html.includes(compactUnit), language);
      assert.match(html, /₸/);
      assert.match(html, /\(\$66,720\)/);
      assert.doesNotMatch(html, /30,000,000/);
    }
  } finally {
    global.localStorage = originalStorage;
  }
});


test("reviewed UniFit indicators describe only the saved route and measurable checks", () => {
  setLanguage("eng", { emit: false });
  const match = { finalScore: 0.2, preferenceMismatch: 0.1, selectedByUser: true,
    admissionsSelection: { option: { title: "Computer Science" }, route: { title: "First-year admission" } },
    admissionsContext: { application_route_id: "first-year", study_level: "undergraduate", intended_entry_cycle: "Fall 2027" },
    requirementsFitPercent: 50, requirementChecks: [
      { measurable: true, status: "met" }, { measurable: true, status: "unmet" },
      { measurable: false, status: "unassessed" },
    ],
    budgetAssessment: { status: "over_budget", evidence: "dated_reference", basis: "tuition" },
    costQuote: { minUSD: 40000, maxUSD: 50000 }, affordabilityGap: 0.2,
  };
  const indicators = reviewedCardIndicators(match, 30000, "Focus: 40/100.");
  assert.equal(indicators.length, 3);
  assert.doesNotMatch(indicators.map(item => item.detail).join(" "), /40\/100|UniFit penalty|affects UniFit|Assessment context|Saved selection/);
  assert.match(indicators[0].label, /50%/);
  assert.equal(indicators[0].value, "50%");
  assert.match(indicators[0].detail, /1 of 2/);
  assert.equal(indicators[0].tone, "warning");
  assert.match(indicators[0].detail, /Other admission conditions/i);
  assert.match(indicators[1].detail, /published price/i);
  assert.match(indicators[1].detail, /tuition-only/i);
  assert.match(indicators[1].detail, /Living and other costs are extra/);
  assert.doesNotMatch(indicators[1].detail, /affects UniFit/i);
  assert.doesNotMatch(indicators.map(item => item.label + item.detail).join(" "), /requirements met|probability|award/i);
});

test("reviewed discovery avoids claiming a missing catalog subject is not offered", () => {
  setLanguage("eng", { emit: false });
  const match = { finalScore: 0.3, preferenceMismatch: 0.3, subjectMatch: { status: "missing" },
    requirementsFitPercent: null, requirementChecks: [{ measurable: true, status: "missing" }],
    budgetAssessment: { status: "unknown_cost" } };
  const indicators = reviewedCardIndicators(match, 20000);
  assert.match(indicators[0].label, /subject was not found/i);
  assert.match(indicators[0].detail, /our catalog/i);
  assert.equal(indicators.length, 1);
  assert.doesNotMatch(indicators.map(item => item.label + item.detail).join(" "), /required exam|does not offer/i);
  assert.deepEqual(reviewedCardIndicators({}, 20000), []);
});

test("a saved program subject mismatch does not claim that the catalog lacks the subject", () => {
  setLanguage("eng", { emit: false });
  const indicators = reviewedCardIndicators({ finalScore: 0.5, selectedByUser: true,
    admissionsContext: { study_option_id: "chemistry-bs", study_level: "undergraduate" },
    admissionsSelection: { option: { id: "chemistry-bs", title: "Chemistry (BS)" } },
    subjectMatch: { status: "missing" },
  }, 20000);
  assert.equal(indicators.length, 1);
  assert.match(indicators[0].label, /Different subject selected/);
  assert.match(indicators[0].detail, /saved program differs/);
  assert.doesNotMatch(indicators[0].label, /not found in this catalog/i);
});


test("a real zero requirements match remains visible without internal ranking scales", () => {
  setLanguage("eng", { emit: false });
  const indicators = reviewedCardIndicators({ finalScore: 0.6, preferenceMismatch: 0.9,
    requirementsFitPercent: 0, requirementChecks: [{ measurable: true, status: "unmet" }],
  }, null, "University indicator: 99/100");
  assert.equal(indicators.length, 1);
  assert.equal(indicators[0].value, "0%");
  assert.match(indicators[0].detail, /0 of 1/);
  assert.doesNotMatch(JSON.stringify(indicators), /99|ranking|preference comparison/i);
});
