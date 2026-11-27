/* frontend/javascript/pages/universities/quick-filters.js */

import { catalogCountryForCode, escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { t } from "../../i18n.js";
import { loadProfile } from "../../utils.js";
import { detectDeviceCountry } from "../../utils/locale.js";
import { trCountry } from "../_shared.js";

// Most visitors are Kazakhstani applicants; this country is offered when the device points to no catalog country.
const FALLBACK_COUNTRY = "Kazakhstan";
const FALLBACK_LEVEL = "bachelor";

/**
 * One-tap shortcut for a filter that also lives in the full filter panel.
 * @typedef {{
 *   id: string,
 *   label: () => string,
 *   isActive: (state: Record<string, any>) => boolean,
 *   controlId: string,
 *   valueWhenOn: string | boolean,
 *   valueWhenOff: string | boolean,
 * }} QuickFilter
 */

/**
 * The visitor's own country when the catalog lists universities there, else the fallback country.
 * @returns {string} a catalog country name
 */
function resolveChipCountry() {
  return catalogCountryForCode(detectDeviceCountry()) || FALLBACK_COUNTRY;
}

/**
 * The study level saved in the profile, else bachelor's. The chip only offers the level; it never applies it on its own.
 * @param {HTMLSelectElement | null} levelSelect
 * @returns {string} a catalog study-level value
 */
function resolveChipLevel(levelSelect) {
  const saved = String(loadProfile()?.studyLevel || "").trim().toLowerCase();
  const offered = new Set(Array.from(levelSelect?.options || []).map((option) => option.value).filter(Boolean));
  return saved && saved !== "any" && offered.has(saved) ? saved : FALLBACK_LEVEL;
}

/**
 * Build the chips for this visitor.
 * @returns {QuickFilter[]}
 */
function buildQuickFilters() {
  const country = resolveChipCountry();
  const levelSelect = document.getElementById("studyLevelSelect");
  const level = resolveChipLevel(levelSelect instanceof HTMLSelectElement ? levelSelect : null);
  return [
    {
      id: "country",
      label: () => trCountry(country),
      isActive: (state) => state.country === country && !state.region && !state.city,
      controlId: "countrySelect",
      valueWhenOn: country,
      valueWhenOff: "",
    },
    {
      id: "level",
      label: () => t(`universities.level.${level}`, level),
      isActive: (state) => state.study_level === level,
      controlId: "studyLevelSelect",
      valueWhenOn: level,
      valueWhenOff: "",
    },
    {
      id: "detailed-admissions",
      label: () => t("universities.filter.reviewed_only", "Detailed admission terms"),
      isActive: (state) => Boolean(state.only_reviewed),
      controlId: "reviewedOnlyToggle",
      valueWhenOn: true,
      valueWhenOff: false,
    },
  ];
}

/**
 * Change a filter through its panel control, so the panel's own change handler updates state and results.
 * @param {string} controlId
 * @param {string | boolean} value
 * @returns {boolean} whether the control exists and was changed
 */
function setPanelControl(controlId, value) {
  const control = document.getElementById(controlId);
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return false;
  if (control instanceof HTMLInputElement && control.type === "checkbox") {
    control.checked = Boolean(value);
  } else {
    control.value = String(value);
  }
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/**
 * Render quick filter chips above the catalog and keep their pressed state in sync with the filters.
 * @param {{ container: HTMLElement | null, state: Record<string, any> }} options
 * @returns {{ sync: () => void, render: () => void, dispose: () => void }}
 */
export function mountQuickFilters({ container, state }) {
  if (!container) return { sync: () => {}, render: () => {}, dispose: () => {} };
  let filters = buildQuickFilters();
  const findFilter = (button) => filters.find((item) => item.id === button.getAttribute("data-quick-filter"));

  const sync = () => {
    container.querySelectorAll("[data-quick-filter]").forEach((button) => {
      const filter = findFilter(button);
      if (filter) button.setAttribute("aria-pressed", filter.isActive(state) ? "true" : "false");
    });
  };

  const render = () => {
    container.setAttribute("aria-label", t("universities.quick_filters.aria", "Quick filters"));
    filters = buildQuickFilters();
    container.innerHTML = filters.map((filter) => `
      <button class="ui-btn ui-btn--sm ui-btn--on-bg u-quick-filter" type="button" data-quick-filter="${escapeHtmlAttr(filter.id)}" aria-pressed="false">${escapeHtml(filter.label())}</button>
    `).join("");
    container.hidden = false;
    sync();
  };

  const onClick = (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-quick-filter]") : null;
    if (!button) return;
    const filter = findFilter(button);
    if (!filter) return;
    const turnOn = !filter.isActive(state);
    if (!setPanelControl(filter.controlId, turnOn ? filter.valueWhenOn : filter.valueWhenOff)) {
      console.warn(`Quick filter control is missing: ${filter.controlId}`);
      return;
    }
    sync();
  };

  container.addEventListener("click", onClick);
  render();

  return {
    sync,
    render,
    dispose: () => container.removeEventListener("click", onClick),
  };
}
