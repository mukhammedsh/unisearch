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

const EXAM_LABEL_OVERRIDES = {
  SAT: "SAT",
  ACT: "ACT",
  GPA: "GPA",
  UNT: "UNT (ЕНТ)",
  NUET_Total: "NUET Total",
  AP_Total: "AP Total",
  AP_Score: "AP Subject Score",
  IB_Diploma: "IB Diploma",
  IB_Course: "IB Course Grade",
  IELTS: "IELTS Academic",
  TOEFL_iBT_0_120: "TOEFL iBT (0-120)",
  TOEFL_iBT_1_6: "TOEFL iBT (1-6)",
  DET: "Duolingo English Test (DET)",
  PTE: "PTE Academic",
  Cambridge_C1_Advanced: "Cambridge C1 Advanced",
  TestDaF_TDN: "TestDaF (TDN)",
  DSH_Level: "DSH Level",
  DELF_DALF_Level: "DELF/DALF Level",
  TCF_Total: "TCF Total",
  NT2_Programme_II: "NT2 Programme II",
  HSK_Level: "HSK Level",
  JLPT_Level: "JLPT Level",
  TOPIK_Level: "TOPIK Level",
};

function humanizeExamId(examId) {
  const s = String(examId || "").trim();
  if (!s) return "";
  return s
    .replaceAll("_", " ")
    .replace(/\bIbt\b/g, "iBT")
    .replace(/\bNuet\b/g, "NUET")
    .replace(/\bDsh\b/g, "DSH")
    .replace(/\bTdn\b/g, "TDN")
    .replace(/\bJlpt\b/g, "JLPT")
    .replace(/\bTopik\b/g, "TOPIK")
    .replace(/\bHsk\b/g, "HSK")
    .replace(/\bTcf\b/g, "TCF")
    .replace(/\bDelf\b/g, "DELF")
    .replace(/\bDalf\b/g, "DALF");
}

function getLangExamLabel(examId, langCode = "") {
  const targetId = String(examId || "").trim();
  if (!targetId) return "";

  const groups = LANG_CONFIG?.language_exams;
  if (!groups || typeof groups !== "object") return "";

  const code = String(langCode || "").trim().toLowerCase();
  if (code && Array.isArray(groups[code])) {
    const found = groups[code].find((x) => String(x?.id || "").trim() === targetId);
    if (found?.label) return String(found.label);
  }

  for (const arr of Object.values(groups)) {
    if (!Array.isArray(arr)) continue;
    const found = arr.find((x) => String(x?.id || "").trim() === targetId);
    if (found?.label) return String(found.label);
  }

  return "";
}

export function getExamDisplayName(examId, opts = {}) {
  const id = String(examId || "").trim();
  if (!id) return "";

  const langLabel = getLangExamLabel(id, opts.langCode || "");
  if (langLabel) return langLabel;

  const cfgLabel = EXAM_CONFIG?.[id]?.label || EXAM_CONFIG?.[id.toUpperCase()]?.label;
  if (cfgLabel) return String(cfgLabel);

  if (EXAM_LABEL_OVERRIDES[id]) return EXAM_LABEL_OVERRIDES[id];
  if (EXAM_LABEL_OVERRIDES[id.toUpperCase()]) return EXAM_LABEL_OVERRIDES[id.toUpperCase()];

  return humanizeExamId(id);
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
    const raw = s ? JSON.parse(s) : {};
    const normalized = normalizeProfile(raw);

    // optional: если хочешь автоматически почистить localStorage от мусора
    // localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));

    return normalized;
  } catch (e) {
    return { ...PROFILE_DEFAULTS };
  }
}

const FALLBACK_LANG_LIMITS = {
  "IELTS": { min: 0, max: 9, step: 0.5 },
  "TOEFL": { min: 0, max: 120, step: 1 },
  "Duolingo": { min: 10, max: 160, step: 1 },
  "DET": { min: 10, max: 160, step: 1 },       // если используешь DET как отдельный ключ
  "Cambridge": { min: 80, max: 230, step: 1 },
  "PTE": { min: 10, max: 90, step: 1 },
};

