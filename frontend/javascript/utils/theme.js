import { safeLocalStorage } from "./safe-storage.js";

const THEME_STORAGE_KEY = "unisearch_theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const THEME_SYSTEM = "system";

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

export function normalizeThemePreference(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === THEME_DARK) return THEME_DARK;
  if (raw === THEME_LIGHT) return THEME_LIGHT;
  return THEME_SYSTEM;
}

export function getThemePreference() {
  const stored = String(safeLocalStorage.get(THEME_STORAGE_KEY) || "").trim().toLowerCase();
  if (stored === THEME_DARK || stored === THEME_LIGHT || stored === THEME_SYSTEM) {
    return stored;
  }
  // No explicit choice (or legacy unknown value): follow the OS theme.
  // Existing light/dark choices are preserved untouched.
  return THEME_SYSTEM;
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

export function resolveTheme(preference) {
  const normalized = normalizeThemePreference(preference);
  if (normalized === THEME_DARK) return THEME_DARK;
  if (normalized === THEME_LIGHT) return THEME_LIGHT;
  return systemTheme();
}

export function applyTheme(theme, options = {}) {
  const preference = normalizeThemePreference(theme);
  const nextTheme = resolveTheme(preference);
  const persist = Boolean(options.persist);
  const root = document.documentElement;

  disableTransitionsTemporarily();
  root.classList.remove("theme-animating");
  root.setAttribute("data-theme", nextTheme);
  root.style.colorScheme = nextTheme;

  if (persist) {
    safeLocalStorage.set(THEME_STORAGE_KEY, preference);
  }

  window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme: nextTheme, preference } }));
  return nextTheme;
}

export function initTheme() {
  const preference = getThemePreference();
  applyTheme(preference, { persist: false, animate: false });

  if (!themeWatchBound && window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getThemePreference() !== THEME_SYSTEM) return;
      applyTheme(THEME_SYSTEM, { persist: false, animate: true });
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

  return getCurrentTheme();
}

export function toggleTheme() {
  const nextTheme = getCurrentTheme() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  return applyTheme(nextTheme, { persist: true });
}
