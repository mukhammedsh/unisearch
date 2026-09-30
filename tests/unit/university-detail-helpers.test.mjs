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
const { loadProfile, saveProfile } = await import("../../frontend/javascript/utils/persistence.js");
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

test("a route without published minimums explains the unavailable percentage once", () => {
  const assessment = {
    scoreMeaning: "published_requirements_met_percent", chancePercent: null,
    reason: "no_published_requirements",
    factors: [{ key: "insufficient_data", status: "neutral" }],
  };
  setLanguage("eng");
  assert.match(renderTrackChanceChip(assessment), /no measurable published minimums/);
  assert.doesNotMatch(renderTrackChanceChip(assessment), /profile evidence/);
  assert.equal(renderTrackFactors(assessment), "");
  setLanguage("rus");
  assert.match(renderTrackChanceChip(assessment), /нет опубликованных измеримых минимумов/);
  setLanguage("eng");
});

const {
  getFinanceChoicesForStudyLevel,
  getFinanceForChoice,
  getAdmissionContextProfile,
  renderAdmissionSection,
  renderDeadlinesTabSection,
  renderFinanceSection,
  resolveFeeStatusAndAid,
  selectAdmissionProgram,
} = await import("../../frontend/javascript/pages/university/render-sections.js");
const { renderOverviewSection } = await import("../../frontend/javascript/pages/university/render-content.js");

test("finance choices follow the selected degree level", () => {
  const categories = [
    { id: "ug", label: "Undergraduate", study_levels: ["Bachelor"] },
    { id: "msc", label: "Master of Finance", study_levels: ["Master"] },
    { id: "mba", label: "Full-Time MBA", study_levels: ["Master"] },
  ];
  assert.deepEqual(getFinanceChoicesForStudyLevel(categories, "MBA").map((choice) => choice.category_id), ["mba"]);
  assert.deepEqual(getFinanceChoicesForStudyLevel(categories, "Bachelor").map((choice) => choice.category_id), ["ug"]);
  assert.equal(getFinanceChoicesForStudyLevel(categories, "Any").length, 3);
  const baseFinance = { total_cost_year_usd: 85960, currency: "USD" };
  assert.equal(getFinanceForChoice(getFinanceChoicesForStudyLevel(categories, "MBA")[0], baseFinance), null);
  assert.deepEqual(getFinanceForChoice(getFinanceChoicesForStudyLevel(categories, "Bachelor")[0], baseFinance), baseFinance);
});

test("manual program context overrides a stale camel-case profile choice without changing saved profile or requested cycle", () => {
  window.location.search = "?admission_program=graduate-physics&admission_level=bachelor&admission_route=first_year";
  const savedProfile = {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
    intendedEntryCycle: "Fall 2027",
    selectedAdmissionChoices: { test_university: { programId: "undergraduate-cs", choiceKey: "old-choice" } },
  };
  const university = {
    id: "test_university",
    academics: { programs: [{ id: "graduate-physics", name: "Physics PhD", study_level: "Doctorate" }] },
    admission_categories: [{
      id: "physics-route",
      label: "Physics PhD",
      scope: "program",
      study_level: "Doctorate",
      applicant_route: "graduate",
      cycle: "Fall 2028",
      program_ids: ["graduate-physics"],
    }],
  };

  const requestProfile = getAdmissionContextProfile(university, savedProfile);
  assert.equal(requestProfile.study_level, "Doctorate");
  assert.equal(requestProfile.applicant_route, "graduate");
  assert.equal(requestProfile.intended_entry_cycle, "Fall 2027");
  assert.equal(requestProfile.studyLevel, "Doctorate");
  assert.equal(requestProfile.applicantRoute, "graduate");
  assert.equal(requestProfile.intendedEntryCycle, "Fall 2027");
  assert.deepEqual(requestProfile.selectedAdmissionChoices.test_university, { programId: "graduate-physics" });
  assert.equal(savedProfile.studyLevel, "Bachelor");
  assert.equal(savedProfile.applicantRoute, "first_year");
  assert.equal(savedProfile.intendedEntryCycle, "Fall 2027");
  assert.equal(savedProfile.selectedAdmissionChoices.test_university.programId, "undergraduate-cs");
  window.location.search = "";
});

test("cycle context keeps equivalent requested values selected and labels only proven mismatches", () => {
  const university = {
    id: "cycle_context_test",
    admission_categories: [
      { id: "fall", label: "Fall route", scope: "general", study_level: "Bachelor", applicant_route: "first_year", cycle: "2027 Fall entry" },
      { id: "spring", label: "Spring route", scope: "general", study_level: "Bachelor", applicant_route: "first_year", cycle: "Spring 2027 entry" },
    ],
  };
  const render = (cycle) => {
    window.location.search = `?admission_cycle=${encodeURIComponent(cycle)}`;
    const container = { innerHTML: "", querySelectorAll: () => [], querySelector: () => null };
    renderAdmissionSection({ annualCostForTrack: () => null, container, university });
    return container.innerHTML;
  };

  const equivalent = render("Fall 2027");
  assert.match(equivalent, /<option value="Fall 2027" selected>Fall 2027<\/option>/);
  assert.doesNotMatch(equivalent, /Fall 2027 \(does not match listed cycle data\)/);
  assert.match(equivalent, /2027 Fall entry/);

  const mismatch = render("Fall 2028");
  assert.match(mismatch, /<option value="Fall 2028" selected>Fall 2028 \(does not match listed cycle data\)<\/option>/);
  window.location.search = "";
});

test("legacy scoped categories are treated as bachelor while unscoped categories stay unknown", () => {
  const categories = [
    { id: "princeton-first-year", scope: "program_group", label: "First-Year Admission" },
    { id: "legacy-general", scope: "general", label: "General" },
    { id: "legacy-program", scope: "program", label: "Program route" },
    { id: "unscoped", label: "Unclassified route" },
    { id: "graduate", study_levels: ["Master"] },
  ];

  assert.deepEqual(
    getFinanceChoicesForStudyLevel(categories, "Bachelor").map((choice) => choice.category_id),
    ["princeton-first-year", "legacy-general", "legacy-program"],
  );
  assert.deepEqual(
    getFinanceChoicesForStudyLevel(categories, "Master").map((choice) => choice.category_id),
    ["graduate"],
  );
});

