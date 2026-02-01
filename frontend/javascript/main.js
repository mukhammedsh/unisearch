/* frontend/javascript/main.js */
import { loadGlobalLayout } from "./components.js";
import { initUniversitiesPage, initUniversityPage, initRankingPage } from "./pages.js";
import { API_BASE } from "./utils.js"; // Импортируем API_BASE

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 UniSearch JS Loaded");

  await loadGlobalLayout();

  const badge = document.querySelector(".hero-badge");

  const path = window.location.pathname;

  // Если нашли бейдж И в конфиге есть версия — обновляем текст
  if (badge && window.APP_VERSION) {
      badge.textContent = `${window.APP_VERSION} • Infomatrix 2026`;
  }

  // ... (твои старые проверки страниц) ...
  if (path.includes("universities.html") || document.getElementById("universitiesList")) {
    initUniversitiesPage();
  } else if (path.includes("university.html") || document.getElementById("detailCard")) {
    initUniversityPage();
  } else if (path.includes("ranking.html") || document.getElementById("rankingList")) {
    initRankingPage();
  } else {
    // 🔥 Если это ГЛАВНАЯ страница (index.html или просто /)
    initHomePageStats();
  }
});

// Новая функция для Главной
async function initHomePageStats() {
    const uniStat = document.getElementById("stat-uni");
    const countryStat = document.getElementById("stat-countries");

    // Если элементов нет на странице, выходим
    if (!uniStat || !countryStat) return;

    try {
        // 1. Запрашиваем вузы (чтобы посчитать их)
        // limit=1, чтобы не грузить все данные, нам нужно только поле total
        const resUni = await fetch(`${API_BASE}/universities?limit=1`);
        const dataUni = await resUni.json();
        
        // 2. Запрашиваем города/страны
        const resLoc = await fetch(`${API_BASE}/locations`);
        const dataLoc = await resLoc.json();

        // 3. Обновляем цифры с красивой анимацией (опционально просто текст)
        if (dataUni.total) uniStat.textContent = dataUni.total + "+";
        
        // Считаем ключи в объекте dataLoc (это и есть страны)
        const countryCount = Object.keys(dataLoc).length;
        if (countryCount) countryStat.textContent = countryCount;

    } catch (e) {
        console.error("Failed to load stats:", e);
    }
}