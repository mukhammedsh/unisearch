import {
  FALLBACK_LANG_LIMITS,
  canonicalizeExamId,
  clampNumberToLimits,
  getExamConfig,
  getLangExamLimits,
} from "./config.js";
import { API_LANG_DEFAULT, API_LANG_SUPPORTED, getUiLanguageForApi, normalizeUiLanguageForApi } from "./locale.js";
import { safeLocalStorage } from "./safe-storage.js";
import { convert } from "../currency.js";

const PROFILE_STORAGE_KEY = "unisearch_profile";
const FILTERS_KEY = "unisearch_filters";

let profileMemoryFallback = null;
let profileMemoryUnpersisted = false;
let filtersMemoryFallback = {};

export const PROFILE_VERSION = 2;

const PROFILE_DEFAULTS = {
  _v: PROFILE_VERSION,
  budget: "",
  budgetCurrency: "USD",
  gpa: "",
  gpaScale: 4,
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
  if (score === "" || score === null || score === undefined) return null;
  const raw = typeof score === "string" ? score.trim() : score;
  if (raw === "") return null;
  let value = Number(raw);
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

  const knownChoiceKeys = new Set([
    "programId", "program_id",
    "programName", "program_name",
    "categoryId", "category_id",
    "requirementProfileId", "requirement_profile_id",
    "fundingOptionId", "funding_option_id",
    "choiceKey", "choice_key",
  ]);
  const extraChoiceKeys = {};
  for (const [k, v] of Object.entries(selection)) {
    if (!knownChoiceKeys.has(k)) {
      extraChoiceKeys[k] = v;
    }
  }

  return {
    ...extraChoiceKeys,
    programId: String(selection.programId || selection.program_id || "").trim(),
    programName: String(selection.programName || selection.program_name || "").trim(),
    categoryId: String(selection.categoryId || selection.category_id || "").trim(),
    requirementProfileId: String(selection.requirementProfileId || selection.requirement_profile_id || "").trim(),
    fundingOptionId: String(selection.fundingOptionId || selection.funding_option_id || "").trim(),
    choiceKey,
  };
}

export function isFutureProfile(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const v = Number(raw._v);
  return Number.isFinite(v) && v > PROFILE_VERSION;
}

