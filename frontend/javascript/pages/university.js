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
  getSelectedAdmissionTrack,
  saveSelectedAdmissionTrack,
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
} from "../utils.js";

import {
  applyPercentWidths,
  clusterMarkerLogoHtml,
  getTrackFundingType,
  getTrackFundingOptions,
  mapMarkerLogoHtml,
  renderExamGroup,
  renderGroupedExamPairRows,
  renderTrackChanceChip,
  renderTrackFundingBadge,
  renderUniChanceSummary,
  splitExamEntries,
  trackLookupKey,
} from "../university-detail-helpers.js";

import { setupTabs, renderNoConnection } from "../components.js";
import { heroIcon, stripLeadingDecorations } from "../icons.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import { extractUniversityIdFromLocation, routeUniversities, routeUniversityDetail } from "../routes.js";
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
  renderTrackLanguageExamGroup,
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
  UNIVERSITIES_TOUR_SEEN_KEY,
  SAVED_UNIVERSITIES_KEY,
  COMPARE_UNIVERSITIES_KEY,
  RECENT_UNIVERSITIES_KEY,
  MAX_COMPARE_UNIVERSITIES,
  MAX_RECENT_UNIVERSITIES,
  __detailProfileUpdatedHandler,
  __detailLanguageChangedHandler,
  __detailFinanceResizeHandler,
  __detailFinanceResizeObserver,
  __universitiesProfileUpdatedHandler,
  __universitiesLanguageChangedHandler,
  __universitiesMapCardActionHandler,
  __rankingLanguageChangedHandler,
  __guideExternalUpdateHandler,
  __guideHashChangeHandler,
  bindGuideExternalUpdates,
  bindGuideHashChange,
  hasSeenUniversitiesTour,
  markUniversitiesTourSeen,
  readIdListStorage,
  writeIdListStorage,
  rememberRecentUniversity,
  readDetailCache,
  writeDetailCache,
  getDetailCacheEntry,
  setDetailCacheEntry,
  touchDetailCacheEntry,
  toFiniteNumber
} from './_shared.js';

