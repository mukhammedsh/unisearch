const __boundTooltipKeys = new Set();

export function bindInfoTooltips(options = {}) {
  if (typeof document === "undefined") return;

  const root = options.root && typeof options.root.querySelectorAll === "function"
    ? options.root
    : document;
  const wrapSelector = String(options.wrapSelector || ".u-info-wrap").trim() || ".u-info-wrap";
  const buttonSelector = String(options.buttonSelector || ".u-info").trim() || ".u-info";
  const openClass = String(options.openClass || "is-open").trim() || "is-open";
  const holdDelayMs = Number.isFinite(Number(options.holdDelayMs)) ? Number(options.holdDelayMs) : 420;
  const key = `${wrapSelector}::${buttonSelector}::${openClass}`;
  if (__boundTooltipKeys.has(key)) return;
  __boundTooltipKeys.add(key);

  const holdTimers = new WeakMap();
  const closeAll = () => {
    root.querySelectorAll(`${wrapSelector}.${openClass}`).forEach((wrap) => {
      wrap.classList.remove(openClass);
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
      const willOpen = !wrap.classList.contains(openClass);
      closeAll();
      if (willOpen) wrap.classList.add(openClass);
      return;
    }

    if (!target.closest(wrapSelector)) {
      closeAll();
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
      wrap.classList.add(openClass);
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
