import { API_BASE } from "./utils/runtime.js";
import { safeLocalStorage, safeSessionStorage } from "./utils/safe-storage.js";
import { formatCurrency, numberLocale } from "./utils/format.js";
import {
  SETTING_PREFERRED_CURRENCY,
  SETTING_CURRENCY_DISPLAY,
  getSettingValue,
  setSettingValue,
} from "./settings.js";

const RATES_STORAGE_KEY = "unisearch_currency_rates_cache_v1";
const RATES_CACHE_TTL_MS = 3600 * 1000; // 1 hour client cache TTL

// Snapshot from ExchangeRate-API (time_last_update_utc: Wed, 18 Nov 2026 00:02:31 +0000)
export const FALLBACK_RATES_DATE = "2026-11-18";
export const FALLBACK_RATES = {
  USD: 1.0,
  AED: 3.6725,
  AFN: 65.569445,
  ALL: 82.33211,
  AMD: 360.496742,
  ANG: 1.79,
  AOA: 929.147823,
  ARS: 1552.2627,
  AUD: 1.48436,
  AWG: 1.79,
  AZN: 1.700728,
  BAM: 1.778167,
  BBD: 2.0,
  BDT: 124.86223,
  BGN: 1.778167,
  BHD: 0.376,
  BIF: 3006.888053,
  BMD: 1.0,
  BND: 1.288383,
  BOB: 11.662995,
  BRL: 5.781701,
  BSD: 1.0,
  BTN: 93.516187,
  BWP: 14.508283,
  BYN: 3.000459,
  BZD: 2.0,
  CAD: 1.429407,
  CDF: 2308.716632,
  CHF: 0.840712,
  CLF: 0.025263,
  CLP: 998.564588,
  CNH: 6.667956,
  CNY: 6.679863,
  COP: 3320.186806,
  CRC: 446.134339,
  CUP: 24.0,
  CVE: 100.248771,
  CZK: 22.170826,
  DJF: 177.721,
  DKK: 6.800425,
  DOP: 60.637513,
  DZD: 137.146457,
  EGP: 53.717698,
  ERN: 15.0,
  ETB: 161.134959,
  EUR: 0.909215,
  FJD: 2.296274,
  FKP: 0.757555,
  FOK: 6.800422,
  GBP: 0.757596,
  GEL: 2.593,
  GGP: 0.757555,
  GHS: 11.778354,
  GIP: 0.757555,
  GMD: 74.811158,
  GNF: 8850.036393,
  GTQ: 7.648031,
  GYD: 209.072444,
  HKD: 7.846176,
  HNL: 26.949218,
  HRK: 6.850083,
  HTG: 131.070255,
  HUF: 332.590881,
  IDR: 18278.202017,
  ILS: 3.246957,
  IMP: 0.757555,
  INR: 93.513494,
  IQD: 1513.72549,
  IRR: 1816886.218373,
  ISK: 124.365658,
  JEP: 0.757555,
  JMD: 158.61453,
  JOD: 0.709,
  JPY: 159.393063,
  KES: 130.099085,
  KGS: 87.453407,
  KHR: 4063.157895,
  KID: 1.48436,
  KMF: 447.278487,
  KRW: 1335.360704,
  KWD: 0.311342,
  KYD: 0.833333,
  KZT: 444.34436,
  LAK: 22344.408775,
  LBP: 89500.0,
  LKR: 332.614594,
  LRD: 169.562219,
  LSL: 16.929365,
  LYD: 6.458359,
  MAD: 9.969406,
  MDL: 18.254106,
  MGA: 4579.234102,
  MKD: 54.865608,
  MMK: 2101.068478,
  MNT: 3602.456854,
  MOP: 8.081579,
  MRU: 40.690473,
  MUR: 47.856783,
  MVR: 15.447647,
  MWK: 1744.899877,
  MXN: 18.442572,
  MYR: 4.093341,
  MZN: 63.721322,
  NAD: 16.929365,
  NGN: 1352.738411,
  NIO: 36.830151,
  NOK: 9.623495,
  NPR: 149.625899,
  NZD: 1.818615,
  OMR: 0.384497,
  PAB: 1.0,
  PEN: 3.41413,
  PGK: 4.526625,
  PHP: 63.683951,
  PKR: 276.818953,
  PLN: 4.002539,
  PYG: 6201.196113,
  QAR: 3.64,
  RON: 4.863092,
  RSD: 106.932051,
  RUB: 82.343695,
  RWF: 1479.712832,
  SAR: 3.75,
  SBD: 8.017727,
  SCR: 14.762627,
  SDG: 446.888567,
  SEK: 10.116792,
  SGD: 1.288508,
  SHP: 0.757555,
  SLE: 23.06523,
  SLL: 23065.229822,
  SOS: 571.851852,
  SRD: 37.553204,
  SSP: 5751.280712,
  STN: 22.274474,
  SYP: 121.79865,
  SZL: 16.929365,
  THB: 33.82355,
  TJS: 9.208671,
  TMT: 3.5,
  TND: 3.031605,
  TOP: 2.397597,
  TRY: 50.448894,
  TTD: 6.765163,
  TVD: 1.48436,
  TWD: 32.967382,
  TZS: 2645.508886,
  UAH: 45.401903,
  UGX: 4047.220753,
  UYU: 40.684563,
  UZS: 11984.031548,
  VES: 916.6477,
  VND: 25704.339633,
  VUV: 120.845917,
  WST: 2.778094,
  XAF: 596.371316,
  XCD: 2.7,
  XCG: 1.79,
  XDR: 0.743691,
  XOF: 596.371316,
  XPF: 108.492145,
  YER: 236.637722,
  ZAR: 16.926458,
  ZMW: 20.60103,
  ZWG: 26.6142,
  ZWL: 26.6142,
};

