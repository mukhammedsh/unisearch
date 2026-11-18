// Comparison of two universities whose admissions data has been rechecked (the reviewed model).
// Pairs of earlier-format universities keep the comparison in compare.js; the two kinds are never mixed in one pair,
// so this module can stay when the earlier format is removed.
//
// Each column reads one admission context. Without a chosen program it reads the university's shared first-year
// route, the same answers the university Overview gives; a university that admits per program says so until a
// program is chosen in the picker. A choice made here is the same saved choice the university page uses.
// Layout follows the familiar product-comparison pattern: identity heads, topic sections, a label per row and one
// value per university, with a compact sticky strip of names while the heads are out of view.
import { API_BASE, bindImageFallbacks, debounce, loadProfile, loadProfileForApi, markMotionEnter, saveSelectedAdmissionChoice } from "../../utils.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { t, tFormat } from "../../i18n.js";
import { heroIcon } from "../../icons.js";
import { navigateToAppRoute, routeCompareSelection, routeUniversityDetail } from "../../routes.js";
import { formatUiNumber, safeUrl, shouldOpenUniversitiesInNewTab, toFiniteNumber, trFactSource } from "../_shared.js";
import { compareCampusHtml, compareLocationText, compareRankText, compareUniversityName, fetchCompareAdmissionContext, fetchCompareStudyOptions, soleCompatibleRoute } from "./compare-helpers.js";
import { admissionContextUrl, programProfileSuggestions, readAdmissionContext } from "../university/admissions-controller.js";
import { admissionsProgramLabel, admissionsRouteName, studyOptionEssentials } from "../university/admissions-render.js";
import { costFact, deadlineFact, fundingFact, requirementsFact } from "../university/admissions-key-facts.js";
import { isEvidenceReviewed, isPublished } from "../university/admissions-status.js";
import { billingPeriodLabel } from "../university/admissions-presentation.js";
import { translateAdmissionText } from "../../university-translations.js";
import { checklistItems, costCard, deadlineCard, firstYearSharedRoute, peopleItems } from "../university/overview-summary.js";

const label = (key) => t(`universities.compare.reviewed.${key}`);
const catalogLabel = (key) => t(`university.admissions.catalog.${key}`);
const MARK_ICONS = { met: "check-circle", below: "exclamation-triangle" };
const PICKER_LEVELS = ["preparation", "undergraduate", "masters", "doctoral", "professional"];

const isMismatched = (resolved) => Object.values(resolved?.context_applicability || {}).includes("mismatched");
const hasSelection = (context) => Boolean(context?.study_option_id || context?.application_route_id);

// The context a column reads: the applicant's own choice, otherwise the shared first-year route when there is one.
function readableContext(column) {
  if (hasSelection(column.context)) return column.context;
  if (!column.sharedRoute) return null;
  return { ...column.context, study_option_id: "", application_route_id: column.sharedRoute.id, study_level: "undergraduate" };
}

// What the column shows: a program, the shared first-year route, a program that still needs a route, or a prompt.
export function columnScope(column) {
  if (column.status !== "ready") return column.status;
  const resolved = column.resolved;
  if (!resolved) return "choose";
  if (isMismatched(resolved)) return "mismatch";
  if (resolved.selected_option) return resolved.selected_route ? "program" : resolved.available_routes?.length ? "route" : "no_route";
  if (resolved.reading_scope === "institution_route" && resolved.selected_route) return "institution";
  return "choose";
}

const readsFacts = (column) => ["program", "institution"].includes(columnScope(column));

function routeLabel(route) {
  return admissionsRouteName({ ...route, title: "", target: "" }, { presentation: "simple" });
}

// A link into the university page that opens the same context and tab the column was read from.
function detailHref(column, hash = "") {
  const context = readableContext(column);
  const base = new URL(routeUniversityDetail(column.id), window.location.href);
  const url = context ? admissionContextUrl(base, context) : base;
  url.hash = hash;
  return url.pathname + url.search + url.hash;
}

const linkAttrs = () => (shouldOpenUniversitiesInNewTab() ? ' target="_blank" rel="noopener noreferrer"' : "");

