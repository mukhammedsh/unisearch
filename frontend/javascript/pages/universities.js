/* frontend/javascript/pages/universities.js */

import {
  $,
  debounce,
  loadFilters,
  saveFilters,
  setUrlParams,
  escapeHtml,
  escapeHtmlAttr,
  loadProfile,
  loadProfileForApi,
  getExamDisplayName,
  initCustomSelect,
  CITY_OPTIONS_BY_COUNTRY,
  aiName,
  markMotionEnter,
  motionPress,
  replayMotion,
  setupSlidingIndicator,
  safeSessionStorage,
  setManualScrollRestoration,
  showToast,
} from "../utils.js";

import { renderErrorScreen } from "../components.js";
import { classifyError } from "../components/network-status.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import {
  getPreferredCurrency,
  loadRates,
  convert,
  getFilterLimits,
  formatMoney,
} from "../currency.js";
import { isUniversitiesListPath, navigateToAppRoute, routeCompare, routeCompareConfigure, routeProfile, routeUniversityDetail } from "../routes.js";
import {
  readCompareAdmissionChoices,
  writeCompareAdmissionChoices as persistCompareAdmissionChoices,
  resolveAiSortResult,
} from "./universities/compare-helpers.js";
import {
  showUniversitiesTour,
} from "./universities/tour-modals.js";
import { describeActiveFilters, buildEmptyStateModel, renderEmptyStateCard } from "./universities/empty-state.js";
import { buildFilterResetPatch } from "./universities/filter-reset.js";
import {
  translateUniversityName,
  translateProgramName,
} from "../university-translations.js";
import { bindInfoTooltips } from "../tooltip.js";

import {
  cleanDecoratedText,
  renderInlineIcon,
  trCountry,
  trCity,
  trState,
  trUniversityName,
  normalizeSortMode,
  fundingPreferenceToQueryValue,
  SAVED_UNIVERSITIES_KEY,
  COMPARE_UNIVERSITIES_KEY,
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
} from './_shared.js';

import { consumeUniversitiesTourSkipOnce } from "./shared/cache.js";
import {
  describeRankingProfile,
  legendEntries,
} from "./universities/unifit-explanation.js";
import {
  abortUniversitiesApiRequests,
  createUniversitiesApiState,
  fetchUniversitiesAiSort,
  fetchUniversitiesList,
  initTranslationDebugLogger,
} from "./universities/api-client.js";
import {
  renderCatalogPagination,
  renderUniversityCard,
  reviewedCardIndicators,
} from "./universities/card-renderer.js";
import { createRecentlyViewedController } from "./universities/recently-viewed.js";
import { createUniversitiesMapController } from "./universities/map-controller.js";

export { reviewedCardIndicators };
export { universityCardPriceInfo, renderUniversityCardCosts, buildRankSourceTooltip } from "./universities/card-tooltips.js";

let __universitiesProfileUpdatedHandler = null;
let __universitiesLanguageChangedHandler = null;
let __universitiesLanguageVisualPendingHandler = null;
let __universitiesLanguageFinishedHandler = null;
let __universitiesMapCardActionHandler = null;
let __universitiesSettingsChangedHandler = null;
let __universitiesScrollHandler = null;
let __universitiesPagehideHandler = null;
let __universitiesBeforeunloadHandler = null;
let __universitiesCurrencyChangedHandler = null;
let __universitiesRatesUpdatedHandler = null;
let __universitiesMobileFilterKeydownHandler = null;
let __universitiesResizeHandler = null;
let __universitiesResizeObserver = null;
let __universitiesOnlineReconnectHandler = null;
let __universitiesOverflowClickHandler = null;
let __universitiesOverflowKeydownHandler = null;
let __universitiesSearchCleanup = null;
let __universitiesMapController = null;
let __universitiesRecentController = null;
let __universitiesApiState = null;

