/* UniSearch script - Full Version */

const API_BASE = "http://127.0.0.1:8000";
const PROFILE_STORAGE_KEY = "unisearch_profile";
const PROFILE_DEFAULTS = { name: "User", budget: "", exams: [] };

// Обновленные списки под новую БД
const CITY_OPTIONS_BY_COUNTRY = {
  "USA": ["Cambridge"],
  "Kazakhstan": ["Astana", "Kaskelen"],
  "UK": ["Cambridge"],
  "South Korea": ["Daejeon"],
  "Japan": ["Kyoto"],
  "Hong Kong": ["Sha Tin"]
};

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
// ---------- Init Routing (ИСПРАВЛЕННАЯ ВЕРСИЯ) ----------
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
    citySelect: $("citySelect"),
    majorSelect: $("majorSelect"),
    studyLevelSelect: $("studyLevelSelect"),
    formatSelect: $("formatSelect"),

    // Эти инпуты оставляем, но они будут работать параллельно с умным поиском
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
  updateMajorOptions(); // Populate majors
  updateCityOptions(state.country, state.city); // Populate cities
  applyToForm();

  const refetch = debounce(() => {
    state.page = 1;
    fetchAndRender();
  }, 250);

  // 2. Event Listeners
  el.qInput?.addEventListener("input", () => { state.q = el.qInput.value.trim(); refetch(); });
  
  el.countrySelect?.addEventListener("change", () => {
    state.country = el.countrySelect.value;
    updateCityOptions(state.country);
    state.city = ""; // Reset city on country change
    if(el.citySelect) el.citySelect.value = "";
    refetch();
  });

  el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
  el.majorSelect?.addEventListener("change", () => { state.major = el.majorSelect.value; refetch(); });
  
  // Доп фильтры, если они есть в HTML
  el.studyLevelSelect?.addEventListener("change", () => { state.study_level = el.studyLevelSelect.value; refetch(); });
  el.formatSelect?.addEventListener("change", () => { state.format = el.formatSelect.value; refetch(); });
  el.minTuitionInput?.addEventListener("input", () => { state.min_tuition = el.minTuitionInput.value; refetch(); });
  el.maxTuitionInput?.addEventListener("input", () => { state.max_tuition = el.maxTuitionInput.value; refetch(); });
  el.sortSelect?.addEventListener("change", () => { state.sort = el.sortSelect.value; refetch(); });

  el.resetBtn?.addEventListener("click", () => {
    Object.assign(state, {
      q: "", country: "", city: "", major: "", study_level: "", format: "",
      min_tuition: "", max_tuition: "", sort: "name_asc", page: 1
    });
    applyToForm();
    fetchAndRender();
  });

  // Card click handler
  el.list.addEventListener("click", (e) => {
    const card = e.target.closest("[data-uni-id]");
    if (!card) return;
    // Don't trigger if clicked on a link inside card
    if (e.target.tagName === "A") return;
    const id = card.getAttribute("data-uni-id");
    if (id) window.location.href = `university.html?id=${encodeURIComponent(id)}`;
  });

  // Initial Fetch
  fetchAndRender();

  // --- Functions ---

  function buildParams() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.country) p.set("country", state.country);
    if (state.city) p.set("city", state.city);
    if (state.major) p.set("major", state.major);
    if (state.study_level) p.set("study_level", state.study_level);
    if (state.format) p.set("format", state.format);
    if (state.min_tuition) p.set("min_tuition", state.min_tuition);
    if (state.max_tuition) p.set("max_tuition", state.max_tuition);
    p.set("sort", state.sort);
    p.set("page", String(state.page));
    p.set("limit", String(state.limit));

    // !!! ИНТЕГРАЦИЯ AI !!!
    // Берем данные из профиля для "умного" поиска
    const profile = loadProfile();
    const userBudget = parseFloat(profile.budget);
    if (!isNaN(userBudget) && userBudget > 0) {
        p.set("user_budget", userBudget);
    }
    // Берем экзамены для проверки min требований
    const userGPA = profile.exams.find(e => e.exam === "GPA")?.score;
    if (userGPA) p.set("min_gpa", userGPA);
    
    const userIELTS = profile.exams.find(e => e.exam === "IELTS")?.score;
    if (userIELTS) p.set("min_ielts", userIELTS);

    return p;
  }

  // ==========================================
  // 🧠 AI SMART SORTING ALGORITHM
  // ==========================================
  function getSmartSortedUniversities(universities) {
    // 1. Загружаем профиль пользователя
    const profile = loadProfile(); // Твоя существующая функция
    
    // Если профиль пустой (нет бюджета и экзаменов), возвращаем список как есть
    const hasBudget = profile.budget && !isNaN(parseFloat(profile.budget));
    const hasExams = profile.exams && profile.exams.length > 0;
    
    if (!hasBudget && !hasExams) return universities;

    const userBudget = hasBudget ? parseFloat(profile.budget) : 0;

    // Превращаем массив экзаменов юзера в удобный объект: {"IELTS": 7.5, "SAT": 1400}
    const userScores = {};
    if (hasExams) {
        profile.exams.forEach(item => {
            if (item.exam && item.score) {
                userScores[item.exam.toUpperCase()] = parseFloat(item.score);
            }
        });
    }

    // 2. Оцениваем каждый университет
    const scored = universities.map(u => {
        let score = 0;
        let isEligible = true; // Подходит ли вообще?

        // --- А. ПРОВЕРКА ЭКЗАМЕНОВ ---
        // Проходимся по всем экзаменам, которые сдал юзер
        for (const [examName, userScore] of Object.entries(userScores)) {
            // Ищем требования вуза. Если их нет в базе, считаем 0.
            const min = u.exams_min ? (u.exams_min[examName] || 0) : 0;
            const avg = u.exams_avg ? (u.exams_avg[examName] || 0) : 0;

            // ❌ HARD FILTER: Если у вуза есть минимум, а у нас меньше — исключаем
            if (min > 0 && userScore < min) {
                isEligible = false;
            }

            // ⭐ SCORING: Начисляем баллы
            if (isEligible) {
                if (avg > 0) {
                    // Если выше среднего — даем много очков. Чем выше, тем лучше.
                    const diff = (userScore - avg) / avg;
                    score += diff * 20; 
                } else if (min > 0) {
                    // Если есть только минимум и мы прошли — даем немного очков
                    const diff = (userScore - min) / min;
                    score += diff * 10;
                }
            }
        }

        // --- Б. ПРОВЕРКА БЮДЖЕТА ---
        if (userBudget > 0) {
            const cost = u.finance.total_cost_year_usd;
            const fa = u.finance.financial_aid || {};
            // Считаем, что грант есть, если Merit или Need based = true
            const hasGrant = fa.merit_based || fa.need_based;

            if (cost <= userBudget) {
                score += 20; // ✅ Вписываемся в бюджет — отлично!
            } else {
                // ⚠️ Бюджет превышен
                if (hasGrant) {
                    score -= 5;  // Штраф маленький, так как есть шанс гранта
                } else {
                    score -= 50; // Штраф огромный, так как денег нет и гранта нет
                }
            }
        }

        return { uni: u, score: score, isEligible: isEligible };
    });

    // 3. Фильтрация и Сортировка
    // Оставляем только те, где прошли Hard Filter (isEligible)
    const filtered = scored.filter(item => item.isEligible);
    
    // Сортируем: у кого больше score, тот выше
    filtered.sort((a, b) => b.score - a.score);

    console.log("📊 AI Ranking applied. Top result:", filtered[0]?.uni.name);
    
    // Возвращаем чистый список университетов
    return filtered.map(item => item.uni);
  }

  async function fetchAndRender() {
    el.state && (el.state.textContent = "Loading...");
    el.list.innerHTML = "";
    el.pagination && (el.pagination.innerHTML = "");

    const params = buildParams();
    setUrlParams(params);

    try {
      const res = await fetch(`${API_BASE}/universities?${params.toString()}`);
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();

      let items = data.items || [];    // ✅ let разрешает изменение
      const total = data.total || 0;

      if (state.sort === "ai_rec") {
          items = getSmartSortedUniversities(items); 
      }

      if (el.total) el.total.textContent = String(total);
      
      if (!items.length) {
        el.state && (el.state.textContent = "No universities found.");
        return;
      }

      if (el.total) el.total.textContent = String(total);
      
      if (!items.length) {
        el.state && (el.state.textContent = "No universities found.");
        return;
      }

      el.state && (el.state.textContent = "");
      
      // Получаем бюджет еще раз для рендеринга бейджиков
      const profile = loadProfile();
      const userBudget = parseFloat(profile.budget);
      
      el.list.innerHTML = items.map(u => renderCard(u, userBudget)).join("");
      
      renderPagination(total);

    } catch (err) {
      console.error(err);
      el.state && (el.state.textContent = "Failed to load data. Is python main.py running?");
    }
  }

  function renderCard(u, _unusedBudget) { // userBudget берем свежий из профиля внутри
    const id = u.id;
    const name = u.name;
    const country = nested(u, ["location", "country"], "");
    const city = nested(u, ["location", "city"], "");
    const loc = [city, country].filter(Boolean).join(", ");
    const cost = nested(u, ["finance", "total_cost_year_usd"], 0);
    const acceptance = nested(u, ["academics", "acceptance_rate_percent"], "?");
    
    // Картинки
    const logoSrc = `images/logos/${id}.png`;
    const thumbSrc = `images/thumbnails/${id}.jpg`;

    // --- 1. ПРОВЕРЯЕМ ГРАНТЫ ---
    const fa = u.finance.financial_aid || {};
    const hasGrant = fa.merit_based || fa.need_based; 

    // --- 2. БЕРЕМ БЮДЖЕТ ЮЗЕРА ---
    const profile = loadProfile();
    const myBudget = parseFloat(profile.budget);
    
    let badgeHTML = "";

    // --- 3. ЛОГИКА ЦВЕТОВ ---
    
    // СЦЕНАРИЙ А: Бюджет указан и ЦЕНА ВЫШЕ бюджета
    if (!isNaN(myBudget) && myBudget > 0 && cost > myBudget) {
        if (hasGrant) {
            // 🔵 Синий: Денег не хватает, но грант спасет
            badgeHTML = `<span style="background:#dbeafe; color:#1e40af; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #93c5fd;">🔵 Budget exceeded, Grant available</span>`;
        } else {
            // 🟣 Фиолетовый: Денег не хватает и грантов нет
            badgeHTML = `<span style="background:#f3e8ff; color:#6b21a8; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #d8b4fe;">🟣 Budget exceeded</span>`;
        }
    } 
    // СЦЕНАРИЙ Б: Все хорошо (бюджет ок) и есть грант
    else if (hasGrant) {
        badgeHTML = `<span style="background:#d1fae5; color:#065f46; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #6ee7b7;">✅ Grant Available</span>`;
    } 
    // СЦЕНАРИЙ В: Обычный
    else {
        badgeHTML = `<span style="background:#f3f4f6; color:#374151; padding:4px 8px; border-radius:6px; font-size:12px; border:1px solid #e5e7eb;">Acceptance: ${acceptance}%</span>`;
    }

    return `
      <article class="uni-card" data-uni-id="${escapeHtml(id)}">
        <div class="uni-media" style="background-image: url('${thumbSrc}');">
          <div class="uni-price">
            <small>Total/Year</small>
            <b>${moneyUSD(cost)}</b>
          </div>
          <div class="uni-logo">
             <img src="${logoSrc}" alt="${initials(name)}" onerror="this.onerror=null; this.parentNode.textContent='${initials(name)}';">
          </div>
        </div>

        <div class="uni-body">
          <h3 class="uni-title">${escapeHtml(name)}</h3>
          <div class="uni-loc">
             📍 ${escapeHtml(loc)}
          </div>
          
          <div class="uni-badge" style="margin-top:10px; min-height:24px;">
            ${badgeHTML}
          </div>

          <div class="uni-footer">
            <a class="uni-details" href="university.html?id=${encodeURIComponent(id)}">
              View Details →
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function renderPagination(total) {
    if (!el.pagination) return;
    const pages = Math.ceil(total / state.limit);
    if (pages <= 1) return;

    let html = "";
    // Simple prev/next logic
    if (state.page > 1) html += `<button data-page="${state.page - 1}">←</button>`;
    
    // Show current page
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
    state.city = sp.get("city") || "";
    state.major = sp.get("major") || "";
    state.min_tuition = sp.get("min_tuition") || "";
    state.max_tuition = sp.get("max_tuition") || "";
    state.sort = sp.get("sort") || "name_asc";
    const p = Number(sp.get("page"));
    if (p > 0) state.page = p;
  }

  function applyToForm() {
    if(el.qInput) el.qInput.value = state.q;
    if(el.countrySelect) el.countrySelect.value = state.country;
    if(el.citySelect) el.citySelect.value = state.city;
    if(el.majorSelect) el.majorSelect.value = state.major;
    if(el.sortSelect) el.sortSelect.value = state.sort;
  }

  function updateCityOptions(country, selectedCity = "") {
    if (!el.citySelect) return;
    el.citySelect.innerHTML = `<option value="">All cities</option>`;
    const cities = CITY_OPTIONS_BY_COUNTRY[country] || [];
    cities.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        el.citySelect.appendChild(opt);
    });
    if(cities.includes(selectedCity)) el.citySelect.value = selectedCity;
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

function saveProfile(p) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
}