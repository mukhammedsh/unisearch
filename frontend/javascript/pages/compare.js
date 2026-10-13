import {
  API_BASE,
  bindImageFallbacks,
  escapeHtml,
  escapeHtmlAttr,
  initials,
  loadProfile,
  loadProfileForApi,
  initCustomSelect,
  saveSelectedAdmissionChoice,
  markMotionEnter,
  replayMotion,
} from "../utils.js";
import { t, tFormat } from "../i18n.js";
import { heroIcon } from "../icons.js";
import { renderErrorScreen } from "../components.js";
import { classifyError } from "../components/network-status.js";
import {
  navigateToAppRoute,
  routeCompareSelection,
  routeUniversityDetail,
} from "../routes.js";
import {
  fetchUniversityDetailCached,
  modeAwareAnnualCost,
  normalizeStudyModeForCost,
  readIdListStorage,
  renderInlineIcon,
  shouldOpenUniversitiesInNewTab,
  uniLogoSrc,
} from "./_shared.js";
import {
  compareAdmissionChoiceOptionLabel,
  compareAdmissionOptionEntries,
  compareAdmissionSelectionFromEntry,
  compareChoiceKey,
  compareLocationText,
  compareRankText,
  comparePublishedAdmission,
  comparePercentText,
  compareSelectedAdmissionEntry,
  compareSelectedCostContext,
  compareCostContextText,
  compareUniversityName,
  fetchCompareProfiles,
  formatCompareCostRange,
  loadCompareUniversities,
  readCompareAdmissionChoices,
  writeCompareAdmissionChoices,
  hasReviewedAdmissions,
  fetchCompareStudyOptions,
  fetchCompareAdmissionContext,
} from "./universities/compare-helpers.js";
import {
  buildCompareDecisionSupportHtml,
  compareMetrics,
  compareRowsHtml,
  compareSlotLabel,
} from "./universities/compare-specs.js";
import {
  applyPercentWidths,
  renderTrackChanceChip,
  renderUniChanceSummary,
} from "../university-detail-helpers.js";
import { getFinanceForChoice, renderAdmissionSection } from "./university/render-sections.js";
import { readAdmissionContext } from "./university/admissions-controller.js";
import { admissionsRouteName, renderAdmissionsContext } from "./university/admissions-render.js";

const COMPARE_PAIR_SIZE = 2;
const COMPARE_UNIVERSITIES_KEY = "unisearch_compare_university_ids_v1";

let activeUniversities = [];
let compareChancesByUniId = new Map();
let compareAdmissionChoices = new Map();
let isDiffOnly = false;
let currentStage = "results";
let reviewedContexts = new Map();
let compareLoadRun = 0;
let comparePopStateHandler = null;
let compareProfileUpdatedHandler = null;
let savingReviewedSelection = false;
const admissionsLabel = key => t(`university.admissions.catalog.${key}`);
const admissionsLoading = () => `<div class="admissions-state" role="status"><div class="center-loading-spinner"></div><span>${escapeHtml(admissionsLabel("loading"))}</span></div>`;
const admissionsFailure = () => `<div class="admissions-state" role="alert"><p>${escapeHtml(admissionsLabel("load_error"))}</p><button type="button" data-compare-context-retry>${escapeHtml(admissionsLabel("retry"))}</button></div>`;

function comparisonContextText(state) {
  const context = state.context;
  return [state.resolved?.selected_option?.title || admissionsLabel("no_program_selected"),
    state.resolved?.selected_route ? admissionsRouteName(state.resolved.selected_route) : admissionsLabel("choose_route"),
    context.study_level ? admissionsLabel(`level.${context.study_level}`) : admissionsLabel("unspecified"),
    context.applicant_route ? admissionsLabel(`applicant.${context.applicant_route}`) : admissionsLabel("unspecified"),
    context.intended_entry_cycle || admissionsLabel("unspecified"), admissionsLabel(`fee.${context.fee_status_context || "unknown"}`),
  ].join(" · ");
}

async function refreshReviewedContext(id, state) {
  state.request?.abort();
  const request = state.request = new AbortController();
  state.status = "loading";
  state.resolved = null;
  try {
    const resolved = await fetchCompareAdmissionContext(id, state.context, loadProfileForApi(), { apiBase: API_BASE, signal: request.signal });
    if (request !== state.request || reviewedContexts.get(id) !== state) return;
    state.resolved = resolved;
    state.status = "ready";
  } catch (error) {
    if (request.signal.aborted || request !== state.request || reviewedContexts.get(id) !== state) return;
    state.status = "error";
  }
}

