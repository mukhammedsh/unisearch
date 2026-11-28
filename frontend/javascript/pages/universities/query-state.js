/* frontend/javascript/pages/universities/query-state.js */

import { loadProfile, loadProfileForApi } from "../../utils.js";
import { getCurrentLanguage } from "../../i18n.js";
import { convert, getFilterLimits, getPreferredCurrency } from "../../currency.js";
import { hasProfileForRanking } from "../../components/profile/profile-utils.js";
import { numberLocale } from "../../utils/format.js";
import {
    MAX_COMPARE_UNIVERSITIES,
    fundingPreferenceToQueryValue,
    normalizeSortMode,
} from "../_shared.js";

export { hasProfileForRanking };

/**
 * Resolve the active funding preference from the stored applicant profile.
 * @returns {string}
 */
export function getProfileFundingQueryValue() {
    const profile = loadProfile();
    return fundingPreferenceToQueryValue(profile?.fundingType || profile?.funding_type || "any");
}

/**
 * Determine whether the profile contains any exam or language evidence.
 * @param {Record<string, unknown>|null|undefined} profile
 * @returns {boolean}
 */
export function hasProfileEvidence(profile) {
    const exams = Array.isArray(profile?.exams) ? profile.exams : [];
    const langs = Array.isArray(profile?.languages) ? profile.languages : [];
    return exams.length > 0 || langs.length > 0;
}

/**
 * Clamp a numeric preference slider value to [0, 100].
 * @param {unknown} value
 * @param {number} [fallback=50]
 * @returns {number}
 */
export function clampPercent(value, fallback = 50) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Clamp a tuition input value to the active currency limits.
 * @param {unknown} value
 * @param {{ min: number, max: number, step: number }} limits
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function clampTuition(value, limits, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(limits.min, Math.min(limits.max, Math.round(n)));
}

/**
 * Show a whole tuition amount in a price field with the interface language's digit grouping ("46 000 000").
 * @param {unknown} value
 * @returns {string} an empty string when the value is not a number
 */
export function formatTuitionInput(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 0 }).format(Math.round(n));
}

/**
 * Read a whole tuition amount typed into a price field, ignoring digit-group separators.
 * @param {unknown} text
 * @returns {number} NaN when the field is empty or holds anything but digits
 */
