import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { admissionDeadlineTitle, admissionsCycleLabel, admissionsRouteName } from "./admissions-render.js";
import { formatPublishedDate } from "./admissions-presentation.js";
import { getReviewedDeadlineEvents } from "./deadline-calendar.js";
import { isEvidenceReviewed, isPublishedReference } from "./admissions-status.js";
import { translateAdmissionText } from "../../university-translations.js";

const label = key => t(`university.admissions.key_facts.${key}`);
const locale = () => ({ eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" })[getCurrentLanguage()] || "en-US";
// Dates an applicant must act on; openings, decisions and replies are not deadlines to meet.
const ACTION_KINDS = new Set(["application", "funding", "funding_consideration", "test", "test_submission", "booking"]);
const DAY_MS = 86400000;

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
  const upcoming = dated.find(entry => entry.day >= today);
  if (upcoming) {
    const days = Math.round((upcoming.day - today) / DAY_MS);
    return { status: "upcoming", days, tone: days <= 30 ? "warning" : "",
      text: days ? tFormat("university.admissions.key_facts.deadline_upcoming", { ...describe(upcoming), days })
        : tFormat("university.admissions.key_facts.deadline_today", describe(upcoming)) };
  }
  if (dated.length) return { status: "passed", tone: "danger", text: tFormat("university.admissions.key_facts.deadline_passed", describe(dated.at(-1))) };
  // Yearless or period-only publications stay as published: no year is inferred and no countdown is shown.
  const ids = new Set(resolved?.fact_groups?.deadlines || []);
  // A partly published window record still publishes its application period.
  const rows = (resolved?.facts || []).filter(row => ids.has(row.id) && row.applicability?.status !== "mismatched" && isEvidenceReviewed(row)
    && (isPublishedReference(row) || typeof row.value?.application_period === "string"));
  const windowName = name => ({ "Early Action": t("university.admissions.reading.early_action"), "Regular Action": t("university.admissions.reading.regular_action") })[name] || name;
  const yearless = rows.flatMap(row => Array.isArray(row.value?.windows) ? row.value.windows : [])
    .filter(window => typeof window.name === "string" && typeof window.application_due === "string" && !/20\d{2}/.test(window.application_due))
    .map(window => `${windowName(window.name)}: ${formatPublishedDate(window.application_due)}`);
  if (yearless.length) return { status: "yearless", tone: "", text: tFormat("university.admissions.key_facts.deadline_yearless", { dates: [...new Set(yearless)].join("; ") }) };
  const period = rows.map(row => row.value?.application_period).find(value => typeof value === "string" && value.trim());
  if (period) return { status: "period", tone: "", text: tFormat("university.admissions.key_facts.deadline_period", { period: translateAdmissionText(period, period) }) };
  return ids.size ? { status: "described", tone: "", text: label("deadline_described") } : { status: "none", tone: "", text: label("deadline_none") };
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
  if (quote.fee_status_match === "unknown" && quote.fee_statuses?.length > 1) notes.push(label("cost_fee_status"));
  if (!quote.annual_comparable) return { status: "not_annual", tone: "", text, notes: [...notes, label("cost_not_annual")].filter(Boolean) };
  if (!quote.usd) return { status: "not_comparable", tone: "", text, notes: notes.filter(Boolean) };
  if (!(Number.isFinite(budgetUsd) && budgetUsd > 0)) return { status: "no_budget", tone: "", text, notes: [...notes, label("budget_missing")].filter(Boolean) };
  const budget = money(budgetUsd, "USD");
  const status = quote.usd.min > budgetUsd ? "over" : quote.usd.max > budgetUsd ? "partial"
    : basis === "tuition" ? "tuition_within" : "within";
  // The published amount stays neutral; only the comparison with the applicant's budget carries a status colour.
  const flag = { text: tFormat(`university.admissions.key_facts.budget_${status}`, { budget }),
    tone: { over: "danger", partial: "warning", tuition_within: "warning", within: "success" }[status] };
  return { status, tone: "", flag, text, notes: notes.filter(Boolean) };
}

export function fundingFact(resolved) {
  // A separate support application is a different route of the same institution, not a second admission chance.
  const support = (resolved?.available_routes || []).find(route => route.classification === "financial_support_application"
    && route.id !== resolved.selected_route?.id);
  if (support) return { text: tFormat("university.admissions.key_facts.funding_route", { route: admissionsRouteName(support, { presentation: "simple" }) }) };
  const count = (resolved?.fact_groups?.funding || []).length;
  return { text: count ? tFormat("university.admissions.key_facts.funding_records", { count }) : label("funding_none") };
}

function row(key, fact, action = "") {
  const flag = fact.flag ? `<p class="admissions-key-facts__flag" data-tone="${fact.flag.tone}">${escapeHtml(fact.flag.text)}</p>` : "";
  const notes = flag + (fact.notes || (fact.note ? [fact.note] : [])).map(note => `<p class="admissions-reading__note">${escapeHtml(note)}</p>`).join("");
  return `<div class="admissions-key-facts__row" data-key-fact="${key}"${fact.status ? ` data-key-fact-status="${escapeHtmlAttr(fact.status)}"` : ""}>
    <dt>${escapeHtml(label(key))}</dt>
    <dd><p class="admissions-key-facts__value"${fact.tone ? ` data-tone="${fact.tone}"` : ""}>${escapeHtml(fact.text)}</p>${notes}${action}</dd></div>`;
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
