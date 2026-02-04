/* algo.js - AI sorting algorithm (Prestige ↔ Budget) */

import { loadProfile, EXAM_CONFIG, LANG_CONFIG } from "./utils.js";

/** ---------------------------
 * Helpers
 * --------------------------*/
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clamp01 = (x) => clamp(x, 0, 1);
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Conservative fallback to avoid "IELTS 10000" even if config failed to load.
const FALLBACK_LANG_EXAMS = {
  IELTS: { min: 0, max: 9, step: 0.5 },
  TOEFL: { min: 0, max: 120, step: 1 },
  TOEFL_iBT_0_120: { min: 0, max: 120, step: 1 },
  TOEFL_iBT_1_6: { min: 1, max: 6, step: 0.5 },
  Duolingo: { min: 10, max: 160, step: 1 },
  DET: { min: 10, max: 160, step: 5 },
  PTE: { min: 10, max: 90, step: 1 },
  Cambridge_C1_Advanced: { min: 160, max: 210, step: 1 },
  Cambridge: { min: 80, max: 230, step: 1 },
};

function normalizeLangCode(code) {
  return String(code || "").trim().toLowerCase();
}

function isLanguageExamKey(key) {
  const k = String(key || "").toUpperCase();
  return (
    k.includes("IELTS") ||
    k.includes("TOEFL") ||
    k.includes("DET") ||
    k.includes("DUOLINGO") ||
    k.includes("PTE") ||
    k.includes("CAMBRIDGE") ||
    k.includes("TESTDAF") ||
    k.includes("DSH") ||
    k.includes("DELF") ||
    k.includes("DALF") ||
    k.includes("TCF") ||
    k.includes("TEF") ||
    k.includes("NT2") ||
    k.includes("HSK") ||
    k.includes("JLPT") ||
    k.includes("TOPIK")
  );
}

function getExamLimits(examKey) {
  if (!examKey) return null;
  const k = String(examKey).trim();

  const examCfg = EXAM_CONFIG && EXAM_CONFIG[k] ? EXAM_CONFIG[k] : null;
  if (examCfg) return examCfg;

  // поддержка разных форматов LANG_CONFIG:
  // - LANG_CONFIG.exams[IELTS]
  // - LANG_CONFIG.language_exams_by_id[IELTS]
  const directLangCfg =
    (LANG_CONFIG && LANG_CONFIG.exams && LANG_CONFIG.exams[k]) ? LANG_CONFIG.exams[k] :
    (LANG_CONFIG && LANG_CONFIG.language_exams_by_id && LANG_CONFIG.language_exams_by_id[k]) ? LANG_CONFIG.language_exams_by_id[k] :
    null;
  if (directLangCfg) return directLangCfg;

  // основной формат из backend/data/languages.json: language_exams.{code}[]
  const groups = LANG_CONFIG?.language_exams || null;
  if (groups && typeof groups === "object") {
    for (const arr of Object.values(groups)) {
      if (!Array.isArray(arr)) continue;
      const found = arr.find((x) => String(x?.id || "").trim() === k);
      if (found) return found;
    }
  }

  return FALLBACK_LANG_EXAMS[k] || null;
}

function clampToLimits(examKey, score) {
  const v = toNum(score);
  if (v === null) return null;

  const cfg = getExamLimits(examKey);
  if (!cfg) return v;

  const min = toNum(cfg.min) ?? -Infinity;
  const max = toNum(cfg.max) ?? Infinity;
  const step = toNum(cfg.step);

  let out = clamp(v, min, max);

  // step rounding with safe base
  if (step && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    out = base + Math.round((out - base) / step) * step;
    out = clamp(out, min, max);
    out = Math.round(out * 1000) / 1000;
  }

  return out;
}

