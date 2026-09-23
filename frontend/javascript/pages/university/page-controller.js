import {
  API_BASE,
  escapeHtml,
  escapeHtmlAttr,
  getFlagImg,
  loadProfile,
  loadProfileForApi,
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
import { renderCoverageSection, renderExtraSection, renderOverviewSection, renderProgramsSection, renderQualificationGuidance } from "./render-content.js";
import { getFinanceChoicesForStudyLevel, getFinanceForChoice, renderAdmissionSection, renderDeadlinesTabSection, renderFinanceSection } from "./render-sections.js";
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

let detailProfileUpdatedHandler = null;
let detailLanguageChangedHandler = null;
let detailLanguageVisualPendingHandler = null;
let detailLanguageFinishedHandler = null;
let detailCurrencyChangedHandler = null;
let detailOnlineReconnectHandler = null;

function clearDetailLanguageSkeletons() {
  const card = document.getElementById("detailCard");
  if (!card) return;
  card.classList.remove("is-language-refreshing");
  card.removeAttribute("aria-busy");
  card.querySelectorAll(".d-language-text-skeleton").forEach((node) => node.remove());
}

function showDetailLanguageSkeletons() {
  const card = document.getElementById("detailCard");
  if (!card || card.style.display === "none") return;
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

function cssString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function thumbnailBackgroundImage(universityId) {
  const webp = cssString(uniThumbnailSrc(universityId, { forceFull: true }));
  const jpg = cssString(uniThumbnailSrc(universityId, { forceFull: true, format: "jpg" }));
  return `image-set(url("${webp}") type("image/webp"), url("${jpg}") type("image/jpeg"))`;
}

function cleanupDetailListeners() {
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
}

const SCOPE_NOTICE_DISMISSED_KEY = "unisearch_universities_scope_notice_dismissed";

function setupScopeNotice() {
  const notice = document.getElementById("universityScopeNotice");
  if (!notice) return;

  let dismissed = false;
  try {
    dismissed = localStorage.getItem(SCOPE_NOTICE_DISMISSED_KEY) === "1";
  } catch (e) {
    dismissed = false;
  }

  notice.hidden = dismissed;
  if (dismissed) return;

  const dismissBtn = document.getElementById("dismissUniversityScopeNotice");
  if (!dismissBtn) return;

  dismissBtn.addEventListener("click", () => {
    notice.hidden = true;
    try {
      localStorage.setItem(SCOPE_NOTICE_DISMISSED_KEY, "1");
    } catch (e) {
      // Ignore storage errors; the notice still closes for this page view.
    }
  });
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


function bindDetailActions({ id, minPrice, translatedName, university, universityId }) {
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
  setTxt("detailLogo", (translatedName || "U").substring(0, 2).toUpperCase());

  const coverEl = document.getElementById("detailCover");
  if (coverEl) coverEl.style.backgroundImage = thumbnailBackgroundImage(universityId);

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

export async function initUniversityPage(options = {}) {
  const preserveVisibleContent = options.preserveVisibleContent === true;
  const id = extractUniversityIdFromLocation(window.location);
  rememberRecentUniversity(id);

  const stateEl = document.getElementById("detailState");
  const cardEl = document.getElementById("detailCard");
  const loadingEl = document.getElementById("detailLoading");

  cleanupDetailListeners();
  setupScopeNotice();
  bindInfoTooltips({ wrapSelector: ".d-info-wrap", buttonSelector: ".d-info" });

  const setDetailLoading = (isLoading) => {
    if (!loadingEl) return;
    const showFullSkeleton = !!isLoading && !preserveVisibleContent;
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
    setDetailLoading(true);
    if (stateEl) stateEl.textContent = "";

    const [university] = await Promise.all([
      fetchUniversityDetailCached(id),
      initUniversityTranslations().catch(() => null),
    ]);
    const universityId = String(university.id || id);
    rememberRecentUniversity(universityId);

    const admissionsData = university?.academics?.admissions && typeof university.academics.admissions === "object"
      ? university.academics.admissions
      : null;
    const translatedName = textOrUnknown(trUniversityName(university), "placeholder.field.university_name", "University name");
    const translatedCity = trCity(university?.location?.city || "");
    const translatedCountry = trCountry(university?.location?.country || "");
    const profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || "Any");
    const profileStudyLevel = loadProfile()?.studyLevel || loadProfile()?.study_level;
    const annualCostForTrack = (track) => {
      const finance = getFinanceForChoice(track, university.finance);
      return finance ? modeAwareAnnualCost(finance, profileStudyMode) : undefined;
    };
    const minPrice = (() => {
      const fundingOptions = getFinanceChoicesForStudyLevel(university.admission_categories, profileStudyLevel);
      let value = profileStudyLevel ? undefined : modeAwareAnnualCost(university.finance || {}, profileStudyMode);
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
      : Number.NaN;
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
    renderCoverageSection({
      container: document.getElementById("detailCoverage"),
      coverageByLevel: university?.coverage_by_level,
    });
    renderExtraSection({ container: document.getElementById("detailExtra"), university });
    const resolveQualificationProgram = (profile) => {
      const programs = Array.isArray(university?.academics?.programs) ? university.academics.programs : [];
      const choices = profile?.selectedAdmissionChoices && typeof profile.selectedAdmissionChoices === "object"
        ? profile.selectedAdmissionChoices
        : {};
      const selectedChoice = choices[universityId] && typeof choices[universityId] === "object" ? choices[universityId] : {};
      const programId = String(selectedChoice.programId || selectedChoice.program_id || "").trim();
      if (programId) {
        const found = programs.find((program) => String(program?.id || "").trim() === programId);
        if (found) return found;
      }
      const targetNames = [selectedChoice.programName, selectedChoice.program_name, profile?.major]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      if (!targetNames.length) return null;
      return programs.find((program) => {
        const name = String(program?.name || "").trim().toLowerCase();
        return name && targetNames.some((target) => name === target || name.includes(target) || target.includes(name));
      }) || null;
    };

    const resolveCoverageProgram = (profile) => {
      const programs = Array.isArray(university?.academics?.programs) ? university.academics.programs : [];
      const choices = profile?.selectedAdmissionChoices && typeof profile.selectedAdmissionChoices === "object"
        ? profile.selectedAdmissionChoices
        : {};
      const selectedChoice = choices[universityId] && typeof choices[universityId] === "object" ? choices[universityId] : {};
      const programId = String(selectedChoice.programId || selectedChoice.program_id || "").trim();
      if (programId) {
        return programs.find((program) => String(program?.id || program?.course_number || "").trim() === programId) || null;
      }
      const exactNames = [selectedChoice.programName, selectedChoice.program_name, profile?.major]
        .map((value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " "))
        .filter(Boolean);
      if (!exactNames.length) return null;
      return programs.find((program) => {
        const name = String(program?.name || "").trim().toLowerCase().replace(/\s+/g, " ");
        return name && exactNames.includes(name);
      }) || null;
    };

    const renderProgramsTab = () => {
      const profile = loadProfile() || {};
      const selectedProgram = resolveQualificationProgram(profile);
      const coverageProgram = resolveCoverageProgram(profile);
      renderProgramsSection({
        admissionsData,
        container: document.getElementById("detailPrograms"),
        university,
        profileMajor: String(profile.major || "").trim(),
        coverageProgram,
      });
      renderQualificationGuidance({
        container: document.getElementById("detailQualificationGuidance"),
        profile,
        university,
        program: selectedProgram,
      });
    };
    renderProgramsTab();

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

    const renderDeadlinesTab = () => {
      renderDeadlinesTabSection({
        container: document.getElementById("detailDeadlines"),
        university,
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
        uniRoi,
        uniChance,
        university,
      });
    };
    renderFinanceTab();

    detailProfileUpdatedHandler = async () => {
      await Promise.all([recomputeUniChance(), recomputeUniRoi()]);
      renderAdmissionTab();
      renderDeadlinesTab();
      renderProgramsTab();
      renderFinanceTab();
    };
    window.addEventListener("profileUpdated", detailProfileUpdatedHandler);

    if (stateEl) stateEl.textContent = "";
    if (cardEl) {
      cardEl.style.display = "block";
      cardEl.classList.add("is-mounted");
    }
    setupTabs();

    const onDetailLanguageChanged = (event) => {
      detailLanguageChangedHandler = null;
      const refreshPromise = (async () => {
        try {
          await initUniversityTranslations();
        } catch (error) {
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
  } catch (error) {
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
    setDetailLoading(false);
    if (preserveVisibleContent) clearDetailLanguageSkeletons();
  }
}
