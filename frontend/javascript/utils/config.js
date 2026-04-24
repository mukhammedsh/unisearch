import { API_BASE, debounce } from "./runtime.js";
import { formatPlural } from "./format.js";
import { getUiLanguageForApi, normalizeUiLanguageForApi } from "./locale.js";

const DEFAULT_EXAM_CONFIG = {
  SAT: { label: "SAT", labels: { eng: "SAT", rus: "SAT" }, input_mode: "number", min: 400, max: 1600, type: "int", step: 10 },
  ACT: { label: "ACT", labels: { eng: "ACT", rus: "ACT" }, input_mode: "number", min: 1, max: 36, type: "int", step: 1 },
  GPA: { label: "GPA", labels: { eng: "GPA", rus: "GPA" }, input_mode: "number", min: 0, max: 100, type: "int", step: 1 },
  IELTS: { min: 0, max: 9, type: "float", step: 0.5 },
  TOEFL: { min: 0, max: 120, type: "int", step: 1 },
  UNT: { label: "UNT (Kazakhstan)", labels: { eng: "UNT (Kazakhstan)", rus: "Р•РќРў" }, input_mode: "number", min: 0, max: 140, type: "int", step: 1 },
  NUET: { label: "NUET", labels: { eng: "NUET", rus: "NUET" }, input_mode: "number", min: 0, max: 240, type: "int", step: 1 },
  AP_Total: { label: "AP Total", labels: { eng: "AP Total", rus: "AP (РѕР±С‰РёР№ Р±Р°Р»Р»)" }, input_mode: "number", min: 0, max: 25, type: "int", step: 1 },
  IB_Diploma: { label: "IB Diploma", labels: { eng: "IB Diploma", rus: "Р”РёРїР»РѕРј IB" }, input_mode: "number", min: 24, max: 45, type: "int", step: 1 },
  A_LEVEL_CERT: {
    label: "A-Level",
    labels: { eng: "A-Level", rus: "РћС†РµРЅРєРё A-Level" },
    input_mode: "grade_combo",
    min: 0,
    max: 18,
    type: "int",
    step: 1,
    grade_scheme: { subject_count_min: 3, subject_count_max: 4, best_of: 3, grades: ["A*", "A", "B", "C", "D", "E", "U"] },
  },
  HKDSE_LEVEL: {
    label: "HKDSE Level",
    labels: { eng: "HKDSE Level", rus: "РЈСЂРѕРІРµРЅСЊ HKDSE" },
    input_mode: "band_select",
    min: 1,
    max: 7,
    type: "int",
    step: 1,
    level_scheme: {
      bands: [
        { value: 1, short_label: "1" },
        { value: 2, short_label: "2" },
        { value: 3, short_label: "3" },
        { value: 4, short_label: "4" },
        { value: 5, short_label: "5" },
        { value: 6, short_label: "5*" },
        { value: 7, short_label: "5**" },
      ],
    },
  },
  HKDSE_WEIGHTED_TOTAL: {
    label: "HKDSE Weighted Total (CUHK JUPAS)",
    labels: { eng: "HKDSE Weighted Total (CUHK JUPAS)", rus: "Р’Р·РІРµС€РµРЅРЅС‹Р№ СЃСѓРјРјР°СЂРЅС‹Р№ Р±Р°Р»Р» HKDSE (CUHK JUPAS)" },
    input_mode: "number",
    min: 0,
    max: 47.25,
    type: "float",
    step: 0.01,
  },
  EGE: { label: "EGE", labels: { eng: "EGE", rus: "Р•Р“Р­" }, input_mode: "number", min: 0, max: 100, type: "int", step: 1 },
  SWISS_MATURITY_CERT: { label: "Swiss Maturity Certificate", labels: { eng: "Swiss Maturity Certificate", rus: "РЁРІРµР№С†Р°СЂСЃРєРёР№ Р°С‚С‚РµСЃС‚Р°С‚ Р·СЂРµР»РѕСЃС‚Рё" }, input_mode: "flag", min: 0, max: 1, type: "bool", step: 1 },
  GERMAN_ABITUR_CERT: { label: "German Abitur Certificate", labels: { eng: "German Abitur Certificate", rus: "РќРµРјРµС†РєРёР№ Р°С‚С‚РµСЃС‚Р°С‚ Abitur" }, input_mode: "flag", min: 0, max: 1, type: "bool", step: 1 },
  OSSD_CERT: { label: "OSSD (Ontario Secondary School Diploma)", labels: { eng: "OSSD (Ontario Secondary School Diploma)", rus: "OSSD (РґРёРїР»РѕРј Рѕ СЃСЂРµРґРЅРµРј РѕР±СЂР°Р·РѕРІР°РЅРёРё РћРЅС‚Р°СЂРёРѕ)" }, input_mode: "flag", min: 0, max: 1, type: "bool", step: 1 },
};

