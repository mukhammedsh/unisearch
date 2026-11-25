// "Key admission facts" at the top of the university Overview tab: four plain answers (when to apply, what it costs,
// what you'll need, who studies here), each with one line of meaning and a link to the tab holding the details.
// Reviewed universities read the institution-wide first-year route through the existing admissions-context endpoint;
// the other universities use the detail payload that is already loaded. Nothing here is saved or changes the page context.
import { API_BASE, loadProfileForApi } from "../../utils.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { heroIcon } from "../../icons.js";
import { formatPrice } from "../../currency.js";
import { translateAdmissionText } from "../../university-translations.js";
import { getExamDisplayName } from "../../utils/config.js";
import { withoutBracketedText } from "../../utils/text.js";
import { formatUiNumber, safeUrl, toFiniteNumber, trFactSource, trTrackDescription } from "../_shared.js";
import { admissionsRequest, firstYearSharedRoute } from "./admissions-controller.js";
import { readForSinglePublishedCycle } from "./admissions-cycle.js";
import { englishRequirementItems } from "./admissions-english.js";
import { admissionsCycleLabel, admissionsProgramLabel, admissionsRouteName } from "./admissions-render.js";
import { costFact, deadlineFact, englishRecommendationItem, fundingPolicyStatement, MARK_ICONS, minimumChecklist, NON_NATIVE_ENGLISH } from "./admissions-key-facts.js";
import { isReviewedPublished } from "./admissions-status.js";
import { extractUniversityDeadlines, getUndergraduateCategories } from "./render-sections.js";
import { loadStaticStudyOptions } from "../../utils/static-snapshot.js";

const label = (key, fallback = "") => t(`university.ux2.${key}`, fallback);
const MAX_CHECKLIST_ITEMS = 5;
const MAX_LEGACY_EXTRAS = 4;
const TEST_TOPICS = new Set(["academic_tests", "standardized_tests"]);
const DOCUMENT_TOPICS = new Set(["documents", "application_documents", "application_process"]);
// Documents the prepared records name verbatim; any other published item keeps its own wording.
const DOCUMENT_LABEL_KEYS = {
  "MIT application including essays/activities/academics": "document_application",
  "Secondary School Report with transcript": "document_school",
  "Two teacher recommendations": "document_references",
};
const TEST_ONLY_DOCUMENT = /^(?:SAT|ACT)(?: or (?:SAT|ACT))*$/i;
const SALARY_FACTS = [
  ["early_career_salary", "early_career_salary_usd", "salary"],
  ["median_earnings_10yr", "median_earnings_10yr_usd", "earnings"],
];

const isString = value => typeof value === "string" && value.trim() !== "";
const examName = id => getExamDisplayName(id, { locale: getCurrentLanguage() });
const listOr = names => names.join(` ${label("or")} `);
// Published outcome figures are in dollars and follow the reader's currency setting.
const usd = amount => formatPrice(amount, "USD");

// The Overview and the Admission tabs read the same default path.
export { firstYearSharedRoute };

// A recommendation that is not checked against a minimum is shown as one, never as something still to prepare.
const markFor = (check, soft = false) => ({ met: "met", unmet: "below" })[check?.status] || (soft ? "recommended" : "todo");
const isSoft = presence => isString(presence) && presence !== "required";

// Published facts that apply to the read route, limited to reviewed and published records.
function routeFacts(resolved, groups) {
  const ids = new Set(groups.flatMap(group => resolved?.fact_groups?.[group] || []));
  return (resolved?.facts || []).filter(row => ids.has(row.id) && row.applicability?.status !== "mismatched" && isReviewedPublished(row));
}

const presenceLabel = presence => t(`university.ux2.needs.presence_${presence}`) || t(`university.admissions.catalog.enum.${presence}`) || String(presence).replaceAll("_", " ");

