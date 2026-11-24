/* frontend/javascript/components/backend-wake.js */
import { API_BASE } from "../utils.js";
import { isOnline, showNetworkStatusBanner } from "./network-status.js";

// The free backend host puts the API to sleep after a quiet period and needs up to about a minute to wake.
// Probing /health early wakes it while the page loads; the banner explains any wait the visitor would notice.
export const WAKE_SLOW_NOTICE_MS = 3500;
export const WAKE_FIRST_PROBE_TIMEOUT_MS = 75_000;
const WAKE_RETRY_PROBE_TIMEOUT_MS = 20_000;
export const WAKE_RETRY_DELAY_MS = 15_000;
export const WAKE_MAX_ATTEMPTS = 6;

/**
 * @typedef {object} WakeBackendDeps
 * @property {typeof fetch} [fetchImpl]
 * @property {(status: 'waking' | 'unavailable' | 'ready') => void} [notify]
 * @property {() => void} [onRecovered] Called when the API answers after at least one failed probe.
 */

function dispatchReconnect() {
  window.dispatchEvent(new CustomEvent("app:online-reconnect"));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves true when GET /health answers with a success status before the timeout.
 * @param {typeof fetch} fetchImpl
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function probeHealth(fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${API_BASE}/health`, {
      method: "GET",
      cache: "no-store",
      // Progressive enhancement: the probe must not compete with the requests that render the page.
      priority: "low",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return Boolean(response && response.ok);
  } catch {
    // A network error or timeout means the API is not reachable yet; the caller reports that state.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wakes the backend and keeps the visitor informed while it starts.
 * Stays silent when the API answers quickly. Gives up after WAKE_MAX_ATTEMPTS probes.
 * @param {WakeBackendDeps} [deps]
 * @returns {Promise<boolean>} true once the API answered
 */
export async function wakeBackend({
  fetchImpl = globalThis.fetch,
  notify = showNetworkStatusBanner,
  onRecovered = dispatchReconnect,
  silent = false,
} = {}) {
  if (typeof fetchImpl !== "function") return false;

  let noticeShown = false;
  const showNotice = (status) => {
    if (silent) return;
    noticeShown = true;
    notify(status);
  };

  for (let attempt = 0; attempt < WAKE_MAX_ATTEMPTS; attempt += 1) {
    const slowTimer = attempt === 0 ? setTimeout(() => showNotice("waking"), WAKE_SLOW_NOTICE_MS) : 0;
    // Probes are sequential on purpose: each retry waits for the previous one to fail.
    // oxlint-disable-next-line no-await-in-loop -- sequential retries
    const awake = await probeHealth(
      fetchImpl,
      attempt === 0 ? WAKE_FIRST_PROBE_TIMEOUT_MS : WAKE_RETRY_PROBE_TIMEOUT_MS,
    );
    clearTimeout(slowTimer);

    if (awake) {
      if (noticeShown) notify("ready");
      if (attempt > 0) onRecovered();
      return true;
    }
    // The offline banner already explains a lost connection; do not blame the server for it.
    if (!isOnline()) return false;

    showNotice("unavailable");
    // oxlint-disable-next-line no-await-in-loop -- sequential retries
    if (attempt < WAKE_MAX_ATTEMPTS - 1) await delay(WAKE_RETRY_DELAY_MS);
  }
  return false;
}
