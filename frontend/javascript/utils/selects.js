import { escapeHtml, getFlagImg } from "./format.js";

let customSelectGlobalClickBound = false;

function bindCustomSelectGlobalClick() {
  if (customSelectGlobalClickBound || typeof document === "undefined") return;
  customSelectGlobalClickBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    document.querySelectorAll(".custom-select-wrapper.open").forEach((wrapper) => {
      if (!wrapper.contains(target)) {
        wrapper.classList.remove("open");
        wrapper.classList.remove("open-up");
        const trigger = wrapper.querySelector(".custom-select-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        wrapper.querySelectorAll(".custom-option.is-highlighted").forEach((node) => node.classList.remove("is-highlighted"));
      }
    });
  });
}

function getSelectLabel(select) {
  const associatedLabel = Array.from(select.labels || [])
    .map((label) => label.querySelector("[data-i18n]")?.textContent?.trim() || label.textContent?.trim())
    .find(Boolean);
  return select.getAttribute("aria-label") || select.getAttribute("title") || associatedLabel || select.name || "";
}

function ensureSelectWrapper(select) {
  let wrapper = select.parentNode;
  const alreadyWrapped = wrapper && wrapper.classList.contains("custom-select-wrapper");
  if (!alreadyWrapped) {
    wrapper = document.createElement("div");
    wrapper.classList.add("custom-select-wrapper");
    select.parentNode.insertBefore(wrapper, select.nextSibling);
    wrapper.appendChild(select);
  }
  select.classList.add("u-select-hidden");
  return wrapper;
}

function setupCustomSelectElements(select, wrapper, selectId, isLanguageSelect) {
  let trigger = wrapper.querySelector(".custom-select-trigger");
  if (!trigger) {
    trigger = document.createElement("div");
    trigger.classList.add("custom-select-trigger");
    wrapper.appendChild(trigger);
  }
  if (isLanguageSelect) {
    wrapper.classList.add("custom-select-wrapper--language");
    trigger.classList.add("custom-select-trigger--language");
  }

  let customOptions = wrapper.querySelector(".custom-options");
  if (!customOptions) {
    customOptions = document.createElement("div");
    customOptions.classList.add("custom-options");
    wrapper.appendChild(customOptions);
  }

  const popupId = customOptions.id || `custom-options-${selectId}`;
  customOptions.id = popupId;

  const searchable = select.dataset.searchable === "true";
  let optionList = searchable ? customOptions.querySelector(".custom-select-option-list") : null;
  if (searchable && !optionList) {
    optionList = document.createElement("div");
    optionList.className = "custom-select-option-list";
  }
  const listboxId = searchable ? `${popupId}-listbox` : popupId;
  if (optionList) {
    optionList.id = listboxId;
    optionList.setAttribute("role", "listbox");
    customOptions.setAttribute("role", "presentation");
  } else {
    customOptions.setAttribute("role", "listbox");
  }

  let searchInput = searchable ? customOptions.querySelector(".custom-select-search") : null;
  if (searchable && !searchInput) {
    searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "custom-select-search";
    searchInput.autocomplete = "off";
  }

  return { trigger, customOptions, optionList, searchInput, listboxId };
}

function shouldOpenUp(trigger, wrapper) {
  if (typeof trigger.getBoundingClientRect !== "function") return false;

  const triggerRect = trigger.getBoundingClientRect();
  let scrollParent = null;

  if (typeof wrapper.closest === "function") {
    const filterCard = wrapper.closest(".u-filter-card");
    const sidebar = wrapper.closest(".u-sidebar");
    if (filterCard && typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      const fcOverflow = window.getComputedStyle(filterCard).overflowY;
      if (fcOverflow === "auto" || fcOverflow === "scroll") {
        scrollParent = filterCard;
      }
    }
    if (!scrollParent && sidebar) {
      scrollParent = sidebar;
    }
  }

  let parentBottom = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 800;
  let parentTop = 0;
  if (scrollParent && typeof scrollParent.getBoundingClientRect === "function") {
    const parentRect = scrollParent.getBoundingClientRect();
    parentBottom = Math.min(parentBottom, parentRect.bottom);
    parentTop = Math.max(parentTop, parentRect.top);
  }

  const spaceBelow = parentBottom - triggerRect.bottom;
  const spaceAbove = triggerRect.top - parentTop;
  return spaceBelow < 210 && spaceAbove > spaceBelow;
}

