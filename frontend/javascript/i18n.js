import { getPreferredCurrency } from "./currency.js";
import { stabilizeNumericRanges } from "./utils/text.js";
import { safeSessionStorage } from "./utils/safe-storage.js";
import { escapeHtml, escapeHtmlAttr } from "./utils/format.js";

const I18N_STORAGE_KEY = "unisearch_ui_language_v1";
const I18N_PACK_REVISION = "32";
const I18N_SESSION_CACHE_PREFIX = `unisearch_i18n_pack_v${I18N_PACK_REVISION}_${window.APP_VERSION || "dev"}_`;

const LANG_ENG = "eng";
const LANG_RUS = "rus";
const LANG_KAZ = "kaz";
const SUPPORTED_LANGS = new Set([LANG_ENG, LANG_RUS, LANG_KAZ]);
const LANG_FILE_BY_CODE = {
  [LANG_ENG]: "Localization/eng",
  [LANG_RUS]: "Localization/ru",
  [LANG_KAZ]: "Localization/kaz",
};
const I18N_PACK_FETCH_TIMEOUT_MS = 4000;

const HTML_LANG_MAP = {
  [LANG_ENG]: "en",
  [LANG_RUS]: "ru",
  [LANG_KAZ]: "kk",
};

const DICT = {
  [LANG_ENG]: {},
  [LANG_RUS]: {},
  [LANG_KAZ]: {},
};

let currentLang = LANG_ENG;
const __loadedPacks = new Set();
const __packLoadPromises = new Map();
let __i18nInitialized = false;

function normalizeLang(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (SUPPORTED_LANGS.has(raw)) return raw;
  if (raw.startsWith("en")) return LANG_ENG;
  if (raw.startsWith("ru")) return LANG_RUS;
  if (raw.startsWith("kk")) return LANG_KAZ;
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
    cache: "no-cache",
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

function _hydratePacksFromSession() {
  const langs = [LANG_ENG, LANG_RUS, LANG_KAZ];
  langs.forEach((lang) => {
    if (Object.keys(DICT[lang] || {}).length > 0) return;
    try {
      const cached = safeSessionStorage.get(`${I18N_SESSION_CACHE_PREFIX}${lang}`, "");
      if (!cached) return;
      const parsed = _parseLocalizationFile(cached);
      if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) return;
      DICT[lang] = { ...(DICT[lang] || {}), ...parsed };
      __loadedPacks.add(lang);

      const code = String(parsed["meta.code"] || "").trim();
      const navKey = `nav.lang.${lang}`;
      if (code && !String(DICT[lang][navKey] || "").trim()) DICT[lang][navKey] = code.toUpperCase();
    } catch (e) {
      // ignore
    }
  });
}

async function _loadLocalizationPacks() {
  _hydratePacksFromSession();
  await Promise.all([LANG_ENG, LANG_RUS, LANG_KAZ].map(_loadLocalizationPack));
}

function _loadLocalizationPack(lang) {
  if (__loadedPacks.has(lang)) return Promise.resolve(true);
  if (__packLoadPromises.has(lang)) return __packLoadPromises.get(lang);

  const file = LANG_FILE_BY_CODE[lang];
  if (!file) return Promise.resolve(false);

  const promise = (async () => {
    try {
      const raw = await _fetchLocalizationText(`${file}?v=${encodeURIComponent(window.APP_VERSION || "dev")}&r=${I18N_PACK_REVISION}`, I18N_PACK_FETCH_TIMEOUT_MS);
      if (!raw) return false;
      const parsed = _parseLocalizationFile(raw);
      if (Object.keys(parsed).length === 0) return false;
      DICT[lang] = { ...(DICT[lang] || {}), ...parsed };
      __loadedPacks.add(lang);
      safeSessionStorage.set(`${I18N_SESSION_CACHE_PREFIX}${lang}`, raw);

      const code = String(parsed["meta.code"] || "").trim();
      const navKey = `nav.lang.${lang}`;
      if (code && !String(DICT[lang][navKey] || "").trim()) DICT[lang][navKey] = code.toUpperCase();
      return true;
    } catch (e) {
      return false;
    }
  })();
  __packLoadPromises.set(lang, promise);
  return promise.finally(() => {
    if (__packLoadPromises.get(lang) === promise) __packLoadPromises.delete(lang);
  });
}

export function getCurrentLanguage() {
  return currentLang;
}

export function t(key, fallback = "", language = currentLang) {
  const k = String(key || "").trim();
  if (!k) return stabilizeNumericRanges(String(fallback || ""));
  const active = DICT[normalizeLang(language) || currentLang] || {};
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

export function applyTokenSubstitutions(text) {
  let out = String(text || "");
  const ai = window.AI_FUNCTIONS || {};
  const fit = String(ai.fit || "UniFit");
  const chance = String(ai.chance || "UniChance");
  out = out.replaceAll("{fit}", fit);
  out = out.replaceAll("{chance}", chance);
  const currency = typeof getPreferredCurrency === "function" ? getPreferredCurrency() : "USD";
  out = out.replaceAll("{currency}", currency);
  return stabilizeNumericRanges(out);
}

const ALLOWED_I18N_TAGS = new Set(["b", "strong", "em", "i", "br", "a", "span", "code"]);
const BLOCKED_I18N_TAGS = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript"]);

function isSafeI18nHref(rawUrl) {
  if (typeof rawUrl !== "string") return false;
  const decoded = rawUrl
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n");
  const trimmed = decoded.trim().replace(/[\x00-\x1f\x7f]/g, "");
  if (!trimmed || trimmed.startsWith("//")) return false;

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex !== -1) {
    const firstSlash = trimmed.indexOf("/");
    const firstQuestion = trimmed.indexOf("?");
    const firstHash = trimmed.indexOf("#");
    const delimiters = [firstSlash, firstQuestion, firstHash].filter((idx) => idx !== -1);
    const firstDelimiter = delimiters.length ? Math.min(...delimiters) : Infinity;
    if (colonIndex < firstDelimiter || firstDelimiter === Infinity) {
      const scheme = trimmed.slice(0, colonIndex).trim().toLowerCase();
      if (scheme !== "http" && scheme !== "https" && scheme !== "mailto") {
        return false;
      }
    }
  }

  return true;
}