// One value cell. `main` is the answer, `details` are muted lines, `items` a checklist and `sources` official links.
function cellHtml(column, value) {
  const id = escapeHtmlAttr(column.id);
  if (!value) return `<dd class="compare-reviewed__cell" data-uni-id="${id}" data-empty><p class="compare-reviewed__muted">${escapeHtml(label("value.not_published"))}</p></dd>`;
  if (value.state) {
    return `<dd class="compare-reviewed__cell" data-uni-id="${id}" data-state="${escapeHtmlAttr(value.state)}"><p class="compare-reviewed__muted">${escapeHtml(value.text)}</p></dd>`;
  }
  const tone = value.tone ? ` data-tone="${escapeHtmlAttr(value.tone)}"` : "";
  const main = value.main ? `<p class="compare-reviewed__value"${tone}${value.kind ? ` data-kind="${escapeHtmlAttr(value.kind)}"` : ""}>${escapeHtml(value.main)}</p>` : "";
  const details = (value.details || []).filter((entry) => entry && (entry.text || typeof entry === "string")).map((entry) => {
    const text = typeof entry === "string" ? entry : entry.text;
    const detailTone = typeof entry === "string" || !entry.tone ? "" : ` data-tone="${escapeHtmlAttr(entry.tone)}"`;
    return `<p class="compare-reviewed__detail"${detailTone}>${escapeHtml(text)}</p>`;
  }).join("");
  const items = value.items?.length ? `<ul class="compare-reviewed__checklist">${value.items.map((entry) => {
    const icon = MARK_ICONS[entry.mark] ? heroIcon(MARK_ICONS[entry.mark], "ui-icon ui-icon--16") : "";
    return `<li data-mark="${escapeHtmlAttr(entry.mark)}"><span class="compare-reviewed__mark" aria-hidden="true">${icon}</span><span class="sr-only">${escapeHtml(t(`university.ux2.needs.mark_${entry.mark}`))}: </span><span${entry.prose ? " data-prose" : ""}>${escapeHtml(entry.text)}</span></li>`;
  }).join("")}</ul>` : "";
  const sources = (value.sources || []).filter(Boolean).map((source) => {
    const href = safeUrl(source.url);
    const text = escapeHtml(source.label);
    return `<span class="compare-reviewed__source">${source.unnamed ? "" : `${escapeHtml(t("university.ux2.source"))} `}${href ? `<a href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer">${text}</a>` : text}</span>`;
  }).join("");
  const extra = value.extra || "";
  const link = value.link ? `<a class="compare-reviewed__link" href="${escapeHtmlAttr(value.link.href)}"${value.link.external ? ' target="_blank" rel="noopener noreferrer"' : linkAttrs()}>${escapeHtml(value.link.label)}${heroIcon(value.link.external ? "arrow-top-right-on-square" : "chevron-right", "ui-icon ui-icon--16")}</a>` : "";
  return `<dd class="compare-reviewed__cell" data-uni-id="${id}">${main}${details}${items}${extra}${sources}${link}</dd>`;
}

// The placeholder a fact cell shows when the column does not read a context with facts.
function scopePlaceholder(column) {
  const scope = columnScope(column);
  if (scope === "loading") return { state: "loading", text: label("value.loading") };
  if (scope === "error") return { state: "error", text: label("value.error") };
  if (scope === "route") return { state: "route", text: label("value.choose_route") };
  if (scope === "no_route") return { state: "no_route", text: label("value.no_route") };
  if (scope === "mismatch") return { state: "mismatch", text: label("value.mismatch") };
  return { state: "choose", text: label("value.depends") };
}

function cardValue(card, column, hash) {
  return {
    main: card.headline,
    kind: card.answerKind,
    tone: card.tone,
    details: [...(card.lines || []), ...(card.aside || [])],
    items: card.items,
    link: card.link ? { href: detailHref(column, hash), label: card.link.label } : null,
  };
}

// Rows of one section: every row has a label and one value per column. A row whose values are all missing is left out.
function rowsHtml(columns, rows) {
  return rows.map((row) => {
    const values = columns.map(row.value);
    if (!row.keepEmpty && values.every((value) => !value)) return "";
    return `<div class="compare-reviewed__row" data-compare-row="${escapeHtmlAttr(row.id)}">
      <dt class="compare-reviewed__row-label">${escapeHtml(label(`row.${row.id}`))}</dt>
      ${columns.map((column, index) => cellHtml(column, values[index])).join("")}
    </div>`;
  }).join("");
}

function sectionHtml(id, columns, rows, note = "") {
  const body = rowsHtml(columns, rows);
  if (!body.trim()) return "";
  return `<section class="compare-reviewed__section" data-compare-section="${escapeHtmlAttr(id)}" aria-labelledby="compareSection-${escapeHtmlAttr(id)}">
    <h2 class="compare-reviewed__section-title" id="compareSection-${escapeHtmlAttr(id)}">${escapeHtml(label(`section.${id}`))}</h2>
    <dl class="compare-reviewed__rows">${body}</dl>
    ${note}
  </section>`;
}

function programRows() {
  return [
    {
      id: "study",
      keepEmpty: true,
      value: (column) => {
        const scope = columnScope(column);
        if (!["program", "route", "no_route"].includes(scope)) return { state: "none", text: label("value.no_program") };
        const essentials = studyOptionEssentials(column.resolved).filter(([key]) => ["duration", "mode", "language", "location"].includes(key)).map(([, value]) => value);
        const [main, ...details] = essentials;
        return main ? { main, kind: "text", details } : null;
      },
    },
    {
      id: "route",
      keepEmpty: true,
      value: (column) => {
        const scope = columnScope(column);
        if (scope === "route") return { state: "route", text: label("value.choose_route") };
        if (scope === "no_route") return { state: "no_route", text: label("value.no_route") };
        if (scope !== "program") return { state: "none", text: label("value.no_program") };
        return { main: routeLabel(column.resolved.selected_route), kind: "text" };
      },
    },
  ];
}

