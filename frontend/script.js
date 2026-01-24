// ====== CONFIG ======
const API_BASE = "http://127.0.0.1:8000"; // если фронт и бек на одном домене, поставь ""

// ====== Helpers ======
function qs(id) { return document.getElementById(id); }

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function toMoney(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("ru-RU").format(n) + " ₸/год";
}

function stars(rating) {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

// ====== Page routing ======
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "universities") initUniversitiesPage();
  if (page === "university") initUniversityPage();
});

// ====== Universities list page ======
function initUniversitiesPage() {
  const state = {
    q: "",
    country: "",
    city: "",
    field: "",
    min_tuition: "",
    max_tuition: "",
    sort: "rating_desc",
    page: 1,
    limit: 10
  };

  const totalCountEl = qs("totalCount");
  const listEl = qs("universitiesList");
  const paginationEl = qs("pagination");
  const listStateEl = qs("listState");

  const qInput = qs("qInput");
  const countrySelect = qs("countrySelect");
  const citySelect = qs("citySelect");
  const fieldSelect = qs("fieldSelect");
  const minTuitionInput = qs("minTuitionInput");
  const maxTuitionInput = qs("maxTuitionInput");
  const sortSelect = qs("sortSelect");
  const sortSelectMobile = qs("sortSelectMobile");
  const resetBtn = qs("resetFiltersBtn");

  // Keep sort in sync
  function syncSort(value) {
    state.sort = value;
    if (sortSelect) sortSelect.value = value;
    if (sortSelectMobile) sortSelectMobile.value = value;
  }

  // Events
  qInput.addEventListener("input", debounce(() => {
    state.q = qInput.value.trim();
    state.page = 1;
    fetchAndRender();
  }, 300));

  countrySelect.addEventListener("change", () => {
    state.country = countrySelect.value;
    state.page = 1;
    fetchAndRender();
  });

  citySelect.addEventListener("change", () => {
    state.city = citySelect.value;
    state.page = 1;
    fetchAndRender();
  });

  fieldSelect.addEventListener("change", () => {
    state.field = fieldSelect.value;
    state.page = 1;
    fetchAndRender();
  });

  minTuitionInput.addEventListener("input", debounce(() => {
    state.min_tuition = minTuitionInput.value;
    state.page = 1;
    fetchAndRender();
  }, 300));

  maxTuitionInput.addEventListener("input", debounce(() => {
    state.max_tuition = maxTuitionInput.value;
    state.page = 1;
    fetchAndRender();
  }, 300));

  sortSelect.addEventListener("change", () => {
    syncSort(sortSelect.value);
    state.page = 1;
    fetchAndRender();
  });

  sortSelectMobile.addEventListener("change", () => {
    syncSort(sortSelectMobile.value);
    state.page = 1;
    fetchAndRender();
  });

  resetBtn.addEventListener("click", () => {
    qInput.value = "";
    countrySelect.value = "";
    citySelect.value = "";
    fieldSelect.value = "";
    minTuitionInput.value = "";
    maxTuitionInput.value = "";
    syncSort("rating_desc");
    state.page = 1;

    state.q = "";
    state.country = "";
    state.city = "";
    state.field = "";
    state.min_tuition = "";
    state.max_tuition = "";

    fetchAndRender();
  });

  // Initial
  fetchAndRender();

  async function fetchAndRender() {
    listStateEl.textContent = "Загрузка...";
    listEl.innerHTML = "";
    paginationEl.innerHTML = "";

    try {
      const params = new URLSearchParams();
      if (state.q) params.set("q", state.q);
      if (state.country) params.set("country", state.country);
      if (state.city) params.set("city", state.city);
      if (state.field) params.set("field", state.field);
      if (state.min_tuition !== "") params.set("min_tuition", state.min_tuition);
      if (state.max_tuition !== "") params.set("max_tuition", state.max_tuition);
      params.set("sort", state.sort);
      params.set("page", String(state.page));
      params.set("limit", String(state.limit));

      const url = `${API_BASE}/api/universities?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items = data.items || [];
      const total = Number(data.total || 0);

      totalCountEl.textContent = String(total);

      if (items.length === 0) {
        listStateEl.textContent = "Ничего не найдено по выбранным фильтрам.";
        return;
      }

      listStateEl.textContent = "";

      listEl.innerHTML = items.map(renderUniversityCard).join("");

      // click handlers (delegation)
      listEl.addEventListener("click", (e) => {
        const card = e.target.closest(".uni-card");
        if (!card) return;
        const id = card.getAttribute("data-id");
        if (!id) return;
        window.location.href = `university.html?id=${encodeURIComponent(id)}`;
      }, { once: true });

      renderPagination(total, state.page, state.limit);
    } catch (err) {
      listStateEl.textContent = "Ошибка загрузки. Проверь, запущен ли backend и CORS.";
      // Для разработки можно показать заглушку
      const mock = [{
        id: 1,
        name: "Пример University",
        country: "Kazakhstan",
        city: "Almaty",
        field: "IT",
        rating: 5,
        tuition: 1200000,
        logo_url: ""
      }];
      listEl.innerHTML = mock.map(renderUniversityCard).join("");
      totalCountEl.textContent = "1";
    }
  }

  function renderUniversityCard(u) {
    const logo = u.logo_url
      ? `<img src="${escapeHtml(u.logo_url)}" alt="logo">`
      : `<div class="logo-fallback">U</div>`;

    const tags = [
      u.field ? `<span class="tag tag--accent">${escapeHtml(u.field)}</span>` : "",
      u.country ? `<span class="tag">${escapeHtml(u.country)}</span>` : "",
      u.city ? `<span class="tag">${escapeHtml(u.city)}</span>` : ""
    ].filter(Boolean).join("");

    return `
      <article class="uni-card" data-id="${escapeHtml(String(u.id))}">
        <div class="uni-logo">${logo}</div>

        <div class="uni-main">
          <h3 class="uni-name">${escapeHtml(u.name || "—")}</h3>
          <div class="uni-meta">${escapeHtml((u.country || "—") + (u.city ? ", " + u.city : ""))}</div>
          <div class="uni-tags">${tags}</div>
        </div>

        <div class="uni-side">
          <div class="uni-rating">${stars(u.rating)} (${escapeHtml(String(u.rating ?? "—"))})</div>
          <div class="uni-price">${toMoney(u.tuition)}</div>
          <button class="uni-btn" type="button">Подробнее</button>
        </div>
      </article>
    `;
  }

  function renderPagination(total, page, limit) {
    const pages = Math.max(1, Math.ceil(total / limit));
    if (pages <= 1) return;

    const btn = (p, text = String(p), active = false) => `
      <button class="page-btn ${active ? "page-btn--active" : ""}" data-page="${p}" type="button">${text}</button>
    `;

    const parts = [];

    const prev = Math.max(1, page - 1);
    const next = Math.min(pages, page + 1);

    parts.push(btn(prev, "←"));
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, page + 2);

    for (let p = start; p <= end; p++) parts.push(btn(p, String(p), p === page));
    parts.push(btn(next, "→"));

    paginationEl.innerHTML = parts.join("");

    paginationEl.onclick = (e) => {
      const b = e.target.closest(".page-btn");
      if (!b) return;
      const p = Number(b.getAttribute("data-page"));
      if (!Number.isFinite(p)) return;
      state.page = p;
      fetchAndRender();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }
}

// ====== University detail page ======
async function initUniversityPage() {
  const id = getParam("id");
  const stateEl = qs("detailState");
  const cardEl = qs("detailCard");
  const logoEl = qs("detailLogo");
  const nameEl = qs("detailName");
  const locEl = qs("detailLocation");
  const tagsEl = qs("detailTags");
  const priceEl = qs("detailPrice");
  const descEl = qs("detailDescription");
  const statsEl = qs("detailStats");
  const openWebsiteBtn = qs("openWebsiteBtn");

  if (!id) {
    stateEl.textContent = "Не передан параметр id.";
    return;
  }

  stateEl.textContent = "Загрузка...";
  cardEl.style.display = "none";

  try {
    const url = `${API_BASE}/api/universities/${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const u = await res.json();

    stateEl.textContent = "";
    cardEl.style.display = "block";

    logoEl.innerHTML = u.logo_url
      ? `<img src="${escapeHtml(u.logo_url)}" alt="logo">`
      : `<div class="logo-fallback">U</div>`;

    nameEl.textContent = u.name || "—";
    locEl.textContent = `${u.country || "—"}${u.city ? ", " + u.city : ""}`;

    tagsEl.innerHTML = [
      u.field ? `<span class="tag tag--accent">${escapeHtml(u.field)}</span>` : "",
      (u.rating !== undefined && u.rating !== null)
        ? `<span class="tag">Рейтинг: ${escapeHtml(String(u.rating))}</span>`
        : "",
    ].filter(Boolean).join("");

    priceEl.textContent = toMoney(u.tuition);
    descEl.textContent = u.description || "Описание пока не заполнено.";

    const stats = [
      ["Язык", u.language],
      ["Уровень", u.level],
      ["Сайт", u.website ? "Доступен" : "—"],
    ];

    statsEl.innerHTML = stats.map(([k, v]) => `
      <div class="stat"><span>${escapeHtml(k)}</span><span>${escapeHtml(v || "—")}</span></div>
    `).join("");

    openWebsiteBtn.onclick = () => {
      if (!u.website) return;
      window.open(u.website, "_blank", "noopener,noreferrer");
    };
  } catch (err) {
    stateEl.textContent = "Ошибка загрузки университета. Проверь backend.";
  }
}

// ====== security helper ======
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