function buildUserScores(profile) {
  const scores = {};

  // Academic exams: profile.exams[] can be {id, score} or {exam, score}
  for (const it of (profile?.exams || [])) {
    const key = it?.id ?? it?.exam;
    if (!key) continue;
    const v = clampToLimits(key, it?.score);
    if (v !== null) scores[String(key)] = v;
  }

  // Language exams stored in profile.languages:
  // you used {kind:"Exam", exam:"IELTS", score:7.5}
  for (const it of (profile?.languages || [])) {
    const kind = String(it?.kind || "").toLowerCase();
    if (kind !== "exam") continue;

    const key = it?.exam ?? it?.examId ?? it?.id;
    if (!key) continue;
    const v = clampToLimits(key, it?.score);
    if (v !== null) scores[String(key)] = v;
  }

  return scores;
}

function buildUserLanguages(profile) {
  const byCode = {};

  for (const it of (profile?.languages || [])) {
    const code = normalizeLangCode(it?.code ?? it?.lang);
    const kind = String(it?.kind || "").trim().toLowerCase();
    if (!code || !kind) continue;

    if (!byCode[code]) {
      byCode[code] = { native: false, cefr: null, exams: {} };
    }

    if (kind === "native") {
      byCode[code].native = true;
      continue;
    }

    if (kind === "cefr") {
      const level = toNum(it?.level);
      if (level !== null) {
        byCode[code].cefr = byCode[code].cefr === null ? level : Math.max(byCode[code].cefr, level);
      }
      continue;
    }

    if (kind === "exam") {
      const examId = String(it?.exam ?? it?.examId ?? "").trim();
      if (!examId) continue;
      const v = clampToLimits(examId, it?.score);
      if (v === null) continue;

      const prev = byCode[code].exams[examId];
      byCode[code].exams[examId] = (prev === undefined) ? v : Math.max(prev, v);
    }
  }

  return byCode;
}

function getUserScore(userScores, key) {
  if (!userScores || !key) return null;
  const k = String(key);

  if (Object.prototype.hasOwnProperty.call(userScores, k)) return userScores[k];

  // алиасы под разные названия
  const up = k.toUpperCase();
  const aliases = {
    TOEFL: ["TOEFL_IBT", "TOEFL_iBT", "TOEFLIBT"],
    TOEFL_IBT: ["TOEFL", "TOEFL_iBT", "TOEFLIBT"],
    TOEFL_IBT_0_120: ["TOEFL", "TOEFL_IBT", "TOEFL_iBT", "TOEFLIBT"],
    TOEFL_IBT_1_6: ["TOEFL", "TOEFL_IBT", "TOEFL_iBT", "TOEFLIBT"],
    DUOLINGO: ["DET", "DUOLINGO_ENGLISH_TEST", "DUOLINGOENGLISHTEST"],
    DET: ["DUOLINGO", "DUOLINGO_ENGLISH_TEST"],
    CAMBRIDGE_C1_ADVANCED: ["CAMBRIDGE"],
  };

  const list = aliases[up] || [];
  for (const a of list) {
    const key2 = String(a);
    if (Object.prototype.hasOwnProperty.call(userScores, key2)) return userScores[key2];
  }

  return null;
}

// weight important exams slightly higher (GPA, SAT/ACT, language)
function examWeight(key) {
  const k = String(key || "").toUpperCase();
  if (k === "GPA") return 1.35;
  if (k === "SAT" || k === "ACT" || k === "UNT" || k === "ENT") return 1.25;
  if (isLanguageExamKey(k)) return 1.15;
  return 1.0;
}

/**
 * Score user vs (min, avg) in [0..1]
 * - Below min: [0..0.5] depending on proximity (penalty grows with gap)
 * - Between min and avg: [0.5..0.75]
 * - Above avg: [0.75..1]
 */
