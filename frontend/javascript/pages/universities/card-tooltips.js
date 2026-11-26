/* frontend/javascript/pages/universities/card-tooltips.js */

import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { heroIcon } from "../../icons.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { convert } from "../../currency.js";
import { translateFactSource } from "../../university-translations.js";
import {
  moneyOrUnknown,
  originalPriceDisclosure,
  splitPriceDisplay,
  toFiniteNumber,
  resolveUniversityCardPrice,
} from "../_shared.js";
import { billingPeriodLabel } from "../university/admissions-presentation.js";

const FEE_STATUS_KEY_MAP = {
  "home fee": "home",
  home: "home",
  "overseas fee": "overseas",
  overseas: "overseas",
  resident: "resident",
  "non-resident": "non_resident",
  "company payer": "company_payer",
  "individual payer": "individual_payer",
  "full tuition": "full_tuition",
  "self-paying candidate": "self_paying",
};

/**
 * Translate a raw catalog fee status label into the active UI language.
 * @param {string} status
 * @returns {string}
 */
function formatCatalogFeeStatus(status) {
  const raw = String(status || "").trim();
  if (!raw) return "";
  const key = FEE_STATUS_KEY_MAP[raw.toLowerCase()];
  return key ? t(`universities.cost.fee_status.${key}`, raw) : raw;
}

/**
 * Check whether a fee status list contains both UK-style Home and Overseas tiers.
 * @param {string[]} feeStatuses
 * @returns {boolean}
 */
function hasHomeOverseasFeeScope(feeStatuses) {
  return ["home", "overseas"].every((kind) =>
    feeStatuses.some((status) => new RegExp(`\\b${kind}\\b`, "i").test(String(status || ""))),
  );
}

/**
 * Summarize covered study levels, collapsing broad 4+ level lists to "All levels".
 * @param {string[]} levels
 * @returns {string}
 */
function formatCatalogLevels(levels) {
  const unique = [...new Set(levels.filter(Boolean))];
  if (!unique.length) return "";
  if (unique.length >= 4) return t("universities.cost.all_levels", "All levels");
  return unique.map((level) => t(`university.admissions.catalog.level.${level}`)).join(", ");
}

/**
 * Short visible label saying which study levels the card price covers. The selected catalog
 * level filter wins; otherwise a price spanning several levels names them ("All levels").
 * The level is never guessed from the applicant profile.
 * @param {string[]} levels
 * @param {string} [studyLevelFilter=""]
 * @returns {string}
 */
export function costScopeLabel(levels, studyLevelFilter = "") {
  const filter = String(studyLevelFilter || "").trim();
  if (filter) return t(`universities.level.${filter}`, "");
  const unique = [...new Set((levels || []).filter(Boolean))];
  return unique.length >= 2 ? formatCatalogLevels(unique) : "";
}

/**
 * Resolve the card price summary for a university on the requested cost basis.
 * @param {object} university
 * @param {string} [basis="annual_total"]
 * @returns {object}
 */
export function universityCardPriceInfo(university, basis = "annual_total") {
  const quote = university?.catalog_costs?.[basis];
  const minimum = toFiniteNumber(quote?.min);
  const maximum = toFiniteNumber(quote?.max);
  const currency = String(quote?.currency || "").trim().toUpperCase();
  if (minimum !== null && maximum !== null && minimum >= 0 && maximum >= minimum && currency) {
    return {
      ...quote,
      amount: minimum,
      currency,
      amountUSD: convert(minimum, currency, "USD"),
      min: minimum,
      max: maximum,
      basis,
    };
  }
  if (basis === "tuition" || university?.admissions_catalog?.availability === "reviewed") {
    return { amount: null, currency: "", amountUSD: null };
  }
  return resolveUniversityCardPrice(university);
}

/**
 * Render the compact price readout and toggletip for a university catalog or map card.
 * @param {object} university
 * @param {string} [basis="annual_total"]
 * @param {string} [scope="catalog"]
 * @param {{ priceFilterActive?: boolean, studyLevel?: string }} [options={}]
 * @returns {string}
 */
