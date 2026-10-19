import { API_BASE, escapeHtml, escapeHtmlAttr, initCustomSelect, loadProfile, loadProfileForApi, saveSelectedAdmissionChoice, stabilizeNumericRanges } from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { admissionsCycleLabel, admissionsProgramLabel, admissionsRouteName, renderAdmissionsContext, renderStudyOptionOverview } from "./admissions-render.js";
import { safeUrl } from "../_shared.js";
import { heroIcon } from "../../icons.js";
import { renderApplicantSection } from "./admissions-presentation.js";

export const REVIEWED_ADMISSIONS_IDS = new Set([
  "mit-usa-cambridge", "imperial-college-london-uk", "stanford-university-usa-ca",
]);
const QUERY_KEYS = {
  study_option_id: "admission_option", application_route_id: "admission_application_route",
  study_level: "admission_level", applicant_route: "admission_route",
  intended_entry_cycle: "admission_cycle", fee_status_context: "admission_fee",
};
const LEVELS = ["undergraduate", "masters", "doctoral", "professional"];
const LEVEL_ALIASES = { bachelor: "undergraduate", master: "masters", doctorate: "doctoral", phd: "doctoral" };
const label = (key) => t(`university.admissions.catalog.${key}`);
const routeName = (route) => admissionsRouteName(route, { presentation: "simple" });
const browsingByInstitution = new Map();

export function normalizeAdmissionCycle(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  const russian = text.match(/^(осенний|весенний) набор (20\d{2})(?: года)?$/i);
  if (russian) return `${russian[1].toLowerCase() === "осенний" ? "Fall" : "Spring"} ${russian[2]}`;
  const kazakh = text.match(/^(20\d{2}) жылғы (күзгі|көктемгі) қабылдау$/i);
  if (kazakh) return `${kazakh[2].toLowerCase() === "күзгі" ? "Fall" : "Spring"} ${kazakh[1]}`;
  return text;
}

