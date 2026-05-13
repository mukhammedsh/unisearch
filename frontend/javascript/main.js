import { loadGlobalLayout, renderNoConnection } from "./components.js";
import { API_BASE, aiName, bindImageFallbacks, initTheme, ensureExamConfig, ensureLanguageConfig, ensureCityDatabase, initGlobalApiLoadingIndicator, frontendStaticAsset } from "./utils.js";
import { initLanguagesPanel } from "./languages.js";
import { applyTranslations, getCurrentLanguage, initI18n, t } from "./i18n.js";
import { hydrateHeroIcons } from "./icons.js";
import { initUniversityTranslations, translateUnknownWord } from "./university-translations.js";
import { applyRouteLinks, isAboutPath, isGuidePath, isHomePath, isRankingPath, isUniversitiesListPath, isUniversityDetailPath, routeGuide } from "./routes.js";

const BACKEND_WAKE_PING_KEY = "unisearch_backend_wake_ping_ts";
const BACKEND_WAKE_PING_INTERVAL_MS = 4 * 60_000;
const GUIDE_SECTION_HASH_RE = /^#guide-[a-z0-9-]+$/i;

const routeModuleLoaders = {
  universities: () => import("./pages/universities.js"),
  university: () => import("./pages/university.js"),
  ranking: () => import("./pages/ranking.js"),
  guide: () => import("./pages/guide.js"),
};
const routeModulePromises = new Map();

function loadRouteModule(routeName) {
  const key = String(routeName || "").trim().toLowerCase();
  const loader = routeModuleLoaders[key];
  if (!loader) return Promise.resolve(null);
  if (!routeModulePromises.has(key)) {
    routeModulePromises.set(key, loader());
  }
  return routeModulePromises.get(key);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const swScriptUrl = frontendStaticAsset("sw.js");
    const swScope = frontendStaticAsset("");
    await navigator.serviceWorker.register(swScriptUrl, {
      scope: swScope.endsWith("/") ? swScope : `${swScope}/`,
      updateViaCache: "none",
    });
  } catch (e) {
    console.warn("Service worker registration failed:", e);
  }
}

function applyAINameConfig() {
  const tokens = {
    fit: aiName("fit"),
    chance: aiName("chance"),
  };

  const replace = (template) =>
    String(template || "")
      .replaceAll("{fit}", tokens.fit)
      .replaceAll("{chance}", tokens.chance);

  document.querySelectorAll("[data-ai-template]").forEach((el) => {
    el.textContent = replace(el.getAttribute("data-ai-template"));
  });

  document.querySelectorAll("[data-ai-name]").forEach((el) => {
    const key = String(el.getAttribute("data-ai-name") || "").trim().toLowerCase();
    if (tokens[key]) el.textContent = tokens[key];
  });
}

function maybeWakeBackend() {
  const now = Date.now();
  try {
    const lastRaw = sessionStorage.getItem(BACKEND_WAKE_PING_KEY);
    const last = Number(lastRaw || 0);
    if (Number.isFinite(last) && (now - last) < BACKEND_WAKE_PING_INTERVAL_MS) return;
    sessionStorage.setItem(BACKEND_WAKE_PING_KEY, String(now));
  } catch (e) {}

  const pingUrl = `${API_BASE}/health?t=${now}`;
  fetch(pingUrl, {
    method: "GET",
    cache: "no-store",
    keepalive: true,
    headers: { Accept: "application/json" },
  }).catch(() => {});
}

function initHomePageActions() {
  const profileTrigger = document.getElementById("profileBtn");
  if (!(profileTrigger instanceof HTMLButtonElement)) return;

  ["homeOpenProfileBtn", "homeWorkflowProfileBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!(btn instanceof HTMLElement)) return;
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      profileTrigger.click();
    });
  });
}

function getUniversitiesSkeletonCount({ listEl, skeletonEl, limit = 24 } = {}) {
  const renderedColumns = listEl
    ? getComputedStyle(listEl).gridTemplateColumns.split(" ").filter(Boolean).length
    : 0;
  const width = Math.max(
    Number(listEl?.clientWidth || 0),
    Number(skeletonEl?.parentElement?.clientWidth || 0),
    Number(window.innerWidth || 0)
  );
  const cardMinWidth = 252;
  const gridGap = 18;
  const columns = renderedColumns || Math.max(1, Math.floor((width + gridGap) / (cardMinWidth + gridGap)));
  const rows = 3;
  return Math.min(limit, Math.max(columns, columns * rows));
}

