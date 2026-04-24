import { t, tFormat } from "../../i18n.js";
import { moneyUSD, nested, getExamDisplayName } from "../../utils.js";
import { 
  toFiniteNumber, 
  trCity, 
  trCountry, 
  trState, 
  trTrackLabel,
  unknownFieldText
} from "../_shared.js";
import { translateWord, humanizeMachineLabel, translateTemplate } from "../../university-translations.js";
import { getTrackFundingOptions, trackLookupKey } from "../../university-detail-helpers.js";

/**
 * Pure logic for university comparison
 */

export const COMPARE_PAIR_SIZE = 2;

export function normalizeCompareIdList(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
}

export function compareUniversityName(u) {
  return String(u?.name || "University");
}

export function compareLocationText(u) {
  const city = String(trCity(u?.location?.city || "") || "").trim();
  const region = String(trState(u?.location?.state || "") || "").trim();
  const country = String(trCountry(u?.location?.country || "") || "").trim();
  return [city, region, country].filter(Boolean).join(", ") || t("common.na", "N/A");
}

export function compareRankText(u) {
  const rank = toFiniteNumber(u?.rank);
  return rank !== null && rank > 0 ? `#${rank}` : t("common.na", "N/A");
}

export function compareStudentCountText(u) {
  const count = toFiniteNumber(u?.academics?.student_count);
  return count !== null ? count.toLocaleString() : t("common.na", "N/A");
}

export function compareProgramSummary(u) {
  const programs = Array.isArray(u?.programs) ? u.programs : [];
  if (!programs.length) return t("common.na", "N/A");
  return programs.slice(0, 3).map(p => p.name).join(", ") + (programs.length > 3 ? "..." : "");
}

export function compareStudyModeText(u) {
  const mode = String(u?.academics?.study_mode || "").trim();
  return mode ? translateWord(`study_mode_${mode.toLowerCase()}`, mode) : t("common.na", "N/A");
}

export function compareLanguageSummary(u) {
  const langs = Array.isArray(u?.academics?.languages) ? u.academics.languages : [];
  return langs.length ? langs.join(", ") : t("common.na", "N/A");
}

export function compareAcceptanceText(u) {
  const rate = toFiniteNumber(u?.academics?.acceptance_rate_percent);
  return rate !== null ? `${rate}%` : t("common.na", "N/A");
}

export function compareTrackLabel(u, choiceKey) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks.find(t => t.id === choiceKey) || tracks[0];
  return track ? trTrackLabel(track.label) : t("common.na", "N/A");
}

export function compareFundingChoiceText(u, choiceKey) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks.find(t => t.id === choiceKey) || tracks[0];
  if (!track) return t("common.na", "N/A");
  return track.is_grant ? t("universities.compare.funding.grant", "Grant/Scholarship") : t("universities.compare.funding.paid", "Self-funded / Paid");
}

export function compareRequirementsText(u, choiceKey) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks.find(t => t.id === choiceKey) || tracks[0];
  if (!track) return t("common.na", "N/A");
  const reqs = [];
  if (track.min_gpa) reqs.push(`GPA ${track.min_gpa}`);
  if (Array.isArray(track.exams) && track.exams.length) reqs.push(t("universities.compare.exams_required", "Exams required"));
  return reqs.length ? reqs.join(", ") : t("universities.compare.standard_requirements", "Standard");
}

export function compareLanguageProofText(u, choiceKey) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks.find(t => t.id === choiceKey) || tracks[0];
  if (!track || !Array.isArray(track.language_requirements) || !track.language_requirements.length) return t("common.na", "N/A");
  return track.language_requirements.map(lr => lr.code).join(", ");
}

export function compareSelectedAnnualCost(u, choiceKey) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks.find(t => t.id === choiceKey) || tracks[0];
  if (!track) return toFiniteNumber(nested(u, ["finance", "total_cost_year_usd"], 0));
  return toFiniteNumber(track.total_cost_year_usd) || toFiniteNumber(nested(u, ["finance", "total_cost_year_usd"], 0));
}

export function compareCostBreakdownNumber(u, type) {
  const finance = u?.finance || {};
  if (type === "tuition") return toFiniteNumber(finance.tuition_fees_usd);
  if (type === "living") return toFiniteNumber(finance.living_costs_usd);
  return null;
}

export function compareAidScore(u) {
  const aid = nested(u, ["finance", "financial_aid"], {});
  let score = 0;
  if (aid.merit_based) score += 50;
  if (aid.need_based) score += 50;
  return score;
}

