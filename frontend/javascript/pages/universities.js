/* frontend/javascript/pages.js */

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
  moneyUSD,
  loadProfile,
  loadProfileForApi,
  getFlagImg,
  initCustomSelect,
  CITY_OPTIONS_BY_COUNTRY,
  getExamDisplayName,
  canonicalizeExamId,
  EXAM_CONFIG,
  LANG_CONFIG,
  aiName,
  animateElementOut,
  markMotionEnter,
  motionPress,
  replayMotion,
  setupSlidingIndicator,
  bindImageFallbacks,
  closeMotionLayer,
} from "../utils.js";

import {
  applyPercentWidths,
  chanceTone,
  clusterMarkerLogoHtml,
  getAdmissionChoicesFromCategories,
  getTrackFundingType,
  mapMarkerLogoHtml,
  renderGroupedExamPairRows,
  renderTrackChanceChip,
  renderTrackFundingBadge,
  renderUniChanceSummary,
} from "../university-detail-helpers.js";

import { setupTabs, renderNoConnection } from "../components.js";
import { heroIcon, stripLeadingDecorations } from "../icons.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import { extractUniversityIdFromLocation, navigateToAppRoute, routeUniversities, routeUniversityDetail } from "../routes.js";
import { fetchCompareProfiles, loadCompareUniversities, resolveAiSortResult } from "./universities/compare-helpers.js";
import { renderAdmissionSection } from "./university/render-sections.js";
import {
  humanizeMachineLabel,
  initUniversityTranslations,
  translateAdmissionText,
  translateDataValue,
  translateProgramName,
  translateTrackLabel,
  translateTemplate,
  translateUniversityDescription,
  translateUniversityName,
  translateUnknownField,
  translateUnknownWord,
  translateWord,
} from "../university-translations.js";
import { bindInfoTooltips } from "../tooltip.js";

import {
  SAFE_PROTOCOLS,
  normalizeUrl,
  safeUrl,
  safePathSegment,
  buildApiUrl,
  formatCampusSizeValue,
  cleanDecoratedText,
  renderInlineIcon,
  renderUniPill,
  renderScholarshipLine,
  renderLocationMarkup,
  rankingBadgeResizeBound,
  rankingBadgeResizeRaf,
  rankingFetchController,
  fitRankingBadgeText,
  ensureRankingBadgeResizeHandler,
  trCountry,
  trCity,
  trState,
  trProgramLanguage,
  trStudyLevel,
  trStudyMode,
  trTag,
  trUniversityName,
  trUniversityDescription,
  trTrackLabel,
  trTrackDescription,
  trProgramName,
  unknownFieldText,
  unknownLabelText,
  textOrUnknown,
  moneyOrUnknown,
  normalizeTranslationKey,
  translateCostBreakdownLabel,
  costBreakdownCoverageNote,
  trackCefrLabel,
  localizeRoiLabel,
  renderRoiBox,
  ruPlural,
  localizeDuration,
  formatUiNumber,
  formatFundingOptionsCount,
  formatAdmissionsPercent,
  admissionsStatusTone,
  admissionsStatusLabel,
  rankingStatusLabel,
  admissionsDataTypeKey,
  admissionsDataTypeLabel,
  admissionsRateLabel,
  admissionsSignalSummary,
  admissionsPrimarySource,
  admissionsFactChips,
  renderAdmissionsChipRow,
  renderAdmissionsSourceLink,
  renderAdmissionsOverview,
  renderProgramAdmissionsSignals,
  normalizeStudyModeForCost,
  modeValueFromMap,
  modeBreakdownFromFinance,
  modeTotalFromFinance,
  extractTuitionCostFromBreakdown,
  modeAwareAnnualCost,
  modeAwareBreakdown,
  normalizeFundingPreference,
  normalizeSortMode,
  fundingPreferenceToQueryValue,
  uniThumbnailSrc,
  uniLogoSrc,
  DETAIL_CACHE_KEY,
  DETAIL_CACHE_TTL_MS,
  DETAIL_CACHE_MAX_ITEMS,
  SAVED_UNIVERSITIES_KEY,
  COMPARE_UNIVERSITIES_KEY,
  COMPARE_ADMISSION_CHOICES_KEY,
  RECENT_UNIVERSITIES_KEY,
  MAX_COMPARE_UNIVERSITIES,
  MAX_RECENT_UNIVERSITIES,
  hasSeenUniversitiesTour,
  markUniversitiesTourSeen,
  readIdListStorage,
  writeIdListStorage,
  shouldOpenUniversitiesInNewTab,
  rememberRecentUniversity,
  readDetailCache,
  writeDetailCache,
  getDetailCacheEntry,
  setDetailCacheEntry,
  touchDetailCacheEntry,
  fetchUniversityDetailCached,
  toFiniteNumber
} from './_shared.js';

let __universitiesProfileUpdatedHandler = null;
let __universitiesLanguageChangedHandler = null;
let __universitiesMapCardActionHandler = null;
let __universitiesSettingsChangedHandler = null;