const EXAM_KEY_ALIASES = {
  NUET: ["NUET_TOTAL", "NUETTOTAL"],
  NUET_TOTAL: ["NUET", "NUETTOTAL"],
  NUETTOTAL: ["NUET", "NUET_TOTAL"],
  TOEFL: ["TOEFL_IBT", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
  TOEFL_IBT: ["TOEFL", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
  WEIGHTED_TOTAL: ["HKDSE_WEIGHTED_TOTAL"],
  HKDSE_WEIGHTED_TOTAL: ["WEIGHTED_TOTAL"],
};

const EXAM_VALUE_LABELS = {
  eng: { added: "Added", required: "Required", level: "Level", total: "Total", points: ["pt", "pts"] },
  rus: { added: "Р”РѕР±Р°РІР»РµРЅРѕ", required: "РўСЂРµР±СѓРµС‚СЃСЏ", level: "РЈСЂРѕРІРµРЅСЊ", total: "РћР±С‰РёР№ Р±Р°Р»Р»", points: ["Р±Р°Р»Р»", "Р±Р°Р»Р»Р°", "Р±Р°Р»Р»РѕРІ"] },
};

const EXAM_LABEL_OVERRIDES = {
  SAT: "SAT Total",
  SAT_MATH: "SAT Math",
  SAT_EBRW: "SAT EBRW",
  ACT: "ACT",
  GPA: "GPA",
  UNT: "UNT (Р•РќРў)",
  NUET_Total: "NUET",
  NUET: "NUET",
  NUET_TOTAL: "NUET",
  AP_Total: "AP Total",
  AP_CALCULUS_AB: "AP Calculus AB",
  AP_CALCULUS_BC: "AP Calculus BC",
  AP_COMPUTER_SCIENCE_A: "AP Computer Science A",
  AP_PHYSICS_C_MECHANICS: "AP Physics C: Mechanics",
  AP_PHYSICS_C_ELECTRICITY_MAGNETISM: "AP Physics C: Electricity and Magnetism",
  AP_CHEMISTRY: "AP Chemistry",
  AP_BIOLOGY: "AP Biology",
  IB_Diploma: "IB Total",
  IB_MATHEMATICS_HL: "IB Mathematics HL",
  IB_PHYSICS_HL: "IB Physics HL",
  IB_CHEMISTRY_HL: "IB Chemistry HL",
  IB_BIOLOGY_HL: "IB Biology HL",
  IB_COMPUTER_SCIENCE_HL: "IB Computer Science HL",
  A_LEVEL_CERT: "A-Level Total",
  A_LEVEL_MATHEMATICS: "A-Level Mathematics",
  A_LEVEL_FURTHER_MATHEMATICS: "A-Level Further Mathematics",
  A_LEVEL_PHYSICS: "A-Level Physics",
  A_LEVEL_CHEMISTRY: "A-Level Chemistry",
  A_LEVEL_BIOLOGY: "A-Level Biology",
  A_LEVEL_COMPUTER_SCIENCE: "A-Level Computer Science",
  HKDSE_WEIGHTED_TOTAL: "HKDSE Weighted Total (CUHK JUPAS)",
  IELTS: "IELTS Academic",
  TOEFL_iBT_0_120: "TOEFL iBT (0вЂ‘120)",
  TOEFL_iBT_1_6: "TOEFL iBT (1вЂ‘6)",
  DET: "Duolingo English Test (DET)",
  PTE: "PTE Academic",
  Cambridge_C1_Advanced: "Cambridge C1 Advanced",
  TestDaF_TDN: "TestDaF (TDN)",
  DSH_Level: "DSH Level",
  DELF_DALF_Level: "DELF/DALF Level",
  TCF_Total: "TCF Total",
  NT2_Programme_II: "NT2 Programme II",
  HSK_Level: "HSK Level",
  JLPT_Level: "JLPT Level",
  TOPIK_Level: "TOPIK Level",
};

const EXAM_LABELS_I18N = {
  eng: {
    SAT: "SAT",
    ACT: "ACT",
    GPA: "GPA",
    UNT: "UNT (Kazakhstan)",
    NUET: "NUET",
    NUETTOTAL: "NUET",
    APTOTAL: "AP",
    IBDIPLOMA: "IB Diploma",
    ALEVELCERT: "A-Level",
    HKDSELEVEL: "HKDSE",
    HKDSEWEIGHTEDTOTAL: "HKDSE Weighted Total (CUHK JUPAS)",
    SWISSMATURITYCERT: "Swiss Maturity Certificate",
    GERMANABITURCERT: "German Abitur Certificate",
    OSSDCERT: "OSSD (Ontario Secondary School Diploma)",
    IELTS: "IELTS Academic",
    TOEFLIBT0120: "TOEFL iBT Total (0-120, legacy)",
    TOEFLIBT16: "TOEFL iBT Band (1-6, since Jan 21, 2026)",
    DET: "Duolingo English Test (DET)",
    PTE: "PTE Academic",
    CAMBRIDGEC1ADVANCED: "Cambridge C1 Advanced",
    TESTDAFTDN: "TestDaF (TDN level)",
    DSHLEVEL: "DSH level",
    DELFDALFLEVEL: "DELF/DALF level",
    TCFTOTAL: "TCF total score",
    NT2PROGRAMMEII: "NT2 Programme II",
    HSKLEVEL: "HSK level",
    JLPTLEVEL: "JLPT level",
    TOPIKLEVEL: "TOPIK level",
  },
  rus: {
    SAT: "SAT",
    ACT: "ACT",
    GPA: "GPA",
    UNT: "Р•РќРў",
    NUET: "NUET",
    NUETTOTAL: "NUET",
    APTOTAL: "AP",
    IBDIPLOMA: "Р”РёРїР»РѕРј IB",
    ALEVELCERT: "A-Level",
    HKDSELEVEL: "HKDSE",
    HKDSEWEIGHTEDTOTAL: "Р’Р·РІРµС€РµРЅРЅС‹Р№ СЃСѓРјРјР°СЂРЅС‹Р№ Р±Р°Р»Р» HKDSE (CUHK JUPAS)",
    SWISSMATURITYCERT: "РЁРІРµР№С†Р°СЂСЃРєРёР№ Р°С‚С‚РµСЃС‚Р°С‚ Р·СЂРµР»РѕСЃС‚Рё",
    GERMANABITURCERT: "РќРµРјРµС†РєРёР№ Р°С‚С‚РµСЃС‚Р°С‚ Abitur",
    OSSDCERT: "OSSD (РґРёРїР»РѕРј Рѕ СЃСЂРµРґРЅРµРј РѕР±СЂР°Р·РѕРІР°РЅРёРё РћРЅС‚Р°СЂРёРѕ)",
    IELTS: "IELTS (Р°РєР°РґРµРјРёС‡РµСЃРєРёР№ РјРѕРґСѓР»СЊ)",
    TOEFLIBT0120: "TOEFL iBT РѕР±С‰РёР№ Р±Р°Р»Р» (0вЂ‘120, СЃС‚Р°СЂР°СЏ С€РєР°Р»Р°)",
    TOEFLIBT16: "TOEFL iBT (С€РєР°Р»Р° 1вЂ‘6, СЃ 21 СЏРЅРІ. 2026)",
    DET: "Duolingo English Test (DET)",
    PTE: "PTE Academic",
    CAMBRIDGEC1ADVANCED: "Cambridge C1 Advanced",
    TESTDAFTDN: "TestDaF (СѓСЂРѕРІРµРЅСЊ TDN)",
    DSHLEVEL: "РЈСЂРѕРІРµРЅСЊ DSH",
    DELFDALFLEVEL: "РЈСЂРѕРІРµРЅСЊ DELF/DALF",
    TCFTOTAL: "РћР±С‰РёР№ Р±Р°Р»Р» TCF",
    NT2PROGRAMMEII: "NT2 Programme II",
    HSKLEVEL: "РЈСЂРѕРІРµРЅСЊ HSK",
    JLPTLEVEL: "РЈСЂРѕРІРµРЅСЊ JLPT",
    TOPIKLEVEL: "РЈСЂРѕРІРµРЅСЊ TOPIK",
  },
};

export const MAJOR_OPTIONS = [
  "Computer Science",
  "Engineering",
  "Business",
  "Medicine",
  "Natural Sciences",
  "Economics",
  "Physics",
  "Mathematics",
  "Law",
  "Social Sciences",
  "Architecture",
  "Psychology",
  "Humanities",
  "Design",
  "Life Sciences",
  "Education",
  "Agriculture",
];

export const FALLBACK_LANG_LIMITS = {
  IELTS: { min: 0, max: 9, step: 0.5 },
  TOEFL: { min: 0, max: 120, step: 1 },
  Duolingo: { min: 10, max: 160, step: 1 },
  DET: { min: 10, max: 160, step: 1 },
  Cambridge: { min: 80, max: 230, step: 1 },
  PTE: { min: 10, max: 90, step: 1 },
};

function cloneDefaultExamConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_EXAM_CONFIG));
}

