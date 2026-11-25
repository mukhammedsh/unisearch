import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.window = globalThis.window || {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  setTimeout,
  clearTimeout,
};
globalThis.document = globalThis.document || {
  documentElement: { setAttribute() {} },
};
if (!globalThis.navigator?.languages) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { languages: ["en-US"], language: "en-US" },
  });
}
globalThis.localStorage = globalThis.localStorage || {
  getItem() { return null; },
  setItem() {},
};

const {
  compareBachelorProgramNames,
  compareProgramSummary,
  compareProgramTitle,
  compareSourceText,
  compareSourceMeta,
  compareExtraRequirementsText,
  compareAdmissionChoiceOptionLabel,
  compareRequirementsText,
  compareAverageScoreText,
  comparePublishedAdmission,
  compareSelectedAnnualCost,
  compareSelectedCostContext,
  hasReviewedAdmissions,
  fetchCompareStudyOptions,
  fetchCompareAdmissionContext,
  compareAdmissionOptionEntries,
  readCompareAdmissionChoices,
  compareStudyFormatCount,
  compareStudyFormatSource,
} = await import("../../frontend/javascript/pages/universities/compare-helpers.js");

const {
  buildCompareDecisionSupportHtml,
  buildCompareDecisionSignals,
  buildCompareSpecs,
  collectCompareExamKeys,
  compareAverageScoreValue,
  compareBestIdsForSpec,
  compareCell,
  compareCostContextsComparable,
  compareDataRow,
  compareFundingRequirementsText,
  compareLanguageRequirementValue,
  compareMetrics,
  compareOptionFundingDeltaPreview,
  comparePublishedAdmissionsComparable,
  compareRequirementValue,
  compareRowsHtml,
  compareSectionRow,
  compareSelectedAverageKeys,
  compareSelectedLanguageRequirementKeys,
  compareSelectedRequirementKeys,
  compareSlotLabel,
  compareSpecRawValue,
  compareSpecRows,
  compareSpecSections,
  compareSpecValue,
  compareTrackRequirementValues,
} = await import("../../frontend/javascript/pages/universities/compare-specs.js");
const { loadProfile, loadProfileForApi, normalizeProfileData, clearProfile } = await import("../../frontend/javascript/utils.js");

