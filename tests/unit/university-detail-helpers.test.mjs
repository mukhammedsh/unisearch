import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async (url) => {
  const target = String(url || "");
  if (target.endsWith("Localization/eng")) {
    return {
      ok: true,
      async text() {
        return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8");
      },
    };
  }
  if (target.endsWith("Localization/ru")) {
    return {
      ok: true,
      async text() {
        return readFile(new URL("../../frontend/Localization/ru", import.meta.url), "utf8");
      },
    };
  }
  return { ok: false, async text() { return ""; } };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const {
  getAdmissionChoicesFromCategories,
  renderTrackChanceChip,
  renderTrackFactors,
} = await import("../../frontend/javascript/university-detail-helpers.js");

await initI18n();

test("renderTrackFactors localizes known factor keys in Russian", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackFactors({
    factors: [
      {
        key: "academic_strength",
        status: "positive",
        label: "Academic profile",
        message: "Academic scores are strong for this requirement profile.",
      },
    ],
  });

  assert.match(html, /Сильный академический профиль/);
  assert.match(html, /Академические баллы хорошо подходят для этого профиля требований\./);
  assert.doesNotMatch(html, /Academic profile/);
  assert.doesNotMatch(html, /Academic scores are strong/);
});

test("renderTrackFactors localizes holistic_review_selectivity in Russian", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackFactors({
    factors: [
      {
        key: "holistic_review_selectivity",
        status: "neutral",
        label: "Holistic review",
        message: "At colleges with <10% acceptance rate, test scores are a screening baseline. Admission relies heavily on olympiads, essays, and extracurriculars.",
      },
    ],
  });

  assert.match(html, /Комплексное рассмотрение/);
  assert.match(html, /В вузах с приемом (&lt;|<)10% баллы тестов — лишь базовый фильтр/);
  assert.doesNotMatch(html, /Holistic review/);
  assert.doesNotMatch(html, /screening baseline/);
});

test("renderTrackFactors keeps backend fallback for unknown factor keys", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackFactors({
    factors: [
      {
        key: "future_signal",
        status: "neutral",
        label: "Future signal",
        message: "Backend fallback stays visible.",
      },
    ],
  });

  assert.match(html, /Future signal/);
  assert.match(html, /Backend fallback stays visible\./);
});

test("renderTrackChanceChip uses Russian badge labels without mixed English terms", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackChanceChip({
    chancePercent: 72,
    badges: ["foundation_required", "need_aware", "need_blind"],
  });

  assert.match(html, /Может потребоваться подготовительная программа/);
  assert.match(html, /Финансовая нуждаемость учитывается/);
  assert.match(html, /Финансовая нуждаемость не учитывается/);
  assert.doesNotMatch(html, /Need-aware|Need-blind|foundation route/);
});

test("getAdmissionChoicesFromCategories preserves score profile and funding-specific requirements", () => {
  const choices = getAdmissionChoicesFromCategories([
    {
      id: "regular",
      label: "Regular",
      requirements: { GPA: 3.2 },
      published_admission: {
        rate_percent: 20,
        scope: "institution",
        audience: "all",
        cycle: "2025",
      },
      language_requirements: [
        { code: "en", requirements: { IELTS: 6.5 }, accept_native: true },
      ],
      requirement_profiles: [
        {
          id: "sat",
          label: "SAT",
          requirements: { SAT: 1200 },
          stats_avg: { SAT: 1320 },
          score_profile: {
            exam_id: "SAT",
            p25_raw: 1260,
            median_raw: 1320,
            p75_raw: 1400,
          },
          published_admission: {
            rate_percent: 7,
            scope: "program",
            audience: "all",
            cycle: "2023-25",
          },
          finance_override: { total_cost_year_usd: 30000 },
          funding_options: [
            {
              id: "paid",
              label: "Paid",
              funding_type: "paid",
              requirements: { SAT: 1200 },
            },
            {
              id: "grant",
              label: "Grant",
              funding_type: "grant",
              requirements: { SAT: 1400, GPA: 3.6 },
              finance_override: { total_cost_year_usd: 10000 },
            },
          ],
        },
      ],
    },
  ]);

  const paid = choices.find((choice) => choice.funding_option_id === "paid");
  const grant = choices.find((choice) => choice.funding_option_id === "grant");

  assert.deepEqual(paid.requirements, { GPA: 3.2, SAT: 1200 });
  assert.deepEqual(paid.base_requirements, { GPA: 3.2, SAT: 1200 });
  assert.deepEqual(paid.funding_requirements, { SAT: 1200 });
  assert.equal(paid.score_profile.exam_id, "SAT");
  assert.equal(paid.stats_avg.SAT, 1320);
  assert.equal(paid.finance_override.total_cost_year_usd, 30000);
  assert.equal(paid.published_admission.rate_percent, 7);
  assert.equal(paid.published_admission.scope, "program");
  assert.equal(paid.language_requirements[0].requirements.IELTS, 6.5);

  assert.deepEqual(grant.requirements, { GPA: 3.6, SAT: 1400 });
  assert.deepEqual(grant.base_requirements, { GPA: 3.2, SAT: 1200 });
  assert.deepEqual(grant.funding_requirements, { SAT: 1400, GPA: 3.6 });
  assert.equal(grant.score_profile.median_raw, 1320);
  assert.equal(grant.finance_override.total_cost_year_usd, 10000);
  assert.equal(grant.published_admission.rate_percent, 7);
});