export let EXAM_CONFIG = cloneDefaultExamConfig();
export let LANG_CONFIG = null;
export let CITY_OPTIONS_BY_COUNTRY = {};

let examConfigPromise = null;
let langConfigPromise = null;
let cityDbPromise = null;

function canonicalExamKey(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function examConfigLocale(value = "") {
  return normalizeUiLanguageForApi(value) || getUiLanguageForApi();
}

export function canonicalizeExamId(examId) {
  const raw = String(examId || "").trim().toUpperCase();
  if (!raw) return "";

  if (EXAM_CONFIG?.[raw]) return raw;
  const rawCanon = canonicalExamKey(raw);
  for (const key of Object.keys(EXAM_CONFIG || {})) {
    if (canonicalExamKey(key) === rawCanon) return key;
  }

  for (const aliasValue of EXAM_KEY_ALIASES[raw] || []) {
    const alias = String(aliasValue || "").trim().toUpperCase();
    if (EXAM_CONFIG?.[alias]) return alias;
    const aliasCanon = canonicalExamKey(alias);
    for (const key of Object.keys(EXAM_CONFIG || {})) {
      if (canonicalExamKey(key) === aliasCanon) return key;
    }
  }

  return raw;
}

export function getExamConfig(examId) {
  const raw = String(examId || "").trim();
  if (!raw) return null;
  const id = canonicalizeExamId(raw);
  return EXAM_CONFIG?.[id] || EXAM_CONFIG?.[raw] || EXAM_CONFIG?.[raw.toUpperCase()] || null;
}

export function getExamInputMode(examId) {
  const config = getExamConfig(examId);
  const raw = String(config?.input_mode || "").trim().toLowerCase();
  if (raw) return raw;
  if (String(config?.type || "").trim().toLowerCase() === "bool") return "flag";
  return "number";
}

export function getExamLevelBands(examId) {
  const bands = getExamConfig(examId)?.level_scheme?.bands;
  return Array.isArray(bands) ? bands : [];
}

export function getExamBandShortLabel(examId, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  const match = getExamLevelBands(examId).find((row) => Number(row?.value) === numericValue);
  return String(match?.short_label || "").trim();
}

export async function ensureExamConfig() {
  if (!examConfigPromise) {
    examConfigPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/exams/config`);
        if (!response.ok) throw new Error("Failed to load exam config");
        const raw = await response.json();
        EXAM_CONFIG = raw?.exams ? raw.exams : raw;
        window.dispatchEvent(new Event("examConfigLoaded"));
      } catch (error) {
        console.error("Error loading exam config:", error);
        EXAM_CONFIG = cloneDefaultExamConfig();
      }
      return EXAM_CONFIG;
    })();
  }
  return examConfigPromise;
}

export async function ensureLanguageConfig() {
  if (!langConfigPromise) {
    langConfigPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/languages/config`);
        if (!response.ok) throw new Error("Failed to load language config");
        LANG_CONFIG = await response.json();
        window.dispatchEvent(new Event("languageConfigLoaded"));
      } catch (error) {
        console.error("Error loading language config:", error);
        LANG_CONFIG = null;
      }
      return LANG_CONFIG;
    })();
  }
  return langConfigPromise;
}

