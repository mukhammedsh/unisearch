import {
  escapeHtml,
  getFlagImg,
  loadProfile,
  motionPress,
  replayMotion,
} from "../../utils.js";
import { renderErrorScreen, setupTabs } from "../../components.js";
import { classifyError } from "../../components/network-status.js";
import { formatPrice } from "../../currency.js";
import { t, tFormat } from "../../i18n.js";
import { extractUniversityIdFromLocation, routeUniversities } from "../../routes.js";
import { bindInfoTooltips } from "../../tooltip.js";
import { initUniversityTranslations } from "../../university-translations.js";
import { renderExtraSection, renderOverviewSection, renderProgramsSection, renderQualificationGuidance, resolveProgramByIdentifier, resolveProgramByName } from "./render-content.js";
import { getAdmissionContextProfile, getFinanceChoicesForStudyLevel, getFinanceForChoice, renderAdmissionSection, renderDeadlinesTabSection, renderFinanceSection, selectAdmissionProgram } from "./render-sections.js";
import { mountAdmissionsCatalog, REVIEWED_ADMISSIONS_IDS } from "./admissions-controller.js";
import { mountTabsNavigation } from "./tabs-navigation.js";
import { mountOverviewSummary } from "./overview-summary.js";
import { mountUniversityGallery } from "./gallery.js";
import { isCoverTransitionActive, waitForCoverTransition } from "../../components/cover-transition.js";
import { heroIcon } from "../../icons.js";
import {
  fetchUniversityDetailCached,
  modeAwareAnnualCost,
  normalizeStudyModeForCost,
  readIdListStorage,
  rememberRecentUniversity,
  renderInlineIcon,
  SAVED_UNIVERSITIES_KEY,
  safeUrl,
  textOrUnknown,
  toFiniteNumber,
  trCity,
  trCountry,
  trUniversityName,
  unknownFieldText,
  writeIdListStorage,
} from "../_shared.js";

let detailProfileUpdatedHandler = null;
let detailLanguageChangedHandler = null;
let detailLanguageVisualPendingHandler = null;
let detailLanguageFinishedHandler = null;
let detailCurrencyChangedHandler = null;
let detailOnlineReconnectHandler = null;
let detailPopStateHandler = null;
let detailAdmissionsCleanup = null;
let detailOverviewSummaryCleanup = null;
let detailGalleryCleanup = null;
let detailTabsCleanup = null;
let detailPageVersion = 0;

function clearDetailLanguageSkeletons() {
  const card = document.getElementById("detailCard");
  if (!card) return;
  card.classList.remove("is-language-refreshing");
  card.removeAttribute("aria-busy");
  card.querySelectorAll(".d-language-text-skeleton").forEach((node) => node.remove());
}

function showDetailLanguageSkeletons() {
  const card = document.getElementById("detailCard");
  if (!card || !card.classList.contains("is-mounted") || card.style.display === "none") return;
  card.classList.add("is-language-refreshing");
  card.setAttribute("aria-busy", "true");

  const head = card.querySelector(".d-head-main");
  if (head && !head.querySelector(".d-language-head-skeleton")) {
    head.insertAdjacentHTML("beforeend", `
      <div class="d-language-text-skeleton d-language-head-skeleton" aria-hidden="true">
        <span class="skeleton-line d-language-skeleton-title"></span>
        <span class="skeleton-line d-language-skeleton-line d-language-skeleton-line--short"></span>
      </div>
    `);
  }

  card.querySelectorAll(".d-tab-pane.active > .d-box").forEach((box) => {
    if (box.querySelector(".d-language-box-skeleton")) return;
    box.insertAdjacentHTML("beforeend", `
      <div class="d-language-text-skeleton d-language-box-skeleton" aria-hidden="true">
        <span class="skeleton-line d-language-skeleton-heading"></span>
        <span class="skeleton-line d-language-skeleton-line"></span>
        <span class="skeleton-line d-language-skeleton-line"></span>
        <span class="skeleton-line d-language-skeleton-line d-language-skeleton-line--short"></span>
      </div>
    `);
  });
}

function bindDetailLanguageLifecycle() {
  detailLanguageVisualPendingHandler = showDetailLanguageSkeletons;
  window.addEventListener("languageChangeVisualPending", detailLanguageVisualPendingHandler);
  detailLanguageFinishedHandler = clearDetailLanguageSkeletons;
  window.addEventListener("languageChangeFinished", detailLanguageFinishedHandler);
}

