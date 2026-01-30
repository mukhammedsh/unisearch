/* UniSearch script - Final Combined Version v2.2 */

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

// ---------- Init Routing ----------
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Script loaded! Checking page...");
  initProfileUI();

  const path = window.location.pathname;
  if (path.includes("universities.html") || document.getElementById("universitiesList")) {
      console.log("✅ Detected Universities List Page");
      initUniversitiesPage();
  } 
  else if (path.includes("university.html") || document.getElementById("detailCard")) {
      console.log("✅ Detected Details Page");
      initUniversityPage();
  }
  else if (path.includes("ranking.html") || document.getElementById("rankingList")) {
      initRankingPage();
  }
});

// =====================================
// PAGE: UNIVERSITIES LIST
// =====================================
function initUniversitiesPage() {
  const el = {
    qInput: $("qInput"),
    countrySelect: $("countrySelect"),
    stateDiv: $("stateDiv"),
    stateSelect: $("stateSelect"),
    citySelect: $("citySelect"),
    majorSelect: $("majorSelect"),
    studyLevelSelect: $("studyLevelSelect"),
    formatSelect: $("formatSelect"),
    minTuitionInput: $("minTuitionInput"),
    maxTuitionInput: $("maxTuitionInput"),
    
    sortSelect: $("sortSelect"),
    
    sliderContainer: $("aiSliderContainer"),
    slider: $("uniFitSlider"),
    sliderLabel: $("sliderLabel"),

    resetBtn: $("resetFiltersBtn"),
    list: $("universitiesList"),
    total: $("totalCount"),
    state: $("listState"),
    pagination: $("pagination"),
  };

  if (!el.list) return;

  const state = {
    q: "", country: "", region: "", city: "", major: "", study_level: "", format: "",
    min_tuition: "", max_tuition: "",
    sort: "name_asc", 
    ai_balance: 50,
    page: 1, limit: 12,
  };

  readFromUrl();
  updateMajorOptions();

  const initLocations = () => {
      updateCountryOptions();
      if (state.country) {
          if (el.countrySelect) el.countrySelect.value = state.country;
          updateLocationLogic(state.country);
          if (state.region && el.stateSelect && el.stateSelect.offsetParent !== null) {
              el.stateSelect.value = state.region;
              updateCitiesForState(state.country, state.region);
          }
          if (state.city && el.citySelect) el.citySelect.value = state.city;
      }
  };
  
  if (Object.keys(CITY_OPTIONS_BY_COUNTRY).length > 0) initLocations();
  window.addEventListener("citiesLoaded", initLocations);

  applyToForm();
  updateSliderVisibility(); 

  const refetch = debounce(() => {
    state.page = 1;
    fetchAndRender();
  }, 250);

  // Listeners
  el.qInput?.addEventListener("input", () => { state.q = el.qInput.value.trim(); refetch(); });
  
  el.countrySelect?.addEventListener("change", () => {
    state.country = el.countrySelect.value;
    state.region = ""; state.city = ""; 
    if(el.stateSelect) el.stateSelect.value = "";
    if(el.citySelect) el.citySelect.value = "";
    updateLocationLogic(state.country);
    refetch();
  });

  el.stateSelect?.addEventListener("change", () => {
    state.region = el.stateSelect.value;
    state.city = ""; 
    updateCitiesForState(state.country, state.region);
    refetch();
  });

  el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
  el.majorSelect?.addEventListener("change", () => { state.major = el.majorSelect.value; refetch(); });
  el.studyLevelSelect?.addEventListener("change", () => { state.study_level = el.studyLevelSelect.value; refetch(); });
  el.formatSelect?.addEventListener("change", () => { state.format = el.formatSelect.value; refetch(); });
  el.minTuitionInput?.addEventListener("input", () => { state.min_tuition = el.minTuitionInput.value; refetch(); });
  el.maxTuitionInput?.addEventListener("input", () => { state.max_tuition = el.maxTuitionInput.value; refetch(); });
  
  el.sortSelect?.addEventListener("change", () => { 
      state.sort = el.sortSelect.value; 
      updateSliderVisibility();
      refetch(); 
  });

  el.slider?.addEventListener("input", () => {
      state.ai_balance = parseInt(el.slider.value);
      updateSliderLabel();
      refetch();
  });

  el.resetBtn?.addEventListener("click", () => {
    Object.assign(state, {
      q: "", country: "", region: "", city: "", major: "", study_level: "", format: "",
      min_tuition: "", max_tuition: "", sort: "name_asc", ai_balance: 50, page: 1
    });
    applyToForm();
    if (el.stateDiv) el.stateDiv.style.display = "none";
    updateCityDropdown([]);
    updateSliderVisibility();
    fetchAndRender();
  });

  el.list.addEventListener("click", (e) => {
    const card = e.target.closest("[data-uni-id]");
    if (!card || e.target.tagName === "A") return;
    window.location.href = `university.html?id=${encodeURIComponent(card.getAttribute("data-uni-id"))}`;
  });

  fetchAndRender();
  window.addEventListener("profileUpdated", () => fetchAndRender());

  // --- Helpers ---

  function updateSliderVisibility() {
      if (!el.sliderContainer) return;
      if (state.sort === "uni_ai") {
          el.sliderContainer.style.display = "block";
          updateSliderLabel();
      } else {
          el.sliderContainer.style.display = "none";
      }
  }

  function updateSliderLabel() {
      if (!el.sliderLabel) return;
      const val = state.ai_balance;
      let text = "Balanced Strategy (50/50)";
      if (val <= 20) text = "Strict Budget Priority 💰 (Best value within limit)";
      else if (val >= 80) text = "Top Prestige Priority 🏆 (Ignore cost)";
      else if (val < 50) text = `Focus on Budget (${100-val}%)`;
      else text = `Focus on Prestige (${val}%)`;
      el.sliderLabel.textContent = text;
  }

  function buildParams() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.country) p.set("country", state.country);
    if (state.region) p.set("region", state.region);
    if (state.city) p.set("city", state.city);
    if (state.major) p.set("major", state.major);
    if (state.study_level) p.set("study_level", state.study_level);
    if (state.format) p.set("format", state.format);
    if (state.min_tuition) p.set("min_tuition", state.min_tuition);
    if (state.max_tuition) p.set("max_tuition", state.max_tuition);
    
    const isAiSort = (state.sort === "uni_ai");
    p.set("sort", isAiSort ? "name_asc" : state.sort);

    if (isAiSort) { p.set("limit", "100"); p.set("page", "1"); } 
    else { p.set("page", String(state.page)); p.set("limit", String(state.limit)); }
    return p;
  }

  function applyToForm() {
    if(el.qInput) el.qInput.value = state.q;
    if(el.countrySelect) el.countrySelect.value = state.country;
    if(el.stateSelect) el.stateSelect.value = state.region;
    if(el.citySelect) el.citySelect.value = state.city;
    if(el.majorSelect) el.majorSelect.value = state.major;
    if(el.studyLevelSelect) el.studyLevelSelect.value = state.study_level;
    if(el.formatSelect) el.formatSelect.value = state.format;
    if(el.minTuitionInput) el.minTuitionInput.value = state.min_tuition;
    if(el.maxTuitionInput) el.maxTuitionInput.value = state.max_tuition;
    if(el.sortSelect) el.sortSelect.value = state.sort;
    if(el.slider) el.slider.value = state.ai_balance;
  }

  // --- Location Logic ---
  function updateLocationLogic(country) {
    if (!el.stateDiv) return;
    const countryData = CITY_OPTIONS_BY_COUNTRY[country];
    if (!country || !countryData) { el.stateDiv.style.display = "none"; updateCityDropdown([]); return; }
    if (Array.isArray(countryData)) { el.stateDiv.style.display = "none"; updateCityDropdown(countryData); } 
    else {
        el.stateDiv.style.display = "block"; 
        const states = Object.keys(countryData).sort();
        el.stateSelect.innerHTML = `<option value="">All States / Regions</option>`;
        states.forEach(s => { el.stateSelect.innerHTML += `<option value="${s}">${s}</option>`; });
        updateCityDropdown([]); 
    }
  }

  function updateCitiesForState(country, region) {
    if (!country || !region) { updateCityDropdown([]); return; }
    const countryData = CITY_OPTIONS_BY_COUNTRY[country];
    if (countryData && !Array.isArray(countryData)) {
        const cities = countryData[region] || [];
        updateCityDropdown(cities);
    }
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
            opt.value = c; opt.textContent = c;
            el.citySelect.appendChild(opt);
        });
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

  function updateMajorOptions() {
    if (!el.majorSelect) return;
    el.majorSelect.innerHTML = `<option value="">Any major</option>`;
    MAJOR_OPTIONS.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m; opt.textContent = m;
        el.majorSelect.appendChild(opt);
    });
  }

  function readFromUrl() {
    const sp = new URL(window.location.href).searchParams;
    state.q = sp.get("q") || "";
    state.country = sp.get("country") || "";
    state.region = sp.get("region") || "";
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

  // ==========================================
  // 🧠 UniFit V2.1: Ideal Smart Sort
  // ==========================================

  const SCALES = { "GPA": 100, "IELTS": 9.0, "TOEFL": 120, "SAT": 1600, "ACT": 36 };

  function normalizeScore(examName, score) {
      const max = SCALES[examName.toUpperCase()] || 100;
      return Math.min(Math.max(score / max, 0), 1);
  }

  // 1. Prestige (0..1): 
  // Учитываем и Min (база), и Avg (престиж)
  // 1. Prestige (50% Rank + 50% Difficulty)
  function calculatePrestigeScore(u) {
      // A. Сложность поступления (Exam Difficulty)
      let diffScore = 0;
      let count = 0;
      
      const ar = u?.academics?.acceptance_rate_percent;
      if (ar !== undefined && !isNaN(ar)) {
          diffScore += (100 - ar) / 100; // Чем ниже AR, тем выше балл
          count++;
      }

      // Учитываем средние баллы (Avg)
      const avgs = u?.exams_avg || {};
      for (const [key, val] of Object.entries(avgs)) {
          const norm = normalizeScore(key, val);
          if (norm > 0) { diffScore += norm; count++; }
      }
      
      const difficulty = count === 0 ? 0.5 : (diffScore / count);

      // B. Мировой рейтинг (World Rank)
      const rank = u.rank || 1000; // Если ранга нет, считаем 1000-м
      
      // Формула: 1 место = 1.0, 100 место = 0.8, 1000 место = 0.1
      // Логарифмическое затухание было бы лучше, но линейное проще:
      let rankScore = 0;
      if (rank <= 100) {
          // Для топ-100: от 1.0 до 0.5
          rankScore = 1.0 - (rank * 0.005); 
      } else {
          // Для остальных: от 0.5 до 0.0
          rankScore = Math.max(0, 0.5 - ((rank - 100) * 0.0005));
      }

      // ИТОГ: Смешиваем 50/50
      return (difficulty * 0.5) + (rankScore * 0.5);
  }

  // 2. Eligibility (Multiplier)
  // Провал по минимуму = 0.05
  // Проход по минимуму = 1.0
  // Превосходство среднего (Avg) = 1.2 (Бонус)
  function calculateEligibilityMultiplier(u, userExams) {
      if (!userExams || Object.keys(userExams).length === 0) return 1.0; 

      const mins = u?.exams_min || {};
      const avgs = u?.exams_avg || {}; // 🔥 Берем средние
      let isFail = false;
      let isExcellent = false;

      for (const [exam, minVal] of Object.entries(mins)) {
          const userVal = userExams[exam.toUpperCase()];
          if (userVal !== undefined) {
              // 1. Провал (строго)
              if (userVal < minVal) isFail = true;
              
              // 2. 🔥 Бонус (если ты круче среднего студента)
              const avgVal = avgs[exam] || avgs[exam.toLowerCase()];
              if (avgVal && userVal >= avgVal) {
                  isExcellent = true;
              }
          }
      }

      if (isFail) return 0.05; // Штраф
      if (isExcellent) return 1.2; // 🔥 Бонус
      return 1.0; 
  }

  // 3. Budget Score (0..1)
  // LOGIC V2.1:
  // - Внутри бюджета: Чем дороже, тем лучше (ты получаешь больше ресурсов).
  // - Снаружи бюджета: Штраф за переплату.
  function calculateBudgetScore(u, userBudget, balance) {
      const cost = u?.finance?.total_cost_year_usd || 0;
      const fa = u?.finance?.financial_aid || {};
      const hasAid = fa.merit_based || fa.need_based;

      if (!userBudget || userBudget <= 0) return 1.0;

      // 🔥 СЦЕНАРИЙ А: Вписываемся в бюджет
      if (cost <= userBudget) {
          // Твоя идея: чем ближе к бюджету, тем выше балл (эффективность)
          const utilization = cost / userBudget; 
          return 0.6 + (0.4 * utilization); 
      }

      // СЦЕНАРИЙ Б: Дороже бюджета (Штраф)
      const overflow = (cost - userBudget) / userBudget; 
      let penalty = overflow; 

      if (hasAid) penalty *= 0.5; // Грант спасает

      const strictness = 1.0 - balance; 
      let score = 1.0 - (penalty * strictness * 3.0); 
      
      return Math.max(0, score);
  }

  function getUniSort(universities, balance0to100) {
      const profile = loadProfile();
      const userBudget = parseFloat(profile.budget);
      const userExams = {};
      
      if (profile.exams && Array.isArray(profile.exams)) {
          profile.exams.forEach(e => {
              if (e.exam && e.score) userExams[e.exam.toUpperCase()] = parseFloat(e.score);
          });
      }

      const balance = balance0to100 / 100; 

      const scored = universities.map(u => {
          const prestige = calculatePrestigeScore(u);
          const budgetScore = calculateBudgetScore(u, userBudget, balance);
          const eligibility = calculateEligibilityMultiplier(u, userExams);

          // Взвешенная сумма (Prestige vs Budget)
          const weightedScore = (prestige * balance) + (budgetScore * (1 - balance));
          
          // Eligibility - это множитель (фильтр)
          const finalScore = weightedScore * eligibility;

          return { uni: u, score: finalScore };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.map(x => x.uni);
  }

  async function fetchAndRender() {
    console.log("PROFILE:", loadProfile());
    if (el.state) el.state.textContent = "Loading...";
    el.list.innerHTML = "";
    if (el.pagination) el.pagination.innerHTML = "";

    const params = buildParams();
    setUrlParams(params);

    try {
      const res = await fetch(`${API_BASE}/universities?${params.toString()}`);
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();

      let items = data.items || [];
      const total = data.total || 0;

      const isAiSort = (state.sort === "uni_ai");
      
      if (isAiSort) {
          items = getUniSort(items, state.ai_balance); 
      }

      if (el.total) el.total.textContent = String(isAiSort ? items.length : total);
      
      if (!items.length) {
        if (el.state) el.state.textContent = "No universities found.";
        return;
      }
      if (el.state) el.state.textContent = "";
      const profile = loadProfile();
      const userBudget = parseFloat(profile.budget);
      el.list.innerHTML = items.map(u => renderCard(u, userBudget)).join("");
      
      if (!isAiSort) renderPagination(total);
      else if (el.pagination) el.pagination.innerHTML = "";
      
    } catch (err) {
      console.error(err);
      if (el.state) el.state.textContent = "Failed to load data. Is backend running?";
    }
  }

  function renderCard(u, myBudget) { 
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
    
    const fa = u.finance?.financial_aid || {};
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
}

// =====================================
// PAGE: UNIVERSITY DETAILS
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

    setTxt("detailName", u.name);
    setTxt("detailLocation", u.location ? `${u.location.city}, ${u.location.country}` : "—");
    if (u.finance) setTxt("detailPrice", `${moneyUSD(u.finance.total_cost_year_usd)} / year`);
    setTxt("detailLogo", (u.name || "U").substring(0, 2).toUpperCase());

    const coverEl = document.getElementById("detailCover");
    if (coverEl) coverEl.style.backgroundImage = `url('images/thumbnails/${u.id}.jpg')`;

    const logoEl = document.getElementById("detailLogo");
    if (logoEl) {
        const initialsText = (u.name || "U").substring(0, 2).toUpperCase();
        logoEl.innerHTML = `<img src="images/logos/${u.id}.png" alt="Logo" onerror="this.style.display='none'; this.parentNode.textContent='${initialsText}'" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const siteBtn = document.getElementById("detailWebsite");
    if (siteBtn) {
        if (u.website) {
            siteBtn.href = u.website; 
            siteBtn.style.display = "inline-flex"; 
        } else {
            siteBtn.style.display = "none";
        }
    }

    // 2. БЛОК RECOMMENDATIONS (Average Stats & Acceptance & Rank)
    const recDiv = document.getElementById("detailRecommendations");
    if (recDiv) {
        // 🔥 Формируем красивый ранг
        let rankHtml = "<span>—</span>";
        if (u.rank) {
            let trophy = "";
            if (u.rank === 1) trophy = "🥇 ";
            else if (u.rank === 2) trophy = "🥈 ";
            else if (u.rank === 3) trophy = "🥉 ";
            rankHtml = `<span style="color:#5d17ea; font-size:1.1em;">${trophy}#${u.rank}</span>`;
        }

        const avgHTML = `
            <div class="d-kv"><span>Global Rank</span>${rankHtml}</div>
            <div class="d-kv"><span>Acceptance Rate</span><span>${u.academics.acceptance_rate_percent}%</span></div>
            <div class="d-kv"><span>Avg GPA</span><span>${u.exams_avg?.GPA || "—"}</span></div>
            <div class="d-kv"><span>Avg IELTS</span><span>${u.exams_avg?.IELTS || "—"}</span></div>
            <div class="d-kv"><span>Avg SAT</span><span>${u.exams_avg?.SAT || "—"}</span></div>
        `;
        recDiv.innerHTML = avgHTML;
    }

    const reqDiv = document.getElementById("detailRequirements");
    if (reqDiv) {
        let reqList = "";
        let count = 0;
        if (u.exams_min?.GPA) { reqList += `<div class="d-kv"><span>Min GPA</span><span>${u.exams_min.GPA}</span></div>`; count++; }
        if (u.exams_min?.IELTS) { reqList += `<div class="d-kv"><span>Min IELTS</span><span>${u.exams_min.IELTS}</span></div>`; count++; }
        if (u.exams_min?.SAT) { reqList += `<div class="d-kv"><span>Min SAT</span><span>${u.exams_min.SAT}</span></div>`; count++; }

        if (count === 0) {
            reqDiv.innerHTML = `<div style="padding:10px 0; color:#666; font-style:italic;">No strict exam requirements</div>`;
        } else {
            reqDiv.innerHTML = reqList;
        }
    }

    const progDiv = document.getElementById("detailPrograms");
    if (progDiv && u.academics?.majors) {
        progDiv.innerHTML = u.academics.majors.map(m => 
            `<span style="display:inline-block; background:#f1f1f1; padding:5px 10px; margin:2px; border-radius:8px; font-size:0.9rem;">${m}</span>`
        ).join(" ");
    }

    const finDiv = document.getElementById("detailFinance");
    const scholDiv = document.getElementById("detailScholarshipInfo");

    if (u.finance) {
        if (scholDiv) {
            const fa = u.finance.financial_aid || {};
            const meritHtml = fa.merit_based 
                ? `<p style="margin-bottom:5px;">✅ Merit-based scholarships available</p>` 
                : `<p style="margin-bottom:5px; opacity:0.5;">❌ No merit-based scholarships</p>`;
            const needHtml = fa.need_based 
                ? `<p>✅ Need-based financial aid</p>` 
                : `<p style="opacity:0.5;">❌ No need-based aid</p>`;
            scholDiv.innerHTML = meritHtml + needHtml;
        }

        const priceBig = document.getElementById("detailPrice");
        if (priceBig) priceBig.textContent = moneyUSD(u.finance.total_cost_year_usd);

        if (finDiv) {
            finDiv.innerHTML = `
                <div class="d-kv"><span>Tuition Fee</span><span>${moneyUSD(u.finance.total_cost_year_usd)}</span></div>
                <div class="d-kv"><span>Application Fee</span><span>$${u.finance.application_fee_usd}</span></div>
            `;
        }
    }

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
// MODULE: PROFILE MODAL (FIXED)
// =====================================
function initProfileUI() {
  const modal = $("profileModal");
  if (!modal) return;

  const openBtn = $("profileBtn");
  const closeBtn = $("profileCloseBtn");
  const backdrop = modal.querySelector(".modal-backdrop") || modal;

  const nameInput = $("profileNameInput");
  const budgetInput = $("budgetInput");
  const nameDisplay = $("profileNameDisplay");
  
  const examNameInput = $("examNameInput");
  const examScoreInput = $("examScoreInput");
  const addExamBtn = $("addExamBtn");
  const examList = $("examList");
  const examError = $("examError");

  // 🔥 Ссылки на кнопку редактирования
  const editNameBtn = $("editNameBtn");
  const profileUsernameDiv = document.querySelector(".profile-username");

  let profile = loadProfile();
  renderProfileData();

  if (openBtn) openBtn.onclick = () => { modal.classList.add("is-open"); modal.style.display="flex"; };
  
  const close = () => { modal.classList.remove("is-open"); modal.style.display="none"; };
  if (closeBtn) closeBtn.onclick = close;
  
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // 🔥 ВОССТАНОВЛЕННАЯ ЛОГИКА РЕДАКТИРОВАНИЯ
  if (editNameBtn && profileUsernameDiv) {
      editNameBtn.onclick = () => {
          profileUsernameDiv.classList.toggle("is-editing");
          if (profileUsernameDiv.classList.contains("is-editing") && nameInput) {
              nameInput.focus();
          }
      };
  }

  if (nameInput) {
      nameInput.oninput = (e) => {
          profile.name = e.target.value;
          saveProfile(profile);
          if(nameDisplay) nameDisplay.textContent = profile.name;
      };
  }

  if (budgetInput) {
      budgetInput.oninput = (e) => {
          profile.budget = e.target.value;
          saveProfile(profile);
      };
  }

  if (addExamBtn) {
      addExamBtn.onclick = async () => {
          if(examError) examError.textContent = "";
          const name = examNameInput.value.trim();
          const score = parseFloat(examScoreInput.value);

          if (!name || isNaN(score)) {
              if(examError) examError.textContent = "Invalid input";
              return;
          }

          try {
             const res = await fetch(`${API_BASE}/exams/validate`, {
                 method: "POST",
                 headers: {"Content-Type": "application/json"},
                 body: JSON.stringify({ exam: name, score: score })
             });
             const json = await res.json();
             
             if(!res.ok) throw new Error(json.detail || "Error");
             
             profile.exams.push({ exam: json.exam, score: json.score });
             saveProfile(profile);
             renderProfileData();
             
             examNameInput.value = "";
             examScoreInput.value = "";

          } catch(e) {
              if(examError) examError.textContent = e.message;
          }
      };
  }

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
// PAGE: RANKING
// =====================================
async function initRankingPage() {
    const listEl = document.getElementById("rankingList");
    if (!listEl) return;

    try {
        // Запрашиваем все университеты
        const res = await fetch(`${API_BASE}/universities?limit=1000`);
        const data = await res.json();
        let items = data.items || [];

        // Сортируем: у кого rank меньше, тот выше. Если rank нет, кидаем в конец (9999)
        items.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));

        const html = items.map((u, index) => {
            // Если ранг есть в базе - берем его, иначе просто порядковый номер
            const rank = u.rank || (index + 1);
            
            // Золото, серебро, бронза для топ-3
            const rankClass = rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : "";
            
            return `
            <a href="university.html?id=${u.id}" class="rank-card">
                <div class="rank-num ${rankClass}">#${rank}</div>
                <div class="rank-logo">
                    <img src="images/logos/${u.id}.png" alt="${initials(u.name)}" onerror="this.parentNode.textContent='${initials(u.name)}'">
                </div>
                <div class="rank-info">
                    <div class="rank-title">${escapeHtml(u.name)}</div>
                    <div class="rank-loc">📍 ${u.location?.city}, ${u.location?.country}</div>
                </div>
                <div class="rank-badge">Acceptance: ${u.academics.acceptance_rate_percent}%</div>
            </a>
            `;
        }).join("");

        listEl.innerHTML = html;
    } catch (e) {
        console.error(e);
        listEl.innerHTML = "<p style='text-align:center'>Failed to load rankings.</p>";
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
      buttons.forEach(b => b.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

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