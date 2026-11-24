/* frontend/javascript/utils/static-snapshot.js */

import { frontendStaticAsset } from "./runtime.js";

const SNAPSHOT_PREFIX = "snapshot";
const SUPPORTED_LANGS = new Set(["eng", "rus", "kaz"]);

let manifestState = "idle"; // "idle" | "loading" | "ready" | "absent"
let manifestData = null;
let manifestPromise = null;

const catalogByLang = new Map();
const detailByKey = new Map();
const translationsByLang = new Map();
const studyOptionsById = new Map();
const configByName = new Map();

/**
 * Normalize a UI/API language identifier to one of the static snapshot language packs.
 * @param {string} [language]
 * @returns {"eng"|"rus"|"kaz"}
 */
function normalizeSnapshotLang(language) {
  const raw = String(language || "").trim().toLowerCase();
  if (raw.startsWith("ru") || raw === "rus") return "rus";
  if (raw.startsWith("kk") || raw.startsWith("kaz")) return "kaz";
  return "eng";
}

function snapshotUrl(relPath) {
  const clean = String(relPath || "").replace(/^\/+/, "");
  return frontendStaticAsset(`${SNAPSHOT_PREFIX}/${clean}`);
}

async function fetchSnapshotJson(relPath, { signal } = {}) {
  const response = await fetch(snapshotUrl(relPath), {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) return null;
  const contentType = String(response.headers?.get?.("Content-Type") || "").toLowerCase();
  if (contentType.includes("text/html")) return null;
  return response.json();
}

/**
 * Check whether the runtime environment enables static snapshot delivery.
 * @returns {boolean}
 */
export function isStaticSnapshotEnabled() {
  const raw = typeof window !== "undefined" ? window.APP_STATIC_SNAPSHOT : "";
  if (typeof raw === "boolean") return raw;
  return ["1", "true", "yes", "on"].includes(String(raw ?? "").trim().toLowerCase());
}

/**
 * Load the static snapshot manifest once per page session.
 * Returns null cleanly when static snapshots are disabled or absent (for example in local dev).
 * @returns {Promise<Record<string, any> | null>}
 */
export async function loadStaticSnapshotManifest() {
  if (!isStaticSnapshotEnabled()) return null;
  if (manifestState === "ready") return manifestData;
  if (manifestState === "absent") return null;
  if (manifestPromise) return manifestPromise;

  manifestState = "loading";
  manifestPromise = fetchSnapshotJson("manifest.json")
    .then((data) => {
      if (data && typeof data === "object" && data.schema_version === "static-snapshot-1.0") {
        manifestData = data;
        manifestState = "ready";
        return manifestData;
      }
      manifestData = null;
      manifestState = "absent";
      return null;
    })
    .catch(() => {
      manifestData = null;
      manifestState = "absent";
      return null;
    })
    .finally(() => {
      manifestPromise = null;
    });

  return manifestPromise;
}

/**
 * Synchronous check: true once the static snapshot manifest has loaded cleanly.
 * @returns {boolean}
 */
export function isStaticSnapshotReady() {
  return manifestState === "ready" && Boolean(manifestData);
}

/**
 * Synchronous check: true when the active static snapshot also hosts campus images and credits.
 * @returns {boolean}
 */
export function hasStaticSnapshotAssets() {
  return isStaticSnapshotReady() && manifestData.assets_included === true;
}

/**
 * Resolve a path under snapshot/assets/ when static snapshot assets are enabled, otherwise "".
 * @param {string} relPath
 * @returns {string}
 */
export function staticSnapshotAssetUrl(relPath) {
  if (!hasStaticSnapshotAssets()) return "";
  const clean = String(relPath || "").replace(/^\/+/, "");
  return clean ? snapshotUrl(`assets/${clean}`) : "";
}

/**
 * Load the static catalog bundle for the requested language.
 * @param {string} [language="eng"]
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Record<string, any> | null>}
 */
export async function loadStaticCatalog(language = "eng", { signal } = {}) {
  const manifest = await loadStaticSnapshotManifest();
  if (!manifest) return null;
  const lang = normalizeSnapshotLang(language);
  if (!SUPPORTED_LANGS.has(lang)) return null;
  if (catalogByLang.has(lang)) return catalogByLang.get(lang);

  const inFlight = fetchSnapshotJson(`catalog/${lang}.json`, { signal })
    .then((data) => {
      if (data && Array.isArray(data.items)) {
        catalogByLang.set(lang, data);
        return data;
      }
      catalogByLang.delete(lang);
      return null;
    })
    .catch((err) => {
      catalogByLang.delete(lang);
      if (err?.name === "AbortError") throw err;
      return null;
    });

  catalogByLang.set(lang, inFlight);
  return inFlight;
}

/**
 * Load a single university's full detail payload from the static snapshot.
 * @param {string} universityId
 * @param {string} [language="eng"]
 * @returns {Promise<Record<string, any> | null>}
 */
export async function loadStaticUniversityDetail(universityId, language = "eng") {
  const manifest = await loadStaticSnapshotManifest();
  if (!manifest) return null;
  const id = String(universityId || "").trim();
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return null;
  const lang = normalizeSnapshotLang(language);
  const key = `${lang}:${id}`;
  if (detailByKey.has(key)) return detailByKey.get(key);

  const request = fetchSnapshotJson(`universities/${lang}/${encodeURIComponent(id)}.json`)
    .then((data) => {
      if (data && typeof data === "object" && data.id) {
        detailByKey.set(key, data);
        return data;
      }
      detailByKey.delete(key);
      return null;
    })
    .catch(() => {
      detailByKey.delete(key);
      return null;
    });

  detailByKey.set(key, request);
  return request;
}

/**
 * Load the static university translation bundle for a language.
 * @param {string} [language="eng"]
 * @returns {Promise<Record<string, any> | null>}
 */
export async function loadStaticTranslations(language = "eng") {
  const manifest = await loadStaticSnapshotManifest();
  if (!manifest) return null;
  const lang = normalizeSnapshotLang(language);
  if (translationsByLang.has(lang)) return translationsByLang.get(lang);

  const request = fetchSnapshotJson(`translations/${lang}.json`)
    .then((data) => {
      if (data && typeof data === "object" && data.data && typeof data.data === "object") {
        translationsByLang.set(lang, data);
        return data;
      }
      translationsByLang.delete(lang);
      return null;
    })
    .catch(() => {
      translationsByLang.delete(lang);
      return null;
    });

  translationsByLang.set(lang, request);
  return request;
}

/**
 * Load the static study-options catalog for a reviewed institution.
 * @param {string} universityId
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Record<string, any> | null>}
 */
export async function loadStaticStudyOptions(universityId, { signal } = {}) {
  const manifest = await loadStaticSnapshotManifest();
  if (!manifest) return null;
  const id = String(universityId || "").trim();
  const reviewed = Array.isArray(manifest.reviewed_ids) ? manifest.reviewed_ids : [];
  if (!id || !reviewed.includes(id)) return null;
  if (studyOptionsById.has(id)) return studyOptionsById.get(id);

  const request = fetchSnapshotJson(`admissions/${encodeURIComponent(id)}/study-options.json`, { signal })
    .then((data) => {
      if (data && Array.isArray(data.items)) {
        studyOptionsById.set(id, data);
        return data;
      }
      studyOptionsById.delete(id);
      return null;
    })
    .catch((err) => {
      studyOptionsById.delete(id);
      if (err?.name === "AbortError") throw err;
      return null;
    });

  studyOptionsById.set(id, request);
  return request;
}

/**
 * Load one of the static reference config files ("locations", "exams-config", "languages-config").
 * @param {"locations"|"exams-config"|"languages-config"} name
 * @returns {Promise<Record<string, any> | null>}
 */
export async function loadStaticConfig(name) {
  const manifest = await loadStaticSnapshotManifest();
  if (!manifest) return null;
  if (configByName.has(name)) return configByName.get(name);

  const request = fetchSnapshotJson(`${name}.json`)
    .then((data) => {
      if (data && typeof data === "object") {
        configByName.set(name, data);
        return data;
      }
      configByName.delete(name);
      return null;
    })
    .catch(() => {
      configByName.delete(name);
      return null;
    });

  configByName.set(name, request);
  return request;
}

/**
 * Clear in-memory snapshot caches (intended for unit tests).
 */
export function resetStaticSnapshotCache() {
  manifestState = "idle";
  manifestData = null;
  manifestPromise = null;
  catalogByLang.clear();
  detailByKey.clear();
  translationsByLang.clear();
  studyOptionsById.clear();
  configByName.clear();
}