function cleanupDetailListeners() {
  detailGalleryCleanup?.();
  detailGalleryCleanup = null;
  detailTabsCleanup?.();
  detailTabsCleanup = null;
  detailAdmissionsCleanup?.();
  detailAdmissionsCleanup = null;
  detailOverviewSummaryCleanup?.();
  detailOverviewSummaryCleanup = null;
  if (detailProfileUpdatedHandler) {
    window.removeEventListener("profileUpdated", detailProfileUpdatedHandler);
    detailProfileUpdatedHandler = null;
  }
  if (detailLanguageChangedHandler) {
    window.removeEventListener("languageChanged", detailLanguageChangedHandler);
    detailLanguageChangedHandler = null;
  }
  if (detailLanguageVisualPendingHandler) {
    window.removeEventListener("languageChangeVisualPending", detailLanguageVisualPendingHandler);
    detailLanguageVisualPendingHandler = null;
  }
  if (detailLanguageFinishedHandler) {
    window.removeEventListener("languageChangeFinished", detailLanguageFinishedHandler);
    detailLanguageFinishedHandler = null;
  }
  if (detailCurrencyChangedHandler) {
    window.removeEventListener("currencyChanged", detailCurrencyChangedHandler);
    detailCurrencyChangedHandler = null;
  }
  if (detailOnlineReconnectHandler) {
    window.removeEventListener("app:online-reconnect", detailOnlineReconnectHandler);
    detailOnlineReconnectHandler = null;
  }
  if (detailPopStateHandler) {
    window.removeEventListener("popstate", detailPopStateHandler);
    detailPopStateHandler = null;
  }
}

function renderDetailLocation(university, translatedCity, translatedCountry) {
  const locationEl = document.getElementById("detailLocation");
  if (!locationEl) return;

  locationEl.removeAttribute("data-i18n");
  const cityText = String(translatedCity || "").trim();
  const countryText = String(translatedCountry || "").trim();
  const detailFlag = getFlagImg(university?.location?.country || "");

  if (!cityText && !countryText) {
    locationEl.textContent = unknownFieldText("placeholder.field.location", "Location");
    return;
  }

  const cityHtml = cityText
    ? `<span class="d-location-city">${escapeHtml(cityText)}${countryText ? "," : ""}</span>`
    : "";
  const countryHtml = countryText
    ? (detailFlag
      ? `<span class="d-location-country">${detailFlag}<span>${escapeHtml(countryText)}</span></span>`
      : `<span class="d-location-country"><span>${escapeHtml(countryText)}</span></span>`)
    : "";

  locationEl.innerHTML = `${cityHtml}${countryHtml}`;
}

