import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { heroIcon } from "../../icons.js";
import { formatExamValue, getExamConfig, getExamDisplayName } from "../../utils/config.js";
import { translateAdmissionSummary, translateAdmissionText, translateFactSource, translateProgramName } from "../../university-translations.js";
import { localizeDuration, trProgramLanguage, trStudyMode } from "../_shared.js";
import { hasReviewWarning, isPublished, needsResolution, publicationState, PUBLICATION_LABEL_KEYS, reviewState, REVIEW_LABEL_KEYS } from "./admissions-status.js";

const PREFIX = "university.admissions.catalog.";

export function admissionsCycleLabel(value) {
  const raw = String(value || "");
  const month = raw.match(/^(January|February|March|April|May|June|July|August|September|October|November|December) (20\d{2})$/);
  if (month) {
    const index = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(month[1]) + 1;
    return `${t(`university.admissions.reading.month_standalone.${index}`, month[1])} ${month[2]}`;
  }
  // Source cycles are published as "2027 entry", "2027-28 entry" and occasionally "2027/28entry".
  const entry = raw.match(/^(Fall|Spring|Summer|Winter)? ?(20\d{2}(?:-(?:\d{2}|20\d{2})|\/\d{2}(?= ?entry))?)(?: ?entry)?(?: \((January|February|March|April|May|June|July|August|September|October|November|December)\))?$/);
  if (!entry) return translateAdmissionSummary(raw) || raw;
  const cycle = tFormat(`university.admissions.reading.${entry[1] ? `entry_${entry[1].toLowerCase()}` : "entry_year"}`, { year: entry[2] });
  const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(entry[3]) + 1;
  return monthIndex ? `${cycle} (${t(`university.admissions.reading.month_standalone.${monthIndex}`)})` : cycle;
}

export function admissionsProgramLabel(option, { includeAward = false } = {}) {
  const officialTitle = String(option?.title || "");
  const suffix = officialTitle.match(/ \(([^()]+)\)$/);
  const courseCode = option?.id?.startsWith("mit-") && suffix?.[1].startsWith("Course ") ? suffix[1].slice(7) : "";
  const award = suffix && option.awards?.some(award => award.toLowerCase() === suffix[1].toLowerCase());
  const name = courseCode || award ? officialTitle.slice(0, suffix.index) : officialTitle;
  const qualification = includeAward && !award && option?.catalog_classification === "ucas_course_choice" ? option.awards?.join(" / ") : "";
  return { title: translateProgramName(name) + (award ? ` (${suffix[1]})` : qualification ? ` (${qualification})` : ""), officialTitle, courseCode };
}

export const ADMISSIONS_RENDER_LABELS = {
  source_text_note: "Official wording remains in its original language. Each record has its own scope, period and conditions; expand a row to see its source details.",
  source_note_simple: "Official source text is shown in its original language.",
  conditional: "Conditional — applicability still needs verification",
  scope_varies: "Scope varies",
  matched: "Matches selected context",
  unknown: "Unknown",
  published: "Published",
  partly_published: "Partly published",
  limited_publication: "Published with a limited or unresolved scope",
  conflicting: "Conflicting official sources",
  review: "Evidence review",
  "review.verified": "Verified",
  "review.reviewed": "Reviewed",
  "review.carried_forward_review": "Previous source review retained",
  "review.conflicting": "Conflicting official sources",
  "review.superseded": "Superseded source review",
  "review.limited": "Source reviewed; some scope or conditions still need verification",
  "review.needs_resolution": "Source review needs resolution",
  "route_entry.external": "Application open to new applicants",
  "route_entry.external_restricted": "Application for a restricted applicant group",
  "route_entry.internal": "Current students only",
  "route_entry.no_admission": "Awarded during another degree; no separate application",
  "route_entry.closed": "Not open to new applicants",
  "route_entry.unresolved": "Application path needs clarification",
  not_published: "Not published",
  needs_review: "Needs review",
  historical: "Historical source record",
  checked: "Official page checked",
  period: "Published period",
  scope: "Source scope",
  conditions: "Conditions and exceptions",
  exceptions: "Exceptions",
  source: "Official source",
  no_facts: "No source records are catalogued for this selection in this section. Check the official program and application pages.",
  no_context: "Select a study option and its application route to view scoped source records.",
  unknowns: "Unresolved source information",
  next_step: "Official next step",
  history: "Historical records",
  history_note: "These records are retained as historical context and are not current requirements or prices for the selected cycle.",
  assessment: "Minimum requirements match",
  assessment_meaning: "The percentage is the share of evaluable published academic and language minimum checks met. It is not an admission probability, a check of all admission criteria, or a funding prediction.",
  assessment_unavailable: "No requirements-match percentage is available for this context.",
  assessment_count: "{met} of {total} evaluated numeric minimum checks met",
  assessment_limits: "Other conditions and admission eligibility are not assessed; this is not an admission probability.",
  assessment_next_missing: "Add the missing evidence in your profile, then review the checks below.",
  assessment_next_unassessed: "Some published rules cannot be checked automatically. Review the official requirements below.",
  assessment_next_no_numeric: "Our data has no numeric minimum for this path that can be compared automatically. Review the official requirements below.",
  assessment_next_applicability: "Check your program, application path and entry year. Review the official conditions below.",
  assessment_profile: "Edit profile",
  self_reported: "Applicant evidence is self-reported; it is not institution-confirmed.",
  provided: "Reported evidence",
  minimum: "Published minimum",
  rule: "Rule being checked",
  source_rule: "Original published rule",
  met: "Met",
  unmet: "Not met",
  missing: "Evidence missing",
  unassessed: "Not assessed",
  yes: "Yes",
  no: "No",
  detail: "Source detail",
  source_scope_details: "Source and conditions",
  "program_detail.study": "Study details",
  "program_detail.fees": "Published course fees",
  "program_detail.degree_policies": "Degree requirements and policies",
  "program_detail.curriculum": "Curriculum and pathways",
  full_source_record: "Full source record",
  full_source_text: "Full published wording",
  published_qualification_table: "Published qualification tables",
  qualification_count: "{count} qualifications",
  record_count: "{count} records",
  check_details: "Optional profile check of published minimums",
  publication: "Publication status",
  "route_class.ucas_course_choice": "UCAS course choice",
  "route_class.postgraduate_course_choice": "Postgraduate course application",
  "topic.eligibility": "Eligibility",
  "topic.academic": "Academic qualifications",
  "topic.tests": "Tests",
  "topic.language": "Language requirements",
  "topic.documents": "Application documents",
  "topic.portfolio": "Interviews and portfolios",
  "topic.application": "Application process",
  "topic.deadlines": "Dates and application windows",
  "topic.costs": "Costs and fees",
  "topic.funding": "Funding",
  "topic.study": "Study content and structure",
  "topic.completion": "Degree completion",
  "topic.offers": "Offers and enrollment",
  "topic.support": "Student support",
  "domain.institution": "Institution information",
  "domain.study": "Study content and structure",
  "domain.degree_completion": "Degree completion and declaration",
  "domain.requirements": "Admission requirements",
  "domain.application": "Application process and documents",
  "domain.offer_enrollment": "Offers and enrollment",
  "domain.deadlines": "Application and funding dates",
  "domain.costs": "Published costs",
  "domain.funding": "Funding and award conditions",
  "domain.career": "Careers and outcomes",
  "domain.student_support": "Student support",
  "domain.other": "Other source information",
  "domain.reference": "Related source comparisons",
  "reason.applicability_unknown": "The selected context or applicant applicability has not been established.",
  "reason.missing_evidence": "Required applicant evidence is missing.",
  "reason.unassessed_minimums": "Some published minima or their conditions cannot yet be assessed.",
  "reason.entry_cycle_required": "Choose your entry year, for example \"Fall 2027\", to check your scores against these minimums.",
  "reason.no_published_requirements": "No evaluable published numeric minimum is catalogued for this context.",
  "reason.requirements_not_met": "At least one evaluated published minimum was not met.",
  "reason.source_fact_changed": "The source record changed and its assessment needs review.",
  "reason.source_state_not_verified": "The source rule is not verified for assessment.",
  "reason.funding_selection_separate": "Funding selection is separate from admission. No admission requirements percentage is calculated for this funding context.",
  "kind.exam_alternatives": "Required test alternatives",
  "kind.academic_requirement": "Academic qualification",
  "kind.manual_minimum": "Minimum requiring individual evidence review",
  "kind.required_exam_presence": "Required test evidence",
  "kind.scoped_gpa": "Scoped academic average",
  "kind.enrollment": "Enrollment condition",
  "kind.enrollment_units": "Major-course completion",
  "kind.credential": "Credential condition",
  "kind.language_requirement": "Language requirement",
  "kind.covered_minima": "Related minimum checks",
  "kind.remaining_conditions": "Remaining source conditions",
  "kind.published_rule": "Published admission rule",
  "kind.conditional_rule": "Conditional admission rule",
  "kind.unresolved_rule": "Unresolved admission rule",
  "kind.stale_annotation": "Source rule needs review",
  "kind.source_state": "Source status needs review",
  "field.currency": "Currency",
  "field.period": "Price period",
  "field.amount": "Amount",
  "field.value": "Value",
  "field.minimum": "Minimum",
  "field.scale": "Original scale",
  "field.unit": "Unit",
  "field.units": "Total degree units",
  "field.major_units": "Major units",
  "field.completed_major_subjects": "Completed major subjects",
  "field.metric": "Academic metric",
  "field.status": "Status",
  "field.taken_on": "Test date",
  "field.as_of_term": "As of term",
  "field.levels": "Study levels",
  "field.applicant_categories": "Applicant categories",
  "field.cycle": "Source cycle",
  "field.fee_status": "Fee-status conditions",
  "field.additional_dimensions": "Additional applicability conditions",
  "field.study": "Study option",
  "field.application": "Application route",
  "field.duration": "Duration",
  "field.mode": "Study mode",
  "field.language": "Teaching language",
  "field.location": "Location",
  "field.department": "Department",
  "field.start_date": "Start date",
  "field.A3i6E": "Program description",
  "field.WOZxr": "External-credit policy",
  "field.ItCSB": "Program requirements",
  "field.advisingExpectations": "Advising expectations",
  "field.cotermQuartersBack": "Coterminal course-transfer timing",
  "field.cotermTransferPolicy": "Coterminal course-transfer policy",
  "field.programGradingPolicies": "Program grading policies",
  "field.programGPARequirement": "Program completion GPA requirement",
  "field.programAdditionalPolicies": "Additional program policies",
  "field.exam_id": "Exam",
  "field.credential_id": "Credential",
  "field.score_percent": "Credential result (%)",
  "field.subjects_minimum": "Minimum major subjects",
  "field.required_modules": "Required test modules",
  "field.allowed_windows": "Published test windows",
  "field.alternatives": "Published alternatives",
  "field.condition": "Condition",
  "field.component_minimums": "Required section minimums",
  "field.components_at_least": "Required subject results",
  "field.profile_field": "Profile evidence",
  "field.gpa_scale": "Original GPA scale",
  "field.count": "Required count",
  "field.reported": "Reported count",
  "field.meeting_minimum": "Results meeting the minimum",
  "field.score": "Reported score",
  "field.details": "Report details",
  "field.components": "Reported sections and subjects",
  "field.raw_value": "Reported grade or result",
  "field.display_value": "Recorded result",
  "field.requires_review": "Requires individual review",
  "field.windows": "Published periods",
  "field.date_boundary": "Published test-date limits",
  "field.max_age_years": "Maximum test age in years",
  "field.search_opens": "Course search opens",
  "field.preparation_opens": "Application preparation opens",
  "field.submission_opens": "Application submission opens",
  "field.medicine_deadline": "Medicine application deadline",
  "field.other_course_equal_consideration": "Equal consideration deadline for other courses",
  "field.a_level_results": "A-level results",
  "field.date": "Date",
  "field.time": "Time",
  "field.timezone": "Time zone",
  "field.scope": "Applies to",
  record_link: "Show full source record",
  counted_minimum: "At least {count} results, each {minimum} or higher",
  counted_provided: "{reported} reported; {met} meet the minimum",
};

