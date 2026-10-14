import { API_BASE, escapeHtml, escapeHtmlAttr, initCustomSelect, loadProfile, loadProfileForApi, saveSelectedAdmissionChoice, stabilizeNumericRanges } from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { admissionsRouteName, renderAdmissionsContext } from "./admissions-render.js";
import { safeUrl } from "../_shared.js";
import { heroIcon } from "../../icons.js";

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
  const classification = relationship ? "" : applicationClasses(option).join(" · ");
  const courseUrl = /^https?:\/\//i.test(option.course_url || "") ? safeUrl(option.course_url) : "";
  const codes = Array.isArray(option.ucas_course_codes) ? option.ucas_course_codes.filter(Boolean) : [];
  const code = option.catalog_code || codes.join(", ");
  if (!classification && !relationship && !courseUrl && !code) return "";
  return `<div class="admissions-programs__relationship">
    ${classification ? `<p><strong>${escapeHtml(label("application_shape"))}:</strong> ${escapeHtml(classification)}</p>` : ""}
    ${relationship ? `<p>${escapeHtml(relationship)}</p>` : ""}
    ${code ? `<p><strong>${escapeHtml(label("catalog_code"))}:</strong> ${escapeHtml(code)}</p>` : ""}
    ${courseUrl ? `<a href="${escapeHtmlAttr(courseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label("official_course_page"))}</a>` : ""}
  </div>`;
}

export function mountAdmissionsCatalog(institutionId) {
  const card = document.getElementById("detailCard");
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
  const selectionSummary = document.getElementById("admissionsReferenceSummary");
  let resolved = null;
  let contextAbort = null;
  let catalogAbort = null;
  let disposed = false;
  let contextSelectDisposers = [];
  let saveStatus = "";
  let advancedOpen = false;
  let search = "";
  let filterLevel = "";
  let page = 1;
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
      route ? routeName(route) : label("route_not_selected"),
      context.applicant_route ? label(`applicant.${context.applicant_route}`) : "",
      context.intended_entry_cycle,
      context.fee_status_context && context.fee_status_context !== "unknown" ? label(`fee.${context.fee_status_context}`) : "",
    ].filter(Boolean);
    const applicationShape = applicationClasses(option).join(" · ");
    selectionSummary.innerHTML = `<div class="admissions-selection__text"><div class="admissions-selection__primary"><span>${escapeHtml(label("reference_scope"))}</span><strong>${escapeHtml(option.title)}</strong></div><span>${scope.map(value => escapeHtml(value)).join(" · ")}</span>${applicationShape ? `<span class="admissions-selection__relationship">${escapeHtml(applicationShape)}</span>` : ""}</div>
      <div class="admissions-selection__actions"><button type="button" data-admissions-open-tab="tab-programs">${escapeHtml(label("change_program"))}</button><button type="button" data-admissions-open-tab="tab-admission">${escapeHtml(label(route ? "change_route" : "choose_route"))}</button></div>`;
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
    root.dataset.state = status;
    const destination = /^https?:\/\//i.test(route?.destination || "") ? safeUrl(route.destination) : "";
    root.innerHTML = `<div class="admissions-context__heading"><div><h2>${escapeHtml(label("simple_title"))}</h2><p>${escapeHtml(label("route_intro"))}</p></div>
        ${!option ? `<button type="button" id="admissionsChooseProgram">${escapeHtml(label("browse_programs"))}</button>` : ""}</div>
      ${legacyPending ? `<p class="admissions-context__note">${escapeHtml(label("legacy_pending"))}</p>` : ""}
      ${resetPending ? `<p class="admissions-context__note" data-admission-reset-notice>${escapeHtml(label("reset_notice"))}</p>` : ""}
      <form id="admissionsContextForm" class="admissions-context__form">
        <div class="admissions-context__primary">
        ${selectHtml("admissionsRoute", label("route_label"), [["", label("choose_route")], ...routes.map((row) => [row.id, routeName(row)])], context.application_route_id, !option || status === "loading")}
        <div class="admissions-context__actions"><button type="submit" id="admissionsContextApply" ${status === "loading" || !option ? "disabled" : ""}>${escapeHtml(label("show_requirements"))}</button></div>
        </div>
        <details id="admissionsAdvanced" class="admissions-context__advanced" data-admissions-advanced ${advancedOpen ? "open" : ""}><summary>${escapeHtml(label("reference_filters"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary>
        <div class="admissions-context__fields">
        ${selectHtml("admissionsApplicant", label("applicant_label"), [["", label("unspecified")], ...["first_year", "transfer", "graduate"].map((value) => [value, label(`applicant.${value}`)])], context.applicant_route)}
        <label class="admissions-context__field" for="admissionsCycle"><span>${escapeHtml(label("cycle_label"))}</span><input id="admissionsCycle" type="text" maxlength="40" value="${escapeHtmlAttr(context.intended_entry_cycle)}" placeholder="${escapeHtmlAttr(label("cycle_example"))}"></label>
        ${selectHtml("admissionsFee", label("fee_label"), ["unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"].map((value) => [value, label(`fee.${value}`)]), context.fee_status_context)}
        </div><p class="admissions-context__note">${escapeHtml(label("reference_filter_note"))}</p></details>
      </form>
      <div class="admissions-context__actions"><button type="button" id="admissionsSaveChoice" ${canSave ? "" : "disabled"}>${escapeHtml(label("save_choice"))}</button><span id="admissionsSaveStatus" class="admissions-context__note" role="status">${saveStatus ? escapeHtml(label(saveStatus)) : ""}</span></div>
      ${route ? `<p class="admissions-context__summary">${escapeHtml(label("selected_route"))}: ${escapeHtml(routeName(route))}${destination ? ` · <a href="${escapeHtmlAttr(destination)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label("open_application"))}</a>` : ""}</p>` : ""}
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
      context.intended_entry_cycle = root.querySelector("#admissionsCycle").value.trim();
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
    const studyDetails = document.getElementById("admissionsStudyDetails");
    studyDetails.hidden = !context.study_option_id;
    studyDetails.querySelector("h3").textContent = stabilizeNumericRanges(option?.title || label("study_info"));
    document.getElementById("admissionsStudyRelationship").innerHTML = renderStudyOptionRelationship(option);
    studyDetails.querySelector("#admissionsViewRequirements").disabled = status !== "ready" || !option;
    document.querySelectorAll("#admissionsProgramList [data-study-option]").forEach((row) => row.setAttribute("aria-pressed", String(row.dataset.studyOption === context.study_option_id)));
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
      } else if (!option || (!resolved?.selected_route && !programOnly)) target.innerHTML = empty(label("no_context"));
      else target.innerHTML = (id === "detailFinance" ? `<p class="admissions-context__note">${escapeHtml(label("finance_note"))}</p>` : "") + renderAdmissionsContext(resolved, {
        domains, includeAssessment: id === "detailRequirements", includeUnknowns: id === "detailRequirements",
        includeHistory: id === "admissionsUniversityInfo", presentation: "simple", programOnly,
        includeSourceNote: !["detailFinance", "detailDeadlines"].includes(id),
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
      <label class="admissions-context__field" for="admissionsSearch"><span>${escapeHtml(label("search_label"))}</span><input type="search" id="admissionsSearch" maxlength="200"></label>
      ${selectHtml("admissionsStudyLevel", label("level_label"), [["", label("all_levels")], ...LEVELS.map((value) => [value, label(`level.${value}`)])], "")}
      <button type="submit" id="admissionsSearchSubmit">${escapeHtml(label("search"))}</button>
    </form><section id="admissionsStudyDetails" class="admissions-study" hidden>
      <div class="admissions-context__heading"><h3></h3><div class="admissions-context__actions"><button type="button" id="admissionsViewRequirements">${escapeHtml(label("view_requirements"))}</button></div></div>
      <p class="admissions-context__note">${escapeHtml(label("study_info_note"))}</p>
      <div id="admissionsStudyRelationship"></div>
      <div id="admissionsStudyInfo"></div>
    </section><div id="admissionsProgramList" class="admissions-programs__list"></div>
    <div class="admissions-programs__pagination"><button type="button" id="admissionsPrevious">${escapeHtml(label("previous"))}</button><span id="admissionsProgramCount" aria-live="polite"></span><button type="button" id="admissionsNext">${escapeHtml(label("next"))}</button></div>`;
  const disposeProgramSelect = initCustomSelect("admissionsStudyLevel");
  const list = programs.querySelector("#admissionsProgramList");
  const previous = programs.querySelector("#admissionsPrevious");
  const next = programs.querySelector("#admissionsNext");
  const submit = programs.querySelector("#admissionsSearchSubmit");
  programs.querySelector("#admissionsViewRequirements").onclick = () => {
    document.querySelector('[data-tab="tab-admission"]').click();
    root.scrollIntoView({ block: "start" });
  };

  async function refreshPrograms() {
    catalogAbort?.abort();
    const request = catalogAbort = new AbortController();
    list.innerHTML = loading();
    previous.disabled = next.disabled = submit.disabled = true;
    try {
      const query = new URLSearchParams({ search, page, limit, lang: getCurrentLanguage() });
      if (filterLevel) query.set("study_level", filterLevel);
      const response = await fetch(`${API_BASE}/universities/${encodeURIComponent(institutionId)}/study-options?${query}`, { signal: request.signal });
      if (!response.ok) throw new Error(`Study options HTTP ${response.status}`);
      const data = await response.json();
      if (request !== catalogAbort || !currentPage()) return;
      items = data.items;
      total = data.total;
      list.innerHTML = items.length ? items.map((option) => `<button type="button" class="admissions-programs__option" data-study-option="${escapeHtmlAttr(option.id)}" aria-pressed="${option.id === context.study_option_id}"><strong class="admissions-programs__option-title">${escapeHtml(option.title)}</strong><span class="admissions-programs__option-levels">${escapeHtml([...option.levels.map((value) => label(`level.${value}`)), ...option.awards].join(" · "))}</span></button>`).join("") : empty(label("no_options"));
      list.querySelectorAll("[data-study-option]").forEach((button) => {
        button.onclick = () => {
          const option = items.find((row) => row.id === button.dataset.studyOption);
          context.study_option_id = option.id;
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
          document.getElementById("admissionsStudyDetails").scrollIntoView({ block: "start" });
        };
      });
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
    search = programs.querySelector("#admissionsSearch").value.trim();
    filterLevel = programs.querySelector("#admissionsStudyLevel").value;
    page = 1;
    void refreshPrograms();
  };
  previous.onclick = () => { page -= 1; void refreshPrograms(); };
  next.onclick = () => { page += 1; void refreshPrograms(); };
  const onProfile = () => {
    context = readAdmissionContext(new URL(window.location.href), loadProfileForApi(), institutionId);
    void refreshContext();
  };
  window.addEventListener("profileUpdated", onProfile);
  window.addEventListener("popstate", onProfile);
  const ready = Promise.all([refreshPrograms(), refreshContext()]);
  const dispose = () => {
    disposed = true;
    contextAbort?.abort();
    catalogAbort?.abort();
    contextSelectDisposers.forEach((dispose) => dispose());
    disposeProgramSelect();
    window.removeEventListener("profileUpdated", onProfile);
    window.removeEventListener("popstate", onProfile);
  };
  return { ready, dispose };
}
