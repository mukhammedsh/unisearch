import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { readAdmissionsCatalog } from "./admissions-catalog-fixture.mjs";

global.fetch = async (url) => {
  const target = String(url || "").split("?")[0];
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
const { renderAdmissionsContext } = await import("../../frontend/javascript/pages/university/admissions-render.js");
const { EXAM_CONFIG } = await import("../../frontend/javascript/utils/config.js");
const {
  admissionChoiceKey,
  applyPercentWidths,
  chanceNoDataHelpNote,
  getAdmissionChoicesFromCategories,
  getGrantsFromCategories,
  getTrackFundingType,
  renderExamGroup,
  renderGroupedExamPairRows,
  renderTrackFundingBadge,
  splitExamEntries,
} = await import("../../frontend/javascript/university-detail-helpers.js");

await initI18n();

test("chanceNoDataHelpNote explains unavailable requirements match reasons in eng and rus", () => {
  setLanguage("eng");
  assert.match(chanceNoDataHelpNote(null), /not enough applicable requirements/i);
  assert.match(chanceNoDataHelpNote({ scoreMeaning: "other" }), /meaning could not be confirmed/i);
  assert.match(
    chanceNoDataHelpNote({ scoreMeaning: "published_requirements_met_percent", reason: "no_published_requirements" }),
    /no measurable published minimums/,
  );
  setLanguage("rus");
  assert.match(
    chanceNoDataHelpNote({ scoreMeaning: "published_requirements_met_percent", reason: "no_published_requirements" }),
    /нет опубликованных измеримых минимумов/,
  );
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
const { renderExtraSection, renderOverviewSection } = await import("../../frontend/javascript/pages/university/render-content.js");

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
  // The general profile holds no entry cycle; the requested cycle comes from this university's context in the URL.
  window.location.search = "?admission_program=graduate-physics&admission_level=bachelor&admission_route=first_year&admission_cycle=Fall%202027";
  const savedProfile = {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
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
  assert.equal(savedProfile.intendedEntryCycle, undefined);
  assert.equal(savedProfile.selectedAdmissionChoices.test_university.programId, "undergraduate-cs");
  window.location.search = "";
});

test("a catalog program without an ID can be selected by its exact stored name", () => {
  const previousHistory = window.history;
  const previousSearch = window.location.search;
  const university = { id: "name-only-university", academics: { programs: [
    { name: "Компьютерные науки", source_name: "Computer Science", study_levels: ["Bachelor"] },
    { name: "Экономика", source_name: "Economics", study_levels: ["Bachelor"] },
  ] } };
  window.history = { pushState: (_state, _title, url) => { window.location.search = new URL(url, "http://localhost").search; } };
  try {
    selectAdmissionProgram(university, university.academics.programs[1]);
    assert.equal(new URLSearchParams(window.location.search).get("admission_program"), "Economics");
    const profile = getAdmissionContextProfile(university, {});
    assert.deepEqual(profile.selectedAdmissionChoices[university.id], { programName: "Economics" });
    assert.equal(profile.study_level, "Bachelor");
  } finally {
    window.history = previousHistory;
    window.location.search = previousSearch;
  }
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

test("published program tuition is shown as gross tuition for paid and fellowship options", () => {
  setLanguage("eng", { persist: false, emit: false });
  const profileKey = "unisearch_profile";
  const previousProfile = localStorage.getItem(profileKey);
  localStorage.setItem(profileKey, JSON.stringify({ studyLevel: "Master" }));
  window.location.search = "?admission_program=analytics-mban";
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const priceEl = { innerHTML: "", textContent: "" };
  const university = {
    id: "sample-university",
    finance: { currency: "USD", scholarships_and_funding: [] },
    academics: { programs: [{
      course_number: "Analytics MBAn",
      id: "analytics-mban",
      name: "Master of Business Analytics (MBAn)",
      tuition_year_usd: 96884,
      currency: "USD",
      tuition_cycle: "2026-27 published annual tuition, excluding summer tuition subsidy; 2027 entry rate not yet stated",
      tuition_source_url: "https://www.example.edu/analytics/tuition-and-aid",
    }] },
    admission_categories: [{
      id: "analytics-mban-admissions",
      label: "Master of Business Analytics (MBAn)",
      scope: "program",
      study_level: "Master",
      program_ids: ["analytics-mban"],
      requirement_profiles: [{
        id: "analytics-mban-profile",
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
    assert.match(container.innerHTML, /analytics\/tuition-and-aid/);
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

test("reviewed overview shows institution facts without a university-wide admission rate", () => {
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "" };
  renderOverviewSection({
    container, includeAdmissionRate: false, officialRank: true, rankStatus: "official",
    acceptanceRate: 4.56, acceptanceMeta: {},
    university: { rank: 1, student_count: 12000, academics: { formats: ["Full-time"] } },
  });
  assert.match(container.innerHTML, /#1/);
  assert.match(container.innerHTML, /12,000/);
  assert.doesNotMatch(container.innerHTML, /Acceptance Rate|Undergraduate acceptance rate|4\.56%|NaN/);
});

test("overview omits missing rank, acceptance rate, and student count instead of rendering placeholders", () => {
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "", hidden: false };
  const box = { hidden: false, querySelectorAll: () => [container] };
  container.closest = () => box;
  renderOverviewSection({
    container,
    includeAdmissionRate: true,
    officialRank: false,
    acceptanceRate: 25,
    acceptanceMeta: {},
    university: {
      rank: null,
      rank_meta: { source: "QS World University Rankings 2026", source_url: "https://topuniversities.example/", status: "not_published" },
      student_count: null,
      academics: {},
    },
  });
  assert.equal(container.hidden, false);
  assert.equal(box.hidden, false);
  assert.match(container.innerHTML, /data-count="1"/);
  assert.match(container.innerHTML, /25%/);
  assert.doesNotMatch(container.innerHTML, /Global Rank|Total Students|No data|Unavailable|QS World University Rankings/);

  renderOverviewSection({
    container,
    includeAdmissionRate: true,
    officialRank: false,
    acceptanceRate: null,
    acceptanceMeta: {},
    university: { rank: null, student_count: null, academics: {} },
  });
  assert.equal(container.hidden, true);
  assert.equal(box.hidden, true);
  assert.equal(container.innerHTML, "");
});

test("extra section renders only description without focus tags and hides when empty", () => {
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "", hidden: false };
  const box = { hidden: false, querySelectorAll: () => [container] };
  container.closest = () => box;
  renderExtraSection({ container, university: { description: "Research university.", tags: ["engineering", "research"] } });
  assert.equal(container.hidden, false);
  assert.equal(box.hidden, false);
  assert.match(container.innerHTML, /Research university\./);
  assert.doesNotMatch(container.innerHTML, /uni-tags-wrap|uni-tag|engineering|No data/);

  renderExtraSection({ container, university: { description: "", tags: ["engineering"] } });
  assert.equal(container.hidden, true);
  assert.equal(box.hidden, true);
  assert.equal(container.innerHTML, "");
});

test("an institution with many delivery formats names the formats rather than each program's schedule", () => {
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "" };
  renderOverviewSection({ container, includeAdmissionRate: false, university: { verified_sources: [{ topic: "formats", url: "https://example.edu/formats" }], academics: {
    formats: ["Full-time", "Full-time", "Hybrid", "Low-residency campus intensives", "Part-time online"],
  } } });
  assert.match(container.innerHTML, /Hybrid \(campus and online\), Online/);
  assert.doesNotMatch(container.innerHTML, /Full-time|Low-residency/);
});

test("unrecognised format wording is still shown, in one disclosure when long", () => {
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "" };
  renderOverviewSection({ container, includeAdmissionRate: false, university: { verified_sources: [{ topic: "formats", url: "https://example.edu/formats" }], academics: {
    formats: ["Full-time", "Full-time", "Part-time", "Evening", "Weekend"],
  } } });
  assert.match(container.innerHTML, /<summary>Varies by program/);
  assert.equal((container.innerHTML.match(/<li>Full-time<\/li>/g) || []).length, 1);
});

test("legacy finance uses the selected graduate program and keeps unrelated tuition and aid unknown", () => {
  setLanguage("eng", { persist: false, emit: false });
  const profileKey = "unisearch_profile";
  const previousProfile = localStorage.getItem(profileKey);
  localStorage.removeItem(profileKey);
  const program = { id: "sample-mfin", name: "Master of Finance", study_levels: ["Master"] };
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const scholarshipContainer = { innerHTML: "" };
  const priceEl = { innerHTML: "", textContent: "" };
  const university = {
    id: "sample-university",
    location: { country: "USA" },
    finance: {
      currency: "USD",
      total_cost_year_usd: 100000,
      scope: "Undergraduate cost of attendance",
      undergraduate_aid_policy: { need_blind_domestic: true, need_blind_international: true, meets_full_demonstrated_need: true },
      doctorate_funding_guarantee: { notes: "Doctoral funding information" },
      scholarships_and_funding: [
        { id: "undergraduate-award", name: "Undergraduate award", study_level: "Bachelor", program_ids: ["sample-bachelor"] },
        { id: "mfin-award", name: "MFin fellowship", study_level: "Master", program_ids: ["sample-mfin"] },
      ],
    },
    academics: { programs: [program] },
    admission_categories: [
      { id: "undergraduate", label: "Undergraduate", scope: "program", study_levels: ["Bachelor"], program_ids: ["sample-bachelor"] },
      {
        id: "sample-mfin-route",
        label: "Master of Finance",
        scope: "program",
        study_levels: ["Master"],
        program_ids: ["sample-mfin"],
        requirement_profiles: [{ id: "mfin-profile", label: "Applicant", funding_options: [{ id: "paid", label: "Self-funded", funding_type: "paid" }] }],
      },
    ],
  };

  try {
    selectAdmissionProgram(university, program);
    window.location.search = "?admission_program=sample-mfin";
    renderFinanceSection({ annualCostForTrack: () => null, container, priceEl, scholarshipContainer, university });

    assert.match(container.innerHTML, /Master of Finance/);
    assert.match(container.innerHTML, /Total cost unknown/);
    assert.doesNotMatch(container.innerHTML, /Undergraduate|\$100,000|Need-Blind|Doctoral funding information/);
    assert.doesNotMatch(scholarshipContainer.innerHTML, /Undergraduate award/);
    assert.match(scholarshipContainer.innerHTML, /MFin fellowship/);
    assert.doesNotMatch(priceEl.innerHTML, /\$100,000/);
  } finally {
    if (previousProfile === null) localStorage.removeItem(profileKey);
    else localStorage.setItem(profileKey, previousProfile);
    window.location.search = "";
  }
});

test("legacy deadlines follow the selected program", () => {
  setLanguage("eng", { persist: false, emit: false });
  const mfin = { id: "sample-mfin", name: "Master of Finance", study_levels: ["Master", "Doctorate"] };
  const physics = { id: "sample-physics", name: "Physics PhD", study_levels: ["Doctorate"] };
  const unreviewedProgram = { id: "sample-management", name: "Management Program", study_levels: ["Master"] };
  const university = {
    id: "sample-university",
    academics: { programs: [mfin, physics, unreviewedProgram] },
    admission_categories: [
      { id: "mfin-route", label: "MFin route", scope: "program", study_levels: ["Master", "Doctorate"], program_ids: ["sample-mfin"], application_deadline: "January 5, 2027" },
      { id: "physics-route", label: "Physics PhD route", scope: "program", study_levels: ["Doctorate"], program_ids: ["sample-physics"], application_deadline: "December 15, 2026" },
      { id: "general-route", label: "General route", scope: "general", study_levels: ["Master"], application_deadline: "February 1, 2027" },
    ],
  };
  const container = { innerHTML: "", querySelectorAll: () => [], querySelector: () => null };

  selectAdmissionProgram(university, mfin);
  window.location.search = "?admission_program=sample-mfin";
  renderDeadlinesTabSection({ container, university });
  assert.match(container.innerHTML, /MFin route/);
  assert.doesNotMatch(container.innerHTML, /Physics PhD route/);
  assert.doesNotMatch(container.innerHTML, /data-deadlines-level/);

  selectAdmissionProgram(university, physics);
  window.location.search = "?admission_program=sample-physics";
  renderDeadlinesTabSection({ container, university });
  assert.match(container.innerHTML, /Physics PhD route/);
  assert.doesNotMatch(container.innerHTML, /MFin route/);

  selectAdmissionProgram(university, unreviewedProgram);
  window.location.search = "?admission_program=sample-management";
  renderDeadlinesTabSection({ container, university });
  assert.match(container.innerHTML, /General route/);
  assert.doesNotMatch(container.innerHTML, /MFin route|Physics PhD route|Deadline details have not been reviewed/);
  window.location.search = "";
});

test("archived legacy finance fixture shows published income thresholds without comparing profile data", () => {
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "", querySelectorAll: () => [] };
  const university = {
    id: "sample-legacy-finance",
    finance: {
      currency: "USD",
      financial_aid: {
        zero_contribution_income_threshold_usd: 100000,
        free_tuition_income_threshold_usd: 200000,
      },
      scholarships_and_funding: [],
    },
    admission_categories: [{ id: "sample-undergraduate", label: "Undergraduate", study_level: "Bachelor", funding_options: [{ id: "paid", funding_type: "paid" }] }],
  };

  // A stale saved profile that still carries the removed income input must not change the thresholds.
  const policy = resolveFeeStatusAndAid({
    university,
    profile: { studyLevel: "Bachelor", familyIncomeAmount: 120000, familyIncomeCurrency: "EUR" },
  });
  assert.deepEqual(
    policy.thresholds.map((threshold) => [threshold.label, threshold.value]),
    [
      ["Zero Parent Contribution Threshold", "< $100,000 / year"],
      ["Free Tuition Threshold", "< $200,000 / year"],
    ],
  );
  assert.ok(policy.thresholds.every((threshold) => !("comparison" in threshold)));

  renderFinanceSection({ annualCostForTrack: () => null, container, university });
  assert.match(container.innerHTML, /Zero Parent Contribution Threshold/);
  assert.match(container.innerHTML, /Free Tuition Threshold/);
  assert.doesNotMatch(container.innerHTML, /Entered income is|Income comparison unavailable|This comparison is context only/);
});

test("UK and US universities always show the fee status as unconfirmed", () => {
  setLanguage("eng", { persist: false, emit: false });
  for (const country of ["United Kingdom", "United States"]) {
    const policy = resolveFeeStatusAndAid({
      university: { location: { country }, finance: {} },
      profile: { studyLevel: "Bachelor", citizenshipStatus: { status: "verified", fee_category: "home" } },
    });
    assert.equal(policy.feeStatusBadge, "Fee status requires an eligibility check");
    assert.match(policy.feeStatusSummary, /Citizenship alone does not establish home, domestic, or overseas fee status/);
  }
  assert.equal(resolveFeeStatusAndAid({ university: { location: { country: "Kazakhstan" }, finance: {} }, profile: {} }).feeStatusBadge, "");
});

test("accepted Stanford aid source remains scoped to its shared route and does not promise an award", async () => {
  setLanguage("eng", { persist: false, emit: false });
  const catalog = await readAdmissionsCatalog();
  const stanford = catalog.institutions.find((row) => row.institution.id === "stanford-university-usa-ca");
  const selected_option = stanford.study_options.find((row) => row.id === "stanford-option-cs-bs");
  const selected_route = stanford.application_routes.find((row) => row.id === "undergraduate-shared-evidence:stanford-first-year");
  const fact = stanford.facts.find((row) => row.id === "undergraduate-shared-evidence:stanford-ug-aid-need-and-scholarship");
  const sourceIds = new Set([...selected_option.source_ids, ...selected_route.source_ids, ...fact.source_ids]);
  const context = {
    selected_option,
    selected_route,
    facts: [fact],
    fact_groups: { funding: [fact.id] },
    sources: stanford.sources.filter((source) => sourceIds.has(source.id)),
    reference_labels: Object.fromEntries(stanford.study_options.map((row) => [row.id, row.title])),
  };
  const html = renderAdmissionsContext(context, { domains: ["funding"], includeAssessment: false });

  assert.ok(selected_route.option_ids.includes(selected_option.id));
  assert.match(html, /meets demonstrated need for admitted applicants, including international citizens/);
  assert.match(html, /aid is not a guaranteed reduction until assessed and awarded/);
  assert.match(html, /University-wide first-year undergraduate admission/);
  assert.match(html, /href="https:\/\/admission\.stanford\.edu\/apply\/international\/"/);
  assert.doesNotMatch(html, /income eligibility|net award amount/);
  setLanguage("eng", { persist: false, emit: false });
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
  const previousSearch = window.location.search;
  saveProfile({ studyLevel: "Professional" });
  window.location.search = "?admission_program=harvard-hls-jd&admission_level=professional";
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
    window.location.search = previousSearch;
  }
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
  assert.equal(renderExamGroup("None", [], "info"), "");
  assert.match(renderExamGroup("Academic", [["SAT", 1300]], "info"), /track-exam-group--info/);
  assert.match(renderExamGroup("Language", [["IELTS", 6.5]], "success"), /track-exam-group--success/);
  assert.match(renderExamGroup("Other", [["GPA", 3.5]], "neutral"), /track-exam-group--neutral/);
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

test("legacy requirement profiles render funding options without legacy chance chips", () => {
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

  setLanguage("eng", { persist: false, emit: false });
  renderAdmissionSection({
    annualCostForTrack: () => 42000,
    container,
    university,
  });

  assert.doesNotMatch(container.innerHTML, /chance-track-chip/);
  assert.doesNotMatch(container.innerHTML, /chance-panel/);
  assert.match(container.innerHTML, /Annual cost before any award:<\/strong> \$42,000/);
  assert.equal((container.innerHTML.match(/class="admission-funding-option(?:\s|")/g) || []).length, 2);
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

test("selected admission context puts course conditions first and omits legacy chance panel", () => {
  setLanguage("eng", { persist: false, emit: false });
  window.location.search = "?admission_program=computing&admission_route=first_year&admission_cycle=2027%20entry";
  const university = {
    id: "ux-course", academics: { programs: [{ id: "computing", name: "Computing", study_levels: ["Bachelor"] }] },
    admission_categories: [{ id: "route", label: "Computing entry", description: "Shared application description", study_level: "Bachelor", applicant_route: "first_year", program_ids: ["computing"], cycle: "2027 entry", source_url: "https://www.imperial.ac.uk/study/courses/undergraduate/computing-meng/", deadlines: [{ cycle: "Annual cycle; the official page does not publish an entry year for these dates." }], requirement_profiles: [{ id: "a-level", label: "A-Level", description: "Shared application description", requirements: {}, requirements_note: "A*A*A including Mathematics", requirements_source_url: "https://www.imperial.ac.uk/study/courses/undergraduate/computing-meng/" }] }],
  };
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderAdmissionSection({ container, university, annualCostForTrack: () => null });
  assert.match(container.innerHTML, /data-admission-category="route"/);
  assert.doesNotMatch(container.innerHTML, /data-admission-program|data-admission-open-tab/);
  assert.equal((container.innerHTML.match(/Shared application description/g) || []).length, 1);
  assert.match(container.innerHTML, /A\*A\*A including Mathematics/);
  assert.doesNotMatch(container.innerHTML, /chance-track-chip|chance-panel|mit-admission-analysis/);
  assert.doesNotMatch(container.innerHTML, /<option[^>]+Annual cycle/);
  assert.match(container.innerHTML, /href="https:\/\/www\.imperial\.ac\.uk\/study\/courses\/undergraduate\/computing-meng\/"/);
  window.location.search = "";
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
  assert.doesNotMatch(container.innerHTML, /data-admission-program/);
  const compactContainer = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderAdmissionSection({ container: compactContainer, university, annualCostForTrack: () => null, compactMode: true });
  assert.match(compactContainer.innerHTML, /<select[^>]*data-admission-program/);
  assert.match(compactContainer.innerHTML, /<option value="компьютерные_науки" selected>/);
  window.location.search = "";
  setLanguage("eng", { persist: false, emit: false });
});

test("comparison setup keeps a program that exists only on admission categories", async () => {
  const { compareProgramChoiceByUniversity } = await import("../../frontend/javascript/pages/university/section-context.js");
  window.location.search = "";
  const university = { id: "ux-category-programs", academics: { programs: [] }, admission_categories: [
    { id: "general-route", label: "General", scope: "general", study_level: "Bachelor", program_names: ["History", "Mathematics"] },
  ] };
  compareProgramChoiceByUniversity.set(university.id, "history");
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderAdmissionSection({ container, university, annualCostForTrack: () => null, compactMode: true });
  assert.match(container.innerHTML, /<option value="history" selected>/);
  assert.doesNotMatch(container.innerHTML, /<option value="__general__" selected>/);
  compareProgramChoiceByUniversity.delete(university.id);
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


test("localized program study levels stay canonical in the assessment request", () => {
  window.location.search = "?admission_program=ru-master";
  const context = getAdmissionContextProfile({ id: "ru-level", academics: { programs: [
    { id: "ru-master", name: "Research", study_levels: ["Магистратура"] },
  ] }, admission_categories: [] }, { studyLevel: "Bachelor" });
  assert.equal(context.study_level, "Master");
  assert.equal(context.studyLevel, "Master");
  window.location.search = "";
});


test("a source note shared by a profile description and its requirements is shown once", () => {
  const note = "GRE evidence is required; no numeric minimum is published.";
  const university = { id: "note-once", admission_categories: [{ id: "graduate", label: "Graduate", study_level: "Master", applicant_route: "graduate", requirement_profiles: [{ id: "general", description: note, requirements_note: note, requirements: {} }] }] };
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderAdmissionSection({ container, university, annualCostForTrack: () => null });
  assert.equal(container.innerHTML.split(note).length - 1, 1);
});

test("funding displays its published coverage without inferring a competitive award", () => {
  const description = "Covers tuition and health insurance plus a stipend.";
  const university = { id: "scoped-award", admission_categories: [{ id: "graduate", label: "Graduate", study_level: "Master", applicant_route: "graduate", requirement_profiles: [{ id: "general", requirements: {}, funding_options: [{ id: "program-award", label: "Program support", funding_type: "grant", funding_source: "program", description }] }] }] };
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderAdmissionSection({ container, university, annualCostForTrack: () => null });
  assert.match(container.innerHTML, /Covers tuition and health insurance plus a stipend/);
  assert.doesNotMatch(container.innerHTML, /competition or ranking/);
});

test("renderFinanceSection hydrates cost-progress bars with data-width-pct instead of inline styles", () => {
  setLanguage("eng", { persist: false, emit: false });
  const previousProfile = loadProfile();
  const previousSearch = window.location.search;
  saveProfile({ studyLevel: "Bachelor" });
  window.location.search = "";
  const segments = [];
  const container = {
    _html: "",
    set innerHTML(html) {
      this._html = html;
      segments.length = 0;
      for (const match of String(html).matchAll(/data-width-pct="([^"]+)"/g)) {
        const properties = {};
        segments.push({
          getAttribute: () => match[1],
          style: { setProperty: (name, value) => { properties[name] = value; } },
          properties,
        });
      }
    },
    get innerHTML() {
      return this._html;
    },
    querySelectorAll: (selector) => (selector === "[data-width-pct]" ? segments : []),
  };
  try {
    renderFinanceSection({
      annualCostForTrack: () => null,
      container,
      university: {
        id: "ux-cost-progress-bars",
        finance: {
          total_cost_year_usd: 10000,
          costs_breakdown_year_usd: {
            Tuition: 7000,
            Room_and_Board: 3000,
          },
        },
        admission_categories: [
          {
            id: "undergraduate",
            label: "Undergraduate",
            study_level: "Bachelor",
            requirement_profiles: [{
              id: "general",
              label: "General",
              funding_options: [{ id: "paid", label: "Self-funded", funding_type: "paid" }],
            }],
          },
        ],
      },
    });
    assert.doesNotMatch(container.innerHTML, /\bstyle\s*=/i);
    assert.match(container.innerHTML, /class="cost-progress-segment cost-color-1" data-width-pct="70"/);
    assert.match(container.innerHTML, /class="cost-progress-segment cost-color-2" data-width-pct="30"/);
    assert.deepEqual(
      segments.map((node) => node.properties),
      [
        { "--fill-width": "70%", "--fill-scale": "0.7" },
        { "--fill-width": "30%", "--fill-scale": "0.3" },
      ],
    );
  } finally {
    saveProfile(previousProfile);
    window.location.search = previousSearch;
  }
});
