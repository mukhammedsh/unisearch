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
} from "../utils.js";

import {
  applyPercentWidths,
  clusterMarkerLogoHtml,
  getTrackFundingType,
  mapMarkerLogoHtml,
  renderExamGroup,
  renderGroupedExamPairRows,
  renderTrackChanceChip,
  renderTrackFundingBadge,
  renderUniChanceSummary,
  splitExamEntries,
} from "../university-detail-helpers.js";

import { setupTabs, renderNoConnection } from "../components.js";
import { heroIcon, stripLeadingDecorations } from "../icons.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import { extractUniversityIdFromLocation, routeUniversities, routeUniversityDetail } from "../routes.js";
import {
  SETTING_STORE_RECENT_UNIVERSITIES,
  SETTING_OPEN_UNIVERSITIES_NEW_TAB,
  shouldStoreRecentUniversities,
} from "../settings.js";
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
  COMPARE_ADMISSION_CHOICES_KEY,
  COMPARE_UNIVERSITIES_KEY,
  DETAIL_CACHE_KEY,
  DETAIL_CACHE_MAX_ITEMS,
  DETAIL_CACHE_TTL_MS,
  fetchUniversityDetailCached,
  getDetailCacheEntry,
  hasSeenUniversitiesTour,
  markUniversitiesTourSeen,
  MAX_COMPARE_UNIVERSITIES,
  MAX_RECENT_UNIVERSITIES,
  readDetailCache,
  readIdListStorage,
  RECENT_UNIVERSITIES_KEY,
  rememberRecentUniversity,
  SAVED_UNIVERSITIES_KEY,
  setDetailCacheEntry,
  shouldOpenUniversitiesInNewTab,
  touchDetailCacheEntry,
  writeDetailCache,
  writeIdListStorage,
} from "./shared/cache.js";
export {
  // shared/cache.js re-exports (used by universities.js)
  COMPARE_ADMISSION_CHOICES_KEY,
  COMPARE_UNIVERSITIES_KEY,
  DETAIL_CACHE_KEY,
  DETAIL_CACHE_MAX_ITEMS,
  DETAIL_CACHE_TTL_MS,
  fetchUniversityDetailCached,
  getDetailCacheEntry,
  hasSeenUniversitiesTour,
  markUniversitiesTourSeen,
  MAX_COMPARE_UNIVERSITIES,
  MAX_RECENT_UNIVERSITIES,
  readDetailCache,
  readIdListStorage,
  RECENT_UNIVERSITIES_KEY,
  rememberRecentUniversity,
  SAVED_UNIVERSITIES_KEY,
  setDetailCacheEntry,
  shouldOpenUniversitiesInNewTab,
  touchDetailCacheEntry,
  writeDetailCache,
  writeIdListStorage,
};
export const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  if (/^www\./i.test(s)) return `https://${s}`;
  return "";
}

export function safeUrl(raw) {
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

export function safePathSegment(raw) {
  return encodeURIComponent(String(raw || "").trim());
}

export function buildApiUrl(path) {
  const base = String(API_BASE || "").trim().replace(/\/+$/, "");
  const suffix = String(path || "").replace(/^\/+/, "");
  return `${base}/${suffix}`;
}

export function formatCampusSizeValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const translated = translateDataValue("campus_size", raw, raw);
  if (getCurrentLanguage() === "eng") return humanizeMachineLabel(translated, raw);
  return translated;
}

export function cleanDecoratedText(text) {
  const raw = String(text || "").trim();
  const stripped = stripLeadingDecorations(raw);
  return stripped || raw;
}

export function renderInlineIcon(name, size = 14, extraClass = "") {
  const classes = ["ui-icon", `ui-icon--${size}`];
  if (extraClass) classes.push(extraClass);
  return heroIcon(name, classes.join(" "));
}

export function renderUniPill(iconName, toneClass, text) {
  const safeText = escapeHtml(cleanDecoratedText(text));
  return `<span class="uni-pill ${toneClass}" title="${safeText}">${renderInlineIcon(iconName, 14, "uni-pill-icon")}<span class="uni-pill-text">${safeText}</span></span>`;
}

export function renderScholarshipLine(iconName, toneClass, text) {
  return `<div class="scholarship-line ${toneClass}">${renderInlineIcon(iconName, 16, "scholarship-line-icon")}<span>${escapeHtml(cleanDecoratedText(text))}</span></div>`;
}

