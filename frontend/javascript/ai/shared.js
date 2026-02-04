import { EXAM_CONFIG, LANG_CONFIG } from "../utils.js";

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const clamp01 = (x) => clamp(x, 0, 1);
export const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const FALLBACK_LANG_EXAMS = {
  IELTS: { min: 0, max: 9, step: 0.5 },
  TOEFL_iBT_0_120: { min: 0, max: 120, step: 1 },
  TOEFL_iBT_1_6: { min: 1, max: 6, step: 0.5 },
  DET: { min: 10, max: 160, step: 5 },
  PTE: { min: 10, max: 90, step: 1 },
  Cambridge_C1_Advanced: { min: 160, max: 210, step: 1 },
  TestDaF_TDN: { min: 3, max: 5, step: 1 },
  DSH_Level: { min: 1, max: 3, step: 1 },
  DELF_DALF_Level: { min: 1, max: 6, step: 1 },
  TCF_Total: { min: 0, max: 699, step: 1 },
  NT2_Programme_II: { min: 0, max: 100, step: 1 },
  HSK_Level: { min: 1, max: 6, step: 1 },
  JLPT_Level: { min: 1, max: 5, step: 1, higher_is_better: false },
  TOPIK_Level: { min: 1, max: 6, step: 1 },
};

function setBestScore(map, key, value) {
  const v = toNum(value);
  if (v === null) return;
  const k = String(key || "").trim();
  if (!k) return;
  const prev = toNum(map[k]);
  map[k] = prev === null ? v : Math.max(prev, v);
}

export function normalizeLangCode(code) {
  const raw = String(code || "").trim().toLowerCase();
  if (!raw) return "";

  if (LANG_CONFIG?.languages && Array.isArray(LANG_CONFIG.languages)) {
    const found = LANG_CONFIG.languages.find((l) => {
      const c = String(l?.code || "").trim().toLowerCase();
      const name = String(l?.name || "").trim().toLowerCase();
      const label = String(l?.label || "").trim().toLowerCase();
      const nativeName = String(l?.native_name || "").trim().toLowerCase();
      return raw === c || raw === name || raw === label || raw === nativeName;
    });
    if (found?.code) return String(found.code).trim().toLowerCase();
  }

  return raw;
}

export function buildUserContext(profile) {
  const userScores = {};
  const userLanguages = {};
  const p = profile || {};

  for (const e of (p.exams || [])) {
    const key = e?.id ?? e?.exam;
    if (!key) continue;
    setBestScore(userScores, key, e?.score);
  }

  for (const l of (p.languages || [])) {
    const code = normalizeLangCode(l?.code ?? l?.lang);
    const kind = String(l?.kind || "").trim().toLowerCase();
    if (!code || !kind) continue;

    if (!userLanguages[code]) {
      userLanguages[code] = { native: false, cefr: null, exams: {} };
    }

    if (kind === "native") {
      userLanguages[code].native = true;
      continue;
    }
    if (kind === "cefr") {
      const level = toNum(l?.level);
      if (level !== null) {
        const prev = toNum(userLanguages[code].cefr);
        userLanguages[code].cefr = prev === null ? level : Math.max(prev, level);
      }
      continue;
    }
    if (kind === "exam") {
      const examId = String(l?.exam ?? l?.examId ?? "").trim();
      if (!examId) continue;
      setBestScore(userLanguages[code].exams, examId, l?.score);
      setBestScore(userScores, examId, l?.score);
    }
  }

  return {
    userScores,
    userLanguages,
    budget: toNum(p?.budget),
  };
}

function findLangExamCfg(examId) {
  const groups = LANG_CONFIG?.language_exams || {};
  if (!groups || typeof groups !== "object") return null;
  for (const arr of Object.values(groups)) {
    if (!Array.isArray(arr)) continue;
    const found = arr.find((x) => String(x?.id || "").trim() === examId);
    if (found) return found;
  }
  return null;
}

export function getExamConfig(examId) {
  const id = String(examId || "").trim();
  if (!id) return null;

  if (EXAM_CONFIG?.[id]) return EXAM_CONFIG[id];
  if (EXAM_CONFIG?.[id.toUpperCase()]) return EXAM_CONFIG[id.toUpperCase()];

  const langCfg = findLangExamCfg(id);
  if (langCfg) return langCfg;

  return FALLBACK_LANG_EXAMS[id] || FALLBACK_LANG_EXAMS[id.toUpperCase()] || null;
}

function getExamLanguageCode(examId) {
  const id = String(examId || "").trim();
  if (!id) return "";
  const groups = LANG_CONFIG?.language_exams || {};
  if (!groups || typeof groups !== "object") return "";
  for (const [code, arr] of Object.entries(groups)) {
    if (!Array.isArray(arr)) continue;
    const found = arr.some((x) => String(x?.id || "").trim() === id);
    if (found) return normalizeLangCode(code);
  }
  return "";
}

