import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { getCurrentLanguage, t } from "../../i18n.js";
import { safeUrl } from "../_shared.js";
import { routeUniversityDetail } from "../../routes.js";
import { admissionContextUrl } from "../university/admissions-controller.js";
import { admissionDeadlineTitle, admissionsCycleLabel, admissionsProgramLabel, admissionsRouteName, studyOptionEssentials } from "../university/admissions-render.js";
import { formatPublishedDate, publishedTuitionQuotes } from "../university/admissions-presentation.js";
import { getReviewedDeadlineEvents } from "../university/deadline-calendar.js";
import { compareUniversityName } from "./compare-helpers.js";

const label = key => t(`universities.compare.summary.${key}`);
const unknown = () => `<span class="admissions-context__note">${escapeHtml(label("unknown"))}</span>`;

function factsFor(resolved, domains) {
  if ((!resolved?.selected_option && resolved?.reading_scope !== "institution_route") || Object.values(resolved?.context_applicability || {}).includes("mismatched")) return [];
  const ids = new Set(domains.flatMap(domain => resolved.fact_groups?.[domain] || []));
  const routeIds = [resolved.selected_route?.id, ...(resolved.selected_route?.shared_policy_context_ids || [])];
  return (resolved.facts || []).filter(row => ids.has(row.id) && (row.publication_status === "published"
    || row.publication_status?.startsWith("published_") && !row.publication_status.includes("conflict") && Array.isArray(row.attributes?.catalog_costs?.quotes))
    && /verified|reviewed|rechecked|carried_forward_review/.test(row.review_status || "")
    && !/conflict|pending|partial|superseded|requires_confirmation/.test(row.review_status || "")
    && row.applicability?.status !== "mismatched" && (!row.scope?.option_ids?.length || row.scope.option_ids.includes(resolved.selected_option?.id))
    && (!row.scope?.route_ids?.length || row.scope.route_ids.some(id => routeIds.includes(id))));
}

function source(row, resolved) {
  const entry = resolved.sources?.find(item => row.source_ids?.includes(item.id) && safeUrl(item.url));
  return entry ? `<a href="${escapeHtmlAttr(safeUrl(entry.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label("source"))}</a>` : "";
}