// A short checklist of the tests, language test and documents the route publishes. Marks come from the applicant's
// own profile evidence: met, to add, or below a published minimum. Nothing here is a probability.
// `profile` (the API profile, optional) lets a recommended English test show the applicant's own result, as on the Admission tab.
export function checklistItems(resolved, profile = null) {
  const checks = new Map((resolved?.assessment?.activeChoice?.details?.checks || []).map(check => [check.factId, check]));
  const rows = routeFacts(resolved, ["requirements", "application"]);
  const item = (kind, row, text, extra = {}) => ({ kind, factId: row.id, mark: markFor(checks.get(row.id), isSoft(row.value?.presence)), text, ...extra });
  const structured = { tests: [], language: [], documents: [] };
  const plain = { tests: [], documents: [] };
  for (const row of rows) {
    const value = row.value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Array.isArray(value.alternatives) && value.alternatives.length && value.alternatives.every(isString)) {
        const exams = listOr(value.alternatives.map(examName));
        structured.tests.push(item("tests", row, value.presence === "required" || !value.presence
          ? tFormat("university.ux2.needs.test", { exams })
          : tFormat("university.ux2.needs.test_other", { exams, presence: presenceLabel(value.presence) })));
      } else if (Array.isArray(value.minima_and_recommendations) && value.presence) {
        const english = tFormat("university.ux2.needs.english", { presence: presenceLabel(value.presence) });
        // A recommendation that applies only when English is not the first language says so beside the test.
        const condition = isSoft(value.presence) && (row.conditions || []).some(entry => NON_NATIVE_ENGLISH.test(entry?.when || "")) ? `, ${label("needs.if_not_native")}` : "";
        structured.language.push(item("language", row, `${english}${condition}`));
      } else if (Array.isArray(value.required) && value.required.every(isString) && DOCUMENT_TOPICS.has(row.topic)) {
        for (const document of value.required.filter(entry => !TEST_ONLY_DOCUMENT.test(entry))) {
          const key = DOCUMENT_LABEL_KEYS[document];
          structured.documents.push(item("documents", row, key ? t(`university.admissions.reading.${key}`) : translateAdmissionText(document, document)));
        }
      }
    } else if (isString(value)) {
      // A university that publishes these as one sentence keeps its own (translated) wording.
      if (TEST_TOPICS.has(row.topic)) plain.tests.push(item("tests", row, translateAdmissionText(value, value), { prose: true }));
      else if (row.topic === "application_documents") plain.documents.push(item("documents", row, translateAdmissionText(value, value), { prose: true }));
    }
  }
  const tests = structured.tests.slice(0, 1).concat(structured.tests.length ? [] : plain.tests.slice(0, 1));
  const documents = structured.documents.length ? structured.documents : plain.documents.slice(0, 1);
  // Published numeric minimums (NU's IELTS and SAT, for example) say more than a test name, so they lead when assessed.
  // A kind of requirement without a checkable minimum keeps its published wording (MIT's recommended English test).
  const minimums = minimumChecklist(resolved).map(({ kind, factId, mark, text }) => ({ kind, factId, mark, text }));
  const kinds = new Set(minimums.map(entry => entry.kind));
  const recommendation = profile ? englishRecommendationItem(resolved, profile) : null;
  const language = recommendation
    ? [{ kind: "language", factId: recommendation.factId, mark: "recommended",
      text: [recommendation.condition ? `${recommendation.text}, ${recommendation.condition}` : recommendation.text, recommendation.have].filter(Boolean).join(". ") }]
    : structured.language.slice(0, 1);
  // An English requirement the checks do not measure (a test that is not required, the course's IELTS level) leads the language line.
  const englishLines = kinds.has("language") ? [] : englishRequirementItems(resolved).map(({ kind, factId, mark, text }) => ({ kind, factId, mark, text }));
  const testsAndLanguage = [...minimums, ...(kinds.has("exam") || kinds.has("academic") ? [] : tests),
    ...(kinds.has("language") ? [] : englishLines.length ? englishLines : language)];
  return [...testsAndLanguage, ...documents].slice(0, MAX_CHECKLIST_ITEMS);
}

const percentText = value => formatUiNumber(Math.round(value * 10) / 10, { maximumFractionDigits: 1 });

