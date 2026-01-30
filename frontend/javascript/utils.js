/* 1. utils.js - Базовые настройки, утилиты и работа с профилем */

const API_BASE = "http://127.0.0.1:8000";
const PROFILE_STORAGE_KEY = "unisearch_profile";
const PROFILE_DEFAULTS = { name: "User", budget: "", exams: [] };

let CITY_OPTIONS_BY_COUNTRY = {};

async function loadCityDatabase() {
  try {
    // ❌ БЫЛО: const response = await fetch('data/cities.json');
    
    // ✅ СТАЛО: Запрашиваем у нашего Python-сервера (API)
    const response = await fetch(`${API_BASE}/locations`); 
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    CITY_OPTIONS_BY_COUNTRY = data;
    console.log("✅ База городов успешно загружена с Бэкенда");
    window.dispatchEvent(new Event("citiesLoaded"));
  } catch (error) {
    console.error("❌ Ошибка при загрузке городов:", error);
  }
}

loadCityDatabase();

const MAJOR_OPTIONS = [
  "Computer Science", "Engineering", "Business", "Medicine", "Natural Sciences",
  "Economics", "Physics", "Mathematics", "Law", "Social Sciences"
];

// --- Helpers ---
function $(id) { return document.getElementById(id); }

function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(str) {
  return String(str ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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

// --- Система уведомлений (TOASTS) ---
function showToast(message, type = "error") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`; // type: 'error' или 'success'
    
    // Иконка в зависимости от типа
    const icon = type === "success" ? "✅" : "⚠️";
    
    toast.innerHTML = `
        <span>${icon} ${escapeHtml(message)}</span>
        <button class="toast-close">&times;</button>
    `;

    // Удаление по клику на крестик
    toast.querySelector(".toast-close").onclick = () => removeToast(toast);

    // Авто-удаление через 3 секунды (было 2, сделал чуть больше для читаемости)
    setTimeout(() => removeToast(toast), 3000);

    // Добавляем в начало (новые снизу толкают старые вверх)
    container.appendChild(toast);
}

function removeToast(toast) {
    toast.style.animation = "fadeOut 0.3s ease forwards";
    toast.addEventListener("animationend", () => {
        if(toast.parentNode) toast.parentNode.removeChild(toast);
    });
}

// --- Управление профилем ---
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

/* --- Сохранение фильтров и состояния (LocalStorage) --- */
const FILTERS_KEY = "unisearch_filters";

// Сохраняем текущее состояние (фильтры + режим просмотра)
function saveFilters(state) {
    if (!state) return;
    // Копируем стейт, чтобы не мутировать оригинал
    const dataToSave = { 
        q: state.q,
        country: state.country,
        region: state.region,
        city: state.city,
        major: state.major,
        study_level: state.study_level,
        format: state.format,
        min_tuition: state.min_tuition,
        max_tuition: state.max_tuition,
        sort: state.sort,
        ai_balance: state.ai_balance,
        viewMode: state.viewMode || "list" // сохраняем режим: 'list' или 'map'
    };
    localStorage.setItem(FILTERS_KEY, JSON.stringify(dataToSave));
}

// Загружаем сохраненное состояние
function loadFilters() {
    try {
        const saved = localStorage.getItem(FILTERS_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.error("Error loading filters", e);
        return {};
    }
}