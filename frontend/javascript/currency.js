import { API_BASE } from "./utils/runtime.js";
import { safeLocalStorage, safeSessionStorage } from "./utils/safe-storage.js";
import { formatCurrency } from "./utils/format.js";
import {
  SETTING_PREFERRED_CURRENCY,
  SETTING_CURRENCY_DISPLAY,
  getSettingValue,
  setSettingValue,
} from "./settings.js";

const RATES_STORAGE_KEY = "unisearch_currency_rates_cache_v1";
const RATES_CACHE_TTL_MS = 3600 * 1000; // 1 hour client cache TTL

export const FALLBACK_RATES = {
  KZT: 450.00,
  RUB: 84.37,
  UZS: 11792.97,
  KGS: 87.49,
  BYN: 3.04,
  TJS: 9.23,
  UAH: 44.62,
  MDL: 17.25,
  AZN: 1.70,
  GEL: 2.61,
  AMD: 363.83,
  EUR: 0.86,
  GBP: 0.74,
  CHF: 0.81,
  PLN: 3.72,
  CZK: 20.87,
  HUF: 313.96,
  RON: 4.30,
  BGN: 1.68,
  RSD: 101.00,
  SEK: 9.67,
  NOK: 9.27,
  DKK: 6.43,
  ISK: 125.00,
  USD: 1.00,
  CAD: 1.38,
  BRL: 5.11,
  MXN: 16.97,
  ARS: 950.00,
  CLP: 910.00,
  COP: 3950.00,
  PEN: 3.70,
  AUD: 1.39,
  CNY: 6.73,
  HKD: 7.84,
  IDR: 17561.81,
  INR: 95.51,
  JPY: 154.25,
  KRW: 1345.06,
  MYR: 4.07,
  NZD: 1.72,
  PHP: 62.66,
  PKR: 278.00,
  BDT: 118.00,
  SGD: 1.27,
  THB: 33.00,
  TWD: 31.60,
  VND: 25879.19,
  MNT: 3450.00,
  AED: 3.67,
  BHD: 0.38,
  EGP: 47.00,
  ILS: 3.04,
  KES: 130.00,
  KWD: 0.31,
  MAD: 9.80,
  NGN: 1450.00,
  OMR: 0.38,
  QAR: 3.64,
  SAR: 3.75,
  TRY: 48.56,
  ZAR: 16.19,
};

