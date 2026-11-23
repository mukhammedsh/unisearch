// Currency choice next to the profile budget field. It writes the same "preferred currency" setting as the
// Settings dialog, so prices everywhere follow the choice. The select is the unit of the number in the field:
// picking a currency keeps the typed number and reads it in that currency (no conversion).

import { SETTINGS_DEFINITIONS, SETTING_PREFERRED_CURRENCY, setSettingValue } from "../../settings.js";

/**
 * Fill the budget currency select with the options of the Settings dialog (same list, groups and
 * translated names). Falls back to the plain list of the setting definition when the dialog is absent.
 * @param {HTMLSelectElement | null} select
 * @param {Document} [doc]
 * @returns {boolean} true when options were added.
 */
export function fillBudgetCurrencyOptions(select, doc = document) {
    if (!select || select.options.length) return false;
    const source = doc.getElementById("settingPreferredCurrency");
    if (source && source.children.length) {
        select.replaceChildren(...Array.from(source.children, (node) => node.cloneNode(true)));
        return true;
    }
    const definition = SETTINGS_DEFINITIONS.find((item) => item.key === SETTING_PREFERRED_CURRENCY);
    for (const { value, label } of definition?.options || []) {
        select.append(new Option(label, value));
    }
    return select.options.length > 0;
}

/**
 * Show the active budget currency in the select.
 * @param {HTMLSelectElement | null} select
 * @param {string} currency ISO currency code
 */
export function syncBudgetCurrencySelect(select, currency) {
    if (select && select.value !== currency) select.value = currency;
}

/**
 * Re-read the number typed in the budget field as an amount in the chosen currency.
 * Returns the profile unchanged when the field holds something that is not a plain whole number.
 * @param {Record<string, unknown>} profile
 * @param {string} fieldValue raw value of the budget field
 * @param {string} currency ISO currency code
 * @returns {Record<string, unknown>}
 */
export function reinterpretBudgetCurrency(profile, fieldValue, currency) {
    const typed = String(fieldValue ?? "").replace(/\s+/g, "");
    const code = String(currency || "").trim().toUpperCase();
    if (!code || !/^\d*$/.test(typed)) return profile;
    return { ...profile, budget: typed, budgetCurrency: code };
}

/**
 * Apply the visitor's choice: same setting and `currencyChanged` flow as the Settings dialog.
 * @param {HTMLSelectElement} select
 */
export function applyBudgetCurrencyChoice(select) {
    const code = String(select.value || "").trim().toUpperCase();
    if (code) setSettingValue(SETTING_PREFERRED_CURRENCY, code);
}
