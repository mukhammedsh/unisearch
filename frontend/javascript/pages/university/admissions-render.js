import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { heroIcon } from "../../icons.js";
import { getExamDisplayName } from "../../utils/config.js";
import { translateAdmissionSummary, translateProgramName } from "../../university-translations.js";
import { localizeDuration, trProgramLanguage, trStudyMode } from "../_shared.js";

const PREFIX = "university.admissions.catalog.";

export function admissionsCycleLabel(value) {
  const raw = String(value || "");
  const entry = raw.match(/^(Fall|Spring|Summer|Winter)? ?(20\d{2})(?: entry)?$/);
  if (!entry) return raw;
  return tFormat(`university.admissions.reading.${entry[1] ? `entry_${entry[1].toLowerCase()}` : "entry_year"}`, { year: entry[2] });
}

export function admissionsProgramLabel(option) {
  const officialTitle = String(option?.title || "");
  const suffix = officialTitle.match(/ \(([^()]+)\)$/);
  const courseCode = option?.id?.startsWith("mit-") && suffix?.[1].startsWith("Course ") ? suffix[1].slice(7) : "";
  const award = suffix && option.awards?.some(award => award.toLowerCase() === suffix[1].toLowerCase());
  const name = courseCode || award ? officialTitle.slice(0, suffix.index) : officialTitle;
  return { title: translateProgramName(name) + (award ? ` (${suffix[1]})` : ""), officialTitle, courseCode };
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
  assessment: "UniChance · published minimum checks",
  assessment_meaning: "The percentage is the share of evaluable published academic and language minimum checks met. It is not an admission probability, a check of all admission criteria, or a funding prediction.",
  assessment_unavailable: "No requirements-match percentage is available for this context.",
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
  "reason.applicability_unknown": "The selected context or applicant applicability has not been established.",
  "reason.missing_evidence": "Required applicant evidence is missing.",
  "reason.unassessed_minimums": "Some published minima or their conditions cannot yet be assessed.",
  "reason.no_published_requirements": "No evaluable published numeric minimum is catalogued for this context.",
  "reason.requirements_not_met": "At least one evaluated published minimum was not met.",
  "reason.source_fact_changed": "The source record changed and its assessment needs review.",
  "reason.source_state_not_verified": "The source rule is not verified for assessment.",
  "kind.exam_alternatives": "Required test alternatives",
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
};

function label(key) {
  return t(`${PREFIX}${key}`, ADMISSIONS_RENDER_LABELS[key] || ADMISSIONS_RENDER_LABELS.detail);
}

