import { applyTheme, bindDialogLightDismiss, closeMotionLayer, getThemePreference, initCustomSelect, replayMotion } from "../utils.js";
import { formatRatesTimestamp, getRatesMetadata } from "../currency.js";
import { getCurrentLanguage, tFormat } from "../i18n.js";
import { isUniversitiesListPath, navigateToAppRoute, routeUniversities } from "../routes.js";
import { requestUniversitiesTourOpen } from "../pages/shared/cache.js";
import {
  SETTING_STORE_RECENT_UNIVERSITIES,
  SETTING_PREFERRED_CURRENCY,
  SETTING_CURRENCY_DISPLAY,
  getSettingValue,
  readSettingsArray,
  setSettingValue,
  shouldStoreRecentUniversities,
  writeSettingsArray,
} from "../settings.js";

let settingsInited = false;

export function initSettingsUI() {
  if (settingsInited) return;
  settingsInited = true;

  const modal = document.getElementById("settingsModal");
  const openBtn = document.getElementById("settingsBtn");
  const closeBtn = document.getElementById("settingsCloseBtn");
  const launchTourBtn = document.getElementById("settingsLaunchTourBtn");
  const card = modal?.querySelector(".settings-card");
  const settingInputs = Array.from(modal?.querySelectorAll("[data-setting-input]") || []);
  const themeInputs = Array.from(modal?.querySelectorAll("[data-theme-input]") || []);
  if (!modal || !openBtn || (!settingInputs.length && !themeInputs.length)) return;

  let previouslyFocused = null;

  const syncSettingsInputs = () => {
    settingInputs.forEach((input) => {
      const key = String(input.getAttribute("data-setting-input") || "").trim();
      if (input.tagName === "SELECT") {
        const val = getSettingValue(key);
        if (val !== undefined && val !== null) {
          input.value = String(val);
        }
        if (input.id) {
          initCustomSelect(input.id);
        }
      } else {
        input.checked = key === SETTING_STORE_RECENT_UNIVERSITIES
          ? shouldStoreRecentUniversities()
          : getSettingValue(key) === true;
      }
    });
  };

  const syncRatesAttribution = () => {
    const statusEl = modal.querySelector?.("#currencyRatesStatus") || document.getElementById("currencyRatesStatus");
    if (!statusEl) return;
    const { date, source } = getRatesMetadata();
    const formattedDate = formatRatesTimestamp(date, getCurrentLanguage());
    if (!formattedDate) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.removeAttribute?.("data-rates-status");
      return;
    }
    const isFallback = source === "fallback";
    statusEl.textContent = isFallback
      ? tFormat("currency.rates_offline", { date: formattedDate }, "Offline rates from {date}")
      : tFormat("currency.rates_updated", { date: formattedDate }, "Updated: {date}");
    statusEl.hidden = false;
    statusEl.setAttribute("data-rates-status", isFallback ? "fallback" : "live");
  };

  const openSettings = () => {
    syncSettingsInputs();
    syncThemeInputs();
    syncRatesAttribution();
    modal.classList.remove("is-closing");
    modal.classList.add("is-open");
    if (typeof modal.showModal === "function") {
      if (!modal.open) modal.showModal();
    } else {
      previouslyFocused = document.activeElement;
    }
    closeBtn?.focus({ preventScroll: true });
  };

  const closeSettings = () => {
    if (modal.classList.contains("is-closing") || (!modal.classList.contains("is-open") && !modal.open)) return;
    const finish = () => {
      modal.classList.remove("is-open", "is-closing");
      if (typeof modal.close === "function") {
        if (modal.open) modal.close();
      } else {
        const focusTarget = previouslyFocused?.isConnected && previouslyFocused !== document.body ? previouslyFocused : openBtn;
        focusTarget.focus({ preventScroll: true });
      }
    };
    closeMotionLayer(modal, finish);
  };

  const syncThemeInputs = () => {
    themeInputs.forEach((input) => {
      if (input.tagName === "SELECT") {
        input.value = getThemePreference();
        if (input.id) {
          initCustomSelect(input.id);
        }
      }
    });
  };

  writeSettingsArray(readSettingsArray());
  syncSettingsInputs();
  syncThemeInputs();
  syncRatesAttribution();

  openBtn.addEventListener("click", openSettings);
  closeBtn?.addEventListener("click", closeSettings);
  launchTourBtn?.addEventListener("click", () => {
    const onCatalog = Boolean(
      isUniversitiesListPath(window.location.pathname)
      && document.getElementById("universitiesList")
      && document.body.dataset.page === "universities"
    );
    closeMotionLayer(modal, () => {
      modal.classList.remove("is-open", "is-closing");
      if (typeof modal.close === "function" && modal.open) modal.close();
      if (onCatalog) {
        window.dispatchEvent(new CustomEvent("unisearch:open-tour"));
      } else {
        requestUniversitiesTourOpen();
        navigateToAppRoute(routeUniversities());
      }
    });
  });
  bindDialogLightDismiss(modal, card, closeSettings);
  settingInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const key = String(input.getAttribute("data-setting-input") || "").trim();
      let nextValue;
      if (input.tagName === "SELECT") {
        nextValue = input.value;
      } else {
        nextValue = key === SETTING_STORE_RECENT_UNIVERSITIES ? !input.checked : input.checked;
      }
      setSettingValue(key, nextValue);
      syncSettingsInputs();
      if (input.type === "checkbox") {
        replayMotion(input, "motion-switch-toggle", { timeoutMs: 260 });
      }
      if (key === SETTING_PREFERRED_CURRENCY || key === SETTING_CURRENCY_DISPLAY) {
        try {
          window.dispatchEvent(new CustomEvent("currencyChanged", {
            detail: {
              key,
              value: nextValue,
              preferredCurrency: key === SETTING_PREFERRED_CURRENCY ? nextValue : getSettingValue(SETTING_PREFERRED_CURRENCY),
              displayMode: key === SETTING_CURRENCY_DISPLAY ? nextValue : getSettingValue(SETTING_CURRENCY_DISPLAY),
            },
          }));
        } catch {
          // ignore event error
        }
      }
    });
  });

  themeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      applyTheme(input.value, { persist: true });
      syncThemeInputs();
    });
  });

  window.addEventListener("settingsChanged", syncSettingsInputs);
  window.addEventListener("themeChanged", syncThemeInputs);
  window.addEventListener("currencyRatesStatusUpdated", syncRatesAttribution);
  window.addEventListener("currencyRatesUpdated", syncRatesAttribution);
  window.addEventListener("languageChanged", syncRatesAttribution);
  if (typeof modal.showModal !== "function") {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeSettings();
      }
    });
  }
}
