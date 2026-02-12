/* 4. pages.js - ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ */

import {
  API_BASE,
  $,
  debounce,
  loadFilters,
  saveFilters,
  setUrlParams,
  nested,
  escapeHtml,
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
} from "./utils.js";

import { setupTabs } from "./components.js";
import { t, tFormat } from "./i18n.js";
import {
  translateAdmissionText,
  translateDataValue,
  translateProgramName,
  translateTrackLabel,
  translateTemplate,
  translateUniversityDescription,
  translateUniversityName,
  translateWord,
} from "./university-translations.js";

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

function normalizeUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  if (/^www\./i.test(s)) return `https://${s}`;
  return "";
}

function safeUrl(raw) {
  const candidate = normalizeUrl(raw);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (SAFE_PROTOCOLS.has(url.protocol)) return url.href;
  } catch (e) {
    return "";
  }
  return "";
}

function safePathSegment(raw) {
  return encodeURIComponent(String(raw || "").trim());
}

const MOBILE_IMAGE_MAX_WIDTH = 640;

function trCountry(value) {
  return translateDataValue("country", value, value);
}

function trCity(value) {
  return translateDataValue("city", value, value);
}

function trState(value) {
  return translateDataValue("state", value, value);
}

function trProgramLanguage(value) {
  return translateDataValue("language", value, value);
}

function trStudyLevel(value) {
  return translateDataValue("study_level", value, value);
}

function trStudyMode(value) {
  return translateDataValue("study_mode", value, value);
}

function trTag(value) {
  return translateDataValue("tag", value, value);
}

function trUniversityName(u) {
  return translateUniversityName(u?.id, String(u?.name || ""));
}

function trUniversityDescription(u) {
  return translateUniversityDescription(u, String(u?.description || ""));
}

function trTrackLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  return translateTrackLabel(raw, raw);
}

function trTrackDescription(universityId, trackId, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return translateAdmissionText(raw, raw);
}

function trProgramName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return translateProgramName(raw, raw);
}

function normalizeStudyModeForCost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "any") return "any";
  if (raw === "on-campus" || raw === "on campus" || raw === "campus" || raw === "in-person" || raw === "offline" || raw === "hybrid" || raw === "blended" || raw === "mixed") return "on-campus";
  if (raw === "online" || raw === "distance" || raw === "remote" || raw === "online / distance") return "online";
  return "any";
}

function modeValueFromMap(modeMap, modeRaw) {
  if (!modeMap || typeof modeMap !== "object") return null;
  const target = normalizeStudyModeForCost(modeRaw);
  for (const [k, v] of Object.entries(modeMap)) {
    if (normalizeStudyModeForCost(k) === target) return v;
  }
  return null;
}

function modeBreakdownFromFinance(financeData, modeRaw) {
  const f = financeData && typeof financeData === "object" ? financeData : {};
  const maps = [
    f.costs_breakdown_year_usd_by_mode,
    f.costs_breakdown_by_mode_year_usd,
    f.mode_costs_breakdown_year_usd,
  ];
  for (const map of maps) {
    const v = modeValueFromMap(map, modeRaw);
    if (v && typeof v === "object") return v;
  }
  return null;
}

function modeTotalFromFinance(financeData, modeRaw) {
  const f = financeData && typeof financeData === "object" ? financeData : {};
  const maps = [
    f.total_cost_year_usd_by_mode,
    f.total_cost_by_mode_year_usd,
    f.mode_total_cost_year_usd,
  ];
  for (const map of maps) {
    const v = modeValueFromMap(map, modeRaw);
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function extractTuitionCostFromBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  for (const [key, val] of Object.entries(breakdown)) {
    const k = String(key || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!k.includes("tuition")) continue;
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function modeAwareAnnualCost(financeData, preferredModeRaw = "any") {
  const f = financeData && typeof financeData === "object" ? financeData : {};
  const mode = normalizeStudyModeForCost(preferredModeRaw);
  const totalRaw = Number(f.total_cost_year_usd);
  const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : 0;
  const breakdown = (f.costs_breakdown_year_usd && typeof f.costs_breakdown_year_usd === "object")
    ? f.costs_breakdown_year_usd
    : {};
  const tuition = extractTuitionCostFromBreakdown(breakdown);

  if (mode === "online") {
    const exactModeBreakdown = modeBreakdownFromFinance(f, "online");
    const exactTuition = extractTuitionCostFromBreakdown(exactModeBreakdown);
    if (Number.isFinite(exactTuition) && exactTuition >= 0) return exactTuition;
    if (Number.isFinite(tuition) && tuition >= 0) return tuition;
    const exactModeTotal = modeTotalFromFinance(f, "online");
    if (Number.isFinite(exactModeTotal) && exactModeTotal >= 0) return exactModeTotal;
    return 0;
  }
  return total;
}

function modeAwareBreakdown(financeData, preferredModeRaw = "any") {
  const f = financeData && typeof financeData === "object" ? financeData : {};
  const mode = normalizeStudyModeForCost(preferredModeRaw);
  const fallback = (f.costs_breakdown_year_usd && typeof f.costs_breakdown_year_usd === "object")
    ? f.costs_breakdown_year_usd
    : {};

  if (mode === "online") {
    const exact = modeBreakdownFromFinance(f, "online");
    const exactTuition = extractTuitionCostFromBreakdown(exact);
    if (Number.isFinite(exactTuition) && exactTuition >= 0) return { Tuition: exactTuition };
    const tuition = extractTuitionCostFromBreakdown(fallback);
    if (Number.isFinite(tuition) && tuition >= 0) return { Tuition: tuition };
    const exactModeTotal = modeTotalFromFinance(f, "online");
    if (Number.isFinite(exactModeTotal) && exactModeTotal >= 0) return { Tuition: exactModeTotal };
    return {};
  }

  return fallback;
}

function normalizeFundingPreference(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "grant" || raw === "paid") return raw;
  return "any";
}

function normalizeSortMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "uni_ai" || raw === "name_asc" || raw === "tuition_asc" || raw === "tuition_desc") {
    return raw;
  }
  return "uni_ai";
}

function fundingPreferenceToQueryValue(value) {
  const normalized = normalizeFundingPreference(value);
  return normalized === "any" ? "" : normalized;
}

function shouldUseOptimizedImages() {
  try {
    const viewport = window.innerWidth || 9999;
    return viewport <= MOBILE_IMAGE_MAX_WIDTH;
  } catch (e) {
    return (window.innerWidth || 1024) <= MOBILE_IMAGE_MAX_WIDTH;
  }
}

function uniThumbnailSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const forceFull = !!opts.forceFull;
  const forceOptimized = !!opts.forceOptimized;
  if (!forceFull && (forceOptimized || shouldUseOptimizedImages())) {
    return `images/thumbnails-mobile/${safeId}.jpg`;
  }
  return `images/thumbnails/${safeId}.jpg`;
}

function uniLogoSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const forceFull = !!opts.forceFull;
  const forceOptimized = !!opts.forceOptimized;
  if (!forceFull && (forceOptimized || shouldUseOptimizedImages())) {
    return `images/logos-mobile/${safeId}.png`;
  }
  return `images/logos/${safeId}.png`;
}

const DETAIL_CACHE_KEY = "unisearch_detail_cache_v1";
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_MAX_ITEMS = 24;
const UNIVERSITIES_TOUR_SEEN_KEY = "unisearch_universities_tour_seen_v1";

function hasSeenUniversitiesTour() {
  try {
    return localStorage.getItem(UNIVERSITIES_TOUR_SEEN_KEY) === "1";
  } catch (e) {
    return false;
  }
}

function markUniversitiesTourSeen() {
  try {
    localStorage.setItem(UNIVERSITIES_TOUR_SEEN_KEY, "1");
  } catch (e) {
    // ignore storage errors
  }
}

