// Plain-language explanation of a UniFit ranking in the catalog: which profile answers the list was ranked for
// (banner) and the few reasons shown on each card ("why here"). Pure functions; no scoring happens here.
// Reasons are derived from the match data the icon badges already use (backend/app/services/ai_scoring.py).

import { parseSummaryBudget, studyLevelLabel } from "../../components/profile/profile-summary.js";

export const MAX_WHY_REASONS = 3;

const SENTIMENT_ORDER = { negative: 0, unknown: 1, positive: 2 };
const text = (value) => String(value ?? "").trim();
const isAny = (value) => !text(value) || text(value).toLowerCase() === "any";

// Catalog study-level values are the lower-case profile values ("Bachelor" -> "bachelor").
// Returns "" when the profile has no level, so the catalog keeps "All levels".
export const catalogStudyLevelFromProfile = (profile) => (isAny(profile?.studyLevel) ? "" : text(profile.studyLevel).toLowerCase());

// Values of the profile that shape the ranking, in the order the banner lists them.
export const describeRankingProfile = (profile, ctx) => {
  const p = profile && typeof profile === "object" ? profile : {};
  const { t, tFormat, formatMoney, majorLabel } = ctx;
  const parts = [];
  if (!isAny(p.studyLevel)) parts.push(studyLevelLabel(p.studyLevel, t));
  if (text(p.major)) parts.push(majorLabel ? majorLabel(text(p.major)) : text(p.major));
  const budget = parseSummaryBudget(p);
  if (budget.state === "set") {
    const currency = text(p.budgetCurrency).toUpperCase() || "USD";
    parts.push(tFormat("universities.ux2.banner.budget", { amount: formatMoney(budget.amount, currency) }));
  }
  const funding = text(p.fundingType).toLowerCase();
  if (funding === "grant") parts.push(t("profile.option.funding_grant"));
  else if (funding === "paid") parts.push(t("profile.option.funding_paid"));
  // Grades and tests are checked against published minimums, so name them too (names only, to stay short).
  if (text(p.gpa)) parts.push(`GPA ${text(p.gpa)} / ${Number(p.gpaScale) === 5 ? 5 : 4}`);
  const examName = ctx.examName || ((id) => id);
  const tests = [
    ...(Array.isArray(p.exams) ? p.exams : []).map((row) => text(row?.exam || row?.id)),
    ...(Array.isArray(p.languages) ? p.languages : []).map((row) => text(row?.exam)),
  ].filter(Boolean);
  [...new Set(tests)].forEach((id) => parts.push(examName(id)));
  return parts;
};

// Negative reasons first, then unknown, then positive; at most `limit` distinct kinds.
export const orderWhyReasons = (reasons, limit = MAX_WHY_REASONS) => {
  const seen = new Set();
  return (Array.isArray(reasons) ? reasons : [])
    .filter((reason) => reason && reason.label && !seen.has(reason.kind) && seen.add(reason.kind))
    .map((reason, index) => ({ reason, index }))
    .sort((a, b) => (SENTIMENT_ORDER[a.reason.sentiment] - SENTIMENT_ORDER[b.reason.sentiment]) || (a.index - b.index))
    .slice(0, limit)
    .map(({ reason }) => reason);
};

// Reasons for a reviewed card, taken from the icon indicators (reviewedCardIndicators) that carry kind/sentiment.
export const reviewedWhyReasons = (indicators, match, budget, t, tFormat) => {
  const reasons = [];
  (Array.isArray(indicators) ? indicators : []).forEach((indicator) => {
    if (!indicator.kind || indicator.kind === "vibe") return;
    if (indicator.kind === "requirements") {
      const { met, total } = indicator.counts || {};
      reasons.push({
        kind: "requirements",
        sentiment: met < total ? "negative" : "positive",
        label: met < total ? tFormat("universities.ux2.why.minimums_partial", { met, total }) : t("universities.ux2.why.minimums_met"),
      });
      return;
    }
    reasons.push({
      kind: indicator.kind,
      sentiment: indicator.sentiment,
      label: indicator.kind === "subject" && indicator.sentiment === "positive" ? t("universities.ux2.why.offers_subject") : indicator.label,
    });
  });
  const hasBudget = Number(budget) > 0;
  if (hasBudget && match?.finalScore != null && !reasons.some((reason) => reason.kind === "budget")) {
    reasons.push({ kind: "budget", sentiment: "unknown", label: t("universities.ux2.why.price_unknown") });
  }
  return reasons;
};

// Reasons for a legacy (not yet reviewed) card from the same flags the card badges use.
export const legacyWhyReasons = (flags, t, tFormat = (key) => t(key)) => {
  const reasons = [];
  if (flags.missingProgram) reasons.push({ kind: "subject", sentiment: "negative", label: t("universities.badge.no_matching_program") });
  else if (flags.offersSubject) reasons.push({ kind: "subject", sentiment: "positive", label: t("universities.ux2.why.offers_subject") });
  if (flags.belowRequirements) reasons.push({ kind: "requirements", sentiment: "negative", label: t("universities.badge.below_requirements") });
  // Missing exam evidence is not a failed requirement (see the banner), so it is an unknown, not a negative.
  else if (flags.conditionalExam) {
    // Name the missing exams when the checks say which ones (e.g. "UNT result needed").
    const names = Array.isArray(flags.missingExamNames) ? flags.missingExamNames.filter(Boolean) : [];
    reasons.push({
      kind: "requirements",
      sentiment: "unknown",
      label: names.length
        ? tFormat("universities.ux2.why.exam_needed_named", { exams: names.join(", ") })
        : t("universities.ux2.why.exam_needed"),
    });
  }
  else if (flags.meetsRequirements) reasons.push({ kind: "requirements", sentiment: "positive", label: t("universities.badge.requirements_met") });
  if (flags.overBudget) {
    // Say by how much, so a small overshoot ranked near the top makes sense.
    const label = flags.overBudgetBy
      ? tFormat(flags.overBudgetAid ? "universities.ux2.why.over_budget_by_aid" : "universities.ux2.why.over_budget_by", { amount: flags.overBudgetBy })
      : t(flags.overBudgetAid ? "universities.badge.over_budget_aid" : "universities.badge.over_budget");
    reasons.push({ kind: "budget", sentiment: "negative", label });
  }
  else if (flags.withinBudget) reasons.push({ kind: "budget", sentiment: "positive", label: t("universities.ux2.why.within_budget") });
  else if (flags.priceUnknown) reasons.push({ kind: "budget", sentiment: "unknown", label: t("universities.ux2.why.price_unknown") });
  return reasons;
};
