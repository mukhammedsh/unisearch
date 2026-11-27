/* frontend/javascript/pages/universities/quick-filters.js */

import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { t } from "../../i18n.js";
import { trCountry } from "../_shared.js";

const HOME_COUNTRY = "Kazakhstan";
const BACHELOR_LEVEL = "bachelor";

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

/** @type {QuickFilter[]} */
const QUICK_FILTERS = [
  {
    id: "home-country",
    label: () => trCountry(HOME_COUNTRY),
    isActive: (state) => state.country === HOME_COUNTRY && !state.region && !state.city,
    controlId: "countrySelect",
    valueWhenOn: HOME_COUNTRY,
    valueWhenOff: "",
  },
  {
    id: "bachelor",
    label: () => t("universities.level.bachelor", "Bachelor's"),
    isActive: (state) => state.study_level === BACHELOR_LEVEL,
    controlId: "studyLevelSelect",
    valueWhenOn: BACHELOR_LEVEL,
    valueWhenOff: "",
  },
  {
    id: "reviewed",
    label: () => t("universities.filter.reviewed_only", "Only verified universities"),
    isActive: (state) => Boolean(state.only_reviewed),
    controlId: "reviewedOnlyToggle",
    valueWhenOn: true,
    valueWhenOff: false,
  },
];

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

  const sync = () => {
    container.querySelectorAll("[data-quick-filter]").forEach((button) => {
      const filter = QUICK_FILTERS.find((item) => item.id === button.getAttribute("data-quick-filter"));
      if (filter) button.setAttribute("aria-pressed", filter.isActive(state) ? "true" : "false");
    });
  };

  const render = () => {
    container.setAttribute("aria-label", t("universities.quick_filters.aria", "Quick filters"));
    container.innerHTML = QUICK_FILTERS.map((filter) => `
      <button class="ui-btn ui-btn--sm ui-btn--on-bg u-quick-filter" type="button" data-quick-filter="${escapeHtmlAttr(filter.id)}" aria-pressed="false">${escapeHtml(filter.label())}</button>
    `).join("");
    container.hidden = false;
    sync();
  };

  const onClick = (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-quick-filter]") : null;
    if (!button) return;
    const filter = QUICK_FILTERS.find((item) => item.id === button.getAttribute("data-quick-filter"));
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