// The university's own published admission statistics: who was counted, how many and in which intake.
// Offers per application (UCAS) and admits from a combined foundation pool are named as such, never as one "rate".
export function selectivityItem(statistics, source) {
  const rate = toFiniteNumber(statistics?.rate_percent);
  const applicants = toFiniteNumber(statistics?.applicants);
  const admitted = toFiniteNumber(statistics?.admitted);
  if (rate === null || applicants === null || admitted === null || applicants <= 0) return null;
  const measure = statistics.measure === "offers" ? "offers" : statistics.scope === "first_year_undergraduate" ? "first_year" : "undergraduate";
  const details = [tFormat(`university.ux2.people.selectivity_counts_${measure === "offers" ? "offers" : "admitted"}`,
    { admitted: formatUiNumber(admitted), applicants: formatUiNumber(applicants) })];
  const international = statistics.international;
  if (toFiniteNumber(international?.applicants) > 0 && toFiniteNumber(international?.admitted) !== null) {
    details.push(tFormat("university.ux2.people.selectivity_international", { admitted: formatUiNumber(international.admitted),
      applicants: formatUiNumber(international.applicants), rate: percentText(international.admitted / international.applicants * 100) }));
  }
  const preparation = statistics.preparation;
  if (isString(preparation?.name) && toFiniteNumber(preparation?.rate_percent) !== null) {
    details.push(tFormat("university.ux2.people.selectivity_preparation", { name: preparation.name, rate: percentText(preparation.rate_percent) }));
  }
  if (measure === "offers") details.push(label("people.selectivity_offers_note"));
  // A share of all applicants reads like a personal chance to a first-time reader, so the card says it is not one.
  details.push(label("people.selectivity_not_chance"));
  const year = toFiniteNumber(statistics.entry_year);
  return { kind: "selectivity", text: tFormat(`university.ux2.people.selectivity_${measure}`, { rate: percentText(rate) }), details,
    source: source(statistics.source, statistics.source_url, year ? tFormat("university.ux2.people.intake", { year }) : "", statistics.checked_at) };
}

// Who studies here: only published figures that exist, each with its official source.
export function peopleItems(university, { acceptanceRate = null, acceptanceMeta = null } = {}) {
  const items = [];
  const source = (name, url, extra = "", checkedAt = "") => {
    const href = safeUrl(url);
    const text = [isString(name) ? trFactSource(name) : "", extra].filter(Boolean).join(" · ");
    const checked = String(checkedAt || "").trim();
    // A source with no published name is shown as a plain "Official source" link, without a "Source:" caption.
    return text ? { label: text, url: href, checkedAt: checked } : href ? { label: t("university.admissions.official_source"), url: href, unnamed: true, checkedAt: checked } : null;
  };
  const selectivity = selectivityItem(university?.admission_statistics, source);
  if (selectivity) items.push(selectivity);
  const rate = selectivity ? null : toFiniteNumber(acceptanceRate);
  if (rate !== null) {
    const kind = String(university?.academics?.admissions?.university_wide?.kind || "").toLowerCase();
    items.push({ kind: "acceptance", text: tFormat(`university.ux2.people.acceptance${kind.startsWith("undergraduate") ? "_undergraduate" : ""}`,
      { rate: formatUiNumber(Math.round(rate * 10) / 10, { maximumFractionDigits: 1 }) }),
    source: source(acceptanceMeta?.source, acceptanceMeta?.source_url, "", acceptanceMeta?.verified_at) });
  }
  const enrollment = university?.enrollment_breakdown;
  const [percent, count, total] = ["undergraduate_international_percent", "undergraduate_international_count", "undergraduate_count"]
    .map(key => toFiniteNumber(enrollment?.[key]));
  if (percent !== null && total !== null && total > 0) {
    const text = count !== null
      ? tFormat("university.ux2.people.international", { percent: formatUiNumber(Math.round(percent)), count: formatUiNumber(count), total: formatUiNumber(total) })
      : tFormat("university.ux2.people.international_share", { percent: formatUiNumber(Math.round(percent)), total: formatUiNumber(total) });
    items.push({ kind: "international", text,
    source: source(enrollment.source, enrollment.source_url, enrollment.census_year, enrollment.checked_at || enrollment.verified_at) });
  }
  const years = toFiniteNumber(university?.housing?.undergraduate_guarantee_years);
  if (years !== null && years > 0) {
    // Russian needs three plural forms; the other languages use one or two.
    const mod10 = years % 10;
    const form = getCurrentLanguage() === "rus" ? (years % 100 >= 11 && years % 100 <= 14 ? "many" : mod10 === 1 ? "one" : mod10 >= 2 && mod10 <= 4 ? "few" : "many")
      : years === 1 ? "one" : "many";
    items.push({ kind: "housing", text: tFormat(`university.ux2.people.housing_${form}`, { years: formatUiNumber(years) }),
      source: source(university.housing.source, university.housing.source_url, "", university.housing.checked_at || university.housing.verified_at) });
  }
  // Reviewed universities show no earnings figure, as in comparison: their reviewed data holds no rechecked outcomes.
  const reviewed = university?.admissions_catalog?.availability === "reviewed";
  for (const [factKey, outcomeKey, kind] of reviewed ? [] : SALARY_FACTS) {
    const value = toFiniteNumber(university?.outcomes?.[outcomeKey]);
    const fact = university?.fact_provenance?.facts?.[factKey];
    if (value === null || !safeUrl(fact?.source_url)) continue;
    items.push({ kind, text: tFormat(`university.ux2.people.${kind}`, { amount: usd(value) }), source: source(fact.source, fact.source_url, "", fact.verified_at) });
    break;
  }
  return items;
}

