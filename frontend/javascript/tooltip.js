const __boundTooltipKeys = new Set();

export const DEFAULT_TOOLTIP_WRAP_SELECTOR = ".ui-tooltip-wrap, .u-info-wrap, .uni-status-tooltip, .d-info-wrap, .profile-info-wrap, .uni-metric-tooltip";
export const DEFAULT_TOOLTIP_BUTTON_SELECTOR = ".ui-tooltip-trigger, .u-info, .uni-status-trigger, .d-info, .profile-info, .uni-metric-trigger";
export const DEFAULT_TOOLTIP_BUBBLE_SELECTOR = ".ui-tooltip-bubble, .u-tooltip, .profile-tooltip, .d-tooltip, .uni-status-tooltip__content";

/**
 * Compute horizontal pixel translation needed to keep a tooltip bubble inside the viewport.
 *
 * @param {{ left?: number, right?: number, width?: number } | null | undefined} rect
 * @param {number} viewportWidth
 * @param {number} [gutter=12]
 * @returns {number}
 */
export function computeViewportHorizontalShift(rect, viewportWidth, gutter = 12) {
  if (!rect || !Number.isFinite(viewportWidth) || viewportWidth <= 0) return 0;
  const left = Number(rect.left);
  const right = Number(rect.right);
  const width = Number.isFinite(Number(rect.width)) ? Number(rect.width) : right - left;
  if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(width) || width <= 0) {
    return 0;
  }
  const safeGutter = Number.isFinite(gutter) && gutter >= 0 ? gutter : 0;
  const maxRight = Math.max(safeGutter, viewportWidth - safeGutter);
  let shift = 0;
  if (right > maxRight) {
    shift = maxRight - right;
  }
  if (left + shift < safeGutter) {
    shift = safeGutter - left;
  }
  return Math.round(shift * 100) / 100 || 0;
}

/**
 * Find the direct tooltip bubble child belonging to a tooltip wrapper element.
 *
 * @param {Element | null | undefined} wrap
 * @param {string} [bubbleSelector=DEFAULT_TOOLTIP_BUBBLE_SELECTOR]
 * @returns {HTMLElement | null}
 */
export function findTooltipBubble(wrap, bubbleSelector = DEFAULT_TOOLTIP_BUBBLE_SELECTOR) {
  if (!(wrap instanceof Element)) return null;
  for (const child of wrap.children) {
    if (child.matches(bubbleSelector) && child instanceof HTMLElement) {
      return child;
    }
  }
  return null;
}

/**
 * Clear runtime horizontal shift clamping on a tooltip wrapper's bubble.
 *
 * @param {Element | null | undefined} wrap
 * @param {string} [bubbleSelector=DEFAULT_TOOLTIP_BUBBLE_SELECTOR]
 * @returns {void}
 */
export function resetTooltipShift(wrap, bubbleSelector = DEFAULT_TOOLTIP_BUBBLE_SELECTOR) {
  const bubble = findTooltipBubble(wrap, bubbleSelector);
  if (bubble) {
    bubble.style.removeProperty("--tooltip-shift-x");
  }
}

/**
 * Measure an opened or hovered tooltip bubble and shift it horizontally if it overflows the viewport.
 *
 * @param {Element | null | undefined} wrap
 * @param {string} [bubbleSelector=DEFAULT_TOOLTIP_BUBBLE_SELECTOR]
 * @returns {number}
 */
export function clampTooltipToViewport(wrap, bubbleSelector = DEFAULT_TOOLTIP_BUBBLE_SELECTOR) {
  const bubble = findTooltipBubble(wrap, bubbleSelector);
  if (!bubble || typeof window === "undefined") return 0;
  const viewportWidth = document.documentElement?.clientWidth || window.innerWidth || 0;
  bubble.style.removeProperty("--tooltip-shift-x");
  const rect = bubble.getBoundingClientRect();
  const shift = computeViewportHorizontalShift(rect, viewportWidth);
  if (shift !== 0) {
    bubble.style.setProperty("--tooltip-shift-x", `${shift}px`);
  }
  return shift;
}

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
  const bubbleSelector = String(options.bubbleSelector || DEFAULT_TOOLTIP_BUBBLE_SELECTOR).trim() || DEFAULT_TOOLTIP_BUBBLE_SELECTOR;
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
      resetTooltipShift(wrap, bubbleSelector);
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
        clampTooltipToViewport(wrap, bubbleSelector);
      } else {
        wrap.classList.remove(openClass);
        wrap.classList.add(closedClass);
        resetTooltipShift(wrap, bubbleSelector);
        btn.setAttribute("aria-expanded", "false");
        try { btn.blur(); } catch {}
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
      if (!wrap.classList.contains(openClass)) {
        resetTooltipShift(wrap, bubbleSelector);
      }
    }
  };

  root.addEventListener("pointerover", (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    const wrap = target.closest(wrapSelector);
    if (!wrap || wrap.classList.contains(closedClass)) return;
    clampTooltipToViewport(wrap, bubbleSelector);
  });

  root.addEventListener("pointerout", clearClosed);

  root.addEventListener("focusin", (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    const wrap = target.closest(wrapSelector);
    if (!wrap || wrap.classList.contains(closedClass)) return;
    clampTooltipToViewport(wrap, bubbleSelector);
  });

  root.addEventListener("focusout", (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    const wrap = target.closest(wrapSelector);
    if (!wrap) return;
    const related = evt.relatedTarget;
    if (!related || !(related instanceof Node) || !wrap.contains(related)) {
      if (!wrap.classList.contains(openClass)) {
        resetTooltipShift(wrap, bubbleSelector);
      }
    }
  });

  root.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") {
      const openWraps = root.querySelectorAll(openWrapsSelector);
      if (!openWraps.length) return;
      const lastOpen = openWraps[openWraps.length - 1];
      const btn = lastOpen.querySelector(buttonSelector);
      closeAll();
      lastOpen.classList.add(closedClass);
      if (btn) {
        try { btn.focus(); } catch {}
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
      clampTooltipToViewport(wrap, bubbleSelector);
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


