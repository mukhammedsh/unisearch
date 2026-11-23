import { API_BASE, loadProfileForApi, showToast } from "../../utils.js";
import { t } from "../../i18n.js";

const DEFAULT_CACHE_TTL_MS = 30000;

export function initTranslationDebugLogger() {
  const isTranslationDebugEnabled = (() => {
    const raw = window.APP_DEBUG;
    if (typeof raw === "boolean") return raw;
    const text = String(raw ?? "").trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(text);
  })();
  const logTranslationDebug = (stage, details = {}) => {
    if (!isTranslationDebugEnabled) return;
    try {
      // oxlint-disable no-console -- guarded by APP_DEBUG runtime flag
      console.groupCollapsed(`[UniSearch Translation Debug] ${stage}`);
      Object.entries(details || {}).forEach(([k, v]) => console.log(`${k}:`, v));
      console.groupEnd();
      // oxlint-enable no-console
    } catch {
      // ignore logging errors
    }
  };
  logTranslationDebug("debug mode enabled", {
    enabled: true,
    note: "ML + translation debug is enabled by APP_DEBUG runtime flag.",
  });
  return logTranslationDebug;
}

/**
 * Mutable request-lifecycle and in-memory response cache state for catalog fetches.
 * @typedef {{
 *   cacheTtlMs: number,
 *   universitiesFetchCache: Map<string, { payload: { items: Array<Record<string, any>>, total: number }, timestamp: number }>,
 *   profiledEndpointUnavailableUntil: number,
 *   legacyPricesWarningShown: boolean,
 *   lastAiFetchKey: string,
 *   lastAiFetchPayload: { items: Array<Record<string, any>>, total: number, warnings: string[] } | null,
 *   lastAiFetchAt: number,
 *   listFetchController: AbortController | null,
 *   aiFetchController: AbortController | null,
 * }} UniversitiesApiState
 */

/**
 * Create a fresh catalog API state container with in-memory TTL caching.
 * @param {{ cacheTtlMs?: number }} [options]
 * @returns {UniversitiesApiState}
 */
