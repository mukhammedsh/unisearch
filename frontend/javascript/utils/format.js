import { heroIcon } from "../icons.js";
import { frontendStaticAsset } from "./runtime.js";

export function stabilizeNumericRanges(text) {
  return String(text || "").replace(/(\d[\d\s.,]*)\s*-\s*(\d[\d\s.,]*)/g, (_, left, right) => {
    return `${String(left || "").trimEnd()}\u2011${String(right || "").trimStart()}`;
  });
}

function escapeHtmlCore(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeHtml(value) {
  return escapeHtmlCore(stabilizeNumericRanges(String(value ?? "")));
}

export function escapeHtmlAttr(value) {
  return escapeHtmlCore(value);
}

let imageFallbacksBound = false;

export function bindImageFallbacks(root = document) {
  const targetRoot = root || document;
  if (targetRoot === document && imageFallbacksBound) return;
  if (!targetRoot || typeof targetRoot.addEventListener !== "function") return;

  targetRoot.addEventListener("error", (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;

    const fallbackSrc = String(img.dataset.fallbackSrc || "").trim();
    const finalSrc = String(img.dataset.finalSrc || "").trim();
    const fallbackText = String(img.dataset.fallbackText || "").trim();
    const parentClass = String(img.dataset.parentErrorClass || "").trim();
    const removeOnError = img.dataset.removeOnError === "1";
    const stage = String(img.dataset.fallbackStage || "0");

    if (parentClass && img.parentElement) img.parentElement.classList.add(parentClass);

    if (stage === "0" && fallbackSrc) {
      img.dataset.fallbackStage = "1";
      img.removeAttribute("srcset");
      img.src = fallbackSrc;
      return;
    }

    if ((stage === "0" || stage === "1") && finalSrc && img.src !== finalSrc) {
      img.dataset.fallbackStage = "2";
      img.removeAttribute("srcset");
      img.src = finalSrc;
      return;
    }

    if (fallbackText && img.parentNode) {
      img.style.display = "none";
      img.parentNode.textContent = fallbackText;
      return;
    }

    if (removeOnError) {
      img.remove();
      return;
    }

    img.style.display = "none";
  }, true);

  if (targetRoot === document) imageFallbacksBound = true;
}

export function nested(obj, path, fallback = null) {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return fallback;
    current = current[key];
  }
  return current === undefined || current === null ? fallback : current;
}

export function initials(name) {
  const text = String(name || "").trim();
  if (!text) return "U";
  const parts = text.split(/\s+/).slice(0, 2);
  return parts.map((part) => (part[0] || "").toUpperCase()).join("") || "U";
}

export function moneyUSD(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `$${new Intl.NumberFormat("en-US").format(amount)}`;
}

function pluralRus(n, forms) {
  const value = Math.abs(n) % 100;
  const last = value % 10;
  if (value > 10 && value < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

export function formatPlural(n, forms, lang = "eng") {
  const num = Number(n);
  if (lang === "rus" && Array.isArray(forms) && forms.length >= 3) return pluralRus(num, forms);
  if (Array.isArray(forms)) return num === 1 ? forms[0] : (forms[1] || forms[0]);
  return String(forms || "");
}

const COUNTRY_CODES = {
  Kazakhstan: "kz",
  USA: "us",
  "South Korea": "kr",
  Japan: "jp",
  "Hong Kong": "hk",
  UK: "gb",
  Switzerland: "ch",
  Canada: "ca",
  Australia: "au",
  China: "cn",
  Singapore: "sg",
  Germany: "de",
  Netherlands: "nl",
};

const COUNTRY_FLAG_ALIASES = {
  au: "au",
  australia: "au",
  "австралия": "au",
  ca: "ca",
  canada: "ca",
  "канада": "ca",
  ch: "ch",
  switzerland: "ch",
  "швейцария": "ch",
  cn: "cn",
  china: "cn",
  "китай": "cn",
  de: "de",
  germany: "de",
  "германия": "de",
  gb: "gb",
  uk: "gb",
  "united kingdom": "gb",
  "great britain": "gb",
  "великобритания": "gb",
  hk: "hk",
  "hong kong": "hk",
  "гонконг": "hk",
  jp: "jp",
  japan: "jp",
  "япония": "jp",
  kr: "kr",
  "south korea": "kr",
  "republic of korea": "kr",
  "южная корея": "kr",
  kz: "kz",
  kazakhstan: "kz",
  "казахстан": "kz",
  nl: "nl",
  netherlands: "nl",
  holland: "nl",
  "нидерланды": "nl",
  sg: "sg",
  singapore: "sg",
  "сингапур": "sg",
  us: "us",
  usa: "us",
  "united states": "us",
  "united states of america": "us",
  "сша": "us",
};

const LANGUAGE_FLAG_CODES = {
  eng: "us",
  rus: "ru",
};

const flagImgHtmlCache = new Map();

export function getFlagImg(countryName) {
  const raw = String(countryName || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const normalized = lower.replace(/\s+/g, " ").trim();
  const code =
    COUNTRY_CODES[raw] ||
    COUNTRY_CODES[raw.toUpperCase()] ||
    COUNTRY_CODES[lower] ||
    COUNTRY_FLAG_ALIASES[normalized] ||
    LANGUAGE_FLAG_CODES[normalized];
  if (!code) return "";
  const cacheKey = `${code}|${raw}`;
  const cached = flagImgHtmlCache.get(cacheKey);
  if (cached) return cached;
  const src = frontendStaticAsset(`images/flags/${code}.svg`);
  const html = `<img class="flag-icon-inline" src="${escapeHtml(src)}" width="24" height="18" loading="lazy" decoding="async" alt="${escapeHtml(raw)}">`;
  flagImgHtmlCache.set(cacheKey, html);
  return html;
}

export function showToast(message, type = "error") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success"
    ? heroIcon("check-circle", "ui-icon ui-icon--18 toast-icon")
    : heroIcon("exclamation-triangle", "ui-icon ui-icon--18 toast-icon");
  toast.innerHTML = `<span class="toast-message">${icon}<span>${escapeHtml(message)}</span></span><button class="toast-close" type="button" aria-label="Close">${heroIcon("x-mark", "ui-icon ui-icon--16")}</button>`;
  toast.querySelector(".toast-close").onclick = () => removeToast(toast);
  window.setTimeout(() => removeToast(toast), 3000);
  container.appendChild(toast);
}

export function removeToast(toast) {
  toast.style.animation = "fadeOut var(--motion-medium, 0.26s) var(--motion-ease-exit, ease) forwards";
  toast.addEventListener("animationend", () => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  });
}