export function renderLocationMarkup({
  city = "",
  country = "",
  flagHtml = "",
  wrapperClass = "",
  iconClass = "",
  showIcon = true,
  cityClass = "",
  countryClass = "",
  fallbackClass = "",
} = {}) {
  const cityText = String(city || "").trim();
  const countryText = String(country || "").trim();
  const parts = [];
  if (cityText) {
    parts.push(`<span class="${cityClass}">${escapeHtml(cityText)}${countryText ? "," : ""}</span>`);
  }
  if (countryText) {
    const countryLabel = `<span>${escapeHtml(countryText)}</span>`;
    parts.push(`<span class="${countryClass}">${flagHtml ? `${flagHtml}${countryLabel}` : countryLabel}</span>`);
  }
  if (!parts.length) {
    parts.push(`<span class="${fallbackClass || cityClass}">${escapeHtml(unknownFieldText("placeholder.field.location", "Location"))}</span>`);
  }
  const iconHtml = showIcon ? renderInlineIcon("map-pin", 14, iconClass) : "";
  return `<div class="${wrapperClass}">${iconHtml}${parts.join("")}</div>`;
}

export let rankingBadgeResizeBound = false;
export let rankingBadgeResizeRaf = 0;
export let rankingFetchController = null;

export function fitRankingBadgeText(container) {
  if (!container) return;
  const badges = Array.from(container.querySelectorAll(".rank-badge"));
  badges.forEach((badge) => {
    const baseSize = 13;
    const minSize = 9;
    let size = baseSize;
    badge.style.fontSize = `${baseSize}px`;
    badge.style.whiteSpace = "nowrap";

    // Keep single-line badge text, shrinking only as much as needed.
    while (badge.scrollWidth > badge.clientWidth && size > minSize) {
      size -= 0.25;
      badge.style.fontSize = `${size.toFixed(2)}px`;
    }
  });
}

export function ensureRankingBadgeResizeHandler() {
  if (rankingBadgeResizeBound) return;
  const onViewportChange = () => {
    if (rankingBadgeResizeRaf) cancelAnimationFrame(rankingBadgeResizeRaf);
    rankingBadgeResizeRaf = requestAnimationFrame(() => {
      rankingBadgeResizeRaf = 0;
      const listEl = document.getElementById("rankingList");
      if (!listEl) return;
      fitRankingBadgeText(listEl);
    });
  };
  window.addEventListener("resize", onViewportChange, { passive: true });
  window.addEventListener("orientationchange", onViewportChange, { passive: true });
  rankingBadgeResizeBound = true;
}

export function trCountry(value) {
  return translateDataValue("country", value, value);
}

export function trCity(value) {
  return translateDataValue("city", value, value);
}

export function trState(value) {
  return translateDataValue("state", value, value);
}

export function trProgramLanguage(value) {
  return translateDataValue("language", value, value);
}

export function trStudyLevel(value) {
  return translateDataValue("study_level", value, value);
}

export function trStudyMode(value) {
  return translateDataValue("study_mode", value, value);
}

export function trTag(value) {
  return translateDataValue("tag", value, value);
}

export function trUniversityName(u) {
  return translateUniversityName(u?.id, String(u?.name || ""));
}

export function trUniversityDescription(u) {
  return translateUniversityDescription(u, String(u?.description || ""));
}

export function trTrackLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  return translateTrackLabel(raw, raw);
}

export function trTrackDescription(universityId, trackId, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return translateAdmissionText(raw, raw);
}

export function trProgramName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return translateProgramName(raw, raw);
}

export function unknownFieldText(fieldKey, fallbackField) {
  return translateUnknownWord(fieldKey, fallbackField);
}

export function unknownLabelText(fieldLabel, fallbackField = "") {
  return translateUnknownField(fieldLabel, fallbackField);
}

export function textOrUnknown(value, fieldKey, fallbackField) {
  const text = String(value ?? "").trim();
  return text || unknownFieldText(fieldKey, fallbackField);
}

export function moneyOrUnknown(value, fieldKey, fallbackField) {
  return Number.isFinite(Number(value))
    ? moneyUSD(value)
    : unknownFieldText(fieldKey, fallbackField);
}

export function normalizeTranslationKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function translateCostBreakdownLabel(rawKey) {
  const key = normalizeTranslationKey(rawKey);
  const fallback = String(rawKey || "")
    .replace(/_/g, " ")
    .trim();
  if (!key) return fallback;
  return translateWord(`cost_item_${key}`, fallback);
}

