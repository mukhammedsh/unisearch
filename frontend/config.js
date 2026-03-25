// config.js
(function initRuntimeConfig(w) {
  const env = (w.__UNISEARCH_ENV__ && typeof w.__UNISEARCH_ENV__ === "object") ? w.__UNISEARCH_ENV__ : {};
  const host = String(location.hostname || "").toLowerCase();
  const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);

  const apiBaseFromEnv = String(env.API_BASE_URL || "").trim();
  // Non-local fallback expects reverse-proxy /api (or provide API_BASE_URL via env.js).
  w.API_BASE_URL = apiBaseFromEnv || (isLocal ? "http://127.0.0.1:8000" : "/api");

  w.APP_VERSION = "2.5.8";

  const debugRaw = env.APP_DEBUG;
  if (typeof debugRaw === "boolean") {
    w.APP_DEBUG = debugRaw;
  } else {
    const debugText = String(debugRaw ?? "").trim().toLowerCase();
    w.APP_DEBUG = ["1", "true", "yes", "on"].includes(debugText);
  }

  const prettyRaw = env.APP_USE_PRETTY_URLS;
  if (typeof prettyRaw === "boolean") {
    w.APP_USE_PRETTY_URLS = prettyRaw;
  } else {
    const prettyText = String(prettyRaw ?? "").trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(prettyText)) w.APP_USE_PRETTY_URLS = true;
    else if (["0", "false", "no", "off"].includes(prettyText)) w.APP_USE_PRETTY_URLS = false;
    else w.APP_USE_PRETTY_URLS = !isLocal;
  }
})(window);

// AI function display names (change these names in one place).
window.AI_FUNCTIONS = {
  fit: "UniFit",
  chance: "UniChance",
};

