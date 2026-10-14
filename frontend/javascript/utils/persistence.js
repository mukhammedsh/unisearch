import {
  FALLBACK_LANG_LIMITS,
  canonicalizeExamId,
  clampNumberToLimits,
  getExamConfig,
  getLangExamLimits,
} from "./config.js";
import { API_LANG_DEFAULT, API_LANG_SUPPORTED, getUiLanguageForApi, normalizeUiLanguageForApi } from "./locale.js";
import { safeLocalStorage } from "./safe-storage.js";
import { CURRENCY_FORMAT_MAP, convert } from "../currency.js";

const PROFILE_STORAGE_KEY = "unisearch_profile";
const FILTERS_KEY = "unisearch_filters";
const ADMISSIONS_CHOICE_MIGRATION_INSTITUTIONS = new Set([
  "mit-usa-cambridge",
  "imperial-college-london-uk",
  "stanford-university-usa-ca",
]);

let profileMemoryFallback = null;
let profileMemoryUnpersisted = false;
let filtersMemoryFallback = {};

export const PROFILE_VERSION = 2;
export const MAX_PROFILE_CITIZENSHIPS = 10;

const PROFILE_DEFAULTS = {
  _v: PROFILE_VERSION,
  budget: "",
  budgetCurrency: "USD",
  familyIncomeAmount: "",
  familyIncomeCurrency: "USD",
  languageEvidence: [],
  institutionalEvidence: [],
  gpa: "",
  gpaScale: 4,
  exams: [],
  languages: [],
  major: "",
  interests: "",
  studyMode: "Any",
  fundingType: "any",
  citizenship: "",
  citizenships: [],
  countryOfEducation: "",
  countryOfEducationOther: "",
  educationCredential: "",
  educationCredentialOther: "",
  applicantRoute: "",
  intendedEntryCycle: "",
  currentResidenceCountry: "",
  currentResidenceOther: "",
  feeStatusContext: "unknown",
  studyLevel: "Any",
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

function normalizeEvidenceDate(value, allowFuture = false) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) return "";
  return allowFuture || text <= new Date().toISOString().slice(0, 10) ? text : "";
}

function normalizeLanguageEvidence(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 10).map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const kind = String(row.kind || "").trim();
    const language = String(row.language || "").trim().toLowerCase();
    if (!["primary_language", "education", "employment"].includes(kind)
      || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language)) return null;
    const next = { kind, language };
    const country = String(row.country || "").trim().slice(0, 80);
    const qualification = String(row.qualification_level || "").trim();
    const startedOn = normalizeEvidenceDate(row.started_on);
    const completedOn = normalizeEvidenceDate(row.completed_on);
    if (startedOn && completedOn && startedOn > completedOn) return null;
    const status = ["completed", "in_progress", "unknown"].includes(row.status) ? row.status : "unknown";
    if (country) next.country = country;
    if (["secondary", "bachelor", "master", "doctorate", "professional", "other"].includes(qualification)) next.qualification_level = qualification;
    if (startedOn) next.started_on = startedOn;
    if (completedOn) next.completed_on = completedOn;
    next.status = status;
    if (typeof row.entirely_in_language === "boolean") next.entirely_in_language = row.entirely_in_language;
    return next;
  }).filter(Boolean);
}

