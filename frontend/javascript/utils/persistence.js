import {
  EXAM_CONFIG,
  FALLBACK_LANG_LIMITS,
  canonicalizeExamId,
  clampNumberToLimits,
  getExamConfig,
  getLangExamLimits,
} from "./config.js";
import { API_LANG_DEFAULT, API_LANG_SUPPORTED, getUiLanguageForApi, normalizeUiLanguageForApi } from "./locale.js";
import { safeLocalStorage } from "./safe-storage.js";

const PROFILE_STORAGE_KEY = "unisearch_profile";
const FILTERS_KEY = "unisearch_filters";

let profileMemoryFallback = null;
let filtersMemoryFallback = {};

const PROFILE_DEFAULTS = {
  name: "User",
  budget: "",
  gpa: "",
  exams: [],
  languages: [],
  major: "",
  interests: "",
  studyMode: "Any",
  fundingType: "any",
  selectedAdmissionChoices: {},
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToStep(value, min, step) {
  const base = Number.isFinite(min) ? min : 0;
  const out = base + Math.round((value - base) / step) * step;
  return Math.round(out * 1000) / 1000;
}

function clampWithConfig(score, config) {
  let value = Number(score);
  if (!Number.isFinite(value)) return null;
  const min = Number.isFinite(Number(config?.min)) ? Number(config.min) : -Infinity;
  const max = Number.isFinite(Number(config?.max)) ? Number(config.max) : Infinity;
  const step = Number.isFinite(Number(config?.step)) ? Number(config.step) : null;
  value = clamp(value, min, max);
  if (step && step > 0) value = roundToStep(value, min, step);
  return clamp(value, min, max);
}

function canonicalProfileExamKey(examId) {
  return String(examId || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeAdmissionChoiceSelection(selection) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;
  const choiceKey = String(selection.choiceKey || selection.choice_key || "").trim();
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

export function normalizeProfileData(profile) {
  const out = { ...PROFILE_DEFAULTS, ...(profile || {}) };
  out.name = String(out.name || PROFILE_DEFAULTS.name).trim() || PROFILE_DEFAULTS.name;
  out.budget = out.budget === null || out.budget === undefined ? PROFILE_DEFAULTS.budget : out.budget;
  out.major = String(out.major ?? "").trim();
  out.studyMode = String(out.studyMode || PROFILE_DEFAULTS.studyMode).trim() || PROFILE_DEFAULTS.studyMode;
  const fundingRaw = String(out.fundingType || out.funding_type || "").trim().toLowerCase();
  out.fundingType = fundingRaw === "grant" || fundingRaw === "paid" ? fundingRaw : PROFILE_DEFAULTS.fundingType;
  out.interests = String(out.interests ?? "").trim().slice(0, 1200);
  out.selectedAdmissionChoices = out.selectedAdmissionChoices && typeof out.selectedAdmissionChoices === "object" && !Array.isArray(out.selectedAdmissionChoices)
    ? Object.fromEntries(
      Object.entries(out.selectedAdmissionChoices)
        .map(([universityId, selection]) => [String(universityId || "").trim(), normalizeAdmissionChoiceSelection(selection)])
        .filter(([universityId, selection]) => universityId && selection),
    )
    : {};

  const gpaConfig = EXAM_CONFIG?.GPA || EXAM_CONFIG?.gpa || { min: 0, max: 100, step: 1 };
  const clampGpa = (value) => {
    const normalized = clampWithConfig(value, gpaConfig);
    return Number.isFinite(normalized) ? normalized : null;
  };
  let normalizedGpa = clampGpa(out.gpa);

  if (!Array.isArray(out.exams)) out.exams = [];
  const dedupedExams = new Map();
  out.exams.forEach((row) => {
    const rawId = String(row?.id || row?.exam || "").trim();
    if (!rawId) return;
    const normalizedId = canonicalizeExamId(rawId);
    if (!normalizedId) return;
    const key = canonicalProfileExamKey(normalizedId);

    if (String(normalizedId).toUpperCase() === "GPA") {
      if (normalizedGpa === null) normalizedGpa = clampGpa(row?.score);
      return;
    }

    const config = getExamConfig(normalizedId);
    const rawValue = String(row?.raw_value || row?.rawValue || "").trim();
    const displayValue = String(row?.display_value || row?.displayValue || "").trim();
    const details = row?.details && typeof row.details === "object" && !Array.isArray(row.details)
      ? JSON.parse(JSON.stringify(row.details))
      : null;
    const clamped = config ? clampWithConfig(row?.score, config) : Number(row?.score);
    const score = Number.isFinite(clamped) ? clamped : null;
    if (score === null && !rawValue && !details) return;

    const normalizedExam = { ...row, id: normalizedId, exam: normalizedId };
    if (score !== null) normalizedExam.score = score;
    else delete normalizedExam.score;
    if (rawValue) normalizedExam.raw_value = rawValue;
    else delete normalizedExam.raw_value;
    delete normalizedExam.rawValue;
    if (displayValue) normalizedExam.display_value = displayValue;
    else delete normalizedExam.display_value;
    delete normalizedExam.displayValue;
    if (details) normalizedExam.details = details;
    else delete normalizedExam.details;

    if (!dedupedExams.has(key)) {
      dedupedExams.set(key, normalizedExam);
      return;
    }

    const existing = dedupedExams.get(key);
    const existingScore = Number(existing?.score);
    const nextScore = Number(score);
    if (
      (Number.isFinite(nextScore) && (!Number.isFinite(existingScore) || nextScore >= existingScore))
      || (!Number.isFinite(existingScore) && !Number.isFinite(nextScore))
    ) {
      dedupedExams.set(key, { ...existing, ...normalizedExam, id: normalizedId, exam: normalizedId });
    }
  });
  out.exams = Array.from(dedupedExams.values());

  if (!Array.isArray(out.languages)) out.languages = [];
  out.languages = out.languages
    .map((row) => {
      if (!row || typeof row !== "object") return null;

      const code = String(row?.code || row?.lang || "").trim().toLowerCase();
      const kind = String(row?.kind || "").trim().toLowerCase();
      if (!code || !kind) return null;

      if (kind === "native") return { code, kind };
      if (kind === "cefr") {
        const level = Number(row?.level);
        return Number.isInteger(level) && level >= 1 && level <= 6 ? { code, kind, level } : null;
      }
      if (kind !== "exam") return null;

      const examId = String(row?.exam || row?.examId || "").trim();
      if (!examId) return null;
      const rawValue = String(row?.raw_value || row?.rawValue || "").trim();
      const displayValue = String(row?.display_value || row?.displayValue || "").trim();
      const details = row?.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? JSON.parse(JSON.stringify(row.details))
        : null;
      const limits = getLangExamLimits(examId) || FALLBACK_LANG_LIMITS[examId] || null;
      const clamped = limits ? clampNumberToLimits(row?.score, limits) : Number(row?.score);
      const normalizedScore = Number.isFinite(clamped) ? clamped : null;
      if (normalizedScore === null && !rawValue && !displayValue && !details) return null;

      const next = { code, kind, exam: examId };
      if (normalizedScore !== null) next.score = normalizedScore;
      if (rawValue) next.raw_value = rawValue;
      if (displayValue) next.display_value = displayValue;
      if (details) next.details = details;
      return next;
    })
    .filter(Boolean);

  out.gpa = normalizedGpa === null ? "" : normalizedGpa;
  return out;
}

export function loadProfile() {
  const readMemoryFallback = () => {
    if (!profileMemoryFallback || typeof profileMemoryFallback !== "object") return null;
    return normalizeProfileData(profileMemoryFallback);
  };

  const raw = safeLocalStorage.getJson(PROFILE_STORAGE_KEY, null);
  if (!raw) return readMemoryFallback() || normalizeProfileData({});

  const normalized = normalizeProfileData(raw);
  profileMemoryFallback = normalized;
  return normalized;
}

export function loadProfileForApi() {
  const profile = loadProfile();
  const payload = { ...profile, locale: getUiLanguageForApi() };
  const budget = Number(profile?.budget);
  if (Number.isFinite(budget) && budget >= 0) payload.budget = budget;
  else delete payload.budget;

  const gpa = Number(profile?.gpa);
  if (Number.isFinite(gpa) && gpa >= 0) payload.gpa = gpa;
  else delete payload.gpa;

  payload.exams = (Array.isArray(profile?.exams) ? profile.exams : [])
    .map((row) => {
      const id = String(row?.id || row?.exam || "").trim();
      const score = Number(row?.score);
      const rawValue = String(row?.raw_value || row?.rawValue || "").trim();
      const displayValue = String(row?.display_value || row?.displayValue || "").trim();
      const details = row?.details && typeof row.details === "object" && !Array.isArray(row.details) ? row.details : null;
      if (!id || (!Number.isFinite(score) && !rawValue && !details)) return null;
      const next = { id };
      if (Number.isFinite(score)) next.score = score;
      if (rawValue) next.raw_value = rawValue;
      if (displayValue) next.display_value = displayValue;
      if (details) next.details = details;
      return next;
    })
    .filter(Boolean);

  payload.languages = (Array.isArray(profile?.languages) ? profile.languages : [])
    .map((row) => {
      const code = String(row?.code || row?.lang || "").trim();
      const kind = String(row?.kind || "").trim().toLowerCase();
      if (!code || !kind) return null;
      if (kind === "native") return { code, kind: "native" };
      if (kind === "cefr") {
        const level = Number(row?.level);
        return Number.isInteger(level) && level >= 1 && level <= 6 ? { code, kind: "cefr", level } : null;
      }
      if (kind !== "exam") return null;
      const exam = String(row?.exam || row?.examId || "").trim();
      const score = Number(row?.score);
      const rawValue = String(row?.raw_value || row?.rawValue || "").trim();
      const displayValue = String(row?.display_value || row?.displayValue || "").trim();
      const details = row?.details && typeof row.details === "object" && !Array.isArray(row.details) ? row.details : null;
      if (!exam || (!Number.isFinite(score) && !rawValue && !details)) return null;
      const next = { code, kind: "exam", exam };
      if (Number.isFinite(score)) next.score = score;
      if (rawValue) next.raw_value = rawValue;
      if (displayValue) next.display_value = displayValue;
      if (details) next.details = details;
      return next;
    })
    .filter(Boolean);

  if (profile?.selectedAdmissionChoices && typeof profile.selectedAdmissionChoices === "object" && !Array.isArray(profile.selectedAdmissionChoices)) {
    payload.selectedAdmissionChoices = Object.fromEntries(
      Object.entries(profile.selectedAdmissionChoices)
        .map(([universityId, selection]) => [String(universityId || "").trim(), normalizeAdmissionChoiceSelection(selection)])
        .filter(([universityId, selection]) => universityId && selection),
    );
  }
  if (!payload.selectedAdmissionChoices || !Object.keys(payload.selectedAdmissionChoices).length) delete payload.selectedAdmissionChoices;
  if (!String(payload.interests || "").trim()) delete payload.interests;
  if (!String(payload.major || "").trim()) delete payload.major;
  if (!String(payload.name || "").trim()) delete payload.name;
  if (!String(payload.studyMode || "").trim()) payload.studyMode = "Any";
  if (!String(payload.fundingType || "").trim()) payload.fundingType = "any";

  return payload;
}

export function saveProfile(profile) {
  const normalized = normalizeProfileData(profile);
  profileMemoryFallback = normalized;
  if (!safeLocalStorage.setJson(PROFILE_STORAGE_KEY, normalized)) {
    console.warn("Failed to persist profile in localStorage; using in-memory fallback.");
  }
  window.dispatchEvent(new Event("profileUpdated"));
}

export function getSelectedAdmissionChoice(universityId) {
  const universityKey = String(universityId || "").trim();
  if (!universityKey) return "";
  return String(loadProfile()?.selectedAdmissionChoices?.[universityKey]?.choiceKey || "").trim();
}

export function saveSelectedAdmissionChoice(universityId, selection) {
  const universityKey = String(universityId || "").trim();
  if (!universityKey) return;
  const profile = normalizeProfileData(loadProfile());
  const selections = {
    ...(profile.selectedAdmissionChoices && typeof profile.selectedAdmissionChoices === "object" ? profile.selectedAdmissionChoices : {}),
  };
  const normalizedSelection = normalizeAdmissionChoiceSelection(selection);
  if (normalizedSelection) selections[universityKey] = normalizedSelection;
  else delete selections[universityKey];
  profile.selectedAdmissionChoices = selections;
  saveProfile(profile);
}

export function saveFilters(state) {
  if (!state) return;
  const payload = {
    q: state.q,
    country: state.country,
    region: state.region,
    city: state.city,
    study_level: state.study_level,
    only_saved: !!state.only_saved,
    min_tuition: state.min_tuition,
    max_tuition: state.max_tuition,
    sort: state.sort,
    practice_vs_science: state.practice_vs_science,
    social_vs_hardcore: state.social_vs_hardcore,
    budget_vs_prestige: state.budget_vs_prestige,
    city_vs_campus: state.city_vs_campus,
    viewMode: state.viewMode || "list",
  };
  filtersMemoryFallback = { ...payload };
  if (!safeLocalStorage.setJson(FILTERS_KEY, payload)) {
    console.warn("Failed to persist filters in localStorage; using in-memory fallback.");
  }
}

export function loadFilters() {
  const parsed = safeLocalStorage.getJson(FILTERS_KEY, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...filtersMemoryFallback };
  filtersMemoryFallback = { ...parsed };
  return parsed;
}

export {
  API_LANG_DEFAULT,
  API_LANG_SUPPORTED,
  getUiLanguageForApi,
  normalizeUiLanguageForApi,
};