function admissionRows(columns, profileExamIds) {
  const showRequirements = columns.some((column) => readsFacts(column) && Number.isFinite(column.resolved?.assessment?.chancePercent));
  return [
    {
      id: "deadline",
      keepEmpty: true,
      value: (column) => (readsFacts(column) ? cardValue(deadlineCard(deadlineFact(column.resolved, new Date(), { profileExamIds })), column, "tab-deadlines") : scopePlaceholder(column)),
    },
    {
      id: "needs",
      keepEmpty: true,
      value: (column) => {
        if (!readsFacts(column)) return scopePlaceholder(column);
        const items = checklistItems(column.resolved);
        const link = { href: detailHref(column, "tab-admission"), label: t("university.ux2.link.needs") };
        return items.length ? { items, link } : { main: t("university.ux2.needs.empty"), kind: "text", link };
      },
    },
    ...(showRequirements ? [{
      id: "requirements",
      value: (column) => {
        if (!readsFacts(column)) return scopePlaceholder(column);
        const fact = requirementsFact(column.resolved);
        return { main: fact.text, kind: "text", tone: fact.tone, details: fact.notes };
      },
    }] : []),
  ];
}

// Named funding programs published for the selected program and route, each with what the source says about it
// (a published exclusion, an unconfirmed fit or a possible award). A possible award is never shown as a promise.
const FUNDING_AVAILABILITY = {
  excluded_by_published_course_rules: "funding_excluded",
  not_established: "funding_unconfirmed",
};

function fundingPrograms(resolved) {
  const ids = new Set(resolved?.fact_groups?.funding || []);
  const optionId = resolved?.selected_option?.id;
  const routeIds = [resolved?.selected_route?.id, ...(resolved?.selected_route?.shared_policy_context_ids || [])];
  const rows = (resolved?.facts || []).filter((row) => ids.has(row.id) && isPublished(row) && isEvidenceReviewed(row)
    && row.applicability?.status !== "mismatched" && typeof row.value?.funding_program === "string"
    && (!row.scope?.option_ids?.length || row.scope.option_ids.includes(optionId))
    && (!row.scope?.route_ids?.length || row.scope.route_ids.some((id) => routeIds.includes(id))));
  const unique = new Map(rows.map((row) => [JSON.stringify([row.value.funding_program, row.value.availability]), row]));
  return [...unique.values()].map((row) => {
    const name = row.value.funding_program === "Need-based Aid"
      ? t("university.admissions.reading.aid_title") : translateAdmissionText(row.value.funding_program, row.value.funding_program);
    // A possible award is named alone; the policy note above already says that nothing is awarded or deducted.
    const status = FUNDING_AVAILABILITY[row.value.availability];
    return status ? `${name}: ${t(`university.admissions.reading.${status}`)}` : name;
  });
}

const FEE_STATUSES = [
  ["unknown", "fee.both"],
  ["self_reported_home_domestic", "fee.home"],
  ["self_reported_international_overseas", "fee.overseas"],
];

// Where a price differs by the fee status a university assigns (Home or Overseas), the reader picks which price to see.
function feeStatusControl(column) {
  const costs = column.resolved?.selected_costs || {};
  const quote = costs.annual_total || costs.tuition;
  const current = column.context.fee_status_context || "unknown";
  // Only a Home/Overseas split maps onto these choices; other published categories stay in the price range and its note.
  const homeOverseas = ["home", "overseas"].every(kind => (quote?.fee_statuses || []).some(status => new RegExp(kind, "i").test(status)));
  if (!homeOverseas && current === "unknown") return "";
  return `<div class="compare-reviewed__fee" role="group" aria-label="${escapeHtmlAttr(label("fee.label"))}">
    <span class="compare-reviewed__fee-label">${escapeHtml(label("fee.label"))}</span>
    ${FEE_STATUSES.map(([value, key]) => `<button type="button" class="compare-reviewed__fee-option" data-compare-fee="${escapeHtmlAttr(value)}" data-uni-id="${escapeHtmlAttr(column.id)}" aria-pressed="${current === value ? "true" : "false"}">${escapeHtml(label(key))}</button>`).join("")}
  </div>`;
}

function costRows(budgetUsd) {
  const budgetMissing = t("university.admissions.key_facts.budget_missing");
  return [
    {
      id: "cost",
      keepEmpty: true,
      value: (column) => {
        if (!readsFacts(column)) return scopePlaceholder(column);
        const fact = costFact(column.resolved, budgetUsd);
        const value = cardValue(costCard(fact), column, "tab-finance");
        // A price for the whole program or per credit names its period in the reader's language instead of a yearly figure.
        const costs = column.resolved?.selected_costs || {};
        const billing = (costs.annual_total || costs.tuition)?.billing_period;
        if (fact.status === "not_annual" && billingPeriodLabel(billing)) {
          value.main = `${fact.amount} ${billingPeriodLabel(billing)}`;
          value.kind = "";
          value.details = [t("university.ux2.cost.before_aid"), ...(fact.basis === "tuition" ? [t("university.ux2.cost.living_extra")] : [])];
        }
        // The missing-budget hint is said once under the section, not in every column.
        value.details = value.details.filter((entry) => (typeof entry === "string" ? entry : entry.text) !== budgetMissing);
        // Where the price depends on a fee status the university assigns, say so and link its own explanation.
        if (fact.links?.length) {
          value.details.push(label("fee.note"));
          value.sources = fact.links.map((entry) => ({ url: entry.url, label: entry.label, unnamed: true }));
        }
        value.extra = feeStatusControl(column);
        return value;
      },
    },
    {
      id: "funding",
      keepEmpty: true,
      value: (column) => {
        if (!readsFacts(column)) return scopePlaceholder(column);
        const fact = fundingFact(column.resolved);
        const programs = fundingPrograms(column.resolved);
        // Published policies are often a full sentence, so they read as body text rather than as a headline figure.
        return { main: fact.text, kind: fact.text.length > 90 ? "prose" : "text", details: [...(fact.notes || []), ...programs] };
      },
    },
  ];
}

