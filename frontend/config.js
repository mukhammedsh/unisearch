// config.js
window.API_BASE_URL =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "https://unisearch-bsjl.onrender.com";

window.APP_VERSION = "2.4.0";

// Use pretty URLs in deployed environments by default.
// Local static dev server (python -m http.server) keeps .html routes.
window.APP_USE_PRETTY_URLS =
  !["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(location.hostname || "").toLowerCase());

// AI function display names (change these names in one place).
window.AI_FUNCTIONS = {
  fit: "UniFit",
  chance: "UniChance",
};
