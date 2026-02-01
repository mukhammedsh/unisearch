// config.js
window.API_BASE_URL =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "https://unisearch-bsjl.onrender.com";