export function compareAidText(u) {
  const merit = nested(u, ["finance", "financial_aid", "merit_based"], false);
  const need = nested(u, ["finance", "financial_aid", "need_based"], false);
  if (merit && need) return t("universities.compare.aid_both", "Merit scholarships + need-based aid");
  if (merit) return t("universities.compare.aid_merit", "Merit scholarships");
  if (need) return t("universities.compare.aid_need", "Need-based financial aid");
  return t("common.na", "N/A");
}

export function compareVerifiedSourceCount(u) {
  return Array.isArray(u?.meta?.sources) ? u.meta.sources.length : 0;
}

export function compareVerifiedFactCount(u) {
  return toFiniteNumber(u?.meta?.fact_count) || 0;
}

export function compareCountText(value) {
  const n = toFiniteNumber(value);
  return n !== null ? String(n) : t("common.na", "N/A");
}

export function compareDataConfidenceText(u) {
  const score = toFiniteNumber(u?.meta?.data_quality_score);
  if (score === null) return t("common.na", "N/A");
  if (score >= 0.9) return t("universities.compare.quality.high", "High");
  if (score >= 0.7) return t("universities.compare.quality.medium", "Medium");
  return t("universities.compare.quality.basic", "Basic");
}

export function compareCampusAreaText(value) {
  const n = toFiniteNumber(value);
  if (n === null) return t("common.na", "N/A");
  return `${n.toLocaleString()} mВІ`;
}

export function compareSourceText(u, field) {
  const source = nested(u, ["meta", "sources", field], "");
  return source ? tFormat("universities.compare.source_note", { source }, `Source: ${source}`) : "";
}

export function collectCompareExamKeys(universities, selector) {
  const keys = new Set();
  universities.forEach((u) => {
    const list = selector(u);
    if (Array.isArray(list)) list.forEach(k => keys.add(k));
  });
  return Array.from(keys);
}

export function compareSelectedRequirementKeys(u) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks[0];
  if (!track || !Array.isArray(track.exams)) return [];
  return track.exams.map(e => e.id);
}

export function compareSelectedAverageKeys(u) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks[0];
  if (!track || !track.stats_avg) return [];
  return Object.keys(track.stats_avg);
}

export function compareSelectedLanguageRequirementKeys(u) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks[0];
  if (!track || !Array.isArray(track.language_requirements)) return [];
  const keys = new Set();
  track.language_requirements.forEach(lr => {
    if (lr.requirements) Object.keys(lr.requirements).forEach(k => keys.add(k));
  });
  return Array.from(keys);
}

export function compareRequirementValue(u, examId) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks[0];
  if (!track || !Array.isArray(track.exams)) return null;
  const exam = track.exams.find(e => e.id === examId);
  return exam ? toFiniteNumber(exam.min_score) : null;
}

export function compareAverageScoreValue(u, examId) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks[0];
  if (!track || !track.stats_avg) return null;
  return toFiniteNumber(track.stats_avg[examId]);
}

export function compareLanguageRequirementValue(u, examId) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  const track = tracks[0];
  if (!track || !Array.isArray(track.language_requirements)) return null;
  for (const lr of track.language_requirements) {
    if (lr.requirements && lr.requirements[examId] !== undefined) {
      return toFiniteNumber(lr.requirements[examId]);
    }
  }
  return null;
}

export function compareScoreText(value) {
  const n = toFiniteNumber(value);
  return n !== null ? String(n) : t("common.na", "N/A");
}

export function compareSpecSections() {
  return {
    overview: t("universities.compare.section.overview", "Overview"),
    programs: t("universities.compare.section.programs", "Programs"),
    admissions: t("universities.compare.section.admissions", "Admissions"),
    finance: t("universities.compare.section.finance", "Finance"),
    outcomes: t("universities.compare.section.outcomes", "Outcomes"),
    data: t("universities.compare.section.data", "Data"),
    context: t("universities.compare.section.context", "Context"),
  };
}

