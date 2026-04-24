import { escapeHtml, getFlagImg } from "./format.js";

let customSelectGlobalClickBound = false;

function bindCustomSelectGlobalClick() {
  if (customSelectGlobalClickBound || typeof document === "undefined") return;
  customSelectGlobalClickBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    document.querySelectorAll(".custom-select-wrapper.open").forEach((wrapper) => {
      if (!wrapper.contains(target)) wrapper.classList.remove("open");
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

  const syncSelectedOptionState = () => {
    const currentValue = String(select.value || "");
    customOptions.querySelectorAll(".custom-option").forEach((node) => {
      node.classList.toggle("selected", String(node.getAttribute("data-value") || "") === currentValue);
    });
  };

  const rebuildCustomOptions = () => {
    customOptions.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (const option of select.options) {
      const node = document.createElement("div");
      node.classList.add("custom-option");
      node.setAttribute("data-value", String(option.value || ""));
      if (option.disabled) node.classList.add("is-disabled");
      const flag = showFlags ? getFlagImg(option.value) : "";
      node.innerHTML = flag ? `${flag} <span>${escapeHtml(option.text)}</span>` : escapeHtml(option.text);
      if (option.selected) node.classList.add("selected");
      fragment.appendChild(node);
    }
    customOptions.appendChild(fragment);
  };

  function updateTrigger() {
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
      if (!(option instanceof Element) || !customOptions.contains(option) || option.classList.contains("is-disabled")) return;
      const nextValue = String(option.getAttribute("data-value") || "");
      const changed = String(select.value || "") !== nextValue;
      select.value = nextValue;
      if (changed) select.dispatchEvent(new Event("change"));
      else syncFromNativeSelect();
      wrapper.classList.remove("open");
    });
  }

  if (wrapper.dataset.bound !== "1") {
    wrapper.dataset.bound = "1";
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll(".custom-select-wrapper.open").forEach((node) => {
        if (node !== wrapper) node.classList.remove("open");
      });
      wrapper.classList.toggle("open");
    });
    select.addEventListener("change", syncFromNativeSelect);
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