export async function initUniversityPage() {
  const id = extractUniversityIdFromLocation(window.location);
  rememberRecentUniversity(id);
  const stateEl = document.getElementById("detailState");
  const cardEl = document.getElementById("detailCard");
  const loadingEl = document.getElementById("detailLoading");
  if (__detailProfileUpdatedHandler) {
    window.removeEventListener("profileUpdated", __detailProfileUpdatedHandler);
    __detailProfileUpdatedHandler = null;
  }
  if (__detailLanguageChangedHandler) {
    window.removeEventListener("languageChanged", __detailLanguageChangedHandler);
    __detailLanguageChangedHandler = null;
  }
  if (__detailFinanceResizeHandler) {
    window.removeEventListener("resize", __detailFinanceResizeHandler);
    __detailFinanceResizeHandler = null;
  }
  if (__detailFinanceResizeObserver) {
    try {
      __detailFinanceResizeObserver.disconnect();
    } catch (e) {
      // ignore observer cleanup issues
    }
    __detailFinanceResizeObserver = null;
  }
  bindInfoTooltips({ wrapSelector: ".d-info-wrap", buttonSelector: ".d-info" });

  const setDetailLoading = (isLoading) => {
    if (!loadingEl) return;
    loadingEl.classList.toggle("is-visible", !!isLoading);
    loadingEl.setAttribute("aria-hidden", isLoading ? "false" : "true");
  };

  if (!id) {
    if (stateEl) stateEl.innerHTML = `<h2 class="d-state-error">${escapeHtml(t("university.error_no_id", "Error: No ID provided."))}</h2>`;
    return;
  }

  try {
    setDetailLoading(true);
    if (stateEl) stateEl.textContent = "";
    const u = await fetchUniversityDetailCached(id);
    const uniId = String(u.id || id);
    const admissionsData = u?.academics?.admissions && typeof u.academics.admissions === "object"
      ? u.academics.admissions
      : null;

    // 1. Header
    const setTxt = (eid, val) => { const e = document.getElementById(eid); if (e) e.textContent = String(val ?? "").trim(); };
    const translatedName = textOrUnknown(trUniversityName(u), "placeholder.field.university_name", "University name");
    const translatedCity = trCity(u?.location?.city || "");
    const translatedCountry = trCountry(u?.location?.country || "");
    const profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || "Any");
    const annualCostForTrack = (track) =>
    modeAwareAnnualCost(((track && track.finance_override) || u.finance || {}), profileStudyMode);

    const fundingOptionsForTrack = (track) => getTrackFundingOptions(track);

    const allFundingOptions = (Array.isArray(u.admission_tracks) ? u.admission_tracks : [])
    .flatMap((track) => fundingOptionsForTrack(track));

    let minPrice = modeAwareAnnualCost(u.finance || {}, profileStudyMode);
    if (allFundingOptions.length) {
    const prices = allFundingOptions
        .map((option) => annualCostForTrack(option))
        .filter((price) => Number.isFinite(Number(price)) && Number(price) > 0);

    if (prices.length > 0) minPrice = Math.min(...prices);
    }
    const acceptanceDirect = toFiniteNumber(u?.academics?.acceptance_rate_percent);
    const acceptanceValues = (Array.isArray(u?.academics?.programs) ? u.academics.programs : [])
        .map((p) => toFiniteNumber(p?.acceptance_rate_percent))
        .filter((v) => v !== null);
    const acceptanceComputed = acceptanceValues.length
        ? (acceptanceValues.reduce((sum, v) => sum + v, 0) / acceptanceValues.length)
        : NaN;
    const acceptanceRate = acceptanceDirect !== null
        ? acceptanceDirect
        : (Number.isFinite(acceptanceComputed) ? acceptanceComputed : null);
    const rankMeta = (u && typeof u.rank_meta === "object" && u.rank_meta) ? u.rank_meta : {};
    const rankStatus = String(rankMeta.status || "").trim().toLowerCase();
    const rankValue = toFiniteNumber(u?.rank);
    const officialRank = rankValue !== null && rankValue > 0 && rankStatus === "official";
    setTxt("detailName", translatedName);
    const detailLocationEl = document.getElementById("detailLocation");
    if (detailLocationEl) {
        const cityText = String(translatedCity || "").trim();
        const countryText = String(translatedCountry || "").trim();
        const detailFlag = getFlagImg(u?.location?.country || "");
        if (cityText || countryText) {
            const cityHtml = cityText
                ? `<span class="d-location-city">${escapeHtml(cityText)}${countryText ? "," : ""}</span>`
                : "";
            const countryHtml = countryText
                ? (detailFlag
                    ? `<span class="d-location-country">${detailFlag}<span>${escapeHtml(countryText)}</span></span>`
                    : `<span class="d-location-country"><span>${escapeHtml(countryText)}</span></span>`)
                : "";
            detailLocationEl.innerHTML = `${cityHtml}${countryHtml}`;
        } else {
            detailLocationEl.textContent = unknownFieldText("placeholder.field.location", "Location");
        }
    }
    const detailQuickStatsEl = document.getElementById("detailQuickStats");
    if (detailQuickStatsEl) {
        const quickStats = [];
        if (officialRank) {
            quickStats.push({
                label: translateWord("global_rank", "Global Rank"),
                value: `#${u.rank}`,
            });
        } else if (rankStatus) {
            quickStats.push({
                label: translateWord("global_rank", "Global Rank"),
                value: rankingStatusLabel(rankStatus),
            });
        }
        if (acceptanceRate !== null) {
            quickStats.push({
                label: t("ranking.acceptance", "Acceptance Rate"),
                value: `${Math.round(acceptanceRate * 100) / 100}%`,
            });
        }
        if (Number.isFinite(Number(minPrice))) {
            quickStats.push({
                label: t("universities.card.est_cost_year", "Est. Cost/Year"),
                value: moneyUSD(minPrice),
            });
        }

        if (quickStats.length) {
            detailQuickStatsEl.innerHTML = quickStats.map((item) => `
                <div class="d-quick-stat">
                    <span class="d-quick-stat-label">${escapeHtml(item.label)}</span>
                    <span class="d-quick-stat-value">${escapeHtml(String(item.value))}</span>
                </div>
            `).join("");
            detailQuickStatsEl.style.display = "grid";
        } else {
            detailQuickStatsEl.innerHTML = "";
            detailQuickStatsEl.style.display = "none";
        }
    }
    setTxt(
        "detailPrice",
        Number.isFinite(Number(minPrice))
            ? tFormat("university.price_from", { price: moneyUSD(minPrice) }, `from ${moneyUSD(minPrice)} / year`)
            : unknownFieldText("placeholder.field.cost", "Cost")
    );
    setTxt("detailLogo", (translatedName || "U").substring(0, 2).toUpperCase());

    const coverEl = document.getElementById("detailCover");
    if (coverEl) coverEl.style.backgroundImage = `url('${uniThumbnailSrc(uniId, { forceFull: true })}')`;

    const logoEl = document.getElementById("detailLogo");
    if (logoEl) {
        const initialsText = (translatedName || "U").substring(0, 2).toUpperCase();
        logoEl.innerHTML = `<img class="d-logo-img" src="${uniLogoSrc(uniId, { forceFull: true })}" alt="Logo" data-fallback-src="${escapeHtmlAttr(uniLogoSrc(uniId))}" data-fallback-text="${escapeHtmlAttr(initialsText)}">`;
    }

    const siteBtn = document.getElementById("detailWebsite");
    if (siteBtn) {
        const safeWebsite = safeUrl(u.website);
        if (safeWebsite) {
            siteBtn.href = safeWebsite;
            siteBtn.style.display = "inline-flex";
            siteBtn.classList.remove("d-site-link--disabled");
            siteBtn.removeAttribute("aria-disabled");
            siteBtn.title = t("university.visit_website", "Visit Official Website");
        } else {
            siteBtn.removeAttribute("href");
            siteBtn.style.display = "inline-flex";
            siteBtn.classList.add("d-site-link--disabled");
            siteBtn.setAttribute("aria-disabled", "true");
            siteBtn.title = unknownFieldText("placeholder.field.official_website", "Official website");
        }
    }
    const mapBtn = document.getElementById("detailMapLink");
    if (mapBtn) {
        const p = new URLSearchParams();
        p.set("view", "map");
        p.set("focus_uni", String(u.id || id));
        mapBtn.href = routeUniversities(p);
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
        const acceptanceMeta = (u?.academics?.acceptance_rate_percent_meta && typeof u.academics.acceptance_rate_percent_meta === "object")
            ? u.academics.acceptance_rate_percent_meta
            : ((u?.academics?.admissions?.university_wide?.provenance && typeof u.academics.admissions.university_wide.provenance === "object")
                ? u.academics.admissions.university_wide.provenance
                : {});
        const acceptanceDisplay = acceptanceRate === null
            ? t("common.no_data", "No data")
            : `${Math.round(acceptanceRate * 100) / 100}%`;
        const acceptanceSourceUrl = safeUrl(acceptanceMeta?.source_url);
        const acceptanceSourceLabel = String(acceptanceMeta?.source || "").trim() || t("university.admissions.official_source", "Official source");
        const acceptanceChecked = String(acceptanceMeta?.verified_at || "").trim();
        const acceptanceBasis = acceptanceMeta?.basis && typeof acceptanceMeta.basis === "object" ? acceptanceMeta.basis : {};
        const acceptanceCycle = String(acceptanceBasis?.cycle || "").trim();
        const acceptanceApplicants = toFiniteNumber(acceptanceBasis?.applicants);
        const acceptanceAdmitted = toFiniteNumber(acceptanceBasis?.admitted);
        const acceptanceInfoTitle = escapeHtml(t("university.admissions.official_source", "Official source"));
        const acceptanceTooltip = acceptanceSourceUrl ? `
            <span class="d-info-wrap">
              <button type="button" class="d-info" aria-label="${acceptanceInfoTitle}" title="${acceptanceInfoTitle}">${renderInlineIcon("information-circle", 14, "d-info-icon")}</button>
              <span class="d-tooltip" role="tooltip">
                <strong>${acceptanceInfoTitle}</strong>
                <span>${escapeHtml(acceptanceSourceLabel)}</span>
                ${acceptanceChecked ? `<span>${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(acceptanceChecked)}</span>` : ""}
                ${acceptanceCycle ? `<span>${escapeHtml(t("university.admissions.cycle", "Cycle"))}: ${escapeHtml(acceptanceCycle)}</span>` : ""}
                ${acceptanceApplicants !== null ? `<span>${escapeHtml(t("university.admissions.counts.applicants", "Applicants"))}: ${escapeHtml(formatUiNumber(acceptanceApplicants))}</span>` : ""}
                ${acceptanceAdmitted !== null ? `<span>${escapeHtml(t("university.admissions.counts.admitted", "Admitted"))}: ${escapeHtml(formatUiNumber(acceptanceAdmitted))}</span>` : ""}
                <span><a href="${escapeHtmlAttr(acceptanceSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.open_source", "Open source"))}</a></span>
              </span>
            </span>
        ` : "";
        const acceptanceRow = `
            <div class="d-kv">
              <span class="d-kv-label">
                ${escapeHtml(t("ranking.acceptance", "Acceptance Rate"))}
                ${acceptanceTooltip}
              </span>
              <span>${escapeHtml(acceptanceDisplay)}</span>
            </div>
        `;
        let rankHtml = `<span>${escapeHtml(unknownFieldText("placeholder.field.global_rank", "Global Rank"))}</span>`;
        if (officialRank) {
            rankHtml = `<span class="d-rank-emphasis">#${u.rank}</span>`;
        } else if (rankStatus) {
            rankHtml = `<span>${escapeHtml(rankingStatusLabel(rankStatus))}</span>`;
        }

        const campusSizeRaw = typeof u.student_life?.size === "string" ? String(u.student_life.size).trim() : "";
        const campusSize = campusSizeRaw
            ? escapeHtml(formatCampusSizeValue(campusSizeRaw))
            : escapeHtml(unknownFieldText("campus_size", "Campus Size"));
        const campusSizeLabel = escapeHtml(translateWord("campus_size", "Campus Size"));
        const campusSizeInfoTitle = escapeHtml(translateWord("campus_size_info_title", "How campus size works"));
        const campusSizeInfoSmall = escapeHtml(translateWord("campus_size_info_small", "Small: up to 500,000 m² (up to 50 ha)"));
        const campusSizeInfoMedium = escapeHtml(translateWord("campus_size_info_medium", "Medium: 500,000-2,000,000 m² (50-200 ha)"));
        const campusSizeInfoLarge = escapeHtml(translateWord("campus_size_info_large", "Large: above 2,000,000 m² (200+ ha)"));
        const campusSizeInfoNote = escapeHtml(translateWord("campus_size_info_note", "Approximate ranges used for quick comparison."));
        recDiv.innerHTML = `
            <div class="d-kv"><span>${escapeHtml(translateWord("global_rank", "Global Rank"))}</span>${rankHtml}</div>
            ${acceptanceRow}
            <div class="d-kv d-kv--last">
              <span class="d-kv-label">
                ${campusSizeLabel}
                <span class="d-info-wrap">
                  <button type="button" class="d-info" aria-label="${campusSizeInfoTitle}" title="${campusSizeInfoTitle}">${renderInlineIcon("information-circle", 14, "d-info-icon")}</button>
                  <span class="d-tooltip" role="tooltip">
                    <strong>${campusSizeInfoTitle}</strong>
                    <span>${campusSizeInfoSmall}</span>
                    <span>${campusSizeInfoMedium}</span>
                    <span>${campusSizeInfoLarge}</span>
                    <span>${campusSizeInfoNote}</span>
                  </span>
                </span>
              </span>
              <span>${campusSize}</span>
            </div>
        `;
        bindInfoTooltips({ wrapSelector: ".d-info-wrap", buttonSelector: ".d-info" });
    }

    const extraDiv = document.getElementById("detailExtra");
    if (extraDiv) {
         const translatedDescription = trUniversityDescription(u);
         const description = translatedDescription
            ? `<p class="uni-description">${escapeHtml(String(translatedDescription)).replace(/\n/g, "<br>")}</p>`
            : `<p class="uni-description uni-description--placeholder">${escapeHtml(unknownFieldText("placeholder.field.description", "Description"))}</p>`;
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
            : `
                <div class="uni-tags-wrap">
                    <div class="uni-tags-title">${escapeHtml(translateWord("focus_tags", "Focus Tags"))}</div>
                    <div class="uni-tags-list">
                        <span class="uni-tag uni-tag--placeholder">${escapeHtml(unknownFieldText("focus_tags", "Focus Tags"))}</span>
                    </div>
                </div>
              `;
         const studentCountValue = toFiniteNumber(u?.student_count);
         const studentCount = studentCountValue !== null
            ? new Intl.NumberFormat("en-US").format(studentCountValue)
            : unknownFieldText("total_students", "Total Students");
         const formats = Array.isArray(u.academics?.formats)
            ? u.academics.formats.map((x) => escapeHtml(trStudyMode(String(x)))).filter(Boolean).join(", ")
            : "";
         
         extraDiv.innerHTML = `
            ${description}
            ${tagsHtml}
            <div class="d-kv"><span>${escapeHtml(translateWord("total_students", "Total Students"))}</span><span>${escapeHtml(studentCount)}</span></div>
            <div class="d-kv d-kv--last"><span>${escapeHtml(translateWord("study_formats", "Study Formats"))}</span><span>${formats || escapeHtml(unknownFieldText("study_formats", "Study Formats"))}</span></div>
         `;
    }

    // --- TAB 2: PROGRAMS ---
    const progDiv = document.getElementById("detailPrograms");
    if (progDiv) {
        const programs = Array.isArray(u?.academics?.programs)
            ? u.academics.programs.filter((p) => p && typeof p === "object")
            : [];
        const admissionsProgramsHtml = renderProgramAdmissionsSignals(admissionsData);

        const prettyField = (key) =>
            String(key || "")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());

        const formatProgramValue = (key, value) => {
            if (value === null || value === undefined || value === "") return "";
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
            if (String(key) === "duration") return localizeDuration(value);
            return String(value);
        };

        if (programs.length) {
            const knownKeys = new Set(["name", "study_levels", "acceptance_rate_percent", "duration", "language", "study_mode"]);
            progDiv.innerHTML = `
                <div class="program-list">
                    ${programs.map((program, idx) => {
                        const isMajorTagField = (key) => {
                            const normalized = String(key || "").trim().toLowerCase();
                            return normalized === "major_tags" || normalized === "majors" || normalized === "applicable_majors";
                        };
                        const renderValueCell = (label, key, rawValue, formattedValue) => {
                            if (Array.isArray(rawValue) && rawValue.length) {
                                const translatedItems = rawValue.map((item) => {
                                    const raw = String(item);
                                    if (String(key) === "study_levels") return trStudyLevel(raw);
                                    if (String(key) === "language") return trProgramLanguage(raw);
                                    if (String(key) === "study_mode") return trStudyMode(raw);
                                    if (isMajorTagField(key)) return trProgramName(raw) || raw;
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
                                const num = toFiniteNumber(rawValue);
                                if (num !== null) {
                                    const pct = Math.max(0, Math.min(100, num));
                                    return `
                                        <div class="program-acceptance">
                                            <div class="program-acceptance-head">
                                                <span class="program-pill program-pill--accent">${escapeHtml(`${Math.round(pct * 100) / 100}%`)}</span>
                                            </div>
                                            <div class="program-acceptance-track" aria-hidden="true">
                                                <div class="program-acceptance-fill" data-width-pct="${pct}"></div>
                                            </div>
                                        </div>
                                    `;
                                }
                                return `<span class="program-card-value program-card-value--empty">${escapeHtml(unknownLabelText(label, label))}</span>`;
                            }
                            if (!String(formattedValue || "").trim()) {
                                return `<span class="program-card-value program-card-value--empty">${escapeHtml(unknownLabelText(label, label))}</span>`;
                            }
                            return `<span class="program-card-value">${escapeHtml(formattedValue)}</span>`;
                        };

                        const programAcceptance = toFiniteNumber(program.acceptance_rate_percent);
                        const rows = [
                            ...(programAcceptance !== null ? [{
                                label: translateWord("acceptance_rate", "Acceptance Rate"),
                                key: "acceptance_rate_percent",
                                rawValue: program.acceptance_rate_percent,
                                value: formatProgramValue("acceptance_rate_percent", program.acceptance_rate_percent),
                            }] : []),
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
                                label: isMajorTagField(k)
                                    ? t("placeholder.field.applicable_majors", "Applicable majors")
                                    : prettyField(k),
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
                                        ${durationMeta ? `<span class="program-pill">${escapeHtml(durationMeta)}</span>` : ""}
                                        ${modeMeta ? `<span class="program-pill">${escapeHtml(modeMeta)}</span>` : ""}
                                        ${levelsMeta ? `<span class="program-pill">${escapeHtml(levelsMeta)}</span>` : ""}
                                    </div>
                                </div>
                                <div class="program-card-title">
                                    ${escapeHtml(trProgramName(program.name || "") || unknownFieldText("placeholder.field.program_name", "Program name"))}
                                </div>
                                <div class="program-card-rows">
                                    ${allRows.map((row) => `
                                        <div class="program-card-row">
                                            <span class="program-card-label">${escapeHtml(row.label)}</span>
                                            ${renderValueCell(row.label, row.key, row.rawValue, row.value)}
                                        </div>
                                    `).join("")}
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
                ${admissionsProgramsHtml}
            `;
        } else {
            const majors = Array.isArray(u?.academics?.majors)
                ? u.academics.majors
                    .map((m) => String(m || "").trim())
                    .filter(Boolean)
                : [];
            const majorsHtml = majors.length
                ? majors.map((m) => `<span class="program-major-chip">${escapeHtml(trProgramName(m))}</span>`).join(" ")
                : `<div class="program-empty">${escapeHtml(unknownFieldText("placeholder.field.programs", "Programs"))}</div>`;
            progDiv.innerHTML = `${majorsHtml}${admissionsProgramsHtml}`;
        }
        applyPercentWidths(progDiv);
        markMotionEnter(progDiv, ".program-card, .program-major-chip, .admissions-summary-card, .admissions-program-card, .program-empty", { limit: 18, staggerMs: 18 });
    }


    // --- TAB 3: ADMISSION ---
        const reqDiv = document.getElementById("detailRequirements");
        const renderAdmissionTab = () => {
        if (!reqDiv) return;
        const warningHTML = uniChance?.missingEvidence
            ? `<div class="chance-warning">${escapeHtml(translateTemplate("add_profile_evidence", "Add exam scores or language evidence in your profile to unlock a reliable {chance} estimate for this university.", { chance: aiName("chance") }))}</div>`
            : "";
        const admissionsOverviewHtml = renderAdmissionsOverview(admissionsData);
        if (!u.admission_tracks || u.admission_tracks.length === 0) {
            reqDiv.innerHTML = `${warningHTML}${renderUniChanceSummary(uniChance)}${admissionsOverviewHtml}<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.admission_tracks", "Admission tracks"))}</div>`;
        } else {
            const tracks = Array.isArray(u.admission_tracks) ? u.admission_tracks : [];
            const trackEntries = tracks
            .map((track, idx) => ({
                track,
                idx,
                options: getTrackFundingOptions(track),
            }))
            .filter(({ options }) => options.length > 0);
            const bestTrackKey = String(uniChance?.bestTrackKey || "").trim();
            const recommendedTrackKey = String(uniChance?.recommendedTrackKey || bestTrackKey || "").trim();
            const selectedTrackKey = getSelectedAdmissionTrack(u.id);
            const effectiveSelectedTrackKey = selectedTrackKey || bestTrackKey;
            const selectedTrackTooltip = t(
                "admission.track.select_tooltip",
                "Select this admission track to use it for admission chance display and for UniFit ranking."
            );
            let tracksHTML = warningHTML + renderUniChanceSummary(uniChance) + admissionsOverviewHtml;

            trackEntries.forEach(({ track, idx, options }) => {
                const trackLabel = trTrackLabel(track.label || "");
                const trackDescription = trTrackDescription(u.id, track.id, track.description || "");
                const majors = Array.isArray(track.applicable_majors) ? track.applicable_majors : [];
                const translatedMajors = majors.map((m) => trProgramName(m)).filter(Boolean);

                let majorsBadge = "";
                if (translatedMajors.length > 0) {
                    majorsBadge = `
                    <div class="track-applicable-majors">
                        <strong>${escapeHtml(translateWord("placeholder.field.applicable_majors", "Applicable majors"))}:</strong>
                        ${translatedMajors.map((major) => `<span class="tag">${escapeHtml(major)}</span>`).join("")}
                    </div>
                    `;
                }

                const optionCardsHtml = options.map((option, optionIdx) => {
                    const trackKey = trackLookupKey(option, optionIdx);
                    const trackChance = uniChanceByTrackKey.get(trackKey);
                    const isRecommendedTrack = Boolean(recommendedTrackKey && trackKey === recommendedTrackKey);
                    const isSelectedTrack = Boolean(effectiveSelectedTrackKey && trackKey === effectiveSelectedTrackKey);

                    const selectionBadges = [];
                    if (isSelectedTrack) selectionBadges.push(escapeHtml(t("admission.track.selected", "Selected")));
                    if (isRecommendedTrack) selectionBadges.push(escapeHtml(t("admission.track.recommended", "Recommended")));

                    const selectionBadgeHtml = selectionBadges.length
                    ? `<div class="track-selection-badge">${selectionBadges.join(" • ")}</div>`
                    : "";

                    const optionPriceOverride = option.finance_override?.total_cost_year_usd;
                    const optionPrice = annualCostForTrack(option);
                    const isGrantTrack = getTrackFundingType(option) === "grant";

                    const priceTitle = isGrantTrack
                    ? (optionPriceOverride != null
                        ? translateWord("est_net_cost", "Est. Net Cost")
                        : translateWord("base_cost_before_grant", "Base Cost (before grant)"))
                    : translateWord("est_cost", "Est. Cost");

                    const priceValue = Number.isFinite(Number(optionPrice))
                    ? moneyUSD(optionPrice)
                    : unknownFieldText("placeholder.field.cost", "Cost");

                    const requirements = option.requirements || {};
                    const minParts = splitExamEntries(requirements);
                    const minList = [
                    renderExamGroup(
                        translateWord("academic_requirements", "Academic requirements"),
                        minParts.acad,
                        "#2563eb"
                    ),
                    renderTrackLanguageExamGroup(option, "requirements"),
                    ].filter(Boolean).join("");

                    const statsAvg = option.stats_avg || {};
                    const avgParts = splitExamEntries(statsAvg);
                    const avgList = [
                    renderExamGroup(
                        translateWord("academic_average", "Academic average"),
                        avgParts.acad,
                        "#2563eb"
                    ),
                    renderTrackLanguageExamGroup(option, "average"),
                    ].filter(Boolean).join("");
                    const minContent = minList || `<div class="track-muted-italic">${escapeHtml(unknownFieldText("placeholder.field.minimum_requirements", "Minimum requirements"))}</div>`;
                    const avgContent = avgList || `<div class="track-muted-italic">${escapeHtml(translateWord("average_admitted_unavailable", "No verified average admitted data published."))}</div>`;
                    const extraRequirementItems = Array.isArray(option.extra_requirements)
                    ? option.extra_requirements
                        .map((item) => trTrackDescription(u.id, option.id, item))
                        .filter(Boolean)
                    : [];
                    const extraReqInfo = extraRequirementItems.length
                    ? `
                        <div class="track-extra-req">
                        <div class="track-extra-req-title">${escapeHtml(translateWord("extra_requirements", "Extra requirements"))}</div>
                        <ul class="track-extra-req-list">${extraRequirementItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                        </div>
                    `
                    : "";

                    const optionLabelRaw = String(option.label || "").trim();
                    const parentLabelRaw = String(track.label || "").trim();
                    const optionLabel = optionLabelRaw && optionLabelRaw !== parentLabelRaw
                    ? trTrackLabel(optionLabelRaw)
                    : "";

                    const fundingMeta = [
                    option.funding_program ? trTrackDescription(u.id, option.id, option.funding_program) : "",
                    option.funding_source ? trTrackDescription(u.id, option.id, option.funding_source) : "",
                    ].filter(Boolean);

                    return `
                    <article class="admission-option-card${isGrantTrack ? " admission-option-card--grant" : ""}">
                        <div class="admission-option-head">
                        <div class="admission-option-title-wrap">
                            ${renderTrackFundingBadge(option)}
                            ${optionLabel ? `<div class="admission-option-title">${escapeHtml(optionLabel)}</div>` : ""}
                            ${renderTrackChanceChip(trackChance)}
                        </div>
                        ${selectionBadgeHtml}
                        </div>

                        ${fundingMeta.length ? `
                        <div class="admission-option-meta">
                            ${fundingMeta.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
                        </div>
                        ` : ""}

                        <div class="track-cost-preview${isGrantTrack ? " track-cost-preview--grant" : ""}">
                        <strong>${escapeHtml(priceTitle)}:</strong> ${escapeHtml(priceValue)}
                        </div>

                        <div class="track-stats-grid">
                        <div class="track-stats-box track-stats-box--min">
                            <div class="track-stats-title">${escapeHtml(translateWord("minimum_to_apply", "Minimum to apply"))}</div>
                            <div class="track-stats-values">${minContent}</div>
                        </div>
                        <div class="track-stats-box track-stats-box--avg">
                            <div class="track-stats-title track-stats-title--avg">${escapeHtml(translateWord("real_average_admitted", "Average admitted"))}</div>
                            <div class="track-stats-values">${avgContent}</div>
                        </div>
                        </div>

                        ${extraReqInfo}

                        <div class="track-select-row">
                        <button
                            type="button"
                            class="track-select-btn${isSelectedTrack ? " is-active" : ""}"
                            data-track-select-key="${escapeHtml(trackKey)}"
                            title="${escapeHtml(selectedTrackTooltip)}"
                            ${isSelectedTrack ? "disabled" : ""}
                        >
                            ${escapeHtml(isSelectedTrack ? t("admission.track.selected", "Selected") : t("admission.track.select", "Select"))}
                        </button>
                        </div>
                    </article>
                    `;
                }).join("");
                const trackHasGrantOnlyOptions = options.length > 0 && options.every((option) => getTrackFundingType(option) === "grant");

                tracksHTML += `
                    <section class="track-card${trackHasGrantOnlyOptions ? " track-card--grant" : ""}">
                    <div class="track-header">
                        <div>
                        <h3 class="track-title">${escapeHtml(trackLabel || unknownFieldText("placeholder.field.track_name", "Track name"))}</h3>
                        ${trackDescription ? `<p class="track-description">${escapeHtml(trackDescription)}</p>` : ""}
                        </div>
                        <div class="track-option-count">
                        ${escapeHtml(formatFundingOptionsCount(options.length))}
                        </div>
                    </div>

                    ${majorsBadge}

                    <div class="track-funding-options-block">
                        <div class="track-funding-options-title">
                        ${escapeHtml(translateWord("admission.track.funding_options", "Funding options"))}
                        </div>
                        <div class="track-funding-options-grid">
                        ${optionCardsHtml}
                        </div>
                    </div>
                    </section>
                `;
            });
            reqDiv.innerHTML = tracksHTML;
            reqDiv.querySelectorAll("[data-track-select-key]").forEach((button) => {
                button.addEventListener("click", () => {
                    if (button.disabled) return;
                    motionPress(button);
                    const trackKey = String(button.getAttribute("data-track-select-key") || "").trim();
                    if (!trackKey) return;
                    saveSelectedAdmissionTrack(u.id, trackKey);
                    reqDiv.querySelectorAll("[data-track-select-key]").forEach((node) => {
                        const active = String(node.getAttribute("data-track-select-key") || "").trim() === trackKey;
                        node.classList.toggle("is-active", active);
                        node.disabled = active;
                        node.textContent = active
                            ? t("admission.track.selected", "Selected")
                            : t("admission.track.select", "Select");
                    });
                    replayMotion(button.closest(".admission-option-card") || button, "motion-state-pulse", { timeoutMs: 520 });
                    replayMotion(button.closest(".track-card") || reqDiv, "motion-panel-enter", { timeoutMs: 420 });
                });
            });
        }
        applyPercentWidths(reqDiv);
        markMotionEnter(reqDiv, ".track-card, .admission-option-card, .admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 18, staggerMs: 18 });
    };
    renderAdmissionTab();
    __detailProfileUpdatedHandler = async () => {
        await Promise.all([recomputeUniChance(), recomputeUniRoi()]);
        renderAdmissionTab();
    };
    window.addEventListener("profileUpdated", __detailProfileUpdatedHandler);

    // --- TAB 4: FINANCE ---
    const finDiv = document.getElementById("detailFinance");
    const scholDiv = document.getElementById("detailScholarshipInfo"); 
    const priceBig = document.getElementById("detailPrice");           
    let financeSummarySyncRaf = 0;
    const applyFinanceSummaryCardHeights = () => {
        const scholarshipCard = scholDiv;
        const totalPriceCard = priceBig?.closest?.(".total-price-card") || null;
        if (!scholarshipCard || !totalPriceCard) return;

        scholarshipCard.style.minHeight = "";
        totalPriceCard.style.minHeight = "";
        if (window.innerWidth <= 768) return;

        const targetHeight = Math.max(
            scholarshipCard.offsetHeight || 0,
            totalPriceCard.offsetHeight || 0,
        );
        if (targetHeight > 0) {
            const value = `${targetHeight}px`;
            scholarshipCard.style.minHeight = value;
            totalPriceCard.style.minHeight = value;
        }
    };
    const syncFinanceSummaryCardHeights = () => {
        if (financeSummarySyncRaf) {
            window.cancelAnimationFrame(financeSummarySyncRaf);
        }
        financeSummarySyncRaf = window.requestAnimationFrame(() => {
            financeSummarySyncRaf = 0;
            applyFinanceSummaryCardHeights();
        });
    };
    const settleFinanceSummaryCardHeights = () => {
        syncFinanceSummaryCardHeights();
        window.setTimeout(syncFinanceSummaryCardHeights, 140);
    };
    __detailFinanceResizeHandler = syncFinanceSummaryCardHeights;
    window.addEventListener("resize", __detailFinanceResizeHandler, { passive: true });
    if (typeof ResizeObserver === "function") {
        __detailFinanceResizeObserver = new ResizeObserver(() => {
            syncFinanceSummaryCardHeights();
        });
        if (scholDiv) __detailFinanceResizeObserver.observe(scholDiv);
        const totalPriceCard = priceBig?.closest?.(".total-price-card") || null;
        if (totalPriceCard) __detailFinanceResizeObserver.observe(totalPriceCard);
        const financeSummaryContainer = scholDiv?.closest?.(".finance-summary-container") || null;
        if (financeSummaryContainer) __detailFinanceResizeObserver.observe(financeSummaryContainer);
    }
    if (document.fonts?.ready?.then) {
        document.fonts.ready.then(syncFinanceSummaryCardHeights).catch(() => {});
    }
    window.addEventListener("load", syncFinanceSummaryCardHeights, { once: true });
    
    if (u.finance) {
        // Scholarships block
        if (scholDiv) {
            const fa = u.finance.financial_aid || {};
            const hasMerit = typeof fa.merit_based === "boolean";
            const hasNeed = typeof fa.need_based === "boolean";
            const meritHtml = hasMerit
                ? (fa.merit_based
                    ? renderScholarshipLine("check-circle", "scholarship-line--positive", translateWord("merit_based_scholarships_available", "Merit-based scholarships available"))
                    : renderScholarshipLine("x-circle", "scholarship-line--muted", translateWord("no_merit_based_scholarships", "No merit-based scholarships")))
                : renderScholarshipLine("question-mark-circle", "scholarship-line--muted", unknownFieldText("placeholder.field.merit_scholarships", "Merit-based scholarships"));
            const needHtml = hasNeed
                ? (fa.need_based
                    ? renderScholarshipLine("check-circle", "scholarship-line--positive", translateWord("need_based_financial_aid", "Need-based financial aid"))
                    : renderScholarshipLine("x-circle", "scholarship-line--muted", translateWord("no_need_based_aid", "No need-based aid")))
                : renderScholarshipLine("question-mark-circle", "scholarship-line--muted", unknownFieldText("placeholder.field.need_based_aid", "Need-based aid"));
            scholDiv.innerHTML = meritHtml + needHtml;
        }

        // Price block
        if (priceBig) {
            let minTotal = modeAwareAnnualCost(u.finance || {}, profileStudyMode);
            const allFundingOptionsForFinance = (Array.isArray(u.admission_tracks) ? u.admission_tracks : [])
                .flatMap((track) => getTrackFundingOptions(track));

            if (allFundingOptionsForFinance.length) {
                const prices = allFundingOptionsForFinance
                    .map((option) => annualCostForTrack(option))
                    .filter((price) => Number.isFinite(Number(price)) && Number(price) > 0);

                if (prices.length > 0) minTotal = Math.min(...prices);
            }
            priceBig.innerHTML = Number.isFinite(Number(minTotal))
                ? `<span class="price-prefix">${escapeHtml(translateWord("from", "from"))}</span>${moneyUSD(minTotal)}`
                : escapeHtml(unknownFieldText("placeholder.field.cost", "Cost"));
        }
        settleFinanceSummaryCardHeights();
        
        // Track cards
        if (finDiv) {
            finDiv.innerHTML = "";

            const tracks = (Array.isArray(u.admission_tracks) && u.admission_tracks.length > 0)
                ? u.admission_tracks
                : [{ label: translateWord("general_tuition", "General Tuition"), finance_override: null }];

            let financeHTML = "";

            tracks.forEach((track) => {
                const optionRows = getTrackFundingOptions(track);
                const trackHasGrantOnlyOptions = optionRows.length > 0 && optionRows.every((option) => getTrackFundingType(option) === "grant");

                const optionCardsHtml = optionRows.map((option) => {
                const isGrantTrack = getTrackFundingType(option) === "grant";
                const fData = option.finance_override || u.finance;
                const total = modeAwareAnnualCost(fData || {}, profileStudyMode);
                const breakdown = modeAwareBreakdown(fData || {}, profileStudyMode);
                const totalText = moneyOrUnknown(total, "placeholder.field.total_cost", "Total cost");

                const colorClasses = ["cost-color-1", "cost-color-2", "cost-color-3", "cost-color-4", "cost-color-5"];
                const breakdownEntries = Object.entries(breakdown || {})
                    .map(([key, val], idx) => {
                    const numericVal = Number(val) || 0;
                    return {
                        colorClass: colorClasses[idx % colorClasses.length],
                        label: translateCostBreakdownLabel(key),
                        percent: Number.isFinite(Number(total)) && Number(total) > 0 ? ((numericVal / Number(total)) * 100) : 0,
                        value: numericVal,
                    };
                    })
                    .filter((entry) => entry.value > 0);
                const breakdownNote = costBreakdownCoverageNote(fData || {}, breakdownEntries, total);

                const optionLabelRaw = String(option.label || "").trim();
                const parentLabelRaw = String(track.label || "").trim();
                const optionLabel = optionLabelRaw && optionLabelRaw !== parentLabelRaw
                    ? trTrackLabel(optionLabelRaw)
                    : "";
                const fundingMeta = [
                    option.funding_program ? trTrackDescription(u.id, option.id, option.funding_program) : "",
                    option.funding_source ? trTrackDescription(u.id, option.id, option.funding_source) : "",
                ].filter(Boolean);

                const totalTitle = isGrantTrack
                    ? translateWord("est_net_cost", "Est. Net Cost")
                    : translateWord("total_per_year", "Total / year");
                const breakdownHtml = breakdownEntries.length > 1
                    ? `
                    <div class="cost-progress-bar">
                        ${breakdownEntries.map((entry) => `<span class="cost-progress-segment ${entry.colorClass}" style="--fill-width:${entry.percent}%"></span>`).join("")}
                    </div>
                    <div class="cost-legend">
                        ${breakdownEntries.map((entry) => `
                        <div class="cost-legend-row">
                            <div class="cost-legend-label-wrap">
                                <span class="cost-legend-dot ${entry.colorClass}"></span>
                                <span class="cost-legend-label">${escapeHtml(entry.label)}</span>
                            </div>
                            <span class="cost-legend-value">${escapeHtml(moneyUSD(entry.value))}</span>
                        </div>
                        `).join("")}
                    </div>
                    `
                    : (breakdownEntries.length === 1
                        ? `<div class="cost-legend-single">${escapeHtml(breakdownEntries[0].label)}: <strong>${escapeHtml(moneyUSD(breakdownEntries[0].value))}</strong></div>`
                        : `<div class="cost-legend-single">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`);
                const breakdownNoteHtml = breakdownNote
                    ? `<div class="finance-breakdown-note">${escapeHtml(breakdownNote)}</div>`
                    : "";

                return `
                    <article class="finance-option-card${isGrantTrack ? " finance-option-card--grant" : ""}">
                    <div class="finance-option-head">
                        ${renderTrackFundingBadge(option)}
                        ${optionLabel ? `<div class="finance-option-label">${escapeHtml(optionLabel)}</div>` : ""}
                    </div>
                    ${fundingMeta.length ? `
                    <div class="admission-option-meta">
                        ${fundingMeta.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
                    </div>
                    ` : ""}

                    <div class="finance-option-total${isGrantTrack ? " finance-option-total--grant" : ""}">
                        <strong>${escapeHtml(totalTitle)}:</strong> ${escapeHtml(totalText)}
                    </div>

                    <div class="cost-breakdown-list">
                        ${breakdownHtml}
                        ${breakdownNoteHtml}
                    </div>
                    </article>
                `;
                }).join("");

                financeHTML += `
                <section class="finance-track-group${trackHasGrantOnlyOptions ? " finance-track-group--grant" : ""}">
                    <div class="finance-track-group-head">
                    <h3>${escapeHtml(trTrackLabel(track.label || "") || translateWord("placeholder.field.track_name", "Track name"))}</h3>
                    ${track.description ? `<p>${escapeHtml(trTrackDescription(u.id, track.id, track.description))}</p>` : ""}
                    </div>

                    <div class="finance-track-options-title">
                    ${escapeHtml(translateWord("admission.track.funding_options", "Funding options"))}
                    </div>

                    <div class="finance-track-options-grid">
                    ${optionCardsHtml}
                    </div>
                </section>
                `;
            });

            const roiHtml = renderRoiBox(uniRoi);
            const financeGridHtml = financeHTML ? `<div class="finance-grid-new">${financeHTML}</div>` : `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`;
            finDiv.innerHTML = `${financeGridHtml}${roiHtml}`;
            markMotionEnter(finDiv, ".finance-track-group, .finance-option-card, .roi-box, .admission-empty-state", { limit: 18, staggerMs: 18 });
        }
    } else {
        if (scholDiv) {
            scholDiv.innerHTML = renderScholarshipLine("question-mark-circle", "scholarship-line--muted", unknownFieldText("placeholder.field.financial_aid", "Financial aid"));
        }
        if (priceBig) {
            priceBig.textContent = unknownFieldText("placeholder.field.cost", "Cost");
        }
        if (finDiv) {
            finDiv.innerHTML = `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`;
            markMotionEnter(finDiv, ".admission-empty-state", { limit: 1 });
        }
        settleFinanceSummaryCardHeights();
    }

    if (stateEl) stateEl.textContent = "";
    if (cardEl) {
        cardEl.style.display = "block";
        cardEl.classList.add("is-mounted");
    }
    setupTabs(); 
    const onDetailLanguageChanged = async () => {
      __detailLanguageChangedHandler = null;
      try {
        await initUniversityTranslations();
      } catch (e) {
        // keep fallback localization if translation pack request fails
      }
      await initUniversityPage();
    };
    __detailLanguageChangedHandler = onDetailLanguageChanged;
    window.addEventListener("languageChanged", onDetailLanguageChanged, { once: true });

  } catch (err) {
    console.error(err);
    if (stateEl) {
      renderNoConnection({
        containerId: stateEl.id,
        onRetry: () => initUniversityPage()
      });
    }
  } finally {
    setDetailLoading(false);
  }
}

