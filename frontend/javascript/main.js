import { loadGlobalLayout } from "./components.js";
import { initUniversitiesPage, initUniversityPage, initRankingPage } from "./pages.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 UniSearch JS Loaded");

  await loadGlobalLayout();

  const path = window.location.pathname;

  if (path.includes("universities.html") || document.getElementById("universitiesList")) {
    console.log("✅ Page: Universities List");
    initUniversitiesPage();
  } else if (path.includes("university.html") || document.getElementById("detailCard")) {
    console.log("✅ Page: University Details");
    initUniversityPage();
  } else if (path.includes("ranking.html") || document.getElementById("rankingList")) {
    console.log("✅ Page: Ranking");
    initRankingPage();
  }
});