const link = (tab, key) => ({ tab, label: label(`link.${key}`) });
// Where each program sets its own dates, costs and requirements, one card says so instead of three identical answers.
// Shortcuts open the program list already narrowed to a study level the university offers.
const LEVEL_SHORTCUTS = ["preparation", "undergraduate", "masters", "doctoral"];
export function programLevelShortcuts(university) {
  const offered = new Set(university?.admissions_catalog?.study_levels || []);
  return LEVEL_SHORTCUTS.filter(level => offered.has(level));
}
const programChoiceCard = university => {
  const levels = programLevelShortcuts(university);
  return { id: "program", icon: "academic-cap", state: "choose", headline: label("choose.headline"), lines: [label("intro_program")],
    levels, link: levels.length ? null : link("tab-programs", "choose") };
};

// Plain headline and supporting lines for the next application date.
export function deadlineCard(fact) {
  const base = { id: "deadline", icon: "calendar", link: link("tab-deadlines", "deadlines") };
  if (["upcoming", "recurring"].includes(fact.status) && fact.next) {
    const closed = (fact.passedWindows || []).map(entry => tFormat("university.ux2.deadline.closed", entry));
    const caution = fact.status === "recurring" ? [label("deadline.annual")] : [];
    // A date the university repeats without naming a year is shown without one, and its countdown is approximate.
    const headlineKey = fact.status === "recurring" ? "headline_yearless" : "headline";
    return { ...base, tone: fact.tone, headline: fact.days ? tFormat(`university.ux2.deadline.${headlineKey}`, { date: fact.next.date, days: fact.days })
      : tFormat("university.ux2.deadline.headline_today", { date: fact.next.date }),
    lines: [fact.next.title, [...closed, ...caution].join(" "), fact.status === "upcoming" ? fact.notes?.[0] : ""].filter(Boolean) };
  }
  return { ...base, tone: fact.tone, answerKind: "text", headline: fact.text, lines: fact.status === "period" ? fact.notes || [] : [] };
}

// The published price, stated before aid, with the university's aid policy and the budget comparison beneath it.
export function costCard(fact, policy = "") {
  const base = { id: "cost", icon: "banknotes", link: link("tab-finance", "cost") };
  if (!fact.amount) return { ...base, answerKind: "text", headline: fact.text, lines: [] };
  const lines = fact.status === "not_annual" ? [] : [
    [label("cost.before_aid"), fact.period ? tFormat("university.admissions.key_facts.cost_period", {
      period: /\bentry\b/i.test(fact.period) ? admissionsCycleLabel(fact.period) || fact.period : fact.period }) : ""].filter(Boolean).join(" "),
    fact.referenceNote,
    fact.basis === "tuition" ? label("cost.living_extra") : "",
  ].filter(Boolean);
  const aside = [];
  if (fact.flag) aside.push({ text: fact.flag.text, tone: fact.flag.tone });
  else if (fact.status === "no_budget") aside.push({ text: t("university.admissions.key_facts.budget_missing") });
  if (policy) aside.push({ text: tFormat("university.admissions.key_facts.funding_policy", { policy }) });
  if (fact.status === "not_annual") return { ...base, answerKind: "text", headline: fact.text, lines: fact.notes || [], aside };
  return { ...base, headline: tFormat(`university.ux2.cost.headline${fact.basis === "tuition" ? "_tuition" : ""}`, { amount: fact.amount }), lines, aside };
}

function checklistCard(items, { hasEvidence }) {
  const base = { id: "needs", icon: "clipboard-document-list", link: link("tab-admission", "needs") };
  if (!items.length) return { ...base, answerKind: "text", headline: label("needs.empty"), lines: [] };
  const evidenceHint = !hasEvidence && items.every(entry => entry.mark === "todo") ? [label("needs.profile_hint")] : [];
  return { ...base, headline: label("needs.headline"), items, lines: evidenceHint };
}

