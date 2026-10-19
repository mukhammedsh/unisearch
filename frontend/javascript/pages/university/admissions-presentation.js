import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { admissionsCycleLabel, renderAdmissionsContext, renderAdmissionsValue } from "./admissions-render.js";
import { translateAdmissionSummary } from "../../university-translations.js";
import { heroIcon } from "../../icons.js";

const label = key => t(`university.admissions.reading.${key}`);
const locale = () => ({ eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" })[getCurrentLanguage()];
const period = row => typeof row.period === "object" ? row.period?.label || "" : row.period || "";
const reviewed = row => row.publication_status === "published" && !/(?:conflict|pending|partial|superseded|requires_confirmation)/.test(row.review_status || "") && /(?:verified|reviewed|rechecked|carried_forward_review)/.test(row.review_status || "");

export function formatPublishedDate(value) {
  const text = String(value || "");
  const middle = text.match(/^mid-(January|February|March|April|May|June|July|August|September|October|November|December)$/i);
  if (middle) {
    const month = formatPublishedDate(`${middle[1][0].toUpperCase()}${middle[1].slice(1).toLowerCase()} 1`).replace(/\b1\b/, "").trim();
    return label("mid_month").replace("{month}", month);
  }
  const match = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})$/);
  if (!match) return text === "January test dates accepted" ? label("january_tests") : text;
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(2000, month, day));
  if (date.getUTCMonth() !== month) return text;
  const monthName = label(`month.${month + 1}`);
  return getCurrentLanguage() === "eng" ? `${monthName} ${day}` : `${day} ${monthName}`;
}

function linked(row, resolved) {
  const routes = [resolved.selected_route?.id, ...(resolved.selected_route?.shared_policy_context_ids || [])];
  return row.scope?.option_ids?.includes(resolved.selected_option?.id)
    || row.scope?.route_ids?.some(id => routes.includes(id));
}

function links(row, resolved) {
  return (resolved.sources || []).filter(source => row.source_ids?.includes(source.id)).map(source => {
    try {
      const url = new URL(source.url);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
      return `<a href="${escapeHtmlAttr(url.href)}" title="${escapeHtmlAttr(source.title || "")}" target="_blank" rel="noopener noreferrer">${escapeHtml(label("official_source"))}</a>`;
    } catch { return ""; }
  }).filter(Boolean).join("");
}