export function admissionsRouteName(route, { presentation } = {}) {
  const localized = presentation === "simple" && route?.id ? t(`${PREFIX}route_name.${route.id.replaceAll(":", ".")}`) : "";
  if (localized) return localized;
  if (presentation === "simple" && !route?.title && !route?.target && route?.classification) {
    const key = `route_class.${route.classification}`;
    return ADMISSIONS_RENDER_LABELS[key] ? label(key) : String(route.classification).replaceAll("_", " ");
  }
  return route?.title || route?.target || route?.classification || route?.destination || label("route_label");
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
  "addressed_conditions", "covered_check_ids", "subjects_field", "field", "mapping_reviewed_at",
  "origin", "university_id", "program_id", "option_ids", "route_ids", "applicant_routes", "cycles",
  "bulletin_external_admissions_field_present", "bulletin_internal_admissions_field_present", "bulletin_coterm_admissions_field_present",
]);
const ENUM_LABELS = {
  strongly_recommended: "enum.strongly_recommended", not_stated: "enum.not_stated",
  not_published_on_this_page: "enum.not_published_on_this_page", paper: "enum.paper", digital: "enum.digital",
  undergraduate: "study_level.undergraduate", masters: "study_level.masters", doctoral: "study_level.doctoral", professional: "study_level.professional",
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
Object.assign(ADMISSIONS_RENDER_LABELS, {
  "study_level.undergraduate": "Undergraduate", "study_level.masters": "Master's", "study_level.doctoral": "Doctoral", "study_level.professional": "Professional",
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
  return safe ? `<a href="${escapeHtmlAttr(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16 admissions-catalog__source-icon")}</a>` : "";
}

function internalField(key) {
  if (["exam_id", "credential_id"].includes(key)) return false;
  return INTERNAL_FIELDS.has(key) || /(?:^|_)(?:ids?|hash|sha256|refs?)$/.test(key) || /(?:Id|Ids|Revision|Hash)$/.test(key);
}

function fieldLabel(key, referenceLabels = {}) {
  if (Object.hasOwn(referenceLabels, key)) return escapeHtml(referenceLabels[key]);
  const localized = t(`${PREFIX}field.${key}`);
  if (localized) return escapeHtml(localized);
  if (ADMISSIONS_RENDER_LABELS[`field.${key}`]) return escapeHtml(label(`field.${key}`));
  // Source-specific field labels accompany the original-language source summary.
  const text = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return escapeHtml(text.charAt(0).toUpperCase() + text.slice(1));
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
  if (Object.hasOwn(referenceLabels, text)) return escapeHtml(referenceLabels[text]);
  if (/^(?:source-[a-f0-9]+|[a-f0-9]{32,}|[a-f0-9-]{36})$/i.test(text)) return "";
  if (ENUM_LABELS[text]) return escapeHtml(label(ENUM_LABELS[text]));
  if (ADMISSIONS_RENDER_LABELS[`kind.${text}`]) return escapeHtml(label(`kind.${text}`));
  if (/^(?:TOEFL|GMAT|IELTS|DUOLINGO|CAMBRIDGE)_/.test(text)) return escapeHtml(getExamDisplayName(text));
  if (/^https?:\/\//i.test(text)) return sourceLink(text);
  return escapeHtml(text);
}

export function renderAdmissionsValue(value, referenceLabels = {}) {
  if (Array.isArray(value)) {
    const items = value.map(item => renderAdmissionsValue(item, referenceLabels)).filter(Boolean);
    return items.length ? `<ul class="admissions-catalog__items">${items.map(item => `<li>${item}</li>`).join("")}</ul>` : "";
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([key]) => !internalField(key)).map(([key, entry]) => {
      const content = renderAdmissionsValue(entry, referenceLabels);
      return content ? `<div class="admissions-catalog__entry"><dt>${fieldLabel(key, referenceLabels)}</dt><dd>${content}</dd></div>` : "";
    }).filter(Boolean);
    return entries.length ? `<dl class="admissions-catalog__values">${entries.join("")}</dl>` : "";
  }
  return scalar(value, referenceLabels);
}

export function renderStudyOptionOverview(resolved) {
  const option = resolved?.selected_option;
  if (!option) return "";
  const studyIds = new Set(resolved.fact_groups?.study || []);
  const rows = (resolved.facts || []).filter(row => studyIds.has(row.id)
    && row.publication_status === "published" && [label("review.verified"), label("review.reviewed"), label("review.carried_forward_review")].includes(reviewLabel(row.review_status))
    && row.applicability?.status !== "mismatched" && row.scope?.option_ids?.includes(option.id)
    && !row.scope.route_ids?.length && row.value && typeof row.value === "object");
  const description = rows.flatMap(row => [row.value.description, row.value.course_page_programme_summary, row.value.A3i6E, row.topic === "study_content" ? row.value.source_content : undefined])
    .find(value => typeof value === "string" && value.trim());
  const translatedDescription = translateAdmissionSummary(description);
  const descriptionHtml = !description ? "" : `<p class="program-card__description">${escapeHtml(translatedDescription || t("university.admissions.reading.summary_translation_missing"))}</p>${getCurrentLanguage() === "eng" ? "" : `<details class="admissions-catalog__evidence" data-program-original><summary>${escapeHtml(t("university.admissions.reading.original_description"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><p class="program-card__description" lang="en">${escapeHtml(description)}</p></details>`}`;
  const formatters = { duration: localizeDuration, mode: trStudyMode, language: trProgramLanguage };
  const fields = ["duration", "mode", "language", "location", "department", "start_date"].map(key => {
    const value = rows.map(row => row.value[key]).find(value => value != null && value !== "") ?? option.format?.[key];
    if (typeof value !== "string" && !(Array.isArray(value) && value.every(item => typeof item === "string"))) return "";
    if (!value.length) return "";
    const formatted = (Array.isArray(value) ? value : [value]).map(item => formatters[key] ? formatters[key](item) : item).join(", ");
    return `<div class="program-card-row"><dt class="program-card-label">${escapeHtml(label(`field.${key}`))}</dt><dd class="program-card-value">${escapeHtml(formatted)}</dd></div>`;
  }).filter(Boolean);
  return `${descriptionHtml}${fields.length ? `<dl class="program-card-rows">${fields.join("")}</dl>` : ""}`;
}

function sources(row, resolved) {
  const ids = row.source_ids || row.sourceIds || [];
  return (resolved.sources || []).filter(source => ids.includes(source.id)).map(source => {
    const link = sourceLink(source.url, source.title || label("source"));
    if (!link) return "";
    return `<div>${link}${source.checked_at ? `<span class="admissions-catalog__meta">${escapeHtml(label("checked"))}: ${escapeHtml(source.checked_at)}</span>` : ""}</div>`;
  }).join("");
}

function scope(row, resolved) {
  const declared = row.scope || {};
  const names = {
    ...(declared.option_ids?.includes(resolved.selected_option?.id) ? { study: resolved.selected_option.title } : {}),
    ...(declared.route_ids?.includes(resolved.selected_route?.id) ? { application: admissionsRouteName(resolved.selected_route) } : {}),
    ...Object.fromEntries(["levels", "applicant_categories", "cycle", "fee_status", "additional_dimensions"].filter(key => declared[key] && (!Array.isArray(declared[key]) || declared[key].length)).map(key => [key, declared[key]])),
  };
  return Object.keys(names).length ? `<div class="admissions-catalog__scope"><strong>${escapeHtml(label("scope"))}</strong>${renderAdmissionsValue(names, resolved.reference_labels)}</div>` : "";
}

function publicationLabel(row, historical) {
  if (historical) return label("historical");
  if (row.publication_status === "published") return label("published");
  const status = String(row.publication_status || "");
  if (!status || ["unknown", "researched_unknown"].includes(status)) return label("unknown");
  if (status.includes("conflict")) return label("conflicting");
  if (status.startsWith("not_")) return label("not_published");
  if (status.startsWith("partially_")) return label("partly_published");
  if (status.startsWith("published_")) return label("limited_publication");
  return label("needs_review");
}

function reviewLabel(status) {
  if (ADMISSIONS_RENDER_LABELS[`review.${status}`]) return label(`review.${status}`);
  if (String(status || "").startsWith("superseded")) return label("review.superseded");
  if (String(status || "").includes("conflict")) return label("review.conflicting");
  if (/(?:pending|partial|requires_confirmation|general_only|types_only)/.test(String(status || ""))) return label("review.limited");
  if (String(status || "").startsWith("verified_")) return label("review.verified");
  if (/(?:reviewed|rechecked)/.test(String(status || ""))) return label("review.reviewed");
  return label("needs_review");
}

function factTitle(row, resolved, domain) {
  const titles = [row.title, row.label, row.value?.title, row.value?.label, row.value?.heading];
  const title = titles.find(value => typeof value === "string" && value.trim());
  if (title) return title;
  const genericIdentities = new Set(["rule", "requirement", "requirements", "test", "exam", "qualification", "required", "not_required", "unknown", "not_published"]);
  const identity = [row.value?.test, row.value?.exam, row.value?.qualification, row.value?.name].find(value => typeof value === "string" && value.trim() && !genericIdentities.has(value.trim().toLowerCase()));
  if (identity) return identity;
  const sourceIds = row.source_ids || row.sourceIds || [];
  if (sourceIds.length === 1) {
    const source = (resolved.sources || []).find(item => item.id === sourceIds[0]);
    const sourceFacts = [...(resolved.facts || []), ...(resolved.history?.facts || [])].filter(fact => (fact.source_ids || fact.sourceIds || []).includes(sourceIds[0]));
    if (source?.title && sourceFacts.length === 1) return source.title;
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
  const review = reviewLabel(row.review_status);
  const reviewWarning = ![
    label("review.verified"), label("review.reviewed"), label("review.carried_forward_review"),
  ].includes(review);
  return [
    row.publication_status !== "published" ? publication : "",
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
  const links = sources(row, resolved);
  const conditions = [row.conditions, row.conditions_and_exceptions, row.exceptions]
    .filter(value => value !== null && value !== undefined)
    .map(value => renderAdmissionsValue(value, resolved.reference_labels)).filter(Boolean).join("");
  const badges = renderStatusBadges(factStatusBadges(row));
  const sourceMeta = `<p class="admissions-catalog__meta">${escapeHtml(label("publication"))}: ${escapeHtml(publicationLabel(row, false))}</p>
    <p class="admissions-catalog__meta">${escapeHtml(label(row.applicability?.status === "matched" ? "matched" : "scope_varies"))}</p>
    <p class="admissions-catalog__meta">${escapeHtml(label("review"))}: ${escapeHtml(reviewLabel(row.review_status))}</p>${scope(row, resolved)}
    ${row.checked_at ? `<p class="admissions-catalog__meta">${escapeHtml(label("checked"))}: ${escapeHtml(row.checked_at)}</p>` : ""}`;
  const note = typeof row.value.interpretation === "string" ? `<p class="admissions-catalog__note">${escapeHtml(row.value.interpretation)}</p>` : "";
  return `<details class="admissions-catalog__fact admissions-catalog__qualification-table" data-admissions-fact="${escapeHtmlAttr(row.id || "")}" open>
    <summary class="admissions-catalog__heading"><span>${escapeHtml(label("published_qualification_table"))}</span><span class="admissions-catalog__status">${escapeHtml(label("qualification_count").replace("{count}", String(qualifications.length)))}</span>${badges}</summary>
    <div class="admissions-catalog__body">${note}${scope(row, resolved)}${row.period ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(typeof row.period === "object" ? row.period.label : row.period)}</p>` : ""}${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}<div class="admissions-catalog__qualification-list">${qualifications.map(item => `<details class="admissions-catalog__qualification"><summary>${escapeHtml(item.qualification_or_country)}</summary>
      ${(Array.isArray(item.tables) ? item.tables.map(table => renderPublishedTable(table, item.qualification_or_country)).join("") : "")}
      ${item.published_text ? `<details class="admissions-catalog__evidence"><summary>${escapeHtml(label("full_source_text"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><p class="admissions-catalog__source-text">${escapeHtml(item.published_text)}</p></details>` : ""}
    </details>`).join("")}</div>
    <details class="admissions-catalog__evidence"><summary>${escapeHtml(label("full_source_record"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${renderAdmissionsValue(row.value, resolved.reference_labels)}${conditions}</div></details>
    <details class="admissions-catalog__evidence"><summary>${escapeHtml(label("source_scope_details"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${sourceMeta}${row.period ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(typeof row.period === "object" ? row.period.label : row.period)}</p>` : ""}</div></details>
    ${links ? `<div class="admissions-catalog__sources">${links}</div>` : ""}</div>
  </details>`;
}

function renderGroupedFact(row, resolved, domain) {
  const conditions = [row.conditions, row.conditions_and_exceptions, row.exceptions]
    .filter(value => value !== null && value !== undefined)
    .map(value => renderAdmissionsValue(value, resolved.reference_labels)).filter(Boolean).join("");
  const period = row.period && typeof row.period === "object" ? row.period.label : row.period;
  const status = label(row.applicability?.status === "matched" ? "matched" : "scope_varies");
  const inlineScope = ["deadlines", "costs", "funding"].includes(domain) ? scope(row, resolved) : "";
  const metadata = `<p class="admissions-catalog__meta">${escapeHtml(label("publication"))}: ${escapeHtml(publicationLabel(row, false))}</p>
    <p class="admissions-catalog__meta">${escapeHtml(label("review"))}: ${escapeHtml(reviewLabel(row.review_status))}</p>
    <p class="admissions-catalog__meta">${escapeHtml(status)}</p>${scope(row, resolved)}
    ${period ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(period)}</p>` : ""}
    ${row.checked_at ? `<p class="admissions-catalog__meta">${escapeHtml(label("checked"))}: ${escapeHtml(row.checked_at)}</p>` : ""}`;
  const links = sources(row, resolved);
  return `<div class="admissions-catalog__group-record" data-admissions-fact="${escapeHtmlAttr(row.id || "")}">
    ${renderStatusBadges(factStatusBadges(row))}
    ${renderAdmissionsValue(row.value, resolved.reference_labels)}
    ${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}
    ${inlineScope}${period ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(period)}</p>` : ""}
    <details class="admissions-catalog__evidence"><summary>${escapeHtml(label("source_scope_details"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${metadata}</div></details>
    ${links ? `<div class="admissions-catalog__sources">${links}</div>` : ""}
  </div>`;
}

function renderFact(row, resolved, domain = "other", historical = false, simple = false) {
  const title = simple ? factTitle(row, resolved, domain) : row.title || row.label;
  const topic = escapeHtml(label(`domain.${domain}`));
  const conditions = [row.conditions, row.conditions_and_exceptions, row.exceptions].filter(value => value !== null && value !== undefined).map(value => renderAdmissionsValue(value, resolved.reference_labels)).filter(Boolean).join("");
  const period = row.period && typeof row.period === "object" ? row.period.label : row.period;
  const links = sources(row, resolved);
  const inlinePeriod = simple && period ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(period)}</p>` : "";
  const inlineScope = simple && ["deadlines", "costs", "funding"].includes(domain) ? scope(row, resolved) : "";
  const publication = publicationLabel(row, historical);
  const review = reviewLabel(row.review_status);
  const reviewWarning = ![label("review.verified"), label("review.reviewed"), label("review.carried_forward_review")].includes(review);
  const applicability = !historical ? label(row.applicability?.status === "matched" ? "matched" : (simple ? "scope_varies" : "conditional")) : "";
  const metadata = `<p class="admissions-catalog__meta">${escapeHtml(label("publication"))}: ${escapeHtml(publication)}</p>
    <p class="admissions-catalog__meta">${escapeHtml(label("review"))}: ${escapeHtml(review)}</p>
    ${scope(row, resolved)}
    ${period ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(period)}</p>` : ""}
    ${row.checked_at ? `<p class="admissions-catalog__meta">${escapeHtml(label("checked"))}: ${escapeHtml(row.checked_at)}</p>` : ""}`;
  if (simple) return `<details class="admissions-catalog__fact" data-admissions-fact="${escapeHtmlAttr(row.id || "")}" ${["deadlines", "costs", "funding"].includes(domain) ? "open" : ""}>
    <summary class="admissions-catalog__heading"><span>${escapeHtml(title)}</span>${historical || row.publication_status !== "published" ? `<span class="admissions-catalog__status">${escapeHtml(publication)}</span>` : ""}${!historical && reviewWarning && review !== publication ? `<span class="admissions-catalog__status">${escapeHtml(review)}</span>` : ""}</summary>
    <div class="admissions-catalog__body">
      ${renderAdmissionsValue(row.value, resolved.reference_labels)}
      ${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}
      ${inlineScope}${inlinePeriod}
      <details class="admissions-catalog__evidence"><summary>${escapeHtml(label("source_scope_details"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${!historical ? `<p class="admissions-catalog__meta">${escapeHtml(applicability)}</p>` : ""}${metadata}</div></details>
      ${links ? `<div class="admissions-catalog__sources">${links}</div>` : ""}
    </div>
  </details>`;
  return `<details class="admissions-catalog__fact" data-admissions-fact="${escapeHtmlAttr(row.id || "")}">
    <summary class="admissions-catalog__heading"><span>${title ? escapeHtml(title) : topic}</span><span class="admissions-catalog__status">${escapeHtml(publicationLabel(row, historical))}</span>${!historical ? `<span class="admissions-catalog__status">${escapeHtml(label(row.applicability?.status === "matched" ? "matched" : "conditional"))}</span>` : ""}</summary>
    <div class="admissions-catalog__body">
      ${!historical ? `<p class="admissions-catalog__meta">${escapeHtml(label(row.applicability?.status === "matched" ? "matched" : "conditional"))}</p>` : ""}
      <p class="admissions-catalog__meta">${escapeHtml(label("review"))}: ${escapeHtml(reviewLabel(row.review_status))}</p>
      ${renderAdmissionsValue(row.value, resolved.reference_labels)}
      ${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}
      ${scope(row, resolved)}
      ${period ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(period)}</p>` : ""}
      ${row.checked_at ? `<p class="admissions-catalog__meta">${escapeHtml(label("checked"))}: ${escapeHtml(row.checked_at)}</p>` : ""}
      ${links ? `<div class="admissions-catalog__sources">${links}</div>` : ""}
    </div>
  </details>`;
}

export function renderAdmissionsFacts(resolved, domains = DOMAINS, { presentation } = {}) {
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
        return `<details class="admissions-catalog__fact admissions-catalog__fact-group" data-admissions-group="${escapeHtmlAttr(domain)}" ${["deadlines", "costs", "funding"].includes(domain) ? "open" : ""}>
          <summary class="admissions-catalog__heading"><span>${escapeHtml(item)}</span><span class="admissions-catalog__status">${escapeHtml(label("record_count").replace("{count}", String(group.length)))}</span>${renderStatusBadges(warnings)}</summary>
          <div class="admissions-catalog__body"><div class="admissions-catalog__group-list">${group.map(row => renderGroupedFact(row, resolved, domain)).join("")}</div></div>
        </details>`;
      }).join("");
    })() : rows.map(row => renderFact(row, resolved, domain, false, false)).join("");
    return `<section class="admissions-catalog__section" data-admissions-domain="${escapeHtmlAttr(domain)}"><h3>${escapeHtml(label(`domain.${domain}`))}</h3><div class="admissions-catalog__list">${content}</div></section>`;
  }).filter(Boolean);
  return sections.length ? `${presentation === "simple" ? `<p class="admissions-catalog__meta">${escapeHtml(t("university.admissions.reading.reference_scope_note"))}</p>` : ""}${sections.join("")}` : `<p class="admissions-catalog__meta">${escapeHtml(label("no_facts"))}</p>`;
}

function renderUnknowns(resolved, unknowns = resolved.unknowns || [], simple = false) {
  if (!unknowns.length) return "";
  const rows = `<div class="admissions-catalog__list">${unknowns.map(row => `<div class="admissions-catalog__unknown"><p>${escapeHtml(row.reason || label("unknown"))}</p>${row.official_next_step ? `<p><strong>${escapeHtml(label("next_step"))}:</strong> ${escapeHtml(row.official_next_step)}</p>` : ""}${scope(row, resolved)}<div class="admissions-catalog__sources">${sources(row, resolved)}</div></div>`).join("")}</div>`;
  return simple ? `<details class="admissions-catalog__fact admissions-catalog__unknowns"><summary class="admissions-catalog__heading">${escapeHtml(label("unknowns"))} (${unknowns.length})${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${rows}</div></details>` : `<section class="admissions-catalog__section"><h3>${escapeHtml(label("unknowns"))}</h3>${rows}</section>`;
}

export function renderAdmissionsAssessment(resolved, { presentation } = {}) {
  const assessment = resolved.assessment;
  if (!assessment) return "";
  const percent = assessment.chancePercent;
  const available = typeof percent === "number" && Number.isFinite(percent);
  const checks = assessment.activeChoice?.details?.checks || [];
  const reported = assessment.reportedEvidence || {};
  const reportedRows = [
    ...(reported.language_evidence || []),
    ...(reported.institutional_evidence || []).map(row => ({
      ...row,
      ...(row.program_id ? { study: resolved.reference_labels?.[row.program_id] || (row.program_id === resolved.selected_option?.id ? resolved.selected_option.title : label("unknown")) } : {}),
    })),
  ];
  const html = `<section class="admissions-catalog__section admissions-catalog__assessment"><h3>${escapeHtml(label("assessment"))}</h3>
    <p>${available ? `<strong>${escapeHtml(percent)}%</strong>` : escapeHtml(label("assessment_unavailable"))}</p>
    <p class="admissions-catalog__meta">${escapeHtml(label("assessment_meaning"))}</p>
    ${assessment.reason && ADMISSIONS_RENDER_LABELS[`reason.${assessment.reason}`] ? `<p>${escapeHtml(label(`reason.${assessment.reason}`))}</p>` : ""}
    <p class="admissions-catalog__meta">${escapeHtml(label("self_reported"))}</p>
    <div class="admissions-catalog__list">${checks.map(check => {
      const title = label(`kind.${check.kind}`);
      const status = ["met", "unmet", "missing", "unassessed"].includes(check.status) ? check.status : "unassessed";
      const provided = check.provided ?? check.providedExamId;
      const rule = renderAdmissionsValue(check.rule, resolved.reference_labels);
      const sourceRule = renderAdmissionsValue(check.sourceRule?.value, resolved.reference_labels);
      const sourcePeriod = typeof check.sourceRule?.period === "object" ? check.sourceRule?.period?.label : check.sourceRule?.period;
      const conditions = [check.conditions, check.sourceRule?.conditions, check.sourceRule?.conditions_and_exceptions, check.sourceRule?.exceptions].filter(value => value !== null && value !== undefined).map(value => renderAdmissionsValue(value, resolved.reference_labels)).filter(Boolean).join("");
      return `<details class="admissions-catalog__fact admissions-catalog__check"><summary class="admissions-catalog__heading"><span>${escapeHtml(title)}</span><span class="admissions-catalog__status">${escapeHtml(label(status))}</span></summary><div class="admissions-catalog__body">
        ${rule ? `<div><strong>${escapeHtml(label("rule"))}</strong>${rule}</div>` : ""}
        ${sourceRule ? `<div><strong>${escapeHtml(label("source_rule"))}</strong>${sourceRule}</div>` : ""}
        ${check.sourceRule ? `<p class="admissions-catalog__meta">${escapeHtml(publicationLabel(check.sourceRule, false))} · ${escapeHtml(label("review"))}: ${escapeHtml(reviewLabel(check.sourceRule.review_status))}</p>` : ""}
        ${sourcePeriod ? `<p class="admissions-catalog__meta">${escapeHtml(label("period"))}: ${escapeHtml(sourcePeriod)}</p>` : ""}
        ${check.sourceRule?.checked_at ? `<p class="admissions-catalog__meta">${escapeHtml(label("checked"))}: ${escapeHtml(check.sourceRule.checked_at)}</p>` : ""}
        ${check.minimum !== null && check.minimum !== undefined ? `<p><strong>${escapeHtml(label("minimum"))}:</strong> ${escapeHtml(check.minimum)}</p>` : ""}
        ${provided !== null && provided !== undefined ? `<div><strong>${escapeHtml(label("provided"))}</strong>${renderAdmissionsValue(provided, resolved.reference_labels)}</div>` : ""}
        ${conditions ? `<div><strong>${escapeHtml(label("conditions"))}</strong>${conditions}</div>` : ""}
        ${check.sourceRule ? scope(check.sourceRule, resolved) : ""}
        ${check.reason && ADMISSIONS_RENDER_LABELS[`reason.${check.reason}`] ? `<p>${escapeHtml(label(`reason.${check.reason}`))}</p>` : ""}
        <div class="admissions-catalog__sources">${sources(check, resolved)}</div>
      </div></details>`;
    }).join("")}</div>
    ${reportedRows.length ? `<details class="admissions-catalog__fact"><summary class="admissions-catalog__heading">${escapeHtml(label("provided"))}</summary><div class="admissions-catalog__body"><p class="admissions-catalog__meta">${escapeHtml(label("self_reported"))}</p>${renderAdmissionsValue(reportedRows, resolved.reference_labels)}</div></details>` : ""}
  </section>`;
  return presentation === "simple" ? `<details class="admissions-catalog__assessment-detail"><summary>${escapeHtml(label("check_details"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-catalog__body">${html}</div></details>` : html;
}

export function renderAdmissionsContext(resolved, { domains = DOMAINS, includeAssessment = true, includeUnknowns = true, includeHistory = true, includeSourceNote = true, presentation, programOnly = false } = {}) {
  if (!resolved?.selected_option || (!resolved?.selected_route && !programOnly)) return `<p class="admissions-catalog__meta">${escapeHtml(label("no_context"))}</p>`;
  if (programOnly) {
    const optionFact = row => row.applicability?.status !== "mismatched" && row.scope?.option_ids?.includes(resolved.selected_option.id) && !row.scope.route_ids?.length;
    domains = domains.filter(domain => ["study", "degree_completion", "career"].includes(domain));
    resolved = { ...resolved, facts: (resolved.facts || []).filter(optionFact), unknowns: (resolved.unknowns || []).filter(optionFact), history: { ...resolved.history, facts: (resolved.history?.facts || []).filter(optionFact), unknowns: (resolved.history?.unknowns || []).filter(optionFact) } };
  }
  const history = resolved.history || {};
  const historyFacts = history.facts || [];
  const historyUnknowns = history.unknowns || [];
  const historyCount = historyFacts.length + historyUnknowns.length;
  return `<div class="admissions-catalog">${includeSourceNote && presentation !== "simple" ? `<p class="admissions-catalog__meta">${escapeHtml(label("source_text_note"))}</p>` : ""}
    ${includeAssessment && !programOnly ? renderAdmissionsAssessment(resolved, { presentation }) : ""}
    ${domains.length ? renderAdmissionsFacts(resolved, domains, { presentation }) : ""}
    ${includeUnknowns ? renderUnknowns(resolved, resolved.unknowns || [], presentation === "simple") : ""}
    ${includeHistory && historyCount ? `<details class="admissions-catalog__fact"><summary class="admissions-catalog__heading">${escapeHtml(label("history"))} (${historyCount})</summary><div class="admissions-catalog__body"><p class="admissions-catalog__meta">${escapeHtml(label("history_note"))}</p>${historyFacts.map(row => renderFact(row, resolved, "other", true, presentation === "simple")).join("")}${renderUnknowns(resolved, historyUnknowns, presentation === "simple")}</div></details>` : ""}
  </div>`;
}
