import { MAJOR_OPTIONS } from "../../utils/config.js";
import { safeLocalStorage } from "../../utils/safe-storage.js";

const PROGRAM_FILTERS_STORAGE_KEY = "unisearch_program_filters_v1";
export const ADMISSION_LEVELS = ["preparation", "undergraduate", "masters", "doctoral", "professional", "residency", "non_degree"];

const LEVEL_ALIASES = { bachelor: "undergraduate", master: "masters", doctorate: "doctoral", phd: "doctoral" };
let memoryStore = {};

/**
 * Normalize a study-level filter value to the reviewed admissions taxonomy.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeProgramFilterLevel(value) {
  const key = String(value || "").trim().toLowerCase();
  const normalized = LEVEL_ALIASES[key] || key;
  return ADMISSION_LEVELS.includes(normalized) ? normalized : "";
}

/**
 * Normalize a major/subject filter value.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeProgramFilterMajor(value) {
  return String(value || "").trim();
}

/**
 * Extract default program filter suggestions from an applicant profile without inferring next levels.
 * @param {Record<string, unknown> | null | undefined} profile
 * @returns {{ major: string, level: string }}
 */
export function programProfileSuggestions(profile) {
  return {
    major: normalizeProgramFilterMajor(profile?.major),
    level: normalizeProgramFilterLevel(profile?.study_level || profile?.studyLevel),
  };
}

function readAllSavedProgramFilters(storage = safeLocalStorage) {
  try {
    if (typeof storage?.getJson === "function") {
      const parsed = storage.getJson(PROGRAM_FILTERS_STORAGE_KEY, null);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      return { ...memoryStore };
    }
    const raw = storage?.getItem?.(PROGRAM_FILTERS_STORAGE_KEY);
    if (!raw) return { ...memoryStore };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return { ...memoryStore };
  }
  return {};
}

function sanitizeInstitutionRecord(record) {
  const clean = {};
  if (!record || typeof record !== "object" || Array.isArray(record)) return clean;
  if (Object.hasOwn(record, "major")) clean.major = normalizeProgramFilterMajor(record.major);
  if (Object.hasOwn(record, "level")) clean.level = normalizeProgramFilterLevel(record.level);
  return clean;
}

/**
 * Read saved per-institution program filter overrides (only fields the user changed).
 * @param {string} institutionId
 * @param {{ getJson?: (key: string, fallback?: unknown) => unknown, getItem?: (key: string) => string | null }} [storage]
 * @returns {{ major?: string, level?: string }}
 */
export function readSavedProgramFilters(institutionId, storage = safeLocalStorage) {
  const id = String(institutionId || "").trim();
  if (!id) return {};
  const all = readAllSavedProgramFilters(storage);
  return sanitizeInstitutionRecord(all[id]);
}

/**
 * Persist explicit per-institution program filter overrides separately from the applicant profile.
 * @param {string} institutionId
 * @param {{ major?: string, level?: string }} patch
 * @param {{ getJson?: (key: string, fallback?: unknown) => unknown, setJson?: (key: string, value: unknown) => boolean, getItem?: (key: string) => string | null, setItem?: (key: string, value: string) => void }} [storage]
 * @returns {{ major?: string, level?: string }}
 */
export function saveProgramFilters(institutionId, patch, storage = safeLocalStorage) {
  const id = String(institutionId || "").trim();
  if (!id) return {};
  const all = readAllSavedProgramFilters(storage);
  const next = sanitizeInstitutionRecord(all[id]);
  if (patch && Object.hasOwn(patch, "major")) next.major = normalizeProgramFilterMajor(patch.major);
  if (patch && Object.hasOwn(patch, "level")) next.level = normalizeProgramFilterLevel(patch.level);
  const updated = { ...all, [id]: next };
  memoryStore = updated;
  try {
    if (typeof storage?.setJson === "function") {
      storage.setJson(PROGRAM_FILTERS_STORAGE_KEY, updated);
    } else {
      storage?.setItem?.(PROGRAM_FILTERS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Keep the in-memory store active when localStorage is unavailable.
  }
  return next;
}

/**
 * Resolve initial Programs tab filters for an institution:
 * user-saved per-institution choices win over profile defaults, while untouched fields track the profile.
 * @param {{
 *   institutionId: string,
 *   profile?: Record<string, unknown> | null,
 *   browsing?: { major?: string, level?: string, majorFromProfile?: boolean, levelFromProfile?: boolean } | null,
 *   storage?: { getItem?: (key: string) => string | null },
 * }} options
 * @returns {{ major: string, level: string, majorFromProfile: boolean, levelFromProfile: boolean }}
 */
export function resolveInitialProgramFilters({ institutionId, profile, browsing = null, storage = safeLocalStorage }) {
  const profileDefaults = programProfileSuggestions(profile);
  const saved = readSavedProgramFilters(institutionId, storage);
  const hasSavedMajor = Object.hasOwn(saved, "major");
  const hasSavedLevel = Object.hasOwn(saved, "level");

  const majorFromProfile = typeof browsing?.majorFromProfile === "boolean"
    ? browsing.majorFromProfile
    : !hasSavedMajor;
  const levelFromProfile = typeof browsing?.levelFromProfile === "boolean"
    ? browsing.levelFromProfile
    : !hasSavedLevel;

  const major = browsing && Object.hasOwn(browsing, "major")
    ? normalizeProgramFilterMajor(browsing.major)
    : (hasSavedMajor ? saved.major : profileDefaults.major);
  const level = browsing && Object.hasOwn(browsing, "level")
    ? normalizeProgramFilterLevel(browsing.level)
    : (hasSavedLevel ? saved.level : profileDefaults.level);

  return { major, level, majorFromProfile, levelFromProfile };
}

/**
 * Build [value, label] pairs for the Programs major filter select, preserving any non-standard active value.
 * @param {string} activeMajor
 * @param {string} allLabel
 * @param {(name: string, fallback?: string) => string} translateTitle
 * @returns {Array<[string, string]>}
 */
export function buildMajorFilterOptions(activeMajor, allLabel, translateTitle) {
  const normalized = normalizeProgramFilterMajor(activeMajor);
  const options = [
    ["", allLabel],
    ...MAJOR_OPTIONS.map((value) => [value, translateTitle(value, value)]),
  ];
  if (normalized && !MAJOR_OPTIONS.includes(normalized)) {
    options.push([normalized, translateTitle(normalized, normalized)]);
  }
  return options;
}
