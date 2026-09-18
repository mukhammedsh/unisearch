import { closeMotionLayer, initCustomSelect, replayMotion, trapFocus } from "../utils.js";
import { applyTheme, getThemePreference } from "../utils.js";
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
  const backdrop = modal?.querySelector(".settings-backdrop");
  const settingInputs = Array.from(modal?.querySelectorAll("[data-setting-input]") || []);
  const themeInputs = Array.from(modal?.querySelectorAll("[data-theme-input]") || []);
  if (!modal || !openBtn || (!settingInputs.length && !themeInputs.length)) return;

  let cleanupFocusTrap = null;

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

  const openSettings = () => {
    syncSettingsInputs();
    syncThemeInputs();
    modal.classList.remove("is-closing");
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
    if (typeof cleanupFocusTrap === "function") cleanupFocusTrap();
    cleanupFocusTrap = trapFocus(modal);
    closeBtn?.focus({ preventScroll: true });
  };

  const closeSettings = () => {
    if (typeof cleanupFocusTrap === "function") {
      cleanupFocusTrap();
      cleanupFocusTrap = null;
    }
    const finish = () => {
      modal.classList.remove("is-open", "is-closing");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      openBtn.focus({ preventScroll: true });
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

  openBtn.addEventListener("click", openSettings);
  closeBtn?.addEventListener("click", closeSettings);
  backdrop?.addEventListener("click", closeSettings);
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
        replayMotion(input.closest(".settings-switch")?.querySelector(".settings-switch-track"), "motion-switch-toggle", { timeoutMs: 260 });
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
        } catch (e) {
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
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeSettings();
    }
  });
}