test("need-blind status does not imply full need coverage or zero loans", () => {
  setLanguage("eng", { persist: false, emit: false });
  const result = resolveFeeStatusAndAid({
    university: { finance: { financial_aid: { need_blind: true, basis: "need" } } },
    profile: { studyLevel: "Bachelor" },
  });

  assert.equal(result.aidBadge, "Need-Blind Undergraduate Admission");
  assert.doesNotMatch(result.aidDescription, /100%|loan/i);
  assert.deepEqual(result.thresholds, []);
  assert.equal(resolveFeeStatusAndAid({
    university: { finance: { financial_aid: { need_blind: true, basis: "need" } } },
    profile: { studyLevel: "Master" },
  }).aidBadge, "");

  const confirmedCoverage = resolveFeeStatusAndAid({
    university: {
      finance: {
        financial_aid: {
          need_blind: true,
          basis: "need",
          meets_full_demonstrated_need: true,
          zero_loans_policy: true,
        },
      },
    },
    profile: { studyLevel: "Bachelor" },
  });
  assert.ok(confirmedCoverage.thresholds.some((item) => item.label === "Full demonstrated need met"));
  assert.ok(confirmedCoverage.thresholds.some((item) => item.label === "Aid packages without loans"));
});

test("uncatalogued aid and unknown costs are described accurately in English and Russian", () => {
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const scholarshipContainer = { innerHTML: "" };
  const priceEl = { innerHTML: "" };
  const university = {
    finance: { currency: "USD", total_cost_year_usd: null, financial_aid: { need_based: true } },
    admission_categories: [{
      id: "bachelor-route",
      label: "Undergraduate route",
      scope: "program_group",
      funding_options: [{
        id: "paid-option",
        label: "Self-funded",
        funding_type: "paid",
        finance_override: { currency: "USD", total_cost_year_usd: null },
      }],
    }],
  };

  for (const [language, expected] of [
    ["eng", "No grant options are catalogued here"],
    ["ru", "В каталоге нет вариантов грантов"],
  ]) {
    setLanguage(language, { persist: false, emit: false });
    renderFinanceSection({
      annualCostForTrack: () => null,
      container,
      priceEl,
      scholarshipContainer,
      university,
    });
    assert.ok(scholarshipContainer.innerHTML.includes(expected));
    assert.doesNotMatch(priceEl.innerHTML, /\$0(?:\.00)?/);
    assert.ok(!container.innerHTML.includes("$0.00"));
  }
});

test("a single scoped published range keeps its currency in the summary and finance option", () => {
  setLanguage("eng", { persist: false, emit: false });
  const summaryLabels = {
    ".price-header": { textContent: "" },
    ".price-context": { textContent: "" },
  };
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const priceEl = {
    innerHTML: "",
    textContent: "",
    closest: () => ({ querySelector: (selector) => summaryLabels[selector] }),
  };
  const university = {
    finance: {
      currency: "USD",
      total_cost_year_range: { min: 95134, max: 100134, currency: "USD", academic_year: "2026-27" },
      scope: "Harvard College undergraduate cost of attendance; domestic and international applicants",
    },
    admission_categories: [{
      id: "college",
      label: "Harvard College Undergraduate",
      study_level: "Bachelor",
      scope: "undergraduate_general",
      requirement_profiles: [{
        id: "college-profile",
        label: "General",
        funding_options: [
          { id: "paid", label: "Standard", funding_type: "paid" },
          { id: "grant", label: "Need-based Aid", funding_type: "grant", funding_program: "Need-based Aid" },
        ],
      }],
    }],
  };

  renderFinanceSection({
    annualCostForTrack: () => null,
    container,
    priceEl,
    university,
  });

  assert.equal(priceEl.textContent, "$95,134–$100,134");
  assert.equal(summaryLabels[".price-header"].textContent, "Published annual cost range");
  assert.match(summaryLabels[".price-context"].textContent, /2026-27/);
  assert.match(container.innerHTML, /\$95,134–\$100,134/);
  assert.match(container.innerHTML, /Harvard College undergraduate cost of attendance/);
  assert.match(container.innerHTML, /Estimated cost before aid/);
});

test("published MBAn tuition is shown as gross tuition for paid and fellowship options", () => {
  setLanguage("eng", { persist: false, emit: false });
  const profileKey = "unisearch_profile";
  const previousProfile = localStorage.getItem(profileKey);
  localStorage.setItem(profileKey, JSON.stringify({ studyLevel: "Master" }));
  window.location.search = "?admission_program=sloan-mban";
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const priceEl = { innerHTML: "", textContent: "" };
  const university = {
    id: "mit-usa-cambridge",
    finance: { currency: "USD", scholarships_and_funding: [] },
    academics: { programs: [{
      course_number: "Sloan MBAn",
      id: "sloan-mban",
      name: "Master of Business Analytics (MBAn)",
      tuition_year_usd: 96884,
      currency: "USD",
      tuition_cycle: "2026-27 published annual tuition, excluding summer tuition subsidy; 2027 entry rate not yet stated",
      tuition_source_url: "https://mitsloan.mit.edu/master-of-business-analytics/admissions/tuition-and-financial-aid",
    }] },
    admission_categories: [{
      id: "mit_sloan_mban_admissions",
      label: "MIT Sloan Master of Business Analytics (MBAn)",
      scope: "program",
      study_level: "Master",
      program_ids: ["Sloan MBAn"],
      requirement_profiles: [{
        id: "mit_sloan_mban_profile",
        label: "MBAn Applicant Profile",
        funding_options: [
          { id: "paid", label: "Self-funded", funding_type: "paid" },
          { id: "merit", label: "MBAn Merit Fellowship", funding_type: "grant" },
        ],
      }],
    }],
  };

  try {
    renderFinanceSection({ annualCostForTrack: () => null, container, priceEl, university });
    assert.equal((container.innerHTML.match(/\$96,884/g) || []).length, 4);
    assert.match(container.innerHTML, /Published gross tuition for 2026.{0,2}27/);
    assert.match(container.innerHTML, /potential awards are not deducted/);
    assert.equal((container.innerHTML.match(/Published tuition \/ year/g) || []).length, 2);
    assert.doesNotMatch(container.innerHTML, /Estimated cost before aid|Total \/ year/);
    assert.match(container.innerHTML, /master-of-business-analytics\/admissions\/tuition-and-financial-aid/);
    assert.doesNotMatch(container.innerHTML, /\$74,884/);
    assert.doesNotMatch(priceEl.innerHTML, /\$96,884/);

    setLanguage("ru", { persist: false, emit: false });
    container.innerHTML = "";
    renderFinanceSection({ annualCostForTrack: () => null, container, priceEl, university });
    assert.equal((container.innerHTML.match(/Опубликованная плата за обучение \/ год/g) || []).length, 2);
  } finally {
    window.location.search = "";
    if (previousProfile === null) localStorage.removeItem(profileKey);
    else localStorage.setItem(profileKey, previousProfile);
    setLanguage("eng", { persist: false, emit: false });
  }
});

