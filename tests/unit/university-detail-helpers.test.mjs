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
const { EXAM_CONFIG } = await import("../../frontend/javascript/utils/config.js");
const {
  admissionChoiceKey,
  applyPercentWidths,
  chanceTone,
  clusterMarkerLogoHtml,
  getAdmissionChoicesFromCategories,
  getGrantsFromCategories,
  getTrackFundingType,
  mapMarkerLogoHtml,
  renderExamGroup,
  renderGroupedExamPairRows,
  renderTrackChanceChip,
  renderTrackFactors,
  renderTrackFundingBadge,
  renderUniChanceSummary,
  splitExamEntries,
} = await import("../../frontend/javascript/university-detail-helpers.js");

await initI18n();

test("map marker markup escapes URLs and cluster counts are normalized", () => {
  const marker = mapMarkerLogoHtml('logo.png" onerror="alert(1)');
  assert.match(marker, /logo\.png&quot; onerror=&quot;alert\(1\)/);
  assert.match(marker, /data-remove-on-error="1"/);
  assert.match(clusterMarkerLogoHtml("logo.png", "3"), /cluster-badge">\+3</);
  assert.match(clusterMarkerLogoHtml("logo.png", "invalid"), /cluster-badge">\+0</);
});

test("applyPercentWidths clamps invalid and out-of-range values", () => {
  const values = ["35", "-4", "125", "not-a-number"];
  const nodes = values.map((value) => {
    const properties = {};
    return {
      getAttribute: () => value,
      style: { setProperty: (name, next) => { properties[name] = next; } },
      properties,
    };
  });
  applyPercentWidths({ querySelectorAll: () => nodes });
  assert.deepEqual(nodes.map((node) => node.properties), [
    { "--fill-width": "35%", "--fill-scale": "0.35" },
    { "--fill-width": "0%", "--fill-scale": "0" },
    { "--fill-width": "100%", "--fill-scale": "1" },
    { "--fill-width": "0%", "--fill-scale": "0" },
  ]);
  assert.doesNotThrow(() => applyPercentWidths(null));
});

test("splitExamEntries separates language evidence and ignores missing values", () => {
  assert.deepEqual(splitExamEntries({ SAT: 1400, IELTS: 7, TOPIK: 4, GPA: null, ACT: undefined }), {
    lang: [["IELTS", 7], ["TOPIK", 4]],
    acad: [["SAT", 1400]],
  });
  assert.deepEqual(splitExamEntries(null), { lang: [], acad: [] });
});

test("grouped exam rows keep composite components together and format levels", () => {
  setLanguage("eng", { persist: false, emit: false });
  const previous = EXAM_CONFIG.IELTS;
  EXAM_CONFIG.IELTS = {
    ...previous,
    breakdown_scheme: {
      parent_score_label: "Overall",
      fixed_components: ["IELTS_LISTENING", "IELTS_SPEAKING"],
    },
  };
  const html = renderGroupedExamPairRows([
    ["IELTS_SPEAKING", 6.5],
    ["SAT", 1400],
    ["IELTS", 7],
    ["IELTS_LISTENING", 7.5],
    ["JLPT", 2],
    ["TOPIK", 4],
    ["", 10],
  ]);
  try {
    assert.match(html, /track-exam-entry-group/);
    assert.match(html, /IELTS/);
    assert.ok(html.indexOf("Listening") < html.indexOf("Speaking"));
    assert.match(html, /SAT:<\/strong> 1400/);
    assert.match(html, /JLPT:<\/strong> N2/);
    assert.match(html, /TOPIK:<\/strong> Level 4/);
    assert.equal(renderGroupedExamPairRows(null), "");
  } finally {
    EXAM_CONFIG.IELTS = previous;
  }
});

test("exam groups expose semantic tones and omit empty sections", () => {
  assert.equal(renderExamGroup("None", [], "#2563eb"), "");
  assert.match(renderExamGroup("Academic", [["SAT", 1300]], "#2563eb"), /track-exam-group--info/);
  assert.match(renderExamGroup("Language", [["IELTS", 6.5]], "#047857"), /track-exam-group--success/);
  assert.match(renderExamGroup("Other", [["GPA", 3.5]], "#fff"), /track-exam-group--neutral/);
});

test("admission choice keys are stable and omit empty segments", () => {
  assert.equal(admissionChoiceKey({ id: " regular " }, { id: "sat" }, { id: "grant" }), "regular::sat::grant");
  assert.equal(admissionChoiceKey({}, {}, null), "");
});

test("category-only admission data produces a usable general choice", () => {
  const choices = getAdmissionChoicesFromCategories([
    null,
    {
      id: "direct",
      label: "Direct admission",
      requirements: { GPA: 3.2 },
      stats_avg: { GPA: 3.7, IELTS: 7 },
      funding_options: [{ id: "paid", funding_type: "paid", requirements: { GPA: 3.4 } }],
      scholarships: ["Merit"],
      program_names: ["Computer Science"],
    },
    {
      id: "general",
      label: "General",
      requirements: { SAT: 1200 },
    },
  ]);
  assert.equal(choices.length, 2);
  assert.equal(choices[0].requirement_profile_id, "general");
  assert.equal(choices[0].funding_option_id, "paid");
  assert.deepEqual(choices[0].requirements, { GPA: 3.4 });
  assert.deepEqual(choices[0].stats_avg, { GPA: 3.7 });
  assert.deepEqual(choices[0].scholarships, ["Merit"]);
  assert.equal(choices[1].id, "general::general");
  assert.equal(choices[1].__is_funding_option, false);
  assert.deepEqual(getAdmissionChoicesFromCategories({}), []);
});

test("profile funding options take precedence and grants are deduplicated", () => {
  const categories = [{
    id: "regular",
    funding_options: [{ id: "category-grant", funding_type: "grant", funding_program: "Ignored" }],
    requirement_profiles: [{
      id: "exam",
      requirements: { SAT: 1200 },
      funding_options: [
        { id: "grant-a", funding_type: "grant", funding_program: "Merit Grant", funding_source: "Official", funding_description: "Full tuition" },
        { id: "grant-b", funding_type: "grant", funding_program: "Merit Grant", description: "Duplicate" },
        { id: "paid", funding_type: "paid" },
      ],
    }],
  }];
  const choices = getAdmissionChoicesFromCategories(categories);
  assert.equal(choices.length, 3);
  const grants = getGrantsFromCategories(categories);
  assert.deepEqual(grants, [{
    id: "regular::exam::grant-a",
    name: "Merit Grant",
    source: "Official",
    description: "Full tuition",
    track_badge: "Grant",
  }]);
});

test("chance tones cover all public thresholds", () => {
  assert.equal(chanceTone(80).cls, "chance-high");
  assert.equal(chanceTone(60).cls, "chance-good");
  assert.equal(chanceTone(40).cls, "chance-medium");
  assert.equal(chanceTone(0).cls, "chance-low");
  assert.equal(chanceTone("invalid").cls, "chance-low");
});

test("chance summary distinguishes empty, missing evidence, selected, and estimated states", () => {
  setLanguage("eng", { persist: false, emit: false });
  const empty = renderUniChanceSummary(null);
  assert.match(empty, /chance-percent chance-low">\?</);
  assert.match(empty, /data-width-pct="0"/);

  const missing = renderUniChanceSummary({
    overallChance: null,
    reason: "missing_exam_score",
    bestChoiceLabel: "SAT route",
  });
  assert.match(missing, /Need exam data/);
  assert.match(missing, /SAT route/);

  const selected = renderUniChanceSummary({
    overallChance: 72,
    bestChoiceLabel: "Paid route",
    bestChoiceKey: "paid",
    recommendedChoiceLabel: "Grant route",
    recommendedChoiceKey: "grant",
    selectedByUser: true,
    chanceModel: "official_score_profile",
  });
  assert.match(selected, /Selected:/);
  assert.match(selected, /Recommended/);
  assert.match(selected, /Profile-based/);
  assert.match(selected, /data-width-pct="72"/);

  const estimated = renderUniChanceSummary({
    overallChance: "35",
    bestChoiceLabel: "General",
    chanceModel: "estimated_fallback",
  });
  assert.match(estimated, /Low confidence/);
  assert.match(estimated, /Estimated/);
  assert.match(estimated, /chance-percent-wrap--low-confidence/);
});

test("chance summary explains distinct no-data reasons", () => {
  assert.match(renderUniChanceSummary({ overallChance: "", reason: "requirements_not_met" }), /do not meet a required minimum/);
  assert.match(renderUniChanceSummary({ overallChance: null, reason: "missing_evidence" }), /Add the required exam scores/);
  assert.match(renderUniChanceSummary({ overallChance: null, label: "Custom unavailable reason" }), /Custom unavailable reason/);
});

test("track chance chips handle no data, invalid badges, and numeric zero", () => {
  assert.match(renderTrackChanceChip(null), /Admission probability/);
  assert.match(renderTrackChanceChip({ chancePercent: null, reason: "requirements_not_met" }), /required minimum/);
  assert.match(renderTrackChanceChip({ chancePercent: 0, badges: ["unknown", "need_aware_penalty"] }), /UniChance 0%/);
  assert.match(renderTrackChanceChip({ chancePercent: 0, badges: ["unknown", "need_aware_penalty"] }), /Need-aware aid/);
  assert.doesNotMatch(renderTrackChanceChip({ chancePercent: 0, badges: ["unknown"] }), /admission-chance-badge/);
});

test("factor rendering filters invalid rows and maps positive, negative, and neutral tones", () => {
  assert.equal(renderTrackFactors(null), "");
  const html = renderTrackFactors({ factors: [
    null,
    [],
    {},
    { key: "academic_strength", status: "positive", label: "Strong", message: "Ready" },
    { key: "academic_gap", status: "negative", label: "Gap", impact_text: "Improve" },
    { key: "custom", status: "other", message: "Review manually" },
  ] });
  assert.match(html, /factor-positive/);
  assert.match(html, /factor-negative/);
  assert.match(html, /factor-neutral/);
  assert.match(html, /Review manually/);
});

test("funding badges infer grant or paid semantics", () => {
  assert.equal(renderTrackFundingBadge(null), "");
  assert.match(renderTrackFundingBadge({ funding_type: "grant" }), /track-funding-badge--grant/);
  assert.match(renderTrackFundingBadge({ track_badge: "Merit Scholarship" }), /track-funding-badge--grant/);
  assert.match(renderTrackFundingBadge({ funding_type: "paid", track_badge: "Contract" }), /track-funding-badge--paid/);
  assert.equal(getTrackFundingType({ funding_type: "grant" }), "grant");
  assert.equal(getTrackFundingType({ funding_type: "paid" }), "paid");
  assert.equal(getTrackFundingType({ track_badge: "Scholarship" }), "grant");
  assert.equal(getTrackFundingType({}), "paid");
});

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

test("renderTrackChanceChip and renderTrackFactors render accessible ui-tooltip structure", () => {
  const badgeHtml = renderTrackChanceChip({
    chancePercent: 85,
    badges: ["need_blind"],
  });
  assert.match(badgeHtml, /class="ui-tooltip-wrap admission-chance-badge-wrap"/);
  assert.match(badgeHtml, /<button type="button" class="ui-tooltip-trigger admission-chance-badge/);
  assert.match(badgeHtml, /class="ui-tooltip-bubble admission-chance-tooltip__content" role="tooltip"/);

  const factorHtml = renderTrackFactors({
    factors: [
      {
        key: "academic_strength",
        status: "positive",
        label: "Academic strength",
        message: "Strong profile.",
      },
    ],
  });
  assert.match(factorHtml, /class="ui-tooltip-wrap track-factor-chip-wrap"/);
  assert.match(factorHtml, /<button type="button" class="ui-tooltip-trigger track-factor-chip factor-positive"/);
  assert.match(factorHtml, /class="ui-tooltip-bubble track-factor-tooltip__content" role="tooltip"/);
});
