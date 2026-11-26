import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { formatPrice, formatPriceRange } from "../../currency.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { ASSESSMENT_RECORD_DOMAINS, admissionDeadlineTitle, admissionsCycleLabel, admissionsRouteName, admissionWindowName, renderAssessmentChecks } from "./admissions-render.js";
import { formatPublishedDate } from "./admissions-presentation.js";
import { getReviewedDeadlineEvents, MONTHS } from "./deadline-calendar.js";
import { isEvidenceReviewed, isPublishedReference, isReviewedPublished } from "./admissions-status.js";
import { translateAdmissionText } from "../../university-translations.js";
import { heroIcon } from "../../icons.js";
import { getExamDisplayName } from "../../utils/config.js";
import { safeUrl } from "../_shared.js";
import { glossaryTerms, renderTermList, routeWording, termsForRoute } from "./admissions-glossary.js";
import { applicationFeeText, fundingKeyLines } from "./admissions-funding-lines.js";
import { englishRequirementItems } from "./admissions-english.js";
import { belowMinimumSectionsText, minimumNumber, missingSectionNames, sectionMinimumsText } from "./admissions-minimums.js";

const label = key => t(`university.admissions.key_facts.${key}`);
const locale = () => ({ eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" })[getCurrentLanguage()] || "en-US";
// Dates an applicant must act on; openings, decisions and replies are not deadlines to meet.
const ACTION_KINDS = new Set(["application", "funding", "funding_consideration", "test", "test_submission", "booking"]);
const DAY_MS = 86400000;
const TEST_KINDS = new Set(["test", "test_submission", "booking"]);
// Funding facts may state the university's need policy in one short field; only these named fields are shown as a policy.
const FUNDING_POLICY_FIELDS = ["international_need"];

// Short answers follow the reader's currency setting with rounded, compact converted amounts.
const summary = () => ({ presentation: "summary", locale: locale() });

export function requirementsFact(resolved) {
  const assessment = resolved?.assessment || {};
  const checks = assessment.activeChoice?.details?.checks || [];
  const measurable = checks.filter(check => check.measurable && ["met", "unmet"].includes(check.status));
  const manual = checks.filter(check => check.status === "unassessed").length;
  const percent = assessment.chancePercent;
  const text = Number.isFinite(percent) && measurable.length
    ? tFormat("university.admissions.key_facts.requirements_met", {
      met: measurable.filter(check => check.status === "met").length, total: measurable.length, percent: Math.round(percent),
    })
    : t(`university.admissions.catalog.reason.${assessment.reason}`) || t("university.admissions.catalog.assessment_unavailable");
  const tone = assessment.reason === "requirements_not_met" ? "warning" : Number.isFinite(percent) && percent >= 100 ? "success" : "";
  // With a checklist the items themselves say what to add; without one, the notes do.
  const missing = assessment.reason === "missing_evidence" && !minimumChecklist(resolved).length ? missingEvidenceNotes(checks) : [];
  return { text, tone, cycleRequired: assessment.reason === "entry_cycle_required",
    notes: [...missing, manual ? tFormat("university.admissions.key_facts.requirements_manual", { count: manual }) : ""].filter(Boolean) };
}

const REQUIREMENT_KINDS = { academic_requirement: "academic", language_requirement: "language", exam_alternatives: "exam", required_exam_presence: "exam" };
const examName = id => getExamDisplayName(id, { locale: getCurrentLanguage() });

// One item the applicant can add, named from the check's own missing parts; nothing is assumed about the values.
function missingInputItem(entry, alternatives = []) {
  const needs = new Set(entry.needs || []);
  if (entry.field === "gpa") return label("requirements_add_gpa");
  const part = needs.has("taken_on") && needs.has("components") ? "date_sections" : needs.has("taken_on") ? "date" : needs.has("components") ? "sections" : "result";
  // A test whose published rule names its sections (the UNT's literacy scores) says which ones to add.
  const sections = part.endsWith("sections") ? missingSectionNames(alternatives.find(alternative => alternative.exam_id === entry.exam)) : "";
  return tFormat(`university.admissions.key_facts.requirements_add_${part}${sections ? "_named" : ""}`, { exam: examName(entry.exam), sections });
}

// Tells the applicant what to add for checks whose evidence is missing, and which overall scores already meet a published minimum.
function missingEvidenceNotes(checks) {
  const lines = [];
  for (const check of checks.filter(item => item.status === "missing" && REQUIREMENT_KINDS[item.kind])) {
    const items = [...new Set(check.kind === "required_exam_presence"
      ? (check.examIds || []).map(id => missingInputItem({ exam: id, needs: ["result"] })) : (check.missingInputs || []).map(entry => missingInputItem(entry, check.rule?.alternatives)))];
    if (!items.length) continue;
    lines.push(tFormat(`university.admissions.key_facts.requirements_need_${items.length > 1 ? "any" : "one"}`,
      { requirement: label(`requirements_kind_${REQUIREMENT_KINDS[check.kind]}`), items: items.join("; ") }));
  }
  if (!lines.length) return [];
  // Only the overall score of a test alternative is named; a met section minimum does not make the alternative met.
  const met = [...new Set(checks.flatMap(check => {
    const totals = new Set((check.rule?.alternatives || []).map(alternative => alternative.exam_id));
    return (check.provided?.minimum_checks || []).filter(item => item.status === "met" && totals.has(item.exam)).map(item => examName(item.exam));
  }))];
  return [...new Set(lines), ...(met.length ? [tFormat("university.admissions.key_facts.requirements_already_met", { items: met.join(", ") })] : [])];
}

// One accepted result as published: the test and its overall minimum, or the GPA and its scale.
function alternativeText(alternative) {
  if (alternative.profile_field === "gpa") {
    return Number.isFinite(alternative.minimum) ? tFormat(`university.admissions.key_facts.minimum_gpa${alternative.scale ? "_scale" : ""}`,
      { minimum: minimumNumber("", alternative.minimum), scale: alternative.scale }) : label("requirements_add_gpa");
  }
  const name = examName(alternative.exam_id);
  if (!Number.isFinite(alternative.minimum)) return name;
  const total = `${name} ${minimumNumber(alternative.exam_id, alternative.minimum)}`;
  // Section minimums stand beside the total, so a total that meets the minimum is never read as the whole requirement.
  const sections = sectionMinimumsText(alternative);
  return sections ? tFormat("university.admissions.key_facts.minimum_with_sections", { minimum: total, sections }) : total;
}

// What the applicant entered for a check, in the same plain form.
function providedText(provided) {
  if (!provided || typeof provided !== "object") return "";
  if (provided.exam && Number.isFinite(provided.score)) return `${examName(provided.exam)} ${minimumNumber(provided.exam, provided.score)}`;
  if (provided.field === "gpa" && Number.isFinite(provided.value)) return `GPA ${minimumNumber("", provided.value)}`;
  // A met GPA alternative reports the profile GPA with its scale ({gpa, gpa_scale}).
  if (Number.isFinite(provided.gpa)) {
    return Number.isFinite(provided.gpa_scale)
      ? tFormat("university.admissions.key_facts.minimum_gpa_scale", { minimum: minimumNumber("", provided.gpa), scale: provided.gpa_scale })
      : `GPA ${minimumNumber("", provided.gpa)}`;
  }
  return "";
}

// A profile link that opens the language editor at one English test, so a missing result or section score is entered in place.
const profileLanguageExamHref = exam => `/profile.html?language_exam=${encodeURIComponent(exam)}`;

// The published English-test names of a recommendation record, as the profile's language exam ids.
const RECOMMENDED_ENGLISH_EXAMS = {
  "IELTS Academic": () => "IELTS", "PTE Academic": () => "PTE", "Duolingo English Test": () => "DET",
  "Cambridge C1 Advanced": () => "Cambridge_C1_Advanced", "Cambridge C2 Proficiency": () => "Cambridge_C2_Proficiency",
  "TOEFL iBT": row => ({ "0-120": "TOEFL_iBT_0_120", "1-6": "TOEFL_iBT_1_6" })[row.scale] || "",
};
// A recommendation that applies only to applicants whose first language is not English (MIT's English proficiency exams).
export const NON_NATIVE_ENGLISH = /\bnon-native English\b/i;

/**
 * The applicant's English as the profile states it: a native English entry, another native language only, or nothing said.
 * @param {{languages?: Array<{code?: string, kind?: string, exam?: string, score?: number}>}} [profile] The API profile.
 * @returns {"native"|"not_native"|"unknown"}
 */
export function englishStatus(profile) {
  const native = (profile?.languages || []).filter(row => row?.kind === "native").map(row => String(row.code || "").toLowerCase());
  return native.includes("en") ? "native" : native.length ? "not_native" : "unknown";
}

/**
 * A published English-test recommendation for applicants whose first language is not English, as one checklist item.
 * It is never a pass or fail: the applicant's own result is shown beside it, and an unknown native language adds a hint.
 * @param {object|null} resolved The admissions-context response.
 * @param {{languages?: Array<object>}} [profile] The API profile, for the native language and English test results.
 * @returns {object|null} A checklist item, or null when no such recommendation applies or English is the applicant's native language.
 */
export function englishRecommendationItem(resolved, profile = {}) {
  const status = englishStatus(profile);
  if (status === "native") return null;
  const ids = new Set(resolved?.fact_groups?.requirements || []);
  const fact = (resolved?.facts || []).find(row => ids.has(row.id) && isReviewedPublished(row) && row.applicability?.status !== "mismatched"
    && row.value?.presence === "strongly_recommended" && Array.isArray(row.value.minima_and_recommendations)
    && (row.conditions || []).some(condition => NON_NATIVE_ENGLISH.test(condition?.when || "")));
  if (!fact) return null;
  const published = fact.value.minima_and_recommendations.map(row => ({ ...row, examId: RECOMMENDED_ENGLISH_EXAMS[row.exam]?.(row) || "" }))
    .filter(row => row.examId && Number.isFinite(row.minimum));
  const results = (profile?.languages || []).filter(row => row?.kind === "exam" && Number.isFinite(row.score));
  // The applicant's own test leads; without one, IELTS stands for the list, which stays on the Admission tab below.
  const own = published.find(row => results.some(result => result.exam === row.examId));
  const shown = own || published.find(row => row.examId === "IELTS") || published[0];
  if (!shown) return null;
  const result = own
    ? results.filter(entry => entry.exam === own.examId).reduce((best, entry) => (!best || entry.score > best.score ? entry : best), null)
    : null;
  const text = tFormat(`university.admissions.key_facts.recommended_english${Number.isFinite(shown.recommended) ? "_better" : ""}`, {
    exam: examName(shown.examId),
    minimum: minimumNumber(shown.examId, shown.minimum),
    better: Number.isFinite(shown.recommended) ? minimumNumber(shown.examId, shown.recommended) : "",
  });
  const mark = !result ? "recommended" : result.score >= shown.minimum ? "met" : "below";
  const resultText = result ? `${examName(result.exam)} ${minimumNumber(result.exam, result.score)}` : "";
  const have = !result ? "" : tFormat(`university.admissions.key_facts.minimum_have${mark === "below" ? "_below" : ""}`, { result: resultText });
  const hint = result ? null
    : status === "unknown" ? { text: label("recommended_english_native_hint"), href: "/profile.html?language=en" }
    : status === "not_native" ? { text: label("recommended_english_add_hint"), href: profileLanguageExamHref(shown.examId) }
    : null;
  return { kind: "language_recommendation", factId: fact.id, mark, text, note: label(`recommended_english_condition${status === "not_native" ? "_not_native" : ""}`),
    // A short form of the condition for the Overview, which has no room for the long note; it is not needed once the profile says English is not the first language.
    ...(status === "unknown" ? { condition: label("recommended_english_if_not_native") } : {}), ...(have ? { have } : {}),
    ...(hint ? { hint } : {}) };
}

// The path's published academic and language minimums as a short checklist, each with the applicant's own status:
// met, below the minimum, or what to add. Shared by the Admission key facts and the Overview "What you'll need" card.
// A language check that needs a result or section scores links to that test in the profile.
export function minimumChecklist(resolved) {
  const checks = resolved?.assessment?.activeChoice?.details?.checks || [];
  return checks.filter(check => REQUIREMENT_KINDS[check.kind]).map(check => {
    // A required test may come with only what to add (Imperial's TMUA), which still names the test.
    const named = ids => [...new Set(ids.filter(Boolean))].map(exam_id => ({ exam_id }));
    const alternatives = check.kind === "required_exam_presence" ? named(check.examIds || [])
      : check.rule?.alternatives?.length ? check.rule.alternatives : named((check.missingInputs || []).map(input => input.exam));
    const items = [...new Set(alternatives.map(alternativeText))];
    if (!items.length) return null;
    const requirement = label(`requirements_kind_${REQUIREMENT_KINDS[check.kind]}`);
    const text = tFormat(`university.admissions.key_facts.minimum_${items.length > 1 ? "any" : "one"}`, { requirement, items: items.join(", ") });
    const have = providedText(check.provided);
    const adds = check.status === "missing" ? [...new Set((check.missingInputs || []).map(entry => missingInputItem(entry, check.rule?.alternatives)))] : [];
    // A result already entered stays visible beside what is still missing, with whether its overall score meets the minimum.
    const overallMet = (check.provided?.minimum_checks || []).some(item => item.exam === check.provided?.exam && item.status === "met");
    // A total that meets the minimum while section scores are missing is checked in part: neither met nor still to prepare.
    const mark = { met: "met", unmet: "below" }[check.status] || (adds.length && overallMet ? "partial" : "todo");
    // A section below its minimum is named, because the overall score of the same result may meet it.
    const belowSections = mark === "below" && overallMet ? belowMinimumSectionsText(check.provided?.minimum_checks, check.provided?.exam) : "";
    const note = adds.length && have ? tFormat(`university.admissions.key_facts.minimum_have_${overallMet ? "overall_" : ""}add`, { result: have, items: adds.join(", ") })
      : adds.length ? tFormat("university.admissions.key_facts.minimum_add", { items: adds.join(", ") })
      // A result the check could not count (NU accepts SAT for Foundation only from international applicants) is not a pass.
      : have && belowSections ? tFormat("university.admissions.key_facts.minimum_have_below_sections", { result: have, sections: belowSections })
      : have ? tFormat(`university.admissions.key_facts.minimum_have${{ below: "_below", todo: "_unconfirmed" }[mark] || ""}`, { result: have }) : "";
    const languageExam = check.kind === "language_requirement" && adds.length ? (check.missingInputs || []).find(input => input.exam)?.exam : "";
    return { kind: REQUIREMENT_KINDS[check.kind], factId: check.factId, mark, text, note, ...(languageExam ? { href: profileLanguageExamHref(languageExam) } : {}) };
  }).filter(Boolean);
}

// The same marks as the Overview checklist: a check, a warning, or a dot for something still to add; a recommendation
// carries an information mark, never a pass or fail.
// "partial" is a result whose overall score meets a minimum while section scores are still missing; "note" is a plain fact.
export const MARK_ICONS = { met: "check-circle", below: "exclamation-triangle", partial: "exclamation-circle", recommended: "information-circle", note: "information-circle" };

const profileLink = (href, text, className) => `<a class="${className}" href="${escapeHtmlAttr(href)}" data-route="profile">${escapeHtml(text)}</a>`;

function renderMinimumChecklist(items) {
  if (!items.length) return "";
  // A note that asks for a missing result is itself the link to that test in the profile.
  const note = item => !item.note ? "" : item.href ? profileLink(item.href, item.note, "admissions-key-facts__checklist-note")
    : `<span class="admissions-key-facts__checklist-note">${escapeHtml(item.note)}</span>`;
  const hint = item => item.hint ? profileLink(item.hint.href, item.hint.text, "admissions-key-facts__checklist-note") : "";
  return `<ul class="admissions-key-facts__checklist">${items.map(item => `<li data-mark="${item.mark}"${item.kind === "language_recommendation" ? " data-recommendation" : ""}><span class="admissions-key-facts__mark" aria-hidden="true">${MARK_ICONS[item.mark] ? heroIcon(MARK_ICONS[item.mark], "ui-icon ui-icon--16") : ""}</span>
    <span class="sr-only">${escapeHtml(t(`university.ux2.needs.mark_${item.mark}`))}: </span><span><span class="admissions-key-facts__checklist-text">${escapeHtml(item.text)}</span>${note(item)}${item.have ? `<span class="admissions-key-facts__checklist-note">${escapeHtml(item.have)}</span>` : ""}${hint(item)}</span></li>`).join("")}</ul>`;
}

// Keeps a test-specific date only when the applicant has not entered a different test of the same requirement.
function withoutUnusedAlternatives(entries, profileExamIds) {
  const owned = new Set(profileExamIds.map(id => String(id).toUpperCase()));
  const group = event => [event.kind, event.applicationCategory, event.cycle].join("|");
  const alternatives = new Map();
  for (const { event } of entries) {
    if (event.examId) alternatives.set(group(event), new Set([...(alternatives.get(group(event)) || []), event.examId.toUpperCase()]));
  }
  return entries.filter(({ event }) => {
    const exam = event.examId?.toUpperCase();
    return !exam || owned.has(exam) || ![...alternatives.get(group(event))].some(other => other !== exam && owned.has(other));
  });
}

// A yearless date counts as annual only when the reviewed record describes its dates as recurring.
const isRecurringYearless = row => row.period?.kind === "yearless_policy" && /\brecurring\b/i.test(row.period.label || "");

// The next calendar occurrence of a published "Month D" date on or after today (a lapsed one moves to next year), or null for any other wording.
function nextAnnualOccurrence(value, today) {
  const match = /^([A-Za-z]+) (\d{1,2})$/.exec(String(value).trim());
  const month = match ? MONTHS.indexOf(match[1].toLowerCase()) : -1;
  if (month < 0) return null;
  const year = new Date(today).getUTCFullYear();
  const at = (shift) => { const time = Date.UTC(year + shift, month, Number(match[2])); return new Date(time).getUTCMonth() === month ? time : null; };
  const thisYear = at(0);
  if (thisYear === null) return null;
  return thisYear >= today ? { day: thisYear, lapsed: false } : at(1) === null ? null : { day: at(1), lapsed: true, last: thisYear };
}

export function deadlineFact(resolved, now = new Date(), { profileExamIds = [] } = {}) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  // Dated references from an earlier cycle do not describe the next date to meet.
  const dated = withoutUnusedAlternatives(getReviewedDeadlineEvents(resolved)
    .filter(event => ACTION_KINDS.has(event.kind) && event.publicationStatus !== "published_dated_reference")
    .map(event => ({ event, day: Date.parse(`${event.deadline}T00:00:00Z`) }))
    .filter(entry => Number.isFinite(entry.day))
    .sort((left, right) => left.day - right.day), profileExamIds);
  const describe = entry => ({ title: admissionDeadlineTitle(entry.event), date: formatPublishedDate(entry.event.deadline) });
  // Terms come from the published round name and the application route, not from the translated title.
  const termsFor = (...names) => termsForRoute(glossaryTerms(names, routeWording(resolved?.selected_route)), resolved?.selected_route);
  const countdown = entry => {
    const days = Math.round((entry.day - today) / DAY_MS);
    return { days, text: days ? tFormat("university.admissions.key_facts.deadline_upcoming", { ...describe(entry), days })
      : tFormat("university.admissions.key_facts.deadline_today", describe(entry)) };
  };
  const ahead = dated.filter(entry => entry.day >= today);
  // The application deadline is the headline; a test or booking date that comes first is shown beneath it.
  const upcoming = ahead.find(entry => entry.event.kind === "application") || ahead[0];
  if (upcoming) {
    const { days, text } = countdown(upcoming);
    const earlier = ahead.find(entry => entry.day < upcoming.day && TEST_KINDS.has(entry.event.kind));
    return { status: "upcoming", days, tone: days <= 30 ? "warning" : "", terms: termsFor(upcoming.event.name, earlier?.event.name), text,
      // The next date as structured parts, so a summary can lead with the date and show the round name separately.
      next: { title: describe(upcoming).title, date: describe(upcoming).date },
      notes: earlier ? [tFormat("university.admissions.key_facts.deadline_earlier", { text: countdown(earlier).text })] : [] };
  }
  if (dated.length) return { status: "passed", tone: "danger", terms: termsFor(dated.at(-1).event.name), text: tFormat("university.admissions.key_facts.deadline_passed", describe(dated.at(-1))) };
  // Yearless dates stay as published unless the record describes them as recurring (annual); periods always stay as published.
  const ids = new Set(resolved?.fact_groups?.deadlines || []);
  // A partly published window record still publishes its application period.
  const rows = (resolved?.facts || []).filter(row => ids.has(row.id) && row.applicability?.status !== "mismatched" && isEvidenceReviewed(row)
    && (isPublishedReference(row) || typeof row.value?.application_period === "string"));
  const windowName = admissionWindowName;
  const yearlessWindows = list => list.flatMap(row => Array.isArray(row.value?.windows) ? row.value.windows : [])
    .filter(window => typeof window.name === "string" && typeof window.application_due === "string" && !/20\d{2}/.test(window.application_due));
  const annual = yearlessWindows(rows.filter(isRecurringYearless))
    .map(window => ({ window, ...nextAnnualOccurrence(window.application_due, today) }))
    .filter(entry => entry.day);
  if (annual.length) {
    const next = annual.reduce((first, entry) => entry.day < first.day ? entry : first);
    const days = Math.round((next.day - today) / DAY_MS);
    const named = entry => ({ name: windowName(entry.window.name), date: formatPublishedDate(entry.window.application_due) });
    // Windows that passed more recently than the next one's last occurrence are named, so the applicant sees why it is the nearest.
    const passedEntries = annual.filter(entry => entry !== next && next.lapsed && entry.lapsed && entry.last > next.last);
    const passed = passedEntries.map(entry => tFormat("university.admissions.key_facts.deadline_recurring_passed", named(entry)));
    // The university names no year, so the date is shown as published and the countdown is an estimate for its next occurrence.
    const dateText = formatPublishedDate(next.window.application_due);
    const upcoming = tFormat(`university.admissions.key_facts.deadline_recurring_${days ? "next" : "today"}`,
      { name: windowName(next.window.name), date: dateText, days });
    return { status: "recurring", days, tone: days <= 30 ? "warning" : "", terms: termsFor(annual.map(entry => entry.window.name)),
      text: [...passed, upcoming].join(" "),
      next: { title: windowName(next.window.name), date: dateText },
      passedWindows: passedEntries.map(named) };
  }
  const windows = yearlessWindows(rows);
  const yearless = windows.map(window => `${windowName(window.name)}: ${formatPublishedDate(window.application_due)}`);
  if (yearless.length) return { status: "yearless", tone: "", terms: termsFor(windows.map(window => window.name)),
    text: tFormat("university.admissions.key_facts.deadline_yearless", { dates: [...new Set(yearless)].join("; ") }) };
  const period = rows.map(row => row.value?.application_period).find(value => typeof value === "string" && value.trim());
  if (period) {
    // A rolling intake and dates not yet published for some applicants are said beside the period, so it is not read as a deadline.
    const record = rows.find(row => row.value?.application_period === period)?.value || {};
    const notes = [/\brolling\b/i.test(record.submission || "") ? label("deadline_rolling") : "",
      /announced|TBA|not (?:yet )?published/i.test(record.other_international_applicants || "") ? label("deadline_international_tba") : ""].filter(Boolean);
    return { status: "period", tone: "", terms: termsFor(), notes, text: tFormat("university.admissions.key_facts.deadline_period", { period: translateAdmissionText(period, period) }) };
  }
  return ids.size ? { status: "described", tone: "", terms: termsFor(), text: label("deadline_described") } : { status: "none", tone: "", text: label("deadline_none") };
}

// The official fee-status page is the source of the reviewed fee-status fact, so it follows the catalog data.
function feeStatusSource(resolved) {
  const fact = (resolved?.facts || []).find(row => row.topic === "fee_status" && isReviewedPublished(row) && row.applicability?.status !== "mismatched");
  const source = (resolved?.sources || []).find(item => fact?.source_ids?.includes(item.id) && safeUrl(item.url));
  return source ? safeUrl(source.url) : "";
}

export function costFact(resolved, budgetUsd, { original = false } = {}) {
  const costs = resolved?.selected_costs || {};
  const basis = costs.annual_total ? "annual_total" : costs.tuition ? "tuition" : "";
  if (!basis) return { status: "unknown", tone: "", text: label("cost_unknown"), notes: [] };
  const quote = costs[basis];
  const priceOptions = { ...summary(), original };
  const amount = formatPriceRange(quote.min, quote.max, quote.currency, priceOptions);
  // A total this site adds up (published tuition plus a living estimate) says so and shows both parts,
  // so it is never mistaken for a published figure or contradicted by the tuition shown elsewhere.
  const calculated = quote.calculation === "tuition_plus_living_range" && costs.tuition && Number.isFinite(quote.living_min);
  // The estimate templates carry their own "≈", so a converted figure must not add a second one.
  const withoutApprox = (value) => String(value).replace(/^≈\s*/, "");
  const text = tFormat(`university.admissions.key_facts.${calculated ? "cost_estimate" : basis === "annual_total" ? "cost_total" : "cost_tuition"}`,
    { amount: calculated ? withoutApprox(amount) : amount });
  const breakdown = calculated ? tFormat("university.admissions.key_facts.cost_breakdown", {
    tuition: formatPriceRange(costs.tuition.min, costs.tuition.max, costs.tuition.currency, priceOptions),
    living: withoutApprox(formatPriceRange(quote.living_min, quote.living_max, quote.currency, priceOptions)) }) : "";
  // A published yearly budget names the tuition it includes, so the reader sees what the rest pays for.
  const tuitionShare = !calculated && basis === "annual_total" && costs.tuition && costs.tuition.currency === quote.currency
    && Number.isFinite(costs.tuition.max) && costs.tuition.max < quote.min
    ? tFormat("university.admissions.key_facts.cost_tuition_share", { tuition: formatPriceRange(costs.tuition.min, costs.tuition.max, costs.tuition.currency, priceOptions) }) : "";
  // The amount and its basis are also returned separately, so a summary can lead with the figure.
  const parts = { amount, basis, period: quote.period || "" };
  const notes = [breakdown || tuitionShare, quote.period ? tFormat("university.admissions.key_facts.cost_period", {
    // Only an explicit entry label names an intake; an academic-year price period stays as published.
    period: /\bentry\b/i.test(quote.period) ? admissionsCycleLabel(quote.period) || quote.period : quote.period }) : ""];
  const referenceNote = breakdown || tuitionShare || (quote.calculation === "tuition_plus_living_range"
    ? t("university.admissions.key_facts.cost_calculated_reference") : "");
  // The explanation is general: the university, not the applicant's nationality or residence, sets the classification.
  const feeStatusDepends = quote.fee_status_match === "unknown" && quote.fee_statuses?.length > 1;
  if (feeStatusDepends) notes.push(label("cost_fee_status"), t("university.admissions.glossary.fee_status.text"));
  const feeStatusPage = feeStatusDepends ? feeStatusSource(resolved) : "";
  const links = feeStatusPage ? [{ url: feeStatusPage, label: label("cost_fee_status_source") }] : [];
  if (!quote.annual_comparable) return { status: "not_annual", tone: "", text, links, feeStatusAction: feeStatusDepends, notes: [...notes, label("cost_not_annual")].filter(Boolean), referenceNote, ...parts };
  if (!quote.usd) return { status: "not_comparable", tone: "", text, links, feeStatusAction: feeStatusDepends, notes: notes.filter(Boolean), referenceNote, ...parts };
  if (!(Number.isFinite(budgetUsd) && budgetUsd > 0)) return { status: "no_budget", tone: "", text, links, feeStatusAction: feeStatusDepends, notes: [...notes, label("budget_missing")].filter(Boolean), referenceNote, ...parts };
  // The applicant's own budget is never rounded.
  const budget = formatPrice(budgetUsd, "USD");
  const status = quote.usd.min > budgetUsd ? "over" : quote.usd.max > budgetUsd ? "partial"
    : basis === "tuition" ? "tuition_within" : "within";
  // The published amount stays neutral; only the comparison with the applicant's budget carries a status colour.
  const flag = { text: tFormat(`university.admissions.key_facts.budget_${status}`, { budget }),
    tone: { over: "danger", partial: "warning", tuition_within: "warning", within: "success" }[status] };
  return { status, tone: "", flag, text, links, feeStatusAction: feeStatusDepends, notes: notes.filter(Boolean), referenceNote, ...parts };
}

// Reviewed funding records that apply to the selected route, never to another path of the university.
function fundingRows(resolved) {
  const ids = new Set(resolved?.fact_groups?.funding || []);
  return (resolved?.facts || []).filter(row => ids.has(row.id) && isReviewedPublished(row) && row.applicability?.status !== "mismatched");
}

// Funding records that apply to the path and are published, with or without a stated limit (NU's grant conditions are published for
// 2027/28 with deadlines still to come). A limited publication is still the university's own statement, so it may be summarised.
function limitedFundingRows(resolved) {
  const ids = new Set(resolved?.fact_groups?.funding || []);
  return (resolved?.facts || []).filter(row => ids.has(row.id) && isPublishedReference(row) && isEvidenceReviewed(row) && row.applicability?.status !== "mismatched");
}

// One short statement the university itself publishes about meeting financial need, phrased as policy rather than an award.
function fundingPolicy(rows) {
  for (const row of rows.filter(item => item.applicability?.route === "matched")) {
    for (const field of FUNDING_POLICY_FIELDS) {
      const statement = typeof row.value?.[field] === "string" ? row.value[field].trim() : "";
      if (statement) return translateAdmissionText(statement, statement);
    }
  }
  return "";
}

// The university's published need policy for the selected route as one statement, or "" when none is published.
export const fundingPolicyStatement = resolved => fundingPolicy(fundingRows(resolved));

export function fundingFact(resolved, { onCostsTab = false } = {}) {
  const rows = fundingRows(resolved);
  const terms = termsForRoute(glossaryTerms(rows.map(row => typeof row.value === "string" ? row.value : row.value?.required)), resolved?.selected_route);
  const policy = fundingPolicy(rows);
  // Award type, coverage and deadline, as the university publishes them, so the answer is not only a pointer to the records.
  const lines = fundingKeyLines(limitedFundingRows(resolved));
  // A separate support application is a different route of the same institution, not a second admission chance.
  const support = (resolved?.available_routes || []).find(route => route.classification === "financial_support_application"
    && route.id !== resolved.selected_route?.id);
  if (support) return { terms, lines, notes: policy ? [tFormat("university.admissions.key_facts.funding_policy", { policy })] : [], supportRouteId: support.id,
    text: tFormat("university.admissions.key_facts.funding_route", { route: admissionsRouteName(support, { presentation: "simple" }) }) };
  const count = (resolved?.fact_groups?.funding || []).length;
  if (policy && count) return { terms, lines, text: tFormat("university.admissions.key_facts.funding_policy", { policy }),
    notes: [tFormat("university.admissions.key_facts.funding_policy_note", { count })] };
  // The records are only claimed to be "below" or "on the tab" when they say something there: the lines above are the answer,
  // and the full records stay behind the "Sources" disclosure.
  const text = !count ? label("funding_none") : label(lines.length ? "funding_lines_lead" : onCostsTab ? "funding_records_here" : "funding_records");
  return { terms, lines, text };
}

function row(key, fact, action = "", shownTerms = null, extra = "") {
  const flag = fact.flag ? `<p class="admissions-key-facts__flag" data-tone="${fact.flag.tone}">${escapeHtml(fact.flag.text)}</p>` : "";
  const notes = flag + (fact.notes || (fact.note ? [fact.note] : [])).map(note => `<p class="admissions-reading__note">${escapeHtml(note)}</p>`).join("");
  const links = (fact.links || []).map(link => `<a class="admissions-key-facts__source" href="${escapeHtmlAttr(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16")}</a>`).join("");
  const lines = fact.lines?.length ? `<ul class="admissions-key-facts__lines">${fact.lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "";
  // The fee status is set in the selection editor; the button opens it with that field in view.
  const feeStatus = fact.feeStatusAction ? `<button type="button" class="admissions-key-facts__link" data-key-facts-fee-status>${escapeHtml(label("set_fee_status"))}</button>` : "";
  const marker = key === "requirements" ? " data-requirements-match" : "";
  return `<div class="admissions-key-facts__row" data-key-fact="${key}"${marker}${fact.status ? ` data-key-fact-status="${escapeHtmlAttr(fact.status)}"` : ""}>
    <dt>${escapeHtml(label(key))}</dt>
    <dd><p class="admissions-key-facts__value"${fact.tone ? ` data-tone="${fact.tone}"` : ""}>${escapeHtml(fact.text)}</p>${fact.before || ""}${notes}${lines}${links}${renderTermList(fact.terms || [], shownTerms)}${feeStatus}${action}${extra}</dd></div>`;
}

// The page's single requirements-match summary: the key-fact result, the minimums checklist and caveats that belong
// beside a number. How each check was made stays behind the tab's closed "Sources" disclosure (requirementsCheckDetails).
function requirementsRow(resolved, cycleAction, shownTerms, profile) {
  const fact = requirementsFact(resolved);
  const assessment = resolved?.assessment || {};
  const checks = assessment.activeChoice?.details?.checks || [];
  const evaluated = checks.filter(check => check.measurable && ["met", "unmet"].includes(check.status));
  const available = Number.isFinite(assessment.chancePercent) && evaluated.length;
  const recommendation = englishRecommendationItem(resolved, profile);
  const minimums = minimumChecklist(resolved);
  const checklist = [...minimums, ...(minimums.some(item => item.kind === "language") ? [] : englishRequirementItems(resolved)), ...(recommendation ? [recommendation] : [])];
  // Without a measured share the checklist itself is the answer, so the row introduces it instead of describing the check.
  // A checklist already says what to add, so a missing result never replaces it with a generic "add your results".
  // A list of published facts only (an English requirement with nothing to compare) is introduced as such, not as "your results".
  const text = !available && checklist.length && ["unassessed_minimums", "missing_evidence"].includes(assessment.reason)
    ? label(checklist.every(item => item.mark === "note") ? "requirements_published_lead" : "requirements_checklist_lead") : fact.text;
  const notes = [
    ...(available && evaluated.some(check => check.status === "unmet") ? [t("university.admissions.catalog.reason.requirements_not_met")] : []),
    ...(fact.notes || []),
    ...(available ? [t("university.admissions.catalog.assessment_limits")] : []),
  ];
  const profileAction = assessment.reason === "missing_evidence"
    ? `<a class="admissions-key-facts__link" href="/profile.html" data-route="profile">${escapeHtml(t("university.admissions.catalog.assessment_profile"))}</a>` : "";
  return row("requirements", { ...fact, text, notes, before: renderMinimumChecklist(checklist) },
    `${fact.cycleRequired ? cycleAction : ""}${profileAction}`, shownTerms);
}

/**
 * How each published condition was checked against the profile, as one closed disclosure for the Admission tab's
 * "Sources" block; the key facts above already state the result.
 * @param {object|null} resolved The admissions-context response.
 * @returns {string} The disclosure as HTML, or "" without an assessment.
 */
export const requirementsCheckDetails = resolved => renderAssessmentChecks(resolved, { recordDomains: ASSESSMENT_RECORD_DOMAINS });

// Where the application is made, as one link to the university's own application page.
// Kazakhstan school and degree documents are this site's main audience, so a reviewed note that the university publishes
// no ruling on them is answered at the top in plain words. A published ruling stays in the requirements detail.
const CREDENTIAL_TOPICS = new Set(["qualification_recognition", "country_specific_qualification_equivalency"]);
const KAZAKHSTAN = /\bKazakhstan\b/;

/**
 * The applicant-facing answer for a Kazakhstan document when the university publishes no ruling on it.
 * @param {object|null} resolved The admissions-context response.
 * @returns {{text: string, links: Array<{url: string, label: string}>}|null}
 */
export function kazakhstanCredentialFact(resolved) {
  const fact = (resolved?.facts || []).find(row => CREDENTIAL_TOPICS.has(row.topic) && row.applicability?.status !== "mismatched"
    && ["verified", "carried_forward"].includes(row.normalized_status?.review) && row.normalized_status?.publication !== "published"
    && KAZAKHSTAN.test([JSON.stringify(row.value ?? ""), ...(row.scope?.applicant_categories || [])].join(" ")));
  if (!fact) return null;
  const source = (resolved?.sources || []).find(item => fact.source_ids?.includes(item.id) && safeUrl(item.url));
  return { text: label("credential_unlisted"), links: source ? [{ url: safeUrl(source.url), label: label("credential_source") }] : [] };
}

function credentialRow(resolved) {
  const fact = kazakhstanCredentialFact(resolved);
  return fact ? row("credential", fact) : "";
}

function applyRow(resolved, applicationUrl) {
  if (!applicationUrl) return "";
  const action = `<a class="admissions-application-link" href="${escapeHtmlAttr(applicationUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.reading.official_application"))}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16")}</a>`;
  // A path applied for through UCAS is not applied for on the university site, so the answer names the service.
  const viaUcas = glossaryTerms(routeWording(resolved?.selected_route)).includes("ucas");
  return row("apply", { text: label(viaUcas ? "apply_text_ucas" : "apply_text") }, action);
}