function renderReviewedChooser(target, university) {
  const id = university.id;
  const state = reviewedContexts.get(id);
  if (!state || !target) return;
  state.selectDisposers?.forEach(dispose => dispose());
  const select = (name, caption, values, selected, disabled = false) => {
    const fieldId = `compare-${name}-${id}`;
    return `<label class="admissions-context__field" for="${escapeHtmlAttr(fieldId)}"><span>${escapeHtml(caption)}</span><select id="${escapeHtmlAttr(fieldId)}" data-context-field="${name}" data-flags="off" ${disabled ? "disabled" : ""}>${values.map(([value, text]) => `<option value="${escapeHtmlAttr(value)}"${value === selected ? " selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
  };
  const context = state.context;
  const pending = state.status === "loading";
  const incompatible = Object.values(state.resolved?.context_applicability || {}).includes("mismatched");
  target.innerHTML = `<div class="admissions-context">
    <p class="admissions-context__note">${escapeHtml(t("universities.compare.reviewed_catalog"))}</p>
    ${loadProfile()?.admissionChoiceResetNotices?.includes(id) ? `<p class="admissions-context__note" role="status" data-admission-reset-notice="${escapeHtmlAttr(id)}">${escapeHtml(admissionsLabel("reset_notice"))}</p>` : ""}
    <p class="admissions-context__summary">${escapeHtml(comparisonContextText(state))}</p>
    <form class="admissions-context__fields" data-compare-context-form>
      ${select("application_route_id", admissionsLabel("route_label"), [["", admissionsLabel("choose_route")], ...(state.resolved?.available_routes || []).map(route => [route.id, admissionsRouteName(route)])], context.application_route_id, pending || !state.resolved?.selected_option)}
      ${select("study_level", admissionsLabel("level_label"), [["", admissionsLabel("unspecified")], ...["undergraduate", "masters", "doctoral", "professional"].map(level => [level, admissionsLabel(`level.${level}`)])], context.study_level, pending)}
      ${select("applicant_route", admissionsLabel("applicant_label"), [["", admissionsLabel("unspecified")], ...["first_year", "transfer", "graduate"].map(value => [value, admissionsLabel(`applicant.${value}`)])], context.applicant_route, pending)}
      <label class="admissions-context__field" for="compare-cycle-${escapeHtmlAttr(id)}"><span>${escapeHtml(admissionsLabel("cycle_label"))}</span><input id="compare-cycle-${escapeHtmlAttr(id)}" data-context-field="intended_entry_cycle" maxlength="40" value="${escapeHtmlAttr(context.intended_entry_cycle)}" ${pending ? "disabled" : ""}></label>
      ${select("fee_status_context", admissionsLabel("fee_label"), ["unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"].map(value => [value, admissionsLabel(`fee.${value}`)]), context.fee_status_context, pending)}
      <div class="admissions-context__actions"><button type="submit" ${pending ? "disabled" : ""}>${escapeHtml(admissionsLabel("apply_context"))}</button></div>
    </form>
    <div class="admissions-context__status" aria-live="polite">${pending ? admissionsLoading() : state.status === "error" ? admissionsFailure() : `<p class="admissions-state">${escapeHtml(incompatible ? admissionsLabel("incompatible_context") : state.resolved?.selected_route ? admissionsLabel("source_text_note") : admissionsLabel("route_required"))}</p>`}</div>
    <div class="admissions-programs">
      <form class="admissions-programs__toolbar" data-compare-search-form>
        <label class="admissions-context__field" for="compare-search-${escapeHtmlAttr(id)}"><span>${escapeHtml(admissionsLabel("search_label"))}</span><input type="search" id="compare-search-${escapeHtmlAttr(id)}" maxlength="200" value="${escapeHtmlAttr(state.search)}"></label>
        ${select("filter_level", admissionsLabel("level_label"), [["", admissionsLabel("all_levels")], ...["undergraduate", "masters", "doctoral", "professional"].map(level => [level, admissionsLabel(`level.${level}`)])], state.filterLevel)}
        <button type="submit">${escapeHtml(admissionsLabel("search"))}</button>
      </form><div class="admissions-programs__list" data-compare-programs></div>
      <div class="admissions-programs__pagination"><button type="button" data-compare-previous>${escapeHtml(admissionsLabel("previous"))}</button><span data-compare-count aria-live="polite"></span><button type="button" data-compare-next>${escapeHtml(admissionsLabel("next"))}</button></div>
    </div></div>`;
  state.selectDisposers = Array.from(target.querySelectorAll("select")).map(element => initCustomSelect(element.id));
  const applyContext = async () => {
    const refresh = refreshReviewedContext(id, state);
    renderReviewedChooser(target, university);
    await refresh;
    if (reviewedContexts.get(id) !== state || document.body.dataset.page !== "compare") return;
    const pane = document.getElementById("compareResultsPane");
    if (currentStage === "results") await renderCompareResults(pane);
    else renderReviewedChooser(pane?.querySelector(`#compare-options-${id}`), university);
  };
  target.querySelector("[data-compare-context-form]").onsubmit = async event => {
    event.preventDefault();
    event.target.querySelectorAll("[data-context-field]").forEach(element => { context[element.dataset.contextField] = element.value.trim(); });
    await applyContext();
    if (state.status !== "ready" || reviewedContexts.get(id) !== state) return;
    const option = state.resolved?.selected_option;
    const route = state.resolved?.selected_route;
    const compatible = ["option", "route", "level"].every(axis => state.resolved?.context_applicability?.[axis] === "matched");
    if (option && route && !compatible) return;
    savingReviewedSelection = true;
    const saved = saveSelectedAdmissionChoice(id, option && route ? {
      studyOptionId: option.id, applicationRouteId: route.id, studyLevel: context.study_level,
      applicantRoute: context.applicant_route, intendedEntryCycle: context.intended_entry_cycle,
      feeStatusContext: context.fee_status_context,
    } : null);
    savingReviewedSelection = false;
    if (saved && option && route) document.querySelectorAll(`[data-admission-reset-notice="${id}"]`).forEach(element => element.remove());
    const status = document.querySelector(`#compare-options-${id} .admissions-context__status`);
    if (status) status.textContent = t(saved ? "profile.state.saved_local" : "profile.state.unsaved");
  };
  target.querySelector("[data-compare-context-retry]")?.addEventListener("click", applyContext);
  target.querySelector("[data-compare-search-form]").onsubmit = event => {
    event.preventDefault();
    state.search = event.target.querySelector("input").value.trim();
    state.filterLevel = event.target.querySelector("select").value;
    state.page = 1;
    void refreshPrograms();
  };
  target.querySelector("[data-compare-previous]").onclick = () => { state.page--; void refreshPrograms(); };
  target.querySelector("[data-compare-next]").onclick = () => { state.page++; void refreshPrograms(); };

  async function refreshPrograms() {
    state.catalogRequest?.abort();
    const request = state.catalogRequest = new AbortController();
    const list = target.querySelector("[data-compare-programs]");
    const previous = target.querySelector("[data-compare-previous]");
    const next = target.querySelector("[data-compare-next]");
    const submit = target.querySelector("[data-compare-search-form] button");
    list.innerHTML = admissionsLoading();
    previous.disabled = next.disabled = submit.disabled = true;
    try {
      const data = await fetchCompareStudyOptions(id, { search: state.search, page: state.page, study_level: state.filterLevel }, { apiBase: API_BASE, signal: request.signal });
      if (request !== state.catalogRequest || !list.isConnected || reviewedContexts.get(id) !== state) return;
      list.innerHTML = data.items.length ? data.items.map(option => `<button type="button" class="admissions-programs__option" data-study-option="${escapeHtmlAttr(option.id)}"><strong class="admissions-programs__option-title">${escapeHtml(option.title)}</strong><span class="admissions-programs__option-levels">${escapeHtml([...option.levels.map(level => admissionsLabel(`level.${level}`)), ...option.awards].join(" · "))}</span></button>`).join("") : `<p class="admissions-state">${escapeHtml(admissionsLabel("no_options"))}</p>`;
      list.querySelectorAll("[data-study-option]").forEach(button => { button.onclick = () => {
        const option = data.items.find(row => row.id === button.dataset.studyOption);
        context.study_option_id = option.id;
        context.application_route_id = "";
        const level = option.levels.length === 1 ? option.levels[0] : state.filterLevel;
        context.study_level = level;
        savingReviewedSelection = true;
        saveSelectedAdmissionChoice(id, null);
        savingReviewedSelection = false;
        void applyContext();
      }; });
      target.querySelector("[data-compare-count]").textContent = tFormat("university.admissions.catalog.results", { from: data.total ? (state.page - 1) * 24 + 1 : 0, to: Math.min(state.page * 24, data.total), total: data.total });
      previous.disabled = state.page === 1;
      next.disabled = state.page * 24 >= data.total;
    } catch (error) {
      if (request.signal.aborted || request !== state.catalogRequest || !list.isConnected) return;
      list.innerHTML = admissionsFailure();
      list.querySelector("button").onclick = refreshPrograms;
      target.querySelector("[data-compare-count]").textContent = "";
    } finally {
      if (request === state.catalogRequest && list.isConnected) submit.disabled = false;
    }
  }
  void refreshPrograms();
}

function reviewedResultsHtml(university) {
  const state = reviewedContexts.get(university.id);
  if (!state) return "";
  const incompatible = Object.values(state.resolved?.context_applicability || {}).includes("mismatched");
  return `<section class="compare-analysis-block" data-reviewed-context="${escapeHtmlAttr(university.id)}"><h2>${escapeHtml(compareUniversityName(university))}</h2>
    <p class="admissions-context__note">${escapeHtml(t("universities.compare.reviewed_catalog"))}</p>
    ${loadProfile()?.admissionChoiceResetNotices?.includes(university.id) ? `<p class="admissions-context__note" role="status" data-admission-reset-notice="${escapeHtmlAttr(university.id)}">${escapeHtml(admissionsLabel("reset_notice"))}</p>` : ""}
    <p class="admissions-context__summary">${escapeHtml(comparisonContextText(state))}</p>
    ${state.status === "error" ? admissionsFailure() : state.status === "loading" ? admissionsLoading() : incompatible ? `<p class="admissions-state">${escapeHtml(admissionsLabel("incompatible_context"))}</p>` : renderAdmissionsContext(state.resolved)}
    </section>`;
}

function disposeReviewedControls() {
  reviewedContexts.forEach(state => {
    state.catalogRequest?.abort();
    state.selectDisposers?.forEach(dispose => dispose());
    state.selectDisposers = [];
  });
}

function getCompareIdsFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const rawIds = String(params.get("ids") || "").split(",");
  const cleanIds = Array.from(new Set(rawIds.map((id) => id.trim()).filter(Boolean))).slice(0, COMPARE_PAIR_SIZE);
  if (cleanIds.length === COMPARE_PAIR_SIZE) return cleanIds;

  const stored = readIdListStorage(COMPARE_UNIVERSITIES_KEY).slice(0, COMPARE_PAIR_SIZE);
  if (stored.length === COMPARE_PAIR_SIZE) return stored;

  return cleanIds;
}

function getChoicesFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("choices") || "").split(",").map((c) => c.trim());
}

function getStageFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const stage = String(params.get("stage") || params.get("compare") || "").trim().toLowerCase();
  return stage === "configure" ? "configure" : "results";
}

function syncUrlWithState(stage = currentStage, { push = false } = {}) {
  const ids = activeUniversities.map((u) => String(u?.id || "").trim()).filter(Boolean);
  if (ids.length !== COMPARE_PAIR_SIZE) return;

  const choices = ids.map((id) => compareChoiceKey(compareAdmissionChoices.get(id)));
  const params = new URLSearchParams();
  params.set("ids", ids.join(","));
  if (choices.some(Boolean)) params.set("choices", choices.join(","));
  if (stage === "configure") {
    params.set("stage", "configure");
  }

  const url = new URL(window.location.href);
  url.search = params.toString();
  if (push) {
    window.history.pushState({ stage }, "", url.toString());
  } else {
    window.history.replaceState({ stage }, "", url.toString());
  }
}

function compareCardsHtml(universities) {
  return universities.map((u, index) => {
    const id = String(u?.id || "");
    const logoSrc = uniLogoSrc(id);
    const logoSrcFull = uniLogoSrc(id, { forceFull: true });
    const publishedAdmission = comparePublishedAdmission(u, compareAdmissionChoices);
    const cost = compareSelectedCostContext(u, compareAdmissionChoices);
    const admissionContext = [
      publishedAdmission.scope === "program"
        ? t("universities.compare.scope.program", "course-specific")
        : t("universities.compare.scope.institution", "institution-wide"),
      publishedAdmission.cycle,
    ].filter(Boolean).join(" · ");
    const costContext = compareCostContextText({ ...cost, scope: "" });
    const linkAttrs = shouldOpenUniversitiesInNewTab() ? ' target="_blank" rel="noopener noreferrer"' : "";

    return `
      <article class="compare-uni-card compare-uni-card--pair" data-compare-slot="${index + 1}" data-uni-id="${escapeHtmlAttr(id)}">
        <div class="compare-uni-card__head">
          <div class="compare-uni-card__identity">
            <span class="compare-uni-card__slot">${escapeHtml(compareSlotLabel(index))}</span>
            <div class="compare-uni-card__logo">
              <img src="${logoSrc}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(compareUniversityName(u)))}">
            </div>
          </div>
        </div>
        <h3>${escapeHtml(compareUniversityName(u))}</h3>
        <p>${escapeHtml(compareLocationText(u))}</p>
        <p class="admissions-context__note">${escapeHtml(t(hasReviewedAdmissions(u) ? "universities.compare.reviewed_catalog" : "universities.compare.legacy_unreviewed"))}</p>
        <div class="compare-uni-card__metrics">
          <span><small>${escapeHtml(t("universities.compare.published_rank", "Published rank"))}</small><strong>${escapeHtml(compareRankText(u))}</strong></span>
          <span><small>${escapeHtml([t("universities.compare.sticker_cost", "Sticker cost"), costContext].filter(Boolean).join(" · "))}</small><strong>${escapeHtml(formatCompareCostRange(cost))}</strong></span>
          <span><small>${escapeHtml([t("universities.compare.published_rate", "Published selectivity"), admissionContext].filter(Boolean).join(" · "))}</small><strong>${escapeHtml(publishedAdmission.value === null ? t("common.na", "N/A") : comparePercentText(publishedAdmission.value))}</strong></span>
        </div>
        ${(() => {
          const uniChance = compareChancesByUniId.get(id);
          const selectedKey = compareChoiceKey(compareAdmissionChoices.get(id));
          const trackChance = (uniChance?.choices || []).find((x) => String(x.choiceKey) === selectedKey);
          return trackChance ? `<div class="compare-uni-card__chance"><small>${escapeHtml(t("universities.compare.requirements_fit_score", "Requirements fit score"))}</small>${renderTrackChanceChip(trackChance)}</div>` : "";
        })()}
        ${(() => {
          const entries = compareAdmissionOptionEntries(u);
          if (entries.length <= 1) return "";
          const selectedKey = compareChoiceKey(compareAdmissionChoices.get(id));
          return `
            <div class="compare-uni-card__track">
              <label class="compare-uni-card__track-label" for="track-select-${escapeHtmlAttr(id)}">${escapeHtml(t("universities.compare.change_track", "Change track"))}</label>
              <select class="compare-track-select" id="track-select-${escapeHtmlAttr(id)}" data-uni-id="${escapeHtmlAttr(id)}" data-action="change-compare-track" aria-label="${escapeHtmlAttr(t("universities.compare.change_track", "Change track"))}">
                ${entries.map((e) => {
                  const label = compareAdmissionChoiceOptionLabel(e, u);
                  const isSelected = e.key === selectedKey;
                  return `<option value="${escapeHtmlAttr(e.key)}"${isSelected ? " selected" : ""}>${escapeHtml(label || e.key)}</option>`;
                }).join("")}
              </select>
            </div>
          `;
        })()}
        <a class="compare-uni-card__link" href="${routeUniversityDetail(id)}"${linkAttrs}>${escapeHtml(t("universities.card.view_details", "View details"))}</a>
      </article>
    `;
  }).join("");
}