export async function ensureCityDatabase() {
  if (!cityDbPromise) {
    cityDbPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/locations`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        CITY_OPTIONS_BY_COUNTRY = await response.json();
        window.dispatchEvent(new Event("citiesLoaded"));
      } catch (error) {
        console.error("Error loading cities:", error);
      }
      return CITY_OPTIONS_BY_COUNTRY;
    })();
  }
  return cityDbPromise;
}

function formatCompositeExamValue(examId, entry, words, options = {}) {
  if (!entry || typeof entry !== "object") return "";
  const scheme = getExamConfig(examId)?.breakdown_scheme;
  if (!scheme || typeof scheme !== "object") return "";

  const components = Array.isArray(entry?.details?.components) ? entry.details.components : [];
  const extraScores = Array.isArray(entry?.details?.extra_scores) ? entry.details.extra_scores : [];
  if (!components.length && !extraScores.length) return "";

  const totalStrategy = String(scheme?.total_strategy || "").trim().toLowerCase();
  const totalLabelRaw = String(scheme?.parent_score_label || "").trim();
  const totalLabel = /^(total|overall)$/i.test(totalLabelRaw)
    ? (words.total || "Total")
    : (totalLabelRaw || words.total || "Total");
  const parts = [];

  if (totalStrategy === "use_parent_score" && Number.isFinite(Number(entry?.score))) {
    parts.push(`${totalLabel} ${entry.score}`);
  }

  [...components, ...extraScores].forEach((item) => {
    if (!item || typeof item !== "object") return;
    const childExam = String(item.exam || item.id || "").trim();
    if (!childExam) return;
    const value = formatExamValue(childExam, item, { ...options, includeLevelPrefix: false });
    if (!value) return;
    parts.push(`${getExamDisplayName(childExam, options)} ${value}`);
  });

  return parts.join(", ");
}

export function formatExamValue(examId, valueOrEntry, options = {}) {
  const locale = examConfigLocale(options?.locale || options?.lang || "");
  const words = EXAM_VALUE_LABELS[locale] || EXAM_VALUE_LABELS.eng;
  const entry = valueOrEntry && typeof valueOrEntry === "object" && !Array.isArray(valueOrEntry) ? valueOrEntry : null;
  const rawValue = String(entry?.display_value || entry?.displayValue || entry?.raw_value || entry?.rawValue || "").trim();
  const score = entry ? entry?.score : valueOrEntry;
  const mode = getExamInputMode(examId);
  const normalizedId = canonicalizeExamId(examId);

  if (mode === "subject_breakdown") {
    const composite = formatCompositeExamValue(examId, entry, words, options);
    if (composite) return composite;
  }
  if (rawValue) return rawValue;
  if (mode === "flag") return options?.context === "requirement" ? words.required : words.added;
  if (mode === "grade_combo" && Number(score) <= 1) return options?.context === "requirement" ? words.required : words.added;

  if (mode === "grade_combo" && Number.isFinite(Number(score))) {
    const scheme = getExamConfig(examId)?.grade_scheme || {};
    const isSingleSubject = Number(scheme?.subject_count_min) === 1 && Number(scheme?.subject_count_max) === 1 && Number(scheme?.best_of) === 1;
    if (isSingleSubject && scheme?.grade_points && typeof scheme.grade_points === "object") {
      const inverted = Object.entries(scheme.grade_points).find(([, pts]) => Number(pts) === Number(score));
      if (inverted?.[0]) return String(inverted[0]);
    }
  }

  if (mode === "band_select") {
    const band = getExamBandShortLabel(examId, score);
    if (band) return options?.includeLevelPrefix === false ? band : `${words.level} ${band}`;
  }

  if (normalizedId === "GPA" && Number.isFinite(Number(score))) return `${score}%`;

  const canonId = canonicalExamKey(normalizedId);
  const needsPointsSuffix = ["ALEVELCERT", "APTOTAL", "IBDIPLOMA", "NUETTOTAL", "NUET", "HKDSEWEIGHTEDTOTAL"].includes(canonId);
  if (needsPointsSuffix && Number.isFinite(Number(score)) && Number(score) > 0) {
    return `${score} ${formatPlural(score, words.points, locale)}`;
  }

  return String(score ?? "").trim();
}

function localizedExamLabel(examId, locale = "") {
  const lang = normalizeUiLanguageForApi(locale) || getUiLanguageForApi();
  const pack = EXAM_LABELS_I18N[lang] || EXAM_LABELS_I18N.eng;
  const fallbackPack = EXAM_LABELS_I18N.eng;
  const candidates = [
    canonicalExamKey(examId),
    canonicalExamKey(canonicalizeExamId(examId)),
    canonicalExamKey(String(examId || "").toUpperCase()),
  ].filter(Boolean);

  for (const key of candidates) {
    if (pack[key]) return pack[key];
  }
  for (const key of candidates) {
    if (fallbackPack[key]) return fallbackPack[key];
  }
  return "";
}

function humanizeExamId(examId) {
  return String(examId || "").trim()
    .replaceAll("_", " ")
    .replace(/\bIbt\b/g, "iBT")
    .replace(/\bNuet\b/g, "NUET")
    .replace(/\bDsh\b/g, "DSH")
    .replace(/\bTdn\b/g, "TDN")
    .replace(/\bJlpt\b/g, "JLPT")
    .replace(/\bTopik\b/g, "TOPIK")
    .replace(/\bHsk\b/g, "HSK")
    .replace(/\bTcf\b/g, "TCF")
    .replace(/\bDelf\b/g, "DELF")
    .replace(/\bDalf\b/g, "DALF");
}

function getLangExamLabel(examId, langCode = "") {
  const targetId = String(examId || "").trim();
  if (!targetId) return "";

  const groups = LANG_CONFIG?.language_exams;
  if (!groups || typeof groups !== "object") return "";
  const code = String(langCode || "").trim().toLowerCase();
  if (code && Array.isArray(groups[code])) {
    const found = groups[code].find((row) => String(row?.id || "").trim() === targetId);
    if (found?.label) return String(found.label);
  }
  for (const items of Object.values(groups)) {
    if (!Array.isArray(items)) continue;
    const found = items.find((row) => String(row?.id || "").trim() === targetId);
    if (found?.label) return String(found.label);
  }
  return "";
}

export function getExamDisplayName(examId, options = {}) {
  const raw = String(examId || "").trim();
  if (!raw) return "";
  const id = canonicalizeExamId(raw);
  const uiLocale = String(options?.locale || options?.lang || options?.uiLang || "").trim();
  const config = getExamConfig(id || raw);
  const cfgLabels = config?.labels && typeof config.labels === "object" ? config.labels : null;
  const localeKey = examConfigLocale(uiLocale);

  const localized = localizedExamLabel(id || raw, uiLocale);
  if (localized) return localized;
  if (cfgLabels?.[localeKey]) return String(cfgLabels[localeKey]).trim();
  if (config?.label) return String(config.label).trim();

  const langLabel = getLangExamLabel(raw, options.langCode || "");
  if (langLabel) return langLabel;

  return EXAM_LABEL_OVERRIDES[id] || EXAM_LABEL_OVERRIDES[raw] || EXAM_LABEL_OVERRIDES[raw.toUpperCase()] || humanizeExamId(raw);
}

export function getLangExamLimits(examId, langConfig = LANG_CONFIG) {
  const exams = langConfig?.language_exams;
  if (!exams) return null;
  for (const locale of Object.keys(exams)) {
    const rows = exams[locale];
    if (!Array.isArray(rows)) continue;
    const found = rows.find((row) => row?.id === examId);
    if (found) return { min: found.min, max: found.max, step: found.step };
  }
  return null;
}

export function clampNumberToLimits(value, limits) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  if (!limits) return amount;

  let out = amount;
  const min = Number(limits.min);
  const max = Number(limits.max);
  const step = Number(limits.step);

  if (Number.isFinite(min)) out = Math.max(min, out);
  if (Number.isFinite(max)) out = Math.min(max, out);
  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    out = base + Math.round((out - base) / step) * step;
    if (Number.isFinite(min)) out = Math.max(min, out);
    if (Number.isFinite(max)) out = Math.min(max, out);
    out = Math.round(out * 1000) / 1000;
  }
  return out;
}

export function applyNumberInputLimits(inputEl, limits) {
  if (!inputEl) return;
  if (!limits) {
    inputEl.removeAttribute("min");
    inputEl.removeAttribute("max");
    inputEl.removeAttribute("step");
    return;
  }
  if (limits.min !== undefined) inputEl.min = String(limits.min);
  if (limits.max !== undefined) inputEl.max = String(limits.max);
  if (limits.step !== undefined) inputEl.step = String(limits.step);
}

export function applyLanguageExamInputLimits(inputEl, examId) {
  const limits = getLangExamLimits(examId, LANG_CONFIG) || FALLBACK_LANG_LIMITS[examId] || null;
  applyNumberInputLimits(inputEl, limits);
  return limits;
}

export { debounce };
