import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async (url) => {
  const target = String(url || "");
  if (target.endsWith("Localization/eng")) {
    return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8"); } };
  }
  if (target.endsWith("Localization/ru")) {
    return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/ru", import.meta.url), "utf8"); } };
  }
  return { ok: false, async text() { return ""; } };
};
global.DOMParser = class {
  parseFromString(html) {
    return { body: { textContent: String(html).replace(/<[^>]*>/g, "") } };
  }
};

const { initI18n, setLanguage, t } = await import("../../frontend/javascript/i18n.js");
const { translateFundingAwardField } = await import("../../frontend/javascript/university-translations.js");
const { getFundingAwardsForSelection, renderFinanceSection } = await import(
  "../../frontend/javascript/pages/university/render-sections.js"
);
const { buildCompareSpecs } = await import(
  "../../frontend/javascript/pages/universities/compare-specs.js"
);
await initI18n();

test("funding awards accept both legacy and current study-level shapes", () => {
  const finance = {
    scholarships_and_funding: [
      { id: "home-bursary", study_levels: ["Bachelor"], target_audience: "domestic_only" },
      { id: "combined-cycle", study_level: "Master / Doctorate" },
      { id: "hbs-mba", study_level: "Master", program_scope: "Harvard Business School MBA" },
    ],
  };
  const categories = [{
    id: "mba",
    label: "Harvard Business School MBA",
    program_names: ["MBA"],
    study_levels: ["Master"],
  }];

  assert.deepEqual(
    getFundingAwardsForSelection(finance, categories, "Bachelor").map((award) => award.id),
    ["home-bursary"],
  );
  assert.deepEqual(
    getFundingAwardsForSelection(finance, categories, "Doctorate").map((award) => award.id),
    ["combined-cycle"],
  );
  assert.deepEqual(
    getFundingAwardsForSelection(finance, categories, "Master", categories).map((award) => award.id),
    ["combined-cycle", "hbs-mba"],
  );
});

test("MBA awards are excluded from unrelated JD and MPA categories", () => {
  const finance = {
    scholarships_and_funding: [
      { id: "hbs-mba", study_level: "Master", program_scope: "Harvard Business School MBA" },
      { id: "broad-graduate", study_level: "Master / Doctorate", program_scope: "Full-time Harvard graduate courses" },
    ],
  };
  const jd = [{ id: "harvard_hls_jd", label: "Harvard Law School JD", program_names: ["JD"], study_levels: ["Master"] }];
  const mpa = [{ id: "harvard_hks_mpa", label: "Harvard Kennedy School MPA", program_names: ["MPA"], study_levels: ["Master"] }];
  const mba = [{ id: "harvard_hbs_mba", label: "Harvard Business School MBA", program_names: ["MBA"], study_levels: ["Master"] }];
  const collegeAward = { scholarships_and_funding: [{ id: "college-aid", study_level: "Bachelor", program_scope: "Harvard College undergraduate degree programs" }] };
  const college = [{ id: "harvard_college", label: "Harvard College undergraduate", study_levels: ["Bachelor"] }];

  assert.deepEqual(getFundingAwardsForSelection(finance, jd, "Master", jd).map((award) => award.id), ["broad-graduate"]);
  assert.deepEqual(getFundingAwardsForSelection(finance, mpa, "Master", mpa).map((award) => award.id), ["broad-graduate"]);
  assert.deepEqual(getFundingAwardsForSelection(finance, mba, "Master", mba).map((award) => award.id), ["hbs-mba", "broad-graduate"]);
  assert.deepEqual(getFundingAwardsForSelection(collegeAward, mba, "Bachelor", mba), []);
  assert.deepEqual(getFundingAwardsForSelection(collegeAward, college, "Bachelor", college).map((award) => award.id), ["college-aid"]);
});

test("Oxford course-restricted award appears only on its eligible routes", () => {
  const finance = { scholarships_and_funding: [{
    id: "oxford-weidenfeld-hoffmann-2027",
    study_level: "Master",
    program_ids: ["msc_advanced_computer_science_pgt", "mba_said_business_school_pgt", "bcl_bachelor_of_civil_law_pgt"],
    program_scope: "Oxford MSc Advanced Computer Science, MBA and BCL",
  }] };
  const advancedCs = [{ program_ids: ["msc_advanced_computer_science_pgt"], study_levels: ["Master"] }];
  const financeMsc = [{ program_ids: ["msc_mathematical_and_computational_finance_pgt"], study_levels: ["Master"] }];
  const bcl = [{ program_ids: ["bcl_bachelor_of_civil_law_pgt"], study_levels: ["Master"] }];
  assert.deepEqual(getFundingAwardsForSelection(finance, advancedCs, "Master").map((award) => award.id), ["oxford-weidenfeld-hoffmann-2027"]);
  assert.deepEqual(getFundingAwardsForSelection(finance, financeMsc, "Master"), []);
  assert.deepEqual(getFundingAwardsForSelection(finance, bcl, "Master").map((award) => award.id), ["oxford-weidenfeld-hoffmann-2027"]);
});