test("overview scopes acceptance-rate label to undergraduate metadata", () => {
  const render = (language, kind) => {
    setLanguage(language, { persist: false, emit: false });
    const container = { innerHTML: "" };
    renderOverviewSection({
      acceptanceMeta: {},
      acceptanceRate: 4.56,
      container,
      officialRank: false,
      rankStatus: "",
      university: { academics: { admissions: { university_wide: { kind } } } },
    });
    return container.innerHTML;
  };

  assert.match(render("eng", "undergraduate_institution_wide"), /Undergraduate acceptance rate/);
  assert.match(render("rus", "undergraduate_institution_wide"), /Доля зачисленных на бакалавриат/);
  assert.match(render("eng", "graduate_institution_wide"), /Acceptance Rate/);
  assert.doesNotMatch(render("eng", "graduate_institution_wide"), /Undergraduate acceptance rate/);
});

test("MIT guest finance uses the selected graduate program and keeps unrelated tuition and aid unknown", () => {
  setLanguage("eng", { persist: false, emit: false });
  const profileKey = "unisearch_profile";
  const previousProfile = localStorage.getItem(profileKey);
  localStorage.removeItem(profileKey);
  const program = { id: "mit-mfin", name: "Master of Finance", study_levels: ["Master"] };
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const scholarshipContainer = { innerHTML: "" };
  const priceEl = { innerHTML: "", textContent: "" };
  const university = {
    id: "mit-usa-cambridge",
    location: { country: "USA" },
    finance: {
      currency: "USD",
      total_cost_year_usd: 100000,
      scope: "MIT undergraduate cost of attendance",
      undergraduate_aid_policy: { need_blind_domestic: true, need_blind_international: true, meets_full_demonstrated_need: true },
      doctorate_funding_guarantee: { notes: "Doctoral funding information" },
      scholarships_and_funding: [
        { id: "undergraduate-award", name: "Undergraduate award", study_level: "Bachelor", program_ids: ["mit-bachelor"] },
        { id: "mfin-award", name: "MFin fellowship", study_level: "Master", program_ids: ["mit-mfin"] },
      ],
    },
    academics: { programs: [program] },
    admission_categories: [
      { id: "mit-undergraduate", label: "MIT Undergraduate", scope: "program", study_levels: ["Bachelor"], program_ids: ["mit-bachelor"] },
      {
        id: "mit-mfin-route",
        label: "MIT Sloan Master of Finance",
        scope: "program",
        study_levels: ["Master"],
        program_ids: ["mit-mfin"],
        requirement_profiles: [{ id: "mfin-profile", label: "Applicant", funding_options: [{ id: "paid", label: "Self-funded", funding_type: "paid" }] }],
      },
    ],
  };

  try {
    selectAdmissionProgram(university, program);
    window.location.search = "?admission_program=mit-mfin";
    renderFinanceSection({ annualCostForTrack: () => null, container, priceEl, scholarshipContainer, university });

    assert.match(container.innerHTML, /MIT Sloan Master of Finance/);
    assert.match(container.innerHTML, /Total cost unknown/);
    assert.doesNotMatch(container.innerHTML, /MIT Undergraduate|\$100,000|Need-Blind|Doctoral funding information/);
    assert.doesNotMatch(scholarshipContainer.innerHTML, /Undergraduate award/);
    assert.match(scholarshipContainer.innerHTML, /MFin fellowship/);
    assert.doesNotMatch(priceEl.innerHTML, /\$100,000/);
  } finally {
    if (previousProfile === null) localStorage.removeItem(profileKey);
    else localStorage.setItem(profileKey, previousProfile);
    window.location.search = "";
  }
});

test("MIT deadlines follow the selected program", () => {
  setLanguage("eng", { persist: false, emit: false });
  const mfin = { id: "mit-mfin", name: "Master of Finance", study_levels: ["Master", "Doctorate"] };
  const physics = { id: "mit-physics", name: "Physics PhD", study_levels: ["Doctorate"] };
  const unreviewedProgram = { id: "mit-management", name: "Management Program", study_levels: ["Master"] };
  const university = {
    id: "mit-usa-cambridge",
    academics: { programs: [mfin, physics, unreviewedProgram] },
    admission_categories: [
      { id: "mfin-route", label: "MIT Sloan MFin", scope: "program", study_levels: ["Master", "Doctorate"], program_ids: ["mit-mfin"], application_deadline: "January 5, 2027" },
      { id: "physics-route", label: "MIT Physics PhD", scope: "program", study_levels: ["Doctorate"], program_ids: ["mit-physics"], application_deadline: "December 15, 2026" },
    ],
  };
  const container = { innerHTML: "", querySelectorAll: () => [] };

  selectAdmissionProgram(university, mfin);
  window.location.search = "?admission_program=mit-mfin";
  renderDeadlinesTabSection({ container, university });
  assert.match(container.innerHTML, /MIT Sloan MFin/);
  assert.doesNotMatch(container.innerHTML, /MIT Physics PhD/);
  assert.doesNotMatch(container.innerHTML, /data-deadlines-level/);

  selectAdmissionProgram(university, physics);
  window.location.search = "?admission_program=mit-physics";
  renderDeadlinesTabSection({ container, university });
  assert.match(container.innerHTML, /MIT Physics PhD/);
  assert.doesNotMatch(container.innerHTML, /MIT Sloan MFin/);

  selectAdmissionProgram(university, unreviewedProgram);
  window.location.search = "?admission_program=mit-management";
  renderDeadlinesTabSection({ container, university });
  assert.match(container.innerHTML, /Deadline details have not been reviewed for this program\./);
  assert.doesNotMatch(container.innerHTML, /No deadlines published\./);
  window.location.search = "";
});