export function renderUniversityCardCosts(university, basis = "annual_total", scope = "catalog", options = {}) {
  let price = universityCardPriceInfo(university, basis);
  if (basis === "annual_total" && price.amount === null && university?.admissions_catalog?.availability === "reviewed") {
    const tuition = universityCardPriceInfo(university, "tuition");
    if (tuition.amount !== null) price = tuition;
  }
  const known = price.amount !== null && Number.isFinite(price.amount);
  const range = known && price.max > price.min;
  const reference = known && (university?.catalog_costs?.reference || price.cycle_status === "dated_reference"
    || price.calculation === "tuition_plus_living_range");
  const money = (value) => splitPriceDisplay(moneyOrUnknown(value, "placeholder.field.cost", "Cost", price.currency, {
    presentation: "summary",
    locale: { eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" }[getCurrentLanguage()] || "en-US",
  }));
  const minimum = known ? money(range ? price.min : price.amount) : { primary: t("universities.cost.price_unavailable"), secondary: "" };
  const maximum = range ? money(price.max) : minimum;
  const primary = range ? `${minimum.primary} – ${maximum.primary.replace(/^≈ /, "")}` : minimum.primary;
  const secondary = minimum.secondary
    ? range ? `(${minimum.secondary.slice(1, -1)} – ${maximum.secondary.slice(1, -1)})` : minimum.secondary
    : "";
  const priceBasis = price.basis || basis;
  const title = t(`universities.cost.${priceBasis}`);
  const showsTuitionReference = basis === "annual_total" && priceBasis === "tuition";
  const entry = String(price.period || "").match(/^(20\d{2}) entry$/);
  const period = entry
    ? tFormat("universities.cost.entry", { year: entry[1] })
    : price.period === "Whole program"
      ? billingPeriodLabel("whole_program")
      : price.period === "Year not stated"
        ? t("universities.cost.cycle_unspecified")
        : price.period;
  const levels = Array.isArray(price.levels) ? price.levels : price.study_level ? [price.study_level] : [];
  const feeStatuses = Array.isArray(price.fee_statuses) ? price.fee_statuses : [];
  const cycleStatus = price.cycle_status === "dated_reference"
    ? t(university?.catalog_costs?.reference ? "universities.cost.cycle_unconfirmed" : "universities.cost.dated_reference")
    : price.cycle_status === "unspecified" && !period
      ? t("universities.cost.cycle_unspecified")
      : "";
  const feeStatusUnknown = price.fee_status_match === "unknown" && feeStatuses.length <= 1
    ? t("universities.cost.fee_status_unknown")
    : "";
  const context = [
    formatCatalogLevels(levels),
    period,
    feeStatuses.map(formatCatalogFeeStatus).filter(Boolean).join(", "),
    (price.campuses || []).join(", "),
    cycleStatus,
    feeStatusUnknown,
    price.filter_match === "partial" ? t("universities.cost.filter_partial") : "",
  ].filter(Boolean).join(" · ");
  const tooltipText = price.calculation === "tuition_plus_living_range"
    ? t("universities.cost.tooltip_living_range")
    : range ? t("universities.cost.tooltip_range") : t("universities.cost.tooltip_single");
  const showFilterText = Boolean(options?.priceFilterActive) || price.filter_match === "partial";
  const filterText = showFilterText
    ? (Array.isArray(price.amounts) || Array.isArray(price.intervals)
      ? t("universities.cost.tooltip_filter_variants")
      : t("universities.cost.tooltip_filter_reference"))
    : "";
  const livingYear = String(price.living_reference || "").match(/\b20\d{2}\b/)?.[0];
  const exclusions = priceBasis === "annual_total" ? university?.catalog_costs?.annual_total?.exclusions || [] : [];
  const note = [
    showsTuitionReference ? t("universities.cost.full_budget_unavailable") : "",
    priceBasis === "tuition" ? t("universities.cost.tuition_scope_note") : "",
    livingYear ? tFormat("universities.cost.tooltip_living_year", { year: livingYear }) : "",
    hasHomeOverseasFeeScope(feeStatuses) ? t("universities.cost.fee_scope") : "",
    ...exclusions.map((key) => t(`universities.cost.exclusion.${key}`)),
  ].filter(Boolean).join(" · ");
  const assessment = university?.matchData?.budgetAssessment;
  const budgetKey = { within_budget: "within", over_budget: "over", uncertain_range: "uncertain" }[assessment?.status];
  const budgetNote = budgetKey
    ? [
        t(budgetKey === "uncertain"
          ? "universities.cost.budget_uncertain_range"
          : `universities.cost.budget_${budgetKey}_${assessment.evidence === "applicable" ? "applicable" : "reference"}`),
        assessment.basis === "tuition" ? t("universities.cost.budget_tuition_only") : "",
      ].filter(Boolean).join(" · ")
    : "";
  if (!known) {
    const fallbackLabel = showsTuitionReference
      ? t("universities.cost.full_budget_unavailable")
      : t("universities.cost.unavailable");
    return `<div class="uni-price uni-price--unknown"><span class="uni-price-val">${escapeHtml(fallbackLabel)}</span>${budgetNote ? `<span class="uni-cost-context" data-budget-assessment>${escapeHtml(budgetNote)}</span>` : ""}</div>`;
  }
  const tooltipId = `uni-cost-tooltip-${scope}-${university?.id || "university"}-${priceBasis}`;
  const billingPeriod = billingPeriodLabel(price.billing_period || "academic_year");
  const originalPriceNote = originalPriceDisclosure(range ? price.min : price.amount, range ? price.max : price.amount, price.currency);
  const priceLabel = [showsTuitionReference ? title : "", primary, billingPeriod].filter(Boolean).join(" ");
  // Qualifiers of the price (what it covers, the second currency) form one quiet line below it,
  // so every card shows its price on the same first line.
  const scopeLabel = costScopeLabel(levels, options?.studyLevel);
  const metaLabel = [showsTuitionReference ? title : "", scopeLabel].filter(Boolean).join(" · ");
  const metaHtml = metaLabel || secondary
    ? `<span class="uni-cost-meta">${metaLabel ? `<span class="uni-cost-meta__label">${escapeHtml(metaLabel)}</span>` : ""}${secondary ? `<span class="uni-cost-secondary">${escapeHtml(secondary)}</span>` : ""}</span>`
    : "";
  return `<span class="ui-tooltip-wrap uni-cost-tooltip">
        <button type="button" class="ui-tooltip-trigger uni-cost-trigger uni-price" data-cost-basis="${escapeHtmlAttr(priceBasis)}" aria-label="${escapeHtmlAttr(`${t("universities.cost.tooltip_open")}: ${priceLabel}`)}" aria-expanded="false">
            <span class="uni-price-line"><span class="uni-price-val">${escapeHtml(primary)}</span>&nbsp;<span class="uni-price-tail"><span class="uni-price-period">${escapeHtml(billingPeriod)}</span>${heroIcon("information-circle", "uni-cost-tooltip__icon", { "stroke-width": 2 })}</span></span>
        </button>
        <span id="${escapeHtmlAttr(tooltipId)}" class="ui-tooltip-bubble uni-cost-tooltip__content" role="tooltip">
            <strong class="ui-tooltip-title">${escapeHtml(title)}${reference ? ` · ${escapeHtml(t("universities.cost.reference_short"))}` : ""}</strong>
            ${context ? `<span class="uni-cost-context" data-cost-context>${escapeHtml(context)}</span>` : ""}
            ${originalPriceNote ? `<span class="ui-tooltip-text" data-cost-original>${escapeHtml(originalPriceNote)}</span>` : ""}
            <span class="ui-tooltip-text">${escapeHtml(tooltipText)}</span>
            ${filterText ? `<span class="ui-tooltip-text ui-tooltip-text--subtle">${escapeHtml(filterText)}</span>` : ""}
            ${note ? `<span class="ui-tooltip-text ui-tooltip-text--subtle">${escapeHtml(note)}</span>` : ""}
            ${budgetNote ? `<span class="uni-cost-context" data-budget-assessment>${escapeHtml(budgetNote)}</span>` : ""}
        </span>
    </span>${metaHtml}`;
}

/**
 * Build the provenance text for a university card's global rank tooltip.
 * @param {object} university
 * @returns {string}
 */
export function buildRankSourceTooltip(university) {
  const rankValue = toFiniteNumber(university?.rank);
  const rankMeta = (university && typeof university.rank_meta === "object" && university.rank_meta) ? university.rank_meta : {};
  const rankSourceValue = String(rankMeta.source || "").trim();
  const rankSource = rankSourceValue ? translateFactSource(rankSourceValue, rankSourceValue) : "";
  if (!rankSource) return "";
  const rankVerifiedAt = String(rankMeta.verified_at || "").trim()
    || t("university.admissions.check_date_unrecorded", "Check date not recorded");
  const hasPublishedRank = rankValue !== null && rankValue > 0;
  return hasPublishedRank
    ? tFormat("ranking.source_tooltip", { source: rankSource, verified_at: rankVerifiedAt }, `${rankSource} · Checked: ${rankVerifiedAt}`)
    : tFormat("ranking.source_tooltip_unranked", { source: rankSource, verified_at: rankVerifiedAt }, `No position in ${rankSource} · Checked: ${rankVerifiedAt}`);
}
