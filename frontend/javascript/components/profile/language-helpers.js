import {
  LANG_CONFIG,
  loadProfile,
  normalizeProfileData,
  saveProfile,
  getExamDisplayName,
} from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { parseValidationErrorDetail } from "./profile-utils.js";

export const KIND_NATIVE = "native";
export const KIND_CEFR = "cefr";
export const KIND_EXAM = "exam";

export const CEFR_LABEL = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
  6: "C2",
};

export function getConfigOrNull() {
  return (typeof LANG_CONFIG !== "undefined" && LANG_CONFIG) ? LANG_CONFIG : null;
}

export function normalizeKind(kindRaw) {
  const kind = String(kindRaw || "").trim().toLowerCase();
  if (kind === KIND_NATIVE) return KIND_NATIVE;
  if (kind === KIND_CEFR) return KIND_CEFR;
  if (kind === KIND_EXAM) return KIND_EXAM;
  return "";
}

export function getLangLabel(cfg, code) {
  const item = (cfg.languages || []).find((x) => x.code === code);
  const normalizedCode = String(code || "").trim().toLowerCase();
  const fallback = item?.native_name || item?.name || item?.label || normalizedCode || code;
  return t(`languages.name.${normalizedCode}`, fallback);
}

export function getLocalizedKindLabel(kindId, fallback = "") {
  const kind = normalizeKind(kindId);
  if (kind === KIND_NATIVE) return t("languages.kind.native", "Native");
  if (kind === KIND_CEFR) return t("languages.kind.cefr", "CEFR");
  if (kind === KIND_EXAM) return t("languages.kind.exam", "Exam");
  return String(fallback || kindId || "");
}

export function getKindLabel(cfg, kindId) {
  const item = (cfg.proof_kinds || []).find((x) => x.id === kindId);
  return getLocalizedKindLabel(kindId, item?.label || kindId);
}

function getExamList(cfg, langCode) {
  return (cfg.language_exams && cfg.language_exams[langCode]) ? cfg.language_exams[langCode] : [];
}

export function getVisibleExamList(cfg, langCode) {
  return getExamList(cfg, langCode).filter((item) => !item?.hidden);
}

export function getExam(cfg, langCode, examId) {
  return getExamList(cfg, langCode).find((x) => String(x?.id || "").trim() === String(examId || "").trim()) || null;
}

export function getExamInputMode(examObj) {
  const raw = String(examObj?.input_mode || "").trim().toLowerCase();
  return raw || "number";
}

export function getBreakdownScheme(examObj) {
  const scheme = examObj?.breakdown_scheme;
  return scheme && typeof scheme === "object" ? scheme : {};
}

export function usesOverallScoreInput(examObj) {
  if (getExamInputMode(examObj) !== "subject_breakdown") return false;
  const scheme = getBreakdownScheme(examObj);
  const strategy = String(scheme.total_strategy || "use_parent_score").trim().toLowerCase();
  return strategy === "use_parent_score" && !normalizeBreakdownDefs(scheme.fixed_components).some((def) => def.required);
}

export function normalizeBreakdownDefs(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const exam = String(row.exam || row.id || row.exam_id || "").trim();
      if (!exam) return null;
      return {
        exam,
        label: String(row.label || "").trim() || exam,
        required: !!row.required,
      };
    })
    .filter(Boolean);
}

export function clearNumericInputLimits(inputEl) {
  if (!inputEl) return;
  inputEl.removeAttribute("min");
  inputEl.removeAttribute("max");
  inputEl.removeAttribute("step");
}

export function setNumericInputLimits(inputEl, examObj) {
  if (!inputEl) return;
  if (!examObj) {
    clearNumericInputLimits(inputEl);
    return;
  }
  if (examObj.min !== undefined) inputEl.min = String(examObj.min);
  else inputEl.removeAttribute("min");
  if (examObj.max !== undefined) inputEl.max = String(examObj.max);
  else inputEl.removeAttribute("max");
  if (examObj.step !== undefined) inputEl.step = String(examObj.step);
  else inputEl.step = "0.5";
}

