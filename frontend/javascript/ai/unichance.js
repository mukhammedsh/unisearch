import {
  clamp,
  clamp01,
  toNum,
  buildUserContext,
  getUserScore,
  examWeight,
  scoreRequirement,
  scoreLanguageBundle,
  isHigherBetterExam,
  isLanguageExamKey,
  collectLanguageRequirements,
} from "./shared.js";

function getTrackKey(track, idx) {
  const id = String(track?.id || "").trim();
  if (id) return id;
  const label = String(track?.label || "").trim();
  return label ? `label:${label}` : `track:${idx}`;
}

function getTrackCost(university, track) {
  const t = toNum(track?.finance_override?.total_cost_year_usd);
  if (t !== null) return Math.max(0, t);
  const u = toNum(university?.finance?.total_cost_year_usd);
  return u !== null ? Math.max(0, u) : 0;
}

function normalizeFundingPreference(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "grant" || raw === "paid") return raw;
  return "any";
}

function getTrackFundingType(track) {
  const rawType = String(track?.funding_type || "").trim().toLowerCase();
  if (rawType === "grant" || rawType === "paid") return rawType;
  const badgeRaw = String(track?.track_badge || "").trim().toLowerCase();
  return /grant|scholar/.test(badgeRaw) ? "grant" : "paid";
}

function filterTrackEntriesByFundingPreference(tracks, fundingPreference) {
  const entries = (Array.isArray(tracks) ? tracks : []).map((track, idx) => ({ track, idx }));
  const pref = normalizeFundingPreference(fundingPreference);
  if (pref === "any") return entries;
  return entries.filter(({ track }) => getTrackFundingType(track) === pref);
}