test("undergraduate Finance compares profile income in its saved currency without implying eligibility", () => {
  setLanguage("eng", { persist: false, emit: false });
  const previousProfile = loadProfile();
  const previousWindowStorage = window.localStorage;
  const profileStorage = new Map();
  window.localStorage = {
    getItem: (key) => profileStorage.get(key) ?? null,
    setItem: (key, value) => profileStorage.set(key, String(value)),
    removeItem: (key) => profileStorage.delete(key),
  };
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const university = {
    id: "harvard-usa-cambridge",
    finance: {
      currency: "USD",
      financial_aid: {
        zero_contribution_income_threshold_usd: 100000,
        free_tuition_income_threshold_usd: 200000,
      },
      scholarships_and_funding: [],
    },
    admission_categories: [{ id: "harvard-college", label: "Harvard College", study_level: "Bachelor", funding_options: [{ id: "paid", funding_type: "paid" }] }],
  };
  const render = () => renderFinanceSection({ annualCostForTrack: () => null, container, university });

  try {
    saveProfile({
      studyLevel: "Bachelor",
      familyIncomeAmount: 120000,
      familyIncomeCurrency: "EUR",
    });
    render();
    assert.equal((container.innerHTML.match(/Entered income is at or above this published threshold/g) || []).length, 1, container.innerHTML);
    assert.equal((container.innerHTML.match(/Entered income is below this published threshold/g) || []).length, 1);
    assert.match(container.innerHTML, /This comparison is context only\. It does not determine aid eligibility, award amount, or net price\./);

    saveProfile({ studyLevel: "Bachelor", familyIncomeAmount: "", familyIncomeCurrency: "USD" });
    container.innerHTML = "";
    render();
    assert.doesNotMatch(container.innerHTML, /Income comparison unavailable|Entered income is/);
    assert.doesNotMatch(container.innerHTML, /This comparison is context only/);
    const nullIncomePolicy = resolveFeeStatusAndAid({
      university,
      profile: { studyLevel: "Bachelor", familyIncomeAmount: null, familyIncomeCurrency: "USD" },
    });
    assert.ok(nullIncomePolicy.thresholds.every((threshold) => !threshold.comparison));

    const invalidIncomePolicy = resolveFeeStatusAndAid({
      university,
      profile: { studyLevel: "Bachelor", familyIncomeAmount: "not-a-number", familyIncomeCurrency: "USD" },
    });
    assert.ok(invalidIncomePolicy.thresholds.every((threshold) => threshold.comparison === "Income comparison unavailable"));
    const unsupportedCurrencyPolicy = resolveFeeStatusAndAid({
      university,
      profile: { studyLevel: "Bachelor", familyIncomeAmount: 50000, familyIncomeCurrency: "ZZZ" },
    });
    assert.ok(unsupportedCurrencyPolicy.thresholds.every((threshold) => threshold.comparison === "Income comparison unavailable"));

    saveProfile({ studyLevel: "Master", familyIncomeAmount: 50000, familyIncomeCurrency: "USD" });
    container.innerHTML = "";
    render();
    assert.doesNotMatch(container.innerHTML, /finance-threshold-comparison|Income comparison unavailable|Entered income is/);
  } finally {
    saveProfile(previousProfile);
    window.localStorage = previousWindowStorage;
    setLanguage("eng", { persist: false, emit: false });
  }
});

test("Stanford undergraduate Finance shows the published outside-US income note", async () => {
  setLanguage("eng", { persist: false, emit: false });
  const previousProfile = loadProfile();
  const previousWindowStorage = window.localStorage;
  const profileStorage = new Map();
  window.localStorage = {
    getItem: (key) => profileStorage.get(key) ?? null,
    setItem: (key, value) => profileStorage.set(key, String(value)),
    removeItem: (key) => profileStorage.delete(key),
  };
  saveProfile({ studyLevel: "Bachelor", familyIncomeAmount: 85000, familyIncomeCurrency: "USD" });
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const rows = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));
  const stanford = rows.find((row) => row.id === "stanford-university-usa-ca");

  try {
    renderFinanceSection({ annualCostForTrack: () => null, container, university: stanford });
    assert.match(container.innerHTML, /may not apply to families living outside the United States/);
    assert.match(container.innerHTML, /This comparison is context only/);

    setLanguage("ru", { persist: false, emit: false });
    container.innerHTML = "";
    renderFinanceSection({ annualCostForTrack: () => null, container, university: stanford });
    assert.match(container.innerHTML, /могут не подходить для семей, живущих за пределами США/);
    assert.match(container.innerHTML, /Это сравнение даёт только общий контекст/);
  } finally {
    saveProfile(previousProfile);
    window.localStorage = previousWindowStorage;
    setLanguage("eng", { persist: false, emit: false });
  }
});