function bindDetailActions({ id, minPrice, university, universityId }) {
  const setTxt = (elementId, value) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.removeAttribute("data-i18n");
    element.textContent = String(value ?? "").trim();
  };

  const uniCurrency = university?.finance?.currency || "USD";
  const formattedPrice = formatPrice(minPrice, uniCurrency);
  setTxt(
    "detailPrice",
    Number.isFinite(Number(minPrice))
      ? tFormat("university.price_from", { price: formattedPrice }, `from ${formattedPrice} / year`)
      : unknownFieldText("placeholder.field.cost", "Cost"),
  );

  const mapParams = new URLSearchParams();
  mapParams.set("view", "map");
  mapParams.set("focus_uni", String(university.id || id));
  const mapHref = routeUniversities(mapParams);

  detailGalleryCleanup = mountUniversityGallery(document.getElementById("detailCover"), universityId, {
    coverAvailable: university?.cover_available !== false,
    coordinates: university?.coordinates,
    universityName: trUniversityName(university),
    mapHref,
  });

  const websiteBtn = document.getElementById("detailWebsite");
  if (websiteBtn) {
    const website = safeUrl(university.website);
    if (website) {
      websiteBtn.href = website;
      websiteBtn.style.display = "inline-flex";
      websiteBtn.title = t("university.visit_website", "Visit Official Website");
    } else {
      websiteBtn.removeAttribute("href");
      websiteBtn.style.display = "none";
    }
  }

  const mapBtn = document.getElementById("detailMapLink");
  if (mapBtn) {
    mapBtn.href = mapHref;
    mapBtn.style.display = "inline-flex";
  }

  const saveBtn = document.getElementById("detailSaveBtn");
  if (!saveBtn) return;

  const iconSpan = saveBtn.querySelector(".uni-action-icon");
  if (iconSpan) iconSpan.removeAttribute("data-heroicon");

  const updateSaveBtn = () => {
    const saved = readIdListStorage(SAVED_UNIVERSITIES_KEY);
    const isSaved = saved.includes(university.id);
    saveBtn.setAttribute("aria-pressed", isSaved ? "true" : "false");
    saveBtn.classList.toggle("is-saved", isSaved);
    if (iconSpan) iconSpan.innerHTML = renderInlineIcon("star", 20);
    saveBtn.querySelector(".d-site-link-label").textContent = isSaved
      ? t("university.action.saved", "Saved")
      : t("university.action.save_label", "Save");
    saveBtn.setAttribute("aria-label", saveBtn.querySelector(".d-site-link-label").textContent);
  };

  updateSaveBtn();
  saveBtn.onclick = () => {
    const saved = readIdListStorage(SAVED_UNIVERSITIES_KEY);
    const idx = saved.indexOf(university.id);
    const wasSaved = idx > -1;
    if (idx > -1) {
      saved.splice(idx, 1);
    } else {
      saved.push(university.id);
    }
    writeIdListStorage(SAVED_UNIVERSITIES_KEY, saved);
    updateSaveBtn();
    motionPress(saveBtn);
    replayMotion(iconSpan || saveBtn, wasSaved ? "motion-icon-unsave" : "motion-icon-save", { timeoutMs: 320 });
  };
}

function computeMinPrice(university, profileStudyLevel, profileStudyMode, annualCostForTrack) {
  const fundingOptions = getFinanceChoicesForStudyLevel(university.admission_categories, profileStudyLevel);
  let value = profileStudyLevel ? undefined : modeAwareAnnualCost(university.finance || {}, profileStudyMode);
  if (fundingOptions.length) {
    const prices = fundingOptions
      .map((option) => annualCostForTrack(option))
      .filter((price) => price != null && Number.isFinite(Number(price)) && Number(price) >= 0);
    if (prices.length > 0) value = Math.min(...prices);
  }
  return value;
}