const rankSource = (university) => {
  const meta = university?.rank_meta || {};
  const name = typeof meta.source === "string" && meta.source.trim() ? trFactSource(meta.source) : "";
  return name || safeUrl(meta.source_url) ? { label: name || t("university.admissions.official_source"), url: meta.source_url, unnamed: !name } : null;
};

function peopleValue(university, kinds) {
  const item = peopleItems(university).find((entry) => kinds.includes(entry.kind));
  return item ? { main: item.text, kind: "text", details: item.details || [], sources: [item.source] } : null;
}

function studentsValue(university) {
  const enrollment = university?.enrollment_breakdown || {};
  const total = toFiniteNumber(enrollment.total_headcount);
  if (total === null || total <= 0) return null;
  const undergraduate = toFiniteNumber(enrollment.undergraduate_count);
  const graduate = toFiniteNumber(enrollment.graduate_count);
  const href = safeUrl(enrollment.source_url);
  const sourceName = [typeof enrollment.source === "string" ? trFactSource(enrollment.source) : "", enrollment.census_year || ""].filter(Boolean).join(" · ");
  return {
    main: tFormat("universities.compare.reviewed.students", { total: formatUiNumber(total) }),
    kind: "text",
    details: undergraduate !== null && graduate !== null
      ? [tFormat("universities.compare.reviewed.students_detail", { undergraduate: formatUiNumber(undergraduate), graduate: formatUiNumber(graduate) })] : [],
    sources: sourceName || href ? [{ label: sourceName || t("university.admissions.official_source"), url: href, unnamed: !sourceName }] : [],
  };
}

function universityRows() {
  return [
    {
      id: "rank",
      value: (column) => {
        const text = compareRankText(column.university);
        return text === t("common.na", "N/A") ? null : { main: text, details: [], sources: [rankSource(column.university)] };
      },
    },
    { id: "selectivity", value: (column) => peopleValue(column.university, ["selectivity", "acceptance"]) },
    { id: "students", value: (column) => studentsValue(column.university) },
    { id: "international", value: (column) => peopleValue(column.university, ["international"]) },
    { id: "housing", value: (column) => peopleValue(column.university, ["housing"]) },
  ];
}

function scopeText(column) {
  const scope = columnScope(column);
  const resolved = column.resolved;
  if (scope === "program" || scope === "route" || scope === "no_route") {
    const option = resolved.selected_option;
    const program = admissionsProgramLabel(option);
    const meta = [
      ...(option.levels || []).map((level) => catalogLabel(`level.${level}`)),
      ...(option.awards || []).filter((award) => !program.title.includes(award)),
    ];
    return { title: program.title, meta: scope === "route" ? [...meta, label("scope.route_meta")].join(" · ") : meta.join(" · ") };
  }
  if (scope === "institution") return { title: label("scope.institution"), meta: label("scope.institution_meta") };
  if (scope === "mismatch") return { title: label("scope.mismatch"), meta: label("scope.mismatch_meta") };
  if (scope === "loading") return { title: label("value.loading"), meta: "" };
  if (scope === "error") return { title: label("value.error"), meta: "" };
  return { title: label("scope.choose"), meta: label("scope.choose_meta") };
}

function headHtml(column, index, photos) {
  const name = compareUniversityName(column.university);
  const scope = columnScope(column);
  const text = scopeText(column);
  const action = scope === "error"
    ? `<button type="button" class="compare-reviewed__button" data-compare-retry="${escapeHtmlAttr(column.id)}">${heroIcon("arrow-path", "ui-icon ui-icon--16")}<span>${escapeHtml(label("retry"))}</span></button>`
    : `<button type="button" class="compare-reviewed__button${["choose", "route", "mismatch"].includes(scope) ? " compare-reviewed__button--primary" : ""}" data-compare-pick="${escapeHtmlAttr(column.id)}"${scope === "loading" ? " disabled" : ""}>${heroIcon(column.context.study_option_id ? "pencil-square" : "academic-cap", "ui-icon ui-icon--16")}<span>${escapeHtml(label(scope === "route" ? "action.choose_route" : column.context.study_option_id ? "action.change" : "action.choose"))}</span></button>`;
  return `<article class="compare-reviewed__head" data-uni-id="${escapeHtmlAttr(column.id)}" data-compare-slot="${index + 1}" data-scope="${escapeHtmlAttr(scope)}">
    ${compareCampusHtml(column.id, photos)}
    <a class="compare-reviewed__identity" href="${escapeHtmlAttr(detailHref(column))}"${linkAttrs()}>
      <span class="compare-reviewed__identity-text"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(compareLocationText(column.university))}</small></span>
    </a>
    <div class="compare-reviewed__scope" aria-live="polite">
      <span class="compare-reviewed__scope-label">${escapeHtml(label("scope.label"))}</span>
      <p class="compare-reviewed__scope-title">${escapeHtml(text.title)}</p>
      ${text.meta ? `<p class="compare-reviewed__scope-meta">${escapeHtml(text.meta)}</p>` : ""}
      ${loadProfile()?.admissionChoiceResetNotices?.includes(column.id) && !hasSelection(column.context)
        ? `<p class="compare-reviewed__scope-meta" role="status" data-admission-reset-notice="${escapeHtmlAttr(column.id)}">${escapeHtml(catalogLabel("reset_notice"))}</p>` : ""}
    </div>
    ${action}
  </article>`;
}