test("a multi-program route requires every ID to match and tuition to agree", () => {
  setLanguage("eng", { persist: false, emit: false });
  const profileKey = "unisearch_profile";
  const previousProfile = localStorage.getItem(profileKey);
  localStorage.setItem(profileKey, JSON.stringify({ studyLevel: "Master" }));
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const priceEl = { innerHTML: "", textContent: "" };
  const university = {
    finance: { currency: "USD", scholarships_and_funding: [] },
    academics: { programs: [
      { course_number: "Program A", tuition_year_usd: 80000, currency: "USD", tuition_cycle: "2026-27 tuition", tuition_source_url: "https://example.edu/program-a/tuition" },
      { course_number: "Program B", tuition_year_usd: 100000, currency: "USD", tuition_cycle: "2026-27 tuition", tuition_source_url: "https://example.edu/program-b/tuition" },
    ] },
    admission_categories: [{
      id: "shared-masters-route",
      label: "Shared Master's admission",
      study_level: "Master",
      program_ids: ["Program A", "Program B", "Program C not in catalog"],
      requirement_profiles: [{
        id: "shared-profile",
        label: "Applicant profile",
        funding_options: [{ id: "paid", label: "Self-funded", funding_type: "paid" }],
      }],
    }],
  };

  try {
    renderFinanceSection({ annualCostForTrack: () => null, container, priceEl, university });
    const route = container.innerHTML;
    assert.match(route, /Total cost unknown/);
    assert.match(route, /Cost breakdown unknown/);
    assert.doesNotMatch(route, /\$80,000|\$100,000/);
    assert.doesNotMatch(route, /program-a\/tuition|program-b\/tuition/);

    university.academics.programs[1].tuition_year_usd = 80000;
    container.innerHTML = "";
    renderFinanceSection({ annualCostForTrack: () => null, container, priceEl, university });
    assert.match(container.innerHTML, /Total cost unknown/);
    assert.doesNotMatch(container.innerHTML, /\$80,000|\$100,000/);
  } finally {
    if (previousProfile === null) localStorage.removeItem(profileKey);
    else localStorage.setItem(profileKey, previousProfile);
  }
});

test("a program-scoped range is shown in its option with applicant and cycle context, not as a university summary", () => {
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const priceEl = { innerHTML: "", textContent: "" };
  const university = {
    finance: { currency: "GBP", total_cost_year_usd: null },
    admission_categories: [
      {
        id: "oxford-cs",
        label: "Undergraduate admission (Computer Science)",
        study_level: "Bachelor",
        scope: "program",
        finance_override: {
          total_cost_year_min: 79855,
          total_cost_year_max: 86155,
          currency: "GBP",
          academic_year: "2027-28",
          fee_status: "overseas",
          scope: "program",
          note: "Published course cost range <img src=x> depends on living costs.",
        },
        funding_options: [{ id: "paid", label: "Overseas fee", funding_type: "paid" }],
      },
      {
        id: "oxford-maths-cs",
        label: "Undergraduate admission (Mathematics and Computer Science)",
        study_level: "Bachelor",
        scope: "program",
      },
    ],
  };

  renderFinanceSection({
    annualCostForTrack: () => null,
    container,
    priceEl,
    university,
  });

  assert.match(container.innerHTML, /£79,855–£86,155/);
  assert.match(container.innerHTML, /Overseas applicants/);
  assert.match(container.innerHTML, /Academic year: 2027.28/);
  assert.match(container.innerHTML, /&lt;img src=x&gt;/);
  assert.doesNotMatch(priceEl.innerHTML, /£79,855/);
  assert.doesNotMatch(priceEl.textContent, /£79,855/);
});

test("a university-scoped range does not leak into a different undergraduate category", () => {
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const priceEl = { innerHTML: "", textContent: "" };
  const university = {
    finance: {
      currency: "USD",
      total_cost_year_min: 95134,
      total_cost_year_max: 100134,
      academic_year: "2026-27",
      scope: "Harvard College undergraduate cost of attendance",
    },
    admission_categories: [
      { id: "college", label: "Harvard College (Undergraduate First-Year)", study_level: "Bachelor", scope: "undergraduate_general" },
      { id: "other", label: "Other Undergraduate Program", study_level: "Bachelor", scope: "program" },
    ],
  };

  renderFinanceSection({
    annualCostForTrack: () => null,
    container,
    priceEl,
    university,
  });

  assert.equal((container.innerHTML.match(/\$95,134–\$100,134/g) || []).length, 1);
  assert.doesNotMatch(priceEl.innerHTML, /\$95,134/);
});

test("Harvard Law JD shows its published tuition without presenting it as total cost", async () => {
  setLanguage("eng", { persist: false, emit: false });
  const previousProfile = loadProfile();
  saveProfile({ studyLevel: "Professional" });
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const priceEl = { innerHTML: "", textContent: "" };
  const rows = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));
  const harvard = rows.find((row) => row.id === "harvard-usa-cambridge");

  try {
    renderFinanceSection({ annualCostForTrack: () => null, container, priceEl, university: harvard });
    const jdHeadingIndex = container.innerHTML.indexOf("<h3>Harvard Law School (HLS - Juris Doctor)</h3>");
    const jdStart = container.innerHTML.lastIndexOf('<section class="finance-track-group', jdHeadingIndex);
    const jdEnd = container.innerHTML.indexOf("</section>", jdHeadingIndex);
    const jdCard = jdStart >= 0 && jdEnd >= 0 ? container.innerHTML.slice(jdStart, jdEnd) : "";
    assert.ok(jdCard, "the professional JD finance route is rendered");
    assert.match(jdCard, /\$84,400/);
    assert.match(jdCard, /Published tuition \/ year/);
    assert.match(jdCard, /Published gross tuition for 2026.{1}27/);
    assert.match(jdCard, /href="https:\/\/hls\.harvard\.edu\/sfs\/financial-aid\/financial-aid-policy\/cost-of-attendance\/"/);
    assert.doesNotMatch(jdCard, /Total \/ year|Estimated cost before aid/);
    assert.doesNotMatch(priceEl.innerHTML, /\$84,400/);
  } finally {
    saveProfile(previousProfile);
  }
});

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

