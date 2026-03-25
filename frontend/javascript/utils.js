/* 1. utils.js - Базовые настройки, утилиты и работа с профилем */

export const API_BASE = window.API_BASE_URL || "http://127.0.0.1:8000";
const AI_DEFAULTS = { fit: "UniFit", chance: "UniChance" };
export const AI_FUNCTIONS = { ...AI_DEFAULTS, ...(window.AI_FUNCTIONS || {}) };

export function aiName(key) {
  const k = String(key || "").trim().toLowerCase();
  return AI_FUNCTIONS[k] || AI_DEFAULTS[k] || "AI Function";
}

export const $ = (id) => document.getElementById(id);

const GLOBAL_LOADING_OVERLAY_ID = "globalLoadingOverlay";
const GLOBAL_LOADING_ACTIVE_CLASS = "global-loading-active";
const GLOBAL_LOADING_SHOW_DELAY_MS = 120;
const GLOBAL_LOADING_MIN_VISIBLE_MS = 220;

let __globalLoaderInstalled = false;
let __globalPendingCount = 0;
let __globalShowTimer = 0;
let __globalHideTimer = 0;
let __globalVisible = false;
let __globalVisibleAt = 0;

function getRequestUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;
  return "";
}

function isBackendApiRequest(input) {
  const raw = getRequestUrl(input);
  if (!raw) return false;
  try {
    const reqUrl = new URL(raw, window.location.origin);
    const apiUrl = new URL(API_BASE, window.location.origin);
    if (reqUrl.origin !== apiUrl.origin) return false;

    const apiPath = String(apiUrl.pathname || "/");
    const apiPrefix = apiPath.endsWith("/") ? apiPath : `${apiPath}/`;
    return reqUrl.pathname === apiPath || reqUrl.pathname.startsWith(apiPrefix) || apiPrefix === "/";
  } catch (e) {
    return raw.startsWith(API_BASE);
  }
}

function ensureGlobalLoadingOverlayNode() {
  if (typeof document === "undefined" || !document.body) return null;
  let node = document.getElementById(GLOBAL_LOADING_OVERLAY_ID);
  if (node) return node;

  node = document.createElement("div");
  node.id = GLOBAL_LOADING_OVERLAY_ID;
  node.className = "global-loading-overlay";
  node.setAttribute("aria-hidden", "true");
  node.innerHTML = `<div class="center-loading" role="status" aria-label="Loading"><div class="center-loading-spinner" aria-hidden="true"></div></div>`;
  document.body.appendChild(node);
  return node;
}

function setGlobalLoadingVisible(visible) {
  const node = ensureGlobalLoadingOverlayNode();
  if (!node) return;
  if (visible) {
    node.classList.add("is-visible");
    node.setAttribute("aria-hidden", "false");
    document.body.classList.add(GLOBAL_LOADING_ACTIVE_CLASS);
    __globalVisibleAt = Date.now();
    __globalVisible = true;
    return;
  }
  node.classList.remove("is-visible");
  node.setAttribute("aria-hidden", "true");
  document.body.classList.remove(GLOBAL_LOADING_ACTIVE_CLASS);
  __globalVisible = false;
}

function onGlobalApiRequestStart() {
  __globalPendingCount += 1;

  if (__globalHideTimer) {
    clearTimeout(__globalHideTimer);
    __globalHideTimer = 0;
  }
  if (__globalVisible || __globalShowTimer) return;

  __globalShowTimer = window.setTimeout(() => {
    __globalShowTimer = 0;
    if (__globalPendingCount > 0) setGlobalLoadingVisible(true);
  }, GLOBAL_LOADING_SHOW_DELAY_MS);
}

function onGlobalApiRequestEnd() {
  __globalPendingCount = Math.max(0, __globalPendingCount - 1);
  if (__globalPendingCount > 0) return;

  if (__globalShowTimer) {
    clearTimeout(__globalShowTimer);
    __globalShowTimer = 0;
  }

  if (!__globalVisible) return;
  const elapsed = Date.now() - __globalVisibleAt;
  const wait = Math.max(0, GLOBAL_LOADING_MIN_VISIBLE_MS - elapsed);
  __globalHideTimer = window.setTimeout(() => {
    __globalHideTimer = 0;
    if (__globalPendingCount === 0) setGlobalLoadingVisible(false);
  }, wait);
}

export function initGlobalApiLoadingIndicator() {
  if (__globalLoaderInstalled || typeof window === "undefined" || typeof window.fetch !== "function") return;
  __globalLoaderInstalled = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureGlobalLoadingOverlayNode();
    }, { once: true });
  } else {
    ensureGlobalLoadingOverlayNode();
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const tracked = isBackendApiRequest(input);
    if (tracked) onGlobalApiRequestStart();
    try {
      return await originalFetch(input, init);
    } finally {
      if (tracked) onGlobalApiRequestEnd();
    }
  };
}

const THEME_STORAGE_KEY = "unisearch_theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
let __themeWatchBound = false;
let __themeAnimTimer = 0;
let __themeAnimFrame = 0;

