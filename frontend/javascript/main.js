/* frontend/javascript/main.js */
import { loadGlobalLayout, renderNoConnection } from "./components.js";
import { initUniversitiesPage } from "./pages/universities.js";
import { initUniversityPage } from "./pages/university.js";
import { initRankingPage } from "./pages/ranking.js";
import { initGuidePage } from "./pages/guide.js";
import { API_BASE, aiName, bindImageFallbacks, initTheme, ensureExamConfig, ensureLanguageConfig, ensureCityDatabase, initGlobalApiLoadingIndicator, frontendStaticAsset } from "./utils.js";
import { initLanguagesPanel } from "./languages.js";
import { applyTranslations, getCurrentLanguage, initI18n, t } from "./i18n.js";
import { hydrateHeroIcons } from "./icons.js";
import { initUniversityTranslations, translateUnknownWord } from "./university-translations.js";
import { applyRouteLinks, isGuidePath, isHomePath, isRankingPath, isUniversitiesListPath, isUniversityDetailPath, routeGuide } from "./routes.js";

const BACKEND_WAKE_PING_KEY = "unisearch_backend_wake_ping_ts";
const BACKEND_WAKE_PING_INTERVAL_MS = 4 * 60_000;


async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const swScriptUrl = frontendStaticAsset("sw.js");
    const swScope = frontendStaticAsset("");
    await navigator.serviceWorker.register(swScriptUrl, { scope: swScope.endsWith("/") ? swScope : `${swScope}/` });
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
  } catch (e) {
    // ignore
  }

  const pingUrl = `${API_BASE}/health?t=${now}`;
  fetch(pingUrl, {
    method: "GET",
    cache: "no-store",
    keepalive: true,
    headers: { Accept: "application/json" },
  }).catch(() => {
    // non-blocking warmup request
  });
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

document.addEventListener("DOMContentLoaded", async () => {
  bindImageFallbacks(document);

  const path = window.location.pathname;
  const hash = String(window.location.hash || "").trim();
  const isGuideSectionHash = /^#guide-[a-z0-9-]+$/i.test(hash);
  const isFrontendRootPath = /^\/frontend\/?$/i.test(String(path || "").trim());
  const isHomePage = Boolean(isHomePath(path) || isFrontendRootPath || document.body.dataset.page === "home");
  if ((isHomePath(path) || isFrontendRootPath) && isGuideSectionHash) {
    const target = `${routeGuide()}${hash}`;
    window.location.replace(target);
    return;
  }

  const siteLoader = document.getElementById("siteInitialLoader");
  if (siteLoader && !isHomePage) document.body.classList.add("initial-loading");
  const isUniversitiesPage = Boolean(isUniversitiesListPath(path) || document.getElementById("universitiesList"));
  const isUniversityPage = Boolean(isUniversityDetailPath(path) || document.getElementById("detailCard"));
  let siteLoaderDismissed = false;
  const dismissSiteLoader = () => {
    if (!siteLoader || siteLoaderDismissed) return;
    siteLoaderDismissed = true;
    siteLoader.classList.add("is-hidden");
    document.body.classList.remove("initial-loading");
    setTimeout(() => siteLoader.remove(), 600);
  };
  const primeRouteLoadingUi = () => {
    if (isUniversitiesPage) {
      const skeletonEl = document.getElementById("universitiesSkeleton");
      const listEl = document.getElementById("universitiesList");
      const paginationEl = document.getElementById("pagination");
      if (skeletonEl && !skeletonEl.innerHTML.trim()) {
        skeletonEl.innerHTML = Array.from({ length: 8 }, () => `
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

    if (isUniversityPage) {
      const detailLoading = document.getElementById("detailLoading");
      if (detailLoading) {
        detailLoading.classList.add("is-visible");
        detailLoading.setAttribute("aria-hidden", "false");
      }
    }
  };

  try {
    initTheme();
    const i18nInitPromise = initI18n().catch((e) => {
      console.warn("i18n init failed, using built-in fallback pack:", e);
    });
    initGlobalApiLoadingIndicator();
    registerServiceWorker();

    await i18nInitPromise;
    await loadGlobalLayout();
    hydrateHeroIcons(document);
    window.dispatchEvent(new CustomEvent("languageChanged"));
    applyRouteLinks(document);

    applyAINameConfig();
    applyTranslations(document);
    initLanguagesPanel();
    initHomePageActions();
    primeRouteLoadingUi();
    dismissSiteLoader();

    const needsUniversityTranslations = Boolean(isUniversitiesPage || isUniversityPage || isRankingPath(path) || document.getElementById("rankingList"));
    const universityTranslationsPromise = needsUniversityTranslations
      ? initUniversityTranslations().catch((e) => {
          console.warn("university translations init failed, using local fallback pack:", e);
        })
      : Promise.resolve();

    const pageInitPromise = (async () => {
      await universityTranslationsPromise;
      if (document.body.dataset.page === "error-404") {
        return;
      }
      if (isUniversitiesPage) {
        await Promise.all([ensureExamConfig(), ensureLanguageConfig()]);
        maybeWakeBackend();
        ensureCityDatabase();
        await initUniversitiesPage();
      } else if (isGuidePath(path) || document.getElementById("guidePage")) {
        await Promise.all([ensureExamConfig(), ensureLanguageConfig()]);
        await initGuidePage();
      } else if (isUniversityDetailPath(path) || document.getElementById("detailCard")) {
        await Promise.all([ensureExamConfig(), ensureLanguageConfig()]);
        await initUniversityPage();
      } else if (isRankingPath(path) || document.getElementById("rankingList")) {
        await Promise.all([ensureExamConfig(), ensureLanguageConfig()]);
        await initRankingPage();
      } else {
        await Promise.all([ensureExamConfig(), ensureLanguageConfig()]);
        await initHomePageStats();
      }
    })();

    await pageInitPromise;

  } catch (error) {
    console.error("Initialization failed:", error);
    // Показываем экран ошибки, если всё упало
    const mainEl = document.querySelector('main') || document.body;
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