function normalizeInstitutionalEvidence(rows) {
  if (!Array.isArray(rows)) return [];
  const institutions = new Set(["mit-usa-cambridge", "imperial-college-london-uk", "stanford-university-usa-ca"]);
  return rows.slice(0, 20).map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || !institutions.has(row.university_id)) return null;
    const kind = String(row.kind || "").trim();
    const next = { university_id: row.university_id, kind };
    const programId = String(row.program_id || "").trim().slice(0, 128);
    if (programId) next.program_id = programId;
    if (kind === "enrollment") {
      next.status = ["enrolled", "on_leave", "completed", "not_enrolled", "unknown"].includes(row.status) ? row.status : "unknown";
      for (const [field, maximum] of [["units", 10000], ["major_units", 10000], ["completed_major_subjects", 1000]]) {
        const rawValue = row[field];
        const value = Number(rawValue);
        if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== ""
          && typeof rawValue !== "boolean" && Number.isInteger(value) && value >= 0 && value <= maximum) next[field] = value;
      }
      const expected = normalizeEvidenceDate(row.expected_completion_on, true);
      if (expected) next.expected_completion_on = expected;
      return next;
    }
    if (kind === "gpa") {
      const metric = String(row.metric || "");
      const value = Number(row.value);
      const scale = Number(row.scale);
      if (!["overall", "technical", "major"].includes(metric)
        || row.value === null || row.value === undefined || String(row.value).trim() === ""
        || row.scale === null || row.scale === undefined || String(row.scale).trim() === ""
        || typeof row.value === "boolean" || typeof row.scale === "boolean"
        || !Number.isFinite(value) || !Number.isFinite(scale) || value < 0 || value > 5 || scale < 1 || scale > 5 || value > scale) return null;
      next.metric = metric;
      next.value = value;
      next.scale = scale;
      const term = String(row.as_of_term || "").trim().slice(0, 40);
      if (term) next.as_of_term = term;
      return next;
    }
    if (kind === "credential") {
      const credential = String(row.credential_id || "").trim().slice(0, 128);
      if (!credential) return null;
      next.credential_id = credential;
      next.status = ["completed", "in_progress", "not_completed", "unknown"].includes(row.status) ? row.status : "unknown";
      const scorePercent = Number(row.score_percent);
      if (row.score_percent !== undefined && row.score_percent !== null && typeof row.score_percent !== "boolean"
        && String(row.score_percent).trim() !== "" && Number.isFinite(scorePercent) && scorePercent >= 0 && scorePercent <= 100) next.score_percent = scorePercent;
      const completed = normalizeEvidenceDate(row.completed_on);
      if (completed) next.completed_on = completed;
      return next;
    }
    return null;
  }).filter(Boolean);
}

function normalizeAdmissionChoiceSelection(selection) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;
  const choiceKey = String(selection.choiceKey || selection.choice_key || "").trim();
  const studyOptionId = String(selection.studyOptionId || selection.study_option_id || "").trim();
  const applicationRouteId = String(selection.applicationRouteId || selection.application_route_id || "").trim();
  const legacyProgramId = String(selection.programId || selection.program_id || "").trim();
  if (!choiceKey && !studyOptionId && !applicationRouteId && !legacyProgramId) return null;

  const knownChoiceKeys = new Set([
    "programId", "program_id",
    "studyOptionId", "study_option_id", "applicationRouteId", "application_route_id",
    "studyLevel", "study_level", "applicantRoute", "applicant_route",
    "intendedEntryCycle", "intended_entry_cycle", "feeStatusContext", "fee_status_context",
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
  const studyLevelValue = selection.studyLevel ?? selection.study_level;
  const studyLevel = studyLevelValue === "" ? "" : ["undergraduate", "masters", "doctoral", "professional"].includes(studyLevelValue) ? studyLevelValue : undefined;
  const applicantRouteValue = selection.applicantRoute ?? selection.applicant_route;
  const applicantRoute = applicantRouteValue === "" ? "" : ["first_year", "transfer", "graduate"].includes(applicantRouteValue) ? applicantRouteValue : undefined;
  const cycleValue = selection.intendedEntryCycle ?? selection.intended_entry_cycle;
  const intendedEntryCycle = typeof cycleValue === "string" ? cycleValue.trim().slice(0, 40) : undefined;
  const feeStatusValue = selection.feeStatusContext ?? selection.fee_status_context;
  const feeStatusContext = ["unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"].includes(feeStatusValue)
    ? feeStatusValue
    : undefined;

  return {
    ...extraChoiceKeys,
    ...(studyOptionId ? { studyOptionId: studyOptionId.slice(0, 128) } : {}),
    ...(applicationRouteId ? { applicationRouteId: applicationRouteId.slice(0, 256) } : {}),
    ...(studyLevel !== undefined ? { studyLevel } : {}),
    ...(applicantRoute !== undefined ? { applicantRoute } : {}),
    ...(intendedEntryCycle !== undefined ? { intendedEntryCycle } : {}),
    ...(feeStatusContext !== undefined ? { feeStatusContext } : {}),
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
    || "study_level" in raw
    || "selected_admission_choices" in raw
    || "country_of_education" in raw
    || "country_of_education_other" in raw
    || "education_credential" in raw
    || "education_credential_other" in raw
    || "applicant_route" in raw
    || "intended_entry_cycle" in raw
    || "current_residence_country" in raw
    || "current_residence_other" in raw
    || "fee_status_context" in raw
  ) {
    return true;
  }
  if (typeof raw.citizenships === "string") return true;
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
  const choices = raw.selectedAdmissionChoices && typeof raw.selectedAdmissionChoices === "object" && !Array.isArray(raw.selectedAdmissionChoices)
    ? raw.selectedAdmissionChoices
    : raw.selected_admission_choices;
  if (choices && typeof choices === "object" && !Array.isArray(choices)) {
    for (const [institutionId, choice] of Object.entries(choices)) {
      if (ADMISSIONS_CHOICE_MIGRATION_INSTITUTIONS.has(institutionId)
        && (isLegacyAdmissionChoice(choice) || (hasCanonicalAdmissionChoiceId(choice) && hasLegacyAdmissionChoiceFields(choice)))) return true;
    }
  }
  return false;
}

function isLegacyAdmissionChoice(choice) {
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) return false;
  return !hasCanonicalAdmissionChoiceId(choice) && Boolean(String(choice.programId || choice.program_id || choice.choiceKey || choice.choice_key || "").trim());
}

