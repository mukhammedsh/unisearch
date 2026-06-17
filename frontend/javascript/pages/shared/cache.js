import { API_BASE, createSafeStorage } from "../../utils.js";
import { getCurrentLanguage } from "../../i18n.js";
import { shouldOpenUniversitiesInNewTab, shouldStoreRecentUniversities } from "../../settings.js";

const safeLocalStorage = createSafeStorage("local");

export const DETAIL_CACHE_KEY = "unisearch_detail_cache_v3";
export const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
export const DETAIL_CACHE_MAX_ITEMS = 24;
const DETAIL_FETCH_RETRY_DELAY_MS = 120;
export const UNIVERSITIES_TOUR_SEEN_KEY = "unisearch_universities_tour_seen_v1";
export const SAVED_UNIVERSITIES_KEY = "unisearch_saved_university_ids_v1";
export const COMPARE_UNIVERSITIES_KEY = "unisearch_compare_university_ids_v1";
export const COMPARE_ADMISSION_CHOICES_KEY = "unisearch_compare_admission_choices_v1";
export const RECENT_UNIVERSITIES_KEY = "unisearch_recent_university_ids_v1";
export const MAX_COMPARE_UNIVERSITIES = 2;
export const MAX_RECENT_UNIVERSITIES = 12;

export let __detailProfileUpdatedHandler = null;
export let __detailLanguageChangedHandler = null;
export let __detailFinanceResizeHandler = null;
export let __detailFinanceResizeObserver = null;
export let __universitiesProfileUpdatedHandler = null;
export let __universitiesLanguageChangedHandler = null;
export let __universitiesMapCardActionHandler = null;
export let __rankingLanguageChangedHandler = null;
export let __guideExternalUpdateHandler = null;
export let __guideHashChangeHandler = null;

export { shouldOpenUniversitiesInNewTab };

export function bindGuideExternalUpdates(handler) {
  if (__guideExternalUpdateHandler) {
    window.removeEventListener("languageChanged", __guideExternalUpdateHandler);
    window.removeEventListener("examConfigLoaded", __guideExternalUpdateHandler);
    window.removeEventListener("languageConfigLoaded", __guideExternalUpdateHandler);
  }
  __guideExternalUpdateHandler = handler;
  window.addEventListener("languageChanged", __guideExternalUpdateHandler);
  window.addEventListener("examConfigLoaded", __guideExternalUpdateHandler);
  window.addEventListener("languageConfigLoaded", __guideExternalUpdateHandler);
}

export function bindGuideHashChange(handler) {
  if (__guideHashChangeHandler) {
    window.removeEventListener("hashchange", __guideHashChangeHandler);
  }
  __guideHashChangeHandler = handler;
  window.addEventListener("hashchange", __guideHashChangeHandler);
}

export function hasSeenUniversitiesTour() {
  return safeLocalStorage.get(UNIVERSITIES_TOUR_SEEN_KEY) === "1";
}

export function markUniversitiesTourSeen() {
  safeLocalStorage.set(UNIVERSITIES_TOUR_SEEN_KEY, "1");
}

export function readIdListStorage(key) {
  const parsed = safeLocalStorage.getJson(key, []);
  return Array.isArray(parsed)
    ? parsed.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
}

export function writeIdListStorage(key, ids) {
  const normalized = Array.from(new Set(
    (Array.isArray(ids) ? ids : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ));
  safeLocalStorage.setJson(key, normalized);
}

export function rememberRecentUniversity(id) {
  if (!shouldStoreRecentUniversities()) return;
  const cleanId = String(id || "").trim();
  if (!cleanId) return;
  const next = [cleanId, ...readIdListStorage(RECENT_UNIVERSITIES_KEY).filter((value) => value !== cleanId)]
    .slice(0, MAX_RECENT_UNIVERSITIES);
  writeIdListStorage(RECENT_UNIVERSITIES_KEY, next);
}

export function readDetailCache() {
  const parsed = safeLocalStorage.getJson(DETAIL_CACHE_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function writeDetailCache(cache) {
  safeLocalStorage.setJson(DETAIL_CACHE_KEY, cache || {});
}

export function getDetailCacheEntry(universityId, lang = getCurrentLanguage()) {
  const key = String(universityId || "").trim();
  const normalizedLang = String(lang || "eng").trim().toLowerCase() || "eng";
  if (!key) return null;
  const cacheKey = `${key}::${normalizedLang}`;
  const entry = readDetailCache()[cacheKey];
  if (!entry || typeof entry !== "object" || !entry.data || typeof entry.data !== "object") return null;
  return {
    key: cacheKey,
    data: entry.data,
    etag: String(entry.etag || ""),
    ts: Number(entry.ts) || 0,
  };
}

export function setDetailCacheEntry(universityId, data, etag = "", lang = getCurrentLanguage()) {
  const key = String(universityId || "").trim();
  const normalizedLang = String(lang || "eng").trim().toLowerCase() || "eng";
  if (!key || !data || typeof data !== "object") return;
  const cacheKey = `${key}::${normalizedLang}`;

  const cache = readDetailCache();
  cache[cacheKey] = { data, etag: String(etag || ""), ts: Date.now() };

  const keys = Object.keys(cache);
  if (keys.length > DETAIL_CACHE_MAX_ITEMS) {
    keys
      .sort((left, right) => (Number(cache[left]?.ts) || 0) - (Number(cache[right]?.ts) || 0))
      .slice(0, keys.length - DETAIL_CACHE_MAX_ITEMS)
      .forEach((oldKey) => delete cache[oldKey]);
  }

  writeDetailCache(cache);
}

export function touchDetailCacheEntry(universityId, lang = getCurrentLanguage()) {
  const key = String(universityId || "").trim();
  const normalizedLang = String(lang || "eng").trim().toLowerCase() || "eng";
  if (!key) return;
  const cacheKey = `${key}::${normalizedLang}`;
  const cache = readDetailCache();
  if (!cache[cacheKey] || typeof cache[cacheKey] !== "object") return;
  cache[cacheKey].ts = Date.now();
  writeDetailCache(cache);
}

export async function fetchUniversityDetailCached(universityId) {
  const key = String(universityId || "").trim();
  const lang = String(getCurrentLanguage() || "eng").trim().toLowerCase() || "eng";
  if (!key) throw new Error("University ID is required");

  const cached = getDetailCacheEntry(key, lang);
  const age = cached ? Date.now() - cached.ts : Number.POSITIVE_INFINITY;
  if (cached && age < DETAIL_CACHE_TTL_MS) return cached.data;

  const headers = {};
  if (cached?.etag) headers["If-None-Match"] = cached.etag;

  const waitForRetry = () => new Promise((resolve) => globalThis.setTimeout(resolve, DETAIL_FETCH_RETRY_DELAY_MS));

  try {
    const qs = new URLSearchParams({ lang }).toString();
    const url = `${API_BASE}/universities/${encodeURIComponent(key)}?${qs}`;
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, { headers });
        if (response.status === 304 && cached?.data) {
          touchDetailCacheEntry(key, lang);
          return cached.data;
        }
        if (response.ok) {
          const data = await response.json();
          setDetailCacheEntry(key, data, response.headers.get("ETag") || "", lang);
          return data;
        }
        lastError = new Error("Backend error");
      } catch (error) {
        lastError = error;
      }
      if (attempt === 0) await waitForRetry();
    }

    throw lastError || new Error("Backend error");
  } catch (error) {
    if (cached?.data) return cached.data;
    throw error;
  }
}
