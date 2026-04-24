import { showToast } from "../utils.js";
import { t } from "../i18n.js";
import {
  SETTING_STORE_RECENT_UNIVERSITIES,
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
  if (!modal || !openBtn || !settingInputs.length) return;

  const syncSettingsInputs = () => {
    settingInputs.forEach((input) => {
      const key = String(input.getAttribute("data-setting-input") || "").trim();
      input.checked = key === SETTING_STORE_RECENT_UNIVERSITIES
        ? shouldStoreRecentUniversities()
        : getSettingValue(key) === true;
    });
  };

  const openSettings = () => {
    syncSettingsInputs();
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
    closeBtn?.focus({ preventScroll: true });
  };

  const closeSettings = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    openBtn.focus({ preventScroll: true });
  };

  writeSettingsArray(readSettingsArray());
  syncSettingsInputs();

  openBtn.addEventListener("click", openSettings);
  closeBtn?.addEventListener("click", closeSettings);
  backdrop?.addEventListener("click", closeSettings);
  settingInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const key = String(input.getAttribute("data-setting-input") || "").trim();
      const nextValue = key === SETTING_STORE_RECENT_UNIVERSITIES ? !input.checked : input.checked;
      setSettingValue(key, nextValue);
      syncSettingsInputs();
      showToast(t("settings.saved", "Settings saved"), "success");
    });
  });

  window.addEventListener("settingsChanged", syncSettingsInputs);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeSettings();
    }
  });
}