function roundToStep(value, min, step) {
  const base = Number.isFinite(min) ? min : 0;
  const out = base + Math.round((value - base) / step) * step;
  return Math.round(out * 1000) / 1000;
}

function clampToExamConfig(value, cfg) {
  const v = toNum(value);
  if (v === null) return null;
  const min = toNum(cfg?.min);
  const max = toNum(cfg?.max);
  const step = toNum(cfg?.step);
  const lower = min === null ? -Infinity : min;
  const upper = max === null ? Infinity : max;
  let out = clamp(v, lower, upper);
  if (step !== null && step > 0) out = roundToStep(out, min ?? 0, step);
  out = clamp(out, lower, upper);
  return Math.round(out * 1000) / 1000;
}

function inferLanguageExamScoreFromEvidence(examId, userLanguages) {
  const cfg = getExamConfig(examId);
  if (!cfg) return null;

  const code = getExamLanguageCode(examId);
  if (!code) return null;
  const langState = userLanguages?.[code];
  if (!langState) return null;

  const higherIsBetter = (typeof cfg.higher_is_better === "boolean") ? cfg.higher_is_better : true;
  const min = toNum(cfg.min);
  const max = toNum(cfg.max);
  if (min === null || max === null) return null;

  // Native proficiency: map to strongest possible value for this exam scale.
  if (langState.native) {
    return higherIsBetter ? max : min;
  }

  const cefr = toNum(langState.cefr);
  if (cefr === null) return null;
  const t = clamp01((cefr - 1) / 5); // A1..C2 -> 0..1
  const raw = higherIsBetter
    ? (min + (max - min) * t)
    : (max - (max - min) * t);
  return clampToExamConfig(raw, cfg);
}

const SCORE_ALIASES = {
  TOEFL: ["TOEFL_iBT_0_120", "TOEFL_iBT_1_6", "TOEFL_iBT"],
  TOEFL_iBT: ["TOEFL_iBT_0_120", "TOEFL_iBT_1_6", "TOEFL"],
  TOEFL_iBT_0_120: ["TOEFL", "TOEFL_iBT"],
  TOEFL_iBT_1_6: ["TOEFL", "TOEFL_iBT"],
  Duolingo: ["DET"],
  DET: ["Duolingo"],
};

export function getUserScore(userScores, examId, userLanguages = null) {
  const id = String(examId || "").trim();
  if (!id) return null;

  if (toNum(userScores?.[id]) !== null) return toNum(userScores[id]);
  if (toNum(userScores?.[id.toUpperCase()]) !== null) return toNum(userScores[id.toUpperCase()]);

  const aliases = SCORE_ALIASES[id] || SCORE_ALIASES[id.toUpperCase()] || [];
  for (const a of aliases) {
    if (toNum(userScores?.[a]) !== null) return toNum(userScores[a]);
    if (toNum(userScores?.[a.toUpperCase()]) !== null) return toNum(userScores[a.toUpperCase()]);
  }

  // No explicit exam score: try inferring from language evidence (native/CEFR).
  return inferLanguageExamScoreFromEvidence(id, userLanguages);
}

export function isLanguageExamKey(examId) {
  const id = String(examId || "").trim();
  if (!id) return false;
  if (findLangExamCfg(id)) return true;

  const up = id.toUpperCase();
  return (
    up.includes("IELTS") ||
    up.includes("TOEFL") ||
    up.includes("DET") ||
    up.includes("DUOLINGO") ||
    up.includes("PTE") ||
    up.includes("CAMBRIDGE") ||
    up.includes("TESTDAF") ||
    up.includes("DSH") ||
    up.includes("DELF") ||
    up.includes("DALF") ||
    up.includes("TCF") ||
    up.includes("TEF") ||
    up.includes("NT2") ||
    up.includes("HSK") ||
    up.includes("JLPT") ||
    up.includes("TOPIK")
  );
}

export function isHigherBetterExam(examId) {
  const cfg = getExamConfig(examId) || {};
  if (typeof cfg.higher_is_better === "boolean") return cfg.higher_is_better;
  return !String(examId || "").toUpperCase().includes("JLPT");
}

export function examWeight(examId) {
  const up = String(examId || "").toUpperCase();
  if (up === "GPA") return 1.35;
  if (up === "SAT" || up === "ACT" || up === "UNT") return 1.2;
  if (isLanguageExamKey(examId)) return 1.1;
  return 1.0;
}

export function scoreRequirement(userRaw, minRaw, avgRaw, higherIsBetter = true) {
  const user = toNum(userRaw);
  const min = toNum(minRaw);
  const avg = toNum(avgRaw);

  if (min === null) return { score: 0.65, pass: true, gap: 0 };
  if (user === null) return { score: 0.2, pass: false, gap: 1 };

  const u = higherIsBetter ? user : -user;
  const mn = higherIsBetter ? min : -min;
  const avRaw = avg === null ? null : (higherIsBetter ? avg : -avg);
  const av = avRaw !== null && avRaw >= mn ? avRaw : mn;

  if (u < mn) {
    const denom = Math.max(Math.abs(mn), 1e-9);
    const ratio = clamp01(u / denom);
    return {
      score: clamp(0.05 + 0.45 * ratio, 0.02, 0.5),
      pass: false,
      gap: clamp01((mn - u) / denom),
    };
  }

  if (u <= av) {
    const t = clamp01((u - mn) / Math.max(av - mn, 1e-9));
    return { score: 0.55 + 0.25 * t, pass: true, gap: 0 };
  }

  const t = clamp01((u - av) / Math.max(Math.abs(av) * 0.2, 1e-9));
  return { score: 0.8 + 0.2 * t, pass: true, gap: 0 };
}