function isFrontendRootPath(pathname) {
  return /^\/frontend\/?$/i.test(String(pathname || "").trim());
}

function routePageFromPath(pathname) {
  if (isHomePath(pathname) || isFrontendRootPath(pathname)) return "home";
  if (isUniversitiesListPath(pathname)) return "universities";
  if (isUniversityDetailPath(pathname)) return "university";
  if (isRankingPath(pathname)) return "ranking";
  if (isGuidePath(pathname)) return "guide";
  if (isAboutPath(pathname)) return "about";
  return "";
}

function isAppRouteUrl(url) {
  if (!(url instanceof URL)) return false;
  if (url.origin !== window.location.origin) return false;
  return Boolean(routePageFromPath(url.pathname));
}

function currentRouteContext() {
  const path = window.location.pathname;
  const pageFromPath = routePageFromPath(path);
  const page = String(document.body.dataset.page || pageFromPath || "home").trim().toLowerCase();
  const normalizedPage = page === "university" ? "university" : (pageFromPath || page || "home");
  return {
    path,
    page: normalizedPage,
    navPage: normalizedPage === "university" ? "universities" : normalizedPage,
    isHomePage: Boolean(normalizedPage === "home" || isHomePath(path) || isFrontendRootPath(path)),
    isUniversitiesPage: Boolean(isUniversitiesListPath(path) || document.getElementById("universitiesList")),
    isUniversityPage: Boolean(isUniversityDetailPath(path) || document.getElementById("detailCard")),
    isRankingPage: Boolean(isRankingPath(path) || document.getElementById("rankingList")),
    isGuidePage: Boolean(isGuidePath(path) || document.getElementById("guidePage")),
  };
}

function syncBodyPageFromRoute() {
  const page = routePageFromPath(window.location.pathname);
  if (page) document.body.dataset.page = page;
}

