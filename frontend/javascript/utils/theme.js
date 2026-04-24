import { safeLocalStorage } from "./safe-storage.js";

const THEME_STORAGE_KEY = "unisearch_theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";

let themeWatchBound = false;
let themeAnimTimer = 0;
let themeAnimFrame = 0;

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
  const animate = options.animate !== false;
  const root = document.documentElement;
  const applyNow = () => {
    root.setAttribute("data-theme", nextTheme);
    root.style.colorScheme = nextTheme;
  };

  if (animate) {
    root.classList.add("theme-animating");
    if (themeAnimFrame) window.cancelAnimationFrame(themeAnimFrame);
    if (themeAnimTimer) window.clearTimeout(themeAnimTimer);
    themeAnimFrame = window.requestAnimationFrame(() => {
      themeAnimFrame = 0;
      applyNow();
      themeAnimTimer = window.setTimeout(() => {
        root.classList.remove("theme-animating");
        themeAnimTimer = 0;
      }, 220);
    });
  } else {
    applyNow();
  }

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