export function costBreakdownCoverageNote(financeData, breakdownEntries, total) {
  const finance = financeData && typeof financeData === "object" ? financeData : {};
  const status = String(finance.costs_breakdown_status || "").trim().toLowerCase();
  const breakdownSum = breakdownEntries.reduce((sum, entry) => sum + (Number(entry?.value) || 0), 0);
  const totalValue = Number(total);
  const hasHiddenPortion = Number.isFinite(totalValue) && totalValue > 0 && (totalValue - breakdownSum) > 1;

  if (status === "official_tuition_and_fees_only") {
    return t(
      "university.finance.breakdown_note.tuition_fees_only",
      "Showing only directly official tuition and institutional fee items. Other living-cost subcategories are hidden because the source does not publish them as authoritative line items."
    );
  }
  if (status === "official_mandatory_breakdown") {
    return t(
      "university.finance.breakdown_note.mandatory_only",
      "Showing only verified mandatory items."
    );
  }
  if (hasHiddenPortion) {
    return t(
      "university.finance.breakdown_note.partial",
      "This breakdown is intentionally partial. The total may also include other source-side allowances or non-itemized costs."
    );
  }
  return "";
}

export function trackCefrLabel(id) {
  const n = Number(id);
  if (n === 1) return "A1";
  if (n === 2) return "A2";
  if (n === 3) return "B1";
  if (n === 4) return "B2";
  if (n === 5) return "C1";
  if (n === 6) return "C2";
  return String(id ?? "");
}

export function renderTrackLanguageExamGroup(track, variant = "requirements") {
  const list = Array.isArray(track?.language_requirements) ? track.language_requirements : [];
  if (!list.length) return "";

  const isAverage = variant === "average";
  const title = isAverage
    ? translateWord("language_average", "Language average")
    : translateWord("language_requirements_short", "Language requirements");
  const mode = String(track?.language_requirements_mode || "all").toLowerCase() === "any" ? "any" : "all";
  const modeText = mode === "any"
    ? translateWord("lang_mode_any", "Any one language proof is enough")
    : translateWord("lang_mode_all", "All listed language proofs are required");

  const rows = [];
  if (!isAverage) {
    rows.push(`<div><strong>${escapeHtml(modeText)}</strong></div>`);
  }

  list.forEach((lr) => {
    const code = String(lr?.code || "").trim().toUpperCase() || "LANG";
    const meta = [];
    if (!isAverage && lr?.accept_native) {
      meta.push(translateWord("native_accepted", "Native accepted"));
    }
    if (!isAverage && lr?.min_cefr != null) {
      meta.push(`${translateWord("min_cefr", "Min CEFR")}: ${trackCefrLabel(lr.min_cefr)}`);
    }
    if (isAverage && lr?.recommended_cefr != null) {
      meta.push(`${translateWord("recommended", "Recommended")}: ${trackCefrLabel(lr.recommended_cefr)}`);
    }

    const examPairs = Object.entries(isAverage ? (lr?.stats_avg || {}) : (lr?.requirements || {}));
    const groupedExamRows = renderGroupedExamPairRows(examPairs, { langCode: lr?.code });
    if (!meta.length && !groupedExamRows && isAverage) return;

    rows.push(`
      <div class="track-exam-entry-group">
        <div class="track-exam-entry-group-title"><strong>${escapeHtml(code)}</strong></div>
        <div class="track-exam-entry-group-list">
          ${meta.length ? `<div>${escapeHtml(meta.join(" • "))}</div>` : ""}
          ${groupedExamRows}
        </div>
      </div>
    `);
  });

  if (isAverage && !rows.length) return "";

  const fallbackText = isAverage
    ? translateWord("average_admitted_unavailable", "No verified average admitted data published.")
    : unknownFieldText("placeholder.field.language_requirements", "Language requirements");
  const content = rows.length
    ? rows.join("")
    : `<div class="track-muted-italic">${escapeHtml(fallbackText)}</div>`;

  return `
      <div class="track-exam-group track-exam-group--success">
      <div class="track-exam-group-title">${escapeHtml(title)}</div>
      <div class="track-exam-group-list">${content}</div>
      </div>
  `;
}

export function localizeRoiLabel(rawLabel, tone = "") {
  const value = String(rawLabel || "").trim().toLowerCase();
  const toneValue = String(tone || "").trim().toLowerCase();

  if (value.includes("excellent")) {
    return t("roi.label.excellent_return", "Excellent Return");
  }
  if (value.includes("positive")) {
    return t("roi.label.positive_return", "Positive Return");
  }
  if (value.includes("high investment")) {
    return t("roi.label.high_investment", "High Investment");
  }
  if (toneValue === "excellent") {
    return t("roi.label.excellent_return", "Excellent Return");
  }
  if (toneValue === "good") {
    return t("roi.label.positive_return", "Positive Return");
  }
  return t("roi.label.high_investment", "High Investment");
}