function scoreRequirement(user, min, avg) {
  const u = toNum(user);
  const mn = toNum(min);
  const av = toNum(avg);

  // no min requirement => neutral+ (doesn't block)
  if (mn === null) return { score: 0.60, hardPass: true, gap: 0 };

  // unknown user score => slight negative but does NOT hard-fail
  if (u === null) return { score: 0.42, hardPass: true, gap: 0 };

  const avgUsed = (av !== null && av >= mn) ? av : mn;

  // below min => hard fail for this requirement
  if (u < mn) {
    const ratio = mn > 0 ? (u / mn) : 0;
    const s = 0.5 * clamp01(ratio);
    const gap = mn > 0 ? (mn - u) / mn : 1;
    return { score: s, hardPass: false, gap };
  }

  // between min and avg => pass
  if (u <= avgUsed) {
    const denom = Math.max(avgUsed - mn, 1e-9);
    const t = clamp01((u - mn) / denom);
    const s = 0.5 + 0.25 * t;
    return { score: s, hardPass: true, gap: 0 };
  }

  // above avg => bonus saturating
  const bonusRange = Math.max(avgUsed * 0.15, 1e-9);
  const t = clamp01((u - avgUsed) / bonusRange);
  const s = 0.75 + 0.25 * t;
  return { score: s, hardPass: true, gap: 0 };
}

function scoreRequirementDirected(user, min, avg, higherIsBetter = true) {
  if (higherIsBetter) return scoreRequirement(user, min, avg);

  const u = (user === null || user === undefined) ? user : (-1 * Number(user));
  const mn = (min === null || min === undefined) ? min : (-1 * Number(min));
  const av = (avg === null || avg === undefined) ? avg : (-1 * Number(avg));
  return scoreRequirement(u, mn, av);
}

function isHigherBetterForExam(examId) {
  const cfg = getExamLimits(examId) || {};
  if (typeof cfg?.higher_is_better === "boolean") return cfg.higher_is_better;

  // Known inverse-scale exams: smaller level number means stronger result.
  const up = String(examId || "").toUpperCase();
  if (up.includes("JLPT")) return false;

  return true;
}

