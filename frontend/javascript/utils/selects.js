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
        const trigger = wrapper.querySelector(".custom-select-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        wrapper.querySelectorAll(".custom-option.is-highlighted").forEach((node) => node.classList.remove("is-highlighted"));
      }
    });
  });
}

export function initCustomSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  bindCustomSelectGlobalClick();

  const isLanguageSelect = selectId === "languageSelect";
  const showFlags = select.dataset.flags !== "off";
  let wrapper = select.parentNode;
  const alreadyWrapped = wrapper && wrapper.classList.contains("custom-select-wrapper");

  if (!alreadyWrapped) {
    wrapper = document.createElement("div");
    wrapper.classList.add("custom-select-wrapper");
    select.parentNode.insertBefore(wrapper, select.nextSibling);
    wrapper.appendChild(select);
    select.classList.add("u-select-hidden");
  } else {
    select.classList.add("u-select-hidden");
  }

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

  const listboxId = customOptions.id || `custom-options-${selectId}`;
  customOptions.id = listboxId;
  customOptions.setAttribute("role", "listbox");

  const selectLabel = select.getAttribute("aria-label") || select.getAttribute("title") || select.name || "";
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", listboxId);
  trigger.setAttribute("tabindex", select.disabled ? "-1" : "0");
  if (selectLabel) {
    trigger.setAttribute("aria-label", selectLabel);
    customOptions.setAttribute("aria-label", selectLabel);
  }

  let highlightedIndex = -1;

  const getEnabledOptions = () => {
    return Array.from(customOptions.querySelectorAll(".custom-option:not(.is-disabled)"));
  };

  const setHighlightedOption = (index, scrollIntoView = true) => {
    const enabled = getEnabledOptions();
    if (!enabled.length) return;
    if (index < 0) index = 0;
    if (index >= enabled.length) index = enabled.length - 1;
    highlightedIndex = index;

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

  const openSelect = () => {
    if (select.disabled || wrapper.classList.contains("open")) return;
    document.querySelectorAll(".custom-select-wrapper.open").forEach((node) => {
      if (node !== wrapper) {
        node.classList.remove("open");
        const otherTrig = node.querySelector(".custom-select-trigger");
        if (otherTrig) otherTrig.setAttribute("aria-expanded", "false");
      }
    });
    wrapper.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");

    const enabled = getEnabledOptions();
    const curVal = String(select.value || "");
    const curIdx = enabled.findIndex((opt) => String(opt.getAttribute("data-value") || "") === curVal);
    setHighlightedOption(curIdx >= 0 ? curIdx : 0, true);
  };

  const closeSelect = (restoreFocus = false) => {
    if (!wrapper.classList.contains("open")) return;
    wrapper.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    customOptions.querySelectorAll(".custom-option").forEach((node) => node.classList.remove("is-highlighted"));
    highlightedIndex = -1;
    if (restoreFocus) {
      try { trigger.focus(); } catch (e) {}
    }
  };

  const selectOptionByNode = (option) => {
    if (!option || option.classList.contains("is-disabled")) return;
    const nextValue = String(option.getAttribute("data-value") || "");
    const changed = String(select.value || "") !== nextValue;
    select.value = nextValue;
    if (changed) select.dispatchEvent(new Event("change"));
    else syncFromNativeSelect();
    closeSelect(true);
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

  const rebuildCustomOptions = () => {
    customOptions.innerHTML = "";
    const fragment = document.createDocumentFragment();
    Array.from(select.options).forEach((option, idx) => {
      const node = document.createElement("div");
      node.classList.add("custom-option");
      node.id = `${listboxId}-opt-${idx}`;
      node.setAttribute("role", "option");
      node.setAttribute("data-value", String(option.value || ""));
      node.setAttribute("aria-selected", option.selected ? "true" : "false");
      if (option.disabled) {
        node.classList.add("is-disabled");
        node.setAttribute("aria-disabled", "true");
      }
      const flag = showFlags ? getFlagImg(option.value) : "";
      node.innerHTML = flag ? `${flag} <span>${escapeHtml(option.text)}</span>` : escapeHtml(option.text);
      if (option.selected) node.classList.add("selected");
      fragment.appendChild(node);
    });
    customOptions.appendChild(fragment);
  };

  function updateTrigger() {
    trigger.setAttribute("tabindex", select.disabled ? "-1" : "0");
    trigger.classList.toggle("is-disabled", !!select.disabled);
    trigger.setAttribute("aria-disabled", select.disabled ? "true" : "false");

    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption) return;
    const flag = showFlags ? getFlagImg(selectedOption.value) : "";
    if (isLanguageSelect) {
      const shortLabel = ({ eng: "EN", rus: "RU" }[String(selectedOption.value || "").toLowerCase()] || String(selectedOption.value || "").toUpperCase() || selectedOption.text);
      trigger.innerHTML = `<div class="custom-select-trigger-content custom-select-trigger-content--compact">${flag || ""}<span>${escapeHtml(shortLabel)}</span></div>`;
      return;
    }
    trigger.innerHTML = flag
      ? `<div class="custom-select-trigger-content">${flag} <span>${escapeHtml(selectedOption.text)}</span></div>`
      : `<span>${escapeHtml(selectedOption.text)}</span>`;
  }

  const syncFromNativeSelect = () => {
    rebuildCustomOptions();
    updateTrigger();
    syncSelectedOptionState();
  };

  syncFromNativeSelect();

  if (customOptions.dataset.bound !== "1") {
    customOptions.dataset.bound = "1";
    customOptions.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const option = target.closest(".custom-option");
      if (!(option instanceof Element) || !customOptions.contains(option)) return;
      selectOptionByNode(option);
    });
  }

  if (wrapper.dataset.bound !== "1") {
    wrapper.dataset.bound = "1";
    trigger.addEventListener("click", (event) => {
      if (select.disabled) return;
      event.stopPropagation();
      if (wrapper.classList.contains("open")) {
        closeSelect(false);
      } else {
        openSelect();
      }
    });
    select.addEventListener("change", syncFromNativeSelect);
  }

  if (trigger.dataset.keyBound !== "1") {
    trigger.dataset.keyBound = "1";
    trigger.addEventListener("keydown", (event) => {
      if (select.disabled) return;
      const isOpen = wrapper.classList.contains("open");

      switch (event.key) {
        case "Down":
        case "ArrowDown":
          event.preventDefault();
          if (!isOpen) {
            openSelect();
          } else {
            setHighlightedOption(highlightedIndex + 1);
          }
          break;
        case "Up":
        case "ArrowUp":
          event.preventDefault();
          if (!isOpen) {
            openSelect();
          } else {
            setHighlightedOption(highlightedIndex - 1);
          }
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
          if (!isOpen) {
            openSelect();
          } else {
            const enabled = getEnabledOptions();
            if (highlightedIndex >= 0 && highlightedIndex < enabled.length) {
              selectOptionByNode(enabled[highlightedIndex]);
            } else {
              closeSelect(true);
            }
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
          if (isOpen) {
            closeSelect(false);
          }
          break;
      }
    });
  }

  if (!wrapper.__customSelectLanguageBound && typeof window !== "undefined") {
    wrapper.__customSelectLanguageBound = true;
    window.addEventListener("languageChanged", () => {
      window.requestAnimationFrame(syncFromNativeSelect);
    });
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

  syncFromNativeSelect();
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
    return Number.isFinite(parsed) ? parsed : 8;
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