function stripHtml(columns) {
  return `<div class="compare-reviewed__strip-anchor"><div class="compare-reviewed__strip" data-compare-strip aria-hidden="true">
    ${columns.map((column) => `<span class="compare-reviewed__strip-item"><span class="compare-reviewed__strip-name">${escapeHtml(compareUniversityName(column.university))}</span></span>`).join("")}
  </div></div>`;
}

export function renderReviewedComparisonPage(columns, { budgetUsd, profileExamIds = [], photos } = {}) {
  const hasProgram = columns.some((column) => ["program", "route", "no_route"].includes(columnScope(column)));
  const readable = columns.some((column) => readsFacts(column));
  const profileNote = (text) => `<p class="compare-reviewed__section-note">${escapeHtml(text)} <a href="/profile.html" data-route="profile">${escapeHtml(label("open_profile"))}</a></p>`;
  const needsHint = readable && !profileExamIds.length ? profileNote(t("university.ux2.needs.profile_hint")) : "";
  const budgetHint = readable && !(Number.isFinite(budgetUsd) && budgetUsd > 0) ? profileNote(label("budget_hint")) : "";
  return `<div class="compare-reviewed" data-reviewed-comparison>
    <header class="compare-reviewed__header">
      <div class="compare-reviewed__heading">
        <p class="compare-results-kicker">${escapeHtml(t("universities.compare.results.kicker"))}</p>
        <h1 class="compare-reviewed__title">${escapeHtml(t("universities.compare.results.title"))}</h1>
        <p class="compare-reviewed__intro">${escapeHtml(label("intro"))}</p>
        <p class="compare-reviewed__hint">${escapeHtml(label("heads_note"))}</p>
      </div>
      <button class="compare-reviewed__button compare-reviewed__button--quiet" type="button" data-action="back-to-catalog">${heroIcon("arrow-left", "ui-icon ui-icon--16")}<span>${escapeHtml(t("universities.compare.back_to_catalog"))}</span></button>
    </header>
    <div class="compare-reviewed__heads" data-compare-heads>
      ${columns.map((column, index) => headHtml(column, index, photos)).join("")}
    </div>
    ${stripHtml(columns)}
    ${hasProgram ? sectionHtml("program", columns, programRows()) : ""}
    ${sectionHtml("admission", columns, admissionRows(columns, profileExamIds), needsHint)}
    ${sectionHtml("cost", columns, costRows(budgetUsd), budgetHint)}
    ${sectionHtml("university", columns, universityRows())}
    <p class="compare-reviewed__note">${escapeHtml(label("note"))}</p>
  </div>`;
}

function loadingHtml() {
  return `<div class="compare-reviewed" data-reviewed-comparison aria-busy="true">
    <div class="compare-reviewed__state" role="status"><div class="center-loading-spinner"></div><span>${escapeHtml(label("value.loading"))}</span></div>
  </div>`;
}

