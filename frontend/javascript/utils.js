export { API_BASE, AI_FUNCTIONS, aiName, frontendStaticAsset, $, prefersReducedMotion, replayMotion, motionPress, markMotionEnter, animateElementOut, initGlobalApiLoadingIndicator, debounce, setUrlParams } from "./utils/runtime.js";
export { getCurrentTheme, applyTheme, initTheme, toggleTheme } from "./utils/theme.js";
export { I18N_STORAGE_KEY, API_LANG_DEFAULT, API_LANG_SUPPORTED, normalizeUiLanguageForApi, getUiLanguageForApi } from "./utils/locale.js";
export { safeLocalStorage, safeSessionStorage, createSafeStorage } from "./utils/safe-storage.js";
export { EXAM_CONFIG, LANG_CONFIG, CITY_OPTIONS_BY_COUNTRY, MAJOR_OPTIONS, FALLBACK_LANG_LIMITS, canonicalizeExamId, getExamConfig, getExamInputMode, getExamLevelBands, getExamBandShortLabel, ensureExamConfig, ensureLanguageConfig, ensureCityDatabase, formatExamValue, getExamDisplayName, getLangExamLimits, clampNumberToLimits, applyNumberInputLimits, applyLanguageExamInputLimits } from "./utils/config.js";
export { stabilizeNumericRanges, escapeHtml, escapeHtmlAttr, bindImageFallbacks, nested, initials, moneyUSD, formatPlural, getFlagImg, showToast, removeToast } from "./utils/format.js";
export { initCustomSelect, setupSlidingIndicator } from "./utils/selects.js";
export { loadProfile, loadProfileForApi, saveProfile, getSelectedAdmissionChoice, saveSelectedAdmissionChoice, saveFilters, loadFilters, normalizeProfileData } from "./utils/persistence.js";
