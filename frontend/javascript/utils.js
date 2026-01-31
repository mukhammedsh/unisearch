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
  "Computer Science",
  "Engineering",
  "Business",
  "Medicine",
  "Natural Sciences", // Covers Physics, Chemistry, Biology
  "Economics",
  "Physics",
  "Mathematics",
  "Law",
  "Social Sciences",
  "Architecture",       // <-- Добавлено (есть в MIT, Delft, ETH)
  "Psychology",         // <-- Добавлено (есть в Stanford, Toronto)
  "Humanities",         // <-- Добавлено (Arts & Humanities)
  "Design",             // <-- Добавлено (Industrial Design)
  "Life Sciences",      // <-- Добавлено (Biology, Bioengineering)
  "Education",          // <-- Добавлено (Melbourne, SDU)
  "Agriculture"         // <-- Добавлено (Kyoto, Tokyo)
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

// --- Flags Configuration (ISO Codes) ---
const COUNTRY_CODES = {
  "Kazakhstan": "kz",
  "USA": "us",
  "South Korea": "kr",
  "Japan": "jp",
  "Hong Kong": "hk",
  "UK": "gb",
  "Switzerland": "ch",
  "Canada": "ca",
  "Australia": "au",
  "China": "cn",
  "Singapore": "sg",
  "Germany": "de",
  "Netherlands": "nl"
};

// Функция 1: Возвращает HTML-картинку (для красивых карточек)
function getFlagImg(countryName) {
  const code = COUNTRY_CODES[countryName];
  if (!code) return "";
  // Используем CDN flagcdn.com (размер 20x15 px)
  return `<img src="https://flagcdn.com/24x18/${code}.png" alt="${code}" style="width: 20px; height: 15px; object-fit: cover; border-radius: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">`;
}

// Функция 2: Возвращает эмодзи (для выпадающего списка)
// В Windows это будут буквы (KZ, US), но это единственное, что работает внутри <option>
function getFlagEmoji(countryName) {
  const code = COUNTRY_CODES[countryName];
  if (!code) return "🏳️";
  
  // Магическая формула: превращает "kz" в 🇰🇿
  return code.toUpperCase().replace(/./g, char => 
      String.fromCodePoint(char.charCodeAt(0) + 127397)
  );
}

function initCustomSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // 1. Очистка: Если уже есть кастомный список, удаляем его перед перерисовкой
    // Это важно для кнопок Reset или когда список городов обновляется
    if (select.parentNode.classList.contains('custom-select-wrapper')) {
        const wrapper = select.parentNode;
        const parent = wrapper.parentNode;
        parent.insertBefore(select, wrapper); // Возвращаем селект на место
        wrapper.remove(); // Удаляем обертку
        select.classList.remove('u-select-hidden');
    }

    // 2. Создаем структуру
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

    // Функция обновления заголовка (то, что видит пользователь)
    function updateTrigger() {
        const selectedOption = select.options[select.selectedIndex];
        // Защита, если список пустой
        if (!selectedOption) return;

        const val = selectedOption.value;
        const text = selectedOption.text;
        
        // Пытаемся получить флаг (если это страна)
        const flag = getFlagImg(val); 

        if (flag) {
            // Если есть флаг — рисуем с флагом
            trigger.innerHTML = `<div style="display:flex; align-items:center; gap:10px;">${flag} <span>${text}</span></div>`;
        } else {
            // Если флага нет (например, Major или Sort) — просто текст
            trigger.innerHTML = `<span>${text}</span>`;
        }
    }

    // 3. Генерация списка опций
    for (const option of select.options) {
        const div = document.createElement('div');
        div.classList.add('custom-option');
        
        const val = option.value;
        const text = option.text;
        const flag = getFlagImg(val); // Проверяем, есть ли флаг для этого значения

        if (flag) {
            div.innerHTML = `${flag} <span>${text}</span>`;
        } else {
            div.textContent = text;
        }

        // Подсветка выбранного
        if (option.selected) {
            div.classList.add('selected');
        }

        div.addEventListener('click', () => {
            select.value = val;
            select.dispatchEvent(new Event('change')); // Сообщаем сайту, что выбор изменился
            
            updateTrigger();
            wrapper.classList.remove('open');
            
            wrapper.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
        });

        customOptions.appendChild(div);
    }

    // Открытие/закрытие
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Закрываем другие открытые списки, чтобы не накладывались
        document.querySelectorAll('.custom-select-wrapper').forEach(w => {
            if (w !== wrapper) w.classList.remove('open');
        });
        wrapper.classList.toggle('open');
    });

    // Инициализация (показать текущее значение)
    updateTrigger();

    // Закрытие при клике вне элемента
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
        }
    });
}