/* frontend/javascript/pages/universities/empty-state.js */

import { escapeHtml } from "../../utils.js";
import { t, tFormat } from "../../i18n.js";

/**
 * @typedef {object} CatalogFilterState
 * @property {string} [q]
 * @property {string} [country]
 * @property {string} [region]
 * @property {string} [city]
 * @property {string} [study_level]
 * @property {string} [funding_type]
 * @property {number} [min_tuition]
 * @property {number} [max_tuition]
 * @property {boolean} [only_saved]
 * @property {boolean} [only_reviewed]
 */

/**
 * @typedef {object} ActiveFilterSummary
 * @property {string[]} labels Human-readable names of the filters that can hide results.
 * @property {"none"|"max"|"min"|"range"} price Which side of the price range is restricted.
 */

/**
 * Name the catalog filters that currently narrow the list, so an empty result can say why.
 * Sorting and the saved tab are not filters here; the saved tab is handled by the caller.
 * @param {CatalogFilterState} filters
 * @param {{ min: number, max: number }} limits Price slider bounds, in the display currency.
 * @param {{
 *   currency: string,
 *   formatMoney: (amount: number, currency: string) => string,
 *   optionLabel?: (field: "country"|"region"|"city"|"study_level", value: string) => string,
 * }} deps
 * @returns {ActiveFilterSummary}
 */
export function describeActiveFilters(filters, limits, deps) {
  const labels = [];
  const optionLabel = deps.optionLabel || ((field, value) => value);
  const q = String(filters.q || "").trim();
  if (q) labels.push(tFormat("universities.empty.filter.search", { value: q }, `search “${q}”`));
  const scoped = [
    ["country", "universities.empty.filter.country", "country"],
    ["region", "universities.empty.filter.region", "state / region"],
    ["city", "universities.empty.filter.city", "city"],
    ["study_level", "universities.empty.filter.study_level", "study level"],
  ];
  for (const [field, key, fallback] of scoped) {
    const raw = String(filters[field] || "").trim();
    if (raw) labels.push(tFormat(key, { value: optionLabel(field, raw) || raw }, `${fallback}: ${optionLabel(field, raw) || raw}`));
  }
  const funding = String(filters.funding_type || "").trim();
  if (funding && funding !== "any") {
    const fundingLabel = t(`profile.option.funding_${funding}`, funding);
    labels.push(tFormat("universities.empty.filter.funding", { value: fundingLabel }, `funding in your profile: ${fundingLabel}`));
  }
  if (filters.only_reviewed) {
    labels.push(t("universities.filter.reviewed_only", "Detailed admissions data"));
  }

  const min = Number(filters.min_tuition);
  const max = Number(filters.max_tuition);
  const minActive = Number.isFinite(min) && min > limits.min;
  const maxActive = Number.isFinite(max) && max < limits.max;
  const money = (value) => deps.formatMoney(value, deps.currency);
  let price = "none";
  if (minActive && maxActive) {
    price = "range";
    labels.push(tFormat("universities.empty.filter.price_range", { min: money(min), max: money(max) }, `price from ${money(min)} to ${money(max)}`));
  } else if (maxActive) {
    price = "max";
    labels.push(tFormat("universities.empty.filter.price_max", { amount: money(max) }, `price up to ${money(max)}`));
  } else if (minActive) {
    price = "min";
    labels.push(tFormat("universities.empty.filter.price_min", { amount: money(min) }, `price from ${money(min)}`));
  }
  return { labels, price };
}

/**
 * Build the empty-state card: why nothing is shown, which filters hide results, and the way out.
 * @param {{ onlySaved: boolean, summary: ActiveFilterSummary }} input
 * @returns {{ text: string, filtersText: string, actions: Array<{ action: string, label: string }> }}
 */
export function buildEmptyStateModel({ onlySaved, summary }) {
  const hasFilters = summary.labels.length > 0;
  let text = t("universities.state.empty", "No universities found.");
  if (onlySaved) {
    text = hasFilters
      ? t("universities.state.empty_saved", "No favorite universities match these filters.")
      : t("universities.state.empty_saved_none", "You have not saved any universities yet. Save one from its card and it will appear here.");
  }
  const actions = [];
  if (hasFilters) {
    actions.push({ action: "reset-filters", label: t("universities.empty.reset_filters", "Reset filters") });
  }
  if (summary.price === "max" || summary.price === "range") {
    actions.push({ action: "clear-price-filter", label: t("universities.empty.show_above_budget", "Show universities above my budget") });
  } else if (summary.price === "min") {
    actions.push({ action: "clear-price-filter", label: t("universities.empty.clear_price", "Remove the price filter") });
  }
  const filtersText = hasFilters
    ? tFormat("universities.empty.filters_intro", { filters: summary.labels.join(" · ") }, `Hidden by your filters: ${summary.labels.join(" · ")}`)
    : "";
  return { text, filtersText, actions };
}

/**
 * Render the empty-state card markup.
 * @param {ReturnType<typeof buildEmptyStateModel>} model
 * @param {{ keepSaved?: boolean }} [options]
 * @returns {string}
 */
export function renderEmptyStateCard(model, options = {}) {
  const buttons = model.actions
    .map((item) => `<button type="button" class="u-state-card__action" data-action="${escapeHtml(item.action)}"${options.keepSaved ? " data-keep-saved" : ""}>${escapeHtml(item.label)}</button>`)
    .join("");
  return `
    <div class="u-state-card u-state-card--empty" role="status">
        <div class="u-state-card__title">${escapeHtml(t("universities.state.empty_title", "No results for current filters"))}</div>
        <div class="u-state-card__text">${escapeHtml(model.text)}</div>
        ${model.filtersText ? `<div class="u-state-card__text u-state-card__filters" data-empty-filters>${escapeHtml(model.filtersText)}</div>` : ""}
        ${buttons ? `<div class="u-state-card__actions">${buttons}</div>` : ""}
    </div>
  `.trim();
}
