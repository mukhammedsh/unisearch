/* UniSearch script
   Backend:
   - GET  http://127.0.0.1:8000/universities?...filters
   - GET  http://127.0.0.1:8000/universities/{id}
*/

const API_BASE = "http://127.0.0.1:8000";
const PROFILE_STORAGE_KEY = "unisearch_profile";
const PROFILE_DEFAULTS = { name: "User", budget: "", exams: [] };

const CITY_OPTIONS_BY_COUNTRY = {
  USA: ["New York", "Los Angeles", "Boston", "Chicago", "San Francisco"],
  Kazakhstan: ["Almaty", "Astana", "Shymkent", "Karaganda", "Aktobe"],
  UK: ["London", "Manchester", "Edinburgh", "Bristol", "Birmingham"],
  Finland: ["Helsinki", "Espoo", "Tampere", "Turku", "Oulu"],
  UAE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah"],
};

const MAJOR_OPTIONS = [
  "Computer Science",
  "Business Administration",
  "Engineering",
  "Medicine",
  "Economics",
  "Psychology",
  "Law",
  "Architecture",
  "Data Science",
  "International Relations",
];

// ---------- helpers ----------
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

// ---------- init routing ----------
document.addEventListener("DOMContentLoaded", () => {
  initProfileUI();
  const page = document.body?.dataset?.page;

  if (page === "universities" || $("universitiesList")) initUniversitiesPage();
  if (page === "university" || $("detailCard")) initUniversityPage();
});