export function getApplicationLink(resolved) {
  const route = resolved?.selected_route;
  if (!route) return "";
  if (route.application_url) return safeUrl(route.application_url);
  const destination = String(route.destination || "");
  if (/^https?:\/\//i.test(destination)) return safeUrl(destination);
  const declaredHost = destination.match(/\((([a-z0-9-]+\.)+[a-z]{2,})\)/i);
  if (declaredHost) return safeUrl(`https://${declaredHost[1]}`);
  const source = resolved.sources?.find(source => route.source_ids?.includes(source.id) && /^https?:\/\//i.test(source.url || ""));
  return safeUrl(source?.url || "");
}

export function readAdmissionContext(url, profile, institutionId) {
  const choice = profile?.selectedAdmissionChoices?.[institutionId] || {};
  const context = {
    study_option_id: choice.studyOptionId || "", application_route_id: choice.applicationRouteId || "",
    study_level: choice.studyLevel || "", applicant_route: choice.applicantRoute || "",
    intended_entry_cycle: choice.intendedEntryCycle || "", fee_status_context: choice.feeStatusContext || "unknown",
  };
  for (const [key, query] of Object.entries(QUERY_KEYS)) {
    if (url.searchParams.has(query)) context[key] = url.searchParams.get(query).trim();
  }
  const level = context.study_level.toLowerCase();
  context.study_level = LEVEL_ALIASES[level] || level;
  if (!LEVELS.includes(context.study_level)) context.study_level = "";
  return context;
}

export function admissionsRequest(profile, context, institutionId) {
  // Empty manual fields must clear saved defaults, rather than being dropped by Pydantic.
  const requestProfile = { ...profile, selectedAdmissionChoices: { ...profile?.selectedAdmissionChoices } };
  delete requestProfile.selectedAdmissionChoices[institutionId];
  for (const key of ["study_level", "applicant_route", "intended_entry_cycle", "fee_status_context"]) delete requestProfile[key];
  return { profile: requestProfile, context: { ...context, applicant_route: context.applicant_route || null } };
}

export function admissionContextUrl(url, context) {
  const next = new URL(url);
  for (const [key, query] of Object.entries(QUERY_KEYS)) next.searchParams.set(query, context[key] || "");
  return next;
}

function selectHtml(id, caption, values, selected, disabled = false) {
  return `<label class="admissions-context__field" for="${id}"><span>${escapeHtml(caption)}</span>
    <select id="${id}" data-flags="off" aria-label="${escapeHtmlAttr(caption)}" ${disabled ? "disabled" : ""}>
      ${values.map(([value, text]) => `<option value="${escapeHtmlAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
    </select></label>`;
}

const APPLICATION_CLASSES = new Set([
  "post_admission_major", "direct_program", "ucas_course_choice", "postgraduate_course_choice",
  "institution_wide", "external_and_coterm", "department_or_program",
]);

function applicationClasses(option) {
  if (!option) return [];
  const application = option.application || {};
  const classifications = [
    application.classification,
    option.catalog_classification,
    ...(option.application_classifications || []).map((item) => item?.classification),
  ].filter((value, index, values) => APPLICATION_CLASSES.has(value) && values.indexOf(value) === index);
  return classifications.map((value) => label(`application_class.${value}`));
}

function renderStudyOptionRelationship(option) {
  if (!option) return "";
  const application = option.application || {};
  const relationship = application.reason || option.application_relationship || "";
  const classification = applicationClasses(option).join(" · ");
  const courseUrl = /^https?:\/\//i.test(option.course_url || "") ? safeUrl(option.course_url) : "";
  const codes = Array.isArray(option.ucas_course_codes) ? option.ucas_course_codes.filter(Boolean) : [];
  const code = option.catalog_code || codes.join(", ");
  const { courseCode } = admissionsProgramLabel(option);
  if (!classification && !relationship && !courseUrl && !code && !courseCode) return "";
  return `<div class="admissions-programs__relationship">
    ${classification ? `<p><strong>${escapeHtml(label("application_shape"))}:</strong> ${escapeHtml(classification)}</p>` : ""}
    ${option.levels?.includes("undergraduate") && option.awards?.includes("MEng") && option.catalog_classification === "ucas_course_choice" ? `<p data-integrated-meng>${escapeHtml(t("university.admissions.reading.integrated_meng"))}</p>` : ""}
    ${relationship ? `<details class="admissions-catalog__evidence"><summary>${escapeHtml(label("detail"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><p>${escapeHtml(relationship)}</p></details>` : ""}
    ${code ? `<p><strong>${escapeHtml(label("catalog_code"))}:</strong> ${escapeHtml(code)}</p>` : ""}
    ${courseCode ? `<p class="admissions-context__note" data-course-code-help>${escapeHtml(tFormat("university.admissions.reading.mit_course_help", { code: courseCode }))}</p>` : ""}
    ${courseUrl ? `<a href="${escapeHtmlAttr(courseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label("official_course_page"))}</a>` : ""}
  </div>`;
}

export function mountAdmissionsCatalog(institutionId) {
  const card = document.getElementById("detailCard");
  const tabs = card.querySelector(".d-tabs");
  let tabNavigation = document.getElementById("admissionsTabNavigation");
  if (!tabNavigation) {
    tabNavigation = document.createElement("div");
    tabNavigation.id = "admissionsTabNavigation";
    tabNavigation.className = "admissions-tabs-navigation";
    tabs.before(tabNavigation);
    tabNavigation.append(tabs);
    tabNavigation.insertAdjacentHTML("afterbegin", '<button type="button" data-tabs-previous></button>');
    tabNavigation.insertAdjacentHTML("beforeend", '<button type="button" data-tabs-next></button>');
  }
  const previousTabs = tabNavigation.querySelector("[data-tabs-previous]");
  const nextTabs = tabNavigation.querySelector("[data-tabs-next]");
  for (const [button, key, icon] of [[previousTabs, "previous_tabs", "chevron-left"], [nextTabs, "next_tabs", "chevron-right"]]) {
    button.setAttribute("aria-label", t(`university.admissions.reading.${key}`));
    button.innerHTML = heroIcon(icon, "ui-icon ui-icon--16");
  }
  const updateTabArrows = () => {
    previousTabs.disabled = tabs.scrollLeft <= 1;
    nextTabs.disabled = tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1;
  };
  previousTabs.onclick = () => tabs.scrollBy({ left: -tabs.clientWidth * 0.7, behavior: "smooth" });
  nextTabs.onclick = () => tabs.scrollBy({ left: tabs.clientWidth * 0.7, behavior: "smooth" });
  const onTabClick = event => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    if (tabs.scrollWidth > tabs.clientWidth) {
      tabs.scrollTo({ left: Math.max(0, button.offsetLeft - tabs.clientWidth / 2 + button.offsetWidth / 2), behavior: "smooth" });
    }
    if (event.isTrusted && window.matchMedia("(max-width: 768px)").matches) tabNavigation.scrollIntoView({ block: "start" });
  };
  tabs.addEventListener("scroll", updateTabArrows, { passive: true });
  tabs.addEventListener("click", onTabClick);
  window.addEventListener("resize", updateTabArrows);
  let root = document.getElementById("admissionsContext");
  if (!root) {
    root = document.createElement("section");
    root.id = "admissionsContext";
    root.className = "admissions-context";
    card.querySelector("#tab-admission .d-box").prepend(root);
  }
  const universityInfo = document.createElement("div");
  universityInfo.id = "admissionsUniversityInfo";
  document.getElementById("detailExtra").append(universityInfo);
  const targets = {
    detailRequirements: ["requirements", "application", "offer_enrollment"],
    detailDeadlines: ["deadlines"], detailFinance: ["costs", "funding"],
    admissionsUniversityInfo: ["institution", "student_support", "other"],
    admissionsStudyInfo: ["study", "degree_completion", "career"],
  };
  card.querySelector(".finance-summary-container").hidden = true;
  card.querySelector(".qualification-guidance").hidden = true;
  card.querySelector(".university-coverage-section").hidden = true;
  card.querySelector("#tab-admission .d-box-title").hidden = true;
  for (const [selector, key] of [
    ['#tab-programs .d-box-title', "study_options_title"],
    ['#tab-programs > .d-box > .d-box-note', "browse_note"],
    ['#tab-admission .d-box-title', "admission_title"],
    ['#tab-deadlines .d-box-title', "deadlines_title"],
    ['#tab-deadlines > .d-box > .d-box-note', "deadlines_intro"],
    ['#tab-finance .finance-section-header .d-box-note', "finance_intro"],
  ]) {
    const element = card.querySelector(selector);
    element.removeAttribute("data-i18n");
    element.textContent = label(key);
  }
  let context = readAdmissionContext(new URL(window.location.href), loadProfileForApi(), institutionId);
  let expandedProgramId = context.study_option_id;
  const selectionSummary = document.getElementById("admissionsReferenceSummary");
  let resolved = null;
  let contextAbort = null;
  let catalogAbort = null;
  let disposed = false;
  let contextSelectDisposers = [];
  let saveStatus = "";
  let advancedOpen = false;
  const browsing = browsingByInstitution.get(institutionId) || {};
  let search = browsing.search || "";
  let searchLanguage = browsing.language || getCurrentLanguage();
  let filterLevel = browsing.level || "";
  let page = browsing.page || 1;
  let total = 0;
  let items = [];
  const limit = 24;
  const currentPage = () => !disposed && root.isConnected && document.body.dataset.page === "university";
  const setUrl = () => window.history.pushState({}, "", admissionContextUrl(window.location.href, context));
  const empty = (message) => `<p class="admissions-state">${escapeHtml(message)}</p>`;
  const loading = () => `<div class="admissions-state" role="status"><div class="center-loading-spinner"></div><span>${escapeHtml(label("loading"))}</span></div>`;
  const failure = (retry) => `<div class="admissions-state" role="alert"><p>${escapeHtml(label("load_error"))}</p><button type="button" data-admissions-retry="${retry}">${escapeHtml(label("retry"))}</button></div>`;

  function renderSelectionSummary(option, route) {
    if (!selectionSummary) return;
    selectionSummary.hidden = !option;
    if (!option) return;
    const scope = [
      ...(option.awards || []),
      route ? routeName(route) : label("route_not_selected"),
      context.applicant_route ? label(`applicant.${context.applicant_route}`) : "",
      admissionsCycleLabel(context.intended_entry_cycle),
      context.fee_status_context && context.fee_status_context !== "unknown" ? label(`fee.${context.fee_status_context}`) : "",
    ].filter(Boolean);
    const applicationShape = applicationClasses(option).join(" · ");
    selectionSummary.innerHTML = `<div class="admissions-selection__text"><div class="admissions-selection__primary"><span>${escapeHtml(label("reference_scope"))}</span><strong>${escapeHtml(admissionsProgramLabel(option).title)}</strong></div><span>${scope.map(value => escapeHtml(value)).join(" · ")}</span>${applicationShape ? `<span class="admissions-selection__relationship">${escapeHtml(applicationShape)}</span>` : ""}</div>
      <div class="admissions-selection__actions"><button type="button" data-admissions-open-tab="tab-programs">${escapeHtml(label("change_program"))}</button><button type="button" data-admissions-open-tab="tab-admission">${escapeHtml(label(route ? "change_route" : "choose_route_action"))}</button></div>`;
    selectionSummary.querySelectorAll("[data-admissions-open-tab]").forEach((button) => {
      button.onclick = () => {
        document.querySelector(`[data-tab="${button.dataset.admissionsOpenTab}"]`)?.click();
        if (button.dataset.admissionsOpenTab === "tab-programs") document.getElementById("admissionsSearch")?.focus();
        else root.scrollIntoView({ block: "start" });
      };
    });
  }

  function renderControls(status = "ready") {
    advancedOpen = root.querySelector("#admissionsAdvanced")?.open ?? advancedOpen;
    contextSelectDisposers.forEach((dispose) => dispose());
    contextSelectDisposers = [];
    const option = resolved?.selected_option;
    const route = resolved?.selected_route;
    const routes = resolved?.available_routes || [];
    const incompatible = resolved && Object.values(resolved.context_applicability).includes("mismatched");
    const resetPending = loadProfile()?.admissionChoiceResetNotices?.includes(institutionId);
    const legacyPending = !context.study_option_id && new URL(window.location.href).searchParams.has("admission_program");
    const canSave = status === "ready" && option && route && ["option", "route", "level"].every((key) => resolved.context_applicability[key] === "matched");
    const cycles = [...new Set((resolved?.facts || []).map(row => row.scope?.cycle).filter(value => typeof value === "string" && value.length <= 40))];
    root.dataset.state = status;
    const destination = getApplicationLink(resolved);
    root.innerHTML = `<div class="admissions-context__heading"><div><h2>${escapeHtml(label("simple_title"))}</h2>${route ? "" : `<p>${escapeHtml(label("route_intro"))}</p>`}</div>
        ${!option ? `<button type="button" id="admissionsChooseProgram">${escapeHtml(label("browse_programs"))}</button>` : ""}</div>
      ${legacyPending ? `<p class="admissions-context__note">${escapeHtml(label("legacy_pending"))}</p>` : ""}
      ${resetPending ? `<p class="admissions-context__note" data-admission-reset-notice>${escapeHtml(label("reset_notice"))}</p>` : ""}
      <form id="admissionsContextForm" class="admissions-context__form" ${option ? "" : "hidden"}>
        <div class="admissions-context__primary">
        ${selectHtml("admissionsRoute", label("route_label"), [["", label("choose_route")], ...routes.map((row) => [row.id, routeName(row)])], context.application_route_id, !option || status === "loading")}
        <div class="admissions-context__actions"><button type="submit" id="admissionsContextApply" class="${route ? "is-applied" : ""}" ${status === "loading" || !option ? "disabled" : ""}>${escapeHtml(route ? t("university.admissions.reading.update_selection") : label("show_requirements"))}</button></div>
        </div>
        <details id="admissionsAdvanced" class="admissions-context__advanced" data-admissions-advanced ${advancedOpen ? "open" : ""}><summary>${escapeHtml(label("reference_filters"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary>
        <div class="admissions-context__fields">
        ${selectHtml("admissionsApplicant", label("applicant_label"), [["", label("unspecified")], ...["first_year", "transfer", "graduate"].map((value) => [value, label(`applicant.${value}`)])], context.applicant_route)}
        <label class="admissions-context__field" for="admissionsCycle"><span>${escapeHtml(label("cycle_label"))}</span><input id="admissionsCycle" type="text" maxlength="40" list="admissionsCycleOptions" aria-describedby="admissionsCycleHelp admissionsCycleNotice" value="${escapeHtmlAttr(context.intended_entry_cycle)}" placeholder="${escapeHtmlAttr(label("cycle_example"))}"></label>
        <datalist id="admissionsCycleOptions">${cycles.map(value => `<option value="${escapeHtmlAttr(value)}"></option>`).join("")}</datalist>
        ${selectHtml("admissionsFee", label("fee_label"), ["unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"].map((value) => [value, label(`fee.${value}`)]), context.fee_status_context)}
        </div><p class="admissions-context__note" id="admissionsCycleHelp">${escapeHtml(t("university.admissions.reading.cycle_help"))}</p><p class="admissions-context__note" id="admissionsCycleNotice" role="status" hidden>${escapeHtml(t("university.admissions.reading.cycle_invalid"))}</p></details>
      </form>
      <div class="admissions-context__actions" ${option ? "" : "hidden"}>${destination ? `<a class="admissions-application-link" href="${escapeHtmlAttr(destination)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.reading.official_application"))}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16")}</a>` : ""}<button type="button" id="admissionsSaveChoice" ${canSave ? "" : "disabled"}>${escapeHtml(label("save_choice"))}</button><span id="admissionsSaveStatus" class="admissions-context__note" role="status">${saveStatus ? escapeHtml(label(saveStatus)) : ""}</span></div>
      <div class="admissions-context__status" aria-live="polite">${status === "loading" ? loading() : status === "error" ? failure("context") : incompatible ? empty(label("incompatible_context")) : !option ? empty(label("choose_program_hint")) : !route ? empty(label("route_required")) : ""}</div>`;
    renderSelectionSummary(option, route);
    if (status === "loading") root.querySelectorAll("select, input").forEach((element) => { element.disabled = true; });
    contextSelectDisposers = ["admissionsRoute", "admissionsApplicant", "admissionsFee"].map(initCustomSelect);
    root.querySelector("#admissionsChooseProgram")?.addEventListener("click", () => {
      document.querySelector('[data-tab="tab-programs"]').click();
      document.getElementById("admissionsSearch").focus();
    });
    root.querySelector("#admissionsContextForm").onsubmit = (event) => {
      event.preventDefault();
      context.application_route_id = root.querySelector("#admissionsRoute").value;
      context.applicant_route = root.querySelector("#admissionsApplicant").value;
      context.intended_entry_cycle = normalizeAdmissionCycle(root.querySelector("#admissionsCycle").value);
      context.fee_status_context = root.querySelector("#admissionsFee").value;
      saveStatus = "";
      setUrl();
      void refreshContext();
    };
    root.querySelectorAll("#admissionsContextForm input, #admissionsContextForm select").forEach((field) => {
      const onDraftChange = () => {
        root.querySelector("#admissionsSaveChoice").disabled = true;
        saveStatus = "apply_before_save";
        root.querySelector("#admissionsSaveStatus").textContent = label(saveStatus);
      };
      field.addEventListener("input", onDraftChange);
      field.addEventListener("change", onDraftChange);
    });
    const cycleInput = root.querySelector("#admissionsCycle");
    const updateCycleNotice = () => {
      const value = normalizeAdmissionCycle(cycleInput.value);
      root.querySelector("#admissionsCycleNotice").hidden = !value || /^(?:20\d{2}(?: entry|-(?:\d{2}|20\d{2}) entry)?|(?:Fall|Autumn|Spring) 20\d{2}(?: entry)?|20\d{2} (?:Fall|Autumn|Spring))$/i.test(value);
    };
    cycleInput.addEventListener("input", updateCycleNotice);
    updateCycleNotice();
    root.querySelector("#admissionsSaveChoice").onclick = () => {
      const persisted = saveSelectedAdmissionChoice(institutionId, {
        studyOptionId: context.study_option_id, applicationRouteId: context.application_route_id,
        studyLevel: context.study_level, applicantRoute: context.applicant_route,
        intendedEntryCycle: context.intended_entry_cycle, feeStatusContext: context.fee_status_context,
      });
      saveStatus = persisted ? "choice_saved" : "choice_session_only";
      root.querySelector("#admissionsSaveStatus").textContent = label(saveStatus);
    };
    root.querySelector('[data-admissions-retry="context"]')?.addEventListener("click", refreshContext);
  }

  function renderContextContent(status) {
    const option = resolved?.selected_option;
    studyDetails.querySelector("h3").textContent = stabilizeNumericRanges(option ? admissionsProgramLabel(option).title : label("study_info"));
    document.getElementById("admissionsStudyRelationship").innerHTML = renderStudyOptionRelationship(option);
    document.getElementById("admissionsStudyOverview").innerHTML = status === "ready" ? renderStudyOptionOverview(resolved) : "";
    studyDetails.querySelector("#admissionsViewRequirements").disabled = status !== "ready" || !option;
    renderProgramSelection(status);
    for (const [id, domains] of Object.entries(targets)) {
      const target = document.getElementById(id);
      const programOnly = id === "admissionsStudyInfo" && !resolved?.selected_route;
      if (id === "admissionsUniversityInfo") {
        target.hidden = status !== "ready" || !option || !resolved?.selected_route;
      }
      if (status === "loading") target.innerHTML = loading();
      else if (status === "error") {
        target.innerHTML = failure("context");
        target.querySelector("button").onclick = refreshContext;
      } else if (id === "detailRequirements" && (!option || !resolved?.selected_route)) target.innerHTML = "";
      else if (!option || (!resolved?.selected_route && !programOnly)) {
        target.innerHTML = `<div class="admissions-state"><p>${escapeHtml(label(option ? "route_required" : "choose_program_hint"))}</p><button type="button">${escapeHtml(label(option ? "choose_route" : "browse_programs"))}</button></div>`;
        target.querySelector("button").onclick = () => {
          document.querySelector(`[data-tab="tab-${option ? "admission" : "programs"}"]`).click();
          (option ? root : programs).scrollIntoView({ block: "start" });
        };
      }
      else if (["detailRequirements", "detailDeadlines", "detailFinance"].includes(id)) target.innerHTML = renderApplicantSection(resolved, domains);
      else target.innerHTML = renderAdmissionsContext(resolved, {
        domains, includeAssessment: id === "detailRequirements", includeUnknowns: id === "detailRequirements",
        includeHistory: id === "admissionsUniversityInfo", presentation: "simple", programOnly,
        includeSourceNote: !["detailFinance", "detailDeadlines", "admissionsStudyInfo"].includes(id),
      });
    }
  }

  async function refreshContext() {
    contextAbort?.abort();
    const request = contextAbort = new AbortController();
    renderControls("loading");
    renderContextContent("loading");
    try {
      const response = await fetch(`${API_BASE}/universities/${encodeURIComponent(institutionId)}/admissions-context`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal,
        body: JSON.stringify(admissionsRequest(loadProfileForApi(), context, institutionId)),
      });
      if (!response.ok) throw new Error(`Admissions context HTTP ${response.status}`);
      const data = await response.json();
      if (request !== contextAbort || !currentPage()) return;
      resolved = data;
      renderControls();
      renderContextContent("ready");
    } catch (error) {
      if (request.signal.aborted || request !== contextAbort || !currentPage()) return;
      resolved = null;
      renderControls("error");
      renderContextContent("error");
    }
  }

  const programs = document.getElementById("detailPrograms");
  programs.classList.add("admissions-programs");
  programs.innerHTML = `<form class="admissions-programs__toolbar" id="admissionsSearchForm">
      <label class="admissions-context__field" for="admissionsSearch"><span>${escapeHtml(label("search_label"))}</span><span class="program-search">${heroIcon("magnifying-glass", "ui-icon ui-icon--18 program-search__icon")}<input class="program-search__input" type="search" id="admissionsSearch" value="${escapeHtmlAttr(search)}" maxlength="200" placeholder="${escapeHtmlAttr(t("university.programs.search_placeholder"))}"></span></label>
      ${selectHtml("admissionsStudyLevel", label("level_label"), [["", label("all_levels")], ...LEVELS.map((value) => [value, label(`level.${value}`)])], filterLevel)}
      <button type="submit" id="admissionsSearchSubmit">${escapeHtml(label("search"))}</button>
    </form><article id="admissionsSelectedProgram" class="program-card" hidden><div data-selected-program-heading></div></article>
    <section id="admissionsStudyDetails" class="admissions-study program-card__body" role="region" aria-labelledby="admissionsStudyTitle" hidden>
      <div class="admissions-context__heading sr-only"><h3 id="admissionsStudyTitle"></h3></div>
      <div class="program-card__body-inner">
      <div id="admissionsStudyOverview" class="admissions-programs__overview"></div>
      <div id="admissionsStudyRelationship"></div>
      <div class="program-card__actions"><button type="button" class="program-card__admission-action" id="admissionsViewRequirements">${escapeHtml(label("view_requirements"))}${heroIcon("chevron-right", "ui-icon ui-icon--16")}</button></div>
      <p class="admissions-context__note">${escapeHtml(label("study_info_note"))}</p>
      <div id="admissionsStudyInfo"></div>
      </div>
    </section><div id="admissionsProgramList" class="admissions-programs__list program-list" role="list"></div>
    <div class="admissions-programs__pagination"><button type="button" id="admissionsPrevious">${heroIcon("chevron-left", "ui-icon ui-icon--16")}${escapeHtml(label("previous"))}</button><span id="admissionsProgramCount" class="admissions-programs__count" aria-live="polite"></span><button type="button" id="admissionsNext">${escapeHtml(label("next"))}${heroIcon("chevron-right", "ui-icon ui-icon--16")}</button></div>`;
  const disposeProgramSelect = initCustomSelect("admissionsStudyLevel");
  const studyDetails = programs.querySelector("#admissionsStudyDetails");
  const selectedProgramHost = programs.querySelector("#admissionsSelectedProgram");
  const list = programs.querySelector("#admissionsProgramList");
  const previous = programs.querySelector("#admissionsPrevious");
  const next = programs.querySelector("#admissionsNext");
  const submit = programs.querySelector("#admissionsSearchSubmit");
  programs.querySelector("#admissionsViewRequirements").onclick = () => {
    document.querySelector('[data-tab="tab-admission"]').click();
    root.scrollIntoView({ block: "start" });
  };

  function programToggle(option) {
    const { title, officialTitle, courseCode } = admissionsProgramLabel(option);
    const original = getCurrentLanguage() !== "eng" && title !== officialTitle ? officialTitle : "";
    return `<button type="button" class="admissions-programs__option program-card__toggle" data-study-option="${escapeHtmlAttr(option.id)}" aria-expanded="false" aria-controls="admissionsStudyDetails">
      <span class="program-card__text"><span class="program-card__kicker">${escapeHtml(option.levels.map(value => label(`level.${value}`)).join(" · "))}</span><span class="admissions-programs__option-title program-card__title">${escapeHtml(title)}</span>${original ? `<span class="admissions-programs__original" lang="en">${escapeHtml(original)}</span>` : ""}<span class="program-card__summary">${escapeHtml(option.awards.join(" · "))}${courseCode ? ` · ${escapeHtml(tFormat("university.admissions.reading.mit_course_code", { code: courseCode }))}` : ""}</span></span>
      <span class="program-card__chevron" aria-hidden="true">${heroIcon("chevron-right", "ui-icon ui-icon--16")}</span></button>`;
  }

  function renderProgramSelection(status = root.dataset.state) {
    selectedProgramHost.append(studyDetails);
    const option = resolved?.selected_option || items.find(row => row.id === context.study_option_id);
    const selectedButton = [...list.querySelectorAll("[data-study-option]")].find(button => button.dataset.studyOption === context.study_option_id);
    selectedProgramHost.hidden = !context.study_option_id || Boolean(selectedButton);
    const heading = selectedProgramHost.querySelector("[data-selected-program-heading]");
    if (selectedProgramHost.hidden) heading.replaceChildren();
    else if (heading.querySelector("[data-study-option]")?.dataset.studyOption !== option?.id) heading.innerHTML = option ? programToggle(option) : "";
    if (selectedButton) selectedButton.closest(".program-card").append(studyDetails);
    studyDetails.hidden = !context.study_option_id || expandedProgramId !== context.study_option_id;
    programs.querySelectorAll("[data-study-option]").forEach(button => {
      const open = button.dataset.studyOption === expandedProgramId;
      button.setAttribute("aria-expanded", String(open));
      if (button.dataset.studyOption !== context.study_option_id) button.removeAttribute("aria-controls");
      else button.setAttribute("aria-controls", "admissionsStudyDetails");
      button.closest(".program-card").classList.toggle("is-open", open);
    });
    selectedProgramHost.classList.toggle("is-open", !studyDetails.hidden);
    if (status === "loading") studyDetails.setAttribute("aria-busy", "true");
    else studyDetails.removeAttribute("aria-busy");
  }

  const onProgramClick = event => {
    const button = event.target.closest("[data-study-option]");
    if (!button) return;
    if (button.dataset.studyOption === context.study_option_id) {
      expandedProgramId = expandedProgramId === context.study_option_id ? "" : context.study_option_id;
      renderProgramSelection();
      return;
    }
    const option = items.find(row => row.id === button.dataset.studyOption);
    if (!option) return;
    context.study_option_id = option.id;
    expandedProgramId = option.id;
    context.application_route_id = "";
    advancedOpen = false;
    root.querySelector("#admissionsAdvanced").open = false;
    saveStatus = "";
    if (option.levels.length === 1) {
      if (context.study_level !== option.levels[0]) context.applicant_route = "";
      context.study_level = option.levels[0];
    } else context.study_level = filterLevel;
    resolved = { selected_option: option, available_routes: [], context_applicability: {} };
    setUrl();
    void refreshContext();
  };
  programs.addEventListener("click", onProgramClick);

  async function refreshPrograms() {
    catalogAbort?.abort();
    const request = catalogAbort = new AbortController();
    selectedProgramHost.append(studyDetails);
    selectedProgramHost.hidden = !context.study_option_id;
    list.innerHTML = loading();
    previous.disabled = next.disabled = submit.disabled = true;
    try {
      const query = new URLSearchParams({ search, page, limit, lang: searchLanguage });
      if (filterLevel) query.set("study_level", filterLevel);
      const response = await fetch(`${API_BASE}/universities/${encodeURIComponent(institutionId)}/study-options?${query}`, { signal: request.signal });
      if (!response.ok) throw new Error(`Study options HTTP ${response.status}`);
      const data = await response.json();
      if (request !== catalogAbort || !currentPage()) return;
      items = data.items;
      total = data.total;
      list.innerHTML = items.length ? items.map(option => `<article class="program-card" role="listitem">${programToggle(option)}</article>`).join("") : empty(label("no_options"));
      renderProgramSelection();
      programs.querySelector("#admissionsProgramCount").textContent = tFormat("university.admissions.catalog.results", { from: total ? (page - 1) * limit + 1 : 0, to: Math.min(page * limit, total), total });
      previous.disabled = page === 1;
      next.disabled = page * limit >= total;
    } catch (error) {
      if (request.signal.aborted || request !== catalogAbort || !currentPage()) return;
      list.innerHTML = failure("programs");
      list.querySelector("button").onclick = refreshPrograms;
      programs.querySelector("#admissionsProgramCount").textContent = "";
    } finally {
      if (request === catalogAbort && currentPage()) submit.disabled = false;
    }
  }
  programs.querySelector("#admissionsSearchForm").onsubmit = (event) => {
    event.preventDefault();
    const nextSearch = programs.querySelector("#admissionsSearch").value.trim();
    if (nextSearch !== search) searchLanguage = getCurrentLanguage();
    search = nextSearch;
    filterLevel = programs.querySelector("#admissionsStudyLevel").value;
    page = 1;
    void refreshPrograms();
  };
  programs.querySelector("#admissionsStudyLevel").addEventListener("change", () => programs.querySelector("#admissionsSearchForm").requestSubmit());
  programs.querySelector("#admissionsSearch").addEventListener("search", event => {
    if (!event.target.value) programs.querySelector("#admissionsSearchForm").requestSubmit();
  });
  previous.onclick = () => { page -= 1; void refreshPrograms(); };
  next.onclick = () => { page += 1; void refreshPrograms(); };
  const onProfile = () => {
    context = readAdmissionContext(new URL(window.location.href), loadProfileForApi(), institutionId);
    expandedProgramId = context.study_option_id;
    void refreshContext();
  };
  window.addEventListener("profileUpdated", onProfile);
  window.addEventListener("popstate", onProfile);
  const ready = Promise.all([refreshPrograms(), refreshContext()]);
  void ready.then(updateTabArrows);
  const dispose = () => {
    browsingByInstitution.set(institutionId, { search, language: searchLanguage, level: filterLevel, page });
    disposed = true;
    contextAbort?.abort();
    catalogAbort?.abort();
    contextSelectDisposers.forEach((dispose) => dispose());
    disposeProgramSelect();
    programs.removeEventListener("click", onProgramClick);
    tabs.removeEventListener("scroll", updateTabArrows);
    tabs.removeEventListener("click", onTabClick);
    window.removeEventListener("resize", updateTabArrows);
    window.removeEventListener("profileUpdated", onProfile);
    window.removeEventListener("popstate", onProfile);
  };
  return { ready, dispose };
}
