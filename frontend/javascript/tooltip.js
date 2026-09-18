const __boundTooltipKeys = new Set();

export const DEFAULT_TOOLTIP_WRAP_SELECTOR = ".ui-tooltip-wrap, .u-info-wrap, .uni-status-tooltip, .d-info-wrap, .profile-info-wrap, .uni-metric-tooltip";
export const DEFAULT_TOOLTIP_BUTTON_SELECTOR = ".ui-tooltip-trigger, .u-info, .uni-status-trigger, .d-info, .profile-info, .uni-metric-trigger";

function buildStateSelector(selectorList, stateClass) {
  return selectorList
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s}.${stateClass}`)
    .join(", ");
}

export function bindInfoTooltips(options = {}) {
  if (typeof document === "undefined") return;

  const root = options.root && typeof options.root.querySelectorAll === "function"
    ? options.root
    : document;
  const wrapSelector = String(options.wrapSelector || DEFAULT_TOOLTIP_WRAP_SELECTOR).trim() || DEFAULT_TOOLTIP_WRAP_SELECTOR;
  const buttonSelector = String(options.buttonSelector || DEFAULT_TOOLTIP_BUTTON_SELECTOR).trim() || DEFAULT_TOOLTIP_BUTTON_SELECTOR;
  const openClass = String(options.openClass || "is-open").trim() || "is-open";
  const closedClass = String(options.closedClass || "is-closed").trim() || "is-closed";
  const holdDelayMs = Number.isFinite(Number(options.holdDelayMs)) ? Number(options.holdDelayMs) : 420;
  const key = `${wrapSelector}::${buttonSelector}::${openClass}::${closedClass}`;
  if (__boundTooltipKeys.has(key)) return;
  __boundTooltipKeys.add(key);

  const holdTimers = new WeakMap();
  const openWrapsSelector = buildStateSelector(wrapSelector, openClass);
  const closedWrapsSelector = buildStateSelector(wrapSelector, closedClass);
  const allStateWrapsSelector = `${openWrapsSelector}, ${closedWrapsSelector}`;

  const closeAll = () => {
    root.querySelectorAll(allStateWrapsSelector).forEach((wrap) => {
      wrap.classList.remove(openClass);
      wrap.classList.remove(closedClass);
      const btn = wrap.querySelector(buttonSelector);
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  root.addEventListener("click", (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;

    const btn = target.closest(buttonSelector);
    if (btn) {
      const wrap = btn.closest(wrapSelector);
      if (!wrap) return;
      evt.preventDefault();
      evt.stopPropagation();
      if (typeof evt.stopImmediatePropagation === "function") {
        evt.stopImmediatePropagation();
      }
      const willOpen = !wrap.classList.contains(openClass);
      closeAll();
      if (willOpen) {
        wrap.classList.remove(closedClass);
        wrap.classList.add(openClass);
        btn.setAttribute("aria-expanded", "true");
      } else {
        wrap.classList.remove(openClass);
        wrap.classList.add(closedClass);
        btn.setAttribute("aria-expanded", "false");
        try { btn.blur(); } catch (e) {}
      }
      return;
    }

    if (!target.closest(wrapSelector) && !target.closest(DEFAULT_TOOLTIP_WRAP_SELECTOR) && !target.closest(DEFAULT_TOOLTIP_BUTTON_SELECTOR)) {
      closeAll();
    }
  });

  const clearClosed = (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    const wrap = target.closest(wrapSelector);
    if (!wrap) return;
    const related = evt.relatedTarget;
    if (!related || !(related instanceof Node) || !wrap.contains(related)) {
      wrap.classList.remove(closedClass);
    }
  };

  root.addEventListener("pointerout", clearClosed);

  root.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") {
      const openWraps = root.querySelectorAll(openWrapsSelector);
      if (!openWraps.length) return;
      const lastOpen = openWraps[openWraps.length - 1];
      const btn = lastOpen.querySelector(buttonSelector);
      closeAll();
      if (btn) {
        try { btn.focus(); } catch (e) {}
      }
    }
  });

  root.addEventListener("touchstart", (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest(buttonSelector);
    if (!btn) return;
    const wrap = btn.closest(wrapSelector);
    if (!wrap) return;
    const timer = window.setTimeout(() => {
      closeAll();
      wrap.classList.remove(closedClass);
      wrap.classList.add(openClass);
      btn.setAttribute("aria-expanded", "true");
      holdTimers.delete(btn);
    }, holdDelayMs);
    holdTimers.set(btn, timer);
  }, { passive: true });

  const clearHold = (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest(buttonSelector);
    if (!btn) return;
    const timer = holdTimers.get(btn);
    if (!timer) return;
    window.clearTimeout(timer);
    holdTimers.delete(btn);
  };

  root.addEventListener("touchend", clearHold, { passive: true });
  root.addEventListener("touchcancel", clearHold, { passive: true });
}

export function initGlobalTooltips(root = document) {
  bindInfoTooltips({
    root,
    wrapSelector: DEFAULT_TOOLTIP_WRAP_SELECTOR,
    buttonSelector: DEFAULT_TOOLTIP_BUTTON_SELECTOR,
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initGlobalTooltips(document), { once: true });
  } else {
    initGlobalTooltips(document);
  }
}


