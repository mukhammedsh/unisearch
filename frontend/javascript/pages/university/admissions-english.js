// The English requirement a path publishes outside the measured checks: an English test that is not required (Stanford)
// and the course's Standard or Higher level with its IELTS band and section minimum (Imperial). Both read facts that are
// already in the catalog, so the requirement is visible without opening a source record. Nothing here is a pass or fail.
import { t, tFormat } from "../../i18n.js";
import { isReviewedPublished } from "./admissions-status.js";
import { minimumNumber } from "./admissions-minimums.js";

const NOT_REQUIRED = /English[- ]proficiency (?:exams?|tests?)\b[^.;]*?\bnot required/i;
const label = key => t(`university.admissions.key_facts.${key}`);
// A sentence that exempts only some applicants is not a statement that no test is needed.
const CONDITIONAL = /\b(?:unless|except|waive[sd]?|exempt\w*|if you|applicants who)\b/i;
const readable = row => isReviewedPublished(row) && row.applicability?.status !== "mismatched";
const strings = value => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(strings)
  : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];

// The level a course designates ("standard university requirement", "Higher level"); "" when the course page does not say.
function designatedLevel(facts) {
  const text = facts.flatMap(row => strings(row.value?.course_english_language_requirement_level)).join(" ");
  if (/\bhigher\b/i.test(text)) return "higher";
  return /\bstandard\b/i.test(text) ? "standard" : "";
}

// IELTS Academic bands the university publishes per level: the overall band and the band every section needs.
function ieltsLevels(facts) {
  const row = facts.find(fact => fact.topic === "language_tests" && /ielts/i.test(fact.id) && fact.value?.standard?.overall && fact.value?.higher?.overall);
  if (!row) return null;
  const band = level => ({ overall: row.value[level].overall, section: row.value[level].each_element });
  return { factId: row.id, standard: band("standard"), higher: band("higher") };
}

const bands = ({ overall, section }) => Number.isFinite(section)
  ? tFormat("university.admissions.key_facts.english_bands", { overall: minimumNumber("IELTS", overall), section: minimumNumber("IELTS", section) })
  : tFormat("university.admissions.key_facts.english_overall", { overall: minimumNumber("IELTS", overall) });

/**
 * English requirement lines the measured checks do not cover.
 * @param {object|null} resolved The admissions-context response.
 * @returns {Array<{kind: string, factId: string, mark: string, text: string, note?: string}>} Checklist items; empty when none applies.
 */
export function englishRequirementItems(resolved) {
  const facts = (resolved?.facts || []).filter(readable);
  const statesNotRequired = text => text.split(/(?<=\.)\s+/).some(sentence => NOT_REQUIRED.test(sentence) && !CONDITIONAL.test(sentence));
  const notRequired = facts.find(row => strings(row.value).some(statesNotRequired));
  if (notRequired) return [{ kind: "language", factId: notRequired.id, mark: "note", text: label("english_not_required") }];
  const ielts = ieltsLevels(facts);
  if (!ielts) return [];
  const level = designatedLevel(facts);
  const note = label("english_other_tests");
  return [{ kind: "language", factId: ielts.factId, mark: "note", note,
    text: level ? tFormat("university.admissions.key_facts.english_level", { level: label(`english_level_${level}`), bands: bands(ielts[level]) })
      : tFormat("university.admissions.key_facts.english_levels", { standard: bands(ielts.standard), higher: bands(ielts.higher) }) }];
}
