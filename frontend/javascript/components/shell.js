import { createSafeStorage, frontendStaticAsset, getCurrentTheme } from "../utils.js";

const safeLocalStorage = createSafeStorage("local");
const safeSessionStorage = createSafeStorage("session");

const NAV_LOGO_LIGHT = frontendStaticAsset("images/whitelogo.png");
const NAV_LOGO_DARK = frontendStaticAsset("images/darklogo.png");
const NAV_LOGO_FALLBACK = frontendStaticAsset("images/minilogo.png");
const LAYOUT_CACHE_KEY = "unisearch_layout_cache_v1";
const TRANSLATION_STATUS_CACHE_TTL_MS = 60_000;
const PROFILE_DRAFT_TRANSFER_KEY = "unisearch_profile_draft_transfer_v1";
const PROFILE_DRAFT_TRANSFER_TTL_MS = 5 * 60_000;

let themeUiSyncBound = false;
let translationStatusCache = {
  ts: 0,
  data: null,
  inFlight: null,
};

function hashString(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return String(hash);
}

function readLayoutCache() {
  const parsed = safeLocalStorage.getJson(LAYOUT_CACHE_KEY, null);
  if (!parsed || typeof parsed.html !== "string" || typeof parsed.hash !== "string") return null;
  return parsed;
}

function writeLayoutCache(html, hash) {
  safeLocalStorage.setJson(LAYOUT_CACHE_KEY, { html, hash, ts: Date.now() });
}

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

export function resolveLayoutMarkup(layoutHtml) {
  const currentHash = hashString(layoutHtml);
  const cached = readLayoutCache();
  if (!cached || cached.hash !== currentHash) {
    writeLayoutCache(layoutHtml, currentHash);
    return layoutHtml;
  }
  return cached.html;
}

export function persistProfileDraftForReload(reason = "reload", nextLanguage = "") {
  const draftApi = window.__unisearchProfileDraft;
  if (!draftApi || typeof draftApi.get !== "function") return;
  const draft = draftApi.get();
  if (!draft || typeof draft !== "object") return;

  safeSessionStorage.setJson(PROFILE_DRAFT_TRANSFER_KEY, {
    ts: Date.now(),
    path: String(window.location.pathname || ""),
    reason: String(reason || "reload"),
    nextLanguage: String(nextLanguage || "").trim().toLowerCase(),
    active: typeof draftApi.isActive === "function" ? Boolean(draftApi.isActive()) : false,
    draft,
  });
}

export function consumeProfileDraftAfterReload() {
  const parsed = safeSessionStorage.getJson(PROFILE_DRAFT_TRANSFER_KEY, null);
  safeSessionStorage.remove(PROFILE_DRAFT_TRANSFER_KEY);
  if (!parsed || typeof parsed !== "object" || !parsed.draft || typeof parsed.draft !== "object") return null;

  const ts = Number(parsed.ts);
  if (!Number.isFinite(ts) || (Date.now() - ts) > PROFILE_DRAFT_TRANSFER_TTL_MS) return null;
  if (String(parsed.path || "") !== String(window.location.pathname || "")) return null;
  return parsed;
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