export const STATIC_FILTER_LIMITS = {
  _comment: "Filter slider bounds per currency. 'default' in USD, converted for unlisted currencies.",
  default: {
    min: 0,
    max: 50000,
    step: 100
  },
  KZT: {
    min: 0,
    max: 25000000,
    step: 50000
  },
  RUB: {
    min: 0,
    max: 4500000,
    step: 5000
  },
  UZS: {
    min: 0,
    max: 600000000,
    step: 1000000
  },
  KGS: {
    min: 0,
    max: 4500000,
    step: 10000
  },
  BYN: {
    min: 0,
    max: 160000,
    step: 500
  },
  TJS: {
    min: 0,
    max: 500000,
    step: 1000
  },
  UAH: {
    min: 0,
    max: 2300000,
    step: 5000
  },
  MDL: {
    min: 0,
    max: 900000,
    step: 2000
  },
  AZN: {
    min: 0,
    max: 90000,
    step: 200
  },
  GEL: {
    min: 0,
    max: 140000,
    step: 500
  },
  AMD: {
    min: 0,
    max: 20000000,
    step: 50000
  },
  EUR: {
    min: 0,
    max: 45000,
    step: 100
  },
  GBP: {
    min: 0,
    max: 40000,
    step: 100
  },
  CHF: {
    min: 0,
    max: 45000,
    step: 100
  },
  PLN: {
    min: 0,
    max: 200000,
    step: 500
  },
  CZK: {
    min: 0,
    max: 1100000,
    step: 2000
  },
  HUF: {
    min: 0,
    max: 16000000,
    step: 50000
  },
  RON: {
    min: 0,
    max: 220000,
    step: 500
  },
  BGN: {
    min: 0,
    max: 90000,
    step: 200
  },
  RSD: {
    min: 0,
    max: 5500000,
    step: 10000
  },
  SEK: {
    min: 0,
    max: 500000,
    step: 1000
  },
  NOK: {
    min: 0,
    max: 500000,
    step: 1000
  },
  DKK: {
    min: 0,
    max: 350000,
    step: 500
  },
  ISK: {
    min: 0,
    max: 6500000,
    step: 10000
  },
  USD: {
    min: 0,
    max: 50000,
    step: 100
  },
  CAD: {
    min: 0,
    max: 70000,
    step: 100
  },
  BRL: {
    min: 0,
    max: 260000,
    step: 500
  },
  MXN: {
    min: 0,
    max: 850000,
    step: 1000
  },
  ARS: {
    min: 0,
    max: 50000000,
    step: 100000
  },
  CLP: {
    min: 0,
    max: 50000000,
    step: 100000
  },
  COP: {
    min: 0,
    max: 200000000,
    step: 500000
  },
  PEN: {
    min: 0,
    max: 190000,
    step: 500
  },
  AUD: {
    min: 0,
    max: 70000,
    step: 100
  },
  CNY: {
    min: 0,
    max: 350000,
    step: 500
  },
  HKD: {
    min: 0,
    max: 400000,
    step: 1000
  },
  IDR: {
    min: 0,
    max: 900000000,
    step: 1000000
  },
  JPY: {
    min: 0,
    max: 8000000,
    step: 10000
  },
  KRW: {
    min: 0,
    max: 70000000,
    step: 100000
  },
  MYR: {
    min: 0,
    max: 210000,
    step: 500
  },
  NZD: {
    min: 0,
    max: 90000,
    step: 200
  },
  PHP: {
    min: 0,
    max: 3200000,
    step: 5000
  },
  PKR: {
    min: 0,
    max: 15000000,
    step: 50000
  },
  BDT: {
    min: 0,
    max: 6000000,
    step: 10000
  },
  SGD: {
    min: 0,
    max: 65000,
    step: 100
  },
  THB: {
    min: 0,
    max: 1700000,
    step: 5000
  },
  TWD: {
    min: 0,
    max: 1600000,
    step: 5000
  },
  VND: {
    min: 0,
    max: 1300000000,
    step: 2000000
  },
  MNT: {
    min: 0,
    max: 180000000,
    step: 500000
  },
  AED: {
    min: 0,
    max: 190000,
    step: 500
  },
  BHD: {
    min: 0,
    max: 20000,
    step: 50
  },
  EGP: {
    min: 0,
    max: 2400000,
    step: 5000
  },
  ILS: {
    min: 0,
    max: 160000,
    step: 500
  },
  KES: {
    min: 0,
    max: 7000000,
    step: 10000
  },
  KWD: {
    min: 0,
    max: 16000,
    step: 50
  },
  MAD: {
    min: 0,
    max: 500000,
    step: 1000
  },
  NGN: {
    min: 0,
    max: 75000000,
    step: 200000
  },
  OMR: {
    min: 0,
    max: 20000,
    step: 50
  },
  QAR: {
    min: 0,
    max: 190000,
    step: 500
  },
  SAR: {
    min: 0,
    max: 190000,
    step: 500
  },
  TRY: {
    min: 0,
    max: 2500000,
    step: 5000
  },
  ZAR: {
    min: 0,
    max: 850000,
    step: 1000
  }
};

