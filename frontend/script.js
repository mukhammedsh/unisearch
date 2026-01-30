/* UniSearch script - Full Version */

const API_BASE = "http://127.0.0.1:8000";
const PROFILE_STORAGE_KEY = "unisearch_profile";
const PROFILE_DEFAULTS = { name: "User", budget: "", exams: [] };

let CITY_OPTIONS_BY_COUNTRY = {};

async function loadCityDatabase() {
  try {
    const response = await fetch('./cities.json'); 
    const data = await response.json();
    
    CITY_OPTIONS_BY_COUNTRY = data;
    
    console.log("База городов успешно загружена");
    
    // 🔥 ВАЖНО: Отправляем сигнал, что база готова!
    window.dispatchEvent(new Event("citiesLoaded"));
    
  } catch (error) {
    console.error("Ошибка при загрузке городов:", error);
  }
}

loadCityDatabase();

const MAJOR_OPTIONS = [
  "Computer Science",
  "Engineering",
  "Business",
  "Medicine",
  "Natural Sciences",
  "Economics",
  "Physics",
  "Mathematics",
  "Law",
  "Social Sciences"
];

// ---------- Helpers ----------
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

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function setUrlParams(params) {
  const url = new URL(window.location.href);
  url.search = params.toString();
  window.history.replaceState({}, "", url.toString());
}

// ---------- Init Routing ----------
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Script loaded! Checking page..."); // Это должно появиться в консоли

  // Запускаем модалку профиля везде
  initProfileUI();

  // Проверяем, на какой мы странице, по URL или наличию элементов
  const path = window.location.pathname;

  if (path.includes("universities.html") || document.getElementById("universitiesList")) {
      console.log("✅ Detected Universities List Page");
      initUniversitiesPage();
  } 
  
  else if (path.includes("university.html") || document.getElementById("detailCard")) {
      console.log("✅ Detected Details Page");
      initUniversityPage(); // <--- Вот эта функция должна запуститься!
  }
});

