// Small Web Animations helpers for catalog motion (stage 2 of
// docs/superpowers/specs/2026-11-25-motion-system-design.md). Height reveals are used for existing
// multi-child elements that are toggled from JS, where a CSS grid 0fr/1fr wrapper would mean new markup.
import { markMotionEnter, prefersReducedMotion } from "./runtime.js";

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
 * @typedef {{ mode?: "hidden" | "display", display?: string, instant?: boolean, retarget?: boolean, onHidden?: () => void }} RevealOptions
 * `retarget` restarts a running reveal toward the element's current full size (its content changed).
 * `onHidden` runs once a hide has completed (at once on the instant path), never after an interrupted hide.
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

const SPACING_KEYS = ["paddingTop", "paddingBottom", "marginTop", "marginBottom"];

/**
 * Border-box height plus the vertical spacing that must travel with it, so nothing snaps at the ends.
 * @param {HTMLElement} node
 * @returns {Record<string, string>}
 */
function measureBox(node) {
  const box = { height: `${node.getBoundingClientRect().height}px` };
  const computed = typeof window.getComputedStyle === "function" && node instanceof window.HTMLElement
    ? window.getComputedStyle(node)
    : null;
  SPACING_KEYS.forEach((key) => { box[key] = computed ? computed[key] : "0px"; });
  return box;
}

/** @returns {Record<string, string>} */
function collapsedBox() {
  return Object.fromEntries(["height", ...SPACING_KEYS].map((key) => [key, "0px"]));
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
  const sameTarget = running ? running.visible === visible && !(options.retarget && visible) : isShown(node, options) === visible;
  if (sameTarget) return;

  const startBox = isShown(node, options) ? measureBox(node) : collapsedBox();
  if (running) {
    runningReveals.delete(node);
    running.animation.cancel();
  }

  if (options.instant || !canAnimate(node)) {
    node.classList.remove(REVEALING_CLASS);
    node.inert = false;
    applyVisibility(node, visible, options);
    if (!visible) options.onHidden?.();
    return;
  }

  let keyframes;
  if (visible) {
    applyVisibility(node, true, options);
    node.inert = false;
    node.classList.remove(REVEALING_CLASS);
    const targetBox = measureBox(node);
    const targetHeight = Number.parseFloat(targetBox.height);
    const startOpacity = targetHeight > 0 ? Math.min(1, Number.parseFloat(startBox.height) / targetHeight) : 0;
    keyframes = [{ ...startBox, opacity: startOpacity }, { ...targetBox, opacity: 1 }];
  } else {
    node.inert = true;
    keyframes = [{ ...startBox, opacity: 1 }, { ...collapsedBox(), opacity: 0 }];
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
      options.onHidden?.();
    }
  }).catch(ignoreCancel);
}

/**
 * Keys of the rows a list rendered last time, or null before its first render.
 * @param {HTMLElement} list
 * @returns {Set<string> | null}
 */
export function readRowKeys(list) {
  if (!list || list.dataset.rowsRendered !== "1") return null;
  return new Set(Array.from(list.querySelectorAll("[data-row-key]"), (row) => row.dataset.rowKey));
}

/**
 * After a list re-render, lets only rows whose `data-row-key` is new enter; the first render is still.
 * @param {HTMLElement} list
 * @param {string} rowSelector
 * @param {Set<string> | null} previousKeys result of `readRowKeys` taken before the re-render
 */
export function enterNewRows(list, rowSelector, previousKeys) {
  if (!list) return;
  list.dataset.rowsRendered = "1";
  if (!previousKeys) return;
  const fresh = Array.from(list.querySelectorAll(rowSelector))
    .map((row) => row.dataset.rowKey)
    .filter((key) => key && !previousKeys.has(key));
  if (!fresh.length) return;
  const selector = fresh.map((key) => `${rowSelector}[data-row-key="${CSS.escape(key)}"]`).join(", ");
  markMotionEnter(list, selector, { limit: fresh.length });
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
 * @param {{ instant?: boolean }} [options]
 */
export function setTextWithFade(node, text, options = {}) {
  if (!node) return;
  const next = String(text);
  if (node.textContent === next) return;
  node.textContent = next;
  if (options.instant || !canAnimate(node)) return;
  node.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: FADE_MS, easing: EASE_STANDARD })
    .finished.catch(ignoreCancel);
}