export const CURRENCY_FORMAT_MAP = {
  KZT: { symbol: "₸", position: "after", maximumFractionDigits: 0 },
  RUB: { symbol: "₽", position: "after", maximumFractionDigits: 0 },
  UZS: { symbol: "soʻm", position: "after", maximumFractionDigits: 0 },
  KGS: { symbol: "сом", position: "after", maximumFractionDigits: 0 },
  BYN: { symbol: "Br", position: "after", maximumFractionDigits: 0 },
  TJS: { symbol: "смн", position: "after", maximumFractionDigits: 0 },
  UAH: { symbol: "₴", position: "after", maximumFractionDigits: 0 },
  MDL: { symbol: "L", position: "after", maximumFractionDigits: 0 },
  AZN: { symbol: "₼", position: "after", maximumFractionDigits: 0 },
  GEL: { symbol: "₾", position: "after", maximumFractionDigits: 0 },
  AMD: { symbol: "֏", position: "after", maximumFractionDigits: 0 },
  EUR: { symbol: "€", position: "before", maximumFractionDigits: 0 },
  GBP: { symbol: "£", position: "before", maximumFractionDigits: 0 },
  CHF: { symbol: "Fr.", position: "before", maximumFractionDigits: 0 },
  PLN: { symbol: "zł", position: "after", maximumFractionDigits: 0 },
  CZK: { symbol: "Kč", position: "after", maximumFractionDigits: 0 },
  HUF: { symbol: "Ft", position: "after", maximumFractionDigits: 0 },
  RON: { symbol: "lei", position: "after", maximumFractionDigits: 0 },
  BGN: { symbol: "лв.", position: "after", maximumFractionDigits: 0 },
  RSD: { symbol: "дин.", position: "after", maximumFractionDigits: 0 },
  SEK: { symbol: "kr", position: "after", maximumFractionDigits: 0 },
  NOK: { symbol: "kr", position: "after", maximumFractionDigits: 0 },
  DKK: { symbol: "kr", position: "after", maximumFractionDigits: 0 },
  ISK: { symbol: "kr", position: "after", maximumFractionDigits: 0 },
  USD: { symbol: "$", position: "before", maximumFractionDigits: 0 },
  CAD: { symbol: "CA$", position: "before", maximumFractionDigits: 0 },
  BRL: { symbol: "R$", position: "before", maximumFractionDigits: 0 },
  MXN: { symbol: "Mex$", position: "before", maximumFractionDigits: 0 },
  ARS: { symbol: "$", position: "before", maximumFractionDigits: 0 },
  CLP: { symbol: "$", position: "before", maximumFractionDigits: 0 },
  COP: { symbol: "$", position: "before", maximumFractionDigits: 0 },
  PEN: { symbol: "S/", position: "before", maximumFractionDigits: 0 },
  AUD: { symbol: "A$", position: "before", maximumFractionDigits: 0 },
  CNY: { symbol: "¥", position: "before", maximumFractionDigits: 0 },
  HKD: { symbol: "HK$", position: "before", maximumFractionDigits: 0 },
  IDR: { symbol: "Rp", position: "after", maximumFractionDigits: 0 },
  INR: { symbol: "₹", position: "before", maximumFractionDigits: 0 },
  JPY: { symbol: "¥", position: "before", maximumFractionDigits: 0 },
  KRW: { symbol: "₩", position: "before", maximumFractionDigits: 0 },
  MYR: { symbol: "RM", position: "before", maximumFractionDigits: 0 },
  NZD: { symbol: "NZ$", position: "before", maximumFractionDigits: 0 },
  PHP: { symbol: "₱", position: "before", maximumFractionDigits: 0 },
  PKR: { symbol: "₨", position: "before", maximumFractionDigits: 0 },
  BDT: { symbol: "৳", position: "after", maximumFractionDigits: 0 },
  SGD: { symbol: "S$", position: "before", maximumFractionDigits: 0 },
  THB: { symbol: "฿", position: "before", maximumFractionDigits: 0 },
  TWD: { symbol: "NT$", position: "before", maximumFractionDigits: 0 },
  VND: { symbol: "₫", position: "after", maximumFractionDigits: 0 },
  MNT: { symbol: "₮", position: "after", maximumFractionDigits: 0 },
  AED: { symbol: "د.إ", position: "after", maximumFractionDigits: 0 },
  BHD: { symbol: "BD", position: "after", maximumFractionDigits: 2 },
  EGP: { symbol: "E£", position: "before", maximumFractionDigits: 0 },
  ILS: { symbol: "₪", position: "before", maximumFractionDigits: 0 },
  KES: { symbol: "KSh", position: "before", maximumFractionDigits: 0 },
  KWD: { symbol: "KD", position: "after", maximumFractionDigits: 2 },
  MAD: { symbol: "DH", position: "after", maximumFractionDigits: 0 },
  NGN: { symbol: "₦", position: "before", maximumFractionDigits: 0 },
  OMR: { symbol: "OMR", position: "after", maximumFractionDigits: 2 },
  QAR: { symbol: "QR", position: "after", maximumFractionDigits: 0 },
  SAR: { symbol: "﷼", position: "after", maximumFractionDigits: 0 },
  TRY: { symbol: "₺", position: "before", maximumFractionDigits: 0 },
  ZAR: { symbol: "R", position: "before", maximumFractionDigits: 0 },
};


let memoryRates = { ...FALLBACK_RATES };
let memoryFilterLimits = { ...STATIC_FILTER_LIMITS };
let memoryRatesDate = "";
let memoryRatesSource = "fallback";
let inFlightRatesPromise = null;

export function getPreferredCurrency() {
  const settingVal = getSettingValue(SETTING_PREFERRED_CURRENCY);
  if (typeof settingVal === "string" && settingVal.trim()) {
    return settingVal.trim().toUpperCase();
  }
  const direct = safeLocalStorage.get("unisearch_preferred_currency");
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim().toUpperCase();
  }
  return "USD";
}