test("Imperial awards keep selected taught courses and CDT cohorts separate", () => {
  const finance = { scholarships_and_funding: [
    { id: "inspires", study_level: "Bachelor / Master", program_scope: "All undergraduate courses and selected postgraduate taught courses" },
    { id: "deans", study_level: "Master", program_ids: ["imperial-msc-finance"], program_scope: "Imperial Business School MSc programmes" },
    { id: "cdt", study_level: "Doctorate", program_scope: "Centre for Doctoral Training cohort programmes only" },
  ] };
  const undergraduate = [{ id: "imperial_eng", study_levels: ["Bachelor"] }];
  const computingMsc = [{ id: "imperial_pgt_stem_msc", program_ids: ["imperial-msc-advanced-computing"], study_levels: ["Master"] }];
  const financeMsc = [{ id: "imperial_pgt_business_msc_mba", program_ids: ["imperial-msc-finance"], study_levels: ["Master"] }];
  const computingPhd = [{ id: "imperial_pgr_phd_doctoral", program_ids: ["imperial-phd-computing"], study_levels: ["Doctorate"] }];
  assert.deepEqual(getFundingAwardsForSelection(finance, undergraduate, "Bachelor").map((award) => award.id), ["inspires"]);
  assert.deepEqual(getFundingAwardsForSelection(finance, computingMsc, "Master").map((award) => award.id), []);
  assert.deepEqual(getFundingAwardsForSelection(finance, financeMsc, "Master").map((award) => award.id), ["deans"]);
  assert.deepEqual(getFundingAwardsForSelection(finance, computingPhd, "Doctorate").map((award) => award.id), []);
});

test("finance view explains awards are not offers or net-price discounts", () => {
  setLanguage("eng", { persist: false, emit: false });
  const scholarshipContainer = { innerHTML: "" };
  const university = {
    id: "sample-university",
    finance: {
      currency: "USD",
      scholarships_and_funding: [{
        id: "need-award",
        name: "Need-Based Award",
        study_level: "Bachelor",
        program_scope: "Undergraduate course",
        applicant_scope: "International applicants",
        academic_year: "2027 entry",
        basis: "need",
        application_process: "separate",
        eligibility: "Applicants who submit the required financial materials.",
        coverage: "Individual award amount determined after review.",
        renewal: null,
        competition: "Selection is not guaranteed.",
        course_application_deadline: "2026-11-01",
        award_application_deadline: null,
        deadline_timezone: null,
        steps: ["Submit the course application", "Submit financial documents"],
        documents: ["CSS Profile"],
        source_url: "https://university.example/financial-aid",
        verified_at: "2026-09-23",
      }],
    },
    admission_categories: [{
      id: "bachelor",
      label: "Undergraduate",
      study_levels: ["Bachelor"],
    }],
  };

  renderFinanceSection({ scholarshipContainer, university });

  assert.match(scholarshipContainer.innerHTML, /funding opportunities, not award offers/i);
  assert.match(scholarshipContainer.innerHTML, /Estimated costs do not decrease/i);
  assert.match(scholarshipContainer.innerHTML, /Course application deadline/);
  assert.match(scholarshipContainer.innerHTML, /Award application deadline/);
  assert.match(scholarshipContainer.innerHTML, /Not published/);
  assert.match(scholarshipContainer.innerHTML, /Steps, documents, and conditions/);
});

test("scholarship selection inside a course application is described accurately", () => {
  setLanguage("eng", { persist: false, emit: false });
  const scholarshipContainer = { innerHTML: "" };
  renderFinanceSection({
    scholarshipContainer,
    university: {
      id: "imperial-college-london-uk",
      finance: {
        scholarships_and_funding: [{
          id: "presidents-phd-scholarships",
          name: "President's PhD Scholarships",
          study_level: "Doctorate",
          application_process: "course_application_selection",
          source_url: "https://www.imperial.ac.uk/study/fees-and-funding/postgraduate-doctoral/grants-scholarships/presidents-phd/",
        }],
      },
      admission_categories: [{ id: "phd", label: "PhD", study_levels: ["Doctorate"] }],
    },
  });
  assert.match(scholarshipContainer.innerHTML, /Select the award in the course application/);
  assert.doesNotMatch(scholarshipContainer.innerHTML, /Separate award application required/);
});