function syncNavbarActive(navPage = "") {
  const currentPage = String(navPage || currentRouteContext().navPage || "").trim().toLowerCase();
  document.querySelectorAll(".navbar-center a").forEach((link) => {
    const isActive = currentPage && String(link.getAttribute("data-link") || "").toLowerCase() === currentPage;
    link.classList.toggle("is-active", !!isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function primeRouteLoadingUi(ctx = currentRouteContext()) {
  if (ctx.isUniversitiesPage) {
    const skeletonEl = document.getElementById("universitiesSkeleton");
    const listEl = document.getElementById("universitiesList");
    const paginationEl = document.getElementById("pagination");
    if (skeletonEl && !skeletonEl.innerHTML.trim()) {
      const skeletonCount = getUniversitiesSkeletonCount({ listEl, skeletonEl });
      skeletonEl.dataset.count = String(skeletonCount);
      skeletonEl.innerHTML = Array.from({ length: skeletonCount }, () => `
        <article class="uni-card u-skeleton-card is-skeleton" aria-hidden="true">
          <div class="uni-media">
            <div class="uni-price" aria-hidden="true">
              <div class="skeleton-line" style="width: 64px; height: 11px; margin-left: auto;"></div>
              <div class="skeleton-line" style="width: 56px; height: 18px; margin: 6px 0 0 auto;"></div>
            </div>
            <div class="uni-logo" aria-hidden="true"></div>
          </div>
          <div class="uni-body">
            <div class="skeleton-line" style="width: 86%; height: 17px;"></div>
            <div class="skeleton-line" style="width: 62%; height: 17px;"></div>
            <div class="skeleton-line" style="width: 58%;"></div>
            <div class="skeleton-line" style="width: 72%;"></div>
            <div class="skeleton-line" style="width: 100%; height: 68px; border-radius: 12px; margin-top: 8px;"></div>
            <div class="skeleton-line" style="width: 42%; height: 14px; margin-top: auto;"></div>
          </div>
        </article>
      `).join("");
    }
    if (skeletonEl) {
      skeletonEl.style.display = "grid";
      skeletonEl.setAttribute("aria-hidden", "false");
    }
    if (listEl) listEl.style.visibility = "hidden";
    if (paginationEl) paginationEl.style.visibility = "hidden";
    return;
  }

  if (ctx.isUniversityPage) {
    const detailLoading = document.getElementById("detailLoading");
    if (detailLoading) {
      detailLoading.classList.add("is-visible");
      detailLoading.setAttribute("aria-hidden", "false");
    }
  }
}

function hydrateRouteShell(ctx = currentRouteContext()) {
  syncNavbarActive(ctx.navPage);
  applyRouteLinks(document);
  hydrateHeroIcons(document);
  bindImageFallbacks(document);
  applyAINameConfig();
  applyTranslations(document);
  initHomePageActions();
  primeRouteLoadingUi(ctx);
}

async function initRoutePage(ctx = currentRouteContext()) {
  if (ctx.isUniversitiesPage || ctx.isUniversityPage || ctx.isRankingPage) {
    try {
      await initUniversityTranslations();
    } catch (e) {
      console.warn("university translations init failed, using local fallback pack:", e);
    }
  }

  if (document.body.dataset.page === "error-404") return;

  if (ctx.isUniversitiesPage) {
    maybeWakeBackend();
    const [module] = await Promise.all([
      loadRouteModule("universities"),
      ensureExamConfig(),
      ensureLanguageConfig(),
      ensureCityDatabase(),
    ]);
    return module?.initUniversitiesPage?.();
  }
  if (ctx.isUniversityPage) {
    const [module] = await Promise.all([
      loadRouteModule("university"),
      ensureExamConfig(),
      ensureLanguageConfig(),
    ]);
    return module?.initUniversityPage?.();
  }
  if (ctx.isGuidePage) {
    const [module] = await Promise.all([
      loadRouteModule("guide"),
      ensureExamConfig(),
      ensureLanguageConfig(),
    ]);
    return module?.initGuidePage?.();
  }
  if (ctx.isRankingPage) {
    const module = await loadRouteModule("ranking");
    return module?.initRankingPage?.();
  }
  return initHomePageStats();
}

async function initializeCurrentRoute() {
  syncBodyPageFromRoute();
  const ctx = currentRouteContext();
  hydrateRouteShell(ctx);
  await initRoutePage(ctx);
}

function stylesheetKeyFrom(link, baseUrl) {
  const href = String(link.getAttribute("href") || "").trim();
  if (!href) return "";
  try {
    return new URL(href, baseUrl).href;
  } catch (e) {
    return href;
  }
}

function syncDocumentHeadFromRoute(nextDoc, routeUrl) {
  const nextTitle = nextDoc.querySelector("title");
  if (nextTitle) {
    const currentTitle = document.querySelector("title");
    const importedTitle = document.importNode(nextTitle, true);
    if (currentTitle) currentTitle.replaceWith(importedTitle);
    else document.head.appendChild(importedTitle);
  }

  const existingStyles = new Set(
    Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))
      .map((link) => stylesheetKeyFrom(link, document.baseURI))
      .filter(Boolean)
  );

  nextDoc.querySelectorAll('link[rel~="stylesheet"][href]').forEach((link) => {
    const key = stylesheetKeyFrom(link, routeUrl);
    if (!key || existingStyles.has(key)) return;
    const clone = document.importNode(link, true);
    clone.setAttribute("href", key);
    document.head.appendChild(clone);
    existingStyles.add(key);
  });
}

function replaceRouteDom(nextDoc) {
  const nextMain = nextDoc.querySelector("main");
  if (!nextMain) throw new Error("Route document has no main element");

  const currentMain = document.querySelector("main");
  const importedMain = document.importNode(nextMain, true);
  if (currentMain) currentMain.replaceWith(importedMain);
  else document.body.appendChild(importedMain);

  const nextFooter = nextDoc.querySelector("footer.site-footer");
  const currentFooter = document.querySelector("footer.site-footer");
  if (nextFooter) {
    const importedFooter = document.importNode(nextFooter, true);
    if (currentFooter) currentFooter.replaceWith(importedFooter);
    else document.body.appendChild(importedFooter);
  } else if (currentFooter) {
    currentFooter.remove();
  }

  const nextPage = String(nextDoc.body?.dataset?.page || "").trim().toLowerCase();
  if (nextPage) document.body.dataset.page = nextPage;
}

let appRouteNavigationInFlight = null;

async function loadAppRoute(rawHref, options = {}) {
  const url = new URL(rawHref, window.location.href);
  if (!isAppRouteUrl(url)) {
    window.location.href = url.href;
    return false;
  }

  const currentUrl = new URL(window.location.href);
  const sameDocumentPath = url.pathname === currentUrl.pathname && url.search === currentUrl.search;
  if (!options.force && sameDocumentPath && url.hash && url.hash !== currentUrl.hash) {
    window.history.pushState({ appRoute: true }, "", url.href);
    document.querySelector(url.hash)?.scrollIntoView({ block: "start" });
    return true;
  }
  if (!options.force && url.href === currentUrl.href) return true;

  if (appRouteNavigationInFlight) {
    try {
      appRouteNavigationInFlight.abort();
    } catch (e) {}
  }

  const controller = new AbortController();
  appRouteNavigationInFlight = controller;
  document.body.classList.add("route-loading");

  try {
    const response = await fetch(url.href, {
      credentials: "same-origin",
      headers: { Accept: "text/html" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Route load failed: ${response.status}`);
    const html = await response.text();
    const nextDoc = new DOMParser().parseFromString(html, "text/html");

    syncDocumentHeadFromRoute(nextDoc, url.href);
    replaceRouteDom(nextDoc);

    if (options.history !== false) {
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method]({ appRoute: true }, "", url.href);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    await initializeCurrentRoute();
    if (url.hash) {
      window.requestAnimationFrame(() => {
        document.querySelector(url.hash)?.scrollIntoView({ block: "start" });
      });
    }
    return true;
  } catch (error) {
    if (error?.name === "AbortError") return false;
    console.warn("Client-side route failed, falling back to full navigation:", error);
    if (options.history === false) window.location.reload();
    else window.location.href = url.href;
    return false;
  } finally {
    if (appRouteNavigationInFlight === controller) appRouteNavigationInFlight = null;
    document.body.classList.remove("route-loading");
  }
}

function shouldHandleLinkClick(event, link) {
  if (!link || event.defaultPrevented) return false;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.hasAttribute("download")) return false;
  const target = String(link.getAttribute("target") || "").trim().toLowerCase();
  if (target && target !== "_self") return false;

  const url = new URL(link.getAttribute("href") || "", window.location.href);
  if (!isAppRouteUrl(url)) return false;

  const currentUrl = new URL(window.location.href);
  if (url.pathname === currentUrl.pathname && url.search === currentUrl.search && url.hash) return false;
  return true;
}

function installClientRouter() {
  if (window.__unisearchClientRouterInstalled) return;
  window.__unisearchClientRouterInstalled = true;

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest("a[href]");
    if (!shouldHandleLinkClick(event, link)) return;
    event.preventDefault();
    loadAppRoute(link.href).catch((error) => {
      console.warn("Client-side navigation failed:", error);
      window.location.href = link.href;
    });
  });

  window.addEventListener("app:navigate", (event) => {
    const detail = event.detail || {};
    if (!detail.href) return;
    detail.handled = true;
    loadAppRoute(detail.href, { replace: !!detail.replace }).catch((error) => {
      console.warn("Client-side navigation failed:", error);
      window.location.href = detail.href;
    });
  });

  window.addEventListener("popstate", () => {
    loadAppRoute(window.location.href, { history: false, force: true }).catch(() => {
      window.location.reload();
    });
  });
}

function shouldRedirectHomeGuideHash(path = window.location.pathname, hash = window.location.hash) {
  return (isHomePath(path) || isFrontendRootPath(path)) && GUIDE_SECTION_HASH_RE.test(String(hash || "").trim());
}

function createSiteLoaderController(isHomePage) {
  const siteLoader = document.getElementById("siteInitialLoader");
  let dismissed = false;
  if (siteLoader && !isHomePage) document.body.classList.add("initial-loading");
  return () => {
    if (!siteLoader || dismissed) return;
    dismissed = true;
    siteLoader.classList.add("is-hidden");
    document.body.classList.remove("initial-loading");
    setTimeout(() => siteLoader.remove(), 600);
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  bindImageFallbacks(document);

  const path = window.location.pathname;
  const hash = String(window.location.hash || "").trim();
  if (shouldRedirectHomeGuideHash(path, hash)) {
    window.location.replace(`${routeGuide()}${hash}`);
    return;
  }

  const dismissSiteLoader = createSiteLoaderController(
    Boolean(routePageFromPath(path) === "home" || document.body.dataset.page === "home")
  );

  try {
    initTheme();
    const i18nInitPromise = initI18n().catch((e) => {
      console.warn("i18n init failed, using built-in fallback pack:", e);
    });
    initGlobalApiLoadingIndicator();
    registerServiceWorker();

    await i18nInitPromise;
    await loadGlobalLayout();
    installClientRouter();
    syncBodyPageFromRoute();

    const ctx = currentRouteContext();
    hydrateRouteShell(ctx);
    initLanguagesPanel();
    window.dispatchEvent(new CustomEvent("languageChanged"));
    dismissSiteLoader();

    await initRoutePage(ctx);

  } catch (error) {
    console.error("Initialization failed:", error);
    const mainEl = document.querySelector("main") || document.body;
    if (mainEl && document.body.dataset.page !== "error-404") {
      renderNoConnection({
        targetEl: mainEl,
        onRetry: () => window.location.reload()
      });
    }
  } finally {
    dismissSiteLoader();
  }

  window.addEventListener("languageChanged", () => {
    applyAINameConfig();
    applyTranslations(document);
    const uniStat = document.getElementById("stat-uni");
    const countryStat = document.getElementById("stat-countries");
    if (uniStat && countryStat) {
      renderHomeCoverage(uniStat.dataset.count || uniStat.textContent, countryStat.dataset.count || countryStat.textContent);
    }
  });
});

function resolveUiLang() {
  const htmlLang = String(document.documentElement.getAttribute("lang") || "").trim().toLowerCase();
  if (htmlLang.startsWith("ru")) return "rus";
  return "eng";
}

function normalizeCount(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function parseCountOrNull(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function formatCountForUi(value, lang) {
  const locale = lang === "rus" ? "ru-RU" : "en-US";
  try {
    return new Intl.NumberFormat(locale).format(normalizeCount(value, 0));
  } catch (e) {
    return String(normalizeCount(value, 0));
  }
}

function getRuPluralCategory(count) {
  const n = Math.abs(normalizeCount(count, 0));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}

function getCountNoun(kind, count, lang) {
  const n = normalizeCount(count, 0);
  const category = lang === "rus" ? getRuPluralCategory(n) : (n === 1 ? "one" : "many");
  const fallback = kind === "countries"
    ? (n === 1 ? "country" : "countries")
    : (n === 1 ? "university" : "universities");
  return t(`home.stats.${kind}_${category}`, fallback);
}

function renderHomeCoverage(universitiesTotal, countriesTotal) {
  const uniStat = document.getElementById("stat-uni");
  const countryStat = document.getElementById("stat-countries");
  const uniLabel = document.getElementById("stat-uni-label");
  const countryLabel = document.getElementById("stat-country-label");
  if (!uniStat || !countryStat || !uniLabel || !countryLabel) return;

  const uniCount = parseCountOrNull(universitiesTotal);
  const countryCount = parseCountOrNull(countriesTotal);
  const lang = resolveUiLang();

  if (uniCount === null) {
    uniStat.dataset.count = "";
    uniStat.textContent = "?";
    uniLabel.textContent = translateUnknownWord("placeholder.field.universities_count", "Universities count");
  } else {
    uniStat.dataset.count = String(uniCount);
    uniStat.textContent = formatCountForUi(uniCount, lang);
    uniLabel.textContent = getCountNoun("universities", uniCount, lang);
  }

  if (countryCount === null) {
    countryStat.dataset.count = "";
    countryStat.textContent = "?";
    countryLabel.textContent = translateUnknownWord("placeholder.field.countries_count", "Countries count");
  } else {
    countryStat.dataset.count = String(countryCount);
    countryStat.textContent = formatCountForUi(countryCount, lang);
    countryLabel.textContent = getCountNoun("countries", countryCount, lang);
  }
}

async function initHomePageStats() {
  const uniStat = document.getElementById("stat-uni");
  const countryStat = document.getElementById("stat-countries");
  if (!uniStat || !countryStat) return;

  renderHomeCoverage(
    normalizeCount(uniStat.dataset.count || uniStat.textContent || 0, 0),
    normalizeCount(countryStat.dataset.count || countryStat.textContent || 0, 0)
  );

  try {
    const resStats = await fetch(`${API_BASE}/stats`);
    if (resStats.ok) {
      const dataStats = await resStats.json();
      renderHomeCoverage(dataStats.universities_total, dataStats.countries_total);
      return;
    }
    const uiLang = String(getCurrentLanguage() || "eng").trim().toLowerCase() || "eng";
    const resUni = await fetch(`${API_BASE}/universities?limit=1&lang=${encodeURIComponent(uiLang)}`);
    const dataUni = await resUni.json();

    const resLoc = await fetch(`${API_BASE}/locations`);
    const dataLoc = await resLoc.json();

    renderHomeCoverage(dataUni.total, Object.keys(dataLoc || {}).length);
  } catch (e) {
    console.error("Failed to load stats:", e);
  }
}