function collectLanguageRequirements(track) {
  const raw = track?.language_requirements;
  const modeRaw =
    String(track?.language_requirements_mode || track?.language_mode || "all")
      .trim()
      .toLowerCase();
  const mode = (modeRaw === "any") ? "any" : "all";

  if (!raw) return { mode, items: [] };

  // Optional structured shape:
  // { mode: "any"|"all", items: [ ... ] }
  if (typeof raw === "object" && !Array.isArray(raw) && Array.isArray(raw.items)) {
    const rawMode = String(raw.mode || mode).trim().toLowerCase();
    return {
      mode: (rawMode === "any") ? "any" : "all",
      items: raw.items.filter(Boolean),
    };
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

function pickBestLanguageEvidence(langReq, userLangState, userScores) {
  const acceptNative = !!langReq?.accept_native;
  const minCefr = toNum(langReq?.min_cefr);
  const avgCefr = toNum(langReq?.recommended_cefr ?? langReq?.avg_cefr ?? langReq?.stats_avg_cefr);

  if (acceptNative && userLangState?.native) {
    return { score: 1, hardPass: true, gap: 0 };
  }

  const candidates = [];
  if (minCefr !== null) {
    candidates.push(scoreRequirement(userLangState?.cefr, minCefr, avgCefr));
  }

  const examReq = (langReq?.requirements && typeof langReq.requirements === "object")
    ? langReq.requirements
    : ((langReq?.exams && typeof langReq.exams === "object") ? langReq.exams : {});

  const examAvg = (langReq?.stats_avg && typeof langReq.stats_avg === "object")
    ? langReq.stats_avg
    : ((langReq?.exams_avg && typeof langReq.exams_avg === "object") ? langReq.exams_avg : {});

  for (const [examId, minVal] of Object.entries(examReq)) {
    const localScore = userLangState?.exams?.[examId];
    const user = (localScore !== undefined) ? localScore : getUserScore(userScores, examId);
    const avgVal = Object.prototype.hasOwnProperty.call(examAvg, examId) ? examAvg[examId] : null;
    const higherIsBetter = isHigherBetterForExam(examId);
    candidates.push(scoreRequirementDirected(user, minVal, avgVal, higherIsBetter));
  }

  if (!candidates.length) {
    // No explicit threshold, but language item exists => mild neutral.
    return { score: 0.55, hardPass: true, gap: 0 };
  }

  candidates.sort((a, b) => {
    if (Math.abs((b.score ?? 0) - (a.score ?? 0)) > 1e-9) return (b.score ?? 0) - (a.score ?? 0);
    if (a.hardPass !== b.hardPass) return a.hardPass ? -1 : 1;
    return (a.gap ?? 0) - (b.gap ?? 0);
  });

  return candidates[0];
}

function analyzeTrack(track, userScores, userLanguages) {
  const req = track?.requirements || {};
  const avg = track?.stats_avg || {};
  const langBundle = collectLanguageRequirements(track);
  const langReqs = langBundle.items;
  const langMode = langBundle.mode;
  const hasStructuredLangReq = langReqs.length > 0;

  const keys = Object.keys(req || {});
  if (!keys.length && !langReqs.length) {
    // no requirements => treat as passable
    return { fit: 0.70, hardPassAll: true, worstGap: 0 };
  }

  let wSum = 0;
  let sSum = 0;
  let hardPassAll = true;
  let worstGap = 0;

  for (const [k, minVal] of Object.entries(req)) {
    if (hasStructuredLangReq && isLanguageExamKey(k)) continue;

    const w = examWeight(k);
    const user = getUserScore(userScores, k);
    const avgVal = Object.prototype.hasOwnProperty.call(avg, k) ? avg[k] : null;

    const r = scoreRequirement(user, minVal, avgVal);
    sSum += r.score * w;
    wSum += w;

    if (!r.hardPass) {
      hardPassAll = false;
      worstGap = Math.max(worstGap, r.gap);
    }
  }

  if (langReqs.length) {
    if (langMode === "any") {
      const candidates = [];
      for (const langReq of langReqs) {
        const code = normalizeLangCode(langReq?.code);
        if (!code) continue;
        const langState = userLanguages?.[code] || null;
        const r = pickBestLanguageEvidence(langReq, langState, userScores);
        candidates.push(r);
      }

      if (candidates.length) {
        candidates.sort((a, b) => {
          if (Math.abs((b.score ?? 0) - (a.score ?? 0)) > 1e-9) return (b.score ?? 0) - (a.score ?? 0);
          if (a.hardPass !== b.hardPass) return a.hardPass ? -1 : 1;
          return (a.gap ?? 0) - (b.gap ?? 0);
        });
        const best = candidates[0];
        const w = 1.2;
        sSum += best.score * w;
        wSum += w;
        if (!best.hardPass) {
          hardPassAll = false;
          worstGap = Math.max(worstGap, best.gap ?? 0);
        }
      }
    } else {
      for (const langReq of langReqs) {
        const code = normalizeLangCode(langReq?.code);
        if (!code) continue;

        const langState = userLanguages?.[code] || null;
        const r = pickBestLanguageEvidence(langReq, langState, userScores);
        const w = 1.2;

        sSum += r.score * w;
        wSum += w;

        if (!r.hardPass) {
          hardPassAll = false;
          worstGap = Math.max(worstGap, r.gap ?? 0);
        }
      }
    }
  }

  const fit = wSum > 0 ? (sSum / wSum) : 0.55;
  return { fit: clamp01(fit), hardPassAll, worstGap };
}

function analyzeScholarships(track, userScores) {
  const list = Array.isArray(track?.scholarships) ? track.scholarships : [];
  if (list.length === 0) {
    return { hasAny: false, bestPotential: 0, bestEligible: null, bestEligibleFit: 0 };
  }

  let bestPotential = 0;
  let bestEligible = null;
  let bestEligibleFit = 0;

  for (const sch of list) {
    const req = sch?.requirements || {};
    const keys = Object.keys(req);

    let fit = 0.60;
    let eligible = true;

    if (keys.length > 0) {
      let wSum = 0;
      let sSum = 0;
      let hardPassAll = true;

      for (const [k, minVal] of Object.entries(req)) {
        const w = examWeight(k);
        const user = getUserScore(userScores, k);
        const r = scoreRequirement(user, minVal, null);
        sSum += r.score * w;
        wSum += w;
        if (!r.hardPass) hardPassAll = false;
      }

      fit = wSum > 0 ? (sSum / wSum) : 0.60;
      eligible = hardPassAll;
    }

    bestPotential = Math.max(bestPotential, fit);

    if (eligible && fit >= bestEligibleFit) {
      bestEligibleFit = fit;
      bestEligible = sch;
    }
  }

  return { hasAny: true, bestPotential: clamp01(bestPotential), bestEligible, bestEligibleFit: clamp01(bestEligibleFit) };
}

function getUniCost(uni, track) {
  const trackCost = track?.finance_override?.total_cost_year_usd;
  const base = toNum(trackCost) ?? toNum(uni?.finance?.total_cost_year_usd) ?? 0;
  return Math.max(0, base);
}

/**
 * Prestige rank score:
 * ВАЖНО: делаем TOP-ранги более различимыми, чем линейная нормализация.
 * Используем log-scale: 1 -> ~1.0, 5 -> сильно выше, чем 17, и т.д.
 */
function getRankScoreFactory(items) {
  const ranks = items.map(u => toNum(u?.rank)).filter(x => x !== null && x > 0);
  const minRank = ranks.length ? Math.min(...ranks) : 1;
  const maxRank = ranks.length ? Math.max(...ranks) : 2000;

  const logMin = Math.log(minRank + 1);
  const logMax = Math.log(maxRank + 1);
  const denom = Math.max(logMax - logMin, 1e-9);

  return function rankScore(rank) {
    const r = toNum(rank);
    if (r === null || r <= 0) return 0.15;
    const x = 1 - ((Math.log(r + 1) - logMin) / denom);
    return clamp01(x);
  };
}

function acceptanceScore(uni) {
  const ar = toNum(uni?.academics?.acceptance_rate_percent);
  if (ar === null) return 0.35;
  // sqrt makes low acceptance hurt, but not collapse everything
  return clamp01(Math.sqrt(clamp(ar, 0, 100) / 100));
}

/**
 * Budget/affordability:
 * - if grant eligible => no penalty even if over budget
 * - if over budget + aid exists => smaller penalty
 */
function affordabilityScore(cost, budget, aidEligible, aidAny) {
  const c = toNum(cost);
  const b = toNum(budget);

  if (!c || c <= 0) return 0.55;
  if (!b || b <= 0) return 0.55;

  if (aidEligible) return 1.0;

  if (c <= b) {
    // within budget: bonus increases as it gets closer to budget (not “cheapest wins”)
    const t = clamp01(c / b); // 0..1
    return clamp01(0.60 + 0.40 * Math.pow(t, 0.70));
  }

  // over budget:
  const ratio = c / b; // >1
  let s = clamp01(1 / Math.pow(ratio, 1.8)); // smooth penalty

  // if any aid exists => soften penalty a bit
  if (aidAny) s = clamp01(s + 0.10);

  return s;
}

/**
 * Admission feasibility:
 * trackFit + acceptance + (hardFail penalty by gap)
 * This is ALWAYS important even in prestige mode.
 */
function admissionChance(trackFit, hardPassAll, worstGap, accScore) {
  let admit = clamp01(trackFit * (0.55 + 0.45 * accScore));

  if (!hardPassAll) {
    // penalty grows with gap (worstGap in 0..1)
    const gapPenalty = clamp01(1 - 1.35 * worstGap);
    admit *= (0.12 + 0.88 * gapPenalty);
  }

  return clamp01(admit);
}

/**
 * Main scoring per university:
 * - evaluates each track and picks best total
 * - ALWAYS rewards: higher admit chance + being above avg
 * - prestige/budget slider only controls preference between rank vs affordability,
 *   but feasibility still gates everything.
 */
function scoreUniversity(uni, userScores, userLanguages, budget, aiBalance, rankScoreFn) {
  const tracks = Array.isArray(uni?.admission_tracks) && uni.admission_tracks.length
    ? uni.admission_tracks
    : [{ id: "default", label: "Standard", requirements: {}, stats_avg: {}, scholarships: [] }];

  const rScore = rankScoreFn(uni?.rank);
  const acc = acceptanceScore(uni);

  let best = null;

  for (const tr of tracks) {
    const trInfo = analyzeTrack(tr, userScores, userLanguages);
    const schInfo = analyzeScholarships(tr, userScores);

    const cost = getUniCost(uni, tr);

    const aidAny =
      schInfo.hasAny ||
      !!uni?.finance?.financial_aid?.merit_based ||
      !!uni?.finance?.financial_aid?.need_based ||
      (Array.isArray(uni?.admission_tracks) && uni.admission_tracks.some(t => Array.isArray(t?.scholarships) && t.scholarships.length > 0));

    const aidEligible = !!schInfo.bestEligible;

    const admit = admissionChance(trInfo.fit, trInfo.hardPassAll, trInfo.worstGap, acc);

    // grant bonus:
    // - if eligible => strong (plus potential)
    // - if not eligible but exists => smaller
    const grantPotential = schInfo.hasAny ? schInfo.bestPotential : 0;
    const grantBonus = aidEligible
      ? clamp01(0.70 + 0.30 * grantPotential)
      : (aidAny ? clamp01(0.40 + 0.20 * grantPotential) : 0.0);

    const aff = affordabilityScore(cost, budget, aidEligible, aidAny);

    // slider weights
    const wPrestige = clamp01((toNum(aiBalance) ?? 50) / 100);
    const wBudget = 1 - wPrestige;

    // preference component:
    const pref = clamp01(wPrestige * rScore + wBudget * aff);

    // FEASIBILITY gating:
    // If user clearly doesn't meet requirements (admit very low), even prestige shouldn't put it top.
    // This is the key fix vs "prestige gives unreachable uni #1".
    const gate = Math.pow(admit, 1.15); // stronger gating

    // final total:
    // - feasibility is always important
    // - pref is controlled by slider
    // - grant helps, but cannot beat 0 admission
    const total = clamp01(
      gate * (
        0.58 * pref +
        0.32 * admit +
        0.10 * grantBonus
      )
    );

    const chosenScholar = schInfo.bestEligible;
    const amount = toNum(chosenScholar?.amount);

    const finalPrice =
      (aidEligible && amount !== null)
        ? Math.max(0, cost - amount)
        : cost;

    const matchData = {
      trackId: tr?.id || "track",
      trackLabel: tr?.label || "Standard",

      // for renderCard:
      finalPrice,
      aidAny,
      aidEligible,
      grantName: chosenScholar ? String(chosenScholar.name || "") : "",

      // useful extras (можно показывать в detail/debug):
      admitChance: admit,
      meetMinRequirements: trInfo.hardPassAll,
      costYearUSD: cost,
      grantPotential,
      grantEligible: aidEligible,
    };

    const candidate = { score: total, matchData };
    if (!best || candidate.score > best.score) best = candidate;
  }

  return best || { score: 0, matchData: { finalPrice: 0, aidAny: false, aidEligible: false, grantName: "", trackLabel: "Standard" } };
}

export function getUniSort(items, aiBalance = 50) {
  const profile = loadProfile();
  const userScores = buildUserScores(profile);
  const userLanguages = buildUserLanguages(profile);
  const userBudget = toNum(profile?.budget);
  const rankScoreFn = getRankScoreFactory(items);

  const enriched = items.map((u) => {
    const res = scoreUniversity(u, userScores, userLanguages, userBudget, aiBalance, rankScoreFn);
    return { ...u, __ai_score: res.score, matchData: res.matchData };
  });

  enriched.sort((a, b) => {
    const da = (b.__ai_score ?? 0) - (a.__ai_score ?? 0);
    if (Math.abs(da) > 1e-9) return da;

    // tie-breakers: better rank, then higher admitChance, then cheaper final price
    const ra = toNum(a.rank) ?? 999999;
    const rb = toNum(b.rank) ?? 999999;
    if (ra !== rb) return ra - rb;

    const ca = toNum(a?.matchData?.admitChance) ?? 0;
    const cb = toNum(b?.matchData?.admitChance) ?? 0;
    if (ca !== cb) return cb - ca;

    const pa = toNum(a?.matchData?.finalPrice) ?? 1e18;
    const pb = toNum(b?.matchData?.finalPrice) ?? 1e18;
    return pa - pb;
  });

  return enriched.map(({ __ai_score, ...rest }) => rest);
}
