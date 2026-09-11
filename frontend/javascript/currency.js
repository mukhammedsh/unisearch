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
  USD: 1.0,
  AED: 3.67,
  AFN: 64.8243,
  ALL: 79.173,
  AMD: 363.83,
  ANG: 1.79,
  AOA: 925.654,
  ARS: 950.0,
  AUD: 1.39,
  AWG: 1.79,
  AZN: 1.7,
  BAM: 1.6835,
  BBD: 2.0,
  BDT: 118.0,
  BGN: 1.68,
  BHD: 0.38,
  BIF: 3002.2714,
  BMD: 1.0,
  BND: 1.2671,
  BOB: 12.5706,
  BRL: 5.11,
  BSD: 1.0,
  BTN: 95.5302,
  BWP: 13.7503,
  BYN: 3.04,
  BZD: 2.0,
  CAD: 1.38,
  CDF: 2303.2866,
  CHF: 0.81,
  CLF: 0.0235,
  CLP: 910.0,
  CNH: 6.7101,
  CNY: 6.73,
  COP: 3950.0,
  CRC: 454.4902,
  CUP: 24.0,
  CVE: 94.9137,
  CZK: 20.87,
  DJF: 177.721,
  DKK: 6.43,
  DOP: 58.8248,
  DZD: 133.1346,
  EGP: 47.0,
  ERN: 15.0,
  ETB: 161.2708,
  EUR: 0.86,
  FJD: 2.2159,
  FKP: 0.7398,
  FOK: 6.4314,
  GBP: 0.74,
  GEL: 2.61,
  GGP: 0.7398,
  GHS: 11.417,
  GIP: 0.7398,
  GMD: 74.6582,
  GNF: 8785.4424,
  GTQ: 7.6431,
  GYD: 209.2915,
  HKD: 7.84,
  HNL: 26.8569,
  HRK: 6.4855,
  HTG: 130.7193,
  HUF: 313.96,
  IDR: 17561.81,
  ILS: 3.04,
  IMP: 0.7398,
  INR: 95.51,
  IQD: 1310.9894,
  IRR: 1453530.6071,
  ISK: 125.0,
  JEP: 0.7398,
  JMD: 157.9683,
  JOD: 0.709,
  JPY: 154.25,
  KES: 130.0,
  KGS: 87.49,
  KHR: 4044.1834,
  KID: 1.3953,
  KMF: 423.475,
  KRW: 1345.06,
  KWD: 0.31,
  KYD: 0.8333,
  KZT: 450.0,
  LAK: 22275.7659,
  LBP: 89500.0,
  LKR: 328.2571,
  LRD: 174.7516,
  LSL: 16.1895,
  LYD: 6.3274,
  MAD: 9.8,
  MDL: 17.25,
  MGA: 4310.5225,
  MKD: 52.9848,
  MMK: 2101.8401,
  MNT: 3450.0,
  MOP: 8.0764,
  MRU: 40.1419,
  MUR: 47.0001,
  MVR: 15.4499,
  MWK: 1744.4538,
  MXN: 16.97,
  MYR: 4.07,
  MZN: 63.7013,
  NAD: 16.1895,
  NGN: 1450.0,
  NIO: 36.8288,
  NOK: 9.27,
  NPR: 152.8483,
  NZD: 1.72,
  OMR: 0.38,
  PAB: 1.0,
  PEN: 3.7,
  PGK: 4.5047,
  PHP: 62.66,
  PKR: 278.0,
  PLN: 3.72,
  PYG: 5904.8669,
  QAR: 3.64,
  RON: 4.3,
  RSD: 101.0,
  RUB: 84.37,
  RWF: 1474.8231,
  SAR: 3.75,
  SBD: 7.896,
  SCR: 13.879,
  SDG: 511.8921,
  SEK: 9.67,
  SGD: 1.27,
  SHP: 0.7398,
  SLE: 24.6816,
  SLL: 24681.6189,
  SOS: 571.5101,
  SRD: 38.1123,
  SSP: 5652.926,
  STN: 21.0891,
  SYP: 121.8891,
  SZL: 16.1895,
  THB: 33.0,
  TJS: 9.23,
  TMT: 3.5014,
  TND: 2.9066,
  TOP: 2.3652,
  TRY: 48.56,
  TTD: 6.7778,
  TVD: 1.3953,
  TWD: 31.6,
  TZS: 2643.5621,
  UAH: 44.62,
  UGX: 3763.4748,
  UYU: 40.2769,
  UZS: 11792.97,
  VES: 832.4883,
  VND: 25879.19,
  VUV: 117.9454,
  WST: 2.6887,
  XAF: 564.6333,
  XCD: 2.7,
  XCG: 1.79,
  XDR: 0.7284,
  XOF: 564.6333,
  XPF: 102.7184,
  YER: 237.2217,
  ZAR: 16.19,
  ZMW: 19.2177,
  ZWG: 26.6758,
  ZWL: 26.6758,
};

