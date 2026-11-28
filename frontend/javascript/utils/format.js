import { heroIcon } from "../icons.js";
import { frontendStaticAsset } from "./runtime.js";
export { stabilizeNumericRanges } from "./text.js";
import { stabilizeNumericRanges } from "./text.js";

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

export function registerUiTranslator(translator) {
  registerUiTranslator.current = typeof translator === "function" ? translator : null;
}

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

const NUMBER_LOCALE_BY_HTML_LANG = { ru: "ru-RU", kk: "kk-KZ" };

/**
 * Locale for formatting numbers in the current interface language: Russian and Kazakh group digits
 * with a no-break space and use a decimal comma, English uses commas and a decimal point.
 * Reads the page language that the i18n module keeps on the document element.
 * @returns {"en-US"|"ru-RU"|"kk-KZ"}
 */
export function numberLocale() {
  const htmlLang = String(globalThis.document?.documentElement?.lang || "").slice(0, 2).toLowerCase();
  return NUMBER_LOCALE_BY_HTML_LANG[htmlLang] || "en-US";
}

export function moneyUSD(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `$${new Intl.NumberFormat(numberLocale()).format(amount)}`;
}

export function formatCurrency(amount, code = "USD", options = {}) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  const currencyCode = String(code || "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat(options.locale || numberLocale(), {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: options.maximumFractionDigits ?? 0,
      ...options,
    }).format(num);
  } catch {
    const formattedNum = new Intl.NumberFormat(options.locale || numberLocale(), {
      maximumFractionDigits: options.maximumFractionDigits ?? 0,
    }).format(num);
    return `${currencyCode} ${formattedNum}`;
  }
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
  if (lang === "kaz" && Array.isArray(forms)) return forms[0] || "";
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

/**
 * The catalog's country name for an ISO 3166-1 alpha-2 code ("KZ" -> "Kazakhstan").
 * @param {string} isoCode
 * @returns {string} "" when the catalog has no universities in that country
 */
export function catalogCountryForCode(isoCode) {
  const code = String(isoCode || "").trim().toLowerCase();
  if (!code) return "";
  return Object.keys(COUNTRY_CODES).find((name) => COUNTRY_CODES[name] === code) || "";
}

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
  kaz: "kz",
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

function setToastPopoverOpen(container, open) {
  try {
    if (open) {
      if (!container.matches?.(":popover-open")) {
        container.showPopover();
      }
    } else if (container.matches?.(":popover-open")) {
      container.hidePopover();
    }
    return true;
  } catch {
    return false;
  }
}

