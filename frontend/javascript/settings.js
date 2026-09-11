export const SETTINGS_CACHE_KEY = "unisearch_settings_cache_v1";
export const SETTING_DISABLE_RECENT_UNIVERSITIES = "disable_recent_universities";
export const SETTING_STORE_RECENT_UNIVERSITIES = SETTING_DISABLE_RECENT_UNIVERSITIES;
export const SETTING_OPEN_UNIVERSITIES_NEW_TAB = "open_universities_new_tab";
export const SETTING_PREFERRED_CURRENCY = "preferred_currency";
export const SETTING_CURRENCY_DISPLAY = "currency_display_mode";

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
  {
    key: SETTING_PREFERRED_CURRENCY,
    type: "select",
    defaultValue: "USD",
    titleKey: "settings.option.preferred_currency.title",
    descriptionKey: "settings.option.preferred_currency.desc",
        options: [
      { value: "KZT", label: "Kazakhstani Tenge (KZT, ₸)" },
      { value: "RUB", label: "Russian Ruble (RUB, ₽)" },
      { value: "UZS", label: "Uzbekistani Som (UZS, soʻm)" },
      { value: "KGS", label: "Kyrgyzstani Som (KGS, сом)" },
      { value: "BYN", label: "Belarusian Ruble (BYN, Br)" },
      { value: "TJS", label: "Tajikistani Somoni (TJS, смн)" },
      { value: "UAH", label: "Ukrainian Hryvnia (UAH, ₴)" },
      { value: "MDL", label: "Moldovan Leu (MDL, L)" },
      { value: "AZN", label: "Azerbaijani Manat (AZN, ₼)" },
      { value: "GEL", label: "Georgian Lari (GEL, ₾)" },
      { value: "AMD", label: "Armenian Dram (AMD, ֏)" },
      { value: "EUR", label: "Euro (EUR, €)" },
      { value: "GBP", label: "British Pound (GBP, £)" },
      { value: "CHF", label: "Swiss Franc (CHF, Fr.)" },
      { value: "PLN", label: "Polish Zloty (PLN, zł)" },
      { value: "CZK", label: "Czech Koruna (CZK, Kč)" },
      { value: "HUF", label: "Hungarian Forint (HUF, Ft)" },
      { value: "RON", label: "Romanian Leu (RON, lei)" },
      { value: "BGN", label: "Bulgarian Lev (BGN, лв.)" },
      { value: "RSD", label: "Serbian Dinar (RSD, дин.)" },
      { value: "SEK", label: "Swedish Krona (SEK, kr)" },
      { value: "NOK", label: "Norwegian Krone (NOK, kr)" },
      { value: "DKK", label: "Danish Krone (DKK, kr)" },
      { value: "ISK", label: "Icelandic Krona (ISK, kr)" },
      { value: "USD", label: "US Dollar (USD, $)" },
      { value: "CAD", label: "Canadian Dollar (CAD, CA$)" },
      { value: "BRL", label: "Brazilian Real (BRL, R$)" },
      { value: "MXN", label: "Mexican Peso (MXN, Mex$)" },
      { value: "ARS", label: "Argentine Peso (ARS, $)" },
      { value: "CLP", label: "Chilean Peso (CLP, $)" },
      { value: "COP", label: "Colombian Peso (COP, $)" },
      { value: "PEN", label: "Peruvian Sol (PEN, S/)" },
      { value: "AUD", label: "Australian Dollar (AUD, A$)" },
      { value: "CNY", label: "Chinese Yuan (CNY, ¥)" },
      { value: "HKD", label: "Hong Kong Dollar (HKD, HK$)" },
      { value: "IDR", label: "Indonesian Rupiah (IDR, Rp)" },
      { value: "INR", label: "Indian Rupee (INR, ₹)" },
      { value: "JPY", label: "Japanese Yen (JPY, ¥)" },
      { value: "KRW", label: "South Korean Won (KRW, ₩)" },
      { value: "MYR", label: "Malaysian Ringgit (MYR, RM)" },
      { value: "NZD", label: "New Zealand Dollar (NZD, NZ$)" },
      { value: "PHP", label: "Philippine Peso (PHP, ₱)" },
      { value: "PKR", label: "Pakistani Rupee (PKR, ₨)" },
      { value: "BDT", label: "Bangladeshi Taka (BDT, ৳)" },
      { value: "SGD", label: "Singapore Dollar (SGD, S$)" },
      { value: "THB", label: "Thai Baht (THB, ฿)" },
      { value: "TWD", label: "New Taiwan Dollar (TWD, NT$)" },
      { value: "VND", label: "Vietnamese Dong (VND, ₫)" },
      { value: "MNT", label: "Mongolian Tugrik (MNT, ₮)" },
      { value: "AED", label: "UAE Dirham (AED, د.إ)" },
      { value: "BHD", label: "Bahraini Dinar (BHD, BD)" },
      { value: "EGP", label: "Egyptian Pound (EGP, E£)" },
      { value: "ILS", label: "Israeli New Shekel (ILS, ₪)" },
      { value: "KES", label: "Kenyan Shilling (KES, KSh)" },
      { value: "KWD", label: "Kuwaiti Dinar (KWD, KD)" },
      { value: "MAD", label: "Moroccan Dirham (MAD, DH)" },
      { value: "NGN", label: "Nigerian Naira (NGN, ₦)" },
      { value: "OMR", label: "Omani Rial (OMR, OMR)" },
      { value: "QAR", label: "Qatari Riyal (QAR, QR)" },
      { value: "SAR", label: "Saudi Riyal (SAR, ﷼)" },
      { value: "TRY", label: "Turkish Lira (TRY, ₺)" },
      { value: "ZAR", label: "South African Rand (ZAR, R)" },
    ],
  },
  {
    key: SETTING_CURRENCY_DISPLAY,
    type: "select",
    defaultValue: "preferred",
    titleKey: "settings.option.currency_display.title",
    descriptionKey: "settings.option.currency_display.desc",
    options: [
      { value: "preferred", labelKey: "currency.display.preferred", label: "In preferred currency" },
      { value: "original", labelKey: "currency.display.original", label: "In original currency" },
      { value: "both", labelKey: "currency.display.both", label: "Both (preferred + original)" },
    ],
  },
];