function label(key) {
  return t(`${PREFIX}${key}`, ADMISSIONS_RENDER_LABELS[key] || ADMISSIONS_RENDER_LABELS.detail);
}

export function admissionsRouteName(route, { presentation } = {}) {
  const localized = presentation === "simple" && route?.id ? t(`${PREFIX}route_name.${route.id.replaceAll(":", ".")}`) : "";
  if (localized) return localized;
  if (presentation === "simple" && !route?.title && !route?.target && route?.classification) {
    const key = `route_class.${route.classification}`;
    return t(`${PREFIX}${key}`) || label(ADMISSIONS_RENDER_LABELS[key] ? key : route.entry ? `route_entry.${route.entry}` : "route_label");
  }
  const name = route?.title || route?.target || route?.classification || route?.destination || label("route_label");
  return name;
}

const DOMAINS = ["institution", "study", "degree_completion", "requirements", "application", "offer_enrollment", "deadlines", "costs", "funding", "career", "student_support", "other"];
const TOPIC_HEADINGS = [
  ["eligibility", ["eligibility", "restriction", "restrictions"]],
  ["academic", ["academic", "qualification", "qualifications", "credential", "credentials", "prerequisite", "prerequisites", "preparation"]],
  ["language", ["english", "language"]],
  ["tests", ["test", "tests", "gre", "minima"]],
  ["documents", ["document", "documents", "materials", "essays", "questions", "sample", "samples"]],
  ["portfolio", ["portfolio", "portfolios", "interview", "interviews"]],
  ["application", ["application", "admissions", "admission", "route", "routes", "selection"]],
  ["deadlines", ["deadline", "deadlines", "window", "windows", "dates", "timing", "timeline"]],
  ["costs", ["cost", "costs", "tuition", "fee", "fees", "charges", "billing", "payment"]],
  ["funding", ["funding", "aid", "scholarship", "scholarships"]],
  ["study", ["study", "curriculum", "duration", "structure", "tracks", "content"]],
  ["completion", ["completion", "declaration"]],
  ["offers", ["offer", "offers", "enrollment", "enrolment", "decision", "decisions"]],
  ["support", ["housing", "support"]],
];
const INTERNAL_FIELDS = new Set([
  "id", "topic", "topics", "provenance", "attributes", "index_attributes", "source_locator",
  "review_attempts", "scope", "measurable", "blocksNumericScore",
  "addressed_conditions", "covered_check_ids", "subjects_field", "field", "mapping_reviewed_at", "score_strategy", "component_count",
  "origin", "university_id", "program_id", "option_ids", "route_ids", "applicant_routes", "cycles",
  "bulletin_external_admissions_field_present", "bulletin_internal_admissions_field_present", "bulletin_coterm_admissions_field_present",
  "legacy_field",
]);
const ENUM_LABELS = {
  source_conflict_requires_confirmation: "conflicting",
  strongly_recommended: "enum.strongly_recommended", not_stated: "enum.not_stated",
  not_published_on_this_page: "enum.not_published_on_this_page", paper: "enum.paper", digital: "enum.digital",
  preparation: "study_level.preparation", undergraduate: "study_level.undergraduate", masters: "study_level.masters", doctoral: "study_level.doctoral", professional: "study_level.professional", residency: "study_level.residency", non_degree: "study_level.non_degree",
  first_year: "applicant.first_year", transfer: "applicant.transfer", graduate: "applicant.graduate",
  self_reported_home_domestic: "fee.home", self_reported_international_overseas: "fee.overseas",
  required: "enum.required", not_required: "enum.not_required", recommended: "enum.recommended",
  unknown: "unknown", not_published: "not_published", needs_review: "needs_review",
  enrolled: "enum.enrolled", completed: "enum.completed", in_progress: "enum.in_progress", not_started: "enum.not_started",
  overall: "enum.overall", technical: "enum.technical", major: "enum.major",
  required_coursework: "enum.required_coursework", study_period_or_pathway: "enum.study_period_or_pathway",
  project_or_dissertation: "enum.project_or_dissertation", student_choice_coursework: "enum.student_choice_coursework",
  published_catalog_expected_length: "enum.published_catalog_expected_length",
  catalog_metadata_not_fixed_individual_duration: "enum.catalog_metadata_not_fixed_individual_duration",
  required_if_applicable: "enum.required_if_applicable", not_accepted: "enum.not_accepted", not_set: "unknown",
  prior_cycle_only: "enum.prior_cycle_only", published_current_page_cycle: "enum.published_current_page_cycle",
  same_all_statuses: "enum.same_all_statuses", postgraduate_taught: "enum.postgraduate_taught",
  independent_award_entry: "enum.independent_award_entry", course_application: "enum.course_application",
  post_admission_major: "enum.post_admission_major", institution_wide: "enum.institution_wide",
  program_specific: "enum.program_specific", route_wide: "enum.route_wide",
  academic_year: "enum.academic_year", one_time: "enum.one_time",
};
// Structured snake_case codes are shown through localized `enum.<code>` labels; codes without one are humanized, never shown raw.
const CODE_VALUE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const CODE_IN_TEXT = /(?<![\w@./-])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\w@/-])/g;
const humanizeCode = code => { const words = code.replaceAll("_", " "); return words.charAt(0).toUpperCase() + words.slice(1); };
const codeLabel = code => t(`${PREFIX}enum.${code}`, humanizeCode(code));
const localizeCodeTokens = text => String(text).replace(CODE_IN_TEXT, code => codeLabel(code));
Object.assign(ADMISSIONS_RENDER_LABELS, {
  "field.possible_exemption_evidence_kinds": "Language background for individual exemption review",
  "study_level.preparation": "Preparation", "study_level.undergraduate": "Undergraduate", "study_level.masters": "Master's", "study_level.doctoral": "Doctoral", "study_level.professional": "Professional", "study_level.residency": "Residency", "study_level.non_degree": "Non-degree",
  "applicant.first_year": "First-year applicant", "applicant.transfer": "Transfer applicant", "applicant.graduate": "Graduate applicant",
  "fee.home": "Self-reported home/domestic status", "fee.overseas": "Self-reported international/overseas status",
  "enum.required": "Required", "enum.not_required": "Not required", "enum.recommended": "Recommended",
  "enum.enrolled": "Enrolled", "enum.completed": "Completed", "enum.in_progress": "In progress", "enum.not_started": "Not started",
  "enum.overall": "Overall", "enum.technical": "Technical", "enum.major": "Major",
  "enum.required_coursework": "Required coursework", "enum.study_period_or_pathway": "Study period or pathway",
  "enum.project_or_dissertation": "Project or dissertation", "enum.student_choice_coursework": "Student-choice coursework",
  "enum.published_catalog_expected_length": "Expected length published in the catalog",
  "enum.catalog_metadata_not_fixed_individual_duration": "Catalog duration; individual study length is not fixed",
  "enum.required_if_applicable": "Required when applicable", "enum.not_accepted": "Not accepted",
  "enum.prior_cycle_only": "Published for a previous cycle only", "enum.published_current_page_cycle": "Published cycle on the reviewed page",
  "enum.same_all_statuses": "Same published amount for all fee statuses", "enum.postgraduate_taught": "Postgraduate taught study",
  "enum.independent_award_entry": "Separate award entry", "enum.course_application": "Course-specific application",
  "enum.post_admission_major": "Major chosen after institutional admission", "enum.institution_wide": "Institutional admission",
  "enum.program_specific": "Program-specific", "enum.route_wide": "Application-route scope",
  "enum.academic_year": "Academic year", "enum.one_time": "One-time payment",
});

function safeUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
}

function sourceLink(url, title = label("source")) {
  const safe = safeUrl(url);
  const localizedTitle = translateFactSource(title, title);
  return safe ? `<a href="${escapeHtmlAttr(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localizedTitle)}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16 admissions-catalog__source-icon")}</a>` : "";
}

function internalField(key) {
  if (["exam_id", "credential_id"].includes(key)) return false;
  // Selector fields are join keys into the source page markup, not applicant-facing facts.
  return INTERNAL_FIELDS.has(key) || /(?:^|_)(?:ids?|hash|sha256|refs?)$/.test(key) || /(?:Id|Ids|Revision|Hash)$/.test(key) || /selector/i.test(key);
}

// A nested `scope` list of course names is published content; the record-level `scope` object stays internal.
const publishedScopeList = (key, entry) => key === "scope" && Array.isArray(entry) && entry.length > 0 && entry.every(item => typeof item === "string");

function fieldLabel(key, referenceLabels = {}) {
  if (key === "assessment_state") return escapeHtml(label("field.status"));
  if (Object.hasOwn(referenceLabels, key)) return escapeHtml(translateProgramName(referenceLabels[key]));
  if (getExamConfig(key)) return escapeHtml(getExamDisplayName(key, { locale: getCurrentLanguage() }));
  const localized = t(`${PREFIX}field.${key}`);
  if (localized) return escapeHtml(localized);
  if (ADMISSIONS_RENDER_LABELS[`field.${key}`]) return escapeHtml(label(`field.${key}`));
  const text = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  const field = text.charAt(0).toUpperCase() + text.slice(1);
  return escapeHtml(translateAdmissionSummary(field) || field);
}

function scalar(value, referenceLabels = {}) {
  if (value === null || value === undefined) return escapeHtml(label("unknown"));
  if (typeof value === "boolean") return escapeHtml(label(value ? "yes" : "no"));
  if (typeof value === "number") {
    const locale = { eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" }[getCurrentLanguage()];
    const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
    const fractionDigits = Math.min(20, (mantissa.split(".")[1] || "").length + Math.max(0, Number(exponent) || 0));
    return new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits }).format(value);
  }
  const text = String(value);
  if (Object.hasOwn(referenceLabels, text)) return escapeHtml(translateProgramName(referenceLabels[text]));
  const languageKinds = { education: "Education", employment: "Work experience", primary_language: "First language" };
  if (Object.hasOwn(languageKinds, text)) return escapeHtml(t(`profile.evidence.language_kind.${text}`, languageKinds[text]));
  if (/^(?:source-[a-f0-9]+|[a-f0-9]{32,}|[a-f0-9-]{36})$/i.test(text)) return "";
  if (ENUM_LABELS[text]) return escapeHtml(label(ENUM_LABELS[text]));
  if (ADMISSIONS_RENDER_LABELS[`kind.${text}`]) return escapeHtml(label(`kind.${text}`));
  if (getExamConfig(text) || /^(?:TOEFL|GMAT|IELTS|DUOLINGO|CAMBRIDGE)_/.test(text)) return escapeHtml(getExamDisplayName(text));
  if (/^https?:\/\//i.test(text)) return sourceLink(text);
  if (CODE_VALUE.test(text)) return escapeHtml(codeLabel(text));
  const localized = localizeCodeTokens(text);
  const summary = translateAdmissionSummary(text);
  if (summary) return escapeHtml(summary === text ? localized : summary);
  const program = translateProgramName(text);
  return escapeHtml(program !== text ? program : translateAdmissionText(localized, localized));
}

// Published round names that have a localized label; any other published name is shown as published.
const WINDOW_NAME_KEYS = {
  "Early Action": "early_action", "Regular Action": "regular_action", "Restrictive Early Action": "restrictive_early_action",
  "Regular Decision": "regular_decision", "Transfer application": "transfer_application",
  "Priority deadline": "priority_deadline", "Application deadline": "application_deadline",
};

export const admissionWindowName = name => WINDOW_NAME_KEYS[name] ? t(`university.admissions.reading.${WINDOW_NAME_KEYS[name]}`) : name;

export function admissionDeadlineTitle(event) {
  if (!event.kind) return translateAdmissionText(event.title, event.title);
  const kind = t(`university.deadlines.kind.${event.kind}`);
  const round = event.name?.match(/^Round (\d+)$/);
  const name = round ? tFormat("university.deadlines.round", { number: round[1] })
    : event.name === "Early Action" ? t("university.admissions.reading.early_action")
      : event.name === "Regular Action" ? t("university.admissions.reading.regular_action")
        : event.name === "MBA Early" ? t("university.deadlines.mba_early") : admissionsCycleLabel(event.name);
  const title = event.kind === "test" && event.applicationCategory === "financial_support" && event.examId
    ? tFormat("university.deadlines.test_for_funding", { exam: getExamDisplayName(event.examId) }) : name ? `${kind} · ${name}` : kind;
  return event.publicationStatus === "published_dated_reference" ? `${title} · ${t("university.deadlines.dated_reference")}` : title;
}

// Prepared bulletin notes can embed a Python dict literal, e.g. "...: {'externalAdmissions': True}.".
// The literal is split on commas and each entry is matched on its own, so no pattern can backtrack across entries.
const PYTHON_DICT_ENTRY = /^'([A-Za-z]\w*)'\s*:\s*(True|False|None|-?\d+(?:\.\d+)?)$/;

function pythonDictFlags(text) {
  const trimmed = text.trim();
  const end = trimmed.endsWith("}.") ? trimmed.length - 2 : trimmed.endsWith("}") ? trimmed.length - 1 : -1;
  const start = trimmed.lastIndexOf("{", end);
  if (end < 0 || start < 0) return null;
  const parts = trimmed.slice(start + 1, end).split(",").map(part => part.trim());
  if (parts.at(-1) === "") parts.pop();
  const entries = parts.map(part => PYTHON_DICT_ENTRY.exec(part));
  if (!entries.length || entries.some(entry => !entry)) return null;
  const flags = Object.fromEntries(entries.map(([, key, raw]) => [key,
    raw === "True" ? true : raw === "False" ? false : raw === "None" ? null : Number(raw)]));
  return { note: trimmed.slice(0, start).trim().replace(/:$/, "").trim(), flags };
}

export function renderAdmissionsValue(value, referenceLabels = {}) {
  if (typeof value === "string") {
    const dict = pythonDictFlags(value);
    if (dict) {
      const note = dict.note ? `<p>${escapeHtml(translateAdmissionText(dict.note, dict.note))}</p>` : "";
      return `${note}${renderAdmissionsValue(dict.flags, referenceLabels)}`;
    }
  }
  if (Array.isArray(value)) {
    // Identical rendered items add no information, so each is shown once.
    const items = [...new Set(value.map(item => renderAdmissionsValue(item, referenceLabels)).filter(Boolean))];
    return items.length ? `<ul class="admissions-catalog__items">${items.map(item => `<li>${item}</li>`).join("")}</ul>` : "";
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([key, entry]) => !internalField(key)
      || publishedScopeList(key, entry)
      || (key === "applicant_routes" && Array.isArray(entry) && entry.some(item => item && typeof item === "object"))).map(([key, entry]) => {
      const content = key === "score" && Number.isFinite(entry) && getExamConfig(value.exam)
        ? escapeHtml(formatExamValue(value.exam, value, { locale: getCurrentLanguage() })) : renderAdmissionsValue(entry, referenceLabels);
      return content ? `<div class="admissions-catalog__entry"><dt>${fieldLabel(key, referenceLabels)}</dt><dd>${content}</dd></div>` : "";
    }).filter(Boolean);
    return entries.length ? `<dl class="admissions-catalog__values">${entries.join("")}</dl>` : "";
  }
  return scalar(value, referenceLabels);
}

function reviewedStudyRows(resolved) {
  const option = resolved?.selected_option;
  if (!option) return [];
  const studyIds = new Set(resolved.fact_groups?.study || []);
  return (resolved.facts || []).filter(row => studyIds.has(row.id)
    && ["published", "published_with_limits", "partially_published"].includes(publicationState(row))
    && !hasReviewWarning(row)
    && row.applicability?.status !== "mismatched" && row.scope?.option_ids?.includes(option.id)
    && (!row.scope.route_ids?.length || ["study_content", "study_structure"].includes(row.topic)) && row.value && typeof row.value === "object");
}

function studyDescriptionEntry(row) {
  if (!row) return null;
  const keys = ["description", "course_overview", "course_page_programme_summary", "A3i6E", "content", ...(row.topic === "study_content" ? ["source_content"] : [])];
  return keys.map(key => [key, row.value[key]]).find(([, value]) => typeof value === "string" && value.trim()) || null;
}

function studyDescriptionRow(resolved) {
  return reviewedStudyRows(resolved).find(studyDescriptionEntry);
}

const STUDY_FIELD_FORMATTERS = { duration: localizeDuration, mode: trStudyMode, language: trProgramLanguage, start_date: admissionsCycleLabel };
const STUDY_FIELD_KEYS = { duration: "duration", mode: "mode", language: "language", location: "location", department: "department", start_date: "start_date",
  Duration: "duration", "Study mode": "mode", Language: "language", Location: "location", "Delivered by": "department", "Start date": "start_date" };

function displayedStudyValue(key, value) {
  if (typeof value !== "string" && !(Array.isArray(value) && value.every(item => typeof item === "string"))) return "";
  const entries = (Array.isArray(value) ? value : [value]).filter(item => !["not_stated", "not_specified", "unknown", "unconfirmed"].includes(item.trim().toLowerCase().replace(/[\s-]+/g, "_")));
  return entries.map(item => {
    const formatted = STUDY_FIELD_FORMATTERS[key] ? STUDY_FIELD_FORMATTERS[key](item) : item;
    if (getCurrentLanguage() === "eng") return formatted;
    const simpleDuration = key === "duration" && /^\d+(?:\.\d+)?\s*(?:years?|yrs?|months?|weeks?|days?|semesters?)$/i.test(item);
    if (formatted !== item && (key !== "duration" || simpleDuration)) return formatted;
    return translateAdmissionSummary(item) || formatted;
  }).join(", ");
}