test("admission funding options keep unknown prices localized instead of rendering zero", () => {
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const university = {
    id: "imperial-college-london-uk",
    finance: { currency: "GBP" },
    admission_categories: [{
      id: "imperial-bachelor-route",
      label: "Bachelor applicants",
      study_level: "Bachelor",
      requirement_profiles: [{
        id: "international-applicant",
        label: "International applicant",
        funding_options: [{ id: "inpires", label: "Inspires scholarship", funding_type: "grant" }],
      }],
    }],
  };
  const render = () => renderAdmissionSection({
    annualCostForTrack: () => null,
    container,
    uniChanceByChoiceKey: new Map(),
    university,
  });

  try {
    setLanguage("eng", { persist: false, emit: false });
    render();
    assert.match(container.innerHTML, /Cost unknown/);
    assert.doesNotMatch(container.innerHTML, /≈\s*£?\$?0(?:\.00)?/);

    setLanguage("ru", { persist: false, emit: false });
    render();
    assert.match(container.innerHTML, /Стоимость: нет данных/);
    assert.doesNotMatch(container.innerHTML, /≈\s*£?\$?0(?:[,.]00)?/);
  } finally {
    setLanguage("eng", { persist: false, emit: false });
  }
});

test("requirements fit stays with its profile when paid and grant options are listed", () => {
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const university = {
    id: "sample-university",
    finance: { currency: "USD" },
    admission_categories: [{
      id: "bachelor",
      label: "Bachelor applicants",
      study_level: "Bachelor",
      requirement_profiles: [{
        id: "general",
        label: "General applicant",
        requirements: { SAT: 1200 },
        funding_options: [
          { id: "paid", funding_type: "paid", label: "Paid" },
          { id: "grant", funding_type: "grant", label: "Grant" },
        ],
      }],
    }],
  };
  const fit = { scoreMeaning: "published_requirements_met_percent", chancePercent: 75, factors: [] };

  setLanguage("eng", { persist: false, emit: false });
  renderAdmissionSection({
    annualCostForTrack: () => 42000,
    container,
    uniChanceByChoiceKey: new Map([
      [admissionChoiceKey({ id: "bachelor" }, { id: "general" }, null), fit],
      [admissionChoiceKey({ id: "bachelor" }, { id: "general" }, { id: "paid" }), fit],
      [admissionChoiceKey({ id: "bachelor" }, { id: "general" }, { id: "grant" }), fit],
    ]),
    university,
  });

  assert.equal((container.innerHTML.match(/class="chance-track-chip/g) || []).length, 1);
  assert.match(container.innerHTML, /Annual cost before any award:<\/strong> \$42,000/);
  assert.equal((container.innerHTML.match(/class="admission-funding-option(?:\s|")/g) || []).length, 2);
  const fundingMarkup = container.innerHTML.slice(container.innerHTML.indexOf('class="admission-funding-option'));
  assert.doesNotMatch(fundingMarkup, /chance-track-chip/);
});

test("chance tones cover all public thresholds", () => {
  assert.equal(chanceTone(80).cls, "chance-high");
  assert.equal(chanceTone(60).cls, "chance-good");
  assert.equal(chanceTone(40).cls, "chance-medium");
  assert.equal(chanceTone(0).cls, "chance-low");
  assert.equal(chanceTone("invalid").cls, "chance-low");
});

test("requirements fit summary requires confirmed semantics and preserves unavailable evidence", () => {
  setLanguage("eng", { persist: false, emit: false });
  const empty = renderUniChanceSummary(null);
  assert.match(empty, /chance-percent chance-low">\?</);
  assert.match(empty, /data-width-pct="0"/);
  assert.match(empty, /not enough applicable requirements or profile evidence/);

  const legacyChance = renderUniChanceSummary({ overallChance: 72 });
  assert.doesNotMatch(legacyChance, /72%/);
  assert.match(legacyChance, /meaning could not be confirmed/);

  const missing = renderUniChanceSummary({
    overallChance: null,
    scoreMeaning: "published_requirements_met_percent",
    reason: "missing_exam_score",
    bestChoiceLabel: "SAT route",
  });
  assert.match(missing, /Add the required exam data/);
  assert.match(missing, /SAT route/);

  const selected = renderUniChanceSummary({
    overallChance: 72,
    scoreMeaning: "published_requirements_met_percent",
    bestChoiceLabel: "Paid route",
    bestChoiceKey: "paid",
    recommendedChoiceLabel: "Grant route",
    recommendedChoiceKey: "grant",
    selectedByUser: true,
  });
  assert.match(selected, /Selected:/);
  assert.match(selected, /Recommended/);
  assert.match(selected, /Fit to published requirements/);
  assert.match(selected, /Share of evaluable published academic and language minimum checks met/);
  assert.match(selected, /not an admission probability/i);
  assert.doesNotMatch(selected, /admitted-student|acceptance rate|confidence range/i);
  assert.doesNotMatch(selected, /affordability|budget/i);
  assert.match(selected, /data-width-pct="72"/);

  const noNumericMinimum = renderUniChanceSummary({
    overallChance: "35",
    scoreMeaning: "unverified_old_probability",
    bestChoiceLabel: "General",
  });
  assert.doesNotMatch(noNumericMinimum, /35%/);
  assert.match(noNumericMinimum, /meaning could not be confirmed/);
  assert.doesNotMatch(noNumericMinimum, /Low confidence|Estimated|admitted-student|acceptance rate/i);

  setLanguage("rus", { persist: false, emit: false });
  const russianProfile = renderUniChanceSummary({
    overallChance: 72,
    scoreMeaning: "published_requirements_met_percent",
    bestChoiceLabel: "SAT route",
  });
  const russianNoMeaning = renderUniChanceSummary({ overallChance: 35 });
  assert.match(russianProfile, /Доля проверяемых опубликованных академических и языковых минимумов, которые выполнены/);
  assert.match(russianNoMeaning, /смысл этого показателя не подтверждён/);
  assert.match(russianProfile, /это не вероятность поступления/i);
  assert.doesNotMatch(`${russianProfile}${russianNoMeaning}`, /профилей зачисленных|диапазон уверенности/i);
  assert.doesNotMatch(`${russianProfile}${russianNoMeaning}`, /бюджет|финанс/i);
  setLanguage("eng", { persist: false, emit: false });
});

test("chance summary explains distinct no-data reasons", () => {
  assert.match(renderUniChanceSummary({ scoreMeaning: "published_requirements_met_percent", overallChance: "", reason: "requirements_not_met" }), /do not meet a required minimum/);
  assert.match(renderUniChanceSummary({ scoreMeaning: "published_requirements_met_percent", overallChance: null, reason: "missing_evidence" }), /Add the required exam scores/);
  assert.match(renderUniChanceSummary({ scoreMeaning: "published_requirements_met_percent", overallChance: null, reason: "unassessed_minimums" }), /technical GPA minimums of 4\.25\/5\.0 and overall GPA minimums of 4\.0\/5\.0/);
  assert.match(renderUniChanceSummary({ scoreMeaning: "published_requirements_met_percent", overallChance: null, reason: "requirements_not_reviewed" }), /minimums have not yet been reviewed/);
  assert.match(renderUniChanceSummary({ scoreMeaning: "published_requirements_met_percent", overallChance: null, label: "Custom unavailable reason" }), /not enough applicable requirements or profile evidence/i);
});

test("track chance chips handle no data, invalid badges, and numeric zero", () => {
  assert.match(renderTrackChanceChip(null), /not enough applicable requirements or profile evidence/);
  assert.match(renderTrackChanceChip({ scoreMeaning: "published_requirements_met_percent", chancePercent: null, reason: "requirements_not_met" }), /required minimum/);
  assert.match(renderTrackChanceChip({ chancePercent: 0, badges: ["unknown", "need_aware_penalty"] }), /meaning could not be confirmed/);
  assert.match(renderTrackChanceChip({ scoreMeaning: "published_requirements_met_percent", chancePercent: 0, badges: ["unknown", "need_aware_penalty"] }), /Requirements fit 0%/);
  assert.match(renderTrackChanceChip({ scoreMeaning: "published_requirements_met_percent", chancePercent: 0, badges: ["unknown", "need_aware_penalty"] }), /Need-aware aid/);
  assert.doesNotMatch(renderTrackChanceChip({ chancePercent: 0, badges: ["unknown"] }), /admission-chance-badge/);
});

test("requirements fit factor rendering filters invalid rows and maps positive, negative, and neutral tones", () => {
  assert.equal(renderTrackFactors(null), "");
  assert.equal(renderTrackFactors({ factors: [{ key: "academic_strength", status: "positive" }] }), "");
  const html = renderTrackFactors({ scoreMeaning: "published_requirements_met_percent", factors: [
    null,
    [],
    {},
    { key: "requirements_met", status: "positive", label: "Requirements", message: "Ready" },
    { key: "requirements_gap", status: "negative", label: "Requirements", impact_text: "Improve" },
    { key: "insufficient_data", status: "other", message: "Review manually" },
  ] });
  assert.match(html, /factor-positive/);
  assert.match(html, /factor-negative/);
  assert.match(html, /factor-neutral/);
  assert.match(html, /not enough applicable requirements or profile evidence to calculate this fit score/i);
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
    scoreMeaning: "published_requirements_met_percent",
    factors: [
      {
        key: "requirements_met",
        status: "positive",
        label: "Requirements",
        message: "All measurable published minimums are met.",
      },
    ],
  });

  assert.match(html, /Требования выполнены/);
  assert.match(html, /Все измеряемые опубликованные минимумы выполнены\./);
  assert.doesNotMatch(html, /Requirements/);
});

test("requirements fit factors suppress legacy acceptance and selectivity factors", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackFactors({
    scoreMeaning: "published_requirements_met_percent",
    factors: [
      {
        key: "holistic_review_selectivity",
        status: "neutral",
        label: "Holistic review",
        message: "At colleges with <10% acceptance rate, test scores are a screening baseline. Admission relies heavily on olympiads, essays, and extracurriculars.",
      },
    ],
  });

  assert.equal(html, "");
});

