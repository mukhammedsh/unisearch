import { getCurrentLanguage, t } from "./i18n.js";
import { API_BASE } from "./utils.js";

const CACHE = {
  byLang: new Map(),
  inFlightByLang: new Map(),
};

function normalizeLang(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.startsWith("ru") || raw === "rus") return "rus";
  if (raw.startsWith("kk") || raw.startsWith("kz") || raw === "kaz") return "kz";
  return "eng";
}

function keyify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getPack(lang = getCurrentLanguage()) {
  return CACHE.byLang.get(normalizeLang(lang)) || null;
}

function getGroup(group, lang = getCurrentLanguage()) {
  const pack = getPack(lang);
  const groups = pack && typeof pack.groups === "object" ? pack.groups : null;
  if (!groups) return null;
  const row = groups[String(group || "").trim()];
  return row && typeof row === "object" ? row : null;
}

function replaceInsensitive(text, search, replacement) {
  const escaped = String(search || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return String(text || "");
  return String(text || "").replace(new RegExp(escaped, "gi"), String(replacement || ""));
}

export async function initUniversityTranslations(force = false) {
  const lang = normalizeLang(getCurrentLanguage());
  if (!force && CACHE.byLang.has(lang)) return CACHE.byLang.get(lang);

  if (!force && CACHE.inFlightByLang.has(lang)) {
    return CACHE.inFlightByLang.get(lang);
  }

  const qs = new URLSearchParams({ lang }).toString();
  const inFlight = fetch(`${API_BASE}/universities/translations?${qs}`)
    .then((res) => {
      if (!res.ok) throw new Error(`universities/translations http ${res.status}`);
      return res.json();
    })
    .then((payload) => {
      const payloadLang = normalizeLang(payload?.lang || lang);
      const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
      CACHE.byLang.set(payloadLang, data);
      return data;
    })
    .catch(() => null)
    .finally(() => {
      CACHE.inFlightByLang.delete(lang);
    });

  CACHE.inFlightByLang.set(lang, inFlight);
  return inFlight;
}

export function translateDataValue(group, value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;

  const map = getGroup(group);
  if (!map) return raw;
  return map[keyify(raw)] || raw;
}

export function translateWord(key, fallback = "") {
  const k = String(key || "").trim();
  if (!k) return String(fallback || "");

  const pack = getPack();
  const words = pack && typeof pack.words === "object" ? pack.words : null;
  if (words && words[k] != null) return String(words[k]);

  return String(t(k, String(fallback || "")) || String(fallback || ""));
}

export function translateTemplate(key, fallback = "", params = {}) {
  let out = translateWord(key, fallback);
  const map = params && typeof params === "object" ? params : {};
  Object.keys(map).forEach((paramKey) => {
    out = out.replaceAll(`{${paramKey}}`, String(map[paramKey]));
  });
  return out;
}

export function translateUniversityName(id, fallback = "") {
  const uniId = String(id || "").trim();
  const fallbackText = String(fallback || "");
  if (!uniId) return fallbackText;

  const pack = getPack();
  const map = pack && typeof pack.university_names === "object" ? pack.university_names : null;
  if (map && map[uniId]) return String(map[uniId]);

  const key = `university.name.${uniId}`;
  const localized = String(t(key, "") || "").trim();
  return localized || fallbackText;
}

export function translateUniversityDescription(university, fallback = "") {
  const lang = normalizeLang(getCurrentLanguage());
  const source = String(fallback || "").trim();
  if (lang === "eng") return source;

  const u = university && typeof university === "object" ? university : {};
  const uniId = String(u.id || "").trim();

  const pack = getPack();
  const map = pack && typeof pack.university_descriptions === "object" ? pack.university_descriptions : null;
  if (map && uniId && map[uniId]) return String(map[uniId]);

  if (source) return source;

  const key = `university.description.${uniId}`;
  const localized = String(t(key, "") || "").trim();
  if (localized) return localized;

  return source;
}

export function translateAdmissionText(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;

  const pack = getPack();
  const exact = pack && typeof pack.admission_exact === "object" ? pack.admission_exact : null;
  if (exact && exact[raw]) return String(exact[raw]);

  const rules = pack && Array.isArray(pack.admission_replace) ? pack.admission_replace : [];
  let out = raw;
  rules.forEach((rule) => {
    if (!Array.isArray(rule) || rule.length < 2) return;
    out = replaceInsensitive(out, String(rule[0]), String(rule[1]));
  });
  return out;
}

export function translateTrackLabel(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;

  const pack = getPack();
  const map = pack && typeof pack.track_labels === "object" ? pack.track_labels : null;
  if (map) {
    const exact = map[keyify(raw)];
    if (exact) return String(exact);
  }

  let out = translateAdmissionText(raw, raw);
  const fallbackRules = pack && Array.isArray(pack.track_label_fallback_replace)
    ? pack.track_label_fallback_replace
    : [];
  fallbackRules.forEach((rule) => {
    if (!Array.isArray(rule) || rule.length < 2) return;
    out = replaceInsensitive(out, String(rule[0]), String(rule[1]));
  });
  return out;
}

export function translateProgramName(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;

  const pack = getPack();
  const map = pack && typeof pack.program_names === "object" ? pack.program_names : null;
  if (!map) return raw;

  return map[keyify(raw)] || raw;
}