// Every card for a reviewed university; without a shared first-year route the first three cards depend on the program.
export function reviewedCards({ resolved, university, budgetUsd, profileExamIds = [], profile = null, now = new Date() }) {
  const people = peopleItems(university);
  const peopleCard = people.length ? [{ id: "people", icon: "users", items: people, headline: "" }] : [];
  if (!resolved) {
    return [programChoiceCard(university), ...peopleCard];
  }
  return [
    deadlineCard(deadlineFact(resolved, now, { profileExamIds })),
    costCard(costFact(resolved, budgetUsd), fundingPolicyStatement(resolved)),
    checklistCard(checklistItems(resolved, profile), { hasEvidence: profileExamIds.length > 0 }),
    ...peopleCard,
  ];
}

// Legacy price: the amount the page header already shows, named by what the record says it covers.
export function legacyCostCard(university, minPrice) {
  const base = { id: "cost", icon: "banknotes", link: link("tab-finance", "cost") };
  const finance = university?.finance || {};
  const amount = toFiniteNumber(minPrice);
  if (amount === null || amount < 0) return { ...base, answerKind: "text", headline: label("cost.legacy_unknown"), lines: [] };
  const tuitionOnly = finance.costs_breakdown_status === "official_tuition_and_fees_only";
  const published = toFiniteNumber(finance.total_cost_year_usd);
  const shown = formatPrice(amount, finance.currency || "USD");
  const aid = finance.financial_aid || {};
  // The aid line states the published policy; an award is always decided individually.
  const aidKey = aid.meets_full_demonstrated_need === true ? `full_need${aid.international_eligible === true ? "_international" : ""}`
    : aid.need_based && aid.merit_based ? "both" : aid.need_based ? "need" : aid.merit_based ? "merit" : "";
  const aside = aidKey ? [{ text: label(`cost.aid_${aidKey}`) }] : [];
  return { ...base, headline: tFormat(`university.ux2.cost.${amount === published ? "headline" : "headline_from"}`, { amount: shown }),
    lines: [label(tuitionOnly ? "cost.legacy_tuition_only" : "cost.legacy_total")], aside };
}

// Legacy requirements: the single undergraduate category's language test and first listed extra requirements.
export function legacyNeedsItems(university) {
  const categories = getUndergraduateCategories(university?.admission_categories);
  if (categories.length !== 1) return categories.length ? null : [];
  const category = categories[0];
  const items = [];
  const entries = (Array.isArray(category.language_requirements) ? category.language_requirements : [])
    .flatMap(entry => Object.entries(entry?.requirements || {}).map(([exam, value]) => `${withoutBracketedText(examName(exam))} ${value}`));
  if (entries.length) {
    items.push({ kind: "language", mark: "todo", text: tFormat(`university.ux2.needs.english_${category.language_requirements_mode === "any" && entries.length > 1 ? "any" : "all"}`, { exams: entries.join(", ") }) });
  }
  const extras = [...new Set(Array.isArray(category.extra_requirements) ? category.extra_requirements.filter(isString) : [])];
  for (const extra of extras.slice(0, Math.min(MAX_LEGACY_EXTRAS, MAX_CHECKLIST_ITEMS - items.length))) {
    items.push({ kind: "documents", mark: "todo", prose: true, text: trTrackDescription(university.id, category.id, extra) });
  }
  return items;
}

export function legacyCards({ university, minPrice, acceptanceRate, acceptanceMeta }) {
  const needs = legacyNeedsItems(university);
  const people = peopleItems(university, { acceptanceRate, acceptanceMeta });
  // Without collected dates the card points to the university's own site instead of an empty Dates tab.
  const collected = extractUniversityDeadlines(university, Array.isArray(university?.admission_categories) ? university.admission_categories : [])
    .some(item => item.deadline || item.guidance);
  const website = safeUrl(university?.website);
  const legacyDeadline = collected
    ? { id: "deadline", icon: "calendar", answerKind: "text", headline: label("deadline.legacy"), lines: [], link: link("tab-deadlines", "deadlines") }
    : { id: "deadline", icon: "calendar", answerKind: "text", headline: label("deadline.legacy_none"), lines: [label("deadline.legacy_none_detail")],
      external: website ? { url: website, label: label("link.official_site") } : null };
  const needsCard = needs === null
    ? { id: "needs", icon: "clipboard-document-list", answerKind: "text", headline: label("needs.varies"), lines: [], link: link("tab-admission", "needs") }
    : checklistCard(needs, { hasEvidence: true });
  return [legacyDeadline, legacyCostCard(university, minPrice), needsCard, ...(people.length ? [{ id: "people", icon: "users", items: people, headline: "" }] : [])];
}