export const STATIC_FILTER_LIMITS = {
  _comment: "Filter slider bounds per currency. 'default' in USD, converted for unlisted currencies.",
  default: {
    min: 0,
    max: 100000,
    step: 100
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

export function niceStep(rawStep) {
  const stepNum = Number(rawStep);
  if (!Number.isFinite(stepNum) || stepNum <= 1) {
    return 1;
  }
  const p = Math.pow(10, Math.floor(Math.log10(stepNum)));
  const m = stepNum / p;
  let tick = 10;
  if (m < 1.41421356) {
    tick = 1;
  } else if (m < 3.16227766) {
    tick = 2;
  } else if (m < 7.07106781) {
    tick = 5;
  }
  return Math.max(1, Math.round(tick * p));
}

export function niceMax(rawMax, step) {
  const maxNum = Number(rawMax);
  const stepNum = Math.max(1, Number(step) || 1);
  if (!Number.isFinite(maxNum) || maxNum <= stepNum) {
    return Math.max(stepNum, 1);
  }
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxNum)) - 1));
  const roundedUnit = Math.max(stepNum, p);
  let candidate = Math.ceil(maxNum / roundedUnit) * roundedUnit;
  if (candidate % stepNum !== 0) {
    candidate = Math.ceil(candidate / stepNum) * stepNum;
  }
  return Math.max(stepNum, Math.round(candidate));
}

export function getFilterLimits(code) {
  const currencyCode = String(code || getPreferredCurrency() || "USD").trim().toUpperCase();
  const limitsMap = memoryFilterLimits || STATIC_FILTER_LIMITS;
  const override = limitsMap[currencyCode] || {};

  const defaultLimits = limitsMap.default || limitsMap.USD || STATIC_FILTER_LIMITS.default || { min: 0, max: 100000, step: 100 };
  const defaultMin = Number(defaultLimits.min ?? 0);
  const defaultMax = Number(defaultLimits.max ?? 100000);
  const defaultStep = Number(defaultLimits.step ?? 100);

  const convMin = convert(defaultMin, "USD", currencyCode);
  const convMax = convert(defaultMax, "USD", currencyCode);
  const convStep = convert(defaultStep, "USD", currencyCode);

  let stepVal = override.step !== undefined ? Math.max(1, Number(override.step)) : niceStep(convStep);
  let minVal = override.min !== undefined ? Math.max(0, Number(override.min)) : Math.max(0, Math.round(convMin));
  let maxVal;

  if (override.max !== undefined) {
    maxVal = Math.max(minVal + stepVal, Number(override.max));
    if (maxVal % stepVal !== 0) {
      maxVal = Math.ceil(maxVal / stepVal) * stepVal;
    }
  } else {
    maxVal = Math.max(minVal + stepVal, niceMax(convMax, stepVal));
  }

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
