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

export async function fetchCompareProfiles(ids, options = {}) {
  const apiBase = String(options.apiBase || "");
  const fetchImpl = typeof options.fetchImpl === "function" ? options.fetchImpl : fetch;
  const loadProfileForApi = typeof options.loadProfileForApi === "function"
    ? options.loadProfileForApi
    : () => ({});
  const cleanIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!cleanIds.length) {
    return { chances: new Map(), rois: new Map() };
  }

  const profile = loadProfileForApi();
  try {
    const response = await fetchImpl(`${apiBase}/universities/compare-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ university_ids: cleanIds, profile }),
    });

    if (!response.ok) throw new Error("Compare request failed");

    const results = await response.json();
    const chances = new Map();
    const rois = new Map();

    cleanIds.forEach((id) => {
      const data = results[id];
      if (data) {
        chances.set(id, data.uniChance);
        rois.set(id, data.roi);
      } else {
        chances.set(id, null);
        rois.set(id, null);
      }
    });

    return { chances, rois };
  } catch (error) {
    return fetchCompareProfilesIndividually(cleanIds, { apiBase, fetchImpl, profile });
  }
}

async function fetchJsonOrNull(fetchImpl, url, profile) {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function fetchCompareProfilesIndividually(ids, options = {}) {
  const apiBase = String(options.apiBase || "");
  const fetchImpl = typeof options.fetchImpl === "function" ? options.fetchImpl : fetch;
  const profile = options.profile || {};
  const rows = await Promise.all(ids.map(async (id) => {
    const encodedId = encodeURIComponent(id);
    const [chance, roi] = await Promise.all([
      fetchJsonOrNull(fetchImpl, `${apiBase}/universities/${encodedId}/uni-chance`, profile),
      fetchJsonOrNull(fetchImpl, `${apiBase}/universities/${encodedId}/roi`, profile),
    ]);
    return [id, chance, roi];
  }));

  return {
    chances: new Map(rows.map(([id, chance]) => [id, chance])),
    rois: new Map(rows.map(([id, , roi]) => [id, roi])),
  };
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
import { formatMoney } from "../../currency.js";
import { 
  nested, 
  loadProfile, 
  getExamDisplayName,
  formatExamValue,
} from "../../utils.js";
import { 
  toFiniteNumber, 
  formatUiNumber,
  trUniversityName,
  trCity,
  trState,
  trCountry,
  trTrackLabel,
  textOrUnknown,
  unknownFieldText,
  ruPlural,
  modeAwareAnnualCost,
  normalizeStudyModeForCost,
  trTrackDescription,
  COMPARE_ADMISSION_CHOICES_KEY,
  formatCampusSizeValue,
  trProgramName,
  trFactSource,
  trFactStatus,
} from "../_shared.js";
import { 
  translateDataValue, 
  translateProgramName, 
  translateTrackLabel, 
  translateWord,
  translateAdmissionText,
  humanizeMachineLabel 
} from "../../university-translations.js";
import { 
  getAdmissionChoicesFromCategories,
  getGrantsFromCategories,
  renderTrackFundingBadge, 
} from "../../university-detail-helpers.js";

export function formatCompareCost(value, fallbackKey = "placeholder.field.cost", fallback = "Cost", currency = "USD") {
  const n = toFiniteNumber(value);
  return n !== null ? formatMoney(n, String(currency || "USD").trim().toUpperCase()) : unknownFieldText(fallbackKey, fallback);
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

function firstObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

export function comparePublishedAdmission(u, compareAdmissionChoices = null) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  const universityWide = firstObject(u?.academics?.admissions?.university_wide);
  const fallbackMeta = firstObject(u?.academics?.acceptance_rate_percent_meta);
  const published = firstObject(option?.published_admission, universityWide);
  const provenance = firstObject(published?.provenance, fallbackMeta);
  const value = toFiniteNumber(
    published?.rate_percent
    ?? published?.acceptance_rate_percent
    ?? u?.academics?.acceptance_rate_percent
  );
  const scopeRaw = String(published?.scope || published?.kind || "institution").trim().toLowerCase();
  const scope = scopeRaw.includes("program") || scopeRaw.includes("course") ? "program" : "institution";
  const basis = firstObject(published?.basis, published?.counts, provenance?.basis);
  return {
    value,
    scope,
    audience: String(published?.audience || "all").trim().toLowerCase(),
    cycle: String(published?.cycle || basis?.cycle || "").trim(),
    source: String(published?.source || provenance?.source || fallbackMeta?.source || "").trim(),
    sourceUrl: String(published?.source_url || provenance?.source_url || fallbackMeta?.source_url || "").trim(),
    verifiedAt: String(published?.verified_at || provenance?.verified_at || fallbackMeta?.verified_at || "").trim(),
    confidence: String(published?.confidence || provenance?.confidence || fallbackMeta?.confidence || "").trim().toLowerCase(),
  };
}

export function compareAcceptanceText(u, compareAdmissionChoices = null) {
  const acc = comparePublishedAdmission(u, compareAdmissionChoices).value;
  return acc !== null ? `${Math.round(acc * 100) / 100}%` : t("common.na", "N/A");
}

export function compareAidText(u) {
  const grants = getGrantsFromCategories(u?.admission_categories);
  if (Array.isArray(grants) && grants.length > 0) {
    const names = Array.from(
      new Set(
        grants.map((g) => trTrackDescription(u?.id, g.id, g.name)).filter(Boolean)
      )
    );
    if (names.length > 0) {
      return names.join(", ");
    }
  }
  return t("no_grants_available", "No grants available");
}

function isBachelorStudyLevel(level) {
  const normalized = String(level || "").trim().toLowerCase();
  return /bachelor|undergraduate|бакалавр|бакалавриат/.test(normalized);
}

export function compareBachelorPrograms(u) {
  const programs = Array.isArray(u?.academics?.programs) ? u.academics.programs : [];
  return programs.filter((program) => {
    const levels = Array.isArray(program?.study_levels) ? program.study_levels : [];
    if (!levels.length) return true;
    return levels.some(isBachelorStudyLevel);
  });
}

export function compareBachelorProgramNames(u) {
  const programs = compareBachelorPrograms(u);
  return Array.from(new Set(
    programs
      .map((program) => {
        const name = String(program?.name || "").trim();
        if (!name) return "";
        if (typeof trProgramName === "function") return trProgramName(name);
        if (typeof translateProgramName === "function") return translateProgramName(name, name);
        return name;
      })
      .filter(Boolean)
  ));
}

export function compareProgramSummary(u) {
  const names = compareBachelorProgramNames(u);
  if (!names.length) return typeof t === "function" ? t("common.na", "N/A") : "N/A";
  const visible = names.slice(0, 2).join(", ");
  const remaining = names.length - 2;
  const more = remaining > 0 ? ` +${remaining}` : "";
  return `${visible}${more}`;
}

export function compareProgramTitle(u) {
  const names = compareBachelorProgramNames(u);
  return names.length > 2 ? names.join(", ") : "";
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

export function compareAdmissionChoiceOptionLabel(entry, u) {
  const opt = entry?.option || entry || {};
  const catRaw = String(opt.category_label || opt.category_id || "").trim();
  const profRaw = String(opt.requirement_profile_label || opt.requirement_profile_id || "").trim();

  let cat = trTrackLabel(catRaw) || translateTrackLabel(catRaw, catRaw);
  let prof = trTrackLabel(profRaw) || translateTrackLabel(profRaw, profRaw);

  const lang = typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "eng";
  const isRu = lang === "ru" || lang === "rus";

  // Clean UNT / general redundancy (e.g. "UNT Admission" and "UNT")
  if (/^UNT Admission$/i.test(catRaw) || /поступление по ент/i.test(cat)) {
    cat = isRu ? "ЕНТ" : "UNT";
  }
  if (/^UNT$/i.test(profRaw)) {
    prof = isRu ? "ЕНТ" : "UNT";
  }

  const parts = [];
  if (cat && (!prof || cat.toLowerCase() !== prof.toLowerCase())) {
    parts.push(cat);
  }
  if (prof && (!cat || cat.toLowerCase() !== prof.toLowerCase())) {
    parts.push(prof);
  } else if (!parts.length && cat) {
    parts.push(cat);
  }

  const fType = String(opt.funding_type || "").toLowerCase();
  const fProg = String(opt.funding_program || "").trim();
  const fDesc = String(opt.funding_description || "").trim();
  const fLabel = String(opt.label || "").trim();

  let fundText = "";
  if (fType === "paid") {
    fundText = translateWord("filter_paid", isRu ? "Платное" : "Paid");
  } else if (fType === "grant") {
    let grantName = "";
    if (/State Educational Grant|State Grant/i.test(fProg) || /State Grant/i.test(fLabel)) {
      grantName = isRu ? "Государственный грант" : "State Grant";
    } else if (/Rector/i.test(fProg) || /Rector/i.test(fLabel)) {
      grantName = isRu ? "Грант ректора" : "Rector Grant";
    } else if (/Abai/i.test(fProg) || /Abai/i.test(fLabel)) {
      grantName = isRu ? "Стипендия им. Абая" : "Abai Scholarship";
    } else if (/Al-Farabi Olympiad/i.test(fProg)) {
      grantName = isRu ? "Олимпиадный грант" : "Al-Farabi Olympiad Grant";
    } else if (fProg) {
      grantName = isRu ? (trTrackDescription(u?.id, opt.id, fProg) || fProg) : fProg;
    } else if (fDesc && fDesc.length < 35) {
      grantName = fDesc;
    } else if (fLabel && !/^profile/i.test(fLabel)) {
      grantName = isRu ? (trTrackLabel(fLabel) || translateTrackLabel(fLabel, fLabel)) : fLabel;
    } else {
      grantName = translateWord("filter_grant", isRu ? "Грант" : "Grant");
    }

    if (grantName && !/грант|стипенди|grant|scholarship|aid/i.test(grantName)) {
      grantName += isRu ? " (Грант)" : " (Grant)";
    }
    fundText = grantName;
  }

  if (fundText) parts.push(fundText);
  return parts.join(" · ") || opt.choice_key || opt.id || "";
}

export function compareChoiceKey(selection) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return "";
  return String(selection.choiceKey || selection.choice_key || "").trim();
}

export function normalizeCompareAdmissionSelection(selection) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;
  const choiceKey = compareChoiceKey(selection);
  if (!choiceKey) return null;
  return {
    programId: String(selection.programId || selection.program_id || "").trim(),
    programName: String(selection.programName || selection.program_name || "").trim(),
    categoryId: String(selection.categoryId || selection.category_id || "").trim(),
    requirementProfileId: String(selection.requirementProfileId || selection.requirement_profile_id || "").trim(),
    fundingOptionId: String(selection.fundingOptionId || selection.funding_option_id || "").trim(),
    choiceKey,
  };
}

export function compareAdmissionSelectionFromEntry(entry) {
  const option = entry?.option || {};
  const programIds = Array.isArray(option?.program_ids) ? option.program_ids : [];
  const programNames = Array.isArray(option?.program_names) ? option.program_names : [];
  return {
    programId: String(programIds[0] || "").trim(),
    programName: String(programNames[0] || "").trim(),
    categoryId: String(option?.category_id || "").trim(),
    requirementProfileId: String(option?.requirement_profile_id || "").trim(),
    fundingOptionId: String(option?.funding_option_id || "").trim(),
    choiceKey: String(entry?.key || "").trim(),
  };
}

export function readCompareAdmissionChoices() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPARE_ADMISSION_CHOICES_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map();
    return new Map(Object.entries(raw)
      .map(([id, selection]) => [String(id || "").trim(), normalizeCompareAdmissionSelection(selection)])
      .filter(([id, selection]) => id && selection));
  } catch (e) {
    return new Map();
  }
}

export function writeCompareAdmissionChoices(choicesMap, activeIds = []) {
  const pairSet = new Set((Array.isArray(activeIds) ? activeIds : []).map(id => String(id || "").trim()).filter(Boolean));
  const data = {};
  if (choicesMap && typeof choicesMap.forEach === "function") {
    choicesMap.forEach((selection, id) => {
      const cleanId = String(id || "").trim();
      const normalized = normalizeCompareAdmissionSelection(selection);
      if ((!pairSet.size || pairSet.has(cleanId)) && normalized) data[cleanId] = normalized;
    });
  }
  try {
    localStorage.setItem(COMPARE_ADMISSION_CHOICES_KEY, JSON.stringify(data));
  } catch (e) {
    // Ignore storage failures
  }
}

export function compareSelectedAdmissionEntry(u, compareAdmissionChoices = null) {
  const entries = compareAdmissionOptionEntries(u);
  if (!entries.length) return null;
  const uniId = String(u?.id || "").trim();
  const choices = compareAdmissionChoices || readCompareAdmissionChoices();
  const selection = choices && typeof choices.get === "function"
    ? choices.get(uniId)
    : null;
  const selectedKey = typeof selection === "object" && selection
    ? String(selection.choiceKey || selection.choice_key || "").trim()
    : String(selection || "").trim();
  if (!selectedKey) return entries[0] || null;
  return entries.find((entry) => entry.key === selectedKey) || entries[0] || null;
}

export function compareSelectedAdmissionOption(u, compareAdmissionChoices = null) {
  return compareSelectedAdmissionEntry(u, compareAdmissionChoices)?.option || null;
}

export function compareSelectedFinance(u, compareAdmissionChoices = null) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  return (option?.finance_override && typeof option.finance_override === "object")
    ? option.finance_override
    : (u?.finance || {});
}

export function compareSelectedAnnualCost(u, compareAdmissionChoices = null) {
  const finance = compareSelectedFinance(u, compareAdmissionChoices);
  const profileMode = normalizeStudyModeForCost(loadProfile()?.studyMode || loadProfile()?.study_mode || "");
  const modeCost = modeAwareAnnualCost(finance, profileMode);
  const total = modeCost ?? finance?.total_cost_year_usd ?? u?.finance?.total_cost_year_usd;
  return toFiniteNumber(total);
}

export function compareSelectedCostContext(u, compareAdmissionChoices = null) {
  const finance = compareSelectedFinance(u, compareAdmissionChoices);
  const fallbackFact = firstObject(u?.fact_provenance?.facts?.tuition_total_cost_year_usd);
  const total = compareSelectedAnnualCost(u, compareAdmissionChoices);
  const min = toFiniteNumber(finance?.total_cost_year_min ?? total);
  const max = toFiniteNumber(finance?.total_cost_year_max ?? min);
  const urls = Array.isArray(finance?.costs_breakdown_source_urls) ? finance.costs_breakdown_source_urls : [];
  return {
    min,
    max: max !== null && min !== null && max >= min ? max : min,
    currency: String(finance?.currency || u?.finance?.currency || "USD").trim().toUpperCase(),
    academicYear: String(finance?.academic_year || "").trim(),
    feeStatus: String(finance?.fee_status || "").trim().toLowerCase(),
    scope: String(finance?.scope || (finance === u?.finance ? "institution" : "program")).trim().toLowerCase(),
    source: String(finance?.source || fallbackFact?.source || "").trim(),
    sourceUrl: String(finance?.source_url || urls[0] || fallbackFact?.source_url || "").trim(),
    verifiedAt: String(finance?.verified_at || fallbackFact?.verified_at || "").trim(),
  };
}

export function formatCompareCostRange(context) {
  const min = toFiniteNumber(context?.min);
  const max = toFiniteNumber(context?.max);
  const currency = String(context?.currency || "USD");
  if (min === null) return t("common.na", "N/A");
  if (max === null || Math.abs(max - min) <= 0.000001) return formatCompareCost(min, "placeholder.field.cost", "Cost", currency);
  return `${formatCompareCost(min, "placeholder.field.cost", "Cost", currency)}–${formatCompareCost(max, "placeholder.field.cost", "Cost", currency)}`;
}

export function compareCostContextText(context) {
  const feeStatus = String(context?.feeStatus || "").trim().toLowerCase();
  const scope = String(context?.scope || "").trim().toLowerCase();
  const feeLabels = {
    international: t("universities.compare.fee_status.international", "international fee status"),
    overseas: t("universities.compare.fee_status.overseas", "overseas fee status"),
    home: t("universities.compare.fee_status.home", "home fee status"),
  };
  const scopeLabels = {
    program: t("universities.compare.scope.program", "course-specific"),
    institution: t("universities.compare.scope.institution", "institution-wide"),
    undergraduate: t("universities.compare.scope.undergraduate", "undergraduate"),
  };
  return [
    String(context?.academicYear || "").trim(),
    feeLabels[feeStatus] || feeStatus,
    scopeLabels[scope] || scope,
  ].filter(Boolean).join(" · ") || t("common.na", "N/A");
}

export function compareAidPolicyText(u) {
  const aid = firstObject(u?.finance?.financial_aid);
  if (!Object.keys(aid).length) return t("common.na", "N/A");
  const parts = [];
  if (aid.basis === "need" || aid.need_based) parts.push(t("universities.compare.aid.need_based", "Need-based"));
  if (aid.basis === "merit" || aid.merit_based) parts.push(t("universities.compare.aid.merit_based", "Merit-based"));
  if (aid.need_blind) parts.push(t("universities.compare.aid.need_blind", "Need-blind admission"));
  if (aid.meets_full_demonstrated_need) parts.push(t("universities.compare.aid.full_need", "Meets full demonstrated need"));
  if (aid.international_eligible) parts.push(t("universities.compare.aid.international", "Available to international students"));
  if (aid.annual_awards_min || aid.annual_awards_max) {
    const min = aid.annual_awards_min || aid.annual_awards_max;
    const max = aid.annual_awards_max || aid.annual_awards_min;
    parts.push(tFormat("universities.compare.aid.awards_year", { min: String(min), max: String(max) }, `${min}–${max} awards per year`));
  }
  return parts.length ? Array.from(new Set(parts)).join(" · ") : t("common.na", "N/A");
}

export function compareUndergraduateStructureText(u) {
  const structure = firstObject(u?.academics?.undergraduate_structure);
  const model = String(structure?.model || "").trim().toLowerCase();
  const modelLabel = model === "liberal_arts_then_concentration"
    ? t("universities.compare.structure.liberal_arts", "Four-year liberal arts; concentration chosen after admission")
    : (model === "course_entry"
      ? t("universities.compare.structure.course_entry", "Direct entry to a specific course")
      : "");
  const durationRaw = String(structure?.duration || "").trim().toLowerCase();
  const duration = durationRaw === "4 years"
    ? t("universities.compare.duration.four_years", "4 years")
    : (durationRaw === "3 or 4 years"
      ? t("universities.compare.duration.three_or_four_years", "3 or 4 years")
      : String(structure?.duration || "").trim());
  const teachingLabels = {
    lectures: t("universities.compare.teaching.lectures", "lectures"),
    seminars: t("universities.compare.teaching.seminars", "seminars"),
    tutorials: t("universities.compare.teaching.tutorials", "tutorials"),
    practicals: t("universities.compare.teaching.practicals", "practicals"),
  };
  const teaching = Array.isArray(structure?.teaching_formats)
    ? structure.teaching_formats.map((item) => teachingLabels[String(item || "").trim().toLowerCase()] || humanizeMachineLabel(item, item)).filter(Boolean).join(", ")
    : "";
  return [modelLabel, duration, teaching].filter(Boolean).join(" · ") || t("common.na", "N/A");
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
    .map(([key, value]) => `${getExamDisplayName(key)} ${formatExamValue(key, value)}`);
  return rows.length ? rows.slice(0, 3).join(", ") : t("common.na", "N/A");
}

export function compareAverageScoreText(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  const stats = (option?.stats_avg && typeof option.stats_avg === "object") ? option.stats_avg : {};
  const rows = Object.entries(stats)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${getExamDisplayName(key)} ${formatExamValue(key, value)}`);
  return rows.length ? rows.slice(0, 3).join(", ") : t("common.na", "N/A");
}