function _readStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === THEME_DARK || v === THEME_LIGHT ? v : "";
  } catch (e) {
    return "";
  }
}

function _systemTheme() {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return THEME_DARK;
    }
  } catch (e) {
    // ignore
  }
  return THEME_LIGHT;
}

export function getCurrentTheme() {
  const attr = String(document.documentElement.getAttribute("data-theme") || "").trim().toLowerCase();
  if (attr === THEME_DARK) return THEME_DARK;
  if (attr === THEME_LIGHT) return THEME_LIGHT;
  return _systemTheme();
}

export function applyTheme(theme, opts = {}) {
  const next = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
  const persist = !!opts.persist;
  const animate = opts.animate !== false;
  const root = document.documentElement;
  const applyNow = () => {
    root.setAttribute("data-theme", next);
    root.style.colorScheme = next;
  };

  if (animate) {
    root.classList.add("theme-animating");
    if (__themeAnimFrame) window.cancelAnimationFrame(__themeAnimFrame);
    if (__themeAnimTimer) window.clearTimeout(__themeAnimTimer);
    __themeAnimFrame = window.requestAnimationFrame(() => {
      __themeAnimFrame = 0;
      applyNow();
      __themeAnimTimer = window.setTimeout(() => {
        root.classList.remove("theme-animating");
        __themeAnimTimer = 0;
      }, 220);
    });
  } else {
    applyNow();
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (e) {
      // ignore
    }
  }
  window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme: next } }));
  return next;
}

export function initTheme() {
  const stored = _readStoredTheme();
  const resolved = stored || _systemTheme();
  applyTheme(resolved, { persist: false, animate: false });

  if (!__themeWatchBound && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (_readStoredTheme()) return;
      applyTheme(_systemTheme(), { persist: false, animate: true });
    };
    try {
      mq.addEventListener("change", onChange);
      __themeWatchBound = true;
    } catch (e) {
      // Fallback for old browsers.
      if (typeof mq.addListener === "function") {
        mq.addListener(onChange);
        __themeWatchBound = true;
      }
    }
  }

  return resolved;
}

export function toggleTheme() {
  const next = getCurrentTheme() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  return applyTheme(next, { persist: true });
}

const PROFILE_STORAGE_KEY = "unisearch_profile";
const I18N_STORAGE_KEY = "unisearch_ui_language_v1";
const API_LANG_DEFAULT = "eng";
const API_LANG_SUPPORTED = new Set(["eng", "rus"]);
let __profileMemoryFallback = null;
// 🔥 ДОБАВЛЕНО: Новые поля в дефолтном профиле
const PROFILE_DEFAULTS = { 
    name: "User", 
    budget: "", 
    gpa: "",
    exams: [], 
    languages: [],   // ✅ новое поле
    major: "", 
    interests: "",
    studyMode: "Any",
    fundingType: "any",
};

export let EXAM_CONFIG = {
        "SAT": {"min": 400, "max": 1600, "type": "int", "step": 10},
        "ACT": {"min": 1, "max": 36, "type": "int", "step": 1},
        "GPA": {"min": 0, "max": 100, "type": "int", "step": 1},
        "IELTS": {"min": 0, "max": 9, "type": "float", "step": 0.5},
        "TOEFL": {"min": 0, "max": 120, "type": "int", "step": 1},
        "UNT": {"min": 0, "max": 140, "type": "int", "step": 1},
        "NUET": {"min": 0, "max": 240, "type": "int", "step": 1},
        "AP_Total": {"min": 0, "max": 25, "type": "int", "step": 1},
        "IB_Diploma": {"min": 24, "max": 45, "type": "int", "step": 1}
    };

let __examConfigPromise = null;
async function loadExamConfig() {
  if (__examConfigPromise) return __examConfigPromise;
  __examConfigPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/exams/config`);
      if (!response.ok) throw new Error("Failed to load exam config");
      
      const raw = await response.json();

      // Поддерживаем оба формата:
      // 1) { "SAT": {min,max,...}, ... }
      // 2) { version, exams: { ... } }
      EXAM_CONFIG = raw?.exams ? raw.exams : raw;

      window.dispatchEvent(new Event("examConfigLoaded"));
    } catch (error) {
      console.error("❌ Error loading exam config:", error);
      EXAM_CONFIG = {
          "SAT": {"min": 400, "max": 1600, "type": "int", "step": 10},
          "ACT": {"min": 1, "max": 36, "type": "int", "step": 1},
          "GPA": {"min": 0, "max": 100, "type": "int", "step": 1},
          "IELTS": {"min": 0, "max": 9, "type": "float", "step": 0.5},
          "TOEFL": {"min": 0, "max": 120, "type": "int", "step": 1},
          "UNT": {"min": 0, "max": 140, "type": "int", "step": 1},
          "NUET": {"min": 0, "max": 240, "type": "int", "step": 1},
          "AP_Total": {"min": 0, "max": 25, "type": "int", "step": 1},
          "IB_Diploma": {"min": 24, "max": 45, "type": "int", "step": 1}
      };
    }
    return EXAM_CONFIG;
  })();
  return __examConfigPromise;
}

export function ensureExamConfig() {
  return loadExamConfig();
}

export let LANG_CONFIG = null;

let __langConfigPromise = null;
async function loadLanguageConfig() {
  if (__langConfigPromise) return __langConfigPromise;
  __langConfigPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/languages/config`);
      if (!response.ok) throw new Error("Failed to load language config");
      LANG_CONFIG = await response.json();
      window.dispatchEvent(new Event("languageConfigLoaded"));
    } catch (error) {
      console.error("❌ Error loading language config:", error);
      LANG_CONFIG = null;
    }
    return LANG_CONFIG;
  })();
  return __langConfigPromise;
}