const STATIC_FILTER_LIMITS = {
  _comment: "Filter slider bounds per currency. 'default' in USD, converted for unlisted currencies.",
  default: {
    min: 0,
    max: 100000,
    step: 100
  }
};

const CURRENCY_FORMAT_MAP = {
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
let memoryRatesDate = FALLBACK_RATES_DATE;
let memoryRatesSource = "fallback";
let inFlightRatesPromise = null;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const RATES_LOCALE_BY_LANGUAGE = {
  eng: "en-US",
  en: "en-US",
  rus: "ru-RU",
  ru: "ru-RU",
  kaz: "kk-KZ",
  kk: "kk-KZ",
};

function normalizeRatesDate(rawDate) {
  const value = String(rawDate || "").trim();
  if (!value || value.toLowerCase() === "fallback") {
    return FALLBACK_RATES_DATE;
  }
  return value;
}

export function getRatesMetadata() {
  return {
    date: normalizeRatesDate(memoryRatesDate),
    source: String(memoryRatesSource || "fallback").trim().toLowerCase() || "fallback",
  };
}

export function formatRatesTimestamp(dateValue, language = "eng", options = {}) {
  const raw = String(dateValue || "").trim();
  if (!raw || raw.toLowerCase() === "fallback") return "";

  const langKey = String(language || "eng").trim().toLowerCase();
  const locale = RATES_LOCALE_BY_LANGUAGE[langKey] || "en-US";

  // Calendar-only YYYY-MM-DD strings must stay in UTC so negative local offsets do not shift them a day earlier.
  const dateOnlyMatch = raw.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(utcDate.getTime()) ||
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() !== month - 1 ||
      utcDate.getUTCDate() !== day
    ) {
      return "";
    }
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(utcDate);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const formatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };
  if (options.timeZone) {
    formatOptions.timeZone = options.timeZone;
  }

  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(parsed);
  } catch {
    const fallbackOptions = { ...formatOptions };
    delete fallbackOptions.timeZone;
    return new Intl.DateTimeFormat(locale, fallbackOptions).format(parsed);
  }
}

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
  } catch {
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
  } catch {
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
    const cachedSource = String(parsed.source || "cache").trim().toLowerCase();
    if (cachedSource === "fallback") return false;

    if (parsed.rates && typeof parsed.rates === "object" && Object.keys(parsed.rates).length > 0) {
      memoryRates = { ...FALLBACK_RATES, ...parsed.rates };
      if (parsed.filter_limits && typeof parsed.filter_limits === "object") {
        memoryFilterLimits = { ...STATIC_FILTER_LIMITS, ...parsed.filter_limits };
      }
      memoryRatesDate = normalizeRatesDate(parsed.date);
      memoryRatesSource = cachedSource || "cache";
      return true;
    }
  } catch {
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
  } catch {
    // ignore storage write error
  }
}

// Live rates cached earlier in this session apply from the first render of every page.
restoreFromSessionStorage();

const sameRates = (left, right) => Object.keys({ ...left, ...right }).every(code => left[code] === right[code]);

