/* frontend/javascript/pages/universities.js */

import {
    $,
    debounce,
    loadFilters,
    saveFilters,
    setUrlParams,
    escapeHtml,
    escapeHtmlAttr,
    loadProfileForApi,
    CITY_OPTIONS_BY_COUNTRY,
    markMotionEnter,
    motionPress,
    setupSlidingIndicator,
    showToast,
} from "../utils.js";

import { renderErrorScreen } from "../components.js";
import { classifyError } from "../components/network-status.js";
import { hideGlobalSearchSuggestions } from "../components/navbar-search.js";
import { setTextWithFade } from "../utils/motion-reveal.js";
import { t } from "../i18n.js";
import {
    getPreferredCurrency,
    loadRates,
    getFilterLimits,
    formatMoney,
} from "../currency.js";
import { isUniversitiesListPath, navigateToAppRoute, routeCompare } from "../routes.js";
import { resolveAiSortResult } from "./universities/compare-helpers.js";
import { showUniversitiesTour } from "./universities/tour-modals.js";
import { describeActiveFilters, buildEmptyStateModel, renderEmptyStateCard } from "./universities/empty-state.js";
import { bindInfoTooltips } from "../tooltip.js";

import {
    MAX_COMPARE_UNIVERSITIES,
    hasSeenUniversitiesTour,
    clearUniversitiesTourResumeStep,
    markUniversitiesTourSeen,
    readUniversitiesTourResumeStep,
    rememberRecentUniversity,
    shouldOpenUniversitiesInNewTab,
} from "./_shared.js";

import { consumeUniversitiesTourSkipOnce } from "./shared/cache.js";
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
import {
    applyUrlParamsToState,
    buildCatalogAiSortPayload,
    buildCatalogParams,
    buildFallbackListParams,
    buildSectionUrlParams,
    createInitialCatalogState,
    getProfileFundingQueryValue,
    parseCompareIds,
    readPageParams,
} from "./universities/query-state.js";
import { createLayoutSyncController } from "./universities/layout-sync.js";
import { createUnifitBannerController } from "./universities/unifit-banner.js";
import { createCompareController } from "./universities/compare-controller.js";
import { createFilterControls } from "./universities/filter-controls.js";

export { reviewedCardIndicators };
export { universityCardPriceInfo, renderUniversityCardCosts, buildRankSourceTooltip } from "./universities/card-tooltips.js";

let __universitiesWindowBindings = [];
let __universitiesSearchCleanup = null;
let __universitiesLayoutSync = null;
let __universitiesUnifitBanner = null;
let __universitiesCompareController = null;
let __universitiesFilterControls = null;
let __universitiesMapController = null;
let __universitiesRecentController = null;
let __universitiesApiState = null;

function bindWindowListener(eventName, handler) {
    window.addEventListener(eventName, handler);
    __universitiesWindowBindings.push([eventName, handler]);
}

export function disposeUniversitiesPage() {
    __universitiesSearchCleanup?.();
    __universitiesSearchCleanup = null;
    __universitiesLayoutSync?.dispose();
    __universitiesLayoutSync = null;
    __universitiesUnifitBanner?.dispose();
    __universitiesUnifitBanner = null;
    __universitiesCompareController?.dispose();
    __universitiesCompareController = null;
    __universitiesFilterControls?.dispose();
    __universitiesFilterControls = null;
    __universitiesMapController?.dispose();
    __universitiesMapController = null;
    __universitiesRecentController?.dispose();
    __universitiesRecentController = null;
    abortUniversitiesApiRequests(__universitiesApiState);
    __universitiesApiState = null;
    for (const [eventName, handler] of __universitiesWindowBindings) {
        window.removeEventListener(eventName, handler);
    }
    __universitiesWindowBindings = [];
}