export function parseTuitionInput(text) {
    const digits = String(text ?? "").replace(/[\s,.'\u00a0\u202f]/g, "");
    return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

/**
 * Safely parse window search parameters.
 * @returns {URLSearchParams}
 */
export function readPageParams() {
    try {
        return new URLSearchParams(window.location.search || "");
    } catch {
        return new URLSearchParams();
    }
}

/**
 * Normalize the requested universities view tab name.
 * @param {unknown} value
 * @returns {"catalog"|"compare"}
 */
function normalizeUniversitiesTab(value) {
    const raw = String(value || "").trim().toLowerCase();
    return ["catalog", "compare"].includes(raw) ? raw : "catalog";
}

/**
 * Deduplicate and bound a list of university comparison IDs.
 * @param {unknown} ids
 * @param {number} [maxCount]
 * @returns {string[]}
 */
export function normalizeCompareIdList(ids, maxCount = MAX_COMPARE_UNIVERSITIES) {
    return Array.from(new Set(
        (Array.isArray(ids) ? ids : [])
            .map((item) => String(item || "").trim())
            .filter(Boolean)
    )).slice(0, maxCount);
}

/**
 * Parse a comma-separated comparison ID list query parameter.
 * @param {unknown} value
 * @param {number} [maxCount]
 * @returns {string[]}
 */
export function parseCompareIds(value, maxCount = MAX_COMPARE_UNIVERSITIES) {
    return normalizeCompareIdList(String(value || "").split(","), maxCount);
}

function convertSavedTuitionBound(rawValue, { savedCurrency, currentCurrency, currentLimits, treatOldMaxAsOpen }) {
    if (rawValue === undefined || rawValue === null || rawValue === "") return null;
    let numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return null;
    if (savedCurrency && savedCurrency !== currentCurrency) {
        if (treatOldMaxAsOpen && numeric >= getFilterLimits(savedCurrency).max) {
            numeric = currentLimits.max;
        } else {
            const usd = convert(numeric, savedCurrency, "USD");
            numeric = Math.round(convert(usd, "USD", currentCurrency) / currentLimits.step) * currentLimits.step;
        }
    }
    return Math.max(currentLimits.min, Math.min(currentLimits.max, numeric));
}

function convertUsdUrlTuitionBound(rawValue, { currentCurrency, currentLimits, fallback }) {
    if (rawValue === null || rawValue === undefined) return fallback;
    const raw = Number(rawValue);
    if (!Number.isFinite(raw)) return fallback;
    const inPref = currentCurrency === "USD" ? raw : convert(raw, "USD", currentCurrency);
    const stepped = Math.round(inPref / currentLimits.step) * currentLimits.step;
    return clampTuition(stepped, currentLimits, fallback);
}

/**
 * Build initial reactive catalog state from URL query params and persisted filters.
 * @param {{
 *   pageParams: URLSearchParams,
 *   savedState: Record<string, unknown>,
 *   currentCurrency: string,
 *   currentLimits: { min: number, max: number, step: number },
 * }} options
 */
export function createInitialCatalogState({ pageParams, savedState, currentCurrency, currentLimits }) {
    const initialCompareIds = parseCompareIds(pageParams.get("ids"));
    const tabFromUrl = pageParams.get("tab");
    const tabFromSaved = savedState.activeTab || null;
    const initialTab = normalizeUniversitiesTab(tabFromUrl || tabFromSaved || "catalog");

    const pageParamsSort = pageParams.get("sort");
    const pageParamsQ = pageParams.get("q");
    const initialQ = String(pageParamsQ !== null ? pageParamsQ : (savedState.q || "")).trim();
    const defaultSortMode = initialQ ? "relevance" : (hasProfileForRanking(loadProfile()) ? "uni_ai" : "name_asc");

    let initialMin = convertSavedTuitionBound(savedState.min_tuition, {
        savedCurrency: savedState.currency,
        currentCurrency,
        currentLimits,
        treatOldMaxAsOpen: false,
    });
    if (initialMin === null) initialMin = currentLimits.min;

    let initialMax = convertSavedTuitionBound(savedState.max_tuition, {
        savedCurrency: savedState.currency,
        currentCurrency,
        currentLimits,
        treatOldMaxAsOpen: true,
    });
    if (initialMax === null) initialMax = currentLimits.max;

    const minRangeGap = currentLimits.step;
    if (initialMin > currentLimits.max - minRangeGap) initialMin = currentLimits.max - minRangeGap;
    if (initialMax < initialMin + minRangeGap) initialMax = Math.min(currentLimits.max, initialMin + minRangeGap);

    let resolvedSort = pageParamsSort || savedState.sort;
    if (initialQ && !pageParamsSort && (!resolvedSort || resolvedSort === "name_asc")) {
        resolvedSort = "relevance";
    }

    const state = {
        q: initialQ,
        country: savedState.country || "",
        region: savedState.region || "",
        city: savedState.city || "",
        study_level: savedState.study_level || "",
        funding_type: getProfileFundingQueryValue(),
        currency: currentCurrency,
        min_tuition: initialMin,
        max_tuition: initialMax,
        cost_basis: savedState.cost_basis === "tuition" ? "tuition" : "annual_total",
        sort: normalizeSortMode(resolvedSort || defaultSortMode),
        practice_vs_science: clampPercent(savedState.practice_vs_science, 50),
        social_vs_hardcore: clampPercent(
            savedState.social_vs_hardcore !== undefined ? savedState.social_vs_hardcore : savedState.admission_bias,
            50
        ),
        budget_vs_prestige: clampPercent(
            savedState.budget_vs_prestige !== undefined ? savedState.budget_vs_prestige : savedState.ai_balance,
            50
        ),
        city_vs_campus: clampPercent(savedState.city_vs_campus, 50),
        only_saved: savedState.only_saved === true || savedState.only_saved === "true" || savedState.only_saved === "1",
        only_reviewed: savedState.only_reviewed === true || savedState.only_reviewed === "true" || savedState.only_reviewed === "1",
        activeTab: initialTab,
        viewMode: savedState.viewMode || "list",
        page: 1,
        limit: 24,
    };

    return { state, defaultSortMode, initialCompareIds };
}

/**
 * Count currently active non-default catalog filters.
 * @param {Record<string, unknown>} state
 * @param {{ min: number, max: number }} limits
 * @returns {number}
 */
export function countActiveFilters(state, limits) {
    let count = 0;
    if (state.q) count += 1;
    if (state.country) count += 1;
    if (state.region) count += 1;
    if (state.city) count += 1;
    if (Number(state.min_tuition) > limits.min || Number(state.max_tuition) < limits.max) count += 1;
    if (state.sort && state.sort !== "name_asc" && !(state.q && state.sort === "relevance")) count += 1;
    if (state.study_level) count += 1;
    if (state.funding_type && state.funding_type !== "any") count += 1;
    if (state.only_saved) count += 1;
    if (state.only_reviewed) count += 1;
    return count;
}

/**
 * Convert slider/state tuition bounds in preferred currency to USD API bounds.
 * @param {Record<string, unknown>} state
 * @param {{ minSlider?: HTMLInputElement|null, maxSlider?: HTMLInputElement|null, currentCurrency?: string, currentLimits: { min: number, max: number } }} options
 * @returns {{ min_tuition?: number, max_tuition?: number }}
 */
function getApiTuitionParams(state, { minSlider, maxSlider, currentCurrency, currentLimits }) {
    const pref = currentCurrency || getPreferredCurrency();
    const minSliderVal = Number(minSlider ? minSlider.value : state.min_tuition);
    const maxSliderVal = Number(maxSlider ? maxSlider.value : state.max_tuition);
    const result = {};

    if (Number.isFinite(minSliderVal) && minSliderVal > currentLimits.min) {
        const usdMin = convert(minSliderVal, pref, "USD");
        result.min_tuition = Math.max(0, Math.floor(usdMin) - 1);
    }

    if (Number.isFinite(maxSliderVal) && maxSliderVal < currentLimits.max) {
        const usdMax = convert(maxSliderVal, pref, "USD");
        result.max_tuition = Math.ceil(usdMax) + 1;
    }

    return result;
}

/**
 * Serialize catalog filter state to URLSearchParams for either backend API or page URL.
 * @param {Record<string, unknown>} state
 * @param {{
 *   forApi?: boolean,
 *   minSlider?: HTMLInputElement|null,
 *   maxSlider?: HTMLInputElement|null,
 *   currentCurrency?: string,
 *   currentLimits: { min: number, max: number },
 *   focusUniId?: string,
 * }} options
 * @returns {URLSearchParams}
 */
export function buildCatalogParams(state, {
    forApi = false,
    minSlider = null,
    maxSlider = null,
    currentCurrency = "",
    currentLimits,
    focusUniId = "",
}) {
    const p = new URLSearchParams();
    const uiLang = getCurrentLanguage();
    if (uiLang) p.set("lang", uiLang);
    if (forApi) p.set("fields", "card");
    state.funding_type = getProfileFundingQueryValue();
    if (state.q) p.set("q", state.q);
    if (state.country) p.set("country", state.country);
    if (state.region) p.set("region", state.region);
    if (state.city) p.set("city", state.city);

    const tuitionParams = getApiTuitionParams(state, { minSlider, maxSlider, currentCurrency, currentLimits });
    if (tuitionParams.min_tuition !== undefined) p.set("min_tuition", String(tuitionParams.min_tuition));
    if (tuitionParams.max_tuition !== undefined) p.set("max_tuition", String(tuitionParams.max_tuition));
    if (state.cost_basis === "tuition") p.set("cost_basis", "tuition");
    if (state.study_level) p.set("study_level", state.study_level);
    if (state.funding_type) p.set("funding_type", state.funding_type);

    const isAiSort = state.sort === "uni_ai";
    const clientFiltered = Boolean(state.only_saved || state.only_reviewed);
    if (forApi) p.set("sort", isAiSort ? "name_asc" : state.sort);

    if (forApi && clientFiltered) {
        p.set("limit", "2000");
        p.set("page", "1");
    } else if (forApi && state.viewMode === "map") {
        p.set("limit", "200");
        p.set("page", "1");
    } else if (forApi && isAiSort) {
        p.set("limit", "100");
        p.set("page", "1");
    } else {
        p.set("page", String(state.page));
        p.set("limit", String(state.limit));
    }

    if (forApi && state.practice_vs_science !== undefined && state.practice_vs_science !== null) {
        p.set("practice_vs_science", String(state.practice_vs_science));
    }
    if (forApi && state.social_vs_hardcore !== undefined && state.social_vs_hardcore !== null) {
        p.set("social_vs_hardcore", String(state.social_vs_hardcore));
    }
    if (forApi && state.budget_vs_prestige !== undefined && state.budget_vs_prestige !== null) {
        p.set("budget_vs_prestige", String(state.budget_vs_prestige));
    }
    if (forApi && state.city_vs_campus !== undefined && state.city_vs_campus !== null) {
        p.set("city_vs_campus", String(state.city_vs_campus));
    }
    if (state.viewMode) p.set("view", state.viewMode);
    if (!forApi && state.sort && state.sort !== "name_asc") p.set("sort", state.sort);
    if (!forApi && state.only_saved) p.set("only_saved", "1");
    if (!forApi && state.only_reviewed) p.set("only_reviewed", "1");
    if (!forApi && focusUniId) p.set("focus_uni", focusUniId);
    return p;
}

/**
 * Build browser URL search parameters reflecting the active catalog/compare tab.
 * @param {Record<string, unknown>} state
 * @param {Parameters<typeof buildCatalogParams>[1]} options
 * @returns {URLSearchParams}
 */
export function buildSectionUrlParams(state, options) {
    const params = buildCatalogParams(state, { ...options, forApi: false });
    if (state.activeTab === "compare") {
        params.set("tab", "compare");
    } else {
        params.delete("tab");
    }
    params.delete("compare");
    params.delete("ids");
    params.delete("choices");
    return params;
}

/**
 * Build request body for the UniFit AI sort endpoint.
 * @param {Record<string, unknown>} state
 * @param {{
 *   minSlider?: HTMLInputElement|null,
 *   maxSlider?: HTMLInputElement|null,
 *   currentCurrency?: string,
 *   currentLimits: { min: number, max: number },
 *   logTranslationDebug?: (label: string, payload: Record<string, unknown>) => void,
 * }} options
 * @returns {Record<string, unknown>}
 */
export function buildCatalogAiSortPayload(state, {
    minSlider = null,
    maxSlider = null,
    currentCurrency = "",
    currentLimits,
    logTranslationDebug = null,
}) {
    const profile = loadProfileForApi();
    const uiLang = getCurrentLanguage();
    const isMapMode = state.viewMode === "map";
    const shouldClientPageSaved = Boolean(state.only_saved || state.only_reviewed);
    const payload = {
        profile,
        lang: uiLang,
        practice_vs_science: state.practice_vs_science,
        social_vs_hardcore: state.social_vs_hardcore,
        budget_vs_prestige: state.budget_vs_prestige,
        city_vs_campus: state.city_vs_campus,
        page: (isMapMode || shouldClientPageSaved) ? 1 : state.page,
        limit: shouldClientPageSaved ? 2000 : (isMapMode ? 200 : state.limit),
    };
    state.funding_type = getProfileFundingQueryValue();
    if (state.q) payload.q = state.q;
    if (state.country) payload.country = state.country;
    if (state.region) payload.region = state.region;
    if (state.city) payload.city = state.city;
    if (state.study_level) payload.study_level = state.study_level;
    if (state.funding_type) payload.funding_type = state.funding_type;
    payload.cost_basis = state.cost_basis;

    const tuitionParams = getApiTuitionParams(state, { minSlider, maxSlider, currentCurrency, currentLimits });
    if (tuitionParams.min_tuition !== undefined) payload.min_tuition = tuitionParams.min_tuition;
    if (tuitionParams.max_tuition !== undefined) payload.max_tuition = tuitionParams.max_tuition;

    logTranslationDebug?.("ai-sort payload", {
        viewMode: state.viewMode,
        uiLang,
        localeInProfile: profile?.locale || profile?.language || profile?.lang || "",
        interestsRawLength: String(profile?.interests || "").trim().length,
    });
    return payload;
}

/**
 * Derive fallback list API params when AI sorting cannot complete quickly.
 * @param {URLSearchParams} apiParams
 * @param {Record<string, unknown>} state
 * @returns {URLSearchParams}
 */
export function buildFallbackListParams(apiParams, state) {
    const fallback = new URLSearchParams(apiParams.toString());
    const clientFiltered = Boolean(state.only_saved || state.only_reviewed);
    fallback.set("sort", state.q ? "relevance" : "name_asc");
    fallback.set("page", clientFiltered ? "1" : String(state.page));
    fallback.set("limit", clientFiltered ? "2000" : String(state.limit));
    return fallback;
}

/**
 * Hydrate mutable catalog state from the current browser URL query string.
 * @param {Record<string, unknown>} state
 * @param {{ currentCurrency: string, currentLimits: { min: number, max: number, step: number } }} options
 * @returns {{ focusUniId: string }}
 */
export function applyUrlParamsToState(state, { currentCurrency, currentLimits }) {
    const sp = new URL(window.location.href).searchParams;
    let focusUniId = "";

    if (sp.has("q")) state.q = sp.get("q");
    if (sp.has("sort")) state.sort = normalizeSortMode(sp.get("sort"));
    else if (sp.has("q") && state.sort === "name_asc") state.sort = "relevance";
    if (sp.has("country")) state.country = sp.get("country");
    if (sp.has("region")) state.region = sp.get("region");
    if (sp.has("city")) state.city = sp.get("city");
    if (sp.has("study_level")) state.study_level = sp.get("study_level");
    if (sp.has("cost_basis")) state.cost_basis = sp.get("cost_basis") === "tuition" ? "tuition" : "annual_total";

    if (sp.has("min_tuition")) {
        state.min_tuition = convertUsdUrlTuitionBound(sp.get("min_tuition"), {
            currentCurrency,
            currentLimits,
            fallback: state.min_tuition,
        });
    }
    if (sp.has("max_tuition")) {
        state.max_tuition = convertUsdUrlTuitionBound(sp.get("max_tuition"), {
            currentCurrency,
            currentLimits,
            fallback: state.max_tuition,
        });
    }
    if (sp.has("only_saved")) {
        state.only_saved = ["1", "true", "yes", "on"].includes(String(sp.get("only_saved") || "").trim().toLowerCase());
    }
    if (sp.has("only_reviewed")) {
        state.only_reviewed = ["1", "true", "yes", "on"].includes(String(sp.get("only_reviewed") || "").trim().toLowerCase());
    }
    if (sp.has("page")) {
        const page = Number(sp.get("page"));
        if (Number.isFinite(page) && page >= 1) state.page = Math.floor(page);
    }
    if (sp.has("view")) {
        const view = sp.get("view");
        if (view === "map" || view === "list") state.viewMode = view;
    }
    if (sp.has("focus_uni")) {
        const id = String(sp.get("focus_uni") || "").trim();
        if (id) focusUniId = id;
    }

    const minGap = currentLimits.step;
    if (state.min_tuition > (currentLimits.max - minGap)) state.min_tuition = currentLimits.max - minGap;
    state.max_tuition = Math.min(currentLimits.max, state.max_tuition);
    if (state.max_tuition < state.min_tuition + minGap) {
        state.max_tuition = state.min_tuition + minGap;
    }

    return { focusUniId };
}