// The application fee as the university publishes it; nothing is shown when no fee amount is published for the path.
function applicationFeeRow(resolved) {
  const text = applicationFeeText(resolved);
  return text ? row("application_fee", { text }) : "";
}

// The funding row: what the university offers for this path and, when it is a separate application, the action that opens it.
function fundingRow(resolved, shownTerms, { onCostsTab = false } = {}) {
  // The funding application is not a way in, so it is opened from here rather than offered among the paths.
  const funding = fundingFact(resolved, { onCostsTab });
  const action = funding.supportRouteId ? `<button type="button" class="admissions-key-facts__link" data-key-facts-route="${escapeHtmlAttr(funding.supportRouteId)}">${escapeHtml(label("open_funding_route"))}</button>` : "";
  return row("funding", funding, action, shownTerms);
}

// The plain answers that open the Dates and Costs tabs: the same facts as the Admission key facts, so every tab
// answers its question first and keeps the official records behind its sources disclosure.
/**
 * @param {object|null} resolved The admissions-context response; nothing is rendered without a selected route.
 * @param {"deadlines"|"finance"} tab The tab whose answers lead it.
 * @param {{budgetUsd?: number, profileExamIds?: string[], now?: Date}} [options]
 * @returns {string} The answers block as HTML, or "".
 */