function updateDiffOnlySections(tableWrap, diffOnly) {
  if (!tableWrap) return;
  tableWrap.classList.toggle("is-diff-only", diffOnly);
  const sectionRows = tableWrap.querySelectorAll(".compare-table__section-row");
  sectionRows.forEach((sectionRow) => {
    const section = sectionRow.getAttribute("data-section");
    const dataRows = Array.from(tableWrap.querySelectorAll(`tr[data-row-section="${section}"]`));
    if (!dataRows.length) return;
    const allHidden = diffOnly && dataRows.every((r) => r.classList.contains("compare-row--identical"));
    sectionRow.style.display = allHidden ? "none" : "";
  });
}

function renderEmptyState(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="compare-results-empty">
      <h2>${escapeHtml(t("universities.compare.results.empty_title", "No comparison yet"))}</h2>
      <p>${escapeHtml(t("universities.compare.results.empty_body", "Select exactly two universities to build a comparison pair."))}</p>
      <div class="compare-results-actions" style="justify-content: center; margin-top: 20px;">
        <button class="compare-results-action" type="button" data-action="back-to-catalog">
          ${heroIcon("arrow-left", "ui-icon ui-icon--16")}
          <span>${escapeHtml(t("universities.compare.back_to_catalog", "Back to catalog"))}</span>
        </button>
      </div>
    </div>
  `;
}

async function renderCompareConfigure(container, { pushState = false } = {}) {
  if (!container) return;
  disposeReviewedControls();
  currentStage = "configure";
  syncUrlWithState("configure", { push: pushState });

  const ready = activeUniversities.every((u) => {
    const id = String(u?.id || "");
    return hasReviewedAdmissions(u) || Boolean(compareChoiceKey(compareAdmissionChoices.get(id)) && compareSelectedAdmissionEntry(u, compareAdmissionChoices));
  });

  container.innerHTML = `
    <div class="compare-results-head compare-results-head--pair">
      <div>
        <p class="compare-results-kicker">${escapeHtml(t("universities.compare.configure.kicker", "Before comparison"))}</p>
        <h2>${escapeHtml(t("universities.compare.configure.title", "Choose admission choices"))}</h2>
        <p class="compare-config-subtitle">${escapeHtml(t(activeUniversities.some(hasReviewedAdmissions) ? "universities.compare.optional_context" : "universities.compare.configure.subtitle"))}</p>
      </div>
      <div class="compare-results-actions">
        <button class="compare-results-action compare-results-action--ghost" type="button" data-action="back-to-catalog" title="${escapeHtmlAttr(t("universities.compare.back_to_catalog", "Back to catalog"))}">
          ${heroIcon("arrow-left", "ui-icon ui-icon--16")}
          <span>${escapeHtml(t("universities.compare.back_to_catalog", "Back to catalog"))}</span>
        </button>
        <button class="compare-results-action" type="button" data-action="build-compare-results"${ready ? "" : " disabled"}>${escapeHtml(t("universities.compare.continue", "Continue"))}</button>
      </div>
    </div>
    <section class="compare-config-panel" aria-label="${escapeHtmlAttr(t("universities.compare.configure.title", "Choose admission choices"))}">
      ${activeUniversities.map((u, index) => {
        const id = String(u?.id || "");
        const selected = compareChoiceKey(compareAdmissionChoices.get(id));
        const logoSrc = uniLogoSrc(id);
        const logoSrcFull = uniLogoSrc(id, { forceFull: true });
        const uniName = compareUniversityName(u);
        const location = compareLocationText(u);
        return `
          <article class="compare-config-column" data-uni-id="${escapeHtmlAttr(id)}">
            <div class="compare-config-column__head">
              <div class="compare-config-column__identity">
                <span class="compare-config-column__slot">${escapeHtml(compareSlotLabel(index))}</span>
                <div class="compare-config-column__logo">
                  <img src="${logoSrc}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(uniName))}">
                </div>
              </div>
              <h2>${escapeHtml(uniName)}</h2>
              ${location ? `<p class="compare-config-column__location">${escapeHtml(location)}</p>` : ""}
              ${hasReviewedAdmissions(u) ? "" : `<p class="admissions-context__note">${escapeHtml(t("universities.compare.legacy_unreviewed"))}</p>`}
              <p class="compare-config-column__status">${escapeHtml(hasReviewedAdmissions(u) ? t("universities.compare.optional_context") : selected ? t("universities.compare.configure.selected", "Admission choice selected") : t("universities.compare.configure.required", "Select one option before comparing"))}</p>
            </div>
            <div class="compare-config-chance">
              ${hasReviewedAdmissions(u) ? "" : renderUniChanceSummary(compareChancesByUniId.get(id))}
            </div>
            <div class="compare-config-options" id="compare-options-${escapeHtmlAttr(id)}">
            </div>
          </article>
        `;
      }).join("")}
    </section>
  `;

  activeUniversities.forEach((u) => {
    const id = String(u?.id || "");
    const optContainer = container.querySelector(`#compare-options-${id}`);
    if (optContainer) {
      if (hasReviewedAdmissions(u)) {
        renderReviewedChooser(optContainer, u);
        return;
      }
      const uniChance = compareChancesByUniId.get(id);
      const uniChanceByChoiceKey = new Map((uniChance?.choices || []).map((choice) => [String(choice.choiceKey), choice]));
      const profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || loadProfile()?.study_mode || "");
      const annualCostForTrack = (track) => modeAwareAnnualCost(getFinanceForChoice(track, u.finance), profileStudyMode);

      renderAdmissionSection({
        annualCostForTrack,
        container: optContainer,
        uniChance,
        uniChanceByChoiceKey,
        university: u,
        effectiveSelectedChoiceKeyOverride: compareChoiceKey(compareAdmissionChoices.get(id)),
        compactMode: true,
        onChoiceSelected: (selection) => {
          const entry = compareAdmissionOptionEntries(u).find((e) => e.key === selection.choiceKey);
          const fullSelection = compareAdmissionSelectionFromEntry(entry);
          compareAdmissionChoices.set(id, fullSelection);
          writeCompareAdmissionChoices(compareAdmissionChoices, activeUniversities.map((x) => x.id));
          syncUrlWithState("configure", { push: pushState });
          renderCompareConfigure(container).catch((err) => console.error(err));
        },
      });
    }
  });

  applyPercentWidths(container);
  bindImageFallbacks(container);
  markMotionEnter(container, ".compare-config-column, .admission-category-card", { limit: 16, staggerMs: 18 });
  replayMotion(container, "motion-panel-enter", { timeoutMs: 420 });
}

