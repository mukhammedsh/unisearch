/* frontend/javascript/pages/universities.js */

import {
  API_BASE,
  $,
  debounce,
  loadFilters,
  saveFilters,
  setUrlParams,
  nested,
  escapeHtml,
  escapeHtmlAttr,
  initials,
  loadProfile,
  loadProfileForApi,
  getFlagImg,
  initCustomSelect,
  CITY_OPTIONS_BY_COUNTRY,
  aiName,
  animateElementOut,
  markMotionEnter,
  motionPress,
  replayMotion,
  setupSlidingIndicator,
  safeSessionStorage,
  showToast,
} from "../utils.js";

import {
  clusterMarkerLogoHtml,
  getGrantsFromCategories,
  mapMarkerLogoHtml,
} from "../university-detail-helpers.js";

import { renderErrorScreen } from "../components.js";
import { classifyError } from "../components/network-status.js";
import { heroIcon } from "../icons.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import {
  getPreferredCurrency,
  loadRates,
  convert,
  getFilterLimits,
  formatMoney,
} from "../currency.js";
import { navigateToAppRoute, routeCompare, routeCompareConfigure, routeUniversityDetail } from "../routes.js";
import {
  readCompareAdmissionChoices,
  writeCompareAdmissionChoices as persistCompareAdmissionChoices,
  resolveAiSortResult,
} from "./universities/compare-helpers.js";
import {
  showUniversitiesTour,
  showUniFitWarning,
} from "./universities/tour-modals.js";
import {
  translateUniversityName,
  translateWord,
} from "../university-translations.js";
import { bindInfoTooltips } from "../tooltip.js";

import {
  cleanDecoratedText,
  renderInlineIcon,
  renderLocationMarkup,
  trCountry,
  trCity,
  trState,
  trUniversityName,
  unknownFieldText,
  textOrUnknown,
  moneyOrUnknown,
  splitPriceDisplay,
  normalizeSortMode,
  fundingPreferenceToQueryValue,
  uniThumbnailSrc,
  uniLogoSrc,
  SAVED_UNIVERSITIES_KEY,
  COMPARE_UNIVERSITIES_KEY,
  RECENT_UNIVERSITIES_KEY,
  MAX_COMPARE_UNIVERSITIES,
  hasSeenUniversitiesTour,
  clearUniversitiesTourResumeStep,
  markUniversitiesTourSeen,
  readUniversitiesTourResumeStep,
  readIdListStorage,
  writeIdListStorage,
  shouldOpenUniversitiesInNewTab,
  rememberRecentUniversity,
  getDetailCacheEntry,
  toFiniteNumber,
  resolveUniversityCardPrice,
  rankingStatusLabel,
} from './_shared.js';

let __universitiesProfileUpdatedHandler = null;
let __universitiesLanguageChangedHandler = null;
let __universitiesMapCardActionHandler = null;
let __universitiesSettingsChangedHandler = null;
let __universitiesScrollHandler = null;
let __universitiesPagehideHandler = null;
let __universitiesBeforeunloadHandler = null;
let __universitiesCurrencyChangedHandler = null;
let __universitiesMobileFilterKeydownHandler = null;
let __universitiesRecentRelocationHandler = null;
let __universitiesResizeHandler = null;
let __universitiesResizeObserver = null;
let __universitiesOnlineReconnectHandler = null;
let __universitiesMapResizeTimer = 0;