function response(body, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test("reviewed comparison does not reuse legacy choices, costs, or rates", async () => {
  const reviewed = {
    id: "mit-usa-cambridge", admissions_catalog: { availability: "reviewed" },
    finance: { total_cost_year_usd: 999 }, academics: { acceptance_rate_percent: 5 },
    admission_categories: [{ id: "old", requirement_profiles: [{ id: "old", requirements: { SAT: 1200 } }] }],
  };
  assert.equal(hasReviewedAdmissions(reviewed), true);
  assert.deepEqual(compareAdmissionOptionEntries(reviewed), []);
  assert.equal(compareSelectedAnnualCost(reviewed), null);
  assert.equal(comparePublishedAdmission(reviewed).value, null);
  assert.equal(compareSpecRawValue({ type: "number", section: "finance", getter: () => 999 }, reviewed), null);
});

test("comparison study options use search, canonical level and pagination without projecting legacy programs", async () => {
  const catalog = { items: [{ id: "program", title: "Computing" }], total: 805 };
  const result = await fetchCompareStudyOptions("reviewed", { search: "computing", study_level: "masters", page: 3 }, {
    apiBase: "/api", fetchImpl: async url => {
      const query = new URL(url, "https://example.test").searchParams;
      assert.equal(query.get("search"), "computing");
      assert.equal(query.get("study_level"), "masters");
      assert.equal(query.get("page"), "3");
      assert.equal(query.get("limit"), "24");
      return response(catalog);
    },
  });
  assert.deepEqual(result, catalog);
  await assert.rejects(fetchCompareStudyOptions("reviewed", {}, { fetchImpl: async () => response({}, false, 503) }), /HTTP 503/);
});

test("comparison context keeps explicit empty overrides and reports HTTP failures", async () => {
  const context = { study_option_id: "cs", application_route_id: "route", study_level: "undergraduate", intended_entry_cycle: "", fee_status_context: "unknown" };
  const profile = { study_level: "masters", intended_entry_cycle: "2027", selectedAdmissionChoices: { reviewed: { studyOptionId: "old", applicationRouteId: "old-route" } }, exams: [{ exam: "SAT", score: 1400 }] };
  const before = structuredClone(profile);
  const result = await fetchCompareAdmissionContext("reviewed", context, profile, { apiBase: "/api", fetchImpl: async (url, options) => {
    assert.equal(url, "/api/universities/reviewed/admissions-context");
    const body = JSON.parse(options.body);
    assert.equal(body.profile.study_level, undefined);
    assert.equal(body.profile.intended_entry_cycle, undefined);
    assert.equal(body.profile.selectedAdmissionChoices.reviewed, undefined);
    assert.equal(body.context.intended_entry_cycle, "");
    assert.ok(!("applicant_route" in body.context), "comparison never sends an applicant category");
    assert.deepEqual(body.profile.exams, profile.exams);
    return response({ assessment: { chancePercent: 0 } });
  } });
  assert.equal(result.assessment.chancePercent, 0);
  assert.deepEqual(profile, before);
  await assert.rejects(fetchCompareAdmissionContext("reviewed", context, profile, { fetchImpl: async () => response({}, false, 503) }), /HTTP 503/);
});

test("comparison storage removes old accepted choices including strings while retaining legacy choices", () => {
  const original = globalThis.localStorage;
  const originalWindowStorage = window.localStorage;
  const originalDispatch = window.dispatchEvent;
  const stored = new Map([["unisearch_compare_admission_choices_v1", JSON.stringify({ "mit-usa-cambridge": "old-key", "stanford-university-usa-ca": { choiceKey: "old-key" }, legacy: { choiceKey: "legacy-key" } })]]);
  globalThis.localStorage = window.localStorage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  const profile = normalizeProfileData({ budget: 31000, gpa: 3.6, applicantRoute: "transfer", intendedEntryCycle: "Fall 2028", feeStatusContext: "self_reported_international_overseas", selectedAdmissionChoices: { legacy: { choiceKey: "legacy-key", programId: "legacy-program" } } });
  stored.set("unisearch_profile", JSON.stringify(profile));
  window.dispatchEvent = () => { assert.deepEqual(JSON.parse(stored.get("unisearch_compare_admission_choices_v1")), { legacy: { choiceKey: "legacy-key" } }); };
  try {
    const choices = readCompareAdmissionChoices();
    assert.deepEqual(Array.from(choices.keys()), ["legacy"]);
    assert.equal(choices.get("legacy").choiceKey, "legacy-key");
    assert.deepEqual(JSON.parse(stored.get("unisearch_compare_admission_choices_v1")), { legacy: { choiceKey: "legacy-key" } });
    assert.deepEqual(JSON.parse(stored.get("unisearch_profile")).admissionChoiceResetNotices, ["mit-usa-cambridge", "stanford-university-usa-ca"]);
    assert.deepEqual({ ...JSON.parse(stored.get("unisearch_profile")), admissionChoiceResetNotices: [] }, profile);
    assert.equal(loadProfileForApi().admissionChoiceResetNotices, undefined);
  } finally { globalThis.localStorage = original; window.localStorage = originalWindowStorage; window.dispatchEvent = originalDispatch; }
});

test("blocked comparison reset persistence still discards old choices and exposes the notice for this session", () => {
  const original = { storage: globalThis.localStorage, windowStorage: window.localStorage, dispatch: window.dispatchEvent, warn: console.warn };
  const warnings = [];
  window.dispatchEvent = () => {};
  console.warn = message => warnings.push(message);
  globalThis.localStorage = window.localStorage = {
    getItem: key => key === "unisearch_compare_admission_choices_v1" ? JSON.stringify({ "imperial-college-london-uk": "old-key" }) : null,
    setItem: () => { throw new Error("Storage unavailable"); }, removeItem: () => {},
  };
  try {
    clearProfile();
    assert.equal(readCompareAdmissionChoices().size, 0);
    assert.deepEqual(loadProfile().admissionChoiceResetNotices, ["imperial-college-london-uk"]);
    assert.ok(warnings.some(message => message.includes("comparison selection reset")));
    assert.equal(loadProfileForApi().admissionChoiceResetNotices, undefined);
  } finally {
    clearProfile();
    globalThis.localStorage = original.storage; window.localStorage = original.windowStorage; window.dispatchEvent = original.dispatch; console.warn = original.warn;
  }
});

test("compareBachelorProgramNames deduplicates and formats program summary", () => {
  const uni = {
    id: "al-farabi-kazakh-national-university-kaz-almaty",
    academics: {
      programs: [
        { name: "Computer Science", study_levels: ["Bachelor"] },
        { name: "Computer Science", study_levels: ["Bachelor"] },
        { name: "Software Engineering", study_levels: ["Bachelor"] },
        { name: "Data Science", study_levels: ["Bachelor"] },
        { name: "Master of AI", study_levels: ["Master"] },
      ],
    },
  };

  const names = compareBachelorProgramNames(uni);
  assert.deepEqual(names, ["Computer Science", "Software Engineering", "Data Science"]);

  const summary = compareProgramSummary(uni);
  assert.equal(summary, "Computer Science, Software Engineering +1");

  const title = compareProgramTitle(uni);
  assert.equal(title, "Computer Science, Software Engineering, Data Science");
});

test("compareProgramSummary handles empty programs gracefully", () => {
  assert.equal(compareProgramSummary({}), "N/A");
  assert.equal(compareProgramTitle({}), "");
});

test("compareSourceText formats source and status", () => {
  const uni = {
    id: "mit-usa-cambridge",
    fact_provenance: {
      facts: {
        rank: {
          source: "QS World University Rankings 2026",
          status: "official",
        },
        acceptance_rate_percent: {
          source: "University Admissions reports & aggregated public statistical profiles",
          status: "official_aggregated",
        },
      },
    },
  };

  assert.equal(
    compareSourceText(uni, "rank"),
    "QS World University Rankings 2026 - Official"
  );
  assert.equal(
    compareSourceText(uni, "acceptance_rate_percent"),
    "University Admissions reports & aggregated public statistical profiles - Official Aggregated"
  );
});

test("compareExtraRequirementsText truncates with count", () => {
  const uni = {
    id: "oxford",
    admission_categories: [
      {
        requirement_profiles: [
          {
            extra_requirements: ["Motivation letter", "Interview", "Portfolio"],
          },
        ],
      },
    ],
  };

  const text = compareExtraRequirementsText(uni);
  assert.equal(text, "Motivation letter; Interview +1");
});

test("compareAdmissionChoiceOptionLabel formats clean and distinguishable labels", () => {
  const paidEntry = {
    option: {
      category_label: "UNT Admission",
      requirement_profile_label: "UNT",
      funding_type: "paid",
      label: "Paid Admission",
    },
  };
  const grantEntry = {
    option: {
      category_label: "UNT Admission",
      requirement_profile_label: "UNT",
      funding_type: "grant",
      funding_program: "State Educational Grant",
      label: "State Grant",
    },
  };
  const rectorEntry = {
    option: {
      category_label: "UNT Admission",
      requirement_profile_label: "UNT",
      funding_type: "grant",
      funding_program: "Rector Grant",
      label: "Profile - Rector Grant (Grant)",
    },
  };

  const uni = { id: "abai-kazakh-national-pedagogical-university-kaz-almaty" };

  assert.equal(compareAdmissionChoiceOptionLabel(paidEntry, uni), "UNT · Paid");
  assert.equal(compareAdmissionChoiceOptionLabel(grantEntry, uni), "UNT · State Grant");
  assert.equal(compareAdmissionChoiceOptionLabel(rectorEntry, uni), "UNT · Rector Grant");
});

test("formatExamValue formats GPA on 4.0 and 5.0 scales explicitly without percent", async () => {
  const { formatExamValue } = await import("../../frontend/javascript/utils.js");
  for (const score of [null, undefined, "", "  "]) assert.equal(formatExamValue("GPA", score), "");
  assert.equal(formatExamValue("GPA", 0), "0 (/4.0)");
  assert.equal(formatExamValue("GPA", 3.8), "3.8 (/4.0)");
  assert.equal(formatExamValue("GPA", 4), "4 (/4.0)");
  assert.equal(formatExamValue("GPA", 4.75, { scale: 5 }), "4.75 (/5.0)");
  assert.equal(formatExamValue("GPA", 4.85), "4.85 (/5.0)");
  assert.equal(formatExamValue("GPA", 3.8, { includeScale: false }), "3.8");
});

test("getExamDisplayName localizes exam subjects and language exam sections in Russian", async () => {
  const { getExamDisplayName } = await import("../../frontend/javascript/utils/config.js");

  assert.equal(getExamDisplayName("SAT_MATH", { locale: "rus" }), "SAT: математика");
  assert.equal(getExamDisplayName("AP_CALCULUS_AB", { locale: "rus" }), "AP: математический анализ AB");
  assert.equal(getExamDisplayName("IELTS_LISTENING", { locale: "rus" }), "IELTS: аудирование");
  assert.equal(getExamDisplayName("TOEFL_iBT_0_120_WRITING", { locale: "rus" }), "TOEFL iBT: письмо");
});

test("compareRequirementsText and compareAverageScoreText format GPA with scale", () => {
  const uni = {
    id: "test-uni",
    admission_categories: [
      {
        id: "cat1",
        requirements: { GPA: 3.5, SAT: 1400 },
        stats_avg: { GPA: 3.85, SAT: 1480 },
        requirement_profiles: [
          {
            id: "prof1",
            requirements: { GPA: 3.5, SAT: 1400 },
            stats_avg: { GPA: 3.85, SAT: 1480 },
          },
        ],
      },
    ],
  };

  const reqText = compareRequirementsText(uni);
  assert.match(reqText, /GPA 3\.5 \(\/4\.0\)/);
  assert.match(reqText, /SAT 1400/);

  const avgText = compareAverageScoreText(uni);
  assert.match(avgText, /GPA 3\.85 \(\/4\.0\)/);
  assert.match(avgText, /SAT 1480/);
});

test("published admission prefers the selected course-specific choice", () => {
  const university = {
    id: "u-1",
    academics: {
      acceptance_rate_percent: 20,
      admissions: {
        university_wide: {
          acceptance_rate_percent: 20,
          counts: { cycle: "2025" },
          provenance: { source: "Institution source", source_url: "https://example.edu/all" },
        },
      },
    },
    admission_categories: [{
      id: "course",
      label: "Course",
      published_admission: {
        rate_percent: 7,
        scope: "program",
        audience: "all",
        cycle: "2023-25",
        source: "Course source",
        source_url: "https://example.edu/course",
      },
      requirement_profiles: [{ id: "sat", label: "SAT", requirements: { SAT: 1400 } }],
    }],
  };

  const admission = comparePublishedAdmission(university);
  assert.equal(admission.value, 7);
  assert.equal(admission.scope, "program");
  assert.equal(admission.cycle, "2023-25");
});

test("cost comparison requires the same year and fee status", () => {
  assert.equal(compareCostContextsComparable([
    { min: 50000, academicYear: "2026-27", feeStatus: "international" },
    { min: 70000, academicYear: "2026-27", feeStatus: "international" },
  ]), true);
  assert.equal(compareCostContextsComparable([
    { min: 50000, academicYear: "2026-27", feeStatus: "international" },
    { min: 70000, academicYear: "2027-28", feeStatus: "international" },
  ]), false);
});

test("published admission with different scope or cycle is incomparable", () => {
  const course = { value: 7, scope: "program", audience: "all", cycle: "2023-25" };
  const institution = { value: 4.18, scope: "institution", audience: "all", cycle: "Class of 2028" };
  assert.equal(comparePublishedAdmissionsComparable([course, institution]), false);
  assert.equal(comparePublishedAdmissionsComparable([institution, course]), false);
});

test("neutral rank and program counts never create winners", () => {
  const universities = [
    { id: "oxford", rank: 4, academics: { programs: [{ name: "Computer Science" }] } },
    { id: "harvard", rank: 5, academics: { programs: [{ name: "Computer Science" }, { name: "Economics" }] } },
  ];
  const specs = buildCompareSpecs(universities);
  for (const key of ["rank", "program_count", "major_tags", "study_formats"]) {
    const spec = specs.find((row) => row.key === key);
    if (spec) assert.deepEqual([...compareBestIdsForSpec(universities, spec)], []);
  }
});

test("missing values, ties, and university order do not create a winner", () => {
  const spec = { key: "verified", type: "number", direction: "higher", getter: (u) => u.value };
  assert.deepEqual([...compareBestIdsForSpec([{ id: "a", value: 10 }, { id: "b" }], spec)], []);
  assert.deepEqual([...compareBestIdsForSpec([{ id: "a", value: 10 }, { id: "b", value: 10 }], spec)], []);
  assert.deepEqual([...compareBestIdsForSpec([{ id: "b", value: 10 }, { id: "a", value: 10 }], spec)], []);
});

test("selected finance context keeps structured range and provenance", () => {
  const university = {
    id: "u-cost",
    finance: { total_cost_year_usd: 10000, currency: "USD" },
    admission_categories: [{
      id: "course",
      label: "Course",
      finance_override: {
        total_cost_year_usd: 20000,
        total_cost_year_min: 20000,
        total_cost_year_max: 24000,
        currency: "GBP",
        academic_year: "2027-28",
        fee_status: "overseas",
        source_url: "https://example.edu/cost",
      },
      requirement_profiles: [{ id: "sat", label: "SAT" }],
    }],
  };
  const context = compareSelectedCostContext(university);
  assert.equal(context.min, 20000);
  assert.equal(context.max, 24000);
  assert.equal(context.currency, "GBP");
  assert.equal(context.academicYear, "2027-28");
});

test("compareSourceMeta and compareSourceText support early_career_salary and median_earnings_10yr", () => {
  const uni = {
    id: "mit-usa-cambridge",
    outcomes: { early_career_salary_usd: 98741 },
    fact_provenance: {
      facts: {
        early_career_salary: {
          value: 98741,
          source: "MIT Graduating Student Survey 2019",
          source_url: "https://ir.mit.edu/gss",
          verified_at: "2026-03-31",
          status: "official",
        },
        median_earnings_10yr: {
          value: 128566,
          source: "U.S. Department of Education College Scorecard",
          source_url: "https://collegescorecard.ed.gov/",
          verified_at: "2026-03-30",
          status: "official",
        },
      },
    },
  };

  const earlyMeta = compareSourceMeta(uni, "early_career_salary");
  assert.equal(earlyMeta.url, "https://ir.mit.edu/gss");
  assert.equal(earlyMeta.verifiedAt, "2026-03-31");
  assert.equal(compareSourceText(uni, "early_career_salary"), "MIT Graduating Student Survey 2019 - Official");

  const medianMeta = compareSourceMeta(uni, "median_earnings_10yr");
  assert.equal(medianMeta.url, "https://collegescorecard.ed.gov/");
  assert.equal(compareSourceText(uni, "median_earnings_10yr"), "U.S. Department of Education College Scorecard - Official");
});

test("outcomes distinguish legacy salary periods and exclude accepted institution-wide aliases", async () => {
  const mit = {
    id: "mit-usa-cambridge",
    name: "MIT",
    outcomes: { early_career_salary_usd: 98741 },
    fact_provenance: {
      facts: {
        early_career_salary: {
          source: "MIT GSS 2019",
          source_url: "https://ir.mit.edu/gss",
          verified_at: "2026-03-31",
          status: "official",
        },
      },
    },
  };
  const caltech = {
    id: "caltech-usa-pasadena",
    name: "Caltech",
    outcomes: { median_earnings_10yr_usd: 128566 },
    fact_provenance: {
      facts: {
        median_earnings_10yr: {
          source: "College Scorecard",
          source_url: "https://collegescorecard.ed.gov/",
          verified_at: "2026-03-30",
          status: "official",
        },
      },
    },
  };
  const stanford = {
    id: "stanford-university-usa-ca",
    name: "Stanford University",
    outcomes: {},
    fact_provenance: { facts: {} },
  };

  const legacyEarly = { ...mit, id: "legacy-early" };
  const signals = buildCompareDecisionSignals([mit, caltech, stanford, legacyEarly]);
  const outcomesTheme = signals.find((s) => s.key === "outcomes");
  assert.ok(outcomesTheme);
  assert.equal(outcomesTheme.status, "missing"); // Not all have early salary

  const mitFacts = outcomesTheme.universities.find((u) => u.id === "mit-usa-cambridge").facts;
  assert.equal(mitFacts[0].label, "Verified early-career salary");
  assert.equal(mitFacts[0].value, "N/A");
  const legacyEarlyFacts = outcomesTheme.universities.find((u) => u.id === "legacy-early").facts;
  assert.equal(legacyEarlyFacts[0].label, "Verified early-career salary");
  assert.equal(legacyEarlyFacts[0].value, "$98,741");

  const caltechFacts = outcomesTheme.universities.find((u) => u.id === "caltech-usa-pasadena").facts;
  assert.equal(caltechFacts[0].label, "10-year post-entry median earnings (Scorecard)");
  assert.equal(caltechFacts[0].value, "$128,566");

  const stanfordFacts = outcomesTheme.universities.find((u) => u.id === "stanford-university-usa-ca").facts;
  assert.equal(stanfordFacts[0].label, "Verified early-career salary");
  assert.equal(stanfordFacts[0].value, "N/A");
});

function richUniversity(id, overrides = {}) {
  return {
    id,
    name: id === "alpha" ? "Alpha University" : "Beta University",
    rank: id === "alpha" ? 20 : 35,
    location: { city: "City", country: "Country" },
    academics: {
      acceptance_rate_percent: id === "alpha" ? 25 : 30,
      study_modes: ["On-campus", "Online"],
      programs: [
        { name: "Computer Science", study_levels: ["Bachelor"], languages: ["English"], major_tags: ["AI", "Systems"] },
        { name: "Economics", study_levels: ["Bachelor"], languages: ["English"] },
      ],
      undergraduate_structure: { model: "Liberal arts", flexibility: "High", source: "Official curriculum" },
      admissions: {
        university_wide: {
          acceptance_rate_percent: id === "alpha" ? 25 : 30,
          counts: { cycle: "2025" },
          provenance: { source: "Admissions report", source_url: `https://${id}.example/admissions`, verified_at: "2026-01-01" },
        },
      },
    },
    finance: {
      total_cost_year_usd: id === "alpha" ? 30000 : 35000,
      total_cost_year_min: id === "alpha" ? 28000 : 34000,
      total_cost_year_max: id === "alpha" ? 32000 : 36000,
      currency: "USD",
      academic_year: "2026-27",
      fee_status: "international",
      costs_breakdown_year_usd: { Tuition: 20000, Housing: 10000 },
      financial_aid: { need_blind: id === "alpha", source: "Aid office", source_url: `https://${id}.example/aid` },
    },
    admission_categories: [{
      id: "regular",
      label: "Regular admission",
      published_admission: { rate_percent: id === "alpha" ? 25 : 30, scope: "institution", audience: "all", cycle: "2025" },
      requirement_profiles: [{
        id: "sat",
        label: "SAT route",
        requirements: { SAT: id === "alpha" ? 1300 : 1250, GPA: 3.5 },
        stats_avg: { SAT: id === "alpha" ? 1450 : 1400, GPA: 3.8 },
        score_profile: { exam_id: "SAT", compatible_exam_ids: ["ACT"], median_raw: id === "alpha" ? 1450 : 1400 },
        language_requirements: [{ code: "en", requirements: { IELTS: id === "alpha" ? 7 : 6.5 } }],
        extra_requirements: ["Essay", "Recommendation"],
        funding_options: [
          { id: "paid", funding_type: "paid", requirements: { SAT: 1300 } },
          { id: "grant", funding_type: "grant", funding_program: "Merit Grant", funding_source: "Aid office", requirements: { SAT: 1450 }, funding_requirements: { SAT: 1450 } },
        ],
      }],
    }],
    outcomes: { early_career_salary_usd: id === "alpha" ? 70000 : 68000 },
    fact_provenance: {
      facts: {
        rank: { source: "Ranking", source_url: `https://${id}.example/rank`, verified_at: "2026-01-01", status: "official" },
        early_career_salary: { source: "Outcomes", source_url: `https://${id}.example/outcomes`, verified_at: "2026-01-01", status: "official" },
      },
    },
    ...overrides,
  };
}

test("compare admission key collectors use selected published averages without substituting score medians", () => {
  const university = richUniversity("alpha");
  assert.deepEqual(compareTrackRequirementValues(university, "SAT"), [1300]);
  assert.equal(compareRequirementValue(university, "SAT"), 1300);
  assert.equal(compareAverageScoreValue(university, "SAT"), 1450);
  assert.equal(compareAverageScoreValue(university, "ACT"), null);
  assert.equal(compareLanguageRequirementValue(university, "IELTS"), 7);
  assert.deepEqual(compareSelectedRequirementKeys(university).sort(), ["GPA", "SAT"]);
  assert.deepEqual(compareSelectedAverageKeys(university).sort(), ["GPA", "SAT"]);
  assert.deepEqual(compareSelectedLanguageRequirementKeys(university), ["IELTS"]);
  assert.deepEqual(collectCompareExamKeys([university, richUniversity("beta")], compareSelectedRequirementKeys).sort(), ["GPA", "SAT"]);

  const medianOnly = richUniversity("median-only", {
    admission_categories: [{
      id: "regular",
      requirement_profiles: [{
        id: "sat",
        score_profile: { exam_id: "SAT", median_raw: 1500 },
      }],
    }],
  });
  assert.equal(compareAverageScoreValue(medianOnly, "SAT"), null);
  assert.deepEqual(compareSelectedAverageKeys(medianOnly), []);
});

test("grant option delta describes stricter cutoffs and non-grants stay neutral", () => {
  const entries = [
    { key: "paid", option: { category_id: "regular", requirement_profile_id: "sat", funding_type: "paid", requirements: { SAT: 1300 } } },
    { key: "grant", option: { category_id: "regular", requirement_profile_id: "sat", funding_type: "grant", requirements: { SAT: 1450 }, funding_requirements: { SAT: 1450 } } },
  ];
  assert.equal(compareOptionFundingDeltaPreview(entries[0], entries), "");
  assert.match(compareOptionFundingDeltaPreview(entries[1], entries), /SAT 1450.*1300/);
  assert.match(compareFundingRequirementsText(richUniversity("alpha")), /N\/A|Merit|SAT/);
});

test("compare specs produce complete rows, metrics, sources, and accessible table markup", () => {
  const universities = [richUniversity("alpha"), richUniversity("beta")];
  const specs = buildCompareSpecs(universities);
  assert.ok(specs.length > 20);
  assert.ok(Object.keys(compareSpecSections()).includes("finance"));
  assert.match(compareSlotLabel(0), /1/);

  const metrics = compareMetrics(universities);
  assert.equal(metrics.specs.length, specs.length);
  const rowsHtml = compareRowsHtml(universities, metrics);
  assert.match(rowsHtml, /compare-table__section-row/);
  assert.match(rowsHtml, /data-row-section="finance"/);
  assert.match(rowsHtml, /compare-source-link/);

  const costSpec = specs.find((spec) => spec.key === "total_cost");
  const costRows = compareSpecRows(universities, costSpec);
  assert.equal(costRows.length, 2);
  const cell = compareSpecValue(costSpec, universities[0], metrics);
  assert.ok(cell.text);
  assert.ok(["", "best"].includes(cell.tone));
  assert.match(compareCell("Value", { tone: "best", sub: "Context", title: "Title" }), /compare-cell--best/);
  assert.match(compareCell("Value", { subHtml: "<small>Safe</small>" }), /<small>Safe<\/small>/);
  assert.match(compareCell(""), /compare-cell--empty/);
  assert.match(compareCell("N/A"), /<span>—<\/span>/);
  assert.match(compareSectionRow("Finance", "finance", universities), /colspan="3"/);
  assert.match(compareDataRow("Same", universities, () => "Equal", "context"), /compare-row--identical/);
  assert.match(compareDataRow("Same", universities, () => "Equal", "context"), /<th scope="row">Same<\/th>/);
});

test("spec comparison rejects unsafe, tied, immaterial, and incomparable winners", () => {
  const universities = [{ id: "a", value: 100 }, { id: "b", value: 95 }];
  assert.equal(compareSpecRawValue({ type: "number", getter: () => { throw new Error("bad"); } }, universities[0]), null);
  assert.equal(compareSpecRawValue({ type: "boolean", getter: () => 1 }, universities[0]), true);
  assert.deepEqual([...compareBestIdsForSpec(universities, { type: "number", direction: "higher", getter: (u) => u.value, materiality: 0.1 })], []);
  assert.deepEqual([...compareBestIdsForSpec(universities, { type: "number", direction: "sideways", getter: (u) => u.value })], []);
  assert.deepEqual([...compareBestIdsForSpec(universities, { type: "number", direction: "higher", reason: false, getter: (u) => u.value })], []);
  assert.deepEqual([...compareBestIdsForSpec(universities, { type: "number", direction: "higher", getter: (u) => u.value, comparable: () => false })], []);
  assert.deepEqual([...compareBestIdsForSpec(universities, { type: "number", direction: "lower", getter: (u) => u.value })], ["b"]);
});

test("comparison context validators reject missing fields and accept normalized matches", () => {
  assert.equal(compareCostContextsComparable(null), false);
  assert.equal(compareCostContextsComparable([{ min: 1 }]), false);
  assert.equal(compareCostContextsComparable([{ min: 1, academicYear: "2026", feeStatus: "intl" }, { min: null, academicYear: "2026", feeStatus: "intl" }]), false);
  assert.equal(compareCostContextsComparable([{ min: 1, academicYear: " 2026 ", feeStatus: "INTL" }, { min: 2, academicYear: "2026", feeStatus: "intl" }]), true);
  assert.equal(comparePublishedAdmissionsComparable(null), false);
  assert.equal(comparePublishedAdmissionsComparable([{ value: 1 }]), false);
  assert.equal(comparePublishedAdmissionsComparable([
    { value: 1, scope: " Program ", audience: "ALL", cycle: "2025" },
    { value: 2, scope: "program", audience: "all", cycle: "2025" },
  ]), true);
});

test("decision support shows published selectivity and requirements separately", () => {
  const universities = [richUniversity("alpha"), richUniversity("beta")];
  const context = {
    choices: new Map([["alpha", { choiceKey: "grant" }]]),
  };
  const themes = buildCompareDecisionSignals(universities, context);
  assert.deepEqual(themes.map((theme) => theme.key), ["admissions", "finance", "academics", "outcomes"]);
  assert.match(themes[0].universities[0].facts[0].label, /Published selectivity/);
  assert.match(themes[0].universities[0].facts[1].label, /Requirements/);
  assert.doesNotMatch(JSON.stringify(themes[0]), /Requirements fit score/);
  assert.equal(themes[1].status, "tradeoff");
  assert.equal(themes[2].status, "tradeoff");
  assert.equal(themes[3].status, "tradeoff");

  const html = buildCompareDecisionSupportHtml(universities, context);
  assert.match(html, /What matters for your choice/);
  assert.match(html, /data-theme-key="finance"/);
  assert.match(html, /target="_blank"/);
});

test("decision support classifies absent rates and costs as missing rather than zero", () => {
  const withoutData = [
    richUniversity("alpha", { academics: {}, finance: {}, admission_categories: [] }),
    richUniversity("beta", { academics: {}, finance: {}, admission_categories: [] }),
  ];
  const themes = buildCompareDecisionSignals(withoutData);
  assert.equal(themes.find((theme) => theme.key === "admissions").status, "missing");
  assert.equal(themes.find((theme) => theme.key === "finance").status, "missing");
});

test("selected annual cost preserves explicit zero but rejects an empty finance fallback", () => {
  assert.equal(compareSelectedAnnualCost({ finance: {} }), null);
  assert.equal(compareSelectedAnnualCost({ finance: { total_cost_year_usd: 0 } }), 0);
});

test("graduate comparison costs do not borrow the undergraduate university budget", () => {
  const university = {
    id: "graduate-cost-test",
    finance: { total_cost_year_usd: 50000 },
    admission_categories: [{
      id: "graduate-route",
      study_levels: ["Master"],
      requirement_profiles: [{ id: "standard", label: "Master application" }],
    }],
  };
  assert.equal(compareSelectedAnnualCost(university), null);
  university.admission_categories[0].finance_override = { total_cost_year_usd: null };
  assert.equal(compareSelectedAnnualCost(university), null);
  university.admission_categories[0].finance_override = { total_cost_year_usd: 0 };
  assert.equal(compareSelectedAnnualCost(university), 0);
});

test("study formats are compared only when an official formats source is linked", () => {
  const formats = ["On-campus", "Hybrid"];
  assert.equal(compareStudyFormatCount({ academics: { formats } }), null);
  assert.equal(compareStudyFormatCount({ academics: { formats }, verified_sources: [{ topic: "requirements", url: "https://example.edu/r" }] }), null);
  const university = { academics: { formats }, verified_sources: [
    { topic: "formats", url: "https://example.edu/f", title: "Programmes", scope: "Undergraduate", checked_at: "2026-11-20" },
  ] };
  assert.equal(compareStudyFormatCount(university), 2);
  assert.deepEqual(compareStudyFormatSource(university),
    { source: "Programmes", sourceUrl: "https://example.edu/f", verifiedAt: "2026-11-20", scope: "Undergraduate" });
});
