const I18N_STORAGE_KEY = "unisearch_ui_language_v1";

const LANG_ENG = "eng";
const LANG_RUS = "rus";
const LANG_KZ = "kz";
const SUPPORTED_LANGS = new Set([LANG_ENG, LANG_RUS, LANG_KZ]);
const LANG_FILE_BY_CODE = {
  [LANG_ENG]: "Localization/eng",
  [LANG_RUS]: "Localization/ru",
  [LANG_KZ]: "Localization/kz",
};
const I18N_PACK_FETCH_TIMEOUT_MS = 4000;

const HTML_LANG_MAP = {
  [LANG_ENG]: "en",
  [LANG_RUS]: "ru",
  [LANG_KZ]: "kk",
};

const DICT = {
  [LANG_ENG]: {},
  [LANG_RUS]: {},
  [LANG_KZ]: {},
};

let currentLang = LANG_ENG;
let __packsLoaded = false;
let __packsLoadPromise = null;

function normalizeLang(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (SUPPORTED_LANGS.has(raw)) return raw;
  if (raw.startsWith("en")) return LANG_ENG;
  if (raw.startsWith("ru")) return LANG_RUS;
  if (raw.startsWith("kk") || raw.startsWith("kz")) return LANG_KZ;
  return "";
}

function detectDeviceLang() {
  const first = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages[0]
    : (navigator.language || "");
  return normalizeLang(first) || LANG_ENG;
}

function readStoredLang() {
  try {
    return normalizeLang(localStorage.getItem(I18N_STORAGE_KEY));
  } catch (e) {
    return "";
  }
}

function writeStoredLang(lang) {
  try {
    localStorage.setItem(I18N_STORAGE_KEY, lang);
  } catch (e) {
    // ignore
  }
}

function setHtmlLang(lang) {
  const htmlLang = HTML_LANG_MAP[lang] || "en";
  document.documentElement.setAttribute("lang", htmlLang);
}

function stabilizeNumericRanges(text) {
  return String(text || "").replace(/(\d[\d\s.,]*)\s*-\s*(\d[\d\s.,]*)/g, (_, left, right) => {
    return `${String(left || "").trimEnd()}\u2011${String(right || "").trimStart()}`;
  });
}

function _parseLocalizationFile(content) {
  const out = {};
  const rows = String(content || "").split(/\r?\n/);
  for (const rawRow of rows) {
    const row = String(rawRow || "").trim();
    if (!row || row.startsWith("#")) continue;
    const idx = row.indexOf(":");
    if (idx <= 0) continue;
    const key = row.slice(0, idx).trim();
    const value = row.slice(idx + 1).trim().replaceAll("\\n", "\n");
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

async function _fetchLocalizationText(file, timeoutMs) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timeoutId = 0;
  const fetchPromise = fetch(file, {
    cache: "no-store",
    ...(controller ? { signal: controller.signal } : {}),
  })
    .then((res) => (res.ok ? res.text() : ""))
    .catch(() => "");

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      try {
        controller?.abort();
      } catch (e) {
        // ignore
      }
      resolve("");
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function _loadLocalizationPacks() {
  if (__packsLoaded) return;
  if (__packsLoadPromise) return __packsLoadPromise;

  __packsLoadPromise = (async () => {
    const langs = [LANG_ENG, LANG_RUS, LANG_KZ];
    await Promise.allSettled(
      langs.map(async (lang) => {
        const file = LANG_FILE_BY_CODE[lang];
        if (!file) return;
        try {
          const raw = await _fetchLocalizationText(file, I18N_PACK_FETCH_TIMEOUT_MS);
          if (!raw) return;
          const parsed = _parseLocalizationFile(raw);
          if (!parsed || typeof parsed !== "object") return;
          DICT[lang] = { ...(DICT[lang] || {}), ...parsed };

          const code = String(parsed["meta.code"] || "").trim();
          const navKey = lang === LANG_ENG ? "nav.lang.eng" : (lang === LANG_RUS ? "nav.lang.rus" : "nav.lang.kz");
          if (code && !String(DICT[lang][navKey] || "").trim()) DICT[lang][navKey] = code.toUpperCase();
        } catch (e) {
          // keep already loaded keys from localization files
        }
      })
    );
    __packsLoaded = true;
  })().catch(() => {
    // keep already loaded keys from localization files
    __packsLoaded = true;
  });

  return __packsLoadPromise;
}

export function getCurrentLanguage() {
  return currentLang;
}

export function t(key, fallback = "") {
  const k = String(key || "").trim();
  if (!k) return stabilizeNumericRanges(String(fallback || ""));
  const active = DICT[currentLang] || {};
  const en = DICT[LANG_ENG] || {};
  const value = active[k];
  if (value !== undefined && value !== null) return stabilizeNumericRanges(String(value));
  const enValue = en[k];
  if (enValue !== undefined && enValue !== null) return stabilizeNumericRanges(String(enValue));
  return stabilizeNumericRanges(String(fallback || ""));
}

export function tFormat(key, params = {}, fallback = "") {
  let out = t(key, fallback);
  const map = params && typeof params === "object" ? params : {};
  Object.keys(map).forEach((paramKey) => {
    out = out.replaceAll(`{${paramKey}}`, String(map[paramKey]));
  });
  return stabilizeNumericRanges(out);
}

function applyTokenSubstitutions(text) {
  let out = String(text || "");
  const ai = window.AI_FUNCTIONS || {};
  const fit = String(ai.fit || "UniFit");
  const chance = String(ai.chance || "UniChance");
  out = out.replaceAll("{fit}", fit);
  out = out.replaceAll("{chance}", chance);
  return stabilizeNumericRanges(out);
}

export function applyTranslations(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;

  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const translated = applyTokenSubstitutions(t(key, el.textContent || ""));
    el.textContent = translated;
  });

  scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    const translated = applyTokenSubstitutions(t(key, el.innerHTML || ""));
    el.innerHTML = translated;
  });

  scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const translated = applyTokenSubstitutions(t(key, el.getAttribute("placeholder") || ""));
    el.setAttribute("placeholder", translated);
  });

  scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const translated = applyTokenSubstitutions(t(key, el.getAttribute("title") || ""));
    el.setAttribute("title", translated);
  });

  scope.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    const translated = applyTokenSubstitutions(t(key, el.getAttribute("aria-label") || ""));
    el.setAttribute("aria-label", translated);
  });
}

export function setLanguage(lang, options = {}) {
  const next = normalizeLang(lang) || LANG_ENG;
  const persist = options.persist !== false;
  const emit = options.emit !== false;
  const changed = next !== currentLang;
  currentLang = next;
  setHtmlLang(next);
  if (persist) writeStoredLang(next);
  if (changed && emit) {
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: { language: next } }));
  }
  return next;
}

export async function initI18n() {
  await _loadLocalizationPacks();
  const stored = readStoredLang();
  const detected = detectDeviceLang();
  const resolved = normalizeLang(stored || detected) || LANG_ENG;
  setLanguage(resolved, { persist: !stored, emit: false });
  return currentLang;
}


