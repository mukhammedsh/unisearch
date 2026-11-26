import { TIME_ZONE_COUNTRY } from "../data/region-currency.js";
import { safeLocalStorage } from "./safe-storage.js";

export const I18N_STORAGE_KEY = "unisearch_ui_language_v1";
export const API_LANG_DEFAULT = "eng";

const API_LANG_SUPPORTED = new Set(["eng", "rus", "kaz"]);
const CIS_RUSSIAN_FALLBACK_COUNTRIES = new Set([
  "AM",
  "AZ",
  "BY",
  "KG",
  "MD",
  "RU",
  "TJ",
  "TM",
  "UZ",
]);

/**
 * Normalize an arbitrary locale or UI code to a supported UniSearch language code.
 * @param {unknown} value
 * @returns {"eng"|"rus"|"kaz"|""}
 */
export function normalizeUiLanguageForApi(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (API_LANG_SUPPORTED.has(raw)) return /** @type {"eng"|"rus"|"kaz"} */ (raw);
  const primary = raw.split(/[-_]/)[0];
  if (primary === "en" || primary === "eng") return "eng";
  if (primary === "ru" || primary === "rus") return "rus";
  if (primary === "kk" || primary === "kaz") return "kaz";
  return "";
}

/**
 * Extract an uppercase ISO 3166-1 alpha-2 region subtag from a BCP 47 tag when present.
 * @param {unknown} tag
 * @returns {string}
 */
function extractLocaleRegion(tag) {
  const raw = String(tag || "").trim();
  if (!raw) return "";
  if (typeof Intl?.Locale === "function") {
    try {
      const region = new Intl.Locale(raw).region;
      if (region) return region.toUpperCase();
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  const match = raw.match(/^[a-zA-Z]{2,3}[-_]([a-zA-Z]{2})\b/);
  return match ? match[1].toUpperCase() : "";
}

/**
 * Determine the first-visit interface language when the visitor has not saved a manual choice:
 * - Visitors in Kazakhstan (by IANA time zone or primary locale region) start in Kazakh ("kaz").
 * - Visitors elsewhere match their ordered browser language list ("kaz", "rus", "eng").
 * - When no browser language matches directly, CIS regions where Russian is a common second language
 *   fall back to "rus" and all other regions fall back to "eng".
 * @param {{ timeZone?: string, languages?: string[] }} [signals]
 * @returns {"eng"|"rus"|"kaz"}
 */
export function detectInitialUiLanguage({ timeZone = "", languages = [] } = {}) {
  const candidates = (Array.isArray(languages) ? languages : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const tzCountry = TIME_ZONE_COUNTRY[String(timeZone || "").trim()] || "";
  const primaryRegion = extractLocaleRegion(candidates[0]);
  if (tzCountry === "KZ" || primaryRegion === "KZ") {
    return "kaz";
  }

  for (const tag of candidates) {
    const matched = normalizeUiLanguageForApi(tag);
    if (matched) return matched;
  }

  const languageRegions = candidates.map(extractLocaleRegion).filter(Boolean);
  for (const country of [tzCountry, ...languageRegions]) {
    if (country === "KZ") return "kaz";
    if (CIS_RUSSIAN_FALLBACK_COUNTRIES.has(country)) return "rus";
  }

  return API_LANG_DEFAULT;
}

function isStorageAccessError(error) {
  return error instanceof Error && (
    error.name === "SecurityError"
    || error.name === "QuotaExceededError"
    || error.name === "InvalidAccessError"
  );
}

function readRawStoredLanguage() {
  const fromWindow = safeLocalStorage.get(I18N_STORAGE_KEY, "");
  if (fromWindow) return fromWindow;
  if (typeof localStorage === "object" && typeof localStorage?.getItem === "function") {
    try {
      return localStorage.getItem(I18N_STORAGE_KEY) || "";
    } catch (error) {
      if (isStorageAccessError(error)) return "";
      throw error;
    }
  }
  return "";
}

/**
 * Persist an explicit language choice to localStorage.
 * @param {string} lang
 */
export function writeStoredUiLanguage(lang) {
  const normalized = normalizeUiLanguageForApi(lang);
  if (!normalized) return;
  if (safeLocalStorage.set(I18N_STORAGE_KEY, normalized)) return;
  if (typeof localStorage === "object" && typeof localStorage?.setItem === "function") {
    try {
      localStorage.setItem(I18N_STORAGE_KEY, normalized);
    } catch (error) {
      if (isStorageAccessError(error)) return;
      throw error;
    }
  }
}

function readUrlUiLanguage() {
  const rawSearch = typeof window === "object" ? String(window?.location?.search || "") : "";
  if (!rawSearch) return "";
  return normalizeUiLanguageForApi(new URLSearchParams(rawSearch).get("lang"));
}

function readDeviceSignals() {
  const timeZone = typeof Intl?.DateTimeFormat === "function"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    : "";
  const languages = typeof navigator === "object" && navigator !== null
    ? [...(Array.isArray(navigator.languages) ? navigator.languages : []), navigator.language].filter(Boolean)
    : [];
  return { timeZone, languages };
}

/**
 * Resolve the active UI language and the source that selected it.
 * @returns {{ language: "eng"|"rus"|"kaz", source: "url"|"storage"|"device" }}
 */
export function resolveUiLanguage() {
  const fromUrl = readUrlUiLanguage();
  if (fromUrl) return { language: fromUrl, source: "url" };

  const stored = normalizeUiLanguageForApi(readRawStoredLanguage());
  if (stored) return { language: stored, source: "storage" };

  return {
    language: detectInitialUiLanguage(readDeviceSignals()),
    source: "device",
  };
}

export function getUiLanguageForApi() {
  return resolveUiLanguage().language;
}