export function initUniversitiesPage() {
    const MAX_TUITION = 150000;
    const MIN_RANGE_GAP = 100;
    const COMPARE_PAIR_SIZE = MAX_COMPARE_UNIVERSITIES;
    const SCOPE_NOTICE_DISMISSED_KEY = "unisearch_universities_scope_notice_dismissed";
    const clampTuition = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(MAX_TUITION, Math.round(n)));
    };
    const clampPercent = (value, fallback = 50) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(100, Math.round(n)));
    };

    const el = {
        qInput: $("qInput"), countrySelect: $("countrySelect"), stateDiv: $("stateDiv"),
        stateSelect: $("stateSelect"), citySelect: $("citySelect"),
        minInput: $("minCostInput"), maxInput: $("maxCostInput"),
        minSlider: $("minCostSlider"), maxSlider: $("maxCostSlider"), track: $("sliderTrack"),
        sortSelect: $("sortSelect"), sliderContainer: $("aiSliderContainer"),
        sortStrategyInfoWrap: document.querySelector('label[for="sortSelect"] .u-info-wrap'),
        sortAiTagsHint: $("sortAiTagsHint"),
        focusSlider: $("focusSlider"), focusLabel: $("focusLabel"),
        atmosphereSlider: $("atmosphereSlider"), atmosphereLabel: $("atmosphereLabel"),
        financeSlider: $("financeSlider"), financeLabel: $("financeLabel"),
        locationSlider: $("locationSlider"), locationLabel: $("locationLabel"),
        resetBtn: $("resetFiltersBtn"),
        content: document.querySelector(".u-content"),
        sectionTabs: $("universitiesSectionTabs"),
        tabButtons: Array.from(document.querySelectorAll("[data-universities-tab]")),
        catalogPane: $("universitiesCatalogPane"),
        rankingPane: $("universitiesRankingPane"),
        compareResultsPane: $("compareResultsPane"),
        compareModeStatus: $("compareModeStatus"),
        list: $("universitiesList"), mapStage: $("mapStage"), mapResults: $("mapResultsPanel"), mapContainer: $("mapContainer"), total: $("totalCount"),
        skeleton: $("universitiesSkeleton"), state: $("listState"), pagination: $("pagination"),
        btnList: $("viewListBtn"), btnMap: $("viewMapBtn"),
        mobileFilterSummary: $("mobileFilterSummary"),
        mobileFilterCount: $("mobileFilterCount"),
        mobileFilterToggle: $("mobileFilterToggle"),
        mobileFilterClose: $("closeMobileFilters"),
        savedFilterButtons: Array.from(document.querySelectorAll("[data-saved-filter]")),
        recentlyViewedBar: $("recentlyViewedBar"),
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
        if (dismissed || !el.scopeNoticeDismiss) return;

        el.scopeNoticeDismiss.addEventListener("click", () => {
            el.scopeNotice.hidden = true;
            try {
                localStorage.setItem(SCOPE_NOTICE_DISMISSED_KEY, "1");
            } catch (e) {
                // Ignore storage errors; the notice still closes for this page view.
            }
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

    bindInfoTooltips({ wrapSelector: ".u-info-wrap", buttonSelector: ".u-info" });
    setupScopeNotice();
    setupSlidingIndicator("#universitiesSectionTabs", ".u-section-tab", "is-active");
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
        return ["catalog", "ranking", "compare"].includes(raw) ? raw : "catalog";
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
    const initialCompareStage = initialCompareIds.length === COMPARE_PAIR_SIZE && ["configure", "results"].includes(initialCompareParam)
        ? initialCompareParam
        : "select";
    const savedState = loadFilters();
    const tabFromUrl = pageParams.get("tab");
    const tabFromCompare = (initialCompareStage === "results" || initialCompareStage === "configure") ? "compare" : null;
    const tabFromSaved = savedState.activeTab || null;
    const initialTab = normalizeUniversitiesTab(tabFromUrl || tabFromCompare || tabFromSaved || "catalog");
    const initialCompareChoices = String(pageParams.get("choices") || "").split(",");

    const defaultSortMode = hasProfileEvidence(loadProfile()) ? "uni_ai" : "name_asc";
    const initialMin = clampTuition(savedState.min_tuition, 0);
    const initialMax = clampTuition(savedState.max_tuition, MAX_TUITION);
    const state = {
        q: savedState.q || "", country: savedState.country || "", region: savedState.region || "", 
        city: savedState.city || "", study_level: savedState.study_level || "",
        funding_type: getProfileFundingQueryValue(),
        min_tuition: initialMin,
        max_tuition: Math.max(initialMax, initialMin + MIN_RANGE_GAP), 
        sort: normalizeSortMode(savedState.sort || defaultSortMode),
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
        compareStage: initialCompareStage,
        compareResultIds: initialCompareIds,
        viewMode: savedState.viewMode || "list", page: 1, limit: 24,
    };
    if (state.min_tuition > (MAX_TUITION - MIN_RANGE_GAP)) state.min_tuition = MAX_TUITION - MIN_RANGE_GAP;
    state.max_tuition = Math.min(MAX_TUITION, state.max_tuition);
    if (state.max_tuition < state.min_tuition + MIN_RANGE_GAP) {
        state.max_tuition = state.min_tuition + MIN_RANGE_GAP;
    }
    const getUniversitiesSkeletonCount = () => {
        const renderedColumns = el.list
            ? getComputedStyle(el.list).gridTemplateColumns.split(" ").filter(Boolean).length
            : 0;
        const width = Math.max(
            Number(el.list?.clientWidth || 0),
            Number(el.skeleton?.parentElement?.clientWidth || 0),
            Number(el.content?.clientWidth || 0)
        );
        const cardMinWidth = 252;
        const gridGap = 18;
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
    let lastFetchKey = "";
    let lastFetchPayload = null;
    let lastFetchAt = 0;
    let lastAiFetchKey = "";
    let lastAiFetchPayload = null;
    let lastAiFetchAt = 0;
    let listFetchController = null;
    let aiFetchController = null;
    let fetchRunSeq = 0;
    let firstVisitTourPending = !hasSeenUniversitiesTour();
    let hasInitialListPaint = false;
    let uniFitWarningShownInSession = false;
    let lastRenderedItems = [];
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
    let compareChancesByUniId = new Map();

    const compareChoiceKey = (selection) => {
        if (!selection || typeof selection !== "object" || Array.isArray(selection)) return "";
        return String(selection.choiceKey || selection.choice_key || "").trim();
    };

    const normalizeCompareAdmissionSelection = (selection) => {
        if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;
        const choiceKey = compareChoiceKey(selection);
        if (!choiceKey) return null;
        return {
            programId: String(selection.programId || selection.program_id || "").trim(),
            programName: String(selection.programName || selection.program_name || "").trim(),
            categoryId: String(selection.categoryId || selection.category_id || "").trim(),
            requirementProfileId: String(selection.requirementProfileId || selection.requirement_profile_id || "").trim(),
            fundingOptionId: String(selection.fundingOptionId || selection.funding_option_id || "").trim(),
            choiceKey,
        };
    };

    const compareAdmissionSelectionFromEntry = (entry) => {
        const option = entry?.option || {};
        const programIds = Array.isArray(option?.program_ids) ? option.program_ids : [];
        const programNames = Array.isArray(option?.program_names) ? option.program_names : [];
        return {
            programId: String(programIds[0] || "").trim(),
            programName: String(programNames[0] || "").trim(),
            categoryId: String(option?.category_id || "").trim(),
            requirementProfileId: String(option?.requirement_profile_id || "").trim(),
            fundingOptionId: String(option?.funding_option_id || "").trim(),
            choiceKey: String(entry?.key || option?.choice_key || option?.choiceKey || option?.id || "").trim(),
        };
    };

    const optionTextForValue = (selectEl, value) => {
        if (!selectEl) return "";
        const opt = Array.from(selectEl.options || []).find((item) => String(item.value || "") === String(value || ""));
        return String(opt?.text || "").trim();
    };

    function activeFilterCount() {
        let count = 0;
        if (state.q) count += 1;
        if (state.country) count += 1;
        if (state.region) count += 1;
        if (state.city) count += 1;
        if (Number(state.min_tuition) > 0 || Number(state.max_tuition) < MAX_TUITION) count += 1;
        if (state.sort && state.sort !== "name_asc") count += 1;
        if (state.study_level) count += 1;
        if (state.funding_type && state.funding_type !== "any") count += 1;
        if (state.only_saved) count += 1;
        return count;
    }

    function mobileFilterChips() {
        const chips = [];
        if (state.q) chips.push(state.q);
        if (state.country) chips.push(trCountry(state.country));
        if (state.region) chips.push(trState(state.region));
        if (state.city) chips.push(trCity(state.city));
        if (Number(state.min_tuition) > 0 || Number(state.max_tuition) < MAX_TUITION) {
            chips.push(`${moneyUSD(Number(state.min_tuition) || 0)}-${moneyUSD(Number(state.max_tuition) || MAX_TUITION)}`);
        }
        if (state.sort && state.sort !== "name_asc") chips.push(optionTextForValue(el.sortSelect, state.sort) || state.sort);
        if (state.only_saved) chips.push(t("universities.filter.favorites", "Favorites"));
        return chips.length ? chips : [t("universities.filter.none_active", "No active filters")];
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
        if (el.mobileFilterSummary) {
            const chips = mobileFilterChips();
            el.mobileFilterSummary.innerHTML = `
                <div class="u-mobile-filter-summary__chips">
                    ${chips.map((chip) => `<span class="u-mobile-chip">${escapeHtml(chip)}</span>`).join("")}
                </div>
            `;
        }
    }

    let rankingInitialized = false;
    let rankingModulePromise = null;
    const isCompareTab = () => state.activeTab === "compare";
    const isCompareResultsMode = () => isCompareTab() && state.compareStage === "results" && state.compareResultIds.length === COMPARE_PAIR_SIZE;
    const isCompareConfigureMode = () => isCompareTab() && state.compareStage === "configure" && state.compareResultIds.length === COMPARE_PAIR_SIZE;
    const isCompareSelectionMode = () => isCompareTab() && state.compareStage === "select";

    const sectionUrlParams = () => {
        const params = buildParams(false);
        if (state.activeTab) params.set("tab", state.activeTab);
        if (isCompareResultsMode() || isCompareConfigureMode()) {
            params.set("compare", state.compareStage);
            params.set("ids", state.compareResultIds.join(","));
            const choices = state.compareResultIds.map(id => compareChoiceKey(compareAdmissionChoices.get(id))).join(",");
            if (choices.replace(/,/g, "")) params.set("choices", choices);
        } else if (isCompareSelectionMode()) {
            params.set("compare", "select");
            params.delete("ids");
            params.delete("choices");
        } else {
            params.delete("compare");
            params.delete("ids");
            params.delete("choices");
        }
        return params;
    };

    const setSectionUrl = (replace = true) => {
        const url = new URL(window.location.href);
        url.search = sectionUrlParams().toString();
        window.history[replace ? "replaceState" : "pushState"]({}, "", url.toString());
    };

    const updateCompareModeStatus = () => {
        if (!el.compareModeStatus) return;
        if (!isCompareSelectionMode()) {
            el.compareModeStatus.hidden = true;
            el.compareModeStatus.innerHTML = "";
            return;
        }
        const count = comparePairIds().length;
        const countText = count
            ? tFormat("universities.compare.status_selected", { count: String(count), total: String(COMPARE_PAIR_SIZE) }, `${count}/${COMPARE_PAIR_SIZE} selected`)
            : t("universities.compare.status_empty", "Comparison shortlist");
        el.compareModeStatus.hidden = false;
        el.compareModeStatus.innerHTML = `
            <div class="u-compare-mode-status__icon">${renderInlineIcon("adjustments-horizontal", 18, "u-compare-mode-status__svg")}</div>
            <div class="u-compare-mode-status__copy">
                <strong>${escapeHtml(t("universities.compare.status_title", "Comparing"))}</strong>
                <span>${escapeHtml(countText)}</span>
            </div>
        `;
    };

    const syncSectionTabs = () => {
        el.tabButtons.forEach((btn) => {
            const tab = String(btn.getAttribute("data-universities-tab") || "").trim();
            const active = tab === state.activeTab;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
    };

    const syncSectionVisibility = async ({ shouldFetch = false, updateUrl = true, replaceUrl = true } = {}) => {
        const showCatalog = state.activeTab === "catalog" || isCompareSelectionMode();
        if (el.catalogPane) el.catalogPane.hidden = !showCatalog;
        if (el.rankingPane) el.rankingPane.hidden = state.activeTab !== "ranking";
        if (el.compareResultsPane) el.compareResultsPane.hidden = !(isCompareResultsMode() || isCompareConfigureMode());
        document.body.classList.toggle("universities-compare-mode", isCompareSelectionMode());
        document.body.classList.toggle("universities-ranking-mode", state.activeTab === "ranking");
        document.body.classList.toggle("universities-compare-configure-mode", isCompareConfigureMode());
        document.body.classList.toggle("universities-compare-results-mode", isCompareResultsMode());
        syncSectionTabs();
        updateCompareModeStatus();
        renderCompareTray();
        if (updateUrl) setSectionUrl(replaceUrl);

        if (state.activeTab === "ranking") {
            if (!rankingInitialized) {
                rankingInitialized = true;
                const rankingModule = await ensureIntegratedRankingAssets();
                await rankingModule?.initRankingPage?.();
                bindImageFallbacks(el.rankingPane || document);
            }
            replayMotion(el.rankingPane, "motion-panel-enter", { timeoutMs: 420 });
            return;
        }

        if (isCompareResultsMode()) {
            await renderCompareResultsPage(state.compareResultIds);
            replayMotion(el.compareResultsPane, "motion-panel-enter", { timeoutMs: 420 });
            return;
        }

        if (isCompareConfigureMode()) {
            await renderCompareConfigurePage(state.compareResultIds);
            replayMotion(el.compareResultsPane, "motion-panel-enter", { timeoutMs: 420 });
            return;
        }

        if (showCatalog) {
            await switchView(state.viewMode || "list", false);
            if (shouldFetch) fetchAndRender();
        }
    };

    const scrollUniversitiesPageTop = (behavior = "smooth") => {
        const run = () => {
            window.scrollTo({ top: 0, left: 0, behavior });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        };
        run();
        window.requestAnimationFrame(() => {
            run();
            window.setTimeout(run, 80);
            window.setTimeout(run, 240);
            window.setTimeout(run, 500);
        });
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
    const comparePairSlots = () => {
        const ids = comparePairIds();
        return Array.from({ length: COMPARE_PAIR_SIZE }, (_, index) => ids[index] || "");
    };
    const readCompareAdmissionChoices = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(COMPARE_ADMISSION_CHOICES_KEY) || "{}");
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map();
            return new Map(Object.entries(raw)
                .map(([id, selection]) => [String(id || "").trim(), normalizeCompareAdmissionSelection(selection)])
                .filter(([id, selection]) => id && selection));
        } catch (e) {
            return new Map();
        }
    };
    const writeCompareAdmissionChoices = () => {
        const pairSet = new Set(comparePairIds());
        const data = {};
        compareAdmissionChoices.forEach((selection, id) => {
            const cleanId = String(id || "").trim();
            const normalized = normalizeCompareAdmissionSelection(selection);
            if (pairSet.has(cleanId) && normalized) data[cleanId] = normalized;
        });
        try {
            localStorage.setItem(COMPARE_ADMISSION_CHOICES_KEY, JSON.stringify(data));
        } catch (e) {
            // Ignore storage failures; comparison still works for the current session.
        }
    };
    compareAdmissionChoices = readCompareAdmissionChoices();
    if (initialCompareStage !== "select" && initialCompareChoices.length) {
        initialCompareIds.forEach((id, index) => {
            const choiceKey = String(initialCompareChoices[index] || "").trim();
            if (choiceKey) {
                compareAdmissionChoices.set(id, { choiceKey });
            }
        });
        writeCompareAdmissionChoices();
    }
    const compareSlotLabel = (index) => tFormat(
        "universities.compare.pair_slot",
        { number: String(index + 1) },
        `University ${index + 1}`
    );
    const isComparePairReady = () => comparePairIds().length === COMPARE_PAIR_SIZE;

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
        const helperText = canCompare
            ? t("universities.compare.pair_ready", "Comparison pair is ready")
            : t("universities.compare.need_more", "Choose the second university");
        const slotsHtml = comparePairSlots().map((id, index) => {
            const name = id ? getUniversityDisplayNameById(id) : "";
            return `
                <div class="compare-tray__slot${id ? "" : " compare-tray__slot--empty"}" role="listitem">
                    <span class="compare-tray__slot-label">${escapeHtml(compareSlotLabel(index))}</span>
                    <span class="compare-tray__slot-name">${escapeHtml(name || t("universities.compare.pair_empty", "Empty slot"))}</span>
                </div>
            `;
        }).join("");
        el.compareTray.innerHTML = `
            <div class="compare-tray__header">
                <span class="compare-tray__text">${escapeHtml(helperText)}</span>
            </div>
            <div class="compare-tray__body">
                <div class="compare-tray__pair" role="list" aria-label="${escapeHtmlAttr(t("universities.compare.pair_label", "Comparison pair"))}">
                    ${slotsHtml}
                </div>
                <div class="compare-tray__actions">
                    <button class="compare-tray__btn" type="button" data-action="clear-compare">${escapeHtml(t("universities.compare.clear", "Clear"))}</button>
                    <button class="compare-tray__btn compare-tray__btn--primary" type="button" data-action="open-compare"${canCompare ? "" : " disabled"}>${escapeHtml(t(canCompare ? "universities.compare.continue" : "universities.compare.open", canCompare ? "Continue" : "Compare"))}</button>
                </div>
            </div>
        `;
        replayMotion(el.compareTray, "motion-panel-enter", { timeoutMs: 420 });
        replayMotion(el.compareTray.querySelector(".compare-tray__text"), "motion-state-pulse", { timeoutMs: 520 });
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
        document.querySelectorAll(".u-map-result-card[data-uni-id]").forEach((card) => {
            const rowId = String(card.getAttribute("data-uni-id") || "").trim();
            const compared = showCompareSelection && compareUniversityIds.has(rowId);
            card.classList.toggle("is-selected", compared);
            card.setAttribute("aria-selected", compared ? "true" : "false");
            const compareBtn = card.querySelector("[data-card-action='compare']");
            if (compareBtn) {
                const label = compared
                    ? t("universities.card.compare_selected", "Selected for comparison")
                    : t("universities.card.compare", "Add to compare");
                compareBtn.classList.toggle("is-active", compared);
                compareBtn.setAttribute("aria-pressed", compared ? "true" : "false");
                compareBtn.setAttribute("title", label);
                compareBtn.setAttribute("aria-label", label);
                compareBtn.innerHTML = `${renderInlineIcon(compared ? "check-circle" : "adjustments-horizontal", 16, "u-map-result-action-icon")}<span>${escapeHtml(label)}</span>`;
            }
            const compareLink = card.querySelector(".u-map-result-link.u-map-result-compare-link");
            if (compareLink) {
                compareLink.textContent = compared
                    ? t("universities.card.compare_selected", "Selected for comparison")
                    : t("universities.card.compare", "Add to compare");
            }
        });
    };

    const toggleCompareUniversity = (uniId, triggerEl = null) => {
        const cleanId = String(uniId || "").trim();
        if (!cleanId) return false;
        const currentPair = comparePairIds();
        const wasCompared = currentPair.includes(cleanId);
        if (wasCompared) {
            setComparePairIds(currentPair.filter((id) => id !== cleanId));
        } else {
            const nextPair = currentPair.length >= COMPARE_PAIR_SIZE
                ? currentPair.slice(1)
                : currentPair.slice();
            nextPair.push(cleanId);
            setComparePairIds(nextPair);
        }
        syncCardActionState();
        const target = triggerEl instanceof Element
            ? triggerEl
            : Array.from(document.querySelectorAll("[data-uni-id]")).find((node) => node.getAttribute("data-uni-id") === cleanId);
        if (target) replayMotion(target, "motion-state-pulse--compare", { timeoutMs: 520 });
        replayMotion(
            target?.querySelector(".uni-action-icon, .u-map-result-action-icon") || target,
            wasCompared ? "motion-icon-compare-remove" : "motion-icon-compare-add",
            { timeoutMs: 320 }
        );
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
            return isCompareSelectionMode() ? toggleCompareUniversity(uniId, actionBtn) : false;
        }

        return false;
    };

    const formatCompareCost = (value, fallbackKey = "placeholder.field.cost", fallback = "Cost") => {
        const n = toFiniteNumber(value);
        return n !== null ? moneyUSD(n) : unknownFieldText(fallbackKey, fallback);
    };

    const compareUniversityName = (u) => {
        const rawName = String(u?.name || u?.id || "").trim();
        return textOrUnknown(trUniversityName(u), "placeholder.field.university_name", rawName || "University name");
    };

    const compareLocationText = (u) => {
        const city = trCity(nested(u, ["location", "city"], ""));
        const region = trState(nested(u, ["location", "state"], ""));
        const country = trCountry(nested(u, ["location", "country"], ""));
        return [city, region, country].filter(Boolean).join(", ") || t("common.na", "N/A");
    };

    const compareRankText = (u) => {
        const rank = toFiniteNumber(u?.rank);
        return rank !== null && rank > 0 ? `#${rank}` : t("common.na", "N/A");
    };

    const compareAcceptanceText = (u) => {
        const acc = toFiniteNumber(u?.academics?.acceptance_rate_percent);
        return acc !== null ? `${Math.round(acc * 100) / 100}%` : t("common.na", "N/A");
    };

    const compareAidText = (u) => {
        const merit = nested(u, ["finance", "financial_aid", "merit_based"], false);
        const need = nested(u, ["finance", "financial_aid", "need_based"], false);
        if (merit && need) return t("universities.compare.aid_both", "Merit scholarships + need-based aid");
        if (merit) return t("universities.compare.aid_merit", "Merit scholarships");
        if (need) return t("universities.compare.aid_need", "Need-based financial aid");
        return t("common.na", "N/A");
    };

    const isBachelorStudyLevel = (level) => {
        const normalized = String(level || "").trim().toLowerCase();
        return /bachelor|undergraduate|бакалавр|бакалавриат/.test(normalized);
    };

    const compareBachelorPrograms = (u) => {
        const programs = Array.isArray(u?.academics?.programs) ? u.academics.programs : [];
        return programs.filter((program) => {
            const levels = Array.isArray(program?.study_levels) ? program.study_levels : [];
            if (!levels.length) return true;
            return levels.some(isBachelorStudyLevel);
        });
    };

    const compareProgramSummary = (u) => {
        const programs = compareBachelorPrograms(u);
        if (!programs.length) return t("common.na", "N/A");
        const names = programs
            .map((program) => translateProgramName(String(u?.id || ""), String(program?.name || "").trim()))
            .filter(Boolean);
        const visible = names.slice(0, 2).join(", ");
        const more = names.length > 2 ? ` +${names.length - 2}` : "";
        return visible ? `${visible}${more}` : t("common.na", "N/A");
    };

    const compareLanguageSummary = (u) => {
        const programs = compareBachelorPrograms(u);
        const langs = new Set();
        programs.forEach((program) => {
            const raw = program?.language;
            const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            values.forEach((value) => {
                const translated = trProgramLanguage(value);
                if (translated) langs.add(translated);
            });
        });
        if (!langs.size) return t("common.na", "N/A");
        return Array.from(langs).slice(0, 3).join(", ");
    };

    const compareStudyModeText = (u) => {
        const formats = Array.isArray(u?.academics?.formats) ? u.academics.formats : [];
        if (formats.length) return formats.map((item) => translateDataValue("study_mode", item, item)).join(", ");
        const programs = compareBachelorPrograms(u);
        const modes = Array.from(new Set(programs.map((program) => String(program?.study_mode || "").trim()).filter(Boolean)));
        return modes.length ? modes.map((item) => translateDataValue("study_mode", item, item)).join(", ") : t("common.na", "N/A");
    };

    const compareAdmissionOptionEntries = (u) => {
        const choices = getAdmissionChoicesFromCategories(u?.admission_categories);
        return choices.map((choice, choiceIdx) => ({
            option: choice,
            choiceIdx,
            key: String(choice?.choice_key || choice?.choiceKey || choice?.id || "").trim(),
        })).filter((entry) => entry.key && entry.option);
    };

    const compareSelectedAdmissionEntry = (u) => {
        const uniId = String(u?.id || "").trim();
        const selectedKey = compareChoiceKey(compareAdmissionChoices.get(uniId));
        if (!selectedKey) return null;
        return compareAdmissionOptionEntries(u).find((entry) => entry.key === selectedKey) || null;
    };

    const compareSelectedAdmissionOption = (u) => compareSelectedAdmissionEntry(u)?.option || null;
    const compareSelectedFinance = (u) => {
        const option = compareSelectedAdmissionOption(u);
        return (option?.finance_override && typeof option.finance_override === "object")
            ? option.finance_override
            : (u?.finance || {});
    };

    const compareSelectedAnnualCost = (u) => {
        const finance = compareSelectedFinance(u);
        const profileMode = normalizeStudyModeForCost(loadProfile()?.studyMode || loadProfile()?.study_mode || "");
        const modeCost = modeAwareAnnualCost(finance, profileMode);
        const total = modeCost ?? finance?.total_cost_year_usd ?? u?.finance?.total_cost_year_usd;
        return toFiniteNumber(total);
    };

    const compareTrackCountText = (u) => {
        const categories = Array.isArray(u?.admission_categories) ? u.admission_categories : [];
        const options = compareAdmissionOptionEntries(u).length;
        if (!categories.length) return t("common.na", "N/A");
        return tFormat("universities.compare.track_count", { count: String(categories.length), options: String(options) }, `${categories.length} categories / ${options} choices`);
    };

    const compareTrackLabel = (u) => {
        const option = compareSelectedAdmissionOption(u);
        if (!option) return t("common.na", "N/A");
        const categoryRaw = String(option?.category_label || option?.category_id || "").trim();
        const profileRaw = String(option?.requirement_profile_label || option?.requirement_profile_id || "").trim();
        const category = categoryRaw ? trTrackLabel(categoryRaw) || translateTrackLabel(categoryRaw, categoryRaw) : "";
        const profile = profileRaw ? trTrackLabel(profileRaw) || translateTrackLabel(profileRaw, profileRaw) : "";
        return Array.from(new Set([category, profile].filter(Boolean))).join(" - ") || t("common.na", "N/A");
    };

    const compareFundingChoiceText = (u) => {
        const option = compareSelectedAdmissionOption(u);
        if (!option) return t("common.na", "N/A");
        const badge = new DOMParser().parseFromString(renderTrackFundingBadge(option), "text/html").body.textContent?.trim() || "";
        const optionLabelRaw = String(option?.label || "").trim();
        const profileLabelRaw = String(option?.requirement_profile_label || "").trim();
        const categoryLabelRaw = String(option?.category_label || "").trim();
        const optionLabel = optionLabelRaw && optionLabelRaw !== profileLabelRaw && optionLabelRaw !== categoryLabelRaw ? trTrackLabel(optionLabelRaw) : "";
        return [badge, optionLabel].filter(Boolean).join(" - ") || compareAidText(u);
    };

    const formatCompareScoreValue = (value) => {
        const n = toFiniteNumber(value);
        return n !== null ? formatUiNumber(n, { maximumFractionDigits: 2 }) : "";
    };

    const compareOptionScoreProfilePreview = (option) => {
        const profile = (option?.score_profile && typeof option.score_profile === "object") ? option.score_profile : null;
        if (!profile) return "";
        const exam = getExamDisplayName(profile.exam_id || (Array.isArray(profile.compatible_exam_ids) ? profile.compatible_exam_ids[0] : ""));
        const median = formatCompareScoreValue(profile.median_raw ?? profile.median_normalized);
        const low = formatCompareScoreValue(profile.p25_raw ?? profile.p25_normalized);
        const high = formatCompareScoreValue(profile.p75_raw ?? profile.p75_normalized);
        if (median && low && high) {
            return tFormat(
                "universities.compare.configure.score_profile_range",
                { exam, median, low, high },
                `${exam} median ${median} (25-75%: ${low}-${high})`
            );
        }
        if (median) {
            return tFormat(
                "universities.compare.configure.score_profile_median",
                { exam, median },
                `${exam} median ${median}`
            );
        }
        return "";
    };

    const compareOptionFundingDeltaPreview = (entry, entries) => {
        const option = entry?.option || {};
        if (getTrackFundingType(option) !== "grant") return "";
        const sameRoute = (candidate) => (
            String(candidate?.option?.category_id || "") === String(option?.category_id || "")
            && String(candidate?.option?.requirement_profile_id || "") === String(option?.requirement_profile_id || "")
        );
        const paidBaseline = (Array.isArray(entries) ? entries : [])
            .find((candidate) => candidate?.key !== entry?.key && sameRoute(candidate) && getTrackFundingType(candidate.option) === "paid");
        const baseline = (paidBaseline?.option?.requirements && typeof paidBaseline.option.requirements === "object")
            ? paidBaseline.option.requirements
            : ((option?.base_requirements && typeof option.base_requirements === "object") ? option.base_requirements : {});
        const req = (option?.requirements && typeof option.requirements === "object") ? option.requirements : {};
        const fundingReq = (option?.funding_requirements && typeof option.funding_requirements === "object") ? option.funding_requirements : {};
        const keys = Object.keys(req).filter((key) => {
            if (Object.prototype.hasOwnProperty.call(fundingReq, key)) return true;
            return baseline[key] !== undefined && String(baseline[key]) !== String(req[key]);
        });
        const rows = keys
            .filter((key) => req[key] !== null && req[key] !== undefined && req[key] !== "")
            .map((key) => {
                const baseValue = baseline[key];
                const current = `${getExamDisplayName(key)} ${req[key]}`;
                return baseValue !== null && baseValue !== undefined && baseValue !== "" && String(baseValue) !== String(req[key])
                    ? tFormat(
                        "universities.compare.configure.funding_delta_from",
                        { value: current, base: String(baseValue) },
                        `${current} (standard ${baseValue})`
                    )
                    : current;
            });
        return rows.length
            ? rows.slice(0, 3).join(", ")
            : t("universities.compare.configure.no_funding_delta", "No separate funding-specific score cutoff in the data");
    };

    const compareFundingRequirementsText = (u) => {
        const entry = compareSelectedAdmissionEntry(u);
        if (!entry) return t("common.na", "N/A");
        const entries = compareAdmissionOptionEntries(u);
        const delta = compareOptionFundingDeltaPreview(entry, entries);
        if (delta) return delta;

        const option = entry.option || {};
        const fundingProgram = String(option?.funding_program || "").trim();
        const fundingSource = String(option?.funding_source || "").trim();
        const parts = [];
        if (fundingProgram) parts.push(trTrackDescription(String(u?.id || ""), option.id, fundingProgram));
        if (fundingSource) parts.push(trTrackDescription(String(u?.id || ""), option.id, fundingSource));
        return parts.length ? parts.join(" - ") : t("common.na", "N/A");
    };

    const compareRequirementsText = (u) => {
        const option = compareSelectedAdmissionOption(u);
        const req = (option?.requirements && typeof option.requirements === "object") ? option.requirements : {};
        const rows = Object.entries(req || {})
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([key, value]) => `${getExamDisplayName(key)} ${value}`);
        return rows.length ? rows.slice(0, 3).join(", ") : t("common.na", "N/A");
    };

    const compareAverageScoreText = (u) => {
        const option = compareSelectedAdmissionOption(u);
        const scoreProfile = compareOptionScoreProfilePreview(option);
        if (scoreProfile) return scoreProfile;
        const stats = (option?.stats_avg && typeof option.stats_avg === "object") ? option.stats_avg : {};
        const rows = Object.entries(stats)
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([key, value]) => `${getExamDisplayName(key)} ${value}`);
        return rows.length ? rows.slice(0, 3).join(", ") : t("common.na", "N/A");
    };

    const compareLanguageProofText = (u) => {
        const option = compareSelectedAdmissionOption(u);
        const requirements = Array.isArray(option?.language_requirements) ? option.language_requirements : [];
        const rows = [];
        requirements.forEach((entry) => {
            const req = (entry?.requirements && typeof entry.requirements === "object") ? entry.requirements : {};
            Object.entries(req).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== "") rows.push(`${getExamDisplayName(key)} ${value}`);
            });
            if (entry?.accept_native) rows.push(t("universities.compare.native_ok", "native accepted"));
        });
        return rows.length ? Array.from(new Set(rows)).slice(0, 4).join(", ") : t("common.na", "N/A");
    };

    const compareExtraRequirementsText = (u) => {
        const option = compareSelectedAdmissionOption(u);
        const extras = Array.isArray(option?.extra_requirements) ? option.extra_requirements.filter(Boolean) : [];
        if (!extras.length) return t("common.na", "N/A");
        const visible = extras.slice(0, 2).join("; ");
        const more = extras.length > 2 ? ` +${extras.length - 2}` : "";
        return `${visible}${more}`;
    };

    const compareCostBreakdownText = (u, mode) => {
        const finance = compareSelectedFinance(u);
        const breakdown = (finance?.costs_breakdown_year_usd && typeof finance.costs_breakdown_year_usd === "object")
            ? finance.costs_breakdown_year_usd
            : {};
        const entries = Object.entries(breakdown);
        if (!entries.length) return t("common.na", "N/A");
        const matcher = mode === "tuition"
            ? (key) => /tuition|fee/i.test(key)
            : (key) => /housing|dorm|food|meal|living|room|board|books|supplies|insurance|transport/i.test(key);
        const selected = entries.filter(([key]) => matcher(String(key || "")));
        const total = selected.reduce((sum, [, value]) => {
            const n = toFiniteNumber(value);
            return n !== null ? sum + n : sum;
        }, 0);
        return total > 0 ? moneyUSD(total) : t("common.na", "N/A");
    };

    const compareSourceText = (u, factKey) => {
        const fact = nested(u, ["fact_provenance", "facts", factKey], null);
        const source = String(fact?.source || "").trim();
        const status = String(fact?.status || u?.rank_meta?.status || "").trim();
        const parts = [source, status ? humanizeMachineLabel(status, status) : ""].filter(Boolean);
        return parts.length ? parts.join(" - ") : t("common.na", "N/A");
    };

    const compareDataConfidenceText = (u) => {
        const sources = Array.isArray(u?.verified_sources) ? u.verified_sources.length : 0;
        const facts = u?.fact_provenance?.facts && typeof u.fact_provenance.facts === "object"
            ? Object.keys(u.fact_provenance.facts).length
            : 0;
        if (!sources && !facts) return t("common.na", "N/A");
        if (getCurrentLanguage() === "rus") {
            return `${sources} ${ruPlural(sources, "источник", "источника", "источников")} / ${facts} ${ruPlural(facts, "факт", "факта", "фактов")}`;
        }
        return tFormat("universities.compare.verified_count", { sources: String(sources), facts: String(facts) }, `${sources} sources / ${facts} facts`);
    };

    const compareOutcomeText = (u) => {
        const salary = toFiniteNumber(u?.outcomes?.average_early_career_salary_usd);
        return salary !== null ? moneyUSD(salary) : t("common.na", "N/A");
    };

    const compareStudentCountText = (u) => {
        const count = toFiniteNumber(u?.student_count);
        if (count === null) return t("common.na", "N/A");
        try {
            return new Intl.NumberFormat(getCurrentLanguage() === "rus" ? "ru-RU" : "en-US").format(count);
        } catch (e) {
            return String(count);
        }
    };

    const compareCountText = (value) => {
        const n = toFiniteNumber(value);
        return n !== null ? formatUiNumber(n, { maximumFractionDigits: 0 }) : t("common.na", "N/A");
    };

    const comparePercentText = (value) => {
        const n = toFiniteNumber(value);
        return n !== null ? `${formatUiNumber(n, { maximumFractionDigits: 2 })}%` : t("common.na", "N/A");
    };

    const compareScoreText = (value) => {
        const n = toFiniteNumber(value);
        return n !== null ? formatUiNumber(n, { maximumFractionDigits: 2 }) : t("common.na", "N/A");
    };

    const compareCampusAreaText = (value) => {
        const n = toFiniteNumber(value);
        return n !== null ? formatCampusSizeValue(n) : t("common.na", "N/A");
    };

    const compareBachelorProgramCount = (u) => compareBachelorPrograms(u).length;

    const compareLanguageCount = (u) => {
        const langs = new Set();
        compareBachelorPrograms(u).forEach((program) => {
            const raw = program?.language;
            const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            values.forEach((value) => {
                const clean = String(value || "").trim();
                if (clean) langs.add(clean.toLowerCase());
            });
        });
        return langs.size;
    };

    const compareStudyFormatCount = (u) => {
        const formats = Array.isArray(u?.academics?.formats) ? u.academics.formats : [];
        const fromPrograms = compareBachelorPrograms(u).map((program) => String(program?.study_mode || "").trim()).filter(Boolean);
        return new Set([...formats, ...fromPrograms].map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)).size;
    };

    const compareMajorTagCount = (u) => {
        const tags = new Set();
        const rawTags = [
            ...(Array.isArray(u?.academics?.major_tags) ? u.academics.major_tags : []),
            ...(Array.isArray(u?.major_focus) ? u.major_focus : []),
        ];
        rawTags.forEach((tag) => {
            const clean = String(tag || "").trim().toLowerCase();
            if (clean) tags.add(clean);
        });
        compareBachelorPrograms(u).forEach((program) => {
            const programTags = Array.isArray(program?.major_tags) ? program.major_tags : [];
            programTags.forEach((tag) => {
                const clean = String(tag || "").trim().toLowerCase();
                if (clean) tags.add(clean);
            });
        });
        return tags.size;
    };

    const compareFundingOptionCount = (u) => {
        return compareAdmissionOptionEntries(u).length;
    };

    const compareExtraRequirementCount = (u) => {
        const extras = new Set();
        compareAdmissionOptionEntries(u).forEach((entry) => {
            const rows = Array.isArray(entry?.option?.extra_requirements) ? entry.option.extra_requirements : [];
            rows.forEach((item) => {
                const clean = String(item || "").trim();
                if (clean) extras.add(clean);
            });
        });
        return extras.size;
    };

    const compareAidScore = (u) => {
        const merit = nested(u, ["finance", "financial_aid", "merit_based"], false) ? 1 : 0;
        const need = nested(u, ["finance", "financial_aid", "need_based"], false) ? 1 : 0;
        return merit + need;
    };

    const compareCostBreakdownNumber = (u, mode) => {
        const finance = compareSelectedFinance(u);
        const breakdown = (finance?.costs_breakdown_year_usd && typeof finance.costs_breakdown_year_usd === "object")
            ? finance.costs_breakdown_year_usd
            : {};
        const entries = Object.entries(breakdown);
        if (!entries.length) return null;
        const matcher = mode === "tuition"
            ? (key) => /tuition|fee/i.test(key)
            : (key) => /housing|dorm|food|meal|living|room|board|books|supplies|insurance|transport/i.test(key);
        const total = entries.reduce((sum, [key, value]) => {
            if (!matcher(String(key || ""))) return sum;
            const n = toFiniteNumber(value);
            return n !== null ? sum + n : sum;
        }, 0);
        return total > 0 ? total : null;
    };

    const compareVerifiedFactCount = (u) => (
        u?.fact_provenance?.facts && typeof u.fact_provenance.facts === "object"
            ? Object.keys(u.fact_provenance.facts).length
            : 0
    );

    const compareVerifiedSourceCount = (u) => Array.isArray(u?.verified_sources) ? u.verified_sources.length : 0;

    const compareTrackRequirementValues = (u, examId) => {
        const option = compareSelectedAdmissionOption(u);
        const values = [];
        const req = (option?.requirements && typeof option.requirements === "object") ? option.requirements : {};
        Object.entries(req || {}).forEach(([key, value]) => {
            if (canonicalizeExamId(key) !== canonicalizeExamId(examId)) return;
            const n = toFiniteNumber(value);
            if (n !== null) values.push(n);
        });
        return values;
    };

    const compareSelectedRequirementKeys = (u) => {
        const option = compareSelectedAdmissionOption(u);
        const req = (option?.requirements && typeof option.requirements === "object") ? option.requirements : {};
        return Object.keys(req).filter((key) => compareRequirementValue(u, key) !== null);
    };

    const compareSelectedAverageKeys = (u) => {
        const option = compareSelectedAdmissionOption(u);
        const stats = (option?.stats_avg && typeof option.stats_avg === "object") ? option.stats_avg : {};
        const keys = Object.keys(stats).filter((key) => compareAverageScoreValue(u, key) !== null);
        const scoreProfile = (option?.score_profile && typeof option.score_profile === "object") ? option.score_profile : null;
        const profileExam = String(scoreProfile?.exam_id || "").trim();
        if (profileExam && compareAverageScoreValue(u, profileExam) !== null) keys.push(profileExam);
        return Array.from(new Set(keys));
    };

    const compareSelectedLanguageRequirementKeys = (u) => {
        const option = compareSelectedAdmissionOption(u);
        const requirements = Array.isArray(option?.language_requirements) ? option.language_requirements : [];
        const keys = [];
        requirements.forEach((entry) => {
            const req = (entry?.requirements && typeof entry.requirements === "object") ? entry.requirements : {};
            Object.keys(req).forEach((key) => {
                if (compareLanguageRequirementValue(u, key) !== null) keys.push(key);
            });
        });
        return keys;
    };

    const compareRequirementValue = (u, examId) => {
        const values = compareTrackRequirementValues(u, examId);
        return values.length ? Math.min(...values) : null;
    };

    const compareAverageScoreValue = (u, examId) => {
        const option = compareSelectedAdmissionOption(u);
        const stats = (option?.stats_avg && typeof option.stats_avg === "object") ? option.stats_avg : {};
        const values = [];
        Object.entries(stats).forEach(([key, value]) => {
            if (canonicalizeExamId(key) !== canonicalizeExamId(examId)) return;
            const n = toFiniteNumber(value);
            if (n !== null) values.push(n);
        });
        if (values.length) return Math.max(...values);
        const scoreProfile = (option?.score_profile && typeof option.score_profile === "object") ? option.score_profile : null;
        const compatible = Array.isArray(scoreProfile?.compatible_exam_ids) ? scoreProfile.compatible_exam_ids : [];
        const profileExams = [scoreProfile?.exam_id, ...compatible].map(canonicalizeExamId).filter(Boolean);
        if (profileExams.includes(canonicalizeExamId(examId))) {
            return toFiniteNumber(scoreProfile?.median_raw ?? scoreProfile?.median_normalized);
        }
        return null;
    };

    const compareLanguageRequirementValue = (u, examId) => {
        const option = compareSelectedAdmissionOption(u);
        const requirements = Array.isArray(option?.language_requirements) ? option.language_requirements : [];
        const values = [];
        requirements.forEach((entry) => {
            const req = (entry?.requirements && typeof entry.requirements === "object") ? entry.requirements : {};
            Object.entries(req).forEach(([key, value]) => {
                if (canonicalizeExamId(key) !== canonicalizeExamId(examId)) return;
                const n = toFiniteNumber(value);
                if (n !== null) values.push(n);
            });
        });
        return values.length ? Math.min(...values) : null;
    };

    const collectCompareExamKeys = (universities, getter) => {
        const byKey = new Map();
        universities.forEach((u) => {
            const entries = getter(u);
            const seen = new Set();
            entries.forEach((key) => {
                const clean = canonicalizeExamId(key);
                if (!clean || seen.has(clean)) return;
                seen.add(clean);
                byKey.set(clean, (byKey.get(clean) || 0) + 1);
            });
        });
        return Array.from(byKey.entries())
            .map(([key]) => key)
            .slice(0, 8);
    };

    const compareBestBadges = (u, metrics) => {
        const badges = [];
        const id = String(u?.id || "");
        if (id && metrics.bestRankId === id) badges.push(t("universities.compare.badge.best_rank", "Best rank"));
        if (id && metrics.lowestCostId === id) badges.push(t("universities.compare.badge.lowest_cost", "Lowest cost"));
        if (id && metrics.highestAcceptanceId === id) badges.push(t("universities.compare.badge.more_accessible", "More accessible"));
        if ((metrics.bestBySpec?.get("aid") || new Set()).has(id)) {
            badges.push(compareAidText(u));
        }
        return badges.slice(0, 3);
    };

    const compareCategoryMeta = () => ({
        prestige: {
            title: t("universities.compare.category.prestige.title", "Prestige"),
            subtitle: t("universities.compare.category.prestige.subtitle", "Rank and selectivity signals"),
            icon: "trophy",
        },
        admissions: {
            title: t("universities.compare.category.admissions.title", "Admissions"),
            subtitle: t("universities.compare.category.admissions.subtitle", "Access, requirement profiles, and funding"),
            icon: "academic-cap",
        },
        finance: {
            title: t("universities.compare.category.finance.title", "Finance"),
            subtitle: t("universities.compare.category.finance.subtitle", "Cost and aid flexibility"),
            icon: "banknotes",
        },
        academics: {
            title: t("universities.compare.category.academics.title", "Academics"),
            subtitle: t("universities.compare.category.academics.subtitle", "Program breadth and study options"),
            icon: "book-open",
        },
        outcomes: {
            title: t("universities.compare.category.outcomes.title", "Outcomes"),
            subtitle: t("universities.compare.category.outcomes.subtitle", "Published career outcome signals"),
            icon: "chart-bar",
        },
        data: {
            title: t("universities.compare.category.data.title", "Data confidence"),
            subtitle: t("universities.compare.category.data.subtitle", "Verified facts and sources"),
            icon: "check-badge",
        },
        context: {
            title: t("universities.compare.category.context.title", "Context"),
            subtitle: t("universities.compare.category.context.subtitle", "Scale and campus context"),
            icon: "building-office-2",
        },
    });

    const compareSpecSections = () => ({
        overview: t("universities.compare.section.overview", "Overview"),
        programs: t("universities.compare.section.programs", "Programs"),
        admissions: t("universities.compare.section.admissions", "Admissions"),
        finance: t("universities.compare.section.finance", "Finance"),
        outcomes: t("universities.compare.section.outcomes", "Outcomes"),
        data: t("universities.compare.section.data", "Data confidence"),
        context: t("universities.compare.section.context", "Context"),
    });

    const buildCompareSpecs = (universities) => {
        const specs = [
            {
                key: "location",
                section: "overview",
                category: "context",
                label: t("universities.compare.row.location", "Location"),
                type: "text",
                direction: "neutral",
                getter: compareLocationText,
            },
            {
                key: "rank",
                section: "overview",
                category: "prestige",
                label: translateWord("global_rank", "Global Rank"),
                type: "number",
                direction: "lower",
                getter: (u) => {
                    const rank = toFiniteNumber(u?.rank);
                    return rank !== null && rank > 0 ? rank : null;
                },
                formatter: (value) => `#${formatUiNumber(value, { maximumFractionDigits: 0 })}`,
                sourceKey: "rank",
                reasonMode: "rank",
                allowSinglePublishedAdvantage: true,
                weight: 1.25,
            },
            {
                key: "student_count",
                section: "overview",
                category: "context",
                label: t("universities.compare.row.student_count", "Students"),
                type: "number",
                direction: "neutral",
                getter: (u) => toFiniteNumber(u?.student_count),
                formatter: compareCountText,
                sourceKey: "student_count",
                score: false,
                reason: false,
            },
            {
                key: "program_count",
                section: "programs",
                category: "academics",
                label: t("universities.compare.row.program_count", "Bachelor programs"),
                type: "number",
                direction: "higher",
                getter: compareBachelorProgramCount,
                formatter: compareCountText,
                reason: false,
            },
            {
                key: "major_tags",
                section: "programs",
                category: "academics",
                label: t("universities.compare.row.major_tags", "Academic fields"),
                type: "number",
                direction: "higher",
                getter: compareMajorTagCount,
                formatter: compareCountText,
                reason: false,
            },
            {
                key: "study_formats",
                section: "programs",
                category: "academics",
                label: t("universities.compare.row.study_formats", "Study formats"),
                type: "number",
                direction: "higher",
                getter: compareStudyFormatCount,
                formatter: compareCountText,
                reason: false,
            },
            {
                key: "program_languages",
                section: "programs",
                category: "academics",
                label: t("universities.compare.row.language", "Program language"),
                type: "number",
                direction: "higher",
                getter: compareLanguageCount,
                formatter: compareCountText,
                reason: false,
            },
            {
                key: "programs",
                section: "programs",
                category: "academics",
                label: t("universities.compare.row.programs", "Programs shown"),
                type: "text",
                direction: "neutral",
                getter: compareProgramSummary,
                score: false,
                reason: false,
            },
            {
                key: "study_mode",
                section: "programs",
                category: "academics",
                label: t("universities.compare.row.study_mode", "Study mode"),
                type: "text",
                direction: "neutral",
                getter: compareStudyModeText,
                score: false,
                reason: false,
            },
            {
                key: "acceptance",
                section: "admissions",
                category: "admissions",
                label: t("ranking.acceptance", "Acceptance Rate"),
                type: "number",
                direction: "higher",
                getter: (u) => toFiniteNumber(u?.academics?.acceptance_rate_percent),
                formatter: comparePercentText,
                sourceKey: "acceptance_rate_percent",
                weight: 1.2,
            },
            {
                key: "selected_route",
                section: "admissions",
                category: "admissions",
                label: t("universities.compare.row.selected_route", "Selected route"),
                type: "text",
                direction: "neutral",
                getter: compareTrackLabel,
                score: false,
                reason: false,
            },
            {
                key: "funding_choice",
                section: "admissions",
                category: "finance",
                label: t("universities.compare.row.funding_choice", "Selected funding"),
                type: "text",
                direction: "neutral",
                getter: compareFundingChoiceText,
                score: false,
                reason: false,
            },
            {
                key: "requirements",
                section: "admissions",
                category: "admissions",
                label: t("universities.compare.row.academic_minimums", "Academic minimums"),
                type: "text",
                direction: "neutral",
                getter: compareRequirementsText,
                score: false,
                reason: false,
            },
            {
                key: "avg_scores",
                section: "admissions",
                category: "prestige",
                label: t("universities.compare.row.avg_scores", "Admitted score context"),
                type: "text",
                direction: "neutral",
                getter: compareAverageScoreText,
                score: false,
                reason: false,
            },
            {
                key: "funding_requirements",
                section: "admissions",
                category: "finance",
                label: t("universities.compare.row.funding_requirements", "Funding-specific requirements"),
                type: "text",
                direction: "neutral",
                getter: compareFundingRequirementsText,
                score: false,
                reason: false,
            },
            {
                key: "language_proof",
                section: "admissions",
                category: "admissions",
                label: t("universities.compare.row.language_proof", "Language proof"),
                type: "text",
                direction: "neutral",
                getter: compareLanguageProofText,
                score: false,
                reason: false,
            },
            {
                key: "extra_requirements",
                section: "admissions",
                category: "admissions",
                label: t("universities.compare.row.application_materials", "Documents / interview / portfolio"),
                type: "text",
                direction: "neutral",
                getter: compareExtraRequirementsText,
                score: false,
                reason: false,
            },
            {
                key: "total_cost",
                section: "finance",
                category: "finance",
                label: t("universities.compare.row.total_cost", "Total / year"),
                type: "number",
                direction: "lower",
                getter: compareSelectedAnnualCost,
                formatter: (value) => moneyUSD(value),
                sourceKey: "tuition_total_cost_year_usd",
                weight: 1.25,
            },
            {
                key: "tuition_fees",
                section: "finance",
                category: "finance",
                label: t("universities.compare.row.tuition_fees", "Tuition + fees"),
                type: "number",
                direction: "lower",
                getter: (u) => compareCostBreakdownNumber(u, "tuition"),
                formatter: (value) => moneyUSD(value),
            },
            {
                key: "living_costs",
                section: "finance",
                category: "finance",
                label: t("universities.compare.row.living_costs", "Living cost items"),
                type: "number",
                direction: "lower",
                getter: (u) => compareCostBreakdownNumber(u, "living"),
                formatter: (value) => moneyUSD(value),
            },
            {
                key: "aid",
                section: "finance",
                category: "finance",
                label: t("universities.compare.row.aid", "Aid"),
                type: "number",
                direction: "higher",
                getter: compareAidScore,
                formatter: (value, u) => compareAidText(u),
                reasonMode: "aid",
            },
            {
                key: "salary",
                section: "outcomes",
                category: "outcomes",
                label: t("universities.compare.row.salary", "Early career salary"),
                type: "number",
                direction: "higher",
                getter: (u) => toFiniteNumber(u?.outcomes?.average_early_career_salary_usd),
                formatter: (value) => moneyUSD(value),
                sourceKey: "average_early_career_salary_usd",
                weight: 1.1,
            },
            {
                key: "verified_sources",
                section: "data",
                category: "data",
                label: t("universities.compare.row.verified_sources", "Verified sources"),
                type: "number",
                direction: "higher",
                getter: compareVerifiedSourceCount,
                formatter: compareCountText,
                reason: false,
            },
            {
                key: "verified_facts",
                section: "data",
                category: "data",
                label: t("universities.compare.row.verified_facts", "Verified facts"),
                type: "number",
                direction: "higher",
                getter: compareVerifiedFactCount,
                formatter: compareCountText,
                reason: false,
            },
            {
                key: "data_quality",
                section: "data",
                category: "data",
                label: t("universities.compare.row.data_quality", "Verified data"),
                type: "text",
                direction: "neutral",
                getter: compareDataConfidenceText,
                score: false,
                reason: false,
            },
            {
                key: "campus_area",
                section: "context",
                category: "context",
                label: t("universities.compare.row.campus_area", "Campus area"),
                type: "number",
                direction: "neutral",
                getter: (u) => toFiniteNumber(u?.student_life?.campus_area_m2),
                formatter: compareCampusAreaText,
                score: false,
                reason: false,
            },
        ];

        const requirementKeys = collectCompareExamKeys(universities, compareSelectedRequirementKeys);
        requirementKeys.forEach((examId) => {
            specs.push({
                key: `req_${examId}`,
                section: "admissions",
                category: "admissions",
                label: tFormat("universities.compare.row.exam_requirement", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} requirement`),
                type: "number",
                direction: "lower",
                getter: (u) => compareRequirementValue(u, examId),
                formatter: compareScoreText,
            });
        });

        const averageScoreKeys = collectCompareExamKeys(universities, compareSelectedAverageKeys);
        averageScoreKeys.forEach((examId) => {
            specs.push({
                key: `avg_${examId}`,
                section: "admissions",
                category: "prestige",
                label: tFormat("universities.compare.row.exam_average", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} admitted score`),
                type: "number",
                direction: "higher",
                getter: (u) => compareAverageScoreValue(u, examId),
                formatter: compareScoreText,
            });
        });

        const languageRequirementKeys = collectCompareExamKeys(universities, compareSelectedLanguageRequirementKeys);
        languageRequirementKeys.forEach((examId) => {
            specs.push({
                key: `lang_${examId}`,
                section: "admissions",
                category: "admissions",
                label: tFormat("universities.compare.row.language_exam_requirement", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} language minimum`),
                type: "number",
                direction: "lower",
                getter: (u) => compareLanguageRequirementValue(u, examId),
                formatter: compareScoreText,
            });
        });

        return specs.filter((spec) => {
            const values = universities.map((u) => compareSpecRawValue(spec, u));
            if (spec.type === "text") {
                return values.some((value) => String(value || "").trim() && String(value || "").trim() !== t("common.na", "N/A"));
            }
            return values.some((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)));
        }).map((spec, index) => ({ ...spec, order: index }));
    };

    const compareSpecRawValue = (spec, u) => {
        try {
            const value = spec.getter(u);
            if (spec.type === "number") return toFiniteNumber(value);
            if (spec.type === "boolean") return !!value;
            return value;
        } catch (e) {
            return spec.type === "number" ? null : "";
        }
    };

    const compareSpecRows = (universities, spec) => universities
        .map((u) => ({
            university: u,
            id: String(u?.id || ""),
            value: compareSpecRawValue(spec, u),
        }))
        .filter((row) => row.id && row.value !== null && row.value !== undefined && row.value !== "" && (spec.type !== "number" || Number.isFinite(row.value)));

    const compareBestIdsForSpec = (universities, spec) => {
        if (spec.reason === false || spec.score === false) return new Set();
        if (!["higher", "lower"].includes(spec.direction)) return new Set();
        const rows = compareSpecRows(universities, spec);
        if (rows.length === 1 && spec.allowSinglePublishedAdvantage) return new Set([rows[0].id]);
        if (rows.length < 2) return new Set();
        const sorted = rows.slice().sort((a, b) => spec.direction === "higher" ? b.value - a.value : a.value - b.value);
        const best = sorted[0]?.value;
        if (!Number.isFinite(best)) return new Set();
        const bestRows = sorted.filter((row) => Math.abs(row.value - best) <= 0.000001);
        return bestRows.length === 1 ? new Set([bestRows[0].id]) : new Set();
    };

    const compareMetrics = (universities) => {
        const specs = buildCompareSpecs(universities);
        const bestBySpec = new Map(specs.map((spec) => [spec.key, compareBestIdsForSpec(universities, spec)]));
        const firstBestId = (key) => Array.from(bestBySpec.get(key) || [])[0] || "";
        return {
            specs,
            bestBySpec,
            bestRankId: firstBestId("rank"),
            lowestCostId: firstBestId("total_cost"),
            highestAcceptanceId: firstBestId("acceptance"),
        };
    };

    const compareCell = (text, opts = {}) => {
        const tone = opts.tone ? ` compare-cell--${opts.tone}` : "";
        const sub = opts.sub ? `<small>${escapeHtml(opts.sub)}</small>` : "";
        return `<td class="compare-cell${tone}"><span>${escapeHtml(text || t("common.na", "N/A"))}</span>${sub}</td>`;
    };

    const compareSectionRow = (label, kind, universities, renderValue) => `
        <tr class="compare-table__section-row" data-section="${escapeHtmlAttr(kind)}">
            <td colspan="${universities.length + 1}">${escapeHtml(label)}</td>
        </tr>
    `;

    const compareDataRow = (label, universities, renderValue) => `
        <tr>
            <td>${escapeHtml(label)}</td>
            ${universities.map((u) => {
                const value = renderValue(u);
                if (value && typeof value === "object") return compareCell(value.text, value);
                return compareCell(String(value || ""));
            }).join("")}
        </tr>
    `;

    const compareSpecValue = (spec, u, metrics) => {
        const raw = compareSpecRawValue(spec, u);
        const text = raw === null || raw === undefined || raw === ""
            ? t("common.na", "N/A")
            : (spec.formatter ? spec.formatter(raw, u) : String(raw));
        const bestIds = metrics.bestBySpec?.get(spec.key) || new Set();
        return {
            text,
            tone: bestIds.has(String(u?.id || "")) ? "best" : "",
            sub: spec.sourceKey ? compareSourceText(u, spec.sourceKey) : "",
        };
    };

    const compareRowsHtml = (universities, metrics) => {
        const sections = compareSpecSections();
        const sectionOrder = ["overview", "programs", "admissions", "finance", "outcomes", "data", "context"];
        const orderedSpecs = (metrics.specs || []).slice().sort((a, b) => {
            const left = sectionOrder.includes(a.section) ? sectionOrder.indexOf(a.section) : sectionOrder.length;
            const right = sectionOrder.includes(b.section) ? sectionOrder.indexOf(b.section) : sectionOrder.length;
            if (left !== right) return left - right;
            return (a.order || 0) - (b.order || 0);
        });
        let currentSection = "";
        return orderedSpecs.map((spec) => {
            const sectionHtml = spec.section !== currentSection
                ? compareSectionRow(sections[spec.section] || humanizeMachineLabel(spec.section, spec.section), spec.section, universities)
                : "";
            currentSection = spec.section;
            return `${sectionHtml}${compareDataRow(spec.label, universities, (u) => compareSpecValue(spec, u, metrics))}`;
        }).join("");
    };

    const valueRows = (universities, getter) => universities
        .map((u) => ({ university: u, id: String(u?.id || ""), value: getter(u) }))
        .filter((row) => row.id && row.value !== null && Number.isFinite(row.value));

    const averageOtherValue = (rows, selectedId) => {
        const others = rows.filter((row) => row.id !== selectedId);
        if (!others.length) return null;
        const sum = others.reduce((acc, row) => acc + row.value, 0);
        return sum / others.length;
    };

    const percentDeltaText = (value, average, inverse = false) => {
        if (!Number.isFinite(value) || !Number.isFinite(average) || average <= 0) return "";
        const delta = inverse ? ((average - value) / average) : ((value - average) / average);
        if (!Number.isFinite(delta) || delta <= 0.005) return "";
        return `${Math.round(delta * 100)}%`;
    };

    const compareAdvantageText = (spec, row, baseline) => {
        const name = compareUniversityName(row.university);
        const metric = spec.label;
        const valueText = spec.formatter ? spec.formatter(row.value, row.university) : String(row.value);
        const baselineText = baseline ? (spec.formatter ? spec.formatter(baseline.value, baseline.university) : String(baseline.value)) : "";
        if (spec.reasonMode === "rank") {
            return tFormat(
                "universities.compare.reason.rank",
                { name, metric, value: valueText },
                `Best published rank: ${valueText}.`
            );
        }
        if (spec.reasonMode === "aid") {
            return tFormat(
                "universities.compare.reason.best",
                { name, metric, value: valueText },
                `${metric}: ${valueText}.`
            );
        }
        const delta = baseline ? percentDeltaText(row.value, baseline.value, spec.direction === "lower") : "";
        if (delta) {
            const key = spec.direction === "lower"
                ? "universities.compare.reason.lower_percent"
                : "universities.compare.reason.higher_percent";
            const fallback = spec.direction === "lower"
                ? `${metric}: ${valueText} instead of ${baselineText}.`
                : `${metric}: ${valueText} instead of ${baselineText}.`;
            return tFormat(key, { name, metric, percent: delta, value: valueText, baseline: baselineText }, fallback);
        }
        const key = spec.direction === "lower"
            ? "universities.compare.reason.lowest"
            : "universities.compare.reason.highest";
        const fallback = spec.direction === "lower"
            ? `Lowest ${metric}: ${valueText}.`
            : `Highest ${metric}: ${valueText}.`;
        return tFormat(key, { name, metric, value: valueText }, fallback);
    };

    const buildCompareAdvantages = (universities, metrics) => {
        const byUniversity = new Map(universities.map((u) => [String(u?.id || ""), []]));
        (metrics.specs || []).forEach((spec) => {
            if (spec.reason === false || !["higher", "lower"].includes(spec.direction)) return;
            const rows = compareSpecRows(universities, spec);
            if (rows.length === 1 && spec.allowSinglePublishedAdvantage) {
                const target = byUniversity.get(rows[0].id);
                if (!target) return;
                target.push({
                    key: spec.key,
                    category: spec.category,
                    strength: (spec.weight || 1) * 0.12,
                    text: compareAdvantageText(spec, rows[0], null),
                });
                return;
            }
            if (rows.length < 2) return;
            const sorted = rows.slice().sort((a, b) => spec.direction === "higher" ? b.value - a.value : a.value - b.value);
            const bestValue = sorted[0]?.value;
            if (!Number.isFinite(bestValue)) return;
            const bestRows = sorted.filter((row) => Math.abs(row.value - bestValue) <= 0.000001);
            if (bestRows.length !== 1) return;
            const best = bestRows[0];
            const baseline = sorted.find((row) => row.id !== best.id) || null;
            const strengthDelta = baseline && Number.isFinite(baseline.value) && baseline.value > 0
                ? Math.abs(best.value - baseline.value) / Math.abs(baseline.value)
                : 0.08;
            const categoryBoost = spec.weight || 1;
            const strength = Math.max(0.02, strengthDelta) * categoryBoost;
            const target = byUniversity.get(best.id);
            if (!target) return;
            target.push({
                key: spec.key,
                category: spec.category,
                strength,
                text: compareAdvantageText(spec, best, baseline),
            });
        });
        byUniversity.forEach((items, id) => {
            byUniversity.set(id, items.sort((a, b) => b.strength - a.strength).slice(0, 6));
        });
        return byUniversity;
    };

    const buildCompareKeyDifferencesHtml = (universities, metrics) => {
        const advantages = buildCompareAdvantages(universities, metrics);
        return `
            <section class="compare-analysis-block compare-key-differences" aria-labelledby="compareKeyDifferencesTitle">
                <div class="compare-block-head">
                    <div class="compare-block-icon">${renderInlineIcon("sparkles", 20, "compare-block-icon-svg")}</div>
                    <div>
                        <h2 id="compareKeyDifferencesTitle">${escapeHtml(t("universities.compare.differences.title", "Key differences"))}</h2>
                        <p>${escapeHtml(t("universities.compare.differences.subtitle", "Shows the clearest published advantages for each selected university."))}</p>
                    </div>
                </div>
                <div class="compare-reasons compare-reasons--pair">
                    ${universities.map((u, index) => {
                        const id = String(u?.id || "");
                        const items = advantages.get(id) || [];
                        return `
                            <article class="compare-reason-group" data-compare-slot="${index + 1}">
                                <span class="compare-reason-slot">${escapeHtml(compareSlotLabel(index))}</span>
                                <h3>${escapeHtml(tFormat("universities.compare.differences.reasons_for", { name: compareUniversityName(u) }, compareUniversityName(u)))}</h3>
                                ${items.length ? `
                                    <ul class="compare-reason-list">
                                        ${items.map((item) => `
                                            <li>
                                                <span class="compare-reason-icon">${renderInlineIcon("check-circle", 18, "compare-reason-icon-svg")}</span>
                                                <span>${escapeHtml(item.text)}</span>
                                            </li>
                                        `).join("")}
                                    </ul>
                                ` : `<p class="compare-reason-empty">${escapeHtml(t("universities.compare.differences.no_clear_advantage", "No clear published advantage found across comparable metrics."))}</p>`}
                            </article>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    };

    const compareNormalizedScore = (value, min, max, direction) => {
        if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return null;
        if (Math.abs(max - min) <= 0.000001) return 50;
        const normalized = (value - min) / (max - min);
        const score = direction === "lower" ? (1 - normalized) : normalized;
        return Math.max(0, Math.min(100, Math.round(score * 100)));
    };

    const buildCompareCategoryScores = (universities, metrics) => {
        const scores = new Map(universities.map((u) => [String(u?.id || ""), new Map()]));
        (metrics.specs || []).forEach((spec) => {
            if (spec.score === false || !["higher", "lower"].includes(spec.direction) || !spec.category) return;
            const rows = compareSpecRows(universities, spec);
            if (rows.length < 2) return;
            const values = rows.map((row) => row.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            rows.forEach((row) => {
                const score = compareNormalizedScore(row.value, min, max, spec.direction);
                if (score === null) return;
                const byCategory = scores.get(row.id);
                if (!byCategory) return;
                const list = byCategory.get(spec.category) || [];
                list.push({ score, weight: spec.weight || 1 });
                byCategory.set(spec.category, list);
            });
        });
        const averaged = new Map();
        scores.forEach((byCategory, id) => {
            const result = new Map();
            byCategory.forEach((items, category) => {
                const weightSum = items.reduce((sum, item) => sum + item.weight, 0);
                const scoreSum = items.reduce((sum, item) => sum + (item.score * item.weight), 0);
                if (weightSum > 0) result.set(category, Math.round(scoreSum / weightSum));
            });
            averaged.set(id, result);
        });
        return averaged;
    };

    const buildCompareOverviewHtml = (universities, metrics) => {
        const categoryMeta = compareCategoryMeta();
        const scores = buildCompareCategoryScores(universities, metrics);
        const categories = Object.keys(categoryMeta).filter((category) => (
            universities.some((u) => scores.get(String(u?.id || ""))?.has(category))
        ));
        if (!categories.length) return "";
        return `
            <section class="compare-analysis-block compare-overview" aria-labelledby="compareOverviewTitle">
                <div class="compare-block-head">
                    <div class="compare-block-icon">${renderInlineIcon("clipboard-document-list", 20, "compare-block-icon-svg")}</div>
                    <div>
                        <h2 id="compareOverviewTitle">${escapeHtml(t("universities.compare.overview.title", "Overview"))}</h2>
                        <p>${escapeHtml(t("universities.compare.overview.subtitle", "0-100 within this comparison only: 100 marks the stronger selected university in that category, not an absolute university score."))}</p>
                    </div>
                </div>
                <div class="compare-score-grid">
                    ${categories.map((category) => {
                        const meta = categoryMeta[category];
                        return `
                            <article class="compare-score-card">
                                <div class="compare-score-card__head">
                                    <span>${renderInlineIcon(meta.icon, 18, "compare-score-card-icon")}</span>
                                    <div>
                                        <h3>${escapeHtml(meta.title)}</h3>
                                        <p>${escapeHtml(meta.subtitle)}</p>
                                    </div>
                                </div>
                                <div class="compare-score-list">
                                    ${universities.map((u) => {
                                        const id = String(u?.id || "");
                                        const score = scores.get(id)?.get(category);
                                        const width = Number.isFinite(score) ? Math.max(0, score) : 0;
                                        return `
                                            <div class="compare-score-row">
                                                <div class="compare-score-row__top">
                                                    <span>${escapeHtml(compareUniversityName(u))}</span>
                                                    <strong>${Number.isFinite(score) ? tFormat("universities.compare.score_value", { score: String(score) }, `${score}/100`) : t("common.na", "N/A")}</strong>
                                                </div>
                                                <div class="compare-score-track" aria-hidden="true"><span style="width:${width}%"></span></div>
                                            </div>
                                        `;
                                    }).join("")}
                                </div>
                            </article>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    };

    const buildCompareConclusionHtml = (universities, metrics) => {
        const categoryMeta = compareCategoryMeta();
        const scores = buildCompareCategoryScores(universities, metrics);
        const winners = Object.keys(categoryMeta).map((category) => {
            const rows = universities
                .map((u) => ({ university: u, id: String(u?.id || ""), score: scores.get(String(u?.id || ""))?.get(category) }))
                .filter((row) => Number.isFinite(row.score))
                .sort((a, b) => b.score - a.score);
            if (!rows.length) return null;
            return { category, title: categoryMeta[category].title, university: rows[0].university, score: rows[0].score };
        }).filter(Boolean);
        const unique = [];
        winners.forEach((winner) => {
            if (unique.some((row) => row.category === winner.category && String(row.university?.id || "") === String(winner.university?.id || ""))) return;
            unique.push(winner);
        });
        const selected = unique.slice(0, 3);
        const body = selected.length
            ? tFormat(
                "universities.compare.conclusion.body",
                {
                    summary: selected.map((row) => `${row.title}: ${compareUniversityName(row.university)}`).join("; "),
                },
                `Best relative fits by category: ${selected.map((row) => `${row.title}: ${compareUniversityName(row.university)}`).join("; ")}.`
            )
            : t("universities.compare.conclusion.empty", "The selected universities are close on the comparable published metrics. Use the highlighted table rows and official sources before making the final decision.");
        return `
            <section class="compare-analysis-block compare-conclusion" aria-labelledby="compareConclusionTitle">
                <div class="compare-block-head">
                    <div class="compare-block-icon">${renderInlineIcon("information-circle", 20, "compare-block-icon-svg")}</div>
                    <div>
                        <h2 id="compareConclusionTitle">${escapeHtml(t("universities.compare.conclusion.title", "Conclusion"))}</h2>
                        <p>${escapeHtml(body)}</p>
                    </div>
                </div>
            </section>
        `;
    };

    const compareCardsHtml = (universities, metrics) => universities.map((u, index) => {
        const id = String(u?.id || "");
        const logoSrc = uniLogoSrc(id);
        const logoSrcFull = uniLogoSrc(id, { forceFull: true });
        const badges = compareBestBadges(u, metrics);
        return `
            <article class="compare-uni-card compare-uni-card--pair" data-compare-slot="${index + 1}" data-uni-id="${escapeHtmlAttr(id)}">
                <div class="compare-uni-card__head">
                    <div class="compare-uni-card__identity">
                        <span class="compare-uni-card__slot">${escapeHtml(compareSlotLabel(index))}</span>
                        <div class="compare-uni-card__logo">
                            <img src="${logoSrc}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(compareUniversityName(u)))}">
                        </div>
                    </div>
                </div>
                <h3>${escapeHtml(compareUniversityName(u))}</h3>
                <p>${escapeHtml(compareLocationText(u))}</p>
                <div class="compare-uni-card__metrics">
                    <span><small>${escapeHtml(translateWord("global_rank", "Rank"))}</small><strong>${escapeHtml(compareRankText(u))}</strong></span>
                    <span><small>${escapeHtml(t("universities.card.cost_short", "Cost"))}</small><strong>${escapeHtml(formatCompareCost(compareSelectedAnnualCost(u)))}</strong></span>
                    <span><small>${escapeHtml(t("ranking.acceptance", "Acceptance"))}</small><strong>${escapeHtml(compareAcceptanceText(u))}</strong></span>
                </div>
                ${(() => {
                    const uniChance = compareChancesByUniId.get(id);
                    const selectedKey = compareChoiceKey(compareAdmissionChoices.get(id));
                    const trackChance = (uniChance?.choices || []).find((x) => String(x.choiceKey) === selectedKey);
                    return trackChance ? `<div class="compare-uni-card__chance">${renderTrackChanceChip(trackChance)}</div>` : "";
                })()}
                ${badges.length ? `<div class="compare-uni-card__badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
                <a class="compare-uni-card__link" href="${routeUniversityDetail(id)}"${universityLinkAttrs()}>${escapeHtml(t("universities.card.view_details", "View details"))}</a>
            </article>
        `;
    }).join("");

    const compareConfigurationReady = (universities) => universities.every((u) => {
        const id = String(u?.id || "");
        return Boolean(compareChoiceKey(compareAdmissionChoices.get(id)) && compareSelectedAdmissionEntry(u));
    });

    const renderCompareConfigurePage = async (ids) => {
        if (!el.compareResultsPane) return;
        const cleanIds = normalizeCompareIdList(Array.isArray(ids) ? ids : []);
        if (cleanIds.length !== COMPARE_PAIR_SIZE) {
            state.compareStage = "select";
            await syncSectionVisibility({ shouldFetch: false, replaceUrl: true });
            return;
        }

        el.compareResultsPane.innerHTML = `
            <div class="compare-results-loading" role="status">
                <div class="skeleton-line" style="width: 42%; height: 22px;"></div>
                <div class="skeleton-line" style="width: 100%; height: 180px;"></div>
                <div class="skeleton-line" style="width: 92%; height: 180px;"></div>
            </div>
        `;

        const universities = await loadCompareUniversities(cleanIds, {
            getRenderedUniversityById,
            getUniversityDisplayNameById,
            fetchUniversityDetailCached,
        });

        if (!isCompareConfigureMode()) return;
        if (universities.length !== COMPARE_PAIR_SIZE) {
            state.compareStage = "select";
            state.compareResultIds = [];
            await syncSectionVisibility({ shouldFetch: false, replaceUrl: true });
            return;
        }

        const compareProfiles = await fetchCompareProfiles(cleanIds, {
            apiBase: API_BASE,
            fetchImpl: fetch,
            loadProfileForApi,
        });
        compareChancesByUniId = compareProfiles.chances;

        let changedChoices = false;
        universities.forEach((u) => {
            const id = String(u?.id || "");
            if (id) {
                const entries = compareAdmissionOptionEntries(u);
                const currentKey = compareChoiceKey(compareAdmissionChoices.get(id));
                const hasValidChoice = Boolean(currentKey && entries.some((entry) => entry.key === currentKey));
                if (hasValidChoice) return;

                const uniChance = compareChancesByUniId.get(id);
                const recommendedKey = String(uniChance?.selectedChoiceKey || uniChance?.recommendedChoiceKey || uniChance?.bestChoiceKey || "").trim();
                if (entries.length) {
                    const match = recommendedKey ? entries.find(e => e.key === recommendedKey) : null;
                    compareAdmissionChoices.set(id, compareAdmissionSelectionFromEntry(match || entries[0]));
                    changedChoices = true;
                }
            }
        });
        if (changedChoices) {
            writeCompareAdmissionChoices();
            setSectionUrl(true);
        }

        const ready = compareConfigurationReady(universities);
        el.compareResultsPane.innerHTML = `
            <div class="compare-results-head compare-results-head--pair">
                <div>
                    <p class="compare-results-kicker">${escapeHtml(t("universities.compare.configure.kicker", "Before comparison"))}</p>
                    <h1>${escapeHtml(t("universities.compare.configure.title", "Choose admission choices"))}</h1>
                    <p class="compare-config-subtitle">${escapeHtml(t("universities.compare.configure.subtitle", "Pick one admission category, requirement profile, and funding option for each university. The comparison will use that choice for requirements, language proof, cost, and funding."))}</p>
                </div>
                <div class="compare-results-actions">
                    <button class="compare-results-action compare-results-action--ghost" type="button" data-action="back-to-compare-select">${escapeHtml(t("universities.compare.results.back_to_selection", "Back to selection"))}</button>
                    <button class="compare-results-action" type="button" data-action="build-compare-results"${ready ? "" : " disabled"}>${escapeHtml(t("universities.compare.continue", "Continue"))}</button>
                </div>
            </div>
            <section class="compare-config-panel" aria-label="${escapeHtmlAttr(t("universities.compare.configure.title", "Choose admission choices"))}">
                ${universities.map((u, index) => {
                    const id = String(u?.id || "");
                    const selected = compareChoiceKey(compareAdmissionChoices.get(id));
                    return `
                        <article class="compare-config-column" data-uni-id="${escapeHtmlAttr(id)}">
                            <div class="compare-config-column__head">
                                <span>${escapeHtml(compareSlotLabel(index))}</span>
                                <h2>${escapeHtml(compareUniversityName(u))}</h2>
                                <p>${escapeHtml(selected ? t("universities.compare.configure.selected", "Admission choice selected") : t("universities.compare.configure.required", "Select one option before comparing"))}</p>
                            </div>
                            <div class="compare-config-chance">
                                ${renderUniChanceSummary(compareChancesByUniId.get(id))}
                            </div>
                            <div class="compare-config-options" id="compare-options-${escapeHtmlAttr(id)}">
                            </div>
                        </article>
                    `;
                }).join("")}
            </section>
        `;

        universities.forEach((u) => {
            const id = String(u?.id || "");
            const container = el.compareResultsPane.querySelector(`#compare-options-${id}`);
            if (container) {
                const uniChance = compareChancesByUniId.get(id);
                const uniChanceByChoiceKey = new Map((uniChance?.choices || []).map((choice) => [String(choice.choiceKey), choice]));
                const profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || loadProfile()?.study_mode || "");
                const annualCostForTrack = (track) => modeAwareAnnualCost(((track && track.finance_override) || u.finance || {}), profileStudyMode);

                renderAdmissionSection({
                    annualCostForTrack,
                    container,
                    uniChance,
                    uniChanceByChoiceKey,
                    university: u,
                    effectiveSelectedChoiceKeyOverride: compareChoiceKey(compareAdmissionChoices.get(id)),
                    compactMode: true,
                    onChoiceSelected: (selection) => {
                        const entry = compareAdmissionOptionEntries(u).find(e => e.key === selection.choiceKey);
                        const fullSelection = compareAdmissionSelectionFromEntry(entry);
                        compareAdmissionChoices.set(id, fullSelection);
                        writeCompareAdmissionChoices();
                        setSectionUrl(true);
                        renderCompareConfigurePage(state.compareResultIds).catch((err) => console.error(err));
                    }
                });
            }
        });

        applyPercentWidths(el.compareResultsPane);
        markMotionEnter(el.compareResultsPane, ".compare-config-column, .admission-category-card", { limit: 16, staggerMs: 18 });
    };

    const renderCompareResultsPage = async (ids) => {
        if (!el.compareResultsPane) return;
        const cleanIds = normalizeCompareIdList(Array.isArray(ids) ? ids : []);
        if (cleanIds.length !== COMPARE_PAIR_SIZE) {
            el.compareResultsPane.innerHTML = `
                <div class="compare-results-empty">
                    <h2>${escapeHtml(t("universities.compare.results.empty_title", "No comparison yet"))}</h2>
                    <p>${escapeHtml(t("universities.compare.results.empty_body", "Select exactly two universities to build a comparison pair."))}</p>
                    <button class="compare-results-action" type="button" data-action="back-to-compare-select">${escapeHtml(t("universities.compare.results.back_to_selection", "Back to selection"))}</button>
                </div>
            `;
            return;
        }

        el.compareResultsPane.innerHTML = `
            <div class="compare-results-loading" role="status">
                <div class="skeleton-line" style="width: 38%; height: 22px;"></div>
                <div class="skeleton-line" style="width: 100%; height: 118px;"></div>
                <div class="skeleton-line" style="width: 92%; height: 180px;"></div>
            </div>
        `;

        const universities = await loadCompareUniversities(cleanIds, {
            getRenderedUniversityById,
            getUniversityDisplayNameById,
            fetchUniversityDetailCached,
        });
        const compareProfiles = await fetchCompareProfiles(cleanIds, {
            apiBase: API_BASE,
            fetchImpl: fetch,
            loadProfileForApi,
        });
        compareChancesByUniId = compareProfiles.chances;

        if (!isCompareResultsMode()) return;
        if (universities.length !== COMPARE_PAIR_SIZE) {
            state.compareStage = "select";
            state.compareResultIds = [];
            await syncSectionVisibility({ shouldFetch: false, replaceUrl: true });
            return;
        }
        if (!compareConfigurationReady(universities)) {
            state.compareStage = "configure";
            await syncSectionVisibility({ shouldFetch: false, replaceUrl: true });
            return;
        }

        const metrics = compareMetrics(universities);
        const rowsHtml = compareRowsHtml(universities, metrics);
        const keyDifferencesHtml = buildCompareKeyDifferencesHtml(universities, metrics);
        const overviewHtml = buildCompareOverviewHtml(universities, metrics);
        const conclusionHtml = buildCompareConclusionHtml(universities, metrics);
        el.compareResultsPane.innerHTML = `
            <div class="compare-results-head compare-results-head--pair">
                <div>
                    <p class="compare-results-kicker">${escapeHtml(t("universities.compare.results.kicker", "Comparison results"))}</p>
                    <h1>${escapeHtml(t("universities.compare.results.title", "University comparison"))}</h1>
                </div>
                <div class="compare-results-actions">
                    <button class="compare-results-action" type="button" data-action="back-to-compare-select">${escapeHtml(t("universities.compare.results.back_to_selection", "Back to selection"))}</button>
                    <button class="compare-results-action compare-results-action--ghost" type="button" data-action="clear-compare-results">${escapeHtml(t("universities.compare.clear", "Clear"))}</button>
                </div>
            </div>
            <div class="compare-uni-grid compare-uni-grid--pair">${compareCardsHtml(universities, metrics)}</div>
            ${keyDifferencesHtml}
            ${overviewHtml}
            <section class="compare-analysis-block compare-tests" aria-labelledby="compareTestsTitle">
                <div class="compare-block-head">
                    <div class="compare-block-icon">${renderInlineIcon("document-check", 20, "compare-block-icon-svg")}</div>
                    <div>
                        <h2 id="compareTestsTitle">${escapeHtml(t("universities.compare.tests.title", "Tests and characteristics"))}</h2>
                        <p>${escapeHtml(t("universities.compare.tests.subtitle", "Detailed table of published values. Green cells mark the strongest comparable value in each row."))}</p>
                    </div>
                </div>
                <div class="compare-table-wrap compare-table-wrap--pair">
                    <table class="compare-table">
                        <thead>
                            <tr>
                                <th>${escapeHtml(t("universities.compare.row.metric", "Metric"))}</th>
                                ${universities.map((u) => `<th>${escapeHtml(compareUniversityName(u))}</th>`).join("")}
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </section>
            ${conclusionHtml}
        `;
        bindImageFallbacks(el.compareResultsPane);
        markMotionEnter(el.compareResultsPane, ".compare-analysis-block, .compare-uni-card", { limit: 12, staggerMs: 18 });
    };

    const openCompareResultsPage = async () => {
        const ids = comparePairIds();
        if (ids.length !== COMPARE_PAIR_SIZE) return;
        state.activeTab = "compare";
        state.compareStage = "configure";
        state.compareResultIds = ids;
        persistSavedAndCompare();
        await syncSectionVisibility({ shouldFetch: false, updateUrl: true, replaceUrl: false });
        scrollUniversitiesPageTop("auto");
    };

    const buildConfiguredCompareResults = async () => {
        const ids = normalizeCompareIdList(state.compareResultIds);
        if (ids.length !== COMPARE_PAIR_SIZE) return;
        state.activeTab = "compare";
        state.compareStage = "results";
        state.compareResultIds = ids;
        persistSavedAndCompare();
        await syncSectionVisibility({ shouldFetch: false, updateUrl: true, replaceUrl: false });
        scrollUniversitiesPageTop("auto");
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
            const width = Math.ceil(chip.getBoundingClientRect().width);
            if (width > 0) {
                chip.style.setProperty("--recent-chip-width", `${width}px`);
            }
        });
    };

    const renderRecentlyViewedBar = () => {
        if (!el.recentlyViewedBar) return;
        const recentIds = readIdListStorage(RECENT_UNIVERSITIES_KEY).slice(0, 6);
        if (!recentIds.length) {
            el.recentlyViewedBar.hidden = true;
            el.recentlyViewedBar.innerHTML = "";
            return;
        }
        const rows = recentIds
            .map((id) => ({ id, label: getUniversityDisplayNameById(id) }))
            .filter((row) => row.label);
        if (!rows.length) {
            el.recentlyViewedBar.hidden = true;
            el.recentlyViewedBar.innerHTML = "";
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

    const persistSavedAndCompare = () => {
        setComparePairIds(comparePairIds());
        writeIdListStorage(SAVED_UNIVERSITIES_KEY, Array.from(savedUniversityIds));
        writeIdListStorage(COMPARE_UNIVERSITIES_KEY, comparePairIds());
        writeCompareAdmissionChoices();
        renderCompareTray();
        updateCompareModeStatus();
        renderRecentlyViewedBar();
        syncCardActionState();
    };

    const normalizeUniversitySearchText = (value) => String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    const acronymForUniversityName = (name) => {
        const skip = new Set(["of", "the", "and", "for", "de", "la", "le"]);
        return String(name || "")
            .split(/[^\p{L}\p{N}]+/u)
            .filter((word) => word && !skip.has(word.toLowerCase()))
            .map((word) => word[0])
            .join("")
            .toLowerCase();
    };

    const universitySearchTokens = (item) => {
        const name = String(item?.name || "");
        const translatedName = trUniversityName(item);
        const id = String(item?.id || "");
        const city = String(item?.location?.city || "");
        const country = String(item?.location?.country || "");
        const aliases = Array.isArray(item?.search_aliases) ? item.search_aliases : [];
        const tokens = [
            name,
            translatedName,
            id,
            id.replace(/-/g, " "),
            city,
            trCity(city),
            country,
            trCountry(country),
            acronymForUniversityName(name),
            acronymForUniversityName(translatedName),
            ...aliases,
        ];
        return Array.from(new Set(tokens.map(normalizeUniversitySearchText).filter(Boolean)));
    };

    const matchesUniversityQuery = (item, rawQuery) => {
        const query = normalizeUniversitySearchText(rawQuery);
        if (!query) return true;
        return universitySearchTokens(item).some((token) => token.includes(query) || query.includes(token));
    };

    const ensureSearchSuggestionsNode = () => {
        if (!el.qInput) return null;
        const host = el.qInput.closest(".u-search") || el.qInput.parentElement;
        if (!host) return null;
        let node = host.querySelector(".u-search-suggestions");
        if (!node) {
            node = document.createElement("div");
            node.className = "u-search-suggestions";
            node.setAttribute("role", "listbox");
            host.appendChild(node);
        }
        return node;
    };

    const hideSearchSuggestions = () => {
        const node = ensureSearchSuggestionsNode();
        if (node) {
            node.innerHTML = "";
            node.classList.remove("is-open");
        }
    };

    const renderSearchSuggestions = () => {
        const node = ensureSearchSuggestionsNode();
        if (!node || !el.qInput) return;
        const q = String(el.qInput.value || "").trim();
        const query = normalizeUniversitySearchText(q);
        if (query.length < 2 || !lastRenderedItems.length) {
            hideSearchSuggestions();
            return;
        }
        const seen = new Set();
        const suggestions = [];
        lastRenderedItems.forEach((item) => {
            if (!matchesUniversityQuery(item, q)) return;
            const value = String(trUniversityName(item) || item?.name || "").trim();
            const key = normalizeUniversitySearchText(value || item?.id);
            if (!value || seen.has(key)) return;
            seen.add(key);
            suggestions.push(value);
        });
        if (!suggestions.length) {
            hideSearchSuggestions();
            return;
        }
        node.innerHTML = "";
        suggestions.slice(0, 7).forEach((name) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "u-search-suggestion";
            btn.setAttribute("data-value", name);
            btn.setAttribute("role", "option");
            const span = document.createElement("span");
            span.textContent = name;
            btn.appendChild(span);
            node.appendChild(btn);
        });
        node.classList.add("is-open");
        markMotionEnter(node, ".u-search-suggestion", { limit: 7, staggerMs: 14 });
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
                <div class="u-map-results-head u-map-results-head--loading">
                    <div class="skeleton-line" style="width: 42%; height: 22px;"></div>
                    <div class="skeleton-line" style="width: min(520px, 78%); height: 13px;"></div>
                </div>
                <div class="u-map-results-list u-map-results-list--loading">
                    ${Array.from({ length: cardCount }, () => `
                        <article class="u-map-result-card u-map-result-card--loading is-skeleton" aria-hidden="true">
                            <div class="u-map-result-focus">
                                <span class="u-map-result-logo"></span>
                                <span class="u-map-result-copy">
                                    <span class="skeleton-line" style="width: 84%; height: 15px;"></span>
                                    <span class="skeleton-line" style="width: 58%; height: 12px;"></span>
                                </span>
                                <span class="skeleton-line u-map-result-rank" style="width: 38px; height: 18px;"></span>
                            </div>
                            <div class="u-map-result-bottom">
                                <span class="skeleton-line" style="width: 72px; height: 14px;"></span>
                                <span class="skeleton-line" style="width: 96px; height: 14px;"></span>
                            </div>
                        </article>
                    `).join("")}
                </div>
            </div>
        `;
    }

    function setUniversitiesLoading(isLoading) {
        const mapMode = state.viewMode === "map";
        const showListSkeleton = !!isLoading && !mapMode;
        if (el.content) {
            el.content.setAttribute("aria-busy", isLoading ? "true" : "false");
        }
        if (el.skeleton) {
            if (showListSkeleton) {
                const skeletonCount = getUniversitiesSkeletonCount();
                if (!el.skeleton.innerHTML.trim() || el.skeleton.dataset.count !== String(skeletonCount)) {
                    el.skeleton.dataset.count = String(skeletonCount);
                    el.skeleton.innerHTML = Array.from({ length: skeletonCount }, () => `
                        <article class="uni-card u-skeleton-card is-skeleton" aria-hidden="true">
                            <div class="uni-media">
                                <div class="uni-price" aria-hidden="true">
                                    <div class="skeleton-line" style="width: 64px; height: 11px; margin-left: auto;"></div>
                                    <div class="skeleton-line" style="width: 56px; height: 18px; margin: 6px 0 0 auto;"></div>
                                </div>
                                <div class="uni-logo" aria-hidden="true"></div>
                            </div>
                            <div class="uni-body">
                                <div class="skeleton-line" style="width: 86%; height: 17px;"></div>
                                <div class="skeleton-line" style="width: 62%; height: 17px;"></div>
                                <div class="skeleton-line" style="width: 58%;"></div>
                                <div class="skeleton-line" style="width: 72%;"></div>
                                <div class="skeleton-line" style="width: 100%; height: 68px; border-radius: 12px; margin-top: 8px;"></div>
                                <div class="skeleton-line" style="width: 42%; height: 14px; margin-top: auto;"></div>
                            </div>
                        </article>
                    `).join("");
                }
                el.skeleton.style.display = "grid";
                el.skeleton.setAttribute("aria-hidden", "false");
            } else {
                el.skeleton.style.display = "none";
                el.skeleton.setAttribute("aria-hidden", "true");
            }
        }
        if (el.list) {
            el.list.style.display = mapMode ? "none" : "grid";
            el.list.style.visibility = showListSkeleton ? "hidden" : "visible";
        }
        if (el.pagination && !mapMode) {
            el.pagination.style.visibility = showListSkeleton ? "hidden" : "visible";
        }
        if (el.mapStage) {
            el.mapStage.classList.toggle("is-loading", !!isLoading && mapMode);
        }
        if (el.mapResults) {
            el.mapResults.setAttribute("aria-busy", isLoading && mapMode ? "true" : "false");
            if (isLoading && mapMode) renderMapLoadingSkeleton();
        }
    }

    const ensureUniversitiesTourModal = () => {
        let modal = document.getElementById("universitiesTourModal");
        if (modal) {
            return modal;
        }

        modal = document.createElement("div");
        modal.id = "universitiesTourModal";
        modal.className = "u-tour-modal";
        modal.setAttribute("aria-hidden", "true");
        modal.style.display = "none";
        modal.innerHTML = `
            <div class="u-tour-backdrop" data-action="close"></div>
            <div class="u-tour-card" role="dialog" aria-modal="true" aria-labelledby="uTourTitle">
                <button class="u-tour-close" type="button" data-action="close" aria-label="${escapeHtml(t("tour.close", "Close tour"))}" title="${escapeHtml(t("tour.close", "Close tour"))}">${renderInlineIcon("x-mark", 18, "u-tour-close-icon")}</button>
                <div class="u-tour-progress">
                    <span id="uTourProgressLabel"></span>
                    <div id="uTourDots" class="u-tour-dots"></div>
                </div>
                <div id="uTourSlide" class="u-tour-slide" aria-live="polite"></div>
                <div class="u-tour-actions">
                    <button class="u-tour-btn u-tour-btn--ghost" type="button" data-action="skip">${escapeHtml(t("tour.skip", "Skip"))}</button>
                    <div class="u-tour-actions-right">
                        <button class="u-tour-btn u-tour-btn--ghost" type="button" data-action="prev">${escapeHtml(t("tour.back", "Back"))}</button>
                        <button class="u-tour-btn u-tour-btn--primary" type="button" data-action="next">${escapeHtml(t("tour.next", "Next"))}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    };

    const showUniversitiesTour = () => new Promise((resolve) => {
        const modal = ensureUniversitiesTourModal();
        const slideEl = modal.querySelector("#uTourSlide");
        const dotsEl = modal.querySelector("#uTourDots");
        const progressLabelEl = modal.querySelector("#uTourProgressLabel");
        const prevBtn = modal.querySelector("[data-action='prev']");
        const nextBtn = modal.querySelector("[data-action='next']");
        const skipBtn = modal.querySelector("[data-action='skip']");
        const actionsEl = modal.querySelector(".u-tour-actions");
        const closeEls = modal.querySelectorAll("[data-action='close']");

        const steps = [
            {
                kicker: t("tour.step1.kicker", "Welcome"),
                title: t("tour.step1.title", "Find universities faster"),
                desc: t("tour.step1.desc", "This page helps you quickly pick universities by country, cost, and your profile."),
                points: [
                    t("tour.step1.point1", "Use search + filters in the left panel."),
                    t("tour.step1.point2", "Switch between List and Map view on the top right."),
                    tFormat("tour.step1.point3", { fit: aiName("fit") }, `Use ${aiName("fit")} to sort by personalized fit.`),
                ],
                action: "",
            },
            {
                kicker: t("tour.step2.kicker", "Step 1"),
                title: t("tour.step2.title", "Fill your profile first"),
                desc: t("tour.step2.desc", "Profile data makes recommendations and admission estimates more accurate."),
                points: [
                    t("tour.step2.point1", "Add budget, major, and GPA."),
                    t("tour.step2.point2", "Add exam and language scores."),
                    tFormat("tour.step2.point3", { fit: aiName("fit"), chance: aiName("chance") }, `This improves ${aiName("fit")} and ${aiName("chance")} quality.`),
                ],
                action: "open_profile",
            },
            {
                kicker: t("tour.step3.kicker", "Step 2"),
                title: t("tour.step3.title", "Use filtering strategically"),
                desc: t("tour.step3.desc", "Start broad, then narrow by country, city, cost range, study level, and funding type."),
                points: [
                    t("tour.step3.point1", "Adjust tuition min/max with the slider."),
                    t("tour.step3.point2", "Use the grant/paid funding filter for finance planning."),
                    t("tour.step3.point3", "Use map view to spot location clusters."),
                ],
                action: "",
            },
            {
                kicker: t("tour.step4.kicker", "Step 3"),
                title: t("tour.step4.title", "Open details and compare admission choices"),
                desc: t("tour.step4.desc", "Click any card to inspect admission categories, requirement profiles, finance, and requirements."),
                points: [
                    tFormat("tour.step4.point1", { chance: aiName("chance") }, `Review ${aiName("chance")} by selected requirement profile in the detail page.`),
                    t("tour.step4.point2", "Check Admission and Costs tabs for requirement and funding details."),
                    t("tour.step4.point3", "Compare yearly cost and scholarships before applying."),
                ],
                action: "",
            },
        ];

        let idx = 0;
        let isPausedForProfile = false;

        const renderStep = (direction = "forward") => {
            const step = steps[idx];
            if (!step || !slideEl || !dotsEl || !progressLabelEl || !prevBtn || !nextBtn || !skipBtn || !actionsEl) return;

            progressLabelEl.textContent = "";
            progressLabelEl.style.display = "none";
            dotsEl.innerHTML = steps
                .map((_, i) => `<span class="u-tour-dot ${i === idx ? "is-active" : ""}" aria-hidden="true"></span>`)
                .join("");

            const actionHtml = step.action === "open_profile"
                ? `<button class="u-tour-inline-btn" type="button" data-action="open-profile">${escapeHtml(t("tour.open_profile", "Open Profile"))}</button>`
                : "";

            slideEl.classList.remove("is-enter-forward", "is-enter-back");
            void slideEl.offsetWidth;
            slideEl.classList.add(direction === "back" ? "is-enter-back" : "is-enter-forward");
            slideEl.innerHTML = `
                <article class="u-tour-step">
                    <div class="u-tour-kicker">${escapeHtml(step.kicker || "")}</div>
                    <h3 id="uTourTitle" class="u-tour-title">${escapeHtml(step.title)}</h3>
                    <p class="u-tour-desc">${escapeHtml(step.desc)}</p>
                    <ul class="u-tour-list">
                        ${step.points.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
                    </ul>
                    ${actionHtml}
                </article>
            `;

            slideEl.querySelector("[data-action='open-profile']")?.addEventListener("click", () => {
                const profileBtn = document.getElementById("profileBtn");
                if (!profileBtn) return;

                isPausedForProfile = true;
                closeMotionLayer(modal, () => {
                    modal.classList.remove("is-open", "is-closing");
                    modal.setAttribute("aria-hidden", "true");
                    modal.style.display = "none";
                    profileBtn.click();
                });

                const onProfileClosed = () => {
                    isPausedForProfile = false;
                    modal.style.display = "flex";
                    modal.classList.remove("is-closing");
                    modal.classList.add("is-open");
                    modal.setAttribute("aria-hidden", "false");
                    nextBtn?.focus();
                };

                window.addEventListener("profileModalClosed", onProfileClosed, { once: true });
            });

            prevBtn.disabled = idx === 0;
            prevBtn.style.display = idx === 0 ? "none" : "";
            nextBtn.textContent = idx === steps.length - 1 ? t("tour.finish", "Finish") : t("tour.next", "Next");
            skipBtn.textContent = t("tour.skip", "Skip");
            skipBtn.disabled = idx === steps.length - 1;
            skipBtn.style.display = idx === steps.length - 1 ? "none" : "";
            skipBtn.style.visibility = idx === steps.length - 1 ? "hidden" : "visible";
            actionsEl.style.justifyContent = idx === steps.length - 1 ? "flex-end" : "space-between";
        };

        const cleanup = () => {
            nextBtn?.removeEventListener("click", onNext);
            prevBtn?.removeEventListener("click", onPrev);
            skipBtn?.removeEventListener("click", onSkip);
            closeEls.forEach((el) => el.removeEventListener("click", onSkip));
            document.removeEventListener("keydown", onKey);
            closeMotionLayer(modal, () => {
                modal.classList.remove("is-open", "is-closing");
                modal.setAttribute("aria-hidden", "true");
                modal.style.display = "none";
                resolve();
            });
        };

        const onNext = () => {
            if (idx >= steps.length - 1) {
                cleanup();
                return;
            }
            idx += 1;
            renderStep("forward");
        };

        const onPrev = () => {
            if (idx <= 0) return;
            idx -= 1;
            renderStep("back");
        };

        const onSkip = () => cleanup();

        const onKey = (e) => {
            if (isPausedForProfile) return;
            if (e.key === "Escape") {
                e.preventDefault();
                cleanup();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                onNext();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                onPrev();
            }
        };

        markUniversitiesTourSeen();
        renderStep("forward");

        nextBtn?.addEventListener("click", onNext);
        prevBtn?.addEventListener("click", onPrev);
        skipBtn?.addEventListener("click", onSkip);
        closeEls.forEach((el) => el.addEventListener("click", onSkip));
        document.addEventListener("keydown", onKey);

        modal.style.display = "flex";
        modal.classList.remove("is-closing");
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        nextBtn?.focus();
    });

    const ensureUniFitWarningModal = () => {
        let modal = document.getElementById("unifitWarningModal");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "unifitWarningModal";
        modal.className = "unifit-warning-modal";
        modal.setAttribute("aria-hidden", "true");
        modal.style.display = "none";
        modal.innerHTML = `
            <div class="unifit-warning-backdrop" data-action="cancel"></div>
            <div class="unifit-warning-card" role="dialog" aria-modal="true" aria-labelledby="unifitWarningTitle">
                <div class="unifit-warning-icon">${renderInlineIcon("exclamation-triangle", 20, "unifit-warning-icon-svg")}</div>
                <div class="unifit-warning-content">
                    <h3 id="unifitWarningTitle">${escapeHtml(t("unifit.warning.title", "Limited Profile Data"))}</h3>
                    <p>${escapeHtml(t("unifit.warning.desc", "UniFit is more accurate when your profile includes exam or language scores."))}</p>
                </div>
                <div class="unifit-warning-actions">
                    <button class="unifit-warning-btn unifit-warning-confirm" data-action="confirm" type="button">${escapeHtml(t("unifit.warning.confirm", "Okay I understand"))}</button>
                    <button class="unifit-warning-btn unifit-warning-cancel" data-action="cancel" type="button">${escapeHtml(t("unifit.warning.cancel", "Cancel"))}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    };

    const showUniFitWarning = () => new Promise((resolve) => {
        uniFitWarningShownInSession = true;
        const modal = ensureUniFitWarningModal();
        const okBtn = modal.querySelector("[data-action='confirm']");
        const cancelEls = modal.querySelectorAll("[data-action='cancel']");

        const cleanup = (result) => {
            okBtn?.removeEventListener("click", onOk);
            cancelEls.forEach((el) => el.removeEventListener("click", onCancel));
            document.removeEventListener("keydown", onKey);
            closeMotionLayer(modal, () => {
                modal.classList.remove("is-open", "is-closing");
                modal.setAttribute("aria-hidden", "true");
                modal.style.display = "none";
                resolve(result);
            });
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                cleanup(false);
            }
        };

        okBtn?.addEventListener("click", onOk);
        cancelEls.forEach((el) => el.addEventListener("click", onCancel));
        document.addEventListener("keydown", onKey);

        modal.style.display = "flex";
        modal.classList.remove("is-closing");
        modal.classList.add("is-open");
        modal.removeAttribute("aria-hidden");
        okBtn?.focus();
    });

    // --- Sliders ---
    function fillTrack() {
        if (!el.minSlider || !el.maxSlider || !el.track) return;
        const minVal = parseInt(el.minSlider.value); const maxVal = parseInt(el.maxSlider.value); const maxRange = parseInt(el.maxSlider.max);
        const percent1 = (minVal / maxRange) * 100; const percent2 = (maxVal / maxRange) * 100;
        const styles = getComputedStyle(document.documentElement);
        const inactive = (styles.getPropertyValue("--slider-track-inactive") || "#d4d8e0").trim();
        const active = (styles.getPropertyValue("--slider-track-active") || "#5d17ea").trim();
        el.track.style.background = `linear-gradient(to right, ${inactive} ${percent1}%, ${active} ${percent1}%, ${active} ${percent2}%, ${inactive} ${percent2}%)`;
    }
    function slideMin() {
        let minVal = parseInt(el.minSlider.value);
        const maxVal = parseInt(el.maxSlider.value);
        if (maxVal - minVal <= MIN_RANGE_GAP) {
            minVal = Math.max(0, maxVal - MIN_RANGE_GAP);
            el.minSlider.value = String(minVal);
        }
        el.minInput.value = el.minSlider.value; state.min_tuition = el.minSlider.value; fillTrack();
    }
    function slideMax() {
        const minVal = parseInt(el.minSlider.value);
        let maxVal = parseInt(el.maxSlider.value);
        if (maxVal - minVal <= MIN_RANGE_GAP) {
            maxVal = Math.min(MAX_TUITION, minVal + MIN_RANGE_GAP);
            el.maxSlider.value = String(maxVal);
        }
        el.maxInput.value = el.maxSlider.value; state.max_tuition = el.maxSlider.value; fillTrack();
    }

    // --- Карта ---
    let mapInstance = null;
    let markersLayer = null;
    let markersByUniId = new Map();
    let activeMapUniId = String(focusUniId || "").trim();
    let mapLibrariesPromise = null;
    let mapInitPromise = null;

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

    async function ensureIntegratedRankingAssets() {
        await loadStylesheetOnce("rankingCss", "css/ranking.css");
        if (!rankingModulePromise) rankingModulePromise = import("./ranking.js");
        return rankingModulePromise;
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

    applyToForm();
    updateSliderVisibility(); 
    
    switchView(state.viewMode, false).catch((err) => console.error(err));
    
    const setupMobileFilters = () => {
        const toggleBtn = $("mobileFilterToggle");
        const sidebar = $("uSidebar");
        if (!toggleBtn || !sidebar) return;

        const setOpen = (isOpen) => {
            sidebar.classList.toggle("is-open", isOpen);
            toggleBtn.classList.toggle("is-active", isOpen);
            if (window.innerWidth <= 980) {
                document.body.style.overflow = isOpen ? "hidden" : "";
            }
        };

        toggleBtn.addEventListener("click", () => {
            setOpen(!sidebar.classList.contains("is-open"));
        });
        el.mobileFilterClose?.addEventListener("click", () => setOpen(false));

        // Close sidebar when clicking outside on mobile backdrop
        sidebar.addEventListener("click", (e) => {
            if (window.innerWidth <= 980 && e.target === sidebar) {
                setOpen(false);
            }
        });
    };
    setupMobileFilters();

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
        updateSliderVisibility();
        updateMobileFilterUi();
        refetch();
    }

    const refetch = debounce(() => { 
        state.page = 1; 
        updateMobileFilterUi();
        saveFilters(state);
        fetchAndRender(); 
    }, 250);

    // --- Listeners ---
    el.qInput?.addEventListener("input", () => {
        state.q = el.qInput.value.trim();
        renderSearchSuggestions();
        refetch();
    });
    el.qInput?.addEventListener("blur", () => window.setTimeout(hideSearchSuggestions, 160));
    ensureSearchSuggestionsNode()?.addEventListener("click", (event) => {
        const btn = event.target instanceof Element ? event.target.closest("[data-value]") : null;
        if (!btn || !el.qInput) return;
        el.qInput.value = String(btn.getAttribute("data-value") || "");
        state.q = el.qInput.value.trim();
        hideSearchSuggestions();
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
            motionPress(btn);
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

    el.resetBtn?.addEventListener("click", () => {
        Object.assign(state, {
            q: "",
            country: "",
            region: "",
            city: "",
            study_level: "",
            funding_type: getProfileFundingQueryValue(),
            min_tuition: 0,
            max_tuition: MAX_TUITION,
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
    });

    el.list.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        const detailLink = target.closest(".uni-card-link-overlay");
        if (detailLink) {
            const card = detailLink.closest("[data-uni-id]");
            const uniId = card?.getAttribute("data-uni-id");
            if (isCompareSelectionMode()) {
                e.preventDefault();
                e.stopPropagation();
                toggleCompareUniversity(uniId, card);
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
            toggleCompareUniversity(card.getAttribute("data-uni-id"), card);
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
        toggleCompareUniversity(popupCard.getAttribute("data-uni-id"), popupCard);
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
        if (action === "open-compare") {
            openCompareResultsPage().catch((err) => console.error(err));
        }
    });

    el.tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const nextTab = normalizeUniversitiesTab(btn.getAttribute("data-universities-tab"));
            if (nextTab === state.activeTab && !(nextTab === "compare" && isCompareResultsMode())) return;
            motionPress(btn);
            state.activeTab = nextTab;
            if (nextTab !== "compare") {
                state.compareStage = "select";
                state.compareResultIds = [];
            } else if (state.compareStage !== "results") {
                state.compareStage = "select";
            }
            state.page = 1;
            saveFilters(state);
            syncSectionVisibility({
                shouldFetch: nextTab !== "ranking" && !isCompareResultsMode(),
                updateUrl: true,
                replaceUrl: false,
            }).catch((err) => console.error(err));
        });
    });

    el.compareResultsPane?.addEventListener("click", async (event) => {
        const actionButton = event.target instanceof Element ? event.target.closest("[data-action]") : null;
        const action = actionButton?.getAttribute("data-action") || "";
        if (!action) return;
        motionPress(actionButton);
        if (action === "back-to-compare-select") {
            state.activeTab = "compare";
            state.compareStage = "select";
            state.compareResultIds = [];
            await syncSectionVisibility({ shouldFetch: false, updateUrl: true, replaceUrl: false });
            syncCardActionState();
            renderCompareTray();
        }
        if (action === "select-compare-admission") {
            const uniId = String(actionButton.getAttribute("data-uni-id") || "").trim();
            const optionKey = String(actionButton.getAttribute("data-option-key") || "").trim();
            if (!uniId || !optionKey) return;
            compareAdmissionChoices.set(uniId, {
                programId: String(actionButton.getAttribute("data-program-id") || "").trim(),
                programName: String(actionButton.getAttribute("data-program-name") || "").trim(),
                categoryId: String(actionButton.getAttribute("data-category-id") || "").trim(),
                requirementProfileId: String(actionButton.getAttribute("data-requirement-profile-id") || "").trim(),
                fundingOptionId: String(actionButton.getAttribute("data-funding-option-id") || "").trim(),
                choiceKey: optionKey,
            });
            writeCompareAdmissionChoices();
            setSectionUrl(true);
            renderCompareConfigurePage(state.compareResultIds).catch((err) => console.error(err));
        }
        if (action === "build-compare-results") {
            if (actionButton.hasAttribute("disabled")) return;
            actionButton.blur();
            buildConfiguredCompareResults().catch((err) => console.error(err));
        }
        if (action === "clear-compare-results") {
            compareUniversityIds.clear();
            compareAdmissionChoices.clear();
            state.compareResultIds = [];
            state.compareStage = "select";
            persistSavedAndCompare();
            syncSectionVisibility({ shouldFetch: false, updateUrl: true, replaceUrl: false }).catch((err) => console.error(err));
        }
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
        let val = clampTuition(el.minInput.value, 0);
        if (val >= parseInt(el.maxSlider.value)) val = Math.max(0, parseInt(el.maxSlider.value) - MIN_RANGE_GAP);
        el.minSlider.value = val; state.min_tuition = val; fillTrack(); refetch();
    });

    el.maxInput?.addEventListener("change", () => {
        let val = clampTuition(el.maxInput.value, MAX_TUITION);
        if (val <= parseInt(el.minSlider.value)) val = Math.min(MAX_TUITION, parseInt(el.minSlider.value) + MIN_RANGE_GAP);
        el.maxSlider.value = val; state.max_tuition = val; fillTrack(); refetch();
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

    syncSectionVisibility({
        shouldFetch: state.activeTab !== "ranking" && !isCompareResultsMode(),
        updateUrl: true,
        replaceUrl: true,
    }).catch((err) => console.error(err));
    __universitiesProfileUpdatedHandler = () => {
        state.funding_type = getProfileFundingQueryValue();
        state.page = 1;
        saveFilters(state);
        if (state.activeTab !== "ranking" && !isCompareResultsMode()) fetchAndRender();
    };
    window.addEventListener("profileUpdated", __universitiesProfileUpdatedHandler);
    __universitiesLanguageChangedHandler = () => {
        applyAISortOptionLabel();
        refreshLocationFilterLabels();
        applyToForm();
        updateTradeoffLabels();
        rankingInitialized = false;
        syncSectionVisibility({
            shouldFetch: state.activeTab !== "ranking" && !isCompareResultsMode(),
            updateUrl: true,
            replaceUrl: true,
        }).catch((err) => console.error(err));
    };
    window.addEventListener("languageChanged", __universitiesLanguageChangedHandler);
    __universitiesSettingsChangedHandler = () => {
        renderRecentlyViewedBar();
    };
    window.addEventListener("settingsChanged", __universitiesSettingsChangedHandler);

    async function switchView(mode, shouldFetch = false) {
        state.viewMode = mode;
        saveFilters(state);
        if (mode === "map") {
            el.list.style.display = "none";
            el.pagination.style.display = "none";
            if (el.mapStage) el.mapStage.style.display = "grid";
            el.btnList.classList.remove("active");
            el.btnMap.classList.add("active");
            replayMotion(el.mapStage, "motion-panel-enter", { timeoutMs: 420 });
            await initMap();
            setTimeout(() => { if(mapInstance) mapInstance.invalidateSize(); }, 100);
            if (shouldFetch) fetchAndRender(); 
        } else {
            el.list.style.display = "grid";
            el.pagination.style.display = "flex";
            if (el.mapStage) el.mapStage.style.display = "none";
            el.btnList.classList.add("active");
            el.btnMap.classList.remove("active");
            replayMotion(el.list, "motion-panel-enter", { timeoutMs: 420 });
            if (shouldFetch) fetchAndRender();
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

    function updateMapResultsSelection(uniId) {
        activeMapUniId = String(uniId || "").trim();
        if (!el.mapResults) return;
        el.mapResults.querySelectorAll(".u-map-result-card[data-uni-id]").forEach((card) => {
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
        const heading = escapeHtml(t("universities.map_panel.title", "Results on the map"));
        const subheading = escapeHtml(isCompareSelectionMode()
            ? t("universities.map_panel.compare_subtitle", "Comparison shortlist on the map.")
            : t("universities.map_panel.subtitle", "Pick a university to center the map and open its details."));

        if (!mappedItems.length) {
            el.mapResults.innerHTML = `
                <div class="u-map-results-head">
                    <h3>${heading}</h3>
                    <p>${subheading}</p>
                </div>
                <div class="u-map-results-empty">${escapeHtml(t("universities.map_panel.empty", "No universities with map coordinates match these filters."))}</div>
            `;
            return;
        }

        const visibleItems = mappedItems.slice(0, 10);
        const preferredId = visibleItems.some((u) => String(u.id || "") === activeMapUniId)
            ? activeMapUniId
            : (visibleItems.some((u) => String(u.id || "") === focusUniId) ? String(focusUniId || "") : "");
        activeMapUniId = preferredId;

        el.mapResults.innerHTML = `
            <div class="u-map-results-head">
                <h3>${heading}</h3>
                <p>${subheading}</p>
            </div>
            <div class="u-map-results-list">
                ${visibleItems.map((u) => {
                    const uniId = String(u.id || "");
                    const match = u.matchData || {};
                    const baseCost =
                        (match.costYearUSD !== undefined ? match.costYearUSD : null) ??
                        (match.cost !== undefined ? match.cost : null) ??
                        nested(u, ["finance", "total_cost_year_usd"], 0);
                    const finalCost =
                        (match.finalPrice !== undefined ? match.finalPrice : null) ??
                        (match.costWithAmountUSD !== undefined ? match.costWithAmountUSD : null) ??
                        baseCost;
                    const city = String(trCity(u?.location?.city || "") || "").trim();
                    const country = String(trCountry(u?.location?.country || "") || "").trim();
                    const locationText = [city, country].filter(Boolean).join(", ");
                    const rank = toFiniteNumber(u?.rank);
                    const detailHref = routeUniversityDetail(uniId);
                    const isActive = uniId === preferredId;
                    const isCompared = isCompareSelectionMode() && compareUniversityIds.has(uniId);
                    const compareLabel = isCompared
                        ? t("universities.card.compare_selected", "Selected for comparison")
                        : t("universities.card.compare", "Add to compare");
                    return `
                        <article class="u-map-result-card${isActive ? " is-active" : ""}${isCompared ? " is-selected" : ""}" data-uni-id="${escapeHtmlAttr(uniId)}" aria-selected="${isCompared ? "true" : "false"}">
                            <button type="button" class="u-map-result-focus" data-uni-focus="${escapeHtmlAttr(uniId)}">
                                <span class="u-map-result-logo">
                                    <img src="${uniLogoSrc(uniId)}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(uniLogoSrc(uniId, { forceFull: true }))}" data-fallback-text="${escapeHtmlAttr(initials(trUniversityName(u) || "U"))}">
                                </span>
                                <span class="u-map-result-copy">
                                    <span class="u-map-result-name">${escapeHtml(textOrUnknown(trUniversityName(u), "placeholder.field.university_name", "University name"))}</span>
                                    <span class="u-map-result-meta">${escapeHtml(locationText || unknownFieldText("placeholder.field.location", "Location"))}</span>
                                </span>
                                <span class="u-map-result-rank">${rank !== null && rank > 0 ? `#${escapeHtml(String(rank))}` : ""}</span>
                            </button>
                            <div class="u-map-result-bottom">
                                <span class="u-map-result-price">${escapeHtml(moneyOrUnknown(finalCost, "placeholder.field.cost", "Cost"))}</span>
                                <a class="u-map-result-link" href="${detailHref}">${escapeHtml(t("universities.card.view_details", "View details →"))}</a>
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
        `;

        el.mapResults.querySelectorAll("[data-uni-focus]").forEach((button) => {
            button.addEventListener("click", () => {
                if (isCompareSelectionMode()) {
                    const card = button.closest("[data-uni-id]");
                    toggleCompareUniversity(card?.getAttribute("data-uni-id"), card);
                }
                focusMapUniversity(button.getAttribute("data-uni-focus"), {
                    openPopup: true,
                    fly: true,
                    zoom: 14,
                });
            });
        });
        el.mapResults.querySelectorAll(".u-map-result-card[data-uni-id]").forEach((card) => {
            card.addEventListener("click", (event) => {
                if (!isCompareSelectionMode()) return;
                const target = event.target instanceof Element ? event.target : null;
                if (target?.closest("button, a")) return;
                toggleCompareUniversity(card.getAttribute("data-uni-id"), card);
            });
        });
        el.mapResults.querySelectorAll(".u-map-result-link").forEach((link) => {
            if (isCompareSelectionMode()) {
                link.classList.add("u-map-result-compare-link");
                link.textContent = compareUniversityIds.has(link.closest("[data-uni-id]")?.getAttribute("data-uni-id") || "")
                    ? t("universities.card.compare_selected", "Selected for comparison")
                    : t("universities.card.compare", "Add to compare");
            }
            link.addEventListener("click", (event) => {
                if (isCompareSelectionMode()) {
                    const card = link.closest("[data-uni-id]");
                    event.preventDefault();
                    toggleCompareUniversity(card?.getAttribute("data-uni-id"), card);
                    return;
                }
                if (!shouldOpenUniversitiesInNewTab()) return;
                const card = link.closest("[data-uni-id]");
                const uniId = card?.getAttribute("data-uni-id");
                rememberRecentUniversity(uniId);
                event.preventDefault();
                openUniversityDetail(uniId);
            });
        });
    }

    function updateMapMarkers(items) {
        if (!mapInstance || !markersLayer) return;
        const L = window.L;
        if (!L) return;
        markersLayer.clearLayers();
        markersByUniId = new Map();
        const profile = loadProfile(); const userBudget = parseFloat(profile.budget);
        renderMapResultsPanel(items);
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

    function resetMapResults() {
        if (mapInstance && typeof mapInstance.closePopup === "function") {
            mapInstance.closePopup();
        }
        if (markersLayer) {
            markersLayer.clearLayers();
        }
        markersByUniId = new Map();
        activeMapUniId = String(focusUniId || "").trim();
        if (el.mapResults) el.mapResults.innerHTML = "";
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
    
    function buildParams(forApi = false) {
        const p = new URLSearchParams();
        const uiLang = getCurrentLanguage();
        if (uiLang) p.set("lang", uiLang);
        if (forApi) p.set("fields", "card");
        state.funding_type = getProfileFundingQueryValue();
        if (state.q) p.set("q", state.q); if (state.country) p.set("country", state.country);
        if (state.region) p.set("region", state.region); if (state.city) p.set("city", state.city);
        if (state.min_tuition) p.set("min_tuition", state.min_tuition);
        if (state.max_tuition) p.set("max_tuition", state.max_tuition);
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
        if (state.min_tuition) payload.min_tuition = state.min_tuition;
        if (state.max_tuition) payload.max_tuition = state.max_tuition;

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
        fallback.set("sort", "name_asc");
        fallback.set("page", state.only_saved ? "1" : String(state.page));
        fallback.set("limit", state.only_saved ? "2000" : String(state.limit));
        return fallback;
    }

    function applyToForm() {
        if(el.qInput) el.qInput.value = state.q; if(el.countrySelect) el.countrySelect.value = state.country;
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
        if(sp.has("country")) state.country = sp.get("country");
        if(sp.has("region")) state.region = sp.get("region");
        if(sp.has("city")) state.city = sp.get("city");
        if(sp.has("study_level")) state.study_level = sp.get("study_level");
        if(sp.has("min_tuition")) state.min_tuition = clampTuition(sp.get("min_tuition"), state.min_tuition);
        if(sp.has("max_tuition")) state.max_tuition = clampTuition(sp.get("max_tuition"), state.max_tuition);
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

        if (state.min_tuition > (MAX_TUITION - MIN_RANGE_GAP)) state.min_tuition = MAX_TUITION - MIN_RANGE_GAP;
        state.max_tuition = Math.min(MAX_TUITION, state.max_tuition);
        if (state.max_tuition < state.min_tuition + MIN_RANGE_GAP) {
            state.max_tuition = state.min_tuition + MIN_RANGE_GAP;
        }
    }

    async function fetchUniversities(apiParams) {
        const key = apiParams.toString();
        const now = Date.now();
        logTranslationDebug("non-ai request start", {
            query: key,
            reason: "sort is not uni_ai or AI fallback path",
        });
        if (lastFetchKey === key && lastFetchPayload && (now - lastFetchAt) < CACHE_TTL_MS) {
            logTranslationDebug("non-ai request cache hit (frontend memory)", {
                ageMs: now - lastFetchAt,
            });
            return lastFetchPayload;
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
        lastFetchKey = key;
        lastFetchPayload = payload;
        lastFetchAt = now;
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
            mlQueryTranslated: Boolean(match.mlQueryTranslated),
            mlQuerySource: String(match.mlQuerySource || ""),
            mlQueryTranslationReason: String(match.mlQueryTranslationReason || ""),
            mlQueryProvider: String(match.mlQueryProvider || ""),
            mlQueryCacheHit: Boolean(match.mlQueryCacheHit),
            mlQueryProviderError: String(match.mlQueryProviderError || ""),
            mlQueryInputPreview: String(match.mlQueryInputPreview || ""),
            mlQueryOutputPreview: String(match.mlQueryOutputPreview || ""),
            mlQueryOutputLength: Number(match.mlQueryOutputLength || 0),
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

    function renderFetchedData(data) {
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
        const warningText = mlUnavailable ? t("universities.state.ml_unavailable", "Machine Learning unavailable. Using rule-based ranking only.") : "";

        if (state.viewMode === "list") {
            if (el.total) el.total.textContent = String(total);
            hasInitialListPaint = true;

            if (!items.length) {
                renderUniversitiesState({
                    warningText,
                    emptyText: state.only_saved
                        ? t("universities.state.empty_saved", "No favorite universities match these filters.")
                        : t("universities.state.empty", "No universities found."),
                });
                renderCompareTray();
                renderRecentlyViewedBar();
                updateMobileFilterUi();
                return;
            }
            renderUniversitiesState({ warningText });
            const profile = loadProfile();
            const userBudget = parseFloat(profile.budget);
            el.list.innerHTML = items.map((u, idx) => renderCard(u, userBudget, idx)).join("");
            markMotionEnter(el.list, ".uni-card", { limit: 16, staggerMs: 24 });
            renderPagination(total);
            markMotionEnter(el.pagination, ".page-btn", { limit: 10, staggerMs: 12 });
            renderCompareTray();
            renderRecentlyViewedBar();
            updateMobileFilterUi();
            return;
        }

        if (state.viewMode === "map") {
            if (el.total) el.total.textContent = String(items.length);
            updateMapMarkers(items);
            markMotionEnter(el.mapResults, ".u-map-result-card", { limit: 12, staggerMs: 18 });
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
        }
    }

    async function fetchAndRender() {
        const runSeq = ++fetchRunSeq;
        logTranslationDebug("fetch cycle start", {
            runSeq,
            viewMode: state.viewMode,
            sort: state.sort,
        });
        setUniversitiesLoading(true);
        if (el.total) el.total.textContent = "0";
        renderUniversitiesState();
        if (state.viewMode === 'list') el.list.innerHTML = "";
        if (state.viewMode === "map" && !mapInstance) await initMap();
        if (el.pagination) el.pagination.innerHTML = "";

        const urlParams = sectionUrlParams();
        const apiParams = buildParams(true);
        setUrlParams(urlParams);

        try {
        if (state.only_saved && savedUniversityIds.size === 0) {
            renderFetchedData({ items: [], total: 0 });
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
                renderData: renderFetchedData,
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
        renderFetchedData(data);

        } catch (err) {
        if (runSeq !== fetchRunSeq) return;
        if (err?.name === "AbortError") return;
        console.error(err);
        if (el.list) {
            renderNoConnection({
                containerId: "universitiesList",
                onRetry: () => fetchAndRender()
            });
        } else if (el.state) {
            el.state.textContent = t("universities.state.failed", "Failed to load data.");
        }
        } finally {
        if (runSeq === fetchRunSeq) {
            setUniversitiesLoading(false);
            if (firstVisitTourPending) {
                firstVisitTourPending = false;
                window.setTimeout(async () => {
                    await showUniversitiesTour();
                    if (shouldShowUniFitWarning()) {
                        await showUniFitWarning();
                    }
                }, 120);
            }
        }
        }
    }

    // --- RENDER CARD (БЕЗ ROI) ---
    function renderCard(u, myBudget, idx = 99) {
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

        // Базовая цена по выбранному варианту, если алгоритм её дал.
        const baseCost =
        (match.costYearUSD !== undefined ? match.costYearUSD : null) ??
        (match.cost !== undefined ? match.cost : null) ??
        nested(u, ["finance", "total_cost_year_usd"], 0);

        // Итоговая цена с учётом scholarship amount (если есть)
        const cost =
        (match.finalPrice !== undefined ? match.finalPrice : null) ??
        (match.costWithAmountUSD !== undefined ? match.costWithAmountUSD : null) ??
        baseCost;

        let badgesHTML = "";
        let whyText = "";
        const badgeHints = (match.uiBadgeHints && typeof match.uiBadgeHints === "object") ? match.uiBadgeHints : {};
        const preferenceMismatch = Number(match.preferenceMismatch);
        const grantChance = Number(match.grantChance);
        const generalChance = Number(match.generalChance);
        const selectedChanceType = String(match.selectedChanceType || "").toLowerCase();
        const hintedVibe = String(badgeHints.vibe || "").toLowerCase();
        const hintedFinance = String(badgeHints.finance || "").toLowerCase();
        const financePref = Number(state.budget_vs_prestige);
        const inGrantMode = selectedChanceType ? selectedChanceType === "grant" : financePref < 50;
        const inPaidMode = selectedChanceType ? selectedChanceType === "general" : financePref > 50;
        const conditionalCount = Number(match.conditionalRequirements || 0);
        const hasConditionalExamWarning = (badgeHints.showConditionalExamNeeded === true) || (!!match.conditional && conditionalCount > 0);
        const hasVeryHighVibeMatch = hintedVibe === "your_vibe" || (!hintedVibe && Number.isFinite(preferenceMismatch) && preferenceMismatch <= 0.14);
        const hasHighVibeMatch = hintedVibe === "top_match" || (!hintedVibe && Number.isFinite(preferenceMismatch) && preferenceMismatch > 0.14 && preferenceMismatch <= 0.22);
        const likelyGrant = hintedFinance === "likely_grant" || (!hintedFinance && inGrantMode && Number.isFinite(grantChance) && grantChance >= 65);
        const paidAdmission = hintedFinance === "paid_admission" || (!hintedFinance && inPaidMode && Number.isFinite(generalChance) && generalChance >= 45);
        const meetsMinRequirements = match.meetMinRequirements === true && !hasConditionalExamWarning;
        const belowRequirements = match.meetMinRequirements === false;
        const aidAny = !!(match.aidAny || match.aidEligible || nested(u, ["finance", "financial_aid", "merit_based"], false) || nested(u, ["finance", "financial_aid", "need_based"], false));
        const hasUserBudget = Number.isFinite(Number(myBudget)) && Number(myBudget) > 0;
        const overBudget = hasUserBudget && Number.isFinite(Number(cost)) && Number(cost) > Number(myBudget);

        const badges = [];
        const acc = toFiniteNumber(u?.academics?.acceptance_rate_percent);
        const acceptanceValueText = acc !== null
            ? `${Math.round(acc * 100) / 100}%`
            : t("common.na", "N/A");

        // Priority 1: warning on missing exam evidence (conditional, not fail)
        if (hasConditionalExamWarning) {
            badges.push(
                renderUniPill("clipboard-document-list", "uni-pill--warn", t("universities.badge.conditional_exam_needed", "Conditional / Exam Needed"))
            );
            whyText = t("universities.why.conditional_exam_needed", "Some required exam evidence is missing, so this result is conditional.");
        }

        // Priority 2: preference-match group. Only one vibe tag may be shown.
        if (hasVeryHighVibeMatch) {
            badges.push(
                renderUniPill("sparkles", "uni-pill--success", t("universities.badge.your_vibe", "Your Vibe"))
            );
            if (!whyText) whyText = t("universities.why.your_vibe", "This university strongly matches your Focus, Atmosphere, and Location sliders.");
        } else if (hasHighVibeMatch) {
            badges.push(
                renderUniPill("check-badge", "uni-pill--success", t("universities.badge.top_match", "Good Match"))
            );
            if (!whyText) whyText = t("universities.why.top_match", "This university is a good preference match for your current slider setup.");
        }

        // Priority 3: financial route tag from finance slider mode + chance
        if (likelyGrant) {
            badges.push(
                renderUniPill("banknotes", "uni-pill--success", t("universities.badge.likely_grant", "Likely Grant"))
            );
            if (!whyText) whyText = t("universities.why.likely_grant", "In grant-priority mode, this university has a strong grant admission chance.");
        } else if (paidAdmission) {
            badges.push(
                renderUniPill("briefcase", "uni-pill--budget", t("universities.badge.paid_admission", "Paid Admission"))
            );
            if (!whyText) whyText = t("universities.why.paid_admission", "In willing-to-pay mode, this university has a strong general admission chance.");
        }

        // Status tags: requirements + budget + aid.
        if (belowRequirements) {
            badges.push(renderUniPill("exclamation-triangle", "uni-pill--warn", t("universities.badge.below_requirements", "Below Requirements")));
        } else if (meetsMinRequirements) {
            badges.push(renderUniPill("check-circle", "uni-pill--success", t("universities.badge.requirements_met", "Requirements Met")));
        }

        if (overBudget) {
            if (aidAny) badges.push(renderUniPill("banknotes", "uni-pill--budget", t("universities.badge.over_budget_aid", "Over Budget • Aid Available")));
            else badges.push(renderUniPill("banknotes", "uni-pill--budget", t("universities.badge.over_budget", "Over Budget")));
        } else if (aidAny) {
            badges.push(renderUniPill("check-circle", "uni-pill--success", t("universities.badge.aid_available", "Aid Available")));
        }

        const visibleBadges = badges.slice();
        const badgeCountClass = `uni-badge--count-${Math.min(Math.max(visibleBadges.length, 1), 8)}`;
        const badgeContainerClass = `uni-badge ${badgeCountClass}`;
        badgesHTML = visibleBadges.join(" ");

        
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
        const safeWhyText = escapeHtml(whyText || "");
        const overlayTitle = whyText ? `${name}. ${whyText}` : String(name || "");
        const rankValue = toFiniteNumber(u?.rank);
        const rankLabel = escapeHtml(translateWord("global_rank", "Global Rank"));
        const costText = moneyOrUnknown(cost, "placeholder.field.cost", "Cost");
        const isSaved = savedUniversityIds.has(String(id));
        const showCompareAction = isCompareSelectionMode();
        const isCompared = showCompareAction && compareUniversityIds.has(String(id));
        const detailLabel = escapeHtml(isCompareSelectionMode()
            ? (isCompared ? t("universities.card.compare_selected", "Selected for comparison") : t("universities.card.compare", "Add to compare"))
            : t("universities.card.view_details", "View details"));
        const metricsHtml = `
            <div class="uni-metrics" aria-label="${escapeHtml(t("universities.card.metrics", "Key metrics"))}">
                <div class="uni-metric${rankValue !== null && rankValue > 0 ? "" : " uni-metric--missing"}">
                    <span class="uni-metric-label">${rankLabel}</span>
                    <span class="uni-metric-value">${rankValue !== null && rankValue > 0 ? `#${escapeHtml(String(rankValue))}` : escapeHtml(t("common.na", "N/A"))}</span>
                </div>
                <div class="uni-metric${acc !== null ? "" : " uni-metric--missing"}">
                    <span class="uni-metric-label">${escapeHtml(t("ranking.acceptance", "Acceptance Rate"))}</span>
                    <span class="uni-metric-value">${escapeHtml(acceptanceValueText)}</span>
                </div>
            </div>
        `;
        const saveLabel = t("universities.card.save", "Add to favorites");
        const compareDefaultLabel = t("universities.card.compare", "Add to compare");
        const compareSelectedLabel = t("universities.card.compare_selected", "Selected for comparison");
        const compareLabel = isCompared ? compareSelectedLabel : compareDefaultLabel;
        const saveActionHtml = showCompareAction
            ? ""
            : `<button class="uni-action-btn uni-action-btn--favorite${isSaved ? " is-active" : ""}" type="button" data-card-action="save" aria-pressed="${isSaved ? "true" : "false"}" title="${escapeHtmlAttr(saveLabel)}" aria-label="${escapeHtmlAttr(saveLabel)}">${renderInlineIcon("star", 16, "uni-action-icon")}</button>`;
        const compareActionHtml = showCompareAction
            ? `<button class="uni-action-btn uni-action-btn--compare${isCompared ? " is-active" : ""}" type="button" data-card-action="compare" aria-pressed="${isCompared ? "true" : "false"}" title="${escapeHtmlAttr(compareLabel)}" aria-label="${escapeHtmlAttr(compareLabel)}">${renderInlineIcon(isCompared ? "check-circle" : "adjustments-horizontal", 16, "uni-action-icon")}</button>`
            : "";
        return `
        <article class="uni-card${isCompared ? " uni-card--compare-selected" : ""}" data-uni-id="${escapeHtmlAttr(id)}" aria-selected="${isCompared ? "true" : "false"}">
            <div class="uni-media">
            <img class="uni-media-img" src="${thumbSrc}" srcset="${escapeHtmlAttr(thumbSrcset)}" sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(thumbSrcFullFallback)}" data-final-src="${escapeHtmlAttr(logoSrcFull)}">
            <div class="uni-card-actions">
                ${saveActionHtml}
                ${compareActionHtml}
            </div>
            <div class="uni-price"><small>${escapeHtml(t("universities.card.est_cost_year", "Est. Cost/Year"))}</small><b>${escapeHtml(costText)}</b></div>
            <div class="uni-logo"><img src="${logoSrc}" alt="${initials(name)}" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(name))}"></div>
            </div>
            <div class="uni-body">
                        <h3 class="uni-title" title="${safeName}">${safeName}</h3>
            ${locHtml}
            ${metricsHtml}
            <div class="uni-card-separator" aria-hidden="true"></div>
            ${badgesHTML ? `<div class="${badgeContainerClass}">${badgesHTML}</div>` : ""}
            ${whyText ? `<div class="uni-why" title="${safeWhyText}">${safeWhyText}</div>` : ""}
            <div class="uni-footer">
                <span class="uni-details">${detailLabel}<span aria-hidden="true">→</span></span>
            </div>
            </div>
            <a class="uni-card-link-overlay" href="${detailHref}"${universityLinkAttrs()} aria-label="${safeName}" title="${escapeHtml(overlayTitle)}"></a>
        </article>
        `;
    }

    function renderPagination(total) {
        if (!el.pagination) return;
        const totalPages = Math.ceil(total / state.limit);
        if (totalPages <= 1) { el.pagination.innerHTML = ""; return; }
        let html = ""; const p = state.page; const maxVisible = 5;
        const createBtn = (page, text, isActive = false) => { const activeClass = isActive ? "page-btn--active" : ""; return `<button class="page-btn ${activeClass}" data-page="${page}">${text}</button>`; };
        if (p > 1) { html += createBtn(1, "«"); html += createBtn(p - 1, `‹ ${escapeHtml(t("universities.pagination.prev", "Prev"))}`); }
        let startPage, endPage;
        if (totalPages <= maxVisible) { startPage = 1; endPage = totalPages; } else { const maxPagesBefore = Math.floor(maxVisible / 2); const maxPagesAfter = Math.ceil(maxVisible / 2) - 1; if (p <= maxPagesBefore + 1) { startPage = 1; endPage = maxVisible; } else if (p + maxPagesAfter >= totalPages) { startPage = totalPages - maxVisible + 1; endPage = totalPages; } else { startPage = p - maxPagesBefore; endPage = p + maxPagesAfter; } }
        if (startPage > 1) html += `<span class="page-dots">...</span>`; for (let i = startPage; i <= endPage; i++) { html += createBtn(i, i, i === p); } if (endPage < totalPages) html += `<span class="page-dots">...</span>`;
        if (p < totalPages) { html += createBtn(p + 1, `${escapeHtml(t("universities.pagination.next", "Next"))} ›`); html += createBtn(totalPages, "»"); }
        el.pagination.innerHTML = html;
        el.pagination.querySelectorAll("button").forEach(b => { b.onclick = () => { const newPage = Number(b.dataset.page); if (newPage && newPage !== state.page) { state.page = newPage; fetchAndRender(); window.scrollTo({top: 0, behavior: 'smooth'}); } }; });
    }
}

// =====================================
// PAGE: UNIVERSITY DETAILS
// =====================================