function readDetailCache() {
  try {
    const raw = localStorage.getItem(DETAIL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeDetailCache(cache) {
  try {
    localStorage.setItem(DETAIL_CACHE_KEY, JSON.stringify(cache || {}));
  } catch (e) {
    // ignore storage quota and serialization errors
  }
}

function getDetailCacheEntry(universityId) {
  const key = String(universityId || "").trim();
  if (!key) return null;
  const cache = readDetailCache();
  const entry = cache[key];
  if (!entry || typeof entry !== "object" || !entry.data || typeof entry.data !== "object") {
    return null;
  }
  return {
    key,
    data: entry.data,
    etag: String(entry.etag || ""),
    ts: Number(entry.ts) || 0,
  };
}

function setDetailCacheEntry(universityId, data, etag = "") {
  const key = String(universityId || "").trim();
  if (!key || !data || typeof data !== "object") return;

  const cache = readDetailCache();
  cache[key] = {
    data,
    etag: String(etag || ""),
    ts: Date.now(),
  };

  const keys = Object.keys(cache);
  if (keys.length > DETAIL_CACHE_MAX_ITEMS) {
    keys
      .sort((a, b) => (Number(cache[a]?.ts) || 0) - (Number(cache[b]?.ts) || 0))
      .slice(0, keys.length - DETAIL_CACHE_MAX_ITEMS)
      .forEach((oldKey) => delete cache[oldKey]);
  }

  writeDetailCache(cache);
}

function touchDetailCacheEntry(universityId) {
  const key = String(universityId || "").trim();
  if (!key) return;
  const cache = readDetailCache();
  if (!cache[key] || typeof cache[key] !== "object") return;
  cache[key].ts = Date.now();
  writeDetailCache(cache);
}

async function fetchUniversityDetailCached(universityId) {
  const key = String(universityId || "").trim();
  if (!key) throw new Error("University ID is required");

  const cached = getDetailCacheEntry(key);
  const age = cached ? (Date.now() - cached.ts) : Number.POSITIVE_INFINITY;

  if (cached && age < DETAIL_CACHE_TTL_MS) {
    return cached.data;
  }

  const headers = {};
  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  try {
    const res = await fetch(`${API_BASE}/universities/${encodeURIComponent(key)}`, { headers });

    if (res.status === 304 && cached?.data) {
      touchDetailCacheEntry(key);
      return cached.data;
    }
    if (!res.ok) throw new Error("Backend error");

    const data = await res.json();
    const etag = res.headers.get("ETag") || "";
    setDetailCacheEntry(key, data, etag);
    return data;
  } catch (err) {
    if (cached?.data) return cached.data;
    throw err;
  }
}

// =====================================
// PAGE: UNIVERSITIES LIST (Список вузов)
// =====================================
export function initUniversitiesPage() {
    const MAX_TUITION = 150000;
    const MIN_RANGE_GAP = 100;
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
        focusSlider: $("focusSlider"), focusLabel: $("focusLabel"),
        atmosphereSlider: $("atmosphereSlider"), atmosphereLabel: $("atmosphereLabel"),
        financeSlider: $("financeSlider"), financeLabel: $("financeLabel"),
        locationSlider: $("locationSlider"), locationLabel: $("locationLabel"),
        resetBtn: $("resetFiltersBtn"),
        content: document.querySelector(".u-content"),
        list: $("universitiesList"), mapContainer: $("mapContainer"), total: $("totalCount"), 
        state: $("listState"), pagination: $("pagination"),
        btnList: $("viewListBtn"), btnMap: $("viewMapBtn"),
        loading: $("universitiesLoading")
    };

    const getProfileFundingQueryValue = () => {
        const profile = loadProfile();
        return fundingPreferenceToQueryValue(profile?.fundingType || profile?.funding_type || "any");
    };

    if (!el.list) return;

    const initInfoTooltips = () => {
        const wraps = Array.from(document.querySelectorAll(".u-info-wrap"));
        if (!wraps.length) return;

        const closeAll = () => wraps.forEach((w) => w.classList.remove("is-open"));
        document.addEventListener("click", (evt) => {
            if (!(evt.target instanceof Element)) return;
            if (evt.target.closest(".u-info-wrap")) return;
            closeAll();
        });

        wraps.forEach((wrap) => {
            const btn = wrap.querySelector(".u-info");
            if (!btn) return;
            let holdTimer = null;

            btn.addEventListener("click", (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                const willOpen = !wrap.classList.contains("is-open");
                closeAll();
                if (willOpen) wrap.classList.add("is-open");
            });

            btn.addEventListener("touchstart", (evt) => {
                evt.stopPropagation();
                holdTimer = window.setTimeout(() => {
                    closeAll();
                    wrap.classList.add("is-open");
                }, 420);
            }, { passive: true });

            const clearHold = () => {
                if (holdTimer) {
                    window.clearTimeout(holdTimer);
                    holdTimer = null;
                }
            };

            btn.addEventListener("touchend", clearHold, { passive: true });
            btn.addEventListener("touchcancel", clearHold, { passive: true });
        });
    };
    initInfoTooltips();

    const applyAISortOptionLabel = () => {
        if (!el.sortSelect) return;
        const aiOpt = el.sortSelect.querySelector('option[value="uni_ai"]');
        if (aiOpt) aiOpt.textContent = tFormat("universities.sort_ai", { fit: aiName("fit") }, `✨ ${aiName("fit")}: AI Smart Sort`);
    };
    applyAISortOptionLabel();

    const savedState = loadFilters();
    const initialMin = clampTuition(savedState.min_tuition, 0);
    const initialMax = clampTuition(savedState.max_tuition, MAX_TUITION);
    const state = {
        q: savedState.q || "", country: savedState.country || "", region: savedState.region || "", 
        city: savedState.city || "", study_level: savedState.study_level || "",
        funding_type: getProfileFundingQueryValue(),
        min_tuition: initialMin,
        max_tuition: Math.max(initialMax, initialMin + MIN_RANGE_GAP), 
        sort: normalizeSortMode(savedState.sort || "uni_ai"),
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
        viewMode: savedState.viewMode || "list", page: 1, limit: 15,
    };
    if (state.min_tuition > (MAX_TUITION - MIN_RANGE_GAP)) state.min_tuition = MAX_TUITION - MIN_RANGE_GAP;
    state.max_tuition = Math.min(MAX_TUITION, state.max_tuition);
    if (state.max_tuition < state.min_tuition + MIN_RANGE_GAP) {
        state.max_tuition = state.min_tuition + MIN_RANGE_GAP;
    }
    let focusUniId = "";
    let focusUniDone = false;

    const CACHE_TTL_MS = 30000;
    const AI_FAST_FALLBACK_MS = 900;
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

    const hasProfileEvidence = (profile) => {
        const exams = Array.isArray(profile?.exams) ? profile.exams : [];
        const langs = Array.isArray(profile?.languages) ? profile.languages : [];
        return exams.length > 0 || langs.length > 0;
    };

    function setUniversitiesLoading(isLoading) {
        if (!el.loading) return;
        const mapMode = state.viewMode === "map";
        const useMapOverlay = !!isLoading && mapMode;
        const showDefaultOverlay = !!isLoading && !mapMode;
        el.loading.classList.toggle("is-visible", showDefaultOverlay);
        el.loading.setAttribute("aria-hidden", showDefaultOverlay ? "false" : "true");
        if (el.content) {
            el.content.classList.toggle("is-loading", showDefaultOverlay);
            el.content.classList.toggle("is-loading-map", useMapOverlay);
        }
    }

    const ensureUniversitiesTourModal = () => {
        let modal = document.getElementById("universitiesTourModal");
        if (modal) {
            modal.querySelectorAll(".u-tour-close").forEach((el) => el.remove());
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
                desc: t("tour.step1.desc", "This page helps you quickly shortlist universities by location, tuition, and fit for your profile."),
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
                    t("tour.step3.point2", "Use grant/paid track filter for finance planning."),
                    t("tour.step3.point3", "Use map view to spot location clusters."),
                ],
                action: "",
            },
            {
                kicker: t("tour.step4.kicker", "Step 3"),
                title: t("tour.step4.title", "Open details and compare tracks"),
                desc: t("tour.step4.desc", "Click any card to inspect admissions, finance, and requirements per track."),
                points: [
                    tFormat("tour.step4.point1", { chance: aiName("chance") }, `Review ${aiName("chance")} by track in the detail page.`),
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
                modal.classList.remove("is-open");
                modal.setAttribute("aria-hidden", "true");
                modal.style.display = "none";

                const onProfileClosed = () => {
                    isPausedForProfile = false;
                    modal.style.display = "flex";
                    modal.classList.add("is-open");
                    modal.setAttribute("aria-hidden", "false");
                    nextBtn?.focus();
                };

                window.addEventListener("profileModalClosed", onProfileClosed, { once: true });
                profileBtn.click();
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
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            modal.style.display = "none";
            resolve();
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
                <div class="unifit-warning-icon">!</div>
                <div class="unifit-warning-content">
                    <h3 id="unifitWarningTitle">${escapeHtml(t("unifit.warning.title", "Limited Profile Data"))}</h3>
                    <p>${escapeHtml(t("unifit.warning.desc", "UniFit works best when your profile includes exam scores or language evidence. Without them, the AI ranking may be less accurate."))}</p>
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
        const modal = ensureUniFitWarningModal();
        const okBtn = modal.querySelector("[data-action='confirm']");
        const cancelEls = modal.querySelectorAll("[data-action='cancel']");

        const cleanup = (result) => {
            okBtn?.removeEventListener("click", onOk);
            cancelEls.forEach((el) => el.removeEventListener("click", onCancel));
            document.removeEventListener("keydown", onKey);
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            modal.style.display = "none";
            resolve(result);
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
        modal.classList.add("is-open");
        modal.removeAttribute("aria-hidden");
        okBtn?.focus();
    });

    // --- Слайдеры ---
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
    
    switchView(state.viewMode, false);
    
    const refetch = debounce(() => { 
        state.page = 1; 
        saveFilters(state);
        fetchAndRender(); 
    }, 250);

    // --- Listeners ---
    el.qInput?.addEventListener("input", () => { state.q = el.qInput.value.trim(); refetch(); });
    
    el.countrySelect?.addEventListener("change", () => {
        state.country = el.countrySelect.value; state.region = ""; state.city = ""; 
        if(el.stateSelect) el.stateSelect.value = ""; if(el.citySelect) el.citySelect.value = "";
        updateLocationLogic(state.country); refetch();
    });
    
    el.stateSelect?.addEventListener("change", () => { state.region = el.stateSelect.value; state.city = ""; updateCitiesForState(state.country, state.region); refetch(); });
    el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
    
    if ($("studyLevelSelect")) $("studyLevelSelect").addEventListener("change", () => { state.study_level = $("studyLevelSelect").value; refetch(); });

    el.sortSelect?.addEventListener("change", async () => {
        const nextSort = el.sortSelect.value;
        const prevSort = state.sort;

        if (nextSort === "uni_ai" && prevSort !== "uni_ai") {
            const profile = loadProfile();
            if (!hasProfileEvidence(profile)) {
                el.sortSelect.value = prevSort;
                initCustomSelect("sortSelect");
                const confirmed = await showUniFitWarning();
                if (!confirmed) return;
                el.sortSelect.value = "uni_ai";
                initCustomSelect("sortSelect");
            }
        }

        state.sort = el.sortSelect.value;
        updateSliderVisibility();
        refetch();
    });

    const bindTradeoffSlider = (sliderEl, stateKey, leftTextKey, leftTextFallback, rightTextKey, rightTextFallback, labelEl) => {
        if (!sliderEl) return;
        sliderEl.addEventListener("input", () => {
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
        "Big City Life",
        "universities.tradeoff.location.right",
        "Cozy Campus",
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
            sort: "uni_ai",
            practice_vs_science: 50,
            social_vs_hardcore: 50,
            budget_vs_prestige: 50,
            city_vs_campus: 50,
            page: 1
        });
        saveFilters(state);
        applyToForm();
        if (el.stateDiv) el.stateDiv.style.display = "none"; 
        updateCityDropdown([]); 
        updateSliderVisibility(); 
        fetchAndRender();
    });

    el.list.addEventListener("click", (e) => {
        const card = e.target.closest("[data-uni-id]");
        if (!card || e.target.tagName === "A") return;
        window.location.href = `university.html?id=${encodeURIComponent(card.getAttribute("data-uni-id"))}`;
    });

    el.btnList?.addEventListener("click", () => { switchView("list", true); });
    el.btnMap?.addEventListener("click", () => { switchView("map", true); });

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

    fetchAndRender(); 
    window.addEventListener("profileUpdated", () => {
        state.funding_type = getProfileFundingQueryValue();
        state.page = 1;
        saveFilters(state);
        fetchAndRender();
    });
    window.addEventListener("languageChanged", () => {
        applyAISortOptionLabel();
        updateTradeoffLabels();
        fetchAndRender();
    });

    function switchView(mode, shouldFetch = false) {
        state.viewMode = mode;
        saveFilters(state);
        if (mode === "map") {
            el.list.style.display = "none"; el.pagination.style.display = "none"; 
            el.mapContainer.style.display = "block"; el.btnList.classList.remove("active"); el.btnMap.classList.add("active");
            initMap(); setTimeout(() => { if(mapInstance) mapInstance.invalidateSize(); }, 100);
            if (shouldFetch) fetchAndRender(); 
        } else {
            el.list.style.display = "grid"; el.pagination.style.display = "flex"; el.mapContainer.style.display = "none";
            el.btnList.classList.add("active"); el.btnMap.classList.remove("active");
            if (shouldFetch) fetchAndRender();
        }
    }

    function initMap() {
        if (mapInstance) return;
        if (typeof L === "undefined") return;
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
                const logoUrl = uniLogoSrc(bestId);
                return L.divIcon({ html: `<div class="cluster-node-fix"><div class="map-marker-container"><div class="marker-img-inner" style="background-image: url('${logoUrl}');"></div></div><div class="cluster-badge">+${count - 1}</div></div>`, className: 'cluster-icon-container', iconSize: [44, 44], iconAnchor: [22, 22] });
            }
        });
        markersLayer.on('clusterclick', function (a) { mapInstance.flyToBounds(a.layer.getBounds(), { padding: [80, 80], duration: 1.0 }); });
        mapInstance.addLayer(markersLayer);
    }

    function updateMapMarkers(items) {
        if (!mapInstance || !markersLayer) return;
        markersLayer.clearLayers();
        markersByUniId = new Map();
        const profile = loadProfile(); const userBudget = parseFloat(profile.budget);
        const newMarkers = [];
        items.forEach(u => {
            if (u.coordinates?.lat && u.coordinates?.lon) {
                const uniId = String(u.id || "");
                const customIcon = L.divIcon({ className: 'custom-div-icon', html: `<div class="map-marker-container"><div class="marker-img-inner" style="background-image: url('${uniLogoSrc(uniId)}');"></div></div>`, iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24] });
                const rankValue = Number(u.rank);
                const marker = L.marker([u.coordinates.lat, u.coordinates.lon], {
                    icon: customIcon,
                    uniId: uniId,
                    uniRank: Number.isFinite(rankValue) ? rankValue : 999999
                });
                const cardHTML = `<div class="map-card-wrapper">${renderCard(u, userBudget)}</div>`;
                marker.bindPopup(cardHTML, { minWidth: 280, maxWidth: 320, className: 'custom-map-popup', autoPan: false });
                marker.on('click', function(e) { this.setZIndexOffset(1000); mapInstance.flyTo(e.target.getLatLng(), 16, { animate: true, duration: 3.0, easeLinearity: 0.1 }); setTimeout(() => { if (!marker.getPopup().isOpen()) marker.openPopup(); }, 100); });
                newMarkers.push(marker);
                markersByUniId.set(uniId, marker);
            }
        });
        markersLayer.addLayers(newMarkers);
        if (state.viewMode === "map" && focusUniId && !focusUniDone) {
            const target = markersByUniId.get(focusUniId);
            if (target) {
                focusUniDone = true;
                const latLng = target.getLatLng();
                mapInstance.flyTo(latLng, 14, { animate: true, duration: 1.2 });
                setTimeout(() => {
                    target.setZIndexOffset(1200);
                    target.openPopup();
                }, 700);
            }
        }
    }

    function updateSliderVisibility() {
        if (el.sortStrategyInfoWrap) {
            const showSortInfo = state.sort === "uni_ai";
            el.sortStrategyInfoWrap.style.display = showSortInfo ? "" : "none";
            el.sortStrategyInfoWrap.setAttribute("aria-hidden", showSortInfo ? "false" : "true");
            if (!showSortInfo) el.sortStrategyInfoWrap.classList.remove("is-open");
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
            "Big City Life",
            "universities.tradeoff.location.right",
            "Cozy Campus"
        );
    }
    
    function buildParams(forApi = false) {
        const p = new URLSearchParams();
        state.funding_type = getProfileFundingQueryValue();
        if (state.q) p.set("q", state.q); if (state.country) p.set("country", state.country);
        if (state.region) p.set("region", state.region); if (state.city) p.set("city", state.city);
        if (state.min_tuition) p.set("min_tuition", state.min_tuition);
        if (state.max_tuition) p.set("max_tuition", state.max_tuition);
        if (state.study_level) p.set("study_level", state.study_level);
        if (state.funding_type) p.set("funding_type", state.funding_type);

        const isAiSort = (state.sort === "uni_ai");
        p.set("sort", forApi ? (isAiSort ? "name_asc" : state.sort) : state.sort);

        if (forApi) {
            const profile = loadProfile();
            const major = String(profile?.major || "").trim();
            const mode = String(profile?.studyMode || "").trim();
            if (major) p.set("major", major);
            if (mode && mode.toLowerCase() !== "any") p.set("format", mode);
        }
        
        if (forApi && state.viewMode === "map") {
            p.set("limit", "200"); p.set("page", "1");
        } else {
            if (forApi && isAiSort) { p.set("limit", "100"); p.set("page", "1"); } 
            else { p.set("page", String(state.page)); p.set("limit", String(state.limit)); }
        }
        if (state.practice_vs_science !== undefined && state.practice_vs_science !== null) p.set("practice_vs_science", String(state.practice_vs_science));
        if (state.social_vs_hardcore !== undefined && state.social_vs_hardcore !== null) p.set("social_vs_hardcore", String(state.social_vs_hardcore));
        if (state.budget_vs_prestige !== undefined && state.budget_vs_prestige !== null) p.set("budget_vs_prestige", String(state.budget_vs_prestige));
        if (state.city_vs_campus !== undefined && state.city_vs_campus !== null) p.set("city_vs_campus", String(state.city_vs_campus));
        if (state.viewMode) p.set("view", state.viewMode);
        if (!forApi && focusUniId) p.set("focus_uni", focusUniId);
        return p;
    }

    function buildAiSortPayload() {
        const profile = loadProfileForApi();
        const payload = {
            profile,
            practice_vs_science: state.practice_vs_science,
            social_vs_hardcore: state.social_vs_hardcore,
            budget_vs_prestige: state.budget_vs_prestige,
            city_vs_campus: state.city_vs_campus,
            page: state.page,
            limit: state.limit,
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
        return payload;
    }

    function buildFallbackListParams(apiParams) {
        const fallback = new URLSearchParams(apiParams.toString());
        fallback.set("sort", "name_asc");
        fallback.set("page", String(state.page));
        fallback.set("limit", String(state.limit));
        return fallback;
    }

    function applyToForm() {
        if(el.qInput) el.qInput.value = state.q; if(el.countrySelect) el.countrySelect.value = state.country;
        if(el.stateSelect) el.stateSelect.value = state.region; if(el.citySelect) el.citySelect.value = state.city;
        if (el.sortSelect) {
            state.sort = normalizeSortMode(state.sort);
            el.sortSelect.value = state.sort;
            if (el.sortSelect.value !== state.sort) {
                state.sort = "uni_ai";
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
        
        fillTrack(); 

        ["countrySelect", "stateSelect", "citySelect", "sortSelect", "studyLevelSelect"].forEach(id => initCustomSelect(id));
        updateSliderVisibility();
        updateTradeoffLabels();
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
        let html = `<option value="">🌍 ${escapeHtml(t("universities.global", "Global"))}</option>`;
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
        if(sp.has("sort")) state.sort = normalizeSortMode(sp.get("sort"));
        if (sp.has("practice_vs_science")) state.practice_vs_science = clampPercent(sp.get("practice_vs_science"), state.practice_vs_science);
        if (sp.has("social_vs_hardcore")) state.social_vs_hardcore = clampPercent(sp.get("social_vs_hardcore"), state.social_vs_hardcore);
        if (sp.has("budget_vs_prestige")) state.budget_vs_prestige = clampPercent(sp.get("budget_vs_prestige"), state.budget_vs_prestige);
        if (sp.has("city_vs_campus")) state.city_vs_campus = clampPercent(sp.get("city_vs_campus"), state.city_vs_campus);
        if (!sp.has("budget_vs_prestige") && sp.has("ai_balance")) {
            state.budget_vs_prestige = clampPercent(sp.get("ai_balance"), state.budget_vs_prestige);
        }
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
        if (lastFetchKey === key && lastFetchPayload && (now - lastFetchAt) < CACHE_TTL_MS) {
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
        lastFetchKey = key;
        lastFetchPayload = payload;
        lastFetchAt = now;
        return payload;
    }

    async function fetchUniversitiesAiSort(payload) {
        const key = JSON.stringify(payload);
        const now = Date.now();
        if (lastAiFetchKey === key && lastAiFetchPayload && (now - lastAiFetchAt) < CACHE_TTL_MS) {
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
        lastAiFetchKey = key;
        lastAiFetchPayload = parsed;
        lastAiFetchAt = now;
        return parsed;
    }

    function renderFetchedData(data) {
        const items = data.items || [];
        const total = data.total || 0;
        const warnings = Array.isArray(data.warnings) ? data.warnings : [];
        const mlUnavailable = warnings.some((w) => String(w || "").toLowerCase().includes("machine learning unavailable"));
        const warningText = mlUnavailable ? t("universities.state.ml_unavailable", "Machine Learning unavailable. Using rule-based ranking only.") : "";

        if (state.viewMode === "list") {
            if (el.total) el.total.textContent = String(total);
            hasInitialListPaint = true;

            if (!items.length) {
                if (el.state) {
                    el.state.textContent = warningText ? `${warningText} ${t("universities.state.empty", "No universities found.")}` : t("universities.state.empty", "No universities found.");
                    el.state.classList.toggle("u-state-warning", !!warningText);
                }
                return;
            }
            if (el.state) {
                el.state.textContent = warningText;
                el.state.classList.toggle("u-state-warning", !!warningText);
            }
            const profile = loadProfile();
            const userBudget = parseFloat(profile.budget);
            el.list.innerHTML = items.map((u, idx) => renderCard(u, userBudget, idx)).join("");
            renderPagination(total);
            return;
        }

        if (state.viewMode === "map") {
            if (el.total) el.total.textContent = String(items.length);
            updateMapMarkers(items);
            if (el.state) {
                el.state.textContent = warningText;
                el.state.classList.toggle("u-state-warning", !!warningText);
            }
        }
    }

    async function fetchAndRender() {
        const runSeq = ++fetchRunSeq;
        setUniversitiesLoading(true);
        if (el.state && state.viewMode === 'list') el.state.textContent = "";
        if (state.viewMode === 'list') el.list.innerHTML = "";
        if (el.pagination) el.pagination.innerHTML = "";

        const urlParams = buildParams(false);
        const apiParams = buildParams(true);
        setUrlParams(urlParams);

        try {
        const isAiSort = (state.sort === "uni_ai") && state.viewMode === "list";
        if (isAiSort) {
            const canUseFallback = !hasInitialListPaint && state.page === 1;
            if (!canUseFallback) {
                const aiData = await fetchUniversitiesAiSort(buildAiSortPayload());
                if (aiData?.__aborted) return;
                if (runSeq !== fetchRunSeq) return;
                renderFetchedData(aiData);
                return;
            }

            const aiPayload = buildAiSortPayload();
            const aiPromise = fetchUniversitiesAiSort(aiPayload).catch((err) => {
                if (err?.name !== "AbortError") {
                    console.warn("AI sort request failed, fallback list is kept.", err);
                }
                return null;
            });
            const fastAiData = await Promise.race([
                aiPromise,
                new Promise((resolve) => window.setTimeout(() => resolve(null), AI_FAST_FALLBACK_MS)),
            ]);

            if (fastAiData && !fastAiData.__aborted) {
                if (runSeq !== fetchRunSeq) return;
                renderFetchedData(fastAiData);
                return;
            }

            const fallbackData = await fetchUniversities(buildFallbackListParams(apiParams));
            if (fallbackData?.__aborted) return;
            if (runSeq !== fetchRunSeq) return;
            renderFetchedData(fallbackData);

            aiPromise.then((lateAiData) => {
                if (!lateAiData || lateAiData.__aborted) return;
                if (runSeq !== fetchRunSeq) return;
                if (state.sort !== "uni_ai" || state.viewMode !== "list") return;
                renderFetchedData(lateAiData);
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
        if (el.state) el.state.textContent = t("universities.state.failed", "Failed to load data.");
        } finally {
        if (runSeq === fetchRunSeq) {
            setUniversitiesLoading(false);
            if (firstVisitTourPending) {
                firstVisitTourPending = false;
                window.setTimeout(() => { showUniversitiesTour(); }, 120);
            }
        }
        }
    }

    // --- RENDER CARD (БЕЗ ROI) ---
    function renderCard(u, myBudget, idx = 99) {
        const id = u.id;
        const name = trUniversityName(u);
        const countryRaw = nested(u, ["location", "country"], "");
        const cityRaw = nested(u, ["location", "city"], "");
        const cityText = escapeHtml(trCity(cityRaw));
        const countryText = escapeHtml(trCountry(countryRaw));
        let locString = cityText;
        if (countryRaw) {
            const flagHtml = getFlagImg(countryRaw);
            locString = cityRaw 
                ? `<div style="display:flex; align-items:center; gap:6px;">${cityText}, ${flagHtml} ${countryText}</div>`
                : `<div style="display:flex; align-items:center; gap:6px;">${flagHtml} ${countryText}</div>`;
        }
        const match = u.matchData || {};

        // Базовая цена (трековая, если algo её дал)
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

        const badges = [];

        // Priority 1: warning on missing exam evidence (conditional, not fail)
        if (hasConditionalExamWarning) {
            badges.push(
                `<span class="uni-pill uni-pill--warn">${escapeHtml(t("universities.badge.conditional_exam_needed", "📝 Conditional / Exam Needed"))}</span>`
            );
            whyText = t("universities.why.conditional_exam_needed", "Some required exam evidence is missing, so this result is conditional.");
        }

        // Priority 2: highlight vibe fit from Focus/Atmosphere/Location distance
        if (hasVeryHighVibeMatch) {
            badges.push(
                `<span class="uni-pill uni-pill--success">${escapeHtml(t("universities.badge.your_vibe", "🔥 Your Vibe"))}</span>`
            );
            if (!whyText) whyText = t("universities.why.your_vibe", "This university strongly matches your Focus, Atmosphere, and Location sliders.");
        } else if (hasHighVibeMatch) {
            badges.push(
                `<span class="uni-pill uni-pill--success">${escapeHtml(t("universities.badge.top_match", "⭐ Top Match"))}</span>`
            );
            if (!whyText) whyText = t("universities.why.top_match", "This university is a strong preference match for your current slider setup.");
        }

        // Priority 3: financial route tag from finance slider mode + chance
        if (likelyGrant) {
            badges.push(
                `<span class="uni-pill uni-pill--success">${escapeHtml(t("universities.badge.likely_grant", "🎓 Likely Grant"))}</span>`
            );
            if (!whyText) whyText = t("universities.why.likely_grant", "In grant-priority mode, this university has a strong grant admission chance.");
        } else if (paidAdmission) {
            badges.push(
                `<span class="uni-pill uni-pill--budget">${escapeHtml(t("universities.badge.paid_admission", "💼 Paid Admission"))}</span>`
            );
            if (!whyText) whyText = t("universities.why.paid_admission", "In willing-to-pay mode, this university has a strong general admission chance.");
        }

        // Fallback: acceptance
        if (badges.length === 0) {
        const acc = u.academics?.acceptance_rate_percent;
        badges.push(
            `<span class="uni-pill uni-pill--neutral">${escapeHtml(tFormat("universities.badge.acceptance", { value: String(acc ?? "—") }, `Acceptance: ${String(acc ?? "—")}%`))}</span>`
        );
        }

        badgesHTML = badges.join(" ");

        
        // ROI УБРАН ПОЛНОСТЬЮ

        const logoSrc = uniLogoSrc(id);
        const logoSrcFull = uniLogoSrc(id, { forceFull: true });
        const thumbSrc = uniThumbnailSrc(id);
        const thumbSrcFull = uniThumbnailSrc(id, { forceFull: true });
        const loadingAttr = idx < 4 ? "eager" : "lazy";
        const fetchPriorityAttr = idx < 2 ? "high" : "auto";
        return `
        <article class="uni-card" data-uni-id="${escapeHtml(id)}">
            <div class="uni-media">
            <img class="uni-media-img" src="${thumbSrc}" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" onerror="if(!this.dataset.full){this.dataset.full='1';this.src='${thumbSrcFull}';}else{this.src='${logoSrcFull}';}">
            <div class="uni-price"><small>${escapeHtml(t("universities.card.est_cost_year", "Est. Cost/Year"))}</small><b>${moneyUSD(cost)}</b></div>
            <div class="uni-logo"><img src="${logoSrc}" alt="${initials(name)}" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" onerror="if(!this.dataset.full){this.dataset.full='1';this.src='${logoSrcFull}';}else{this.onerror=null; this.parentNode.textContent='${initials(name)}';}"></div>
            </div>
            <div class="uni-body">
                        <h3 class="uni-title">${escapeHtml(name)}</h3>
            <div class="uni-loc" style="margin-bottom:8px;">📍 ${locString}</div> 
            <div class="uni-badge" style="margin-top:auto; min-height:24px; display:flex; flex-direction:column; align-items:flex-start; gap:4px;">${badgesHTML}</div>
            ${whyText ? `<div class="uni-why">${escapeHtml(whyText)}</div>` : ""}
            </div>
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
// PAGE: UNIVERSITY DETAILS (Детальная)
// =====================================
export async function initUniversityPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const stateEl = document.getElementById("detailState");
  const cardEl = document.getElementById("detailCard");
  const loadingEl = document.getElementById("detailLoading");

  const setDetailLoading = (isLoading) => {
    if (!loadingEl) return;
    loadingEl.classList.toggle("is-visible", !!isLoading);
    loadingEl.setAttribute("aria-hidden", isLoading ? "false" : "true");
  };

  if (!id) {
    if (stateEl) stateEl.innerHTML = `<h2 style='color:red; text-align:center;'>${escapeHtml(t("university.error_no_id", "Error: No ID provided."))}</h2>`;
    return;
  }

  try {
    setDetailLoading(true);
    if (stateEl) stateEl.textContent = "";
    const u = await fetchUniversityDetailCached(id);
    const uniId = String(u.id || id);

    // 1. Шапка
    const setTxt = (eid, val) => { const e = document.getElementById(eid); if (e) e.textContent = val || "—"; };
    const translatedName = trUniversityName(u);
    const translatedCity = trCity(u?.location?.city || "");
    const translatedCountry = trCountry(u?.location?.country || "");
    const profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || "Any");
    const annualCostForTrack = (track) => modeAwareAnnualCost((track && track.finance_override) || u.finance || {}, profileStudyMode);
    setTxt("detailName", translatedName); 
    setTxt("detailLocation", u.location ? `${translatedCity}, ${translatedCountry}` : "—");
    
    let minPrice = modeAwareAnnualCost(u.finance || {}, profileStudyMode);
    if (u.admission_tracks) {
        const prices = u.admission_tracks.map((t) => annualCostForTrack(t));
        if (prices.length > 0) minPrice = Math.min(...prices);
    }
    setTxt("detailPrice", tFormat("university.price_from", { price: moneyUSD(minPrice) }, `from ${moneyUSD(minPrice)} / year`));
    setTxt("detailLogo", (translatedName || "U").substring(0, 2).toUpperCase());

    const coverEl = document.getElementById("detailCover");
    if (coverEl) coverEl.style.backgroundImage = `url('${uniThumbnailSrc(uniId)}')`;

    const logoEl = document.getElementById("detailLogo");
    if (logoEl) {
        const initialsText = (translatedName || "U").substring(0, 2).toUpperCase();
        logoEl.innerHTML = `<img src="${uniLogoSrc(uniId)}" alt="Logo" onerror="if(!this.dataset.full){this.dataset.full='1';this.src='${uniLogoSrc(uniId, { forceFull: true })}';}else{this.style.display='none'; this.parentNode.textContent='${initialsText}';}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const siteBtn = document.getElementById("detailWebsite");
    if (siteBtn && u.website) {
        const safeWebsite = safeUrl(u.website);
        if (safeWebsite) {
            siteBtn.href = safeWebsite;
            siteBtn.style.display = "inline-flex";
        } else {
            siteBtn.removeAttribute("href");
            siteBtn.style.display = "none";
        }
    }
    const mapBtn = document.getElementById("detailMapLink");
    if (mapBtn) {
        const p = new URLSearchParams();
        p.set("view", "map");
        p.set("focus_uni", String(u.id || id));
        if (u.location?.country) p.set("country", String(u.location.country));
        if (u.location?.city) p.set("city", String(u.location.city));
        mapBtn.href = `universities.html?${p.toString()}`;
        mapBtn.style.display = "inline-flex";
    }
    let uniChance = null;
    let uniChanceByTrackKey = new Map();
    let uniRoi = null;
    const recomputeUniChance = async () => {
        try {
            const res = await fetch(`${API_BASE}/universities/${encodeURIComponent(id)}/uni-chance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profile: loadProfileForApi() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || "UniChance API Error");
            uniChance = data || null;
        } catch (err) {
            console.error("Failed to compute UniChance on backend:", err);
            uniChance = null;
        }
        uniChanceByTrackKey = new Map((uniChance?.tracks || []).map((x) => [String(x.trackKey), x]));
    };
    const recomputeUniRoi = async () => {
        try {
            const res = await fetch(`${API_BASE}/universities/${encodeURIComponent(id)}/roi`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profile: loadProfileForApi() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || "ROI API Error");
            uniRoi = data || null;
        } catch (err) {
            console.error("Failed to compute ROI on backend:", err);
            uniRoi = null;
        }
    };
    await Promise.all([recomputeUniChance(), recomputeUniRoi()]);

    // --- TAB 1: GENERAL ---
    const recDiv = document.getElementById("detailRecommendations");
    if (recDiv) {
        const acceptanceDirect = Number(u?.academics?.acceptance_rate_percent);
        const acceptanceValues = (Array.isArray(u?.academics?.programs) ? u.academics.programs : [])
            .map((p) => Number(p?.acceptance_rate_percent))
            .filter((v) => Number.isFinite(v));
        const acceptanceComputed = acceptanceValues.length
            ? (acceptanceValues.reduce((sum, v) => sum + v, 0) / acceptanceValues.length)
            : NaN;
        const acceptanceRate = Number.isFinite(acceptanceDirect)
            ? acceptanceDirect
            : (Number.isFinite(acceptanceComputed) ? acceptanceComputed : null);
        let rankHtml = "<span>—</span>";
        if (u.rank) {
            let trophy = "";
            if (u.rank === 1) trophy = "🥇 "; else if (u.rank === 2) trophy = "🥈 "; else if (u.rank === 3) trophy = "🥉 ";
            rankHtml = `<span style="color:#5d17ea; font-size:1.1em;">${trophy}#${u.rank}</span>`;
        }
        
        const campusSizeRaw = String(u.student_life?.size || "Medium");
        const campusSize = escapeHtml(translateDataValue("campus_size", campusSizeRaw, campusSizeRaw));
        recDiv.innerHTML = `
            <div class="d-kv"><span>${escapeHtml(translateWord("global_rank", "Global Rank"))}</span>${rankHtml}</div>
            <div class="d-kv"><span>${escapeHtml(t("ranking.acceptance", "Acceptance"))}</span><span>${acceptanceRate === null ? "—" : `${Math.round(acceptanceRate * 100) / 100}%`}</span></div>
            <div class="d-kv" style="border-bottom:none;"><span>${escapeHtml(translateWord("campus_size", "Campus Size"))}</span><span>${campusSize}</span></div>
        `;
    }

    const extraDiv = document.getElementById("detailExtra");
    if (extraDiv) {
         const translatedDescription = trUniversityDescription(u);
         const description = translatedDescription
            ? `<p class="uni-description">${escapeHtml(String(translatedDescription)).replace(/\n/g, "<br>")}</p>`
            : "";
         const tags = Array.isArray(u.tags)
            ? u.tags.map((t) => String(t || "").trim()).filter(Boolean)
            : (typeof u.tags === "string" ? u.tags.split(",").map((t) => t.trim()).filter(Boolean) : []);
         const tagsHtml = tags.length
            ? `
                <div class="uni-tags-wrap">
                    <div class="uni-tags-title">${escapeHtml(translateWord("focus_tags", "Focus Tags"))}</div>
                    <div class="uni-tags-list">
                        ${tags.map((tag) => `<span class="uni-tag">${escapeHtml(trTag(tag))}</span>`).join("")}
                    </div>
                </div>
              `
            : "";
         const studentCount = u.student_count ? new Intl.NumberFormat('en-US').format(u.student_count) : "—";
         const formats = Array.isArray(u.academics?.formats)
            ? u.academics.formats.map((x) => escapeHtml(trStudyMode(String(x)))).join(", ")
            : escapeHtml(trStudyMode("On-campus"));
         
         extraDiv.innerHTML = `
            ${description}
            ${tagsHtml}
            <div class="d-kv"><span>${escapeHtml(translateWord("total_students", "Total Students"))}</span><span>${studentCount}</span></div>
            <div class="d-kv" style="border-bottom:none;"><span>${escapeHtml(translateWord("study_formats", "Study Formats"))}</span><span>${formats || escapeHtml(trStudyMode("On-campus"))}</span></div>
         `;
    }

    // --- TAB 2: PROGRAMS ---
    const progDiv = document.getElementById("detailPrograms");
    if (progDiv) {
        const programs = Array.isArray(u?.academics?.programs)
            ? u.academics.programs.filter((p) => p && typeof p === "object")
            : [];

        const prettyField = (key) =>
            String(key || "")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());

        const formatProgramValue = (key, value) => {
            if (value === null || value === undefined || value === "") return "—";
            if (Array.isArray(value)) {
                return value.map((x) => {
                    const raw = String(x);
                    if (String(key) === "study_levels") return trStudyLevel(raw);
                    if (String(key) === "language") return trProgramLanguage(raw);
                    if (String(key) === "study_mode") return trStudyMode(raw);
                    return raw;
                }).join(", ");
            }
            if (typeof value === "boolean") return value ? "Yes" : "No";
            if (String(key) === "acceptance_rate_percent") return `${value}%`;
            if (String(key) === "study_mode") return trStudyMode(String(value));
            return String(value);
        };

        if (programs.length) {
            const knownKeys = new Set(["name", "study_levels", "acceptance_rate_percent", "duration", "language", "study_mode"]);
            progDiv.innerHTML = `
                <div class="program-list">
                    ${programs.map((program, idx) => {
                        const renderValueCell = (key, rawValue, formattedValue) => {
                            if (Array.isArray(rawValue) && rawValue.length) {
                                const translatedItems = rawValue.map((item) => {
                                    const raw = String(item);
                                    if (String(key) === "study_levels") return trStudyLevel(raw);
                                    if (String(key) === "language") return trProgramLanguage(raw);
                                    if (String(key) === "study_mode") return trStudyMode(raw);
                                    return raw;
                                });
                                return `
                                    <div class="program-card-tags">
                                        ${translatedItems.map((item) => `
                                            <span class="program-tag">${escapeHtml(String(item))}</span>
                                        `).join("")}
                                    </div>
                                `;
                            }
                            if (String(key) === "acceptance_rate_percent") {
                                const num = Number(rawValue);
                                if (Number.isFinite(num)) {
                                    const pct = Math.max(0, Math.min(100, num));
                                    return `
                                        <div class="program-acceptance">
                                            <div class="program-acceptance-head">
                                                <span class="program-pill program-pill--accent">${escapeHtml(`${Math.round(pct * 100) / 100}%`)}</span>
                                            </div>
                                            <div class="program-acceptance-track" aria-hidden="true">
                                                <div class="program-acceptance-fill" style="width:${pct}%;"></div>
                                            </div>
                                        </div>
                                    `;
                                }
                                return `<span class="program-card-value program-card-value--empty">${escapeHtml(translateWord("not_specified", "Not specified"))}</span>`;
                            }
                            if (formattedValue === "—") {
                                return `<span class="program-card-value program-card-value--empty">${escapeHtml(translateWord("not_specified", "Not specified"))}</span>`;
                            }
                            return `<span class="program-card-value">${escapeHtml(formattedValue)}</span>`;
                        };

                        const rows = [
                            {
                                label: translateWord("acceptance_rate", "Acceptance Rate"),
                                key: "acceptance_rate_percent",
                                rawValue: program.acceptance_rate_percent,
                                value: formatProgramValue("acceptance_rate_percent", program.acceptance_rate_percent),
                            },
                            {
                                label: translateWord("study_levels", "Study Levels"),
                                key: "study_levels",
                                rawValue: program.study_levels,
                                value: formatProgramValue("study_levels", program.study_levels),
                            },
                            {
                                label: translateWord("duration", "Duration"),
                                key: "duration",
                                rawValue: program.duration,
                                value: formatProgramValue("duration", program.duration),
                            },
                            {
                                label: translateWord("language", "Language"),
                                key: "language",
                                rawValue: program.language,
                                value: formatProgramValue("language", program.language),
                            },
                            {
                                label: translateWord("study_mode", "Study Mode"),
                                key: "study_mode",
                                rawValue: program.study_mode,
                                value: formatProgramValue("study_mode", program.study_mode),
                            },
                        ];

                        const extraRows = Object.entries(program)
                            .filter(([k, v]) => !knownKeys.has(k) && v !== null && v !== undefined && v !== "")
                            .map(([k, v]) => ({
                                label: prettyField(k),
                                key: k,
                                rawValue: v,
                                value: formatProgramValue(k, v),
                            }));

                        const allRows = [...rows, ...extraRows];
                        const modeMeta = formatProgramValue("study_mode", program.study_mode);
                        const durationMeta = formatProgramValue("duration", program.duration);
                        const levelsMeta = Array.isArray(program.study_levels)
                            ? `${program.study_levels.length} ${translateWord("levels", "levels")}`
                            : "";

                        return `
                            <div class="program-card">
                                <div class="program-card-head">
                                    <span class="program-card-index">${escapeHtml(translateWord("program", "Program"))} ${idx + 1}</span>
                                    <div class="program-card-meta">
                                        ${durationMeta !== "—" ? `<span class="program-pill">${escapeHtml(durationMeta)}</span>` : ""}
                                        ${modeMeta !== "—" ? `<span class="program-pill">${escapeHtml(modeMeta)}</span>` : ""}
                                        ${levelsMeta ? `<span class="program-pill">${escapeHtml(levelsMeta)}</span>` : ""}
                                    </div>
                                </div>
                                <div class="program-card-title">
                                    ${escapeHtml(trProgramName(program.name || `${translateWord("program", "Program")} ${idx + 1}`))}
                                </div>
                                <div class="program-card-rows">
                                    ${allRows.map((row) => `
                                        <div class="program-card-row">
                                            <span class="program-card-label">${escapeHtml(row.label)}</span>
                                            ${renderValueCell(row.key, row.rawValue, row.value)}
                                        </div>
                                    `).join("")}
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        } else if (u.academics?.majors) {
            progDiv.innerHTML = u.academics.majors
                .map(m => `<span class="program-major-chip">${escapeHtml(trProgramName(String(m)))}</span>`)
                .join(" ");
        } else {
            progDiv.innerHTML = `<div class="program-empty">${escapeHtml(translateWord("no_program_data", "No program data available."))}</div>`;
        }
    }

    function isLanguageExam(examKey) {
        const k = String(examKey || "").toUpperCase();
        return (
            k.includes("IELTS") ||
            k.includes("TOEFL") ||
            k.includes("DET") ||
            k.includes("DUOLINGO") ||
            k.includes("PTE") ||
            k.includes("CAMBRIDGE") ||
            k.includes("TESTDAF") ||
            k.includes("DSH") ||
            k.includes("DELF") ||
            k.includes("DALF") ||
            k.includes("TCF") ||
            k.includes("TEF") ||
            k.includes("NT2") ||
            k.includes("HSK") ||
            k.includes("JLPT") ||
            k.includes("TOPIK")
        );
        }

        function formatExamScore(examKey, score) {
        const k = String(examKey || "").toUpperCase();
        // В твоей базе GPA в процентах
        if (k === "GPA") return `${score}%`;
        if (k.includes("JLPT")) return `N${score}`;
        if (k.includes("TOPIK") || k.includes("HSK") || k.includes("TESTDAF") || k.includes("DSH")) return `${translateWord("level_word", "Level")} ${score}`;
        return String(score);
        }

        function splitExamEntries(obj) {
        const lang = [];
        const acad = [];
        for (const [k, v] of Object.entries(obj || {})) {
            if (v === null || v === undefined) continue;
            (isLanguageExam(k) ? lang : acad).push([k, v]);
        }
        return { lang, acad };
        }

        function renderExamGroup(title, pairs, color) {
        if (!pairs.length) return "";
        return `
            <div style="margin-top:10px;">
            <div style="font-size:11px; font-weight:800; color:${color}; margin-bottom:6px; letter-spacing:0.4px;">
                ${title}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; font-size:13px;">
                ${pairs.map(([exam, score]) => `
                <div><strong>${escapeHtml(getExamDisplayName(exam))}:</strong> ${escapeHtml(formatExamScore(exam, score))}</div>
                `).join("")}
            </div>
            </div>
        `;
        }

        function cefrLabel(id) {
        const n = Number(id);
        if (n === 1) return "A1";
        if (n === 2) return "A2";
        if (n === 3) return "B1";
        if (n === 4) return "B2";
        if (n === 5) return "C1";
        if (n === 6) return "C2";
        return String(id);
        }

        function renderLanguageRequirements(track) {
        const list = Array.isArray(track?.language_requirements) ? track.language_requirements : [];
        if (!list.length) return "";

        const mode = String(track?.language_requirements_mode || "all").toLowerCase() === "any" ? "any" : "all";
        const modeText = mode === "any"
            ? translateWord("lang_mode_any", "Any one language proof is enough")
            : translateWord("lang_mode_all", "All listed language proofs are required");

        return `
            <div style="margin-top:12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px;">
              <div style="font-size:11px; font-weight:800; color:#1d4ed8; margin-bottom:8px; letter-spacing:0.4px;">
                ${escapeHtml(translateWord("language_track_rules", "LANGUAGE TRACK RULES"))}
              </div>
              <div style="font-size:12px; color:#1e3a8a; margin-bottom:10px;">${escapeHtml(modeText)}</div>
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${list.map(lr => {
                    const code = String(lr?.code || "").toUpperCase();
                    const nativeOk = !!lr?.accept_native;
                    const minCefr = lr?.min_cefr != null ? cefrLabel(lr.min_cefr) : null;
                    const recCefr = lr?.recommended_cefr != null ? cefrLabel(lr.recommended_cefr) : null;

                    const reqPairs = Object.entries(lr?.requirements || {});
                    const avgPairs = Object.entries(lr?.stats_avg || {});

                    return `
                      <div style="background:#fff; border:1px solid #dbeafe; border-radius:8px; padding:10px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                          <span style="font-size:10px; font-weight:800; color:#1d4ed8; border:1px solid #93c5fd; background:#eff6ff; padding:2px 6px; border-radius:999px;">
                            ${escapeHtml(code || "LANG")}
                          </span>
                          ${nativeOk ? `<span style="font-size:11px; color:#065f46; font-weight:700;">${escapeHtml(translateWord("native_accepted", "Native accepted"))}</span>` : ""}
                        </div>
                        ${(minCefr || recCefr) ? `
                          <div style="font-size:12px; color:#334155; margin-bottom:6px;">
                            ${minCefr ? `<span><strong>${escapeHtml(translateWord("min_cefr", "Min CEFR"))}:</strong> ${escapeHtml(minCefr)}</span>` : ""}
                            ${(minCefr && recCefr) ? `<span> • </span>` : ""}
                            ${recCefr ? `<span><strong>${escapeHtml(translateWord("typical", "Typical"))}:</strong> ${escapeHtml(recCefr)}</span>` : ""}
                          </div>
                        ` : ""}
                        ${reqPairs.length ? `
                          <div style="font-size:12px; color:#334155;">
                            <strong>${escapeHtml(translateWord("exam_minimums", "Exam minimums"))}:</strong>
                            ${reqPairs.map(([k, v]) => `<div>${escapeHtml(getExamDisplayName(k, { langCode: lr?.code }))} ≥ ${escapeHtml(String(v))}</div>`).join("")}
                          </div>
                        ` : ""}
                        ${avgPairs.length ? `
                          <div style="font-size:12px; color:#475569; margin-top:6px;">
                            <strong>${escapeHtml(translateWord("typical_admitted", "Typical admitted"))}:</strong>
                            ${avgPairs.map(([k, v]) => `<div>${escapeHtml(getExamDisplayName(k, { langCode: lr?.code }))}: ${escapeHtml(String(v))}</div>`).join("")}
                          </div>
                        ` : ""}
                      </div>
                    `;
                }).join("")}
              </div>
            </div>
        `;
        }

        function trackLookupKey(track, idx) {
        const id = String(track?.id || "").trim();
        if (id) return id;
        const label = String(track?.label || "").trim();
        if (label) return `label:${label}`;
        return `track:${idx}`;
        }

        function chanceTone(chance) {
        const c = Number(chance) || 0;
        if (c >= 80) return { cls: "chance-high", label: translateWord("high_chance", "High chance") };
        if (c >= 60) return { cls: "chance-good", label: translateWord("good_chance", "Good chance") };
        if (c >= 40) return { cls: "chance-medium", label: translateWord("moderate_chance", "Moderate chance") };
        return { cls: "chance-low", label: translateWord("low_chance", "Low chance") };
        }

        function renderUniChanceSummary() {
        if (!uniChance) return "";
        const chance = Number(uniChance.overallChance) || 0;
        const tone = chanceTone(chance);
        return `
            <div class="chance-panel">
              <div class="chance-head">
                <div>
                  <div class="chance-title">${escapeHtml(aiName("chance"))} AI - ${escapeHtml(translateWord("admission_probability_title", "Admission Probability"))}</div>
                  <div class="chance-sub">${escapeHtml(translateWord("admission_probability_sub", "Estimated from your profile, minimum requirements, language rules, selectivity, and affordability context."))}</div>
                </div>
                <div class="chance-percent ${tone.cls}">${chance}%</div>
              </div>
              <div class="chance-meter"><div class="chance-fill ${tone.cls}" style="width:${chance}%;"></div></div>
              <div class="chance-foot">${escapeHtml(translateWord("best_track", "Best track"))}: <strong>${escapeHtml(trTrackLabel(uniChance.bestTrackLabel || translateWord("general_admission", "General admission")))}</strong> • ${escapeHtml(tone.label)}</div>
            </div>
        `;
        }

        function renderTrackChanceChip(trackChance) {
        if (!trackChance) return "";
        const chance = Number(trackChance.chancePercent) || 0;
        const tone = chanceTone(chance);
        return `<div class="chance-track-chip ${tone.cls}">${escapeHtml(aiName("chance"))} ${chance}%</div>`;
        }

        function renderTrackFundingBadge(track) {
        const rawType = String(track?.funding_type || "").trim().toLowerCase();
        const badgeRaw = String(track?.track_badge || "").trim();
        if (!rawType && !badgeRaw) return "";
        const isGrant = rawType === "grant" || /grant|scholar/i.test(badgeRaw);
        const fallback = isGrant ? translateWord("filter_grant", "Grant") : translateWord("filter_paid", "Paid");
        const text = badgeRaw ? trTrackLabel(translateAdmissionText(badgeRaw, badgeRaw)) : fallback;
        const cls = isGrant ? "track-funding-badge--grant" : "track-funding-badge--paid";
        return `<span class="track-funding-badge ${cls}">${escapeHtml(text)}</span>`;
        }

        function getTrackFundingType(track) {
        const rawType = String(track?.funding_type || "").trim().toLowerCase();
        if (rawType === "grant" || rawType === "paid") return rawType;
        const badgeRaw = String(track?.track_badge || "").trim().toLowerCase();
        return /grant|scholar/.test(badgeRaw) ? "grant" : "paid";
        }

        const readAdmissionTrackFilterFromProfile = () => {
            const profile = loadProfile();
            const pref = normalizeFundingPreference(profile?.fundingType || profile?.funding_type || "any");
            return pref === "any" ? "all" : pref;
        };
        let admissionTrackFilter = readAdmissionTrackFilterFromProfile();


    // --- TAB 3: ADMISSION (ИСПРАВЛЕНО: Вернул Цену и Средние баллы) ---
        const reqDiv = document.getElementById("detailRequirements");
        const renderAdmissionTab = () => {
        if (!reqDiv) return;
        const warningHTML = uniChance?.missingEvidence
            ? `<div class="chance-warning">${escapeHtml(translateTemplate("add_profile_evidence", "Add exam scores or language evidence in your profile to unlock a reliable {chance} estimate for this university.", { chance: aiName("chance") }))}</div>`
            : "";
        if (!u.admission_tracks || u.admission_tracks.length === 0) {
            reqDiv.innerHTML = `${warningHTML}<div style="padding:10px 0; color:#666;">${escapeHtml(translateWord("no_admission_tracks_data", "No specific admission tracks data."))}</div>`;
        } else {
            const tracks = Array.isArray(u.admission_tracks) ? u.admission_tracks : [];
            const filteredEntries = tracks
                .map((track, idx) => ({ track, idx }))
                .filter(({ track }) => {
                if (admissionTrackFilter === "all") return true;
                return getTrackFundingType(track) === admissionTrackFilter;
            });
            const totalTracks = tracks.length;
            const shownTracks = filteredEntries.length;
            const admissionFilterLabel = admissionTrackFilter === "grant"
                ? translateWord("filter_grant", "Grant")
                : (admissionTrackFilter === "paid" ? translateWord("filter_paid", "Paid") : translateWord("filter_any", "Any"));
            const admissionFilterClass = admissionTrackFilter === "grant"
                ? "admission-filter-pill--grant"
                : (admissionTrackFilter === "paid" ? "admission-filter-pill--paid" : "admission-filter-pill--any");

            let tracksHTML = warningHTML + renderUniChanceSummary();
            tracksHTML += `
            <div class="admission-filter-row">
                <span class="admission-filter-label">${escapeHtml(translateWord("track_filter", "Track Filter"))}:</span>
                <span class="admission-filter-pill ${admissionFilterClass}">${admissionFilterLabel} (${escapeHtml(translateWord("from_profile", "from profile"))})</span>
                <span class="admission-filter-meta">${escapeHtml(translateTemplate("showing_tracks", "Showing {shown} of {total} tracks", { shown: shownTracks, total: totalTracks }))}</span>
            </div>`;

            filteredEntries.forEach(({ track, idx }) => {
                const trackChance = uniChanceByTrackKey.get(trackLookupKey(track, idx));
                let majorsBadge = "";
                if (track.applicable_majors && track.applicable_majors.length > 0) {
                    majorsBadge = `<div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:6px;">
                        ${track.applicable_majors.map(m => 
                            `<span style="background:#f0fdf4; color:#166534; font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid #bbf7d0;">📚 ${escapeHtml(String(m))}</span>`
                        ).join("")}
                    </div>`;
                } else {
                    majorsBadge = `<span style="font-size:12px; color:#666; font-style:italic;">${escapeHtml(translateWord("for_all_majors", "For all majors"))}</span>`;
                }
                
                const trackPriceOverride = track.finance_override?.total_cost_year_usd;
                const trackPrice = annualCostForTrack(track);
                const isGrantTrack = getTrackFundingType(track) === "grant";
                const trackPriceTitle = isGrantTrack
                    ? (trackPriceOverride != null ? translateWord("est_net_cost", "Est. Net Cost") : translateWord("base_cost_before_grant", "Base Cost (before grant)"))
                    : translateWord("est_cost", "Est. Cost");

                // Требования
                const reqSplit = splitExamEntries(track.requirements || {});
                const minList =
                    renderExamGroup(translateWord("academic_exams", "ACADEMIC EXAMS"), reqSplit.acad, "#6b7280") +
                    renderExamGroup(translateWord("language_exams", "LANGUAGE EXAMS"), reqSplit.lang, "#2563eb");


                // Средние баллы
                const avgSplit = splitExamEntries(track.stats_avg || {});
                let avgList = "";

                if (Object.keys(track.stats_avg || {}).length > 0) {
                avgList =
                    renderExamGroup(translateWord("academic_exams", "ACADEMIC EXAMS"), avgSplit.acad, "#047857") +
                    renderExamGroup(translateWord("language_exams", "LANGUAGE EXAMS"), avgSplit.lang, "#047857");
                } else {
                avgList = `<div style="color:#999; font-style:italic;">${escapeHtml(translateWord("not_available", "Not available"))}</div>`;
                }

                const languageReqInfo = renderLanguageRequirements(track);
                const extraReqs = Array.isArray(track.extra_requirements) ? track.extra_requirements.filter(Boolean) : [];
                const extraReqInfo = extraReqs.length
                    ? `
                    <div style="margin-top:12px; background:#f9fafb; padding:12px; border-radius:8px; border:1px solid #f3f4f6;">
                        <div style="font-size:10px; font-weight:700; color:#6b7280; margin-bottom:6px; text-transform:uppercase;">${escapeHtml(translateWord("extra_requirements", "Extra Requirements"))}</div>
                        <ul style="margin:0; padding-left:18px; font-size:12px; color:#4b5563; line-height:1.4;">
                            ${extraReqs.map((item) => `<li>${escapeHtml(translateAdmissionText(String(item), String(item)))}</li>`).join("")}
                        </ul>
                    </div>
                    `
                    : "";

                // Гранты
                let grantsInfo = "";
                if (track.scholarships && track.scholarships.length > 0) {
                    grantsInfo = `
                    <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #e5e7eb;">
                        <div style="font-size:11px; font-weight:700; color:#059669; margin-bottom:8px; letter-spacing:0.5px;">${escapeHtml(translateWord("available_grants_aid", "AVAILABLE GRANTS & AID"))}:</div>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${track.scholarships.map(s => {
                                let conditions = "";
                                if (s.requirements) {
                                    conditions = Object.entries(s.requirements)
                                        .map(([k, v]) => `${escapeHtml(String(k))} ≥ ${escapeHtml(String(v))}`)
                                        .join(" • ");
                                }
                                const badgeText = s.amount 
                                    ? `${translateWord("cover", "Cover")}: ${moneyUSD(s.amount)}` 
                                    : (s.type === 'need' ? translateWord("need_based_aid", "Need-based Aid") : translateWord("merit_scholarship", "Merit Scholarship"));
                                const safeBadgeText = escapeHtml(String(badgeText));

                                return `
                                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 10px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                        <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#064e3b; font-size:13px;">
                                            <span>🏆</span> ${escapeHtml(String(s.name || ""))}
                                        </div>
                                        <div style="font-size:10px; font-weight:700; background:#fff; color:#059669; padding:2px 6px; border-radius:4px; border:1px solid #86efac;">
                                            ${safeBadgeText}
                                        </div>
                                    </div>
                                    ${conditions ? `
                                        <div style="font-size:11px; color:#4b5563; margin-left:22px;">
                                            <span style="font-weight:600; color:#059669;">${escapeHtml(translateWord("requires", "Requires"))}:</span> ${conditions}
                                        </div>
                                    ` : `<div style="font-size:11px; color:#9ca3af; margin-left:22px; font-style:italic;">${escapeHtml(translateWord("no_specific_requirements_listed", "No specific requirements listed"))}</div>`}
                                </div>
                                `;
                            }).join("")}
                        </div>
                    </div>`;
                }

                tracksHTML += `
                <div class="track-card" style="border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin-bottom:16px; background:#fff; box-shadow:0 2px 5px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <div>
                            <h4 style="margin:0 0 4px 0; font-size:18px; color:#5d17ea;">${escapeHtml(trTrackLabel(String(track.label || translateWord("track", "Track"))))}</h4>
                            ${renderTrackFundingBadge(track)}
                            ${renderTrackChanceChip(trackChance)}
                            ${majorsBadge}
                            <p style="margin:8px 0 0; font-size:13px; color:#555; line-height:1.5;">${escapeHtml(trTrackDescription(u.id, track.id, String(track.description || ""))).replace(/\n/g, "<br>")}</p>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px; color:#666;">${trackPriceTitle}</div>
                            <div style="font-size:16px; font-weight:800; color:#111;">${moneyUSD(trackPrice)}</div>
                        </div>
                    </div>
                    
                    <div class="track-stats-grid">
                        <div style="background:#f9fafb; padding:12px; border-radius:8px; border:1px solid #f3f4f6;">
                            <div style="font-size:10px; font-weight:700; color:#6b7280; margin-bottom:6px; text-transform:uppercase;">${escapeHtml(translateWord("minimum_to_apply", "Minimum To Apply"))}</div>
                            <div style="font-size:13px; display:flex; flex-direction:column; gap:4px;">${minList || escapeHtml(translateWord("none", "None"))}</div>
                        </div>
                        <div style="background:#ecfdf5; padding:12px; border-radius:8px; border:1px solid #d1fae5;">
                            <div style="font-size:10px; font-weight:700; color:#047857; margin-bottom:6px; text-transform:uppercase;">${escapeHtml(translateWord("real_average_admitted", "Real Average (Admitted)"))}</div>
                            <div style="font-size:13px; display:flex; flex-direction:column; gap:4px;">${avgList}</div>
                        </div>
                    </div>
                    ${languageReqInfo}
                    ${extraReqInfo}
                    ${grantsInfo}
                </div>
                `;
            });
            if (!filteredEntries.length) {
                tracksHTML += `<div style="padding:10px 0; color:#666;">${escapeHtml(translateWord("no_tracks_selected_filter", "No tracks for selected filter."))}</div>`;
            }
            reqDiv.innerHTML = tracksHTML;
        }
    };
    renderAdmissionTab();
    window.addEventListener("profileUpdated", async () => {
        admissionTrackFilter = readAdmissionTrackFilterFromProfile();
        await Promise.all([recomputeUniChance(), recomputeUniRoi()]);
        renderAdmissionTab();
    });

    // --- TAB 4: FINANCE (С блоком ROI) ---
    const finDiv = document.getElementById("detailFinance");
    const scholDiv = document.getElementById("detailScholarshipInfo"); 
    const priceBig = document.getElementById("detailPrice");           
    
    if (u.finance) {
        // Блок скидок
        if (scholDiv) {
            const fa = u.finance.financial_aid || {};
            const meritHtml = fa.merit_based 
                ? `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:600; color:#065f46;"><span style="font-size:16px;">✅</span> ${escapeHtml(translateWord("merit_based_scholarships_available", "Merit-based scholarships available"))}</div>` 
                : `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; opacity:0.6; color:#4b5563;"><span style="font-size:16px;">❌</span> ${escapeHtml(translateWord("no_merit_based_scholarships", "No merit-based scholarships"))}</div>`;
            const needHtml = fa.need_based 
                ? `<div style="display:flex; align-items:center; gap:8px; font-weight:600; color:#065f46;"><span style="font-size:16px;">✅</span> ${escapeHtml(translateWord("need_based_financial_aid", "Need-based financial aid"))}</div>` 
                : `<div style="display:flex; align-items:center; gap:8px; opacity:0.6; color:#4b5563;"><span style="font-size:16px;">❌</span> ${escapeHtml(translateWord("no_need_based_aid", "No need-based aid"))}</div>`;
            scholDiv.innerHTML = meritHtml + needHtml;
        }

        // Блок цены
        if (priceBig) {
            let minTotal = modeAwareAnnualCost(u.finance || {}, profileStudyMode);
            if (u.admission_tracks) {
                const prices = u.admission_tracks.map((t) => annualCostForTrack(t)).filter((p) => p > 0);
                if (prices.length > 0) minTotal = Math.min(...prices);
            }
            priceBig.innerHTML = `<span style="font-size:0.5em; color:#64748b; vertical-align:middle; margin-right:4px;">${escapeHtml(translateWord("from", "from"))}</span>${moneyUSD(minTotal)}`;
        }
        
        // Карточки треков
        if (finDiv) {
            finDiv.innerHTML = ""; 
            const tracks = (u.admission_tracks && u.admission_tracks.length > 0) ? u.admission_tracks : [{ label: translateWord("general_tuition", "General Tuition"), finance_override: null }];
            let financeHTML = "";

            tracks.forEach(track => {
                const fData = track.finance_override || u.finance;
                const total = modeAwareAnnualCost(fData || {}, profileStudyMode);
                const breakdown = modeAwareBreakdown(fData || {}, profileStudyMode);

                let barHTML = `<div class="cost-progress-bar" style="height:8px; display:flex; border-radius:4px; overflow:hidden; background:#e5e7eb;">`;
                let legendHTML = `<div class="cost-legend">`;
                
                const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
                let i = 0;

                if (Object.keys(breakdown).length > 0) {
                    for (const [key, val] of Object.entries(breakdown)) {
                        const color = colors[i % colors.length];
                        const numericVal = Number(val) || 0;
                        const percent = total > 0 ? ((numericVal / total) * 100) : 0;
                        barHTML += `<div style="width:${percent}%; background:${color};" title="${escapeHtml(String(key))}"></div>`;
                        legendHTML += `
                            <div style="display:flex; align-items:center; font-size:13px; margin-bottom:6px;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span style="width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0;"></span>
                                    <span style="color:#555;">${escapeHtml(String(key)).replace(/_/g, " ")}</span>
                                </div>
                                <span style="font-weight:700; color:#111; margin-left:12px;">${moneyUSD(numericVal)}</span>
                            </div>
                        `;
                        i++;
                    }
                } else {
                    barHTML += `<div style="width:100%; background:#3b82f6;"></div>`;
                    legendHTML += `<div style="font-size:13px;">Tuition: <b>${moneyUSD(total)}</b></div>`;
                }
                barHTML += `</div>`;
                legendHTML += `</div>`;

                financeHTML += `
                <div class="finance-card">
                    <div class="finance-header">
                        <div class="finance-track-name">${escapeHtml(trTrackLabel(String(track.label || translateWord("general_tuition", "General Tuition"))))}</div>
                        <div class="finance-total">
                            <small>${escapeHtml(translateWord("total_per_year", "Total / Year"))}</small>
                            <span>${moneyUSD(total)}</span>
                        </div>
                    </div>
                    
                    <div class="finance-body">
                        ${barHTML}
                        ${legendHTML}
                    </div>

                    ${track.scholarships && track.scholarships.length > 0 ? `
                        <div class="finance-footer">
                            <div class="finance-grant-title">${escapeHtml(translateWord("available_scholarships", "Available Scholarships"))}:</div>
                            <ul class="finance-grant-list">
                                ${track.scholarships.map(s => `<li>${escapeHtml(translateAdmissionText(String(s.name || ""), String(s.name || "")))}</li>`).join("")}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                `;
            });

            // ROI block is calculated on backend.
            const roi = uniRoi || {};
            const roiTitle = escapeHtml(String(roi.title || t("roi.title", "Estimated ROI (Return on Investment)")));
            const roiValueNum = Number(roi.roi_value);
            const roiValue = Number.isFinite(roiValueNum) ? roiValueNum.toFixed(1) : "0.0";
            const userSalary = Number(roi.salary_used_usd) || 0;
            const roiLabel = escapeHtml(String(roi.roi_label || t("roi.label.high_investment", "High Investment")));
            const roiTone = String(roi.roi_tone || "warn");
            const roiColor = (roiTone === "excellent" || roiTone === "good") ? "#059669" : "#d97706";
            const roiContextType = String(roi.context_type || "");
            const userMajor = escapeHtml(String(roi.user_major || ""));
            const points = Number(roi.salary_data_points) || 0;
            const avgHint = points > 0
                ? t("roi.avg_hint_all_majors", "Showing computed average across all majors.")
                : t("roi.avg_hint_all_graduates", "Showing average for all graduates.");

            let roiContent = "";
            if (roiContextType === "matched_major") {
                roiContent = `
                    <div style="background:#d1fae5; color:#065f46; padding:12px; border-radius:8px; margin-bottom:15px; font-size:13px; border:1px solid #a7f3d0;">
                        ✅ ${tFormat("roi.context.matched_major", { major: userMajor }, "Calculation based on {major} graduates from this university.")}
                    </div>
                `;
            } else if (roiContextType === "missing_major") {
                roiContent = `
                    <div style="background:#fff3cd; color:#856404; padding:12px; border-radius:8px; margin-bottom:15px; font-size:13px; border:1px solid #ffeeba;">
                        ⚠️ <strong>${escapeHtml(t("roi.tip", "Tip:"))}</strong> ${escapeHtml(t("roi.context.missing_major", "Select your Major in Profile to see precise ROI for your field."))} ${escapeHtml(avgHint)}
                    </div>
                `;
            } else if (roiContextType === "fallback_major") {
                roiContent = `
                    <div style="background:#f3f4f6; color:#374151; padding:12px; border-radius:8px; margin-bottom:15px; font-size:13px; border:1px solid #e5e7eb;">
                        ℹ️ ${tFormat("roi.context.fallback_major", { major: userMajor }, "Specific data for {major} not available.")} ${escapeHtml(avgHint)}
                    </div>
                `;
            } else {
                roiContent = `
                    <div style="background:#f3f4f6; color:#374151; padding:12px; border-radius:8px; margin-bottom:15px; font-size:13px; border:1px solid #e5e7eb;">
                        ℹ️ ${escapeHtml(t("roi.context.default", "ROI is based on available university outcomes data."))}
                    </div>
                `;
            }
            
            const roiBlock = `
                <div class="roi-box" style="margin-top:30px; background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:25px; box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                    <h3 style="margin:0 0 10px 0; color:#5d17ea; font-size:18px;">${roiTitle}</h3>
                    <p style="font-size:13px; color:#666; margin-bottom:20px; line-height:1.5;">
                        <b>${escapeHtml(t("roi.what_is", "What is ROI?"))}</b> ${escapeHtml(t("roi.explain", "It calculates how many times your first annual salary covers the cost of one year of education."))}
                        <br><i>${escapeHtml(t("roi.formula", "Formula: Avg. Graduate Salary / Annual Tuition Cost"))}</i>
                    </p>
                    
                    ${roiContent}

                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px;">
                        <div style="flex:1; min-width:200px;">
                            <div style="font-size:12px; color:#666; text-transform:uppercase; font-weight:700;">${escapeHtml(t("roi.estimated_salary", "Est. Graduate Salary"))}</div>
                            <div style="font-size:24px; font-weight:800; color:#111;">${moneyUSD(userSalary)}</div>
                            <div style="font-size:11px; color:#999;">${escapeHtml(t("roi.per_year_early", "per year (early career)"))}</div>
                        </div>
                        <div style="width:1px; height:50px; background:#eee; display:none; @media(min-width:600px){display:block;}"></div>
                        <div style="flex:1; min-width:200px;">
                            <div style="font-size:12px; color:#666; text-transform:uppercase; font-weight:700;">${escapeHtml(t("roi.score", "ROI Score"))}</div>
                            <div style="font-size:32px; font-weight:900; color:${roiColor};">
                                ${roiValue}x
                            </div>
                            <div style="font-size:11px; color:${roiColor}; font-weight:600;">
                                ${roiLabel}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            finDiv.innerHTML = `<div class="finance-grid-new">${financeHTML}</div>` + roiBlock;
        }
    }

    if (stateEl) stateEl.textContent = "";
    if (cardEl) {
        cardEl.style.display = "block";
        cardEl.classList.add("is-mounted");
    }
    setupTabs(); 
    window.addEventListener("languageChanged", () => {
      window.location.reload();
    }, { once: true });

  } catch (err) {
    console.error(err);
    if (stateEl) stateEl.textContent = t("university.error_loading", "Error loading details.");
  } finally {
    setDetailLoading(false);
  }
}

// =====================================
// PAGE: RANKING (Исправлена сортировка)
// =====================================
export async function initRankingPage() {
    const listEl = document.getElementById("rankingList");
    if (!listEl) return;
    window.addEventListener("languageChanged", () => { initRankingPage(); }, { once: true });

    try {
        // Запрашиваем 200 вузов
        const res = await fetch(`${API_BASE}/universities?limit=200&sort=rank_asc`);
        if (!res.ok) throw new Error("Error loading ranking");
        const data = await res.json();
        let items = data.items || [];

        const html = items.map((u, index) => {
            const rank = u.rank || (index + 1);
            
            // Цвета для топ-3
            let rankClass = "";
            if (rank === 1) rankClass = "rank-1";
            else if (rank === 2) rankClass = "rank-2";
            else if (rank === 3) rankClass = "rank-3";

            const logoSrc = uniLogoSrc(u.id);
            const logoSrcFull = uniLogoSrc(u.id, { forceFull: true });
            const thumbSrc = uniThumbnailSrc(u.id);
            const thumbSrcFull = uniThumbnailSrc(u.id, { forceFull: true });
            const loadingAttr = index < 4 ? "eager" : "lazy";
            const fetchPriorityAttr = index < 2 ? "high" : "auto";
            const flag = getFlagImg(u.location.country);
            const cityText = escapeHtml(trCity(String(u.location.city || "")));
            const countryText = escapeHtml(trCountry(String(u.location.country || "")));
            const uniName = trUniversityName(u);

            return `
            <a href="university.html?id=${encodeURIComponent(u.id)}" class="rank-card">
                <img class="rank-bg-img" src="${thumbSrc}" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" onerror="if(!this.dataset.full){this.dataset.full='1';this.src='${thumbSrcFull}';}else{this.src='${logoSrcFull}';}">
                <div class="rank-num ${rankClass}">#${rank}</div>
                <div class="rank-logo">
                    <img src="${logoSrc}" alt="${initials(uniName)}" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" onerror="if(!this.dataset.full){this.dataset.full='1';this.src='${logoSrcFull}';}else{this.parentNode.textContent='${initials(uniName)}';}">
                </div>
                <div class="rank-info">
                    <div class="rank-title">${escapeHtml(uniName)}</div>
                    <div class="rank-loc">
                        ${flag} 
                        <span style="margin-left:6px;">${cityText}, ${countryText}</span>
                    </div>
                </div>
                <div class="rank-badge">
                    ${escapeHtml(t("ranking.acceptance", "Acceptance"))}: <b>${u.academics.acceptance_rate_percent}%</b>
                </div>
            </a>
            `;
        }).join("");

        listEl.innerHTML = html;

    } catch (err) {
        console.error(err);
        listEl.innerHTML = `<div style="padding:20px; text-align:center; color:red;">${escapeHtml(t("ranking.failed", "Failed to load rankings."))}</div>`;
    }
}

// =====================================
// PAGE: GUIDE
// =====================================
export function initGuidePage() {
    const page = document.getElementById("guidePage");
    if (!page) return;
    const navLinks = Array.from(page.querySelectorAll(".guide-nav a[href^='#guide-']"));
    const sections = Array.from(page.querySelectorAll(".guide-section[id]"));

    const academicWrap = document.getElementById("guideAcademicExams");
    const languageWrap = document.getElementById("guideLanguageExams");
    const glossaryWrap = document.getElementById("guideGlossary");

    const fitName = aiName("fit");
    const chanceName = aiName("chance");
    const gloss = [
        { term: fitName, desc: t("guide.glossary.fit", "AI ranking mode that balances prestige, affordability, and admission feasibility.") },
        { term: chanceName, desc: t("guide.glossary.chance", "AI probability (0-100) of your admission, computed per track from your profile and requirements.") },
        { term: t("guide.glossary.term.swr", "SWR Cache"), desc: t("guide.glossary.swr", "Stale-While-Revalidate: show cached data instantly, then refresh in background and update if changed.") },
        { term: t("guide.glossary.term.admission_track", "Admission Track"), desc: t("guide.glossary.admission_track", "A specific way to apply to a university (e.g., direct, exam-based, scholarship path).") },
        { term: t("guide.glossary.term.requirements", "Requirements"), desc: t("guide.glossary.requirements", "Minimum scores to be considered for a track.") },
        { term: t("guide.glossary.term.stats_avg", "Stats Avg"), desc: t("guide.glossary.stats_avg", "Typical scores of admitted students on that track.") },
        { term: t("guide.glossary.term.language_requirements", "Language Requirements"), desc: t("guide.glossary.language_requirements", "Accepted proof of language ability: native, CEFR, or language exam.") },
        { term: t("guide.glossary.term.mode_any", "Mode = any"), desc: t("guide.glossary.mode_any", "You need to satisfy at least one listed language option.") },
        { term: t("guide.glossary.term.mode_all", "Mode = all"), desc: t("guide.glossary.mode_all", "You must satisfy every listed language requirement.") },
        { term: t("guide.glossary.term.match_score", "Match Score"), desc: tFormat("guide.glossary.match_score", { fit: fitName }, `Internal ${fitName} ranking score; higher means a better fit for your profile.`) },
    ];

    const normalizeExamId = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const scoreScaleText = (cfg) => {
        const min = Number(cfg?.min);
        const max = Number(cfg?.max);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return "";
        if (min === max) return "";
        return tFormat("guide.scale_text", { min, max }, `In UniSearch, this score is entered on a ${min}-${max} scale.`);
    };

    const guideLoadingMarkup = (label) => `
        <div class="center-loading center-loading--compact" role="status" aria-label="${escapeHtml(String(label || t("common.loading", "Loading")))}">
            <div class="center-loading-spinner center-loading-spinner--sm" aria-hidden="true"></div>
        </div>
    `;

    const academicExamDescriptions = {
        SAT: t("guide.academic.sat", "SAT is a standardized college admissions exam widely used for undergraduate applications, focused on evidence-based reading, writing, and mathematics."),
        ACT: t("guide.academic.act", "ACT is a standardized admissions exam used by many universities, covering English, mathematics, reading, and science reasoning."),
        GPA: t("guide.academic.gpa", "GPA represents cumulative school academic performance across courses and is often used as a baseline indicator of consistency."),
        UNT: t("guide.academic.unt", "UNT (Unified National Testing) is the national exam used in Kazakhstan for many undergraduate admission pathways."),
        NUETTOTAL: t("guide.academic.nuettotal", "This is a combined entrance test score used in specific institutional admission routes."),
        APTOTAL: t("guide.academic.aptotal", "AP Total reflects combined performance across multiple Advanced Placement subjects."),
        IBDIPLOMA: t("guide.academic.ibdiploma", "IB Diploma score is the overall International Baccalaureate Diploma result used in many global admissions systems."),
    };

    function describeAcademicExam(id, cfg) {
        const normalized = normalizeExamId(id);
        const base = academicExamDescriptions[normalized]
            || t("guide.academic.default", "This is an academic metric used by one or more admission tracks in the UniSearch dataset.");
        const scale = scoreScaleText(cfg);
        return `${base}${scale ? ` ${scale}` : ""}`.trim();
    }

    function describeLanguageExam(examId, langCode, cfg, labelText = "") {
        const exam = String(examId || "").toUpperCase();
        const label = String(labelText || "").toUpperCase();
        const key = `${exam} ${label}`;

        let base = t("guide.language.default", "This language proficiency exam is used to verify readiness for study in the program language.");
        if (key.includes("IELTS")) {
            base = t("guide.language.ielts", "IELTS evaluates English proficiency across listening, reading, writing, and speaking for academic contexts.");
        } else if (key.includes("TOEFL")) {
            base = t("guide.language.toefl", "TOEFL measures academic English proficiency and is commonly accepted for university admissions.");
        } else if (key.includes("DUOLINGO") || key.includes("DET")) {
            base = t("guide.language.det", "Duolingo English Test is an online adaptive English proficiency exam accepted by many institutions.");
        } else if (key.includes("PTE")) {
            base = t("guide.language.pte", "PTE Academic is a computer-based English proficiency test used in international admissions.");
        } else if (key.includes("CAMBRIDGE")) {
            base = t("guide.language.cambridge", "Cambridge English qualifications assess practical English proficiency at standardized CEFR-aligned levels.");
        } else if (key.includes("TESTDAF") || key.includes("DSH")) {
            base = t("guide.language.german", "TestDaF and DSH are German-language proficiency exams commonly required for German-taught study tracks.");
        } else if (key.includes("DELF") || key.includes("DALF") || key.includes("TCF") || key.includes("TEF")) {
            base = t("guide.language.french", "These exams assess French proficiency and are used for French-language academic eligibility.");
        } else if (key.includes("NT2")) {
            base = t("guide.language.dutch", "NT2 is a Dutch-as-a-second-language exam used to confirm readiness for Dutch-language study.");
        } else if (key.includes("HSK")) {
            base = t("guide.language.hsk", "HSK measures Chinese language proficiency for academic and formal language use.");
        } else if (key.includes("JLPT")) {
            base = t("guide.language.jlpt", "JLPT measures Japanese language proficiency across standard difficulty levels.");
        } else if (key.includes("TOPIK")) {
            base = t("guide.language.topik", "TOPIK measures Korean language proficiency and is used for Korean-language academic readiness.");
        } else if (langCode) {
            base = tFormat("guide.language.by_code", { code: String(langCode).toUpperCase() }, `This exam is used as language proof for ${String(langCode).toUpperCase()}-language admission tracks.`);
        }

        const scale = scoreScaleText(cfg);
        return `${base}${scale ? ` ${scale}` : ""}`.trim();
    }

    function renderGlossary() {
        if (!glossaryWrap) return;
        const lines = gloss.map((g) => `<li><strong>${escapeHtml(g.term)}:</strong> ${escapeHtml(g.desc)}</li>`).join("");
        glossaryWrap.innerHTML = `
            <p>${escapeHtml(t("guide.glossary.intro", "This glossary defines the exact terms used throughout UniSearch so users can interpret ranking and probability outputs consistently."))}</p>
            <ul class="guide-list">${lines}</ul>
        `;
    }

    function renderAcademicExams() {
        if (!academicWrap) return;

        const langIds = new Set();
        const groups = LANG_CONFIG?.language_exams || {};
        for (const arr of Object.values(groups)) {
            if (!Array.isArray(arr)) continue;
            arr.forEach((x) => langIds.add(String(x?.id || "").trim()));
        }

        const seen = new Set();
        const exams = Object.entries(EXAM_CONFIG || {})
            .filter(([id]) => !langIds.has(String(id)))
            .filter(([id]) => {
                const normalized = canonicalizeExamId(id);
                const key = String(normalized || id).toUpperCase().replace(/[^A-Z0-9]/g, "");
                if (!key) return false;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => getExamDisplayName(a[0]).localeCompare(getExamDisplayName(b[0])));

        if (!exams.length) {
            academicWrap.innerHTML = guideLoadingMarkup(t("guide.loading_exam_config", "Loading exam config"));
            return;
        }

        const items = exams.map(([id, cfg]) =>
            `<li><strong>${escapeHtml(getExamDisplayName(id))}.</strong> ${escapeHtml(describeAcademicExam(id, cfg))}</li>`
        ).join("");
        academicWrap.innerHTML = `
            <p>${escapeHtml(t("guide.academic.intro", "The following academic exams are currently used by UniSearch for admission track matching and recommendation quality."))}</p>
            <ul class="guide-list">${items}</ul>
        `;
    }

    function renderLanguageExams() {
        if (!languageWrap) return;
        const groups = LANG_CONFIG?.language_exams || {};
        const languages = LANG_CONFIG?.languages || [];
        const nameByCode = Object.fromEntries(languages.map((x) => [x.code, x.name || x.label || x.code]));

        const codes = Object.keys(groups).sort();
        if (!codes.length) {
            languageWrap.innerHTML = guideLoadingMarkup(t("guide.loading_language_config", "Loading language exam config"));
            return;
        }

        languageWrap.innerHTML = codes.map((code) => {
            const arr = Array.isArray(groups[code]) ? groups[code] : [];
            if (!arr.length) return "";
            const title = nameByCode[code] || code.toUpperCase();

            return `
                <section class="guide-subsection">
                    <h4>${escapeHtml(title)} (${escapeHtml(code.toUpperCase())})</h4>
                    <ul class="guide-list">
                        ${arr.map((ex) => {
                            const examLabel = getExamDisplayName(ex?.id, { langCode: code });
                            return `<li><strong>${escapeHtml(examLabel)}.</strong> ${escapeHtml(describeLanguageExam(ex?.id, code, ex, examLabel))}</li>`;
                        }).join("")}
                    </ul>
                </section>
            `;
        }).join("");
    }

    function renderAll() {
        renderGlossary();
        renderAcademicExams();
        renderLanguageExams();
    }

    const sectionById = new Map(sections.map((sec) => [sec.id, sec]));
    const activateSection = (id, updateHash = false) => {
        const nextId = sectionById.has(id) ? id : (sections[0]?.id || "");
        if (!nextId) return;

        sections.forEach((sec) => {
            const active = sec.id === nextId;
            sec.classList.toggle("is-active", active);
            sec.setAttribute("aria-hidden", active ? "false" : "true");
        });

        navLinks.forEach((link) => {
            const active = link.getAttribute("href") === `#${nextId}`;
            link.classList.toggle("is-active", active);
            link.setAttribute("aria-current", active ? "page" : "false");
        });

        if (updateHash) {
            history.replaceState(null, "", `#${nextId}`);
        }
    };

    navLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            activateSection((link.getAttribute("href") || "").replace("#", ""), true);
        });
    });

    window.addEventListener("hashchange", () => {
        activateSection(String(window.location.hash || "").replace("#", ""), false);
    });

    renderAll();
    activateSection(String(window.location.hash || "").replace("#", ""), false);
    window.addEventListener("examConfigLoaded", renderAll);
    window.addEventListener("languageConfigLoaded", renderAll);
}