function computeAcceptanceRate(university) {
  const acceptanceDirect = toFiniteNumber(university?.academics?.acceptance_rate_percent);
  const acceptanceValues = (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
    .map((program) => toFiniteNumber(program?.acceptance_rate_percent))
    .filter((value) => value !== null);
  const acceptanceComputed = acceptanceValues.length
    ? (acceptanceValues.reduce((sum, value) => sum + value, 0) / acceptanceValues.length)
    : Number.NaN;
  return acceptanceDirect !== null
    ? acceptanceDirect
    : (Number.isFinite(acceptanceComputed) ? acceptanceComputed : null);
}

function resolveProgramForProfile(university, universityId, profile, { allowPartial = false } = {}) {
  const programs = Array.isArray(university?.academics?.programs) ? university.academics.programs : [];
  const choices = profile?.selectedAdmissionChoices && typeof profile.selectedAdmissionChoices === "object"
    ? profile.selectedAdmissionChoices
    : {};
  const selectedChoice = choices[universityId] && typeof choices[universityId] === "object" ? choices[universityId] : {};
  const programId = String(selectedChoice.programId || selectedChoice.program_id || "").trim();
  if (programId) {
    const found = resolveProgramByIdentifier(programs, programId);
    if (found) return found;
  }
  const targetNames = [selectedChoice.programName, selectedChoice.program_name, profile?.major]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (!targetNames.length) return null;
  return resolveProgramByName(programs, targetNames, allowPartial ? { allowPartial: true } : undefined);
}

function mountOverviewSummaryBlock(options) {
  const container = document.getElementById("detailOverviewSummary");
  if (container) container.hidden = false;
  return mountOverviewSummary({ container, ...options });
}

function renderReviewedUniversityPage({ id, preserveVisibleContent, university, universityId, cardEl }) {
  if (university?.admissions_catalog?.availability !== "reviewed") throw new Error("Reviewed university catalog contract is unavailable");
  const translatedName = textOrUnknown(trUniversityName(university), "placeholder.field.university_name", "University name");
  const nameEl = document.getElementById("detailName");
  if (nameEl) {
    nameEl.removeAttribute("data-i18n");
    nameEl.textContent = translatedName;
  }
  renderDetailLocation(university, trCity(university?.location?.city), trCountry(university?.location?.country));
  bindDetailActions({ id, minPrice: undefined, university, universityId });
  renderExtraSection({ container: document.getElementById("detailExtra"), university });
  const rankStatus = String(university.rank_meta?.status || "").trim().toLowerCase();
  const rankValue = toFiniteNumber(university.rank);
  renderOverviewSection({
    container: document.getElementById("detailRecommendations"), university,
    officialRank: rankValue !== null && rankValue > 0 && rankStatus === "official", includeAdmissionRate: false,
  });
  const mounted = mountAdmissionsCatalog(universityId);
  detailAdmissionsCleanup = mounted.dispose;
  detailOverviewSummaryCleanup = mountOverviewSummaryBlock({ university, universityId, reviewed: true }).dispose;
  if (cardEl) {
    cardEl.style.display = "block";
    cardEl.classList.add("is-mounted");
  }
  setupTabs();
  detailTabsCleanup = mountTabsNavigation(cardEl);
  const initialUrl = new URL(window.location.href);
  const requestedTab = initialUrl.hash.match(/^#tab-(general|programs|admission|deadlines|finance)$/)?.[1];
  const initialTab = requestedTab || (initialUrl.searchParams.get("admission_application_route") ? "admission"
    : initialUrl.searchParams.get("admission_option") ? "programs" : "general");
  if (!preserveVisibleContent) document.querySelector(`[data-tab="tab-${initialTab}"]`)?.click();
  bindDetailRefreshLifecycle();
}

async function renderLegacyUniversityPage({ id, university, universityId, cardEl, stateEl }) {
  let reviewNotice = document.getElementById("catalogReviewNotice");
  if (!reviewNotice) {
    reviewNotice = document.createElement("div");
    reviewNotice.id = "catalogReviewNotice";
    reviewNotice.className = "d-head";
    cardEl?.querySelector(".d-tabs")?.before(reviewNotice);
  }
  // Earlier-format data was collected before the current review standard; the reader is told so before any figure.
  reviewNotice.innerHTML = `<div class="legacy-data-notice" role="note">${heroIcon("exclamation-circle", "ui-icon ui-icon--18 legacy-data-notice__icon")}
    <div class="legacy-data-notice__body"><p class="legacy-data-notice__title">${escapeHtml(t("university.ux2.legacy.title"))}</p>
    <p class="legacy-data-notice__text">${escapeHtml(t("university.ux2.legacy.text"))}</p></div></div>`;

  const admissionsData = university?.academics?.admissions && typeof university.academics.admissions === "object"
    ? university.academics.admissions
    : null;
  const translatedName = textOrUnknown(trUniversityName(university), "placeholder.field.university_name", "University name");
  const translatedCity = trCity(university?.location?.city || "");
  const translatedCountry = trCountry(university?.location?.country || "");
  let profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || "Any");
  const profileStudyLevel = loadProfile()?.studyLevel || loadProfile()?.study_level;
  const annualCostForTrack = (track) => {
    const finance = getFinanceForChoice(track, university.finance);
    return finance ? modeAwareAnnualCost(finance, profileStudyMode) : undefined;
  };
  const minPrice = computeMinPrice(university, profileStudyLevel, profileStudyMode, annualCostForTrack);
  const acceptanceRate = computeAcceptanceRate(university);

  const rankMeta = university && typeof university.rank_meta === "object" ? university.rank_meta : {};
  const rankStatus = String(rankMeta.status || "").trim().toLowerCase();
  const rankValue = toFiniteNumber(university?.rank);
  const officialRank = rankValue !== null && rankValue > 0 && rankStatus === "official";

  const detailNameEl = document.getElementById("detailName");
  if (detailNameEl) {
    detailNameEl.removeAttribute("data-i18n");
    detailNameEl.textContent = translatedName;
  }

  renderDetailLocation(university, translatedCity, translatedCountry);
  bindDetailActions({ id, minPrice, university, universityId });

  const acceptanceMeta = (university?.academics?.acceptance_rate_percent_meta && typeof university.academics.acceptance_rate_percent_meta === "object")
    ? university.academics.acceptance_rate_percent_meta
    : ((university?.academics?.admissions?.university_wide?.provenance && typeof university.academics.admissions.university_wide.provenance === "object")
      ? university.academics.admissions.university_wide.provenance
      : {});

  renderOverviewSection({ acceptanceMeta, acceptanceRate, container: document.getElementById("detailRecommendations"), officialRank, university });
  detailOverviewSummaryCleanup = mountOverviewSummaryBlock({
    university, universityId, reviewed: false,
    legacy: {
      acceptanceMeta, acceptanceRate,
      // Read the profile again on every refresh, so the figure follows the same level and study mode as the page header.
      getMinPrice: () => computeMinPrice(university, loadProfile()?.studyLevel || loadProfile()?.study_level,
        normalizeStudyModeForCost(loadProfile()?.studyMode || "Any"), annualCostForTrack),
    },
  }).dispose;
  renderExtraSection({ container: document.getElementById("detailExtra"), university });

  const renderProgramsTab = () => {
    const profile = getAdmissionContextProfile(university, loadProfile() || {});
    const selectedProgram = resolveProgramForProfile(university, universityId, profile, { allowPartial: true });
    const selectedChoice = profile.selectedAdmissionChoices?.[universityId] || {};
    const coverageProgram = resolveProgramForProfile(university, universityId, profile);
    renderProgramsSection({
      admissionsData,
      container: document.getElementById("detailPrograms"),
      university,
      profileMajor: String(profile.major || "").trim(),
      coverageProgram,
      selectedProgram: selectedChoice.programId || selectedChoice.programName ? selectedProgram : null,
      onProgramAdmissionSelected: (program) => {
        selectAdmissionProgram(university, program);
        renderProgramsTab();
        void refreshAdmissionContext({ skipPrograms: true });
      },
    });
    renderQualificationGuidance({
      container: document.getElementById("detailQualificationGuidance"),
      university,
      program: selectedProgram,
    });
  };
  renderProgramsTab();

  let refreshAdmissionContext = () => {};
  const renderAdmissionTab = () => {
    renderAdmissionSection({
      annualCostForTrack,
      container: document.getElementById("detailRequirements"),
      university,
      onContextChange: () => refreshAdmissionContext(),
    });
  };
  renderAdmissionTab();

  const renderDeadlinesTab = () => {
    renderDeadlinesTabSection({
      container: document.getElementById("detailDeadlines"),
      university,
      onContextChange: () => refreshAdmissionContext(),
    });
  };
  renderDeadlinesTab();

  const scholarshipEl = document.getElementById("detailScholarshipInfo");
  const priceEl = document.getElementById("detailPrice");

  const renderFinanceTab = () => {
    renderFinanceSection({
      annualCostForTrack,
      container: document.getElementById("detailFinance"),
      priceEl,
      profileStudyMode,
      scholarshipContainer: scholarshipEl,
      university,
    });
  };
  renderFinanceTab();

  refreshAdmissionContext = ({ skipPrograms = false } = {}) => {
    profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || "Any");
    renderAdmissionTab();
    renderDeadlinesTab();
    if (!skipPrograms) renderProgramsTab();
    renderFinanceTab();
  };
  detailProfileUpdatedHandler = refreshAdmissionContext;
  window.addEventListener("profileUpdated", detailProfileUpdatedHandler);
  detailPopStateHandler = refreshAdmissionContext;
  window.addEventListener("popstate", detailPopStateHandler);

  if (stateEl) stateEl.textContent = "";
  if (cardEl) {
    cardEl.style.display = "block";
    cardEl.classList.add("is-mounted");
  }
  setupTabs();
  detailTabsCleanup = mountTabsNavigation(cardEl);
  // A link to a tab (for example from the overview or another page) opens that tab, as on reviewed pages.
  const requestedTab = window.location.hash.match(/^#tab-(general|programs|admission|deadlines|finance)$/)?.[1];
  if (requestedTab && requestedTab !== "general") document.querySelector(`[data-tab="tab-${requestedTab}"]`)?.click();

  bindDetailRefreshLifecycle();
}

export async function initUniversityPage(options = {}) {
  const pageVersion = ++detailPageVersion;
  const preserveVisibleContent = options.preserveVisibleContent === true;
  const skipLoadingSkeleton = options.skipLoadingSkeleton === true;
  const id = extractUniversityIdFromLocation(window.location);
  rememberRecentUniversity(id);

  const stateEl = document.getElementById("detailState");
  const cardEl = document.getElementById("detailCard");
  const loadingEl = document.getElementById("detailLoading");

  cleanupDetailListeners();
  bindInfoTooltips({ wrapSelector: ".d-info-wrap", buttonSelector: ".d-info" });

  const setDetailLoading = (isLoading) => {
    if (!loadingEl) return;
    const showFullSkeleton = !!isLoading && !preserveVisibleContent && !skipLoadingSkeleton;
    loadingEl.classList.toggle("is-visible", showFullSkeleton);
    loadingEl.setAttribute("aria-hidden", showFullSkeleton ? "false" : "true");
  };

  if (!id) {
    setDetailLoading(false);
    if (stateEl) {
      stateEl.innerHTML = `<h2 class="d-state-error">${escapeHtml(t("university.error_no_id", "Error: No ID provided."))}</h2>`;
    }
    return;
  }

  try {
    setDetailLoading(!cardEl?.classList.contains("is-mounted"));
    if (stateEl) stateEl.textContent = "";

    const [university] = await Promise.all([
      fetchUniversityDetailCached(id, { requireReviewedCatalog: REVIEWED_ADMISSIONS_IDS.has(id) }),
      initUniversityTranslations().catch(() => null),
    ]);
    if (pageVersion !== detailPageVersion) return;
    if (!skipLoadingSkeleton && isCoverTransitionActive()) {
      await waitForCoverTransition();
      if (pageVersion !== detailPageVersion) return;
      cardEl?.classList.add("has-cover-handoff");
    }
    const universityId = String(university.id || id);
    document.body.classList.toggle("university--reviewed", REVIEWED_ADMISSIONS_IDS.has(universityId));
    rememberRecentUniversity(universityId);

    if (REVIEWED_ADMISSIONS_IDS.has(universityId)) {
      renderReviewedUniversityPage({ id, preserveVisibleContent, university, universityId, cardEl });
      return;
    }

    await renderLegacyUniversityPage({ id, university, universityId, cardEl, stateEl });
  } catch (error) {
    if (pageVersion !== detailPageVersion) return;
    console.error(error);
    if (stateEl) {
      const classified = classifyError(error);
      renderErrorScreen({
        type: classified.type,
        containerId: stateEl.id,
        onRetry: () => initUniversityPage(),
      });
    }
  } finally {
    if (pageVersion === detailPageVersion) {
      setDetailLoading(false);
      if (preserveVisibleContent) clearDetailLanguageSkeletons();
    }
  }
}

function bindDetailRefreshLifecycle() {
  const onDetailLanguageChanged = (event) => {
    detailLanguageChangedHandler = null;
    const refreshPromise = (async () => {
      try {
        await initUniversityTranslations();
      } catch {
        // keep local fallback copy when translation pack refresh fails
      }
      await initUniversityPage({ preserveVisibleContent: true });
    })();
    event?.detail?.waitUntil?.(refreshPromise);
    refreshPromise.catch((error) => console.error(error));
  };
  detailLanguageChangedHandler = onDetailLanguageChanged;
  window.addEventListener("languageChanged", onDetailLanguageChanged, { once: true });
  bindDetailLanguageLifecycle();

  const onDetailCurrencyChanged = async () => {
    detailCurrencyChangedHandler = null;
    await initUniversityPage();
  };
  detailCurrencyChangedHandler = onDetailCurrencyChanged;
  window.addEventListener("currencyChanged", onDetailCurrencyChanged, { once: true });

  const onDetailOnlineReconnect = async () => {
    detailOnlineReconnectHandler = null;
    await initUniversityPage();
  };
  detailOnlineReconnectHandler = onDetailOnlineReconnect;
  window.addEventListener("app:online-reconnect", onDetailOnlineReconnect, { once: true });
}

export function disposeUniversityPage() {
  detailPageVersion += 1;
  cleanupDetailListeners();
}