function isMultipleOfStep(score, min, step) {
  const k = (score - min) / step;
  return Math.abs(k - Math.round(k)) < 1e-9;
}

function clonePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return structuredClone(value);
  } catch {
    return null;
  }
}

export function getProfileDraftBridge() {
  const bridge = window.__unisearchProfileDraft;
  if (!bridge || typeof bridge !== "object") return null;
  if (typeof bridge.get !== "function" || typeof bridge.set !== "function") return null;
  if (typeof bridge.isActive === "function" && !bridge.isActive()) return null;
  return bridge;
}

export function loadEditableProfile() {
  const bridge = getProfileDraftBridge();
  if (bridge) {
    return normalizeProfileData(bridge.get());
  }
  return normalizeProfileData(loadProfile());
}

export function saveEditableProfile(profile) {
  const bridge = getProfileDraftBridge();
  const next = normalizeProfileData(profile);
  if (bridge) {
    bridge.set(next);
    return;
  }
  saveProfile(next);
}

export function normalizeLangEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const code = String(entry.code || entry.lang || "").trim().toLowerCase();
  const kind = normalizeKind(entry.kind);
  if (!code || !kind) return null;

  if (kind === KIND_NATIVE) return { code, kind };

  if (kind === KIND_CEFR) {
    const level = Number(entry.level);
    if (!Number.isInteger(level) || level < 1 || level > 6) return null;
    return { code, kind, level };
  }

  if (kind === KIND_EXAM) {
    const examId = String(entry.exam || entry.examId || "").trim();
    const rawValue = String(entry.raw_value || entry.rawValue || "").trim();
    const displayValue = String(entry.display_value || entry.displayValue || "").trim();
    const details = clonePlainObject(entry.details);
    const score = Number(entry.score);
    if (!examId || (Number.isNaN(score) && !rawValue && !details)) return null;
    const out = { code, kind, exam: examId };
    const takenOn = String(entry.taken_on || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(takenOn) && takenOn <= new Date().toISOString().slice(0, 10)) out.taken_on = takenOn;
    if (!Number.isNaN(score)) out.score = score;
    if (rawValue) out.raw_value = rawValue;
    if (displayValue) out.display_value = displayValue;
    if (details) out.details = details;
    return out;
  }

  return null;
}

function getCompositeParentLabel(examObj) {
  const raw = String(getBreakdownScheme(examObj)?.parent_score_label || "").trim();
  const normalized = raw.toLowerCase();
  if (normalized === "overall") return t("languages.exam_total_overall", "Overall");
  if (normalized === "total") return t("languages.exam_total_total", "Total");
  return raw || t("languages.exam_total_total", "Total");
}

export function formatValuePart(value) {
  const raw = String(value?.display_value || value?.displayValue || value?.raw_value || value?.rawValue || "").trim();
  if (raw) return raw;
  const score = Number(value?.score);
  return Number.isFinite(score) ? String(score) : "";
}

export function formatLanguageExamValue(cfg, entry) {
  if (!entry || entry.kind !== KIND_EXAM) return "";
  const examObj = getExam(cfg, entry.code, entry.exam);
  const mode = getExamInputMode(examObj);
  if (mode === "subject_breakdown") {
    const components = Array.isArray(entry?.details?.components) ? entry.details.components : [];
    const parts = [];
    if (Number.isFinite(Number(entry.score))) {
      parts.push(`${getCompositeParentLabel(examObj)} ${entry.score}`);
    }
    components.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const childExam = String(item.exam || item.id || item.exam_id || "").trim();
      const value = formatValuePart(item);
      if (!childExam || !value) return;
      parts.push(`${getExamDisplayName(childExam, { langCode: entry.code, locale: getCurrentLanguage() })} ${value}`);
    });
    if (parts.length) return parts.join(", ");
  }

  const display = String(entry.display_value || entry.displayValue || entry.raw_value || entry.rawValue || "").trim();
  if (display) return display;

  const score = Number(entry.score);
  return Number.isFinite(score) ? String(score) : "";
}

