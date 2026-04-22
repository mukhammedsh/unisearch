export const SETTINGS_CACHE_KEY = "unisearch_settings_cache_v1";
export const SETTING_DISABLE_RECENT_UNIVERSITIES = "disable_recent_universities";
export const SETTING_STORE_RECENT_UNIVERSITIES = SETTING_DISABLE_RECENT_UNIVERSITIES;
export const SETTING_OPEN_UNIVERSITIES_NEW_TAB = "open_universities_new_tab";

export const SETTINGS_DEFINITIONS = [
  {
    key: SETTING_STORE_RECENT_UNIVERSITIES,
    type: "bool",
    defaultValue: false,
    titleKey: "settings.option.store_recent.title",
    descriptionKey: "settings.option.store_recent.desc",
  },
  {
    key: SETTING_OPEN_UNIVERSITIES_NEW_TAB,
    type: "bool",
    defaultValue: false,
    titleKey: "settings.option.open_universities_new_tab.title",
    descriptionKey: "settings.option.open_universities_new_tab.desc",
  },
];

function normalizeSettingValue(definition, value) {
  if (definition?.type === "bool") return value === true;
  return value;
}

export function readSettingsArray() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_CACHE_KEY) || "[]");
    const rawRows = Array.isArray(parsed) ? parsed : [];
    const byKey = new Map();
    rawRows.forEach((row) => {
      const key = String(row?.key || "").trim();
      if (!key) return;
      byKey.set(key, row?.value);
    });
    return SETTINGS_DEFINITIONS.map((definition) => ({
      key: definition.key,
      type: definition.type,
      value: byKey.has(definition.key)
        ? normalizeSettingValue(definition, byKey.get(definition.key))
        : definition.defaultValue,
    }));
  } catch (e) {
    return SETTINGS_DEFINITIONS.map((definition) => ({
      key: definition.key,
      type: definition.type,
      value: definition.defaultValue,
    }));
  }
}

export function writeSettingsArray(settings) {
  try {
    const input = Array.isArray(settings) ? settings : [];
    const byKey = new Map(input.map((row) => [String(row?.key || "").trim(), row?.value]));
    const normalized = SETTINGS_DEFINITIONS.map((definition) => ({
      key: definition.key,
      type: definition.type,
      value: byKey.has(definition.key)
        ? normalizeSettingValue(definition, byKey.get(definition.key))
        : definition.defaultValue,
    }));
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (e) {
    return readSettingsArray();
  }
}

export function getSettingValue(key) {
  const definition = SETTINGS_DEFINITIONS.find((item) => item.key === key);
  const row = readSettingsArray().find((item) => item.key === key);
  return row ? row.value : definition?.defaultValue;
}

export function setSettingValue(key, value) {
  const definition = SETTINGS_DEFINITIONS.find((item) => item.key === key);
  const next = readSettingsArray().map((row) => (
    row.key === key
      ? { ...row, value: normalizeSettingValue(definition, value) }
      : row
  ));
  const saved = writeSettingsArray(next);
  try {
    window.dispatchEvent(new CustomEvent("settingsChanged", { detail: { settings: saved, key, value } }));
  } catch (e) {
    // ignore event dispatch errors
  }
  return saved;
}

export function shouldStoreRecentUniversities() {
  return getSettingValue(SETTING_DISABLE_RECENT_UNIVERSITIES) !== true;
}

export function shouldOpenUniversitiesInNewTab() {
  return getSettingValue(SETTING_OPEN_UNIVERSITIES_NEW_TAB) === true;
}
