/* frontend/javascript/main.js */
import { loadGlobalLayout } from "./components.js";
import { initUniversitiesPage, initUniversityPage, initRankingPage, initGuidePage } from "./pages.js";
import { API_BASE, aiName, initTheme, ensureExamConfig, ensureLanguageConfig, ensureCityDatabase, initGlobalApiLoadingIndicator } from "./utils.js";
import { initLanguagesPanel } from "./languages.js";
import { applyTranslations, getCurrentLanguage, initI18n } from "./i18n.js";
import { applyRouteLinks, isGuidePath, isRankingPath, isUniversitiesListPath, isUniversityDetailPath } from "./routes.js";

const BACKEND_WAKE_PING_KEY = "unisearch_backend_wake_ping_ts";
const BACKEND_WAKE_PING_INTERVAL_MS = 4 * 60_000;

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
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

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 UniSearch JS Loaded");
  initTheme();
  maybeWakeBackend();
  const i18nInitPromise = initI18n().catch((e) => {
    console.warn("i18n init failed, using built-in fallback pack:", e);
  });
  initGlobalApiLoadingIndicator();
  registerServiceWorker();

  // Render core layout first, then finish i18n in background.
  await loadGlobalLayout();
  await i18nInitPromise;
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: { language: getCurrentLanguage() } }));
  applyRouteLinks(document);

  applyAINameConfig();
  applyTranslations(document);
  initLanguagesPanel();

  const badge = document.querySelector(".hero-badge");
  const path = window.location.pathname;
  const isUniversitiesPage = isUniversitiesListPath(path) || document.getElementById("universitiesList");

  if (badge && window.APP_VERSION) {
    badge.textContent = `${window.APP_VERSION} • QOL (Quality of Life)`;
  }

  if (isUniversitiesPage) {
    // Keep universities first paint focused on list data; preload configs shortly after.
    window.setTimeout(() => {
      ensureExamConfig();
      ensureLanguageConfig();
    }, 1200);
    ensureCityDatabase();
    initUniversitiesPage();
  } else if (isGuidePath(path) || document.getElementById("guidePage")) {
    ensureExamConfig();
    ensureLanguageConfig();
    initGuidePage();
  } else if (isUniversityDetailPath(path) || document.getElementById("detailCard")) {
    ensureExamConfig();
    ensureLanguageConfig();
    initUniversityPage();
  } else if (isRankingPath(path) || document.getElementById("rankingList")) {
    ensureExamConfig();
    ensureLanguageConfig();
    initRankingPage();
  } else {
    ensureExamConfig();
    ensureLanguageConfig();
    initHomePageStats();
  }

  window.addEventListener("languageChanged", () => {
    applyAINameConfig();
    applyTranslations(document);
  });
});

async function initHomePageStats() {
  const uniStat = document.getElementById("stat-uni");
  const countryStat = document.getElementById("stat-countries");
  if (!uniStat || !countryStat) return;

  try {
    const resStats = await fetch(`${API_BASE}/stats`);
    if (resStats.ok) {
      const dataStats = await resStats.json();
      if (dataStats.universities_total) uniStat.textContent = dataStats.universities_total + "+";
      if (dataStats.countries_total) countryStat.textContent = dataStats.countries_total;
      return;
    }
    const resUni = await fetch(`${API_BASE}/universities?limit=1`);
    const dataUni = await resUni.json();

    const resLoc = await fetch(`${API_BASE}/locations`);
    const dataLoc = await resLoc.json();

    if (dataUni.total) uniStat.textContent = dataUni.total + "+";
    const countryCount = Object.keys(dataLoc).length;
    if (countryCount) countryStat.textContent = countryCount;
  } catch (e) {
    console.error("Failed to load stats:", e);
  }
}