test("requirements fit factors suppress unsupported factor keys", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackFactors({
    scoreMeaning: "published_requirements_met_percent",
    factors: [
      {
        key: "future_signal",
        status: "neutral",
        label: "Future signal",
        message: "Backend fallback stays visible.",
      },
    ],
  });

  assert.equal(html, "");
});

test("renderTrackChanceChip uses Russian badge labels without mixed English terms", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackChanceChip({
    chancePercent: 72,
    scoreMeaning: "published_requirements_met_percent",
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
    scoreMeaning: "published_requirements_met_percent",
    badges: ["need_blind"],
  });
  assert.match(badgeHtml, /class="ui-tooltip-wrap admission-chance-badge-wrap"/);
  assert.match(badgeHtml, /<button type="button" class="ui-tooltip-trigger admission-chance-badge/);
  assert.match(badgeHtml, /class="ui-tooltip-bubble admission-chance-tooltip__content" role="tooltip"/);

  const factorHtml = renderTrackFactors({
    scoreMeaning: "published_requirements_met_percent",
    factors: [
      {
        key: "requirements_met",
        status: "positive",
        label: "Requirements",
        message: "All measurable published minimums are met.",
      },
    ],
  });
  assert.match(factorHtml, /class="ui-tooltip-wrap track-factor-chip-wrap"/);
  assert.match(factorHtml, /<button type="button" class="ui-tooltip-trigger track-factor-chip factor-positive"/);
  assert.match(factorHtml, /class="ui-tooltip-bubble track-factor-tooltip__content" role="tooltip"/);
});
test("selected admission context puts course conditions first and keeps history separate", () => {
  setLanguage("eng", { persist: false, emit: false });
  window.location.search = "?admission_program=computing&admission_route=first_year&admission_cycle=2027%20entry";
  const university = {
    id: "ux-course", academics: { programs: [{ id: "computing", name: "Computing", study_levels: ["Bachelor"] }] },
    admission_categories: [{ id: "route", label: "Computing entry", description: "Shared application description", study_level: "Bachelor", applicant_route: "first_year", program_ids: ["computing"], cycle: "2027 entry", source_url: "https://www.imperial.ac.uk/study/courses/undergraduate/computing-meng/", deadlines: [{ cycle: "Annual cycle; the official page does not publish an entry year for these dates." }], requirement_profiles: [{ id: "a-level", label: "A-Level", description: "Shared application description", requirements: {}, requirements_note: "A*A*A including Mathematics", requirements_source_url: "https://www.imperial.ac.uk/study/courses/undergraduate/computing-meng/" }] }],
  };
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  const fit = { scoreMeaning: "published_requirements_met_percent", chancePercent: 100, factors: [] };
  renderAdmissionSection({ container, university, annualCostForTrack: () => null, uniChanceByChoiceKey: new Map([["route::a-level",fit]]) });
  assert.match(container.innerHTML, /Selected program/);
  assert.equal((container.innerHTML.match(/Shared application description/g) || []).length, 1);
  assert.match(container.innerHTML, /A\*A\*A including Mathematics/);
  assert.match(container.innerHTML, /percentage covers numeric minimums only/);
  assert.ok(container.innerHTML.indexOf("A*A*A including Mathematics") < container.innerHTML.indexOf("Requirements fit and historical statistics"));
  assert.doesNotMatch(container.innerHTML, /<option[^>]+Annual cycle/);
  assert.match(container.innerHTML, /data-admission-open-tab="tab-finance"/);
  assert.match(container.innerHTML, /href="https:\/\/www\.imperial\.ac\.uk\/study\/courses\/undergraduate\/computing-meng\/"/);
  window.location.search = "";
});