function sourceNote(row, resolved) {
  const value = period(row);
  const labels = {
    "Current published policy; cycle not specified": "current_policy",
    "Recurring first-year dates; page does not specify entry year": "yearless_period",
  };
  const entry = value.match(/^(Fall|Spring|Summer|Winter)? ?(20\d{2}) entry$/);
  const translated = labels[value] ? label(labels[value]) : entry ? admissionsCycleLabel(value) : value;
  const simple = labels[value] || entry || /^[\d–—‑\s-]+$/.test(value);
  return `<div class="admissions-reading__source">${simple && value ? `<span>${escapeHtml(translated)}</span>` : ""}${links(row, resolved)}${value && !simple ? `<details class="admissions-catalog__evidence"><summary>${escapeHtml(label("source_period"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><p>${escapeHtml(value)}</p></details>` : ""}</div>`;
}

function aidSummary(rows, resolved) {
  const route = resolved.selected_route?.id;
  if (!["mit-first-year", "mit-transfer"].includes(route)) return "";
  const process = rows.find(row => reviewed(row) && row.value?.priority_due && Array.isArray(row.value.required) && row.value.required.includes("CSS Profile"));
  if (!process) return "";
  const international = rows.find(row => reviewed(row) && row.value?.international_need && row.value.css_code);
  const stages = route === "mit-transfer" ? [["Transfer", t("university.admissions.catalog.applicant.transfer")]]
    : [["EA", label("early_action")], ["RA", label("regular_action")]];
  const dates = stages.filter(([stage]) => typeof process.value.priority_due[stage] === "string")
    .map(([stage, name]) => [escapeHtml(name), escapeHtml(formatPublishedDate(process.value.priority_due[stage]))]);
  const text = value => escapeHtml(translateAdmissionSummary(value) || label("summary_translation_missing"));
  const documents = process.value.required.filter(item => item !== "FAFSA for federal-aid eligible domestic applicants").map(item =>
    item === "CSS Profile" ? `${escapeHtml(label("aid_css"))}${international ? ` ${escapeHtml(tFormat("university.admissions.reading.aid_css_code", { code: international.value.css_code }))}` : ""}` : text(item));
  const timeline = dates.length ? `${table(label("aid_priority_dates"), [label("window"), label("aid_by")], dates)}<p class="admissions-reading__note">${escapeHtml(label("recurring_dates"))}</p>` : "";
  return `<section class="admissions-reading__section" data-aid-summary><h3>${escapeHtml(label("aid_title"))}</h3><p>${escapeHtml(label("aid_explained"))}</p>
    <h4>${escapeHtml(label("aid_documents"))}</h4><ol class="admissions-catalog__items">${documents.map(document => `<li>${document}</li>`).join("")}</ol>
    ${process.value.required.includes("FAFSA for federal-aid eligible domestic applicants") ? `<p class="admissions-reading__note" data-aid-fafsa>${escapeHtml(label("aid_fafsa"))}</p>` : ""}
    ${timeline}
    ${international ? `<h4>${escapeHtml(label("aid_international_title"))}</h4><p>${text(international.value.international_category)}</p><p>${text(international.value.international_need)}</p><p>${escapeHtml(label("aid_finances_title"))}</p>${renderAdmissionsValue((international.value.parent_finances || []).map(value => translateAdmissionSummary(value) || label("summary_translation_missing")))}${["separated_divorced_parents", "non_english", "submission", "processing"].filter(key => international.value[key]).map(key => `<p>${text(international.value[key])}</p>`).join("")}${sourceNote(international, resolved)}` : ""}
    ${process.value.late ? `<p>${text(process.value.late)}</p>` : ""}${process.value.individual_award ? `<p class="admissions-reading__note">${text(process.value.individual_award)}</p>` : ""}<p class="admissions-reading__note">${escapeHtml(label("potential_aid"))}</p>${sourceNote(process, resolved)}</section>`;
}

function table(caption, headings, rows) {
  return `<div class="admissions-reading__table-wrap"><table class="admissions-reading__table" role="table"><caption>${escapeHtml(caption)}</caption><thead role="rowgroup"><tr role="row">${headings.map(heading => `<th scope="col" role="columnheader">${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody role="rowgroup">${rows.map(cells => `<tr role="row">${cells.map((cell, index) => `<${index ? 'td role="cell"' : 'th scope="row" role="rowheader"'} data-label="${escapeHtmlAttr(headings[index])}">${cell}</${index ? "td" : "th"}>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function requirements(rows, resolved) {
  return rows.filter(reviewed).map(row => {
    const value = row.value;
    if (!value || typeof value !== "object") return "";
    if (value.presence && Array.isArray(value.alternatives) && value.alternatives.every(item => typeof item === "string")) {
      return `<section class="admissions-reading__section"><h3>${escapeHtml(label("tests"))}</h3><p><strong>${escapeHtml(value.alternatives.join(` ${label("or")} `))}</strong> · ${renderAdmissionsValue(value.presence)}</p>${value.cutoff === null ? `<p class="admissions-reading__note">${escapeHtml(label("no_numeric_cutoff"))}</p>` : ""}${sourceNote(row, resolved)}</section>`;
    }
    if (Array.isArray(value.minima_and_recommendations)) {
      const exams = value.minima_and_recommendations.filter(exam => typeof exam.exam === "string");
      const entries = exams.map(exam => [
        `${escapeHtml(exam.exam)}${exam.test_date_before || exam.test_date_from ? `<small>${escapeHtml(label(exam.test_date_before ? "test_before" : "test_from"))} ${escapeHtml(exam.test_date_before || exam.test_date_from)}</small>` : ""}${exam.scale ? `<small>${escapeHtml(label("scale"))}: ${escapeHtml(exam.scale)}</small>` : ""}`,
        renderAdmissionsValue(exam.minimum), renderAdmissionsValue(exam.recommended),
      ]);
      const condition = row.conditions?.find(item => item.when === "Non-native English speaker AND (using English for fewer than five years OR not speaking English at home or school)");
      return `<section class="admissions-reading__section"><h3>${escapeHtml(label("language"))}</h3><p>${renderAdmissionsValue(value.presence)}</p>${condition ? `<p>${escapeHtml(label("english_condition"))}</p>` : ""}${table(label("language_scores"), [label("exam"), label("minimum"), label("recommended")], entries)}${sourceNote(row, resolved)}</section>`;
    }
    if (Array.isArray(value.required) && value.required.every(item => typeof item === "string") && ["documents", "application_process"].includes(row.topic)) {
      const documentLabels = {
        "MIT application including essays/activities/academics": "document_application",
        "Secondary School Report with transcript": "document_school",
        "Two teacher recommendations": "document_references",
        "SAT or ACT": "document_tests",
      };
      return `<section class="admissions-reading__section"><h3>${escapeHtml(label("documents"))}</h3>${renderAdmissionsValue(value.required.map(item => documentLabels[item] ? label(documentLabels[item]) : item))}${sourceNote(row, resolved)}</section>`;
    }
    return "";
  }).join("");
}

function deadlines(rows, resolved) {
  return rows.filter(reviewed).sort((left, right) => Number(Boolean(right.value?.windows?.some(window => window.application_due))) - Number(Boolean(left.value?.windows?.some(window => window.application_due)))).map(row => {
    const windows = row.value?.windows;
    if (!Array.isArray(windows)) return "";
    const rounds = windows.filter(window => typeof window.name === "string" && typeof window.application_due === "string");
    const tests = windows.filter(window => typeof window.round === "string" && typeof window.latest === "string" && Array.isArray(window.tests));
    if (!rounds.length && !tests.length) return "";
    const windowName = value => value === "Early Action" ? label("early_action") : value === "Regular Action" ? label("regular_action") : value;
    const cells = rounds.length ? rounds.map(window => [escapeHtml(windowName(window.name)), escapeHtml(formatPublishedDate(window.application_due)), escapeHtml(formatPublishedDate(window.aid_due || label("unknown"))), escapeHtml(formatPublishedDate(window.decision || label("unknown")))])
      : tests.map(window => [escapeHtml(windowName(window.round)), escapeHtml(window.tests.map(test => test === "English proficiency" ? label("language") : test).join(", ")), escapeHtml(formatPublishedDate(window.latest))]);
    return `<section class="admissions-reading__section">${table(label(rounds.length ? "application_dates" : "test_dates"), rounds.length ? [label("window"), label("apply_by"), label("aid_by"), label("decision")] : [label("window"), label("exam"), label("last_test")], cells)}${!row.scope?.cycle && !/20\d{2}/.test(JSON.stringify(windows)) ? `<p class="admissions-reading__note">${escapeHtml(label("recurring_dates"))}</p>` : ""}${row.value.enrollment_reply ? `<p>${escapeHtml(label("reply_by"))}: <strong>${escapeHtml(formatPublishedDate(row.value.enrollment_reply))}</strong></p>` : ""}${sourceNote(row, resolved)}</section>`;
  }).join("");
}

function finance(rows, resolved) {
  const budgets = rows.map(row => row.attributes?.catalog_costs
    ? { ...row, value: row.attributes.catalog_costs, period: { label: row.attributes.catalog_costs.academic_year } } : row)
    .filter(row => reviewed(row) && typeof row.value?.currency === "string" && Number.isFinite(row.value?.total_before_aid));
  const budgetHtml = budgets.map(row => {
    const value = row.value;
    const money = amount => `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(amount)} ${escapeHtml(value.currency)}`;
    const items = ["tuition", "student_life_fee", "housing_estimate", "food_estimate", "materials_estimate", "personal_estimate"]
      .filter(key => Number.isFinite(value[key]));
    const insurance = value.health_insurance === "Additional required coverage, not in this total" ? label("insurance_not_included") : value.health_insurance;
    const exclusions = (value.exclusions || []).map(key => t(`universities.cost.exclusion.${key}`)).join(" ");
    return `<section class="admissions-reading__section"><h3>${escapeHtml(label("reference_budget"))} · ${escapeHtml(period(row))}</h3><p class="admissions-reading__total">${money(value.total_before_aid)}</p><p class="admissions-reading__note">${escapeHtml(label("dated_budget"))}</p><dl class="admissions-reading__costs">${items.map(key => `<div><dt>${escapeHtml(label(key))}</dt><dd>${money(value[key])}</dd></div>`).join("")}</dl>${insurance ? `<p>${escapeHtml(label("insurance_extra"))} ${escapeHtml(insurance)}</p>` : ""}${exclusions ? `<p>${escapeHtml(exclusions)}</p>` : ""}${sourceNote(row, resolved)}</section>`;
  }).join("");
  const funding = new Map();
  for (const row of rows.filter(reviewed)) {
    const value = row.value;
    if (!value?.funding_program || value.funding_type === "paid") continue;
    const key = JSON.stringify([value.funding_program, row.scope, row.period, row.conditions, row.conditions_and_exceptions]);
    if (!funding.has(key)) funding.set(key, row);
  }
  const aid = aidSummary(rows, resolved);
  const fundingHtml = aid || [...funding.values()].map(row => `<section class="admissions-reading__section"><h3>${escapeHtml(row.value.funding_program === "Need-based Aid" ? label("aid_title") : row.value.funding_program)}</h3><p>${escapeHtml(label("potential_aid"))}</p>${sourceNote(row, resolved)}</section>`).join("");
  return `${budgets.length ? "" : `<p class="admissions-reading__note">${escapeHtml(label("no_budget"))}</p>`}${budgetHtml}${fundingHtml}`;
}

export function renderApplicantSection(resolved, domains) {
  const ids = new Set(domains.flatMap(domain => resolved.fact_groups?.[domain] || []));
  const rows = (resolved.facts || []).filter(row => ids.has(row.id) && row.applicability?.status !== "mismatched");
  const relevant = row => linked(row, resolved) && !(domains.includes("requirements") && /^(?:study_content|study_structure|degree_)/.test(row.topic));
  const focused = rows.filter(relevant);
  const general = rows.filter(row => !relevant(row));
  const mode = domains.includes("costs") ? "finance" : domains.includes("deadlines") ? "dates" : "requirements";
  const highlights = mode === "finance" ? finance(focused, resolved) : mode === "dates" ? deadlines(focused, resolved) : requirements(focused, resolved);
  const references = facts => renderAdmissionsContext({ ...resolved, facts }, {
    domains, includeAssessment: false, includeUnknowns: false, includeHistory: false,
    includeSourceNote: false, presentation: "simple",
  });
  const mainRecords = highlights && mode !== "requirements"
    ? `<details class="admissions-reading__references"><summary>${escapeHtml(label("full_records"))}</summary>${references(focused)}</details>`
    : focused.length || !general.length ? references(focused) : "";
  return `<div class="admissions-reading">${highlights}${mode === "finance" && !focused.some(row => row.value?.funding_program) ? `<p class="admissions-reading__note">${escapeHtml(label("potential_aid"))}</p>` : ""}${mainRecords}${general.length ? `<details class="admissions-reading__references" data-general-references><summary>${escapeHtml(label("general_references"))} (${general.length})</summary><p class="admissions-reading__note">${escapeHtml(label("general_reference_note"))}</p>${references(general)}</details>` : ""}${mode === "requirements" ? renderAdmissionsContext({ ...resolved, facts: [], fact_groups: {} }, { domains: [], includeSourceNote: false, includeHistory: false, presentation: "simple" }) : ""}</div>`;
}
