// Pure helpers that describe how the current profile draft is used by UniFit.
// Every sentence mirrors behaviour of backend/app/services/ai_scoring.py and the catalog code;
// keep the two in sync when either side changes.

import { withoutBracketedText } from "../../utils/text.js";

const LEVEL_LABEL_KEYS = {
  preparation: "profile.option.study_level_preparation",
  bachelor: "profile.option.study_level_bachelor",
  master: "profile.option.study_level_master",
  doctorate: "profile.option.study_level_doctorate",
  mba: "profile.option.study_level_mba",
  professional: "profile.option.study_level_professional",
  residency: "profile.option.study_level_residency",
  non_degree: "profile.option.study_level_non_degree",
};

const text = (value) => String(value ?? "").trim();
const isAny = (value) => !text(value) || text(value).toLowerCase() === "any";
const asList = (value) => (Array.isArray(value) ? value : []);

export const parseSummaryBudget = (profile) => {
  const raw = text(profile?.budget).replace(/\s+/g, "");
  if (!raw) return { state: "empty", amount: null };
  if (raw.includes(".") || raw.includes(",")) return { state: "empty", amount: null };
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return { state: "empty", amount: null };
  // The ranking ignores a budget of zero (ai_scoring.py: `budget > 0`).
  return amount > 0 ? { state: "set", amount } : { state: "zero", amount };
};

export const studyLevelLabel = (value, t) => {
  const key = LEVEL_LABEL_KEYS[text(value).toLowerCase()];
  return key ? t(key, text(value)) : text(value);
};

// "IELTS (academic module)" -> "IELTS": the summary lists what is counted, not the full exam title.
export const shortExamLabel = (label) => {
  const full = text(label);
  const short = withoutBracketedText(full);
  return short || full;
};

const hasExamEvidence = (profile) => asList(profile?.exams).some((row) => row && (row.exam || row.id));
const hasLanguageEvidence = (profile) => asList(profile?.languages).some((row) => row && (row.code || row.lang));

// Which of the five page sections already hold an answer (outline markers).
export const buildSectionFillStates = (profile) => {
  const p = profile && typeof profile === "object" ? profile : {};
  return {
    basics: !isAny(p.studyLevel) || !!text(p.major) || !!text(p.interests) || !isAny(p.studyMode),
    preferences: parseSummaryBudget(p).state !== "empty" || !isAny(p.fundingType),
    scores: !!text(p.gpa) || hasExamEvidence(p),
    languages: hasLanguageEvidence(p),
    specific: asList(p.languageEvidence).length > 0 || asList(p.institutionalEvidence).length > 0,
  };
};

