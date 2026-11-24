/* frontend/javascript/pages/universities/stale-list-cache.js */
import { safeLocalStorage } from "../../utils/safe-storage.js";

// The last successful catalog pages are kept in this browser so a slow or sleeping backend still
// leaves something to look at. Entries are tied to the app version, so a release never shows
// results shaped for an older frontend, and they expire after a week.
const STORAGE_KEY = "unisearch_catalog_last_lists_v1";
const MAX_ENTRIES = 4;
const MAX_ENTRY_CHARS = 400_000;
export const STALE_LIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @typedef {{ items: Array<Record<string, any>>, total: number }} CatalogListPayload
 * @typedef {{ id: string, savedAt: number, payload: CatalogListPayload }} StaleListEntry
 */

/**
 * The request key contains the visitor's profile, so entries are matched by a hash instead of storing it again.
 * @param {string} requestKey
 * @returns {string}
 */
function hashRequestKey(requestKey) {
  let hash = 5381;
  for (let index = 0; index < requestKey.length; index += 1) {
    hash = ((hash * 33) ^ requestKey.charCodeAt(index)) >>> 0;
  }
  return `${hash.toString(36)}-${requestKey.length.toString(36)}`;
}

function currentVersion() {
  return String(window.APP_VERSION || "");
}

/** @returns {StaleListEntry[]} */
function readEntries() {
  const stored = safeLocalStorage.getJson(STORAGE_KEY, null);
  if (!stored || stored.version !== currentVersion() || !Array.isArray(stored.entries)) return [];
  return stored.entries.filter((entry) => entry && typeof entry.id === "string" && Array.isArray(entry.payload?.items));
}

/**
 * @param {string} requestKey
 * @param {number} [now]
 * @returns {CatalogListPayload | null}
 */
export function readStaleCatalogList(requestKey, now = Date.now()) {
  const id = hashRequestKey(requestKey);
  const entry = readEntries().find((item) => item.id === id);
  if (!entry || now - Number(entry.savedAt) > STALE_LIST_MAX_AGE_MS) return null;
  return entry.payload;
}

/**
 * @param {string} requestKey
 * @param {CatalogListPayload} payload
 * @param {number} [now]
 * @returns {boolean} true when the entry was stored
 */
export function saveStaleCatalogList(requestKey, payload, now = Date.now()) {
  if (!Array.isArray(payload?.items) || payload.items.length === 0) return false;
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_ENTRY_CHARS) return false;

  const id = hashRequestKey(requestKey);
  const entries = readEntries()
    .filter((entry) => entry.id !== id && now - Number(entry.savedAt) <= STALE_LIST_MAX_AGE_MS)
    .slice(-(MAX_ENTRIES - 1));
  entries.push({ id, savedAt: now, payload });
  return safeLocalStorage.setJson(STORAGE_KEY, { version: currentVersion(), entries });
}