function hasCanonicalAdmissionChoiceId(choice) {
  return Boolean(String(choice?.studyOptionId || choice?.study_option_id || "").trim()
    || String(choice?.applicationRouteId || choice?.application_route_id || "").trim());
}

function hasLegacyAdmissionChoiceFields(choice) {
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) return false;
  return ["programId", "program_id", "programName", "program_name", "categoryId", "category_id", "requirementProfileId", "requirement_profile_id", "fundingOptionId", "funding_option_id", "choiceKey", "choice_key"]
    .some((key) => key in choice);
}

function normalizeAdmissionChoiceForInstitution(institutionId, selection) {
  if (ADMISSIONS_CHOICE_MIGRATION_INSTITUTIONS.has(institutionId) && !hasCanonicalAdmissionChoiceId(selection)) return null;
  const normalized = normalizeAdmissionChoiceSelection(selection);
  if (ADMISSIONS_CHOICE_MIGRATION_INSTITUTIONS.has(institutionId) && normalized) {
    for (const key of ["programId", "programName", "categoryId", "requirementProfileId", "fundingOptionId", "choiceKey"]) delete normalized[key];
  }
  return normalized;
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
    "citizenship", "citizenships", "studyLevel", "study_level",
    "countryOfEducation", "country_of_education", "countryOfEducationOther", "country_of_education_other",
    "educationCredential", "education_credential", "educationCredentialOther", "education_credential_other",
    "applicantRoute", "applicant_route", "intendedEntryCycle", "intended_entry_cycle",
    "currentResidenceCountry", "current_residence_country", "currentResidenceOther", "current_residence_other",
    "feeStatusContext", "fee_status_context",
    "languageEvidence", "language_evidence", "institutionalEvidence", "institutional_evidence",
    "selectedAdmissionChoices", "selected_admission_choices",
    "admissionChoiceResetNotices",
    "familyIncomeAmount", "familyIncomeCurrency",
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
  const incomeAmountRaw = raw.familyIncomeAmount;
  let incomeAmountValue = "";
  if (typeof incomeAmountRaw === "number") {
    incomeAmountValue = incomeAmountRaw;
  } else if (typeof incomeAmountRaw === "string" && incomeAmountRaw.trim()) {
    incomeAmountValue = Number(incomeAmountRaw.trim());
  } else if (incomeAmountRaw !== "" && incomeAmountRaw !== null && incomeAmountRaw !== undefined) {
    incomeAmountValue = Number.NaN;
  }
  const familyIncomeAmount = Number.isFinite(incomeAmountValue) && incomeAmountValue >= 0 && incomeAmountValue <= 1_000_000_000_000
    ? incomeAmountValue
    : "";
  const incomeCurrencyRaw = typeof raw.familyIncomeCurrency === "string" ? raw.familyIncomeCurrency.trim().toUpperCase() : "";
  const familyIncomeCurrency = Object.prototype.hasOwnProperty.call(CURRENCY_FORMAT_MAP, incomeCurrencyRaw)
    ? incomeCurrencyRaw
    : PROFILE_DEFAULTS.familyIncomeCurrency;
  const major = String(raw.major ?? "").trim();
  const studyMode = String(raw.studyMode || PROFILE_DEFAULTS.studyMode).trim() || PROFILE_DEFAULTS.studyMode;
  const parseFundingType = (val) => {
    const s = String(val || "").trim().toLowerCase();
    return s === "grant" || s === "paid" ? s : (s === "any" ? "any" : null);
  };
  const fundingType = parseFundingType(raw.fundingType) || parseFundingType(raw.funding_type) || PROFILE_DEFAULTS.fundingType;

  let citizenshipsList = [];
  if (Array.isArray(raw.citizenships)) {
    citizenshipsList = raw.citizenships
      .filter((c) => typeof c === "string")
      .map((c) => c.trim())
      .filter(Boolean);
  } else if (typeof raw.citizenships === "string") {
    citizenshipsList = raw.citizenships.split(",").map((c) => c.trim()).filter(Boolean);
  }
  if (!citizenshipsList.length && typeof raw.citizenship === "string" && raw.citizenship.trim()) {
    citizenshipsList = [raw.citizenship.trim()];
  }
  const seenCountries = new Set();
  const dedupedCitizenships = [];
  for (const c of citizenshipsList) {
    const key = c.toUpperCase();
    if (!seenCountries.has(key)) {
      seenCountries.add(key);
      dedupedCitizenships.push(c);
    }
    if (dedupedCitizenships.length >= MAX_PROFILE_CITIZENSHIPS) break;
  }
  const citizenship = dedupedCitizenships.length > 0 ? dedupedCitizenships[0] : "";

  const studyLevel = typeof raw.studyLevel === "string"
    ? raw.studyLevel.trim()
    : (typeof raw.study_level === "string" ? raw.study_level.trim() : PROFILE_DEFAULTS.studyLevel);

  const readOptionalString = (camelKey, snakeKey, maxLength = 120) => {
    const value = typeof raw[camelKey] === "string" ? raw[camelKey] : raw[snakeKey];
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  };
  const countryOfEducation = readOptionalString("countryOfEducation", "country_of_education", 80);
  const countryOfEducationOther = readOptionalString("countryOfEducationOther", "country_of_education_other", 80);
  const educationCredential = readOptionalString("educationCredential", "education_credential", 80);
  const educationCredentialOther = readOptionalString("educationCredentialOther", "education_credential_other", 120);
  const applicantRoute = readOptionalString("applicantRoute", "applicant_route", 40);
  const intendedEntryCycle = readOptionalString("intendedEntryCycle", "intended_entry_cycle", 40);
  const currentResidenceCountry = readOptionalString("currentResidenceCountry", "current_residence_country", 80);
  const currentResidenceOther = readOptionalString("currentResidenceOther", "current_residence_other", 80);
  const feeStatusContext = readOptionalString("feeStatusContext", "fee_status_context", 40) || "unknown";
  const languageEvidence = normalizeLanguageEvidence(raw.languageEvidence ?? raw.language_evidence);
  const institutionalEvidence = normalizeInstitutionalEvidence(raw.institutionalEvidence ?? raw.institutional_evidence);

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
  const admissionChoiceResetNotices = Array.isArray(raw.admissionChoiceResetNotices)
    ? raw.admissionChoiceResetNotices.filter((id) => ADMISSIONS_CHOICE_MIGRATION_INSTITUTIONS.has(id))
    : [];
  const resetNotices = new Set(admissionChoiceResetNotices);
  const selectedAdmissionChoices = Object.fromEntries(
    Object.entries(rawChoices)
      .map(([universityId, selection]) => {
        const institutionId = String(universityId || "").trim();
        if (!isFutureProfile(raw) && ADMISSIONS_CHOICE_MIGRATION_INSTITUTIONS.has(institutionId) && isLegacyAdmissionChoice(selection)) {
          resetNotices.add(institutionId);
          return [institutionId, null];
        }
        return [institutionId, ADMISSIONS_CHOICE_MIGRATION_INSTITUTIONS.has(institutionId) && isFutureProfile(raw)
          ? normalizeAdmissionChoiceSelection(selection)
          : normalizeAdmissionChoiceForInstitution(institutionId, selection)];
      })
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
    const takenOn = normalizeEvidenceDate(row.taken_on);
    const key = `${canonicalProfileExamKey(normalizedId)}::${takenOn}`;

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

    const knownExamKeys = new Set(["id", "exam", "score", "raw_value", "rawValue", "display_value", "displayValue", "details", "taken_on"]);
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
    if (takenOn) normalizedExam.taken_on = takenOn;

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

      const knownLangKeys = new Set(["code", "lang", "kind", "level", "exam", "examId", "score", "raw_value", "rawValue", "display_value", "displayValue", "details", "taken_on"]);
      const extraLangKeys = {};
      for (const [k, v] of Object.entries(row)) {
        if (!knownLangKeys.has(k)) {
          extraLangKeys[k] = v;
        }
      }

      const takenOn = normalizeEvidenceDate(row.taken_on);
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
      if (takenOn) next.taken_on = takenOn;
      return next;
    })
    .filter(Boolean);

  return {
    ...extraFields,
    _v: version,
    budget,
    budgetCurrency,
    familyIncomeAmount,
    familyIncomeCurrency,
    gpa: normalizedGpa === null ? "" : normalizedGpa,
    gpaScale,
    exams,
    languages,
    major,
    interests,
    studyMode,
    fundingType,
    citizenship,
    citizenships: dedupedCitizenships,
    countryOfEducation,
    countryOfEducationOther,
    educationCredential,
    educationCredentialOther,
    applicantRoute,
    intendedEntryCycle,
    currentResidenceCountry,
    currentResidenceOther,
    feeStatusContext,
    studyLevel: studyLevel || PROFILE_DEFAULTS.studyLevel,
    selectedAdmissionChoices,
    admissionChoiceResetNotices: [...resetNotices],
    languageEvidence,
    institutionalEvidence,
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
      const takenOn = normalizeEvidenceDate(row?.taken_on);
      if (takenOn) next.taken_on = takenOn;
      return next;
    })
    .filter(Boolean);

  payload.languages = (Array.isArray(profile?.languages) ? profile.languages : [])
    .map((row) => {
      const code = String(row?.code || row?.lang || "").trim().toLowerCase();
      const kind = String(row?.kind || "").trim().toLowerCase();
      if (!code || !kind) return null;
      const takenOn = normalizeEvidenceDate(row?.taken_on);
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
      if (takenOn) next.taken_on = takenOn;
      return next;
    })
    .filter(Boolean);

  payload.language_evidence = normalizeLanguageEvidence(profile?.languageEvidence ?? profile?.language_evidence);
  payload.institutional_evidence = normalizeInstitutionalEvidence(profile?.institutionalEvidence ?? profile?.institutional_evidence);

  if (profile?.selectedAdmissionChoices && typeof profile.selectedAdmissionChoices === "object" && !Array.isArray(profile.selectedAdmissionChoices)) {
    const choices = Object.fromEntries(
      Object.entries(profile.selectedAdmissionChoices)
        .map(([universityId, selection]) => {
          const institutionId = String(universityId || "").trim();
          return [institutionId, normalizeAdmissionChoiceForInstitution(institutionId, selection)];
        })
        .filter(([universityId, selection]) => universityId && selection),
    );
    if (Object.keys(choices).length) {
      payload.selectedAdmissionChoices = choices;
    }
  }

  if (String(profile?.citizenship || "").trim()) {
    payload.citizenship = String(profile.citizenship).trim();
  }
  if (Array.isArray(profile?.citizenships) && profile.citizenships.length > 0) {
    payload.citizenships = profile.citizenships.map((c) => String(c || "").trim()).filter(Boolean);
  }
  for (const [profileKey, payloadKey] of [
    ["countryOfEducation", "country_of_education"],
    ["countryOfEducationOther", "country_of_education_other"],
    ["educationCredential", "education_credential"],
    ["educationCredentialOther", "education_credential_other"],
    ["applicantRoute", "applicant_route"],
    ["intendedEntryCycle", "intended_entry_cycle"],
    ["currentResidenceCountry", "current_residence_country"],
    ["currentResidenceOther", "current_residence_other"],
    ["feeStatusContext", "fee_status_context"],
  ]) {
    const value = String(profile?.[profileKey] || "").trim();
    if (value) payload[payloadKey] = value;
  }
  payload.fee_status_context = String(profile?.feeStatusContext || "unknown").trim() || "unknown";
  if (String(profile?.studyLevel || "").trim() && String(profile.studyLevel).trim() !== "Any") {
    payload.study_level = String(profile.studyLevel).trim();
  }
  return payload;
}

export function saveProfile(profile) {
  const normalized = normalizeProfileData(profile);
  normalized.admissionChoiceResetNotices = normalized.admissionChoiceResetNotices.filter((institutionId) => {
    const choice = normalized.selectedAdmissionChoices[institutionId];
    return !(choice?.studyOptionId && choice?.applicationRouteId);
  });
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
  if (!universityKey) return false;
  const profile = normalizeProfileData(loadProfile());
  const selections = {
    ...(profile.selectedAdmissionChoices && typeof profile.selectedAdmissionChoices === "object" ? profile.selectedAdmissionChoices : {}),
  };
  const normalizedSelection = normalizeAdmissionChoiceSelection(selection);
  if (normalizedSelection) selections[universityKey] = normalizedSelection;
  else delete selections[universityKey];
  profile.selectedAdmissionChoices = selections;
  return saveProfile(profile);
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
