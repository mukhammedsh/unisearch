// Small Web Animations helpers for catalog motion (stage 2 of
// docs/superpowers/specs/2026-11-25-motion-system-design.md). Height reveals are used for existing
// multi-child elements that are toggled from JS, where a CSS grid 0fr/1fr wrapper would mean new markup.
import { prefersReducedMotion } from "./runtime.js";

// Mirrors --motion-fast / --motion-snappy and the enter/exit easing tokens in 06-motion-accessibility.css.
const REVEAL_ENTER_MS = 160;
const REVEAL_EXIT_MS = 120;
const FADE_MS = 120;
const EASE_ENTER = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_EXIT = "cubic-bezier(0.4, 0, 1, 1)";
const EASE_STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
const REVEALING_CLASS = "motion-revealing";

/** @type {WeakMap<HTMLElement, { animation: Animation, visible: boolean }>} */
const runningReveals = new WeakMap();
/** @type {WeakMap<HTMLElement, Animation>} */
const runningFades = new WeakMap();

/**
 * @param {HTMLElement} node
 * @returns {boolean}
 */
function canAnimate(node) {
  return typeof node?.animate === "function" && !prefersReducedMotion();
}

/**
 * Swallows the rejection a cancelled animation produces; anything else is a real error.
 * @param {unknown} error
 */
function ignoreCancel(error) {
  if (error?.name !== "AbortError") throw error;
}

/**
 * @typedef {{ mode?: "hidden" | "display", display?: string, instant?: boolean }} RevealOptions
 */

/**
 * @param {HTMLElement} node
 * @param {RevealOptions} options
 * @returns {boolean}
 */
function isShown(node, options) {
  if (options.mode !== "display") return !node.hidden;
  // Stylesheets may hide the element before any inline display is set (e.g. `.u-field--state`).
  const computed = typeof window.getComputedStyle === "function" && node instanceof window.HTMLElement
    ? window.getComputedStyle(node).display
    : node.style.display;
  return computed !== "none";
}

/**
 * @param {HTMLElement} node
 * @param {boolean} visible
 * @param {RevealOptions} options
 */
function applyVisibility(node, visible, options) {
  if (options.mode === "display") node.style.display = visible ? (options.display ?? "") : "none";
  else node.hidden = !visible;
}

/**
 * Shows or hides an element, growing or shrinking its height. Hidden content is `inert` while it
 * collapses; a later call interrupts a running one and continues from the current height.
 * @param {HTMLElement} node
 * @param {boolean} visible
 * @param {RevealOptions} [options]
 */
export function setRevealed(node, visible, options = {}) {
  if (!node) return;
  const running = runningReveals.get(node);
  if (running ? running.visible === visible : isShown(node, options) === visible) return;

  const startHeight = node.getBoundingClientRect().height;
  if (running) {
    runningReveals.delete(node);
    running.animation.cancel();
  }

  if (options.instant || !canAnimate(node)) {
    node.classList.remove(REVEALING_CLASS);
    node.inert = false;
    applyVisibility(node, visible, options);
    return;
  }

  let keyframes;
  if (visible) {
    applyVisibility(node, true, options);
    node.inert = false;
    const targetHeight = node.scrollHeight;
    const startOpacity = targetHeight > 0 ? Math.min(1, startHeight / targetHeight) : 0;
    keyframes = [
      { height: `${startHeight}px`, opacity: startOpacity },
      { height: `${targetHeight}px`, opacity: 1 },
    ];
  } else {
    node.inert = true;
    keyframes = [
      { height: `${startHeight}px`, opacity: 1 },
      { height: "0px", opacity: 0 },
    ];
  }

  node.classList.add(REVEALING_CLASS);
  const animation = node.animate(keyframes, {
    duration: visible ? REVEAL_ENTER_MS : REVEAL_EXIT_MS,
    easing: visible ? EASE_ENTER : EASE_EXIT,
  });
  runningReveals.set(node, { animation, visible });
  animation.finished.then(() => {
    if (runningReveals.get(node)?.animation !== animation) return;
    runningReveals.delete(node);
    node.classList.remove(REVEALING_CLASS);
    if (!visible) {
      applyVisibility(node, false, options);
      node.inert = false;
    }
  }).catch(ignoreCancel);
}

/**
 * Fades an element in without moving it (used when a view becomes visible).
 * @param {HTMLElement} node
 * @param {{ instant?: boolean }} [options]
 */
export function fadeIn(node, options = {}) {
  if (!node) return;
  runningFades.get(node)?.cancel();
  runningFades.delete(node);
  if (options.instant || !canAnimate(node)) return;
  const animation = node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: EASE_STANDARD });
  runningFades.set(node, animation);
  animation.finished.then(() => {
    if (runningFades.get(node) === animation) runningFades.delete(node);
  }).catch(ignoreCancel);
}

/**
 * Updates a short text (such as a count) and lets it settle with a quiet fade when it changed.
 * @param {HTMLElement} node
 * @param {string} text
 */
export function setTextWithFade(node, text) {
  if (!node) return;
  const next = String(text);
  if (node.textContent === next) return;
  node.textContent = next;
  if (!canAnimate(node)) return;
  node.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: FADE_MS, easing: EASE_STANDARD })
    .finished.catch(ignoreCancel);
}
