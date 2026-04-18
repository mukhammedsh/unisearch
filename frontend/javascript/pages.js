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
} from "./utils.js";

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
} from "./university-detail-helpers.js";

import { setupTabs, renderNoConnection } from "./components.js";
import { heroIcon, stripLeadingDecorations } from "./icons.js";
import { getCurrentLanguage, t, tFormat } from "./i18n.js";
import { extractUniversityIdFromLocation, routeUniversities, routeUniversityDetail } from "./routes.js";
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
} from "./university-translations.js";
import { bindInfoTooltips } from "./tooltip.js";
export { initRankingPage } from "./pages/ranking.js";
export { initGuidePage } from "./pages/guide.js";

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

function buildApiUrl(path) {
  const base = String(API_BASE || "").trim().replace(/\/+$/, "");
  const suffix = String(path || "").replace(/^\/+/, "");
  return `${base}/${suffix}`;
}

function formatCampusSizeValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const translated = translateDataValue("campus_size", raw, raw);
  if (getCurrentLanguage() === "eng") return humanizeMachineLabel(translated, raw);
  return translated;
}

function cleanDecoratedText(text) {
  const raw = String(text || "").trim();
  const stripped = stripLeadingDecorations(raw);
  return stripped || raw;
}

function renderInlineIcon(name, size = 14, extraClass = "") {
  const classes = ["ui-icon", `ui-icon--${size}`];
  if (extraClass) classes.push(extraClass);
  return heroIcon(name, classes.join(" "));
}

function renderUniPill(iconName, toneClass, text) {
  const safeText = escapeHtml(cleanDecoratedText(text));
  return `<span class="uni-pill ${toneClass}" title="${safeText}">${renderInlineIcon(iconName, 14, "uni-pill-icon")}<span class="uni-pill-text">${safeText}</span></span>`;
}

function renderScholarshipLine(iconName, toneClass, text) {
  return `<div class="scholarship-line ${toneClass}">${renderInlineIcon(iconName, 16, "scholarship-line-icon")}<span>${escapeHtml(cleanDecoratedText(text))}</span></div>`;
}