// Program picker: a modal dialog with search, study-level filters and the program list; a program with several
// application routes asks for the route in the same dialog before the column changes.
function openPicker({ column, trigger, onApply }) {
  const dialog = document.createElement("dialog");
  dialog.className = "compare-picker";
  dialog.setAttribute("closedby", "any");
  dialog.setAttribute("aria-labelledby", "comparePickerTitle");
  const suggestions = programProfileSuggestions(loadProfileForApi());
  const offeredLevels = new Set(column.university?.admissions_catalog?.study_levels || []);
  const levels = PICKER_LEVELS.filter((level) => offeredLevels.has(level));
  const picker = {
    search: "",
    level: levels.includes(suggestions.level) ? suggestions.level : "",
    page: 1,
    items: [],
    total: 0,
    status: "loading",
    step: "programs",
    pending: null,
    pendingContext: null,
    request: null,
  };
  if (columnScope(column) === "route") {
    picker.step = "routes";
    picker.pending = column.resolved;
    picker.pendingContext = column.context;
  }
  const currentOption = column.resolved?.selected_option?.id || column.context.study_option_id || "";
  const usingShared = !hasSelection(column.context) || (!column.context.study_option_id && column.context.application_route_id === column.sharedRoute?.id);

  const optionHtml = (option) => {
    const program = admissionsProgramLabel(option);
    const selected = option.id === currentOption;
    const meta = [...(option.levels || []).map((level) => catalogLabel(`level.${level}`)), ...(option.awards || [])].join(" · ");
    return `<li><button type="button" class="compare-picker__option" data-picker-option="${escapeHtmlAttr(option.id)}"${selected ? ' aria-current="true"' : ""}>
      <span class="compare-picker__option-text"><strong>${escapeHtml(program.title)}</strong>${program.title !== program.officialTitle ? `<small lang="en">${escapeHtml(program.officialTitle)}</small>` : ""}${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</span>
      ${selected ? heroIcon("check", "ui-icon ui-icon--16") : ""}
    </button></li>`;
  };

  const listHtml = () => {
    if (picker.status === "error") return `<div class="compare-picker__state" role="alert"><p>${escapeHtml(catalogLabel("load_error"))}</p><button type="button" class="compare-reviewed__button" data-picker-retry>${escapeHtml(catalogLabel("retry"))}</button></div>`;
    if (picker.status === "loading" && !picker.items.length) return `<div class="compare-picker__state" role="status"><div class="center-loading-spinner"></div><span>${escapeHtml(catalogLabel("loading"))}</span></div>`;
    if (!picker.items.length) return `<p class="compare-picker__state">${escapeHtml(catalogLabel("no_options"))}</p>`;
    const more = picker.items.length < picker.total
      ? `<button type="button" class="compare-reviewed__button compare-picker__more" data-picker-more${picker.status === "loading" ? " disabled" : ""}>${escapeHtml(label("picker.more"))}</button>` : "";
    return `<ul class="compare-picker__list">${picker.items.map(optionHtml).join("")}</ul>${more}`;
  };

  const programsHtml = () => `
    ${column.sharedRoute ? `<button type="button" class="compare-picker__option compare-picker__option--shared" data-picker-shared${usingShared ? ' aria-current="true"' : ""}>
      <span class="compare-picker__option-text"><strong>${escapeHtml(label("scope.institution"))}</strong><small>${escapeHtml(label("scope.institution_meta"))}</small></span>
      ${usingShared ? heroIcon("check", "ui-icon ui-icon--16") : ""}
    </button>` : ""}
    <form class="compare-picker__search" data-picker-search role="search">
      <label class="sr-only" for="comparePickerSearch">${escapeHtml(label("picker.search"))}</label>
      ${heroIcon("magnifying-glass", "ui-icon ui-icon--16")}
      <input id="comparePickerSearch" type="search" maxlength="200" autocomplete="off" placeholder="${escapeHtmlAttr(label("picker.search"))}" value="${escapeHtmlAttr(picker.search)}">
    </form>
    ${levels.length > 1 ? `<div class="compare-picker__levels" role="group" aria-label="${escapeHtmlAttr(catalogLabel("level_label"))}">
      ${["", ...levels].map((level) => `<button type="button" class="compare-picker__level" data-picker-level="${escapeHtmlAttr(level)}" aria-pressed="${picker.level === level ? "true" : "false"}">${escapeHtml(level ? catalogLabel(`level.${level}`) : catalogLabel("all_levels"))}</button>`).join("")}
    </div>` : ""}
    <p class="compare-picker__count" aria-live="polite" data-picker-count>${picker.status === "ready" ? escapeHtml(tFormat("universities.compare.reviewed.picker.count", { total: formatUiNumber(picker.total) })) : ""}</p>
    <div class="compare-picker__results" data-picker-results>${listHtml()}</div>`;

  const routesHtml = () => {
    const resolved = picker.pending;
    const program = admissionsProgramLabel(resolved.selected_option);
    return `<button type="button" class="compare-reviewed__button compare-reviewed__button--quiet compare-picker__back" data-picker-back>${heroIcon("arrow-left", "ui-icon ui-icon--16")}<span>${escapeHtml(label("picker.back"))}</span></button>
      <p class="compare-picker__intro">${escapeHtml(tFormat("universities.compare.reviewed.picker.routes_intro", { program: program.title }))}</p>
      <ul class="compare-picker__list">${resolved.available_routes.map((route) => `<li><button type="button" class="compare-picker__option" data-picker-route="${escapeHtmlAttr(route.id)}">
        <span class="compare-picker__option-text"><strong>${escapeHtml(routeLabel(route))}</strong>${(route.levels || []).length ? `<small>${escapeHtml(route.levels.map((level) => catalogLabel(`level.${level}`)).join(" · "))}</small>` : ""}</span>
      </button></li>`).join("")}</ul>`;
  };

  const render = ({ keepSearchFocus = false } = {}) => {
    const body = picker.step === "routes" ? routesHtml() : picker.step === "applying"
      ? `<div class="compare-picker__state" role="status"><div class="center-loading-spinner"></div><span>${escapeHtml(catalogLabel("loading"))}</span></div>`
      : programsHtml();
    dialog.innerHTML = `<div class="compare-picker__panel">
      <header class="compare-picker__head">
        <div class="compare-picker__heading">
          <h2 id="comparePickerTitle">${escapeHtml(label("picker.title"))}</h2>
          <p>${escapeHtml(compareUniversityName(column.university))}</p>
        </div>
        <button type="button" class="compare-picker__close" data-picker-close aria-label="${escapeHtmlAttr(label("picker.close"))}" title="${escapeHtmlAttr(label("picker.close"))}">${heroIcon("x-mark", "ui-icon ui-icon--18")}</button>
      </header>
      <div class="compare-picker__body">${body}</div>
    </div>`;
    if (keepSearchFocus) {
      const input = dialog.querySelector("#comparePickerSearch");
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  };

  const renderResults = () => {
    const results = dialog.querySelector("[data-picker-results]");
    if (!results) return;
    results.innerHTML = listHtml();
    const count = dialog.querySelector("[data-picker-count]");
    if (count) count.textContent = picker.status === "ready" ? tFormat("universities.compare.reviewed.picker.count", { total: formatUiNumber(picker.total) }) : "";
  };

  async function loadPrograms({ append = false } = {}) {
    picker.request?.abort();
    const request = picker.request = new AbortController();
    picker.status = "loading";
    if (!append) { picker.items = []; picker.page = 1; }
    renderResults();
    try {
      const data = await fetchCompareStudyOptions(column.id, { search: picker.search, page: picker.page, study_level: picker.level }, { apiBase: API_BASE, signal: request.signal });
      if (request !== picker.request) return;
      picker.items = append ? [...picker.items, ...data.items] : data.items;
      picker.total = data.total;
      picker.status = "ready";
    } catch (error) {
      if (request.signal.aborted || request !== picker.request) return;
      picker.status = "error";
    }
    if (picker.step === "programs") renderResults();
  }

  async function chooseProgram(option) {
    picker.request?.abort();
    picker.step = "applying";
    render();
    const context = {
      ...column.context,
      study_option_id: option.id,
      application_route_id: "",
      study_level: option.levels.length === 1 ? option.levels[0] : picker.level || column.context.study_level || "",
    };
    try {
      let resolved = await fetchCompareAdmissionContext(column.id, context, loadProfileForApi(), { apiBase: API_BASE });
      if (!dialog.open) return;
      const sole = soleCompatibleRoute(resolved, context);
      if (sole) {
        context.application_route_id = sole.id;
        resolved = await fetchCompareAdmissionContext(column.id, context, loadProfileForApi(), { apiBase: API_BASE });
        if (!dialog.open) return;
      }
      if (!resolved.selected_route && resolved.available_routes?.length > 1 && !isMismatched(resolved)) {
        picker.pending = resolved;
        picker.pendingContext = context;
        picker.step = "routes";
        render();
        dialog.querySelector("[data-picker-route]")?.focus();
        return;
      }
      onApply(context, resolved);
      dialog.close();
    } catch (error) {
      if (!dialog.open) return;
      picker.step = "programs";
      picker.status = "error";
      render();
    }
  }

  async function chooseRoute(routeId) {
    const context = { ...picker.pendingContext, application_route_id: routeId };
    picker.step = "applying";
    render();
    try {
      const resolved = await fetchCompareAdmissionContext(column.id, context, loadProfileForApi(), { apiBase: API_BASE });
      if (!dialog.open) return;
      onApply(context, resolved);
      dialog.close();
    } catch (error) {
      if (!dialog.open) return;
      picker.step = "routes";
      render();
    }
  }

  const searchLater = debounce(() => { void loadPrograms(); }, 250);

  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const outsideDialog = (e) => {
      const rect = dialog.getBoundingClientRect();
      return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener("pointerdown", (e) => { pressedOutside = outsideDialog(e); });
    dialog.addEventListener("pointerup", (e) => { if (pressedOutside && outsideDialog(e)) dialog.close(); });
  }
  dialog.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.matches("[data-picker-close]")) dialog.close();
    else if (target.matches("[data-picker-shared]")) { onApply(null, null); dialog.close(); }
    else if (target.matches("[data-picker-level]")) {
      picker.level = target.dataset.pickerLevel;
      dialog.querySelectorAll("[data-picker-level]").forEach((button) => button.setAttribute("aria-pressed", String(button === target)));
      void loadPrograms();
    } else if (target.matches("[data-picker-more]")) { picker.page += 1; void loadPrograms({ append: true }); }
    else if (target.matches("[data-picker-retry]")) void loadPrograms();
    else if (target.matches("[data-picker-back]")) { picker.step = "programs"; render(); renderResults(); }
    else if (target.matches("[data-picker-route]")) void chooseRoute(target.dataset.pickerRoute);
    else if (target.matches("[data-picker-option]")) {
      const option = picker.items.find((item) => item.id === target.dataset.pickerOption);
      if (option) void chooseProgram(option);
    }
  });
  dialog.addEventListener("input", (event) => {
    if (event.target.id !== "comparePickerSearch") return;
    picker.search = event.target.value.trim();
    searchLater();
  });
  dialog.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadPrograms();
  });
  dialog.addEventListener("close", () => {
    picker.request?.abort();
    dialog.remove();
    if (trigger?.isConnected) trigger.focus();
  });

  document.body.append(dialog);
  render();
  dialog.showModal();
  (dialog.querySelector("#comparePickerSearch") || dialog.querySelector("[data-picker-route]"))?.focus();
  void loadPrograms();
  return dialog;
}