export function initUniversitiesPage() {
    const prefCurrency = getPreferredCurrency();
    let currentCurrency = prefCurrency;
    let currentLimits = getFilterLimits(prefCurrency);
    const COMPARE_PAIR_SIZE = MAX_COMPARE_UNIVERSITIES;
    const SCOPE_NOTICE_DISMISSED_KEY = "unisearch_universities_scope_notice_dismissed";
    const UNIVERSITIES_SCROLL_KEY = "unisearch_universities_scroll";

    if (window.history && "scrollRestoration" in window.history) {
        try {
            window.history.scrollRestoration = "manual";
        } catch (e) {}
    }

    const saveCurrentScrollPosition = () => {
        if (state.activeTab !== "catalog" || state.viewMode !== "list") return;
        const currentY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
        safeSessionStorage.set(UNIVERSITIES_SCROLL_KEY, String(currentY));
    };

    const clearSavedScrollPosition = () => {
        safeSessionStorage.remove(UNIVERSITIES_SCROLL_KEY);
    };

    const restoreScrollPosition = () => {
        if (state.activeTab !== "catalog" || state.viewMode !== "list") return;
        const rawY = safeSessionStorage.get(UNIVERSITIES_SCROLL_KEY);
        const targetY = rawY !== null ? Math.max(0, parseInt(rawY, 10) || 0) : 0;
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: targetY, left: 0, behavior: "instant" });
        });
    };

    const clampTuition = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(currentLimits.min, Math.min(currentLimits.max, Math.round(n)));
    };
    const clampPercent = (value, fallback = 50) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(100, Math.round(n)));
    };

    const el = {
        qInput: $("qInput"), searchClearBtn: $("searchClearBtn"), countrySelect: $("countrySelect"), stateDiv: $("stateDiv"),
        stateSelect: $("stateSelect"), citySelect: $("citySelect"),
        minInput: $("minCostInput"), maxInput: $("maxCostInput"),
        minSlider: $("minCostSlider"), maxSlider: $("maxCostSlider"), track: $("sliderTrack"),
        minCostLabel: $("minCostLabel"), maxCostLabel: $("maxCostLabel"),
        sortSelect: $("sortSelect"), sliderContainer: $("aiSliderContainer"),
        sortStrategyInfoWrap: document.querySelector('label[for="sortSelect"] .u-info-wrap'),
        sortAiTagsHint: $("sortAiTagsHint"),
        focusSlider: $("focusSlider"), focusLabel: $("focusLabel"),
        atmosphereSlider: $("atmosphereSlider"), atmosphereLabel: $("atmosphereLabel"),
        financeSlider: $("financeSlider"), financeLabel: $("financeLabel"),
        locationSlider: $("locationSlider"), locationLabel: $("locationLabel"),
        resetBtn: $("resetFiltersBtn"),
        content: document.querySelector(".u-content"),
        workspaceLayout: $("universitiesWorkspaceLayout"),
        catalogPane: $("universitiesCatalogPane"),
        sidebar: $("uSidebar") || document.querySelector(".u-sidebar"),
        filterCard: document.querySelector(".u-filter-card"),
        list: $("universitiesList"), mapStage: $("mapStage"), mapResults: $("mapResultsPanel"), mapContainer: $("mapContainer"), total: $("totalCount"),
        skeleton: $("universitiesSkeleton"), state: $("listState"), pagination: $("pagination"),
        btnList: $("viewListBtn"), btnMap: $("viewMapBtn"), viewToggles: $("viewToggles"),
        compareModeBtn: $("compareModeBtn"), compareModeLabel: $("compareModeLabel"),
        mobileFilterCount: $("mobileFilterCount"),
        mobileFilterToggle: $("mobileFilterToggle"),
        mobileFilterClose: $("closeMobileFilters"),
        mobileApplyFilters: $("mobileApplyFilters"),
        mobileResetFilters: $("mobileResetFilters"),
        savedFilterButtons: Array.from(document.querySelectorAll("[data-saved-filter]")),
        recentlyViewedBar: $("recentlyViewedBar"),
        mobileRecentSlot: $("mobileRecentSlot"),
        unifitWarningBanner: $("unifitWarningBanner"),
        unifitWarningDismiss: $("dismissUnifitWarningBanner"),
        compareTray: $("compareTray"),
        scopeNotice: $("universitiesScopeNotice"),
        scopeNoticeDismiss: $("dismissUniversitiesScopeNotice")
    };
    const ensureCompareTrayNode = () => {
        if (el.compareTray) return;
        const tray = document.createElement("div");
        tray.id = "compareTray";
        tray.className = "compare-tray";
        tray.setAttribute("aria-live", "polite");
        tray.hidden = true;
        const main = document.querySelector("main");
        if (main?.parentNode) main.parentNode.insertBefore(tray, main.nextSibling);
        else document.body.appendChild(tray);
        el.compareTray = tray;
    };
    ensureCompareTrayNode();
    const isTranslationDebugEnabled = (() => {
        const raw = window.APP_DEBUG;
        if (typeof raw === "boolean") return raw;
        const text = String(raw ?? "").trim().toLowerCase();
        return ["1", "true", "yes", "on"].includes(text);
    })();
    const logTranslationDebug = (stage, details = {}) => {
        if (!isTranslationDebugEnabled) return;
        try {
            console.groupCollapsed(`[UniSearch Translation Debug] ${stage}`);
            Object.entries(details || {}).forEach(([k, v]) => console.log(`${k}:`, v));
            console.groupEnd();
        } catch (e) {
            // ignore logging errors
        }
    };
    logTranslationDebug("debug mode enabled", {
        enabled: true,
        note: "ML + translation debug is enabled by APP_DEBUG runtime flag.",
    });

    const getProfileFundingQueryValue = () => {
        const profile = loadProfile();
        return fundingPreferenceToQueryValue(profile?.fundingType || profile?.funding_type || "any");
    };

    function hasProfileEvidence(profile) {
        const exams = Array.isArray(profile?.exams) ? profile.exams : [];
        const langs = Array.isArray(profile?.languages) ? profile.languages : [];
        return exams.length > 0 || langs.length > 0;
    }

    const setupScopeNotice = () => {
        if (!el.scopeNotice) return;

        let dismissed = false;
        try {
            dismissed = localStorage.getItem(SCOPE_NOTICE_DISMISSED_KEY) === "1";
        } catch (e) {
            dismissed = false;
        }

        el.scopeNotice.hidden = dismissed;
        if (dismissed) {
            document.documentElement.classList.add("scope-notice-dismissed");
        }
        if (dismissed || !el.scopeNoticeDismiss) return;

        el.scopeNoticeDismiss.addEventListener("click", () => {
            el.scopeNotice.hidden = true;
            document.documentElement.classList.add("scope-notice-dismissed");
            try {
                localStorage.setItem(SCOPE_NOTICE_DISMISSED_KEY, "1");
            } catch (e) {
                // Ignore storage errors; the notice still closes for this page view.
            }
            scheduleSyncSidebarMaxHeight();
            scheduleSyncWorkspaceDepth();
        });
    };

    if (!el.list) return;
    if (__universitiesProfileUpdatedHandler) {
        window.removeEventListener("profileUpdated", __universitiesProfileUpdatedHandler);
        __universitiesProfileUpdatedHandler = null;
    }
    if (__universitiesLanguageChangedHandler) {
        window.removeEventListener("languageChanged", __universitiesLanguageChangedHandler);
        __universitiesLanguageChangedHandler = null;
    }
    if (__universitiesMapCardActionHandler) {
        document.removeEventListener("click", __universitiesMapCardActionHandler, true);
        __universitiesMapCardActionHandler = null;
    }
    if (__universitiesSettingsChangedHandler) {
        window.removeEventListener("settingsChanged", __universitiesSettingsChangedHandler);
        __universitiesSettingsChangedHandler = null;
    }
    if (__universitiesScrollHandler) {
        window.removeEventListener("scroll", __universitiesScrollHandler);
        __universitiesScrollHandler = null;
    }
    if (__universitiesPagehideHandler) {
        window.removeEventListener("pagehide", __universitiesPagehideHandler);
        __universitiesPagehideHandler = null;
    }
    if (__universitiesBeforeunloadHandler) {
        window.removeEventListener("beforeunload", __universitiesBeforeunloadHandler);
        __universitiesBeforeunloadHandler = null;
    }
    if (__universitiesMobileFilterKeydownHandler) {
        document.removeEventListener("keydown", __universitiesMobileFilterKeydownHandler);
        __universitiesMobileFilterKeydownHandler = null;
    }
    document.documentElement.classList.remove("sidebar-filters-open");
    document.body.classList.remove("sidebar-filters-open");
    if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = "";
    }
    if (__universitiesRecentRelocationHandler) {
        window.removeEventListener("resize", __universitiesRecentRelocationHandler);
        __universitiesRecentRelocationHandler = null;
    }
    if (__universitiesResizeHandler) {
        window.removeEventListener("resize", __universitiesResizeHandler);
        __universitiesResizeHandler = null;
    }
    if (__universitiesMapResizeTimer) {
        window.clearTimeout(__universitiesMapResizeTimer);
        __universitiesMapResizeTimer = 0;
    }
    if (__universitiesResizeObserver) {
        __universitiesResizeObserver.disconnect();
        __universitiesResizeObserver = null;
    }

    bindInfoTooltips({ wrapSelector: ".u-info-wrap", buttonSelector: ".u-info" });
    bindInfoTooltips({ wrapSelector: ".uni-status-tooltip", buttonSelector: ".uni-status-trigger" });
    bindInfoTooltips({ wrapSelector: ".uni-metric-tooltip", buttonSelector: ".uni-metric-trigger" });
    setupScopeNotice();

    let unifitWarningBannerDismissed = false;

    el.unifitWarningDismiss?.addEventListener("click", () => {
        unifitWarningBannerDismissed = true;
        if (el.unifitWarningBanner) {
            el.unifitWarningBanner.hidden = true;
        }
    });

    const updateUnifitWarningBanner = (items = []) => {
        if (!el.unifitWarningBanner) return;
        if (state.sort !== "uni_ai") {
            el.unifitWarningBanner.hidden = true;
            return;
        }
        if (unifitWarningBannerDismissed) {
            el.unifitWarningBanner.hidden = true;
            return;
        }
        const profile = loadProfile();
        const hasEvidence = hasProfileEvidence(profile);
        const candidateItems = Array.isArray(items) && items.length > 0 ? items : (lastRenderedItems || []);
        const hasConditionalInItems = candidateItems.some((u) => {
            const match = u?.matchData || {};
            const badgeHints = (match.uiBadgeHints && typeof match.uiBadgeHints === "object") ? match.uiBadgeHints : {};
            const conditionalCount = Number(match.conditionalRequirements || 0);
            return (badgeHints.showConditionalExamNeeded === true) || (!!match.conditional && conditionalCount > 0);
        });
        const shouldShow = !hasEvidence || hasConditionalInItems;
        el.unifitWarningBanner.hidden = !shouldShow;
    };

    setupSlidingIndicator(".u-saved-filter", ".u-saved-filter__btn", "is-active");

    const applyAISortOptionLabel = () => {
        if (!el.sortSelect) return;
        const aiOpt = el.sortSelect.querySelector('option[value="uni_ai"]');
        if (aiOpt) aiOpt.textContent = cleanDecoratedText(
            tFormat("universities.sort_ai", { fit: aiName("fit") }, `${aiName("fit")}: ${t("common.ai_short", "AI")} Smart Sort`)
        );
    };
    applyAISortOptionLabel();

    const readPageParams = () => {
        try {
            return new URLSearchParams(window.location.search || "");
        } catch (e) {
            return new URLSearchParams();
        }
    };
    const normalizeUniversitiesTab = (value) => {
        const raw = String(value || "").trim().toLowerCase();
        return ["catalog", "compare"].includes(raw) ? raw : "catalog";
    };
    const normalizeCompareIdList = (ids) => Array.from(new Set(
        (Array.isArray(ids) ? ids : [])
            .map((item) => String(item || "").trim())
            .filter(Boolean)
    )).slice(0, COMPARE_PAIR_SIZE);
    const parseCompareIds = (value) => normalizeCompareIdList(
        String(value || "").split(",")
    );
    const pageParams = readPageParams();
    const initialCompareIds = parseCompareIds(pageParams.get("ids"));
    const initialCompareParam = String(pageParams.get("compare") || "").trim().toLowerCase();
    if (initialCompareIds.length === COMPARE_PAIR_SIZE && ["configure", "results"].includes(initialCompareParam)) {
        const choices = String(pageParams.get("choices") || "").split(",").filter(Boolean);
        const stage = (initialCompareParam === "configure" || choices.length === 0) ? "configure" : "results";
        const redirectUrl = routeCompare(initialCompareIds, choices, stage === "configure" ? { stage: "configure" } : "");
        navigateToAppRoute(redirectUrl, { replace: true });
        return;
    }
    const savedState = loadFilters();
    const tabFromUrl = pageParams.get("tab");
    const tabFromSaved = savedState.activeTab || null;
    const initialTab = normalizeUniversitiesTab(tabFromUrl || tabFromSaved || "catalog");

    const pageParamsSort = pageParams.get("sort");
    const pageParamsQ = pageParams.get("q");
    const initialQ = (pageParamsQ !== null ? pageParamsQ : (savedState.q || "")).trim();
    const defaultSortMode = initialQ ? "relevance" : (hasProfileEvidence(loadProfile()) ? "uni_ai" : "name_asc");
    let initialMin = currentLimits.min;
    let initialMax = currentLimits.max;

    if (savedState.min_tuition !== undefined && savedState.min_tuition !== null && savedState.min_tuition !== "") {
        let rawMin = Number(savedState.min_tuition);
        if (Number.isFinite(rawMin)) {
            if (savedState.currency && savedState.currency !== currentCurrency) {
                const usd = convert(rawMin, savedState.currency, "USD");
                rawMin = Math.round(convert(usd, "USD", currentCurrency) / currentLimits.step) * currentLimits.step;
            }
            initialMin = Math.max(currentLimits.min, Math.min(currentLimits.max, rawMin));
        }
    }

    if (savedState.max_tuition !== undefined && savedState.max_tuition !== null && savedState.max_tuition !== "") {
        let rawMax = Number(savedState.max_tuition);
        if (Number.isFinite(rawMax)) {
            if (savedState.currency && savedState.currency !== currentCurrency) {
                const oldMaxLimit = getFilterLimits(savedState.currency).max;
                if (rawMax >= oldMaxLimit) {
                    rawMax = currentLimits.max;
                } else {
                    const usd = convert(rawMax, savedState.currency, "USD");
                    rawMax = Math.round(convert(usd, "USD", currentCurrency) / currentLimits.step) * currentLimits.step;
                }
            }
            initialMax = Math.max(currentLimits.min, Math.min(currentLimits.max, rawMax));
        }
    }

    const minRangeGap = currentLimits.step;
    if (initialMin > currentLimits.max - minRangeGap) initialMin = currentLimits.max - minRangeGap;
    if (initialMax < initialMin + minRangeGap) initialMax = Math.min(currentLimits.max, initialMin + minRangeGap);

    let resolvedSort = pageParamsSort || savedState.sort;
    if (initialQ && !pageParamsSort && (!resolvedSort || resolvedSort === "name_asc")) {
        resolvedSort = "relevance";
    }

    const state = {
        q: initialQ, country: savedState.country || "", region: savedState.region || "", 
        city: savedState.city || "", study_level: savedState.study_level || "",
        funding_type: getProfileFundingQueryValue(),
        currency: currentCurrency,
        min_tuition: initialMin,
        max_tuition: initialMax, 
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
        activeTab: initialTab,
        compareStage: "select",
        compareResultIds: [],
        compareDiffOnly: false,
        viewMode: savedState.viewMode || "list", page: 1, limit: 24,
    };
    const getUniversitiesSkeletonCount = () => {
        const renderedColumns = el.list
            ? getComputedStyle(el.list).gridTemplateColumns.split(" ").filter(Boolean).length
            : 0;
        const width = Math.max(
            Number(el.list?.clientWidth || 0),
            Number(el.skeleton?.parentElement?.clientWidth || 0),
            Number(el.content?.clientWidth || 0)
        );
        const cardMinWidth = 280;
        const gridGap = 20;
        const columns = renderedColumns || (width > 0
            ? Math.max(1, Math.floor((width + gridGap) / (cardMinWidth + gridGap)))
            : Math.max(1, Math.floor((window.innerWidth + gridGap) / (cardMinWidth + gridGap))));
        const rows = 3;
        return Math.min(state.limit, Math.max(columns, columns * rows));
    };
    let focusUniId = "";
    let focusUniDone = false;

    const CACHE_TTL_MS = 30000;
    const AI_FAST_FALLBACK_MS = 450;
    const SKELETON_SHOW_DELAY_MS = 120;
    const SKELETON_FADE_MS = 160;
    let skeletonShowTimer = 0;
    let skeletonFadeTimer = 0;
    let isSkeletonCurrentlyVisible = false;
    const universitiesFetchCache = new Map();
    let lastAiFetchKey = "";
    let lastAiFetchPayload = null;
    let lastAiFetchAt = 0;
    let listFetchController = null;
    let aiFetchController = null;
    let fetchRunSeq = 0;
    let firstVisitTourPending = !hasSeenUniversitiesTour();
    let hasInitialListPaint = false;
    let hasRestoredInitialScroll = false;
    let uniFitWarningShownInSession = false;
    let lastRenderedItems = [];
    let viewModesReady = false;
    let savedUniversityIds = new Set(readIdListStorage(SAVED_UNIVERSITIES_KEY));
    let compareUniversityIds = new Set(
        initialCompareIds.length === COMPARE_PAIR_SIZE
            ? initialCompareIds
            : normalizeCompareIdList(readIdListStorage(COMPARE_UNIVERSITIES_KEY))
    );
    if (initialCompareIds.length !== COMPARE_PAIR_SIZE) {
        state.compareResultIds.forEach((id) => compareUniversityIds.add(id));
    }
    compareUniversityIds = new Set(normalizeCompareIdList(Array.from(compareUniversityIds)));
    let compareAdmissionChoices = new Map();

    const syncViewModeControls = () => {
        [el.btnList, el.btnMap].forEach((button) => {
            if (!button) return;
            button.disabled = !viewModesReady;
            button.setAttribute("aria-disabled", viewModesReady ? "false" : "true");
        });
    };

    syncViewModeControls();

    function activeFilterCount() {
        let count = 0;
        if (state.q) count += 1;
        if (state.country) count += 1;
        if (state.region) count += 1;
        if (state.city) count += 1;
        if (Number(state.min_tuition) > currentLimits.min || Number(state.max_tuition) < currentLimits.max) count += 1;
        if (state.sort && state.sort !== "name_asc" && !(state.q && state.sort === "relevance")) count += 1;
        if (state.study_level) count += 1;
        if (state.funding_type && state.funding_type !== "any") count += 1;
        if (state.only_saved) count += 1;
        return count;
    }


    function syncSavedFilterButtons() {
        const mode = state.only_saved ? "favorites" : "all";
        el.savedFilterButtons.forEach((btn) => {
            const active = String(btn.getAttribute("data-saved-filter") || "") === mode;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }

    function updateMobileFilterUi() {
        const count = activeFilterCount();
        if (el.mobileFilterCount) {
            el.mobileFilterCount.hidden = count <= 0;
            el.mobileFilterCount.textContent = String(count);
        }
    }

        const isCompareTab = () => state.activeTab === "compare";
    const isCompareResultsMode = () => false;
    const isCompareSelectionMode = () => isCompareTab();

    const sectionUrlParams = () => {
        const params = buildParams(false);
        if (state.activeTab === "compare") {
            params.set("tab", "compare");
        } else {
            params.delete("tab");
        }
        params.delete("compare");
        params.delete("ids");
        params.delete("choices");
        return params;
    };

    const setSectionUrl = (replace = true) => {
        const url = new URL(window.location.href);
        url.search = sectionUrlParams().toString();
        window.history[replace ? "replaceState" : "pushState"]({}, "", url.toString());
    };

    const syncCompareModeControls = () => {
        if (!el.compareModeBtn || !el.compareModeLabel) return;
        const active = isCompareSelectionMode();
        el.compareModeBtn.classList.toggle("is-active", active);
        el.compareModeBtn.setAttribute("aria-pressed", active ? "true" : "false");
        const label = t("universities.compare.enter", "Compare mode");
        el.compareModeBtn.setAttribute("aria-label", label);
        el.compareModeBtn.setAttribute("title", label);
        el.compareModeLabel.textContent = label;
    };

    const syncHeaderSearchContext = () => {
        const search = document.getElementById("universitySearch");
        if (!search || !el.qInput) return;
        search.hidden = false;
        const placeholderKey = "universities.search_placeholder";
        const placeholderFallback = "Search university...";
        el.qInput.placeholder = t(placeholderKey, placeholderFallback);
        el.qInput.setAttribute("data-i18n-placeholder", placeholderKey);
        el.qInput.setAttribute("aria-label", t(placeholderKey, placeholderFallback));
        el.qInput.setAttribute("data-i18n-aria-label", placeholderKey);
    };

    const syncSectionVisibility = async ({ shouldFetch = false, updateUrl = true, replaceUrl = true } = {}) => {
        if (el.workspaceLayout) el.workspaceLayout.hidden = false;
        if (el.catalogPane) el.catalogPane.hidden = false;
        document.body.classList.toggle("universities-compare-mode", isCompareSelectionMode());
        document.body.classList.remove("universities-compare-configure-mode");
        document.body.classList.remove("universities-compare-results-mode");
        if (el.viewToggles) el.viewToggles.hidden = false;
        if (el.total) {
            el.total.textContent = String(state.lastCatalogTotal ?? el.total.textContent ?? "0");
        }
        syncHeaderSearchContext();
        syncCompareModeControls();
        renderCompareTray();
        updateUnifitWarningBanner(lastRenderedItems);
        if (updateUrl) setSectionUrl(replaceUrl);

        await switchView(state.viewMode || "list", false);
        if (shouldFetch) fetchAndRender();
    };

    const getRenderedUniversityById = (id) => {
        const cleanId = String(id || "").trim();
        return lastRenderedItems.find((item) => String(item?.id || "") === cleanId) || null;
    };

    const getUniversityDisplayNameById = (id) => {
        const cleanId = String(id || "").trim();
        if (!cleanId) return "";

        const rendered = getRenderedUniversityById(cleanId);
        const renderedName = String(rendered ? trUniversityName(rendered) : "").trim();
        if (renderedName) return renderedName;

        const cachedLanguages = [getCurrentLanguage(), "eng", "ru"];
        for (const lang of cachedLanguages) {
            const cached = getDetailCacheEntry(cleanId, lang);
            const cachedName = String(cached?.data ? trUniversityName(cached.data) : "").trim();
            if (cachedName) return cachedName;
        }

        const translated = String(translateUniversityName(cleanId, "") || "").trim();
        return translated && translated !== cleanId ? translated : "";
    };

    const comparePairIds = () => normalizeCompareIdList(Array.from(compareUniversityIds));
    const setComparePairIds = (ids) => {
        const nextIds = normalizeCompareIdList(ids);
        compareUniversityIds = new Set(nextIds);
        const nextSet = new Set(nextIds);
        Array.from(compareAdmissionChoices.keys()).forEach((id) => {
            if (!nextSet.has(id)) compareAdmissionChoices.delete(id);
        });
    };
    const writeCompareAdmissionChoices = () => persistCompareAdmissionChoices(compareAdmissionChoices, comparePairIds());
    compareAdmissionChoices = readCompareAdmissionChoices();
    const isComparePairReady = () => comparePairIds().length >= 2;

    const syncCompareSelectionFromStorage = () => {
        const rawIds = readIdListStorage(COMPARE_UNIVERSITIES_KEY);
        const storedIds = normalizeCompareIdList(rawIds);
        if (rawIds.length !== storedIds.length) {
            writeIdListStorage(COMPARE_UNIVERSITIES_KEY, storedIds);
        }
        if (!storedIds.length) return;
        const currentIds = comparePairIds();
        if (storedIds.join("|") !== currentIds.join("|")) {
            setComparePairIds(storedIds);
        }
    };

    const renderCompareTray = () => {
        if (!el.compareTray) return;
        if (isCompareSelectionMode()) syncCompareSelectionFromStorage();
        const ids = comparePairIds();
        if (!ids.length || !isCompareSelectionMode() || isCompareResultsMode()) {
            el.compareTray.hidden = true;
            el.compareTray.innerHTML = "";
            return;
        }
        el.compareTray.hidden = false;
        el.compareTray.classList.toggle("is-ready", isComparePairReady());
        const canCompare = isComparePairReady();
        const chipsHtml = ids.map((id) => {
            const name = getUniversityDisplayNameById(id);
            const logoSrc = uniLogoSrc(id);
            const removeLabel = t("universities.compare.remove", "Remove from comparison");
            return `
                <div class="compare-tray__chip" role="listitem">
                    ${logoSrc ? `<img class="compare-tray__chip-logo" src="${escapeHtmlAttr(logoSrc)}" alt="" loading="lazy">` : ""}
                    <span class="compare-tray__chip-name" title="${escapeHtmlAttr(name)}">${escapeHtml(name)}</span>
                    <button class="compare-tray__chip-remove" type="button" data-action="remove-compare-slot" data-uni-id="${escapeHtmlAttr(id)}" title="${escapeHtmlAttr(removeLabel)}" aria-label="${escapeHtmlAttr(removeLabel)}">
                        ${renderInlineIcon("x-mark", 12)}
                    </button>
                </div>
            `;
        }).join("");
        el.compareTray.innerHTML = `
            <span class="compare-tray__badge">${ids.length}/${MAX_COMPARE_UNIVERSITIES}</span>
            <div class="compare-tray__chips" role="list" aria-label="${escapeHtmlAttr(t("universities.compare.selection", "Selected universities"))}">
                ${chipsHtml}
            </div>
            <div class="compare-tray__actions">
                <button class="compare-tray__btn compare-tray__btn--ghost" type="button" data-action="clear-compare">${escapeHtml(t("universities.compare.clear", "Clear"))}</button>
                <button class="compare-tray__btn compare-tray__btn--primary" type="button" data-action="open-compare"${canCompare ? "" : " disabled"}>${escapeHtml(t(canCompare ? "universities.compare.continue" : "universities.compare.open", canCompare ? "Continue" : "Compare"))}</button>
            </div>
        `;
        replayMotion(el.compareTray, "motion-panel-enter", { timeoutMs: 420 });
    };

    const compensateCardAnchorShift = (card, beforeTop) => {
        if (!(card instanceof Element) || !Number.isFinite(beforeTop)) return;
        window.requestAnimationFrame(() => {
            const afterTop = card.getBoundingClientRect().top;
            const delta = afterTop - beforeTop;
            if (Math.abs(delta) > 1) {
                window.scrollBy({ top: delta, left: 0, behavior: "auto" });
            }
        });
    };

    const syncCardActionState = () => {
        const showCompareSelection = isCompareSelectionMode();
        document.querySelectorAll(".uni-card[data-uni-id]").forEach((card) => {
            const rowId = String(card.getAttribute("data-uni-id") || "").trim();
            const saved = savedUniversityIds.has(rowId);
            const compared = showCompareSelection && compareUniversityIds.has(rowId);
            const saveBtn = card.querySelector("[data-card-action='save']");
            const compareBtn = card.querySelector("[data-card-action='compare']");
            card.classList.toggle("uni-card--compare-selected", compared);
            card.setAttribute("aria-selected", compared ? "true" : "false");
            if (saveBtn) {
                saveBtn.classList.toggle("is-active", saved);
                saveBtn.setAttribute("aria-pressed", saved ? "true" : "false");
            }
            const details = card.querySelector(".uni-details");
            if (details) {
                const label = showCompareSelection
                    ? (compared
                        ? t("universities.card.compare_selected_short", "Selected")
                        : t("universities.card.compare_short", "Compare"))
                    : t("universities.card.view_details", "View details");
                details.innerHTML = `${escapeHtml(label)}<span aria-hidden="true">→</span>`;
            }
            if (compareBtn) {
                const label = compared
                    ? t("universities.card.compare_selected", "Selected for comparison")
                    : t("universities.card.compare", "Add to compare");
                compareBtn.classList.toggle("is-active", compared);
                compareBtn.setAttribute("aria-pressed", compared ? "true" : "false");
                compareBtn.setAttribute("title", label);
                compareBtn.setAttribute("aria-label", label);
                compareBtn.innerHTML = renderInlineIcon(compared ? "check-circle" : "adjustments-horizontal", 16, "uni-action-icon");
            }
        });
    };

    const toggleCompareUniversity = (uniId) => {
        const cleanId = String(uniId || "").trim();
        if (!cleanId) return false;
        const currentPair = comparePairIds();
        const wasCompared = currentPair.includes(cleanId);
        if (wasCompared) {
            setComparePairIds(currentPair.filter((id) => id !== cleanId));
        } else {
            const nextPair = currentPair.length >= MAX_COMPARE_UNIVERSITIES
                ? currentPair.slice(1)
                : currentPair.slice();
            nextPair.push(cleanId);
            setComparePairIds(nextPair);
        }
        syncCardActionState();
        persistSavedAndCompare();
        return true;
    };

    const handleCardAction = (actionBtn, options = {}) => {
        if (!(actionBtn instanceof Element)) return false;
        const card = actionBtn.closest("[data-uni-id]");
        const uniId = String(card?.getAttribute("data-uni-id") || "").trim();
        const action = String(actionBtn.getAttribute("data-card-action") || "").trim();
        if (!card || !uniId || !action) return false;

        motionPress(actionBtn);

        if (action === "save") {
            const wasSaved = savedUniversityIds.has(uniId);
            const beforeTop = card.getBoundingClientRect().top;
            const savedCountBefore = savedUniversityIds.size;
            const shouldCompensateShift = !!options.compensateLayoutShift && (
                (!wasSaved && savedCountBefore === 0) ||
                wasSaved
            );
            if (wasSaved) savedUniversityIds.delete(uniId);
            else savedUniversityIds.add(uniId);
            syncCardActionState();
            replayMotion(
                actionBtn.querySelector(".uni-action-icon") || actionBtn,
                wasSaved ? "motion-icon-unsave" : "motion-icon-save",
                { timeoutMs: 320 }
            );
            persistSavedAndCompare();
            if (state.only_saved && wasSaved) {
                refetch();
            } else if (shouldCompensateShift) {
                compensateCardAnchorShift(card, beforeTop);
            }
            return true;
        }

        if (action === "compare") {
            return isCompareSelectionMode() ? toggleCompareUniversity(uniId) : false;
        }

        return false;
    };

    const openCompareResultsPage = async () => {
        const ids = comparePairIds();
        if (ids.length !== COMPARE_PAIR_SIZE) return;
        navigateToAppRoute(routeCompareConfigure(ids));
    };

    const universityLinkAttrs = () => (
        shouldOpenUniversitiesInNewTab()
            ? ' target="_blank" rel="noopener noreferrer"'
            : ""
    );

    const openUniversityDetail = (id) => {
        const cleanId = String(id || "").trim();
        if (!cleanId) return;
        const href = routeUniversityDetail(cleanId);
        if (shouldOpenUniversitiesInNewTab()) {
            window.open(href, "_blank", "noopener,noreferrer");
            return;
        }
        navigateToAppRoute(href);
    };

    const lockRecentChipWidths = (root) => {
        if (!root) return;
        root.querySelectorAll(".u-recent__chip").forEach((chip) => {
            chip.style.removeProperty("--recent-chip-width");
        });
    };

    const renderRecentlyViewedBar = () => {
        if (!el.recentlyViewedBar) return;
        const recentIds = readIdListStorage(RECENT_UNIVERSITIES_KEY).slice(0, 6);
        if (!recentIds.length) {
            el.recentlyViewedBar.hidden = true;
            el.recentlyViewedBar.innerHTML = "";
            scheduleSyncWorkspaceDepth();
            return;
        }
        const rows = recentIds
            .map((id) => ({ id, label: getUniversityDisplayNameById(id) }))
            .filter((row) => row.label);
        if (!rows.length) {
            el.recentlyViewedBar.hidden = true;
            el.recentlyViewedBar.innerHTML = "";
            scheduleSyncWorkspaceDepth();
            return;
        }
        el.recentlyViewedBar.hidden = false;
        el.recentlyViewedBar.innerHTML = `
            <div class="u-recent__head">
                <span class="u-recent__label">${escapeHtml(t("universities.recent.title", "Recently viewed"))}</span>
                <button class="u-recent__clear" type="button" data-action="clear-recent">
                    ${renderInlineIcon("x-mark", 14, "u-recent__clear-icon")}
                    <span>${escapeHtml(t("universities.recent.clear_all", "Clear all"))}</span>
                </button>
            </div>
            <div class="u-recent__items">
                ${rows.map((row) => {
                    const removeLabel = tFormat(
                        "universities.recent.remove",
                        { university: row.label },
                        `Remove ${row.label} from recently viewed`
                    );
                    return `
                        <span class="u-recent__chip">
                            <a class="u-recent__link" href="${routeUniversityDetail(row.id)}"${universityLinkAttrs()}>${escapeHtml(row.label)}</a>
                            <button
                                class="u-recent__remove"
                                type="button"
                                data-action="remove-recent"
                                data-uni-id="${escapeHtmlAttr(row.id)}"
                                aria-label="${escapeHtmlAttr(removeLabel)}"
                                title="${escapeHtmlAttr(removeLabel)}"
                            >${renderInlineIcon("x-mark", 14, "u-recent__remove-icon")}</button>
                        </span>
                    `;
                }).join("")}
            </div>
        `;
        lockRecentChipWidths(el.recentlyViewedBar);
        scheduleSyncWorkspaceDepth();
        el.recentlyViewedBar.querySelector('[data-action="clear-recent"]')?.addEventListener("click", () => {
            const clearBtn = el.recentlyViewedBar.querySelector('[data-action="clear-recent"]');
            motionPress(clearBtn);
            replayMotion(clearBtn?.querySelector(".u-recent__clear-icon") || clearBtn, "motion-icon-clear", { timeoutMs: 240 });
            animateElementOut(el.recentlyViewedBar, () => {
                writeIdListStorage(RECENT_UNIVERSITIES_KEY, []);
                renderRecentlyViewedBar();
            }, { className: "motion-row-exit", timeoutMs: 280 });
        });
        el.recentlyViewedBar.querySelectorAll('[data-action="remove-recent"]').forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const uniId = String(button.getAttribute("data-uni-id") || "").trim();
                if (!uniId) return;
                const chip = button.closest(".u-recent__chip");
                motionPress(button);
                replayMotion(button.querySelector(".u-recent__remove-icon") || button, "motion-icon-remove", { timeoutMs: 240 });
                animateElementOut(chip, () => {
                    const nextIds = readIdListStorage(RECENT_UNIVERSITIES_KEY).filter((id) => id !== uniId);
                    writeIdListStorage(RECENT_UNIVERSITIES_KEY, nextIds);
                    renderRecentlyViewedBar();
                }, { className: "motion-chip-remove", timeoutMs: 260 });
            });
        });
    };

    let lastAppliedLayoutDepth = "";
    let depthSyncRafId = 0;

    const syncWorkspaceDepth = () => {
        if (depthSyncRafId) {
            window.cancelAnimationFrame(depthSyncRafId);
            depthSyncRafId = 0;
        }
        if (!el.workspaceLayout || typeof window === "undefined") return;

        if (state.viewMode !== "map") clearMapSidebarDepth();

        // Mobile / tablet screen layouts stack vertically, do not force desktop depth
        if (window.innerWidth <= 1024) {
            if (lastAppliedLayoutDepth !== "") {
                lastAppliedLayoutDepth = "";
                el.workspaceLayout.style.removeProperty("min-height");
            }
            clearMapSidebarDepth();
            return;
        }

        // Map mode content is short and stable; forcing list-mode depth would
        // leave a large empty area below the map.
        if (state.viewMode === "map") {
            if (lastAppliedLayoutDepth !== "") {
                lastAppliedLayoutDepth = "";
                el.workspaceLayout.style.removeProperty("min-height");
            }
            syncMapSidebarDepth();
            return;
        }

        const sidebar = el.sidebar || $("uSidebar") || document.querySelector(".u-sidebar");
        const content = el.catalogPane || el.content || document.querySelector(".u-content");
        if (!sidebar || !content) return;

        const filterCard = el.filterCard || sidebar.querySelector(".u-filter-card");
        const recentBar = el.recentlyViewedBar;

        let leftColHeight = 0;
        if (filterCard) {
            leftColHeight += filterCard.offsetHeight;
        }
        if (recentBar && !recentBar.hidden && recentBar.offsetHeight > 0) {
            const cs = window.getComputedStyle(sidebar);
            const gap = parseFloat(cs.rowGap || cs.gap) || 24;
            leftColHeight += gap + recentBar.offsetHeight;
        }
        leftColHeight = Math.max(leftColHeight, sidebar.scrollHeight || 0);

        const rightColHeight = content.offsetHeight || 0;
        const targetDepth = Math.max(leftColHeight, rightColHeight);
        const targetStr = targetDepth > 0 ? `${targetDepth}px` : "";

        if (lastAppliedLayoutDepth !== targetStr) {
            lastAppliedLayoutDepth = targetStr;
            if (targetStr) {
                el.workspaceLayout.style.minHeight = targetStr;
            } else {
                el.workspaceLayout.style.removeProperty("min-height");
            }
        }
        syncSidebarMaxHeight();
    };

    let sidebarMaxHeightRafId = 0;
    let lastAppliedSidebarMaxHeight = null;

    const syncSidebarMaxHeight = () => {
        if (typeof window === "undefined") return;
        const sidebar = el.sidebar || $("uSidebar") || document.querySelector(".u-sidebar");
        if (!sidebar) return;

        if (window.innerWidth <= 1024 || (state.viewMode === "map" && window.innerWidth > 1180)) {
            if (lastAppliedSidebarMaxHeight !== null) {
                lastAppliedSidebarMaxHeight = null;
                sidebar.style.removeProperty("--sidebar-max-height");
            }
            return;
        }

        const rect = sidebar.getBoundingClientRect();
        const bottomGap = 16;
        const availableHeight = Math.max(200, Math.floor(window.innerHeight - rect.top - bottomGap));
        if (lastAppliedSidebarMaxHeight !== availableHeight) {
            lastAppliedSidebarMaxHeight = availableHeight;
            sidebar.style.setProperty("--sidebar-max-height", `${availableHeight}px`);
        }
    };

    const scheduleSyncSidebarMaxHeight = () => {
        if (typeof window === "undefined") return;
        if (sidebarMaxHeightRafId) return;
        sidebarMaxHeightRafId = window.requestAnimationFrame(() => {
            sidebarMaxHeightRafId = 0;
            syncSidebarMaxHeight();
        });
    };

    const scheduleSyncWorkspaceDepth = () => {
        if (typeof window === "undefined") return;
        scheduleSyncSidebarMaxHeight();
        if (depthSyncRafId) return;
        depthSyncRafId = window.requestAnimationFrame(() => {
            depthSyncRafId = 0;
            syncWorkspaceDepth();
        });
    };

    // In map mode the sidebar keeps its own internal scroll, but its outer
    // height is clamped to the content column so the filter column, the map,
    // and the results rail all end at the same depth.
    const clearMapSidebarDepth = () => {
        const sidebar = el.sidebar || $("uSidebar") || document.querySelector(".u-sidebar");
        if (sidebar) sidebar.style.removeProperty("height");
    };

    const syncMapSidebarDepth = () => {
        const sidebar = el.sidebar || $("uSidebar") || document.querySelector(".u-sidebar");
        const content = el.catalogPane || el.content || document.querySelector(".u-content");
        if (!sidebar || !content) return;
        // Below the split breakpoint the columns stack; the stylesheet
        // rules apply untouched there.
        if (state.viewMode !== "map" || window.innerWidth <= 1180) {
            clearMapSidebarDepth();
            return;
        }
        clearMapSidebarDepth();
        const targetH = content.offsetHeight || 0;
        if (targetH > 0) sidebar.style.height = `${targetH}px`;
    };

    const persistSavedAndCompare = () => {
        setComparePairIds(comparePairIds());
        writeIdListStorage(SAVED_UNIVERSITIES_KEY, Array.from(savedUniversityIds));
        writeIdListStorage(COMPARE_UNIVERSITIES_KEY, comparePairIds());
        writeCompareAdmissionChoices();
        renderCompareTray();
        syncCompareModeControls();
        renderRecentlyViewedBar();
        syncCardActionState();
    };

    const hideSearchSuggestions = () => {
        const host = el.qInput?.closest(".navbar-search") || el.qInput?.parentElement;
        const node = host?.querySelector(".navbar-search-suggestions");
        if (node) {
            node.innerHTML = "";
            node.classList.remove("is-open");
        }
    };

    function renderUniversitiesState(options = {}) {
        if (!el.state) return;
        const warningText = String(options.warningText || "").trim();
        const emptyText = String(options.emptyText || "").trim();
        const blocks = [];

        if (warningText) {
            blocks.push(`
                <div class="u-state-card u-state-card--warning" role="status">
                    <div class="u-state-card__title">${escapeHtml(t("universities.scope_note.warning_title", "Temporary ranking fallback"))}</div>
                    <div class="u-state-card__text">${escapeHtml(warningText)}</div>
                </div>
            `.trim());
        }

        if (emptyText) {
            blocks.push(`
                <div class="u-state-card u-state-card--empty" role="status">
                    <div class="u-state-card__title">${escapeHtml(t("universities.scope_note.empty_title", "No results for current filters"))}</div>
                    <div class="u-state-card__text">${escapeHtml(emptyText)}</div>
                </div>
            `.trim());
        }

        if (!blocks.length) {
            el.state.innerHTML = "";
            return;
        }

        el.state.innerHTML = blocks.join("");
    }

    function renderMapLoadingSkeleton() {
        if (!el.mapResults) return;
        const cardCount = Math.max(3, Math.min(5, Math.floor((Number(window.innerWidth || 0) || 1024) / 280)));
        el.mapResults.innerHTML = `
            <div class="u-map-results-loading is-skeleton" role="status" aria-live="polite" aria-label="${escapeHtmlAttr(t("universities.loading", "Loading universities"))}">
                <div class="u-map-results-list u-map-results-list--loading">
                    ${Array.from({ length: cardCount }, () => `
                        <article class="uni-card uni-card--no-media u-skeleton-card is-skeleton" aria-hidden="true">
                            <div class="uni-body">
                                <div class="uni-head">
                                    <span class="uni-logo uni-logo--inline"></span>
                                    <span class="uni-head-copy">
                                        <span class="skeleton-line" style="width: 84%; height: 15px;"></span>
                                        <span class="skeleton-line" style="width: 58%; height: 12px;"></span>
                                    </span>
                                </div>
                                <div class="u-skeleton-metric">
                                    <span class="skeleton-line u-skeleton-metric-icon"></span>
                                    <span class="skeleton-line u-skeleton-metric-label"></span>
                                    <span class="skeleton-line u-skeleton-metric-value"></span>
                                </div>
                                <div class="uni-footer u-skeleton-footer">
                                    <div class="u-skeleton-price">
                                        <div class="skeleton-line u-skeleton-price-value"></div>
                                        <div class="skeleton-line u-skeleton-price-period"></div>
                                    </div>
                                    <div class="skeleton-line u-skeleton-details"></div>
                                </div>
                            </div>
                        </article>
                    `).join("")}
                </div>
            </div>
        `;
    }

    function setUniversitiesLoading(isLoading, options = {}) {
        const mapMode = state.viewMode === "map";
        const preserveResults = options.preserveResults === true;

        if (skeletonFadeTimer) {
            clearTimeout(skeletonFadeTimer);
            skeletonFadeTimer = 0;
        }

        if (el.content) {
            el.content.setAttribute("aria-busy", isLoading ? "true" : "false");
        }
        if (el.mapStage) {
            el.mapStage.classList.toggle("is-loading", !!isLoading && mapMode && !preserveResults);
        }
        if (el.mapResults) {
            el.mapResults.setAttribute("aria-busy", isLoading && mapMode ? "true" : "false");
            if (isLoading && mapMode && !preserveResults) renderMapLoadingSkeleton();
        }

        if (mapMode) {
            if (skeletonShowTimer) {
                clearTimeout(skeletonShowTimer);
                skeletonShowTimer = 0;
            }
            if (el.skeleton) {
                el.skeleton.style.display = "none";
                el.skeleton.setAttribute("aria-hidden", "true");
                el.skeleton.classList.remove("is-fading-out");
            }
            isSkeletonCurrentlyVisible = false;
            if (el.list) el.list.style.display = "none";
            return;
        }

        if (isLoading) {
            if (preserveResults) {
                el.list?.classList.remove("is-fetching");
                return;
            }
            if (el.list) {
                el.list.classList.add("is-fetching");
            }

            const showSkeletonDom = () => {
                if (!el.skeleton) return;
                const skeletonCount = getUniversitiesSkeletonCount();
                if (!el.skeleton.innerHTML.trim() || el.skeleton.dataset.count !== String(skeletonCount)) {
                    el.skeleton.dataset.count = String(skeletonCount);
                    el.skeleton.innerHTML = Array.from({ length: skeletonCount }, () => `
                        <article class="uni-card u-skeleton-card is-skeleton" aria-hidden="true">
                            <div class="uni-media">
                                <div class="uni-logo" aria-hidden="true"></div>
                            </div>
                            <div class="uni-body">
                                <div class="skeleton-line u-skeleton-title"></div>
                                <div class="skeleton-line u-skeleton-title u-skeleton-title--short"></div>
                                <div class="skeleton-line u-skeleton-location"></div>
                                <div class="u-skeleton-metric">
                                    <span class="skeleton-line u-skeleton-metric-icon"></span>
                                    <span class="skeleton-line u-skeleton-metric-label"></span>
                                    <span class="skeleton-line u-skeleton-metric-value"></span>
                                </div>
                                <div class="uni-footer u-skeleton-footer">
                                    <div class="u-skeleton-price">
                                        <div class="skeleton-line u-skeleton-price-value"></div>
                                        <div class="skeleton-line u-skeleton-price-period"></div>
                                    </div>
                                    <div class="skeleton-line u-skeleton-details"></div>
                                </div>
                            </div>
                        </article>
                    `).join("");
                }
                el.skeleton.classList.remove("is-fading-out");
                el.skeleton.style.display = "grid";
                el.skeleton.setAttribute("aria-hidden", "false");
                isSkeletonCurrentlyVisible = true;
                if (el.list) {
                    el.list.style.visibility = "hidden";
                }
                if (el.pagination) {
                    el.pagination.style.visibility = "hidden";
                }
            };

            const hasExistingCards = Boolean(hasInitialListPaint && el.list && el.list.children.length > 0);
            if (!hasExistingCards) {
                if (skeletonShowTimer) {
                    clearTimeout(skeletonShowTimer);
                    skeletonShowTimer = 0;
                }
                showSkeletonDom();
            } else if (!isSkeletonCurrentlyVisible && !skeletonShowTimer) {
                skeletonShowTimer = window.setTimeout(() => {
                    skeletonShowTimer = 0;
                    showSkeletonDom();
                }, SKELETON_SHOW_DELAY_MS);
            }
            return;
        }

        // isLoading === false
        if (skeletonShowTimer) {
            clearTimeout(skeletonShowTimer);
            skeletonShowTimer = 0;
        }

        if (el.list) {
            el.list.classList.remove("is-fetching");
            el.list.style.display = "grid";
            el.list.style.visibility = "visible";
        }
        if (el.pagination) {
            el.pagination.style.visibility = "visible";
        }

        if (el.skeleton) {
            if (isSkeletonCurrentlyVisible) {
                el.skeleton.classList.add("is-fading-out");
                el.skeleton.setAttribute("aria-hidden", "true");
                skeletonFadeTimer = window.setTimeout(() => {
                    skeletonFadeTimer = 0;
                    if (el.skeleton) {
                        el.skeleton.style.display = "none";
                        el.skeleton.classList.remove("is-fading-out");
                    }
                    isSkeletonCurrentlyVisible = false;
                }, SKELETON_FADE_MS);
            } else {
                el.skeleton.style.display = "none";
                el.skeleton.setAttribute("aria-hidden", "true");
                el.skeleton.classList.remove("is-fading-out");
                isSkeletonCurrentlyVisible = false;
            }
        }
    }

    // --- Sliders ---
    function applySliderBounds(limits, prefCurrency = (currentCurrency || getPreferredCurrency())) {
        currentLimits = limits;
        [el.minSlider, el.maxSlider, el.minInput, el.maxInput].forEach((input) => {
            if (!input) return;
            input.min = String(limits.min);
            input.max = String(limits.max);
            input.step = String(limits.step);
        });
        if (el.minInput) el.minInput.placeholder = String(limits.min);
        if (el.maxInput) el.maxInput.placeholder = String(limits.max);
        updateSliderLabels();
    }

    function updateSliderLabels() {
        const pref = currentCurrency || getPreferredCurrency();
        const minVal = Number(el.minSlider ? el.minSlider.value : state.min_tuition) || 0;
        const maxVal = Number(el.maxSlider ? el.maxSlider.value : state.max_tuition) || currentLimits.max;
        const formattedMin = formatMoney(minVal, pref);
        const formattedMax = formatMoney(maxVal, pref);
        if (el.minCostLabel) el.minCostLabel.textContent = formattedMin;
        if (el.maxCostLabel) el.maxCostLabel.textContent = formattedMax;
        if (el.minSlider) el.minSlider.setAttribute("aria-valuetext", formattedMin);
        if (el.maxSlider) el.maxSlider.setAttribute("aria-valuetext", formattedMax);
    }

    function fillTrack() {
        if (!el.minSlider || !el.maxSlider || !el.track) return;
        const minVal = Number(el.minSlider.value) || 0;
        const maxVal = Number(el.maxSlider.value) || 0;
        const minLimit = Number(el.minSlider.min) || currentLimits.min || 0;
        const maxRange = Number(el.maxSlider.max) || currentLimits.max || 100000;
        const rangeSpan = Math.max(1, maxRange - minLimit);

        const r1 = Math.max(0, Math.min(1, (minVal - minLimit) / rangeSpan));
        const r2 = Math.max(0, Math.min(1, (maxVal - minLimit) / rangeSpan));

        const thumbSize = 18;
        const getThumbPos = (r) => {
            const pct = (r * 100).toFixed(2);
            const offset = (0.5 - r) * thumbSize;
            if (Math.abs(offset) < 0.001) return `${pct}%`;
            const sign = offset >= 0 ? "+" : "-";
            return `calc(${pct}% ${sign} ${Math.abs(offset).toFixed(2)}px)`;
        };

        const pos1 = getThumbPos(r1);
        const pos2 = getThumbPos(r2);

        const styles = getComputedStyle(document.documentElement);
        const inactive = (styles.getPropertyValue("--slider-track-inactive") || "#d4d8e0").trim();
        const active = (styles.getPropertyValue("--slider-track-active") || "#5d17ea").trim();
        el.track.style.background = `linear-gradient(to right, ${inactive} 0%, ${inactive} ${pos1}, ${active} ${pos1}, ${active} ${pos2}, ${inactive} ${pos2}, ${inactive} 100%)`;
    }
    function slideMin() {
        const gap = currentLimits.step;
        let minVal = parseInt(el.minSlider.value, 10) || 0;
        const maxVal = parseInt(el.maxSlider.value, 10) || currentLimits.max;
        if (maxVal - minVal < gap) {
            minVal = Math.max(currentLimits.min, maxVal - gap);
            el.minSlider.value = String(minVal);
        }
        el.minInput.value = el.minSlider.value;
        state.min_tuition = Number(el.minSlider.value);
        fillTrack();
        updateSliderLabels();
    }
    function slideMax() {
        const gap = currentLimits.step;
        const minVal = parseInt(el.minSlider.value, 10) || 0;
        let maxVal = parseInt(el.maxSlider.value, 10) || currentLimits.max;
        if (maxVal - minVal < gap) {
            maxVal = Math.min(currentLimits.max, minVal + gap);
            el.maxSlider.value = String(maxVal);
        }
        el.maxInput.value = el.maxSlider.value;
        state.max_tuition = Number(el.maxSlider.value);
        fillTrack();
        updateSliderLabels();
    }

    // --- Map ---
    let mapInstance = null;
    let markersLayer = null;
    let markersByUniId = new Map();
    let activeMapUniId = String(focusUniId || "").trim();
    let mapLibrariesPromise = null;
    let mapInitPromise = null;
    let mapWarmupScheduled = false;

    const MAP_ASSETS = {
        leafletCss: {
            href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
            integrity: "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H",
        },
        markerClusterCss: {
            href: "https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css",
            integrity: "sha384-lPzjPsFQL6te2x+VxmV6q1DpRxpRk0tmnl2cpwAO5y04ESyc752tnEWPKDfl1olr",
        },
        markerClusterDefaultCss: {
            href: "https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css",
            integrity: "sha384-5kMSQJ6S4Qj5i09mtMNrWpSi8iXw230pKU76xTmrpezGnNJQzj0NzXjQLLg+jE7k",
        },
        leafletJs: {
            src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
            integrity: "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH",
        },
        markerClusterJs: {
            src: "https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js",
            integrity: "sha384-RLIyj5q1b5XJTn0tqUhucRZe40nFTocRP91R/NkRJHwAe4XxnTV77FXy/vGLiec2",
        },
    };

    function loadStylesheetOnce(id, asset) {
        if (document.getElementById(id)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const href = String(typeof asset === "string" ? asset : asset?.href || "").trim();
            const link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = href;
            link.crossOrigin = "anonymous";
            if (typeof asset !== "string" && asset?.integrity) link.integrity = asset.integrity;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Failed to load ${href}`));
            document.head.appendChild(link);
        });
    }

        function loadScriptOnce(id, asset) {
        if (document.getElementById(id)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const src = String(typeof asset === "string" ? asset : asset?.src || "").trim();
            const script = document.createElement("script");
            script.id = id;
            script.src = src;
            script.async = true;
            script.crossOrigin = "anonymous";
            if (typeof asset !== "string" && asset?.integrity) script.integrity = asset.integrity;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    function ensureMapLibraries() {
        if (window.L && typeof window.L.markerClusterGroup === "function") {
            return Promise.resolve(window.L);
        }
        if (!mapLibrariesPromise) {
            mapLibrariesPromise = Promise.all([
                loadStylesheetOnce("leafletCss", MAP_ASSETS.leafletCss),
                loadStylesheetOnce("leafletMarkerClusterCss", MAP_ASSETS.markerClusterCss),
                loadStylesheetOnce("leafletMarkerClusterDefaultCss", MAP_ASSETS.markerClusterDefaultCss),
                loadScriptOnce("leafletJs", MAP_ASSETS.leafletJs)
                    .then(() => loadScriptOnce("leafletMarkerClusterJs", MAP_ASSETS.markerClusterJs)),
            ]).then(() => {
                if (!window.L || typeof window.L.markerClusterGroup !== "function") {
                    throw new Error("Leaflet marker cluster is unavailable");
                }
                return window.L;
            }).catch((error) => {
                mapLibrariesPromise = null;
                throw error;
            });
        }
        return mapLibrariesPromise;
    }

    readFromUrl(); 
    
    const initLocations = () => {
        updateCountryOptions();
        if (state.country) {
            if (el.countrySelect) el.countrySelect.value = state.country;
            updateLocationLogic(state.country);
            if (state.region && el.stateSelect) { el.stateSelect.value = state.region; updateCitiesForState(state.country, state.region); }
            if (state.city && el.citySelect) el.citySelect.value = state.city;
        }
        applyToForm();
    };
    
    if (Object.keys(CITY_OPTIONS_BY_COUNTRY).length > 0) initLocations();
    window.addEventListener("citiesLoaded", initLocations);

    applySliderBounds(currentLimits, currentCurrency);
    applyToForm();
    updateSliderVisibility();
    syncSidebarMaxHeight();
    
    loadRates().then(() => {
        const pref = getPreferredCurrency();
        if (pref === currentCurrency) {
            const freshLimits = getFilterLimits(pref);
            currentLimits = freshLimits;
            applySliderBounds(freshLimits, pref);
            fillTrack();
            updateSliderLabels();
        }
    }).catch(() => {});
    
    switchView(state.viewMode, false).catch((err) => console.error(err));
    
    const setupMobileFilters = () => {
        const toggleBtn = $("mobileFilterToggle");
        const sidebar = $("uSidebar");
        if (!toggleBtn || !sidebar) return;

        let draftSnapshot = null;
        let isEditing = false;
        const isMobileViewport = () => window.innerWidth <= 1024;

        const resetDraft = () => {
            clearSavedScrollPosition();
            Object.assign(state, {
                q: "",
                country: "",
                region: "",
                city: "",
                study_level: "",
                funding_type: getProfileFundingQueryValue(),
                min_tuition: currentLimits.min,
                max_tuition: currentLimits.max,
                sort: "name_asc",
                practice_vs_science: 50,
                social_vs_hardcore: 50,
                budget_vs_prestige: 50,
                city_vs_campus: 50,
                only_saved: false,
                page: 1,
            });
            applyToForm();
            if (el.stateDiv) el.stateDiv.style.display = "none";
            updateCityDropdown([]);
            updateSliderVisibility();
            updateMobileFilterUi();
        };

        const setOpen = (isOpen, { apply = false } = {}) => {
            if (!isMobileViewport()) return;
            if (isOpen) {
                draftSnapshot = { ...state };
                isEditing = true;
            } else if (isEditing && !apply && draftSnapshot) {
                Object.assign(state, draftSnapshot);
                applyToForm();
            }
            sidebar.classList.toggle("is-open", isOpen);
            toggleBtn.classList.toggle("is-active", isOpen);
            toggleBtn.hidden = isOpen;
            document.body.style.overflow = isOpen ? "hidden" : "";
            document.documentElement.classList.toggle("sidebar-filters-open", isOpen);
            if (!isOpen) {
                isEditing = false;
                draftSnapshot = null;
                updateMobileFilterUi();
            }
        };

        toggleBtn.addEventListener("click", () => {
            setOpen(!sidebar.classList.contains("is-open"));
        });
        el.mobileFilterClose?.addEventListener("click", () => setOpen(false));
        el.mobileResetFilters?.addEventListener("click", () => resetDraft());
        el.mobileApplyFilters?.addEventListener("click", () => {
            if (!isEditing) return;
            state.page = 1;
            clearSavedScrollPosition();
            setOpen(false, { apply: true });
            saveFilters(state);
            fetchAndRender();
        });

        // Close sidebar when clicking outside on mobile backdrop
        sidebar.addEventListener("click", (e) => {
            if (window.innerWidth <= 1024 && e.target === sidebar) {
                setOpen(false);
            }
        });

        __universitiesMobileFilterKeydownHandler = (event) => {
            if (event.key === "Escape" && sidebar.classList.contains("is-open")) setOpen(false);
        };
        document.addEventListener("keydown", __universitiesMobileFilterKeydownHandler);

        return { isEditing: () => isEditing };
    };
    const mobileFilters = setupMobileFilters();

    const recentDesktopAnchor = document.createComment("recently viewed desktop position");
    el.recentlyViewedBar?.parentNode?.insertBefore(recentDesktopAnchor, el.recentlyViewedBar);
    const relocateRecentlyViewedBar = () => {
        if (!el.recentlyViewedBar || !recentDesktopAnchor.parentNode) return;
        if (window.innerWidth <= 1024 && el.mobileRecentSlot) {
            el.mobileRecentSlot.append(el.recentlyViewedBar);
            return;
        }
        recentDesktopAnchor.parentNode.insertBefore(el.recentlyViewedBar, recentDesktopAnchor.nextSibling);
    };
    relocateRecentlyViewedBar();
    __universitiesRecentRelocationHandler = relocateRecentlyViewedBar;
    window.addEventListener("resize", __universitiesRecentRelocationHandler);

    async function handleSortChange(nextSort) {
        const prevSort = state.sort;
        if (el.sortSelect) el.sortSelect.value = nextSort;

        if (nextSort === "uni_ai" && prevSort !== "uni_ai") {
            const profile = loadProfile();
            if (!hasProfileEvidence(profile)) {
                if (el.sortSelect) {
                    el.sortSelect.value = prevSort;
                    initCustomSelect("sortSelect");
                }
                const confirmed = await showUniFitWarning();
                if (!confirmed) {
                    updateMobileFilterUi();
                    return;
                }
                if (el.sortSelect) {
                    el.sortSelect.value = "uni_ai";
                    initCustomSelect("sortSelect");
                }
            }
        }

        state.sort = el.sortSelect ? el.sortSelect.value : normalizeSortMode(nextSort);
        if (state.sort !== "uni_ai" && el.unifitWarningBanner) {
            unifitWarningBannerDismissed = false;
            el.unifitWarningBanner.hidden = true;
        }
        updateSliderVisibility();
        updateMobileFilterUi();
        refetch();
    }

    const scheduleRefetch = debounce(() => {
        state.page = 1; 
        clearSavedScrollPosition();
        updateMobileFilterUi();
        saveFilters(state);
        
        fetchAndRender(); 
    }, 250);
    const refetch = (...args) => {
        if (mobileFilters?.isEditing()) return;
        scheduleRefetch(...args);
    };

    // --- Listeners ---
    function syncSearchClearButton() {
        if (!el.searchClearBtn) return;
        const hasText = Boolean(String(el.qInput?.value || "").trim().length);
        el.searchClearBtn.hidden = !hasText;
    }

    el.qInput?.addEventListener("input", () => {
        const prevQ = state.q;
        state.q = el.qInput.value.trim();
        syncSearchClearButton();
        hideSearchSuggestions();
        if (!prevQ && state.q && state.sort === "name_asc") {
            state.sort = "relevance";
            if (el.sortSelect) {
                el.sortSelect.value = "relevance";
                initCustomSelect("sortSelect");
            }
        } else if (prevQ && !state.q && state.sort === "relevance") {
            state.sort = "name_asc";
            if (el.sortSelect) {
                el.sortSelect.value = "name_asc";
                initCustomSelect("sortSelect");
            }
        }
        if (state.activeTab !== "catalog" && !isCompareSelectionMode()) return;
        refetch();
    });
    el.qInput?.addEventListener("blur", () => window.setTimeout(hideSearchSuggestions, 160));
    el.searchClearBtn?.addEventListener("click", () => {
        if (!el.qInput) return;
        el.qInput.value = "";
        state.q = "";
        syncSearchClearButton();
        hideSearchSuggestions();
        el.qInput.focus();
        if (state.sort === "relevance") {
            state.sort = "name_asc";
            if (el.sortSelect) {
                el.sortSelect.value = "name_asc";
                initCustomSelect("sortSelect");
            }
        }
        if (state.activeTab !== "catalog" && !isCompareSelectionMode()) return;
        refetch();
    });
    
    el.countrySelect?.addEventListener("change", () => {
        state.country = el.countrySelect.value; state.region = ""; state.city = ""; 
        if(el.stateSelect) el.stateSelect.value = ""; if(el.citySelect) el.citySelect.value = "";
        updateLocationLogic(state.country); refetch();
    });
    
    el.stateSelect?.addEventListener("change", () => { state.region = el.stateSelect.value; state.city = ""; updateCitiesForState(state.country, state.region); refetch(); });
    el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
    
    if ($("studyLevelSelect")) $("studyLevelSelect").addEventListener("change", () => { state.study_level = $("studyLevelSelect").value; refetch(); });

    el.savedFilterButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const nextOnlySaved = String(btn.getAttribute("data-saved-filter") || "") === "favorites";
            if (state.only_saved === nextOnlySaved) return;
            state.only_saved = nextOnlySaved;
            syncSavedFilterButtons();
            refetch();
        });
    });

    el.sortSelect?.addEventListener("change", () => {
        handleSortChange(el.sortSelect.value);
    });

    const shouldShowUniFitWarning = () => {
        if (state.sort !== "uni_ai") return false;
        if (uniFitWarningShownInSession) return false;
        return !hasProfileEvidence(loadProfile());
    };

    const bindTradeoffSlider = (sliderEl, stateKey, leftTextKey, leftTextFallback, rightTextKey, rightTextFallback, labelEl) => {
        if (!sliderEl) return;
        sliderEl.addEventListener("input", () => {
            state[stateKey] = clampPercent(sliderEl.value, 50);
            updateTradeoffLabel(labelEl, state[stateKey], leftTextKey, leftTextFallback, rightTextKey, rightTextFallback);
        });
        sliderEl.addEventListener("change", () => {
            state[stateKey] = clampPercent(sliderEl.value, 50);
            updateTradeoffLabel(labelEl, state[stateKey], leftTextKey, leftTextFallback, rightTextKey, rightTextFallback);
            refetch();
        });
    };

    bindTradeoffSlider(
        el.focusSlider,
        "practice_vs_science",
        "universities.tradeoff.focus.left",
        "Career & Practice",
        "universities.tradeoff.focus.right",
        "Science & Research",
        el.focusLabel
    );
    bindTradeoffSlider(
        el.atmosphereSlider,
        "social_vs_hardcore",
        "universities.tradeoff.atmosphere.left",
        "Social & Events",
        "universities.tradeoff.atmosphere.right",
        "Hardcore Study",
        el.atmosphereLabel
    );
    bindTradeoffSlider(
        el.financeSlider,
        "budget_vs_prestige",
        "universities.tradeoff.finance.left",
        "Budget & Grants",
        "universities.tradeoff.finance.right",
        "Prestige & Comfort",
        el.financeLabel
    );
    bindTradeoffSlider(
        el.locationSlider,
        "city_vs_campus",
        "universities.tradeoff.location.left",
        "Study in City",
        "universities.tradeoff.location.right",
        "Study Outside City",
        el.locationLabel
    );

    function handleResetAllFilters() {
        clearSavedScrollPosition();
        Object.assign(state, {
            q: "",
            country: "",
            region: "",
            city: "",
            study_level: "",
            funding_type: getProfileFundingQueryValue(),
            min_tuition: currentLimits.min,
            max_tuition: currentLimits.max,
            sort: "name_asc",
            practice_vs_science: 50,
            social_vs_hardcore: 50,
            budget_vs_prestige: 50,
            city_vs_campus: 50,
            only_saved: false,
            page: 1
        });
        saveFilters(state);
        applyToForm();
        if (el.stateDiv) el.stateDiv.style.display = "none"; 
        updateCityDropdown([]); 
        updateSliderVisibility(); 
        updateMobileFilterUi();
        
        fetchAndRender();
    }

    el.resetBtn?.addEventListener("click", () => {
        motionPress(el.resetBtn);
        handleResetAllFilters();
    });

    el.state?.addEventListener("click", (e) => {
        const btn = e.target instanceof Element ? e.target.closest('[data-action="reset-filters"]') : null;
        if (!btn) return;
        motionPress(btn);
        handleResetAllFilters();
    });

    el.list.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        if (target.closest(".ui-tooltip-trigger, .ui-tooltip-wrap, .uni-status-trigger, .uni-metric-trigger")) return;
        const detailLink = target.closest(".uni-card-link-overlay");
        if (detailLink) {
            const card = detailLink.closest("[data-uni-id]");
            const uniId = card?.getAttribute("data-uni-id");
            if (isCompareSelectionMode()) {
                e.preventDefault();
                e.stopPropagation();
                toggleCompareUniversity(uniId);
                return;
            }
            rememberRecentUniversity(uniId);
            if (shouldOpenUniversitiesInNewTab()) {
                e.preventDefault();
                openUniversityDetail(uniId);
            }
            return;
        }
        const actionBtn = target.closest("[data-card-action]");
        if (actionBtn) {
            e.preventDefault();
            e.stopPropagation();
            handleCardAction(actionBtn, { compensateLayoutShift: true });
            return;
        }
        const card = target.closest("[data-uni-id]");
        if (!card || target.tagName === "A") return;
        if (isCompareSelectionMode()) {
            e.preventDefault();
            e.stopPropagation();
            toggleCompareUniversity(card.getAttribute("data-uni-id"));
            return;
        }
        rememberRecentUniversity(card.getAttribute("data-uni-id"));
        openUniversityDetail(card.getAttribute("data-uni-id"));
    });

    __universitiesMapCardActionHandler = (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const actionBtn = target?.closest(".map-card-wrapper [data-card-action]");
        if (actionBtn) {
            e.preventDefault();
            e.stopPropagation();
            handleCardAction(actionBtn, { compensateLayoutShift: false });
            return;
        }
        if (!isCompareSelectionMode()) return;
        const popupCard = target?.closest(".map-card-wrapper [data-uni-id]");
        if (!popupCard) return;
        e.preventDefault();
        e.stopPropagation();
        toggleCompareUniversity(popupCard.getAttribute("data-uni-id"));
    };
    document.addEventListener("click", __universitiesMapCardActionHandler, true);

    el.compareTray?.addEventListener("click", (e) => {
        const action = e.target instanceof Element ? e.target.closest("[data-action]")?.getAttribute("data-action") : "";
        const actionButton = e.target instanceof Element ? e.target.closest("[data-action]") : null;
        if (actionButton) motionPress(actionButton);
        if (action === "clear-compare") {
            const wasCompareResults = isCompareResultsMode();
            compareUniversityIds.clear();
            compareAdmissionChoices.clear();
            state.compareResultIds = [];
            state.compareStage = "select";
            persistSavedAndCompare();
            syncCardActionState();
            if (wasCompareResults) {
                syncSectionVisibility({ shouldFetch: false, replaceUrl: true }).catch((err) => console.error(err));
            }
        }
        if (action === "remove-compare-slot") {
            const slotUniId = String(actionButton?.getAttribute("data-uni-id") || "").trim();
            if (slotUniId) {
                toggleCompareUniversity(slotUniId);
            }
        }
        if (action === "open-compare") {
            openCompareResultsPage().catch((err) => console.error(err));
        }
    });

    const setCompareSelectionMode = (enabled, { replaceUrl = false } = {}) => {
        hideSearchSuggestions();
        const nextTab = enabled ? "compare" : "catalog";
        if (nextTab === state.activeTab && !(nextTab === "compare" && isCompareResultsMode())) return;
        state.activeTab = nextTab;
        if (nextTab !== "compare") {
            state.compareStage = "select";
            state.compareResultIds = [];
        } else if (state.compareStage !== "results") {
            state.compareStage = "select";
        }
        saveFilters(state);
        syncSectionVisibility({
            shouldFetch: !lastRenderedItems.length,
            updateUrl: true,
            replaceUrl,
        }).catch((err) => console.error(err));
        syncCardActionState();
    };

    el.compareModeBtn?.addEventListener("click", () => {
        motionPress(el.compareModeBtn);
        setCompareSelectionMode(!isCompareSelectionMode());
    });


    el.btnList?.addEventListener("click", () => {
        switchView("list", true).catch((err) => console.error(err));
    });
    el.btnMap?.addEventListener("click", () => {
        switchView("map", true).catch((err) => console.error(err));
    });

    if (el.minSlider && el.maxSlider) {
        el.minSlider.addEventListener("input", slideMin);
        el.maxSlider.addEventListener("input", slideMax);
        el.minSlider.addEventListener("change", () => refetch());
        el.maxSlider.addEventListener("change", () => refetch());
    }

    el.minInput?.addEventListener("change", () => {
        const gap = currentLimits.step;
        let val = clampTuition(el.minInput.value, currentLimits.min);
        const maxVal = parseInt(el.maxSlider?.value, 10) || currentLimits.max;
        if (val > maxVal - gap) {
            val = Math.max(currentLimits.min, maxVal - gap);
        }
        el.minInput.value = String(val);
        if (el.minSlider) el.minSlider.value = String(val);
        state.min_tuition = val;
        fillTrack();
        updateSliderLabels();
        refetch();
    });

    el.maxInput?.addEventListener("change", () => {
        const gap = currentLimits.step;
        let val = clampTuition(el.maxInput.value, currentLimits.max);
        const minVal = parseInt(el.minSlider?.value, 10) || 0;
        if (val < minVal + gap) {
            val = Math.min(currentLimits.max, minVal + gap);
        }
        el.maxInput.value = String(val);
        if (el.maxSlider) el.maxSlider.value = String(val);
        state.max_tuition = val;
        fillTrack();
        updateSliderLabels();
        refetch();
    });

    const refreshLocationFilterLabels = () => {
        updateCountryOptions();
        if (!state.country) {
            if (el.countrySelect) el.countrySelect.value = "";
            if (el.stateSelect) el.stateSelect.value = "";
            if (el.citySelect) el.citySelect.value = "";
            updateLocationLogic("");
            return;
        }

        if (el.countrySelect) el.countrySelect.value = state.country;
        updateLocationLogic(state.country);

        if (state.region && el.stateSelect) {
            el.stateSelect.value = state.region;
            updateCitiesForState(state.country, state.region);
        }

        if (state.city && el.citySelect) {
            el.citySelect.value = state.city;
        }

        ["countrySelect", "stateSelect", "citySelect"].forEach((id) => initCustomSelect(id));
    };

    hideSearchSuggestions();
    syncSectionVisibility({
        shouldFetch: !isCompareResultsMode(),
        updateUrl: true,
        replaceUrl: true,
    }).catch((err) => console.error(err));
    __universitiesProfileUpdatedHandler = () => {
        state.funding_type = getProfileFundingQueryValue();
        state.page = 1;
        saveFilters(state);
        if (!isCompareResultsMode()) {
            fetchAndRender();
        }
    };
    window.addEventListener("profileUpdated", __universitiesProfileUpdatedHandler);
    __universitiesLanguageChangedHandler = () => {
        applyAISortOptionLabel();
        refreshLocationFilterLabels();
        applyToForm();
        updateTradeoffLabels();
        syncSectionVisibility({
            shouldFetch: !isCompareResultsMode(),
            updateUrl: true,
            replaceUrl: true,
        }).catch((err) => console.error(err));
    };
    window.addEventListener("languageChanged", __universitiesLanguageChangedHandler);
    __universitiesSettingsChangedHandler = () => {
        renderRecentlyViewedBar();
    };
    window.addEventListener("settingsChanged", __universitiesSettingsChangedHandler);

    if (__universitiesOnlineReconnectHandler) {
        window.removeEventListener("app:online-reconnect", __universitiesOnlineReconnectHandler);
    }
    __universitiesOnlineReconnectHandler = () => {
        if (!isCompareResultsMode() && typeof fetchAndRender === "function") {
            fetchAndRender();
        }
    };
    window.addEventListener("app:online-reconnect", __universitiesOnlineReconnectHandler);

    if (__universitiesCurrencyChangedHandler) {
        window.removeEventListener("currencyChanged", __universitiesCurrencyChangedHandler);
    }
    __universitiesCurrencyChangedHandler = (e) => {
        const newCurrency = String(e?.detail?.currency || e?.detail?.preferredCurrency || getPreferredCurrency() || "USD").trim().toUpperCase();
        const oldCurrency = currentCurrency || "USD";
        if (newCurrency === oldCurrency) {
            if (typeof fetchAndRender === "function" && !isCompareResultsMode()) {
                fetchAndRender();
            }
            return;
        }

        // 1. Read current slider positions
        const oldMin = Number(el.minSlider ? el.minSlider.value : state.min_tuition);
        const oldMax = Number(el.maxSlider ? el.maxSlider.value : state.max_tuition);
        const oldLimits = currentLimits || getFilterLimits(oldCurrency);

        // 2. Convert: old currency -> USD -> new currency
        const wasAtMin = !Number.isFinite(oldMin) || oldMin <= oldLimits.min;
        const wasAtMax = !Number.isFinite(oldMax) || oldMax >= oldLimits.max;

        const usdMin = convert(oldMin, oldCurrency, "USD");
        const usdMax = convert(oldMax, oldCurrency, "USD");

        const convertedMin = convert(usdMin, "USD", newCurrency);
        const convertedMax = convert(usdMax, "USD", newCurrency);

        // 3. Get new bounds from getFilterLimits(newCurrency)
        const newLimits = getFilterLimits(newCurrency);
        currentLimits = newLimits;
        currentCurrency = newCurrency;

        // 4. Clamp converted positions to new bounds
        const step = newLimits.step || 1;
        let clampedMin = wasAtMin ? newLimits.min : Math.max(newLimits.min, Math.min(newLimits.max, Math.round(convertedMin / step) * step));
        let clampedMax = wasAtMax ? newLimits.max : Math.max(newLimits.min, Math.min(newLimits.max, Math.round(convertedMax / step) * step));

        if (clampedMax - clampedMin < step) {
            if (clampedMin + step <= newLimits.max) {
                clampedMax = clampedMin + step;
            } else {
                clampedMin = Math.max(newLimits.min, clampedMax - step);
            }
        }

        // 5. Update slider min/max/step attributes
        applySliderBounds(newLimits, newCurrency);

        // 6. Update slider positions and input values
        if (el.minSlider) el.minSlider.value = String(clampedMin);
        if (el.maxSlider) el.maxSlider.value = String(clampedMax);
        if (el.minInput) el.minInput.value = String(clampedMin);
        if (el.maxInput) el.maxInput.value = String(clampedMax);
        state.min_tuition = clampedMin;
        state.max_tuition = clampedMax;
        state.currency = newCurrency;
        saveFilters(state);
        fillTrack();

        // 7. Re-render slider labels
        updateSliderLabels();

        // Re-render visible cards and map markers
        if (typeof fetchAndRender === "function" && !isCompareResultsMode()) {
            fetchAndRender();
        }
    };
    window.addEventListener("currencyChanged", __universitiesCurrencyChangedHandler);

    let scrollSaveTimer = null;
    const syncMobileFilterFooterClearance = () => {
        const toggleBtn = el.mobileFilterToggle || $("mobileFilterToggle");
        if (!toggleBtn) return;
        if (window.innerWidth > 1024) {
            toggleBtn.style.removeProperty("--u-mobile-filter-footer-clearance");
            return;
        }

        const footer = document.querySelector(".site-footer");
        if (!footer) return;
        const footerClearance = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top + 16);
        toggleBtn.style.setProperty("--u-mobile-filter-footer-clearance", `${Math.ceil(footerClearance)}px`);
    };

    const onCatalogScroll = () => {
        scheduleSyncSidebarMaxHeight();
        syncMobileFilterFooterClearance();
        if (scrollSaveTimer) return;
        scrollSaveTimer = window.setTimeout(() => {
            scrollSaveTimer = null;
            saveCurrentScrollPosition();
        }, 150);
    };

    __universitiesScrollHandler = onCatalogScroll;
    __universitiesPagehideHandler = saveCurrentScrollPosition;
    __universitiesBeforeunloadHandler = saveCurrentScrollPosition;

    window.addEventListener("scroll", __universitiesScrollHandler, { passive: true });
    window.addEventListener("pagehide", __universitiesPagehideHandler);
    window.addEventListener("beforeunload", __universitiesBeforeunloadHandler);

    __universitiesResizeHandler = () => {
        scheduleSyncWorkspaceDepth();
        scheduleSyncSidebarMaxHeight();
        syncMobileFilterFooterClearance();
        // Map stage height follows the viewport, so tell Leaflet to re-fit tiles.
        if (state.viewMode === "map" && mapInstance) {
            if (__universitiesMapResizeTimer) window.clearTimeout(__universitiesMapResizeTimer);
            __universitiesMapResizeTimer = window.setTimeout(() => {
                __universitiesMapResizeTimer = 0;
                if (mapInstance) mapInstance.invalidateSize();
            }, 150);
        }
    };
    window.addEventListener("resize", __universitiesResizeHandler, { passive: true });
    syncMobileFilterFooterClearance();

    if (typeof ResizeObserver !== "undefined") {
        __universitiesResizeObserver = new ResizeObserver(() => {
            scheduleSyncWorkspaceDepth();
            scheduleSyncSidebarMaxHeight();
        });
        const sidebarNode = el.sidebar || $("uSidebar") || document.querySelector(".u-sidebar");
        const contentNode = el.catalogPane || el.content || document.querySelector(".u-content");
        if (sidebarNode) __universitiesResizeObserver.observe(sidebarNode);
        if (contentNode) __universitiesResizeObserver.observe(contentNode);
        if (el.recentlyViewedBar) __universitiesResizeObserver.observe(el.recentlyViewedBar);
        const filterCardNode = el.filterCard || sidebarNode?.querySelector(".u-filter-card");
        if (filterCardNode) __universitiesResizeObserver.observe(filterCardNode);
    }

    function applyViewVisibility(mode) {
        if (el.list) el.list.style.display = mode === "list" ? "grid" : "none";
        if (el.pagination) el.pagination.style.display = mode === "list" ? "flex" : "none";
        if (el.mapStage) el.mapStage.style.display = mode === "map" ? "grid" : "none";
    }

    async function switchView(mode, shouldFetch = false) {
        state.viewMode = mode;
        saveFilters(state);
        el.btnList?.classList.toggle("active", mode === "list");
        el.btnMap?.classList.toggle("active", mode === "map");

        if (mode === "map" && Array.isArray(lastRenderedItems) && lastRenderedItems.length > 0) {
            renderMapResultsPanel(lastRenderedItems);
        }

        applyViewVisibility(mode);
        scheduleSyncWorkspaceDepth();

        if (mode === "map") {
            await initMap();
            if (state.viewMode !== "map") return;
            if (lastRenderedItems.length > 0) {
                updateMapMarkers(lastRenderedItems, { renderResults: false });
            }
            window.setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 100);
        }

        if (shouldFetch) {
            fetchAndRender({ preserveVisibleResults: true, animateResults: false });
        }
    }

    async function initMap() {
        if (mapInstance) return mapInstance;
        if (mapInitPromise) return mapInitPromise;
        mapInitPromise = (async () => {
            const L = await ensureMapLibraries();
            if (mapInstance) return mapInstance;
            mapInstance = L.map('mapContainer', {
                maxBounds: [[-90, -180], [90, 180]],
                maxBoundsViscosity: 1.0,
                minZoom: 2,
                maxZoom: 18,
                zoomAnimation: true,
                zoomAnimationThreshold: 4,
                fadeAnimation: true,
                markerZoomAnimation: true,
                zoomSnap: 0.25,
                zoomDelta: 0.25,
                wheelDebounceTime: 30,
                wheelPxPerZoomLevel: 120
            }).setView([25, 0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { noWrap: true }).addTo(mapInstance);
            markersLayer = L.markerClusterGroup({
                showCoverageOnHover: false, zoomToBoundsOnClick: false, spiderfyOnMaxZoom: true, animate: true, animationDuration: 1000,
                chunkedLoading: true, chunkInterval: 30, chunkDelay: 30,
                iconCreateFunction: function(cluster) {
                    const markers = cluster.getAllChildMarkers();
                    const count = markers.length;
                    let best = null;
                    for (const m of markers) {
                        const r = Number(m?.options?.uniRank);
                        if (!Number.isFinite(r)) continue;
                        if (!best || r < best.rank) best = { rank: r, id: m?.options?.uniId };
                    }
                    const fallbackId = markers[0]?.options?.uniId || "default";
                    const bestId = (best && best.id) ? best.id : fallbackId;
                    const logoUrl = uniLogoSrc(bestId, { forceFull: true });
                    return L.divIcon({
                        html: clusterMarkerLogoHtml(logoUrl, count - 1),
                        className: "cluster-icon-container",
                        iconSize: [44, 44],
                        iconAnchor: [22, 22],
                    });
                }
            });
            markersLayer.on('clusterclick', function (a) { mapInstance.flyToBounds(a.layer.getBounds(), { padding: [80, 80], duration: 1.0 }); });
            mapInstance.on('popupclose', (e) => {
                if (markersByUniId.size === 0) return;
                const source = e.popup && typeof e.popup.getSource === "function" ? e.popup.getSource() : e.popup?._source;
                const closedUniId = source?.options?.uniId;
                if (closedUniId && closedUniId === activeMapUniId) {
                    updateMapResultsSelection("");
                }
            });
            mapInstance.addLayer(markersLayer);
            return mapInstance;
        })().catch((error) => {
            mapInitPromise = null;
            throw error;
        });
        return mapInitPromise;
    }

    function warmMapMode(items) {
        renderMapResultsPanel(items);
        if (mapInstance || mapWarmupScheduled) return;
        mapWarmupScheduled = true;

        // Loading the map libraries after the first catalog paint keeps the
        // first view switch from racing a cold Leaflet setup. The visible map
        // still invalidates its size when it is opened for the first time.
        const startWarmup = () => {
            initMap()
                .then(() => {
                    updateMapMarkers(lastRenderedItems, { renderResults: false });
                    viewModesReady = true;
                    syncViewModeControls();
                })
                .catch((error) => console.warn("Map warmup failed", error));
        };
        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(startWarmup, { timeout: 1000 });
        } else {
            window.setTimeout(startWarmup, 0);
        }
    }

    function updateMapResultsSelection(uniId) {
        activeMapUniId = String(uniId || "").trim();
        if (!el.mapResults) return;
        el.mapResults.querySelectorAll(".u-map-results-list .uni-card[data-uni-id]").forEach((card) => {
            const isActive = card.getAttribute("data-uni-id") === activeMapUniId;
            card.classList.toggle("is-active", isActive);
        });
    }

    function focusMapUniversity(uniId, { openPopup = true, fly = true, zoom = 14 } = {}) {
        const targetId = String(uniId || "").trim();
        if (!targetId || !mapInstance) return;
        const marker = markersByUniId.get(targetId);
        if (!marker) return;

        updateMapResultsSelection(targetId);
        const latLng = marker.getLatLng();
        const openTarget = () => {
            marker.setZIndexOffset(1200);
            if (openPopup) marker.openPopup();
        };

        if (fly) {
            mapInstance.once('moveend', openTarget);
            mapInstance.flyTo(latLng, zoom, {
                animate: true,
                duration: 1.0,
                easeLinearity: 0.2
            });
            return;
        }

        mapInstance.panTo(latLng);
        openTarget();
    }

    function renderMapResultsPanel(items) {
        if (!el.mapResults) return;
        const mappedItems = (Array.isArray(items) ? items : []).filter((u) => u?.coordinates?.lat && u?.coordinates?.lon);

        if (!mappedItems.length) {
            el.mapResults.innerHTML = `
                <div class="u-map-results-empty">${escapeHtml(t("universities.map_panel.empty", "No universities with map coordinates match these filters."))}</div>
            `;
            return;
        }

        const visibleItems = mappedItems.slice(0, 30);
        const preferredId = visibleItems.some((u) => String(u.id || "") === activeMapUniId)
            ? activeMapUniId
            : (visibleItems.some((u) => String(u.id || "") === focusUniId) ? String(focusUniId || "") : "");
        activeMapUniId = preferredId;

        const profile = loadProfileForApi();
        const userBudget = parseFloat(profile.budget);
        el.mapResults.innerHTML = `
            <div class="u-map-results-list">
                ${visibleItems.map((u, idx) => {
                    const uniId = String(u?.id || "");
                    return renderCard(u, userBudget, idx, {
                        hideMedia: true,
                        mapVariant: true,
                        isActive: uniId !== "" && uniId === preferredId,
                    });
                }).join("")}
            </div>
        `;

        el.mapResults.querySelectorAll(".u-map-results-list .uni-card[data-uni-id]").forEach((card) => {
            card.addEventListener("click", (event) => {
                const target = event.target instanceof Element ? event.target : null;
                if (!target) return;
                if (target.closest(".ui-tooltip-trigger, .ui-tooltip-wrap, .uni-status-trigger, .uni-metric-trigger, .u-tooltip, .ui-tooltip-bubble")) return;
                const uniId = String(card.getAttribute("data-uni-id") || "").trim();
                if (!uniId) return;
                const detailsLink = target.closest("a.uni-details");
                if (detailsLink) {
                    event.preventDefault();
                    if (isCompareSelectionMode()) {
                        toggleCompareUniversity(uniId);
                        return;
                    }
                    rememberRecentUniversity(uniId);
                    openUniversityDetail(uniId);
                    return;
                }
                if (isCompareSelectionMode()) {
                    toggleCompareUniversity(uniId);
                }
                focusMapUniversity(uniId, {
                    openPopup: true,
                    fly: true,
                    zoom: 14,
                });
            });
        });
    }

    function updateMapMarkers(items, options = {}) {
        if (!mapInstance || !markersLayer) return;
        const L = window.L;
        if (!L) return;
        markersLayer.clearLayers();
        markersByUniId = new Map();
        const profile = loadProfileForApi(); const userBudget = parseFloat(profile.budget);
        if (options.renderResults !== false) renderMapResultsPanel(items);
        const isCompactViewport = window.matchMedia("(max-width: 768px)").matches;
        const popupOptions = {
            minWidth: isCompactViewport ? 220 : 320,
            maxWidth: isCompactViewport ? 280 : 380,
            className: "custom-map-popup",
            autoPan: true,
            keepInView: true,
            autoPanPaddingTopLeft: L.point(20, 20),
            autoPanPaddingBottomRight: L.point(20, 20)
        };
        const newMarkers = [];
        items.forEach(u => {
            if (u.coordinates?.lat && u.coordinates?.lon) {
                const uniId = String(u.id || "");
                const customIcon = L.divIcon({
                    className: "custom-div-icon",
                    html: mapMarkerLogoHtml(uniLogoSrc(uniId, { forceFull: true })),
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                    popupAnchor: [0, -24],
                });
                const rankValue = Number(u.rank);
                const marker = L.marker([u.coordinates.lat, u.coordinates.lon], {
                    icon: customIcon,
                    uniId: uniId,
                    uniRank: Number.isFinite(rankValue) ? rankValue : 999999
                });
                const cardHTML = `<div class="map-card-wrapper">${renderCard(u, userBudget)}</div>`;
                marker.bindPopup(cardHTML, popupOptions);
                marker.on('click', function(e) {
                    const clickedMarker = this;
                    updateMapResultsSelection(uniId);
                    clickedMarker.setZIndexOffset(1000);
                    mapInstance.once('moveend', () => {
                        if (!clickedMarker.getPopup().isOpen()) clickedMarker.openPopup();
                    });
                    mapInstance.flyTo(e.target.getLatLng(), 16, {
                        animate: true,
                        duration: 1.0,
                        easeLinearity: 0.2
                    });
                });
                newMarkers.push(marker);
                markersByUniId.set(uniId, marker);
            }
        });
        markersLayer.addLayers(newMarkers);
        if (state.viewMode === "map" && focusUniId && !focusUniDone) {
            const target = markersByUniId.get(focusUniId);
            if (target) {
                updateMapResultsSelection(focusUniId);
                focusUniDone = true;
                const latLng = target.getLatLng();
                mapInstance.once('moveend', () => {
                    target.setZIndexOffset(1200);
                    target.openPopup();
                });
                mapInstance.flyTo(latLng, 14, { animate: true, duration: 1.2 });
            }
        }

        if (!focusUniDone) {
            if (activeMapUniId) updateMapResultsSelection(activeMapUniId);
        }
    }

    function updateSliderVisibility() {
        if (el.sortStrategyInfoWrap) {
            const showSortInfo = state.sort === "uni_ai";
            el.sortStrategyInfoWrap.style.display = showSortInfo ? "" : "none";
            el.sortStrategyInfoWrap.setAttribute("aria-hidden", showSortInfo ? "false" : "true");
            if (!showSortInfo) el.sortStrategyInfoWrap.classList.remove("is-open");
        }
        if (el.sortAiTagsHint) {
            const showAiTagsHint = state.sort !== "uni_ai";
            el.sortAiTagsHint.style.display = showAiTagsHint ? "" : "none";
            el.sortAiTagsHint.setAttribute("aria-hidden", showAiTagsHint ? "false" : "true");
        }
        if (!el.sliderContainer) return;
        if (state.sort === "uni_ai") {
            el.sliderContainer.style.display = "block";
            updateTradeoffLabels();
        } 
        else { el.sliderContainer.style.display = "none"; }
    }

    function updateTradeoffLabel(labelEl, value, leftTextKey, leftTextFallback, rightTextKey, rightTextFallback) {
        if (!labelEl) return;
        const val = clampPercent(value, 50);
        const leftText = t(leftTextKey, leftTextFallback);
        const rightText = t(rightTextKey, rightTextFallback);
        let text = t("universities.tradeoff.balanced", "Balanced (50/50)");
        if (val < 50) text = `${leftText} (${100 - val}%)`;
        else if (val > 50) text = `${rightText} (${val}%)`;
        labelEl.textContent = text;
    }

    function updateTradeoffLabels() {
        updateTradeoffLabel(
            el.focusLabel,
            state.practice_vs_science,
            "universities.tradeoff.focus.left",
            "Career & Practice",
            "universities.tradeoff.focus.right",
            "Science & Research"
        );
        updateTradeoffLabel(
            el.atmosphereLabel,
            state.social_vs_hardcore,
            "universities.tradeoff.atmosphere.left",
            "Social & Events",
            "universities.tradeoff.atmosphere.right",
            "Hardcore Study"
        );
        updateTradeoffLabel(
            el.financeLabel,
            state.budget_vs_prestige,
            "universities.tradeoff.finance.left",
            "Budget & Grants",
            "universities.tradeoff.finance.right",
            "Prestige & Comfort"
        );
        updateTradeoffLabel(
            el.locationLabel,
            state.city_vs_campus,
            "universities.tradeoff.location.left",
            "Study in City",
            "universities.tradeoff.location.right",
            "Study Outside City"
        );
    }
    
    function getApiTuitionParams() {
        const pref = currentCurrency || getPreferredCurrency();
        const minSliderVal = Number(el.minSlider ? el.minSlider.value : state.min_tuition);
        const maxSliderVal = Number(el.maxSlider ? el.maxSlider.value : state.max_tuition);
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

    function buildParams(forApi = false) {
        const p = new URLSearchParams();
        const uiLang = getCurrentLanguage();
        if (uiLang) p.set("lang", uiLang);
        if (forApi) p.set("fields", "card");
        state.funding_type = getProfileFundingQueryValue();
        if (state.q) p.set("q", state.q); if (state.country) p.set("country", state.country);
        if (state.region) p.set("region", state.region); if (state.city) p.set("city", state.city);
        const tuitionParams = getApiTuitionParams();
        if (tuitionParams.min_tuition !== undefined) p.set("min_tuition", String(tuitionParams.min_tuition));
        if (tuitionParams.max_tuition !== undefined) p.set("max_tuition", String(tuitionParams.max_tuition));
        if (state.study_level) p.set("study_level", state.study_level);
        if (state.funding_type) p.set("funding_type", state.funding_type);

        const isAiSort = (state.sort === "uni_ai");
        if (forApi) p.set("sort", isAiSort ? "name_asc" : state.sort);

        if (forApi) {
            const profile = loadProfile();
            const major = String(profile?.major || "").trim();
            const mode = String(profile?.studyMode || "").trim();
            if (major) p.set("major", major);
            if (mode && mode.toLowerCase() !== "any") p.set("format", mode);
        }
        
        if (forApi && state.only_saved) {
            p.set("limit", "2000"); p.set("page", "1");
        } else if (forApi && state.viewMode === "map") {
            p.set("limit", "200"); p.set("page", "1");
        } else {
            if (forApi && isAiSort) { p.set("limit", "100"); p.set("page", "1"); } 
            else { p.set("page", String(state.page)); p.set("limit", String(state.limit)); }
        }
        if (forApi && state.practice_vs_science !== undefined && state.practice_vs_science !== null) p.set("practice_vs_science", String(state.practice_vs_science));
        if (forApi && state.social_vs_hardcore !== undefined && state.social_vs_hardcore !== null) p.set("social_vs_hardcore", String(state.social_vs_hardcore));
        if (forApi && state.budget_vs_prestige !== undefined && state.budget_vs_prestige !== null) p.set("budget_vs_prestige", String(state.budget_vs_prestige));
        if (forApi && state.city_vs_campus !== undefined && state.city_vs_campus !== null) p.set("city_vs_campus", String(state.city_vs_campus));
        if (state.viewMode) p.set("view", state.viewMode);
        if (!forApi && state.sort && state.sort !== "name_asc") p.set("sort", state.sort);
        if (!forApi && state.only_saved) p.set("only_saved", "1");
        if (!forApi && focusUniId) p.set("focus_uni", focusUniId);
        return p;
    }

    function buildAiSortPayload() {
        const profile = loadProfileForApi();
        const uiLang = getCurrentLanguage();
        const isMapMode = state.viewMode === "map";
        const shouldClientPageSaved = !!state.only_saved;
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
        const tuitionParams = getApiTuitionParams();
        if (tuitionParams.min_tuition !== undefined) payload.min_tuition = tuitionParams.min_tuition;
        if (tuitionParams.max_tuition !== undefined) payload.max_tuition = tuitionParams.max_tuition;

        const major = String(profile?.major || "").trim();
        const mode = String(profile?.studyMode || "").trim();
        if (major) payload.major = major;
        if (mode && mode.toLowerCase() !== "any") payload.format = mode;
        logTranslationDebug("ai-sort payload", {
            viewMode: state.viewMode,
            uiLang,
            localeInProfile: profile?.locale || profile?.language || profile?.lang || "",
            interestsRawLength: String(profile?.interests || "").trim().length,
        });
        return payload;
    }

    function buildFallbackListParams(apiParams) {
        const fallback = new URLSearchParams(apiParams.toString());
        fallback.set("sort", state.q ? "relevance" : "name_asc");
        fallback.set("page", state.only_saved ? "1" : String(state.page));
        fallback.set("limit", state.only_saved ? "2000" : String(state.limit));
        return fallback;
    }

    function applyToForm() {
        if(el.qInput) el.qInput.value = state.q;
        syncSearchClearButton();
        if(el.countrySelect) el.countrySelect.value = state.country;
        if(el.stateSelect) el.stateSelect.value = state.region; if(el.citySelect) el.citySelect.value = state.city;
        if (el.sortSelect) {
            state.sort = normalizeSortMode(state.sort);
            el.sortSelect.value = state.sort;
            if (el.sortSelect.value !== state.sort) {
                state.sort = defaultSortMode;
                el.sortSelect.value = state.sort;
            }
        }
        const studyLevelSelect = $("studyLevelSelect");
        if (studyLevelSelect) studyLevelSelect.value = state.study_level || "";
        if (el.focusSlider) el.focusSlider.value = state.practice_vs_science;
        if (el.atmosphereSlider) el.atmosphereSlider.value = state.social_vs_hardcore;
        if (el.financeSlider) el.financeSlider.value = state.budget_vs_prestige;
        if (el.locationSlider) el.locationSlider.value = state.city_vs_campus;
        if (el.minSlider) el.minSlider.value = state.min_tuition;
        if (el.maxSlider) el.maxSlider.value = state.max_tuition;
        if (el.minInput) el.minInput.value = state.min_tuition;
        if (el.maxInput) el.maxInput.value = state.max_tuition;
        syncSavedFilterButtons();
        
        fillTrack(); 
        updateSliderLabels();

        ["countrySelect", "stateSelect", "citySelect", "sortSelect", "studyLevelSelect"].forEach(id => initCustomSelect(id));
        updateSliderVisibility();
        updateTradeoffLabels();
        updateMobileFilterUi();
    }

    function updateLocationLogic(country) {
        if (!el.stateDiv) return;
        const countryData = CITY_OPTIONS_BY_COUNTRY[country];
        if (!country || !countryData) { el.stateDiv.style.display = "none"; updateCityDropdown([]); return; }
        if (Array.isArray(countryData)) { el.stateDiv.style.display = "none"; updateCityDropdown(countryData); } 
        else {
            el.stateDiv.style.display = "block"; 
            const states = Object.keys(countryData).sort();
            el.stateSelect.innerHTML = `<option value="">${escapeHtml(t("universities.any_state", "Any State"))}</option>`;
            states.forEach((s) => {
                const value = String(s || "");
                const label = trState(value);
                el.stateSelect.innerHTML += `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
            });
            initCustomSelect("stateSelect");
            updateCityDropdown([]);
        }
    }
    function updateCitiesForState(country, region) {
        if (!country || !region) { updateCityDropdown([]); return; }
        const countryData = CITY_OPTIONS_BY_COUNTRY[country];
        if (countryData && !Array.isArray(countryData)) { updateCityDropdown(countryData[region] || []); }
    }
    function updateCityDropdown(cities) {
        if (!el.citySelect) return;
        if (!cities || cities.length === 0) { el.citySelect.innerHTML = `<option value="">${escapeHtml(t("universities.select_country_first", "Select country first"))}</option>`; el.citySelect.disabled = true; } 
        else {
            el.citySelect.disabled = false;
            el.citySelect.innerHTML = `<option value="">${escapeHtml(t("universities.all_cities", "All Cities"))}</option>`;
            cities.sort().forEach((c) => {
                const value = String(c || "");
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = trCity(value);
                el.citySelect.appendChild(opt);
            });
        }
        initCustomSelect("citySelect");
    }
    function updateCountryOptions() {
        if (!el.countrySelect) return;
        const countries = Object.keys(CITY_OPTIONS_BY_COUNTRY).sort();
        const currentVal = el.countrySelect.value || state.country;
        let html = `<option value="">${escapeHtml(t("universities.global", "Global"))}</option>`;
        countries.forEach(c => { 
            const isSelected = (c === currentVal) ? "selected" : ""; 
            const value = String(c || "");
            const text = escapeHtml(trCountry(value));
            html += `<option value="${escapeHtml(value)}" ${isSelected}>${text}</option>`; 
        });
        el.countrySelect.innerHTML = html;
        initCustomSelect("countrySelect");
    }
    function readFromUrl() {
        const sp = new URL(window.location.href).searchParams;
        if(sp.has("q")) state.q = sp.get("q");
        if(sp.has("sort")) state.sort = normalizeSortMode(sp.get("sort"));
        else if(sp.has("q") && state.sort === "name_asc") state.sort = "relevance";
        if(sp.has("country")) state.country = sp.get("country");
        if(sp.has("region")) state.region = sp.get("region");
        if(sp.has("city")) state.city = sp.get("city");
        if(sp.has("study_level")) state.study_level = sp.get("study_level");
        if(sp.has("min_tuition")) {
            const raw = Number(sp.get("min_tuition"));
            if (Number.isFinite(raw)) {
                const inPref = currentCurrency === "USD" ? raw : convert(raw, "USD", currentCurrency);
                const stepped = Math.round(inPref / currentLimits.step) * currentLimits.step;
                state.min_tuition = clampTuition(stepped, state.min_tuition);
            }
        }
        if(sp.has("max_tuition")) {
            const raw = Number(sp.get("max_tuition"));
            if (Number.isFinite(raw)) {
                const inPref = currentCurrency === "USD" ? raw : convert(raw, "USD", currentCurrency);
                const stepped = Math.round(inPref / currentLimits.step) * currentLimits.step;
                state.max_tuition = clampTuition(stepped, state.max_tuition);
            }
        }
        if (sp.has("only_saved")) state.only_saved = ["1", "true", "yes", "on"].includes(String(sp.get("only_saved") || "").trim().toLowerCase());
        if(sp.has("page")) {
            const page = Number(sp.get("page"));
            if (Number.isFinite(page) && page >= 1) state.page = Math.floor(page);
        }
        if(sp.has("view")) {
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
    }

    async function fetchUniversities(apiParams) {
        const key = apiParams.toString();
        const now = Date.now();
        logTranslationDebug("non-ai request start", {
            query: key,
            reason: "sort is not uni_ai or AI fallback path",
        });
        const cached = universitiesFetchCache.get(key);
        if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
            logTranslationDebug("non-ai request cache hit (frontend memory)", {
                ageMs: now - cached.timestamp,
            });
            return cached.payload;
        }

        if (listFetchController) {
            listFetchController.abort();
        }
        const controller = new AbortController();
        listFetchController = controller;

        let res;
        try {
            res = await fetch(`${API_BASE}/universities?${key}`, { signal: controller.signal });
        } catch (err) {
            if (err?.name === "AbortError") {
                return { items: [], total: 0, __aborted: true };
            }
            throw err;
        } finally {
            if (listFetchController === controller) {
                listFetchController = null;
            }
        }

        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        const payload = {
            items: data.items || [],
            total: data.total || 0,
        };
        logTranslationDebug("non-ai response received", {
            httpStatus: res.status,
            apiItems: payload.items.length,
            total: payload.total,
        });
        if (universitiesFetchCache.size >= 50) {
            const oldestKey = universitiesFetchCache.keys().next().value;
            if (oldestKey !== undefined) universitiesFetchCache.delete(oldestKey);
        }
        universitiesFetchCache.set(key, { payload, timestamp: now });
        return payload;
    }

    async function fetchUniversitiesAiSort(payload) {
        const key = JSON.stringify(payload);
        const now = Date.now();
        const payloadInterests = String(payload?.profile?.interests || "").trim();
        logTranslationDebug("request start", {
            cacheCandidateKeyLength: key.length,
            interestsRawLength: payloadInterests.length,
        });
        if (lastAiFetchKey === key && lastAiFetchPayload && (now - lastAiFetchAt) < CACHE_TTL_MS) {
            logTranslationDebug("request cache hit (frontend memory)", {
                ageMs: now - lastAiFetchAt,
            });
            return lastAiFetchPayload;
        }

        if (aiFetchController) {
            aiFetchController.abort();
        }
        const controller = new AbortController();
        aiFetchController = controller;

        let res;
        try {
            res = await fetch(`${API_BASE}/universities/ai-sort`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
        } catch (err) {
            if (err?.name === "AbortError") {
                return { items: [], total: 0, __aborted: true };
            }
            throw err;
        } finally {
            if (aiFetchController === controller) {
                aiFetchController = null;
            }
        }

        if (!res.ok) throw new Error("AI sort API Error");
        const data = await res.json();
        const parsed = {
            items: data.items || [],
            total: data.total || 0,
            warnings: Array.isArray(data.warnings) ? data.warnings : [],
        };
        const probe = parsed.items[0] || {};
        const match = (probe && typeof probe === "object") ? (probe.matchData || {}) : {};
        logTranslationDebug("response received", {
            httpStatus: res.status,
            apiItems: parsed.items.length,
            apiWarnings: parsed.warnings,
            mlApplied: Boolean(match.mlApplied),
            mlAvailable: Boolean(match.mlAvailable),
            mlUnavailable: Boolean(match.mlUnavailable),
            mlWarning: String(match.mlWarning || ""),
        });
        lastAiFetchKey = key;
        lastAiFetchPayload = parsed;
        lastAiFetchAt = now;
        return parsed;
    }

    function renderFetchedData(data, options = {}) {
        const animateResults = options.animateResults !== false;
        const rawItems = Array.isArray(data.items) ? data.items : [];
        let items = rawItems;
        let total = data.total || 0;
        if (state.only_saved) {
            const savedIds = new Set(Array.from(savedUniversityIds).map((id) => String(id || "").trim()).filter(Boolean));
            const filteredItems = rawItems.filter((item) => savedIds.has(String(item?.id || "").trim()));
            total = filteredItems.length;
            items = state.viewMode === "map"
                ? filteredItems
                : filteredItems.slice((state.page - 1) * state.limit, state.page * state.limit);
        }
        lastRenderedItems = state.only_saved ? rawItems : items;
        const warnings = Array.isArray(data.warnings) ? data.warnings : [];
        const mlUnavailable = warnings.some((w) => String(w || "").toLowerCase().includes("machine learning unavailable"));
        const warningText = (mlUnavailable && state.sort === "uni_ai")
            ? t("universities.state.ml_unavailable", "Interests from your profile are temporarily not affecting sorting.")
            : "";

        updateUnifitWarningBanner(items);

        if (state.viewMode === "list") {
            state.lastCatalogTotal = total;
            if (el.total) el.total.textContent = String(total);
            hasInitialListPaint = true;

            if (!items.length) {
                if (el.list) el.list.innerHTML = "";
                if (el.pagination) el.pagination.innerHTML = "";
                warmMapMode(items);
                renderUniversitiesState({
                    warningText,
                    emptyText: state.only_saved
                        ? t("universities.state.empty_saved", "No favorite universities match these filters.")
                        : t("universities.state.empty", "No universities found."),
                });
                renderCompareTray();
                renderRecentlyViewedBar();
                updateMobileFilterUi();
                scheduleSyncWorkspaceDepth();
                return;
            }
            renderUniversitiesState({ warningText });
            const profile = loadProfileForApi();
            const userBudget = parseFloat(profile.budget);
            el.list.innerHTML = items.map((u, idx) => renderCard(u, userBudget, idx)).join("");
            warmMapMode(items);
            if (animateResults) markMotionEnter(el.list, ".uni-card", { limit: 16, staggerMs: 24 });
            renderPagination(total);
            if (animateResults) markMotionEnter(el.pagination, ".page-btn", { limit: 10, staggerMs: 12 });
            renderCompareTray();
            renderRecentlyViewedBar();
            updateMobileFilterUi();
            scheduleSyncWorkspaceDepth();
            return;
        }

        if (state.viewMode === "map") {
            state.lastCatalogTotal = items.length;
            if (el.total) el.total.textContent = String(items.length);
            updateMapMarkers(items);
            const profile = loadProfileForApi();
            const userBudget = parseFloat(profile.budget);
            if (el.list) el.list.innerHTML = items.map((u, idx) => renderCard(u, userBudget, idx)).join("");
            renderPagination(total);
            viewModesReady = true;
            syncViewModeControls();
            if (animateResults) markMotionEnter(el.mapResults, ".u-map-results-list .uni-card", { limit: 12, staggerMs: 18 });
            renderUniversitiesState({
                warningText,
                emptyText: items.length
                    ? ""
                    : (state.only_saved ? t("universities.state.empty_saved", "No favorite universities match these filters.") : t("universities.state.empty", "No universities found.")),
            });
            renderCompareTray();
            syncCardActionState();
            renderRecentlyViewedBar();
            updateMobileFilterUi();
            scheduleSyncWorkspaceDepth();
        }
    }

    async function fetchAndRender(options = {}) {
        const preserveVisibleResults = options.preserveVisibleResults === true;
        const animateResults = options.animateResults !== false;
        const runSeq = ++fetchRunSeq;
        logTranslationDebug("fetch cycle start", {
            runSeq,
            viewMode: state.viewMode,
            sort: state.sort,
        });
        setUniversitiesLoading(true, { preserveResults: preserveVisibleResults });
        if (!hasInitialListPaint) {
            state.lastCatalogTotal = 0;
            if (el.total) el.total.textContent = "0";
            renderUniversitiesState();
            if (state.viewMode === 'list') el.list.innerHTML = "";
            if (el.pagination) el.pagination.innerHTML = "";
        }
        if (state.viewMode === "map" && !mapInstance) await initMap();

        const urlParams = sectionUrlParams();
        const apiParams = buildParams(true);
        setUrlParams(urlParams);

        try {
        if (state.only_saved && savedUniversityIds.size === 0) {
            renderFetchedData({ items: [], total: 0 }, { animateResults });
            return;
        }
        const isAiSort = (state.sort === "uni_ai");
        if (isAiSort) {
            await resolveAiSortResult({
                canUseFastFallback: state.viewMode === "list" && !hasInitialListPaint && state.page === 1,
                fastFallbackMs: AI_FAST_FALLBACK_MS,
                fetchAi: () => fetchUniversitiesAiSort(buildAiSortPayload()),
                fetchFallback: () => fetchUniversities(buildFallbackListParams(apiParams)),
                isCurrentRun: () => runSeq === fetchRunSeq && state.sort === "uni_ai",
                renderData: (data) => renderFetchedData(data, { animateResults }),
                onAiError: (err, mode) => {
                    const message = mode === "direct"
                        ? "AI sort failed, fallback list is used."
                        : "AI sort request failed, fallback list is kept.";
                    console.warn(message, err);
                },
            });
            return;
        }

        const data = await fetchUniversities(apiParams);
        if (data?.__aborted) return;
        if (runSeq !== fetchRunSeq) return;
        renderFetchedData(data, { animateResults });

        } catch (err) {
        if (runSeq !== fetchRunSeq) return;
        if (err?.name === "AbortError") return;
        console.error(err);
        const classified = classifyError(err);
        if (el.list) {
            const hasExistingCards = (Array.isArray(lastRenderedItems) && lastRenderedItems.length > 0) ||
                                     Boolean(el.list.querySelector(".uni-card"));
            if (hasExistingCards && classified.isOffline) {
                showToast(t("universities.offline_action_warning", "Cannot refresh catalog while offline. Showing cached results."), "warning");
            } else {
                renderErrorScreen({
                    type: classified.type,
                    containerId: "universitiesList",
                    onRetry: () => fetchAndRender()
                });
            }
        } else if (el.state) {
            el.state.textContent = t("universities.state.failed", "Failed to load data.");
        }
        } finally {
        if (runSeq === fetchRunSeq) {
            setUniversitiesLoading(false, { preserveResults: preserveVisibleResults });
            if (!hasRestoredInitialScroll) {
                hasRestoredInitialScroll = true;
                restoreScrollPosition();
            }
            if (firstVisitTourPending) {
                firstVisitTourPending = false;
                window.setTimeout(async () => {
                    await showUniversitiesTour({ startStep: readUniversitiesTourResumeStep() });
                    clearUniversitiesTourResumeStep();
                    markUniversitiesTourSeen();
                    if (shouldShowUniFitWarning()) {
                        await showUniFitWarning();
                    }
                }, 120);
            }
        }
        }
    }

    // --- Render University Catalog Card ---
    function renderCard(u, myBudget, idx = 99, options = {}) {
        const hideMedia = Boolean(options && options.hideMedia);
        const mapVariant = Boolean(options && options.mapVariant);
        const cardIsActive = Boolean(options && options.isActive);
        const id = u.id;
        const name = textOrUnknown(trUniversityName(u), "placeholder.field.university_name", "University name");
        const countryRaw = nested(u, ["location", "country"], "");
        const cityRaw = nested(u, ["location", "city"], "");
        const locHtml = renderLocationMarkup({
            city: trCity(cityRaw),
            country: trCountry(countryRaw),
            flagHtml: countryRaw ? getFlagImg(countryRaw) : "",
            wrapperClass: "uni-loc",
            iconClass: "uni-loc-icon",
            showIcon: false,
            cityClass: "uni-loc-city",
            countryClass: "uni-loc-country",
            fallbackClass: "uni-loc-line",
        });
        const match = u.matchData || {};
        const priceInfo = resolveUniversityCardPrice(u);
        const cost = priceInfo.amount;
        const uniCurrency = priceInfo.currency;

        const statusIndicators = [];
        const addStatusIndicator = (iconName, tone, label, detail = "") => {
            const cleanLabel = String(label || "").trim();
            const cleanDetail = String(detail || "").trim();
            const ariaText = cleanDetail ? `${cleanLabel}: ${cleanDetail}` : cleanLabel;
            const tooltipHtml = cleanDetail
                ? `<strong class="uni-status-tooltip__title">${escapeHtml(cleanLabel)}</strong><span class="uni-status-tooltip__text">${escapeHtml(cleanDetail)}</span>`
                : `<strong class="uni-status-tooltip__title">${escapeHtml(cleanLabel)}</strong>`;
            statusIndicators.push(`
                <span class="uni-status-tooltip">
                    <button class="uni-status-trigger uni-status-trigger--${tone}" type="button" aria-label="${escapeHtmlAttr(ariaText)}" aria-expanded="false">
                        <span aria-hidden="true">${renderInlineIcon(iconName, 16, "uni-status-icon")}</span>
                    </button>
                    <span class="u-tooltip uni-status-tooltip__content" role="tooltip">${tooltipHtml}</span>
                </span>
            `);
        };
        const badgeHints = (match.uiBadgeHints && typeof match.uiBadgeHints === "object") ? match.uiBadgeHints : {};
        const preferenceMismatch = Number(match.preferenceMismatch);
        const grantChance = Number(match.grantChance);
        const generalChance = Number(match.generalChance);
        const selectedChanceType = String(match.selectedChanceType || "").toLowerCase();
        const hintedVibe = String(badgeHints.vibe || "").toLowerCase();
        const hintedFinance = String(badgeHints.finance || "").toLowerCase();
        const hintedRequirements = String(badgeHints.requirements || "").toLowerCase();
        const hintedBudgetAid = String(badgeHints.budgetAid || "").toLowerCase();
        const financePref = Number(state.budget_vs_prestige);
        const inGrantMode = selectedChanceType ? selectedChanceType === "grant" : financePref < 50;
        const inPaidMode = selectedChanceType ? selectedChanceType === "general" : financePref > 50;
        const conditionalCount = Number(match.conditionalRequirements || 0);
        const hasConditionalExamWarning = (badgeHints.showConditionalExamNeeded === true) || (!!match.conditional && conditionalCount > 0);
        const hasVeryHighVibeMatch = hintedVibe === "your_vibe" || (!hintedVibe && Number.isFinite(preferenceMismatch) && preferenceMismatch <= 0.14);
        const hasHighVibeMatch = hintedVibe === "top_match" || (!hintedVibe && Number.isFinite(preferenceMismatch) && preferenceMismatch > 0.14 && preferenceMismatch <= 0.22);
        const likelyGrant = hintedFinance === "likely_grant" || (!hintedFinance && inGrantMode && Number.isFinite(grantChance) && grantChance >= 65);
        const paidAdmission = hintedFinance === "paid_admission" || (!hintedFinance && inPaidMode && Number.isFinite(generalChance) && generalChance >= 45);
        const meetsMinRequirements = hintedRequirements === "requirements_met" || (!hintedRequirements && match.meetMinRequirements === true && !hasConditionalExamWarning);
        const belowRequirements = hintedRequirements === "below_requirements" || (!hintedRequirements && match.meetMinRequirements === false);
        const hasGrant = getGrantsFromCategories(u?.admission_categories).length > 0;
        const aidAny = !!(match.aidAny || match.aidEligible || hasGrant);
        const hasUserBudget = Number.isFinite(Number(myBudget)) && Number(myBudget) > 0;
        const compareCostUSD = priceInfo.amountUSD ?? (cost !== null && uniCurrency ? (uniCurrency === "USD" ? cost : convert(cost, uniCurrency, "USD")) : cost);
        const overBudget = hasUserBudget && Number.isFinite(Number(compareCostUSD)) && Number(compareCostUSD) > Number(myBudget);
        const showOverBudgetAid = hintedBudgetAid === "over_budget_aid" || (!hintedBudgetAid && overBudget && aidAny);
        const showOverBudgetStrict = hintedBudgetAid === "over_budget" || (!hintedBudgetAid && overBudget && !aidAny);
        const showAidAvailable = hintedBudgetAid === "aid_available" || (!hintedBudgetAid && !overBudget && aidAny);

        // Priority 1: warning on missing exam evidence (conditional, not fail)
        if (hasConditionalExamWarning) {
            addStatusIndicator("clipboard-document-list", "warning", t("universities.badge.conditional_exam_needed", "Conditional / Exam Needed"), t("universities.why.conditional_exam_needed", "Some required exam evidence is missing, so this result is conditional."));
        }

        // Priority 2: preference-match group. Only one vibe tag may be shown.
        if (hasVeryHighVibeMatch) {
            addStatusIndicator("sparkles", "match", t("universities.badge.your_vibe", "Your Vibe"), t("universities.why.your_vibe", "This university strongly matches your Focus, Atmosphere, and Location sliders."));
        } else if (hasHighVibeMatch) {
            addStatusIndicator("check-badge", "match", t("universities.badge.top_match", "Good Match"), t("universities.why.top_match", "This university is a good preference match for your current slider setup."));
        }

        // Priority 3: financial route tag from finance slider mode + chance
        if (likelyGrant) {
            addStatusIndicator("banknotes", "grant", t("universities.badge.likely_grant", "Likely Grant"), t("universities.why.likely_grant", "In grant-priority mode, this university has a strong grant admission chance."));
        } else if (paidAdmission) {
            addStatusIndicator("briefcase", "finance", t("universities.badge.paid_admission", "Paid Admission"), t("universities.why.paid_admission", "In willing-to-pay mode, this university has a strong general admission chance."));
        }

        // Status tags: requirements + budget + aid.
        if (belowRequirements) {
            addStatusIndicator("exclamation-triangle", "warning", t("universities.badge.below_requirements", "Below Requirements"));
        } else if (meetsMinRequirements) {
            addStatusIndicator("check-circle", "requirements", t("universities.badge.requirements_met", "Requirements Met"));
        }

        if (showOverBudgetAid) {
            addStatusIndicator("banknotes", "budget", t("universities.badge.over_budget_aid", "Over Budget • Aid Available"));
        } else if (showOverBudgetStrict) {
            addStatusIndicator("banknotes", "budget", t("universities.badge.over_budget", "Over Budget"));
        } else if (showAidAvailable) {
            addStatusIndicator("banknotes", "aid", t("universities.badge.aid_available", "Aid Available"));
        }

        const statusHtml = statusIndicators.slice(0, 4).join("");

        
        // ROI intentionally removed from university cards.

        const logoSrc = uniLogoSrc(id);
        const logoSrcFull = uniLogoSrc(id, { forceFull: true });
        const thumbSrc = uniThumbnailSrc(id);
        const thumbSrcMedium = uniThumbnailSrc(id, { size: "medium" });
        const thumbSrcFull = uniThumbnailSrc(id, { forceFull: true });
        const thumbSrcFullFallback = uniThumbnailSrc(id, { forceFull: true, format: "jpg" });
        const thumbSrcset = `${thumbSrc} 640w, ${thumbSrcMedium} 960w, ${thumbSrcFull} 1600w`;
        const loadingAttr = idx < 4 ? "eager" : "lazy";
        const fetchPriorityAttr = idx < 2 ? "high" : "auto";
        const detailHref = routeUniversityDetail(id);
        const safeName = escapeHtml(name);
        const overlayTitle = String(name || "");
        const rankValue = toFiniteNumber(u?.rank);
        const rankLabel = escapeHtml(translateWord("global_rank", "Global Rank"));
        const costText = moneyOrUnknown(cost, "placeholder.field.cost", "Cost", uniCurrency, { presentation: "summary" });
        const isCompared = isCompareSelectionMode() && compareUniversityIds.has(String(id));
        const detailLabel = escapeHtml(isCompareSelectionMode()
            ? (isCompared ? t("universities.card.compare_selected_short", "Selected") : t("universities.card.compare_short", "Compare"))
            : t("universities.card.view_details", "View details"));
        const rankMeta = (u && typeof u.rank_meta === "object" && u.rank_meta) ? u.rank_meta : {};
        const rankSource = String(rankMeta.source || "").trim();
        const rankStatusRaw = String(rankMeta.status || "").trim().toLowerCase();
        const statusLabel = rankStatusRaw
            ? rankingStatusLabel(rankStatusRaw)
            : translateWord("global_rank", "Global Rank");
        const rankVerifiedAt = String(rankMeta.verified_at || "").trim()
            || unknownFieldText("placeholder.field.verification_date", "Verification date");
        const sourceTooltip = rankSource
            ? tFormat("ranking.source_tooltip", { source: rankSource, status: statusLabel, verified_at: rankVerifiedAt }, `Source: ${rankSource} | Type: ${statusLabel} | Checked: ${rankVerifiedAt}`)
            : "";
        const rankValueText = rankValue !== null && rankValue > 0 ? `#${escapeHtml(String(rankValue))}` : escapeHtml(t("common.na", "N/A"));
        const rankAriaLabel = sourceTooltip
            ? `${rankLabel} ${rankValueText}: ${sourceTooltip}`
            : `${rankLabel} ${rankValueText}`;
        const rankInnerHtml = `
                    <span class="uni-metric-icon" aria-hidden="true">${renderInlineIcon("globe-alt", 14, "uni-metric-svg")}</span>
                    <span class="uni-metric-label">${rankLabel}</span>
                    <span class="uni-metric-value">${rankValueText}</span>
        `;
        const metricsHtml = `
            <div class="uni-metrics" aria-label="${escapeHtml(t("universities.card.metrics", "Key metrics"))}">
                ${sourceTooltip ? `
                <span class="ui-tooltip-wrap uni-metric-tooltip">
                    <button type="button" class="ui-tooltip-trigger uni-metric uni-metric--rank uni-metric-trigger${rankValue !== null && rankValue > 0 ? "" : " uni-metric--missing"}" aria-label="${escapeHtmlAttr(rankAriaLabel)}" aria-expanded="false">
${rankInnerHtml}
                    </button>
                    <span class="ui-tooltip-bubble uni-metric-tooltip__content" role="tooltip">
                        <strong class="ui-tooltip-title">${rankLabel}</strong>
                        <span class="ui-tooltip-text">${escapeHtml(sourceTooltip)}</span>
                    </span>
                </span>
                ` : `
                <span class="uni-metric uni-metric--rank${rankValue !== null && rankValue > 0 ? "" : " uni-metric--missing"}">
${rankInnerHtml}
                </span>
                `}
            </div>
        `;
        const statusClass = statusHtml ? " uni-card--has-status" : " uni-card--compact";
        const hasCost = Number.isFinite(Number(cost));
        const priceParts = splitPriceDisplay(costText);
        const priceHtml = hasCost
            ? `<div class="uni-price${priceParts.secondary ? " uni-price--with-conversion" : ""}">
                <span class="uni-price-line"><span class="uni-price-val">${escapeHtml(priceParts.primary)}</span>${priceParts.secondary ? "" : ` <span class="uni-price-period">${escapeHtml(t("universities.card.per_year", "/ год"))}</span>`}</span>
                ${priceParts.secondary ? `<span class="uni-price-line"><span class="uni-price-val">${escapeHtml(priceParts.secondary)}</span> <span class="uni-price-period">${escapeHtml(t("universities.card.per_year", "/ год"))}</span></span>` : ""}
              </div>`
            : `<div class="uni-price uni-price--unknown"><span class="uni-price-val">${escapeHtml(costText)}</span></div>`;
        const logoImgHtml = `<img src="${logoSrc}" alt="${initials(name)}" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(name))}">`;
        const mediaHtml = hideMedia ? "" : `
            <div class="uni-media">
            <img class="uni-media-img" src="${thumbSrc}" srcset="${escapeHtmlAttr(thumbSrcset)}" sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(thumbSrcFullFallback)}" data-final-src="${escapeHtmlAttr(logoSrcFull)}">
            <div class="uni-logo">${logoImgHtml}</div>
            </div>`;
        const headHtml = hideMedia
            ? `<div class="uni-head"><span class="uni-logo uni-logo--inline">${logoImgHtml}</span><div class="uni-head-copy"><h3 class="uni-title" title="${safeName}">${safeName}</h3>${locHtml}</div></div>`
            : `<h3 class="uni-title" title="${safeName}">${safeName}</h3>${locHtml}`;
        const detailsHtml = mapVariant
            ? `<a class="uni-details" href="${detailHref}"${universityLinkAttrs()}>${detailLabel}<span aria-hidden="true">→</span></a>`
            : `<span class="uni-details">${detailLabel}<span aria-hidden="true">→</span></span>`;
        const overlayHtml = mapVariant
            ? ""
            : `<a class="uni-card-link-overlay" href="${detailHref}"${universityLinkAttrs()} aria-label="${safeName}" title="${escapeHtml(overlayTitle)}"></a>`;
        return `
        <article class="uni-card${statusClass}${isCompared ? " uni-card--compare-selected" : ""}${hideMedia ? " uni-card--no-media" : ""}${mapVariant ? " uni-card--map" : ""}${cardIsActive ? " is-active" : ""}" data-uni-id="${escapeHtmlAttr(id)}" aria-selected="${isCompared ? "true" : "false"}">
            ${mediaHtml}
            ${statusHtml ? `<div class="uni-card-statuses" aria-label="${escapeHtmlAttr(t("universities.card.statuses", "University status"))}">${statusHtml}</div>` : ""}
            <div class="uni-body">
            ${headHtml}
            ${metricsHtml}
            <div class="uni-footer">
                ${priceHtml}
                ${detailsHtml}
            </div>
            </div>
            ${overlayHtml}
        </article>
        `;
    }

    function renderPagination(total) {
        if (!el.pagination) return;
        const totalPages = Math.ceil(total / state.limit);
        if (totalPages <= 1) { el.pagination.innerHTML = ""; return; }
        let html = ""; const p = state.page; const maxVisible = 5;
        const createBtn = (page, content, isActive = false, extraClass = "", isDisabled = false) => {
            const activeClass = isActive ? "page-btn--active" : "";
            const disabledClass = isDisabled ? "page-btn--disabled" : "";
            const classes = ["page-btn", activeClass, disabledClass, extraClass].filter(Boolean).join(" ");
            return `<button type="button" class="${classes}" data-page="${page}"${isActive ? ' aria-current="page"' : ''}${isDisabled ? ' disabled' : ''}>${content}</button>`;
        };
        html += createBtn(1, heroIcon("chevron-double-left", "page-btn__icon", { "stroke-width": 2 }), false, "page-btn--nav page-btn--first", p <= 1);
        html += createBtn(Math.max(1, p - 1), `${heroIcon("chevron-left", "page-btn__icon", { "stroke-width": 2 })}<span class="page-btn__text">${escapeHtml(t("universities.pagination.prev", "Prev"))}</span>`, false, "page-btn--nav page-btn--prev", p <= 1);
        let startPage, endPage;
        if (totalPages <= maxVisible) {
            startPage = 1;
            endPage = totalPages;
        } else {
            const maxPagesBefore = Math.floor(maxVisible / 2);
            const maxPagesAfter = Math.ceil(maxVisible / 2) - 1;
            if (p <= maxPagesBefore + 1) {
                startPage = 1;
                endPage = maxVisible;
            } else if (p + maxPagesAfter >= totalPages) {
                startPage = totalPages - maxVisible + 1;
                endPage = totalPages;
            } else {
                startPage = p - maxPagesBefore;
                endPage = p + maxPagesAfter;
            }
        }
        if (startPage > 1) html += `<span class="page-dots">...</span>`;
        for (let i = startPage; i <= endPage; i++) {
            html += createBtn(i, `<span class="page-btn__text">${i}</span>`, i === p, "page-btn--num");
        }
        if (endPage < totalPages) html += `<span class="page-dots">...</span>`;
        html += createBtn(Math.min(totalPages, p + 1), `<span class="page-btn__text">${escapeHtml(t("universities.pagination.next", "Next"))}</span>${heroIcon("chevron-right", "page-btn__icon", { "stroke-width": 2 })}`, false, "page-btn--nav page-btn--next", p >= totalPages);
        html += createBtn(totalPages, heroIcon("chevron-double-right", "page-btn__icon", { "stroke-width": 2 }), false, "page-btn--nav page-btn--last", p >= totalPages);
        el.pagination.innerHTML = html;
        el.pagination.querySelectorAll("button").forEach(b => {
            b.onclick = () => {
                const newPage = Number(b.dataset.page);
                if (newPage && newPage !== state.page) {
                    state.page = newPage;
                    clearSavedScrollPosition();
                    fetchAndRender();
                    window.scrollTo({top: 0, behavior: 'smooth'});
                }
            };
        });
    }

    syncWorkspaceDepth();
}