function renderPeopleSources(items) {
  const entries = (items || []).map(entry => entry.source).filter(Boolean);
  if (!entries.length) return "";
  const summaryLabel = t(entries.length > 1 ? "university.ux2.sources.many" : "university.ux2.sources.one");
  const rows = entries.map(source => {
    const text = escapeHtml(source.label);
    const checked = source.checkedAt
      ? `${escapeHtml(t("university.admissions.checked", "Last checked"))}: ${escapeHtml(source.checkedAt)}`
      : escapeHtml(t("university.admissions.check_date_unrecorded", "Check date not recorded"));
    const link = source.url
      ? `<a class="overview-summary__source-link" href="${escapeHtmlAttr(source.url)}" target="_blank" rel="noopener noreferrer"><span>${text}</span>${heroIcon("arrow-up-right", "ui-icon ui-icon--12 overview-summary__source-ext")}</a>`
      : `<span class="overview-summary__source-text">${text}</span>`;
    return `<li class="overview-summary__source-row">${link}<span class="overview-summary__source-date">${checked}</span></li>`;
  });
  return `<details class="overview-summary__sources motion-disclosure">
    <summary class="overview-summary__sources-summary">
      ${heroIcon("document-check", "ui-icon ui-icon--16")}
      <span>${escapeHtml(summaryLabel)}</span>
      <span class="overview-summary__sources-count">${entries.length}</span>
      ${heroIcon("chevron-down", "ui-icon ui-icon--14 overview-summary__sources-chevron")}
    </summary>
    <ul class="overview-summary__sources-list">${rows.join("")}</ul>
  </details>`;
}

function renderItem(card, entry) {
  if (card.id === "needs") {
    const icon = MARK_ICONS[entry.mark] ? heroIcon(MARK_ICONS[entry.mark], "ui-icon ui-icon--16") : "";
    return `<li class="overview-summary__item" data-mark="${entry.mark}"><span class="overview-summary__mark" aria-hidden="true">${icon}</span>
      <span class="sr-only">${escapeHtml(label(`needs.mark_${entry.mark}`))}: </span><span class="overview-summary__item-text"${entry.prose ? " data-prose" : ""}>${escapeHtml(entry.text)}</span></li>`;
  }
  const details = (entry.details || []).map(text => `<span class="overview-summary__fact-detail">${escapeHtml(text)}</span>`).join("");
  return `<li class="overview-summary__fact"><span class="overview-summary__fact-headline">${escapeHtml(entry.text)}</span>${details}</li>`;
}

function renderCard(card) {
  const tone = card.tone ? ` data-tone="${escapeHtmlAttr(card.tone)}"` : "";
  const answerKind = card.answerKind || (card.id === "needs" && card.items?.length ? "hint" : "");
  const answer = card.headline ? `<p class="overview-summary__answer"${tone}${answerKind ? ` data-kind="${answerKind}"` : ""}>${escapeHtml(card.headline)}</p>` : "";
  const lines = (card.lines || []).map(text => `<p class="overview-summary__detail">${escapeHtml(text)}</p>`).join("");
  const aside = card.aside?.length
    ? `<div class="overview-summary__aside">${card.aside.map(entry => `<p class="overview-summary__detail"${entry.tone ? ` data-tone="${escapeHtmlAttr(entry.tone)}"` : ""}>${escapeHtml(entry.text)}</p>`).join("")}</div>`
    : "";
  const items = card.items?.length
    ? card.id === "people"
      ? `<ul class="overview-summary__facts-grid" data-count="${card.items.length}">${card.items.map(entry => renderItem(card, entry)).join("")}</ul>${renderPeopleSources(card.items)}`
      : `<ul class="overview-summary__list" data-count="${card.items.length}">${card.items.map(entry => renderItem(card, entry)).join("")}</ul>`
    : "";
  const levels = card.levels?.length ? `<div class="overview-summary__levels">${card.levels.map(level => `<button type="button" class="overview-summary__link" data-open-level="${escapeHtmlAttr(level)}">${escapeHtml(t(`university.admissions.catalog.level.${level}`))}${heroIcon("chevron-right", "ui-icon ui-icon--16")}</button>`).join("")}</div>` : "";
  const action = card.link ? `<button type="button" class="overview-summary__link" data-open-tab="${escapeHtmlAttr(card.link.tab)}">${escapeHtml(card.link.label)}${heroIcon("chevron-right", "ui-icon ui-icon--16")}</button>`
    : card.external ? `<a class="overview-summary__link" href="${escapeHtmlAttr(card.external.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(card.external.label)}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16")}</a>` : "";
  return `<section class="overview-summary__card" data-summary-card="${card.id}"${card.state ? ` data-state="${card.state}"` : ""}${card.items?.length ? ' data-has-list="true"' : ""}>
    <div class="overview-summary__head">
      <h3 class="overview-summary__label">${heroIcon(card.icon, "ui-icon ui-icon--18")}<span>${escapeHtml(label(`card.${card.id}`))}</span></h3>
      ${action}
    </div>
    ${answer}${lines}${items}${aside}${levels}</section>`;
}