export function disposeUniversitiesPage() {
    __universitiesSearchCleanup?.();
    __universitiesSearchCleanup = null;
    __universitiesMapController?.dispose();
    __universitiesMapController = null;
    __universitiesRecentController?.dispose();
    __universitiesRecentController = null;
    abortUniversitiesApiRequests(__universitiesApiState);
    __universitiesApiState = null;
    if (__universitiesProfileUpdatedHandler) {
        window.removeEventListener("profileUpdated", __universitiesProfileUpdatedHandler);
        __universitiesProfileUpdatedHandler = null;
    }
    if (__universitiesLanguageChangedHandler) {
        window.removeEventListener("languageChanged", __universitiesLanguageChangedHandler);
        __universitiesLanguageChangedHandler = null;
    }
    if (__universitiesLanguageVisualPendingHandler) {
        window.removeEventListener("languageChangeVisualPending", __universitiesLanguageVisualPendingHandler);
        __universitiesLanguageVisualPendingHandler = null;
    }
    if (__universitiesLanguageFinishedHandler) {
        window.removeEventListener("languageChangeFinished", __universitiesLanguageFinishedHandler);
        __universitiesLanguageFinishedHandler = null;
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
    if (__universitiesCurrencyChangedHandler) {
        window.removeEventListener("currencyChanged", __universitiesCurrencyChangedHandler);
        __universitiesCurrencyChangedHandler = null;
    }
    if (__universitiesRatesUpdatedHandler) {
        window.removeEventListener("currencyRatesUpdated", __universitiesRatesUpdatedHandler);
        __universitiesRatesUpdatedHandler = null;
    }
    if (__universitiesOnlineReconnectHandler) {
        window.removeEventListener("app:online-reconnect", __universitiesOnlineReconnectHandler);
        __universitiesOnlineReconnectHandler = null;
    }
    if (__universitiesMobileFilterKeydownHandler) {
        document.removeEventListener("keydown", __universitiesMobileFilterKeydownHandler);
        __universitiesMobileFilterKeydownHandler = null;
    }
    if (__universitiesResizeHandler) {
        window.removeEventListener("resize", __universitiesResizeHandler);
        __universitiesResizeHandler = null;
    }
    if (__universitiesResizeObserver) {
        __universitiesResizeObserver.disconnect();
        __universitiesResizeObserver = null;
    }
    if (__universitiesOverflowClickHandler) {
        document.removeEventListener("click", __universitiesOverflowClickHandler);
        __universitiesOverflowClickHandler = null;
    }
    if (__universitiesOverflowKeydownHandler) {
        document.removeEventListener("keydown", __universitiesOverflowKeydownHandler);
        __universitiesOverflowKeydownHandler = null;
    }
    document.documentElement.classList.remove("sidebar-filters-open");
    document.body.classList.remove("sidebar-filters-open");
    document.querySelectorAll("[data-sidebar-inert='1']").forEach((node) => {
        node.inert = false;
        delete node.dataset.sidebarInert;
    });
}

function collectUniversitiesElements() {
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
        unifitBannerTitle: $("unifitBannerTitle"),
        unifitBannerEdit: $("unifitBannerEdit"),
        unifitLegend: $("unifitLegend"),
        unifitWarningDismiss: $("dismissUnifitWarningBanner"),
        compareTray: $("compareTray"),
    };
    if (!el.compareTray) {
        const tray = document.createElement("div");
        tray.id = "compareTray";
        tray.className = "compare-tray";
        tray.setAttribute("aria-live", "polite");
        tray.hidden = true;
        const main = document.querySelector("main");
        if (main?.parentNode) main.parentNode.insertBefore(tray, main.nextSibling);
        else document.body.appendChild(tray);
        el.compareTray = tray;
    }
    return el;
}

function getProfileFundingQueryValue() {
    const profile = loadProfile();
    return fundingPreferenceToQueryValue(profile?.fundingType || profile?.funding_type || "any");
}

function hasProfileEvidence(profile) {
    const exams = Array.isArray(profile?.exams) ? profile.exams : [];
    const langs = Array.isArray(profile?.languages) ? profile.languages : [];
    return exams.length > 0 || langs.length > 0;
}

function setupStatusOverflowHandlers() {
    const closeAllStatusOverflows = () => {
        document.querySelectorAll(".uni-status-overflow.is-open").forEach((wrap) => {
            wrap.classList.remove("is-open");
            const trigger = wrap.querySelector(".uni-status-overflow-trigger");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
            const popover = wrap.querySelector(".uni-status-overflow-popover");
            if (popover) popover.hidden = true;
        });
    };

    __universitiesOverflowClickHandler = (evt) => {
        const target = evt.target instanceof Element ? evt.target : null;
        if (!target) return;

        const trigger = target.closest(".uni-status-overflow-trigger");
        if (trigger) {
            evt.preventDefault();
            evt.stopPropagation();
            const wrap = trigger.closest(".uni-status-overflow");
            if (!wrap) return;
            const popover = wrap.querySelector(".uni-status-overflow-popover");
            const isCurrentlyOpen = wrap.classList.contains("is-open");

            closeAllStatusOverflows();

            if (!isCurrentlyOpen) {
                wrap.classList.add("is-open");
                trigger.setAttribute("aria-expanded", "true");
                if (popover) popover.hidden = false;
            }
            return;
        }

        if (!target.closest(".uni-status-overflow")) {
            closeAllStatusOverflows();
        }
    };
    document.addEventListener("click", __universitiesOverflowClickHandler);

    __universitiesOverflowKeydownHandler = (evt) => {
        if (evt.key === "Escape") {
            const openWrap = document.querySelector(".uni-status-overflow.is-open");
            if (openWrap) {
                evt.preventDefault();
                const trigger = openWrap.querySelector(".uni-status-overflow-trigger");
                closeAllStatusOverflows();
                if (trigger && typeof trigger.focus === "function") {
                    trigger.focus();
                }
            }
        }
    };
    document.addEventListener("keydown", __universitiesOverflowKeydownHandler);
}

