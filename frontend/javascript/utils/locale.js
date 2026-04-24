import { safeLocalStorage } from "./safe-storage.js";

export const I18N_STORAGE_KEY = "unisearch_ui_language_v1";
export const API_LANG_DEFAULT = "eng";
export const API_LANG_SUPPORTED = new Set(["eng", "rus"]);

export function normalizeUiLanguageForApi(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (API_LANG_SUPPORTED.has(raw)) return raw;
  if (raw.startsWith("en")) return "eng";
  if (raw.startsWith("ru")) return "rus";
  return "";
}

export function getUiLanguageForApi() {
  const stored = normalizeUiLanguageForApi(safeLocalStorage.get(I18N_STORAGE_KEY));
  if (stored) return stored;

  try {
    const first = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages[0]
      : (navigator.language || "");
    const detected = normalizeUiLanguageForApi(first);
    if (detected) return detected;
  } catch (error) {
    return API_LANG_DEFAULT;
  }

  return API_LANG_DEFAULT;
}
