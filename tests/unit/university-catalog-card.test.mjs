import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { universityCardPriceInfo, renderUniversityCardCosts } = await import("../../frontend/javascript/pages/universities.js");
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

test("published reference cards show only the selected price basis and retain its explanation", () => {
  setLanguage("eng", { emit: false });
  const university = { admissions_catalog: { availability: "reviewed" }, catalog_costs: { reference: true,
    annual_total: { min: 92760, max: 92760, currency: "USD", period: "2026-2027", study_level: "undergraduate", exclusions: ["insurance"] },
    tuition: { min: 66720, max: 66720, currency: "USD", period: "2026-2027", study_level: "undergraduate" } } };
  assert.equal(universityCardPriceInfo(university).amount, 92760);
  assert.equal(universityCardPriceInfo(university, "tuition").amount, 66720);
  const html = renderUniversityCardCosts(university, "tuition");
  assert.match(html, /66,720/);
  assert.doesNotMatch(html, /92,760/);
  assert.equal((html.match(/data-cost-basis=/g) || []).length, 1);
  assert.match(html, /data-cost-basis="tuition"/);
  assert.match(html, /role="tooltip"/);
  assert.match(html, /2026[‑-]2027/);
  assert.equal((html.match(/2026[‑-]2027/g) || []).length, 1);
  const annual = renderUniversityCardCosts(university);
  assert.match(annual, /92,760/);
  assert.doesNotMatch(annual, /66,720/);
  assert.match(annual, /Insurance extra/);
});

test("ranges and verified zero remain prices while missing values do not become free", () => {
  setLanguage("eng", { emit: false });
  const university = { catalog_costs: { tuition: { min: 10050, max: 47800, currency: "GBP", fee_statuses: ["Home fee", "Overseas fee"] } } };
  const html = renderUniversityCardCosts(university, "tuition");
  assert.match(html, / – /);
  assert.match(html, /Home fee, Overseas fee/);
  assert.doesNotMatch(html, /data-cost-basis="annual_total"/);
  const missingTotal = renderUniversityCardCosts(university);
  assert.match(missingTotal, /No comparable full budget/);
  assert.doesNotMatch(missingTotal, /data-cost-basis="tuition"|10,050|47,800/);
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
