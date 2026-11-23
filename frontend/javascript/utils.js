export { API_BASE, aiName, frontendStaticAsset, $, prefersReducedMotion, replayMotion, motionPress, markMotionEnter, animateElementOut, closeMotionLayer, trapFocus, initGlobalApiLoadingIndicator, debounce, setUrlParams, bindDialogLightDismiss, setManualScrollRestoration } from "./utils/runtime.js";
export { getCurrentTheme, getThemePreference, applyTheme, initTheme } from "./utils/theme.js";
export { safeSessionStorage, createSafeStorage } from "./utils/safe-storage.js";
export { EXAM_CONFIG, LANG_CONFIG, CITY_OPTIONS_BY_COUNTRY, MAJOR_OPTIONS, canonicalizeExamId, getExamConfig, getExamInputMode, getExamLevelBands, ensureExamConfig, ensureLanguageConfig, ensureCityDatabase, formatExamValue, getExamDisplayName } from "./utils/config.js";
export { stabilizeNumericRanges, escapeHtml, escapeHtmlAttr, bindImageFallbacks, nested, moneyUSD, getFlagImg, showToast } from "./utils/format.js";
export { initCustomSelect, setupSlidingIndicator } from "./utils/selects.js";
export { loadProfile, loadProfileForApi, saveProfile, clearProfile, getSelectedAdmissionChoice, saveSelectedAdmissionChoice, saveFilters, loadFilters, normalizeProfileData, isFutureProfile } from "./utils/persistence.js";
