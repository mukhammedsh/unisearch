import { frontendStaticAsset, getCurrentTheme } from "../utils.js";

const NAV_LOGO_LIGHT = frontendStaticAsset("images/whitelogo.png");
const NAV_LOGO_DARK = frontendStaticAsset("images/darklogo.png");
const NAV_LOGO_FALLBACK = frontendStaticAsset("images/minilogo.png");
let themeUiSyncBound = false;

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

export { NAV_LOGO_DARK, NAV_LOGO_FALLBACK, NAV_LOGO_LIGHT };
