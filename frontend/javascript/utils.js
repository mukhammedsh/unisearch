/* 1. utils.js - Базовые настройки, утилиты и работа с профилем */

export const API_BASE = window.API_BASE_URL || "http://127.0.0.1:8000";

export const $ = (id) => document.getElementById(id);

const PROFILE_STORAGE_KEY = "unisearch_profile";
// 🔥 ДОБАВЛЕНО: Новые поля в дефолтном профиле
const PROFILE_DEFAULTS = { 
    name: "User", 
    budget: "", 
    exams: [], 
    languages: [],   // ✅ новое поле
    major: "", 
    studyMode: "Any" 
};

export let EXAM_CONFIG = {
        "SAT": {"min": 400, "max": 1600, "type": "int", "step": 10},
        "ACT": {"min": 1, "max": 36, "type": "int", "step": 1},
        "GPA": {"min": 0, "max": 100, "type": "int", "step": 1},
        "UNT": {"min": 0, "max": 140, "type": "int", "step": 1},
        "NUET_Total": {"min": 0, "max": 240, "type": "int", "step": 1},
        "AP_Total": {"min": 0, "max": 25, "type": "int", "step": 1},
        "AP_Score": {"min": 1, "max": 5, "type": "int", "step": 1},
        "IB_Diploma": {"min": 24, "max": 45, "type": "int", "step": 1},
        "IB_Course": {"min": 1, "max": 7, "type": "int", "step": 1}
    };

async function loadExamConfig() {
  try {
    const response = await fetch(`${API_BASE}/exams/config`);
    if (!response.ok) throw new Error("Failed to load exam config");
    
    const raw = await response.json();

// Поддерживаем оба формата:
// 1) { "SAT": {min,max,...}, ... }
// 2) { version, exams: { ... } }
EXAM_CONFIG = raw?.exams ? raw.exams : raw;

console.log("✅ Exam config loaded:", EXAM_CONFIG);
window.dispatchEvent(new Event("examConfigLoaded"));
  } catch (error) {
    console.error("❌ Error loading exam config:", error);
    EXAM_CONFIG = {
        "SAT": {"min": 400, "max": 1600, "type": "int", "step": 10},
        "ACT": {"min": 1, "max": 36, "type": "int", "step": 1},
        "GPA": {"min": 0, "max": 100, "type": "int", "step": 1},
        "UNT": {"min": 0, "max": 140, "type": "int", "step": 1},
        "NUET_Total": {"min": 0, "max": 240, "type": "int", "step": 1},
        "AP_Total": {"min": 0, "max": 25, "type": "int", "step": 1},
        "AP_Score": {"min": 1, "max": 5, "type": "int", "step": 1},
        "IB_Diploma": {"min": 24, "max": 45, "type": "int", "step": 1},
        "IB_Course": {"min": 1, "max": 7, "type": "int", "step": 1}
    };
  }
}

loadExamConfig();

export let LANG_CONFIG = null;

async function loadLanguageConfig() {
  try {
    const response = await fetch(`${API_BASE}/languages/config`);
    if (!response.ok) throw new Error("Failed to load language config");
    LANG_CONFIG = await response.json();
    console.log("✅ Language config loaded:", LANG_CONFIG);
    window.dispatchEvent(new Event("languageConfigLoaded"));
  } catch (error) {
    console.error("❌ Error loading language config:", error);
    LANG_CONFIG = null;
  }
}

loadLanguageConfig();


export let CITY_OPTIONS_BY_COUNTRY = {};

async function loadCityDatabase() {
  try {
    const response = await fetch(`${API_BASE}/locations`); 
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    CITY_OPTIONS_BY_COUNTRY = data;
    console.log("✅ База городов успешно загружена");
    window.dispatchEvent(new Event("citiesLoaded"));
  } catch (error) {
    console.error("❌ Ошибка при загрузке городов:", error);
  }
}

loadCityDatabase();

export const MAJOR_OPTIONS = [
  "Computer Science",
  "Engineering",
  "Business",
  "Medicine",
  "Natural Sciences",
  "Economics",
  "Physics",
  "Mathematics",
  "Law",
  "Social Sciences",
  "Architecture",
  "Psychology",
  "Humanities",
  "Design",
  "Life Sciences",
  "Education",
  "Agriculture"
];

// --- Helpers ---
export function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function escapeHtml(str) {
  return String(str ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function nested(obj, path, fallback = null) {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return fallback;
    cur = cur[key];
  }
  return (cur === undefined || cur === null) ? fallback : cur;
}

export function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).slice(0, 2);
  return (parts.map(p => (p[0] || "").toUpperCase()).join("") || "U");
}

export function moneyUSD(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  return "$" + new Intl.NumberFormat("en-US").format(n);
}

