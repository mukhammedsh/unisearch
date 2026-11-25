import { safeLocalStorage } from "./safe-storage.js";
import { prefersReducedMotion } from "./runtime.js";

const THEME_STORAGE_KEY = "unisearch_theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const THEME_SYSTEM = "system";

let themeWatchBound = false;
let disableTransitionsFrame = 0;
let themeChangeSequence = 0;
let themeTransition = null;

function disableTransitionsTemporarily() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root || typeof root.setAttribute !== "function" || typeof root.removeAttribute !== "function") return;

  root.setAttribute("data-theme-switching", "1");
  if (disableTransitionsFrame && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(disableTransitionsFrame);
    disableTransitionsFrame = 0;
  }
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    disableTransitionsFrame = window.requestAnimationFrame(() => {
      disableTransitionsFrame = window.requestAnimationFrame(() => {
        if (root.getAttribute("data-theme-switching") === "1") root.removeAttribute("data-theme-switching");
        disableTransitionsFrame = 0;
      });
    });
  } else {
    root.removeAttribute("data-theme-switching");
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
  } catch {
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

function resolveTheme(preference) {
  const normalized = normalizeThemePreference(preference);
  if (normalized === THEME_DARK) return THEME_DARK;
  if (normalized === THEME_LIGHT) return THEME_LIGHT;
  return systemTheme();
}

export function applyTheme(theme, options = {}) {
  const preference = normalizeThemePreference(theme);
  const nextTheme = resolveTheme(preference);
  const root = document.documentElement;
  const sequence = ++themeChangeSequence;
  const animate = options.animate !== false && nextTheme !== getCurrentTheme();

  if (options.persist) safeLocalStorage.set(THEME_STORAGE_KEY, preference);
  themeTransition?.skipTransition();
  themeTransition = null;

  const updateTheme = () => {
    if (sequence !== themeChangeSequence) return;
    root.setAttribute("data-theme", nextTheme);
    root.style.colorScheme = nextTheme;
    window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme: nextTheme, preference } }));
  };

  if (animate && !prefersReducedMotion() && typeof document.startViewTransition === "function") {
    root.setAttribute("data-theme-switching", "fade");
    const transition = document.startViewTransition(updateTheme);
    themeTransition = transition;
    const finish = () => {
      if (themeTransition !== transition) return;
      themeTransition = null;
      root.removeAttribute("data-theme-switching");
    };
    void transition.finished.then(finish, finish);
  } else {
    if (root.getAttribute("data-theme-switching") === "fade") root.removeAttribute("data-theme-switching");
    if (animate) disableTransitionsTemporarily();
    updateTheme();
  }

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
    } catch {
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