export function studyOverviewCoverage(resolved) {
  const row = studyDescriptionRow(resolved);
  if (!row) return null;
  const essentials = new Map(studyOptionEssentials(resolved));
  const valueKeys = [studyDescriptionEntry(row)[0], ...Object.entries(row.value)
    .filter(([key, value]) => STUDY_FIELD_KEYS[key] && displayedStudyValue(STUDY_FIELD_KEYS[key], value) === essentials.get(STUDY_FIELD_KEYS[key]))
    .map(([key]) => key)];
  return { factId: row.id, valueKeys };
}

function programDetailTitle(row) {
  if ([row.title, row.label, row.value?.title, row.value?.label, row.value?.heading].some(value => typeof value === "string" && value.trim())) return "";
  const value = row.value || {};
  if (value.course_page_tuition_fees) return label("program_detail.fees");
  if (value.ItCSB || value.minimum_program_units || value.advisingExpectations || value.programGradingPolicies) return label("program_detail.degree_policies");
  if (value.structure || value.study_periods_pathways_and_components || value.variant_progression_conditions) return label("program_detail.curriculum");
  return "";
}

export function studyOptionEssentials(resolved) {
  const rows = reviewedStudyRows(resolved);
  const publishedKeys = { duration: "Duration", mode: "Study mode", location: "Location", start_date: "Start date", department: "Delivered by", language: "Language" };
  return ["duration", "mode", "language", "location", "department", "start_date"].flatMap(key => {
    const catalogLanguage = key === "language" ? resolved?.selected_option?.format?.language : null;
    const value = (catalogLanguage && catalogLanguage !== "not_stated" ? catalogLanguage : null)
      ?? rows.map(row => row.value[key] ?? row.value[publishedKeys[key]]).find(value => value != null && value !== "")
      ?? resolved?.selected_option?.format?.[key]
      ?? (key === "location" ? resolved?.selected_option?.format?.campus : undefined);
    const formatted = displayedStudyValue(key, value);
    return formatted ? [[key, formatted]] : [];
  });
}

export function renderStudyOptionOverview(resolved, { includeSources = true } = {}) {
  const option = resolved?.selected_option;
  if (!option) return "";
  const overview = option.overviews?.find(row => typeof row.text === "string" && row.text.trim());
  const descriptionRow = studyDescriptionRow(resolved);
  const description = studyDescriptionEntry(descriptionRow)?.[1] || overview?.text;
  const summary = translateAdmissionSummary(description, { section: "study" });
  const translatedDescription = summary || translateAdmissionSummary(description);
  const hasStudyRecords = (resolved.fact_groups?.study || []).some(id => resolved.facts?.some(row =>
    row.id === id && row.scope?.option_ids?.includes(option.id) && row.applicability?.status !== "mismatched"));
  const descriptionHtml = description ? `<p class="program-card__description"><span${translatedDescription ? "" : ' lang="en"'}>${escapeHtml(translatedDescription || description)}</span> <span class="admissions-programs__admission-note">${escapeHtml(t("university.admissions.catalog.requirements_tab_hint"))}</span></p>`
    : `<p class="admissions-context__note" data-program-overview-missing>${escapeHtml(t(`university.admissions.reading.${hasStudyRecords ? "structured_study" : "overview_missing"}`))}</p>`;
  const fields = studyOptionEssentials(resolved).map(([key, value]) => `<div class="program-card-row"><dt class="program-card-label">${escapeHtml(label(`field.${key}`))}</dt><dd class="program-card-value">${escapeHtml(value)}</dd></div>`);
  const awards = [...new Set(option.awards || [])];
  const degrees = awards.map(award => award === "MEng"
    ? t("university.admissions.reading.degree.MEng", "Master of Engineering")
    : t(`university.admissions.reading.degree.${award}`)).filter(Boolean);
  if (option.catalog_classification === "ucas_course_choice" && awards.includes("MEng")) {
    degrees.push(t("university.admissions.reading.degree.MEng_ucas_note", "This is an undergraduate entry route that leads to the Master of Engineering award."));
  }
  return `${degrees.length ? `<p class="admissions-context__note" data-award-explanation>${degrees.map(escapeHtml).join(" · ")}</p>` : ""}${descriptionHtml}${fields.length ? `<dl class="program-card-rows admissions-programs__essentials">${fields.join("")}</dl>` : ""}${includeSources ? renderStudyOptionSources(resolved) : ""}`;
}

export function renderStudyOptionSources(resolved, { includeStudyInfo = false } = {}) {
  const option = resolved?.selected_option;
  if (!option) return "";
  const overview = option.overviews?.find(row => typeof row.text === "string" && row.text.trim());
  const descriptionRow = studyDescriptionRow(resolved);
  const overviewSourceIds = descriptionRow?.source_ids || overview?.source_ids || reviewedStudyRows(resolved)[0]?.source_ids || option.source_ids || [];
  const sourceRows = (resolved.sources || []).filter(source => overviewSourceIds.includes(source.id));
  const sourcesByUrl = new Map(sourceRows.map(source => {
    const title = source.title?.startsWith(`${option.title} | `) ? source.title.slice(option.title.length + 3) : source.title;
    return [safeUrl(source.url), { link: sourceLink(source.url, title || label("source")), checkedAt: source.checked_at || descriptionRow?.checked_at }];
  }).filter(([url, entry]) => url && entry.link));
  const courseUrl = safeUrl(option.course_url);
  if (courseUrl && !sourcesByUrl.has(courseUrl)) sourcesByUrl.set(courseUrl, { link: sourceLink(courseUrl, label("official_course_page")), checkedAt: descriptionRow?.checked_at });
  const entries = [...sourcesByUrl.values()];
  if (!entries.length && !includeStudyInfo) return "";
  const factAttrs = descriptionRow?.id ? `data-admissions-fact="${escapeHtmlAttr(descriptionRow.id)}" data-admissions-domain="study"` : "";
  const items = entries.map(({ link, checkedAt }) => `<li>${link}${checkedAt ? `<span class="admissions-catalog__meta">${escapeHtml(label("checked"))}: ${escapeHtml(checkedAt)}</span>` : ""}</li>`).join("");
  return `<div class="admissions-programs__sources"><details class="admissions-programs__references" ${factAttrs}><summary>${escapeHtml(t("university.admissions.reading.source_and_date"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-programs__references-body">${items ? `<ul class="admissions-programs__source-list" data-program-overview-sources>${items}</ul>` : ""}</div></details></div>`;
}

// One line per distinct official URL. `compact` uses the short "Checked" caption and falls back to the record's own
// checked date when no linked source carries one, so every record keeps a visible checked date.
function sources(row, resolved, { compact = false } = {}) {
  const ids = row.source_ids || row.sourceIds || [];
  const byUrl = new Map();
  for (const source of (resolved.sources || []).filter(item => ids.includes(item.id))) {
    const url = safeUrl(source.url);
    if (!url) continue;
    if (!byUrl.has(url)) byUrl.set(url, { titles: new Set(), dates: new Set() });
    const entry = byUrl.get(url);
    if (source.title) entry.titles.add(source.title);
    if (source.checked_at) entry.dates.add(source.checked_at);
  }
  const caption = escapeHtml(compact ? t("university.admissions.checked", "Checked") : label("checked"));
  const meta = dates => dates.length ? `<span class="admissions-catalog__meta">${caption}: ${dates.map(escapeHtml).join(", ")}</span>` : "";
  if (compact && row.checked_at && ![...byUrl.values()].some(entry => entry.dates.has(row.checked_at))) {
    if (!byUrl.size) return `<div>${meta([row.checked_at])}</div>`;
    const [first] = byUrl.values();
    first.dates.add(row.checked_at);
  }
  return [...byUrl].map(([url, entry]) => `<div>${sourceLink(url, [...entry.titles].join(" · ") || label("source"))}${meta([...entry.dates])}</div>`).join("");
}

const sourcesBlock = html => html ? `<div class="admissions-catalog__sources">${html}</div>` : "";

// Conditions, combined conditions-and-exceptions and exceptions often repeat the same sentence; show each once.
function recordConditions(row, resolved) {
  const seen = new Set();
  return [row.conditions, row.conditions_and_exceptions, row.exceptions].filter(value => value !== null && value !== undefined)
    .map(value => renderAdmissionsValue(value, resolved.reference_labels)).filter(html => html && !seen.has(html) && seen.add(html)).join("");
}

// Baseline states (published, verified) are not repeated per record; only deviations and scope applicability are listed.
function recordStatusLine(row, historical = false) {
  const parts = [
    ...(!historical ? [label(row.applicability?.status === "matched" ? "matched" : "scope_varies")] : []),
    ...(historical || !isPublished(row) ? [`${label("publication")}: ${publicationLabel(row, historical)}`] : []),
    ...(hasReviewWarning(row) ? [`${label("review")}: ${reviewLabel(row)}`] : []),
  ];
  return parts.length ? `<p class="admissions-catalog__meta">${parts.map(escapeHtml).join(" · ")}</p>` : "";
}

