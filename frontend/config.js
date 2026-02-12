// config.js
window.API_BASE_URL =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "https://unisearch-bsjl.onrender.com";

window.APP_VERSION = "2.1.2";

// AI function display names (change these names in one place).
window.AI_FUNCTIONS = {
  fit: "UniFit",
  chance: "UniChance",
};
