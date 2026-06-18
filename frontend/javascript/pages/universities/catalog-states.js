import { t, tFormat } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { renderInlineIcon } from "../_shared.js";

/**
 * State rendering functions for university catalog
 */

export function renderUniversitiesState(container, options = {}) {
  if (!container) return;
  const warningText = String(options.warningText || "").trim();
  const emptyText = String(options.emptyText || "").trim();
  const blocks = [];

  if (warningText) {
    blocks.push(`
      <div class="u-state-card u-state-card--warning" role="status">
        <div class="u-state-card__title">${escapeHtml(t("universities.scope_note.warning_title", "Temporary ranking fallback"))}</div>
        <div class="u-state-card__text">${escapeHtml(warningText)}</div>
      </div>
    `.trim());
  }

  if (emptyText) {
    blocks.push(`
      <div class="u-state-card u-state-card--empty" role="status">
        <div class="u-state-card__title">${escapeHtml(t("universities.scope_note.empty_title", "No results for current filters"))}</div>
        <div class="u-state-card__text">${escapeHtml(emptyText)}</div>
      </div>
    `.trim());
  }

  if (!blocks.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = blocks.join("");
}

export function getUniversitiesSkeletonCount() {
  const viewportWidth = window.innerWidth;
  if (viewportWidth >= 1400) return 12;
  if (viewportWidth >= 1200) return 9;
  if (viewportWidth >= 900) return 6;
  if (viewportWidth >= 600) return 4;
  return 3;
}

export function setUniversitiesLoading(elements, isLoading, viewMode = "list") {
  const { content, skeleton, list, pagination, mapStage, mapResults } = elements;
  const mapMode = viewMode === "map";
  const showListSkeleton = !!isLoading && !mapMode;

  if (content) {
    content.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  if (skeleton) {
    if (showListSkeleton) {
      const skeletonCount = getUniversitiesSkeletonCount();
      if (!skeleton.innerHTML.trim() || skeleton.dataset.count !== String(skeletonCount)) {
        skeleton.dataset.count = String(skeletonCount);
        skeleton.innerHTML = Array.from({ length: skeletonCount }, () => `
          <article class="uni-card u-skeleton-card is-skeleton" aria-hidden="true">
            <div class="uni-media">
              <div class="uni-price" aria-hidden="true">
                <div class="skeleton-line" style="width: 64px; height: 11px; margin-left: auto;"></div>
                <div class="skeleton-line" style="width: 56px; height: 18px; margin: 6px 0 0 auto;"></div>
              </div>
              <div class="uni-logo" aria-hidden="true"></div>
            </div>
            <div class="uni-body">
              <div class="skeleton-line" style="width: 86%; height: 17px;"></div>
              <div class="skeleton-line" style="width: 62%; height: 17px;"></div>
              <div class="skeleton-line" style="width: 58%;"></div>
              <div class="skeleton-line" style="width: 72%;"></div>
              <div class="skeleton-line" style="width: 100%; height: 68px; border-radius: 12px; margin-top: 8px;"></div>
              <div class="skeleton-line" style="width: 42%; height: 14px; margin-top: auto;"></div>
            </div>
          </article>
        `).join("");
      }
      skeleton.style.display = "grid";
      skeleton.setAttribute("aria-hidden", "false");
    } else {
      skeleton.style.display = "none";
      skeleton.setAttribute("aria-hidden", "true");
    }
  }

  if (list) {
    list.style.display = mapMode ? "none" : "grid";
    list.style.visibility = showListSkeleton ? "hidden" : "visible";
  }

  if (pagination && !mapMode) {
    pagination.style.visibility = showListSkeleton ? "hidden" : "visible";
  }

  if (mapStage) {
    mapStage.classList.toggle("is-loading", !!isLoading && mapMode);
  }

  if (mapResults && isLoading && mapMode) {
    mapResults.innerHTML = `
      <div class="inline-loading-note inline-loading-note--compact" role="status" aria-live="polite">
        ${escapeHtml(t("universities.loading", "Loading universities"))}
      </div>
    `;
  }
}

export function renderMobileFilterSummary(container, state) {
  if (!container) return;

  const filters = [];
  if (state.q) filters.push(state.q);
  if (state.country) filters.push(state.country);
  if (state.city) filters.push(state.city);
  if (state.min_tuition > 0 || state.max_tuition < 150000) filters.push("Cost range");

  const count = filters.length;
  container.textContent = count > 0 ? String(count) : "";
  container.style.display = count > 0 ? "" : "none";
}

export function renderSearchSuggestions(container, items, query, options = {}) {
  const { onSelect = () => {}, maxItems = 8 } = options;

  if (!container || !items.length) {
    if (container) {
      container.innerHTML = "";
      container.classList.remove("is-open");
    }
    return;
  }

  const visible = items.slice(0, maxItems);
  container.innerHTML = "";
  visible.forEach((item) => {
    const name = String(item?.name || "");
    const id = String(item?.id || "");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "u-search-suggestion";
    btn.setAttribute("data-uni-id", id);
    btn.textContent = name;
    container.appendChild(btn);
  });

  container.classList.add("is-open");

  container.querySelectorAll(".u-search-suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      const uniId = button.getAttribute("data-uni-id");
      if (uniId) onSelect(uniId);
    });
  });
}

export function hideSearchSuggestions(container) {
  if (!container) return;
  container.innerHTML = "";
  container.classList.remove("is-open");
}