export function renderRoiBox(roi) {
  if (!roi || typeof roi !== "object") return "";
  const salary = toFiniteNumber(roi.salary_used_usd);
  const annualCost = toFiniteNumber(roi.annual_cost_usd);
  const roiValue = toFiniteNumber(roi.roi_value);
  const contextType = String(roi.context_type || "").trim().toLowerCase();
  if (salary === null || annualCost === null || roiValue === null || salary <= 0 || contextType === "no_salary_data") return "";

  const tone = String(roi.roi_tone || "").trim().toLowerCase();
  const toneClass = tone === "excellent" || tone === "good" ? "roi-tone-positive" : "roi-tone-warn";
  const userMajor = String(roi.user_major || "").trim();
  const matchedMajor = String(roi.matched_major || "").trim();
  let contextClass = "roi-context--neutral";
  let contextText = t("roi.context.default", "ROI is based on available university outcomes data.");

  if (contextType === "matched_major" && matchedMajor) {
    contextClass = "roi-context--matched";
    contextText = translateTemplate(
      "roi.context.matched_major",
      "Calculation based on {major} graduates from this university.",
      { major: matchedMajor }
    );
  } else if (contextType === "fallback_major" && userMajor) {
    contextText = translateTemplate(
      "roi.context.fallback_major",
      "Specific data for {major} not available.",
      { major: userMajor }
    );
  } else if (contextType === "missing_major") {
    contextClass = "roi-context--missing";
    contextText = t("roi.context.missing_major", "Select your Major in Profile to see precise ROI for your field.");
  }

  const label = localizeRoiLabel(roi.roi_label, tone);
  return `
    <section class="roi-box">
      <h3 class="roi-title">${escapeHtml(t("roi.title", "Estimated ROI (Return on Investment)"))}</h3>
      <p class="roi-description">${escapeHtml(t("roi.explain", "It calculates how many times your first annual salary covers the cost of one year of education."))}</p>
      <div class="roi-context ${contextClass}">${escapeHtml(contextText)}</div>
      <div class="roi-metrics-row">
        <div class="roi-metric">
          <div class="roi-metric-label">${escapeHtml(t("roi.score", "ROI Score"))}</div>
          <div class="roi-metric-value roi-metric-value--accent ${toneClass}">${escapeHtml(formatUiNumber(roiValue, { maximumFractionDigits: 1 }))}x</div>
          <div class="roi-metric-note roi-metric-note--tone ${toneClass}">${escapeHtml(label)}</div>
        </div>
        <div class="roi-metrics-divider" aria-hidden="true"></div>
        <div class="roi-metric">
          <div class="roi-metric-label">${escapeHtml(t("roi.estimated_salary", "Est. Graduate Salary"))}</div>
          <div class="roi-metric-value">${escapeHtml(moneyUSD(salary))}</div>
          <div class="roi-metric-note">${escapeHtml(t("roi.per_year_early", "per year (early career)"))}</div>
        </div>
        <div class="roi-metrics-divider" aria-hidden="true"></div>
        <div class="roi-metric">
          <div class="roi-metric-label">${escapeHtml(translateWord("total_per_year", "Total / year"))}</div>
          <div class="roi-metric-value">${escapeHtml(moneyUSD(annualCost))}</div>
          <div class="roi-metric-note">${escapeHtml(t("roi.formula", "Simple idea: compare average graduate salary with the cost of one study year."))}</div>
        </div>
      </div>
    </section>
  `;
}

