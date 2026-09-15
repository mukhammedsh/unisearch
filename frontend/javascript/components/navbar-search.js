/* frontend/javascript/components/navbar-search.js */
import {
  API_BASE,
  bindImageFallbacks,
  debounce,
  escapeHtml,
  escapeHtmlAttr,
  initials,
} from "../utils.js";
import { getCurrentLanguage, t } from "../i18n.js";
import {
  isComparePath,
  routeUniversityDetail,
  routeUniversities,
} from "../routes.js";
import { shouldOpenUniversitiesInNewTab } from "../settings.js";
import { classifyError, isOnline } from "./network-status.js";

const searchCache = new Map();
let activeAbortController = null;
let highlightedIndex = -1;
let globalClickBound = false;

function buildLogoUrl(universityId, forceFull = false) {
  const safeId = encodeURIComponent(String(universityId || "").trim());
  const folder = forceFull ? "logos" : "logos-small";
  return `${API_BASE}/universities/assets/${folder}/${safeId}.png`;
}

export function isGlobalSearchDisabledWorkspace() {
  if (typeof document === "undefined") return false;
  const page = String(document.body?.dataset?.page || "").trim().toLowerCase();
  if (page === "compare") return true;
  if (page && page !== "home") return false;

  const path = typeof window !== "undefined" ? String(window.location?.pathname || "") : "";
  return Boolean(
    (typeof document.getElementById === "function" && document.getElementById("compareResultsPane")) ||
    (typeof isComparePath === "function" && isComparePath(path))
  );
}

function ensureSuggestionsContainer(host) {
  if (!host) return null;
  let container = host.querySelector(".navbar-search-suggestions");
  if (!container) {
    container = document.createElement("div");
    container.className = "navbar-search-suggestions";
    container.setAttribute("role", "listbox");
    container.setAttribute("aria-label", t("universities.search_placeholder", "Search university..."));
    host.appendChild(container);
  }
  return container;
}

export function hideGlobalSearchSuggestions() {
  const container = document.querySelector(".navbar-search-suggestions");
  if (container) {
    container.classList.remove("is-open");
    container.innerHTML = "";
  }
  highlightedIndex = -1;
}