function createOptionNode(option, index, listboxId, showFlags) {
  const node = document.createElement("div");
  node.classList.add("custom-option");
  node.id = `${listboxId}-opt-${index}`;
  node.setAttribute("role", "option");
  node.setAttribute("data-value", String(option.value || ""));
  node.setAttribute("data-label", option.text || "");
  node.setAttribute("aria-selected", option.selected ? "true" : "false");
  if (option.disabled) {
    node.classList.add("is-disabled");
    node.setAttribute("aria-disabled", "true");
  }
  const flag = showFlags ? getFlagImg(option.value) : "";
  node.innerHTML = flag ? `${flag} <span>${escapeHtml(option.text)}</span>` : escapeHtml(option.text);
  if (option.selected) node.classList.add("selected");
  return node;
}

function rebuildCustomOptions(select, customOptions, optionList, searchInput, listboxId, showFlags) {
  customOptions.innerHTML = "";
  if (searchInput) customOptions.appendChild(searchInput);
  if (optionList) {
    optionList.innerHTML = "";
    customOptions.appendChild(optionList);
  }
  const fragment = document.createDocumentFragment();
  let optIndex = 0;

  Array.from(select.children).forEach((child) => {
    if (child.tagName === "OPTGROUP") {
      const groupLabel = child.getAttribute("label") || "";
      const groupHeader = document.createElement("div");
      groupHeader.classList.add("custom-optgroup-label");
      groupHeader.setAttribute("role", "presentation");
      groupHeader.textContent = groupLabel;
      fragment.appendChild(groupHeader);

      Array.from(child.children).forEach((subChild) => {
        if (subChild.tagName === "OPTION") {
          fragment.appendChild(createOptionNode(subChild, optIndex++, listboxId, showFlags));
        }
      });
    } else if (child.tagName === "OPTION") {
      fragment.appendChild(createOptionNode(child, optIndex++, listboxId, showFlags));
    }
  });

  (optionList || customOptions).appendChild(fragment);
}

function updateTriggerContent(trigger, select, isLanguageSelect, showFlags) {
  trigger.setAttribute("tabindex", select.disabled ? "-1" : "0");
  trigger.classList.toggle("is-disabled", !!select.disabled);
  trigger.setAttribute("aria-disabled", select.disabled ? "true" : "false");

  const selectedOption = select.options[select.selectedIndex];
  if (!selectedOption) return;

  const flag = showFlags ? getFlagImg(selectedOption.value) : "";
  if (isLanguageSelect) {
    const shortLabel = ({ eng: "EN", rus: "RU", kaz: "KZ" }[String(selectedOption.value || "").toLowerCase()] || String(selectedOption.value || "").toUpperCase() || selectedOption.text);
    trigger.innerHTML = `<div class="custom-select-trigger-content custom-select-trigger-content--compact">${flag || ""}<span>${escapeHtml(shortLabel)}</span></div>`;
    return;
  }
  trigger.innerHTML = flag
    ? `<div class="custom-select-trigger-content">${flag} <span>${escapeHtml(selectedOption.text)}</span></div>`
    : `<span>${escapeHtml(selectedOption.text)}</span>`;
}

function findTypeaheadMatch(enabled, currentIdx, buffer) {
  const isSingleChar = buffer.length === 1;
  const isRepeatedChar = buffer.length > 1 && buffer.split("").every((c) => c === buffer[0]);

  const matchesQuery = (node, query) => {
    const text = (node.getAttribute("data-label") || node.textContent || "").trim().toLowerCase();
    const val = String(node.getAttribute("data-value") || "").trim().toLowerCase();
    return text.startsWith(query) || val.startsWith(query);
  };

  const currentOption = enabled[currentIdx];
  const currentOptionText = (currentOption?.getAttribute("data-label") || currentOption?.textContent || "").trim().toLowerCase();
  const currentOptionVal = String(currentOption?.getAttribute("data-value") || "").trim().toLowerCase();
  const isSameLetterAsCurrent = currentOptionText.startsWith(buffer[0]) || currentOptionVal.startsWith(buffer[0]);

  if (isRepeatedChar || (isSingleChar && isSameLetterAsCurrent)) {
    const searchChar = buffer[0];
    for (let i = currentIdx + 1; i < enabled.length; i++) {
      if (matchesQuery(enabled[i], searchChar)) return i;
    }
    for (let i = 0; i <= currentIdx; i++) {
      if (matchesQuery(enabled[i], searchChar)) return i;
    }
  } else {
    for (let i = 0; i < enabled.length; i++) {
      if (matchesQuery(enabled[i], buffer)) return i;
    }
  }
  return -1;
}

