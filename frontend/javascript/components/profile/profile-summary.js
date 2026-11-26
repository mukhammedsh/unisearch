// Pure helpers that describe how the current profile draft is used by UniFit.
// Every sentence mirrors behaviour of backend/app/services/ai_scoring.py and the catalog code;
// keep the two in sync when either side changes.

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
