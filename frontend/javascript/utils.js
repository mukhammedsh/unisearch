/* 1. utils.js - Базовые настройки, утилиты и работа с профилем */

const API_BASE = "http://127.0.0.1:8000";
const PROFILE_STORAGE_KEY = "unisearch_profile";
const PROFILE_DEFAULTS = { name: "User", budget: "", exams: [] };

let CITY_OPTIONS_BY_COUNTRY = {};

// Загрузка базы городов
async function loadCityDatabase() {
  try {
    // 🔥 ПУТЬ ИСПРАВЛЕН: теперь он ведет в папку data
    const response = await fetch('data/cities.json'); 
    
    const data = await response.json();
    CITY_OPTIONS_BY_COUNTRY = data;
    console.log("База городов успешно загружена");
    window.dispatchEvent(new Event("citiesLoaded"));
  } catch (error) {
    console.error("Ошибка при загрузке городов:", error);
  }
}
loadCityDatabase();

const MAJOR_OPTIONS = [
  "Computer Science", "Engineering", "Business", "Medicine", "Natural Sciences",
  "Economics", "Physics", "Mathematics", "Law", "Social Sciences"
];

// --- Helpers (Помощники) ---
function $(id) { return document.getElementById(id); }

function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nested(obj, path, fallback = null) {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return fallback;
    cur = cur[key];
  }
  return (cur === undefined || cur === null) ? fallback : cur;
}

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).slice(0, 2);
  return (parts.map(p => (p[0] || "").toUpperCase()).join("") || "U");
}

function moneyUSD(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  return "$" + new Intl.NumberFormat("en-US").format(n);
}

function setUrlParams(params) {
  const url = new URL(window.location.href);
  url.search = params.toString();
  window.history.replaceState({}, "", url.toString());
}

// --- Управление профилем (Global) ---
function loadProfile() {
  try {
    const s = localStorage.getItem(PROFILE_STORAGE_KEY);
    return s ? JSON.parse(s) : { ...PROFILE_DEFAULTS };
  } catch(e) { return { ...PROFILE_DEFAULTS }; }
}

function saveProfile(p) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("profileUpdated"));
}