function bindSearchInputEvents(searchInput, customOptions, closeSelect, setHighlightedOption, getSelectedOption, selectOptionByNode) {
  if (!searchInput || searchInput.dataset.bound === "1") return;
  searchInput.dataset.bound = "1";
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    customOptions.querySelectorAll(".custom-option").forEach((option) => {
      const label = String(option.getAttribute("data-label") || "").toLocaleLowerCase();
      const value = String(option.getAttribute("data-value") || "").toLocaleLowerCase();
      option.hidden = Boolean(query) && !label.includes(query) && !value.includes(query);
    });
    setHighlightedOption(0, false);
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSelect(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedOption(event.key === "ArrowDown" ? 1 : -1, true, true);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = getSelectedOption();
      if (option) selectOptionByNode(option);
    }
  });
}

function bindTriggerKeyboardEvents({ select, wrapper, trigger, getEnabledOptions, openSelect, closeSelect, setHighlightedOption, selectOptionByNode, getHighlightedIndex }) {
  if (trigger.dataset.keyBound === "1") return;
  trigger.dataset.keyBound = "1";

  let typeaheadBuffer = "";
  let typeaheadTimeout = null;

  trigger.addEventListener("blur", () => {
    typeaheadBuffer = "";
    clearTimeout(typeaheadTimeout);
  });

  const handleTypeahead = (char, isOpen) => {
    const enabled = getEnabledOptions();
    if (!enabled.length) return;

    clearTimeout(typeaheadTimeout);
    typeaheadTimeout = setTimeout(() => { typeaheadBuffer = ""; }, 800);
    typeaheadBuffer += char.toLowerCase();

    const currentIdx = isOpen
      ? (getHighlightedIndex() >= 0 ? getHighlightedIndex() : 0)
      : Math.max(0, enabled.findIndex((opt) => String(opt.getAttribute("data-value") || "") === String(select.value || "")));

    const matchIdx = findTypeaheadMatch(enabled, currentIdx, typeaheadBuffer);
    if (matchIdx !== -1) {
      if (isOpen) setHighlightedOption(matchIdx, true);
      else selectOptionByNode(enabled[matchIdx]);
    }
  };

  trigger.addEventListener("keydown", (event) => {
    if (select.disabled) return;
    const isOpen = wrapper.classList.contains("open");

    switch (event.key) {
      case "Down":
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) openSelect();
        else setHighlightedOption(getHighlightedIndex() + 1);
        break;
      case "Up":
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) openSelect();
        else setHighlightedOption(getHighlightedIndex() - 1);
        break;
      case "Home":
        if (isOpen) {
          event.preventDefault();
          setHighlightedOption(0);
        }
        break;
      case "End":
        if (isOpen) {
          event.preventDefault();
          const enabled = getEnabledOptions();
          setHighlightedOption(enabled.length - 1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!isOpen) openSelect();
        else {
          const enabled = getEnabledOptions();
          const idx = getHighlightedIndex();
          if (idx >= 0 && idx < enabled.length) selectOptionByNode(enabled[idx]);
          else closeSelect(true);
        }
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          event.stopPropagation();
          closeSelect(true);
        }
        break;
      case "Tab":
        if (isOpen) closeSelect(false);
        break;
      default:
        if (
          event.key &&
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey
        ) {
          event.preventDefault();
          handleTypeahead(event.key, isOpen);
        }
        break;
    }
  });
}