function sanitizeI18nDom(rawHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!doctype html><body>${rawHtml}`, "text/html");
  if (!doc || !doc.body) return sanitizeI18nTokens(rawHtml);

  function walk(node) {
    if (node.nodeType === 3) {
      return escapeHtml(node.textContent);
    }
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      if (BLOCKED_I18N_TAGS.has(tag)) return "";
      const childrenHtml = Array.from(node.childNodes).map(walk).join("");
      if (!ALLOWED_I18N_TAGS.has(tag)) return childrenHtml;
      if (tag === "br") return "<br>";
      if (tag === "a") {
        const rawHref = node.getAttribute("href") || "";
        if (isSafeI18nHref(rawHref)) {
          const isBlank = node.getAttribute("target") === "_blank";
          const targetAttr = isBlank ? ' target="_blank" rel="noopener noreferrer"' : "";
          return `<a href="${escapeHtmlAttr(rawHref.trim())}"${targetAttr}>${childrenHtml}</a>`;
        }
        return childrenHtml;
      }
      return `<${tag}>${childrenHtml}</${tag}>`;
    }
    return "";
  }

  return Array.from(doc.body.childNodes).map(walk).join("");
}

function sanitizeI18nTokens(rawHtml) {
  if (!rawHtml || typeof rawHtml !== "string") return "";
  let clean = rawHtml.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of BLOCKED_I18N_TAGS) {
    const re = new RegExp("<" + tag + "(?:\\s[^>]*)?>[\\s\\S]*?<\\/" + tag + "\\s*>", "gi");
    clean = clean.replace(re, "");
    const selfClosing = new RegExp("<" + tag + "(?:\\s[^>]*)?\\/?>", "gi");
    clean = clean.replace(selfClosing, "");
  }

  let openAllowedLinks = 0;
  clean = clean.replace(/<(\/)?([a-zA-Z0-9_-]+)((?:\s+[^"'>/=\s]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))?)*)\s*(\/?)>/g, (match, isClosing, rawTagName, attrs) => {
    const tag = rawTagName.toLowerCase();
    if (!ALLOWED_I18N_TAGS.has(tag)) return "";
    if (tag === "br") return "<br>";
    if (tag === "a") {
      if (isClosing) {
        if (openAllowedLinks > 0) {
          openAllowedLinks--;
          return "</a>";
        }
        return "";
      }
      const hrefMatch = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/i);
      const rawHref = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? "") : "";
      if (!isSafeI18nHref(rawHref)) return "";
      openAllowedLinks++;
      const isBlank = /target\s*=\s*(?:"_blank"|'_blank'|_blank)/i.test(attrs);
      const targetAttr = isBlank ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escapeHtmlAttr(rawHref.trim())}"${targetAttr}>`;
    }
    if (isClosing) return `</${tag}>`;
    return `<${tag}>`;
  });

  return clean;
}

export function sanitizeI18nHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== "string") return "";
  if (typeof DOMParser === "function") {
    try {
      return sanitizeI18nDom(rawHtml);
    } catch (e) {
      // Fallback to tokens
    }
  }
  return sanitizeI18nTokens(rawHtml);
}

export { sanitizeI18nHtml as sanitizeHtml };

export function applyTranslations(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;

  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const translated = applyTokenSubstitutions(t(key, el.textContent || ""));
    el.textContent = translated;
  });

  scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (!key) return;
    const fallback = el.getAttribute("data-i18n-default") || el.getAttribute("data-i18n-fallback") || "";
    const raw = t(key, fallback);
    if (!raw) return;
    const translated = applyTokenSubstitutions(raw);
    el.innerHTML = sanitizeI18nHtml(translated);
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

  scope.querySelectorAll("[data-i18n-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-label");
    const translated = applyTokenSubstitutions(t(key, el.getAttribute("label") || ""));
    el.setAttribute("label", translated);
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
  if (__i18nInitialized) {
    void _loadLocalizationPack(next).then((loaded) => {
      if (loaded && currentLang === next) applyTranslations();
    });
  }
  if (changed && emit) {
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: { language: next } }));
  }
  return next;
}

export async function initI18n() {
  _hydratePacksFromSession();
  const stored = readStoredLang();
  const detected = detectDeviceLang();
  const resolved = normalizeLang(stored || detected) || LANG_ENG;
  setLanguage(resolved, { persist: !stored, emit: false });

  await _loadLocalizationPacks();
  __i18nInitialized = true;
  return currentLang;
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("currencyChanged", () => {
    try {
      applyTranslations();
    } catch (e) {
      // ignore
    }
  });
}