function collectUniversitiesElements() {
    const el = {
        qInput: $("qInput"), searchClearBtn: $("searchClearBtn"), countrySelect: $("countrySelect"), stateDiv: $("stateDiv"),
        stateSelect: $("stateSelect"), cityDiv: $("cityDiv"), citySelect: $("citySelect"),
        minInput: $("minCostInput"), maxInput: $("maxCostInput"),
        minSlider: $("minCostSlider"), maxSlider: $("maxCostSlider"), track: $("sliderTrack"),
        minCostLabel: $("minCostLabel"), maxCostLabel: $("maxCostLabel"),
        sortSelect: $("sortSelect"), sliderContainer: $("aiSliderContainer"),
        unifitPrefsPanel: $("unifitPreferencesPanel"), unifitPrefsCount: $("unifitPrefsCount"),
        reviewedOnlyToggle: $("reviewedOnlyToggle"),
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
        unifitBannerPrefsBtn: $("unifitBannerPrefsBtn"),
        unifitLegendDetails: $("unifitLegendDetails"),
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

/** Visible text of the selected option of a filter dropdown, or the raw value when it is not listed. */
function selectedFilterOptionLabel(field, value) {
    const selectId = { country: "countrySelect", region: "stateSelect", city: "citySelect", study_level: "studyLevelSelect" }[field];
    const option = Array.from($(selectId)?.options || []).find((item) => item.value === value);
    return String(option?.textContent || value || "").trim();
}

export function initUniversitiesPage() {
    const prefCurrency = getPreferredCurrency();
    let currentCurrency = prefCurrency;
    let currentLimits = getFilterLimits(prefCurrency);

    const el = collectUniversitiesElements();
    const logTranslationDebug = initTranslationDebugLogger();

    if (!el.list) return;
    disposeUniversitiesPage();

    const pageParams = readPageParams();
    const redirectCompareIds = parseCompareIds(pageParams.get("ids"));
    const initialCompareParam = String(pageParams.get("compare") || "").trim().toLowerCase();
    if (redirectCompareIds.length === MAX_COMPARE_UNIVERSITIES && ["configure", "results"].includes(initialCompareParam)) {
        const choices = String(pageParams.get("choices") || "").split(",").filter(Boolean);
        const stage = (initialCompareParam === "configure" || choices.length === 0) ? "configure" : "results";
        const redirectUrl = routeCompare(redirectCompareIds, choices, stage === "configure" ? { stage: "configure" } : "");
        navigateToAppRoute(redirectUrl, { replace: true });
        return;
    }

    let catalogDisposed = false;
    const isCurrentCatalog = () => !catalogDisposed && el.list.isConnected && isUniversitiesListPath(window.location.pathname);

    bindInfoTooltips({ wrapSelector: ".u-info-wrap", buttonSelector: ".u-info" });
    bindInfoTooltips({ wrapSelector: ".uni-status-tooltip", buttonSelector: ".uni-status-trigger" });
    bindInfoTooltips({ wrapSelector: ".uni-metric-tooltip", buttonSelector: ".uni-metric-trigger" });
    setupSlidingIndicator(".u-saved-filter", ".u-saved-filter__btn", "is-active");

    const { state, defaultSortMode, initialCompareIds } = createInitialCatalogState({
        pageParams,
        savedState: loadFilters(),
        currentCurrency,
        currentLimits,
    });

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

    const syncSavedFilterButtons = () => {
        const mode = state.only_saved ? "favorites" : "all";
        el.savedFilterButtons.forEach((btn) => {
            const active = String(btn.getAttribute("data-saved-filter") || "") === mode;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
    };

    // Shared hide path keeps the items painted while the panel fades out.
    const hideSearchSuggestions = () => hideGlobalSearchSuggestions();

    const syncSearchClearButton = () => {
        if (!el.searchClearBtn) return;
        const hasText = Boolean(String(el.qInput?.value || "").trim().length);
        el.searchClearBtn.hidden = !hasText;
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

    const layoutSync = createLayoutSyncController({
        el,
        state,
        onResize: () => {
            filterControls.closeMobileIfDesktop();
            // Map stage height follows the viewport, so tell Leaflet to re-fit tiles.
            mapController.scheduleInvalidateSize(150);
        },
    });
    __universitiesLayoutSync = layoutSync;

    const unifitBanner = createUnifitBannerController({ el, state });
    __universitiesUnifitBanner = unifitBanner;

    const compareController = createCompareController({
        el,
        state,
        initialCompareIds,
        getLastRenderedItems: () => lastRenderedItems,
        onRenderRecentlyViewed: () => renderRecentlyViewedBar(),
        onHideSearchSuggestions: hideSearchSuggestions,
        onRefetch: () => refetch(),
        onSyncSectionVisibility: (options) => syncSectionVisibility(options),
    });
    __universitiesCompareController = compareController;

    const recentController = createRecentlyViewedController({
        container: el.recentlyViewedBar,
        getUniversityDisplayNameById: compareController.getUniversityDisplayNameById,
        universityLinkAttrs: compareController.universityLinkAttrs,
        scheduleSyncWorkspaceDepth: layoutSync.scheduleSyncWorkspaceDepth,
    });
    __universitiesRecentController = recentController;
    const renderRecentlyViewedBar = (options) => recentController.render(options);

    const scheduleRefetch = debounce(() => {
        if (!isCurrentCatalog()) return;
        state.page = 1;
        layoutSync.clearSavedScrollPosition();
        filterControls.updateMobileFilterUi();
        saveFilters(state);
        fetchAndRender();
    }, 250);

    const refetch = (...args) => {
        if (filterControls.isMobileEditing()) return;
        saveFilters(state);
        scheduleRefetch(...args);
    };

    const filterControls = createFilterControls({
        el,
        state,
        defaultSortMode,
        getCurrentCurrency: () => currentCurrency,
        setCurrentCurrency: (currency) => { currentCurrency = currency; },
        getCurrentLimits: () => currentLimits,
        setCurrentLimits: (limits) => { currentLimits = limits; },
        syncSearchClearButton,
        syncSavedFilterButtons,
        clearSavedScrollPosition: layoutSync.clearSavedScrollPosition,
        refetch,
        fetchAndRender: (options) => fetchAndRender(options),
    });
    __universitiesFilterControls = filterControls;

    const buildParams = (forApi = false) => buildCatalogParams(state, {
        forApi,
        minSlider: el.minSlider,
        maxSlider: el.maxSlider,
        currentCurrency,
        currentLimits,
        focusUniId,
    });

    const sectionUrlParams = () => buildSectionUrlParams(state, {
        minSlider: el.minSlider,
        maxSlider: el.maxSlider,
        currentCurrency,
        currentLimits,
        focusUniId,
    });

    const buildAiSortPayload = () => buildCatalogAiSortPayload(state, {
        minSlider: el.minSlider,
        maxSlider: el.maxSlider,
        currentCurrency,
        currentLimits,
        logTranslationDebug,
    });

    const setSectionUrl = (replace = true) => {
        if (!isCurrentCatalog()) return;
        const url = new URL(window.location.href);
        url.search = sectionUrlParams().toString();
        window.history[replace ? "replaceState" : "pushState"]({}, "", url.toString());
    };

    const syncSectionVisibility = async ({
        shouldFetch = false,
        updateUrl = true,
        replaceUrl = true,
        fetchOptions = {},
    } = {}) => {
        if (el.workspaceLayout) el.workspaceLayout.hidden = false;
        if (el.catalogPane) el.catalogPane.hidden = false;
        document.body.classList.toggle("universities-compare-mode", compareController.isCompareSelectionMode());
        if (el.viewToggles) el.viewToggles.hidden = false;
        if (el.total) {
            el.total.textContent = String(state.lastCatalogTotal ?? el.total.textContent ?? "0");
        }
        syncHeaderSearchContext();
        compareController.syncCompareModeControls();
        compareController.renderCompareTray();
        unifitBanner.update();
        if (updateUrl) setSectionUrl(replaceUrl);

        await switchView(state.viewMode || "list", false);
        if (shouldFetch) await fetchAndRender(fetchOptions);
    };

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
                                        <span class="skeleton-line u-map-skeleton-title"></span>
                                        <span class="skeleton-line u-map-skeleton-subtitle"></span>
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
            el.mapStage.classList.toggle("is-loading", Boolean(isLoading) && mapMode && !preserveResults);
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

    const renderCard = (u, myBudget, idx = 99, options = {}) => renderUniversityCard(u, myBudget, idx, options, {
        costBasis: state.cost_basis,
        priceFilterActive: Number(state.min_tuition) > currentLimits.min || Number(state.max_tuition) < currentLimits.max,
        studyLevel: state.study_level,
        isCompareMode: compareController.isCompareSelectionMode(),
        compareUniversityIds: compareController.getCompareUniversityIds(),
        linkAttrs: compareController.universityLinkAttrs(),
    });
    const fetchUniversities = (apiParams, extra = {}) => fetchUniversitiesList(apiParams, { apiState, logTranslationDebug, ...extra });
    const fetchAiSort = (payload, extra = {}) => fetchUniversitiesAiSort(payload, { apiState, logTranslationDebug, ...extra });

    const mapController = createUniversitiesMapController({
        el,
        state,
        apiState,
        savedUniversityIds: compareController.getSavedUniversityIds(),
        getFocusUniId: () => focusUniId,
        isFocusUniDone: () => focusUniDone,
        setFocusUniDone: (done) => { focusUniDone = done; },
        getLastRenderedItems: () => lastRenderedItems,
        setLastRenderedItems: (items) => { lastRenderedItems = items; },
        setViewModesReady: (ready) => { viewModesReady = ready; },
        syncViewModeControls,
        scheduleSyncWorkspaceDepth: layoutSync.scheduleSyncWorkspaceDepth,
        refreshUnifitLegend: unifitBanner.refreshLegend,
        updateUnifitWarningBanner: unifitBanner.update,
        renderCompareTray: compareController.renderCompareTray,
        syncCardActionState: compareController.syncCardActionState,
        renderRecentlyViewedBar,
        updateMobileFilterUi: filterControls.updateMobileFilterUi,
        isCompareSelectionMode: compareController.isCompareSelectionMode,
        toggleCompareUniversity: compareController.toggleCompareUniversity,
        openUniversityDetail: compareController.openUniversityDetail,
        universityLinkAttrs: compareController.universityLinkAttrs,
        renderCard,
        buildParams,
        buildAiSortPayload,
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

    ({ focusUniId } = applyUrlParamsToState(state, { currentCurrency, currentLimits }));

    if (Object.keys(CITY_OPTIONS_BY_COUNTRY).length > 0) {
        filterControls.initLocations();
    }

    unifitBanner.bindEvents();
    compareController.bindEvents();
    filterControls.bindEvents();
    layoutSync.bindEvents();

    filterControls.applySliderBounds(currentLimits);
    filterControls.applyToForm();
    filterControls.updateSliderVisibility();
    layoutSync.syncSidebarMaxHeight();

    loadRates().then(() => {
        const pref = getPreferredCurrency();
        if (pref === currentCurrency) {
            const freshLimits = getFilterLimits(pref);
            currentLimits = freshLimits;
            filterControls.applySliderBounds(freshLimits);
            filterControls.fillTrack();
            filterControls.updateSliderLabels();
        }
    }).catch(() => {});

    switchView(state.viewMode, false).catch((err) => console.error(err));

    const onCatalogSearchInput = () => {
        if (!isCurrentCatalog()) return;
        const prevQ = state.q;
        state.q = el.qInput.value.trim();
        syncSearchClearButton();
        hideSearchSuggestions();
        if (!prevQ && state.q) {
            if (state.sort === "name_asc") state.sort = "relevance";
            filterControls.syncRelevanceSortOption();
        } else if (prevQ && !state.q) {
            if (state.sort === "relevance") state.sort = "name_asc";
            filterControls.syncRelevanceSortOption();
        }
        if (state.activeTab !== "catalog" && !compareController.isCompareSelectionMode()) return;
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
        }
        filterControls.syncRelevanceSortOption();
        if (state.activeTab !== "catalog" && !compareController.isCompareSelectionMode()) return;
        refetch();
    };
    el.qInput?.addEventListener("input", onCatalogSearchInput);
    el.qInput?.addEventListener("blur", onCatalogSearchBlur);
    el.searchClearBtn?.addEventListener("click", onCatalogSearchClear);
    __universitiesSearchCleanup = () => {
        catalogDisposed = true;
        if (skeletonShowTimer) {
            clearTimeout(skeletonShowTimer);
            skeletonShowTimer = 0;
        }
        if (skeletonFadeTimer) {
            clearTimeout(skeletonFadeTimer);
            skeletonFadeTimer = 0;
        }
        el.qInput?.removeEventListener("input", onCatalogSearchInput);
        el.qInput?.removeEventListener("blur", onCatalogSearchBlur);
        el.searchClearBtn?.removeEventListener("click", onCatalogSearchClear);
    };

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
        const nextSort = el.sortSelect.value;
        el.sortSelect.value = nextSort;
        state.sort = nextSort;
        if (state.sort !== "uni_ai") {
            unifitBanner.resetDismissed();
        }
        filterControls.updateSliderVisibility();
        filterControls.updateMobileFilterUi();
        refetch();
    });

    el.state?.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const clearPriceBtn = target?.closest('[data-action="clear-price-filter"]');
        if (clearPriceBtn) {
            motionPress(clearPriceBtn);
            filterControls.handleClearPriceFilter();
            return;
        }
        const btn = target?.closest('[data-action="reset-filters"]');
        if (!btn) return;
        motionPress(btn);
        filterControls.handleResetAllFilters({ keepSaved: btn.hasAttribute("data-keep-saved") });
    });

    el.list.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        if (target.closest(".ui-tooltip-trigger, .ui-tooltip-wrap, .uni-status-trigger, .uni-metric-trigger, .uni-status-overflow")) return;
        const detailLink = target.closest(".uni-card-link-overlay");
        if (detailLink) {
            const card = detailLink.closest("[data-uni-id]");
            const uniId = card?.getAttribute("data-uni-id");
            if (compareController.isCompareSelectionMode()) {
                e.preventDefault();
                e.stopPropagation();
                compareController.toggleCompareUniversity(uniId);
                return;
            }
            rememberRecentUniversity(uniId);
            if (shouldOpenUniversitiesInNewTab()) {
                e.preventDefault();
                compareController.openUniversityDetail(uniId);
            }
            return;
        }
        const actionBtn = target.closest("[data-card-action]");
        if (actionBtn) {
            e.preventDefault();
            e.stopPropagation();
            compareController.handleCardAction(actionBtn, { compensateLayoutShift: true });
            return;
        }
        const card = target.closest("[data-uni-id]");
        if (!card || target.tagName === "A") return;
        if (compareController.isCompareSelectionMode()) {
            e.preventDefault();
            e.stopPropagation();
            compareController.toggleCompareUniversity(card.getAttribute("data-uni-id"));
            return;
        }
        rememberRecentUniversity(card.getAttribute("data-uni-id"));
        compareController.openUniversityDetail(card.getAttribute("data-uni-id"));
    });

    el.btnList?.addEventListener("click", () => {
        switchView("list", true, { animate: true }).catch((err) => console.error(err));
    });
    el.btnMap?.addEventListener("click", () => {
        switchView("map", true, { animate: true }).catch((err) => console.error(err));
    });

    hideSearchSuggestions();
    syncSectionVisibility({
        shouldFetch: true,
        updateUrl: true,
        replaceUrl: true,
    }).catch((err) => console.error(err));

    bindWindowListener("profileUpdated", () => {
        state.funding_type = getProfileFundingQueryValue();
        state.page = 1;
        saveFilters(state);
        fetchAndRender();
    });
    bindWindowListener("languageChangeVisualPending", showLanguageCardSkeletons);
    bindWindowListener("languageChangeFinished", clearLanguageCardSkeletons);
    bindWindowListener("languageChanged", (event) => {
        const refreshPromise = (async () => {
            unifitBanner.applyAISortOptionLabel();
            filterControls.refreshLocationFilterLabels();
            filterControls.applyToForm();
            filterControls.updateTradeoffLabels();
            await syncSectionVisibility({
                shouldFetch: true,
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
    });
    bindWindowListener("settingsChanged", () => renderRecentlyViewedBar());
    bindWindowListener("app:online-reconnect", () => {
        fetchAndRender();
    });
    // Live rates that arrive after the first render redraw the cards and slider bounds; filters stay as they are.
    bindWindowListener("currencyRatesUpdated", () => {
        fetchAndRender().catch((err) => console.error(err));
    });
    bindWindowListener("currencyChanged", (e) => {
        filterControls.handleCurrencyChanged(e);
        fetchAndRender();
    });

    function renderFetchedData(data, options = {}) {
        const animateResults = options.animateResults !== false;
        const rawItems = Array.isArray(data.items) ? data.items : [];
        let items = rawItems;
        let total = data.total || 0;
        const clientFiltered = Boolean(state.only_saved || state.only_reviewed);
        if (clientFiltered) {
            const savedIds = new Set(Array.from(compareController.getSavedUniversityIds()).map((id) => String(id || "").trim()).filter(Boolean));
            const filteredItems = rawItems.filter((item) => (
                (!state.only_saved || savedIds.has(String(item?.id || "").trim()))
                && (!state.only_reviewed || item?.admissions_catalog?.availability === "reviewed")
            ));
            total = filteredItems.length;
            items = state.viewMode === "map"
                ? filteredItems
                : filteredItems.slice((state.page - 1) * state.limit, state.page * state.limit);
            lastRenderedItems = filteredItems;
        } else {
            lastRenderedItems = items;
        }
        const warnings = Array.isArray(data.warnings) ? data.warnings : [];
        const mlUnavailable = warnings.some((w) => String(w || "").toLowerCase().includes("machine learning unavailable"));
        const warningText = (mlUnavailable && state.sort === "uni_ai")
            ? t("universities.state.ml_unavailable", "Interests from your profile are temporarily not affecting sorting.")
            : "";

        unifitBanner.update();

        if (state.viewMode === "list") {
            state.lastCatalogTotal = total;
            // The first count after load is placed as is; later changes settle with a fade.
            setTextWithFade(el.total, String(total), { instant: !hasInitialListPaint });
            hasInitialListPaint = true;

            if (!items.length) {
                if (el.list) el.list.replaceChildren();
                if (el.pagination) el.pagination.replaceChildren();
                warmMapMode();
                renderUniversitiesState({
                    warningText,
                    emptyHtml: buildCatalogEmptyState(),
                });
                compareController.renderCompareTray();
                renderRecentlyViewedBar();
                filterControls.updateMobileFilterUi();
                layoutSync.scheduleSyncWorkspaceDepth();
                return;
            }
            renderUniversitiesState({ warningText });
            const profile = loadProfileForApi();
            const userBudget = Number.parseFloat(profile.budget);
            el.list.innerHTML = items.map((u, idx) => renderCard(u, userBudget, idx)).join("");
            unifitBanner.refreshLegend();
            warmMapMode();
            if (animateResults) markMotionEnter(el.list, ".uni-card", { limit: 16, staggerMs: 24 });
            renderPagination(total);
            if (animateResults) markMotionEnter(el.pagination, ".page-btn", { limit: 10, staggerMs: 12 });
            compareController.renderCompareTray();
            renderRecentlyViewedBar();
            filterControls.updateMobileFilterUi();
            layoutSync.scheduleSyncWorkspaceDepth();
            return;
        }

        if (state.viewMode === "map") {
            state.lastCatalogTotal = items.length;
            setTextWithFade(el.total, String(items.length), { instant: !hasInitialListPaint });
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
            compareController.renderCompareTray();
            compareController.syncCardActionState();
            renderRecentlyViewedBar();
            filterControls.updateMobileFilterUi();
            layoutSync.scheduleSyncWorkspaceDepth();
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
            if (state.viewMode === "list") el.list.replaceChildren();
            if (el.pagination) el.pagination.replaceChildren();
        }
        if (state.viewMode === "map" && !mapController.hasMapInstance()) await initMap();
        if (!isCurrentCatalog()) return;

        const urlParams = sectionUrlParams();
        const apiParams = buildParams(true);
        setUrlParams(urlParams);

        const savedIds = compareController.getSavedUniversityIds();
        let staleShown = false;
        // A sleeping backend: show this browser's last result for the same request until the fresh one arrives.
        const showStaleResult = (staleData) => {
            if (runSeq !== fetchRunSeq || !isCurrentCatalog()) return;
            staleShown = true;
            renderFetchedData(staleData, { animateResults: false });
            setUniversitiesLoading(false, { preserveResults: true });
        };

        try {
            if (state.viewMode === "map") {
                mapController.invalidateSize({ pan: false, animate: false });
                if (state.only_saved && savedIds.size === 0) {
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

            if (state.only_saved && savedIds.size === 0) {
                renderFetchedData({ items: [], total: 0 }, { animateResults });
                return;
            }
            const isAiSort = state.sort === "uni_ai";
            if (isAiSort) {
                await resolveAiSortResult({
                    canUseFastFallback: state.viewMode === "list" && !hasInitialListPaint && state.page === 1,
                    fastFallbackMs: AI_FAST_FALLBACK_MS,
                    fetchAi: () => fetchAiSort(buildAiSortPayload(), { onStale: showStaleResult }),
                    fetchFallback: () => fetchUniversities(buildFallbackListParams(apiParams, state)),
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

            const data = await fetchUniversities(apiParams, { onStale: showStaleResult });
            if (data?.__aborted) return;
            if (runSeq !== fetchRunSeq || !isCurrentCatalog()) return;
            renderFetchedData(data, { animateResults });
        } catch (err) {
            if (runSeq !== fetchRunSeq || !isCurrentCatalog()) return;
            if (err?.name === "AbortError") return;
            console.error(err);
            if (staleShown) {
                // The saved list stays on screen; replacing it with an error screen would lose what the visitor can still use.
                showToast(t("universities.stale_refresh_failed", "The server did not answer. Showing the last results saved on this device."), "warning");
                return;
            }
            const classified = classifyError(err);
            if (el.list) {
                const hasExistingCards = (Array.isArray(lastRenderedItems) && lastRenderedItems.length > 0)
                    || Boolean(el.list.querySelector(".uni-card"));
                if (hasExistingCards && classified.isOffline) {
                    showToast(t("universities.offline_action_warning", "Cannot refresh catalog while offline. Showing cached results."), "warning");
                } else {
                    renderErrorScreen({
                        type: classified.type,
                        containerId: "universitiesList",
                        onRetry: () => fetchAndRender(),
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
                    layoutSync.restoreScrollPosition();
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
                layoutSync.clearSavedScrollPosition();
                void fetchAndRender();
                window.scrollTo({ top: 0, behavior: "smooth" });
            },
        });
    }

    layoutSync.syncWorkspaceDepth();
}
