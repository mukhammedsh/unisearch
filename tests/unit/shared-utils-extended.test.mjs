import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async (url) => {
  const target = String(url || "");
  for (const language of ["eng", "ru"]) {
    if (target.endsWith(`Localization/${language}`)) {
      return { ok: true, text: () => readFile(new URL(`../../frontend/Localization/${language}`, import.meta.url), "utf8") };
    }
  }
  return { ok: false, text: async () => "" };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const shared = await import("../../frontend/javascript/pages/_shared.js");
await initI18n();

test("shared URL and asset helpers encode untrusted identifiers", () => {
  assert.equal(shared.safePathSegment(" a/b?c "), "a%2Fb%3Fc");
  assert.equal(shared.buildApiUrl("/universities"), "http://localhost:8000/universities");
  assert.equal(shared.safeUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(shared.safeUrl("https://[invalid"), "");
  assert.equal(shared.uniLogoSrc("a/b"), "http://localhost:8000/universities/assets/logos-small/a%2Fb.png");
  assert.equal(shared.uniLogoSrc("a/b", { forceFull: true }), "http://localhost:8000/universities/assets/logos/a%2Fb.png");
});

test("presentation helpers render escaped text, icons, and location fallbacks", () => {
  const icon = shared.renderInlineIcon("map-pin", 18, "custom");
  assert.match(icon, /ui-icon--18/);
  assert.match(icon, /custom/);
  assert.match(shared.renderUniPill("check", "success", "🔥 Safe <label>"), /Safe &lt;label&gt;/);
  assert.match(shared.renderScholarshipLine("academic-cap", "grant", "• Merit & need"), /Merit &amp; need/);

  const location = shared.renderLocationMarkup({
    city: "Paris", country: "France", flagHtml: "<i>flag</i>", wrapperClass: "location", showIcon: false,
    cityClass: "city", countryClass: "country",
  });
  assert.match(location, /Paris,/);
  assert.match(location, /<i>flag<\/i>/);
  assert.doesNotMatch(location, /map-pin/);
  assert.match(shared.renderLocationMarkup({}), /Location/);
});

test("translation wrappers preserve empty values and known data labels", () => {
  setLanguage("eng", { persist: false, emit: false });
  assert.equal(shared.formatCampusSizeValue("very_large"), "Very Large");
  assert.equal(shared.formatCampusSizeValue(""), "");
  assert.equal(shared.trTrackLabel(""), "");
  assert.equal(shared.trTrackDescription("u", "t", ""), "");
  assert.equal(shared.trProgramName(""), "");
  assert.equal(shared.trFactSource(""), "");
  assert.equal(shared.trFactStatus(""), "");
  assert.equal(shared.textOrUnknown("  value  ", "missing", "Missing"), "value");
  assert.match(shared.textOrUnknown("", "placeholder.field.location", "Location"), /Location/);
  assert.match(shared.moneyOrUnknown(1200, "missing", "Missing", "USD"), /1,200/);
  assert.match(shared.moneyOrUnknown("bad", "common.na", "N/A"), /^N\/A/);
});

test("cost breakdown notes explain authoritative and partial coverage", () => {
  assert.match(shared.translateCostBreakdownLabel("Housing_Dorm"), /Housing|Dorm/i);
  assert.equal(shared.translateCostBreakdownLabel(""), "");
  assert.match(shared.costBreakdownCoverageNote(
    { costs_breakdown_status: "official_tuition_and_fees_only" }, [{ value: 100 }], 100,
  ), /tuition and institutional fee/i);
  assert.match(shared.costBreakdownCoverageNote(
    { costs_breakdown_status: "official_mandatory_breakdown" }, [{ value: 100 }], 100,
  ), /mandatory/i);
  assert.match(shared.costBreakdownCoverageNote({}, [{ value: 80 }], 100), /partial/i);
  assert.equal(shared.costBreakdownCoverageNote({}, [{ value: 100 }], 100), "");
});

test("language requirement groups distinguish requirements and admitted averages", () => {
  const track = {
    language_requirements_mode: "any",
    language_requirements: [{
      code: "en",
      accept_native: true,
      min_cefr: 4,
      recommended_cefr: 5,
      requirements: { IELTS: 6.5 },
      stats_avg: { IELTS: 7.5 },
    }, {
      code: "de",
      stats_avg: {},
    }],
  };
  const requirements = shared.renderTrackLanguageExamGroup(track);
  assert.match(requirements, /Any one language proof/);
  assert.match(requirements, /Native accepted/);
  assert.match(requirements, /B2/);
  assert.match(requirements, /IELTS/);
  const average = shared.renderTrackLanguageExamGroup(track, "average");
  assert.match(average, /Language average/);
  assert.match(average, /Recommended.*C1/s);
  assert.equal(shared.renderTrackLanguageExamGroup({}, "average"), "");
  assert.equal(shared.trackCefrLabel(1), "A1");
  assert.equal(shared.trackCefrLabel(6), "C2");
  assert.equal(shared.trackCefrLabel(9), "9");
});

test("duration and number localization handles Russian plural boundaries", () => {
  setLanguage("rus", { persist: false, emit: false });
  assert.equal(shared.ruPlural(1, "one", "few", "many"), "one");
  assert.equal(shared.ruPlural(3, "one", "few", "many"), "few");
  assert.equal(shared.ruPlural(11, "one", "few", "many"), "many");
  assert.equal(shared.ruPlural(-21, "one", "few", "many"), "one");
  assert.equal(shared.localizeDuration("4 years 2 months 3 weeks 1 day 5 semesters"), "4 года 2 месяца 3 недели 1 день 5 семестров");
  assert.equal(shared.localizeDuration(""), "");
  assert.match(shared.formatUiNumber(1234.5), /1[\s ]234,5/);
  assert.equal(shared.formatUiNumber("not-number"), "not-number");
  setLanguage("eng", { persist: false, emit: false });
  assert.equal(shared.localizeDuration("4 years"), "4 years");
});

test("admissions status and type contracts cover every supported official shape", () => {
  assert.equal(shared.formatAdmissionsPercent(12.345), "12.35%");
  assert.equal(shared.formatAdmissionsPercent(null), "");
  assert.equal(shared.admissionsStatusTone("official_rate"), "accent");
  assert.equal(shared.admissionsStatusTone("competition_ratio_only"), "success");
  assert.equal(shared.admissionsStatusTone("verified_null_only"), "muted");
  assert.equal(shared.admissionsStatusTone("unknown"), "warn");

  for (const status of ["official_rate", "official_counts", "official_signals", "competition_ratio_only", "verified_null_only", "no_official_source", "unknown"]) {
    assert.ok(shared.admissionsStatusLabel(status));
  }
  assert.equal(shared.rankingStatusLabel("not-published"), "N/A");
  assert.match(shared.rankingStatusLabel(""), /Global rank/i);
  assert.ok(shared.rankingStatusLabel("official_aggregated"));

  assert.equal(shared.admissionsDataTypeKey({ data_type: "cutoff" }), "cutoff");
  assert.equal(shared.admissionsDataTypeKey({ acceptance_rate_percent: 10 }), "acceptance_rate");
  assert.equal(shared.admissionsDataTypeKey({ metric_unit: "places" }), "capacity");
  assert.equal(shared.admissionsDataTypeKey({ metric_unit: "points" }), "cutoff");
  assert.equal(shared.admissionsDataTypeKey({ metric_unit: "grade_profile" }), "entry_standard");
  assert.equal(shared.admissionsDataTypeKey({ counts: { applicants: 10, offers: 2 } }), "counts");
  assert.equal(shared.admissionsDataTypeKey({}), "official_signal");
  for (const type of ["acceptance_rate", "capacity", "entry_standard", "cutoff", "counts", "competition_ratio", "verified-null", "other"]) {
    assert.ok(shared.admissionsDataTypeLabel(type));
    assert.ok(shared.admissionsSignalSummary({ data_type: type }));
  }
  assert.match(shared.admissionsSignalSummary({ data_type: "verified-null" }, { institutionWideOnly: true }), /university level/);
});

test("admissions sources prefer provenance and reject unsafe URLs", () => {
  assert.deepEqual(shared.admissionsPrimarySource({
    provenance: { source_url: "https://uni.example/report", source: "Official report" },
    sources: [{ url: "https://fallback.example" }],
  }), { url: "https://uni.example/report", label: "Official report" });
  assert.deepEqual(shared.admissionsPrimarySource({
    provenance: { source_url: "javascript:bad" },
    sources: [{ url: "https://uni.example/admissions", label: "Admissions page" }],
  }), { url: "https://uni.example/admissions", label: "Admissions page" });
  assert.equal(shared.admissionsPrimarySource({ sources: [{ url: "data:text/html,bad" }] }), null);

  const link = shared.renderAdmissionsSourceLink({ sources: [{ url: "https://www.uni.example/path" }] });
  assert.match(link, /uni\.example/);
  assert.match(link, /noopener noreferrer/);
  assert.equal(shared.renderAdmissionsSourceLink({}), "");
});

test("admissions fact chips preserve rates, official counts, ranges, and requirements", () => {
  const chips = shared.admissionsFactChips({
    status: "official_counts",
    acceptance_rate_percent: 25,
    metric_value: 50,
    metric_unit: "places",
    counts: {
      applicants: 200,
      admitted: 50,
      offers: 60,
      enrolled: 45,
      places: 50,
      a_level_10th_percentile: "AAA",
      a_level_90th_percentile: "A*A*A*",
      polytechnic_gpa_10th_percentile: 3.2,
      polytechnic_gpa_90th_percentile: 3.8,
      cycle: "2025",
    },
    provenance: { basis: { approximate_admission_range: "20-30%", supplementary_application_required: true } },
  });
  const text = chips.map((chip) => chip.text).join(" | ");
  assert.match(text, /25% Rate from official counts/);
  assert.match(text, /50 places/);
  assert.match(text, /Applicants 200/);
  assert.match(text, /A-Level results AAA-A\*A\*A\*/);
  assert.match(text, /Poly GPA 3\.2-3\.8/);
  assert.match(text, /Cycle: 2025/);
  assert.match(text, /Approx\. range 20-30%/);
  assert.match(text, /Supplementary required/);
  assert.match(shared.renderAdmissionsChipRow(chips), /admissions-chip--warn/);
  assert.equal(shared.renderAdmissionsChipRow([null, { text: "" }]), "");
});

test("admissions overview renders official program rows and hides verified-null rows from counts", () => {
  const admissions = {
    status_date: "2026-09-01",
    university_wide: {
      status: "official_counts", acceptance_rate_percent: 20, counts: { applicants: 100, admitted: 20 },
      provenance: { source_url: "https://uni.example/facts", source: "Fact book", verified_at: "2026-08-31" },
    },
    program_level: {
      status: "official_signals",
      sources: [{ url: "https://uni.example/programs", label: "Programs" }],
    },
    programs: [
      { program_name: "Computer Science", data_type: "capacity", metric_value: 50, metric_unit: "places" },
      { program_name: "History", data_type: "verified-null" },
    ],
  };
  const overview = shared.renderAdmissionsOverview(admissions);
  assert.match(overview, /20%/);
  assert.match(overview, /1 official row/);
  assert.match(overview, /Fact book/);
  const programs = shared.renderProgramAdmissionsSignals(admissions);
  assert.match(programs, /Computer Science/);
  assert.match(programs, /50 places/);
  assert.match(programs, /History/);
  assert.equal(shared.renderAdmissionsOverview(null), "");
  assert.equal(shared.renderProgramAdmissionsSignals({ programs: [] }), "");
});

test("cost-mode helpers normalize aliases and never invent negative tuition", () => {
  for (const mode of ["on-campus", "on campus", "campus", "in-person", "offline", "hybrid", "blended", "mixed"]) {
    assert.equal(shared.normalizeStudyModeForCost(mode), "on-campus");
  }
  for (const mode of ["online", "distance", "remote", "online / distance"]) {
    assert.equal(shared.normalizeStudyModeForCost(mode), "online");
  }
  assert.equal(shared.normalizeStudyModeForCost("unknown"), "any");
  assert.equal(shared.modeValueFromMap({ Distance: 10 }, "online"), 10);
  assert.equal(shared.modeValueFromMap(null, "online"), null);
  assert.equal(shared.extractTuitionCostFromBreakdown({ annual_tuition_fee: 9000 }), 9000);
  assert.equal(shared.extractTuitionCostFromBreakdown({ Tuition: -1 }), null);
  assert.equal(shared.extractTuitionCostFromBreakdown(null), null);
  assert.deepEqual(shared.modeAwareBreakdown({ total_cost_year_usd_by_mode: { online: 7000 } }, "online"), { Tuition: 7000 });
  assert.deepEqual(shared.modeAwareBreakdown({}, "online"), {});
});

test("sort, funding, and finite-number helpers keep query contracts stable", () => {
  for (const mode of ["uni_ai", "name_asc", "tuition_asc", "tuition_desc", "rank_asc", "relevance"]) {
    assert.equal(shared.normalizeSortMode(mode.toUpperCase()), mode);
  }
  assert.equal(shared.normalizeSortMode("bad"), "name_asc");
  assert.equal(shared.fundingPreferenceToQueryValue("grant"), "grant");
  assert.equal(shared.fundingPreferenceToQueryValue("any"), "");
  assert.equal(shared.toFiniteNumber(0), 0);
  assert.equal(shared.toFiniteNumber("2.5"), 2.5);
  assert.equal(shared.toFiniteNumber(""), null);
  assert.equal(shared.toFiniteNumber(Infinity), null);
});