export function isLegacyProfile(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const v = Number(raw._v);
  // Future version must NEVER be treated as legacy!
  if (Number.isFinite(v) && v > PROFILE_VERSION) return false;
  // Missing version or version < PROFILE_VERSION is legacy
  if (!Number.isFinite(v) || v < PROFILE_VERSION) return true;
  // Version is exactly PROFILE_VERSION: check if any legacy aliases remain
  // "name" is a removed nickname field: old profiles containing it need one-time migration.
  if (
    "name" in raw
    || "budget_currency" in raw
    || "funding_type" in raw
    || "gpa_scale" in raw
    || "gpa_raw" in raw
    || "user_gpa_scale" in raw
    || "selected_admission_choices" in raw
  ) {
    return true;
  }
  if (Array.isArray(raw.exams)) {
    for (const e of raw.exams) {
      if (e && typeof e === "object" && !Array.isArray(e)) {
        if ("rawValue" in e || "displayValue" in e || !e.id || !e.exam || e.id !== e.exam) {
          return true;
        }
      }
    }
  }
  if (Array.isArray(raw.languages)) {
    for (const l of raw.languages) {
      if (l && typeof l === "object" && !Array.isArray(l)) {
        if ("lang" in l || "examId" in l || "rawValue" in l || "displayValue" in l) {
          return true;
        }
      }
    }
  }
  if (raw.selectedAdmissionChoices && typeof raw.selectedAdmissionChoices === "object" && !Array.isArray(raw.selectedAdmissionChoices)) {
    for (const choice of Object.values(raw.selectedAdmissionChoices)) {
      if (choice && typeof choice === "object" && !Array.isArray(choice)) {
        if (
          "choice_key" in choice
          || "program_id" in choice
          || "program_name" in choice
          || "category_id" in choice
          || "requirement_profile_id" in choice
          || "funding_option_id" in choice
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function normalizeProfileData(profile) {
  const raw = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};

  // Preserve unknown/future fields from raw
  // "name" is a removed nickname field kept here so legacy values are stripped, not preserved.
  const knownRootKeys = new Set([
    "_v", "name", "budget", "budgetCurrency", "budget_currency",
    "gpa", "gpaScale", "gpa_scale", "gpa_raw", "user_gpa_scale",
    "exams", "languages", "major", "interests",
    "studyMode", "fundingType", "funding_type",
    "selectedAdmissionChoices", "selected_admission_choices",
  ]);
  const extraFields = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!knownRootKeys.has(k)) {
      extraFields[k] = v;
    }
  }

  // Version: preserve future version numbers (> PROFILE_VERSION); otherwise canonical PROFILE_VERSION
  const rawVersion = Number(raw._v);
  const version = Number.isFinite(rawVersion) && rawVersion > PROFILE_VERSION ? rawVersion : PROFILE_VERSION;

  const budget = raw.budget === null || raw.budget === undefined || raw.budget === "" ? "" : raw.budget;
  const budgetCurrencyRaw = String(raw.budgetCurrency || raw.budget_currency || "").trim().toUpperCase();
  const budgetCurrency = budgetCurrencyRaw || PROFILE_DEFAULTS.budgetCurrency;
  const major = String(raw.major ?? "").trim();
  const studyMode = String(raw.studyMode || PROFILE_DEFAULTS.studyMode).trim() || PROFILE_DEFAULTS.studyMode;
  const parseFundingType = (val) => {
    const s = String(val || "").trim().toLowerCase();
    return s === "grant" || s === "paid" ? s : (s === "any" ? "any" : null);
  };
  const fundingType = parseFundingType(raw.fundingType) || parseFundingType(raw.funding_type) || PROFILE_DEFAULTS.fundingType;
  const interests = String(raw.interests ?? "").trim().slice(0, 1200);

  // Selected admission choices:
  // Canonical selectedAdmissionChoices (if an object, including an intentionally empty {}) takes
  // strict precedence over legacy selected_admission_choices to prevent resurrecting choices
  // that the user intentionally removed.
  // Legacy selected_admission_choices is used only when canonical selectedAdmissionChoices is absent.
  const rawChoices = (raw.selectedAdmissionChoices && typeof raw.selectedAdmissionChoices === "object" && !Array.isArray(raw.selectedAdmissionChoices))
    ? raw.selectedAdmissionChoices
    : (raw.selected_admission_choices && typeof raw.selected_admission_choices === "object" && !Array.isArray(raw.selected_admission_choices))
      ? raw.selected_admission_choices
      : {};
  const selectedAdmissionChoices = Object.fromEntries(
    Object.entries(rawChoices)
      .map(([universityId, selection]) => [String(universityId || "").trim(), normalizeAdmissionChoiceSelection(selection)])
      .filter(([universityId, selection]) => universityId && selection),
  );

  // Priority rule: valid canonical gpaScale (4 or 5) takes precedence over legacy gpa_scale / user_gpa_scale.
  // Fallback to gpa_scale / user_gpa_scale only when gpaScale is not 4 or 5.
  let rawGpaScale = raw.gpaScale;
  if (Number(rawGpaScale) !== 4 && Number(rawGpaScale) !== 5) {
    rawGpaScale = raw.gpa_scale ?? raw.user_gpa_scale;
  }
  const gpaScale = Number(rawGpaScale) === 5 ? 5 : 4;
  const gpaMax = gpaScale === 5 ? 5 : 4;
  const clampGpa = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const normalized = String(value).trim().replace(/,/g, ".");
    if (normalized === "") return null;
    const num = Number(normalized);
    if (!Number.isFinite(num)) return null;
    return Math.max(0, Math.min(gpaMax, Math.round(num * 100) / 100));
  };
  let normalizedGpa = clampGpa(raw.gpa);
  if (normalizedGpa === null) {
    normalizedGpa = clampGpa(raw.gpa_raw);
  }

  const rawExams = Array.isArray(raw.exams) ? raw.exams : [];
  const dedupedExams = new Map();
  rawExams.forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
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
    let details = null;
    if (row?.details && typeof row.details === "object" && !Array.isArray(row.details)) {
      try {
        details = JSON.parse(JSON.stringify(row.details));
      } catch {
        details = null;
      }
    }
    const clamped = config ? clampWithConfig(row?.score, config) : Number(row?.score);
    const score = Number.isFinite(clamped) ? clamped : null;
    if (score === null && !rawValue && !details) return;

    const knownExamKeys = new Set(["id", "exam", "score", "raw_value", "rawValue", "display_value", "displayValue", "details"]);
    const extraExamKeys = {};
    for (const [k, v] of Object.entries(row)) {
      if (!knownExamKeys.has(k)) {
        extraExamKeys[k] = v;
      }
    }

    const normalizedExam = {
      ...extraExamKeys,
      id: normalizedId,
      exam: normalizedId,
    };
    if (score !== null) normalizedExam.score = score;
    if (rawValue) normalizedExam.raw_value = rawValue;
    if (displayValue) normalizedExam.display_value = displayValue;
    if (details) normalizedExam.details = details;

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
  const exams = Array.from(dedupedExams.values());

  const rawLanguages = Array.isArray(raw.languages) ? raw.languages : [];
  const languages = rawLanguages
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;

      const code = String(row?.code || row?.lang || "").trim().toLowerCase();
      const kind = String(row?.kind || "").trim().toLowerCase();
      if (!code || !kind) return null;

      const knownLangKeys = new Set(["code", "lang", "kind", "level", "exam", "examId", "score", "raw_value", "rawValue", "display_value", "displayValue", "details"]);
      const extraLangKeys = {};
      for (const [k, v] of Object.entries(row)) {
        if (!knownLangKeys.has(k)) {
          extraLangKeys[k] = v;
        }
      }

      if (kind === "native") return { ...extraLangKeys, code, kind: "native" };
      if (kind === "cefr") {
        const level = Number(row?.level);
        return Number.isInteger(level) && level >= 1 && level <= 6 ? { ...extraLangKeys, code, kind: "cefr", level } : null;
      }
      if (kind !== "exam") return null;

      const examId = String(row?.exam || row?.examId || "").trim();
      if (!examId) return null;
      const rawValue = String(row?.raw_value || row?.rawValue || "").trim();
      const displayValue = String(row?.display_value || row?.displayValue || "").trim();
      let details = null;
      if (row?.details && typeof row.details === "object" && !Array.isArray(row.details)) {
        try {
          details = JSON.parse(JSON.stringify(row.details));
        } catch {
          details = null;
        }
      }
      const limits = getLangExamLimits(examId) || FALLBACK_LANG_LIMITS[examId] || null;
      const clamped = limits ? clampNumberToLimits(row?.score, limits) : Number(row?.score);
      const normalizedScore = Number.isFinite(clamped) ? clamped : null;
      if (normalizedScore === null && !rawValue && !displayValue && !details) return null;

      const next = { ...extraLangKeys, code, kind: "exam", exam: examId };
      if (normalizedScore !== null) next.score = normalizedScore;
      if (rawValue) next.raw_value = rawValue;
      if (displayValue) next.display_value = displayValue;
      if (details) next.details = details;
      return next;
    })
    .filter(Boolean);

  return {
    ...extraFields,
    _v: version,
    budget,
    budgetCurrency,
    gpa: normalizedGpa === null ? "" : normalizedGpa,
    gpaScale,
    exams,
    languages,
    major,
    interests,
    studyMode,
    fundingType,
    selectedAdmissionChoices,
  };
}