async function renderCompareResults(container, { pushState = false } = {}) {
  if (!container) return;
  disposeReviewedControls();
  currentStage = "results";
  syncUrlWithState("results", { push: pushState });

  const metrics = compareMetrics(activeUniversities);
  const rowsHtml = compareRowsHtml(activeUniversities, metrics);
  const decisionSupportHtml = buildCompareDecisionSupportHtml(activeUniversities, {
    choices: compareAdmissionChoices,
    chances: compareChancesByUniId,
  });

  container.innerHTML = `
    <div class="compare-results-head compare-results-head--pair">
      <div>
        <p class="compare-results-kicker">${escapeHtml(t("universities.compare.results.kicker", "Comparison results"))}</p>
        <h2>${escapeHtml(t("universities.compare.results.title", "University comparison"))}</h2>
      </div>
      <div class="compare-results-actions">
        <button class="compare-results-action compare-results-action--ghost" type="button" data-action="back-to-tracks" title="${escapeHtmlAttr(t("universities.compare.back_to_tracks", "Back to tracks"))}">
          ${heroIcon("arrow-left", "ui-icon ui-icon--16")}
          <span>${escapeHtml(t("universities.compare.back_to_tracks", "Back to tracks"))}</span>
        </button>
      </div>
    </div>
    <div class="compare-uni-grid compare-uni-grid--pair">${compareCardsHtml(activeUniversities)}</div>
    ${activeUniversities.filter(hasReviewedAdmissions).map(reviewedResultsHtml).join("")}
    ${decisionSupportHtml}
    <section class="compare-analysis-block compare-tests" aria-labelledby="compareTestsTitle">
      <div class="compare-block-head">
        <div class="compare-block-icon">${renderInlineIcon("document-check", 20, "compare-block-icon-svg")}</div>
        <div class="compare-block-title-wrap">
          <h2 id="compareTestsTitle">${escapeHtml(t("universities.compare.tests.title", "Tests and characteristics"))}</h2>
          <p>${escapeHtml(t("universities.compare.tests.subtitle", "Detailed published values. Color is used only for a comparable and meaningful difference."))}</p>
        </div>
        <div class="compare-block-tools">
          <label class="compare-diff-toggle" title="${escapeHtmlAttr(t("universities.compare.diff_only", "Differences only"))}">
            <input type="checkbox" data-action="toggle-diff-only"${isDiffOnly ? " checked" : ""}>
            <span class="compare-diff-toggle__track"><span class="compare-diff-toggle__thumb"></span></span>
            <span class="compare-diff-toggle__label">${escapeHtml(t("universities.compare.diff_only", "Differences only"))}</span>
          </label>
        </div>
      </div>
      <p class="compare-table-scroll-hint">${escapeHtml(t("universities.compare.table_scroll_hint", "Swipe horizontally to see both universities."))}</p>
      <div class="compare-table-wrap compare-table-wrap--pair${isDiffOnly ? " is-diff-only" : ""}">
        <table class="compare-table">
          <thead>
            <tr>
              <th>${escapeHtml(t("universities.compare.row.metric", "Metric"))}</th>
              ${activeUniversities.map((u) => `<th>${escapeHtml(compareUniversityName(u))}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </section>
  `;

  const tableWrap = container.querySelector(".compare-table-wrap");
  container.querySelectorAll("[data-reviewed-context]").forEach(section => {
    section.querySelector("[data-compare-context-retry]")?.addEventListener("click", async () => {
      const id = section.dataset.reviewedContext;
      const state = reviewedContexts.get(id);
      const refresh = refreshReviewedContext(id, state);
      await renderCompareResults(container);
      await refresh;
      if (container.isConnected && currentStage === "results") await renderCompareResults(container);
    });
  });
  if (tableWrap && isDiffOnly) {
    updateDiffOnlySections(tableWrap, true);
  }
  bindImageFallbacks(container);
  markMotionEnter(container, ".compare-analysis-block, .compare-uni-card", { limit: 12, staggerMs: 18 });
  replayMotion(container, "motion-panel-enter", { timeoutMs: 420 });
}

function bindCompareEvents(container) {
  if (!container || container.dataset.boundEvents === "1") return;
  container.dataset.boundEvents = "1";

  container.addEventListener("click", async (event) => {
    const actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;
    const action = actionBtn.getAttribute("data-action");

    if (action === "back-to-catalog") {
      event.preventDefault();
      navigateToAppRoute(routeCompareSelection());
      return;
    }

    if (action === "back-to-tracks") {
      event.preventDefault();
      await renderCompareConfigure(container, { pushState: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "build-compare-results") {
      event.preventDefault();
      await renderCompareResults(container, { pushState: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  });

  container.addEventListener("change", async (event) => {
    const diffToggle = event.target.closest("[data-action='toggle-diff-only']");
    if (diffToggle) {
      isDiffOnly = Boolean(diffToggle.checked);
      const tableWrap = container.querySelector(".compare-table-wrap");
      updateDiffOnlySections(tableWrap, isDiffOnly);
      return;
    }

    const trackSelect = event.target.closest("[data-action='change-compare-track']");
    if (trackSelect) {
      const uniId = String(trackSelect.getAttribute("data-uni-id") || "").trim();
      const nextKey = String(trackSelect.value || "").trim();
      const uni = activeUniversities.find((u) => String(u?.id || "") === uniId);
      if (uni && nextKey) {
        const entry = compareAdmissionOptionEntries(uni).find((e) => e.key === nextKey);
        if (entry) {
          compareAdmissionChoices.set(uniId, compareAdmissionSelectionFromEntry(entry));
          writeCompareAdmissionChoices(compareAdmissionChoices, activeUniversities.map((x) => x.id));
          await renderCompareResults(container);
        }
      }
    }
  });
}

export function disposeComparePage() {
  compareLoadRun++;
  reviewedContexts.forEach(state => { state.request?.abort(); state.catalogRequest?.abort(); state.selectDisposers?.forEach(dispose => dispose()); });
  reviewedContexts = new Map();
  window.removeEventListener("popstate", comparePopStateHandler);
  window.removeEventListener("profileUpdated", compareProfileUpdatedHandler);
  comparePopStateHandler = compareProfileUpdatedHandler = null;
}

export async function initComparePage() {
  const container = document.getElementById("compareResultsPane");
  if (!container) return;
  const loadRun = ++compareLoadRun;
  reviewedContexts.forEach(state => { state.request?.abort(); state.catalogRequest?.abort(); state.selectDisposers?.forEach(dispose => dispose()); });
  reviewedContexts = new Map();
  window.removeEventListener("popstate", comparePopStateHandler);
  window.removeEventListener("profileUpdated", compareProfileUpdatedHandler);
  comparePopStateHandler = () => {
    if (!container.isConnected || document.body.dataset.page !== "compare") return;
    const targetStage = getStageFromUrl();
    if (targetStage !== currentStage && activeUniversities.length === COMPARE_PAIR_SIZE) {
      (targetStage === "configure" ? renderCompareConfigure(container) : renderCompareResults(container)).catch(error => console.error(error));
    }
  };
  compareProfileUpdatedHandler = () => {
    if (!savingReviewedSelection && container.isConnected && document.body.dataset.page === "compare") void initComparePage();
  };
  window.addEventListener("popstate", comparePopStateHandler);
  window.addEventListener("profileUpdated", compareProfileUpdatedHandler);

  bindCompareEvents(container);

  const ids = getCompareIdsFromUrl();
  if (ids.length !== COMPARE_PAIR_SIZE) {
    renderEmptyState(container);
    return;
  }

  container.innerHTML = `
    <div class="compare-results-loading" role="status">
      <div class="skeleton-line" style="width: 38%; height: 22px;"></div>
      <div class="skeleton-line" style="width: 100%; height: 118px;"></div>
      <div class="skeleton-line" style="width: 92%; height: 180px;"></div>
    </div>
  `;

  try {
    const [universities, compareProfiles] = await Promise.all([
      loadCompareUniversities(ids, { fetchUniversityDetailCached }),
      fetchCompareProfiles(ids, {
        apiBase: API_BASE,
        fetchImpl: fetch,
        loadProfileForApi,
      }),
    ]);
    if (loadRun !== compareLoadRun || !container.isConnected) return;

    if (universities.length !== COMPARE_PAIR_SIZE) {
      renderEmptyState(container);
      return;
    }

    activeUniversities = universities;
    compareChancesByUniId = compareProfiles.chances;
    savingReviewedSelection = true;
    compareAdmissionChoices = readCompareAdmissionChoices();
    savingReviewedSelection = false;

    const urlChoices = getChoicesFromUrl();
    activeUniversities.forEach((u, idx) => {
      const id = String(u?.id || "");
      if (hasReviewedAdmissions(u)) {
        compareAdmissionChoices.delete(id);
        compareChancesByUniId.delete(id);
        reviewedContexts.set(id, { context: readAdmissionContext(new URL(window.location.pathname, window.location.origin), loadProfileForApi(), id), search: "", filterLevel: "", page: 1, status: "loading", resolved: null });
        return;
      }
      const entries = compareAdmissionOptionEntries(u);
      const urlChoiceKey = urlChoices[idx] || "";
      const storedKey = compareChoiceKey(compareAdmissionChoices.get(id));
      const targetKey = urlChoiceKey || storedKey;
      let matchedEntry = targetKey ? entries.find((e) => e.key === targetKey) : null;
      if (!matchedEntry && entries.length) {
        const uniChance = compareChancesByUniId.get(id);
        const recKey = String(uniChance?.selectedChoiceKey || uniChance?.recommendedChoiceKey || uniChance?.bestChoiceKey || "").trim();
        matchedEntry = recKey ? entries.find((e) => e.key === recKey) : null;
        if (!matchedEntry) matchedEntry = entries[0];
      }
      if (matchedEntry) {
        compareAdmissionChoices.set(id, compareAdmissionSelectionFromEntry(matchedEntry));
      }
    });
    writeCompareAdmissionChoices(compareAdmissionChoices, ids);
    await Promise.all(Array.from(reviewedContexts, ([id, state]) => refreshReviewedContext(id, state)));
    if (loadRun !== compareLoadRun || !container.isConnected) return;

    const initialStage = getStageFromUrl();
    if (initialStage === "configure") {
      await renderCompareConfigure(container);
    } else {
      await renderCompareResults(container);
    }
  } catch (err) {
    if (loadRun !== compareLoadRun || !container.isConnected) return;
    console.error("Failed to load universities for comparison:", err);
    const classified = classifyError(err);
    renderErrorScreen({
      type: classified.type,
      targetEl: container,
      onRetry: () => initComparePage(),
    });
    window.addEventListener("app:online-reconnect", () => {
      initComparePage().catch(() => {});
    }, { once: true });
  }
}