export function createUniversitiesApiState({ cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  return {
    cacheTtlMs,
    universitiesFetchCache: new Map(),
    profiledEndpointUnavailableUntil: 0,
    legacyPricesWarningShown: false,
    lastAiFetchKey: "",
    lastAiFetchPayload: null,
    lastAiFetchAt: 0,
    listFetchController: null,
    aiFetchController: null,
  };
}

/**
 * Abort any in-flight catalog list or AI-sort network requests.
 * @param {UniversitiesApiState | null | undefined} apiState
 */
export function abortUniversitiesApiRequests(apiState) {
  if (!apiState) return;
  apiState.listFetchController?.abort();
  apiState.listFetchController = null;
  apiState.aiFetchController?.abort();
  apiState.aiFetchController = null;
}

/**
 * Fetch a filtered page of universities using POST /universities/profiled with fallback to GET /universities.
 * @param {URLSearchParams} apiParams
 * @param {{ apiState?: UniversitiesApiState, logTranslationDebug?: (stage: string, details?: Record<string, unknown>) => void }} [options]
 * @returns {Promise<{ items: Array<Record<string, any>>, total: number, __aborted?: boolean }>}
 */
export async function fetchUniversitiesList(apiParams, { apiState, logTranslationDebug = () => {} } = {}) {
  const state = apiState || createUniversitiesApiState();
  const profile = loadProfileForApi();
  const requestPayload = { ...Object.fromEntries(apiParams), profile };
  const key = JSON.stringify(requestPayload);
  const now = Date.now();
  logTranslationDebug("non-ai request start", {
    query: apiParams.toString(),
    reason: "sort is not uni_ai or AI fallback path",
  });
  const cached = state.universitiesFetchCache.get(key);
  if (cached && (now - cached.timestamp) < state.cacheTtlMs) {
    logTranslationDebug("non-ai request cache hit (frontend memory)", {
      ageMs: now - cached.timestamp,
    });
    return cached.payload;
  }

  if (state.listFetchController) {
    state.listFetchController.abort();
  }
  const controller = new AbortController();
  state.listFetchController = controller;

  let res;
  try {
    if (Date.now() < state.profiledEndpointUnavailableUntil) {
      res = await fetch(`${API_BASE}/universities?${apiParams}`, { signal: controller.signal });
    } else {
      res = await fetch(`${API_BASE}/universities/profiled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: key,
        signal: controller.signal,
      });
      if (res.status === 404 || res.status === 405) {
        state.profiledEndpointUnavailableUntil = Date.now() + state.cacheTtlMs;
        if (!state.legacyPricesWarningShown) {
          state.legacyPricesWarningShown = true;
          showToast(t("universities.cost.legacy_server_warning"), "warning");
        }
        res = await fetch(`${API_BASE}/universities?${apiParams}`, { signal: controller.signal });
      }
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      return { items: [], total: 0, __aborted: true };
    }
    throw err;
  } finally {
    if (state.listFetchController === controller) {
      state.listFetchController = null;
    }
  }

  if (!res.ok) throw new Error("API Error");
  const data = await res.json();
  const payload = {
    items: data.items || [],
    total: data.total || 0,
  };
  logTranslationDebug("non-ai response received", {
    httpStatus: res.status,
    apiItems: payload.items.length,
    total: payload.total,
  });
  if (state.universitiesFetchCache.size >= 50) {
    const oldestKey = state.universitiesFetchCache.keys().next().value;
    if (oldestKey !== undefined) state.universitiesFetchCache.delete(oldestKey);
  }
  state.universitiesFetchCache.set(key, { payload, timestamp: now });
  return payload;
}

/**
 * Fetch UniFit AI-sorted universities from POST /universities/ai-sort with TTL caching.
 * @param {Record<string, any>} payload
 * @param {{ apiState?: UniversitiesApiState, logTranslationDebug?: (stage: string, details?: Record<string, unknown>) => void }} [options]
 * @returns {Promise<{ items: Array<Record<string, any>>, total: number, warnings?: string[], __aborted?: boolean }>}
 */
export async function fetchUniversitiesAiSort(payload, { apiState, logTranslationDebug = () => {} } = {}) {
  const state = apiState || createUniversitiesApiState();
  const key = JSON.stringify(payload);
  const now = Date.now();
  const payloadInterests = String(payload?.profile?.interests || "").trim();
  logTranslationDebug("request start", {
    cacheCandidateKeyLength: key.length,
    interestsRawLength: payloadInterests.length,
  });
  if (state.lastAiFetchKey === key && state.lastAiFetchPayload && (now - state.lastAiFetchAt) < state.cacheTtlMs) {
    logTranslationDebug("request cache hit (frontend memory)", {
      ageMs: now - state.lastAiFetchAt,
    });
    return state.lastAiFetchPayload;
  }

  if (state.aiFetchController) {
    state.aiFetchController.abort();
  }
  const controller = new AbortController();
  state.aiFetchController = controller;

  let res;
  try {
    res = await fetch(`${API_BASE}/universities/ai-sort`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      return { items: [], total: 0, __aborted: true };
    }
    throw err;
  } finally {
    if (state.aiFetchController === controller) {
      state.aiFetchController = null;
    }
  }

  if (!res.ok) throw new Error("AI sort API Error");
  const data = await res.json();
  const parsed = {
    items: data.items || [],
    total: data.total || 0,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
  const probe = parsed.items[0] || {};
  const match = (probe && typeof probe === "object") ? (probe.matchData || {}) : {};
  logTranslationDebug("response received", {
    httpStatus: res.status,
    apiItems: parsed.items.length,
    apiWarnings: parsed.warnings,
    mlApplied: Boolean(match.mlApplied),
    mlAvailable: Boolean(match.mlAvailable),
    mlUnavailable: Boolean(match.mlUnavailable),
    mlWarning: String(match.mlWarning || ""),
  });
  state.lastAiFetchKey = key;
  state.lastAiFetchPayload = parsed;
  state.lastAiFetchAt = now;
  return parsed;
}