export function loadProfile() {
  const readMemoryFallback = () => {
    if (!profileMemoryFallback || typeof profileMemoryFallback !== "object") return null;
    return normalizeProfileData(profileMemoryFallback);
  };

  // If in-memory fallback has unpersisted changes (due to future profile or storage write error),
  // return in-memory state directly to prevent clobbering edits with stale data from localStorage!
  if (profileMemoryUnpersisted && profileMemoryFallback) {
    return readMemoryFallback();
  }

  const raw = safeLocalStorage.getJson(PROFILE_STORAGE_KEY, null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return readMemoryFallback() || normalizeProfileData({});
  }

  // Future-version safety: do NOT downgrade and do NOT overwrite localStorage!
  if (isFutureProfile(raw)) {
    const normalized = normalizeProfileData(raw);
    profileMemoryFallback = normalized;
    return normalized;
  }

  const normalized = normalizeProfileData(raw);
  profileMemoryFallback = normalized;

  if (isLegacyProfile(raw)) {
    try {
      const persisted = safeLocalStorage.setJson(PROFILE_STORAGE_KEY, normalized);
      if (!persisted) {
        console.warn("Failed to persist migrated profile in localStorage; using in-memory fallback (persists only until page reload).");
      }
    } catch (err) {
      console.warn("Failed to migrate profile in localStorage:", err);
    }
  }

  return normalized;
}