// Starts loading live rates for any page and resolves when they arrive or after `waitMs`, whichever comes first.
// Rates that arrive later and differ announce `currencyRatesUpdated`. It is not `currencyChanged`: pages that rebuild on
// a currency change would reset what the reader is doing, so only views that can redraw prices in place listen to it.
export function startRatesLoading(waitMs = 1000) {
  const before = memoryRates;
  let waited = false;
  const loading = loadRates().then(() => {
    if (!waited || sameRates(before, memoryRates)) return;
    try {
      window.dispatchEvent(new CustomEvent("currencyRatesUpdated", { detail: { currency: getPreferredCurrency() } }));
    } catch {
      // ignore event error
    }
  });
  return Promise.race([loading, new Promise(resolve => setTimeout(resolve, waitMs))]).then(() => { waited = true; });
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
        memoryRatesDate = normalizeRatesDate(json.date);
        memoryRatesSource = String(json.source || "api").trim().toLowerCase() || "api";

        if (memoryRatesSource !== "fallback") {
          persistToSessionStorage({
            rates: memoryRates,
            filter_limits: memoryFilterLimits,
            date: memoryRatesDate,
            source: memoryRatesSource,
          });
        }
      }
    } catch {
      // If fetch fails, keep cached or static fallback
      if (!restoreFromSessionStorage()) {
        memoryRates = { ...FALLBACK_RATES };
        memoryFilterLimits = { ...STATIC_FILTER_LIMITS };
        memoryRatesDate = FALLBACK_RATES_DATE;
        memoryRatesSource = "fallback";
      }
    } finally {
      inFlightRatesPromise = null;
      try {
        window.dispatchEvent(new CustomEvent("currencyRatesStatusUpdated", {
          detail: getRatesMetadata(),
        }));
      } catch {
        // ignore event error
      }
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
  if (m < Math.SQRT2) {
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

  const stepVal = override.step !== undefined ? Math.max(1, Number(override.step)) : niceStep(convStep);
  const minVal = override.min !== undefined ? Math.max(0, Number(override.min)) : Math.max(0, Math.round(convMin));
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
function getNumberFormatter(maxDigits, locale = numberLocale()) {
  const cacheKey = `${locale}:${maxDigits}`;
  let fmt = _numberFormatCache.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      maximumFractionDigits: maxDigits,
      minimumFractionDigits: 0,
    });
    _numberFormatCache.set(cacheKey, fmt);
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
  const numFormatted = getNumberFormatter(maxDigits).format(num);

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

function roundToSignificantFigures(amount, significantDigits = 2) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num === 0) return num;

  const exponent = Math.floor(Math.log10(Math.abs(num)));
  const unit = Math.pow(10, exponent - significantDigits + 1);
  return Math.round(num / unit) * unit;
}

function canConvert(from, to) {
  if (from === to) return true;
  const rates = memoryRates || FALLBACK_RATES;
  return [from, to].every(code => (rates[code] || FALLBACK_RATES[code]) > 0);
}

// A converted amount is an estimate: a summary rounds it to two significant figures and writes millions and more in
// compact local notation ("≈ 30 млн ₸"), while the original published price always stays exact.
function formatConverted(amount, code, options = {}) {
  if (options.presentation !== "summary") return formatMoney(amount, code);
  if (Math.abs(amount) >= 1_000_000) {
    return formatCurrency(amount, code, {
      locale: options.locale || "en-US", notation: "compact", maximumSignificantDigits: 2, currencyDisplay: "narrowSymbol",
    });
  }
  return formatMoney(roundToSignificantFigures(amount), code);
}

function priceParts(values, originalCurrency, options) {
  const origCode = String(originalCurrency || "USD").trim().toUpperCase();
  const prefCode = getPreferredCurrency();
  const mode = getCurrencyDisplayMode();
  const original = values.map(value => formatMoney(value, origCode)).join(" – ");
  // Without a rate for either currency the published price is shown as it is rather than mislabeled.
  if (options.original || origCode === prefCode || mode === "original" || !canConvert(origCode, prefCode)) return original;
  const converted = `≈ ${values.map(value => formatConverted(convert(value, origCode, prefCode), prefCode, options)).join(" – ")}`;
  return mode === "both" ? `${converted} (${original})` : converted;
}

// `options.presentation: "summary"` rounds converted amounts for cards and headlines; `options.locale` names the
// interface locale for compact notation.
export function formatPrice(amount, originalCurrency = "USD", options = {}) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  return priceParts([num], originalCurrency, options);
}

// A published price range in the reader's currency; equal ends read as one amount.
export function formatPriceRange(min, max, originalCurrency = "USD", options = {}) {
  const low = Number(min);
  const high = Number(max);
  if (min === null || min === undefined || min === "" || !Number.isFinite(low)) return "—";
  if (max === null || max === undefined || max === "" || !Number.isFinite(high) || high === low) return formatPrice(low, originalCurrency, options);
  return priceParts([low, high], originalCurrency, options);
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
      } catch {
        // ignore
      }
    }
  });
}
