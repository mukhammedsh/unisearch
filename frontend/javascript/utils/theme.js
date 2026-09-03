import { safeLocalStorage } from "./safe-storage.js";

const THEME_STORAGE_KEY = "unisearch_theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";

let themeWatchBound = false;
let disableTransitionsTimer = 0;
let disableTransitionsStyle = null;

function disableTransitionsTemporarily() {
  if (typeof document === "undefined" || !document.head) return;
  if (!disableTransitionsStyle) {
    disableTransitionsStyle = document.createElement("style");
    disableTransitionsStyle.textContent =
      "*, *::before, *::after { -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; }";
    document.head.appendChild(disableTransitionsStyle);
  }
  if (disableTransitionsTimer && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(disableTransitionsTimer);
    disableTransitionsTimer = 0;
  }
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function" && document.body) {
    window.getComputedStyle(document.body).opacity;
  }
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    disableTransitionsTimer = window.requestAnimationFrame(() => {
      disableTransitionsTimer = window.requestAnimationFrame(() => {
        if (disableTransitionsStyle) {
          disableTransitionsStyle.remove();
          disableTransitionsStyle = null;
        }
        disableTransitionsTimer = 0;
      });
    });
  } else if (disableTransitionsStyle) {
    disableTransitionsStyle.remove();
    disableTransitionsStyle = null;
  }
}

function readStoredTheme() {
  const value = safeLocalStorage.get(THEME_STORAGE_KEY);
  return value === THEME_DARK || value === THEME_LIGHT ? value : "";
}

function systemTheme() {
  try {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return THEME_DARK;
  } catch (error) {
    return THEME_LIGHT;
  }
  return THEME_LIGHT;
}

export function getCurrentTheme() {
  const attr = String(document.documentElement.getAttribute("data-theme") || "").trim().toLowerCase();
  if (attr === THEME_DARK) return THEME_DARK;
  if (attr === THEME_LIGHT) return THEME_LIGHT;
  return systemTheme();
}

export function applyTheme(theme, options = {}) {
  const nextTheme = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
  const persist = Boolean(options.persist);
  const root = document.documentElement;

  disableTransitionsTemporarily();
  root.classList.remove("theme-animating");
  root.setAttribute("data-theme", nextTheme);
  root.style.colorScheme = nextTheme;

  if (persist) {
    safeLocalStorage.set(THEME_STORAGE_KEY, nextTheme);
  }

  window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme: nextTheme } }));
  return nextTheme;
}

export function initTheme() {
  const resolved = readStoredTheme() || systemTheme();
  applyTheme(resolved, { persist: false, animate: false });

  if (!themeWatchBound && window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredTheme()) return;
      applyTheme(systemTheme(), { persist: false, animate: true });
    };
    try {
      mediaQuery.addEventListener("change", onChange);
      themeWatchBound = true;
    } catch (error) {
      if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(onChange);
        themeWatchBound = true;
      }
    }
  }

  return resolved;
}

export function toggleTheme() {
  const nextTheme = getCurrentTheme() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  return applyTheme(nextTheme, { persist: true });
}