// =====================================
// PAGE: UNIVERSITIES LIST
// =====================================
function initUniversitiesPage() {
  const el = {
    qInput: $("qInput"),
    countrySelect: $("countrySelect"),
    stateDiv: $("stateDiv"),      // 🔥 Обертка штата
    stateSelect: $("stateSelect"),// 🔥 Селект штата
    citySelect: $("citySelect"),
    majorSelect: $("majorSelect"),
    studyLevelSelect: $("studyLevelSelect"),
    formatSelect: $("formatSelect"),

    minTuitionInput: $("minTuitionInput"),
    maxTuitionInput: $("maxTuitionInput"),
    
    sortSelect: $("sortSelect"),
    resetBtn: $("resetFiltersBtn"),

    list: $("universitiesList"),
    total: $("totalCount"),
    state: $("listState"),
    pagination: $("pagination"),
  };

  if (!el.list) return;

  const state = {
    q: "",
    country: "",
    region: "", // 🔥 Состояние для штата
    city: "",
    major: "",
    study_level: "",
    format: "",
    min_tuition: "",
    max_tuition: "",
    sort: "name_asc",
    page: 1,
    limit: 12,
  };

  // 1. Initial Setup
  readFromUrl();
  updateMajorOptions();

  const initLocations = () => {
      updateCountryOptions();
      
      if (state.country) {
          el.countrySelect.value = state.country;
          // Запускаем логику: проверяем, нужны ли штаты
          updateLocationLogic(state.country);
          
          // Если был выбран штат, восстанавливаем его
          if (state.region && el.stateSelect && el.stateSelect.offsetParent !== null) {
              el.stateSelect.value = state.region;
              updateCitiesForState(state.country, state.region);
          }
          
          // Восстанавливаем город
          if (state.city) {
              el.citySelect.value = state.city;
          }
      }
  };
  
  // Если база уже есть - рисуем сразу
  if (Object.keys(CITY_OPTIONS_BY_COUNTRY).length > 0) {
      initLocations();
  }

  // Слушаем, когда база догрузится (если интернет медленный)
  window.addEventListener("citiesLoaded", () => {
      console.log("⚡ Cities loaded event, updating UI...");
      initLocations();
  });

  applyToForm();

  const refetch = debounce(() => {
    state.page = 1;
    fetchAndRender();
  }, 250);

  // 2. Event Listeners
  el.qInput?.addEventListener("input", () => { state.q = el.qInput.value.trim(); refetch(); });
  
  el.countrySelect?.addEventListener("change", () => {
    state.country = el.countrySelect.value;
    state.region = ""; 
    state.city = ""; 
    
    // Сбрасываем визуально
    if(el.stateSelect) el.stateSelect.value = "";
    if(el.citySelect) el.citySelect.value = "";

    updateLocationLogic(state.country);
    refetch();
  });

  el.stateSelect?.addEventListener("change", () => {
    state.region = el.stateSelect.value;
    state.city = ""; // Новый штат = сброс города
    
    updateCitiesForState(state.country, state.region);
    refetch();
  });

  el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
  el.majorSelect?.addEventListener("change", () => { state.major = el.majorSelect.value; refetch(); });
  el.studyLevelSelect?.addEventListener("change", () => { state.study_level = el.studyLevelSelect.value; refetch(); });
  el.formatSelect?.addEventListener("change", () => { state.format = el.formatSelect.value; refetch(); });
  el.minTuitionInput?.addEventListener("input", () => { state.min_tuition = el.minTuitionInput.value; refetch(); });
  el.maxTuitionInput?.addEventListener("input", () => { state.max_tuition = el.maxTuitionInput.value; refetch(); });
  el.sortSelect?.addEventListener("change", () => { state.sort = el.sortSelect.value; refetch(); });

  el.resetBtn?.addEventListener("click", () => {
    Object.assign(state, {
      q: "", country: "", region: "", city: "", major: "", study_level: "", format: "",
      min_tuition: "", max_tuition: "", sort: "name_asc", page: 1
    });
    applyToForm();
    // Скрываем штаты при сбросе
    if (el.stateDiv) el.stateDiv.style.display = "none";
    updateCityDropdown([]);
    fetchAndRender();
  });

  // Card click handler
  el.list.addEventListener("click", (e) => {
    const card = e.target.closest("[data-uni-id]");
    if (!card) return;
    if (e.target.tagName === "A") return;
    const id = card.getAttribute("data-uni-id");
    if (id) window.location.href = `university.html?id=${encodeURIComponent(id)}`;
  });

  // Initial Fetch
  fetchAndRender();

  // Слушаем обновление профиля и перерисовываем список на лету
  window.addEventListener("profileUpdated", () => {
      fetchAndRender();
  });

  // --- Functions ---

  function buildParams() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.country) p.set("country", state.country);
    // Добавляем штат в URL (для сохранения состояния), даже если бэкенд его пока не фильтрует
    if (state.region) p.set("region", state.region);
    if (state.city) p.set("city", state.city);
    
    if (state.major) p.set("major", state.major);
    if (state.study_level) p.set("study_level", state.study_level);
    if (state.format) p.set("format", state.format);
    if (state.min_tuition) p.set("min_tuition", state.min_tuition);
    if (state.max_tuition) p.set("max_tuition", state.max_tuition);
    
    const isAiSort = (state.sort === "uni_chance" || state.sort === "uni_budget");
    p.set("sort", isAiSort ? "name_asc" : state.sort);

    if (state.sort === "uni_chance" || state.sort === "uni_budget") {
        p.set("limit", "100"); 
        p.set("page", "1"); 
    } else {
        p.set("page", String(state.page));
        p.set("limit", String(state.limit));
    }
    return p;
  }

  // ==========================================
  // 🧠 UniFit Sorting (Chance / Budget)
  // - returns ALL universities (soft ranking)
  // - exams missing in user profile => "unknown" (no hard penalty)
  // - user below uni min on required exam => strong penalty
  // ==========================================

  const UNIFIT_WEIGHTS = {
    chance:   { exams: 0.70, budget: 0.10, acceptance: 0.20 },
    budget:   { exams: 0, budget: 1, acceptance: 0 },
  };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function acceptanceScore(u) {
    const ar = u?.academics?.acceptance_rate_percent;
    if (ar === undefined || ar === null || isNaN(ar)) return 0.5;
    return clamp(ar / 100, 0, 1);
  }

  // Budget score differs by mode
  function budgetScore(u, userBudget, mode) {
    const cost = u?.finance?.total_cost_year_usd;
    if (!userBudget || isNaN(userBudget) || userBudget <= 0) return 0.5;
    if (cost === undefined || cost === null || isNaN(cost)) return 0.5;
    const hasAid = !!(u?.finance?.financial_aid?.merit_based || u?.finance?.financial_aid?.need_based);
    const ratio = cost / userBudget;
    if (cost <= userBudget) {
      let s = 0.50 + 0.50 * clamp(ratio, 0, 1);
      if (mode === "chance") s = 0.85 + 0.15 * clamp(ratio, 0, 1);
      return clamp(s, 0, 1);
    }
    const over = (cost - userBudget) / userBudget;
    let s;
    if (mode === "chance") s = 1.00 - 1.5 * over;
    else s = 1.00 - 2.5 * over;
    if (hasAid) s += (mode === "chance" ? 0.05 : 0.10);
    return clamp(s, 0, 1);
  }


  // Exams scoring:
  // - evaluates only exams that exist both in user profile and in uni requirements (min/avg)
  // - user below min => hard negative penalty
  // - if no matched exams => neutral 0.5, but low "coverage" reduces confidence slightly
  function examsScore(u, userScores) {
    const minMap = u?.exams_min || {};
    const avgMap = u?.exams_avg || {};
    const uniExamKeys = new Set([...Object.keys(minMap || {}), ...Object.keys(avgMap || {})]);
    const comparable = [];
    for (const examKey of uniExamKeys) {
      const key = examKey.toUpperCase();
      if (userScores[key] !== undefined && !isNaN(userScores[key])) comparable.push(key);
    }
    if (comparable.length === 0) return { score01: 0.5, penalty: 0, coverage: 0 };

    let sum = 0;
    let hardFails = 0;
    for (const key of comparable) {
      const user = userScores[key];
      const min = (minMap[key] !== undefined) ? minMap[key] : minMap[key.toLowerCase()];
      const avg = (avgMap[key] !== undefined) ? avgMap[key] : avgMap[key.toLowerCase()];
      const minVal = (min !== undefined && !isNaN(min)) ? Number(min) : 0;
      const avgVal = (avg !== undefined && !isNaN(avg)) ? Number(avg) : 0;

      if (minVal > 0 && user < minVal) {
        hardFails += 1;
        sum += 0.05;
        continue;
      }
      if (avgVal > 0) {
        const r = user / avgVal;
        const s = clamp(0.75 + (r - 1) * 1.0, 0, 1);
        sum += s;
      } else if (minVal > 0) {
        const r = user / minVal;
        const s = clamp(0.70 + (r - 1) * 0.3, 0, 1);
        sum += s;
      } else { sum += 0.5; }
    }
    const avgScore = sum / comparable.length;
    const coverage = clamp(comparable.length / Math.max(1, uniExamKeys.size), 0, 1);
    const penalty = hardFails * 0.75;
    const confidenceMult = 0.8 + 0.2 * coverage;
    return { score01: clamp(avgScore * confidenceMult, 0, 1), penalty, coverage };
  }

  // Main scoring function
  function uniFitScore(u, profile, mode) {
    const weights = UNIFIT_WEIGHTS[mode] || UNIFIT_WEIGHTS.chance;
    const userBudget = profile?.budget ? Number(profile.budget) : 0;
    const userScores = {};
    if (profile?.exams && Array.isArray(profile.exams)) {
      for (const item of profile.exams) {
        if (!item?.exam) continue;
        const key = String(item.exam).toUpperCase().trim();
        const val = Number(item.score);
        if (!isNaN(val)) userScores[key] = val;
      }
    }
    const ex = examsScore(u, userScores);
    const b  = budgetScore(u, userBudget, mode);
    const a  = acceptanceScore(u);
    let score01 = ex.score01 * weights.exams + b * weights.budget + a * weights.acceptance;
    score01 = clamp(score01 - ex.penalty, 0, 1);
    return { score01, breakdown: { exams: ex.score01, budget: b, acceptance: a, penalty: ex.penalty, coverage: ex.coverage, weights } };
  }

  // Public API: sorts and returns universities
  function getUniSort(universities, mode = "chance", { returnDebug = false } = {}) {
    const profile = loadProfile?.() || {};
    if (!Array.isArray(universities) || universities.length === 0) return [];
    const scored = universities.map(u => {
      const res = uniFitScore(u, profile, mode);
      return { uni: u, score01: res.score01, breakdown: res.breakdown };
    });
    scored.sort((x, y) => y.score01 - x.score01);
    if (returnDebug) return scored;
    return scored.map(x => x.uni);
  }


  async function fetchAndRender() {
    console.log("PROFILE:", loadProfile());
    el.state && (el.state.textContent = "Loading...");
    el.list.innerHTML = "";
    el.pagination && (el.pagination.innerHTML = "");

    const params = buildParams();
    setUrlParams(params);

    try {
      const res = await fetch(`${API_BASE}/universities?${params.toString()}`);
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();

      let items = data.items || [];
      const total = data.total || 0;

      if (state.sort === "uni_chance") items = getUniSort(items, "chance"); 
      if (state.sort === "uni_budget") items = getUniSort(items, "budget"); 

      const isAiSort = (state.sort === "uni_chance" || state.sort === "uni_budget");
      if (el.total) el.total.textContent = String(isAiSort ? items.length : total);
      
      if (!items.length) {
        el.state && (el.state.textContent = "No universities found.");
        return;
      }
      el.state && (el.state.textContent = "");
      const profile = loadProfile();
      const userBudget = parseFloat(profile.budget);
      el.list.innerHTML = items.map(u => renderCard(u, userBudget)).join("");
      if (!isAiSort) renderPagination(total);
      else if (el.pagination) el.pagination.innerHTML = "";
    } catch (err) {
      console.error(err);
      el.state && (el.state.textContent = "Failed to load data.");
    }
  }

  function renderCard(u, _unusedBudget) { 
    const id = u.id;
    const name = u.name;
    const country = nested(u, ["location", "country"], "");
    const city = nested(u, ["location", "city"], "");
    const loc = [city, country].filter(Boolean).join(", ");
    const cost = nested(u, ["finance", "total_cost_year_usd"], 0);
    const acceptance = nested(u, ["academics", "acceptance_rate_percent"], "?");
    const logoSrc = `images/logos/${id}.png`;
    const thumbSrc = `images/thumbnails/${id}.jpg`;
    const profile = loadProfile();
    const myBudget = parseFloat(profile.budget);
    const hasExams = profile.exams && profile.exams.length > 0;
    let failedReqs = [];
    if (hasExams && u.exams_min) {
        const userScores = {};
        profile.exams.forEach(e => { if(e.exam && e.score) userScores[e.exam.toUpperCase()] = parseFloat(e.score); });
        for (const [exam, minScore] of Object.entries(u.exams_min)) {
            const myScore = userScores[exam];
            if (myScore !== undefined && myScore < minScore) failedReqs.push(`${exam} < ${minScore}`);
        }
    }
    const fa = u.finance.financial_aid || {};
    const hasGrant = fa.merit_based || fa.need_based; 
    let budgetBadge = "";
    if (!isNaN(myBudget) && myBudget > 0) {
        if (cost > myBudget) {
            if (hasGrant) budgetBadge = `<span style="background:#dbeafe; color:#1e40af; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #93c5fd;">🔵 Budget exceeded, Grant available</span>`;
            else budgetBadge = `<span style="background:#f3e8ff; color:#6b21a8; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #d8b4fe;">🟣 Budget exceeded</span>`;
        } else if (hasGrant) budgetBadge = `<span style="background:#d1fae5; color:#065f46; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #6ee7b7;">✅ Grant Available</span>`;
    } else if (hasGrant) budgetBadge = `<span style="background:#d1fae5; color:#065f46; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #6ee7b7;">✅ Grant Available</span>`;
    let badgesHTML = "";
    if (failedReqs.length > 0) {
        const reasonStr = failedReqs.join(", ");
        badgesHTML += `<span style="background:#fee2e2; color:#991b1b; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #fca5a5; margin-bottom:4px;">⛔ Requirements: ${reasonStr}</span> `;
    }
    if (budgetBadge) badgesHTML += budgetBadge;
    if (!badgesHTML) badgesHTML = `<span style="background:#f3f4f6; color:#374151; padding:4px 8px; border-radius:6px; font-size:12px; border:1px solid #e5e7eb;">Acceptance: ${acceptance}%</span>`;

    return `
      <article class="uni-card" data-uni-id="${escapeHtml(id)}">
        <div class="uni-media" style="background-image: url('${thumbSrc}');">
          <div class="uni-price"><small>Total/Year</small><b>${moneyUSD(cost)}</b></div>
          <div class="uni-logo"><img src="${logoSrc}" alt="${initials(name)}" onerror="this.onerror=null; this.parentNode.textContent='${initials(name)}';"></div>
        </div>
        <div class="uni-body">
          <h3 class="uni-title">${escapeHtml(name)}</h3>
          <div class="uni-loc">📍 ${escapeHtml(loc)}</div>
          <div class="uni-badge" style="margin-top:10px; min-height:24px; display:flex; flex-direction:column; align-items:flex-start; gap:4px;">${badgesHTML}</div>
          <div class="uni-footer"><a class="uni-details" href="university.html?id=${encodeURIComponent(id)}">View Details →</a></div>
        </div>
      </article>
    `;
  }

  function renderPagination(total) {
    if (!el.pagination) return;
    const pages = Math.ceil(total / state.limit);
    if (pages <= 1) return;
    let html = "";
    if (state.page > 1) html += `<button data-page="${state.page - 1}">←</button>`;
    html += `<span style="margin:0 10px;">Page ${state.page} of ${pages}</span>`;
    if (state.page < pages) html += `<button data-page="${state.page + 1}">→</button>`;
    el.pagination.innerHTML = html;
    el.pagination.querySelectorAll("button").forEach(b => {
        b.onclick = () => {
            state.page = Number(b.dataset.page);
            fetchAndRender();
            window.scrollTo({top:0, behavior:'smooth'});
        };
    });
  }

  function readFromUrl() {
    const sp = new URL(window.location.href).searchParams;
    state.q = sp.get("q") || "";
    state.country = sp.get("country") || "";
    state.region = sp.get("region") || ""; // Читаем штат из URL
    state.city = sp.get("city") || "";
    state.major = sp.get("major") || "";
    state.study_level = sp.get("study_level") || "";
    state.format = sp.get("format") || "";
    state.min_tuition = sp.get("min_tuition") || "";
    state.max_tuition = sp.get("max_tuition") || "";
    state.sort = sp.get("sort") || "name_asc";
    const p = Number(sp.get("page"));
    if (p > 0) state.page = p;
  }

  function applyToForm() {
    if(el.qInput) el.qInput.value = state.q;
    if(el.countrySelect) el.countrySelect.value = state.country;
    if(el.stateSelect) el.stateSelect.value = state.region; // Восстанавливаем штат
    if(el.citySelect) el.citySelect.value = state.city;
    if(el.majorSelect) el.majorSelect.value = state.major;
    if(el.studyLevelSelect) el.studyLevelSelect.value = state.study_level;
    if(el.formatSelect) el.formatSelect.value = state.format;
    if(el.minTuitionInput) el.minTuitionInput.value = state.min_tuition;
    if(el.maxTuitionInput) el.maxTuitionInput.value = state.max_tuition;
    if(el.sortSelect) el.sortSelect.value = state.sort;
  }

  function updateCityOptions(country, selectedCity = "") {
    if (!el.citySelect) return;

    const cities = CITY_OPTIONS_BY_COUNTRY[country] || [];

    el.citySelect.innerHTML = cities.length
      ? `<option value="">All cities</option>`
      : `<option value="">Select country first</option>`;

    el.citySelect.disabled = !cities.length;

    cities.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      el.citySelect.appendChild(opt);
    });

    if (cities.includes(selectedCity)) el.citySelect.value = selectedCity;
  }

  function updateMajorOptions() {
    if (!el.majorSelect) return;
    el.majorSelect.innerHTML = `<option value="">Any major</option>`;
    MAJOR_OPTIONS.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        el.majorSelect.appendChild(opt);
    });
  }

  function updateCityDropdown(cities) {
    if (!el.citySelect) return;
    
    if (!cities || cities.length === 0) {
        el.citySelect.innerHTML = `<option value="">Select region/country first</option>`;
        el.citySelect.disabled = true;
    } else {
        el.citySelect.disabled = false;
        el.citySelect.innerHTML = `<option value="">All Cities</option>`;
        cities.sort().forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            el.citySelect.appendChild(opt);
        });
    }
  }

  function updateLocationLogic(country) {
    if (!el.stateDiv) return;
    const countryData = CITY_OPTIONS_BY_COUNTRY[country];

    if (!country || !countryData) {
        // Страна не выбрана
        el.stateDiv.style.display = "none";
        updateCityDropdown([]); 
        return;
    }

    // Проверяем: это массив (список городов) или объект (список штатов)?
    if (Array.isArray(countryData)) {
        // 🟢 Простая страна (Kazakhstan, Hong Kong)
        el.stateDiv.style.display = "none"; 
        updateCityDropdown(countryData); // Сразу грузим города
    } else {
        // 🔵 Страна со штатами (USA)
        el.stateDiv.style.display = "block"; // Показываем селект штатов
        
        // Заполняем список штатов
        const states = Object.keys(countryData).sort();
        el.stateSelect.innerHTML = `<option value="">All States / Regions</option>`;
        states.forEach(s => {
            el.stateSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });

        // Города блокируем, пока не выберут штат
        updateCityDropdown([]); 
    }
  }

  function updateCitiesForState(country, region) {
    if (!country || !region) {
        updateCityDropdown([]); 
        return;
    }
    // Безопасный доступ к данным
    const countryData = CITY_OPTIONS_BY_COUNTRY[country];
    if (countryData && !Array.isArray(countryData)) {
        const cities = countryData[region] || [];
        updateCityDropdown(cities);
    }
  }

  function updateCountryOptions() {
    if (!el.countrySelect) return;
    const countries = Object.keys(CITY_OPTIONS_BY_COUNTRY).sort();
    const currentVal = el.countrySelect.value || state.country;

    let html = `<option value="">All Countries</option>`;
    countries.forEach(c => {
        const isSelected = (c === currentVal) ? "selected" : "";
        html += `<option value="${c}" ${isSelected}>${c}</option>`;
    });
    el.countrySelect.innerHTML = html;
  }
}