export function collectLanguageRequirements(track) {
  const raw = track?.language_requirements;
  const modeRaw =
    String(track?.language_requirements_mode || track?.language_mode || "all")
      .trim()
      .toLowerCase();
  const mode = modeRaw === "any" ? "any" : "all";

  if (!raw) return { mode, items: [] };

  if (typeof raw === "object" && !Array.isArray(raw) && Array.isArray(raw.items)) {
    const m = String(raw.mode || mode).trim().toLowerCase();
    return { mode: m === "any" ? "any" : "all", items: raw.items.filter(Boolean) };
  }

  if (Array.isArray(raw)) return { mode, items: raw.filter(Boolean) };

  if (typeof raw === "object") {
    const out = [];
    for (const [code, cfg] of Object.entries(raw)) {
      if (cfg && typeof cfg === "object") out.push({ code, ...cfg });
    }
    return { mode, items: out };
  }

  return { mode, items: [] };
}

function scoreSingleLanguageRequirement(langReq, userLanguages) {
  const code = normalizeLangCode(langReq?.code);
  const state = userLanguages?.[code] || null;
  if (langReq?.accept_native && state?.native) {
    return { score: 1, pass: true, gap: 0, source: "native" };
  }

  const candidates = [];

  const minCefr = toNum(langReq?.min_cefr);
  const avgCefr = toNum(langReq?.recommended_cefr ?? langReq?.avg_cefr);
  const cefrUser = toNum(state?.cefr);
  if (minCefr !== null && cefrUser !== null) {
    const r = scoreRequirement(cefrUser, minCefr, avgCefr, true);
    candidates.push({ ...r, source: "cefr" });
  }

  const req = (langReq?.requirements && typeof langReq.requirements === "object") ? langReq.requirements : {};
  const avg = (langReq?.stats_avg && typeof langReq.stats_avg === "object") ? langReq.stats_avg : {};
  for (const [examId, minVal] of Object.entries(req)) {
    const local = toNum(state?.exams?.[examId]);
    const inferredFromSameLanguage = getUserScore({}, examId, state ? { [code]: state } : null);
    const user = local !== null ? local : inferredFromSameLanguage;
    if (user === null) continue;
    const avgVal = Object.prototype.hasOwnProperty.call(avg, examId) ? avg[examId] : null;
    const higher = isHigherBetterExam(examId);
    const r = scoreRequirement(user, minVal, avgVal, higher);
    candidates.push({ ...r, source: examId });
  }

  if (!candidates.length) {
    const hasThresholds = (minCefr !== null) || Object.keys(req).length > 0;
    if (hasThresholds) return { score: 0.15, pass: false, gap: 1, source: "missing" };
    if (!state) return { score: 0.3, pass: false, gap: 1, source: "missing" };
    return { score: 0.55, pass: true, gap: 0, source: "neutral" };
  }

  const best = candidates.reduce((m, x) => Math.max(m, x.score || 0), 0);
  const avgScore = candidates.reduce((s, x) => s + (x.score || 0), 0) / Math.max(candidates.length, 1);
  const pass = candidates.some((x) => !!x.pass);
  const minGap = candidates.reduce((m, x) => Math.min(m, x.gap || 0), 1);
  return {
    score: clamp01(0.72 * best + 0.28 * avgScore),
    pass,
    gap: pass ? 0 : minGap,
    source: "combined",
  };
}

export function scoreLanguageBundle(track, userLanguages) {
  const bundle = collectLanguageRequirements(track);
  const list = bundle.items || [];
  if (!list.length) return { score: 0.72, pass: true, hardFails: 0 };

  if (bundle.mode === "any") {
    const options = list.map((lr) => scoreSingleLanguageRequirement(lr, userLanguages));
    options.sort((a, b) => (b.score || 0) - (a.score || 0));
    const best = options[0] || { score: 0.15, pass: false, hardFails: 1 };
    return { score: best.score || 0, pass: !!best.pass, hardFails: best.pass ? 0 : 1 };
  }

  let s = 0;
  let c = 0;
  let pass = true;
  let hardFails = 0;
  for (const lr of list) {
    const r = scoreSingleLanguageRequirement(lr, userLanguages);
    s += r.score || 0;
    c += 1;
    if (!r.pass) {
      pass = false;
      hardFails += 1;
    }
  }
  return { score: c ? s / c : 0.2, pass, hardFails };
}