export function loadProfileForApi() {
  const profile = loadProfile();
  const payload = {
    studyMode: String(profile?.studyMode || "Any").trim() || "Any",
    fundingType: String(profile?.fundingType || "any").trim() || "any",
    locale: getUiLanguageForApi(),
  };

  const budget = Number(profile?.budget);
  const budgetCurrency = String(profile?.budgetCurrency || "USD").trim().toUpperCase();
  if (Number.isFinite(budget) && budget >= 0) {
    const usdBudget = convert(budget, budgetCurrency, "USD");
    payload.budget = Math.min(1000000, Math.max(0, Math.round(usdBudget)));
  }

  const gpa = Number(profile?.gpa);
  const gpaScale = Number(profile?.gpaScale) === 5 ? 5 : 4;
  if (Number.isFinite(gpa) && gpa >= 0) {
    const gpaNormalized = gpaScale === 5 ? Math.round((gpa / 5.0) * 4.0 * 100) / 100 : gpa;
    payload.gpa = gpaNormalized;
    payload.gpa_scale = 4;
  }

  if (String(profile?.major || "").trim()) {
    payload.major = String(profile.major).trim();
  }

  if (String(profile?.interests || "").trim()) {
    payload.interests = String(profile.interests).trim();
  }

  payload.exams = (Array.isArray(profile?.exams) ? profile.exams : [])
    .map((row) => {
      const id = String(row?.id || row?.exam || "").trim();
      const score = Number(row?.score);
      const rawValue = String(row?.raw_value || row?.rawValue || "").trim();
      const displayValue = String(row?.display_value || row?.displayValue || "").trim();
      let details = null;
      if (row?.details && typeof row.details === "object" && !Array.isArray(row.details)) {
        try {
          details = JSON.parse(JSON.stringify(row.details));
        } catch {
          details = null;
        }
      }
      if (!id || (!Number.isFinite(score) && !rawValue && !details)) return null;
      const next = { id, exam: id };
      if (Number.isFinite(score)) next.score = score;
      if (rawValue) next.raw_value = rawValue;
      if (displayValue) next.display_value = displayValue;
      if (details) next.details = details;
      return next;
    })
    .filter(Boolean);

  payload.languages = (Array.isArray(profile?.languages) ? profile.languages : [])
    .map((row) => {
      const code = String(row?.code || row?.lang || "").trim().toLowerCase();
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
      let details = null;
      if (row?.details && typeof row.details === "object" && !Array.isArray(row.details)) {
        try {
          details = JSON.parse(JSON.stringify(row.details));
        } catch {
          details = null;
        }
      }
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
    const choices = Object.fromEntries(
      Object.entries(profile.selectedAdmissionChoices)
        .map(([universityId, selection]) => [String(universityId || "").trim(), normalizeAdmissionChoiceSelection(selection)])
        .filter(([universityId, selection]) => universityId && selection),
    );
    if (Object.keys(choices).length) {
      payload.selectedAdmissionChoices = choices;
    }
  }

  return payload;
}

export function saveProfile(profile) {
  const normalized = normalizeProfileData(profile);
  profileMemoryFallback = normalized;

  // Future-version write protection:
  // An existing version of the application must NOT silently overwrite an unknown future schema in localStorage!
  // Check parsed JSON first, and if unparseable/corrupt, check raw string for future version tags (_v >= 3).
  const existingRaw = safeLocalStorage.getJson(PROFILE_STORAGE_KEY, null);
  let isExistingFuture = isFutureProfile(existingRaw);
  if (!isExistingFuture && existingRaw === null) {
    const rawString = safeLocalStorage.get(PROFILE_STORAGE_KEY, "");
    if (rawString && /"_v"\s*:\s*([3-9]|\d{2,})/.test(rawString)) {
      isExistingFuture = true;
    }
  }

  if (isExistingFuture || isFutureProfile(profile)) {
    console.warn("Refusing to overwrite future-version profile in localStorage; keeping in-memory fallback (persists only until page reload).");
    profileMemoryUnpersisted = true;
    window.dispatchEvent(new Event("profileUpdated"));
    return false;
  }

  const persisted = safeLocalStorage.setJson(PROFILE_STORAGE_KEY, normalized);
  if (!persisted) {
    profileMemoryUnpersisted = true;
    console.warn("Failed to persist profile in localStorage; using in-memory fallback (persists only until page reload).");
  } else {
    profileMemoryUnpersisted = false;
  }
  window.dispatchEvent(new Event("profileUpdated"));
  return persisted;
}

export function clearProfile() {
  profileMemoryFallback = null;
  profileMemoryUnpersisted = false;
  const cleared = safeLocalStorage.remove(PROFILE_STORAGE_KEY);
  window.dispatchEvent(new Event("profileUpdated"));
  return cleared;
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

export function calculateProfileCompletion(rawProfile) {
  const profile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};

  const budgetRaw = String(profile.budget ?? "").trim();
  const hasBudget = budgetRaw !== "";

  const studyModeRaw = String((profile.studyMode ?? profile.study_mode) ?? "").trim();
  const hasStudyMode = studyModeRaw !== "";

  const fundingTypeRaw = String((profile.fundingType ?? profile.funding_type) ?? "").trim();
  const hasFundingType = fundingTypeRaw !== "";

  const gpaRaw = String(profile.gpa ?? "").trim();
  const hasGpa = gpaRaw !== "";

  const hasExams = Array.isArray(profile.exams) && profile.exams.length > 0 && profile.exams.some(
    (e) => Boolean(e && (e.exam || e.id || e.name || Number.isFinite(Number(e.score)) || e.rawValue || e.raw_value))
  );

  const hasLanguages = Array.isArray(profile.languages) && profile.languages.length > 0 && profile.languages.some(
    (l) => Boolean(l && (l.code || l.lang || l.name || l.exam))
  );

  const majorRaw = String(profile.major ?? "").trim();
  const hasMajor = majorRaw !== "";

  const details = {
    budget: hasBudget,
    studyMode: hasStudyMode,
    fundingType: hasFundingType,
    gpa: hasGpa,
    exams: hasExams,
    languages: hasLanguages,
    major: hasMajor,
  };

  const total = 7;
  const completed = Object.values(details).filter(Boolean).length;
  const percentage = Math.round((completed / total) * 100);

  return {
    completed,
    total,
    percentage,
    details,
  };
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
    activeTab: state.activeTab || "catalog",
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