export function setUrlParams(params) {
  const url = new URL(window.location.href);
  url.search = params.toString();
  window.history.replaceState({}, "", url.toString());
}

export function showToast(message, type = "error") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✅" : "⚠️";
    
    toast.innerHTML = `<span>${icon} ${escapeHtml(message)}</span><button class="toast-close">&times;</button>`;
    toast.querySelector(".toast-close").onclick = () => removeToast(toast);
    setTimeout(() => removeToast(toast), 3000);
    container.appendChild(toast);
}

export function removeToast(toast) {
    toast.style.animation = "fadeOut 0.3s ease forwards";
    toast.addEventListener("animationend", () => {
        if(toast.parentNode) toast.parentNode.removeChild(toast);
    });
}

// --- Управление профилем ---
export function loadProfile() {
  try {
    const s = localStorage.getItem(PROFILE_STORAGE_KEY);
    // Мержим с дефолтными значениями, чтобы новые поля (major, studyMode) появились
    return s ? { ...PROFILE_DEFAULTS, ...JSON.parse(s) } : { ...PROFILE_DEFAULTS };
  } catch(e) { return { ...PROFILE_DEFAULTS }; }
}

export function saveProfile(p) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("profileUpdated"));
}

/* --- Сохранение фильтров (ОЧИЩЕНО) --- */
const FILTERS_KEY = "unisearch_filters";

export function saveFilters(state) {
    if (!state) return;
    
    const dataToSave = { 
        q: state.q,
        country: state.country,
        region: state.region,
        city: state.city,
        // 🔥 УДАЛЕНО: major и format больше не сохраняются в фильтрах
        study_level: state.study_level,
        min_tuition: state.min_tuition,
        max_tuition: state.max_tuition,
        sort: state.sort,
        ai_balance: state.ai_balance,
        viewMode: state.viewMode || "list"
    };
    localStorage.setItem(FILTERS_KEY, JSON.stringify(dataToSave));
}

export function loadFilters() {
    try {
        const saved = localStorage.getItem(FILTERS_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.error("Error loading filters", e);
        return {};
    }
}

// --- Flags ---
const COUNTRY_CODES = {
  "Kazakhstan": "kz", "USA": "us", "South Korea": "kr", "Japan": "jp",
  "Hong Kong": "hk", "UK": "gb", "Switzerland": "ch", "Canada": "ca",
  "Australia": "au", "China": "cn", "Singapore": "sg", "Germany": "de", "Netherlands": "nl"
};

export function getFlagImg(countryName) {
  const code = COUNTRY_CODES[countryName];
  if (!code) return "";
  return `<img src="https://flagcdn.com/24x18/${code}.png" alt="${code}" style="width: 20px; height: 15px; object-fit: cover; border-radius: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">`;
}

export function initCustomSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (select.parentNode.classList.contains('custom-select-wrapper')) {
        const wrapper = select.parentNode;
        const parent = wrapper.parentNode;
        parent.insertBefore(select, wrapper);
        wrapper.remove();
        select.classList.remove('u-select-hidden');
    }

    const wrapper = document.createElement('div');
    wrapper.classList.add('custom-select-wrapper');
    select.parentNode.insertBefore(wrapper, select.nextSibling);
    wrapper.appendChild(select);
    select.classList.add('u-select-hidden');

    const trigger = document.createElement('div');
    trigger.classList.add('custom-select-trigger');
    wrapper.appendChild(trigger);

    const customOptions = document.createElement('div');
    customOptions.classList.add('custom-options');
    wrapper.appendChild(customOptions);

    function updateTrigger() {
        const selectedOption = select.options[select.selectedIndex];
        if (!selectedOption) return;
        const val = selectedOption.value;
        const text = selectedOption.text;
        const flag = getFlagImg(val); 
        if (flag) trigger.innerHTML = `<div style="display:flex; align-items:center; gap:10px;">${flag} <span>${text}</span></div>`;
        else trigger.innerHTML = `<span>${text}</span>`;
    }

    for (const option of select.options) {
        const div = document.createElement('div');
        div.classList.add('custom-option');
        const val = option.value;
        const text = option.text;
        const flag = getFlagImg(val); 
        if (flag) div.innerHTML = `${flag} <span>${text}</span>`;
        else div.textContent = text;

        if (option.selected) div.classList.add('selected');

        div.addEventListener('click', () => {
            select.value = val;
            select.dispatchEvent(new Event('change')); 
            updateTrigger();
            wrapper.classList.remove('open');
            wrapper.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
        });
        customOptions.appendChild(div);
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select-wrapper').forEach(w => { if (w !== wrapper) w.classList.remove('open'); });
        wrapper.classList.toggle('open');
    });

    updateTrigger();
    document.addEventListener('click', (e) => { if (!wrapper.contains(e.target)) wrapper.classList.remove('open'); });
}