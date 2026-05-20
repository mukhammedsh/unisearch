export async function loadCompareUniversities(ids, options = {}) {
  const cleanIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const getRenderedUniversityById = options.getRenderedUniversityById || (() => null);
  const getUniversityDisplayNameById = options.getUniversityDisplayNameById || ((id) => id);
  const fetchUniversityDetailCached = options.fetchUniversityDetailCached;

  const fallbackById = new Map(cleanIds.map((id) => [
    id,
    getRenderedUniversityById(id) || { id, name: getUniversityDisplayNameById(id) },
  ]));

  const universities = await Promise.all(cleanIds.map(async (id) => {
    try {
      const detail = await fetchUniversityDetailCached(id);
      return detail || fallbackById.get(id);
    } catch (error) {
      return fallbackById.get(id);
    }
  }));

  return universities.filter(Boolean);
}

export async function fetchCompareChances(ids, options = {}) {
  const apiBase = String(options.apiBase || "");
  const fetchImpl = typeof options.fetchImpl === "function" ? options.fetchImpl : fetch;
  const loadProfileForApi = typeof options.loadProfileForApi === "function"
    ? options.loadProfileForApi
    : () => ({});
  const cleanIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  const chances = await Promise.all(cleanIds.map(async (id) => {
    try {
      const response = await fetchImpl(`${apiBase}/universities/${encodeURIComponent(id)}/uni-chance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: loadProfileForApi() }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }));

  return new Map(cleanIds.map((id, index) => [id, chances[index]]));
}

export async function resolveAiSortResult(options = {}) {
  const canUseFastFallback = Boolean(options.canUseFastFallback);
  const fetchAi = options.fetchAi;
  const fetchFallback = options.fetchFallback;
  const renderData = typeof options.renderData === "function" ? options.renderData : () => {};
  const isCurrentRun = typeof options.isCurrentRun === "function" ? options.isCurrentRun : () => true;
  const fastFallbackMs = Number(options.fastFallbackMs || 450);
  const onAiError = typeof options.onAiError === "function" ? options.onAiError : () => {};

  if (!canUseFastFallback) {
    try {
      const aiData = await fetchAi();
      if (!aiData?.__aborted && isCurrentRun()) {
        renderData(aiData);
      }
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      onAiError(error, "direct");
    }
    const fallbackData = await fetchFallback();
    if (!fallbackData?.__aborted && isCurrentRun()) {
      renderData(fallbackData);
    }
    return;
  }

  let aiResolved = false;
  let aiDataResult = null;

  const aiPromise = (async () => {
    try {
      const data = await fetchAi();
      aiResolved = true;
      aiDataResult = data;
      return data;
    } catch (error) {
      aiResolved = true;
      if (error?.name !== "AbortError") onAiError(error, "fast-fallback");
      return null;
    }
  })();

  const timeoutPromise = new Promise((resolve) => {
    window.setTimeout(() => resolve("timeout"), fastFallbackMs);
  });

  const firstResult = await Promise.race([aiPromise, timeoutPromise]);

  if (firstResult !== "timeout") {
    // AI responded within timeout
    if (aiDataResult && !aiDataResult.__aborted && isCurrentRun()) {
      renderData(aiDataResult);
    }
    return;
  }

  // Timeout reached, check if AI is ALREADY resolved (race condition)
  if (aiResolved) {
    if (aiDataResult && !aiDataResult.__aborted && isCurrentRun()) {
      renderData(aiDataResult);
    }
    return;
  }

  // Still no AI, fetch fallback
  const fallbackData = await fetchFallback();
  
  // If AI resolved while we were fetching fallback, or if this run is stale, don't render fallback
  if (!aiResolved && fallbackData && !fallbackData.__aborted && isCurrentRun()) {
    renderData(fallbackData);
  }

  // Wait for late AI anyway to upgrade quality
  const lateAiData = await aiPromise;
  if (lateAiData && !lateAiData.__aborted && isCurrentRun()) {
    renderData(lateAiData);
  }
}

import { t, tFormat, getCurrentLanguage } from "../../i18n.js";
import { 
  nested, 
  loadProfile, 
  moneyUSD, 
  getExamDisplayName 
} from "../../utils.js";
import { 
  toFiniteNumber, 
  formatUiNumber,
  trUniversityName,
  trCity,
  trState,
  trCountry,
  trProgramLanguage,
  trTrackLabel,
  textOrUnknown,
  unknownFieldText,
  ruPlural,
  modeAwareAnnualCost,
  normalizeStudyModeForCost
} from "../_shared.js";
import { 
  translateDataValue, 
  translateProgramName, 
  translateTrackLabel, 
  humanizeMachineLabel 
} from "../../university-translations.js";
import { 
  getAdmissionChoicesFromCategories,
  renderTrackFundingBadge, 
} from "../../university-detail-helpers.js";

export function formatCompareCost(value, fallbackKey = "placeholder.field.cost", fallback = "Cost") {
  const n = toFiniteNumber(value);
  return n !== null ? moneyUSD(n) : unknownFieldText(fallbackKey, fallback);
}

export function compareUniversityName(u) {
  const rawName = String(u?.name || u?.id || "").trim();
  return textOrUnknown(trUniversityName(u), "placeholder.field.university_name", rawName || "University name");
}

export function compareLocationText(u) {
  const city = trCity(nested(u, ["location", "city"], ""));
  const region = trState(nested(u, ["location", "state"], ""));
  const country = trCountry(nested(u, ["location", "country"], ""));
  return [city, region, country].filter(Boolean).join(", ") || t("common.na", "N/A");
}

export function compareRankText(u) {
  const rank = toFiniteNumber(u?.rank);
  return rank !== null && rank > 0 ? `#${rank}` : t("common.na", "N/A");
}

export function compareAcceptanceText(u) {
  const acc = toFiniteNumber(u?.academics?.acceptance_rate_percent);
  return acc !== null ? `${Math.round(acc * 100) / 100}%` : t("common.na", "N/A");
}

export function compareAidText(u) {
  const merit = nested(u, ["finance", "financial_aid", "merit_based"], false);
  const need = nested(u, ["finance", "financial_aid", "need_based"], false);
  if (merit && need) return t("universities.compare.aid_both", "Merit scholarships + need-based aid");
  if (merit) return t("universities.compare.aid_merit", "Merit scholarships");
  if (need) return t("universities.compare.aid_need", "Need-based financial aid");
  return t("common.na", "N/A");
}

export function compareBachelorPrograms(u) {
  const programs = Array.isArray(u?.academics?.programs) ? u.academics.programs : [];
  return programs.filter((program) => {
    const levels = Array.isArray(program?.study_levels) ? program.study_levels : [];
    if (!levels.length) return true;
    return levels.some((level) => /bachelor|undergraduate/i.test(String(level || "")));
  });
}

export function compareProgramSummary(u) {
  const programs = compareBachelorPrograms(u);
  if (!programs.length) return t("common.na", "N/A");
  const names = programs
    .map((program) => translateProgramName(String(u?.id || ""), String(program?.name || "").trim()))
    .filter(Boolean);
  const visible = names.slice(0, 2).join(", ");
  const more = names.length > 2 ? ` +${names.length - 2}` : "";
  return visible ? `${visible}${more}` : t("common.na", "N/A");
}

export function compareLanguageSummary(u) {
  const programs = compareBachelorPrograms(u);
  const langs = new Set();
  programs.forEach((program) => {
    const raw = program?.language;
    const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    values.forEach((value) => {
      const translated = trProgramLanguage(value);
      if (translated) langs.add(translated);
    });
  });
  if (!langs.size) return t("common.na", "N/A");
  return Array.from(langs).slice(0, 3).join(", ");
}

export function compareStudyModeText(u) {
  const formats = Array.isArray(u?.academics?.formats) ? u.academics.formats : [];
  if (formats.length) return formats.map((item) => translateDataValue("study_mode", item, item)).join(", ");
  const programs = compareBachelorPrograms(u);
  const modes = Array.from(new Set(programs.map((program) => String(program?.study_mode || "").trim()).filter(Boolean)));
  return modes.length ? modes.map((item) => translateDataValue("study_mode", item, item)).join(", ") : t("common.na", "N/A");
}

export function compareAdmissionOptionEntries(u) {
  const choices = getAdmissionChoicesFromCategories(u?.admission_categories);
  return choices.map((option, choiceIdx) => ({
    option,
    choiceIdx,
    key: String(option?.choice_key || option?.choiceKey || option?.id || "").trim(),
  })).filter((entry) => entry.key && entry.option);
}

export function compareSelectedAdmissionEntry(u, compareAdmissionChoices) {
  const uniId = String(u?.id || "").trim();
  const selection = compareAdmissionChoices.get(uniId);
  const selectedKey = typeof selection === "object" && selection
    ? String(selection.choiceKey || selection.choice_key || "").trim()
    : String(selection || "").trim();
  if (!selectedKey) return null;
  return compareAdmissionOptionEntries(u).find((entry) => entry.key === selectedKey) || null;
}

export function compareSelectedAdmissionOption(u, compareAdmissionChoices) {
  return compareSelectedAdmissionEntry(u, compareAdmissionChoices)?.option || null;
}

export function compareSelectedFinance(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  return (option?.finance_override && typeof option.finance_override === "object")
    ? option.finance_override
    : (u?.finance || {});
}

export function compareSelectedAnnualCost(u, compareAdmissionChoices) {
  const finance = compareSelectedFinance(u, compareAdmissionChoices);
  const profileMode = normalizeStudyModeForCost(loadProfile()?.studyMode || loadProfile()?.study_mode || "");
  const modeCost = modeAwareAnnualCost(finance, profileMode);
  const total = modeCost ?? finance?.total_cost_year_usd ?? u?.finance?.total_cost_year_usd;
  return toFiniteNumber(total);
}

export function compareTrackCountText(u) {
  const categories = Array.isArray(u?.admission_categories) ? u.admission_categories : [];
  const options = compareAdmissionOptionEntries(u).length;
  if (!categories.length) return t("common.na", "N/A");
  return tFormat("universities.compare.track_count", { count: String(categories.length), options: String(options) }, `${categories.length} categories / ${options} choices`);
}

export function compareTrackLabel(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  if (!option) return t("common.na", "N/A");
  const category = String(option?.category_label || option?.category_id || "").trim();
  const profile = String(option?.requirement_profile_label || option?.requirement_profile_id || "").trim();
  return Array.from(new Set([category, profile].filter(Boolean).map((item) => trTrackLabel(item) || translateTrackLabel(item, item)))).join(" - ") || t("common.na", "N/A");
}

export function compareFundingChoiceText(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  if (!option) return t("common.na", "N/A");
  const badgeHtml = renderTrackFundingBadge(option);
  const badge = (new DOMParser().parseFromString(badgeHtml, "text/html")).body.textContent?.trim() || "";
  const optionLabelRaw = String(option?.label || "").trim();
  const profileLabelRaw = String(option?.requirement_profile_label || "").trim();
  const categoryLabelRaw = String(option?.category_label || "").trim();
  const optionLabel = optionLabelRaw && optionLabelRaw !== profileLabelRaw && optionLabelRaw !== categoryLabelRaw ? trTrackLabel(optionLabelRaw) : "";
  return [badge, optionLabel].filter(Boolean).join(" - ") || compareAidText(u);
}

export function compareRequirementsText(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  const req = (option?.requirements && typeof option.requirements === "object") ? option.requirements : {};
  const rows = Object.entries(req || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${getExamDisplayName(key)} ${value}`);
  return rows.length ? rows.slice(0, 3).join(", ") : t("common.na", "N/A");
}

export function compareAverageScoreText(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  const stats = (option?.stats_avg && typeof option.stats_avg === "object") ? option.stats_avg : {};
  const rows = Object.entries(stats)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${getExamDisplayName(key)} ${value}`);
  return rows.length ? rows.slice(0, 3).join(", ") : t("common.na", "N/A");
}

export function compareLanguageProofText(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  const requirements = Array.isArray(option?.language_requirements) ? option.language_requirements : [];
  const rows = [];
  requirements.forEach((entry) => {
    const req = (entry?.requirements && typeof entry.requirements === "object") ? entry.requirements : {};
    Object.entries(req).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") rows.push(`${getExamDisplayName(key)} ${value}`);
    });
    if (entry?.accept_native) rows.push(t("universities.compare.native_ok", "native accepted"));
  });
  return rows.length ? Array.from(new Set(rows)).slice(0, 4).join(", ") : t("common.na", "N/A");
}

export function compareExtraRequirementsText(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  const extras = Array.isArray(option?.extra_requirements) ? option.extra_requirements.filter(Boolean) : [];
  if (!extras.length) return t("common.na", "N/A");
  const visible = extras.slice(0, 2).join("; ");
  const more = extras.length > 2 ? ` +${extras.length - 2}` : "";
  return `${visible}${more}`;
}

export function compareCostBreakdownText(u, mode, compareAdmissionChoices) {
  const finance = compareSelectedFinance(u, compareAdmissionChoices);
  const breakdown = (finance?.costs_breakdown_year_usd && typeof finance.costs_breakdown_year_usd === "object")
    ? finance.costs_breakdown_year_usd
    : {};
  const entries = Object.entries(breakdown);
  if (!entries.length) return t("common.na", "N/A");
  const matcher = mode === "tuition"
    ? (key) => /tuition|fee/i.test(key)
    : (key) => /housing|dorm|food|meal|living|room|board|books|supplies|insurance|transport/i.test(key);
  const selected = entries.filter(([key]) => matcher(String(key || "")));
  const total = selected.reduce((sum, [, value]) => {
    const n = toFiniteNumber(value);
    return n !== null ? sum + n : sum;
  }, 0);
  return total > 0 ? moneyUSD(total) : t("common.na", "N/A");
}

export function compareSourceText(u, factKey) {
  const fact = nested(u, ["fact_provenance", "facts", factKey], null);
  const source = String(fact?.source || "").trim();
  const status = String(fact?.status || u?.rank_meta?.status || "").trim();
  const parts = [source, status ? humanizeMachineLabel(status, status) : ""].filter(Boolean);
  return parts.length ? parts.join(" - ") : t("common.na", "N/A");
}

export function compareDataConfidenceText(u) {
  const sources = Array.isArray(u?.verified_sources) ? u.verified_sources.length : 0;
  const facts = u?.fact_provenance?.facts && typeof u.fact_provenance.facts === "object"
    ? Object.keys(u.fact_provenance.facts).length
    : 0;
  if (!sources && !facts) return t("common.na", "N/A");
  if (getCurrentLanguage() === "rus") {
    return `${sources} ${ruPlural(sources, "источник", "источника", "источников")} / ${facts} ${ruPlural(facts, "факт", "факта", "фактов")}`;
  }
  return tFormat("universities.compare.verified_count", { sources: String(sources), facts: String(facts) }, `${sources} sources / ${facts} facts`);
}

export function compareOutcomeText(u) {
  const salary = toFiniteNumber(u?.outcomes?.average_early_career_salary_usd);
  return salary !== null ? moneyUSD(salary) : t("common.na", "N/A");
}

export function compareStudentCountText(u) {
  const count = toFiniteNumber(u?.student_count);
  if (count === null) return t("common.na", "N/A");
  try {
    return new Intl.NumberFormat(getCurrentLanguage() === "rus" ? "ru-RU" : "en-US").format(count);
  } catch (e) {
    return String(count);
  }
}

export function compareCountText(value) {
  const n = toFiniteNumber(value);
  return n !== null ? formatUiNumber(n, { maximumFractionDigits: 0 }) : t("common.na", "N/A");
}

export function comparePercentText(value) {
  const n = toFiniteNumber(value);
  return n !== null ? `${formatUiNumber(n, { maximumFractionDigits: 2 })}%` : t("common.na", "N/A");
}

export function compareScoreText(value) {
  const n = toFiniteNumber(value);
  return n !== null ? formatUiNumber(n, { maximumFractionDigits: 2 }) : t("common.na", "N/A");
}

export function compareCampusAreaText(value) {
  const n = toFiniteNumber(value);
  return n !== null ? formatCampusSizeValue(n) : t("common.na", "N/A");
}

export function compareBachelorProgramCount(u) {
  return compareBachelorPrograms(u).length;
}

export function compareLanguageCount(u) {
  const langs = new Set();
  compareBachelorPrograms(u).forEach((program) => {
    const raw = program?.language;
    const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    values.forEach((value) => {
      const clean = String(value || "").trim();
      if (clean) langs.add(clean.toLowerCase());
    });
  });
  return langs.size;
}

export function compareStudyFormatCount(u) {
  const formats = Array.isArray(u?.academics?.formats) ? u.academics.formats : [];
  const fromPrograms = compareBachelorPrograms(u).map((program) => String(program?.study_mode || "").trim()).filter(Boolean);
  return new Set([...formats, ...fromPrograms].map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)).size;
}

export function compareMajorTagCount(u) {
  const tags = new Set();
  const rawTags = [
    ...(Array.isArray(u?.academics?.major_tags) ? u.academics.major_tags : []),
    ...(Array.isArray(u?.major_focus) ? u.major_focus : []),
  ];
  rawTags.forEach((tag) => {
    const clean = String(tag || "").trim().toLowerCase();
    if (clean) tags.add(clean);
  });
  compareBachelorPrograms(u).forEach((program) => {
    const programTags = Array.isArray(program?.major_tags) ? program.major_tags : [];
    programTags.forEach((tag) => {
      const clean = String(tag || "").trim().toLowerCase();
      if (clean) tags.add(clean);
    });
  });
  return tags.size;
}

export function compareFundingOptionCount(u) {
  return compareAdmissionOptionEntries(u).length;
}

export function compareExtraRequirementCount(u) {
  const extras = new Set();
  compareAdmissionOptionEntries(u).forEach((entry) => {
    const rows = Array.isArray(entry?.option?.extra_requirements) ? entry.option.extra_requirements : [];
    rows.forEach((item) => {
      const clean = String(item || "").trim();
      if (clean) extras.add(clean);
    });
  });
  return extras.size;
}

export function compareAidScore(u) {
  const merit = nested(u, ["finance", "financial_aid", "merit_based"], false) ? 1 : 0;
  const need = nested(u, ["finance", "financial_aid", "need_based"], false) ? 1 : 0;
  return merit + need;
}

export function compareCostBreakdownNumber(u, mode, compareAdmissionChoices) {
  const finance = compareSelectedFinance(u, compareAdmissionChoices);
  const breakdown = (finance?.costs_breakdown_year_usd && typeof finance.costs_breakdown_year_usd === "object")
    ? finance.costs_breakdown_year_usd
    : {};
  const entries = Object.entries(breakdown);
  if (!entries.length) return null;
  const matcher = mode === "tuition"
    ? (key) => /tuition|fee/i.test(key)
    : (key) => /housing|dorm|food|meal|living|room|board|books|supplies|insurance|transport/i.test(key);
  const total = entries.reduce((sum, [key, value]) => {
    if (!matcher(String(key || ""))) return sum;
    const n = toFiniteNumber(value);
    return n !== null ? sum + n : sum;
  }, 0);
  return total > 0 ? total : null;
}
