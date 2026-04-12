// config.js
(function initRuntimeConfig(w) {
  const env = (w.__UNISEARCH_ENV__ && typeof w.__UNISEARCH_ENV__ === "object") ? w.__UNISEARCH_ENV__ : {};
  const host = String(location.hostname || "").toLowerCase();
  const port = String(location.port || "").trim();
  const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  const isDevStaticHost = !isLocal && ["5501", "5510"].includes(port) && !!host;

  const apiBaseFromEnv = String(env.API_BASE_URL || "").trim();
  const apiPortFromEnv = String(env.API_PORT || "").trim() || "8000";
  const inferredLocalApiBase = `${location.protocol}//${host || "127.0.0.1"}:${apiPortFromEnv}`;
  // On local static serving, use the same host with the configured backend port.
  // For production/non-dev hosts, keep reverse-proxy /api unless env.js overrides it.
  w.API_BASE_URL = apiBaseFromEnv || ((isLocal || isDevStaticHost) ? inferredLocalApiBase : "/api");

  w.APP_VERSION = "3.4.2";

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
    // Plain local static servers (localhost or LAN IP on dev ports) do not
    // rewrite pretty URLs like /universities -> /universities.html.
    else w.APP_USE_PRETTY_URLS = !(isLocal || isDevStaticHost);
  }
})(window);

// AI function display names (change these names in one place).
window.AI_FUNCTIONS = {
  fit: "UniFit",
  chance: "UniChance",
};