const SETTINGS_DEFINITIONS_MAP = new Map(SETTINGS_DEFINITIONS.map((d) => [d.key, d]));

function normalizeSettingValue(definition, value) {
  if (definition?.type === "bool") return value === true;
  if (definition?.type === "select") {
    const val = String(value ?? "").trim();
    if (Array.isArray(definition.options)) {
      const match = definition.options.some((opt) => (typeof opt === "object" ? opt.value : opt) === val);
      if (match) return val;
    }
    return definition.defaultValue;
  }
  return value;
}

function getRawSettingsMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_CACHE_KEY) || "[]");
    const rawRows = Array.isArray(parsed) ? parsed : [];
    const byKey = new Map();
    rawRows.forEach((row) => {
      const key = String(row?.key || "").trim();
      if (!key) return;
      byKey.set(key, row?.value);
    });
    return byKey;
  } catch (e) {
    return new Map();
  }
}

export function readSettingsArray() {
  const byKey = getRawSettingsMap();
  return SETTINGS_DEFINITIONS.map((definition) => ({
    key: definition.key,
    type: definition.type,
    value: byKey.has(definition.key)
      ? normalizeSettingValue(definition, byKey.get(definition.key))
      : definition.defaultValue,
  }));
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
  const definition = SETTINGS_DEFINITIONS_MAP.get(key);
  if (!definition) return undefined;
  const rawMap = getRawSettingsMap();
  if (rawMap.has(key)) {
    return normalizeSettingValue(definition, rawMap.get(key));
  }
  return definition.defaultValue;
}

export function setSettingValue(key, value) {
  const definition = SETTINGS_DEFINITIONS_MAP.get(key);
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

export function getPreferredCurrencySetting() {
  return getSettingValue(SETTING_PREFERRED_CURRENCY) || "USD";
}

export function getCurrencyDisplayModeSetting() {
  return getSettingValue(SETTING_CURRENCY_DISPLAY) || "preferred";
}
