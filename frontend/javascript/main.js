/* 5. main.js - Точка входа приложения */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 UniSearch JS Loaded");

  // 1. Сначала грузим меню и профиль из layout.html
  // Функция берется из components.js
  if (typeof loadGlobalLayout === "function") {
      await loadGlobalLayout();
  } else {
      console.error("❌ loadGlobalLayout not found! Check components.js");
  }

  // 2. Потом запускаем логику конкретной страницы
  const path = window.location.pathname;

  if (path.includes("universities.html") || document.getElementById("universitiesList")) {
      console.log("✅ Page: Universities List");
      initUniversitiesPage();
  } 
  else if (path.includes("university.html") || document.getElementById("detailCard")) {
      console.log("✅ Page: University Details");
      initUniversityPage();
  }
  else if (path.includes("ranking.html") || document.getElementById("rankingList")) {
      console.log("✅ Page: Ranking");
      initRankingPage();
  }
});