export function formatLanguageValidationToast(code, examId, detailRaw) {
  const examLabel = getExamDisplayName(examId, { langCode: code, locale: getCurrentLanguage() });
  const { detail, rangeMatch, stepMatch } = parseValidationErrorDetail(detailRaw);
  if (!detail) {
    return tFormat("languages.error.generic", { exam: examLabel }, `Could not save ${examLabel}`);
  }

  if (rangeMatch) {
    return tFormat(
      "languages.error.range",
      { exam: examLabel, min: rangeMatch[1], max: rangeMatch[2] },
      `${examLabel} must be between ${rangeMatch[1]} and ${rangeMatch[2]}`
    );
  }

  if (stepMatch) {
    return tFormat(
      "languages.error.step",
      { exam: examLabel, step: stepMatch[1] },
      `${examLabel} must use step ${stepMatch[1]}`
    );
  }

  if (/integer/i.test(detail)) {
    return tFormat(
      "languages.error.integer_required",
      { exam: examLabel },
      `${examLabel} requires an integer score`
    );
  }

  if (/invalid score format/i.test(detail)) {
    return t("languages.error.enter_score", "Enter score");
  }

  return tFormat(
    "languages.error.detail",
    { exam: examLabel, reason: detail },
    `Could not save ${examLabel}: ${detail}`
  );
}

export function validateExamScore(examObj, code, rawInput, { required = true } = {}) {
  const normalizedRaw = String(rawInput || "").trim().replaceAll(",", ".");
  if (!normalizedRaw) {
    return required ? { error: t("languages.error.enter_score", "Enter score") } : { empty: true };
  }

  const score = Number(normalizedRaw);
  if (Number.isNaN(score)) {
    return { error: t("languages.error.enter_score", "Enter score") };
  }

  const examLabel = getExamDisplayName(examObj?.id, { langCode: code, locale: getCurrentLanguage() });
  const examType = String(examObj?.type || "").trim().toLowerCase();
  if (examType === "int" && !Number.isInteger(score)) {
    return {
      error: tFormat(
        "languages.error.integer_required",
        { exam: examLabel },
        `${examLabel} requires an integer score`
      ),
    };
  }

  const min = Number(examObj?.min);
  const max = Number(examObj?.max);
  if (Number.isFinite(min) && Number.isFinite(max) && (score < min || score > max)) {
    return {
      error: tFormat(
        "languages.error.range",
        { exam: examLabel, min, max },
        `${examLabel} must be between ${min} and ${max}`
      ),
    };
  }

  const step = Number(examObj?.step ?? 1);
  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    if (!isMultipleOfStep(score, base, step)) {
      return {
        error: tFormat(
          "languages.error.step",
          { exam: examLabel, step },
          `${examLabel} must use step ${step}`
        ),
      };
    }
  }

  return { score, raw: normalizedRaw };
}

export function findExistingExamEntry(profile, code, examId, takenOn = "") {
  const rows = (Array.isArray(profile?.languages) ? profile.languages : [])
    .map(normalizeLangEntry)
    .filter(Boolean);
  return rows.find((row) => row.code === code && row.kind === KIND_EXAM && row.exam === examId && String(row.taken_on || "") === takenOn) || null;
}

/**
 * The position of the entry being edited, when the submitted entry is still the same language, kind and test.
 * @param {Array<{code: string, kind: string, exam?: string}>} rows Saved, normalized language entries.
 * @param {object|null} edited The saved entry that was opened with "Edit", or null for a new entry.
 * @param {{code: string, kind: string, exam?: string}} submitted The validated entry about to be saved.
 * @returns {number} The index to replace, or -1 to add or match by date instead.
 */
export function findEditedLanguageIndex(rows, edited, submitted) {
  if (!edited || edited.code !== submitted.code || edited.kind !== submitted.kind
    || (submitted.kind === KIND_EXAM && edited.exam !== submitted.exam)) return -1;
  const key = JSON.stringify(edited);
  return rows.findIndex(row => JSON.stringify(row) === key);
}
