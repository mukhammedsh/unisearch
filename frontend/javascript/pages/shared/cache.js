import { API_BASE, createSafeStorage } from "../../utils.js";
import { getCurrentLanguage } from "../../i18n.js";
import { shouldOpenUniversitiesInNewTab, shouldStoreRecentUniversities } from "../../settings.js";
import { loadStaticUniversityDetail } from "../../utils/static-snapshot.js";

const safeLocalStorage = createSafeStorage("local");
const safeSessionStorage = createSafeStorage("session");

const DETAIL_CACHE_KEY = "unisearch_detail_cache_v4";
safeLocalStorage.remove("unisearch_detail_cache_v3");
export const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
export const DETAIL_CACHE_MAX_ITEMS = 24;
const DETAIL_FETCH_RETRY_DELAY_MS = 120;
const UNIVERSITIES_TOUR_SEEN_KEY = "unisearch_universities_tour_seen_v1";
const UNIVERSITIES_TOUR_RESUME_STEP_KEY = "unisearch_universities_tour_resume_step_v1";
// One-shot hand-off from the profile page: the visitor just filled in the profile and asked for matches,
// so the first-visit catalog tour must not open over the results. Session-scoped and consumed once.
const UNIVERSITIES_TOUR_SKIP_ONCE_KEY = "unisearch_universities_tour_skip_once_v1";
export const SAVED_UNIVERSITIES_KEY = "unisearch_saved_university_ids_v1";
export const COMPARE_UNIVERSITIES_KEY = "unisearch_compare_university_ids_v1";
export const COMPARE_ADMISSION_CHOICES_KEY = "unisearch_compare_admission_choices_v1";
export const RECENT_UNIVERSITIES_KEY = "unisearch_recent_university_ids_v1";
export const MAX_COMPARE_UNIVERSITIES = 2;
export const MAX_RECENT_UNIVERSITIES = 12;

let __guideExternalUpdateHandler = null;
let __guideHashChangeHandler = null;

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

export function readUniversitiesTourResumeStep() {
  const step = Number.parseInt(safeSessionStorage.get(UNIVERSITIES_TOUR_RESUME_STEP_KEY), 10);
  return Number.isInteger(step) && step >= 0 ? step : 0;
}

export function saveUniversitiesTourResumeStep(step) {
  const normalized = Number.parseInt(step, 10);
  if (!Number.isInteger(normalized) || normalized < 0) return;
  safeSessionStorage.set(UNIVERSITIES_TOUR_RESUME_STEP_KEY, String(normalized));
}

export function hasUniversitiesTourResumeStep() {
  return safeSessionStorage.get(UNIVERSITIES_TOUR_RESUME_STEP_KEY, null) !== null;
}

export function clearUniversitiesTourResumeStep() {
  safeSessionStorage.remove(UNIVERSITIES_TOUR_RESUME_STEP_KEY);
}

export function requestUniversitiesTourSkipOnce() {
  safeSessionStorage.set(UNIVERSITIES_TOUR_SKIP_ONCE_KEY, "1");
}

export function consumeUniversitiesTourSkipOnce() {
  const requested = safeSessionStorage.get(UNIVERSITIES_TOUR_SKIP_ONCE_KEY, null) === "1";
  safeSessionStorage.remove(UNIVERSITIES_TOUR_SKIP_ONCE_KEY);
  return requested;
}

/**
 * Read a deduplicated string ID list from local storage.
 * @param {string} key
 * @returns {string[]}
 */
export function readIdListStorage(key) {
  const parsed = safeLocalStorage.getJson(key, []);
  return Array.isArray(parsed)
    ? parsed.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
}

/**
 * Persist a deduplicated list of non-empty IDs to local storage.
 * @param {string} key
 * @param {Array<unknown>} ids
 */
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

/**
 * Look up a valid cached university detail entry by ID and UI language.
 * @param {string} universityId
 * @param {string} [lang]
 * @returns {{ key: string, data: Record<string, any>, etag: string, ts: number } | null}
 */
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

/**
 * Store a university detail response and optional ETag in bounded local storage cache.
 * @param {string} universityId
 * @param {Record<string, any>} data
 * @param {string} [etag=""]
 * @param {string} [lang]
 */
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

/**
 * Fetch a university detail payload with ETag revalidation, TTL caching, and single retry.
 * @param {string} universityId
 * @param {{ requireReviewedCatalog?: boolean }} [options]
 * @returns {Promise<Record<string, any>>}
 */
export async function fetchUniversityDetailCached(universityId, { requireReviewedCatalog = false } = {}) {
  const key = String(universityId || "").trim();
  const lang = String(getCurrentLanguage() || "eng").trim().toLowerCase() || "eng";
  if (!key) throw new Error("University ID is required");

  const staticDetail = await loadStaticUniversityDetail(key, lang);
  if (staticDetail) {
    if (!requireReviewedCatalog || staticDetail?.admissions_catalog?.availability === "reviewed") {
      return staticDetail;
    }
  }

  const cached = getDetailCacheEntry(key, lang);
  const reviewed = cached?.data?.admissions_catalog?.availability === "reviewed";
  const age = cached ? Date.now() - cached.ts : Number.POSITIVE_INFINITY;
  if (cached && !requireReviewedCatalog && !reviewed && age < DETAIL_CACHE_TTL_MS) return cached.data;

  const headers = {};
  if (cached?.etag && (!requireReviewedCatalog || reviewed)) headers["If-None-Match"] = cached.etag;

  const waitForRetry = () => new Promise((resolve) => globalThis.setTimeout(resolve, DETAIL_FETCH_RETRY_DELAY_MS));

  try {
    const qs = new URLSearchParams({ lang }).toString();
    const url = `${API_BASE}/universities/${encodeURIComponent(key)}?${qs}`;
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // Sequential retry loop: the second request only runs if attempt 0 fails before backoff.
        // oxlint-disable-next-line no-await-in-loop
        const response = await fetch(url, { headers });
        if (response.status === 304 && cached?.data && (!requireReviewedCatalog || reviewed)) {
          touchDetailCacheEntry(key, lang);
          return cached.data;
        }
        if (response.ok) {
          // oxlint-disable-next-line no-await-in-loop
          const data = await response.json();
          if (requireReviewedCatalog && data?.admissions_catalog?.availability !== "reviewed") {
            throw new Error("Reviewed university catalog contract is unavailable");
          }
          setDetailCacheEntry(key, data, response.headers.get("ETag") || "", lang);
          return data;
        }
        lastError = new Error("Backend error");
      } catch (error) {
        lastError = error;
      }
      // oxlint-disable-next-line no-await-in-loop
      if (attempt === 0) await waitForRetry();
    }

    throw lastError || new Error("Backend error");
  } catch (error) {
    if (cached?.data && !reviewed && !requireReviewedCatalog) return cached.data;
    throw error;
  }
}
