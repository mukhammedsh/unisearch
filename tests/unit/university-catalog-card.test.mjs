import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { universityCardPriceInfo } = await import("../../frontend/javascript/pages/universities.js");

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
