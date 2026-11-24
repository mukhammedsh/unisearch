import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { formatPrice, formatPriceRange } from "../../currency.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { admissionsCycleLabel, admissionDeadlineTitle, admissionWindowName, renderAdmissionsContext, renderAdmissionsUnknowns, renderAdmissionsValue } from "./admissions-render.js";
import { getReviewedDeadlineEvents } from "./deadline-calendar.js";
import { trStudyMode } from "../_shared.js";
import { translateAdmissionSummary, translateFactSource } from "../../university-translations.js";
import { glossaryTerms, renderTermList } from "./admissions-glossary.js";
import { isEvidenceReviewed as evidenceReviewed, isPublishedReference, isReviewedPublished as reviewed, needsResolution, reviewNeedsResolution, reviewState } from "./admissions-status.js";

const label = key => t(`university.admissions.reading.${key}`);
const period = row => typeof row.period === "object" ? row.period?.label || "" : row.period || "";

export function formatPublishedDate(value) {
  const text = String(value || "");
  const iso = text.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(`${text}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) return text;
    const month = label(`month.${Number(iso[2])}`);
    return getCurrentLanguage() === "eng" ? `${month} ${Number(iso[3])}, ${iso[1]}` : `${Number(iso[3])} ${month} ${iso[1]}`;
  }
  // "mid-April" and "early April" are published as approximate dates; both read in the interface language.
  const middle = text.match(/^(mid-|early )(January|February|March|April|May|June|July|August|September|October|November|December)$/i);
  if (middle) {
    const month = formatPublishedDate(`${middle[2][0].toUpperCase()}${middle[2].slice(1).toLowerCase()} 1`).replace(/\b1\b/, "").trim();
    return label(/^mid/i.test(middle[1]) ? "mid_month" : "early_month").replace("{month}", month);
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
  const routes = new Set([resolved.selected_route?.id, ...(resolved.selected_route?.shared_policy_context_ids || [])]);
  return (resolved.reading_scope === "institution_route" && !row.scope?.option_ids?.length)
    || row.scope?.option_ids?.includes(resolved.selected_option?.id)
    || row.scope?.route_ids?.some(id => routes.has(id));
}

function safeSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

// Numbers the official sources of one reading area in citation order. Sources sharing a URL share a number,
// so every excerpt marker and the area's source list agree.
function createSourceRegistry(resolved) {
  const entries = new Map();
  const cite = (ids, checkedAt = "") => {
    const cited = [];
    for (const id of ids || []) {
      const source = (resolved.sources || []).find(item => item.id === id);
      const url = safeSourceUrl(source?.url);
      if (!url) continue;
      let entry = entries.get(url);
      if (!entry) entries.set(url, entry = { number: entries.size + 1, url, titles: new Set(), dates: new Set() });
      if (source.title) entry.titles.add(translateFactSource(source.title, source.title));
      if (source.checked_at) entry.dates.add(source.checked_at);
      if (!cited.includes(entry)) cited.push(entry);
    }
    const factDate = String(checkedAt || "").trim();
    if (factDate) for (const entry of cited) if (!entry.dates.size) entry.dates.add(factDate);
    return cited.sort((left, right) => left.number - right.number);
  };
  return { cite, entries: () => [...entries.values()] };
}

const sourceTitle = entry => [...entry.titles].join(" · ") || new URL(entry.url).hostname;

function markers(row, resolved) {
  const cited = resolved.readingSources?.cite(row.source_ids, row.checked_at) || [];
  // The numbers are named as sources, so a reader can tell they point to the official pages listed under the tab.
  return cited.length ? `<span class="admissions-reading__refs"><span class="admissions-reading__refs-label">${escapeHtml(t(`university.ux2.sources.${cited.length > 1 ? "many" : "one"}`))}</span>${cited.map(entry => `<a class="admissions-reading__ref" href="${escapeHtmlAttr(entry.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtmlAttr(tFormat("university.admissions.reading.source_marker", { number: entry.number, title: sourceTitle(entry) }))}" title="${escapeHtmlAttr(sourceTitle(entry))}" data-source-ref="${entry.number}">${entry.number}</a>`).join("")}</span>` : "";
}

// Official pages can share one title (for example a first-year and a transfer "Application" page). Those entries get the
// URL path segments that differ within their group, so the reader can tell the pages apart; unique titles stay as they are.
export function sourceDistinguishingHints(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const title = sourceTitle(entry);
    groups.set(title, [...(groups.get(title) || []), entry]);
  }
  const hints = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const parsed = group.map(entry => {
      const url = new URL(entry.url);
      const segments = url.pathname.split("/").filter(Boolean).map(part => {
        try { return decodeURIComponent(part).replace(/\.html?$/i, ""); } catch { return part.replace(/\.html?$/i, ""); }
      });
      return { entry, host: url.hostname.replace(/^www\./, ""), segments, query: url.search };
    });
    const common = new Set(parsed[0].segments.filter(segment => parsed.every(item => item.segments.includes(segment))));
    for (const item of parsed) {
      const distinct = item.segments.filter(segment => !common.has(segment));
      const path = (distinct.length ? distinct : item.segments.slice(-1)).join(" / ");
      const sameHost = parsed.every(other => other.host === item.host);
      const hint = [sameHost ? "" : item.host, path, item.query].filter(Boolean).join(" ");
      hints.set(item.entry, hint);
    }
  }
  return hints;
}

function renderSourceList(registry) {
  const entries = registry.entries();
  if (!entries.length) return "";
  const hints = sourceDistinguishingHints(entries);
  const checked = escapeHtml(t("university.admissions.checked"));
  const missingDate = escapeHtml(t("university.admissions.check_date_unrecorded"));
  const dateNote = dates => dates.size
    ? `<span class="admissions-reading__note" data-source-checked>${checked}: ${[...dates].map(escapeHtml).join(", ")}</span>`
    : `<span class="admissions-reading__note" data-source-check-date-missing>${missingDate}</span>`;
  // One shared check date is stated once for the list instead of on every line.
  const allDates = new Set(entries.flatMap(entry => [...entry.dates]));
  const shared = entries.length > 1 && allDates.size === 1 && entries.every(entry => entry.dates.size === 1);
  return `<section class="admissions-reading__sources" data-reading-sources><h3>${escapeHtml(tFormat("university.admissions.reading.official_sources_count", { count: entries.length }))}</h3>${shared ? dateNote(allDates) : ""}<ol class="admissions-reading__source-list">${entries.map(entry => `<li value="${entry.number}" data-source-number="${entry.number}"><a href="${escapeHtmlAttr(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceTitle(entry))}</a>${hints.get(entry) ? `<span class="admissions-reading__note" data-source-hint>${escapeHtml(hints.get(entry))}</span>` : ""}${!shared ? dateNote(entry.dates) : ""}</li>`).join("")}</ol></section>`;
}

const PERIOD_LABELS = {
  "Current published policy; cycle not specified": "current_policy",
  "Recurring first-year dates; page does not specify entry year": "yearless_period",
};

// Research wording that says the source gives no entry year; the applicant only needs to know the year is not stated.
const YEARLESS_WORDING = /\b(?:year not stated|cycle not (?:specified|separately established)|no (?:application )?year|yearless|does not (?:state|specify) (?:entry |cycle )?year|undated)\b/i;
const RECURRING_WORDING = /\brecurring\b/i;

// The applicant-facing reading of a period label: an entry cycle, an academic year or a "year not stated" note.
// Other research wording (process notes, date lists already shown in the value) stays in the full source records.
export function plainPeriodLabel(value, kind = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (PERIOD_LABELS[text]) return label(PERIOD_LABELS[text]);
  if (/^(Fall|Spring|Summer|Winter)? ?(20\d{2}(?:-(?:\d{2}|20\d{2})|\/\d{2})?) ?entry$/.test(text)) return admissionsCycleLabel(text);
  if (/^[\d–—‑\s-]+$/.test(text)) return text;
  const cycle = text.match(/^(?:Effective |First entry )?((?:Fall|Spring|Summer|Winter) 20\d{2})(?: entry)?\b/);
  if (cycle) return admissionsCycleLabel(`${cycle[1]} entry`);
  const year = text.match(/^(?:Catalog )?(20\d{2}-(?:\d{2}|20\d{2}))\b/);
  if (year) return year[1];
  if (YEARLESS_WORDING.test(text) || RECURRING_WORDING.test(text) || kind === "yearless_policy") {
    return label(RECURRING_WORDING.test(text) ? "yearless_period" : "current_policy");
  }
  return "";
}

// The published period as plain muted text in the applicant's language: an entry year or academic year only. A note that
// the page names no year is research scope, not an answer, so it stays in the full source records.
function periodNote(row) {
  const value = period(row || {}) || row?.scope?.cycle || "";
  const plain = plainPeriodLabel(value, row?.period?.kind);
  if (!plain || [label("yearless_period"), label("current_policy")].includes(plain)) return "";
  return `<span data-source-period>${escapeHtml(plain)}</span>`;
}

function sourceNote(row, resolved, { omitPeriod = false } = {}) {
  const content = `${omitPeriod ? "" : periodNote(row)}${markers(row, resolved)}`;
  return content ? `<div class="admissions-reading__source">${content}</div>` : "";
}

function sourceSummaries(rows, resolved, section) {
  const seen = resolved.readingSeen || new Set();
  // The CS MS policy includes the central English minima and exemptions; retain the shared record in full references.
  const csEnglish = section === "requirements" && rows.some(row => row.id === "engineering-doerr-evidence:cs-ms-tests-and-english-policy"
    && reviewed(row) && row.scope?.option_ids?.includes(resolved.selected_option?.id));
  const sourceUrls = row => (row.source_ids || []).map(id => safeSourceUrl((resolved.sources || []).find(item => item.id === id)?.url) || `id:${id}`).sort();
  const excerpts = rows.filter(row => !(csEnglish && row.id === "engineering-doerr-evidence:english-proficiency" && reviewed(row)))
    .filter(row => evidenceReviewed(row) || needsResolution(row)).filter(row => !row.scope?.levels?.length || !resolved.selected_option?.levels?.length
    || row.scope.levels.some(level => resolved.selected_option.levels.includes(level))).sort((left, right) => Number(linked(right, resolved)) - Number(linked(left, resolved))).map(row => {
    const value = row.value || {};
    const values = typeof value === "string" ? [value] : [JSON.stringify(value), value.full_course_specific_academic_requirement_and_exceptions, value.A_level_rules_by_option_panel, value.IB_rules_by_option_panel, ...Object.values(value)].flat();
    const status = reviewState(row) === "carried_forward" ? "carried_forward" : evidenceReviewed(row) ? "reviewed" : reviewNeedsResolution(row) ? "conflict" : "unverified";
    // An excerpt that would read exactly like one already shown on this tab (same text, sources, period and status) is printed once.
    const texts = [...new Set([...new Set(values.filter(item => typeof item === "string"))].map(item => translateAdmissionSummary(item, { section })).filter(Boolean))].filter(text => {
      const key = JSON.stringify([text, sourceUrls(row), period(row) || row.scope?.cycle || "", status]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return texts.length ? { row, texts, status, period: periodNote(row) } : null;
  }).filter(Boolean);
  if (!excerpts.length) return "";
  // A period shared by every excerpt of the section is stated once under its heading; differing periods stay beside their excerpts.
  const sharedPeriod = excerpts.length > 1 && excerpts[0].period && excerpts.every(item => item.period === excerpts[0].period) ? excerpts[0].period : "";
  // A text that is unconfirmed or conflicting says so beside it; a carried-forward review is provenance and stays in the full records.
  const statusNote = status => status === "conflict" ? label("source_conflict") : label("source_unverified");
  const statusAttribute = status => status === "conflict" ? "data-summary-conflict" : "data-summary-unverified";
  const blocks = excerpts.map(({ row, texts, status }) => `<div class="admissions-reading__excerpt" data-summary-fact="${escapeHtmlAttr(row.id)}">${!["reviewed", "carried_forward"].includes(status) ? `<p class="admissions-context__note" ${statusAttribute(status)}>${escapeHtml(statusNote(status))}</p>` : ""}${texts.map(text => `<p>${escapeHtml(text)}</p>`).join("")}${sourceNote(row, resolved, { omitPeriod: Boolean(sharedPeriod) })}</div>`);
  return `<section class="admissions-reading__section" data-source-summary="${section}"><h3>${escapeHtml(label(`summary_${section}`))}</h3>${sharedPeriod ? `<div class="admissions-reading__source" data-section-period>${sharedPeriod}</div>` : ""}${blocks.join("")}</section>`;
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
    item === "CSS Profile" ? `${escapeHtml(label("aid_css"))}${international ? ` ${escapeHtml(tFormat("university.admissions.reading.aid_css_code", { code: international.value.css_code }))}` : ""}${renderTermList(["css_profile"], resolved.readingTerms)}` : text(item));
  const timeline = dates.length ? `${table(label("aid_priority_dates"), [label("window"), label("aid_by")], dates)}<p class="admissions-reading__note">${escapeHtml(label("recurring_dates"))}</p>` : "";
  return `<section class="admissions-reading__section" data-aid-summary><h3>${escapeHtml(label("aid_title"))}</h3><p>${escapeHtml(label("aid_explained"))}</p>
    <h4>${escapeHtml(label("aid_documents"))}</h4><ol class="admissions-catalog__items">${documents.map(document => `<li>${document}</li>`).join("")}</ol>
    ${process.value.required.includes("FAFSA for federal-aid eligible domestic applicants") ? `<p class="admissions-reading__note" data-aid-fafsa>${escapeHtml(label("aid_fafsa"))}</p>` : ""}
    ${timeline}
    ${international ? `<h4>${escapeHtml(label("aid_international_title"))}</h4><p>${text(international.value.international_category)}</p><p>${text(international.value.international_need)}</p><p>${escapeHtml(label("aid_finances_title"))}</p>${renderAdmissionsValue((international.value.parent_finances || []).map(value => translateAdmissionSummary(value) || label("summary_translation_missing")))}${["separated_divorced_parents", "non_english", "submission", "processing"].filter(key => international.value[key]).map(key => `<p>${text(international.value[key])}</p>`).join("")}${sourceNote(international, resolved)}` : ""}
    ${process.value.late ? `<p>${text(process.value.late)}</p>` : ""}${process.value.individual_award ? `<p class="admissions-reading__note">${text(process.value.individual_award)}</p>` : ""}<p class="admissions-reading__note">${escapeHtml(label("potential_aid"))}</p>${sourceNote(process, resolved)}</section>`;
}

function table(caption, headings, rows) {
  return `<div class="admissions-reading__table-wrap" tabindex="0" role="region" aria-label="${escapeHtmlAttr(caption)}"><table class="admissions-reading__table"><caption>${escapeHtml(caption)}</caption><thead><tr>${headings.map(heading => `<th scope="col">${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map((cell, index) => `<${index ? "td" : 'th scope="row"'} data-label="${escapeHtmlAttr(headings[index])}">${cell}</${index ? "td" : "th"}>`).join("")}</tr>`).join("")}</tbody></table></div>`;
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
      // A score floor for an optional test applies only to applicants who take it; a bare "Minimum" would read as a requirement.
      const minimumHeading = label(value.presence === "required" ? "minimum" : "minimum_if_taken");
      return `<section class="admissions-reading__section"><h3>${escapeHtml(label("language"))}</h3><p>${renderAdmissionsValue(value.presence)}</p>${condition ? `<p>${escapeHtml(label("english_condition"))}</p>` : ""}${table(label("language_scores"), [label("exam"), minimumHeading, label("recommended")], entries)}${sourceNote(row, resolved)}</section>`;
    }
    if (Array.isArray(value.required) && value.required.every(item => typeof item === "string") && ["documents", "application_process"].includes(row.topic)) {
      const documentLabels = {
        "MIT application including essays/activities/academics": "document_application",
        "Secondary School Report with transcript": "document_school",
        "Two teacher recommendations": "document_references",
        "SAT or ACT": "document_tests",
      };
      return `<section class="admissions-reading__section"><h3>${escapeHtml(label("documents"))}</h3>${renderAdmissionsValue(value.required.map(item => documentLabels[item] ? label(documentLabels[item]) : translateAdmissionSummary(item) || item))}${sourceNote(row, resolved)}</section>`;
    }
    return "";
  }).join("");
}

function deadlines(rows, resolved) {
  let recurringShown = false;
  return rows.filter(row => reviewed(row) || Array.isArray(row.attributes?.deadline_events) || row.value?.application_deadline && evidenceReviewed(row)).sort((left, right) => Number(Boolean(right.value?.windows?.some(window => window.application_due))) - Number(Boolean(left.value?.windows?.some(window => window.application_due)))).map(row => {
    if (typeof row.value?.application_deadline === "string") {
      const entries = [[escapeHtml(t("university.deadlines.kind.application")), escapeHtml(formatPublishedDate(row.value.application_deadline))]];
      if (row.value.expected_start) entries.push([escapeHtml(t("university.admissions.catalog.field.start_date")), escapeHtml(formatPublishedDate(row.value.expected_start))]);
      return `<section class="admissions-reading__section" data-dated-source-reference>${row.publication_status.includes("_past") ? `<p class="admissions-reading__note">${escapeHtml(t("university.deadlines.dated_reference"))}</p>` : ""}${table(label("application_dates"), [label("window"), label("date")], entries)}${sourceNote(row, resolved)}</section>`;
    }
    if (Array.isArray(row.attributes?.deadline_events) || Array.isArray(row.value)) {
      const events = getReviewedDeadlineEvents(resolved).filter(event => event.sourceFactId === row.id);
      const entries = events.map(event => [
        escapeHtml(admissionDeadlineTitle(event)), escapeHtml(formatPublishedDate(event.deadline)),
        escapeHtml([event.time, event.timezone].filter(Boolean).join(" · ") || label("unknown")),
      ]);
      return entries.length ? `<section class="admissions-reading__section" data-published-deadline-array>${table(t("university.admissions.catalog.domain.deadlines"), [label("window"), label("date"), label("local_time")], entries)}${renderTermList(glossaryTerms(events.map(event => event.name)), resolved.readingTerms)}${sourceNote(row, resolved)}</section>` : "";
    }
    if (row.value?.windows?.some(window => window.entry && window.date)) {
      const entries = row.value.windows.filter(window => window.entry && window.date).map(window => [
        escapeHtml(admissionsCycleLabel(window.entry)), escapeHtml(formatPublishedDate(window.date)),
        escapeHtml(translateAdmissionSummary(JSON.stringify(window.applicant_category), { section: "applicant_scope" }) || translateAdmissionSummary(window.applicant_category, { section: "applicant_scope" }) || label("check_source_conditions")),
      ]);
      return `<section class="admissions-reading__section" data-transfer-windows>${table(label("application_dates"), [label("window"), label("apply_by"), label("applicant_scope")], entries)}${sourceNote(row, resolved)}</section>`;
    }
    if (row.value?.deadlines && typeof row.value.deadlines === "object") {
      const entries = Object.entries(row.value.deadlines)
        .filter(([key, value]) => resolved.reference_labels?.[key] === resolved.selected_option?.title && typeof value === "string")
        .map(([, value]) => [escapeHtml(resolved.selected_option.title), escapeHtml(formatPublishedDate(value))]);
      if (entries.length) {
        const consideration = row.value.deadline_kind === "admissions_for_scholarship_consideration";
        return `<section class="admissions-reading__section" data-program-deadlines>${table(consideration ? t("university.deadlines.kind.funding_consideration") : label("application_dates"), [label("program"), consideration ? label("date") : label("apply_by")], entries)}${sourceNote(row, resolved)}</section>`;
      }
    }
    if (row.value?.other_course_equal_consideration) {
      const medicine = ["imperial-option-medicine", "imperial-option-medicine-graduate-entry"].includes(resolved.selected_option?.id);
      const deadline = medicine ? row.value.medicine_deadline : row.value.other_course_equal_consideration;
      if (!deadline?.date) return "";
      const entries = [[escapeHtml(label(medicine ? "ucas_medicine" : "ucas_equal_consideration")), escapeHtml(formatPublishedDate(deadline.date)), escapeHtml([deadline.time, deadline.timezone].filter(Boolean).join(" · "))]];
      if (row.value.submission_opens) entries.unshift([escapeHtml(label("submission_opens")), escapeHtml(formatPublishedDate(row.value.submission_opens)), ""]);
      return `<section class="admissions-reading__section" data-ucas-dates>${table(label("application_dates"), [label("window"), label("date"), label("local_time")], entries)}${renderTermList(["ucas"], resolved.readingTerms)}${sourceNote(row, resolved)}</section>`;
    }
    const windows = row.value?.windows;
    if (!Array.isArray(windows)) return "";
    const rounds = windows.filter(window => typeof window.name === "string" && typeof window.application_due === "string");
    const tests = windows.filter(window => typeof window.round === "string" && typeof window.latest === "string" && Array.isArray(window.tests));
    if (!rounds.length && !tests.length) return "";
    const windowName = admissionWindowName;
    const cells = rounds.length ? rounds.map(window => [escapeHtml(windowName(window.name)), escapeHtml(formatPublishedDate(window.application_due)), escapeHtml(formatPublishedDate(window.aid_due || label("unknown"))), escapeHtml(formatPublishedDate(window.decision || label("unknown")))])
      : tests.map(window => [escapeHtml(windowName(window.round)), escapeHtml(window.tests.map(test => test === "English proficiency" ? label("language") : test).join(", ")), escapeHtml(formatPublishedDate(window.latest))]);
    const recurring = !row.scope?.cycle && !/20\d{2}/.test(JSON.stringify(windows)) && !recurringShown;
    if (recurring) recurringShown = true;
    return `<section class="admissions-reading__section">${table(label(rounds.length ? "application_dates" : "test_dates"), rounds.length ? [label("window"), label("apply_by"), label("aid_by"), label("decision")] : [label("window"), label("exam"), label("last_test")], cells)}${renderTermList(glossaryTerms(rounds.map(window => window.name), tests.map(window => window.round)), resolved.readingTerms)}${recurring ? `<p class="admissions-reading__note">${escapeHtml(label("recurring_dates"))}</p>` : ""}${row.value.enrollment_reply ? `<p>${escapeHtml(label("reply_by"))}: <strong>${escapeHtml(formatPublishedDate(row.value.enrollment_reply))}</strong></p>` : ""}${sourceNote(row, resolved)}</section>`;
  }).join("");
}

function finance(rows, resolved) {
  const budgets = rows.map(row => row.attributes?.catalog_costs
    ? { ...row, value: row.attributes.catalog_costs, period: { label: row.attributes.catalog_costs.academic_year } } : row)
    .filter(row => reviewed(row) && typeof row.value?.currency === "string" && Number.isFinite(row.value?.total_before_aid));
  const budgetHtml = budgets.map(row => {
    const value = row.value;
    const money = amount => escapeHtml(formatPrice(amount, value.currency));
    const items = ["tuition", "student_life_fee", "housing_estimate", "food_estimate", "materials_estimate", "personal_estimate"]
      .filter(key => Number.isFinite(value[key]));
    const insurance = value.health_insurance === "Additional required coverage, not in this total" ? label("insurance_not_included") : value.health_insurance;
    const exclusions = (value.exclusions || []).map(key => label(`exclusion.${key}`)).join(" ");
    const tuitionNote = Number.isFinite(value.tuition) ? `<p class="admissions-reading__note">${escapeHtml(label("tuition_budget_note"))}</p>` : "";
    return `<section class="admissions-reading__section"><h3>${escapeHtml(label("reference_budget"))} · ${escapeHtml(period(row))}</h3><p class="admissions-reading__total">${money(value.total_before_aid)}</p><p class="admissions-reading__note">${escapeHtml(label("dated_budget"))}</p><dl class="admissions-reading__costs">${items.map(key => `<div><dt>${escapeHtml(label(key))}</dt><dd>${money(value[key])}</dd></div>`).join("")}</dl>${tuitionNote}${insurance ? `<p>${escapeHtml(label("insurance_extra"))} ${escapeHtml(insurance)}</p>` : ""}${exclusions ? `<p>${escapeHtml(exclusions)}</p>` : ""}${sourceNote(row, resolved)}</section>`;
  }).join("");
  const funding = new Map();
  for (const row of rows.filter(reviewed)) {
    const value = row.value;
    if (!value?.funding_program || value.funding_type === "paid") continue;
    const key = JSON.stringify([value.funding_program, row.scope, row.period, row.conditions, row.conditions_and_exceptions]);
    if (!funding.has(key)) funding.set(key, row);
  }
  const aid = aidSummary(rows, resolved);
  const fundingHtml = aid || [...funding.values()].map(row => {
    const availability = row.value.availability;
    const status = availability === "excluded_by_published_course_rules" ? "funding_excluded"
      : availability === "not_established" ? "funding_unconfirmed" : "potential_aid";
    return `<section class="admissions-reading__section" data-funding-availability="${escapeHtmlAttr(availability || "conditional")}"><h3>${escapeHtml(row.value.funding_program === "Need-based Aid" ? label("aid_title") : row.value.funding_program)}</h3><p>${escapeHtml(label(status))}</p>${row.value.eligibility_note ? `<p>${escapeHtml(translateAdmissionSummary(row.value.eligibility_note) || row.value.eligibility_note)}</p>` : ""}${sourceNote(row, resolved)}</section>`;
  }).join("");
  // Without a published budget the tab's cost answer above already says what is known; no extra note repeats it.
  return `${budgetHtml}${fundingHtml}`;
}

export function billingPeriodLabel(value) {
  const key = { academic_year: "universities.card.per_year", whole_program: "universities.cost.whole_program", per_credit: "universities.cost.per_credit" }[value];
  return key ? t(key) : "";
}

export function publishedTuitionQuotes(row, optionId) {
  const value = row.attributes?.catalog_costs || row.value;
  const publishedReference = isPublishedReference(row) && Array.isArray(value?.quotes);
  if (!reviewed(row) && !(publishedReference && evidenceReviewed(row))) return [];
  if (Array.isArray(value?.quotes)) return value.quotes.filter(quote => quote.basis === "tuition" && Number.isFinite(quote.amount) && quote.amount >= 0 && quote.currency
    && (!quote.option_ids?.length || quote.option_ids.includes(optionId))).map(quote => ({
    feeStatus: translateAdmissionSummary(quote.fee_status) || quote.fee_status || "",
    campus: translateAdmissionSummary(quote.campus) || quote.campus || "", currency: "",
    studyYears: quote.study_years?.length ? tFormat("universities.cost.study_years", { years: quote.study_years.join(", ") }) : "",
    reference: quote.reference_only ? t("universities.cost.reference_short") : "",
    // The amount already names its currency in the reader's display setting.
    amounts: [`${formatPrice(quote.amount, quote.currency)} ${billingPeriodLabel(quote.billing_period)}`.trim()],
    period: String(quote.source_year || (/20\d{2}/.test(quote.period_label || "") ? quote.period_label : "")) || label("unknown"),
  }));
  if (!row.value?.course_page_tuition_fees) return [];
  return Object.entries(row.value.course_page_tuition_fees).flatMap(([status, panels]) => Array.isArray(panels) ? panels.map(panel => ({
    feeStatus: status === "Home fee" ? label("home_fee") : status === "Overseas fee" ? label("overseas_fee") : status,
    currency: panel.currency || "",
    amounts: ["published", "published_current_page_cycle"].includes(panel.panel_status) && panel.amounts_and_periods?.length
      ? panel.amounts_and_periods.map(amount => amount.replace(/\bper year\b/g, label("per_year")).replace(/\btotal fee\b/g, label("total_fee"))
        .replace(/\bwhole programme\b/g, label("total_fee")).replace(/\bfirst year\b/g, label("first_year")).replace(/\bSecond year\b/g, label("second_year"))
        .replace(/\b(?:Full-time|Part-time)\b/g, value => trStudyMode(value))) : [label("unknown")],
    period: admissionsCycleLabel(panel.cycle || panel.panel_cycle_label || ""),
  })) : []);
}

function courseCosts(rows, resolved) {
  return rows.map(row => {
    const quotes = publishedTuitionQuotes(row, resolved.selected_option?.id);
    const hasCampus = quotes.some(quote => quote.campus);
    const hasFeeStatus = quotes.some(quote => quote.feeStatus);
    const headings = [...(hasCampus ? [t("university.admissions.catalog.field.location")] : []), ...(hasFeeStatus ? [label("fee_status")] : []), label("tuition"), label("source_period")];
    const entries = quotes.map(quote => [
      ...(hasCampus ? [[escapeHtml(quote.campus || label("unknown")), quote.studyYears ? `<small>${escapeHtml(quote.studyYears)}</small>` : ""].join("")] : []),
      ...(hasFeeStatus ? [escapeHtml(quote.feeStatus || label("unknown"))] : []),
      [quote.amounts.map(escapeHtml).join("<br>"), escapeHtml(quote.currency), quote.reference ? `<small>${escapeHtml(quote.reference)}</small>` : ""].filter(Boolean).join(" "),
      escapeHtml(quote.period),
    ]);
    return entries.length ? `<section class="admissions-reading__section" data-course-tuition>${table(label("published_tuition"), headings, entries)}${row.value?.course_page_tuition_fees ? `<p class="admissions-reading__note">${escapeHtml(label("fee_status_explained"))}</p>` : ""}${sourceNote(row, resolved)}</section>` : "";
  }).join("");
}

function livingReferences(rows, resolved) {
  return rows.filter(reviewed).filter(row => row.value?.average_9months && Number.isFinite(row.value.private_sector_total_12months)).map(row => {
    const value = row.value;
    const money = amount => escapeHtml(formatPrice(amount, value.currency));
    const range = value.average_9months;
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return "";
    return `<section class="admissions-reading__section" data-living-reference><h3>${escapeHtml(label("living_reference"))} · ${escapeHtml(translateAdmissionSummary(value.cycle) || value.cycle)}</h3><dl class="admissions-reading__costs"><div><dt>${escapeHtml(label("living_nine_months"))}</dt><dd>${escapeHtml(formatPriceRange(range.min, range.max, value.currency))}</dd></div><div><dt>${escapeHtml(label("living_twelve_months"))}</dt><dd>${money(value.private_sector_total_12months)}</dd></div></dl><p>${escapeHtml(translateAdmissionSummary(value.exclusions) || value.exclusions)}</p><p class="admissions-reading__note">${escapeHtml(label("different_cost_periods"))}</p>${sourceNote(row, resolved)}</section>`;
  }).join("");
}

function scholarshipRounds(rows, resolved) {
  return rows.filter(reviewed).filter(row => !row.scope?.levels?.length || !resolved.selected_option?.levels?.length || row.scope.levels.some(level => resolved.selected_option.levels.includes(level)))
    .filter(row => row.value?.coverage && row.value.rounds?.some(round => round.deadline && round.notify_by)).map(row => {
    const dates = row.value.rounds.filter(round => round.deadline && round.notify_by).map(round => [escapeHtml(formatPublishedDate(round.deadline)), escapeHtml(formatPublishedDate(round.notify_by))]);
    return `<section class="admissions-reading__section" data-scholarship-rounds>${table(label("scholarship_rounds"), [label("apply_by"), label("decision")], dates)}${row.value.deadline_time ? `<p>${escapeHtml(label("local_time"))}: ${escapeHtml([row.value.deadline_time, row.value.timezone].filter(Boolean).join(" · "))}</p>` : ""}<p class="admissions-reading__note">${escapeHtml(label("scholarship_dates_separate"))}</p>${sourceNote(row, resolved)}</section>`;
  }).join("");
}

/**
 * @param {object} source The admissions-context response.
 * @param {string[]} domains The fact domains the tab reads.
 * @param {{checkDetails?: string}} [options] `checkDetails`: how the key facts checked each condition (HTML), kept in the "Sources" disclosure.
 * @returns {string} The tab's reading area as HTML.
 */
export function renderApplicantSection(source, domains, { checkDetails = "" } = {}) {
  // Each tab's reading area numbers its own sources, explains each term once and prints each identical excerpt once.
  const resolved = { ...source, readingSources: createSourceRegistry(source), readingTerms: new Set(), readingSeen: new Set() };
  const ids = new Set(domains.flatMap(domain => resolved.fact_groups?.[domain] || []));
  const referenceIds = new Set(domains.includes("requirements") ? resolved.fact_groups?.reference || [] : []);
  for (const id of referenceIds) ids.add(id);
  if (domains.includes("deadlines")) for (const row of resolved.facts || []) if (row.attributes?.deadline_events?.length || row.value?.application_deadline) ids.add(row.id);
  const rows = (resolved.facts || []).filter(row => ids.has(row.id) && row.applicability?.status !== "mismatched");
  const relevant = row => !referenceIds.has(row.id) && linked(row, resolved) && !(domains.includes("requirements") && /^(?:study_content|study_structure|degree_)/.test(row.topic));
  const focused = rows.filter(relevant);
  const general = rows.filter(row => !relevant(row));
  const mode = domains.includes("costs") ? "finance" : domains.includes("deadlines") ? "dates" : "requirements";
  const summaryRows = (resolved.facts || []).filter(row => row.applicability?.status !== "mismatched");
  const tba = mode === "dates" && resolved.selected_route && !Object.values(resolved.context_applicability || {}).includes("mismatched") && (resolved.unknowns || []).find(row => row.id === "nu-b-gap-future-central-dates" && row.applicability?.status !== "mismatched" && row.scope?.option_ids?.includes(resolved.selected_option?.id));
  const tbaSource = tba && { ...tba, source_ids: tba.source_ids?.filter(id => resolved.selected_option?.levels?.includes("masters") ? id.includes("master-regular") : id.includes("doctoral-regular")) };
  const highlights = mode === "finance" ? `${courseCosts(focused, resolved)}${finance(focused, resolved)}${livingReferences(rows, resolved)}${sourceSummaries(rows, resolved, "costs")}${sourceSummaries(rows, resolved, "funding")}${scholarshipRounds(rows, resolved)}`
    : mode === "dates" ? `${tba ? `<section class="admissions-reading__section" data-dates-tba><p>${escapeHtml(label("dates_tba"))}</p><p>${escapeHtml(label("dates_tba_next"))}</p>${sourceNote(tbaSource, resolved)}</section>` : ""}${deadlines(focused, resolved)}${sourceSummaries(summaryRows.filter(relevant), resolved, "deadlines")}`
      : `${requirements(focused, resolved)}${sourceSummaries(rows, resolved, "requirements")}${sourceSummaries(focused, resolved, "application")}`;
  const references = facts => renderAdmissionsContext({ ...source, facts }, {
    domains: [...domains, ...(referenceIds.size ? ["reference"] : [])], includeAssessment: false, includeUnknowns: false, includeHistory: false,
    includeSourceNote: false, includeReferenceScopeNote: false, presentation: "simple",
  });
  const unknowns = mode === "requirements" ? source.unknowns || [] : [];
  const count = focused.length + general.length + unknowns.length;
  // The tab's plain answers come first (the key facts above it); the official pages, every full record, the additional
  // references and the unresolved information sit behind one closed "Sources" disclosure with one language note.
  const fullRecords = count ? `<details class="admissions-reading__references" data-full-records><summary>${escapeHtml(label("full_records"))}</summary>
    <p class="admissions-reading__note">${escapeHtml(label("reference_scope_note"))}</p>${focused.length ? references(focused) : ""}
    ${general.length ? `<details class="admissions-reading__references" data-general-references><summary>${escapeHtml(label("general_references"))} (${general.length})</summary><p class="admissions-reading__note">${escapeHtml(label("general_reference_note"))}</p>${references(general)}</details>` : ""}
    ${unknowns.length ? renderAdmissionsUnknowns(source) : ""}</details>` : "";
  const sourceList = renderSourceList(resolved.readingSources);
  const citedCount = resolved.readingSources.entries().length;
  const fallbackUrls = citedCount ? [] : [...new Set([...focused, ...general, ...unknowns].flatMap(item => item.source_ids || item.sourceIds || [])
    .map(id => safeSourceUrl((source.sources || []).find(entry => entry.id === id)?.url)).filter(Boolean))];
  const sourceCount = citedCount || fallbackUrls.length;
  const records = sourceList || fullRecords || checkDetails ? `<details class="admissions-reading__references admissions-reading__provenance" data-all-records><summary>${escapeHtml(sourceCount ? tFormat("university.admissions.reading.sources_disclosure_count", { count: sourceCount }) : label("sources_disclosure"))}</summary>${checkDetails}${sourceList}${fullRecords}</details>`
    : tba ? "" : references([]);
  return `<div class="admissions-reading">${highlights}${records}</div>`;
}