export function setPreferredCurrency(code) {
  const normalized = String(code || "USD").trim().toUpperCase();
  safeLocalStorage.set("unisearch_preferred_currency", normalized);
  setSettingValue(SETTING_PREFERRED_CURRENCY, normalized);
  try {
    window.dispatchEvent(new CustomEvent("currencyChanged", {
      detail: {
        currency: normalized,
        preferredCurrency: normalized,
        mode: getCurrencyDisplayMode(),
        displayMode: getCurrencyDisplayMode(),
      },
    }));
  } catch (e) {
    // ignore event error
  }
  return normalized;
}

export function getCurrencyDisplayMode() {
  const settingVal = getSettingValue(SETTING_CURRENCY_DISPLAY);
  const normalized = String(settingVal || "preferred").trim().toLowerCase();
  return ["preferred", "original", "both"].includes(normalized) ? normalized : "preferred";
}

export function setCurrencyDisplayMode(mode) {
  const normalized = String(mode || "preferred").trim().toLowerCase();
  const valid = ["preferred", "original", "both"].includes(normalized) ? normalized : "preferred";
  setSettingValue(SETTING_CURRENCY_DISPLAY, valid);
  try {
    window.dispatchEvent(new CustomEvent("currencyChanged", {
      detail: {
        mode: valid,
        displayMode: valid,
        currency: getPreferredCurrency(),
        preferredCurrency: getPreferredCurrency(),
      },
    }));
  } catch (e) {
    // ignore event error
  }
  return valid;
}

function restoreFromSessionStorage() {
  try {
    const parsed = safeSessionStorage.getJson(RATES_STORAGE_KEY);
    if (!parsed || typeof parsed !== "object") return false;
    const now = Date.now();
    const timestamp = Number(parsed.timestamp || 0);
    if (now - timestamp > RATES_CACHE_TTL_MS) return false;

    if (parsed.rates && typeof parsed.rates === "object" && Object.keys(parsed.rates).length > 0) {
      memoryRates = { ...FALLBACK_RATES, ...parsed.rates };
      if (parsed.filter_limits && typeof parsed.filter_limits === "object") {
        memoryFilterLimits = { ...STATIC_FILTER_LIMITS, ...parsed.filter_limits };
      }
      memoryRatesDate = String(parsed.date || "");
      memoryRatesSource = String(parsed.source || "cache");
      return true;
    }
  } catch (e) {
    // ignore storage read error
  }
  return false;
}

function persistToSessionStorage(data) {
  try {
    safeSessionStorage.setJson(RATES_STORAGE_KEY, {
      rates: data.rates,
      filter_limits: data.filter_limits,
      date: data.date,
      source: data.source,
      timestamp: Date.now(),
    });
  } catch (e) {
    // ignore storage write error
  }
}

