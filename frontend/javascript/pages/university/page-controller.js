import {
  API_BASE,
  escapeHtml,
  escapeHtmlAttr,
  getFlagImg,
  loadProfile,
  loadProfileForApi,
  moneyUSD,
  motionPress,
} from "../../utils.js";
import { renderNoConnection, setupTabs } from "../../components.js";
import { t, tFormat } from "../../i18n.js";
import { extractUniversityIdFromLocation, routeUniversities } from "../../routes.js";
import { bindInfoTooltips } from "../../tooltip.js";
import { initUniversityTranslations } from "../../university-translations.js";
import { renderExtraSection, renderOverviewSection, renderProgramsSection } from "./render-content.js";
import { renderAdmissionSection, renderFinanceSection } from "./render-sections.js";
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
  uniLogoSrc,
  uniThumbnailSrc,
  unknownFieldText,
  writeIdListStorage,
} from "../_shared.js";
import { getAdmissionChoicesFromCategories } from "../../university-detail-helpers.js";

let detailProfileUpdatedHandler = null;
let detailLanguageChangedHandler = null;
let detailFinanceResizeHandler = null;
let detailFinanceResizeObserver = null;

function cleanupDetailListeners() {
  if (detailProfileUpdatedHandler) {
    window.removeEventListener("profileUpdated", detailProfileUpdatedHandler);
    detailProfileUpdatedHandler = null;
  }
  if (detailLanguageChangedHandler) {
    window.removeEventListener("languageChanged", detailLanguageChangedHandler);
    detailLanguageChangedHandler = null;
  }
  if (detailFinanceResizeHandler) {
    window.removeEventListener("resize", detailFinanceResizeHandler);
    detailFinanceResizeHandler = null;
  }
  if (detailFinanceResizeObserver) {
    try {
      detailFinanceResizeObserver.disconnect();
    } catch (error) {
      // keep cleanup resilient across navigation swaps
    }
    detailFinanceResizeObserver = null;
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

function renderDetailQuickStats({ acceptanceRate }) {
  const quickStatsEl = document.getElementById("detailQuickStats");
  if (!quickStatsEl) return;

  const quickStats = [];
  if (acceptanceRate !== null) {
    quickStats.push({
      label: t("ranking.acceptance", "Acceptance Rate"),
      value: `${Math.round(acceptanceRate * 100) / 100}%`,
    });
  }

  if (!quickStats.length) {
    quickStatsEl.innerHTML = "";
    quickStatsEl.style.display = "none";
    return;
  }

  quickStatsEl.innerHTML = quickStats.map((item) => `
    <div class="d-quick-stat">
      <span class="d-quick-stat-label">${escapeHtml(item.label)}</span>
      <span class="d-quick-stat-value">${escapeHtml(String(item.value))}</span>
    </div>
  `).join("");
  quickStatsEl.style.display = "grid";
}

function bindDetailActions({ id, minPrice, translatedName, university, universityId }) {
  const setTxt = (elementId, value) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.removeAttribute("data-i18n");
    element.textContent = String(value ?? "").trim();
  };

  setTxt(
    "detailPrice",
    Number.isFinite(Number(minPrice))
      ? tFormat("university.price_from", { price: moneyUSD(minPrice) }, `from ${moneyUSD(minPrice)} / year`)
      : unknownFieldText("placeholder.field.cost", "Cost"),
  );
  setTxt("detailLogo", (translatedName || "U").substring(0, 2).toUpperCase());

  const coverEl = document.getElementById("detailCover");
  if (coverEl) coverEl.style.backgroundImage = `url('${uniThumbnailSrc(universityId, { forceFull: true })}')`;

  const logoEl = document.getElementById("detailLogo");
  if (logoEl) {
    const initialsText = (translatedName || "U").substring(0, 2).toUpperCase();
    logoEl.innerHTML = `<img class="d-logo-img" src="${uniLogoSrc(universityId, { forceFull: true })}" alt="Logo" data-fallback-src="${escapeHtmlAttr(uniLogoSrc(universityId))}" data-fallback-text="${escapeHtmlAttr(initialsText)}">`;
  }

  const websiteBtn = document.getElementById("detailWebsite");
  if (websiteBtn) {
    const website = safeUrl(university.website);
    if (website) {
      websiteBtn.href = website;
      websiteBtn.style.display = "inline-flex";
      websiteBtn.classList.remove("d-site-link--disabled");
      websiteBtn.removeAttribute("aria-disabled");
      websiteBtn.title = t("university.visit_website", "Visit Official Website");
    } else {
      websiteBtn.removeAttribute("href");
      websiteBtn.style.display = "inline-flex";
      websiteBtn.classList.add("d-site-link--disabled");
      websiteBtn.setAttribute("aria-disabled", "true");
      websiteBtn.title = unknownFieldText("placeholder.field.official_website", "Official website");
    }
  }

  const mapBtn = document.getElementById("detailMapLink");
  if (mapBtn) {
    const params = new URLSearchParams();
    params.set("view", "map");
    params.set("focus_uni", String(university.id || id));
    mapBtn.href = routeUniversities(params);
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
  };

  updateSaveBtn();
  saveBtn.onclick = () => {
    const saved = readIdListStorage(SAVED_UNIVERSITIES_KEY);
    const idx = saved.indexOf(university.id);
    if (idx > -1) {
      saved.splice(idx, 1);
    } else {
      saved.push(university.id);
    }
    writeIdListStorage(SAVED_UNIVERSITIES_KEY, saved);
    updateSaveBtn();
    motionPress(saveBtn);
  };
}

export async function initUniversityPage() {
  const id = extractUniversityIdFromLocation(window.location);
  rememberRecentUniversity(id);

  const stateEl = document.getElementById("detailState");
  const cardEl = document.getElementById("detailCard");
  const loadingEl = document.getElementById("detailLoading");

  cleanupDetailListeners();
  bindInfoTooltips({ wrapSelector: ".d-info-wrap", buttonSelector: ".d-info" });

  const setDetailLoading = (isLoading) => {
    if (!loadingEl) return;
    loadingEl.classList.toggle("is-visible", !!isLoading);
    loadingEl.setAttribute("aria-hidden", isLoading ? "false" : "true");
  };

  if (!id) {
    if (stateEl) {
      stateEl.innerHTML = `<h2 class="d-state-error">${escapeHtml(t("university.error_no_id", "Error: No ID provided."))}</h2>`;
    }
    return;
  }

  try {
    setDetailLoading(true);
    if (stateEl) stateEl.textContent = "";

    const university = await fetchUniversityDetailCached(id);
    const universityId = String(university.id || id);
    rememberRecentUniversity(universityId);

    const admissionsData = university?.academics?.admissions && typeof university.academics.admissions === "object"
      ? university.academics.admissions
      : null;
    const translatedName = textOrUnknown(trUniversityName(university), "placeholder.field.university_name", "University name");
    const translatedCity = trCity(university?.location?.city || "");
    const translatedCountry = trCountry(university?.location?.country || "");
    const profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || "Any");
    const annualCostForTrack = (track) => modeAwareAnnualCost(((track && track.finance_override) || university.finance || {}), profileStudyMode);
    const minPrice = (() => {
      const fundingOptions = getAdmissionChoicesFromCategories(university.admission_categories);
      let value = modeAwareAnnualCost(university.finance || {}, profileStudyMode);
      if (fundingOptions.length) {
        const prices = fundingOptions
          .map((option) => annualCostForTrack(option))
          .filter((price) => Number.isFinite(Number(price)) && Number(price) > 0);
        if (prices.length > 0) value = Math.min(...prices);
      }
      return value;
    })();
    const acceptanceDirect = toFiniteNumber(university?.academics?.acceptance_rate_percent);
    const acceptanceValues = (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
      .map((program) => toFiniteNumber(program?.acceptance_rate_percent))
      .filter((value) => value !== null);
    const acceptanceComputed = acceptanceValues.length
      ? (acceptanceValues.reduce((sum, value) => sum + value, 0) / acceptanceValues.length)
      : NaN;
    const acceptanceRate = acceptanceDirect !== null
      ? acceptanceDirect
      : (Number.isFinite(acceptanceComputed) ? acceptanceComputed : null);
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
    renderDetailQuickStats({ acceptanceRate });
    bindDetailActions({ id, minPrice, translatedName, university, universityId });

    let uniChance = null;
    let uniChanceByChoiceKey = new Map();
    let uniRoi = null;

    const recomputeUniChance = async () => {
      try {
        const response = await fetch(`${API_BASE}/universities/${encodeURIComponent(id)}/uni-chance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: loadProfileForApi() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.detail || "UniChance API Error");
        uniChance = data || null;
      } catch (error) {
        console.error("Failed to compute UniChance on backend:", error);
        uniChance = null;
      }
      uniChanceByChoiceKey = new Map((uniChance?.choices || []).map((choice) => [String(choice.choiceKey), choice]));
    };

    const recomputeUniRoi = async () => {
      try {
        const response = await fetch(`${API_BASE}/universities/${encodeURIComponent(id)}/roi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: loadProfileForApi() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.detail || "ROI API Error");
        uniRoi = data || null;
      } catch (error) {
        console.error("Failed to compute ROI on backend:", error);
        uniRoi = null;
      }
    };

    await Promise.all([recomputeUniChance(), recomputeUniRoi()]);

    const acceptanceMeta = (university?.academics?.acceptance_rate_percent_meta && typeof university.academics.acceptance_rate_percent_meta === "object")
      ? university.academics.acceptance_rate_percent_meta
      : ((university?.academics?.admissions?.university_wide?.provenance && typeof university.academics.admissions.university_wide.provenance === "object")
        ? university.academics.admissions.university_wide.provenance
        : {});

    renderOverviewSection({ acceptanceMeta, acceptanceRate, container: document.getElementById("detailRecommendations"), officialRank, rankStatus, university });
    renderExtraSection({ container: document.getElementById("detailExtra"), university });
    renderProgramsSection({ admissionsData, container: document.getElementById("detailPrograms"), university });

    const renderAdmissionTab = () => {
      renderAdmissionSection({
        annualCostForTrack,
        container: document.getElementById("detailRequirements"),
        uniChance,
        uniChanceByChoiceKey,
        university,
      });
    };
    renderAdmissionTab();
    detailProfileUpdatedHandler = async () => {
      await Promise.all([recomputeUniChance(), recomputeUniRoi()]);
      renderAdmissionTab();
    };
    window.addEventListener("profileUpdated", detailProfileUpdatedHandler);

    const scholarshipEl = document.getElementById("detailScholarshipInfo");
    const priceEl = document.getElementById("detailPrice");
    let financeSummarySyncRaf = 0;
    const applyFinanceSummaryCardHeights = () => {
      const scholarshipCard = scholarshipEl?.closest?.(".scholarship-card") || scholarshipEl;
      const totalPriceCard = priceEl?.closest?.(".total-price-card") || null;
      if (!scholarshipCard || !totalPriceCard) return;
      scholarshipCard.style.minHeight = "";
      totalPriceCard.style.minHeight = "";
      if (window.innerWidth <= 768) return;
      const targetHeight = Math.max(scholarshipCard.offsetHeight || 0, totalPriceCard.offsetHeight || 0);
      if (targetHeight > 0) {
        const value = `${targetHeight}px`;
        scholarshipCard.style.minHeight = value;
        totalPriceCard.style.minHeight = value;
      }
    };
    const syncFinanceSummaryCardHeights = () => {
      if (financeSummarySyncRaf) window.cancelAnimationFrame(financeSummarySyncRaf);
      financeSummarySyncRaf = window.requestAnimationFrame(() => {
        financeSummarySyncRaf = 0;
        applyFinanceSummaryCardHeights();
      });
    };
    const settleFinanceSummaryCardHeights = () => {
      syncFinanceSummaryCardHeights();
      window.setTimeout(syncFinanceSummaryCardHeights, 140);
    };

    detailFinanceResizeHandler = syncFinanceSummaryCardHeights;
    window.addEventListener("resize", detailFinanceResizeHandler, { passive: true });
    if (typeof ResizeObserver === "function") {
      detailFinanceResizeObserver = new ResizeObserver(() => {
        syncFinanceSummaryCardHeights();
      });
      if (scholarshipEl) detailFinanceResizeObserver.observe(scholarshipEl);
      const scholarshipCard = scholarshipEl?.closest?.(".scholarship-card") || null;
      if (scholarshipCard) detailFinanceResizeObserver.observe(scholarshipCard);
      const totalPriceCard = priceEl?.closest?.(".total-price-card") || null;
      if (totalPriceCard) detailFinanceResizeObserver.observe(totalPriceCard);
      const financeSummaryContainer = scholarshipEl?.closest?.(".finance-summary-container") || null;
      if (financeSummaryContainer) detailFinanceResizeObserver.observe(financeSummaryContainer);
    }
    if (document.fonts?.ready?.then) {
      document.fonts.ready.then(syncFinanceSummaryCardHeights).catch(() => {});
    }
    window.addEventListener("load", syncFinanceSummaryCardHeights, { once: true });

    renderFinanceSection({
      annualCostForTrack,
      container: document.getElementById("detailFinance"),
      onSummaryChanged: settleFinanceSummaryCardHeights,
      priceEl,
      profileStudyMode,
      scholarshipContainer: scholarshipEl,
      uniRoi,
      university,
    });

    if (stateEl) stateEl.textContent = "";
    if (cardEl) {
      cardEl.style.display = "block";
      cardEl.classList.add("is-mounted");
    }
    setupTabs();

    const onDetailLanguageChanged = async () => {
      detailLanguageChangedHandler = null;
      try {
        await initUniversityTranslations();
      } catch (error) {
        // keep local fallback copy when translation pack refresh fails
      }
      await initUniversityPage();
    };
    detailLanguageChangedHandler = onDetailLanguageChanged;
    window.addEventListener("languageChanged", onDetailLanguageChanged, { once: true });
  } catch (error) {
    console.error(error);
    if (stateEl) {
      renderNoConnection({
        containerId: stateEl.id,
        onRetry: () => initUniversityPage(),
      });
    }
  } finally {
    setDetailLoading(false);
  }
}
