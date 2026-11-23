// Short funding lines (award, coverage, deadline) and the application fee, read from facts the catalog already holds, so
// the answer is visible without opening a source record. Each line states what the university publishes; an award is never promised.
import { formatPrice } from "../../currency.js";
import { t, tFormat } from "../../i18n.js";
import { translateAdmissionText } from "../../university-translations.js";
import { formatPublishedDate } from "./admissions-presentation.js";
import { isReviewedPublished } from "./admissions-status.js";

const MAX_FUNDING_LINES = 5;
const isText = value => typeof value === "string" && value.trim() !== "";
const published = text => translateAdmissionText(text.trim(), text.trim());
// A discount for paying in one payment is not an award for need or merit, so it is not listed among the funding options.
const PAYMENT_DISCOUNT = /\bpayment discount\b|\bnot a need\/merit award\b/i;

// A named competitive award with an amount and a deadline (Imperial Inspires).
function awardLines(value) {
  if (!isText(value.funding_program) || value.funding_type === "paid" || value.availability === "excluded_by_published_course_rules") return [];
  const lines = [];
  if (isText(value.value)) lines.push(`${value.funding_program}: ${published(value.value)}`);
  const due = value.deadline;
  if (isText(due?.date)) {
    const dueText = tFormat("university.admissions.key_facts.funding_apply_by", {
      date: formatPublishedDate(due.date), time: [due.time, due.timezone].filter(isText).join(" ") }).trimEnd();
    lines.push(dueText.endsWith(",") ? dueText.slice(0, -1).trimEnd() : dueText);
  }
  if (isText(value.outcome)) lines.push(published(value.outcome));
  return lines;
}

// Tuition discounts by group, as {group: percent} (NU's published fee discounts).
function coverageLines(value) {
  const entries = Object.entries(value.published_tuition_coverage_percent || {}).filter(([, percent]) => Number.isFinite(percent));
  return entries.sort((left, right) => right[1] - left[1]).map(([group, percent]) => tFormat("university.admissions.key_facts.funding_coverage",
    { percent, group: t(`university.admissions.key_facts.coverage_${group.toLowerCase()}`) || group.replaceAll("_", " ") }));
}

// The category a coverage applies to: its translation when the catalog has one, otherwise the published wording before the first colon (the list of examples).
function coverageGroup(scope) {
  const full = published(scope);
  return full !== scope.trim() ? full : published(scope.split(":")[0]);
}

// A separate grant application: how it is applied for and the tuition coverage each category receives (NU's financial support).
function optionLines(value) {
  const options = (Array.isArray(value.published_tuition_coverage_options) ? value.published_tuition_coverage_options : [])
    .filter(option => Number.isFinite(option?.coverage_percent) && isText(option.scope) && !PAYMENT_DISCOUNT.test(option.scope));
  return [...(isText(value.process) ? [published(value.process)] : []), ...options.map(option => tFormat("university.admissions.key_facts.funding_coverage",
    { percent: option.coverage_percent, group: coverageGroup(option.scope) }))];
}

/**
 * Up to five lines that say what funding the university publishes for the path: award type, coverage and deadline.
 * @param {Array<object>} rows Reviewed funding facts that apply to the selected path.
 * @returns {string[]} The lines; empty when no fact has a shape that can be summarised (nothing is then promised on the page).
 */
export function fundingKeyLines(rows) {
  const lines = rows.flatMap(row => {
    const value = row.value && typeof row.value === "object" && !Array.isArray(row.value) ? row.value : null;
    return value ? [...awardLines(value), ...optionLines(value), ...coverageLines(value)] : [];
  });
  return [...new Set(lines)].slice(0, MAX_FUNDING_LINES);
}

/**
 * The application fee the university publishes as an amount, with its late fee when it has one.
 * @param {object|null} resolved The admissions-context response.
 * @returns {string} One sentence, or "" when no reviewed fee amount applies to the path.
 */
export function applicationFeeText(resolved) {
  const row = (resolved?.facts || []).find(fact => fact.topic === "application_fee" && isReviewedPublished(fact)
    && fact.applicability?.status !== "mismatched" && Number.isFinite(fact.value?.amount) && isText(fact.value?.currency));
  if (!row) return "";
  const { amount, currency, late_fee: late, late_window: window } = row.value;
  const fee = tFormat("university.admissions.key_facts.application_fee_amount", { amount: formatPrice(amount, currency) });
  if (!Number.isFinite(late)) return fee;
  // Only the wording the data states is translated; an unfamiliar window is left out rather than guessed.
  const lastWeeks = /last two weeks/i.test(window || "");
  return `${fee} ${tFormat(`university.admissions.key_facts.application_fee_late${lastWeeks ? "_window" : ""}`, { amount: formatPrice(late, currency) })}`;
}
