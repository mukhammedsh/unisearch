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

test("published reference prices show both bases, their year and excluded costs", () => {
  setLanguage("eng", { emit: false });
  const university = { admissions_catalog: { availability: "reviewed" }, catalog_costs: { reference: true,
    annual_total: { min: 92760, max: 92760, currency: "USD", period: "2026-2027", study_level: "undergraduate", exclusions: ["insurance"] },
    tuition: { min: 66720, max: 66720, currency: "USD", period: "2026-2027", study_level: "undergraduate" } } };
  assert.equal(universityCardPriceInfo(university).amount, 92760);
  assert.equal(universityCardPriceInfo(university, "tuition").amount, 66720);
  const html = renderUniversityCardCosts(university, "tuition");
  assert.match(html, /66,720/);
  assert.match(html, /92,760/);
  assert.ok(html.indexOf('data-cost-basis="tuition"') < html.indexOf('data-cost-basis="annual_total"'));
  assert.match(html, /2026[‑-]2027/);
  assert.equal((html.match(/2026[‑-]2027/g) || []).length, 1);
  assert.match(html, /Insurance is additional/);
});

test("ranges and verified zero remain prices while missing values do not become free", () => {
  setLanguage("eng", { emit: false });
  const university = { catalog_costs: { tuition: { min: 10050, max: 47800, currency: "GBP", fee_statuses: ["Home fee", "Overseas fee"] } } };
  const html = renderUniversityCardCosts(university, "tuition");
  assert.match(html, / – /);
  assert.match(html, /Home\/Overseas/);
  assert.match(html, /No comparable full budget/);
  assert.ok(renderUniversityCardCosts(university).indexOf('data-cost-basis="tuition"') < renderUniversityCardCosts(university).indexOf('data-cost-basis="annual_total"'));
  assert.equal(universityCardPriceInfo({ catalog_costs: { tuition: { min: 0, max: 0, currency: "USD" } } }, "tuition").amount, 0);
  assert.equal(universityCardPriceInfo({ catalog_costs: { tuition: { min: null, max: null, currency: "USD" } } }, "tuition").amount, null);
});