// =====================================
// PAGE: UNIVERSITY DETAILS (Split Requirements & Recommendations)
// =====================================
async function initUniversityPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const stateEl = document.getElementById("detailState");
  const cardEl = document.getElementById("detailCard");

  if (!id) {
    if (stateEl) stateEl.innerHTML = "<h2 style='color:red; text-align:center;'>Error: No ID provided.</h2>";
    return;
  }

  try {
    if (stateEl) stateEl.textContent = "Loading...";
    
    const res = await fetch(`${API_BASE}/universities/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Backend error");
    const u = await res.json();

    const setTxt = (eid, val) => { 
        const e = document.getElementById(eid); 
        if (e) e.textContent = val || "—"; 
    };

    // 1. Basic Info
    setTxt("detailName", u.name);
    setTxt("detailLocation", u.location ? `${u.location.city}, ${u.location.country}` : "—");
    if (u.finance) setTxt("detailPrice", `${moneyUSD(u.finance.total_cost_year_usd)} / year`);
    setTxt("detailLogo", (u.name || "U").substring(0, 2).toUpperCase());

    // --- НАСТРОЙКА ФОНА (COVER) ---
    const coverEl = document.getElementById("detailCover");
    if (coverEl) {
        // Ставим картинку фона
        coverEl.style.backgroundImage = `url('images/thumbnails/${u.id}.jpg')`;
    }

    // --- НАСТРОЙКА ЛОГОТИПА ---
    const logoEl = document.getElementById("detailLogo");
    if (logoEl) {
        // Вставляем картинку вместо текста
        // Если картинки нет, сработает onerror и покажет инициалы (например NU)
        const initialsText = (u.name || "U").substring(0, 2).toUpperCase();
        logoEl.innerHTML = `<img src="images/logos/${u.id}.png" alt="Logo" onerror="this.style.display='none'; this.parentNode.textContent='${initialsText}'" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const siteBtn = document.getElementById("detailWebsite");
    if (siteBtn) {
        if (u.website) {
            siteBtn.href = u.website; // Ставим ссылку из JSON
            siteBtn.style.display = "inline-flex"; // Показываем кнопку
        } else {
            siteBtn.style.display = "none"; // Если ссылки нет, скрываем
        }
    }

    // 2. БЛОК RECOMMENDATIONS (Average Stats & Acceptance)
    const recDiv = document.getElementById("detailRecommendations");
    if (recDiv) {
        // Собираем данные для рекомендаций
        const avgHTML = `
            <div class="d-kv"><span>Acceptance Rate</span><span>${u.academics.acceptance_rate_percent}%</span></div>
            <div class="d-kv"><span>Avg GPA</span><span>${u.exams_avg?.GPA || "—"}</span></div>
            <div class="d-kv"><span>Avg IELTS</span><span>${u.exams_avg?.IELTS || "—"}</span></div>
            <div class="d-kv"><span>Avg SAT</span><span>${u.exams_avg?.SAT || "—"}</span></div>
        `;
        recDiv.innerHTML = avgHTML;
    }

    // 3. БЛОК REQUIREMENTS (Strict Minimums)
    const reqDiv = document.getElementById("detailRequirements");
    if (reqDiv) {
        let reqList = "";
        let count = 0;

        // Проверяем каждое требование. Если > 0, добавляем в список.
        if (u.exams_min?.GPA) {
            reqList += `<div class="d-kv"><span>Min GPA</span><span>${u.exams_min.GPA}</span></div>`;
            count++;
        }
        if (u.exams_min?.IELTS) {
            reqList += `<div class="d-kv"><span>Min IELTS</span><span>${u.exams_min.IELTS}</span></div>`;
            count++;
        }
        if (u.exams_min?.SAT) {
            reqList += `<div class="d-kv"><span>Min SAT</span><span>${u.exams_min.SAT}</span></div>`;
            count++;
        }

        // Логика: если требований нет -> выводим текст
        if (count === 0) {
            reqDiv.innerHTML = `<div style="padding:10px 0; color:#666; font-style:italic;">No strict exam requirements</div>`;
        } else {
            reqDiv.innerHTML = reqList;
        }
    }

    // 4. Programs
    const progDiv = document.getElementById("detailPrograms");
    if (progDiv && u.academics?.majors) {
        progDiv.innerHTML = u.academics.majors.map(m => 
            `<span style="display:inline-block; background:#f1f1f1; padding:5px 10px; margin:2px; border-radius:8px; font-size:0.9rem;">${m}</span>`
        ).join(" ");
    }

    // 5. Finances (Tab Content)
    const finDiv = document.getElementById("detailFinance"); // Это список цен справа
    const scholDiv = document.getElementById("detailScholarshipInfo"); // Это блок слева (зеленый)

    if (u.finance) {
        // --- ЛОГИКА ДЛЯ ЛЕВОГО БЛОКА (ГРАНТЫ) ---
        if (scholDiv) {
            const fa = u.finance.financial_aid || {}; // Защита, если объекта нет
            
            // Формируем строки в зависимости от true/false
            const meritHtml = fa.merit_based 
                ? `<p style="margin-bottom:5px;">✅ Merit-based scholarships available</p>` 
                : `<p style="margin-bottom:5px; opacity:0.5;">❌ No merit-based scholarships</p>`;
            
            const needHtml = fa.need_based 
                ? `<p>✅ Need-based financial aid</p>` 
                : `<p style="opacity:0.5;">❌ No need-based aid</p>`;

            scholDiv.innerHTML = meritHtml + needHtml;
        }

        // --- ЛОГИКА ДЛЯ ПРАВОГО БЛОКА (ЦЕНЫ) ---
        // Обновляем большую цену
        const priceBig = document.getElementById("detailPrice");
        if (priceBig) priceBig.textContent = moneyUSD(u.finance.total_cost_year_usd);

        // Список деталей
        if (finDiv) {
            finDiv.innerHTML = `
                <div class="d-kv"><span>Tuition Fee</span><span>${moneyUSD(u.finance.total_cost_year_usd)}</span></div>
                <div class="d-kv"><span>Application Fee</span><span>$${u.finance.application_fee_usd}</span></div>
            `;
        }
    }

    // 6. Extra
    const extraDiv = document.getElementById("detailExtra");
    if (extraDiv) {
         extraDiv.innerHTML = `
            <div class="d-kv"><span>Size</span><span>${u.student_life?.size || "—"}</span></div>
            <div class="d-kv"><span>Format</span><span>${u.academics?.formats?.join(", ") || "On-campus"}</span></div>
         `;
    }

    if (stateEl) stateEl.textContent = "";
    if (cardEl) cardEl.style.display = "block"; 

    setupTabs();

  } catch (err) {
    console.error(err);
    if (stateEl) stateEl.textContent = "Error loading details.";
  }
}