export async function loadRates() {
  if (restoreFromSessionStorage() && memoryRatesSource !== "fallback") {
    return {
      rates: { ...memoryRates },
      date: memoryRatesDate,
      source: memoryRatesSource,
      filter_limits: { ...memoryFilterLimits },
    };
  }

  if (inFlightRatesPromise) {
    return inFlightRatesPromise;
  }

  inFlightRatesPromise = (async () => {
    try {
      const url = `${API_BASE}/currency/rates`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Currency API responded with ${res.status}`);
      }

      const json = await res.json();
      if (json && typeof json === "object" && json.rates && typeof json.rates === "object") {
        memoryRates = { ...FALLBACK_RATES, ...json.rates };
        if (json.filter_limits && typeof json.filter_limits === "object") {
          memoryFilterLimits = { ...STATIC_FILTER_LIMITS, ...json.filter_limits };
        }
        memoryRatesDate = String(json.date || "");
        memoryRatesSource = String(json.source || "api");

        persistToSessionStorage({
          rates: memoryRates,
          filter_limits: memoryFilterLimits,
          date: memoryRatesDate,
          source: memoryRatesSource,
        });
      }
    } catch (e) {
      // If fetch fails, keep cached or static fallback
      if (!restoreFromSessionStorage()) {
        memoryRates = { ...FALLBACK_RATES };
        memoryFilterLimits = { ...STATIC_FILTER_LIMITS };
        memoryRatesDate = "";
        memoryRatesSource = "fallback";
      }
    } finally {
      inFlightRatesPromise = null;
    }

    return {
      rates: { ...memoryRates },
      date: memoryRatesDate,
      source: memoryRatesSource,
      filter_limits: { ...memoryFilterLimits },
    };
  })();

  return inFlightRatesPromise;
}

export function convert(amount, from = "USD", to = "USD") {
  if (amount === null || amount === undefined || amount === "") return 0;
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  const fromCode = String(from || "USD").trim().toUpperCase();
  const toCode = String(to || "USD").trim().toUpperCase();

  if (fromCode === toCode) return num;

  const rates = memoryRates || FALLBACK_RATES;
  const fromRate = rates[fromCode] || FALLBACK_RATES[fromCode];
  const toRate = rates[toCode] || FALLBACK_RATES[toCode];

  if (!fromRate || !toRate || fromRate <= 0 || toRate <= 0) {
    return num;
  }

  const usdAmount = num / fromRate;
  return usdAmount * toRate;
}

export function getFilterLimits(code) {
  const currencyCode = String(code || getPreferredCurrency() || "USD").trim().toUpperCase();
  const limitsMap = memoryFilterLimits || STATIC_FILTER_LIMITS;

  if (limitsMap[currencyCode]) {
    const lim = limitsMap[currencyCode];
    return {
      min: Number(lim.min ?? 0),
      max: Number(lim.max ?? 50000),
      step: Number(lim.step ?? 100),
    };
  }

  const defaultLimits = limitsMap.default || limitsMap.USD || STATIC_FILTER_LIMITS.default;
  const convMin = convert(defaultLimits.min, "USD", currencyCode);
  const convMax = convert(defaultLimits.max, "USD", currencyCode);
  const convStep = convert(defaultLimits.step, "USD", currencyCode);

  const minVal = Math.max(0, Math.round(convMin));
  const maxVal = Math.max(minVal + 1, Math.round(convMax));
  const stepVal = Math.max(1, Math.round(convStep));

  return {
    min: minVal,
    max: maxVal,
    step: stepVal,
  };
}

const _numberFormatCache = new Map();
function getNumberFormatter(maxDigits) {
  let fmt = _numberFormatCache.get(maxDigits);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: maxDigits,
      minimumFractionDigits: 0,
    });
    _numberFormatCache.set(maxDigits, fmt);
  }
  return fmt;
}

export function formatMoney(amount, code = "USD") {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  const upperCode = String(code || "USD").trim().toUpperCase();
  const config = CURRENCY_FORMAT_MAP[upperCode];

  const maxDigits = config?.maximumFractionDigits !== undefined ? config.maximumFractionDigits : 0;
  const numFormatted = getNumberFormatter(maxDigits).format(Math.round(num));

  if (!config) {
    return formatCurrency(num, upperCode);
  }

  const { symbol, position } = config;
  if (position === "after") {
    return `${numFormatted} ${symbol}`;
  }

  const isWordSymbol = /^[A-Za-z.]+$/.test(symbol) || /^(?:R\$|Mex\$|NT\$|S\/|E£|KSh|DH)$/.test(symbol);
  return isWordSymbol ? `${symbol} ${numFormatted}` : `${symbol}${numFormatted}`;
}

export function formatPrice(amount, originalCurrency = "USD") {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";

  const origCode = String(originalCurrency || "USD").trim().toUpperCase();
  const prefCode = getPreferredCurrency();
  const mode = getCurrencyDisplayMode();

  if (origCode === prefCode) {
    return formatMoney(num, origCode);
  }

  const convertedAmount = convert(num, origCode, prefCode);
  const prefFormatted = formatMoney(convertedAmount, prefCode);
  const origFormatted = formatMoney(num, origCode);

  if (mode === "original") {
    return origFormatted;
  }

  if (mode === "both") {
    return `≈ ${prefFormatted} (${origFormatted})`;
  }

  // mode === "preferred"
  return `≈ ${prefFormatted}`;
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("settingsChanged", (e) => {
    const key = e?.detail?.key;
    if (key === SETTING_PREFERRED_CURRENCY || key === SETTING_CURRENCY_DISPLAY) {
      try {
        window.dispatchEvent(new CustomEvent("currencyChanged", {
          detail: {
            key,
            value: e.detail.value,
            currency: getPreferredCurrency(),
            preferredCurrency: getPreferredCurrency(),
            mode: getCurrencyDisplayMode(),
            displayMode: getCurrencyDisplayMode(),
          },
        }));
      } catch (err) {
        // ignore
      }
    }
  });
}