test("top-five structured award copy and Oxford Reach deadlines render in Russian", async () => {
  setLanguage("ru", { persist: false, emit: false });
  const universities = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));
  const oxford = universities.find((row) => row.id === "university-of-oxford-uk-oxford");
  const reach = oxford.finance.scholarships_and_funding.find((award) => award.id === "oxford-reach-oxford-scholarship-2027");

  assert.equal(translateFundingAwardField(reach, "eligibility", reach.eligibility).startsWith("Для рассмотрения на стипендию"), true);
  const scholarshipContainer = { innerHTML: "" };
  renderFinanceSection({
    scholarshipContainer,
    university: {
      id: oxford.id,
      finance: { scholarships_and_funding: [reach] },
      admission_categories: [{ id: "undergraduate", label: "Undergraduate", study_levels: ["Bachelor"] }],
    },
  });

  assert.match(scholarshipContainer.innerHTML, /Стипендия Reach Oxford/);
  assert.match(scholarshipContainer.innerHTML, /Заявка UCAS до 15 октября 2026 года, 18:00/);
  assert.match(scholarshipContainer.innerHTML, /Срок подачи заявки на стипендию: 2027.01-26 12:00/);
  assert.match(scholarshipContainer.innerHTML, /Присуждается около 2–3 стипендий в год/);
  assert.doesNotMatch(scholarshipContainer.innerHTML, /An Oxford admission offer is required|Around 2–3 awards per year|Scholarship application deadline/);
});

test("all catalogued top-five award copy fields have Russian labels", async () => {
  setLanguage("ru", { persist: false, emit: false });
  const universities = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));
  const topFive = new Set([
    "mit-usa-cambridge", "stanford-university-usa-ca", "harvard-usa-cambridge",
    "university-of-oxford-uk-oxford", "imperial-college-london-uk",
  ]);
  const fields = [
    "name", "program_scope", "applicant_scope", "academic_year", "eligibility", "coverage",
    "renewal", "competition", "deadline_timezone", "course_application_deadline", "award_application_deadline",
  ];
  const officialDocumentNames = new Set([
    "CSS Profile", "International Student Supplement", "MBA Financial Aid Application",
    "FAFSA", "PhD application and research proposal", "Complete Oxford graduate course application",
  ]);

  for (const university of universities.filter((row) => topFive.has(row.id))) {
    for (const award of university.finance?.scholarships_and_funding || []) {
      for (const field of fields) {
        const value = award[field];
        if (typeof value === "string" && !/^20\d{2}-\d{2}-\d{2}(?:\s|$)/.test(value)) {
          assert.notEqual(translateFundingAwardField(award, field === "academic_year" ? "cycle" : field, value), value, `${award.id}:${field}`);
        }
      }
      for (const [field, values] of [["steps", award.steps], ["documents", award.documents]]) {
        for (const [index, value] of (values || []).entries()) {
          if (!officialDocumentNames.has(value)) {
            assert.notEqual(translateFundingAwardField(award, `${field}.${index}`, value), value, `${award.id}:${field}.${index}`);
          }
        }
      }
      if (Array.isArray(award.coverage)) {
        for (const coverage of award.coverage) {
          assert.notEqual(t(`university.finance.award.coverage_item.${coverage}`, coverage), coverage, `${award.id}:coverage:${coverage}`);
        }
      }
    }
  }
  assert.match(t("university.finance.award.applicant_scope.domestic_only", "Home fee status only"), /статус Home/);
});

test("compare funding choice labels a grant as potential and unconfirmed", () => {
  setLanguage("eng", { persist: false, emit: false });
  const university = {
    id: "sample-university",
    admission_categories: [{
      id: "bachelor",
      label: "Undergraduate",
      study_levels: ["Bachelor"],
      requirement_profiles: [{
        id: "general",
        label: "General",
        funding_options: [{ id: "grant", label: "Merit grant", funding_type: "grant" }],
      }],
    }],
  };
  const specs = buildCompareSpecs([university]);
  const fundingSpec = specs.find((spec) => spec.key === "funding_choice");

  assert.ok(fundingSpec, "the funding comparison row should be available");
  assert.match(fundingSpec.getter(university), /Potential award; not confirmed/);
});

test("comparison does not show a funding-option price as a confirmed course cost", () => {
  setLanguage("eng", { persist: false, emit: false });
  const university = {
    id: "sample-university",
    finance: { currency: "USD", total_cost_year_usd: 45000 },
    admission_categories: [{
      id: "bachelor",
      label: "Undergraduate",
      study_levels: ["Bachelor"],
      requirement_profiles: [{
        id: "general",
        label: "General",
        funding_options: [{
          id: "grant",
          label: "Merit grant",
          funding_type: "grant",
          finance_override: { currency: "USD", total_cost_year_usd: 1 },
        }],
      }],
    }],
  };
  const otherUniversity = {
    id: "other-university",
    finance: { currency: "USD", total_cost_year_usd: 50000, costs_breakdown_year_usd: { tuition: 50000 } },
  };
  const specs = buildCompareSpecs([university, otherUniversity]);
  const totalCost = specs.find((spec) => spec.key === "total_cost");
  const tuition = specs.find((spec) => spec.key === "tuition_fees");

  assert.equal(totalCost.getter(university), null);
  assert.equal(totalCost.formatter(null, university), "N/A");
  assert.equal(tuition.getter(university), "N/A");
});