// Short top cards (when to apply, what it costs) sit side by side; denser or standalone cards span the full row.
function renderCardGrid(cards) {
  const needsCard = cards.find(card => card.id === "needs");
  const compactRow = Boolean(needsCard && !(needsCard.items?.length) && cards.some(card => card.id === "deadline") && cards.some(card => card.id === "cost"));
  return `<div class="overview-summary__grid"${compactRow ? ' data-compact-row="true"' : ""}>${cards.map(renderCard).join("")}</div>`;
}

export function renderSummary(cards, intro = "") {
  return `<div class="overview-summary__body">
    <div class="overview-summary__heading"><div class="overview-summary__title" role="heading" aria-level="2">${escapeHtml(label("title"))}</div>${intro ? `<p class="overview-summary__intro">${escapeHtml(intro)}</p>` : ""}</div>
    ${renderCardGrid(cards)}
    <p class="overview-summary__note">${escapeHtml(label("note"))}</p></div>`;
}

const renderLoading = () => `<div class="overview-summary__body"><div class="overview-summary__heading"><div class="overview-summary__title" role="heading" aria-level="2">${escapeHtml(label("title"))}</div></div>
  <div class="overview-summary__state" role="status"><div class="center-loading-spinner"></div><span>${escapeHtml(label("loading"))}</span></div></div>`;
const renderError = () => `<div class="overview-summary__body"><div class="overview-summary__heading"><div class="overview-summary__title" role="heading" aria-level="2">${escapeHtml(label("title"))}</div></div>
  <div class="overview-summary__state" role="alert"><p>${escapeHtml(label("error"))}</p><button type="button" class="overview-summary__link" data-summary-retry>${escapeHtml(label("retry"))}</button></div></div>`;

// Opens a tab. With a shared first-year route and no program or route chosen on the page, the tab opens on that
// route, exactly as choosing it in the Admission tab would, so the dates and costs the card promised are there.
// The choice is not saved; an existing selection on the page is never replaced.
export function summaryTabUrl(href, tabId, routeId = "") {
  const next = new URL(href);
  const params = next.searchParams;
  const chosen = params.get("admission_option") || params.get("admission_application_route");
  if (routeId && tabId !== "tab-programs" && !chosen) {
    params.set("admission_option", "");
    params.set("admission_application_route", routeId);
    params.set("admission_level", "undergraduate");
  }
  next.hash = `#${tabId}`;
  return next;
}

function openTab(tabId, routeId = "") {
  const current = new URL(window.location.href);
  const next = summaryTabUrl(current.href, tabId, routeId);
  if (next.href === current.href) {
    document.querySelector(`[data-tab="${tabId}"]`)?.click();
    return;
  }
  const contextChanged = next.search !== current.search;
  window.history.pushState({}, "", next);
  // The admissions controller reads a changed context (and the tab) from the URL on popstate.
  if (contextChanged) window.dispatchEvent(new PopStateEvent("popstate"));
  else document.querySelector(`[data-tab="${tabId}"]`)?.click();
}