function updateHighlightedItem(items) {
  const container = document.querySelector(".navbar-search-suggestions");
  if (!container) return;
  const nodes = Array.from(container.querySelectorAll(".navbar-search-suggestion"));
  nodes.forEach((node, idx) => {
    const isCur = idx === highlightedIndex;
    node.classList.toggle("is-highlighted", isCur);
    node.setAttribute("aria-selected", isCur ? "true" : "false");
    if (isCur && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  });
}

export async function fetchUniversitySearchResults(query, signal) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [];
  const lang = (typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "") || "eng";
  const cacheKey = `${lang}:${trimmed.toLowerCase()}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  const url = `${API_BASE}/universities?q=${encodeURIComponent(trimmed)}&limit=5&fields=card&lang=${encodeURIComponent(lang)}`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items.slice(0, 5) : [];
  searchCache.set(cacheKey, items);
  return items;
}

export function generateSuggestionsHtml(items, highlightedIdx = -1) {
  if (!items || !items.length) {
    return `
      <div class="navbar-search-empty" role="status">
        <span class="navbar-search-empty__text">${escapeHtml(t("universities.no_matches", "No universities found"))}</span>
      </div>
    `;
  }

  const openNewTab = typeof shouldOpenUniversitiesInNewTab === "function" && shouldOpenUniversitiesInNewTab();
  const targetAttrs = openNewTab ? ' target="_blank" rel="noopener noreferrer"' : "";

  return items.map((item, idx) => {
    const id = String(item?.id || "").trim();
    const name = String(item?.name || "").trim();
    const city = String(item?.location?.city || "").trim();
    const country = String(item?.location?.country || "").trim();
    const locationText = [city, country].filter(Boolean).join(", ");
    const logoSrc = buildLogoUrl(id, false);
    const logoSrcFull = buildLogoUrl(id, true);
    const initialsText = initials(name);
    const href = routeUniversityDetail(id);
    const isHigh = idx === highlightedIdx;

    return `
      <a href="${escapeHtmlAttr(href)}" class="navbar-search-suggestion${isHigh ? " is-highlighted" : ""}" role="option" data-uni-id="${escapeHtmlAttr(id)}" aria-selected="${isHigh ? "true" : "false"}"${targetAttrs}>
        <span class="navbar-search-suggestion__logo">
          <img src="${escapeHtmlAttr(logoSrc)}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initialsText)}" />
        </span>
        <span class="navbar-search-suggestion__body">
          <span class="navbar-search-suggestion__name">${escapeHtml(name)}</span>
          ${locationText ? `<span class="navbar-search-suggestion__location">${escapeHtml(locationText)}</span>` : ""}
        </span>
      </a>
    `;
  }).join("");
}

export function generateOfflineNoticeHtml() {
  return `
    <div class="navbar-search-empty navbar-search-empty--offline" role="status">
      <span class="navbar-search-empty__text" data-i18n="navbar.search.offline_notice">${escapeHtml(t("navbar.search.offline_notice", "Search is unavailable while offline."))}</span>
    </div>
  `;
}

export function renderGlobalSearchOfflineNotice(host) {
  const container = ensureSuggestionsContainer(host);
  if (!container) return;
  container.innerHTML = generateOfflineNoticeHtml();
  container.classList.add("is-open");
}

export function renderGlobalSearchSuggestions(host, items, query) {
  const container = ensureSuggestionsContainer(host);
  if (!container) return;
  container.innerHTML = generateSuggestionsHtml(items, highlightedIndex);
  container.classList.add("is-open");
  bindImageFallbacks(container);
}

function bindGlobalClick() {
  if (globalClickBound || typeof document === "undefined") return;
  globalClickBound = true;
  document.addEventListener("click", (event) => {
    const host = document.getElementById("universitySearch");
    if (!host) return;
    if (!host.contains(event.target)) {
      hideGlobalSearchSuggestions();
    }
  });
}

export function initGlobalNavbarSearch() {
  if (typeof document === "undefined") return;
  if (isGlobalSearchDisabledWorkspace()) {
    hideGlobalSearchSuggestions();
    return;
  }

  const host = document.getElementById("universitySearch");
  const qInput = document.getElementById("qInput");
  const searchClearBtn = document.getElementById("searchClearBtn");
  const navbar = document.querySelector(".navbar");

  if (navbar) navbar.classList.add("has-university-search");
  if (host) host.hidden = false;

  if (!qInput || !host) return;
  if (qInput.dataset.globalSearchBound === "1") return;
  qInput.dataset.globalSearchBound = "1";

  bindGlobalClick();

  const syncClearButton = () => {
    if (searchClearBtn) {
      searchClearBtn.hidden = !Boolean(qInput.value.trim().length);
    }
  };

  const doSearch = debounce(async () => {
    if (isGlobalSearchDisabledWorkspace()) {
      hideGlobalSearchSuggestions();
      return;
    }
    const q = qInput.value.trim();
    if (!q) {
      hideGlobalSearchSuggestions();
      return;
    }

    if (!isOnline()) {
      renderGlobalSearchOfflineNotice(host);
      return;
    }

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    try {
      const items = await fetchUniversitySearchResults(q, activeAbortController.signal);
      if (isGlobalSearchDisabledWorkspace()) {
        hideGlobalSearchSuggestions();
        return;
      }
      if (qInput.value.trim() === q) {
        highlightedIndex = -1;
        renderGlobalSearchSuggestions(host, items, q);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        const errorInfo = classifyError(err);
        if (errorInfo.isOffline) {
          renderGlobalSearchOfflineNotice(host);
        } else {
          hideGlobalSearchSuggestions();
        }
      }
    }
  }, 180);

  qInput.addEventListener("input", () => {
    if (isGlobalSearchDisabledWorkspace()) {
      hideGlobalSearchSuggestions();
      return;
    }
    syncClearButton();
    doSearch();
  });

  qInput.addEventListener("focus", () => {
    if (isGlobalSearchDisabledWorkspace()) {
      hideGlobalSearchSuggestions();
      return;
    }
    const q = qInput.value.trim();
    if (q) doSearch();
  });

  qInput.addEventListener("keydown", (event) => {
    if (isGlobalSearchDisabledWorkspace()) {
      return;
    }
    const container = host.querySelector(".navbar-search-suggestions");
    const isOpen = container && container.classList.contains("is-open");
    const suggestions = isOpen ? Array.from(container.querySelectorAll(".navbar-search-suggestion")) : [];

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen || !suggestions.length) return;
      highlightedIndex = (highlightedIndex + 1) % suggestions.length;
      updateHighlightedItem(suggestions);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen || !suggestions.length) return;
      highlightedIndex = (highlightedIndex - 1 + suggestions.length) % suggestions.length;
      updateHighlightedItem(suggestions);
      return;
    }

    if (event.key === "Enter") {
      if (isOpen && suggestions.length > 0) {
        event.preventDefault();
        const target = (highlightedIndex >= 0 && suggestions[highlightedIndex]) || suggestions[0];
        if (target) {
          const href = target.getAttribute("href");
          hideGlobalSearchSuggestions();
          if (href) {
            const openNewTab = target.getAttribute("target") === "_blank";
            if (openNewTab) {
              window.open(href, "_blank", "noopener,noreferrer");
            } else {
              window.location.href = href;
            }
          }
        }
        return;
      }

      // If no suggestion dropdown is open, pressing enter with a query opens catalog
      const q = qInput.value.trim();
      if (q) {
        event.preventDefault();
        window.location.href = routeUniversities({ q });
      }
      return;
    }

    if (event.key === "Escape") {
      hideGlobalSearchSuggestions();
      qInput.blur();
    }
  });

  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      qInput.value = "";
      syncClearButton();
      hideGlobalSearchSuggestions();
      qInput.focus();
    });
  }

  // Close suggestions when user clicks an item
  host.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest(".navbar-search-suggestion") : null;
    if (link) {
      hideGlobalSearchSuggestions();
    }
  });
}
