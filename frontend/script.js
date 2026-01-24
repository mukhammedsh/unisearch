/* UniSearch script
   Backend:
   - GET  http://127.0.0.1:8000/universities?...filters
   - GET  http://127.0.0.1:8000/universities/{id}
*/

const API_BASE = "http://127.0.0.1:8000";

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
    majorInput: $("majorInput"),
    studyLevelSelect: $("studyLevelSelect"),
    formatSelect: $("formatSelect"),

    minTuitionInput: $("minTuitionInput"),
    maxTuitionInput: $("maxTuitionInput"),
    minAcceptanceInput: $("minAcceptanceInput"),
    maxAcceptanceInput: $("maxAcceptanceInput"),
    minIeltsInput: $("minIeltsInput"),
    maxIeltsInput: $("maxIeltsInput"),
    minGpaInput: $("minGpaInput"),
    maxGpaInput: $("maxGpaInput"),

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
    min_ielts: "",
    max_ielts: "",
    min_gpa: "",
    max_gpa: "",

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
  el.countrySelect?.addEventListener("change", () => { state.country = el.countrySelect.value; refetch(); });
  el.citySelect?.addEventListener("input", () => { state.city = el.citySelect.value.trim(); refetch(); });
  el.majorInput?.addEventListener("input", () => { state.major = el.majorInput.value.trim(); refetch(); });
  el.studyLevelSelect?.addEventListener("change", () => { state.study_level = el.studyLevelSelect.value; refetch(); });
  el.formatSelect?.addEventListener("change", () => { state.format = el.formatSelect.value; refetch(); });

  el.minTuitionInput?.addEventListener("input", () => { state.min_tuition = el.minTuitionInput.value; refetch(); });
  el.maxTuitionInput?.addEventListener("input", () => { state.max_tuition = el.maxTuitionInput.value; refetch(); });

  el.minAcceptanceInput?.addEventListener("input", () => { state.min_acceptance = el.minAcceptanceInput.value; refetch(); });
  el.maxAcceptanceInput?.addEventListener("input", () => { state.max_acceptance = el.maxAcceptanceInput.value; refetch(); });

  el.minIeltsInput?.addEventListener("input", () => { state.min_ielts = el.minIeltsInput.value; refetch(); });
  el.maxIeltsInput?.addEventListener("input", () => { state.max_ielts = el.maxIeltsInput.value; refetch(); });

  el.minGpaInput?.addEventListener("input", () => { state.min_gpa = el.minGpaInput.value; refetch(); });
  el.maxGpaInput?.addEventListener("input", () => { state.max_gpa = el.maxGpaInput.value; refetch(); });

  el.sortSelect?.addEventListener("change", () => { state.sort = el.sortSelect.value; refetch(); });

  el.resetBtn?.addEventListener("click", () => {
    Object.assign(state, {
      q: "", country: "", city: "", major: "", study_level: "", format: "",
      min_tuition: "", max_tuition: "",
      min_acceptance: "", max_acceptance: "",
      min_ielts: "", max_ielts: "",
      min_gpa: "", max_gpa: "",
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

    if (state.min_ielts !== "") p.set("min_ielts", state.min_ielts);
    if (state.max_ielts !== "") p.set("max_ielts", state.max_ielts);

    if (state.min_gpa !== "") p.set("min_gpa", state.min_gpa);
    if (state.max_gpa !== "") p.set("max_gpa", state.max_gpa);

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

    state.min_ielts = sp.get("min_ielts") || "";
    state.max_ielts = sp.get("max_ielts") || "";

    state.min_gpa = sp.get("min_gpa") || "";
    state.max_gpa = sp.get("max_gpa") || "";

    state.sort = sp.get("sort") || state.sort;

    const page = Number(sp.get("page"));
    const limit = Number(sp.get("limit"));
    if (Number.isFinite(page) && page >= 1) state.page = page;
    if (Number.isFinite(limit) && limit >= 1) state.limit = limit;
  }

  function applyToForm() {
    el.qInput && (el.qInput.value = state.q);
    el.countrySelect && (el.countrySelect.value = state.country);
    el.citySelect && (el.citySelect.value = state.city);

    el.majorInput && (el.majorInput.value = state.major);
    el.studyLevelSelect && (el.studyLevelSelect.value = state.study_level);
    el.formatSelect && (el.formatSelect.value = state.format);

    el.minTuitionInput && (el.minTuitionInput.value = state.min_tuition);
    el.maxTuitionInput && (el.maxTuitionInput.value = state.max_tuition);

    el.minAcceptanceInput && (el.minAcceptanceInput.value = state.min_acceptance);
    el.maxAcceptanceInput && (el.maxAcceptanceInput.value = state.max_acceptance);

    el.minIeltsInput && (el.minIeltsInput.value = state.min_ielts);
    el.maxIeltsInput && (el.maxIeltsInput.value = state.max_ielts);

    el.minGpaInput && (el.minGpaInput.value = state.min_gpa);
    el.maxGpaInput && (el.maxGpaInput.value = state.max_gpa);

    el.sortSelect && (el.sortSelect.value = state.sort);
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
    const gpa = nested(u, ["exams_avg", "GPA"], null);
    const ielts = nested(u, ["exams_avg", "IELTS"], null);

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
        kv("GPA (avg)", (gpa !== null && gpa !== undefined) ? String(gpa) : "—"),
        kv("IELTS (avg)", (ielts !== null && ielts !== undefined) ? String(ielts) : "—"),
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