export function compareLanguageProofText(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  const requirements = Array.isArray(option?.language_requirements) ? option.language_requirements : [];
  const rows = [];
  requirements.forEach((entry) => {
    const req = (entry?.requirements && typeof entry.requirements === "object") ? entry.requirements : {};
    Object.entries(req).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") rows.push(`${getExamDisplayName(key)} ${formatExamValue(key, value)}`);
    });
    if (entry?.accept_native) rows.push(t("universities.compare.native_ok", "native accepted"));
  });
  return rows.length ? Array.from(new Set(rows)).slice(0, 4).join(", ") : t("common.na", "N/A");
}

export function compareExtraRequirementsText(u, compareAdmissionChoices) {
  const option = compareSelectedAdmissionOption(u, compareAdmissionChoices);
  const extras = Array.isArray(option?.extra_requirements) ? option.extra_requirements.filter(Boolean) : [];
  if (!extras.length) return typeof t === "function" ? t("common.na", "N/A") : "N/A";
  const visible = extras
    .slice(0, 2)
    .map((item) => (typeof trTrackDescription === "function" ? trTrackDescription(String(u?.id || ""), option?.id, item) : (typeof translateAdmissionText === "function" ? translateAdmissionText(item, item) : item)))
    .join("; ");
  const more = extras.length > 2 ? ` +${extras.length - 2}` : "";
  return `${visible}${more}`;
}

