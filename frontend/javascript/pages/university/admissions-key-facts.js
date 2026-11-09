import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { admissionDeadlineTitle, admissionsCycleLabel, admissionsRouteName } from "./admissions-render.js";
import { formatPublishedDate } from "./admissions-presentation.js";
import { getReviewedDeadlineEvents } from "./deadline-calendar.js";
import { isEvidenceReviewed, isPublishedReference, isReviewedPublished } from "./admissions-status.js";
import { translateAdmissionText } from "../../university-translations.js";
import { heroIcon } from "../../icons.js";
import { safeUrl } from "../_shared.js";
import { glossaryTerms, renderTermList, routeWording } from "./admissions-glossary.js";

const label = key => t(`university.admissions.key_facts.${key}`);
const locale = () => ({ eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" })[getCurrentLanguage()] || "en-US";
// Dates an applicant must act on; openings, decisions and replies are not deadlines to meet.
const ACTION_KINDS = new Set(["application", "funding", "funding_consideration", "test", "test_submission", "booking"]);
const DAY_MS = 86400000;
// Funding facts may state the university's need policy in one short field; only these named fields are shown as a policy.
const FUNDING_POLICY_FIELDS = ["international_need"];

function money(amount, currency) {
  return new Intl.NumberFormat(locale(), { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function moneyRange(min, max, currency) {
  return min === max ? money(min, currency) : `${money(min, currency)}–${money(max, currency)}`;
}

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
  return { text, tone, cycleRequired: assessment.reason === "entry_cycle_required",
    note: manual ? tFormat("university.admissions.key_facts.requirements_manual", { count: manual }) : "" };
}

export function deadlineFact(resolved, now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  // Dated references from an earlier cycle do not describe the next date to meet.
  const dated = getReviewedDeadlineEvents(resolved)
    .filter(event => ACTION_KINDS.has(event.kind) && event.publicationStatus !== "published_dated_reference")
    .map(event => ({ event, day: Date.parse(`${event.deadline}T00:00:00Z`) }))
    .filter(entry => Number.isFinite(entry.day))
    .sort((left, right) => left.day - right.day);
  const describe = entry => ({ title: admissionDeadlineTitle(entry.event), date: formatPublishedDate(entry.event.deadline) });
  // Terms come from the published round name and the application route, not from the translated title.
  const termsFor = (...names) => glossaryTerms(names, routeWording(resolved?.selected_route));
  const upcoming = dated.find(entry => entry.day >= today);
  if (upcoming) {
    const days = Math.round((upcoming.day - today) / DAY_MS);
    return { status: "upcoming", days, tone: days <= 30 ? "warning" : "", terms: termsFor(upcoming.event.name),
      text: days ? tFormat("university.admissions.key_facts.deadline_upcoming", { ...describe(upcoming), days })
        : tFormat("university.admissions.key_facts.deadline_today", describe(upcoming)) };
  }
  if (dated.length) return { status: "passed", tone: "danger", terms: termsFor(dated.at(-1).event.name), text: tFormat("university.admissions.key_facts.deadline_passed", describe(dated.at(-1))) };
  // Yearless or period-only publications stay as published: no year is inferred and no countdown is shown.
  const ids = new Set(resolved?.fact_groups?.deadlines || []);
  // A partly published window record still publishes its application period.
  const rows = (resolved?.facts || []).filter(row => ids.has(row.id) && row.applicability?.status !== "mismatched" && isEvidenceReviewed(row)
    && (isPublishedReference(row) || typeof row.value?.application_period === "string"));
  const windowName = name => ({ "Early Action": t("university.admissions.reading.early_action"), "Regular Action": t("university.admissions.reading.regular_action") })[name] || name;
  const windows = rows.flatMap(row => Array.isArray(row.value?.windows) ? row.value.windows : [])
    .filter(window => typeof window.name === "string" && typeof window.application_due === "string" && !/20\d{2}/.test(window.application_due));
  const yearless = windows.map(window => `${windowName(window.name)}: ${formatPublishedDate(window.application_due)}`);
  if (yearless.length) return { status: "yearless", tone: "", terms: termsFor(windows.map(window => window.name)),
    text: tFormat("university.admissions.key_facts.deadline_yearless", { dates: [...new Set(yearless)].join("; ") }) };
  const period = rows.map(row => row.value?.application_period).find(value => typeof value === "string" && value.trim());
  if (period) return { status: "period", tone: "", terms: termsFor(), text: tFormat("university.admissions.key_facts.deadline_period", { period: translateAdmissionText(period, period) }) };
  return ids.size ? { status: "described", tone: "", terms: termsFor(), text: label("deadline_described") } : { status: "none", tone: "", text: label("deadline_none") };
}

// The official fee-status page is the source of the reviewed fee-status fact, so it follows the catalog data.
function feeStatusSource(resolved) {
  const fact = (resolved?.facts || []).find(row => row.topic === "fee_status" && isReviewedPublished(row) && row.applicability?.status !== "mismatched");
  const source = (resolved?.sources || []).find(item => fact?.source_ids?.includes(item.id) && safeUrl(item.url));
  return source ? safeUrl(source.url) : "";
}

export function costFact(resolved, budgetUsd) {
  const costs = resolved?.selected_costs || {};
  const basis = costs.annual_total ? "annual_total" : costs.tuition ? "tuition" : "";
  if (!basis) return { status: "unknown", tone: "", text: label("cost_unknown"), notes: [] };
  const quote = costs[basis];
  const amount = moneyRange(quote.min, quote.max, quote.currency);
  const converted = quote.currency !== "USD" && quote.usd ? ` (≈ ${moneyRange(quote.usd.min, quote.usd.max, "USD")})` : "";
  const text = tFormat(`university.admissions.key_facts.${basis === "annual_total" ? "cost_total" : "cost_tuition"}`, { amount: `${amount}${converted}` });
  const notes = [quote.period ? tFormat("university.admissions.key_facts.cost_period", {
    // Only an explicit entry label names an intake; an academic-year price period stays as published.
    period: /\bentry\b/i.test(quote.period) ? admissionsCycleLabel(quote.period) || quote.period : quote.period }) : ""];
  // The explanation is general: the university, not the applicant's nationality or residence, sets the classification.
  const feeStatusDepends = quote.fee_status_match === "unknown" && quote.fee_statuses?.length > 1;
  if (feeStatusDepends) notes.push(label("cost_fee_status"), t("university.admissions.glossary.fee_status.text"));
  const feeStatusPage = feeStatusDepends ? feeStatusSource(resolved) : "";
  const links = feeStatusPage ? [{ url: feeStatusPage, label: label("cost_fee_status_source") }] : [];
  if (!quote.annual_comparable) return { status: "not_annual", tone: "", text, links, notes: [...notes, label("cost_not_annual")].filter(Boolean) };
  if (!quote.usd) return { status: "not_comparable", tone: "", text, links, notes: notes.filter(Boolean) };
  if (!(Number.isFinite(budgetUsd) && budgetUsd > 0)) return { status: "no_budget", tone: "", text, links, notes: [...notes, label("budget_missing")].filter(Boolean) };
  const budget = money(budgetUsd, "USD");
  const status = quote.usd.min > budgetUsd ? "over" : quote.usd.max > budgetUsd ? "partial"
    : basis === "tuition" ? "tuition_within" : "within";
  // The published amount stays neutral; only the comparison with the applicant's budget carries a status colour.
  const flag = { text: tFormat(`university.admissions.key_facts.budget_${status}`, { budget }),
    tone: { over: "danger", partial: "warning", tuition_within: "warning", within: "success" }[status] };
  return { status, tone: "", flag, text, links, notes: notes.filter(Boolean) };
}

// Reviewed funding records that apply to the selected route, never to another path of the university.
function fundingRows(resolved) {
  const ids = new Set(resolved?.fact_groups?.funding || []);
  return (resolved?.facts || []).filter(row => ids.has(row.id) && isReviewedPublished(row) && row.applicability?.status !== "mismatched");
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

export function fundingFact(resolved) {
  const rows = fundingRows(resolved);
  const terms = glossaryTerms(rows.map(row => typeof row.value === "string" ? row.value : row.value?.required));
  const policy = fundingPolicy(rows);
  // A separate support application is a different route of the same institution, not a second admission chance.
  const support = (resolved?.available_routes || []).find(route => route.classification === "financial_support_application"
    && route.id !== resolved.selected_route?.id);
  if (support) return { terms, notes: policy ? [tFormat("university.admissions.key_facts.funding_policy", { policy })] : [],
    text: tFormat("university.admissions.key_facts.funding_route", { route: admissionsRouteName(support, { presentation: "simple" }) }) };
  const count = (resolved?.fact_groups?.funding || []).length;
  if (policy && count) return { terms, text: tFormat("university.admissions.key_facts.funding_policy", { policy }),
    notes: [tFormat("university.admissions.key_facts.funding_policy_note", { count })] };
  return { terms, text: count ? tFormat("university.admissions.key_facts.funding_records", { count }) : label("funding_none") };
}

function row(key, fact, action = "") {
  const flag = fact.flag ? `<p class="admissions-key-facts__flag" data-tone="${fact.flag.tone}">${escapeHtml(fact.flag.text)}</p>` : "";
  const notes = flag + (fact.notes || (fact.note ? [fact.note] : [])).map(note => `<p class="admissions-reading__note">${escapeHtml(note)}</p>`).join("");
  const links = (fact.links || []).map(link => `<a class="admissions-key-facts__source" href="${escapeHtmlAttr(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16")}</a>`).join("");
  return `<div class="admissions-key-facts__row" data-key-fact="${key}"${fact.status ? ` data-key-fact-status="${escapeHtmlAttr(fact.status)}"` : ""}>
    <dt>${escapeHtml(label(key))}</dt>
    <dd><p class="admissions-key-facts__value"${fact.tone ? ` data-tone="${fact.tone}"` : ""}>${escapeHtml(fact.text)}</p>${notes}${links}${renderTermList(fact.terms || [])}${action}</dd></div>`;
}

export function renderAdmissionsKeyFacts(resolved, { budgetUsd, profileCycle = "", now = new Date() } = {}) {
  if (!resolved?.selected_route) return "";
  const requirements = requirementsFact(resolved);
  const cycleAction = `<button type="button" class="admissions-key-facts__link" data-key-facts-cycle="${profileCycle ? "apply" : "edit"}">${escapeHtml(profileCycle
    ? tFormat("university.admissions.key_facts.use_profile_cycle", { cycle: admissionsCycleLabel(profileCycle) }) : label("set_cycle"))}</button>`;
  const open = (tab, key) => `<button type="button" class="admissions-key-facts__link" data-open-tab="${tab}">${escapeHtml(label(key))}</button>`;
  return `<section class="admissions-key-facts" data-admissions-key-facts aria-labelledby="admissionsKeyFactsTitle">
    <h3 id="admissionsKeyFactsTitle">${escapeHtml(label("title"))}</h3>
    <dl class="admissions-key-facts__list">
      ${row("requirements", requirements, requirements.cycleRequired ? cycleAction : "")}
      ${row("deadline", deadlineFact(resolved, now), open("tab-deadlines", "open_deadlines"))}
      ${row("cost", costFact(resolved, budgetUsd), open("tab-finance", "open_finance"))}
      ${row("funding", fundingFact(resolved))}
    </dl>
    <p class="admissions-reading__note">${escapeHtml(label("note"))}</p>
  </section>`;
}