export function saveProfile(p) {
  const normalized = normalizeProfile(p);
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
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

export function getLangExamLimits(examId, LANG_CONFIG) {
  const le = LANG_CONFIG?.language_exams;
  if (!le) return null;

  for (const locale of Object.keys(le)) {
    const arr = le[locale];
    if (!Array.isArray(arr)) continue;
    const found = arr.find(x => x?.id === examId);
    if (found) return { min: found.min, max: found.max, step: found.step };
  }
  return null;
}

export function clampNumberToLimits(val, limits) {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  if (!limits) return n;

  let out = n;
  const min = Number(limits.min);
  const max = Number(limits.max);
  const step = Number(limits.step);

  if (Number.isFinite(min)) out = Math.max(min, out);
  if (Number.isFinite(max)) out = Math.min(max, out);

  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    out = base + Math.round((out - base) / step) * step;
    if (Number.isFinite(min)) out = Math.max(min, out);
    if (Number.isFinite(max)) out = Math.min(max, out);
    out = Math.round(out * 1000) / 1000;
  }
  return out;
}

export function applyNumberInputLimits(inputEl, limits) {
  if (!inputEl) return;

  if (!limits) {
    inputEl.removeAttribute("min");
    inputEl.removeAttribute("max");
    inputEl.removeAttribute("step");
    return;
  }

  if (limits.min !== undefined) inputEl.min = String(limits.min);
  if (limits.max !== undefined) inputEl.max = String(limits.max);
  if (limits.step !== undefined) inputEl.step = String(limits.step);
}

export function applyLanguageExamInputLimits(inputEl, examId) {
  // 1) config с сервера
  let limits = getLangExamLimits(examId, LANG_CONFIG);

  // 2) fallback
  if (!limits) limits = FALLBACK_LANG_LIMITS[examId] || null;

  applyNumberInputLimits(inputEl, limits);
  return limits; // удобно для отладки
}


function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function roundToStep(val, min, step) {
  const base = Number.isFinite(min) ? min : 0;
  const out = base + Math.round((val - base) / step) * step;
  return Math.round(out * 1000) / 1000;
}

function clampWithCfg(score, cfg) {
  let v = Number(score);
  if (!Number.isFinite(v)) return null;
  const min = Number.isFinite(Number(cfg?.min)) ? Number(cfg.min) : -Infinity;
  const max = Number.isFinite(Number(cfg?.max)) ? Number(cfg.max) : Infinity;
  const step = Number.isFinite(Number(cfg?.step)) ? Number(cfg.step) : null;

  v = clamp(v, min, max);
  if (step && step > 0) v = roundToStep(v, min, step);
  return clamp(v, min, max);
}

function normalizeProfile(p) {
  const out = { ...PROFILE_DEFAULTS, ...(p || {}) };

  // --- Academic exams: profile.exams = [{id:"SAT", score:1500}, ...]
  if (!Array.isArray(out.exams)) out.exams = [];
  out.exams = out.exams
    .map(it => {
      const rawId = String(it?.id || it?.exam || "").trim();
      const id = rawId || "";
      if (!id) return null;

      const cfg =
        EXAM_CONFIG?.[id] ||
        EXAM_CONFIG?.[id.toUpperCase()] ||
        null;
      const normalizedId = EXAM_CONFIG?.[id] ? id : (EXAM_CONFIG?.[id.toUpperCase()] ? id.toUpperCase() : id);
      if (!cfg) return { ...it, id: normalizedId, exam: normalizedId }; // если нет конфига — не трогаем

      const clamped = clampWithCfg(it?.score, cfg);
      return { ...it, id: normalizedId, exam: normalizedId, score: (clamped ?? it?.score) };
    })
    .filter(Boolean);

  // --- Language exams: profile.languages = [{kind:"Exam", exam:"IELTS", score:7.5}, ...]
  if (!Array.isArray(out.languages)) out.languages = [];
  out.languages = out.languages
    .map(it => {
      if (!it || typeof it !== "object") return null;

      const code = String(it?.code || it?.lang || "").trim().toLowerCase();
      const kind = String(it?.kind || "").trim().toLowerCase();
      if (!code || !kind) return null;

      if (kind === "native") {
        return { code, kind };
      }

      if (kind === "cefr") {
        const level = Number(it?.level);
        if (!Number.isInteger(level) || level < 1 || level > 6) return null;
        return { code, kind, level };
      }

      if (kind === "exam") {
        const examId = String(it?.exam || it?.examId || "").trim();
        if (!examId) return null;

        // 1) пробуем из LANG_CONFIG
        let limits = getLangExamLimits(examId, LANG_CONFIG);

        // 2) если не нашли — пробуем fallback
        if (!limits) limits = FALLBACK_LANG_LIMITS[examId] || null;

        const clamped = limits ? clampNumberToLimits(it?.score, limits) : Number(it?.score);
        if (!Number.isFinite(clamped)) return null;

        return { code, kind, exam: examId, score: clamped };
      }

      return null;
    })
    .filter(Boolean);

  return out;
}