export function initUniversitiesPage() {
    const prefCurrency = getPreferredCurrency();
    let currentCurrency = prefCurrency;
    let currentLimits = getFilterLimits(prefCurrency);
    const COMPARE_PAIR_SIZE = MAX_COMPARE_UNIVERSITIES;
    const UNIVERSITIES_SCROLL_KEY = "unisearch_universities_scroll";

    setManualScrollRestoration();

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
        const targetY = rawY !== null ? Math.max(0, Number.parseInt(rawY, 10) || 0) : 0;
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

    const el = collectUniversitiesElements();
    const logTranslationDebug = initTranslationDebugLogger();

    if (!el.list) return;
    disposeUniversitiesPage();
    let catalogDisposed = false;
    const isCurrentCatalog = () => !catalogDisposed && el.list.isConnected && isUniversitiesListPath(window.location.pathname);

    bindInfoTooltips({ wrapSelector: ".u-info-wrap", buttonSelector: ".u-info" });
    bindInfoTooltips({ wrapSelector: ".uni-status-tooltip", buttonSelector: ".uni-status-trigger" });
    bindInfoTooltips({ wrapSelector: ".uni-metric-tooltip", buttonSelector: ".uni-metric-trigger" });

    setupStatusOverflowHandlers();

    let unifitWarningBannerDismissed = false;

    el.unifitWarningDismiss?.addEventListener("click", () => {
        unifitWarningBannerDismissed = true;
        if (el.unifitWarningBanner) {
            el.unifitWarningBanner.hidden = true;
        }
    });

    const updateUnifitWarningBanner = () => {
        if (!el.unifitWarningBanner) return;
        if (state.sort !== "uni_ai") {
            el.unifitWarningBanner.hidden = true;
            return;
        }
        if (unifitWarningBannerDismissed) {
            el.unifitWarningBanner.hidden = true;
            return;
        }
        // The banner states which profile answers the ranking uses, so the list never looks unexplained.
        const profile = loadProfile();
        const parts = describeRankingProfile(profile, {
            t, tFormat, formatMoney, majorLabel: (major) => translateProgramName(major, major),
            examName: (id) => getExamDisplayName(id, { locale: getCurrentLanguage() }),
        });
        const hasEvidence = hasProfileEvidence(profile);
        if (el.unifitBannerTitle) {
            el.unifitBannerTitle.textContent = parts.length
                ? tFormat("universities.ux2.banner.ranked", { values: parts.join(" · ") })
                : t(hasEvidence ? "universities.ux2.banner.scores_only" : "universities.ux2.banner.generic");
        }
        if (el.unifitBannerEdit) {
            el.unifitBannerEdit.textContent = t(parts.length || hasEvidence ? "universities.ux2.banner.edit" : "universities.ux2.banner.set_up");
            el.unifitBannerEdit.setAttribute("href", routeProfile());
        }
        el.unifitWarningBanner.hidden = false;
        refreshUnifitLegend();
    };

    // Legend of the icon badges that are on the rendered cards, drawn with the same icons and tones as the badges,
    // so a first-time visitor learns the mapping once. Called after the banner updates and after each card render.
    const refreshUnifitLegend = () => {
        const box = el.unifitLegend;
        if (!box) return;
        const scope = state.viewMode === "map" ? el.mapResults : el.list;
        const badges = state.sort === "uni_ai" && scope
            ? Array.from(scope.querySelectorAll(".uni-card:not(.is-skeleton) .uni-status-trigger[data-legend]"))
                .map((node) => ({ key: node.dataset.legend, icon: node.dataset.legendIcon, tone: node.dataset.legendTone }))
            : [];
        const entries = legendEntries(badges);
        box.hidden = !entries.length;
        box.innerHTML = entries.length
            ? `<span class="u-unifit-legend__lead">${escapeHtml(t("universities.ux2.legend.lead"))}</span>${entries.map(({ icon, tone, labelKey }) =>
                `<span class="u-unifit-legend__item"><span class="uni-status-trigger uni-status-trigger--${escapeHtmlAttr(tone)}" aria-hidden="true">${renderInlineIcon(icon, 16, "uni-status-icon")}</span><span class="u-unifit-legend__label">${escapeHtml(t(labelKey))}</span></span>`).join("")}`
            : "";
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
        } catch {
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
    const apiState = createUniversitiesApiState({ cacheTtlMs: CACHE_TTL_MS });
    __universitiesApiState = apiState;
    let fetchRunSeq = 0;
    let firstVisitTourPending = !hasSeenUniversitiesTour();
    if (consumeUniversitiesTourSkipOnce()) {
        // Arrived through "Save and show matches": the visitor already did the tour's main step.
        firstVisitTourPending = false;
        markUniversitiesTourSeen();
    }
    let hasInitialListPaint = false;
    let hasRestoredInitialScroll = false;
    let lastRenderedItems = [];
    let viewModesReady = false;
    const savedUniversityIds = new Set(readIdListStorage(SAVED_UNIVERSITIES_KEY));
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

    const clearLanguageCardSkeletons = () => {
        if (!el.list) return;
        el.list.querySelectorAll(".uni-card.is-language-refreshing").forEach((card) => {
            card.classList.remove("is-language-refreshing");
            card.removeAttribute("aria-busy");
            card.querySelector(".u-language-text-skeleton")?.remove();
        });
    };

    const showLanguageCardSkeletons = () => {
        if (!el.list || state.viewMode !== "list") return;
        el.list.querySelectorAll(".uni-card:not(.is-skeleton)").forEach((card) => {
            const body = card.querySelector(".uni-body");
            if (!body || body.querySelector(".u-language-text-skeleton")) return;
            card.classList.add("is-language-refreshing");
            card.setAttribute("aria-busy", "true");
            body.insertAdjacentHTML("beforeend", `
                <div class="u-language-text-skeleton" aria-hidden="true">
                    <span class="skeleton-line u-skeleton-title"></span>
                    <span class="skeleton-line u-skeleton-title u-skeleton-title--short"></span>
                    <span class="skeleton-line u-skeleton-location"></span>
                    <span class="skeleton-line u-language-text-skeleton__metric"></span>
                    <span class="skeleton-line u-language-text-skeleton__footer"></span>
                </div>
            `);
        });
    };

    const syncViewModeControls = () => {
        const isMap = state.viewMode === "map";
        if (el.btnList) {
            el.btnList.disabled = !viewModesReady;
            el.btnList.classList.toggle("active", !isMap);
            el.btnList.setAttribute("aria-pressed", !isMap ? "true" : "false");
        }
        if (el.btnMap) {
            el.btnMap.disabled = !viewModesReady;
            el.btnMap.classList.toggle("active", isMap);
            el.btnMap.setAttribute("aria-pressed", isMap ? "true" : "false");
        }
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
        if (!isCurrentCatalog()) return;
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

    const syncSectionVisibility = async ({
        shouldFetch = false,
        updateUrl = true,
        replaceUrl = true,
        fetchOptions = {},
    } = {}) => {
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
        updateUnifitWarningBanner();
        if (updateUrl) setSectionUrl(replaceUrl);

        await switchView(state.viewMode || "list", false);
        if (shouldFetch) await fetchAndRender(fetchOptions);
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
    // A pair is compared only within one data group: universities with rechecked (reviewed) admissions data, or
    // universities in the earlier format. The group of an id comes from its catalog row or cached detail; an unknown
    // group never blocks a choice here, and the comparison page itself explains a mixed pair.
    const compareGroupById = new Map();
    let compareTrayNotice = "";
    const compareGroupOf = (id) => {
        const cleanId = String(id || "").trim();
        const known = compareGroupById.get(cleanId);
        if (known) return known;
        const row = getRenderedUniversityById(cleanId)
            || [getCurrentLanguage(), "eng", "ru"].map((lang) => getDetailCacheEntry(cleanId, lang)?.data).find(Boolean);
        const availability = row?.admissions_catalog?.availability;
        if (!availability) return "";
        const group = availability === "reviewed" ? "reviewed" : "legacy";
        compareGroupById.set(cleanId, group);
        return group;
    };
    const comparePairGroups = () => new Set(comparePairIds().map(compareGroupOf).filter(Boolean));
    const isComparePairMixed = () => comparePairGroups().size > 1;
    const isComparePairReady = () => comparePairIds().length >= 2 && !isComparePairMixed();

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
            el.compareTray.replaceChildren();
            return;
        }
        el.compareTray.hidden = false;
        el.compareTray.classList.toggle("is-ready", isComparePairReady());
        const canCompare = isComparePairReady();
        const notice = isComparePairMixed() ? t("universities.compare.tray_mixed") : compareTrayNotice;
        const chipsHtml = ids.map((id) => {
            const name = getUniversityDisplayNameById(id);
            const removeLabel = t("universities.compare.remove", "Remove from comparison");
            return `
                <div class="compare-tray__chip" role="listitem">
                    <span class="compare-tray__chip-name" title="${escapeHtmlAttr(name)}">${escapeHtml(name)}</span>
                    <button class="compare-tray__chip-remove" type="button" data-action="remove-compare-slot" data-uni-id="${escapeHtmlAttr(id)}" title="${escapeHtmlAttr(removeLabel)}" aria-label="${escapeHtmlAttr(removeLabel)}">
                        ${renderInlineIcon("x-mark", 12)}
                    </button>
                </div>
            `;
        }).join("");
        el.compareTray.classList.toggle("has-note", Boolean(notice));
        el.compareTray.innerHTML = `
            ${notice ? `<p class="compare-tray__note" role="status">${escapeHtml(notice)}</p>` : ""}
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
        const pairGroups = showCompareSelection ? comparePairGroups() : new Set();
        const pairGroup = pairGroups.size === 1 ? [...pairGroups][0] : "";
        document.querySelectorAll(".uni-card[data-uni-id]").forEach((card) => {
            const rowId = String(card.getAttribute("data-uni-id") || "").trim();
            const saved = savedUniversityIds.has(rowId);
            const compared = showCompareSelection && compareUniversityIds.has(rowId);
            const rowGroup = pairGroup && !compared ? compareGroupOf(rowId) : "";
            const otherGroup = Boolean(rowGroup && rowGroup !== pairGroup);
            const saveBtn = card.querySelector("[data-card-action='save']");
            const compareBtn = card.querySelector("[data-card-action='compare']");
            card.classList.toggle("uni-card--compare-selected", compared);
            card.classList.toggle("uni-card--compare-unavailable", otherGroup);
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
                        : otherGroup ? t("universities.card.compare_other_group") : t("universities.card.compare_short", "Compare"))
                    : t("universities.card.view_details", "View details");
                details.innerHTML = otherGroup ? escapeHtml(label) : `${escapeHtml(label)}<span aria-hidden="true">→</span>`;
                if (otherGroup) details.setAttribute("title", t("universities.card.compare_other_group_title"));
                else details.removeAttribute("title");
            }
            if (compareBtn) {
                const label = compared
                    ? t("universities.card.compare_selected", "Selected for comparison")
                    : otherGroup ? t("universities.card.compare_other_group_title") : t("universities.card.compare", "Add to compare");
                compareBtn.classList.toggle("is-active", compared);
                compareBtn.setAttribute("aria-pressed", compared ? "true" : "false");
                if (otherGroup) compareBtn.setAttribute("aria-disabled", "true");
                else compareBtn.removeAttribute("aria-disabled");
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
        const pairGroups = comparePairGroups();
        const group = compareGroupOf(cleanId);
        if (!wasCompared && group && pairGroups.size === 1 && !pairGroups.has(group)) {
            // The other data group cannot join this pair; the tray says why instead of silently replacing a choice.
            compareTrayNotice = tFormat(`universities.compare.tray_blocked_${group}`, { university: getUniversityDisplayNameById(cleanId) });
            renderCompareTray();
            return true;
        }
        compareTrayNotice = "";
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
        if (ids.length !== COMPARE_PAIR_SIZE || isComparePairMixed()) return;
        // Rechecked universities open their one-stage comparison; earlier-format pairs choose admission options first.
        const reviewedPair = ids.every((id) => compareGroupOf(id) === "reviewed");
        navigateToAppRoute(reviewedPair ? routeCompare(ids) : routeCompareConfigure(ids));
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

    const recentController = createRecentlyViewedController({
        container: el.recentlyViewedBar,
        getUniversityDisplayNameById,
        universityLinkAttrs,
        scheduleSyncWorkspaceDepth: () => scheduleSyncWorkspaceDepth(),
    });
    __universitiesRecentController = recentController;
    const renderRecentlyViewedBar = (options) => recentController.render(options);

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

        let leftColHeight = 0;
        if (filterCard) {
            leftColHeight += filterCard.offsetHeight;
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

        // Independent panels invariant: sidebar geometry must never depend on
        // the live scroll position. Derive the height from offsets that do not
        // change while scrolling: the sticky `top` and the layout's document
        // offset (where the unscrolled sidebar starts). Using the larger of the
        // two keeps the panel's bottom inside the viewport before the page is
        // scrolled, so the end of the filters is never hidden below the fold.
        const computedTop = Number.parseFloat(window.getComputedStyle(sidebar).top) || 90;
        const layoutTop = el.workspaceLayout
            ? el.workspaceLayout.getBoundingClientRect().top + window.scrollY
            : 0;
        const startTop = Math.max(computedTop, layoutTop);
        const bottomGap = 16;
        const availableHeight = Math.max(200, Math.floor(window.innerHeight - startTop - bottomGap));
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
            node.replaceChildren();
            node.classList.remove("is-open");
        }
    };

    /** Visible text of the selected option of a filter dropdown, or the raw value when it is not listed. */
    function selectedFilterOptionLabel(field, value) {
        const selectId = { country: "countrySelect", region: "stateSelect", city: "citySelect", study_level: "studyLevelSelect" }[field];
        const option = Array.from($(selectId)?.options || []).find((item) => item.value === value);
        return String(option?.textContent || value || "").trim();
    }

    /** Empty-result card that names the filters hiding results and offers a way out. */
    function buildCatalogEmptyState() {
        const summary = describeActiveFilters(state, currentLimits, {
            currency: currentCurrency || getPreferredCurrency(),
            formatMoney,
            optionLabel: selectedFilterOptionLabel,
        });
        return renderEmptyStateCard(buildEmptyStateModel({ onlySaved: state.only_saved, summary }), { keepSaved: state.only_saved });
    }

    function renderUniversitiesState(options = {}) {
        if (!el.state) return;
        const warningText = String(options.warningText || "").trim();
        const emptyText = String(options.emptyText || "").trim();
        const emptyHtml = String(options.emptyHtml || "").trim();
        const blocks = [];

        if (warningText) {
            blocks.push(`
                <div class="u-state-card u-state-card--warning" role="status">
                    <div class="u-state-card__title">${escapeHtml(t("universities.state.warning_title", "Interests unavailable"))}</div>
                    <div class="u-state-card__text">${escapeHtml(warningText)}</div>
                </div>
            `.trim());
        }

        if (emptyHtml) {
            blocks.push(emptyHtml);
        } else if (emptyText) {
            blocks.push(`
                <div class="u-state-card u-state-card--empty" role="status">
                    <div class="u-state-card__title">${escapeHtml(t("universities.state.empty_title", "No results for current filters"))}</div>
                    <div class="u-state-card__text">${escapeHtml(emptyText)}</div>
                </div>
            `.trim());
        }

        if (!blocks.length) {
            el.state.replaceChildren();
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
    function applySliderBounds(limits) {
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
        // At the right edge the filter has no upper limit, so pricier universities still match.
        const openEnded = maxVal >= currentLimits.max;
        if (el.minCostLabel) el.minCostLabel.textContent = formattedMin;
        if (el.maxCostLabel) el.maxCostLabel.textContent = openEnded ? `${formattedMax}+` : formattedMax;
        if (el.minSlider) el.minSlider.setAttribute("aria-valuetext", formattedMin);
        if (el.maxSlider) el.maxSlider.setAttribute("aria-valuetext", openEnded ? tFormat("universities.cost.max_open", { amount: formattedMax }) : formattedMax);
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

        const styles = getComputedStyle(el.track);
        const inactive = styles.getPropertyValue("--slider-track-inactive").trim();
        const active = styles.getPropertyValue("--slider-track-active").trim();
        el.track.style.background = `linear-gradient(to right, ${inactive} 0%, ${inactive} ${pos1}, ${active} ${pos1}, ${active} ${pos2}, ${inactive} ${pos2}, ${inactive} 100%)`;
    }
    function slideMin() {
        const gap = currentLimits.step;
        let minVal = Number.parseInt(el.minSlider.value, 10) || 0;
        const maxVal = Number.parseInt(el.maxSlider.value, 10) || currentLimits.max;
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
        const minVal = Number.parseInt(el.minSlider.value, 10) || 0;
        let maxVal = Number.parseInt(el.maxSlider.value, 10) || currentLimits.max;
        if (maxVal - minVal < gap) {
            maxVal = Math.min(currentLimits.max, minVal + gap);
            el.maxSlider.value = String(maxVal);
        }
        el.maxInput.value = el.maxSlider.value;
        state.max_tuition = Number(el.maxSlider.value);
        fillTrack();
        updateSliderLabels();
    }

    const renderCard = (u, myBudget, idx = 99, options = {}) => renderUniversityCard(u, myBudget, idx, options, {
        costBasis: state.cost_basis,
        priceFilterActive: Number(state.min_tuition) > currentLimits.min || Number(state.max_tuition) < currentLimits.max,
        studyLevel: state.study_level,
        isCompareMode: isCompareSelectionMode(),
        compareUniversityIds,
        linkAttrs: universityLinkAttrs(),
    });
    const fetchUniversities = (apiParams) => fetchUniversitiesList(apiParams, { apiState, logTranslationDebug });
    const fetchAiSort = (payload) => fetchUniversitiesAiSort(payload, { apiState, logTranslationDebug });

    const mapController = createUniversitiesMapController({
        el,
        state,
        apiState,
        savedUniversityIds,
        getFocusUniId: () => focusUniId,
        isFocusUniDone: () => focusUniDone,
        setFocusUniDone: (done) => { focusUniDone = done; },
        getLastRenderedItems: () => lastRenderedItems,
        setLastRenderedItems: (items) => { lastRenderedItems = items; },
        setViewModesReady: (ready) => { viewModesReady = ready; },
        syncViewModeControls,
        scheduleSyncWorkspaceDepth,
        refreshUnifitLegend,
        updateUnifitWarningBanner,
        renderCompareTray,
        syncCardActionState,
        renderRecentlyViewedBar,
        updateMobileFilterUi,
        isCompareSelectionMode,
        toggleCompareUniversity,
        openUniversityDetail,
        universityLinkAttrs,
        renderCard,
        buildParams: (forApi) => buildParams(forApi),
        buildAiSortPayload: () => buildAiSortPayload(),
        fetchUniversities,
        fetchUniversitiesAiSort: fetchAiSort,
        fetchAndRender: (options) => fetchAndRender(options),
    });
    __universitiesMapController = mapController;
    const {
        switchView,
        initMap,
        warmMapMode,
        loadNextMapResults,
        refreshMapPoints,
        updateMapMarkers,
    } = mapController;

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

    applySliderBounds(currentLimits);
    applyToForm();
    updateSliderVisibility();
    syncSidebarMaxHeight();
    
    loadRates().then(() => {
        const pref = getPreferredCurrency();
        if (pref === currentCurrency) {
            const freshLimits = getFilterLimits(pref);
            currentLimits = freshLimits;
            applySliderBounds(freshLimits);
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
            Object.assign(state, buildFilterResetPatch(state, {
                fundingType: getProfileFundingQueryValue(),
                limits: currentLimits,
                onlySaved: false,
            }));
            applyToForm();
            if (el.stateDiv) el.stateDiv.style.display = "none";
            updateCityDropdown([]);
            updateSliderVisibility();
            updateMobileFilterUi();
        };

        const setBackgroundInert = (active) => {
            if (!active) {
                document.querySelectorAll("[data-sidebar-inert='1']").forEach((node) => {
                    node.inert = false;
                    delete node.dataset.sidebarInert;
                });
                return;
            }
            let current = sidebar;
            while (current && current.parentElement && current !== document.body) {
                for (const sibling of current.parentElement.children) {
                    if (sibling !== current && sibling.tagName !== "SCRIPT" && sibling.id !== "toast-container") {
                        sibling.inert = true;
                        sibling.dataset.sidebarInert = "1";
                    }
                }
                current = current.parentElement;
            }
        };

        const setOpen = (isOpen, { apply = false } = {}) => {
            if (isOpen && !isMobileViewport()) return;
            const wasOpen = sidebar.classList.contains("is-open");
            if (isOpen) {
                draftSnapshot = { ...state };
                isEditing = true;
            } else if (isEditing && !apply && draftSnapshot) {
                Object.assign(state, draftSnapshot);
                applyToForm();
            }
            sidebar.classList.toggle("is-open", isOpen);
            if (isOpen) {
                sidebar.setAttribute("role", "dialog");
                sidebar.setAttribute("aria-modal", "true");
            } else {
                sidebar.removeAttribute("role");
                sidebar.removeAttribute("aria-modal");
            }
            toggleBtn.classList.toggle("is-active", isOpen);
            toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
            toggleBtn.hidden = isOpen;
            setBackgroundInert(isOpen);
            document.documentElement.classList.toggle("sidebar-filters-open", isOpen);
            if (isOpen) {
                const firstFocusTarget = el.mobileFilterClose || sidebar.querySelector("button, input, select, [tabindex='0']");
                firstFocusTarget?.focus({ preventScroll: true });
            } else {
                isEditing = false;
                draftSnapshot = null;
                updateMobileFilterUi();
                if (wasOpen) {
                    toggleBtn.focus({ preventScroll: true });
                }
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

        return {
            isEditing: () => isEditing,
            closeIfDesktop: () => {
                if (!isMobileViewport() && sidebar.classList.contains("is-open")) {
                    setOpen(false);
                }
            },
        };
    };
    const mobileFilters = setupMobileFilters();

    function handleSortChange(nextSort) {
        if (el.sortSelect) el.sortSelect.value = nextSort;

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
        if (!isCurrentCatalog()) return;
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

    const onCatalogSearchInput = () => {
        if (!isCurrentCatalog()) return;
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
    };
    const onCatalogSearchBlur = () => window.setTimeout(() => { if (isCurrentCatalog()) hideSearchSuggestions(); }, 160);
    const onCatalogSearchClear = () => {
        if (!isCurrentCatalog()) return;
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
    };
    el.qInput?.addEventListener("input", onCatalogSearchInput);
    el.qInput?.addEventListener("blur", onCatalogSearchBlur);
    el.searchClearBtn?.addEventListener("click", onCatalogSearchClear);
    __universitiesSearchCleanup = () => {
        catalogDisposed = true;
        el.qInput?.removeEventListener("input", onCatalogSearchInput);
        el.qInput?.removeEventListener("blur", onCatalogSearchBlur);
        el.searchClearBtn?.removeEventListener("click", onCatalogSearchClear);
    };
    
    el.countrySelect?.addEventListener("change", () => {
        state.country = el.countrySelect.value; state.region = ""; state.city = ""; 
        if(el.stateSelect) el.stateSelect.value = ""; if(el.citySelect) el.citySelect.value = "";
        updateLocationLogic(state.country); refetch();
    });
    
    el.stateSelect?.addEventListener("change", () => { state.region = el.stateSelect.value; state.city = ""; updateCitiesForState(state.country, state.region); refetch(); });
    el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
    
    if ($("studyLevelSelect")) $("studyLevelSelect").addEventListener("change", () => { state.study_level = $("studyLevelSelect").value; refetch(); });
    $("costBasisSelect")?.addEventListener("change", () => { state.cost_basis = $("costBasisSelect").value; refetch(); });

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

    function handleResetAllFilters({ keepSaved = false } = {}) {
        clearSavedScrollPosition();
        Object.assign(state, buildFilterResetPatch(state, {
            fundingType: getProfileFundingQueryValue(),
            limits: currentLimits,
            onlySaved: keepSaved ? state.only_saved : false,
        }));
        saveFilters(state);
        applyToForm();
        if (el.stateDiv) el.stateDiv.style.display = "none"; 
        updateCityDropdown([]); 
        updateSliderVisibility(); 
        updateMobileFilterUi();
        
        fetchAndRender();
    }

    /** Drop only the price range; every other filter stays as the visitor set it. */
    function handleClearPriceFilter() {
        clearSavedScrollPosition();
        Object.assign(state, { min_tuition: currentLimits.min, max_tuition: currentLimits.max, page: 1 });
        saveFilters(state);
        applyToForm();
        fetchAndRender();
    }

    el.resetBtn?.addEventListener("click", () => {
        motionPress(el.resetBtn);
        handleResetAllFilters();
    });

    el.state?.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const clearPriceBtn = target?.closest('[data-action="clear-price-filter"]');
        if (clearPriceBtn) {
            motionPress(clearPriceBtn);
            handleClearPriceFilter();
            return;
        }
        const btn = target?.closest('[data-action="reset-filters"]');
        if (!btn) return;
        motionPress(btn);
        handleResetAllFilters({ keepSaved: btn.hasAttribute("data-keep-saved") });
    });

    el.list.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        if (target.closest(".ui-tooltip-trigger, .ui-tooltip-wrap, .uni-status-trigger, .uni-metric-trigger, .uni-status-overflow")) return;
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
            compareTrayNotice = "";
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
        const maxVal = Number.parseInt(el.maxSlider?.value, 10) || currentLimits.max;
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
        const minVal = Number.parseInt(el.minSlider?.value, 10) || 0;
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
    __universitiesLanguageVisualPendingHandler = showLanguageCardSkeletons;
    window.addEventListener("languageChangeVisualPending", __universitiesLanguageVisualPendingHandler);
    __universitiesLanguageFinishedHandler = clearLanguageCardSkeletons;
    window.addEventListener("languageChangeFinished", __universitiesLanguageFinishedHandler);
    __universitiesLanguageChangedHandler = (event) => {
        const refreshPromise = (async () => {
            applyAISortOptionLabel();
            refreshLocationFilterLabels();
            applyToForm();
            updateTradeoffLabels();
            await syncSectionVisibility({
                shouldFetch: !isCompareResultsMode(),
                updateUrl: true,
                replaceUrl: true,
                fetchOptions: {
                    preserveVisibleResults: true,
                    animateResults: false,
                },
            });
        })();
        event?.detail?.waitUntil?.(refreshPromise);
        refreshPromise.catch((err) => console.error(err));
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

    // Live rates that arrive after the first render redraw the cards and slider bounds; filters stay as they are.
    if (__universitiesRatesUpdatedHandler) {
        window.removeEventListener("currencyRatesUpdated", __universitiesRatesUpdatedHandler);
    }
    __universitiesRatesUpdatedHandler = () => {
        if (typeof fetchAndRender === "function" && !isCompareResultsMode()) fetchAndRender().catch((err) => console.error(err));
    };
    window.addEventListener("currencyRatesUpdated", __universitiesRatesUpdatedHandler);

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
        applySliderBounds(newLimits);

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
        // Independent panels invariant: window scroll must never recompute
        // sidebar geometry (see syncSidebarMaxHeight). Only viewport
        // clearance and scroll persistence are scroll-safe here.
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
        mobileFilters?.closeIfDesktop?.();
        scheduleSyncWorkspaceDepth();
        scheduleSyncSidebarMaxHeight();
        syncMobileFilterFooterClearance();
        // Map stage height follows the viewport, so tell Leaflet to re-fit tiles.
        mapController.scheduleInvalidateSize(150);
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
        if (state.cost_basis === "tuition") p.set("cost_basis", "tuition");
        if (state.study_level) p.set("study_level", state.study_level);
        if (state.funding_type) p.set("funding_type", state.funding_type);

        const isAiSort = (state.sort === "uni_ai");
        if (forApi) p.set("sort", isAiSort ? "name_asc" : state.sort);

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
        payload.cost_basis = state.cost_basis;
        const tuitionParams = getApiTuitionParams();
        if (tuitionParams.min_tuition !== undefined) payload.min_tuition = tuitionParams.min_tuition;
        if (tuitionParams.max_tuition !== undefined) payload.max_tuition = tuitionParams.max_tuition;

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
        if ($("costBasisSelect")) $("costBasisSelect").value = state.cost_basis;
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

        ["countrySelect", "stateSelect", "citySelect", "sortSelect", "studyLevelSelect", "costBasisSelect"].forEach(id => initCustomSelect(id));
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
            const states = Object.keys(countryData).sort((a, b) => a.localeCompare(b));
            el.stateSelect.innerHTML = `<option value="">${escapeHtml(t("universities.any_state", "Any State"))}</option>`;
            states.forEach((s) => {
                const value = String(s || "");
                const label = trState(value);
                el.stateSelect.innerHTML += `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
            });
            initCustomSelect("stateSelect");
            updateCitiesForState(country, "");
        }
    }
    function updateCitiesForState(country, region) {
        if (!country) { updateCityDropdown([]); return; }
        const countryData = CITY_OPTIONS_BY_COUNTRY[country];
        if (Array.isArray(countryData)) { updateCityDropdown(countryData); return; }
        if (countryData && typeof countryData === "object") {
            const cities = region
                ? countryData[region] || []
                : [...new Set(Object.values(countryData).flatMap((items) => Array.isArray(items) ? items : []))];
            updateCityDropdown(cities);
        }
    }
    function updateCityDropdown(cities) {
        if (!el.citySelect) return;
        if (!cities || cities.length === 0) { el.citySelect.innerHTML = `<option value="">${escapeHtml(t("universities.select_country_first", "Select country first"))}</option>`; el.citySelect.disabled = true; } 
        else {
            el.citySelect.disabled = false;
            el.citySelect.innerHTML = `<option value="">${escapeHtml(t("universities.all_cities", "All Cities"))}</option>`;
            cities.toSorted((a, b) => a.localeCompare(b)).forEach((c) => {
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
        const countries = Object.keys(CITY_OPTIONS_BY_COUNTRY).sort((a, b) => a.localeCompare(b));
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
        if(sp.has("cost_basis")) state.cost_basis = sp.get("cost_basis") === "tuition" ? "tuition" : "annual_total";
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

        updateUnifitWarningBanner();

        if (state.viewMode === "list") {
            state.lastCatalogTotal = total;
            if (el.total) el.total.textContent = String(total);
            hasInitialListPaint = true;

            if (!items.length) {
                if (el.list) el.list.replaceChildren();
                if (el.pagination) el.pagination.replaceChildren();
                warmMapMode();
                renderUniversitiesState({
                    warningText,
                    emptyHtml: buildCatalogEmptyState(),
                });
                renderCompareTray();
                renderRecentlyViewedBar();
                updateMobileFilterUi();
                scheduleSyncWorkspaceDepth();
                return;
            }
            renderUniversitiesState({ warningText });
            const profile = loadProfileForApi();
            const userBudget = Number.parseFloat(profile.budget);
            el.list.innerHTML = items.map((u, idx) => renderCard(u, userBudget, idx)).join("");
            refreshUnifitLegend();
            warmMapMode();
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
            const userBudget = Number.parseFloat(profile.budget);
            if (el.list) el.list.innerHTML = items.map((u, idx) => renderCard(u, userBudget, idx)).join("");
            renderPagination(total);
            viewModesReady = true;
            syncViewModeControls();
            if (animateResults) markMotionEnter(el.mapResults, ".u-map-results-list .uni-card", { limit: 12, staggerMs: 18 });
            renderUniversitiesState({
                warningText,
                emptyHtml: items.length ? "" : buildCatalogEmptyState(),
            });
            renderCompareTray();
            syncCardActionState();
            renderRecentlyViewedBar();
            updateMobileFilterUi();
            scheduleSyncWorkspaceDepth();
        }
    }

    async function fetchAndRender(options = {}) {
        if (!isCurrentCatalog()) return;
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
            if (state.viewMode === 'list') el.list.replaceChildren();
            if (el.pagination) el.pagination.replaceChildren();
        }
        if (state.viewMode === "map" && !mapController.hasMapInstance()) await initMap();
        if (!isCurrentCatalog()) return;

        const urlParams = sectionUrlParams();
        const apiParams = buildParams(true);
        setUrlParams(urlParams);

        try {
        if (state.viewMode === "map") {
            mapController.invalidateSize({ pan: false, animate: false });
            if (state.only_saved && savedUniversityIds.size === 0) {
                mapController.resetForEmptySaved();
                return;
            }

            mapController.clearBoundsCache();
            await Promise.all([
                loadNextMapResults({ reset: true, animateResults }),
                refreshMapPoints({ force: true }).catch((error) => {
                    console.warn("Map points failed to load", error);
                    showToast(t("universities.map_panel.points_failed", "Map markers could not be refreshed."), "warning");
                }),
            ]);
            viewModesReady = true;
            syncViewModeControls();
            renderUniversitiesState({
                emptyHtml: mapController.getMapResultsCount() ? "" : buildCatalogEmptyState(),
            });
            return;
        }

        if (state.only_saved && savedUniversityIds.size === 0) {
            renderFetchedData({ items: [], total: 0 }, { animateResults });
            return;
        }
        const isAiSort = (state.sort === "uni_ai");
        if (isAiSort) {
            await resolveAiSortResult({
                canUseFastFallback: state.viewMode === "list" && !hasInitialListPaint && state.page === 1,
                fastFallbackMs: AI_FAST_FALLBACK_MS,
                fetchAi: () => fetchAiSort(buildAiSortPayload()),
                fetchFallback: () => fetchUniversities(buildFallbackListParams(apiParams)),
                isCurrentRun: () => isCurrentCatalog() && runSeq === fetchRunSeq && state.sort === "uni_ai",
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
        if (runSeq !== fetchRunSeq || !isCurrentCatalog()) return;
        renderFetchedData(data, { animateResults });

        } catch (err) {
        if (runSeq !== fetchRunSeq || !isCurrentCatalog()) return;
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
        if (runSeq === fetchRunSeq && isCurrentCatalog()) {
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
                }, 120);
            }
        }
        }
    }

    function renderPagination(total) {
        renderCatalogPagination(el.pagination, {
            total,
            currentPage: state.page,
            pageSize: state.limit,
            onPageChange: (newPage) => {
                state.page = newPage;
                clearSavedScrollPosition();
                void fetchAndRender();
                window.scrollTo({ top: 0, behavior: "smooth" });
            },
        });
    }

    syncWorkspaceDepth();
}