function setupSelectStateController({ select, wrapper, trigger, customOptions, optionList, searchInput, listboxId, isLanguageSelect, showFlags }) {
  let highlightedIndex = -1;

  const getEnabledOptions = () => Array.from(customOptions.querySelectorAll(".custom-option:not(.is-disabled)")).filter((opt) => !opt.hidden);

  const setHighlightedOption = (index, scrollIntoView = true, relative = false) => {
    const enabled = getEnabledOptions();
    if (!enabled.length) return;
    let targetIndex = relative ? highlightedIndex + index : index;
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex >= enabled.length) targetIndex = enabled.length - 1;
    highlightedIndex = targetIndex;

    customOptions.querySelectorAll(".custom-option").forEach((node) => node.classList.remove("is-highlighted"));
    const target = enabled[highlightedIndex];
    if (target) {
      target.classList.add("is-highlighted");
      trigger.setAttribute("aria-activedescendant", target.id || "");
      if (scrollIntoView && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "nearest" });
      }
    }
  };

  const closeSelect = (restoreFocus = false) => {
    if (!wrapper.classList.contains("open")) return;
    wrapper.classList.remove("open");
    wrapper.classList.remove("open-up");
    trigger.setAttribute("aria-expanded", "false");
    customOptions.querySelectorAll(".custom-option").forEach((node) => node.classList.remove("is-highlighted"));
    if (searchInput) searchInput.value = "";
    highlightedIndex = -1;
    if (restoreFocus) {
      try { trigger.focus(); } catch (e) {}
    }
  };

  const openSelect = () => {
    if (select.disabled || wrapper.classList.contains("open")) return;
    document.querySelectorAll(".custom-select-wrapper.open").forEach((node) => {
      if (node !== wrapper) {
        node.classList.remove("open");
        node.classList.remove("open-up");
        const otherTrig = node.querySelector(".custom-select-trigger");
        if (otherTrig) otherTrig.setAttribute("aria-expanded", "false");
      }
    });

    if (shouldOpenUp(trigger, wrapper)) wrapper.classList.add("open-up");
    else wrapper.classList.remove("open-up");

    wrapper.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");

    if (searchInput) {
      searchInput.value = "";
      customOptions.querySelectorAll(".custom-option[hidden]").forEach((option) => { option.hidden = false; });
    }

    const enabled = getEnabledOptions();
    const curVal = String(select.value || "");
    const curIdx = enabled.findIndex((opt) => String(opt.getAttribute("data-value") || "") === curVal);
    setHighlightedOption(curIdx >= 0 ? curIdx : 0, true);
    if (searchInput) searchInput.focus();
  };

  const syncSelectedOptionState = () => {
    const currentValue = String(select.value || "");
    customOptions.querySelectorAll(".custom-option").forEach((node) => {
      const isSelected = String(node.getAttribute("data-value") || "") === currentValue;
      node.classList.toggle("selected", isSelected);
      node.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (isSelected && !wrapper.classList.contains("open")) {
        trigger.setAttribute("aria-activedescendant", node.id || "");
      }
    });
  };

  const syncFromNativeSelect = () => {
    const currentLabel = getSelectLabel(select);
    if (currentLabel) {
      trigger.setAttribute("aria-label", currentLabel);
      (optionList || customOptions).setAttribute("aria-label", currentLabel);
      if (searchInput) searchInput.setAttribute("aria-label", select.dataset.searchPlaceholder || currentLabel);
    }
    rebuildCustomOptions(select, customOptions, optionList, searchInput, listboxId, showFlags);
    updateTriggerContent(trigger, select, isLanguageSelect, showFlags);
    syncSelectedOptionState();
  };

  const selectOptionByNode = (option) => {
    if (!option || option.classList.contains("is-disabled")) return;
    const nextValue = String(option.getAttribute("data-value") || "");
    const changed = String(select.value || "") !== nextValue;
    select.value = nextValue;
    if (changed) select.dispatchEvent(new Event("change"));
    else syncFromNativeSelect();
    if (wrapper.classList.contains("open")) closeSelect(true);
  };

  return {
    getEnabledOptions,
    setHighlightedOption,
    openSelect,
    closeSelect,
    syncFromNativeSelect,
    selectOptionByNode,
    getHighlightedIndex: () => highlightedIndex,
    getCurrentHighlightedOption: () => getEnabledOptions()[highlightedIndex],
  };
}

function bindSelectObserverAndEvents(wrapper, select, syncFromNativeSelect) {
  if (!wrapper.__customSelectLanguageBound && typeof window !== "undefined") {
    wrapper.__customSelectLanguageBound = true;
    wrapper.__customSelectLanguageHandler = () => {
      window.requestAnimationFrame(syncFromNativeSelect);
    };
    window.addEventListener("languageChanged", wrapper.__customSelectLanguageHandler);
  }

  if (!wrapper.__customSelectObserver && typeof MutationObserver === "function") {
    const observer = new MutationObserver(syncFromNativeSelect);
    observer.observe(select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled", "label", "selected"],
    });
    wrapper.__customSelectObserver = observer;
  }

  return () => {
    if (wrapper.__customSelectLanguageHandler) {
      window.removeEventListener("languageChanged", wrapper.__customSelectLanguageHandler);
      wrapper.__customSelectLanguageHandler = null;
      wrapper.__customSelectLanguageBound = false;
    }
    wrapper.__customSelectObserver?.disconnect();
    wrapper.__customSelectObserver = null;
  };
}

