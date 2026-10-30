import { getCurrentLanguage, t } from "./i18n.js";
import { API_BASE } from "./utils.js";
import { normalizeTranslationKey } from "./utils/text.js";

const CACHE = {
  byLang: new Map(),
  inFlightByLang: new Map(),
};

function normalizeLang(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.startsWith("ru") || raw === "rus") return "rus";
  if (raw.startsWith("kk") || raw.startsWith("kaz")) return "kaz";
  return "eng";
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
  const pattern = new RegExp(`(^|[^A-Za-z])(${escaped})(?=$|[^A-Za-z])`, "gi");
  return String(text || "").replace(pattern, (_, prefix) => `${prefix}${String(replacement || "")}`);
}

async function loadLocalKazakhTranslations() {
  const url = new URL("../Localization/universities-kaz.json", import.meta.url);
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Kazakh translation bundle http ${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== "object" || !Object.keys(data.university_names || {}).length) {
    throw new Error("Kazakh translation bundle is empty");
  }
  CACHE.byLang.set("kaz", data);
  return data;
}

export function humanizeMachineLabel(value, fallback = "") {
  const raw = String(value || fallback || "").trim();
  if (!raw) return String(fallback || "");

  const spaced = raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return String(fallback || "");

  return spaced.replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

export async function loadUniversityTranslationsForLanguage(language, force = false) {
  const lang = normalizeLang(language);
  if (!force && CACHE.byLang.has(lang)) return CACHE.byLang.get(lang);

  if (!force && CACHE.inFlightByLang.has(lang)) {
    return CACHE.inFlightByLang.get(lang);
  }

  const qs = new URLSearchParams({ lang }).toString();
  const inFlight = fetch(`${API_BASE}/universities/translations?${qs}`, { cache: "no-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(`universities/translations http ${res.status}`);
      return res.json();
    })
    .then((payload) => {
      const payloadLang = normalizeLang(payload?.lang || lang);
      const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
      if (payloadLang !== lang || (lang === "kaz" && !Object.keys(data.university_names || {}).length)) {
        throw new Error(`universities/translations returned ${payloadLang} for ${lang}`);
      }
      CACHE.byLang.set(payloadLang, data);
      return data;
    })
    .catch(async () => {
      if (lang !== "kaz") return null;
      try {
        return await loadLocalKazakhTranslations();
      } catch (error) {
        console.warn("Kazakh translation data is unavailable", error);
        return null;
      }
    })
    .finally(() => {
      CACHE.inFlightByLang.delete(lang);
    });

  CACHE.inFlightByLang.set(lang, inFlight);
  return inFlight;
}

export async function initUniversityTranslations(force = false) {
  return loadUniversityTranslationsForLanguage(getCurrentLanguage(), force);
}

export function translateDataValue(group, value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;

  const map = getGroup(group);
  if (!map) return raw;
  return map[normalizeTranslationKey(raw)] || raw;
}

export function translateWord(key, fallback = "") {
  const k = String(key || "").trim();
  if (!k) return String(fallback || "");

  const pack = getPack();
  const words = pack && typeof pack.words === "object" ? pack.words : null;
  const common = pack && typeof pack.common === "object" ? pack.common : null;
  if (words && words[k] != null) return String(words[k]);
  if (common && common[k] != null) return String(common[k]);

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

export function translateUnknownField(fieldLabel, fallback = "") {
  const rawLabel = String(fieldLabel || fallback || "Data").trim() || String(fallback || "Data");
  const label = /[_-]/.test(rawLabel) ? humanizeMachineLabel(rawLabel, rawLabel) : rawLabel;
  return translateTemplate("common.placeholder_unknown", "{field} unknown", { field: label });
}

export function translateUnknownWord(key, fallback = "") {
  return translateUnknownField(translateWord(key, fallback), fallback);
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
  const source = String(fallback || university?.description || "").trim();
  if (lang === "eng") return source;

  const uniId = String(university?.id || "").trim();
  if (uniId) {
    const descriptions = getPack(lang)?.university_descriptions;
    const fromPack = String(descriptions?.[uniId] || "").trim();
    if (fromPack) return fromPack;
    const key = `university.description.${uniId}`;
    const localized = String(t(key, "") || "").trim();
    if (localized) return localized;
  }

  return source;
}

export function translateAdmissionText(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;

  const pack = getPack();
  const exact = pack && typeof pack.admission_exact === "object" ? pack.admission_exact : null;
  if (exact) {
    if (exact[raw]) return String(exact[raw]);
    const normQuotes = raw.replace(/[\u2018\u2019`]/g, "'");
    if (exact[normQuotes]) return String(exact[normQuotes]);
  }

  const rules = pack && Array.isArray(pack.admission_replace) ? pack.admission_replace : [];
  let out = raw;
  rules.forEach((rule) => {
    if (!Array.isArray(rule) || rule.length < 2) return;
    out = replaceInsensitive(out, String(rule[0]), String(rule[1]));
  });
  return out;
}

export function translateAdmissionSummary(value, { section = "" } = {}) {
  const raw = String(value || "").trim();
  if (section) return String(getPack()?.admission_summaries?.[raw]?.[section] || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;
  return String(getPack()?.admission_exact?.[raw] || "");
}

export function translateFundingAwardField(award, field, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return t("university.finance.award_unknown", "Not published");
  const awardId = String(award?.id || "").trim();
  const fieldKey = String(field || "").trim();
  if (!awardId || !fieldKey) return raw;
  const localized = translateAdmissionSummary(raw) || translateAdmissionText(raw, raw);
  return t(`university.finance.award.copy.${awardId}.${fieldKey}`, localized);
}

export function translateTrackLabel(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;

  const pack = getPack();
  const map = pack && typeof pack.track_labels === "object" ? pack.track_labels : null;
  if (map) {
    const k = normalizeTranslationKey(raw);
    if (map[k]) return String(map[k]);
    if (map[raw]) return String(map[raw]);
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
  if (map) {
    const k = normalizeTranslationKey(raw);
    if (map[k]) return String(map[k]);
    if (map[raw]) return String(map[raw]);
  }

  return raw;
}

export function translateFactSource(value, fallback = "") {
  const raw = String(value || fallback || "").trim();
  if (!raw) return String(fallback || "");
  if (normalizeLang(getCurrentLanguage()) === "eng") return raw;

  const pack = getPack();
  const map = pack && typeof pack.fact_sources === "object" ? pack.fact_sources : null;
  if (map && map[raw]) return String(map[raw]);

  const exact = pack && typeof pack.admission_exact === "object" ? pack.admission_exact : null;
  if (exact && exact[raw]) return String(exact[raw]);

  const program = translateProgramName(raw);
  if (program !== raw) return program;
  return translateAdmissionText(raw, raw);
}

export function translateFactStatus(value, fallback = "") {
  const raw = String(value || fallback || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return String(fallback || "");
  const fallbackLabel = humanizeMachineLabel(raw, raw);
  return typeof t === "function" ? t(`facts.status.${raw}`, fallbackLabel) : fallbackLabel;
}
