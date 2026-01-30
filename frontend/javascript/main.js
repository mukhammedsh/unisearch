/* 5. main.js - Точка входа приложения */

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 UniSearch JS Loaded");

  // Инициализация профиля (есть на всех страницах)
  initProfileUI();

  // Простой роутер
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