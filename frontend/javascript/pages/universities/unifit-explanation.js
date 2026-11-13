// Plain-language explanation of a UniFit ranking in the catalog: which profile answers the list was ranked for
// and which card icons are on screen (banner legend). Pure functions; no scoring happens here.

import { parseSummaryBudget, studyLevelLabel } from "../../components/profile/profile-summary.js";

// Legend entry per card status icon, in display order: the key is the `data-legend` value written on each icon
// badge (addStatusIndicator in universities.js) and the value is the localization key of its short label.
export const LEGEND_LABEL_KEYS = {
  subject_missing: "universities.ux2.legend.subject_missing",
  subject_matched: "universities.ux2.legend.subject_matched",
  requirements_below: "universities.ux2.legend.requirements_below",
  exam_needed: "universities.ux2.legend.exam_needed",
  requirements_met: "universities.ux2.legend.requirements_met",
  no_data: "universities.ux2.legend.no_data",
  over_budget_aid: "universities.ux2.legend.over_budget_aid",
  over_budget: "universities.ux2.legend.over_budget",
  budget_check: "universities.ux2.legend.budget_check",
  within_budget: "universities.ux2.legend.within_budget",
  aid: "universities.ux2.legend.aid",
  vibe: "universities.ux2.legend.vibe",
};
const LEGEND_ORDER = Object.keys(LEGEND_LABEL_KEYS);

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

// Distinct legend entries for the icon badges found on the rendered cards ({ key, icon, tone } each).
// The same meaning with the same icon and tone is listed once; unknown keys are ignored.
export const legendEntries = (badges) => {
  const seen = new Set();
  return (Array.isArray(badges) ? badges : [])
    .filter((badge) => badge && LEGEND_LABEL_KEYS[badge.key] && badge.icon && badge.tone)
    .filter((badge) => {
      const id = `${badge.key}|${badge.icon}|${badge.tone}`;
      return !seen.has(id) && seen.add(id);
    })
    .map((badge) => ({ key: badge.key, icon: badge.icon, tone: badge.tone, labelKey: LEGEND_LABEL_KEYS[badge.key] }))
    .sort((a, b) => LEGEND_ORDER.indexOf(a.key) - LEGEND_ORDER.indexOf(b.key));
};

// Names of the exam results a card still needs, for the "exam needed" tooltip. Language rules arrive as
// alternatives (mode "any": native, CEFR, IELTS, TOEFL...), so they are named once as a language test.
export const missingExamNames = (checks, { examLabel, languageTest, joiner }) => [...new Set(
  (Array.isArray(checks) ? checks : [])
    .filter((check) => check && check.provided == null && check.status !== "met")
    .map((check) => (check.mode === "any"
      ? languageTest
      : text(check.examId || check.exam).split(" or ").map(examLabel).join(` ${joiner} `)))
    .filter(Boolean),
)];