export function ruPlural(n, one, few, many) {
  const abs = Math.abs(Number(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

export function localizeDuration(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return raw;

  const lang = getCurrentLanguage();
  if (lang === "eng") return raw;

  if (lang === "rus") {
    return raw
      .replace(/\b(\d+)\s*(years?|yrs?)\b/gi, (_, n) => `${n} ${ruPlural(Number(n), "год", "года", "лет")}`)
      .replace(/\b(\d+)\s*months?\b/gi, (_, n) => `${n} ${ruPlural(Number(n), "месяц", "месяца", "месяцев")}`)
      .replace(/\b(\d+)\s*weeks?\b/gi, (_, n) => `${n} ${ruPlural(Number(n), "неделя", "недели", "недель")}`)
      .replace(/\b(\d+)\s*days?\b/gi, (_, n) => `${n} ${ruPlural(Number(n), "день", "дня", "дней")}`)
      .replace(/\b(\d+)\s*semesters?\b/gi, (_, n) => `${n} ${ruPlural(Number(n), "семестр", "семестра", "семестров")}`);
  }

  return raw;
}

export function formatUiNumber(value, options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "").trim();
  const lang = getCurrentLanguage() === "rus" ? "ru-RU" : "en-US";
  try {
    return new Intl.NumberFormat(lang, options).format(n);
  } catch (e) {
    return String(n);
  }
}

export function formatFundingOptionsCount(count) {
  const numericCount = Number(count);
  const safeCount = Number.isFinite(numericCount) ? numericCount : 0;
  const formattedCount = formatUiNumber(safeCount, { maximumFractionDigits: 0 });

  if (getCurrentLanguage() === "rus") {
    return `${formattedCount} ${ruPlural(
      safeCount,
      "вариант финансирования",
      "варианта финансирования",
      "вариантов финансирования"
    )}`;
  }

  return `${formattedCount} ${safeCount === 1 ? "funding option" : "funding options"}`;
}

export function formatAdmissionsPercent(value) {
  const n = toFiniteNumber(value);
  if (n === null) return "";
  return `${formatUiNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

export function admissionsStatusTone(status) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "official_rate" || key === "official_counts" || key === "official_signals") return "accent";
  if (key === "competition_ratio_only") return "success";
  if (key === "verified_null_only") return "muted";
  return "warn";
}

export function admissionsStatusLabel(status) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "official_rate") return t("university.admissions.status.official_rate", "Official rate");
  if (key === "official_counts") return t("university.admissions.status.official_counts", "Official counts");
  if (key === "official_signals") return t("university.admissions.status.official_signals", "Official signals");
  if (key === "competition_ratio_only") return t("university.admissions.status.competition_ratio_only", "Official competition ratio");
  if (key === "verified_null_only") return t("university.admissions.status.verified_null_only", "Not separately published");
  if (key === "no_official_source") return t("university.admissions.status.no_official_source", "No official source");
  return t("university.admissions.status.reviewed", "Officially reviewed");
}

export function rankingStatusLabel(status) {
  const key = String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return unknownFieldText("placeholder.field.global_rank", "Global Rank");
  if (key === "not_published") return t("common.na", "N/A");

  const fallback = humanizeMachineLabel(key, key);
  return t(`ranking.source_status.${key}`, fallback);
}

export function admissionsDataTypeKey(row) {
  const explicit = String(row?.data_type || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (toFiniteNumber(row?.acceptance_rate_percent) !== null) return "acceptance_rate";
  const unit = String(row?.metric_unit || "").trim().toLowerCase();
  if (unit === "places") return "capacity";
  if (unit === "points") return "cutoff";
  if (unit === "grade_profile") return "entry_standard";
  const counts = row?.counts && typeof row.counts === "object" ? row.counts : {};
  if (counts?.applicants != null && (counts?.admitted != null || counts?.offers != null)) return "counts";
  return "official_signal";
}

export function admissionsDataTypeLabel(typeKey) {
  const key = String(typeKey || "").trim().toLowerCase();
  if (key === "acceptance_rate") return t("university.admissions.metric.acceptance_rate", "Acceptance rate");
  if (key === "capacity") return t("university.admissions.metric.capacity", "Capacity");
  if (key === "entry_standard") return t("university.admissions.metric.entry_standard", "Entry standard");
  if (key === "cutoff") return t("university.admissions.metric.cutoff", "Cutoff");
  if (key === "counts") return t("university.admissions.metric.counts", "Applicants / offers");
  if (key === "competition_ratio") return t("university.admissions.metric.competition_ratio", "Competition ratio");
  if (key === "verified-null") return t("university.admissions.metric.verified_null", "Not separately published");
  return t("university.admissions.metric.official_signal", "Official signal");
}

export function admissionsRateLabel(row) {
  const status = String(row?.status || "").trim().toLowerCase();
  const counts = row?.counts && typeof row.counts === "object" ? row.counts : {};
  const hasCountBasis = toFiniteNumber(counts?.applicants) !== null
    && (toFiniteNumber(counts?.admitted) !== null || toFiniteNumber(counts?.offers) !== null);
  if (status === "official_counts" && hasCountBasis) {
    return t("university.admissions.metric.rate_from_counts", "Rate from official counts");
  }
  return t("university.admissions.metric.acceptance_rate", "Acceptance rate");
}

export function admissionsSignalSummary(row) {
  const typeKey = admissionsDataTypeKey(row);
  if (typeKey === "acceptance_rate") return t("university.admissions.signal.rate", "Official rate from published counts.");
  if (typeKey === "capacity") return t("university.admissions.signal.capacity", "Official published capacity or places.");
  if (typeKey === "entry_standard") return t("university.admissions.signal.entry_standard", "Official published grade profile or entry standard.");
  if (typeKey === "cutoff") return t("university.admissions.signal.cutoff", "Official published cutoff or direct-admit threshold.");
  if (typeKey === "counts") return t("university.admissions.signal.counts", "Official published applicants, offers, or admitted counts.");
  if (typeKey === "competition_ratio") return t("university.admissions.signal.competition_ratio", "Official published competition-ratio style signal.");
  if (typeKey === "verified-null") return t("university.admissions.signal.verified_null", "No separate official program-level metric published.");
  return t("university.admissions.signal.official", "Official published admissions signal.");
}

export function admissionsPrimarySource(entry) {
  const provenanceUrl = safeUrl(entry?.provenance?.source_url);
  if (provenanceUrl) {
    return {
      url: provenanceUrl,
      label: String(entry?.provenance?.source || "").trim() || t("university.admissions.official_source", "Official source"),
    };
  }
  const sources = Array.isArray(entry?.sources) ? entry.sources : [];
  for (const source of sources) {
    const href = safeUrl(source?.url);
    if (!href) continue;
    return {
      url: href,
      label: String(source?.label || "").trim() || t("university.admissions.official_source", "Official source"),
    };
  }
  return null;
}

export function admissionsFactChips(row) {
  const chips = [];
  const counts = row?.counts && typeof row.counts === "object" ? row.counts : {};
  const basis = row?.provenance?.basis && typeof row.provenance.basis === "object" ? row.provenance.basis : {};
  const rate = toFiniteNumber(row?.acceptance_rate_percent);
  const metricValue = toFiniteNumber(row?.metric_value);
  const metricUnit = String(row?.metric_unit || "").trim().toLowerCase();

  if (rate !== null) {
    chips.push({
      tone: "accent",
      text: `${formatAdmissionsPercent(rate)} ${admissionsRateLabel(row)}`,
    });
  }

  if (metricValue !== null) {
    if (metricUnit === "places") {
      chips.push({
        tone: "accent",
        text: `${formatUiNumber(metricValue)} ${t("university.admissions.counts.places", "places")}`,
      });
    } else if (metricUnit === "points") {
      chips.push({
        tone: "accent",
        text: `${formatUiNumber(metricValue)} ${t("university.admissions.unit.points", "points")}`,
      });
    } else {
      chips.push({
        tone: "accent",
        text: `${formatUiNumber(metricValue)} ${metricUnit || t("university.admissions.metric.official_signal", "Official signal")}`.trim(),
      });
    }
  }

  const countKeys = [
    ["applicants", t("university.admissions.counts.applicants", "Applicants")],
    ["admitted", t("university.admissions.counts.admitted", "Admitted")],
    ["offers", t("university.admissions.counts.offers", "Offers")],
    ["enrolled", t("university.admissions.counts.enrolled", "Enrolled")],
    ["places", t("university.admissions.counts.places", "Places")],
  ];
  countKeys.forEach(([key, label]) => {
    const value = toFiniteNumber(counts?.[key]);
    if (value === null) return;
    chips.push({ tone: "neutral", text: `${label} ${formatUiNumber(value)}` });
  });

  const aLevelLo = String(counts?.a_level_10th_percentile || "").trim();
  const aLevelHi = String(counts?.a_level_90th_percentile || "").trim();
  if (aLevelLo || aLevelHi) {
    const value = aLevelLo && aLevelHi
      ? (aLevelLo === aLevelHi ? aLevelLo : `${aLevelLo}-${aLevelHi}`)
      : (aLevelLo || aLevelHi);
    chips.push({ tone: "neutral", text: `${t("university.admissions.a_level", "A-Level")} ${value}` });
  }

  const polyLo = toFiniteNumber(counts?.polytechnic_gpa_10th_percentile);
  const polyHi = toFiniteNumber(counts?.polytechnic_gpa_90th_percentile);
  if (polyLo !== null || polyHi !== null) {
    const value = polyLo !== null && polyHi !== null
      ? (polyLo === polyHi
        ? formatUiNumber(polyLo, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        : `${formatUiNumber(polyLo, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}-${formatUiNumber(polyHi, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)
      : formatUiNumber(polyLo !== null ? polyLo : polyHi, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    chips.push({ tone: "neutral", text: `${t("university.admissions.poly_gpa", "Poly GPA")} ${value}` });
  }

  const cycle = String(counts?.cycle || basis?.cycle || "").trim();
  if (cycle) {
    chips.push({ tone: "neutral", text: `${t("university.admissions.cycle", "Cycle")}: ${cycle}` });
  }

  const approxRange = String(basis?.approximate_admission_range || "").trim();
  if (approxRange) {
    chips.push({ tone: "neutral", text: `${t("university.admissions.range", "Approx. range")} ${approxRange}` });
  }

  if (basis?.supplementary_application_required) {
    chips.push({ tone: "warn", text: t("university.admissions.supplementary_required", "Supplementary required") });
  }

  if (!chips.length && admissionsDataTypeKey(row) === "verified-null") {
    chips.push({ tone: "muted", text: t("university.admissions.metric.verified_null", "Not separately published") });
  }

  return chips;
}

export function renderAdmissionsChipRow(chips) {
  const items = Array.isArray(chips) ? chips.filter((chip) => chip && String(chip.text || "").trim()) : [];
  if (!items.length) return "";
  return `
    <div class="admissions-chip-row">
      ${items.map((chip) => `
        <span class="admissions-chip admissions-chip--${escapeHtml(String(chip.tone || "neutral"))}">${escapeHtml(String(chip.text || ""))}</span>
      `).join("")}
    </div>
  `;
}

export function renderAdmissionsSourceLink(entry) {
  const source = admissionsPrimarySource(entry);
  if (!source?.url) return "";
  const title = String(source.label || "").trim();
  return `
    <a
      class="admissions-source-link"
      href="${escapeHtmlAttr(source.url)}"
      target="_blank"
      rel="noopener noreferrer"
      ${title ? `title="${escapeHtmlAttr(title)}"` : ""}
    >${escapeHtml(t("university.admissions.open_source", "Open source"))}</a>
  `;
}

export function renderAdmissionsOverview(admissions) {
  const data = admissions && typeof admissions === "object" ? admissions : null;
  if (!data) return "";

  const universityWide = data?.university_wide && typeof data.university_wide === "object" ? data.university_wide : {};
  const programLevel = data?.program_level && typeof data.program_level === "object" ? data.program_level : {};
  const programRows = Array.isArray(data?.programs) ? data.programs.filter((row) => row && typeof row === "object") : [];
  const publishedProgramRows = programRows.filter((row) => admissionsDataTypeKey(row) !== "verified-null");
  const universityRate = toFiniteNumber(universityWide?.acceptance_rate_percent);
  const universityValue = universityRate !== null
    ? formatAdmissionsPercent(universityRate)
    : t("university.admissions.no_university_rate", "No official university-wide acceptance rate published.");
  const universitySub = universityRate !== null
    ? admissionsRateLabel(universityWide)
    : admissionsStatusLabel(universityWide?.status);
  const universityChecked = String(universityWide?.provenance?.verified_at || data?.status_date || "").trim();

  let programValue = "";
  let programSub = "";
  const programStatus = String(programLevel?.status || "").trim().toLowerCase();
  if (programStatus === "official_counts" || programStatus === "official_signals" || programStatus === "competition_ratio_only") {
    programValue = formatUiNumber(publishedProgramRows.length);
    programSub = tFormat("university.admissions.rows_count", { count: formatUiNumber(publishedProgramRows.length) }, `${publishedProgramRows.length} official rows`);
  } else {
    programValue = t("university.admissions.no_program_metrics", "No separate official program-level metric published.");
    programSub = admissionsStatusLabel(programLevel?.status);
  }
  const programChecked = String(data?.status_date || "").trim();

  const programNote = programStatus === "official_counts"
    ? t("university.admissions.signal.counts", "Official published applicants, offers, or admitted counts.")
    : programStatus === "official_signals"
      ? t("university.admissions.signal.entry_standard", "Official published grade profile or entry standard.")
      : programStatus === "competition_ratio_only"
        ? t("university.admissions.signal.competition_ratio", "Official published competition-ratio style signal.")
        : t("university.admissions.signal.verified_null", "No separate official program-level metric published.");

  return `
    <section class="admissions-overview">
      <div class="admissions-section-title">${escapeHtml(t("university.official_admissions_data", "Official admissions data"))}</div>
      <p class="admissions-section-note">${escapeHtml(t("university.official_admissions_note", "UniSearch shows only official published admissions metrics. If a university does not publish a rate, we keep it empty instead of guessing."))}</p>
      <div class="admissions-summary-grid">
        <article class="admissions-summary-card">
          <div class="admissions-summary-top">
            <span class="admissions-chip admissions-chip--${escapeHtml(admissionsStatusTone(universityWide?.status))}">${escapeHtml(admissionsStatusLabel(universityWide?.status))}</span>
            ${renderAdmissionsSourceLink(universityWide)}
          </div>
          <div class="admissions-summary-eyebrow">${escapeHtml(t("university.admissions.university_wide", "University-wide"))}</div>
          <div class="admissions-summary-value">${escapeHtml(universityValue)}</div>
          <div class="admissions-summary-sub">${escapeHtml(universitySub)}</div>
          ${renderAdmissionsChipRow(admissionsFactChips(universityWide).filter((chip) => !(universityRate !== null && String(chip.text || "").includes("%"))))}
          ${universityChecked ? `<div class="admissions-summary-meta">${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(universityChecked)}</div>` : ""}
        </article>
        <article class="admissions-summary-card">
          <div class="admissions-summary-top">
            <span class="admissions-chip admissions-chip--${escapeHtml(admissionsStatusTone(programLevel?.status))}">${escapeHtml(admissionsStatusLabel(programLevel?.status))}</span>
            ${renderAdmissionsSourceLink(programLevel)}
          </div>
          <div class="admissions-summary-eyebrow">${escapeHtml(t("university.admissions.program_level", "Program-level"))}</div>
          <div class="admissions-summary-value">${escapeHtml(programValue)}</div>
          <div class="admissions-summary-sub">${escapeHtml(programSub)}</div>
          <p class="admissions-summary-note">${escapeHtml(programNote)}</p>
          ${programChecked ? `<div class="admissions-summary-meta">${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(programChecked)}</div>` : ""}
        </article>
      </div>
    </section>
  `;
}

export function renderProgramAdmissionsSignals(admissions) {
  const rows = Array.isArray(admissions?.programs) ? admissions.programs.filter((row) => row && typeof row === "object") : [];
  if (!rows.length) return "";

  return `
    <section class="admissions-programs-block">
      <div class="admissions-section-title">${escapeHtml(t("university.admissions.program_signals", "Official program-level signals"))}</div>
      <p class="admissions-section-note">${escapeHtml(t("university.admissions.program_signals_note", "These rows may be rate, applicants/offers, capacity, cutoff, grade profile, or verified-null when the university does not publish a separate program metric."))}</p>
      <div class="admissions-program-grid">
        ${rows.map((row) => {
          const typeKey = admissionsDataTypeKey(row);
          const checked = String(row?.provenance?.verified_at || admissions?.status_date || "").trim();
          return `
            <article class="admissions-program-card">
              <div class="admissions-program-head">
                <span class="admissions-chip admissions-chip--${escapeHtml(typeKey === "verified-null" ? "muted" : "accent")}">${escapeHtml(admissionsDataTypeLabel(typeKey))}</span>
                ${renderAdmissionsSourceLink(row)}
              </div>
              <div class="admissions-program-title">${escapeHtml(trProgramName(row?.program_name || "") || t("placeholder.field.program_name", "Program name"))}</div>
              ${renderAdmissionsChipRow(admissionsFactChips(row))}
              <p class="admissions-program-note">${escapeHtml(admissionsSignalSummary(row))}</p>
              ${checked ? `<div class="admissions-summary-meta">${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(checked)}</div>` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function normalizeStudyModeForCost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "any") return "any";
  if (raw === "on-campus" || raw === "on campus" || raw === "campus" || raw === "in-person" || raw === "offline" || raw === "hybrid" || raw === "blended" || raw === "mixed") return "on-campus";
  if (raw === "online" || raw === "distance" || raw === "remote" || raw === "online / distance") return "online";
  return "any";
}

export function modeValueFromMap(modeMap, modeRaw) {
  if (!modeMap || typeof modeMap !== "object") return null;
  const target = normalizeStudyModeForCost(modeRaw);
  for (const [k, v] of Object.entries(modeMap)) {
    if (normalizeStudyModeForCost(k) === target) return v;
  }
  return null;
}

export function modeBreakdownFromFinance(financeData, modeRaw) {
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

export function modeTotalFromFinance(financeData, modeRaw) {
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

export function extractTuitionCostFromBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  for (const [key, val] of Object.entries(breakdown)) {
    const k = String(key || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!k.includes("tuition")) continue;
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function modeAwareAnnualCost(financeData, preferredModeRaw = "any") {
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

export function modeAwareBreakdown(financeData, preferredModeRaw = "any") {
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

export function normalizeFundingPreference(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "grant" || raw === "paid") return raw;
  return "any";
}

export function normalizeSortMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "uni_ai" || raw === "name_asc" || raw === "tuition_asc" || raw === "tuition_desc") {
    return raw;
  }
  return "name_asc";
}

export function fundingPreferenceToQueryValue(value) {
  const normalized = normalizeFundingPreference(value);
  return normalized === "any" ? "" : normalized;
}

export function uniThumbnailSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const size = String(opts.size || "").trim().toLowerCase();
  const format = String(opts.format || "jpg").trim().toLowerCase() === "webp" ? "webp" : "jpg";
  const forceFull = !!opts.forceFull || size === "full" || size === "large";
  const folder = forceFull
    ? "thumbnails"
    : size === "medium"
      ? "thumbnails-medium"
      : "thumbnails-small";
  return buildApiUrl(`universities/assets/${folder}/${safeId}.${format}`);
}

export function uniLogoSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const forceFull = !!opts.forceFull;
  const folder = forceFull ? "logos" : "logos-small";
  return buildApiUrl(`universities/assets/${folder}/${safeId}.png`);
}

// =====================================
// PAGE: UNIVERSITIES LIST
// =====================================
export function toFiniteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