export function showToast(message, type = "error") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const text = String(message || "").trim();
  if (!text) return;

  const activeToasts = typeof container.querySelectorAll === "function"
    ? Array.from(container.querySelectorAll(".toast:not(.is-leaving)"))
    : [];

  const exactDuplicate = activeToasts.find((el) => {
    const textEl = (typeof el.querySelector === "function" && (el.querySelector(".toast-message span:last-child") || el.querySelector(".toast-message"))) || null;
    const currentText = String(el._toastMessage || textEl?.textContent || el.textContent || "").trim();
    const sameType = el.classList && typeof el.classList.contains === "function"
      ? el.classList.contains(type)
      : String(el.className || "").includes(type);
    return currentText === text && sameType;
  });

  if (exactDuplicate) {
    if (exactDuplicate._dismissTimer) {
      window.clearTimeout(exactDuplicate._dismissTimer);
    }
    exactDuplicate._dismissTimer = window.setTimeout(() => removeToast(exactDuplicate), 3000);
    return;
  }

  if (type === "error") {
    activeToasts
      .filter((el) => {
        if (el.classList && typeof el.classList.contains === "function") {
          return el.classList.contains("error");
        }
        return String(el.className || "").includes("error");
      })
      .forEach((el) => removeToast(el));
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast._toastMessage = text;
  toast._toastType = type;
  const icon = type === "success"
    ? heroIcon("check-circle", "ui-icon ui-icon--18 toast-icon")
    : heroIcon("exclamation-triangle", "ui-icon ui-icon--18 toast-icon");
  const translator = registerUiTranslator.current;
  const closeLabel = translator ? translator("common.close", "Close") : "Close";
  toast.innerHTML = `<span class="toast-message">${icon}<span role="status" aria-live="polite">${escapeHtml(text)}</span></span><button class="ui-btn ui-btn--icon ui-btn--ghost toast-close" type="button" aria-label="${escapeHtmlAttr(closeLabel)}">${heroIcon("x-mark", "ui-icon ui-icon--16")}</button>`;

  const dismiss = () => {
    removeToast(toast);
  };

  if (typeof container.addEventListener === "function" && !container.dataset?.toastFocusBound) {
    if (container.dataset) container.dataset.toastFocusBound = "1";
    container.addEventListener("focusin", (event) => {
      const related = event.relatedTarget;
      if (related && typeof container.contains === "function" && !container.contains(related)) {
        container._previousFocus = related;
      }
    });
  }

  let pointerInside = false;
  let focusInside = false;
  const pauseAutoDismiss = () => {
    if (toast._dismissTimer) {
      window.clearTimeout(toast._dismissTimer);
      toast._dismissTimer = null;
    }
  };
  const scheduleAutoDismiss = () => {
    if (toast.dataset?.dismissing === "1" || pointerInside || focusInside) return;
    pauseAutoDismiss();
    toast._dismissTimer = window.setTimeout(dismiss, 3000);
  };

  const closeBtn = typeof toast.querySelector === "function"
    ? toast.querySelector(".toast-close")
    : null;
  if (closeBtn) {
    closeBtn.onclick = () => {
      const hasFocus = typeof toast.contains === "function" && toast.contains(document.activeElement);
      if (hasFocus && typeof container.querySelectorAll === "function") {
        const remaining = Array.from(container.querySelectorAll(".toast:not(.is-leaving)"))
          .find((item) => item !== toast);
        const nextFocus = remaining?.querySelector?.(".toast-close") || container._previousFocus;
        if (nextFocus && typeof nextFocus.focus === "function") {
          nextFocus.focus();
        }
        container._previousFocus = null;
      }
      dismiss();
    };
  }
  if (typeof toast.addEventListener === "function") {
    toast.addEventListener("pointerenter", () => {
      pointerInside = true;
      pauseAutoDismiss();
    });
    toast.addEventListener("pointerleave", () => {
      pointerInside = false;
      scheduleAutoDismiss();
    });
    toast.addEventListener("focusin", () => {
      focusInside = true;
      pauseAutoDismiss();
    });
    toast.addEventListener("focusout", (event) => {
      if (typeof toast.contains === "function" && event.relatedTarget && toast.contains(event.relatedTarget)) {
        return;
      }
      focusInside = false;
      scheduleAutoDismiss();
    });
  }
  scheduleAutoDismiss();

  const supportsPopover =
    typeof HTMLElement === "function" &&
    Object.hasOwn(HTMLElement.prototype, "popover") &&
    typeof container.showPopover === "function";
  if (supportsPopover) {
    if (!container.hasAttribute?.("popover")) {
      container.setAttribute("popover", "manual");
    }
    setToastPopoverOpen(container, true);
  }
  container.appendChild(toast);
}

export function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  const parentContainer = toast.parentNode;
  if (toast._dismissTimer) {
    window.clearTimeout(toast._dismissTimer);
    toast._dismissTimer = null;
  }
  if (!toast.dataset) toast.dataset = {};
  if (toast.dataset.dismissing === "1") return;
  toast.dataset.dismissing = "1";

  const finish = () => {
    if (typeof toast.remove === "function") {
      toast.remove();
    } else if (toast.parentNode && typeof toast.parentNode.removeChild === "function") {
      toast.parentNode.removeChild(toast);
    }
    if (
      parentContainer &&
      typeof parentContainer.hidePopover === "function" &&
      typeof parentContainer.querySelectorAll === "function" &&
      parentContainer.querySelectorAll(".toast").length === 0
    ) {
      setToastPopoverOpen(parentContainer, false);
    }
  };

  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    finish();
  };

  if (toast.classList && typeof toast.classList.add === "function") {
    toast.classList.add("is-leaving");
  } else {
    toast.className = `${toast.className || ""} is-leaving`.trim();
  }
  if (typeof toast.addEventListener === "function") {
    toast.addEventListener("animationend", cleanup, { once: true });
  }
  window.setTimeout(cleanup, 1000);
}
