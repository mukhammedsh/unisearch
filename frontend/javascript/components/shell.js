import { frontendStaticAsset, getCurrentTheme } from "../utils.js";

const NAV_LOGO_LIGHT = frontendStaticAsset("images/whitelogo.png");
const NAV_LOGO_DARK = frontendStaticAsset("images/darklogo.png");
const NAV_LOGO_FALLBACK = frontendStaticAsset("images/minilogo.png");
const TRANSLATION_STATUS_CACHE_TTL_MS = 60_000;

let themeUiSyncBound = false;
let translationStatusCache = {
  ts: 0,
  data: null,
  inFlight: null,
};

export function syncNavbarLogo(themeOverride = "") {
  const navbarLogo = document.querySelector(".logo[data-logo-light][data-logo-dark]");
  if (!navbarLogo) return;
  const theme = (themeOverride || getCurrentTheme() || "light").toLowerCase();
  const nextLogo = theme === "dark" ? NAV_LOGO_DARK : NAV_LOGO_LIGHT;
  if (!nextLogo || navbarLogo.getAttribute("src") === nextLogo) return;
  navbarLogo.dataset.fallback = "0";
  navbarLogo.setAttribute("src", nextLogo);
}

export function bindThemeUiSync() {
  if (themeUiSyncBound) return;
  themeUiSyncBound = true;

  const syncNow = () => syncNavbarLogo();
  try {
    const observer = new MutationObserver(syncNow);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  } catch (error) {
    // noop
  }

  window.addEventListener("load", syncNow);
  window.addEventListener("pageshow", syncNow);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncNow();
  });
}

export async function fetchTranslationRuntimeStatus(apiBase, force = false) {
  const now = Date.now();
  if (!force && translationStatusCache.data && (now - translationStatusCache.ts) < TRANSLATION_STATUS_CACHE_TTL_MS) {
    return translationStatusCache.data;
  }
  if (translationStatusCache.inFlight) return translationStatusCache.inFlight;

  translationStatusCache.inFlight = (async () => {
    try {
      const response = await fetch(`${apiBase}/translation-status`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`translation-status http ${response.status}`);
      const data = await response.json();
      translationStatusCache.ts = Date.now();
      translationStatusCache.data = data && typeof data === "object" ? data : null;
      return translationStatusCache.data;
    } catch (error) {
      translationStatusCache.ts = Date.now();
      translationStatusCache.data = null;
      return null;
    } finally {
      translationStatusCache.inFlight = null;
    }
  })();

  return translationStatusCache.inFlight;
}

export { NAV_LOGO_DARK, NAV_LOGO_FALLBACK, NAV_LOGO_LIGHT };