// Mounts the comparison for two reviewed universities. Returns controls the page uses on profile and language changes.
export function mountReviewedComparison(container, universities, photos) {
  let disposed = false;
  let saving = false;
  let observer = null;
  let picker = null;
  const columns = universities.map((university) => ({
    university,
    id: String(university.id),
    context: readAdmissionContext(new URL(window.location.pathname, window.location.origin), loadProfileForApi(), String(university.id)),
    sharedRoute: null,
    routesLoaded: false,
    resolved: null,
    status: "loading",
    request: null,
  }));

  async function loadColumn(column) {
    column.request?.abort();
    const request = column.request = new AbortController();
    column.status = "loading";
    try {
      if (!column.routesLoaded) {
        const data = await fetchCompareStudyOptions(column.id, { page: 1 }, { apiBase: API_BASE, signal: request.signal });
        column.sharedRoute = firstYearSharedRoute(data.shared_routes);
        column.routesLoaded = true;
      }
      const context = readableContext(column);
      const resolved = context ? await fetchCompareAdmissionContext(column.id, context, loadProfileForApi(), { apiBase: API_BASE, signal: request.signal }) : null;
      if (request !== column.request || disposed) return;
      column.resolved = resolved;
      column.status = "ready";
    } catch (error) {
      if (request.signal.aborted || request !== column.request || disposed) return;
      console.error("Failed to load a reviewed comparison column:", error);
      column.status = "error";
    }
  }

  function render() {
    if (disposed || !container.isConnected) return;
    const profile = loadProfileForApi();
    container.innerHTML = renderReviewedComparisonPage(columns, {
      photos,
      budgetUsd: profile.budget,
      profileExamIds: (profile.exams || []).map((exam) => exam.id),
    });
    bindImageFallbacks(container);
    observeHeads();
  }

  // The name strip appears only while the full heads are scrolled out of view.
  function observeHeads() {
    observer?.disconnect();
    const heads = container.querySelector("[data-compare-heads]");
    const strip = container.querySelector("[data-compare-strip]");
    if (!heads || !strip || typeof IntersectionObserver !== "function") return;
    observer = new IntersectionObserver(([entry]) => {
      strip.classList.toggle("is-visible", !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { threshold: 0 });
    observer.observe(heads);
  }

  async function reloadColumn(column) {
    const pending = loadColumn(column);
    render();
    await pending;
    render();
  }

  // The same saved choice the university page reads; a program without a readable route is not saved.
  function persistChoice(column, context, resolved) {
    saving = true;
    if (context && resolved?.selected_route && !isMismatched(resolved)) {
      saveSelectedAdmissionChoice(column.id, {
        studyOptionId: resolved.selected_option?.id || "",
        applicationRouteId: resolved.selected_route.id,
        studyLevel: context.study_level,
        intendedEntryCycle: context.intended_entry_cycle,
        feeStatusContext: context.fee_status_context,
      });
    } else {
      // The shared first-year route is the column default, so choosing it clears the saved choice.
      saveSelectedAdmissionChoice(column.id, null);
    }
    saving = false;
  }

  function applyChoice(column, context, resolved) {
    persistChoice(column, context, resolved);
    column.request?.abort();
    if (context) {
      column.context = context;
      column.resolved = resolved;
      column.status = "ready";
      render();
      return;
    }
    column.context = { ...column.context, study_option_id: "", application_route_id: "", study_level: "" };
    void reloadColumn(column);
  }

  const onClick = (event) => {
    const pick = event.target.closest("[data-compare-pick]");
    if (pick) {
      const column = columns.find((entry) => entry.id === pick.dataset.comparePick);
      if (column) picker = openPicker({ column, trigger: pick, onApply: (context, resolved) => applyChoice(column, context, resolved) });
      return;
    }
    const fee = event.target.closest("[data-compare-fee]");
    if (fee) {
      const column = columns.find((entry) => entry.id === fee.dataset.uniId);
      if (!column || column.status === "loading" || (column.context.fee_status_context || "unknown") === fee.dataset.compareFee) return;
      column.context = { ...column.context, fee_status_context: fee.dataset.compareFee };
      void reloadColumn(column).then(() => {
        // A chosen program keeps its fee status with the saved choice; the shared default route is not saved.
        if (hasSelection(column.context) && column.status === "ready") persistChoice(column, column.context, column.resolved);
      });
      return;
    }
    const retry = event.target.closest("[data-compare-retry]");
    if (retry) {
      const column = columns.find((entry) => entry.id === retry.dataset.compareRetry);
      if (column) void reloadColumn(column);
      return;
    }
    if (event.target.closest("[data-action='back-to-catalog']")) {
      event.preventDefault();
      navigateToAppRoute(routeCompareSelection());
    }
  };
  container.addEventListener("click", onClick);

  container.innerHTML = loadingHtml();
  const ready = Promise.all(columns.map(loadColumn)).then(() => {
    render();
    markMotionEnter(container, ".compare-reviewed__head, .compare-reviewed__section", { limit: 8, staggerMs: 24 });
  });

  return {
    ready,
    rerender: render,
    // Saved choices, budget or exam results changed elsewhere: read them again unless this page made the change.
    onProfileUpdated() {
      if (saving || disposed) return;
      const profile = loadProfileForApi();
      columns.forEach((column) => {
        column.context = readAdmissionContext(new URL(window.location.pathname, window.location.origin), profile, column.id);
      });
      void Promise.all(columns.map(loadColumn)).then(render);
    },
    dispose() {
      disposed = true;
      observer?.disconnect();
      picker?.close?.();
      columns.forEach((column) => column.request?.abort());
      container.removeEventListener("click", onClick);
    },
  };
}