function money(amount, currency) {
  return `${new Intl.NumberFormat({ eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" }[getCurrentLanguage()], { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
}

function detailLink(university, state, tab) {
  const url = admissionContextUrl(new URL(routeUniversityDetail(university.id), window.location.href), state?.context || {});
  url.hash = `tab-${tab}`;
  return `<a href="${escapeHtmlAttr(url.pathname + url.search + url.hash)}">${escapeHtml(label(tab))}</a>`;
}

function cells(university, state) {
  const resolved = state?.resolved;
  const option = resolved?.selected_option;
  const unavailable = state?.status !== "ready" || (!option && resolved?.reading_scope !== "institution_route") || Object.values(resolved?.context_applicability || {}).includes("mismatched");
  const title = option ? admissionsProgramLabel(option).title : "";
  const awards = (option?.awards || []).filter(award => award !== title).join(" · ");
  const program = unavailable ? unknown() : option ? `<strong>${escapeHtml(title)}</strong>${awards ? `<small>${escapeHtml(awards)}</small>` : ""}` : escapeHtml(t("universities.compare.institution_route"));
  const study = unavailable || !option ? [] : studyOptionEssentials(resolved).filter(([key]) => ["duration", "mode", "language"].includes(key)).map(([, value]) => value);
  const tuition = unavailable ? [] : factsFor(resolved, ["study", "costs"]).flatMap(row => {
    const quotes = publishedTuitionQuotes(row, option?.id);
    if (quotes.length) return quotes.map(quote => `<div>${quote.amounts.map(escapeHtml).join(" · ")}<small>${escapeHtml([quote.currency, quote.feeStatus, quote.period, quote.campus, quote.studyYears, quote.reference].filter(Boolean).join(" · "))} ${source(row, resolved)}</small></div>`);
    const value = row.attributes?.catalog_costs || row.value;
    if (!Number.isFinite(value?.tuition) || typeof value?.currency !== "string") return [];
    return [`<div>${escapeHtml(money(value.tuition, value.currency))}<small>${escapeHtml(value.academic_year || row.period?.label || "")} · ${escapeHtml(label("reference"))} ${source(row, resolved)}</small></div>`];
  });
  const budget = unavailable ? [] : factsFor(resolved, ["costs"]).flatMap(row => {
    const value = row.attributes?.catalog_costs || row.value;
    if (!Number.isFinite(value?.total_before_aid) || typeof value.currency !== "string") return [];
    return [`<div>${escapeHtml(money(value.total_before_aid, value.currency))}<small>${escapeHtml(value.academic_year || row.period?.label || "")} · ${escapeHtml(label("before_aid"))} ${source(row, resolved)}</small></div>`];
  });
  const upcoming = unavailable ? [] : getReviewedDeadlineEvents(resolved).filter(event => event.kind === "application");
  const next = upcoming.find(event => event.deadline >= new Date().toISOString().slice(0, 10)) || upcoming[0];
  let date = next ? `<strong>${escapeHtml(formatPublishedDate(next.deadline))}</strong><small>${escapeHtml([admissionDeadlineTitle(next), next.time, next.timezone, admissionsCycleLabel(next.cycle)].filter(Boolean).join(" · "))}</small>${safeUrl(next.sourceUrl) ? `<a href="${escapeHtmlAttr(safeUrl(next.sourceUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label("source"))}</a>` : ""}` : "";
  if (!date && !unavailable) {
    const windows = factsFor(resolved, ["deadlines"]).flatMap(row => (row.value?.windows || []).filter(window => typeof window.application_due === "string"));
    if (windows.length) date = `${windows.map(window => `${escapeHtml(window.name)}: ${escapeHtml(formatPublishedDate(window.application_due))}`).join("<br>")}<small>${escapeHtml(label("year_not_stated"))}</small>`;
  }
  const funders = unavailable ? [] : [...new Map(factsFor(resolved, ["funding"]).filter(row => typeof row.value?.funding_program === "string")
    .map(row => [JSON.stringify([row.value.funding_program, row.value.availability]), row])).values()]
    .map(row => `<div>${escapeHtml(row.value.funding_program)}<small>${escapeHtml(t(`university.admissions.reading.${row.value.availability === "excluded_by_published_course_rules" ? "funding_excluded" : row.value.availability === "not_established" ? "funding_unconfirmed" : "potential_aid"}`))}</small></div>`);
  return {
    program, study: study.length ? escapeHtml(study.join(" · ")) : unknown(),
    route: unavailable || !resolved.selected_route ? unknown() : escapeHtml(admissionsRouteName({ ...resolved.selected_route, title: "", target: "" }, { presentation: "simple" })),
    cycle: state?.context?.intended_entry_cycle ? escapeHtml(admissionsCycleLabel(state.context.intended_entry_cycle)) : unknown(),
    tuition: tuition.length ? tuition.join("") : unknown(), budget: budget.length ? budget.join("") : unknown(),
    deadline: `${date || unknown()}${detailLink(university, state, "deadlines")}`,
    funding: `${funders.length ? funders.join("") : `<small>${escapeHtml(label("potential_aid"))}</small>`}${detailLink(university, state, "finance")}`,
    admission: detailLink(university, state, "admission"),
  };
}

export function renderReviewedComparison(universities, contexts) {
  const values = universities.map(university => cells(university, contexts.get(university.id)));
  return `<section class="compare-analysis-block compare-summary" data-reviewed-comparison><div class="compare-block-head"><h2>${escapeHtml(label("title"))}</h2></div>
    <p>${escapeHtml(label("scope_note"))}</p><p class="compare-table-scroll-hint">${escapeHtml(t("universities.compare.table_scroll_hint"))}</p>
    <div class="compare-table-wrap compare-table-wrap--pair"><table class="compare-table"><thead><tr><th>${escapeHtml(t("universities.compare.row.metric"))}</th>${universities.map(university => `<th scope="col">${escapeHtml(compareUniversityName(university))}</th>`).join("")}</tr></thead>
    <tbody>${["program", "study", "route", "cycle", "tuition", "budget", "deadline", "funding", "admission"].map(key => `<tr><th scope="row">${escapeHtml(label(key))}</th>${values.map(value => `<td class="compare-cell"><div class="compare-summary-value">${value[key]}</div></td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
}
