/* frontend/javascript/components/network-status.js */
import { heroIcon } from "../icons.js";
import { t } from "../i18n.js";
import { API_BASE } from "../utils.js";

const BANNER_ID = "networkStatusBanner";
const ONLINE_DISMISS_DELAY_MS = 2600;
const CONNECTIVITY_CACHE_TTL_MS = 5000;

let monitorInstalled = false;
let dismissTimer = 0;
let lastConnectivityResult = null;
let lastConnectivityAt = 0;

/**
 * Returns true if the browser currently reports an online state.
 * @returns {boolean}
 */
export function isOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

/**
 * Probes the backend endpoint to confirm real Internet / API connectivity ("Lie-Fi" detection).
 * @param {Object} [options]
 * @param {boolean} [options.force=false]
 * @param {number} [options.timeoutMs=3500]
 * @returns {Promise<boolean>}
 */
export async function checkConnectivity(options = {}) {
  const force = Boolean(options.force);
  const timeoutMs = Math.max(500, Number(options.timeoutMs || 3500));
  const now = Date.now();

  if (!force && lastConnectivityResult !== null && (now - lastConnectivityAt < CONNECTIVITY_CACHE_TTL_MS)) {
    return lastConnectivityResult;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    lastConnectivityResult = false;
    lastConnectivityAt = now;
    return false;
  }

  if (typeof window === "undefined" || typeof fetch !== "function") return true;

  const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(timeoutMs)
    : undefined;

  try {
    const healthUrl = `${API_BASE}/health`;
    const res = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    const reachable = Boolean(res && (res.ok || res.status < 500));
    lastConnectivityResult = reachable;
    lastConnectivityAt = Date.now();
    return reachable;
  } catch {
    lastConnectivityResult = false;
    lastConnectivityAt = Date.now();
    return false;
  }
}

/**
 * Classifies an error into a structured category: 'offline', 'server', 'not_found', 'abort', or 'generic'.
 * @param {any} error
 * @returns {{ type: 'offline' | 'server' | 'not_found' | 'abort' | 'generic', isOffline: boolean, isServer: boolean, isNotFound: boolean, isAbort: boolean, status: number | null }}
 */
export function classifyError(error) {
  if (!error) {
    return { type: "generic", isOffline: false, isServer: false, isNotFound: false, isAbort: false, isGeneric: true, status: null };
  }

  if (error?.name === "AbortError" || error?.__aborted) {
    return { type: "abort", isOffline: false, isServer: false, isNotFound: false, isAbort: true, isGeneric: false, status: null };
  }

  // Explicit offline flag or browser reports disconnected
  if (!isOnline()) {
    return { type: "offline", isOffline: true, isServer: false, isNotFound: false, isAbort: false, isGeneric: false, status: null };
  }

  const status = Number(error?.status || error?.statusCode || 0) || null;
  const msg = String(error?.message || error || "").toLowerCase();

  // Network fetch failure in browser (Failed to fetch, NetworkError, Load failed)
  if (
    error instanceof TypeError &&
    (msg.includes("fetch") || msg.includes("networkerror") || msg.includes("network request failed") || msg.includes("failed to fetch") || msg.includes("load failed"))
  ) {
    return { type: "offline", isOffline: true, isServer: false, isNotFound: false, isAbort: false, isGeneric: false, status: null };
  }

  // 404 Not Found
  if (status === 404 || msg.includes("404") || msg.includes("not found")) {
    return { type: "not_found", isOffline: false, isServer: false, isNotFound: true, isAbort: false, isGeneric: false, status: 404 };
  }

  // 5xx Server Error or API failure with server status
  if ((status && status >= 500 && status <= 599) || msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("server error") || msg.includes("api error")) {
    return { type: "server", isOffline: false, isServer: true, isNotFound: false, isAbort: false, isGeneric: false, status: status || 500 };
  }

  return { type: "generic", isOffline: false, isServer: false, isNotFound: false, isAbort: false, isGeneric: true, status };
}

function ensureBannerElement() {
  if (typeof document === "undefined" || !document.body) return null;
  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.className = "network-status-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-atomic", "true");
    document.body.appendChild(banner);
  }
  return banner;
}

/**
 * Banner states. Problem states stay until the state changes; positive ones dismiss themselves.
 * @type {Record<string, { icon: string, key: string, fallback: string, autoDismiss: boolean }>}
 */
const BANNER_STATES = {
  offline: { icon: "signal-slash", key: "network.offline.banner", fallback: "You are offline. Showing cached workspace data.", autoDismiss: false },
  online: { icon: "check-circle", key: "network.online.banner", fallback: "Connection restored.", autoDismiss: true },
  waking: { icon: "clock", key: "network.waking.banner", fallback: "The server is waking up. This can take up to a minute.", autoDismiss: false },
  unavailable: { icon: "exclamation-triangle", key: "network.unavailable.banner", fallback: "The server is not responding right now. Please try again in a few minutes.", autoDismiss: false },
  ready: { icon: "check-circle", key: "network.ready.banner", fallback: "The server is ready.", autoDismiss: true },
};

/**
 * Shows the network status banner.
 * @param {'offline' | 'online' | 'waking' | 'unavailable' | 'ready'} status
 */
export function showNetworkStatusBanner(status) {
  const banner = ensureBannerElement();
  if (!banner) return;

  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = 0;
  }

  const stateName = Object.hasOwn(BANNER_STATES, status) ? status : "online";
  const state = BANNER_STATES[stateName];
  banner.classList.remove(...Object.keys(BANNER_STATES).map((name) => `network-status-banner--${name}`));
  banner.classList.add(`network-status-banner--${stateName}`);

  const iconName = state.icon;
  const iconClass = "ui-icon ui-icon--16";
  const text = t(state.key, state.fallback);

  const iconSpan = document.createElement("span");
  iconSpan.className = "network-status-banner__icon";
  iconSpan.setAttribute("aria-hidden", "true");
  iconSpan.innerHTML = heroIcon(iconName, iconClass) || heroIcon("exclamation-triangle", iconClass);

  const textSpan = document.createElement("span");
  textSpan.className = "network-status-banner__text";
  textSpan.textContent = text;

  banner.replaceChildren(iconSpan, textSpan);

  // Trigger smooth enter animation
  banner.classList.add("is-visible");

  if (state.autoDismiss) {
    dismissTimer = window.setTimeout(() => {
      dismissTimer = 0;
      banner.classList.remove("is-visible");
    }, ONLINE_DISMISS_DELAY_MS);
  }
}

/**
 * Initializes global online/offline listeners and automatic reconnection events.
 */
export function initNetworkStatusMonitor() {
  if (monitorInstalled || typeof window === "undefined") return;
  monitorInstalled = true;

  window.addEventListener("offline", () => {
    showNetworkStatusBanner("offline");
    window.dispatchEvent(new CustomEvent("app:offline"));
  });

  window.addEventListener("online", () => {
    showNetworkStatusBanner("online");
    window.dispatchEvent(new CustomEvent("app:online"));
    window.dispatchEvent(new CustomEvent("app:online-reconnect"));
  });

  // Check initial state
  if (!isOnline()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => showNetworkStatusBanner("offline"), { once: true });
    } else {
      showNetworkStatusBanner("offline");
    }
  }
}
