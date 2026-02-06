/* frontend/javascript/main.js */
import { loadGlobalLayout } from "./components.js";
import { initUniversitiesPage, initUniversityPage, initRankingPage, initGuidePage } from "./pages.js";
import { API_BASE, aiName, initTheme, ensureExamConfig, ensureLanguageConfig, ensureCityDatabase } from "./utils.js";
import { initLanguagesPanel } from "./languages.js";

function applyAINameConfig() {
  const tokens = {
    fit: aiName("fit"),
    chance: aiName("chance"),
    mentor: aiName("mentor"),
  };

  const replace = (template) =>
    String(template || "")
      .replaceAll("{fit}", tokens.fit)
      .replaceAll("{chance}", tokens.chance)
      .replaceAll("{mentor}", tokens.mentor);

  document.querySelectorAll("[data-ai-template]").forEach((el) => {
    el.textContent = replace(el.getAttribute("data-ai-template"));
  });

  document.querySelectorAll("[data-ai-name]").forEach((el) => {
    const key = String(el.getAttribute("data-ai-name") || "").trim().toLowerCase();
    if (tokens[key]) el.textContent = tokens[key];
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 UniSearch JS Loaded");
  initTheme();

  // 1) Вставляет navbar + profile modal и вешает все обработчики (включая Languages)
  await loadGlobalLayout();

  applyAINameConfig();
  initLanguagesPanel();

  // Load configs early so UI and algorithms match previous behavior.
  ensureExamConfig();
  ensureLanguageConfig();

  const badge = document.querySelector(".hero-badge");
  const path = window.location.pathname;

  if (badge && window.APP_VERSION) {
    badge.textContent = `${window.APP_VERSION} • Infomatrix 2026`;
  }

  if (path.includes("universities.html") || document.getElementById("universitiesList")) {
    ensureCityDatabase();
    initUniversitiesPage();
  } else if (path.includes("guide.html") || document.getElementById("guidePage")) {
    initGuidePage();
  } else if (path.includes("university.html") || document.getElementById("detailCard")) {
    initUniversityPage();
  } else if (path.includes("ranking.html") || document.getElementById("rankingList")) {
    initRankingPage();
  } else {
    initHomePageStats();
  }
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