export function renderTabAnswers(resolved, tab, { budgetUsd, profileExamIds = [], now = new Date() } = {}) {
  if (!resolved?.selected_route) return "";
  const shownTerms = new Set(resolved.context?.study_level === "undergraduate" ? ["foundation"] : []);
  const rows = tab === "deadlines" ? [row("deadline", deadlineFact(resolved, now, { profileExamIds }), "", shownTerms)]
    : [row("cost", costFact(resolved, budgetUsd), "", shownTerms), applicationFeeRow(resolved), fundingRow(resolved, shownTerms, { onCostsTab: true })];
  return `<section class="admissions-key-facts admissions-key-facts--tab" data-tab-answers="${tab}" aria-label="${escapeHtmlAttr(label("title"))}">
    <dl class="admissions-key-facts__list">${rows.join("")}</dl></section>`;
}

/**
 * @param {object|null} resolved The admissions-context response; nothing is rendered without a selected route.
 * @param {{budgetUsd?: number, profileExamIds?: string[], now?: Date, applicationUrl?: string,
 *   profile?: {languages?: Array<object>}}} [options] `profile` is the API profile, read for the native language and English tests.
 * @returns {string} The key-facts block as HTML, or "".
 */
export function renderAdmissionsKeyFacts(resolved, { budgetUsd, profileExamIds = [], now = new Date(), applicationUrl = "", profile = {}, returnRoute = null } = {}) {
  if (!resolved?.selected_route) return "";
  // A separate grant application is read on its own, so the block says so and offers the admission path it was opened from.
  const supportNotice = resolved.selected_route.classification === "financial_support_application"
    ? `<p class="admissions-key-facts__notice" data-funding-route-notice>${escapeHtml(label("funding_route_viewing"))}${returnRoute
      ? ` <button type="button" class="admissions-key-facts__link" data-key-facts-route="${escapeHtmlAttr(returnRoute.id)}">${escapeHtml(tFormat("university.admissions.key_facts.back_to_route",
        { route: admissionsRouteName(returnRoute, { presentation: "simple" }) }))}</button>` : ""}</p>` : "";
  // The entry cycle belongs to this university's selection, so the action opens the entry-year field.
  const cycleAction = `<button type="button" class="admissions-key-facts__link" data-key-facts-cycle="edit">${escapeHtml(label("set_cycle"))}</button>`;
  const open = (tab, key) => `<button type="button" class="admissions-key-facts__link" data-open-tab="${tab}">${escapeHtml(label(key))}</button>`;
  // A glossary term is explained once per key-facts block, in the first row that names it. A path read for the first
  // year does not need the Foundation term its shared route name carries.
  const shownTerms = new Set(resolved.context?.study_level === "undergraduate" ? ["foundation"] : []);
  return `<section class="admissions-key-facts" data-admissions-key-facts aria-labelledby="admissionsKeyFactsTitle">
    <h3 id="admissionsKeyFactsTitle">${escapeHtml(label("title"))}</h3>${supportNotice}
    <dl class="admissions-key-facts__list">
      ${requirementsRow(resolved, cycleAction, shownTerms, profile)}
      ${credentialRow(resolved)}
      ${applyRow(resolved, applicationUrl)}
      ${row("deadline", deadlineFact(resolved, now, { profileExamIds }), open("tab-deadlines", "open_deadlines"), shownTerms)}
      ${row("cost", costFact(resolved, budgetUsd), open("tab-finance", "open_finance"), shownTerms)}
      ${applicationFeeRow(resolved)}
      ${fundingRow(resolved, shownTerms)}
    </dl>
    <p class="admissions-reading__note">${escapeHtml(label("note"))}</p>
  </section>`;
}
