import { motionPress, replayMotion } from "../../utils.js";

/**
 * Event handlers for university catalog
 */

export function handleCardAction(actionBtn, context = {}) {
  const {
    savedUniversityIds = new Set(),
    compareUniversityIds = new Set(),
    isCompareSelectionMode = () => false,
    toggleCompareUniversity = () => {},
    syncCardActionState = () => {},
    persistSavedAndCompare = () => {},
    refetch = () => {},
    compensateCardAnchorShift = () => {},
    state = {}
  } = context;

  if (!(actionBtn instanceof Element)) return false;
  const card = actionBtn.closest("[data-uni-id]");
  const uniId = String(card?.getAttribute("data-uni-id") || "").trim();
  const action = String(actionBtn.getAttribute("data-card-action") || "").trim();
  if (!card || !uniId || !action) return false;

  motionPress(actionBtn);

  if (action === "save") {
    const wasSaved = savedUniversityIds.has(uniId);
    const beforeTop = card.getBoundingClientRect().top;
    const savedCountBefore = savedUniversityIds.size;
    const shouldCompensateShift = (
      (!wasSaved && savedCountBefore === 0) ||
      wasSaved
    );
    if (wasSaved) savedUniversityIds.delete(uniId);
    else savedUniversityIds.add(uniId);
    syncCardActionState();
    replayMotion(actionBtn.querySelector(".uni-action-icon") || actionBtn, "motion-pop", { timeoutMs: 420 });
    replayMotion(card, "motion-state-pulse", { timeoutMs: 520 });
    persistSavedAndCompare();
    if (state.only_saved && wasSaved) {
      refetch();
    } else if (shouldCompensateShift) {
      compensateCardAnchorShift(card, beforeTop);
    }
    return true;
  }

  if (action === "compare") {
    return isCompareSelectionMode() ? toggleCompareUniversity(uniId, actionBtn) : false;
  }

  return false;
}

export function setupFilterEventListeners(elements, handlers) {
  const {
    onSearchInput = () => {},
    onSearchBlur = () => {},
    onCountryChange = () => {},
    onStateChange = () => {},
    onCityChange = () => {},
    onStudyLevelChange = () => {},
    onSortChange = () => {},
    onSliderChange = () => {},
    onResetFilters = () => {}
  } = handlers;

  if (elements.qInput) {
    elements.qInput.addEventListener("input", onSearchInput);
    elements.qInput.addEventListener("blur", onSearchBlur);
  }

  if (elements.countrySelect) {
    elements.countrySelect.addEventListener("change", onCountryChange);
  }

  if (elements.stateSelect) {
    elements.stateSelect.addEventListener("change", onStateChange);
  }

  if (elements.citySelect) {
    elements.citySelect.addEventListener("change", onCityChange);
  }

  if (elements.studyLevelSelect) {
    elements.studyLevelSelect.addEventListener("change", onStudyLevelChange);
  }

  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", onSortChange);
  }

  if (elements.resetBtn) {
    elements.resetBtn.addEventListener("click", onResetFilters);
  }

  // Slider listeners
  const sliders = [
    { el: elements.focusSlider, handler: onSliderChange },
    { el: elements.atmosphereSlider, handler: onSliderChange },
    { el: elements.financeSlider, handler: onSliderChange },
    { el: elements.locationSlider, handler: onSliderChange },
    { el: elements.minSlider, handler: onSliderChange },
    { el: elements.maxSlider, handler: onSliderChange }
  ];

  sliders.forEach(({ el, handler }) => {
    if (el) el.addEventListener("input", handler);
  });
}

export function setupViewModeListeners(elements, handlers) {
  const { onListView = () => {}, onMapView = () => {} } = handlers;

  if (elements.btnList) {
    elements.btnList.addEventListener("click", onListView);
  }

  if (elements.btnMap) {
    elements.btnMap.addEventListener("click", onMapView);
  }
}

export function setupMobileFilterListeners(elements, handlers) {
  const { onToggle = () => {}, onClose = () => {} } = handlers;

  if (elements.mobileFilterToggle) {
    elements.mobileFilterToggle.addEventListener("click", onToggle);
  }

  if (elements.mobileFilterClose) {
    elements.mobileFilterClose.addEventListener("click", onClose);
  }
}

export function setupPaginationListeners(container, onPageChange) {
  if (!container) return;
  container.querySelectorAll("button[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const newPage = Number(button.dataset.page);
      if (newPage && Number.isFinite(newPage)) {
        onPageChange(newPage);
      }
    });
  });
}

export function setupCardActionListeners(container, onCardAction) {
  if (!container) return;
  container.querySelectorAll("[data-card-action]").forEach(button => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onCardAction(button);
    });
  });
}

export function setupSavedFilterListeners(buttons, onFilterClick) {
  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const filterName = button.getAttribute("data-saved-filter");
      if (filterName) onFilterClick(filterName);
    });
  });
}