export const buildProfileSummary = (profile, ctx = {}) => {
  const p = profile && typeof profile === "object" ? profile : {};
  const t = ctx.t || ((key, fallback) => fallback || key);
  const tFormat = ctx.tFormat || ((key, params, fallback) => fallback || key);
  const formatMoney = ctx.formatMoney || ((amount, currency) => `${amount} ${currency}`);
  const majorLabel = ctx.majorLabel || ((major) => major);
  const row = (id, state, titleKey, detailKey, value = "") => ({
    id,
    state,
    title: t(titleKey),
    value,
    detail: Array.isArray(detailKey) ? detailKey.map((key) => t(key)).join(" ") : t(detailKey),
  });

  const rows = [];

  // Study level: filters the UniFit list and scopes prices and requirements.
  rows.push(isAny(p.studyLevel)
    ? row("level", "not_used", "profile.ux2.summary.level.title", "profile.ux2.summary.level.unused")
    : row("level", "used", "profile.ux2.summary.level.title", "profile.ux2.summary.level.used", studyLevelLabel(p.studyLevel, t)));

  // Subject and interests: a missing program lowers the rank; interests need the language model.
  const major = text(p.major);
  const interests = text(p.interests);
  const subjectDetails = [];
  if (major) subjectDetails.push("profile.ux2.summary.subject.major");
  if (interests) subjectDetails.push("profile.ux2.summary.subject.interests");
  rows.push(subjectDetails.length
    ? row("subject", "used", "profile.ux2.summary.subject.title", subjectDetails,
      major ? majorLabel(major) : t("profile.ux2.summary.subject.interests_value"))
    : row("subject", "not_used", "profile.ux2.summary.subject.title", "profile.ux2.summary.subject.unused"));

  // Budget: over-budget lowers the rank; nothing is hidden and grants are not subtracted.
  const budget = parseSummaryBudget(p);
  if (budget.state === "set") {
    const currency = text(p.budgetCurrency).toUpperCase() || "USD";
    rows.push(row("budget", "used", "profile.ux2.summary.budget.title", "profile.ux2.summary.budget.used",
      tFormat("profile.ux2.summary.budget.value", { amount: formatMoney(budget.amount, currency) })));
  } else {
    rows.push(row("budget", "not_used", "profile.ux2.summary.budget.title",
      budget.state === "zero" ? "profile.ux2.summary.budget.zero" : "profile.ux2.summary.budget.unused"));
  }

  // Funding type hides universities known to lack that option in every catalog sort, UniFit included;
  // study mode picks the compared price and only matters with a budget.
  const modeSet = !isAny(p.studyMode);
  const fundingSet = !isAny(p.fundingType);
  const formatDetails = [];
  const formatValues = [];
  if (modeSet) {
    formatDetails.push(budget.state === "set" ? "profile.ux2.summary.format.mode" : "profile.ux2.summary.format.mode_no_budget");
    formatValues.push(t(text(p.studyMode).toLowerCase() === "online"
      ? "profile.option.study_mode_online"
      : "profile.option.study_mode_oncampus"));
  }
  if (fundingSet) {
    formatDetails.push("profile.ux2.summary.format.funding");
    formatValues.push(t(text(p.fundingType).toLowerCase() === "grant"
      ? "profile.option.funding_grant"
      : "profile.option.funding_paid"));
  }
  if (!formatDetails.length) {
    rows.push(row("format", "not_used", "profile.ux2.summary.format.title", "profile.ux2.summary.format.unused"));
  } else {
    const modeIgnored = modeSet && budget.state !== "set";
    rows.push(row("format", modeIgnored ? "partial" : "used", "profile.ux2.summary.format.title", formatDetails, formatValues.join(", ")));
  }

  // GPA, exams and languages feed the minimum requirements match.
  // Echo the actual answers (e.g. "GPA 3.8 / 4, SAT 1400") so the reader sees exactly what is counted.
  const examLabel = ctx.examLabel || ((entry) => [text(entry?.exam || entry?.id), text(entry?.score)].filter(Boolean).join(" "));
  const evidence = [];
  if (text(p.gpa)) {
    evidence.push(`${t("profile.ux2.summary.requirements.gpa")} ${text(p.gpa)} / ${Number(p.gpaScale) === 5 ? 5 : 4}`);
  }
  asList(p.exams).filter((entry) => entry && (entry.exam || entry.id)).forEach((entry) => evidence.push(examLabel(entry)));
  const languageRows = asList(p.languages).filter((entry) => entry && (entry.code || entry.lang));
  languageRows.filter((entry) => entry.exam).forEach((entry) => evidence.push(examLabel(entry)));
  // Native and CEFR entries carry no test name. Reviewed language checks read both (ai_scoring.py: accept_native, min_cefr), so name them.
  if (languageRows.some((entry) => !entry.exam && text(entry.kind).toLowerCase() === "native")) evidence.push(t("profile.ux2.summary.requirements.native"));
  if (languageRows.some((entry) => !entry.exam && text(entry.kind).toLowerCase() === "cefr")) evidence.push(t("profile.ux2.summary.requirements.cefr"));
  rows.push(evidence.length
    ? row("requirements", "used", "profile.ux2.summary.requirements.title", "profile.ux2.summary.requirements.used", evidence.join(", "))
    : row("requirements", "not_used", "profile.ux2.summary.requirements.title", "profile.ux2.summary.requirements.unused"));

  return rows;
};

export const buildSummarySentence = (rows, ctx = {}) => {
  const t = ctx.t || ((key, fallback) => fallback || key);
  const tFormat = ctx.tFormat || ((key, params, fallback) => fallback || key);
  const total = rows.length;
  const used = rows.filter((entry) => entry.state !== "not_used").length;
  if (!used) return t("profile.ux2.summary.sentence_none");
  return tFormat("profile.ux2.summary.sentence", { used: String(used), total: String(total) });
};
