/* frontend/javascript/main.js */
import { loadGlobalLayout } from "./components.js";
import { initUniversitiesPage, initUniversityPage, initRankingPage, initGuidePage } from "./pages.js";
import { API_BASE, aiName, initTheme, ensureExamConfig, ensureLanguageConfig, ensureCityDatabase, initGlobalApiLoadingIndicator } from "./utils.js";
import { initLanguagesPanel } from "./languages.js";
import { applyTranslations, getCurrentLanguage, initI18n } from "./i18n.js";
import { hydrateHeroIcons } from "./icons.js";
import { initUniversityTranslations, translateUnknownWord } from "./university-translations.js";
import { applyRouteLinks, isGuidePath, isHomePath, isRankingPath, isUniversitiesListPath, isUniversityDetailPath, routeGuide } from "./routes.js";

const BACKEND_WAKE_PING_KEY = "unisearch_backend_wake_ping_ts";
const BACKEND_WAKE_PING_INTERVAL_MS = 4 * 60_000;

function frontendStaticAsset(path = "") {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const currentPath = String(window.location.pathname || "");
  const frontendPrefix = (currentPath === "/frontend" || currentPath.startsWith("/frontend/")) ? "/frontend" : "";
  return `${frontendPrefix}/${cleanPath}`.replace(/\/{2,}/g, "/");
}

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

  const pingUrl = `${API_BASE}/health?warmup=1&t=${now}`;
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
  const path = window.location.pathname;
  const hash = String(window.location.hash || "").trim();
  const isGuideSectionHash = /^#guide-[a-z0-9-]+$/i.test(hash);
  const isFrontendRootPath = /^\/frontend\/?$/i.test(String(path || "").trim());
  if ((isHomePath(path) || isFrontendRootPath) && isGuideSectionHash) {
    const target = `${routeGuide()}${hash}`;
    window.location.replace(target);
    return;
  }

  initTheme();
  const isUniversitiesPage = Boolean(isUniversitiesListPath(path) || document.getElementById("universitiesList"));
  const i18nInitPromise = initI18n().catch((e) => {
    console.warn("i18n init failed, using built-in fallback pack:", e);
  });
  if (!isUniversitiesPage) {
    initGlobalApiLoadingIndicator();
  }
  registerServiceWorker();

  // Ensure language + university translation packs are ready before UI render.
  await i18nInitPromise;
  await initUniversityTranslations().catch((e) => {
    console.warn("university translations init failed, using local fallback pack:", e);
  });
  await loadGlobalLayout();
  hydrateHeroIcons(document);
  window.dispatchEvent(new CustomEvent("languageChanged"));
  applyRouteLinks(document);

  applyAINameConfig();
  applyTranslations(document);
  initLanguagesPanel();
  initHomePageActions();
  
  if (isUniversitiesPage) {
    // Keep universities first paint focused on list data; preload configs shortly after.
    window.setTimeout(() => {
      ensureExamConfig();
      ensureLanguageConfig();
    }, 1200);
    window.setTimeout(() => {
      maybeWakeBackend();
    }, 1400);
    ensureCityDatabase();
    initUniversitiesPage();
  } else if (isGuidePath(path) || document.getElementById("guidePage")) {
    await Promise.all([
      ensureExamConfig(),
      ensureLanguageConfig(),
    ]);
    initGuidePage();
  } else if (isUniversityDetailPath(path) || document.getElementById("detailCard")) {
    await Promise.all([
      ensureExamConfig(),
      ensureLanguageConfig(),
    ]);
    initUniversityPage();
  } else if (isRankingPath(path) || document.getElementById("rankingList")) {
    await Promise.all([
      ensureExamConfig(),
      ensureLanguageConfig(),
    ]);
    initRankingPage();
  } else {
    await Promise.all([
      ensureExamConfig(),
      ensureLanguageConfig(),
    ]);
    initHomePageStats();
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
  if (kind === "countries") {
    if (lang === "rus") {
      const cat = getRuPluralCategory(n);
      if (cat === "one") return "страна";
      if (cat === "few") return "страны";
      return "стран";
    }
    return n === 1 ? "country" : "countries";
  }

  if (kind === "universities") {
    if (lang === "rus") {
      const cat = getRuPluralCategory(n);
      if (cat === "one") return "университет";
      if (cat === "few") return "университета";
      return "университетов";
    }
    return n === 1 ? "university" : "universities";
  }

  return "";
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