// =====================================
// Universities page
// =====================================
function initUniversitiesPage() {
  const el = {
    qInput: $("qInput"),
    countrySelect: $("countrySelect"),
    citySelect: $("citySelect"),
    majorSelect: $("majorSelect"),
    studyLevelSelect: $("studyLevelSelect"),
    formatSelect: $("formatSelect"),

    minTuitionInput: $("minTuitionInput"),
    maxTuitionInput: $("maxTuitionInput"),
    minAcceptanceInput: $("minAcceptanceInput"),
    maxAcceptanceInput: $("maxAcceptanceInput"),
    minIeltsInput: $("minIeltsInput"),
    maxIeltsInput: $("maxIeltsInput"),

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
    min_acceptance: "",
    max_acceptance: "",

    sort: "name_asc",
    page: 1,
    limit: 12, // сетка, удобнее 12
  };

  // read from URL once (если откроете ссылку с параметрами)
  readFromUrl();
  applyToForm();

  const refetch = debounce(() => {
    state.page = 1;
    fetchAndRender();
  }, 250);

  // listeners
  el.qInput?.addEventListener("input", () => { state.q = el.qInput.value.trim(); refetch(); });
  el.countrySelect?.addEventListener("change", () => {
    state.country = el.countrySelect.value;
    updateCityOptions(state.country, state.city);
    if (!CITY_OPTIONS_BY_COUNTRY[state.country]?.includes(state.city)) {
      state.city = "";
      el.citySelect && (el.citySelect.value = "");
    }
    refetch();
  });
  el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
  el.majorSelect?.addEventListener("change", () => { state.major = el.majorSelect.value; refetch(); });
  el.studyLevelSelect?.addEventListener("change", () => { state.study_level = el.studyLevelSelect.value; refetch(); });
  el.formatSelect?.addEventListener("change", () => { state.format = el.formatSelect.value; refetch(); });

  el.minTuitionInput?.addEventListener("input", () => { state.min_tuition = el.minTuitionInput.value; refetch(); });
  el.maxTuitionInput?.addEventListener("input", () => { state.max_tuition = el.maxTuitionInput.value; refetch(); });

  el.minAcceptanceInput?.addEventListener("input", () => { state.min_acceptance = el.minAcceptanceInput.value; refetch(); });
  el.maxAcceptanceInput?.addEventListener("input", () => { state.max_acceptance = el.maxAcceptanceInput.value; refetch(); });

  el.sortSelect?.addEventListener("change", () => { state.sort = el.sortSelect.value; refetch(); });

  el.resetBtn?.addEventListener("click", () => {
    Object.assign(state, {
      q: "", country: "", city: "", major: "", study_level: "", format: "",
      min_tuition: "", max_tuition: "",
      min_acceptance: "", max_acceptance: "",
      sort: "name_asc",
      page: 1,
      limit: state.limit,
    });
    applyToForm();
    fetchAndRender();
  });

  // card click (если клик вне ссылки)
  el.list.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) return; // пусть ссылка работает сама

    const card = e.target.closest("[data-uni-id]");
    if (!card) return;
    const id = card.getAttribute("data-uni-id");
    if (!id) return;
    window.location.href = `university.html?id=${encodeURIComponent(id)}`;
  });

  fetchAndRender();

  function buildParams() {
    const p = new URLSearchParams();

    if (state.q) p.set("q", state.q);
    if (state.country) p.set("country", state.country);
    if (state.city) p.set("city", state.city);

    if (state.major) p.set("major", state.major);
    if (state.study_level) p.set("study_level", state.study_level);
    if (state.format) p.set("format", state.format);

    if (state.min_tuition !== "") p.set("min_tuition", state.min_tuition);
    if (state.max_tuition !== "") p.set("max_tuition", state.max_tuition);

    if (state.min_acceptance !== "") p.set("min_acceptance", state.min_acceptance);
    if (state.max_acceptance !== "") p.set("max_acceptance", state.max_acceptance);

    p.set("sort", state.sort);
    p.set("page", String(state.page));
    p.set("limit", String(state.limit));

    return p;
  }

  async function fetchAndRender() {
    el.state && (el.state.textContent = "Загрузка...");
    el.list.innerHTML = "";
    el.pagination && (el.pagination.innerHTML = "");

    const params = buildParams();
    setUrlParams(params);

    try {
      const res = await fetch(`${API_BASE}/universities?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items = Array.isArray(data.items) ? data.items : [];
      // совместимость: если total нет — берём count/items.length
      const total = Number(
        data.total ?? data.count ?? items.length ?? 0
      );

      if (el.total) el.total.textContent = String(total);

      if (!items.length) {
        el.state && (el.state.textContent = "Ничего не найдено по выбранным фильтрам.");
        return;
      }

      el.state && (el.state.textContent = "");
      el.list.innerHTML = items.map(renderCard).join("");

      // пагинация: работает корректно только если backend возвращает total
      if (Number.isFinite(Number(data.total))) renderPagination(total);
    } catch (err) {
      el.state && (el.state.textContent = "Ошибка загрузки. Проверьте backend (порт 8000) и CORS.");
    }
  }

  function renderCard(u) {
    const id = u.id ?? "";
    const name = u.name ?? "—";

    const country = nested(u, ["location", "country"], "—");
    const city = nested(u, ["location", "city"], "");
    const stateLoc = nested(u, ["location", "state"], "");
    const loc = [city, country].filter(Boolean).join(", ") || [country, stateLoc].filter(Boolean).join(", ") || "—";

    const tuition = nested(u, ["finance", "tuition_year_usd"], null);
    const majors = nested(u, ["academics", "majors"], []);
    const majorTop = Array.isArray(majors) && majors.length ? majors[0] : null;

    const acceptance = nested(u, ["academics", "acceptance_rate_percent"], null);
    const badgeText = (acceptance !== null && acceptance !== undefined)
      ? `Acceptance <strong>${escapeHtml(String(acceptance))}%</strong>`
      : `Major <strong>${escapeHtml(majorTop || "—")}</strong>`;

    return `
      <article class="uni-card" data-uni-id="${escapeHtml(String(id))}">
        <div class="uni-media">
          <div class="uni-price">
            <small>from</small>
            <b>${tuition !== null && tuition !== undefined ? escapeHtml(moneyUSD(tuition)) : "—"}</b>
          </div>
          <div class="uni-logo">${escapeHtml(initials(name))}</div>
        </div>

        <div class="uni-body">
          <h3 class="uni-title">${escapeHtml(name)}</h3>

          <div class="uni-loc">
            <span class="uni-pin" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" stroke-width="2"/>
                <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2"/>
              </svg>
            </span>
            ${escapeHtml(loc)}
          </div>

          <div class="uni-badge">
            ${badgeText}
          </div>

          <div class="uni-footer">
            <a class="uni-details" href="university.html?id=${encodeURIComponent(String(id))}">
              View Details
              <span class="uni-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function renderPagination(total) {
    if (!el.pagination) return;

    const pages = Math.max(1, Math.ceil(total / state.limit));
    if (pages <= 1) return;

    const current = state.page;
    const start = Math.max(1, current - 2);
    const end = Math.min(pages, current + 2);

    let html = "";
    html += btn(Math.max(1, current - 1), "←", false);

    for (let p = start; p <= end; p++) {
      html += btn(p, String(p), p === current);
    }

    html += btn(Math.min(pages, current + 1), "→", false);

    el.pagination.innerHTML = html;

    el.pagination.querySelectorAll("[data-page]").forEach(b => {
      b.addEventListener("click", () => {
        const p = Number(b.getAttribute("data-page"));
        if (!Number.isFinite(p)) return;
        state.page = p;
        fetchAndRender();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    function btn(page, text, active) {
      return `<button class="page-btn ${active ? "page-btn--active" : ""}" type="button" data-page="${page}">
        ${escapeHtml(text)}
      </button>`;
    }
  }

  function readFromUrl() {
    const url = new URL(window.location.href);
    const sp = url.searchParams;

    state.q = sp.get("q") || "";
    state.country = sp.get("country") || "";
    state.city = sp.get("city") || "";

    state.major = sp.get("major") || "";
    state.study_level = sp.get("study_level") || "";
    state.format = sp.get("format") || "";

    state.min_tuition = sp.get("min_tuition") || "";
    state.max_tuition = sp.get("max_tuition") || "";

    state.min_acceptance = sp.get("min_acceptance") || "";
    state.max_acceptance = sp.get("max_acceptance") || "";

    state.sort = sp.get("sort") || state.sort;

    const page = Number(sp.get("page"));
    const limit = Number(sp.get("limit"));
    if (Number.isFinite(page) && page >= 1) state.page = page;
    if (Number.isFinite(limit) && limit >= 1) state.limit = limit;
  }

  function applyToForm() {
    updateMajorOptions();
    updateCityOptions(state.country, state.city);
    el.qInput && (el.qInput.value = state.q);
    el.countrySelect && (el.countrySelect.value = state.country);
    el.citySelect && (el.citySelect.value = state.city);

    el.majorSelect && (el.majorSelect.value = state.major);
    el.studyLevelSelect && (el.studyLevelSelect.value = state.study_level);
    el.formatSelect && (el.formatSelect.value = state.format);

    el.minTuitionInput && (el.minTuitionInput.value = state.min_tuition);
    el.maxTuitionInput && (el.maxTuitionInput.value = state.max_tuition);

    el.minAcceptanceInput && (el.minAcceptanceInput.value = state.min_acceptance);
    el.maxAcceptanceInput && (el.maxAcceptanceInput.value = state.max_acceptance);

    el.sortSelect && (el.sortSelect.value = state.sort);
  }

  function updateCityOptions(country, selectedCity = "") {
    if (!el.citySelect) return;
    const cities = CITY_OPTIONS_BY_COUNTRY[country] || [];
    const hasCountry = Boolean(country);

    el.citySelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = hasCountry ? "All cities" : "Select country first";
    el.citySelect.appendChild(placeholder);

    if (hasCountry) {
      cities.forEach((city) => {
        const opt = document.createElement("option");
        opt.value = city;
        opt.textContent = city;
        el.citySelect.appendChild(opt);
      });
    }

    el.citySelect.disabled = !hasCountry;
    const validSelection = hasCountry && cities.includes(selectedCity);
    el.citySelect.value = validSelection ? selectedCity : "";
  }

  function updateMajorOptions() {
    if (!el.majorSelect) return;
    el.majorSelect.innerHTML = "";

    const anyOpt = document.createElement("option");
    anyOpt.value = "";
    anyOpt.textContent = "Any major";
    el.majorSelect.appendChild(anyOpt);

    MAJOR_OPTIONS.forEach((major) => {
      const opt = document.createElement("option");
      opt.value = major;
      opt.textContent = major;
      el.majorSelect.appendChild(opt);
    });
  }
}

// =====================================
// University detail page
// =====================================
async function initUniversityPage() {
  const id = getParam("id");
  const stateEl = $("detailState");
  const cardEl = $("detailCard");

  if (!id) {
    stateEl && (stateEl.textContent = "Не передан id. Откройте со списка: university.html?id=...");
    return;
  }

  stateEl && (stateEl.textContent = "Загрузка...");
  cardEl && (cardEl.style.display = "none");

  try {
    const res = await fetch(`${API_BASE}/universities/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const u = await res.json();

    // extract fields from your JSON structure
    const name = u.name ?? "—";
    const country = nested(u, ["location", "country"], "—");
    const city = nested(u, ["location", "city"], "");
    const stateLoc = nested(u, ["location", "state"], "");
    const location = [city, country].filter(Boolean).join(", ") || [country, stateLoc].filter(Boolean).join(", ") || "—";

    const majors = nested(u, ["academics", "majors"], []);
    const levels = nested(u, ["academics", "study_levels"], []);
    const formats = nested(u, ["academics", "formats"], []);
    const acceptance = nested(u, ["academics", "acceptance_rate_percent"], null);

    const tuition = nested(u, ["finance", "tuition_year_usd"], null);
    const fee = nested(u, ["finance", "application_fee_usd"], null);

    const size = nested(u, ["student_life", "size"], null);

    // fill UI
    stateEl && (stateEl.textContent = "");
    cardEl && (cardEl.style.display = "block");

    const cover = $("detailCover");
    const price = $("detailPrice");
    const logo = $("detailLogo");
    const title = $("detailName");
    const locEl = $("detailLocation");

    const programs = $("detailPrograms");
    const req = $("detailRequirements");
    const fin = $("detailFinance");
    const extra = $("detailExtra");

    if (cover) {
      // пока без фото — градиент уже в CSS, можно позже поставить background-image через поле из backend
      cover.style.backgroundImage = "";
    }

    if (price) {
      price.textContent = (tuition !== null && tuition !== undefined) ? `${moneyUSD(tuition)}/year` : "—";
    }

    if (logo) {
      logo.textContent = initials(name);
    }

    if (title) title.textContent = name;
    if (locEl) locEl.textContent = location;

    if (programs) {
      programs.innerHTML = [
        kv("Majors", Array.isArray(majors) && majors.length ? majors.join(", ") : "—"),
        kv("Study levels", Array.isArray(levels) && levels.length ? levels.join(", ") : "—"),
        kv("Formats", Array.isArray(formats) && formats.length ? formats.join(", ") : "—"),
      ].join("");
    }

    if (req) {
      req.innerHTML = [
        kv("Acceptance rate", (acceptance !== null && acceptance !== undefined) ? `${acceptance}%` : "—"),
      ].join("");
    }

    if (fin) {
      fin.innerHTML = [
        kv("Tuition / year", (tuition !== null && tuition !== undefined) ? moneyUSD(tuition) : "—"),
        kv("Application fee", (fee !== null && fee !== undefined) ? moneyUSD(fee) : "—"),
      ].join("");
    }

    if (extra) {
      extra.innerHTML = [
        kv("Student size", size ?? "—"),
        kv("ID", u.id ?? "—"),
      ].join("");
    }

  } catch (err) {
    stateEl && (stateEl.textContent = "Ошибка загрузки университета. Проверьте backend и id.");
  }

  function kv(k, v) {
    return `<div class="d-kv"><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`;
  }
}

// =====================================
// Profile modal (local-only)
// =====================================
function initProfileUI() {
  const modal = $("profileModal");
  if (!modal) return;

  const openBtn = $("profileBtn");
  const closeBtn = $("profileCloseBtn");
  const backdrop = modal.querySelector("[data-close='profile']");

  const nameWrap = modal.querySelector(".profile-username");
  const nameDisplay = $("profileNameDisplay");
  const nameInput = $("profileNameInput");
  const editBtn = $("editNameBtn");
  const usernameError = $("usernameError");

  const budgetInput = $("budgetInput");
  const examNameInput = $("examNameInput");
  const examScoreInput = $("examScoreInput");
  const addExamBtn = $("addExamBtn");
  const examList = $("examList");
  const examError = $("examError");

  let profile = loadProfile();
  renderProfile();

  openBtn?.addEventListener("click", () => {
    openModal();
  });

  closeBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  editBtn?.addEventListener("click", () => {
    clearUsernameError();
    nameWrap?.classList.add("is-editing");
    nameInput?.focus();
    nameInput?.select();
  });

  nameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelNameEdit();
    }
  });

  nameInput?.addEventListener("blur", () => {
    commitName();
  });

  budgetInput?.addEventListener("input", () => {
    profile.budget = budgetInput.value;
    saveProfile(profile);
  });

  budgetInput?.addEventListener("blur", () => {
    const val = parseBudget(budgetInput.value);
    if (val === "") {
      profile.budget = "";
      budgetInput.value = "";
    } else {
      profile.budget = String(val);
      budgetInput.value = String(val);
    }
    saveProfile(profile);
  });

  addExamBtn?.addEventListener("click", async () => {
    clearError();
    const exam = String(examNameInput?.value || "").trim();
    const scoreRaw = String(examScoreInput?.value || "").trim();

    if (!exam) {
      return showError("Exam name is required.");
    }

    if (!scoreRaw) {
      return showError("Score is required.");
    }

    const score = Number(scoreRaw);
    if (!Number.isFinite(score)) {
      return showError("Score must be a number.");
    }

    addExamBtn.disabled = true;
    addExamBtn.textContent = "Adding...";

    try {
      const result = await validateExam(exam, score);
      profile.exams.push({ exam: result.exam, score: result.score });
      saveProfile(profile);
      renderExamList();
      examNameInput.value = "";
      examScoreInput.value = "";
    } catch (err) {
      showError(err?.message || "Exam validation failed.");
    } finally {
      addExamBtn.disabled = false;
      addExamBtn.textContent = "Add";
    }
  });

  examList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-exam-index]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-exam-index"));
    if (!Number.isFinite(idx)) return;
    profile.exams.splice(idx, 1);
    saveProfile(profile);
    renderExamList();
  });

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    clearUsernameError();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    cancelNameEdit();
  }

  function commitName() {
    if (!nameInput || !nameDisplay) return;
    const raw = String(nameInput.value || "").trim();
    const cleaned = sanitizeUsername(raw);
    if (!cleaned.ok) {
      showUsernameError(cleaned.reason || "Invalid username.");
      return;
    }
    profile.name = cleaned.value;
    nameDisplay.textContent = cleaned.value;
    nameInput.value = cleaned.value;
    saveProfile(profile);
    nameWrap?.classList.remove("is-editing");
    clearUsernameError();
  }

  function cancelNameEdit() {
    if (!nameInput) return;
    nameInput.value = profile.name || "User";
    nameWrap?.classList.remove("is-editing");
    clearUsernameError();
  }

  function renderProfile() {
    if (nameDisplay) nameDisplay.textContent = profile.name || "User";
    if (nameInput) nameInput.value = profile.name || "User";
    if (budgetInput) budgetInput.value = profile.budget || "";
    renderExamList();
  }

  function renderExamList() {
    if (!examList) return;
    if (!Array.isArray(profile.exams) || profile.exams.length === 0) {
      examList.innerHTML = "";
      return;
    }

    examList.innerHTML = profile.exams.map((item, idx) => {
      return `
        <div class="profile-exam-item">
          <div class="profile-exam-meta">
            <div class="profile-exam-name">${escapeHtml(item.exam)}</div>
            <div class="profile-exam-score">Score: ${escapeHtml(String(item.score))}</div>
          </div>
          <button class="profile-delete" type="button" data-exam-index="${idx}">Delete</button>
        </div>
      `;
    }).join("");
  }

  function showError(msg) {
    if (examError) examError.textContent = msg;
  }

  function clearError() {
    if (examError) examError.textContent = "";
  }

  function showUsernameError(msg) {
    if (usernameError) usernameError.textContent = msg;
  }

  function clearUsernameError() {
    if (usernameError) usernameError.textContent = "";
  }
}

function parseBudget(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const num = Number(raw);
  if (!Number.isFinite(num)) return "";
  if (num < 1) return 1;
  if (num > 1000000) return 1000000;
  return Math.round(num);
}

function sanitizeUsername(value) {
  const v = String(value || "").trim();
  if (!v) return { ok: false, reason: "Username is required." };
  if (v.length < 3 || v.length > 12) {
    return { ok: false, reason: "Too many symbols in username (3-12)" };
  }
  if (!/^[A-Za-z0-9]+$/.test(v)) {
    return { ok: false, reason: "Invalid symbols" };
  }
  return { ok: true, value: v };
}

function loadProfile() {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { ...PROFILE_DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      name: String(parsed?.name || PROFILE_DEFAULTS.name),
      budget: parsed?.budget ?? PROFILE_DEFAULTS.budget,
      exams: Array.isArray(parsed?.exams) ? parsed.exams : [],
    };
  } catch {
    return { ...PROFILE_DEFAULTS };
  }
}

function saveProfile(profile) {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors in alpha
  }
}

async function validateExam(exam, score) {
  const payload = { exam, score };
  const res = await fetch(`${API_BASE}/exams/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.detail || "Exam validation failed.";
    throw new Error(message);
  }

  return res.json();
}