function renderLocationMarkup({
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

let rankingBadgeResizeBound = false;
let rankingBadgeResizeRaf = 0;
let rankingFetchController = null;

function fitRankingBadgeText(container) {
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

function ensureRankingBadgeResizeHandler() {
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

function unknownFieldText(fieldKey, fallbackField) {
  return translateUnknownWord(fieldKey, fallbackField);
}

function unknownLabelText(fieldLabel, fallbackField = "") {
  return translateUnknownField(fieldLabel, fallbackField);
}

function textOrUnknown(value, fieldKey, fallbackField) {
  const text = String(value ?? "").trim();
  return text || unknownFieldText(fieldKey, fallbackField);
}

function moneyOrUnknown(value, fieldKey, fallbackField) {
  return Number.isFinite(Number(value))
    ? moneyUSD(value)
    : unknownFieldText(fieldKey, fallbackField);
}

function normalizeTranslationKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function translateCostBreakdownLabel(rawKey) {
  const key = normalizeTranslationKey(rawKey);
  const fallback = String(rawKey || "")
    .replace(/_/g, " ")
    .trim();
  if (!key) return fallback;
  return translateWord(`cost_item_${key}`, fallback);
}

function costBreakdownCoverageNote(financeData, breakdownEntries, total) {
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

function trackCefrLabel(id) {
  const n = Number(id);
  if (n === 1) return "A1";
  if (n === 2) return "A2";
  if (n === 3) return "B1";
  if (n === 4) return "B2";
  if (n === 5) return "C1";
  if (n === 6) return "C2";
  return String(id ?? "");
}

function renderTrackLanguageExamGroup(track, variant = "requirements") {
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

function localizeRoiLabel(rawLabel, tone = "") {
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

function renderRoiBox(roi) {
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

function ruPlural(n, one, few, many) {
  const abs = Math.abs(Number(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function localizeDuration(rawValue) {
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

function formatUiNumber(value, options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "").trim();
  const lang = getCurrentLanguage() === "rus" ? "ru-RU" : "en-US";
  try {
    return new Intl.NumberFormat(lang, options).format(n);
  } catch (e) {
    return String(n);
  }
}

function formatFundingOptionsCount(count) {
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

function formatAdmissionsPercent(value) {
  const n = toFiniteNumber(value);
  if (n === null) return "";
  return `${formatUiNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

function admissionsStatusTone(status) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "official_rate" || key === "official_counts" || key === "official_signals") return "accent";
  if (key === "competition_ratio_only") return "success";
  if (key === "verified_null_only") return "muted";
  return "warn";
}

function admissionsStatusLabel(status) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "official_rate") return t("university.admissions.status.official_rate", "Official rate");
  if (key === "official_counts") return t("university.admissions.status.official_counts", "Official counts");
  if (key === "official_signals") return t("university.admissions.status.official_signals", "Official signals");
  if (key === "competition_ratio_only") return t("university.admissions.status.competition_ratio_only", "Official competition ratio");
  if (key === "verified_null_only") return t("university.admissions.status.verified_null_only", "Not separately published");
  if (key === "no_official_source") return t("university.admissions.status.no_official_source", "No official source");
  return t("university.admissions.status.reviewed", "Officially reviewed");
}

function rankingStatusLabel(status) {
  const key = String(status || "").trim().toLowerCase();
  if (!key) return unknownFieldText("placeholder.field.global_rank", "Global Rank");

  const fallback = humanizeMachineLabel(key, key);
  return t(`ranking.source_status.${key}`, fallback);
}

function admissionsDataTypeKey(row) {
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

function admissionsDataTypeLabel(typeKey) {
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

function admissionsRateLabel(row) {
  const status = String(row?.status || "").trim().toLowerCase();
  const counts = row?.counts && typeof row.counts === "object" ? row.counts : {};
  const hasCountBasis = toFiniteNumber(counts?.applicants) !== null
    && (toFiniteNumber(counts?.admitted) !== null || toFiniteNumber(counts?.offers) !== null);
  if (status === "official_counts" && hasCountBasis) {
    return t("university.admissions.metric.rate_from_counts", "Rate from official counts");
  }
  return t("university.admissions.metric.acceptance_rate", "Acceptance rate");
}

function admissionsSignalSummary(row) {
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

function admissionsPrimarySource(entry) {
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

function admissionsFactChips(row) {
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

function renderAdmissionsChipRow(chips) {
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

function renderAdmissionsSourceLink(entry) {
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

function renderAdmissionsOverview(admissions) {
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

function renderProgramAdmissionsSignals(admissions) {
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
  return "name_asc";
}

function fundingPreferenceToQueryValue(value) {
  const normalized = normalizeFundingPreference(value);
  return normalized === "any" ? "" : normalized;
}

function uniThumbnailSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const forceFull = !!opts.forceFull;
  const folder = forceFull ? "thumbnails" : "thumbnails-small";
  return buildApiUrl(`universities/assets/${folder}/${safeId}.jpg`);
}

function uniLogoSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const forceFull = !!opts.forceFull;
  const folder = forceFull ? "logos" : "logos-small";
  return buildApiUrl(`universities/assets/${folder}/${safeId}.png`);
}

const DETAIL_CACHE_KEY = "unisearch_detail_cache_v3";
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_MAX_ITEMS = 24;
const UNIVERSITIES_TOUR_SEEN_KEY = "unisearch_universities_tour_seen_v1";
const SAVED_UNIVERSITIES_KEY = "unisearch_saved_university_ids_v1";
const COMPARE_UNIVERSITIES_KEY = "unisearch_compare_university_ids_v1";
const RECENT_UNIVERSITIES_KEY = "unisearch_recent_university_ids_v1";
const MAX_COMPARE_UNIVERSITIES = 8;
const MAX_RECENT_UNIVERSITIES = 12;
let __detailProfileUpdatedHandler = null;
let __detailLanguageChangedHandler = null;
let __detailFinanceResizeHandler = null;
let __detailFinanceResizeObserver = null;
let __universitiesProfileUpdatedHandler = null;
let __universitiesLanguageChangedHandler = null;
let __universitiesMapCardActionHandler = null;
let __rankingLanguageChangedHandler = null;
let __guideExternalUpdateHandler = null;
let __guideHashChangeHandler = null;

function bindGuideExternalUpdates(handler) {
  if (__guideExternalUpdateHandler) {
    window.removeEventListener("languageChanged", __guideExternalUpdateHandler);
    window.removeEventListener("examConfigLoaded", __guideExternalUpdateHandler);
    window.removeEventListener("languageConfigLoaded", __guideExternalUpdateHandler);
  }
  __guideExternalUpdateHandler = handler;
  window.addEventListener("languageChanged", __guideExternalUpdateHandler);
  window.addEventListener("examConfigLoaded", __guideExternalUpdateHandler);
  window.addEventListener("languageConfigLoaded", __guideExternalUpdateHandler);
}

function bindGuideHashChange(handler) {
  if (__guideHashChangeHandler) {
    window.removeEventListener("hashchange", __guideHashChangeHandler);
  }
  __guideHashChangeHandler = handler;
  window.addEventListener("hashchange", __guideHashChangeHandler);
}

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

function readIdListStorage(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed)
      ? parsed.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
  } catch (e) {
    return [];
  }
}

function writeIdListStorage(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)))));
  } catch (e) {
    // ignore storage errors
  }
}

function rememberRecentUniversity(id) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return;
  const next = [cleanId, ...readIdListStorage(RECENT_UNIVERSITIES_KEY).filter((value) => value !== cleanId)]
    .slice(0, MAX_RECENT_UNIVERSITIES);
  writeIdListStorage(RECENT_UNIVERSITIES_KEY, next);
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

function getDetailCacheEntry(universityId, lang = getCurrentLanguage()) {
  const key = String(universityId || "").trim();
  const normalizedLang = String(lang || "eng").trim().toLowerCase() || "eng";
  if (!key) return null;
  const cacheKey = `${key}::${normalizedLang}`;
  const cache = readDetailCache();
  const entry = cache[cacheKey];
  if (!entry || typeof entry !== "object" || !entry.data || typeof entry.data !== "object") {
    return null;
  }
  return {
    key: cacheKey,
    data: entry.data,
    etag: String(entry.etag || ""),
    ts: Number(entry.ts) || 0,
  };
}

function setDetailCacheEntry(universityId, data, etag = "", lang = getCurrentLanguage()) {
  const key = String(universityId || "").trim();
  const normalizedLang = String(lang || "eng").trim().toLowerCase() || "eng";
  if (!key || !data || typeof data !== "object") return;
  const cacheKey = `${key}::${normalizedLang}`;

  const cache = readDetailCache();
  cache[cacheKey] = {
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

function touchDetailCacheEntry(universityId, lang = getCurrentLanguage()) {
  const key = String(universityId || "").trim();
  const normalizedLang = String(lang || "eng").trim().toLowerCase() || "eng";
  if (!key) return;
  const cacheKey = `${key}::${normalizedLang}`;
  const cache = readDetailCache();
  if (!cache[cacheKey] || typeof cache[cacheKey] !== "object") return;
  cache[cacheKey].ts = Date.now();
  writeDetailCache(cache);
}

async function fetchUniversityDetailCached(universityId) {
  const key = String(universityId || "").trim();
  const lang = String(getCurrentLanguage() || "eng").trim().toLowerCase() || "eng";
  if (!key) throw new Error("University ID is required");

  const cached = getDetailCacheEntry(key, lang);
  const age = cached ? (Date.now() - cached.ts) : Number.POSITIVE_INFINITY;

  if (cached && age < DETAIL_CACHE_TTL_MS) {
    return cached.data;
  }

  const headers = {};
  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  try {
    const qs = new URLSearchParams({ lang }).toString();
    const res = await fetch(`${API_BASE}/universities/${encodeURIComponent(key)}?${qs}`, { headers });

    if (res.status === 304 && cached?.data) {
      touchDetailCacheEntry(key, lang);
      return cached.data;
    }
    if (!res.ok) throw new Error("Backend error");

    const data = await res.json();
    const etag = res.headers.get("ETag") || "";
    setDetailCacheEntry(key, data, etag, lang);
    return data;
  } catch (err) {
    if (cached?.data) return cached.data;
    throw err;
  }
}

// =====================================
// PAGE: UNIVERSITIES LIST
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
        sortAiTagsHint: $("sortAiTagsHint"),
        focusSlider: $("focusSlider"), focusLabel: $("focusLabel"),
        atmosphereSlider: $("atmosphereSlider"), atmosphereLabel: $("atmosphereLabel"),
        financeSlider: $("financeSlider"), financeLabel: $("financeLabel"),
        locationSlider: $("locationSlider"), locationLabel: $("locationLabel"),
        resetBtn: $("resetFiltersBtn"),
        content: document.querySelector(".u-content"),
        list: $("universitiesList"), mapStage: $("mapStage"), mapResults: $("mapResultsPanel"), mapContainer: $("mapContainer"), total: $("totalCount"),
        skeleton: $("universitiesSkeleton"), state: $("listState"), pagination: $("pagination"),
        btnList: $("viewListBtn"), btnMap: $("viewMapBtn"),
        mobileFilterSummary: $("mobileFilterSummary"),
        mobileFilterCount: $("mobileFilterCount"),
        mobileFilterToggle: $("mobileFilterToggle"),
        mobileFilterClose: $("closeMobileFilters"),
        savedOnlyToggle: $("savedOnlyToggle"),
        savedShortlistBar: $("savedShortlistBar"),
        recentlyViewedBar: $("recentlyViewedBar"),
        compareTray: $("compareTray")
    };
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

    bindInfoTooltips({ wrapSelector: ".u-info-wrap", buttonSelector: ".u-info" });

    const applyAISortOptionLabel = () => {
        if (!el.sortSelect) return;
        const aiOpt = el.sortSelect.querySelector('option[value="uni_ai"]');
        if (aiOpt) aiOpt.textContent = cleanDecoratedText(
            tFormat("universities.sort_ai", { fit: aiName("fit") }, `${aiName("fit")}: ${t("common.ai_short", "AI")} Smart Sort`)
        );
    };
    applyAISortOptionLabel();

    const savedState = loadFilters();
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
        viewMode: savedState.viewMode || "list", page: 1, limit: 24,
    };
    if (state.min_tuition > (MAX_TUITION - MIN_RANGE_GAP)) state.min_tuition = MAX_TUITION - MIN_RANGE_GAP;
    state.max_tuition = Math.min(MAX_TUITION, state.max_tuition);
    if (state.max_tuition < state.min_tuition + MIN_RANGE_GAP) {
        state.max_tuition = state.min_tuition + MIN_RANGE_GAP;
    }
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
    let compareUniversityIds = new Set(readIdListStorage(COMPARE_UNIVERSITIES_KEY).slice(0, MAX_COMPARE_UNIVERSITIES));

    const optionTextForValue = (selectEl, value) => {
        if (!selectEl) return "";
        const opt = Array.from(selectEl.options || []).find((item) => String(item.value || "") === String(value || ""));
        return String(opt?.text || "").trim();
    };

    const activeFilterCount = () => {
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
    };

    const mobileFilterChips = () => {
        const chips = [];
        if (state.q) chips.push(state.q);
        if (state.country) chips.push(trCountry(state.country));
        if (state.region) chips.push(trState(state.region));
        if (state.city) chips.push(trCity(state.city));
        if (Number(state.min_tuition) > 0 || Number(state.max_tuition) < MAX_TUITION) {
            chips.push(`${moneyUSD(Number(state.min_tuition) || 0)}-${moneyUSD(Number(state.max_tuition) || MAX_TUITION)}`);
        }
        if (state.sort && state.sort !== "name_asc") chips.push(optionTextForValue(el.sortSelect, state.sort) || state.sort);
        if (state.only_saved) chips.push(t("universities.filter.saved_only", "Favorites only"));
        return chips.length ? chips : [t("universities.filter.none_active", "No active filters")];
    };

    const updateMobileFilterUi = () => {
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
    };

    const renderCompareTray = () => {
        if (!el.compareTray) return;
        const ids = Array.from(compareUniversityIds);
        if (!ids.length) {
            el.compareTray.hidden = true;
            el.compareTray.innerHTML = "";
            return;
        }
        const names = ids
            .map((id) => lastRenderedItems.find((item) => String(item?.id || "") === id))
            .map((item, idx) => item ? trUniversityName(item) : ids[idx])
            .filter(Boolean);
        el.compareTray.hidden = false;
        const canCompare = ids.length >= 2;
        const helperText = canCompare
            ? tFormat("universities.compare.selected", { count: String(ids.length) }, `${ids.length} selected for comparison`)
            : t("universities.compare.need_more", "Select one more university to compare");
        const visibleNames = names.slice(0, 3).join(", ");
        const hiddenNamesCount = Math.max(0, names.length - 3);
        const namesText = visibleNames
            ? `: ${visibleNames}${hiddenNamesCount ? ` +${hiddenNamesCount}` : ""}`
            : "";
        el.compareTray.innerHTML = `
            <div class="compare-tray__text">${escapeHtml(helperText)}${escapeHtml(namesText)}</div>
            <div class="compare-tray__actions">
                <button class="compare-tray__btn" type="button" data-action="clear-compare">${escapeHtml(t("universities.compare.clear", "Clear"))}</button>
                <button class="compare-tray__btn compare-tray__btn--primary" type="button" data-action="open-compare"${canCompare ? "" : " disabled"}>${escapeHtml(t("universities.compare.open", "Compare"))}</button>
            </div>
        `;
        replayMotion(el.compareTray, "motion-panel-enter", { timeoutMs: 420 });
        replayMotion(el.compareTray.querySelector(".compare-tray__text"), "motion-state-pulse", { timeoutMs: 520 });
    };

    const getRenderedUniversityById = (id) => {
        const cleanId = String(id || "").trim();
        return lastRenderedItems.find((item) => String(item?.id || "") === cleanId) || null;
    };

    const renderSavedShortlistBar = () => {
        if (!el.savedShortlistBar) return;
        const ids = Array.from(savedUniversityIds);
        if (!ids.length) {
            el.savedShortlistBar.hidden = true;
            el.savedShortlistBar.innerHTML = "";
            return;
        }
        const rows = ids.slice(0, 8).map((id) => {
            const item = getRenderedUniversityById(id);
            const label = item ? trUniversityName(item) : id.replace(/-/g, " ");
            return { id, label };
        });
        el.savedShortlistBar.hidden = false;
        el.savedShortlistBar.innerHTML = `
            <span class="u-shortlist__label">${escapeHtml(t("universities.shortlist.title", "Shortlist"))}</span>
            <div class="u-shortlist__items">
                ${rows.map((row) => `
                    <span class="u-shortlist__chip">
                        <a class="u-shortlist__chip-text" href="${routeUniversityDetail(row.id)}">${escapeHtml(row.label)}</a>
                        <button class="u-shortlist__remove" type="button" data-action="remove-saved" data-uni-id="${escapeHtmlAttr(row.id)}" aria-label="${escapeHtmlAttr(t("universities.shortlist.remove", "Remove from shortlist"))}">${renderInlineIcon("x-mark", 14, "u-shortlist__remove-icon")}</button>
                    </span>
                `).join("")}
            </div>
        `;
        replayMotion(el.savedShortlistBar, "motion-panel-enter", { timeoutMs: 420 });
        markMotionEnter(el.savedShortlistBar, ".u-shortlist__chip", { limit: 8, staggerMs: 18 });
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
        document.querySelectorAll(".uni-card[data-uni-id]").forEach((card) => {
            const rowId = String(card.getAttribute("data-uni-id") || "").trim();
            const saved = savedUniversityIds.has(rowId);
            const compared = compareUniversityIds.has(rowId);
            const saveBtn = card.querySelector("[data-card-action='save']");
            const compareBtn = card.querySelector("[data-card-action='compare']");
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
            const shouldCompensateShift = !!options.compensateLayoutShift && !wasSaved && savedUniversityIds.size === 0;
            if (wasSaved) savedUniversityIds.delete(uniId);
            else savedUniversityIds.add(uniId);
            syncCardActionState();
            replayMotion(actionBtn.querySelector(".uni-action-icon") || actionBtn, "motion-pop", { timeoutMs: 420 });
            replayMotion(card, "motion-state-pulse", { timeoutMs: 520 });
            persistSavedAndCompare();
            if (state.only_saved && wasSaved) {
                refetch();
            } else if (shouldCompensateShift) {
                compensateCardAnchorShift(card, beforeTop);
            }
            return true;
        }

        if (action === "compare") {
            if (compareUniversityIds.has(uniId)) compareUniversityIds.delete(uniId);
            else {
                if (compareUniversityIds.size >= MAX_COMPARE_UNIVERSITIES) {
                    const [first] = compareUniversityIds;
                    if (first) compareUniversityIds.delete(first);
                }
                compareUniversityIds.add(uniId);
            }
            syncCardActionState();
            replayMotion(actionBtn, "motion-state-pulse--compare", { timeoutMs: 520 });
            persistSavedAndCompare();
            return true;
        }

        return false;
    };

    const ensureCompareModal = () => {
        let modal = document.getElementById("compareModal");
        if (modal) return modal;
        modal = document.createElement("div");
        modal.id = "compareModal";
        modal.className = "compare-modal";
        modal.innerHTML = `
            <div class="compare-modal__backdrop" data-action="close-compare-modal"></div>
            <div class="compare-modal__card" role="dialog" aria-modal="true" aria-labelledby="compareModalTitle">
                <div class="compare-modal__head">
                    <h2 class="compare-modal__title" id="compareModalTitle">${escapeHtml(t("universities.compare.title", "Compare universities"))}</h2>
                    <button class="compare-modal__close" type="button" data-action="close-compare-modal" aria-label="${escapeHtmlAttr(t("common.close", "Close"))}">${renderInlineIcon("x-mark", 18, "compare-modal__close-icon")}</button>
                </div>
                <div class="compare-modal__body"></div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener("click", (event) => {
            const action = event.target instanceof Element ? event.target.closest("[data-action]")?.getAttribute("data-action") : "";
            if (action === "close-compare-modal") {
                modal.classList.remove("is-open");
                document.body.style.overflow = "";
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !modal.classList.contains("is-open")) return;
            modal.classList.remove("is-open");
            document.body.style.overflow = "";
        });
        return modal;
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
        if (merit && need) return t("universities.compare.aid_both", "Merit + need-based");
        if (merit) return t("universities.compare.aid_merit", "Merit aid");
        if (need) return t("universities.compare.aid_need", "Need-based aid");
        return t("common.na", "N/A");
    };

    const compareProgramSummary = (u) => {
        const programs = Array.isArray(u?.academics?.programs) ? u.academics.programs : [];
        if (!programs.length) return t("common.na", "N/A");
        const names = programs
            .map((program) => translateProgramName(String(u?.id || ""), String(program?.name || "").trim()))
            .filter(Boolean);
        const visible = names.slice(0, 2).join(", ");
        const more = names.length > 2 ? ` +${names.length - 2}` : "";
        return visible ? `${visible}${more}` : t("common.na", "N/A");
    };

    const compareLanguageSummary = (u) => {
        const programs = Array.isArray(u?.academics?.programs) ? u.academics.programs : [];
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
        const programs = Array.isArray(u?.academics?.programs) ? u.academics.programs : [];
        const modes = Array.from(new Set(programs.map((program) => String(program?.study_mode || "").trim()).filter(Boolean)));
        return modes.length ? modes.map((item) => translateDataValue("study_mode", item, item)).join(", ") : t("common.na", "N/A");
    };

    const compareFirstTrack = (u) => {
        const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
        return tracks[0] || null;
    };

    const compareTrackCountText = (u) => {
        const tracks = Array.isArray(u?.admission_tracks) ? u.admission_tracks : [];
        const options = tracks.reduce((sum, track) => sum + (Array.isArray(track?.funding_options) ? Math.max(track.funding_options.length, 1) : 1), 0);
        if (!tracks.length) return t("common.na", "N/A");
        return tFormat("universities.compare.track_count", { count: String(tracks.length), options: String(options) }, `${tracks.length} tracks / ${options} options`);
    };

    const compareTrackLabel = (u) => {
        const track = compareFirstTrack(u);
        if (!track) return t("common.na", "N/A");
        return translateTrackLabel(String(u?.id || ""), String(track?.id || track?.label || ""), String(track?.label || ""));
    };

    const compareRequirementsText = (u) => {
        const track = compareFirstTrack(u);
        const option = Array.isArray(track?.funding_options) ? track.funding_options[0] : null;
        const req = (option?.requirements && typeof option.requirements === "object")
            ? option.requirements
            : ((track?.requirements && typeof track.requirements === "object") ? track.requirements : {});
        const rows = Object.entries(req || {})
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([key, value]) => `${getExamDisplayName(key)} ${value}`);
        return rows.length ? rows.slice(0, 3).join(", ") : t("common.na", "N/A");
    };

    const compareAverageScoreText = (u) => {
        const track = compareFirstTrack(u);
        const stats = (track?.stats_avg && typeof track.stats_avg === "object") ? track.stats_avg : {};
        const rows = Object.entries(stats)
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([key, value]) => `${getExamDisplayName(key)} ${value}`);
        return rows.length ? rows.slice(0, 3).join(", ") : t("common.na", "N/A");
    };

    const compareLanguageProofText = (u) => {
        const track = compareFirstTrack(u);
        const requirements = Array.isArray(track?.language_requirements) ? track.language_requirements : [];
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
        const track = compareFirstTrack(u);
        const extras = Array.isArray(track?.extra_requirements) ? track.extra_requirements.filter(Boolean) : [];
        if (!extras.length) return t("common.na", "N/A");
        const visible = extras.slice(0, 2).join("; ");
        const more = extras.length > 2 ? ` +${extras.length - 2}` : "";
        return `${visible}${more}`;
    };

    const compareCostBreakdownText = (u, mode) => {
        const breakdown = (u?.finance?.costs_breakdown_year_usd && typeof u.finance.costs_breakdown_year_usd === "object")
            ? u.finance.costs_breakdown_year_usd
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

    const compareBestBadges = (u, metrics) => {
        const badges = [];
        const id = String(u?.id || "");
        if (id && metrics.bestRankId === id) badges.push(t("universities.compare.badge.best_rank", "Best rank"));
        if (id && metrics.lowestCostId === id) badges.push(t("universities.compare.badge.lowest_cost", "Lowest cost"));
        if (id && metrics.highestAcceptanceId === id) badges.push(t("universities.compare.badge.more_accessible", "More accessible"));
        if (nested(u, ["finance", "financial_aid", "merit_based"], false) || nested(u, ["finance", "financial_aid", "need_based"], false)) {
            badges.push(t("universities.compare.badge.aid", "Aid"));
        }
        return badges.slice(0, 3);
    };

    const compareMetrics = (universities) => {
        const byMin = (items, getter) => items
            .map((u) => ({ id: String(u?.id || ""), value: getter(u) }))
            .filter((row) => row.id && row.value !== null && Number.isFinite(row.value))
            .sort((a, b) => a.value - b.value)[0]?.id || "";
        const byMax = (items, getter) => items
            .map((u) => ({ id: String(u?.id || ""), value: getter(u) }))
            .filter((row) => row.id && row.value !== null && Number.isFinite(row.value))
            .sort((a, b) => b.value - a.value)[0]?.id || "";
        return {
            bestRankId: byMin(universities, (u) => {
                const rank = toFiniteNumber(u?.rank);
                return rank !== null && rank > 0 ? rank : null;
            }),
            lowestCostId: byMin(universities, (u) => toFiniteNumber(u?.finance?.total_cost_year_usd)),
            highestAcceptanceId: byMax(universities, (u) => toFiniteNumber(u?.academics?.acceptance_rate_percent)),
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

    const openCompareModal = async () => {
        const ids = Array.from(compareUniversityIds);
        if (ids.length < 2) return;
        const modal = ensureCompareModal();
        const body = modal.querySelector(".compare-modal__body");
        if (!body) return;
        body.innerHTML = `
            <div class="compare-loading" role="status">
                <div class="skeleton-line" style="width: 44%; height: 18px;"></div>
                <div class="skeleton-line" style="width: 82%; height: 96px;"></div>
                <div class="skeleton-line" style="width: 76%; height: 96px;"></div>
            </div>
        `;
        modal.classList.add("is-open");
        document.body.style.overflow = "hidden";
        window.setTimeout(() => modal.querySelector(".compare-modal__close")?.focus(), 0);

        const fallbackById = new Map(ids.map((id) => [id, getRenderedUniversityById(id) || { id, name: id.replace(/-/g, " ") }]));
        const universities = (await Promise.all(ids.map(async (id) => {
            try {
                const detail = await fetchUniversityDetailCached(id);
                return detail || fallbackById.get(id);
            } catch (e) {
                return fallbackById.get(id);
            }
        }))).filter(Boolean);

        if (!modal.classList.contains("is-open") || universities.length < 2) return;
        const metrics = compareMetrics(universities);
        const cardHtml = universities.map((u) => {
            const id = String(u?.id || "");
            const logoSrc = uniLogoSrc(id);
            const logoSrcFull = uniLogoSrc(id, { forceFull: true });
            const badges = compareBestBadges(u, metrics);
            return `
                <article class="compare-uni-card" data-uni-id="${escapeHtmlAttr(id)}">
                    <div class="compare-uni-card__head">
                        <div class="compare-uni-card__logo">
                            <img src="${logoSrc}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(compareUniversityName(u)))}">
                        </div>
                        <button class="compare-uni-card__remove" type="button" data-action="remove-compare" data-uni-id="${escapeHtmlAttr(id)}" aria-label="${escapeHtmlAttr(t("universities.compare.remove", "Remove from comparison"))}">${renderInlineIcon("x-mark", 16, "compare-remove-icon")}</button>
                    </div>
                    <h3>${escapeHtml(compareUniversityName(u))}</h3>
                    <p>${escapeHtml(compareLocationText(u))}</p>
                    <div class="compare-uni-card__metrics">
                        <span><small>${escapeHtml(translateWord("global_rank", "Rank"))}</small><strong>${escapeHtml(compareRankText(u))}</strong></span>
                        <span><small>${escapeHtml(t("universities.card.cost_short", "Cost"))}</small><strong>${escapeHtml(formatCompareCost(u?.finance?.total_cost_year_usd))}</strong></span>
                        <span><small>${escapeHtml(t("ranking.acceptance", "Acceptance"))}</small><strong>${escapeHtml(compareAcceptanceText(u))}</strong></span>
                    </div>
                    ${badges.length ? `<div class="compare-uni-card__badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
                    <a class="compare-uni-card__link" href="${routeUniversityDetail(id)}">${escapeHtml(t("universities.card.view_details", "View details"))}</a>
                </article>
            `;
        }).join("");

        const rowsHtml = [
            compareSectionRow(t("universities.compare.section.overview", "Overview"), "overview", universities),
            compareDataRow(t("universities.compare.row.location", "Location"), universities, compareLocationText),
            compareDataRow(translateWord("global_rank", "Global Rank"), universities, (u) => ({
                text: compareRankText(u),
                tone: metrics.bestRankId === String(u?.id || "") ? "best" : "",
                sub: compareSourceText(u, "rank"),
            })),
            compareDataRow(t("universities.compare.row.student_count", "Students"), universities, compareStudentCountText),
            compareDataRow(t("universities.compare.row.website", "Website"), universities, (u) => safeUrl(u?.website) ? t("universities.compare.available", "Available") : t("common.na", "N/A")),
            compareSectionRow(t("universities.compare.section.programs", "Programs"), "programs", universities),
            compareDataRow(t("universities.compare.row.programs", "Programs shown"), universities, compareProgramSummary),
            compareDataRow(t("universities.compare.row.study_mode", "Study mode"), universities, compareStudyModeText),
            compareDataRow(t("universities.compare.row.language", "Program language"), universities, compareLanguageSummary),
            compareSectionRow(t("universities.compare.section.admissions", "Admissions"), "admissions", universities),
            compareDataRow(t("ranking.acceptance", "Acceptance Rate"), universities, (u) => ({
                text: compareAcceptanceText(u),
                tone: metrics.highestAcceptanceId === String(u?.id || "") ? "best" : "",
                sub: compareSourceText(u, "acceptance_rate_percent"),
            })),
            compareDataRow(t("universities.compare.row.tracks", "Admission tracks"), universities, compareTrackCountText),
            compareDataRow(t("universities.compare.row.main_track", "Main track"), universities, compareTrackLabel),
            compareDataRow(t("universities.compare.row.requirements", "Minimum requirements"), universities, compareRequirementsText),
            compareDataRow(t("universities.compare.row.avg_scores", "Admitted score context"), universities, compareAverageScoreText),
            compareDataRow(t("universities.compare.row.language_proof", "Language proof"), universities, compareLanguageProofText),
            compareDataRow(t("universities.compare.row.extra_requirements", "Extra requirements"), universities, compareExtraRequirementsText),
            compareSectionRow(t("universities.compare.section.finance", "Finance"), "finance", universities),
            compareDataRow(t("universities.compare.row.total_cost", "Total / year"), universities, (u) => ({
                text: formatCompareCost(u?.finance?.total_cost_year_usd),
                tone: metrics.lowestCostId === String(u?.id || "") ? "best" : "",
                sub: compareSourceText(u, "tuition_total_cost_year_usd"),
            })),
            compareDataRow(t("universities.compare.row.tuition_fees", "Tuition + fees"), universities, (u) => compareCostBreakdownText(u, "tuition")),
            compareDataRow(t("universities.compare.row.living_costs", "Living cost items"), universities, (u) => compareCostBreakdownText(u, "living")),
            compareDataRow(t("universities.compare.row.aid", "Aid"), universities, compareAidText),
            compareSectionRow(t("universities.compare.section.context", "Context"), "context", universities),
            compareDataRow(t("universities.compare.row.salary", "Early career salary"), universities, compareOutcomeText),
            compareDataRow(t("universities.compare.row.data_quality", "Verified data"), universities, compareDataConfidenceText),
        ].join("");

        body.innerHTML = `
            <div class="compare-modal__intro">
                <p>${escapeHtml(t("universities.compare.intro", "Use this view to compare practical decision signals side by side. Highlighted cells mark the strongest value among selected universities."))}</p>
            </div>
            <div class="compare-uni-grid">${cardHtml}</div>
            <div class="compare-table-wrap" style="--compare-columns:${universities.length}; --compare-min-width:${170 + (universities.length * 180)}px;">
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
        `;
        body.querySelectorAll("[data-action='remove-compare']").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = String(btn.getAttribute("data-uni-id") || "").trim();
                if (!id) return;
                compareUniversityIds.delete(id);
                persistSavedAndCompare();
                syncCardActionState();
                if (compareUniversityIds.size < 2) {
                    modal.classList.remove("is-open");
                    document.body.style.overflow = "";
                    return;
                }
                openCompareModal().catch((err) => console.error(err));
            });
        });
    };

    const renderRecentlyViewedBar = () => {
        if (!el.recentlyViewedBar) return;
        const recentIds = readIdListStorage(RECENT_UNIVERSITIES_KEY).filter((id) => !compareUniversityIds.has(id)).slice(0, 6);
        if (!recentIds.length) {
            el.recentlyViewedBar.hidden = true;
            el.recentlyViewedBar.innerHTML = "";
            return;
        }
        const rows = recentIds.map((id) => {
            const item = getRenderedUniversityById(id);
            const label = item ? trUniversityName(item) : id.replace(/-/g, " ");
            return { id, label };
        });
        el.recentlyViewedBar.hidden = false;
        el.recentlyViewedBar.innerHTML = `
            <span class="u-recent__label">${escapeHtml(t("universities.recent.title", "Recently viewed"))}</span>
            <div class="u-recent__items">
                ${rows.map((row) => `<a class="u-recent__chip" href="${routeUniversityDetail(row.id)}">${escapeHtml(row.label)}</a>`).join("")}
            </div>
        `;
    };

    const persistSavedAndCompare = () => {
        writeIdListStorage(SAVED_UNIVERSITIES_KEY, Array.from(savedUniversityIds));
        writeIdListStorage(COMPARE_UNIVERSITIES_KEY, Array.from(compareUniversityIds));
        renderCompareTray();
        renderSavedShortlistBar();
        renderRecentlyViewedBar();
        syncCardActionState();
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
        const q = String(el.qInput.value || "").trim().toLowerCase();
        if (q.length < 2 || !lastRenderedItems.length) {
            hideSearchSuggestions();
            return;
        }
        const seen = new Set();
        const suggestions = [];
        lastRenderedItems.forEach((item) => {
            const rows = [
                { type: t("universities.suggestions.university", "University"), value: trUniversityName(item) },
                { type: t("universities.suggestions.city", "City"), value: trCity(item?.location?.city || "") },
                { type: t("universities.suggestions.country", "Country"), value: trCountry(item?.location?.country || "") },
            ];
            rows.forEach((row) => {
                const value = String(row.value || "").trim();
                const key = value.toLowerCase();
                if (!value || seen.has(key) || !key.includes(q)) return;
                seen.add(key);
                suggestions.push(row);
            });
        });
        if (!suggestions.length) {
            hideSearchSuggestions();
            return;
        }
        node.innerHTML = suggestions.slice(0, 6).map((row) => `
            <button type="button" class="u-search-suggestion" data-value="${escapeHtmlAttr(row.value)}" role="option">
                <span>${escapeHtml(row.value)}</span>
                <small>${escapeHtml(row.type)}</small>
            </button>
        `).join("");
        node.classList.add("is-open");
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

    function setUniversitiesLoading(isLoading) {
        const mapMode = state.viewMode === "map";
        const showListSkeleton = !!isLoading && !mapMode;
        if (el.content) {
            el.content.setAttribute("aria-busy", isLoading ? "true" : "false");
        }
        if (el.skeleton) {
            if (showListSkeleton) {
                if (!el.skeleton.innerHTML.trim()) {
                    const skeletonCount = Math.min(Math.max(8, Math.ceil(window.innerWidth / 320) * 2), state.limit);
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
        if (el.mapResults && isLoading && mapMode) {
            el.mapResults.innerHTML = `
                <div class="inline-loading-note inline-loading-note--compact" role="status" aria-live="polite">
                    ${escapeHtml(t("universities.loading", "Loading universities"))}
                </div>
            `;
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

    // --- РљР°СЂС‚Р° ---
    let mapInstance = null;
    let markersLayer = null;
    let markersByUniId = new Map();
    let activeMapUniId = String(focusUniId || "").trim();

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

    async function handleSortChange(nextSort, sourceEl = null) {
        const prevSort = state.sort;
        if (el.sortSelect) el.sortSelect.value = nextSort;

        if (nextSort === "uni_ai" && prevSort !== "uni_ai") {
            const profile = loadProfile();
            if (!hasProfileEvidence(profile)) {
                if (el.sortSelect) {
                    el.sortSelect.value = prevSort;
                    initCustomSelect("sortSelect");
                }
                if (sourceEl) sourceEl.value = prevSort;
                const confirmed = await showUniFitWarning();
                if (!confirmed) {
                    updateMobileFilterUi();
                    return;
                }
                if (el.sortSelect) {
                    el.sortSelect.value = "uni_ai";
                    initCustomSelect("sortSelect");
                }
                if (sourceEl) sourceEl.value = "uni_ai";
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

    el.savedOnlyToggle?.addEventListener("change", () => {
        state.only_saved = !!el.savedOnlyToggle.checked;
        refetch();
    });

    el.sortSelect?.addEventListener("change", () => {
        handleSortChange(el.sortSelect.value, null);
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
            rememberRecentUniversity(card?.getAttribute("data-uni-id"));
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
        rememberRecentUniversity(card.getAttribute("data-uni-id"));
        window.location.href = routeUniversityDetail(card.getAttribute("data-uni-id"));
    });

    __universitiesMapCardActionHandler = (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const actionBtn = target?.closest(".map-card-wrapper [data-card-action]");
        if (!actionBtn) return;
        e.preventDefault();
        e.stopPropagation();
        handleCardAction(actionBtn, { compensateLayoutShift: false });
    };
    document.addEventListener("click", __universitiesMapCardActionHandler, true);

    el.compareTray?.addEventListener("click", (e) => {
        const action = e.target instanceof Element ? e.target.closest("[data-action]")?.getAttribute("data-action") : "";
        const actionButton = e.target instanceof Element ? e.target.closest("[data-action]") : null;
        if (actionButton) motionPress(actionButton);
        if (action === "clear-compare") {
            compareUniversityIds.clear();
            persistSavedAndCompare();
            syncCardActionState();
        }
        if (action === "open-compare") {
            openCompareModal().catch((err) => console.error(err));
        }
    });

    el.savedShortlistBar?.addEventListener("click", (e) => {
        const removeBtn = e.target instanceof Element ? e.target.closest("[data-action='remove-saved']") : null;
        if (!removeBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const uniId = String(removeBtn.getAttribute("data-uni-id") || "").trim();
        if (!uniId) return;
        motionPress(removeBtn);
        const chip = removeBtn.closest(".u-shortlist__chip");
        animateElementOut(chip, () => {
            savedUniversityIds.delete(uniId);
            writeIdListStorage(SAVED_UNIVERSITIES_KEY, Array.from(savedUniversityIds));
            el.list?.querySelectorAll("[data-card-action='save']").forEach((btn) => {
                const rowId = String(btn.closest("[data-uni-id]")?.getAttribute("data-uni-id") || "");
                const active = savedUniversityIds.has(rowId);
                btn.classList.toggle("is-active", active);
                btn.setAttribute("aria-pressed", active ? "true" : "false");
            });
            renderSavedShortlistBar();
            syncCardActionState();
            if (state.only_saved) refetch();
        });
    });

    el.btnList?.addEventListener("click", () => {
        motionPress(el.btnList);
        switchView("list", true);
    });
    el.btnMap?.addEventListener("click", () => {
        motionPress(el.btnMap);
        switchView("map", true);
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

    fetchAndRender();
    __universitiesProfileUpdatedHandler = () => {
        state.funding_type = getProfileFundingQueryValue();
        state.page = 1;
        saveFilters(state);
        fetchAndRender();
    };
    window.addEventListener("profileUpdated", __universitiesProfileUpdatedHandler);
    __universitiesLanguageChangedHandler = () => {
        applyAISortOptionLabel();
        refreshLocationFilterLabels();
        applyToForm();
        updateTradeoffLabels();
        fetchAndRender();
    };
    window.addEventListener("languageChanged", __universitiesLanguageChangedHandler);

    function switchView(mode, shouldFetch = false) {
        state.viewMode = mode;
        saveFilters(state);
        if (mode === "map") {
            el.list.style.display = "none";
            el.pagination.style.display = "none";
            if (el.mapStage) el.mapStage.style.display = "grid";
            el.btnList.classList.remove("active");
            el.btnMap.classList.add("active");
            replayMotion(el.mapStage, "motion-panel-enter", { timeoutMs: 420 });
            replayMotion(el.btnMap, "motion-state-pulse", { timeoutMs: 520 });
            initMap();
            setTimeout(() => { if(mapInstance) mapInstance.invalidateSize(); }, 100);
            if (shouldFetch) fetchAndRender(); 
        } else {
            el.list.style.display = "grid";
            el.pagination.style.display = "flex";
            if (el.mapStage) el.mapStage.style.display = "none";
            el.btnList.classList.add("active");
            el.btnMap.classList.remove("active");
            replayMotion(el.list, "motion-panel-enter", { timeoutMs: 420 });
            replayMotion(el.btnList, "motion-state-pulse", { timeoutMs: 520 });
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
                return L.divIcon({
                    html: clusterMarkerLogoHtml(logoUrl, count - 1),
                    className: "cluster-icon-container",
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                });
            }
        });
        markersLayer.on('clusterclick', function (a) { mapInstance.flyToBounds(a.layer.getBounds(), { padding: [80, 80], duration: 1.0 }); });
        mapInstance.addLayer(markersLayer);
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
        const subheading = escapeHtml(t("universities.map_panel.subtitle", "Pick a university to center the map and open its details."));

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
            : (visibleItems.some((u) => String(u.id || "") === focusUniId) ? String(focusUniId || "") : String(visibleItems[0]?.id || ""));
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
                    return `
                        <article class="u-map-result-card${isActive ? " is-active" : ""}" data-uni-id="${escapeHtml(uniId)}">
                            <button type="button" class="u-map-result-focus" data-uni-focus="${escapeHtml(uniId)}">
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
                focusMapUniversity(button.getAttribute("data-uni-focus"), {
                    openPopup: true,
                    fly: true,
                    zoom: 14,
                });
            });
        });
    }

    function updateMapMarkers(items) {
        if (!mapInstance || !markersLayer) return;
        markersLayer.clearLayers();
        markersByUniId = new Map();
        const profile = loadProfile(); const userBudget = parseFloat(profile.budget);
        renderMapResultsPanel(items);
        const isCompactViewport = window.matchMedia("(max-width: 768px)").matches;
        const mapViewportHeight = Number(el.mapContainer?.clientHeight || 0);
        const popupMaxHeight = Math.max(220, mapViewportHeight - (isCompactViewport ? 28 : 40));
        const popupOptions = {
            minWidth: isCompactViewport ? 220 : 280,
            maxWidth: isCompactViewport ? 280 : 320,
            maxHeight: popupMaxHeight,
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
                    html: mapMarkerLogoHtml(uniLogoSrc(uniId)),
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
            const fallbackId = activeMapUniId || String(items?.[0]?.id || "");
            if (fallbackId) updateMapResultsSelection(fallbackId);
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
        
        if (forApi && state.only_saved) {
            p.set("limit", "2000"); p.set("page", "1");
        } else if (forApi && state.viewMode === "map") {
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
        if (el.savedOnlyToggle) el.savedOnlyToggle.checked = !!state.only_saved;
        
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
        let html = `<option value="">&#x1F30D; ${escapeHtml(t("universities.global", "Global"))}</option>`;
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
        if (sp.has("only_saved")) state.only_saved = ["1", "true", "yes", "on"].includes(String(sp.get("only_saved") || "").trim().toLowerCase());
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
                renderSavedShortlistBar();
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
            renderSavedShortlistBar();
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
            renderSavedShortlistBar();
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
        if (state.viewMode === "map") resetMapResults();
        if (el.pagination) el.pagination.innerHTML = "";

        const urlParams = buildParams(false);
        const apiParams = buildParams(true);
        setUrlParams(urlParams);

        try {
        if (state.only_saved && savedUniversityIds.size === 0) {
            renderFetchedData({ items: [], total: 0 });
            return;
        }
        const isAiSort = (state.sort === "uni_ai");
        if (isAiSort) {
            const canUseFallback = state.viewMode === "list" && !hasInitialListPaint && state.page === 1;
            if (!canUseFallback) {
                try {
                    const aiData = await fetchUniversitiesAiSort(buildAiSortPayload());
                    if (aiData?.__aborted) return;
                    if (runSeq !== fetchRunSeq) return;
                    renderFetchedData(aiData);
                } catch (err) {
                    if (err?.name === "AbortError") return;
                    console.warn("AI sort failed, fallback list is used.", err);
                    const fallbackData = await fetchUniversities(buildFallbackListParams(apiParams));
                    if (fallbackData?.__aborted) return;
                    if (runSeq !== fetchRunSeq) return;
                    renderFetchedData(fallbackData);
                }
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

            const lateAiData = await aiPromise;
            if (!lateAiData || lateAiData.__aborted) return;
            if (runSeq !== fetchRunSeq) return;
            if (state.sort !== "uni_ai") return;
            renderFetchedData(lateAiData);
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

    // --- RENDER CARD (Р‘Р•Р— ROI) ---
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

        // Р‘Р°Р·РѕРІР°СЏ С†РµРЅР° (С‚СЂРµРєРѕРІР°СЏ, РµСЃР»Рё algo РµС‘ РґР°Р»)
        const baseCost =
        (match.costYearUSD !== undefined ? match.costYearUSD : null) ??
        (match.cost !== undefined ? match.cost : null) ??
        nested(u, ["finance", "total_cost_year_usd"], 0);

        // РС‚РѕРіРѕРІР°СЏ С†РµРЅР° СЃ СѓС‡С‘С‚РѕРј scholarship amount (РµСЃР»Рё РµСЃС‚СЊ)
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
        const thumbSrcFull = uniThumbnailSrc(id, { forceFull: true });
        const loadingAttr = idx < 4 ? "eager" : "lazy";
        const fetchPriorityAttr = idx < 2 ? "high" : "auto";
        const detailHref = routeUniversityDetail(id);
        const safeName = escapeHtml(name);
        const safeWhyText = escapeHtml(whyText || "");
        const overlayTitle = whyText ? `${name}. ${whyText}` : String(name || "");
        const rankValue = toFiniteNumber(u?.rank);
        const rankLabel = escapeHtml(translateWord("global_rank", "Global Rank"));
        const detailLabel = escapeHtml(t("universities.card.view_details", "View details"));
        const costText = moneyOrUnknown(cost, "placeholder.field.cost", "Cost");
        const isSaved = savedUniversityIds.has(String(id));
        const isCompared = compareUniversityIds.has(String(id));
        const metricsHtml = `
            <div class="uni-metrics" aria-label="${escapeHtml(t("universities.card.metrics", "Key metrics"))}">
                <div class="uni-metric${rankValue !== null && rankValue > 0 ? "" : " uni-metric--missing"}">
                    <span class="uni-metric-label">${rankLabel}</span>
                    <span class="uni-metric-value">${rankValue !== null && rankValue > 0 ? `#${escapeHtml(String(rankValue))}` : escapeHtml(t("common.na", "N/A"))}</span>
                </div>
                <div class="uni-metric">
                    <span class="uni-metric-label">${escapeHtml(t("universities.card.cost_short", "Cost"))}</span>
                    <span class="uni-metric-value">${escapeHtml(costText)}</span>
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
        return `
        <article class="uni-card" data-uni-id="${escapeHtmlAttr(id)}">
            <div class="uni-media">
            <img class="uni-media-img" src="${thumbSrc}" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(thumbSrcFull)}" data-final-src="${escapeHtmlAttr(logoSrcFull)}">
            <div class="uni-card-actions">
                <button class="uni-action-btn uni-action-btn--favorite${isSaved ? " is-active" : ""}" type="button" data-card-action="save" aria-pressed="${isSaved ? "true" : "false"}" title="${escapeHtmlAttr(saveLabel)}" aria-label="${escapeHtmlAttr(saveLabel)}">${renderInlineIcon("star", 16, "uni-action-icon")}</button>
                <button class="uni-action-btn uni-action-btn--compare${isCompared ? " is-active" : ""}" type="button" data-card-action="compare" aria-pressed="${isCompared ? "true" : "false"}" title="${escapeHtmlAttr(compareLabel)}" aria-label="${escapeHtmlAttr(compareLabel)}">${renderInlineIcon(isCompared ? "check-circle" : "adjustments-horizontal", 16, "uni-action-icon")}</button>
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
            <a class="uni-card-link-overlay" href="${detailHref}" aria-label="${safeName}" title="${escapeHtml(overlayTitle)}"></a>
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

// =====================================
// PAGE: RANKING
// =====================================
function toFiniteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