export function initCustomSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  bindCustomSelectGlobalClick();

  const isLanguageSelect = selectId === "languageSelect";
  const showFlags = select.dataset.flags !== "off";
  const wrapper = ensureSelectWrapper(select);
  const elements = setupCustomSelectElements(select, wrapper, selectId, isLanguageSelect);
  const { trigger, customOptions, optionList, searchInput, listboxId } = elements;

  const selectLabel = getSelectLabel(select);
  if (searchInput) {
    searchInput.placeholder = select.dataset.searchPlaceholder || "";
    searchInput.setAttribute("aria-label", select.dataset.searchPlaceholder || selectLabel || "");
  }

  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", listboxId);
  trigger.setAttribute("tabindex", select.disabled ? "-1" : "0");
  if (selectLabel) {
    trigger.setAttribute("aria-label", selectLabel);
    (optionList || customOptions).setAttribute("aria-label", selectLabel);
  }

  const state = setupSelectStateController({ select, wrapper, trigger, customOptions, optionList, searchInput, listboxId, isLanguageSelect, showFlags });

  state.syncFromNativeSelect();

  bindSearchInputEvents(searchInput, customOptions, state.closeSelect, state.setHighlightedOption, state.getCurrentHighlightedOption, state.selectOptionByNode);

  if (customOptions.dataset.bound !== "1") {
    customOptions.dataset.bound = "1";
    customOptions.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const option = target.closest(".custom-option");
      if (!(option instanceof Element) || !customOptions.contains(option)) return;
      state.selectOptionByNode(option);
    });
  }

  if (wrapper.dataset.bound !== "1") {
    wrapper.dataset.bound = "1";
    trigger.addEventListener("click", (event) => {
      if (select.disabled) return;
      event.stopPropagation();
      if (wrapper.classList.contains("open")) state.closeSelect(false);
      else state.openSelect();
    });
    select.addEventListener("change", state.syncFromNativeSelect);
  }

  bindTriggerKeyboardEvents({
    select,
    wrapper,
    trigger,
    getEnabledOptions: state.getEnabledOptions,
    openSelect: state.openSelect,
    closeSelect: state.closeSelect,
    setHighlightedOption: state.setHighlightedOption,
    selectOptionByNode: state.selectOptionByNode,
    getHighlightedIndex: state.getHighlightedIndex,
  });

  return bindSelectObserverAndEvents(wrapper, select, state.syncFromNativeSelect);
}

export function setupSlidingIndicator(containerSelector, itemSelector, activeClass = "active") {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.classList.add("has-sliding-indicator");

  let indicator = container.querySelector(".sliding-indicator");
  if (!indicator) {
    indicator = document.createElement("span");
    indicator.className = "sliding-indicator";
    indicator.setAttribute("aria-hidden", "true");
    container.appendChild(indicator);
  }

  const state = { previewTarget: null };
  const activeSelector = `${itemSelector}.${activeClass}, ${itemSelector}.is-active`;
  const getActive = () => container.querySelector(activeSelector);
  const readExtraWidth = () => {
    const raw = getComputedStyle(container).getPropertyValue("--sliding-indicator-extra-width").trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const positionTo = (target) => {
    if (!target || container.offsetWidth === 0) {
      indicator.style.opacity = "0";
      return;
    }
    const left = target.offsetLeft;
    const width = Math.max(1, target.offsetWidth + readExtraWidth());
    const isReady = indicator.dataset.ready === "1";
    if (!isReady) indicator.style.transition = "none";
    indicator.style.opacity = "1";
    indicator.style.width = `${width}px`;
    indicator.style.transform = `translate3d(${left}px, 0, 0)`;
    if (!isReady) {
      indicator.dataset.ready = "1";
      void indicator.offsetWidth;
      requestAnimationFrame(() => {
        indicator.style.transition = "";
      });
    }
  };

  const update = (target = null) => {
    positionTo(target || state.previewTarget || getActive());
  };

  const bindItems = () => {
    container.querySelectorAll(itemSelector).forEach((item) => {
      if (item.dataset?.slidingIndicatorBound === "1") return;
      if (item.dataset) item.dataset.slidingIndicatorBound = "1";
      item.addEventListener("pointerenter", () => {
        state.previewTarget = item;
        update(item);
      });
      item.addEventListener("pointerleave", () => {
        if (state.previewTarget === item) state.previewTarget = null;
        update();
      });
      item.addEventListener("focusin", () => {
        state.previewTarget = item;
        update(item);
      });
      item.addEventListener("focusout", () => {
        if (state.previewTarget === item) state.previewTarget = null;
        window.setTimeout(() => update(), 0);
      });
    });
  };

  const refresh = () => {
    bindItems();
    update();
  };

  bindItems();
  const observer = new MutationObserver(refresh);
  observer.observe(container, { attributes: true, childList: true, subtree: true, attributeFilter: ["class"] });
  window.addEventListener("resize", update, { passive: true });
  window.addEventListener("load", refresh, { passive: true });
  window.setTimeout(refresh, 50);
  return update;
}