// =====================================
// MODULE: PROFILE MODAL (Сохранено полностью)
// =====================================
function initProfileUI() {
  const modal = $("profileModal");
  if (!modal) return;

  const openBtn = $("profileBtn");
  const closeBtn = $("profileCloseBtn");
  const backdrop = modal.querySelector(".modal-backdrop") || modal; // адаптация под твою верстку

  // Inputs
  const nameInput = $("profileNameInput");
  const budgetInput = $("budgetInput");
  const nameDisplay = $("profileNameDisplay");
  
  // Exam inputs
  const examNameInput = $("examNameInput");
  const examScoreInput = $("examScoreInput");
  const addExamBtn = $("addExamBtn");
  const examList = $("examList");
  const examError = $("examError");

  // Load Data
  let profile = loadProfile();
  renderProfileData();

  // Handlers
  if (openBtn) openBtn.onclick = () => { modal.classList.add("is-open"); modal.style.display="flex"; };
  
  const close = () => { modal.classList.remove("is-open"); modal.style.display="none"; };
  if (closeBtn) closeBtn.onclick = close;
  
  // Close on Escape
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // Auto-save fields
  if (nameInput) {
      nameInput.oninput = (e) => {
          profile.name = e.target.value;
          saveProfile(profile);
          if(nameDisplay) nameDisplay.textContent = profile.name;
      };
  }

  if (budgetInput) {
      budgetInput.oninput = (e) => {
          profile.budget = e.target.value; // сохраняем как строку пока вводится
          saveProfile(profile);
      };
  }

  // Exam Logic
  if (addExamBtn) {
      addExamBtn.onclick = async () => {
          if(examError) examError.textContent = "";
          const name = examNameInput.value.trim();
          const score = parseFloat(examScoreInput.value);

          if (!name || isNaN(score)) {
              if(examError) examError.textContent = "Invalid input";
              return;
          }

          // Validate via Backend
          try {
             const res = await fetch(`${API_BASE}/exams/validate`, {
                 method: "POST",
                 headers: {"Content-Type": "application/json"},
                 body: JSON.stringify({ exam: name, score: score })
             });
             const json = await res.json();
             
             if(!res.ok) throw new Error(json.detail || "Error");
             
             // Add to list
             profile.exams.push({ exam: json.exam, score: json.score });
             saveProfile(profile);
             renderProfileData();
             
             // Clear inputs
             examNameInput.value = "";
             examScoreInput.value = "";

          } catch(e) {
              if(examError) examError.textContent = e.message;
          }
      };
  }

  // Delete Exam Logic (delegation)
  if (examList) {
      examList.onclick = (e) => {
          if (e.target.tagName === "BUTTON") {
              const idx = e.target.dataset.idx;
              profile.exams.splice(idx, 1);
              saveProfile(profile);
              renderProfileData();
          }
      };
  }

  function renderProfileData() {
      if(nameInput) nameInput.value = profile.name;
      if(nameDisplay) nameDisplay.textContent = profile.name;
      if(budgetInput) budgetInput.value = profile.budget;
      
      if(examList) {
          examList.innerHTML = profile.exams.map((ex, i) => `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; background:#f9f9f9; padding:5px;">
                <span><b>${ex.exam}</b>: ${ex.score}</span>
                <button data-idx="${i}" style="color:red; border:none; background:none; cursor:pointer;">X</button>
            </div>
          `).join("");
      }
  }
}

// =====================================
// TABS LOGIC
// =====================================
function setupTabs() {
  const buttons = document.querySelectorAll(".d-tab-btn");
  const panes = document.querySelectorAll(".d-tab-pane");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      // 1. Убираем класс active у всех кнопок и панелей
      buttons.forEach(b => b.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));

      // 2. Добавляем active нажатой кнопке
      btn.classList.add("active");

      // 3. Находим нужную панель по data-tab и показываем её
      const tabId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(tabId);
      if (targetPane) {
        targetPane.classList.add("active");
      }
    });
  });
}

// Local Storage Helpers
function loadProfile() {
  try {
    const s = localStorage.getItem(PROFILE_STORAGE_KEY);
    return s ? JSON.parse(s) : { ...PROFILE_DEFAULTS };
  } catch(e) { return { ...PROFILE_DEFAULTS }; }
}

// В самом низу script.js
function saveProfile(p) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
  // ЭТА СТРОКА СООБЩАЕТ ВСЕМУ САЙТУ ОБ ИЗМЕНЕНИЯХ
  window.dispatchEvent(new Event("profileUpdated"));
}