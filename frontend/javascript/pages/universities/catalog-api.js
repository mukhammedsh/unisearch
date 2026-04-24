import { API_BASE } from "../../utils.js";

/**
 * API requests for university catalog
 */

const CACHE_TTL_MS = 30000;

let lastFetchKey = null;
let lastFetchPayload = null;
let lastFetchAt = 0;

let lastAiFetchKey = null;
let lastAiFetchPayload = null;
let lastAiFetchAt = 0;

let listFetchController = null;
let aiFetchController = null;

export function resetCatalogApiCache() {
  lastFetchKey = null;
  lastFetchPayload = null;
  lastFetchAt = 0;
  lastAiFetchKey = null;
  lastAiFetchPayload = null;
  lastAiFetchAt = 0;
}

export function abortCatalogApiRequests() {
  if (listFetchController) {
    listFetchController.abort();
    listFetchController = null;
  }
  if (aiFetchController) {
    aiFetchController.abort();
    aiFetchController = null;
  }
}

export async function fetchUniversities(apiParams, options = {}) {
  const { logDebug = () => {} } = options;
  const key = apiParams.toString();
  const now = Date.now();

  logDebug("non-ai request start", {
    query: key,
    reason: "sort is not uni_ai or AI fallback path",
  });

  if (lastFetchKey === key && lastFetchPayload && (now - lastFetchAt) < CACHE_TTL_MS) {
    logDebug("non-ai request cache hit (frontend memory)", {
      ageMs: now - lastFetchAt,
    });
    return lastFetchPayload;
  }

  if (listFetchController) {
    listFetchController.abort();
  }
  const controller = new AbortController();
  listFetchController = controller;

  let res;
  try {
    res = await fetch(`${API_BASE}/universities?${key}`, { signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      return { items: [], total: 0, __aborted: true };
    }
    throw err;
  } finally {
    if (listFetchController === controller) {
      listFetchController = null;
    }
  }

  if (!res.ok) throw new Error("API Error");
  const data = await res.json();
  const payload = {
    items: data.items || [],
    total: data.total || 0,
  };

  logDebug("non-ai response received", {
    httpStatus: res.status,
    apiItems: payload.items.length,
    total: payload.total,
  });

  lastFetchKey = key;
  lastFetchPayload = payload;
  lastFetchAt = now;
  return payload;
}

export async function fetchUniversitiesAiSort(payload, options = {}) {
  const { logDebug = () => {} } = options;
  const key = JSON.stringify(payload);
  const now = Date.now();
  const payloadInterests = String(payload?.profile?.interests || "").trim();

  logDebug("request start", {
    cacheCandidateKeyLength: key.length,
    interestsRawLength: payloadInterests.length,
  });

  if (lastAiFetchKey === key && lastAiFetchPayload && (now - lastAiFetchAt) < CACHE_TTL_MS) {
    logDebug("request cache hit (frontend memory)", {
      ageMs: now - lastAiFetchAt,
    });
    return lastAiFetchPayload;
  }

  if (aiFetchController) {
    aiFetchController.abort();
  }
  const controller = new AbortController();
  aiFetchController = controller;

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
    if (aiFetchController === controller) {
      aiFetchController = null;
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

  logDebug("response received", {
    httpStatus: res.status,
    apiItems: parsed.items.length,
    apiWarnings: parsed.warnings,
    mlQueryTranslated: Boolean(match.mlQueryTranslated),
    mlQuerySource: String(match.mlQuerySource || ""),
    mlQueryTranslationReason: String(match.mlQueryTranslationReason || ""),
    mlQueryProvider: String(match.mlQueryProvider || ""),
    mlQueryCacheHit: Boolean(match.mlQueryCacheHit),
    mlQueryProviderError: String(match.mlQueryProviderError || ""),
    mlQueryInputPreview: String(match.mlQueryInputPreview || ""),
    mlQueryOutputPreview: String(match.mlQueryOutputPreview || ""),
    mlQueryOutputLength: Number(match.mlQueryOutputLength || 0),
    mlApplied: Boolean(match.mlApplied),
    mlAvailable: Boolean(match.mlAvailable),
    mlUnavailable: Boolean(match.mlUnavailable),
    mlWarning: String(match.mlWarning || ""),
  });

  lastAiFetchKey = key;
  lastAiFetchPayload = parsed;
  lastAiFetchAt = now;
  return parsed;
}