const periodOf = row => row.period && typeof row.period === "object" ? row.period.label : row.period;
const periodLine = row => periodOf(row) ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(periodOf(row))}</p>` : "";

function recordDetails(content) {
  return content.trim() ? `<details class="admissions-catalog__evidence"><summary>${escapeHtml(label("source_scope_details"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${content}</div></details>` : "";
}

function scope(row, resolved) {
  const declared = row.scope || {};
  const names = {
    ...(declared.option_ids?.includes(resolved.selected_option?.id) ? { study: admissionsProgramLabel(resolved.selected_option).title } : {}),
    ...(declared.route_ids?.includes(resolved.selected_route?.id) ? { application: admissionsRouteName(resolved.selected_route, { presentation: getCurrentLanguage() === "eng" ? undefined : "simple" }) } : {}),
    ...Object.fromEntries(["levels", "applicant_categories", "cycle", "fee_status", "additional_dimensions"].filter(key => declared[key] && (!Array.isArray(declared[key]) || declared[key].length))
      .map(key => [key, key === "cycle" && typeof declared.cycle === "string" ? admissionsCycleLabel(declared.cycle) || declared.cycle : declared[key]])),
  };
  return Object.keys(names).length ? `<div class="admissions-catalog__scope"><strong>${escapeHtml(label("scope"))}</strong>${renderAdmissionsValue(names, resolved.reference_labels)}</div>` : "";
}

function publicationLabel(row, historical) {
  if (historical) return label("historical");
  return label(PUBLICATION_LABEL_KEYS[publicationState(row)] || "needs_review");
}

function reviewLabel(row) {
  return label(REVIEW_LABEL_KEYS[reviewState(row)] || "needs_review");
}

function factTitle(row, resolved, domain) {
  const titles = [row.title, row.label, row.value?.title, row.value?.label, row.value?.heading];
  const title = titles.find(value => typeof value === "string" && value.trim());
  if (title) return translateAdmissionSummary(title) || translateAdmissionText(title, title);
  if (domain === "requirements" && row.value && typeof row.value === "object") {
    if (row.value.IELTS_Academic) return label("topic.language");
    if (row.value.NAT) return `${label("topic.academic")} · NAT`;
    if (row.value.NUFYP || row.value.undergraduate || row.value.academic_alternatives) return label("topic.academic");
  }
  const genericIdentities = new Set(["rule", "requirement", "requirements", "test", "exam", "qualification", "required", "not_required", "unknown", "not_published"]);
  const identity = [row.value?.test, row.value?.exam, row.value?.qualification, row.value?.name].find(value => typeof value === "string" && value.trim() && !genericIdentities.has(value.trim().toLowerCase()));
  if (identity) return translateAdmissionSummary(identity) || translateAdmissionText(identity, identity);
  const sourceIds = row.source_ids || row.sourceIds || [];
  if (sourceIds.length === 1) {
    const source = (resolved.sources || []).find(item => item.id === sourceIds[0]);
    const sourceFacts = [...(resolved.facts || []), ...(resolved.history?.facts || [])].filter(fact => (fact.source_ids || fact.sourceIds || []).includes(sourceIds[0]));
    if (source?.title && sourceFacts.length === 1) return translateFactSource(source.title, source.title);
  }
  const tokens = new Set([row.topic || "", ...(row.topics || [])].join(" ").toLowerCase().split(/[_\s-]+/));
  const headings = TOPIC_HEADINGS.filter(([, words]) => words.some(word => tokens.has(word))).map(([key]) => key);
  if (domain === "degree_completion" && !headings.includes("completion")) headings.push("completion");
  // General application wording adds no distinction when the topic names specific requirements or dates.
  const specific = headings.filter(key => key !== "application");
  return ((specific.length ? specific : headings).slice(0, 2)).map(key => label(`topic.${key}`)).join(" · ") || label(`domain.${domain}`);
}

function hasPublishedIdentity(row, resolved) {
  const explicit = [row.title, row.label, row.value?.title, row.value?.label, row.value?.heading]
    .some(value => typeof value === "string" && value.trim());
  if (explicit) return true;
  const generic = new Set(["rule", "requirement", "requirements", "test", "exam", "qualification", "required", "not_required", "unknown", "not_published"]);
  const identity = [row.value?.test, row.value?.exam, row.value?.qualification, row.value?.name]
    .find(value => typeof value === "string" && value.trim() && !generic.has(value.trim().toLowerCase()));
  if (identity) return true;
  const ids = row.source_ids || row.sourceIds || [];
  return ids.length === 1 && [
    ...(resolved.facts || []), ...(resolved.history?.facts || []),
  ].filter(fact => (fact.source_ids || fact.sourceIds || []).includes(ids[0])).length === 1;
}

function renderPublishedTable(table, title) {
  if (!Array.isArray(table) || !table.length) return "";
  const [header, ...rows] = table.filter(Array.isArray);
  const cells = (values, tag) => `<tr>${values.map(value => `<${tag}>${escapeHtml(String(value ?? ""))}</${tag}>`).join("")}</tr>`;
  return `<div class="admissions-catalog__table-wrap"><table class="admissions-catalog__table" aria-label="${escapeHtmlAttr(title)}"><thead>${cells(header || [], "th")}</thead><tbody>${rows.map(row => cells(row, "td")).join("")}</tbody></table></div>`;
}

function factStatusBadges(row) {
  const publication = publicationLabel(row, false);
  const review = reviewLabel(row);
  const reviewWarning = hasReviewWarning(row);
  return [
    !isPublished(row) ? publication : "",
    reviewWarning && review !== publication ? review : "",
  ].filter(Boolean);
}

function renderStatusBadges(values) {
  return [...new Set(values)].map(value => `<span class="admissions-catalog__status">${escapeHtml(value)}</span>`).join("");
}

function renderQualificationTable(row, resolved) {
  const entries = row.value?.labelled_qualifications;
  if (!Array.isArray(entries) || !entries.length) return "";
  const qualifications = entries.filter(item => item && typeof item.qualification_or_country === "string");
  if (!qualifications.length) return "";
  const conditions = recordConditions(row, resolved);
  const badges = renderStatusBadges(factStatusBadges(row));
  const note = typeof row.value.interpretation === "string" ? `<p class="admissions-catalog__note">${escapeHtml(row.value.interpretation)}</p>` : "";
  // The list above already shows each qualification name, its tables, its full wording and the note.
  // The full record keeps only what the list cannot show: other fields, tables in an unexpected shape and unnamed entries.
  const isTable = table => Array.isArray(table) && table.every(Array.isArray);
  const residual = entries.map(item => {
    if (!qualifications.includes(item)) return item;
    const tables = Array.isArray(item.tables) ? item.tables : [];
    const rest = Object.fromEntries(Object.entries(item).filter(([key]) => !["qualification_or_country", "published_text"].includes(key) && !(key === "tables" && tables.every(isTable))));
    return Object.keys(rest).length ? { qualification_or_country: item.qualification_or_country, ...rest } : null;
  }).filter(Boolean);
  const remaining = { ...Object.fromEntries(Object.entries(row.value).filter(([key]) => !["labelled_qualifications", "interpretation"].includes(key))),
    ...(residual.length ? { labelled_qualifications: residual } : {}) };
  const remainingHtml = renderAdmissionsValue(remaining, resolved.reference_labels);
  return `<details class="admissions-catalog__fact admissions-catalog__qualification-table" data-admissions-fact="${escapeHtmlAttr(row.id || "")}" open>
    <summary class="admissions-catalog__heading"><span>${escapeHtml(label("published_qualification_table"))}</span><span class="admissions-catalog__status">${escapeHtml(label("qualification_count").replace("{count}", String(qualifications.length)))}</span>${badges}</summary>
    <div class="admissions-catalog__body">${note}${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}<div class="admissions-catalog__qualification-list">${qualifications.map(item => `<details class="admissions-catalog__qualification"><summary>${escapeHtml(item.qualification_or_country)}</summary>
      ${(Array.isArray(item.tables) ? item.tables.map(table => renderPublishedTable(table, item.qualification_or_country)).join("") : "")}
      ${item.published_text ? `<details class="admissions-catalog__evidence"><summary>${escapeHtml(label("full_source_text"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><p class="admissions-catalog__source-text">${escapeHtml(item.published_text)}</p></details>` : ""}
    </details>`).join("")}</div>
    ${remainingHtml ? `<details class="admissions-catalog__evidence"><summary>${escapeHtml(label("full_source_record"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${remainingHtml}</div></details>` : ""}
    ${recordDetails(`${recordStatusLine(row)}${scope(row, resolved)}${periodLine(row)}`)}
    ${sourcesBlock(sources(row, resolved, { compact: true }))}</div>
  </details>`;
}

function conflictExplanation(row) {
  if (!needsResolution(row)) return "";
  const reason = typeof row.reason === "string" ? row.reason : "";
  const next = typeof row.official_next_step === "string" ? row.official_next_step : "";
  return `${reason ? `<p>${escapeHtml(translateAdmissionSummary(reason) || reason)}</p>` : ""}${next ? `<p><strong>${escapeHtml(label("next_step"))}:</strong> ${escapeHtml(translateAdmissionSummary(next) || next)}</p>` : ""}`;
}

function renderGroupedFact(row, resolved, domain, { withSources = true } = {}) {
  const conditions = recordConditions(row, resolved);
  const inline = ["deadlines", "costs", "funding"].includes(domain);
  return `<div class="admissions-catalog__group-record" data-admissions-fact="${escapeHtmlAttr(row.id || "")}">
    ${renderStatusBadges(factStatusBadges(row))}
    ${renderAdmissionsValue(row.value, resolved.reference_labels)}
    ${conflictExplanation(row)}
    ${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}
    ${inline ? scope(row, resolved) : ""}${periodLine(row)}
    ${recordDetails(`${recordStatusLine(row)}${inline ? "" : scope(row, resolved)}`)}
    ${withSources ? sourcesBlock(sources(row, resolved, { compact: true })) : ""}
  </div>`;
}

function renderFact(row, resolved, domain = "other", historical = false, simple = false) {
  const title = simple ? factTitle(row, resolved, domain) : row.title || row.label;
  const topic = escapeHtml(label(`domain.${domain}`));
  const conditions = recordConditions(row, resolved);
  const period = periodOf(row);
  const publication = publicationLabel(row, historical);
  const review = reviewLabel(row);
  const reviewWarning = hasReviewWarning(row);
  if (simple) {
    const inline = ["deadlines", "costs", "funding"].includes(domain);
    // Scope and period appear once: inline for dates, costs and funding, otherwise inside the source details.
    return `<details class="admissions-catalog__fact" data-admissions-fact="${escapeHtmlAttr(row.id || "")}" ${inline ? "open" : ""}>
    <summary class="admissions-catalog__heading"><span>${escapeHtml(title)}</span>${historical || !isPublished(row) ? `<span class="admissions-catalog__status">${escapeHtml(publication)}</span>` : ""}${!historical && reviewWarning && review !== publication ? `<span class="admissions-catalog__status">${escapeHtml(review)}</span>` : ""}</summary>
    <div class="admissions-catalog__body">
      ${renderAdmissionsValue(row.value, resolved.reference_labels)}
      ${conflictExplanation(row)}
      ${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}
      ${inline ? scope(row, resolved) : ""}${periodLine(row)}
      ${recordDetails(`${recordStatusLine(row, historical)}${inline ? "" : scope(row, resolved)}`)}
      ${sourcesBlock(sources(row, resolved, { compact: true }))}
    </div>
  </details>`;
  }
  const links = sources(row, resolved);
  return `<details class="admissions-catalog__fact" data-admissions-fact="${escapeHtmlAttr(row.id || "")}">
    <summary class="admissions-catalog__heading"><span>${title ? escapeHtml(title) : topic}</span><span class="admissions-catalog__status">${escapeHtml(publicationLabel(row, historical))}</span>${!historical ? `<span class="admissions-catalog__status">${escapeHtml(label(row.applicability?.status === "matched" ? "matched" : "conditional"))}</span>` : ""}</summary>
    <div class="admissions-catalog__body">
      ${!historical ? `<p class="admissions-catalog__meta">${escapeHtml(label(row.applicability?.status === "matched" ? "matched" : "conditional"))}</p>` : ""}
      <p class="admissions-catalog__meta">${escapeHtml(label("review"))}: ${escapeHtml(reviewLabel(row))}</p>
      ${renderAdmissionsValue(row.value, resolved.reference_labels)}
      ${conflictExplanation(row)}
      ${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}
      ${scope(row, resolved)}
      ${period ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(period)}</p>` : ""}
      ${row.checked_at ? `<p class="admissions-catalog__meta">${escapeHtml(label("checked"))}: ${escapeHtml(row.checked_at)}</p>` : ""}
      ${links ? `<div class="admissions-catalog__sources">${links}</div>` : ""}
    </div>
  </details>`;
}

export function renderAdmissionsFacts(resolved, domains = DOMAINS, { presentation, includeReferenceScopeNote = true, emptyMessage = true, programOnly = false } = {}) {
  const facts = new Map((resolved.facts || []).filter(row => row.applicability?.status !== "mismatched").map(row => [row.id, row]));
  const seen = new Set();
  const sections = domains.map(domain => {
    const rows = (resolved.fact_groups?.[domain] || []).map(id => facts.get(id)).filter(row => {
      if (!row || (presentation === "simple" && seen.has(row.id))) return false;
      seen.add(row.id);
      return true;
    });
    if (!rows.length) return "";
    const content = presentation === "simple" ? (() => {
      const genericGroups = new Map();
      const groupPositions = new Set();
      const output = [];
      for (const row of rows) {
        if (Array.isArray(row.value?.labelled_qualifications)) {
          const table = renderQualificationTable(row, resolved);
          if (table) { output.push(table); continue; }
        }
        if (hasPublishedIdentity(row, resolved)) {
          output.push(renderFact(row, resolved, domain, false, true));
          continue;
        }
        const title = factTitle(row, resolved, domain);
        if (!genericGroups.has(title)) {
          genericGroups.set(title, []);
          groupPositions.add(output.length);
          output.push(title);
        }
        const group = genericGroups.get(title);
        group.push(row);
      }
      return output.map((item, index) => {
        if (!groupPositions.has(index)) return item;
        const group = genericGroups.get(item);
        if (group.length === 1) return renderFact(group[0], resolved, domain, false, true);
        const warnings = group.flatMap(factStatusBadges);
        // Records of one group often cite the same official pages; list those sources once for the group.
        const lines = group.map(row => sources(row, resolved, { compact: true }));
        const shared = lines[0] && lines.every(line => line === lines[0]);
        return `<details class="admissions-catalog__fact admissions-catalog__fact-group" data-admissions-group="${escapeHtmlAttr(domain)}" ${["deadlines", "costs", "funding"].includes(domain) ? "open" : ""}>
          <summary class="admissions-catalog__heading"><span>${escapeHtml(item)}</span><span class="admissions-catalog__status">${escapeHtml(label("record_count").replace("{count}", String(group.length)))}</span>${renderStatusBadges(warnings)}</summary>
          <div class="admissions-catalog__body"><div class="admissions-catalog__group-list">${group.map(row => renderGroupedFact(row, resolved, domain, { withSources: !shared })).join("")}</div>${shared ? sourcesBlock(lines[0]) : ""}</div>
        </details>`;
      }).join("");
    })() : rows.map(row => renderFact(row, resolved, domain, false, false)).join("");
    return `<section class="admissions-catalog__section" data-admissions-domain="${escapeHtmlAttr(domain)}"><h3>${escapeHtml(label(programOnly && domain === "study" ? "program_detail.study" : `domain.${domain}`))}</h3><div class="admissions-catalog__list">${content}</div></section>`;
  }).filter(Boolean);
  return sections.length ? `${presentation === "simple" && includeReferenceScopeNote ? `<p class="admissions-catalog__meta">${escapeHtml(t("university.admissions.reading.reference_scope_note"))}</p>` : ""}${sections.join("")}`
    : emptyMessage ? `<p class="admissions-catalog__meta">${escapeHtml(label("no_facts"))}</p>` : "";
}

function renderUnknowns(resolved, unknowns = resolved.unknowns || [], simple = false) {
  if (!unknowns.length) return "";
  const rows = `<div class="admissions-catalog__list">${unknowns.map(row => `<div class="admissions-catalog__unknown"><p>${escapeHtml(localizeCodeTokens(translateAdmissionSummary(row.reason) || row.reason || label("unknown")))}</p>${row.official_next_step ? `<p><strong>${escapeHtml(label("next_step"))}:</strong> ${escapeHtml(localizeCodeTokens(translateAdmissionSummary(row.official_next_step) || row.official_next_step))}</p>` : ""}${scope(row, resolved)}${sourcesBlock(sources(row, resolved, { compact: true }))}</div>`).join("")}</div>`;
  return simple ? `<details class="admissions-catalog__fact admissions-catalog__unknowns"><summary class="admissions-catalog__heading">${escapeHtml(label("unknowns"))} (${unknowns.length})${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${rows}</div></details>` : `<section class="admissions-catalog__section"><h3>${escapeHtml(label("unknowns"))}</h3>${rows}</section>`;
}

function countedMinimumLabel(exam, minimum) {
  const scheme = getExamConfig(exam)?.breakdown_scheme;
  const component = minimum.exam_ids?.[0] || scheme?.selectable_components?.[0] || scheme?.fixed_components?.[0];
  const subject = typeof component === "object" ? component.exam : component || exam;
  return tFormat(`${PREFIX}counted_minimum`, { count: minimum.count, minimum: formatExamValue(subject, minimum.minimum, { locale: getCurrentLanguage(), context: "requirement" }) }, ADMISSIONS_RENDER_LABELS.counted_minimum);
}

function renderAssessmentRule(rule, referenceLabels) {
  if (!rule) return "";
  rule = Object.fromEntries(Object.entries(rule).filter(([key]) => key !== "kind"));
  if (!Array.isArray(rule?.alternatives)) return renderAdmissionsValue(rule, referenceLabels);
  return renderAdmissionsValue({ ...rule, alternatives: rule.alternatives.map(alternative => ({
    ...alternative,
    ...(alternative.exam_id && alternative.minimum != null ? { minimum: formatExamValue(alternative.exam_id, alternative.minimum, { locale: getCurrentLanguage(), context: "requirement" }) } : {}),
    ...(alternative.component_minimums ? { component_minimums: Object.fromEntries(Object.entries(alternative.component_minimums).map(([exam, minimum]) => [exam, formatExamValue(exam, minimum, { locale: getCurrentLanguage(), context: "requirement" })])) } : {}),
    ...(alternative.components_at_least ? { components_at_least: countedMinimumLabel(alternative.exam_id, alternative.components_at_least) } : {}),
  })) }, referenceLabels);
}

function renderMinimumChecks(provided) {
  const checks = Array.isArray(provided?.minimum_checks) ? provided.minimum_checks : [];
  if (!checks.length) return "";
  const format = (exam, value) => value == null ? t("admission.requirements_fit.check.not_provided", "Not provided")
    : formatExamValue(exam, value, { locale: getCurrentLanguage() });
  const rows = checks.map(check => {
    const counted = check.minimum && typeof check.minimum === "object";
    const minimum = counted ? countedMinimumLabel(check.exam, check.minimum) : format(check.exam, check.minimum);
    const reported = counted ? tFormat(`${PREFIX}counted_provided`, { reported: check.provided?.reported ?? label("unknown"), met: check.provided?.meeting_minimum ?? label("unknown") }, ADMISSIONS_RENDER_LABELS.counted_provided) : format(check.exam, check.provided);
    const status = ["met", "unmet", "missing", "unassessed"].includes(check.status) ? check.status : "unassessed";
    return `<li data-minimum-exam="${escapeHtmlAttr(check.exam)}" data-minimum-status="${status}"><strong>${escapeHtml(getExamDisplayName(check.exam, { locale: getCurrentLanguage() }))}</strong><span> · ${escapeHtml(label("minimum"))}: ${escapeHtml(minimum)}</span><span> · ${escapeHtml(label("provided"))}: ${escapeHtml(reported)}</span><span> · ${escapeHtml(label(status))}</span></li>`;
  }).join("");
  return `<ul class="admissions-catalog__items" data-minimum-checks>${rows}</ul>`;
}

const LANGUAGE_EVIDENCE_KINDS = new Set(["education", "employment", "primary_language"]);
const INSTITUTIONAL_EVIDENCE_KINDS = new Set(["enrollment", "gpa", "credential"]);
// Fact domains whose records are rendered beside the assessment on the Admission tab.
export const ASSESSMENT_RECORD_DOMAINS = ["requirements", "application", "offer_enrollment", "reference"];

const EVIDENCE_LABELS = {
  degree_units: "Total degree units", major_units: "Units in the major requirements", major_subjects_short: "Major subjects",
  expected_completion: "Expected completion", as_of_term: "As of term", credential_other: "Program credential",
  "entirely.yes": "Yes, entirely", "entirely.no": "No",
  "metric.overall": "Overall GPA", "metric.technical": "Technical GPA", "metric.major": "Major GPA",
  "status.completed": "Completed", "status.in_progress": "In progress", "status.enrolled": "Enrolled", "status.on_leave": "On leave", "status.not_enrolled": "Not enrolled", "status.unknown": "Not specified",
  "language_kind.primary_language": "First language", "language_kind.education": "Education", "language_kind.employment": "Work experience",
  "institution_kind.enrollment": "Enrollment or course progress", "institution_kind.gpa": "Program GPA", "institution_kind.credential": "Program credential",
};

// Applicant evidence reads as one sentence; internal field names such as "Code" or "Kind" are never shown.
function evidenceLine(row, resolved) {
  const text = (key, raw = "") => t(`profile.evidence.${key}`, EVIDENCE_LABELS[key] ?? raw);
  const detail = (key, value) => value === null || value === undefined || value === "" ? "" : `${text(key)}: ${value}`;
  if (LANGUAGE_EVIDENCE_KINDS.has(row.kind)) {
    const entirely = typeof row.entirely_in_language === "boolean" ? text(`entirely.${row.entirely_in_language ? "yes" : "no"}`) : "";
    const qualification = row.qualification_level ? text(`qualification.${row.qualification_level}`, row.qualification_level) : "";
    return [[text(`language_kind.${row.kind}`, row.kind), String(row.language || "").toUpperCase()].filter(Boolean).join(" · "),
      row.country, qualification, row.started_on, row.completed_on, entirely].filter(Boolean).join(" · ");
  }
  const credential = row.kind === "credential"
    ? [row.credential_id && resolved.reference_labels?.[row.credential_id] ? translateProgramName(resolved.reference_labels[row.credential_id]) : text("credential_other"),
      row.score_percent !== null && row.score_percent !== undefined ? `${row.score_percent}%` : ""].filter(Boolean).join(" ") : "";
  return [text(`institution_kind.${row.kind}`, row.kind),
    row.study ? `${label("field.study")}: ${translateProgramName(row.study)}` : "",
    row.kind === "gpa" ? `${text(`metric.${row.metric}`, row.metric)}: ${row.value}/${row.scale}` : "", credential,
    row.kind !== "gpa" && row.status ? text(`status.${row.status}`, row.status) : "",
    detail("degree_units", row.units), detail("major_units", row.major_units), detail("major_subjects_short", row.completed_major_subjects),
    detail("expected_completion", row.expected_completion_on), detail("as_of_term", row.as_of_term)].filter(Boolean).join(" · ");
}

function renderEvidenceList(rows, resolved) {
  const lines = rows.map(row => evidenceLine(row, resolved)).filter(Boolean);
  return lines.length ? `<ul class="admissions-catalog__items" data-reported-evidence>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "";
}

const ATTEMPT_KEYS = new Set(["id", "exam", "score", "raw_value", "display_value", "taken_on", "details", "code", "kind", "minimum_checks"]);

// A reported test attempt: one line with the test, its result and date, then any section results.
function renderReportedAttempt(attempt) {
  const locale = getCurrentLanguage();
  const hasScore = Number.isFinite(attempt.score) && getExamConfig(attempt.exam);
  const result = hasScore ? formatExamValue(attempt.exam, attempt, { locale }) : String(attempt.display_value ?? attempt.raw_value ?? attempt.score ?? "");
  const line = [`${getExamDisplayName(attempt.exam, { locale })}${result ? `: ${result}` : ""}`,
    attempt.taken_on ? `${label("field.taken_on")}: ${attempt.taken_on}` : ""].filter(Boolean).join(" · ");
  const rest = Object.fromEntries(Object.entries(attempt).filter(([key]) => !ATTEMPT_KEYS.has(key) || key === "details"));
  return `<p class="admissions-catalog__reported">${escapeHtml(line)}</p>${renderAdmissionsValue(rest)}`;
}

function renderReportedEvidence(value, resolved) {
  if (Array.isArray(value)) {
    const items = value.map(item => renderReportedEvidence(item, resolved)).filter(Boolean);
    return items.length ? `<ul class="admissions-catalog__items">${items.map(item => `<li>${item}</li>`).join("")}</ul>` : "";
  }
  if (!value || typeof value !== "object") return renderAdmissionsValue(value, resolved.reference_labels);
  if (typeof value.exam === "string") return renderReportedAttempt(value);
  if (LANGUAGE_EVIDENCE_KINDS.has(value.kind) || INSTITUTIONAL_EVIDENCE_KINDS.has(value.kind)) return `<p class="admissions-catalog__reported">${escapeHtml(evidenceLine(value, resolved))}</p>`;
  const wrapped = ["exams", "institutional_evidence", "possible_exemption_evidence", "self_reported_exemption"].filter(key => value[key] !== null && value[key] !== undefined);
  if (wrapped.length) return wrapped.map(key => renderReportedEvidence(value[key], resolved)).join("");
  return renderAdmissionsValue(Object.fromEntries(Object.entries(value).filter(([key]) => !["code", "kind"].includes(key))), resolved.reference_labels);
}

export function renderAdmissionsAssessment(resolved, { presentation, recordDomains = [] } = {}) {
  const assessment = resolved.assessment;
  if (!assessment) return "";
  const percent = assessment.chancePercent;
  const available = typeof percent === "number" && Number.isFinite(percent);
  const checks = assessment.activeChoice?.details?.checks || [];
  const evaluated = checks.filter(check => check.measurable && ["met", "unmet"].includes(check.status));
  const reported = assessment.reportedEvidence || {};
  const reportedRows = [
    ...(reported.language_evidence || []),
    ...(reported.institutional_evidence || []).map(row => ({
      ...row,
      ...(row.program_id ? { study: resolved.reference_labels?.[row.program_id] || (row.program_id === resolved.selected_option?.id ? resolved.selected_option.title : label("unknown")) } : {}),
    })),
  ];
  // A check whose source record is rendered beside the assessment points to it instead of repeating the record.
  const recordedIds = new Set(recordDomains.flatMap(domain => resolved.fact_groups?.[domain] || []));
  const factIds = new Set((resolved.facts || []).filter(row => row.applicability?.status !== "mismatched").map(row => row.id));
  const hasRecord = id => Boolean(id) && recordedIds.has(id) && factIds.has(id);
  const reason = assessment.reason && ADMISSIONS_RENDER_LABELS[`reason.${assessment.reason}`]
    ? label(`reason.${assessment.reason}`) : label("assessment_unavailable");
  const hasNumericChecks = checks.some(check => check.measurable || check.numericMinimum);
  const sourceOnly = checks.length > 0 && !hasNumericChecks;
  const nextStep = assessment.reason === "applicability_unknown" ? "applicability"
    : sourceOnly || assessment.reason === "no_published_requirements" ? "no_numeric"
    : assessment.reason === "missing_evidence" ? "missing"
    : ["unassessed_minimums", "source_fact_changed", "source_state_not_verified"].includes(assessment.reason) ? "unassessed" : "";
  const displayChecks = [];
  const anonymousGroups = new Map();
  for (const check of checks) {
    const fact = (resolved.facts || []).find(row => row.id === check.factId) || check.sourceRule;
    const heading = fact ? factTitle(fact, resolved, "requirements") : "";
    const kind = label(`kind.${check.kind}`);
    const identities = [...(check.examIds || []), ...(check.rule?.alternatives || []).map(row => row.exam_id)]
      .filter(id => id && getExamConfig(id)).map(id => getExamDisplayName(id, { locale: getCurrentLanguage() }));
    const credential = check.rule?.credential_id;
    if (credential && resolved.reference_labels?.[credential]) identities.push(resolved.reference_labels[credential]);
    const generic = ["published_rule", "conditional_rule", "unresolved_rule", "stale_annotation", "source_state"].includes(check.kind);
    const title = [...new Set((identities.length ? identities : [heading, ...(!generic || !heading ? [kind] : [])]).filter(Boolean))].join(" · ");
    const item = { check, title, context: identities.length ? [...new Set([heading, kind].filter(Boolean))].join(" · ") : "" };
    const groupable = check.kind === "published_rule" && check.status === "unassessed" && fact && !hasPublishedIdentity(fact, resolved)
      && !check.numericMinimum && !check.measurable && check.minimum == null && !check.rule && !identities.length;
    if (!groupable) displayChecks.push([item]);
    else if (anonymousGroups.has(title)) anonymousGroups.get(title).push(item);
    else {
      const group = [item];
      anonymousGroups.set(title, group);
      displayChecks.push(group);
    }
  }
  const summary = `<h2>${escapeHtml(label("assessment"))}</h2>
    ${available ? `<p><strong>${escapeHtml(percent)}%</strong></p>${evaluated.length ? `<p>${escapeHtml(tFormat(`${PREFIX}assessment_count`, { met: evaluated.filter(check => check.status === "met").length, total: evaluated.length }, ADMISSIONS_RENDER_LABELS.assessment_count))}</p>` : ""}${evaluated.some(check => check.status === "unmet") ? `<p>${escapeHtml(label("reason.requirements_not_met"))}</p>` : ""}<p class="admissions-catalog__meta">${escapeHtml(label("assessment_limits"))}</p>` : `<p>${escapeHtml(nextStep ? label(`assessment_next_${nextStep}`) : reason)}${evaluated.some(check => check.status === "unmet") ? ` ${escapeHtml(label("reason.requirements_not_met"))}` : ""}${nextStep === "missing" ? ` <a href="/profile.html" data-route="profile">${escapeHtml(label("assessment_profile"))}</a>` : ""}</p>`}`;
  const renderCheck = ({ check, title, context }, grouped = false) => {
      const status = ["met", "unmet", "missing", "unassessed"].includes(check.status) ? check.status : "unassessed";
      const provided = check.provided ?? check.providedExamId;
      const minimumChecks = renderMinimumChecks(provided);
      const reportedAttempt = minimumChecks ? Object.fromEntries(Object.entries(provided).filter(([key]) => key !== "minimum_checks")) : provided;
      if (minimumChecks && reportedAttempt.details) {
        reportedAttempt.details = Object.fromEntries(Object.entries(reportedAttempt.details).filter(([key]) => !["total_strategy", "best_of"].includes(key)));
      }
      const rule = renderAssessmentRule(check.rule, resolved.reference_labels);
      const recorded = hasRecord(check.factId);
      const seenConditions = new Set();
      const conditions = (recorded ? [check.conditions] : [check.conditions, check.sourceRule?.conditions, check.sourceRule?.conditions_and_exceptions, check.sourceRule?.exceptions])
        .filter(value => value !== null && value !== undefined).map(value => renderAdmissionsValue(value, resolved.reference_labels))
        .filter(html => html && !seenConditions.has(html) && seenConditions.add(html)).join("");
      // The full source record, its status, period, scope and conditions live in the records list; the check keeps only its own result.
      const sourceRecord = !recorded && check.sourceRule ? `${(() => {
        const sourceRule = renderAdmissionsValue(check.sourceRule.value, resolved.reference_labels);
        return sourceRule ? `<div><strong>${escapeHtml(label("source_rule"))}</strong>${sourceRule}</div>` : "";
      })()}${recordStatusLine(check.sourceRule)}${periodLine(check.sourceRule)}` : "";
      const body = `<div class="admissions-catalog__body${grouped ? " admissions-catalog__check" : ""}">
        ${context ? `<p class="admissions-catalog__meta">${escapeHtml(context)}</p>` : ""}
        ${rule ? `<div><strong>${escapeHtml(label("rule"))}</strong>${rule}</div>` : ""}
        ${sourceRecord}
        ${check.minimum !== null && check.minimum !== undefined ? `<p><strong>${escapeHtml(label("minimum"))}:</strong> ${escapeHtml(check.minimum)}</p>` : ""}
        ${minimumChecks}
        ${provided !== null && provided !== undefined ? `<div><strong>${escapeHtml(label("provided"))}</strong>${renderReportedEvidence(reportedAttempt, resolved)}</div>` : ""}
        ${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}
        ${!recorded && check.sourceRule ? scope(check.sourceRule, resolved) : ""}
        ${check.reason && ADMISSIONS_RENDER_LABELS[`reason.${check.reason}`] ? `<p>${escapeHtml(label(`reason.${check.reason}`))}</p>` : ""}
        ${recorded ? `<p><button type="button" class="admissions-catalog__record-link" data-admissions-record-link="${escapeHtmlAttr(check.factId)}">${escapeHtml(label("record_link"))}</button></p>` : ""}
        ${sourcesBlock(sources({ ...check, checked_at: check.checked_at ?? check.sourceRule?.checked_at }, resolved, { compact: true }))}
      </div>`;
      return grouped ? body : `<details class="admissions-catalog__fact admissions-catalog__check"><summary class="admissions-catalog__heading"><span>${escapeHtml(title)}</span><span class="admissions-catalog__status">${escapeHtml(label(status))}</span></summary>${body}</details>`;
  };
  const detail = `<p class="admissions-catalog__meta">${escapeHtml(label("assessment_meaning"))}</p><p class="admissions-catalog__meta">${escapeHtml(label("self_reported"))}</p>${assessment.reason && ADMISSIONS_RENDER_LABELS[`reason.${assessment.reason}`] ? `<p>${escapeHtml(reason)}</p>` : ""}${sourceOnly && checks.some(check => check.status === "unassessed") ? `<p class="admissions-catalog__meta">${escapeHtml(label("assessment_next_unassessed"))}</p>` : ""}${["missing", "unassessed"].filter(status => checks.some(check => check.status === status)).map(status => `<p class="admissions-catalog__meta">${escapeHtml(t(`${PREFIX}check_next_${status}`))}</p>`).join("")}<div class="admissions-catalog__list">${displayChecks.map(group => group.length === 1 ? renderCheck(group[0]) : `<details class="admissions-catalog__fact admissions-catalog__check"><summary class="admissions-catalog__heading"><span>${escapeHtml(group[0].title)} (${escapeHtml(tFormat(`${PREFIX}check_group_count`, { count: group.length }))})</span><span class="admissions-catalog__status">${escapeHtml(label("unassessed"))}</span></summary><div class="admissions-catalog__body">${group.map(item => renderCheck(item, true)).join("")}</div></details>`).join("")}</div>
    ${reportedRows.length ? `<details class="admissions-catalog__fact"><summary class="admissions-catalog__heading">${escapeHtml(label("provided"))}</summary><div class="admissions-catalog__body"><p class="admissions-catalog__meta">${escapeHtml(label("self_reported"))}</p>${renderEvidenceList(reportedRows, resolved)}</div></details>` : ""}`;
  return `<section class="admissions-catalog__section admissions-catalog__assessment" data-requirements-match>${summary}${presentation === "simple" ? `<details class="admissions-catalog__assessment-detail"><summary>${escapeHtml(label("check_details"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${detail}</div></details>` : detail}</section>`;
}

export function renderAdmissionsContext(resolved, { domains = DOMAINS, includeAssessment = true, includeUnknowns = true, includeHistory = true, includeSourceNote = true, presentation, programOnly = false, overviewCoverage = null } = {}) {
  const institutionRouteReading = resolved?.reading_scope === "institution_route" && resolved?.selected_route;
  if ((!resolved?.selected_option && !institutionRouteReading) || (!resolved?.selected_route && !programOnly && !institutionRouteReading)) return `<p class="admissions-catalog__meta">${escapeHtml(label("no_context"))}</p>`;
  if (programOnly) {
    const optionFact = row => row.applicability?.status !== "mismatched" && row.scope?.option_ids?.includes(resolved.selected_option.id)
      && (!row.scope.route_ids?.length || ["study_content", "study_structure"].includes(row.topic));
    domains = domains.filter(domain => ["study", "degree_completion", "career", "other"].includes(domain));
    const coveredKeys = new Set(overviewCoverage?.valueKeys || []);
    const facts = (resolved.facts || []).filter(optionFact).map(sourceRow => {
      const value = sourceRow.id === overviewCoverage?.factId
        ? Object.fromEntries(Object.entries(sourceRow.value).filter(([key]) => !coveredKeys.has(key))) : sourceRow.value;
      const hasConditions = [sourceRow.conditions, sourceRow.conditions_and_exceptions, sourceRow.exceptions]
        .some(item => Array.isArray(item) ? item.length : Boolean(item));
      if (sourceRow.id === overviewCoverage?.factId && !Object.keys(value).length && !hasConditions) return null;
      const row = value === sourceRow.value ? sourceRow : { ...sourceRow, value };
      const title = programDetailTitle(row);
      return title ? { ...row, title } : row;
    }).filter(Boolean);
    resolved = { ...resolved, facts, unknowns: (resolved.unknowns || []).filter(optionFact), history: { ...resolved.history, facts: (resolved.history?.facts || []).filter(optionFact), unknowns: (resolved.history?.unknowns || []).filter(optionFact) } };
    if (!resolved.facts.some(row => domains.some(domain => resolved.fact_groups?.[domain]?.includes(row.id)))
      && (!includeUnknowns || !resolved.unknowns.length)
      && (!includeHistory || !(resolved.history?.facts?.length || resolved.history?.unknowns?.length))) return "";
  }
  const history = resolved.history || {};
  const historyFacts = history.facts || [];
  const historyUnknowns = history.unknowns || [];
  const historyCount = historyFacts.length + historyUnknowns.length;
  return `<div class="admissions-catalog">${includeSourceNote && presentation !== "simple" ? `<p class="admissions-catalog__meta">${escapeHtml(label("source_text_note"))}</p>` : ""}
    ${includeAssessment && !programOnly ? renderAdmissionsAssessment(resolved, { presentation, recordDomains: domains }) : ""}
    ${domains.length ? renderAdmissionsFacts(resolved, domains, { presentation, includeReferenceScopeNote: !programOnly, emptyMessage: !programOnly, programOnly }) : ""}
    ${includeUnknowns ? renderUnknowns(resolved, resolved.unknowns || [], presentation === "simple") : ""}
    ${includeHistory && historyCount ? `<details class="admissions-catalog__fact"><summary class="admissions-catalog__heading">${escapeHtml(label("history"))} (${historyCount})</summary><div class="admissions-catalog__body"><p class="admissions-catalog__meta">${escapeHtml(label("history_note"))}</p>${historyFacts.map(row => renderFact(row, resolved, "other", true, presentation === "simple")).join("")}${renderUnknowns(resolved, historyUnknowns, presentation === "simple")}</div></details>` : ""}
  </div>`;
}
