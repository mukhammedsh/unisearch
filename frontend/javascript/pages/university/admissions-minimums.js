// How a published minimum is written for the reader: the total next to the section (component) minimums it comes with,
// so "IELTS 6.0" is never read as the whole requirement when Writing needs more.
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { getExamDisplayName } from "../../utils/config.js";

const locale = () => ({ eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" })[getCurrentLanguage()] || "en-US";
// Tests whose full set of sections is known, so equal minimums can be said as "every section" or "other sections".
const SECTION_TOTALS = { IELTS: 4, TOEFL_iBT_0_120: 4, TOEFL_iBT_1_6: 4 };
const EXAM_PREFIX = /^(?:IELTS|TOEFL_iBT_0_120|TOEFL_iBT_1_6|PTE|DET|UNT)_/i;

/**
 * Test scores are written as on score reports: no digit grouping (SAT 1240), and IELTS bands with one decimal (6.0).
 * @param {string} exam The exam id; IELTS bands keep one decimal.
 * @param {number} value The score.
 * @returns {string}
 */
export const minimumNumber = (exam, value) => new Intl.NumberFormat(locale(), { useGrouping: false,
  minimumFractionDigits: /^IELTS/i.test(exam || "") && Number.isInteger(value) ? 1 : 0 }).format(value);

const examName = id => getExamDisplayName(id, { locale: getCurrentLanguage() });
const joinNames = names => new Intl.ListFormat(locale(), { style: "long", type: "conjunction" }).format(names);

/**
 * The reader's name of one section of a test (Writing, mathematical literacy), from the section id the minimum names.
 * @param {string} id A section id such as IELTS_WRITING or UNT_MATHEMATICAL_LITERACY.
 * @returns {string}
 */
function sectionName(id) {
  const part = String(id || "").replace(EXAM_PREFIX, "").toLowerCase();
  // Another test's sections (NUET) are named by their own label, without the test's name in front.
  return t(`university.admissions.key_facts.section_${part}`) || examName(id).replace(/^[^:]*:\s*/, "");
}

/**
 * The section minimums of one accepted result, in the reader's words: "Writing at least 6.0, other sections at least 5.5".
 * @param {{exam_id?: string, component_minimums?: Record<string, number>}} alternative One accepted result with its published rule.
 * @returns {string} The text, or "" when the rule has no section minimums.
 */
export function sectionMinimumsText(alternative) {
  const entries = Object.entries(alternative?.component_minimums || {}).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return "";
  const groups = new Map();
  for (const [id, value] of entries) groups.set(value, [...(groups.get(value) || []), id]);
  const total = SECTION_TOTALS[alternative.exam_id] || 0;
  const ordered = [...groups].sort((left, right) => right[0] - left[0]);
  const covers = ordered.reduce((sum, [, ids]) => sum + ids.length, 0) === total;
  // With every section of the test named, the one largest group of equal minimums reads as "every section" or "other sections".
  const largest = Math.max(...ordered.map(([, ids]) => ids.length));
  const rest = covers && ordered.filter(([, ids]) => ids.length === largest).length === 1 && (ordered.length === 1 || largest > 1)
    ? ordered.find(([, ids]) => ids.length === largest) : null;
  return ordered.map(group => group === rest
    ? tFormat(`university.admissions.key_facts.minimum_sections_${ordered.length === 1 ? "all" : "other"}`, { value: minimumNumber(alternative.exam_id, group[0]) })
    : tFormat("university.admissions.key_facts.minimum_sections_named", { names: joinNames(group[1].map(sectionName)), value: minimumNumber(alternative.exam_id, group[0]) })).join(", ");
}

/**
 * Names the sections a result still needs for a check, when the published rule names them and they are not the four sections of a language test.
 * @param {{exam_id?: string, component_minimums?: Record<string, number>}|undefined} alternative The accepted result the missing input belongs to.
 * @returns {string} For example "mathematical literacy and reading literacy", or "".
 */
export function missingSectionNames(alternative) {
  const ids = Object.keys(alternative?.component_minimums || {});
  return ids.length && !SECTION_TOTALS[alternative.exam_id] ? joinNames(ids.map(sectionName)) : "";
}

/**
 * The sections of one reported result that are below their published minimum, in the reader's words:
 * "Writing 5.5 (at least 6.0)". Only sections count; a total below its minimum is said by the caller.
 * @param {Array<{exam?: string, status?: string, provided?: number|null, minimum?: number}>} minimumChecks The checks of one result.
 * @param {string} [totalExam] The id of the result's overall score, which is not a section.
 * @returns {string} The text, or "" when no reported section is below its minimum.
 */
export function belowMinimumSectionsText(minimumChecks, totalExam = "") {
  const below = (minimumChecks || []).filter(item => item?.status === "unmet" && item.exam !== totalExam
    && Number.isFinite(item.provided) && Number.isFinite(item.minimum));
  return joinNames(below.map(item => tFormat("university.admissions.key_facts.minimum_below_section",
    { name: sectionName(item.exam), score: minimumNumber(item.exam, item.provided), minimum: minimumNumber(item.exam, item.minimum) })));
}