test("no matching assessment avoids exposing an API fallback choice label", () => {
  setLanguage("ru", { persist: false, emit: false });
  const html = renderUniChanceSummary({ scoreMeaning: "published_requirements_met_percent", overallChance: null, reason: "no_choices", bestChoiceLabel: "No choices for selected filters" });
  assert.match(html, /Проверьте выбранный маршрут/);
  assert.doesNotMatch(html, /No choices|Лучший вариант:/);
  setLanguage("eng", { persist: false, emit: false });
});
test("funding with an explicit first-year route does not leak into transfer", async () => {
  const { getFundingAwardsForSelection } = await import("../../frontend/javascript/pages/university/render-sections.js");
  const finance = { scholarships_and_funding: [{ id: "first-year-aid", study_level: "Bachelor", applicant_routes: ["first_year"] },{ id: "unknown-route-aid", study_level: "Bachelor" }] };
  assert.deepEqual(getFundingAwardsForSelection(finance,[{applicant_route:"transfer"}],"Bachelor").map(a=>a.id),["unknown-route-aid"]);
  assert.equal(getFundingAwardsForSelection(finance,[{applicant_route:"first_year"}],"Bachelor").length,2);
  assert.equal(getFundingAwardsForSelection(finance,[{}],"Bachelor").length,2);
  window.location.search = "?admission_route=transfer";
  const scholarshipContainer = { innerHTML: "" };
  renderFinanceSection({
    annualCostForTrack: () => null, container: { innerHTML: "", querySelectorAll: () => [] }, scholarshipContainer,
    university: { id: "ux-transfer-funding", finance: { scholarships_and_funding: [finance.scholarships_and_funding[0]] }, admission_categories: [{ id: "transfer", study_level: "Bachelor", applicant_route: "transfer", funding_source_url: "https://financialaid.stanford.edu/undergrad/apply/" }] },
  });
  assert.match(scholarshipContainer.innerHTML, /<a href="https:\/\/financialaid\.stanford\.edu\/undergrad\/apply\/"/);
  assert.doesNotMatch(scholarshipContainer.innerHTML, /&lt;a/);
  window.location.search = "";

});

test("Russian program names remain distinct when restoring a selected program ID", () => {
  setLanguage("rus", { persist: false, emit: false });
  window.location.search = "?admission_program=cs-ru&admission_route=transfer&admission_cycle=2027";
  const university = { id: "ux-russian-programs", academics: { programs: [
    { id: "physics-ru", name: "Физика", study_levels: ["Bachelor"] },
    { id: "cs-ru", name: "Компьютерные науки", study_levels: ["Bachelor"] },
  ] }, admission_categories: [
    { id: "physics-route", label: "Физика", scope: "program", study_level: "Bachelor", applicant_route: "transfer", program_ids: ["physics-ru"] },
    { id: "cs-route", label: "Компьютерные науки", scope: "program", study_level: "Bachelor", applicant_route: "transfer", program_ids: ["cs-ru"] },
  ] };
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderAdmissionSection({ container, university, annualCostForTrack: () => null });
  assert.match(container.innerHTML, /data-admission-category="cs-route"/);
  assert.doesNotMatch(container.innerHTML, /data-admission-category="physics-route"/);
  assert.match(container.innerHTML, /class="admission-program-option is-active"\s+data-admission-program="компьютерные_науки"/);
  window.location.search = "";
  setLanguage("eng", { persist: false, emit: false });
});

test("admission descriptions deduplicate the localized paragraph", async () => {
  const translations = JSON.parse(await readFile(new URL("../../backend/data/universities_translations.json", import.meta.url), "utf8"));
  const pack = translations.languages.rus;
  const source = "One university-wide first-year application through the Common Application; applicants apply to Stanford, not to a selected major. SAT or ACT is required. Need-blind for US applicants; international applicants are need-aware if requesting aid.";
  const localized = pack.admission_exact[source];
  assert.ok(localized);
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ lang: "rus", data: pack }) });
  try {
    const { loadUniversityTranslationsForLanguage } = await import("../../frontend/javascript/university-translations.js");
    await loadUniversityTranslationsForLanguage("rus", true);
  } finally {
    global.fetch = previousFetch;
  }
  setLanguage("rus", { persist: false, emit: false });
  window.location.search = "";
  const university = { id: "ux-localized-description", admission_categories: [{
    id: "first-year", label: "First-year", scope: "general", study_level: "Bachelor", applicant_route: "first_year",
    description: source, requirement_profiles: [{ id: "applicant", description: localized, requirements: {} }],
  }] };
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderAdmissionSection({ container, university, annualCostForTrack: () => null });
  assert.equal(container.innerHTML.split(localized).length - 1, 1);
  setLanguage("eng", { persist: false, emit: false });
});
