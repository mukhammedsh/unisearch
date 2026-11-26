// Plain-language explanation of a UniFit ranking in the catalog: which profile answers the list was ranked for,
// how to summarize them on one compact toolbar line, and how card tooltips explain fit and requirements.
// Pure functions; no scoring happens here.

import { parseSummaryBudget, studyLevelLabel } from "../../components/profile/profile-summary.js";

const text = (value) => String(value ?? "").trim();
const isAny = (value) => !text(value) || text(value).toLowerCase() === "any";

// Catalog study-level values are the lower-case profile values ("Bachelor" -> "bachelor").
// Returns "" when the profile has no level, so the catalog keeps "All levels".
export const catalogStudyLevelFromProfile = (profile) => (isAny(profile?.studyLevel) ? "" : text(profile.studyLevel).toLowerCase());

// Values of the profile that shape the ranking, in priority order from broad scope to specific evidence.
export const describeRankingProfile = (profile, ctx) => {
  const p = profile && typeof profile === "object" ? profile : {};
  const { t, tFormat, formatMoney, majorLabel } = ctx;
  const parts = [];
  if (!isAny(p.studyLevel)) parts.push(studyLevelLabel(p.studyLevel, t));
  if (text(p.major)) parts.push(majorLabel ? majorLabel(text(p.major)) : text(p.major));
  else if (text(p.interests)) parts.push(t("profile.ux2.summary.subject.interests_value"));
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

// Short inline summary of the profile answers: shows up to `maxVisible` leading items and collapses any
// remaining items into `+N`, while the info tooltip keeps the complete list.
export const summarizeRankingProfile = (parts, maxVisible = 2) => {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
  const limit = Math.max(1, Number(maxVisible) || 2);
  if (list.length <= limit) return list.join(" · ");
  return `${list.slice(0, limit).join(" · ")} · +${list.length - limit}`;
};

// Preference sliders in banner/tooltip order: [UniFit factor key, `universities.tradeoff.*` label key].
const PREFERENCE_DIMENSIONS = [
  ["practice_vs_science", "focus"], ["social_vs_hardcore", "atmosphere"],
  ["city_vs_campus", "location"], ["budget_vs_prestige", "finance"],
];

// Label keys of the sliders whose university indicator sits close to the user's setting (both 0..1), so the
// preference tooltip can name what matches instead of printing raw indicator numbers. A centred slider means
// "doesn't matter" in UniFit, so it is never named; an unknown (null) indicator is skipped.
export const closePreferenceLabels = (match, tolerance = 0.15) => PREFERENCE_DIMENSIONS
  .filter(([key]) => {
    const requested = match?.userPreferences?.[key];
    const observed = match?.factors?.[key];
    return typeof requested === "number" && typeof observed === "number"
      && Math.abs(requested - 0.5) > 0.005 && Math.abs(requested - observed) <= tolerance;
  })
  .map(([, label]) => label);

// Qualitative strength tier for a 1..100% centre-origin preference slider displacement.
export const tradeoffStrengthTier = (percent) => (percent <= 33 ? "slight" : percent <= 66 ? "moderate" : "strong");

// Format a UniFit preference slider caption where 50 is centred ("Doesn't matter") and moving away from centre
// scales strength from 0 to 100% (`|value - 50| * 2`) alongside a plain-language strength tier.
export const formatTradeoffCaption = (
  value,
  { leftText, rightText, balancedText, tierLabel, formatSelected },
) => {
  const numeric = Number(value);
  const clamped = Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 50;
  if (clamped === 50) {
    return { text: balancedText, percent: 0, side: "center", tier: null };
  }
  const percent = Math.abs(clamped - 50) * 2;
  const side = clamped < 50 ? "left" : "right";
  const tier = tradeoffStrengthTier(percent);
  const sideText = side === "left" ? leftText : rightText;
  const level = tierLabel(tier);
  return {
    text: formatSelected({ side: sideText, level, percent }),
    percent,
    side,
    tier,
  };
};

// What a reviewed card still needs from the profile: one entry per missing published check, its alternatives
// joined ("SAT or ACT"). Built from the backend `missingInputs`; checks without them are skipped.
export const reviewedMissingInputs = (checks, { examLabel, joiner }) => [...new Set(
  (Array.isArray(checks) ? checks : [])
    .filter((check) => check && check.status === "missing" && Array.isArray(check.missingInputs))
    .map((check) => [...new Set(check.missingInputs
      .map((input) => (input?.field === "gpa" ? "GPA" : input?.exam ? examLabel(input.exam) : ""))
      .filter(Boolean))].join(` ${joiner} `))
    .filter(Boolean),
)];

// Earlier-format checks the profile fails: exam, published minimum and the applicant's value, for a short
// "below the minimum" tooltip line. Formatting is injected so the function stays pure.
export const unmetMinimums = (checks, { examLabel, formatValue, joiner }) => (Array.isArray(checks) ? checks : [])
  .filter((check) => check && check.status === "unmet" && check.minimum != null && check.provided != null)
  .map((check) => {
    const exam = text(check.examId || check.exam);
    return {
      exam: exam.split(" or ").map((name) => examLabel(name)).join(` ${joiner} `),
      minimum: formatValue(exam, check.minimum, "requirement"),
      provided: typeof check.provided === "string" ? examLabel(check.provided) : formatValue(exam, check.provided, "profile"),
    };
  });

// The budget as the applicant typed it ("5 200 000 ₸"), not a round trip through rounded dollars
// ("5 200 030 ₸"). `usd` is the whole-dollar budget sent to the API; the typed amount is used only while it
// still rounds to that same dollar figure, otherwise `fallback(usd)` formats the converted value.
export const exactBudgetMoney = (usd, profile, { convert, formatMoney, fallback }) => {
  const typed = Number(profile?.budget);
  const currency = text(profile?.budgetCurrency).toUpperCase() || "USD";
  if (text(profile?.budget) && Number.isFinite(typed) && typed > 0
    && Math.round(convert(typed, currency, "USD")) === Math.round(Number(usd))) {
    return formatMoney(typed, currency);
  }
  return fallback(usd);
};

// Plain budget sentence for a card tooltip. `costMin`/`costMax`/`budget` are USD; `money` formats a USD amount
// for display and `tr`/`trf` are the i18n helpers. Returns "" when there is nothing to compare.
export const budgetTooltip = ({ status, costMin, costMax = costMin, budget, tuitionOnly = false }, { money, budgetMoney = money, tr, trf }) => {
  const min = Number(costMin);
  const max = Number.isFinite(Number(costMax)) ? Number(costMax) : min;
  const limit = Number(budget);
  if (costMin == null || !Number.isFinite(min) || !(limit > 0)) return "";
  const cost = max > min ? `${money(min)} – ${money(max)}` : money(min);
  const notes = [];
  if (status === "over") {
    notes.push(trf("universities.tip.budget_over", { cost, gap: money(min - limit) }), tr("universities.tip.before_aid"));
  } else if (status === "within") {
    notes.push(trf("universities.tip.budget_within", { cost, budget: budgetMoney(limit) }));
  } else if (status === "range") {
    notes.push(trf("universities.tip.budget_range", { min: money(min), max: money(max) }));
  } else if (status === "fee_status") {
    notes.push(trf("universities.tip.budget_fee_status", { min: money(min), max: money(max) }));
  } else if (status === "level_needed") {
    notes.push(trf("universities.tip.budget_level_needed", { cost }));
  } else {
    return "";
  }
  if (tuitionOnly) notes.push(tr("universities.tip.tuition_only"));
  return notes.join(" ");
};

// Names of the exam results a card still needs, for the "exam needed" tooltip. Language rules arrive as
// alternatives (mode "any": native, CEFR, IELTS, TOEFL...), so they are named once as a language test.
export const missingExamNames = (checks, { examLabel, languageTest, joiner }) => [...new Set(
  (Array.isArray(checks) ? checks : [])
    .filter((check) => check && check.provided == null && check.status !== "met")
    .map((check) => (check.mode === "any"
      ? languageTest
      : text(check.examId || check.exam).split(" or ").map((name) => examLabel(name)).join(` ${joiner} `)))
    .filter(Boolean),
)];
