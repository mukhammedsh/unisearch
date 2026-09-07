const inferredApiBase = `${window.location?.protocol || "http:"}//${window.location?.hostname || "127.0.0.1"}:8000`;

export const API_BASE = window.API_BASE_URL || inferredApiBase;
export const AI_DEFAULTS = { fit: "UniFit", chance: "UniChance" };
export const AI_FUNCTIONS = { ...AI_DEFAULTS, ...(window.AI_FUNCTIONS || {}) };
export const $ = (id) => document.getElementById(id);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const GLOBAL_LOADING_OVERLAY_ID = "globalLoadingOverlay";
const GLOBAL_LOADING_SHOW_DELAY_MS = 120;
const GLOBAL_LOADING_MIN_VISIBLE_MS = 220;

let globalLoaderInstalled = false;
let globalPendingCount = 0;
let globalShowTimer = 0;
let globalHideTimer = 0;
let globalVisible = false;
let globalVisibleAt = 0;

export function aiName(key) {
  const normalized = String(key || "").trim().toLowerCase();
  return AI_FUNCTIONS[normalized] || AI_DEFAULTS[normalized] || "AI Function";
}

export function frontendStaticAsset(path = "") {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const currentPath = String(window.location.pathname || "");
  const frontendPrefix = currentPath === "/frontend" || currentPath.startsWith("/frontend/")
    ? "/frontend"
    : "";
  return `${frontendPrefix}/${cleanPath}`.replace(/\/{2,}/g, "/");
}

export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function replayMotion(node, className, options = {}) {
  if (!node || !className || prefersReducedMotion()) return;
  const timeoutMs = Number(options.timeoutMs || 560);
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  const cleanup = () => node.classList.remove(className);
  node.addEventListener("animationend", cleanup, { once: true });
  window.setTimeout(cleanup, timeoutMs);
}

export function motionPress(node) {
  replayMotion(node, "motion-press-pop", { timeoutMs: 260 });
}

export function markMotionEnter(root, selector = "", options = {}) {
  if (!root || prefersReducedMotion()) return;
  const className = String(options.className || "motion-list-item-enter");
  const staggerMs = Math.max(0, Number(options.staggerMs || 22));
  const limit = Math.max(0, Number(options.limit || 16));
  const nodes = selector ? Array.from(root.querySelectorAll(selector)) : [root];

  nodes.slice(0, limit || nodes.length).forEach((node, index) => {
    if (!(node instanceof HTMLElement)) return;
    node.classList.remove(className);
    node.style.animationDelay = `${Math.min(index * staggerMs, 180)}ms`;
    void node.offsetWidth;
    node.classList.add(className);
    const cleanup = () => {
      node.classList.remove(className);
      node.style.animationDelay = "";
    };
    node.addEventListener("animationend", cleanup, { once: true });
    window.setTimeout(cleanup, 760);
  });
}

export function animateElementOut(node, callback, options = {}) {
  if (!node || prefersReducedMotion()) {
    if (typeof callback === "function") callback();
    return;
  }

  const className = String(options.className || "motion-row-exit");
  const timeoutMs = Number(options.timeoutMs || 260);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    node.classList.remove(className);
    if (typeof callback === "function") callback();
  };
  node.classList.add(className);
  node.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, timeoutMs);
}

export function closeMotionLayer(node, finish, options = {}) {
  if (!node) {
    if (typeof finish === "function") finish();
    return;
  }

  const className = String(options.className || "is-closing");
  const timeoutMs = Number(options.timeoutMs || 180);
  const shouldAnimate = !prefersReducedMotion() && node.classList.contains("is-open");

  if (!shouldAnimate) {
    if (typeof finish === "function") finish();
    return;
  }

  let done = false;
  const complete = () => {
    if (done) return;
    done = true;
    node.classList.remove(className);
    if (typeof finish === "function") finish();
  };

  node.classList.add(className);
  window.setTimeout(complete, timeoutMs);
}

export function debounce(fn, ms = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function setUrlParams(params) {
  const url = new URL(window.location.href);
  url.search = params.toString();
  window.history.replaceState({}, "", url.toString());
}

function getRequestUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;
  return "";
}

function isBackendApiRequest(input) {
  const raw = getRequestUrl(input);
  if (!raw) return false;
  try {
    const requestUrl = new URL(raw, window.location.origin);
    const apiUrl = new URL(API_BASE, window.location.origin);
    if (requestUrl.origin !== apiUrl.origin) return false;

    const apiPath = String(apiUrl.pathname || "/");
    const apiPrefix = apiPath.endsWith("/") ? apiPath : `${apiPath}/`;
    return requestUrl.pathname === apiPath || requestUrl.pathname.startsWith(apiPrefix) || apiPrefix === "/";
  } catch (error) {
    return raw.startsWith(API_BASE);
  }
}

function ensureGlobalLoadingOverlayNode() {
  if (typeof document === "undefined" || !document.body) return null;
  let node = document.getElementById(GLOBAL_LOADING_OVERLAY_ID);
  if (node) return node;

  node = document.createElement("div");
  node.id = GLOBAL_LOADING_OVERLAY_ID;
  node.className = "global-loading-overlay";
  node.setAttribute("aria-hidden", "true");
  node.innerHTML = `
    <div class="global-loading-overlay__track" aria-hidden="true">
      <div class="global-loading-overlay__bar"></div>
    </div>
  `;
  document.body.appendChild(node);
  return node;
}

function setGlobalLoadingVisible(visible) {
  const node = ensureGlobalLoadingOverlayNode();
  if (!node) return;
  if (visible) {
    node.classList.add("is-visible");
    node.setAttribute("aria-hidden", "false");
    globalVisibleAt = Date.now();
    globalVisible = true;
    return;
  }
  node.classList.remove("is-visible");
  node.setAttribute("aria-hidden", "true");
  globalVisible = false;
}

function onGlobalApiRequestStart() {
  globalPendingCount += 1;

  if (globalHideTimer) {
    clearTimeout(globalHideTimer);
    globalHideTimer = 0;
  }
  if (globalVisible || globalShowTimer) return;

  globalShowTimer = window.setTimeout(() => {
    globalShowTimer = 0;
    if (globalPendingCount > 0) setGlobalLoadingVisible(true);
  }, GLOBAL_LOADING_SHOW_DELAY_MS);
}

function onGlobalApiRequestEnd() {
  globalPendingCount = Math.max(0, globalPendingCount - 1);
  if (globalPendingCount > 0) return;

  if (globalShowTimer) {
    clearTimeout(globalShowTimer);
    globalShowTimer = 0;
  }

  if (!globalVisible) return;
  const elapsed = Date.now() - globalVisibleAt;
  const wait = Math.max(0, GLOBAL_LOADING_MIN_VISIBLE_MS - elapsed);
  globalHideTimer = window.setTimeout(() => {
    globalHideTimer = 0;
    if (globalPendingCount === 0) setGlobalLoadingVisible(false);
  }, wait);
}

export function initGlobalApiLoadingIndicator() {
  if (globalLoaderInstalled || typeof window === "undefined" || typeof window.fetch !== "function") return;
  globalLoaderInstalled = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureGlobalLoadingOverlayNode();
    }, { once: true });
  } else {
    ensureGlobalLoadingOverlayNode();
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const tracked = isBackendApiRequest(input);
    if (tracked) onGlobalApiRequestStart();
    try {
      return await originalFetch(input, init);
    } finally {
      if (tracked) onGlobalApiRequestEnd();
    }
  };
}