export function compareCategoryMeta() {
  return {
    prestige: {
      icon: "academic-cap",
      title: t("universities.compare.category.prestige.title", "Prestige"),
      subtitle: t("universities.compare.category.prestige.subtitle", "Rankings and entry standards"),
    },
    admissions: {
      icon: "user-plus",
      title: t("universities.compare.category.admissions.title", "Admissions"),
      subtitle: t("universities.compare.category.admissions.subtitle", "Difficulty and requirements"),
    },
    finance: {
      icon: "banknotes",
      title: t("universities.compare.category.finance.title", "Finance"),
      subtitle: t("universities.compare.category.finance.subtitle", "Affordability and aid"),
    },
    outcomes: {
      icon: "briefcase",
      title: t("universities.compare.category.outcomes.title", "Outcomes"),
      subtitle: t("universities.compare.category.outcomes.subtitle", "Career and salary potential"),
    },
    data: {
      icon: "document-magnifying-glass",
      title: t("universities.compare.category.data.title", "Data quality"),
      subtitle: t("universities.compare.category.data.subtitle", "Verification level"),
    },
  };
}

export function buildCompareSpecs(universities, choices = new Map()) {
  const specs = [
    {
      key: "rank",
      section: "overview",
      category: "prestige",
      label: translateWord("global_rank", "Global Rank"),
      type: "number",
      direction: "lower",
      getter: (u) => toFiniteNumber(u?.rank),
      formatter: compareRankText,
      sourceKey: "rank",
      weight: 1.5,
      reasonMode: "rank",
      allowSinglePublishedAdvantage: true,
    },
    {
      key: "location",
      section: "overview",
      category: "context",
      label: t("universities.compare.row.location", "Location"),
      type: "text",
      direction: "neutral",
      getter: compareLocationText,
      score: false,
      reason: false,
    },
    {
      key: "student_count",
      section: "overview",
      category: "context",
      label: t("universities.compare.row.student_count", "Students"),
      type: "number",
      direction: "neutral",
      getter: (u) => toFiniteNumber(u?.academics?.student_count),
      formatter: (v) => v ? v.toLocaleString() : t("common.na", "N/A"),
      score: false,
      reason: false,
    },
    {
      key: "programs",
      section: "programs",
      category: "context",
      label: t("universities.compare.row.programs", "Programs shown"),
      type: "text",
      direction: "neutral",
      getter: compareProgramSummary,
      score: false,
      reason: false,
    },
    {
      key: "study_mode",
      section: "programs",
      category: "context",
      label: t("universities.compare.row.study_mode", "Study mode"),
      type: "text",
      direction: "neutral",
      getter: compareStudyModeText,
      score: false,
      reason: false,
    },
    {
      key: "language",
      section: "programs",
      category: "context",
      label: t("universities.compare.row.language", "Program language"),
      type: "text",
      direction: "neutral",
      getter: compareLanguageSummary,
      score: false,
      reason: false,
    },
    {
      key: "acceptance",
      section: "admissions",
      category: "admissions",
      label: t("ranking.acceptance", "Acceptance Rate"),
      type: "number",
      direction: "higher",
      getter: (u) => toFiniteNumber(u?.academics?.acceptance_rate_percent),
      formatter: compareAcceptanceText,
      sourceKey: "acceptance_rate_percent",
      weight: 1.2,
    },
    {
      key: "selected_track",
      section: "admissions",
      category: "admissions",
      label: t("universities.compare.row.selected_track", "Selected track"),
      type: "text",
      direction: "neutral",
      getter: (u) => compareTrackLabel(u, choices.get(String(u?.id))),
      score: false,
      reason: false,
    },
    {
      key: "funding_choice",
      section: "admissions",
      category: "finance",
      label: t("universities.compare.row.funding_choice", "Selected funding"),
      type: "text",
      direction: "neutral",
      getter: (u) => compareFundingChoiceText(u, choices.get(String(u?.id))),
      score: false,
      reason: false,
    },
    {
      key: "requirements",
      section: "admissions",
      category: "admissions",
      label: t("universities.compare.row.requirements", "Minimum requirements"),
      type: "text",
      direction: "neutral",
      getter: (u) => compareRequirementsText(u, choices.get(String(u?.id))),
      score: false,
      reason: false,
    },
    {
      key: "language_proof",
      section: "admissions",
      category: "admissions",
      label: t("universities.compare.row.language_proof", "Language proof"),
      type: "text",
      direction: "neutral",
      getter: (u) => compareLanguageProofText(u, choices.get(String(u?.id))),
      score: false,
      reason: false,
    },
    {
      key: "total_cost",
      section: "finance",
      category: "finance",
      label: t("universities.compare.row.total_cost", "Total / year"),
      type: "number",
      direction: "lower",
      getter: (u) => compareSelectedAnnualCost(u, choices.get(String(u?.id))),
      formatter: (value) => moneyUSD(value),
      sourceKey: "tuition_total_cost_year_usd",
      weight: 1.25,
    },
    {
      key: "tuition_fees",
      section: "finance",
      category: "finance",
      label: t("universities.compare.row.tuition_fees", "Tuition + fees"),
      type: "number",
      direction: "lower",
      getter: (u) => compareCostBreakdownNumber(u, "tuition"),
      formatter: (value) => moneyUSD(value),
    },
    {
      key: "living_costs",
      section: "finance",
      category: "finance",
      label: t("universities.compare.row.living_costs", "Living cost items"),
      type: "number",
      direction: "lower",
      getter: (u) => compareCostBreakdownNumber(u, "living"),
      formatter: (value) => moneyUSD(value),
    },
    {
      key: "aid",
      section: "finance",
      category: "finance",
      label: t("universities.compare.row.aid", "Aid"),
      type: "number",
      direction: "higher",
      getter: compareAidScore,
      formatter: (value, u) => compareAidText(u),
      reasonMode: "aid",
    },
    {
      key: "salary",
      section: "outcomes",
      category: "outcomes",
      label: t("universities.compare.row.salary", "Early career salary"),
      type: "number",
      direction: "higher",
      getter: (u) => toFiniteNumber(u?.outcomes?.average_early_career_salary_usd),
      formatter: (value) => moneyUSD(value),
      sourceKey: "average_early_career_salary_usd",
      weight: 1.1,
    },
    {
      key: "verified_sources",
      section: "data",
      category: "data",
      label: t("universities.compare.row.verified_sources", "Verified sources"),
      type: "number",
      direction: "higher",
      getter: compareVerifiedSourceCount,
      formatter: compareCountText,
      reason: false,
    },
    {
      key: "verified_facts",
      section: "data",
      category: "data",
      label: t("universities.compare.row.verified_facts", "Verified facts"),
      type: "number",
      direction: "higher",
      getter: compareVerifiedFactCount,
      formatter: compareCountText,
      reason: false,
    },
    {
      key: "data_quality",
      section: "data",
      category: "data",
      label: t("universities.compare.row.data_quality", "Verified data"),
      type: "text",
      direction: "neutral",
      getter: compareDataConfidenceText,
      score: false,
      reason: false,
    },
    {
      key: "campus_area",
      section: "context",
      category: "context",
      label: t("universities.compare.row.campus_area", "Campus area"),
      type: "number",
      direction: "neutral",
      getter: (u) => toFiniteNumber(u?.student_life?.campus_area_m2),
      formatter: compareCampusAreaText,
      score: false,
      reason: false,
    },
  ];

  const requirementKeys = collectCompareExamKeys(universities, compareSelectedRequirementKeys);
  requirementKeys.forEach((examId) => {
    specs.push({
      key: `req_${examId}`,
      section: "admissions",
      category: "admissions",
      label: tFormat("universities.compare.row.exam_requirement", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} requirement`),
      type: "number",
      direction: "lower",
      getter: (u) => compareRequirementValue(u, examId),
      formatter: compareScoreText,
    });
  });

  const averageScoreKeys = collectCompareExamKeys(universities, compareSelectedAverageKeys);
  averageScoreKeys.forEach((examId) => {
    specs.push({
      key: `avg_${examId}`,
      section: "admissions",
      category: "prestige",
      label: tFormat("universities.compare.row.exam_average", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} admitted score`),
      type: "number",
      direction: "higher",
      getter: (u) => compareAverageScoreValue(u, examId),
      formatter: compareScoreText,
    });
  });

  const languageRequirementKeys = collectCompareExamKeys(universities, compareSelectedLanguageRequirementKeys);
  languageRequirementKeys.forEach((examId) => {
    specs.push({
      key: `lang_${examId}`,
      section: "admissions",
      category: "admissions",
      label: tFormat("universities.compare.row.language_exam_requirement", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} language minimum`),
      type: "number",
      direction: "lower",
      getter: (u) => compareLanguageRequirementValue(u, examId),
      formatter: compareScoreText,
    });
  });

  return specs.filter((spec) => {
    const values = universities.map((u) => compareSpecRawValue(spec, u));
    if (spec.type === "text") {
      return values.some((value) => String(value || "").trim() && String(value || "").trim() !== t("common.na", "N/A"));
    }
    return values.some((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)));
  }).map((spec, index) => ({ ...spec, order: index }));
}

export function compareSpecRawValue(spec, u) {
  try {
    const value = spec.getter(u);
    if (spec.type === "number") return toFiniteNumber(value);
    if (spec.type === "boolean") return !!value;
    return value;
  } catch (e) {
    return spec.type === "number" ? null : "";
  }
}

export function compareSpecRows(universities, spec) {
  return universities
    .map((u) => ({
      university: u,
      id: String(u?.id || ""),
      value: compareSpecRawValue(spec, u),
    }))
    .filter((row) => row.id && row.value !== null && row.value !== undefined && row.value !== "" && (spec.type !== "number" || Number.isFinite(row.value)));
}

export function compareBestIdsForSpec(universities, spec) {
  if (spec.reason === false || spec.score === false) return new Set();
  if (!["higher", "lower"].includes(spec.direction)) return new Set();
  const rows = compareSpecRows(universities, spec);
  if (rows.length === 1 && spec.allowSinglePublishedAdvantage) return new Set([rows[0].id]);
  if (rows.length < 2) return new Set();
  const sorted = rows.slice().sort((a, b) => spec.direction === "higher" ? b.value - a.value : a.value - b.value);
  const best = sorted[0]?.value;
  if (!Number.isFinite(best)) return new Set();
  const bestRows = sorted.filter((row) => Math.abs(row.value - best) <= 0.000001);
  return bestRows.length === 1 ? new Set([bestRows[0].id]) : new Set();
}

export function compareMetrics(universities, choices = new Map()) {
  const specs = buildCompareSpecs(universities, choices);
  const bestBySpec = new Map(specs.map((spec) => [spec.key, compareBestIdsForSpec(universities, spec)]));
  const firstBestId = (key) => Array.from(bestBySpec.get(key) || [])[0] || "";
  return {
    specs,
    bestBySpec,
    bestRankId: firstBestId("rank"),
    lowestCostId: firstBestId("total_cost"),
    highestAcceptanceId: firstBestId("acceptance"),
  };
}

export function percentDeltaText(value, average, inverse = false) {
  if (!Number.isFinite(value) || !Number.isFinite(average) || average <= 0) return "";
  const delta = inverse ? ((average - value) / average) : ((value - average) / average);
  if (!Number.isFinite(delta) || delta <= 0.005) return "";
  return `${Math.round(delta * 100)}%`;
}

export function compareAdvantageText(spec, row, baseline) {
  const name = compareUniversityName(row.university);
  const metric = spec.label;
  const valueText = spec.formatter ? spec.formatter(row.value, row.university) : String(row.value);
  const baselineText = baseline ? (spec.formatter ? spec.formatter(baseline.value, baseline.university) : String(baseline.value)) : "";
  if (spec.reasonMode === "rank") {
    return tFormat(
      "universities.compare.reason.rank",
      { name, metric, value: valueText },
      `Best published rank: ${valueText}.`
    );
  }
  if (spec.reasonMode === "aid") {
    return tFormat(
      "universities.compare.reason.best",
      { name, metric, value: valueText },
      `${metric}: ${valueText}.`
    );
  }
  const delta = baseline ? percentDeltaText(row.value, baseline.value, spec.direction === "lower") : "";
  if (delta) {
    const key = spec.direction === "lower"
      ? "universities.compare.reason.lower_percent"
      : "universities.compare.reason.higher_percent";
    const fallback = spec.direction === "lower"
      ? `${metric}: ${valueText} instead of ${baselineText}.`
      : `${metric}: ${valueText} instead of ${baselineText}.`;
    return tFormat(key, { name, metric, percent: delta, value: valueText, baseline: baselineText }, fallback);
  }
  const key = spec.direction === "lower"
    ? "universities.compare.reason.lowest"
    : "universities.compare.reason.highest";
  const fallback = spec.direction === "lower"
    ? `Lowest ${metric}: ${valueText}.`
    : `Highest ${metric}: ${valueText}.`;
  return tFormat(key, { name, metric, value: valueText }, fallback);
}

export function buildCompareAdvantages(universities, metrics) {
  const byUniversity = new Map(universities.map((u) => [String(u?.id || ""), []]));
  (metrics.specs || []).forEach((spec) => {
    if (spec.reason === false || !["higher", "lower"].includes(spec.direction)) return;
    const rows = compareSpecRows(universities, spec);
    if (rows.length === 1 && spec.allowSinglePublishedAdvantage) {
      const target = byUniversity.get(rows[0].id);
      if (!target) return;
      target.push({
        key: spec.key,
        category: spec.category,
        strength: (spec.weight || 1) * 0.12,
        text: compareAdvantageText(spec, rows[0], null),
      });
      return;
    }
    if (rows.length < 2) return;
    const sorted = rows.slice().sort((a, b) => spec.direction === "higher" ? b.value - a.value : a.value - b.value);
    const bestValue = sorted[0]?.value;
    if (!Number.isFinite(bestValue)) return;
    const bestRows = sorted.filter((row) => Math.abs(row.value - bestValue) <= 0.000001);
    if (bestRows.length !== 1) return;
    const best = bestRows[0];
    const baseline = sorted.find((row) => row.id !== best.id) || null;
    const strengthDelta = baseline && Number.isFinite(baseline.value) && baseline.value > 0
      ? Math.abs(best.value - baseline.value) / Math.abs(baseline.value)
      : 0.08;
    const categoryBoost = spec.weight || 1;
    const strength = Math.max(0.02, strengthDelta) * categoryBoost;
    const target = byUniversity.get(best.id);
    if (!target) return;
    target.push({
      key: spec.key,
      category: spec.category,
      strength,
      text: compareAdvantageText(spec, best, baseline),
    });
  });
  byUniversity.forEach((items, id) => {
    byUniversity.set(id, items.sort((a, b) => b.strength - a.strength).slice(0, 6));
  });
  return byUniversity;
}

export function compareNormalizedScore(value, min, max, direction) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (Math.abs(max - min) <= 0.000001) return 50;
  const normalized = (value - min) / (max - min);
  const score = direction === "lower" ? (1 - normalized) : normalized;
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

export function buildCompareCategoryScores(universities, metrics) {
  const scores = new Map(universities.map((u) => [String(u?.id || ""), new Map()]));
  (metrics.specs || []).forEach((spec) => {
    if (spec.score === false || !["higher", "lower"].includes(spec.direction) || !spec.category) return;
    const rows = compareSpecRows(universities, spec);
    if (rows.length < 2) return;
    const values = rows.map((row) => row.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    rows.forEach((row) => {
      const score = compareNormalizedScore(row.value, min, max, spec.direction);
      if (score === null) return;
      const byCategory = scores.get(row.id);
      if (!byCategory) return;
      const list = byCategory.get(spec.category) || [];
      list.push({ score, weight: spec.weight || 1 });
      byCategory.set(spec.category, list);
    });
  });
  const averaged = new Map();
  scores.forEach((byCategory, id) => {
    const result = new Map();
    byCategory.forEach((items, category) => {
      const weightSum = items.reduce((sum, item) => sum + item.weight, 0);
      const scoreSum = items.reduce((sum, item) => sum + (item.score * item.weight), 0);
      if (weightSum > 0) result.set(category, Math.round(scoreSum / weightSum));
    });
    averaged.set(id, result);
  });
  return averaged;
}

export { trTrackLabel };


export function formatCompareCost(value, fallbackKey = "placeholder.field.cost", fallback = "Cost") {
  const n = toFiniteNumber(value);
  return n !== null ? moneyUSD(n) : unknownFieldText(fallbackKey, fallback);
}

export function compareAdmissionOptionEntries(u) {
  const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
  return tracks.flatMap((track, trackIdx) => {
    const options = getTrackFundingOptions(track);
    return options.map((option, optionIdx) => ({
      track,
      option,
      trackIdx,
      optionIdx,
      key: trackLookupKey(option, optionIdx),
    }));
  }).filter((entry) => entry.key && entry.option);
}

export function compareSelectedAdmissionEntry(u, choices) {
  const uniId = String(u?.id || "");
  const choiceKey = choices.get(uniId);
  if (!choiceKey) return null;
  const entries = compareAdmissionOptionEntries(u);
  return entries.find((e) => e.key === choiceKey) || null;
}

export function compareBestBadges(u, metrics) {
  const badges = [];
  const id = String(u?.id || "");
  if (id && metrics.bestRankId === id) badges.push(t("universities.compare.badge.best_rank", "Best rank"));
  if (id && metrics.lowestCostId === id) badges.push(t("universities.compare.badge.lowest_cost", "Lowest cost"));
  if (id && metrics.highestAcceptanceId === id) badges.push(t("universities.compare.badge.more_accessible", "More accessible"));
  if ((metrics.bestBySpec?.get("aid") || new Set()).has(id)) {
    badges.push(compareAidText(u));
  }
  return badges.slice(0, 3);
}