export function ensureLanguageConfig() {
  return loadLanguageConfig();
}


export let CITY_OPTIONS_BY_COUNTRY = {};

let __cityDbPromise = null;
async function loadCityDatabase() {
  if (__cityDbPromise) return __cityDbPromise;
  __cityDbPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/locations`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      CITY_OPTIONS_BY_COUNTRY = data;
      window.dispatchEvent(new Event("citiesLoaded"));
    } catch (error) {
      console.error("❌ Ошибка при загрузке городов:", error);
    }
    return CITY_OPTIONS_BY_COUNTRY;
  })();
  return __cityDbPromise;
}

export function ensureCityDatabase() {
  return loadCityDatabase();
}

export const MAJOR_OPTIONS = [
  "Computer Science",
  "Engineering",
  "Business",
  "Medicine",
  "Natural Sciences",
  "Economics",
  "Physics",
  "Mathematics",
  "Law",
  "Social Sciences",
  "Architecture",
  "Psychology",
  "Humanities",
  "Design",
  "Life Sciences",
  "Education",
  "Agriculture"
];

// --- Helpers ---
export function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function stabilizeNumericRanges(text) {
  return String(text || "").replace(/(\d[\d\s.,]*)\s*-\s*(\d[\d\s.,]*)/g, (_, left, right) => {
    return `${String(left || "").trimEnd()}\u2011${String(right || "").trimStart()}`;
  });
}

export function escapeHtml(str) {
  const normalized = stabilizeNumericRanges(String(str ?? ""));
  return normalized.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function nested(obj, path, fallback = null) {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return fallback;
    cur = cur[key];
  }
  return (cur === undefined || cur === null) ? fallback : cur;
}

export function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).slice(0, 2);
  return (parts.map(p => (p[0] || "").toUpperCase()).join("") || "U");
}

export function moneyUSD(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  return "$" + new Intl.NumberFormat("en-US").format(n);
}

const EXAM_KEY_ALIASES = {
  NUET: ["NUET_TOTAL", "NUETTOTAL"],
  NUET_TOTAL: ["NUET", "NUETTOTAL"],
  NUETTOTAL: ["NUET", "NUET_TOTAL"],
  TOEFL: ["TOEFL_IBT", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
  TOEFL_IBT: ["TOEFL", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
};

function canonicalExamKey(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function canonicalizeExamId(examId) {
  const raw = String(examId || "").trim().toUpperCase();
  if (!raw) return "";

  const cfg = EXAM_CONFIG || {};
  if (cfg[raw]) return raw;

  const rawCanon = canonicalExamKey(raw);
  for (const k of Object.keys(cfg)) {
    if (canonicalExamKey(k) === rawCanon) return k;
  }

  const aliases = EXAM_KEY_ALIASES[raw] || [];
  for (const a of aliases) {
    const alias = String(a || "").trim().toUpperCase();
    if (cfg[alias]) return alias;
    const aliasCanon = canonicalExamKey(alias);
    for (const k of Object.keys(cfg)) {
      if (canonicalExamKey(k) === aliasCanon) return k;
    }
  }

  return raw;
}

const EXAM_LABEL_OVERRIDES = {
  SAT: "SAT",
  ACT: "ACT",
  GPA: "GPA",
  UNT: "UNT (ЕНТ)",
  NUET_Total: "NUET Total",
  NUET: "NUET Total",
  NUET_TOTAL: "NUET Total",
  AP_Total: "AP Total",
  IB_Diploma: "IB Diploma",
  IELTS: "IELTS Academic",
  TOEFL_iBT_0_120: "TOEFL iBT (0‑120)",
  TOEFL_iBT_1_6: "TOEFL iBT (1‑6)",
  DET: "Duolingo English Test (DET)",
  PTE: "PTE Academic",
  Cambridge_C1_Advanced: "Cambridge C1 Advanced",
  TestDaF_TDN: "TestDaF (TDN)",
  DSH_Level: "DSH Level",
  DELF_DALF_Level: "DELF/DALF Level",
  TCF_Total: "TCF Total",
  NT2_Programme_II: "NT2 Programme II",
  HSK_Level: "HSK Level",
  JLPT_Level: "JLPT Level",
  TOPIK_Level: "TOPIK Level",
};

const EXAM_LABELS_I18N = {
  eng: {
    SAT: "SAT",
    ACT: "ACT",
    GPA: "GPA",
    UNT: "UNT (Kazakhstan)",
    NUET: "NUET Total",
    NUETTOTAL: "NUET Total",
    APTOTAL: "AP Total",
    IBDIPLOMA: "IB Diploma",
    ALEVELCERT: "A-Level Certificate",
    HKDSELEVEL: "HKDSE level",
    SWISSMATURITYCERT: "Swiss Maturity Certificate",
    GERMANABITURCERT: "German Abitur Certificate",
    OSSDCERT: "OSSD (Ontario Secondary School Diploma)",
    IELTS: "IELTS Academic",
    TOEFLIBT0120: "TOEFL iBT Total (0‑120, legacy)",
    TOEFLIBT16: "TOEFL iBT Band (1‑6, since Jan 21, 2026)",
    DET: "Duolingo English Test (DET)",
    PTE: "PTE Academic",
    CAMBRIDGEC1ADVANCED: "Cambridge C1 Advanced",
    TESTDAFTDN: "TestDaF (TDN level)",
    DSHLEVEL: "DSH level",
    DELFDALFLEVEL: "DELF/DALF level",
    TCFTOTAL: "TCF total score",
    NT2PROGRAMMEII: "NT2 Programme II",
    HSKLEVEL: "HSK level",
    JLPTLEVEL: "JLPT level",
    TOPIKLEVEL: "TOPIK level",
  },
  rus: {
    SAT: "SAT",
    ACT: "ACT",
    GPA: "GPA",
    UNT: "ЕНТ",
    NUET: "NUET (общий балл)",
    NUETTOTAL: "NUET (общий балл)",
    APTOTAL: "AP (общий балл)",
    IBDIPLOMA: "Диплом IB",
    ALEVELCERT: "A-Level сертификат",
    HKDSELEVEL: "HKDSE уровень",
    SWISSMATURITYCERT: "Швейцарский аттестат зрелости",
    GERMANABITURCERT: "Немецкий Abitur",
    OSSDCERT: "OSSD (Ontario Secondary School Diploma)",
    IELTS: "IELTS (академический модуль)",
    TOEFLIBT0120: "TOEFL iBT общий балл (0‑120, старая шкала)",
    TOEFLIBT16: "TOEFL iBT шкала 1‑6 (с 21 янв 2026)",
    DET: "Тест Duolingo по английскому (DET)",
    PTE: "PTE Academic (академический)",
    CAMBRIDGEC1ADVANCED: "Cambridge C1 Advanced (продвинутый уровень)",
    TESTDAFTDN: "TestDaF (уровень TDN)",
    DSHLEVEL: "DSH уровень",
    DELFDALFLEVEL: "DELF/DALF уровень",
    TCFTOTAL: "TCF (общий балл)",
    NT2PROGRAMMEII: "NT2 Programme II (программа II)",
    HSKLEVEL: "HSK уровень",
    JLPTLEVEL: "JLPT уровень",
    TOPIKLEVEL: "TOPIK уровень",
  },
};

function _localizedExamLabel(examId, locale = "") {
  const lang = normalizeUiLanguageForApi(locale) || getUiLanguageForApi();
  const pack = EXAM_LABELS_I18N[lang] || EXAM_LABELS_I18N.eng;
  const fallbackPack = EXAM_LABELS_I18N.eng;

  const candidates = [
    canonicalExamKey(examId),
    canonicalExamKey(canonicalizeExamId(examId)),
    canonicalExamKey(String(examId || "").toUpperCase()),
  ].filter(Boolean);

  for (const key of candidates) {
    if (pack[key]) return pack[key];
  }
  for (const key of candidates) {
    if (fallbackPack[key]) return fallbackPack[key];
  }
  return "";
}

function humanizeExamId(examId) {
  const s = String(examId || "").trim();
  if (!s) return "";
  return s
    .replaceAll("_", " ")
    .replace(/\bIbt\b/g, "iBT")
    .replace(/\bNuet\b/g, "NUET")
    .replace(/\bDsh\b/g, "DSH")
    .replace(/\bTdn\b/g, "TDN")
    .replace(/\bJlpt\b/g, "JLPT")
    .replace(/\bTopik\b/g, "TOPIK")
    .replace(/\bHsk\b/g, "HSK")
    .replace(/\bTcf\b/g, "TCF")
    .replace(/\bDelf\b/g, "DELF")
    .replace(/\bDalf\b/g, "DALF");
}

function getLangExamLabel(examId, langCode = "") {
  const targetId = String(examId || "").trim();
  if (!targetId) return "";

  const groups = LANG_CONFIG?.language_exams;
  if (!groups || typeof groups !== "object") return "";

  const code = String(langCode || "").trim().toLowerCase();
  if (code && Array.isArray(groups[code])) {
    const found = groups[code].find((x) => String(x?.id || "").trim() === targetId);
    if (found?.label) return String(found.label);
  }

  for (const arr of Object.values(groups)) {
    if (!Array.isArray(arr)) continue;
    const found = arr.find((x) => String(x?.id || "").trim() === targetId);
    if (found?.label) return String(found.label);
  }

  return "";
}

export function getExamDisplayName(examId, opts = {}) {
  const raw = String(examId || "").trim();
  if (!raw) return "";
  const id = canonicalizeExamId(raw);
  const uiLocale = String(opts?.locale || opts?.lang || opts?.uiLang || "").trim();

  const localized = _localizedExamLabel(id || raw, uiLocale);
  if (localized) return localized;

  const langLabel = getLangExamLabel(raw, opts.langCode || "");
  if (langLabel) return langLabel;

  const cfgLabel = EXAM_CONFIG?.[id]?.label || EXAM_CONFIG?.[raw]?.label || EXAM_CONFIG?.[raw.toUpperCase()]?.label;
  if (cfgLabel) return String(cfgLabel);

  if (EXAM_LABEL_OVERRIDES[id]) return EXAM_LABEL_OVERRIDES[id];
  if (EXAM_LABEL_OVERRIDES[raw]) return EXAM_LABEL_OVERRIDES[raw];
  if (EXAM_LABEL_OVERRIDES[raw.toUpperCase()]) return EXAM_LABEL_OVERRIDES[raw.toUpperCase()];

  return humanizeExamId(raw);
}

export function setUrlParams(params) {
  const url = new URL(window.location.href);
  url.search = params.toString();
  window.history.replaceState({}, "", url.toString());
}

export function showToast(message, type = "error") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✅" : "⚠️";
    
    toast.innerHTML = `<span>${icon} ${escapeHtml(message)}</span><button class="toast-close">&times;</button>`;
    toast.querySelector(".toast-close").onclick = () => removeToast(toast);
    setTimeout(() => removeToast(toast), 3000);
    container.appendChild(toast);
}

export function removeToast(toast) {
    toast.style.animation = "fadeOut 0.3s ease forwards";
    toast.addEventListener("animationend", () => {
        if(toast.parentNode) toast.parentNode.removeChild(toast);
    });
}

// --- Управление профилем ---
export function loadProfile() {
  const readMemoryFallback = () => {
    if (!__profileMemoryFallback || typeof __profileMemoryFallback !== "object") return null;
    return normalizeProfileData(__profileMemoryFallback);
  };

  try {
    const s = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!s) {
      const fromMemory = readMemoryFallback();
      if (fromMemory) return fromMemory;
      return normalizeProfileData({});
    }
    const raw = JSON.parse(s);
    const normalized = normalizeProfileData(raw);

    // optional: если хочешь автоматически почистить localStorage от мусора
    // localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));

    __profileMemoryFallback = normalized;
    return normalized;
  } catch (e) {
    const fromMemory = readMemoryFallback();
    if (fromMemory) return fromMemory;
    return normalizeProfileData({});
  }
}

function normalizeUiLanguageForApi(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (API_LANG_SUPPORTED.has(raw)) return raw;
  if (raw.startsWith("en")) return "eng";
  if (raw.startsWith("ru")) return "rus";
  return "";
}

export function getUiLanguageForApi() {
  try {
    const stored = normalizeUiLanguageForApi(localStorage.getItem(I18N_STORAGE_KEY));
    if (stored) return stored;
  } catch (e) {
    // ignore storage issues
  }

  try {
    const first = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages[0]
      : (navigator.language || "");
    const detected = normalizeUiLanguageForApi(first);
    if (detected) return detected;
  } catch (e) {
    // ignore navigator issues
  }

  return API_LANG_DEFAULT;
}

export function loadProfileForApi() {
  const profile = loadProfile();
  const payload = {
    ...profile,
    locale: getUiLanguageForApi(),
  };

  const budget = Number(profile?.budget);
  if (Number.isFinite(budget) && budget >= 0) payload.budget = budget;
  else delete payload.budget;

  const gpa = Number(profile?.gpa);
  if (Number.isFinite(gpa) && gpa >= 0) payload.gpa = gpa;
  else delete payload.gpa;

  payload.exams = (Array.isArray(profile?.exams) ? profile.exams : [])
    .map((row) => {
      const id = String(row?.id || row?.exam || "").trim();
      const score = Number(row?.score);
      if (!id || !Number.isFinite(score)) return null;
      return { id, score };
    })
    .filter(Boolean);

  payload.languages = (Array.isArray(profile?.languages) ? profile.languages : [])
    .map((row) => {
      const code = String(row?.code || row?.lang || "").trim();
      const kind = String(row?.kind || "").trim().toLowerCase();
      if (!code || !kind) return null;
      if (kind === "native") return { code, kind: "native" };
      if (kind === "cefr") {
        const level = Number(row?.level);
        if (!Number.isInteger(level) || level < 1 || level > 6) return null;
        return { code, kind: "cefr", level };
      }
      if (kind === "exam") {
        const exam = String(row?.exam || row?.examId || "").trim();
        const score = Number(row?.score);
        if (!exam || !Number.isFinite(score)) return null;
        return { code, kind: "exam", exam, score };
      }
      return null;
    })
    .filter(Boolean);

  if (!String(payload.interests || "").trim()) delete payload.interests;
  if (!String(payload.major || "").trim()) delete payload.major;
  if (!String(payload.name || "").trim()) delete payload.name;
  if (!String(payload.studyMode || "").trim()) payload.studyMode = "Any";
  if (!String(payload.fundingType || "").trim()) payload.fundingType = "any";

  return payload;
}

const FALLBACK_LANG_LIMITS = {
  "IELTS": { min: 0, max: 9, step: 0.5 },
  "TOEFL": { min: 0, max: 120, step: 1 },
  "Duolingo": { min: 10, max: 160, step: 1 },
  "DET": { min: 10, max: 160, step: 1 },       // если используешь DET как отдельный ключ
  "Cambridge": { min: 80, max: 230, step: 1 },
  "PTE": { min: 10, max: 90, step: 1 },
};

export function saveProfile(p) {
  const normalized = normalizeProfileData(p);
  __profileMemoryFallback = normalized;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn("Failed to persist profile in localStorage; using in-memory fallback.", e);
  }
  window.dispatchEvent(new Event("profileUpdated"));
}


/* --- Сохранение фильтров (ОЧИЩЕНО) --- */
const FILTERS_KEY = "unisearch_filters";
let __filtersMemoryFallback = {};

export function saveFilters(state) {
    if (!state) return;
    
    const dataToSave = { 
        q: state.q,
        country: state.country,
        region: state.region,
        city: state.city,
        // funding type now comes from profile.fundingType
        study_level: state.study_level,
        min_tuition: state.min_tuition,
        max_tuition: state.max_tuition,
        sort: state.sort,
        practice_vs_science: state.practice_vs_science,
        social_vs_hardcore: state.social_vs_hardcore,
        budget_vs_prestige: state.budget_vs_prestige,
        city_vs_campus: state.city_vs_campus,
        viewMode: state.viewMode || "list"
    };
    __filtersMemoryFallback = { ...dataToSave };
    try {
        localStorage.setItem(FILTERS_KEY, JSON.stringify(dataToSave));
    } catch (e) {
        console.warn("Failed to persist filters in localStorage; using in-memory fallback.", e);
    }
}

export function loadFilters() {
    try {
        const saved = localStorage.getItem(FILTERS_KEY);
        if (!saved) return { ...__filtersMemoryFallback };
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { ...__filtersMemoryFallback };
        }
        __filtersMemoryFallback = { ...parsed };
        return parsed;
    } catch (e) {
        console.warn("Error loading filters; using in-memory fallback.", e);
        return { ...__filtersMemoryFallback };
    }
}

// --- Flags ---
const COUNTRY_CODES = {
  "Kazakhstan": "kz", "USA": "us", "South Korea": "kr", "Japan": "jp",
  "Hong Kong": "hk", "UK": "gb", "Switzerland": "ch", "Canada": "ca",
  "Australia": "au", "China": "cn", "Singapore": "sg", "Germany": "de", "Netherlands": "nl"
};

const LANGUAGE_FLAG_CODES = {
  eng: "us",
  rus: "ru",
};
const FLAG_IMG_HTML_CACHE = new Map();

let __customSelectGlobalClickBound = false;
function bindCustomSelectGlobalClick() {
  if (__customSelectGlobalClickBound || typeof document === "undefined") return;
  __customSelectGlobalClickBound = true;
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    document.querySelectorAll(".custom-select-wrapper.open").forEach((wrapper) => {
      if (!wrapper.contains(target)) wrapper.classList.remove("open");
    });
  });
}

export function getFlagImg(countryName) {
  const raw = String(countryName || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const code = COUNTRY_CODES[raw] || COUNTRY_CODES[raw.toUpperCase()] || COUNTRY_CODES[lower] || LANGUAGE_FLAG_CODES[lower];
  if (!code) return "";
  const cacheKey = `${code}|${raw}`;
  const cached = FLAG_IMG_HTML_CACHE.get(cacheKey);
  if (cached) return cached;
  const html = `<img class="flag-icon-inline" src="https://flagcdn.com/${code}.svg" width="24" height="15" loading="lazy" decoding="async" alt="${escapeHtml(raw)}">`;
  FLAG_IMG_HTML_CACHE.set(cacheKey, html);
  return html;
}

export function initCustomSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    bindCustomSelectGlobalClick();
    const isLanguageSelect = selectId === "languageSelect";
    let wrapper = select.parentNode;
    const alreadyWrapped = wrapper && wrapper.classList.contains("custom-select-wrapper");

    if (!alreadyWrapped) {
        wrapper = document.createElement("div");
        wrapper.classList.add("custom-select-wrapper");
        select.parentNode.insertBefore(wrapper, select.nextSibling);
        wrapper.appendChild(select);
        select.classList.add("u-select-hidden");
    } else {
        select.classList.add("u-select-hidden");
    }

    let trigger = wrapper.querySelector(".custom-select-trigger");
    if (!trigger) {
        trigger = document.createElement("div");
        trigger.classList.add("custom-select-trigger");
        wrapper.appendChild(trigger);
    }
    if (isLanguageSelect) {
        wrapper.classList.add("custom-select-wrapper--language");
        trigger.classList.add("custom-select-trigger--language");
    }

    let customOptions = wrapper.querySelector(".custom-options");
    if (!customOptions) {
        customOptions = document.createElement("div");
        customOptions.classList.add("custom-options");
        wrapper.appendChild(customOptions);
    }

    const syncSelectedOptionState = () => {
        const currentValue = String(select.value || "");
        customOptions.querySelectorAll(".custom-option").forEach((node) => {
            const value = String(node.getAttribute("data-value") || "");
            node.classList.toggle("selected", value === currentValue);
        });
    };

    function updateTrigger() {
        const selectedOption = select.options[select.selectedIndex];
        if (!selectedOption) return;
        const val = selectedOption.value;
        const text = selectedOption.text;
        const flag = getFlagImg(val);
        if (isLanguageSelect) {
            const shortLabel = ({ eng: "EN", rus: "RU" }[String(val || "").toLowerCase()] || String(val || "").toUpperCase() || text);
            trigger.innerHTML = `<div class="custom-select-trigger-content custom-select-trigger-content--compact">${flag || ""}<span>${escapeHtml(shortLabel)}</span></div>`;
            return;
        }
        if (flag) {
            trigger.innerHTML = `<div class="custom-select-trigger-content">${flag} <span>${escapeHtml(text)}</span></div>`;
        } else {
            trigger.innerHTML = `<span>${escapeHtml(text)}</span>`;
        }
    }

    customOptions.innerHTML = "";
    const optionsFragment = document.createDocumentFragment();
    for (const option of select.options) {
        const div = document.createElement("div");
        div.classList.add("custom-option");
        div.setAttribute("data-value", String(option.value || ""));
        if (option.disabled) div.classList.add("is-disabled");
        const val = option.value;
        const text = option.text;
        const flag = getFlagImg(val);
        if (flag) div.innerHTML = `${flag} <span>${escapeHtml(text)}</span>`;
        else div.textContent = text;

        if (option.selected) div.classList.add("selected");
        optionsFragment.appendChild(div);
    }
    customOptions.appendChild(optionsFragment);

    if (customOptions.dataset.bound !== "1") {
        customOptions.dataset.bound = "1";
        customOptions.addEventListener("click", (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            const optionEl = target.closest(".custom-option");
            if (!(optionEl instanceof Element) || !customOptions.contains(optionEl)) return;
            if (optionEl.classList.contains("is-disabled")) return;

            const nextValue = String(optionEl.getAttribute("data-value") || "");
            const changed = String(select.value || "") !== nextValue;
            select.value = nextValue;
            if (changed) select.dispatchEvent(new Event("change"));
            else {
                updateTrigger();
                syncSelectedOptionState();
            }
            wrapper.classList.remove("open");
        });
    }

    if (wrapper.dataset.bound !== "1") {
        wrapper.dataset.bound = "1";
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".custom-select-wrapper.open").forEach(w => { if (w !== wrapper) w.classList.remove("open"); });
            wrapper.classList.toggle("open");
        });

        select.addEventListener("change", () => {
            updateTrigger();
            syncSelectedOptionState();
        });
    }

    updateTrigger();
    syncSelectedOptionState();
}

export function getLangExamLimits(examId, LANG_CONFIG) {
  const le = LANG_CONFIG?.language_exams;
  if (!le) return null;

  for (const locale of Object.keys(le)) {
    const arr = le[locale];
    if (!Array.isArray(arr)) continue;
    const found = arr.find(x => x?.id === examId);
    if (found) return { min: found.min, max: found.max, step: found.step };
  }
  return null;
}

export function clampNumberToLimits(val, limits) {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  if (!limits) return n;

  let out = n;
  const min = Number(limits.min);
  const max = Number(limits.max);
  const step = Number(limits.step);

  if (Number.isFinite(min)) out = Math.max(min, out);
  if (Number.isFinite(max)) out = Math.min(max, out);

  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    out = base + Math.round((out - base) / step) * step;
    if (Number.isFinite(min)) out = Math.max(min, out);
    if (Number.isFinite(max)) out = Math.min(max, out);
    out = Math.round(out * 1000) / 1000;
  }
  return out;
}

export function applyNumberInputLimits(inputEl, limits) {
  if (!inputEl) return;

  if (!limits) {
    inputEl.removeAttribute("min");
    inputEl.removeAttribute("max");
    inputEl.removeAttribute("step");
    return;
  }

  if (limits.min !== undefined) inputEl.min = String(limits.min);
  if (limits.max !== undefined) inputEl.max = String(limits.max);
  if (limits.step !== undefined) inputEl.step = String(limits.step);
}

export function applyLanguageExamInputLimits(inputEl, examId) {
  // 1) config с сервера
  let limits = getLangExamLimits(examId, LANG_CONFIG);

  // 2) fallback
  if (!limits) limits = FALLBACK_LANG_LIMITS[examId] || null;

  applyNumberInputLimits(inputEl, limits);
  return limits; // удобно для отладки
}


function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function roundToStep(val, min, step) {
  const base = Number.isFinite(min) ? min : 0;
  const out = base + Math.round((val - base) / step) * step;
  return Math.round(out * 1000) / 1000;
}

function clampWithCfg(score, cfg) {
  let v = Number(score);
  if (!Number.isFinite(v)) return null;
  const min = Number.isFinite(Number(cfg?.min)) ? Number(cfg.min) : -Infinity;
  const max = Number.isFinite(Number(cfg?.max)) ? Number(cfg.max) : Infinity;
  const step = Number.isFinite(Number(cfg?.step)) ? Number(cfg.step) : null;

  v = clamp(v, min, max);
  if (step && step > 0) v = roundToStep(v, min, step);
  return clamp(v, min, max);
}

export function normalizeProfileData(p) {
  const out = { ...PROFILE_DEFAULTS, ...(p || {}) };
  const fundingRaw = String(out.fundingType || out.funding_type || "").trim().toLowerCase();
  if (fundingRaw === "grant" || fundingRaw === "paid") out.fundingType = fundingRaw;
  else out.fundingType = "any";
  out.interests = String(out.interests ?? "").trim().slice(0, 1200);

  const gpaCfg = EXAM_CONFIG?.GPA || EXAM_CONFIG?.gpa || { min: 0, max: 100, step: 1 };
  const clampGpa = (v) => {
    const normalized = clampWithCfg(v, gpaCfg);
    return Number.isFinite(normalized) ? normalized : null;
  };
  let normalizedGpa = clampGpa(out.gpa);

  // --- Academic exams: profile.exams = [{id:"SAT", score:1500}, ...]
  if (!Array.isArray(out.exams)) out.exams = [];
  const dedupedExams = new Map();
  out.exams.forEach((it) => {
    const rawId = String(it?.id || it?.exam || "").trim();
    if (!rawId) return;

    const normalizedId = canonicalizeExamId(rawId);
    if (!normalizedId) return;
    const key = canonicalExamKey(normalizedId);

    if (String(normalizedId).toUpperCase() === "GPA") {
      if (normalizedGpa === null) normalizedGpa = clampGpa(it?.score);
      return;
    }

    const cfg = EXAM_CONFIG?.[normalizedId] || EXAM_CONFIG?.[normalizedId.toUpperCase()] || null;
    const clamped = cfg ? clampWithCfg(it?.score, cfg) : it?.score;
    const score = (clamped ?? it?.score);

    if (!dedupedExams.has(key)) {
      dedupedExams.set(key, { ...it, id: normalizedId, exam: normalizedId, score });
      return;
    }

    const existing = dedupedExams.get(key);
    const existingScore = Number(existing?.score);
    const nextScore = Number(score);
    if (Number.isFinite(nextScore) && (!Number.isFinite(existingScore) || nextScore >= existingScore)) {
      dedupedExams.set(key, { ...existing, ...it, id: normalizedId, exam: normalizedId, score });
    }
  });
  out.exams = Array.from(dedupedExams.values());

  // --- Language exams: profile.languages = [{kind:"Exam", exam:"IELTS", score:7.5}, ...]
  if (!Array.isArray(out.languages)) out.languages = [];
  out.languages = out.languages
    .map(it => {
      if (!it || typeof it !== "object") return null;

      const code = String(it?.code || it?.lang || "").trim().toLowerCase();
      const kind = String(it?.kind || "").trim().toLowerCase();
      if (!code || !kind) return null;

      if (kind === "native") {
        return { code, kind };
      }

      if (kind === "cefr") {
        const level = Number(it?.level);
        if (!Number.isInteger(level) || level < 1 || level > 6) return null;
        return { code, kind, level };
      }

      if (kind === "exam") {
        const examId = String(it?.exam || it?.examId || "").trim();
        if (!examId) return null;

        // 1) пробуем из LANG_CONFIG
        let limits = getLangExamLimits(examId, LANG_CONFIG);

        // 2) если не нашли — пробуем fallback
        if (!limits) limits = FALLBACK_LANG_LIMITS[examId] || null;

        const clamped = limits ? clampNumberToLimits(it?.score, limits) : Number(it?.score);
        if (!Number.isFinite(clamped)) return null;

        return { code, kind, exam: examId, score: clamped };
      }

      return null;
    })
    .filter(Boolean);

  out.gpa = (normalizedGpa === null) ? "" : normalizedGpa;
  return out;
}