// The Programs tab's own level filter narrows the list, as if the reader had chosen the level there.
function openProgramsAtLevel(level) {
  const select = document.getElementById("admissionsStudyLevel");
  if (select && [...select.options].some(option => option.value === level)) {
    select.value = level;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  openTab("tab-programs");
}

// Mounts the summary into `container` and keeps it current. `legacy` carries the values the legacy page already computed.
// Returns { dispose }; every request is cancelled and every listener removed on dispose.
export function mountOverviewSummary({ container, university, universityId, reviewed, legacy = {} }) {
  if (!container) return { dispose() {} };
  let version = 0;
  let controller = null;
  let disposed = false;
  let routeLoaded = false;
  let route = null;
  // Without a shared path, the program the Admission tab reads (Imperial) gives the Overview its answers.
  let programContext = null;
  const hasContent = () => Boolean(container.querySelector(".overview-summary__grid"));

  const show = html => { if (!disposed) container.innerHTML = html; };
  const onClick = event => {
    const tab = event.target.closest?.("[data-open-tab]")?.dataset.openTab;
    const level = event.target.closest?.("[data-open-level]")?.dataset.openLevel;
    if (level) openProgramsAtLevel(level);
    else if (tab) openTab(tab, route?.id || "");
    else if (event.target.closest?.("[data-summary-retry]")) void loadReviewed();
  };
  container.addEventListener("click", onClick);

  const fetchJson = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}/universities/${encodeURIComponent(universityId)}/${path}`, options);
    if (!response.ok) throw new Error(`Overview summary HTTP ${response.status}`);
    return response.json();
  };

  function renderLegacy() {
    const minPrice = typeof legacy.getMinPrice === "function" ? legacy.getMinPrice() : legacy.minPrice;
    show(renderSummary(legacyCards({ university, minPrice, acceptanceRate: legacy.acceptanceRate, acceptanceMeta: legacy.acceptanceMeta }), label("intro_legacy")));
  }

  async function loadReviewed() {
    const current = ++version;
    controller?.abort();
    const request = controller = new AbortController();
    // A refresh keeps the answers already on screen; only the first load shows the loading state.
    if (!hasContent()) show(renderLoading());
    try {
      if (!routeLoaded) {
        const staticOptions = await loadStaticStudyOptions(universityId, { signal: request.signal }).catch((err) => {
          if (err?.name === "AbortError") throw err;
          return null;
        });
        const options = staticOptions
          || await fetchJson(`study-options?${new URLSearchParams({ limit: "1", lang: getCurrentLanguage() })}`, { signal: request.signal });
        if (current !== version) return;
        route = firstYearSharedRoute(options.shared_routes);
        routeLoaded = true;
      }
      const apiProfile = loadProfileForApi();
      let resolved = null;
      if (route || programContext) {
        const context = route
          ? { study_option_id: "", application_route_id: route.id, study_level: "undergraduate", intended_entry_cycle: "", fee_status_context: "unknown" }
          : { ...programContext };
        // As in the Admission tab and the comparison, a route publishing one entry cycle is read for it, so its minimums can be checked.
        ({ resolved } = await readForSinglePublishedCycle(next => fetchJson("admissions-context", { method: "POST", headers: { "Content-Type": "application/json" },
          signal: request.signal, body: JSON.stringify(admissionsRequest(apiProfile, next, universityId)) }), context));
        if (current !== version) return;
        if (!resolved?.selected_route) throw new Error("Overview summary route is not readable");
      }
      const cards = reviewedCards({ resolved, university, budgetUsd: apiProfile.budget, profileExamIds: (apiProfile.exams || []).map(exam => exam.id), profile: apiProfile });
      const intro = !resolved ? "" : route
        ? tFormat("university.ux2.intro_route", { route: admissionsRouteName(resolved.selected_route, { presentation: "simple", level: "undergraduate" }) })
        : tFormat("university.ux2.intro_selected_program", { program: admissionsProgramLabel(resolved.selected_option, { includeAward: true }).title });
      show(renderSummary(cards, intro));
    } catch (error) {
      if (request.signal.aborted || current !== version) return;
      console.error(error);
      show(renderError());
    }
  }

  const onProfileUpdated = () => { if (reviewed) void loadReviewed(); else renderLegacy(); };
  window.addEventListener("profileUpdated", onProfileUpdated);
  const onAdmissionContext = event => {
    if (!reviewed || route || event.detail?.institutionId !== universityId || !event.detail?.context?.application_route_id) return;
    const next = { ...event.detail.context };
    if (JSON.stringify(next) === JSON.stringify(programContext)) return;
    programContext = next;
    void loadReviewed();
  };
  window.addEventListener("unisearch:admission-context", onAdmissionContext);
  if (reviewed) void loadReviewed(); else renderLegacy();

  return {
    dispose() {
      disposed = true;
      version += 1;
      controller?.abort();
      container.removeEventListener("click", onClick);
      window.removeEventListener("profileUpdated", onProfileUpdated);
      window.removeEventListener("unisearch:admission-context", onAdmissionContext);
    },
  };
}