function acceptanceScore(university) {
  let ar = toNum(university?.academics?.acceptance_rate_percent);
  if (ar === null) {
    const vals = (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
      .map((p) => toNum(p?.acceptance_rate_percent))
      .filter((v) => v !== null);
    if (vals.length) ar = vals.reduce((sum, v) => sum + v, 0) / vals.length;
  }
  if (ar === null) return 0.55;
  return clamp01(Math.sqrt(clamp(ar, 1, 100) / 100));
}

function affordabilityScore(university, track, budget) {
  if (budget === null || budget <= 0) return 0.6;
  const cost = getTrackCost(university, track);
  if (!cost) return 0.6;
  if (cost <= budget) return 1.0;

  const ratio = clamp01(budget / cost);
  const aidAny =
    !!university?.finance?.financial_aid?.merit_based ||
    !!university?.finance?.financial_aid?.need_based ||
    (Array.isArray(track?.scholarships) && track.scholarships.length > 0);

  let s = clamp(0.2 + 0.8 * Math.pow(ratio, 0.75), 0.2, 1);
  if (aidAny) s = clamp01(s + 0.08);
  return s;
}

function scholarshipBoost(track, userScores, userLanguages) {
  const list = Array.isArray(track?.scholarships) ? track.scholarships : [];
  if (!list.length) return 0;

  for (const sch of list) {
    const req = sch?.requirements || {};
    const keys = Object.keys(req);
    if (!keys.length) return 0.03;

    let ok = true;
    for (const [examId, minVal] of Object.entries(req)) {
      const user = getUserScore(userScores, examId, userLanguages);
      const higher = isHigherBetterExam(examId);
      const r = scoreRequirement(user, minVal, null, higher);
      if (!r.pass) {
        ok = false;
        break;
      }
    }
    if (ok) return 0.08;
  }
  return 0.03;
}

function chanceLevel(pct) {
  if (pct >= 80) return { id: "high", label: "High chance" };
  if (pct >= 60) return { id: "good", label: "Good chance" };
  if (pct >= 40) return { id: "medium", label: "Moderate chance" };
  return { id: "low", label: "Low chance" };
}

function hasUsableEvidence(ctx) {
  const hasScores = Object.keys(ctx?.userScores || {}).length > 0;
  if (hasScores) return true;

  const langs = Object.values(ctx?.userLanguages || {});
  for (const l of langs) {
    if (!l || typeof l !== "object") continue;
    if (l.native) return true;
    if (toNum(l.cefr) !== null) return true;
    if (Object.keys(l.exams || {}).length > 0) return true;
  }
  return false;
}

function zeroChanceResult(trackEntries) {
  const entries = Array.isArray(trackEntries) ? trackEntries : [];
  const perTrack = entries.map((entry, fallbackIdx) => {
    const track = entry?.track || entry || {};
    const idx = Number.isInteger(entry?.idx) ? entry.idx : fallbackIdx;
    return {
      trackKey: getTrackKey(track, idx),
      trackId: track?.id || "",
      trackLabel: track?.label || `Track ${idx + 1}`,
      chancePercent: 0,
      level: chanceLevel(0),
      details: {
        academic: 0,
        language: 0,
        selectivity: 0,
        affordability: 0,
        feasibilityGate: 0,
      },
    };
  });

  const best = perTrack[0] || {
    trackKey: "default",
    trackId: "default",
    trackLabel: "General admission",
    chancePercent: 0,
    level: chanceLevel(0),
    details: {},
  };

  return {
    overallChance: 0,
    level: chanceLevel(0),
    bestTrackKey: best.trackKey,
    bestTrackId: best.trackId,
    bestTrackLabel: best.trackLabel,
    tracks: perTrack,
  };
}

function scoreTrack(university, track, idx, ctx) {
  const req = (track?.requirements && typeof track.requirements === "object") ? track.requirements : {};
  const avg = (track?.stats_avg && typeof track.stats_avg === "object") ? track.stats_avg : {};
  const langBundle = collectLanguageRequirements(track);
  const hasStructuredLangReq = (langBundle.items || []).length > 0;

  let weighted = 0;
  let weights = 0;
  let hardFails = 0;
  let reqCount = 0;

  for (const [examId, minVal] of Object.entries(req)) {
    if (hasStructuredLangReq && isLanguageExamKey(examId)) continue;
    const user = getUserScore(ctx.userScores, examId, ctx.userLanguages);
    const avgVal = Object.prototype.hasOwnProperty.call(avg, examId) ? avg[examId] : null;
    const higher = isHigherBetterExam(examId);
    const r = scoreRequirement(user, minVal, avgVal, higher);
    const w = examWeight(examId);
    weighted += (r.score || 0) * w;
    weights += w;
    reqCount += 1;
    if (!r.pass) hardFails += 1;
  }

  const academicScore = weights > 0 ? (weighted / weights) : 0.65;

  const lang = scoreLanguageBundle(track, ctx.userLanguages);
  const selectivity = acceptanceScore(university);
  const affordability = affordabilityScore(university, track, ctx.budget);
  const schBoost = scholarshipBoost(track, ctx.userScores, ctx.userLanguages);

  const base = clamp01(
    (academicScore * 0.53) +
    ((lang.score || 0.5) * 0.24) +
    (selectivity * 0.13) +
    (affordability * 0.10)
  );

  const totalConstraints = reqCount + ((langBundle.items || []).length ? 1 : 0);
  const failCount = hardFails + (lang.pass ? 0 : Math.max(1, lang.hardFails || 1));
  const failRatio = totalConstraints > 0 ? clamp01(failCount / totalConstraints) : 0;

  const feasibilityGate = clamp(1 - 0.78 * failRatio, 0.18, 1);
  const chance01 = clamp01(base * feasibilityGate + schBoost);
  const chancePercent = Math.round(chance01 * 100);
  const level = chanceLevel(chancePercent);

  return {
    trackKey: getTrackKey(track, idx),
    trackId: track?.id || "",
    trackLabel: track?.label || `Track ${idx + 1}`,
    chancePercent,
    level,
    details: {
      academic: Math.round(academicScore * 100),
      language: Math.round((lang.score || 0) * 100),
      selectivity: Math.round(selectivity * 100),
      affordability: Math.round(affordability * 100),
      feasibilityGate: Math.round(feasibilityGate * 100),
    },
  };
}

export function estimateUniChance(university, profile) {
  const ctx = buildUserContext(profile || {});
  const allTracks = Array.isArray(university?.admission_tracks) && university.admission_tracks.length
    ? university.admission_tracks
    : [{ id: "default", label: "General admission", requirements: {}, stats_avg: {} }];
  const fundingType = normalizeFundingPreference(profile?.fundingType || profile?.funding_type || "any");
  const trackEntries = filterTrackEntriesByFundingPreference(allTracks, fundingType);

  // Requested behavior: if profile has no usable exam/language evidence, return 0.
  const hasEvidence = hasUsableEvidence(ctx);
  if (!hasEvidence) {
    const res = zeroChanceResult(trackEntries);
    res.missingEvidence = true;
    res.fundingType = fundingType;
    return res;
  }

  if (!trackEntries.length) {
    return {
      overallChance: 0,
      level: chanceLevel(0),
      bestTrackKey: "none",
      bestTrackId: "",
      bestTrackLabel: "No tracks for selected funding type",
      tracks: [],
      missingEvidence: false,
      fundingType,
    };
  }

  const perTrack = trackEntries.map(({ track, idx }) => scoreTrack(university, track, idx, ctx));
  perTrack.sort((a, b) => b.chancePercent - a.chancePercent);

  const best = perTrack[0] || {
    trackKey: "default",
    trackId: "default",
    trackLabel: "General admission",
    chancePercent: 0,
    level: chanceLevel(0),
    details: {},
  };

  const overallChance = best.chancePercent;

  return {
    overallChance,
    level: best.level,
    bestTrackKey: best.trackKey,
    bestTrackId: best.trackId,
    bestTrackLabel: best.trackLabel,
    tracks: perTrack,
    missingEvidence: false,
    fundingType,
  };
}