export function compareSourceText(u, factKey) {
  const fact = nested(u, ["fact_provenance", "facts", factKey], null);
  const source = String(fact?.source || "").trim();
  const status = String(fact?.status || u?.rank_meta?.status || "").trim();
  const translatedSource = source
    ? (typeof trFactSource === "function" ? trFactSource(source) : (typeof translateFactSource === "function" ? translateFactSource(source, source) : source))
    : "";
  const translatedStatus = status
    ? (typeof trFactStatus === "function" ? trFactStatus(status) : (typeof translateFactStatus === "function" ? translateFactStatus(status, status) : (typeof humanizeMachineLabel === "function" ? humanizeMachineLabel(status, status) : status)))
    : "";
  const parts = [translatedSource, translatedStatus].filter(Boolean);
  return parts.length ? parts.join(" - ") : (typeof t === "function" ? t("common.na", "N/A") : "N/A");
}

export function compareSourceMeta(u, factKey) {
  const fact = nested(u, ["fact_provenance", "facts", factKey], null);
  return {
    text: compareSourceText(u, factKey),
    url: String(fact?.source_url || "").trim(),
    verifiedAt: String(fact?.verified_at || "").trim(),
  };
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

export function compareAidScore(u) {
  const grants = getGrantsFromCategories(u?.admission_categories);
  return Array.isArray(grants) ? grants.length : 0;
}

export function compareCostBreakdownText(u, mode, compareAdmissionChoices) {
  const finance = compareSelectedFinance(u, compareAdmissionChoices);
  const breakdown = (finance?.costs_breakdown_year_usd && typeof finance.costs_breakdown_year_usd === "object")
    ? finance.costs_breakdown_year_usd
    : {};
  const matcher = mode === "tuition"
    ? (key) => /tuition|fee/i.test(key)
    : (key) => /housing|dorm|food|meal|living|room|board|books|supplies|insurance|transport/i.test(key);
  const entries = Object.entries(breakdown).filter(([key]) => matcher(String(key || "")));
  const values = entries
    .map(([, value]) => toFiniteNumber(value))
    .filter((value) => value !== null);
  if (!values.length) return t("common.na", "N/A");
  const currency = String(finance?.currency || u?.finance?.currency || "USD").trim().toUpperCase();
  const hasExplicitRange = entries.some(([key]) => /(?:_|\b)(?:min|max)(?:_|\b)/i.test(String(key || "")));
  if (hasExplicitRange && values.length > 1) {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return minimum === maximum
      ? formatCompareCost(minimum, "placeholder.field.cost", "Cost", currency)
      : `${formatCompareCost(minimum, "placeholder.field.cost", "Cost", currency)}–${formatCompareCost(maximum, "placeholder.field.cost", "Cost", currency)}`;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return formatCompareCost(total, "placeholder.field.cost", "Cost", currency);
}
