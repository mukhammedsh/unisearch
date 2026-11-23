import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { EXAM_CONFIG, formatExamValue } from "../../frontend/javascript/utils/config.js";
import { formatMoney, convert } from "../../frontend/javascript/currency.js";
import { moneyUSD, numberLocale } from "../../frontend/javascript/utils/format.js";
import {
  buildEmptyStateModel,
  describeActiveFilters,
  renderEmptyStateCard,
} from "../../frontend/javascript/pages/universities/empty-state.js";
import { costScopeLabel } from "../../frontend/javascript/pages/universities/card-tooltips.js";
import { budgetTooltip, exactBudgetMoney } from "../../frontend/javascript/pages/universities/unifit-explanation.js";
import { hasPartialDateInput } from "../../frontend/javascript/components/profile/profile-utils.js";
import { fillBudgetCurrencyOptions } from "../../frontend/javascript/components/profile/budget-currency.js";

// Labels come from the language packs, so the English pack is loaded as in the app.
global.fetch = async (url) => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
await initI18n();
setLanguage("eng", { emit: false });

const examDefinitions = JSON.parse(await readFile(new URL("../../backend/data/exams.json", import.meta.url), "utf8"));
for (const id of ["A_LEVEL_CERT", "A_LEVEL_MATHEMATICS", "A_LEVEL_PHYSICS", "A_LEVEL_CHEMISTRY"]) EXAM_CONFIG[id] = examDefinitions[id];

const setHtmlLang = (lang) => { global.document.documentElement.lang = lang; };

test("P18: numbers follow the interface language, the typed amount keeps its digits", () => {
  setHtmlLang("en");
  assert.equal(numberLocale(), "en-US");
  assert.equal(formatMoney(5200000, "KZT"), "5,200,000 ₸");
  assert.equal(moneyUSD(92760), "$92,760");
  setHtmlLang("ru");
  assert.equal(numberLocale(), "ru-RU");
  assert.match(formatMoney(5200000, "KZT"), /^5[  ]200[  ]000 ₸$/);
  assert.match(formatMoney(1234.5, "BHD"), /1[  ]?234,5 BD/);
  setHtmlLang("kk");
  assert.equal(numberLocale(), "kk-KZ");
  assert.match(formatMoney(5200000, "KZT"), /^5[  ]200[  ]000 ₸$/);
  setHtmlLang("");
  assert.equal(numberLocale(), "en-US");
});

test("P18: a typed budget is shown as typed, not as a round trip through rounded dollars", () => {
  const profile = { budget: "5200000", budgetCurrency: "KZT" };
  const usd = Math.round(convert(5200000, "KZT", "USD"));
  const fallback = (value) => `converted ${value}`;
  setHtmlLang("en");
  assert.equal(exactBudgetMoney(usd, profile, { convert, formatMoney, fallback }), "5,200,000 ₸");
  // The stored dollar budget no longer matches the typed amount: use the converted fallback.
  assert.equal(exactBudgetMoney(usd + 500, profile, { convert, formatMoney, fallback }), `converted ${usd + 500}`);
  assert.equal(exactBudgetMoney(5000, { budget: "", budgetCurrency: "USD" }, { convert, formatMoney, fallback }), "converted 5000");
  const tip = budgetTooltip(
    { status: "within", costMin: 1000, budget: usd },
    { money: fallback, budgetMoney: (value) => exactBudgetMoney(value, profile, { convert, formatMoney, fallback }), tr: (k) => k, trf: (k, p) => `${k}|${p.budget}` },
  );
  assert.match(tip, /5,200,000 ₸/);
});

test("P21: A-Level is shown as grades, not as the internal points sum", () => {
  const entry = {
    exam: "A_LEVEL_CERT",
    score: 17,
    details: { components: [
      { exam: "A_LEVEL_MATHEMATICS", score: 6 },
      { exam: "A_LEVEL_PHYSICS", score: 6 },
      { exam: "A_LEVEL_CHEMISTRY", score: 5 },
    ] },
  };
  assert.match(formatExamValue("A_LEVEL_CERT", entry, { locale: "eng" }), /^A\*A\*A \(/);
  // Grades that do not add up to the stored total are not presented as the applicant's grades.
  assert.match(formatExamValue("A_LEVEL_CERT", { ...entry, score: 15 }, { locale: "eng" }), /^15 \(/);
});

test("P11: the empty state names the filters that hide results and the way out", () => {
  setHtmlLang("en");
  const limits = { min: 0, max: 20000000 };
  const deps = { currency: "KZT", formatMoney, optionLabel: (field, value) => value };
  const summary = describeActiveFilters(
    { q: "MIT", country: "", study_level: "bachelor", min_tuition: 0, max_tuition: 5200000, funding_type: "" },
    limits, deps,
  );
  assert.equal(summary.price, "max");
  assert.deepEqual(summary.labels.length, 3);
  assert.ok(summary.labels.some((label) => /5,200,000 ₸/.test(label)));
  const model = buildEmptyStateModel({ onlySaved: false, summary });
  assert.deepEqual(model.actions.map((item) => item.action), ["reset-filters", "clear-price-filter"]);
  assert.match(model.filtersText, /MIT/);
  const html = renderEmptyStateCard(model, { keepSaved: true });
  assert.match(html, /data-action="reset-filters" data-keep-saved/);
  assert.match(html, /data-action="clear-price-filter"/);

  const none = describeActiveFilters({ min_tuition: 0, max_tuition: 20000000 }, limits, deps);
  assert.equal(none.price, "none");
  const bare = buildEmptyStateModel({ onlySaved: true, summary: none });
  assert.equal(bare.actions.length, 0);
  assert.equal(bare.filtersText, "");
});

test("P10: a price covering several study levels says so; a level filter names the level", () => {
  setHtmlLang("en");
  assert.equal(costScopeLabel(["undergraduate"], ""), "");
  assert.equal(costScopeLabel(["doctoral", "masters", "professional", "undergraduate"], ""), "All levels");
  assert.equal(costScopeLabel(["undergraduate"], "bachelor"), "Bachelor's");
  assert.equal(costScopeLabel(["doctoral", "undergraduate"], "bachelor"), "Bachelor's");
});

test("P16: a partly typed date counts as invalid, an empty one does not", () => {
  assert.equal(hasPartialDateInput({ validity: { badInput: true }, value: "" }), true);
  assert.equal(hasPartialDateInput({ validity: { badInput: false }, value: "" }), false);
  assert.equal(hasPartialDateInput(null), false);
});

test("P19: the budget currency select reuses the options of the Settings dialog", () => {
  const nodes = ["KZT", "USD"].map((value) => ({ cloneNode: () => ({ value }) }));
  const select = { options: [], replaceChildren(...items) { this.options = items; } };
  const doc = { getElementById: () => ({ children: nodes }) };
  assert.equal(fillBudgetCurrencyOptions(select, doc), true);
  assert.deepEqual(select.options.map((item) => item.value), ["KZT", "USD"]);
  // Already filled: nothing is replaced.
  assert.equal(fillBudgetCurrencyOptions(select, doc), false);
});
