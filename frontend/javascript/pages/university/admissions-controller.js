import { API_BASE, escapeHtml, escapeHtmlAttr, initCustomSelect, loadProfile, loadProfileForApi, saveSelectedAdmissionChoice, stabilizeNumericRanges } from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { translateProgramName } from "../../university-translations.js";
import { admissionsCycleLabel, admissionsProgramLabel, admissionsRouteName, studyOverviewCoverage, renderAdmissionsContext, renderStudyOptionOverview, renderStudyOptionSources } from "./admissions-render.js";
import { safeUrl } from "../_shared.js";
import { heroIcon } from "../../icons.js";
import { renderApplicantSection } from "./admissions-presentation.js";
import { getReviewedDeadlineEvents } from "./deadline-calendar.js";
import { mountDeadlineCalendar } from "./deadline-calendar-view.js";

export const REVIEWED_ADMISSIONS_IDS = new Set([
  "mit-usa-cambridge", "imperial-college-london-uk", "stanford-university-usa-ca", "nazarbayev-university-kaz-astana",
]);
const QUERY_KEYS = {
  study_option_id: "admission_option", application_route_id: "admission_application_route",
  study_level: "admission_level", applicant_route: "admission_route",
  intended_entry_cycle: "admission_cycle", fee_status_context: "admission_fee",
};
export const ADMISSION_LEVELS = ["preparation", "undergraduate", "masters", "doctoral", "professional", "residency", "non_degree"];
const LEVEL_ALIASES = { bachelor: "undergraduate", master: "masters", doctorate: "doctoral", phd: "doctoral" };
const label = (key) => t(`university.admissions.catalog.${key}`);
const routeName = (route) => admissionsRouteName(route, { presentation: "simple" });
const browsingByInstitution = new Map();

export function hasReadableAdmissionContext(resolved) {
  return Boolean(resolved?.selected_route && (resolved.selected_option || resolved.reading_scope === "institution_route"));
}

export function programProfileSuggestions(profile) {
  const level = String(profile?.study_level || "").toLowerCase();
  return { major: String(profile?.major || "").trim(), level: ADMISSION_LEVELS.includes(LEVEL_ALIASES[level] || level) ? LEVEL_ALIASES[level] || level : "" };
}

export function programRestriction(option) {
  if (["internal", "restricted"].includes(option.applicant_access)) return option.applicant_access;
  if (option.new_applicant_availability?.startsWith("not_open") || option.inventory_status === "officially_listed_but_recruitment_closed") return "restricted";
  if (["internal", "internal_by_special_approval", "internal_predoctoral_progression", "intermediate_doctoral_award", "terminal_award_on_doctoral_withdrawal"].includes(option.application?.classification)) return "internal";
  if (["restricted_joint_program_master", "restricted_special_admission"].includes(option.application?.classification)) return "restricted";
  return "";
}

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
  const declaredUrl = destination.match(/^https?:\/\/\S+/i);
  if (declaredUrl) return safeUrl(declaredUrl[0]);
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
  if (!ADMISSION_LEVELS.includes(context.study_level)) context.study_level = "";
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
    if (event.isTrusted) {
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = `#${button.dataset.tab}`;
      window.history.replaceState(window.history.state, "", nextUrl);
      if (window.matchMedia("(max-width: 768px)").matches) tabNavigation.scrollIntoView({ block: "start" });
    }
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
  const openProgramIds = new Set(context.study_option_id ? [context.study_option_id] : []);
  const selectionSummary = document.getElementById("admissionsReferenceSummary");
  let resolved = null;
  let calendarState = {};
  let contextAbort = null;
  let catalogAbort = null;
  const previews = new Map();
  let previewSerial = 0;
  let disposed = false;
  let contextSelectDisposers = [];
  let saveStatus = "";
  let contextDirty = false;
  let advancedOpen = false;
  const browsing = browsingByInstitution.get(institutionId) || {};
  const profileSuggestions = programProfileSuggestions(loadProfileForApi());
  let suggestedMajor = browsing.major ?? profileSuggestions.major;
  let search = browsing.search || "";
  let searchLanguage = browsing.language || getCurrentLanguage();
  let filterLevel = browsing.level ?? profileSuggestions.level;
  let suggestedLevel = browsing.suggestedLevel ?? Boolean(filterLevel && filterLevel === profileSuggestions.level);
  let page = browsing.page || 1;
  let total = 0;
  let items = [];
  let sharedRoutes = [];
  const limit = 8;
  const currentPage = () => !disposed && root.isConnected && document.body.dataset.page === "university";
  const setUrl = () => window.history.pushState({}, "", admissionContextUrl(window.location.href, context));
  const empty = (message) => `<p class="admissions-state">${escapeHtml(message)}</p>`;
  const loading = () => `<div class="admissions-state" role="status"><div class="center-loading-spinner"></div><span>${escapeHtml(label("loading"))}</span></div>`;
  const failure = (retry) => `<div class="admissions-state" role="alert"><p>${escapeHtml(label("load_error"))}</p><button type="button" data-admissions-retry="${retry}">${escapeHtml(label("retry"))}</button></div>`;

  function renderSelectionSummary(option, route) {
    if (!selectionSummary) return;
    selectionSummary.hidden = !option && !hasReadableAdmissionContext(resolved);
    if (selectionSummary.hidden) return;
    const programTitle = option ? admissionsProgramLabel(option, { includeAward: true }).title : routeName(route);
    const scope = [
      ...(option?.catalog_classification === "ucas_course_choice" ? [] : (option?.awards || []).filter(award => award !== programTitle)),
      option ? route ? routeName(route) : resolved.available_routes?.length ? label("route_not_selected") : t("university.admissions.reading.no_route_short") : "",
      context.applicant_route ? label(`applicant.${context.applicant_route}`) : "",
      admissionsCycleLabel(context.intended_entry_cycle),
      context.fee_status_context && context.fee_status_context !== "unknown" ? label(`fee.${context.fee_status_context}`) : "",
    ].filter(Boolean);
    selectionSummary.innerHTML = `<div class="admissions-selection__text"><div class="admissions-selection__primary"><span>${escapeHtml(label("reference_scope"))}</span><strong>${escapeHtml(programTitle)}</strong></div>${scope.length ? `<span>${[...new Set(scope)].map(value => escapeHtml(value)).join(" · ")}</span>` : ""}</div>
      <div class="admissions-selection__actions"><button type="button" data-admissions-open-tab="tab-admission" aria-controls="admissionsSelectionEditor" aria-expanded="${!route}">${escapeHtml(t("university.admissions.reading.update_selection"))}</button></div>`;
    selectionSummary.querySelectorAll("[data-admissions-open-tab]").forEach((button) => {
      button.onclick = () => {
        document.querySelector(`[data-tab="${button.dataset.admissionsOpenTab}"]`)?.click();
        const editor = root.querySelector("#admissionsSelectionEditor");
        editor.hidden = false;
        button.setAttribute("aria-expanded", "true");
        root.scrollIntoView({ block: "start" });
        editor.querySelector("button").focus();
      };
    });
  }

  function renderControls(status = "ready") {
    advancedOpen = root.querySelector("#admissionsAdvanced")?.open ?? advancedOpen;
    contextSelectDisposers.forEach((dispose) => dispose());
    contextSelectDisposers = [];
    const option = resolved?.selected_option;
    const routes = option ? resolved?.available_routes || [] : sharedRoutes;
    const sharedEntries = option ? sharedRoutes.filter(item => option.levels?.includes("undergraduate") && !option.route_ids?.includes(item.id)) : sharedRoutes;
    const readable = hasReadableAdmissionContext(resolved);
    const route = status === "loading"
      ? routes.find((row) => row.id === context.application_route_id) || null
      : resolved?.selected_route;
    const incompatible = resolved && Object.values(resolved.context_applicability).includes("mismatched");
    const noRoute = option && status === "ready" && !routes.length && !incompatible;
    const programSource = noRoute && resolved.sources?.find(source => option.source_ids?.includes(source.id) && safeUrl(source.url));
    const resetPending = loadProfile()?.admissionChoiceResetNotices?.includes(institutionId);
    const legacyPending = !context.study_option_id && new URL(window.location.href).searchParams.has("admission_program");
    const canSave = status === "ready" && readable && (option ? ["option", "route", "level"] : ["route", "level"]).every((key) => resolved.context_applicability[key] === "matched");
    const cycles = [...new Set((resolved?.facts || []).map(row => row.scope?.cycle).filter(value => typeof value === "string" && value.length <= 40))];
    const profile = loadProfileForApi();
    const profileHints = [profile.applicant_route ? label(`applicant.${profile.applicant_route}`) : "", admissionsCycleLabel(profile.intended_entry_cycle), profile.fee_status_context && profile.fee_status_context !== "unknown" ? label(`fee.${profile.fee_status_context}`) : ""].filter(Boolean);
    const routeHelp = item => t(`university.admissions.entry.route_help.${item.id.replaceAll(":", ".")}`);
    const explainedRoutes = routes.filter(item => routeHelp(item));
    const routeEntries = option && !route && routes.length > 0 && explainedRoutes.length === routes.length;
    const specialRoutes = option?.id === "stanford-option-cs-ms" || option?.id === "stanford-option-cs-phd"
      ? explainedRoutes.filter(item => item.id.startsWith("engineering-doerr-evidence:cs-")) : [];
    const routeOption = item => `<div class="admissions-route-option"><div class="admissions-context__actions"><button type="button" data-read-route="${escapeHtmlAttr(item.id)}" ${status === "loading" ? "disabled" : ""}>${escapeHtml(routeName(item))}</button></div><p class="admissions-context__note">${escapeHtml(routeHelp(item))}</p></div>`;
    root.dataset.state = status;
    const destination = status === "ready" && !contextDirty ? getApplicationLink(resolved) : "";
    root.innerHTML = `<div class="admissions-context__heading"><div><h2>${escapeHtml(label("simple_title"))}</h2>${route || noRoute ? "" : `<p>${escapeHtml(label("route_intro"))}</p>`}</div></div>
      ${legacyPending ? `<p class="admissions-context__note">${escapeHtml(label("legacy_pending"))}</p>` : ""}
      ${resetPending ? `<p class="admissions-context__note" data-admission-reset-notice>${escapeHtml(label("reset_notice"))}</p>` : ""}
      ${route && routeHelp(route) ? `<p class="admissions-context__note" data-route-audience>${escapeHtml(routeHelp(route))}</p>` : ""}
      <div id="admissionsSelectionEditor" class="admissions-selection-editor" ${route ? "hidden" : ""}><div class="admissions-selection-editor__body">
      <div class="admissions-context__actions"><button type="button" id="admissionsChooseProgram">${escapeHtml(label(option ? "change_program" : "browse_programs"))}</button></div>
      ${sharedEntries.length ? `<div class="admissions-entry" data-shared-admission><p>${escapeHtml(t(`university.admissions.entry.${option ? "shared_path_alternative" : "institution_wide"}`))}</p><div class="admissions-context__actions">${sharedEntries.map(item => `<button type="button" data-shared-route="${escapeHtmlAttr(item.id)}" ${status === "loading" ? "disabled" : ""}>${escapeHtml(routeName(item))}</button>`).join("")}</div></div>` : ""}
      ${option && !route && explainedRoutes.length ? `<div class="admissions-entry" data-route-options><p>${escapeHtml(t("university.admissions.entry.route_situations"))}</p>${explainedRoutes.filter(item => !specialRoutes.includes(item)).map(routeOption).join("")}${specialRoutes.length ? `<details class="admissions-special-routes"><summary>${escapeHtml(tFormat("university.admissions.reading.special_routes", { count: specialRoutes.length }))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-entry">${specialRoutes.map(routeOption).join("")}</div></details>` : ""}</div>` : ""}
      <form id="admissionsContextForm" class="admissions-context__form" ${(option && !noRoute) || readable ? "" : "hidden"}>
        <div class="admissions-context__primary">
        ${selectHtml("admissionsRoute", label("route_label"), [["", label("choose_route")], ...routes.map((row) => [row.id, routeName(row)])], context.application_route_id, (!option && !readable) || status === "loading")}
        </div>
        <details id="admissionsAdvanced" class="admissions-context__advanced" data-admissions-advanced ${advancedOpen ? "open" : ""}><summary>${escapeHtml(label("reference_filters"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary>
        ${profileHints.length ? `<div class="admissions-entry" data-profile-context-hints><p class="admissions-context__note">${escapeHtml(tFormat("university.admissions.entry.profile_hints", { details: profileHints.join(" · ") }))}</p><div class="admissions-context__actions"><button type="button" data-use-profile-context ${status === "loading" ? "disabled" : ""}>${escapeHtml(t("university.admissions.entry.use_profile"))}</button></div></div>` : ""}
        <div class="admissions-context__fields">
        ${selectHtml("admissionsApplicant", label("applicant_label"), [["", label("unspecified")], ...["first_year", "transfer", "graduate"].map((value) => [value, label(`applicant.${value}`)])], context.applicant_route)}
        <label class="admissions-context__field" for="admissionsCycle"><span>${escapeHtml(label("cycle_label"))}</span><input id="admissionsCycle" type="text" maxlength="40" list="admissionsCycleOptions" aria-describedby="admissionsCycleHelp admissionsCycleNotice" value="${escapeHtmlAttr(context.intended_entry_cycle)}" placeholder="${escapeHtmlAttr(label("cycle_example"))}"></label>
        <datalist id="admissionsCycleOptions">${cycles.map(value => `<option value="${escapeHtmlAttr(value)}"></option>`).join("")}</datalist>
        ${selectHtml("admissionsFee", label("fee_label"), ["unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"].map((value) => [value, label(`fee.${value}`)]), context.fee_status_context)}
        </div><p class="admissions-context__note">${escapeHtml(label("advanced_note"))}</p><p class="admissions-context__note" id="admissionsCycleHelp">${escapeHtml(t("university.admissions.reading.cycle_help"))}</p><p class="admissions-context__note" id="admissionsCycleNotice" role="status" hidden>${escapeHtml(t("university.admissions.reading.cycle_invalid"))}</p></details>
        <div class="admissions-context__actions"><button type="submit" id="admissionsContextApply" class="${route ? "is-applied" : ""}" ${status === "loading" || (!option && !readable) ? "disabled" : ""}>${escapeHtml(label("apply_context"))}</button></div>
      </form></div></div>
      <div class="admissions-context__actions" ${(option && !noRoute) || readable ? "" : "hidden"}>${destination ? `<a class="admissions-application-link" href="${escapeHtmlAttr(destination)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.reading.official_application"))}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16")}</a>` : ""}<button type="button" id="admissionsSaveChoice" ${canSave && !contextDirty ? "" : "disabled"}>${escapeHtml(label("save_choice"))}</button><span id="admissionsSaveStatus" class="admissions-context__note" role="status">${saveStatus ? escapeHtml(label(saveStatus)) : ""}</span></div>
      <div class="admissions-context__status" aria-live="polite">${status === "loading" ? loading() : status === "error" ? failure("context") : incompatible ? empty(label("incompatible_context")) : readable ? "" : !option ? empty(label("choose_program_hint")) : noRoute ? `<p data-no-application-route>${escapeHtml(t("university.admissions.reading.no_application_route"))}</p>${programSource ? `<a href="${escapeHtmlAttr(safeUrl(programSource.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label("official_course_page"))}</a>` : ""}` : ""}</div>`;
    renderSelectionSummary(option, route);
    if (status === "loading") root.querySelectorAll("select, input").forEach((element) => { element.disabled = true; });
    contextSelectDisposers = ["admissionsRoute", "admissionsApplicant", "admissionsFee"].filter(id => root.querySelector(`#${id}`)?.tagName === "SELECT").map(initCustomSelect);
    root.querySelectorAll("[data-shared-route]").forEach(button => {
      button.onclick = () => {
        context.study_option_id = "";
        context.application_route_id = button.dataset.sharedRoute;
        context.study_level = "undergraduate";
        context.applicant_route = "";
        saveStatus = "";
        setUrl();
        void refreshContext();
      };
    });
    root.querySelector("[data-use-profile-context]")?.addEventListener("click", () => {
      context.applicant_route = profile.applicant_route || "";
      context.intended_entry_cycle = profile.intended_entry_cycle || "";
      context.fee_status_context = profile.fee_status_context || "unknown";
      saveStatus = "";
      setUrl();
      void refreshContext();
    });
    root.querySelectorAll("[data-read-route]").forEach(button => {
      button.onclick = () => {
        context.application_route_id = button.dataset.readRoute;
        context.applicant_route = "";
        saveStatus = "";
        setUrl();
        void refreshContext();
      };
    });
    root.querySelector("#admissionsChooseProgram")?.addEventListener("click", () => {
      document.querySelector('[data-tab="tab-programs"]').click();
      document.getElementById("admissionsSearch").focus();
    });
    const readFormContext = () => ({
      application_route_id: root.querySelector("#admissionsRoute").value,
      applicant_route: root.querySelector("#admissionsApplicant").value,
      intended_entry_cycle: normalizeAdmissionCycle(root.querySelector("#admissionsCycle").value),
      fee_status_context: root.querySelector("#admissionsFee").value,
    });
    const contextMatchesForm = (draft) => Object.entries(draft).every(([key, value]) => value === (context[key] || ""));
    const updateDraftState = () => {
      const draft = readFormContext();
      contextDirty = !contextMatchesForm(draft);
      const canApply = contextDirty && Boolean(draft.application_route_id);
      saveStatus = canApply ? "apply_before_save" : "";
      const saveButton = root.querySelector("#admissionsSaveChoice");
      if (saveButton) saveButton.disabled = !canSave || contextDirty;
      const saveStatusNode = root.querySelector("#admissionsSaveStatus");
      if (saveStatusNode) saveStatusNode.textContent = saveStatus ? label(saveStatus) : "";
    };
    const applyFormContext = () => {
      Object.assign(context, readFormContext());
      contextDirty = false;
      saveStatus = "";
      setUrl();
      void refreshContext();
    };
    root.querySelector("#admissionsContextForm").onsubmit = (event) => {
      event.preventDefault();
      applyFormContext();
    };
    root.querySelector("#admissionsRoute").addEventListener("change", applyFormContext);
    root.querySelectorAll("#admissionsContextForm input, #admissionsContextForm select").forEach((field) => {
      field.addEventListener("input", updateDraftState);
      field.addEventListener("change", updateDraftState);
    });
    const cycleInput = root.querySelector("#admissionsCycle");
    const updateCycleNotice = () => {
      const value = normalizeAdmissionCycle(cycleInput.value);
      root.querySelector("#admissionsCycleNotice").hidden = !value || /^(?:20\d{2}(?:[/-](?:\d{2}|20\d{2}))?(?: entry)?|(?:Fall|Autumn|Spring) 20\d{2}(?: entry)?|20\d{2} (?:Fall|Autumn|Spring))$/i.test(value);
    };
    cycleInput.addEventListener("input", updateCycleNotice);
    updateCycleNotice();
    const saveChoiceButton = root.querySelector("#admissionsSaveChoice");
    if (saveChoiceButton) saveChoiceButton.onclick = () => {
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
    const readable = hasReadableAdmissionContext(resolved);
    renderStudyDetails(studyDetails, resolved, status);
    renderProgramSelection(status);
    for (const [id, domains] of Object.entries(targets)) {
      if (id === "admissionsStudyInfo") continue;
      const target = document.getElementById(id);
      const programOnly = ["admissionsStudyInfo", "admissionsUniversityInfo"].includes(id) && !resolved?.selected_route;
      if (id === "admissionsUniversityInfo") {
        target.hidden = status !== "ready" || (!readable && !option);
      }
      if (status === "loading") target.innerHTML = loading();
      else if (status === "error") {
        target.innerHTML = failure("context");
        target.querySelector("button").onclick = refreshContext;
      } else if (id === "detailRequirements" && !readable) target.innerHTML = "";
      else if ((!option && !readable) || (!resolved?.selected_route && !programOnly)) {
        const canChooseRoute = option && resolved.available_routes?.length;
        target.innerHTML = `<div class="admissions-state"><p>${escapeHtml(option && !canChooseRoute ? t("university.admissions.reading.no_application_route") : label(option ? "route_required" : "choose_program_hint"))}</p><button type="button">${escapeHtml(label(canChooseRoute ? "choose_route" : "browse_programs"))}</button></div>`;
        target.querySelector("button").onclick = () => {
          document.querySelector(`[data-tab="tab-${canChooseRoute ? "admission" : "programs"}"]`).click();
          (canChooseRoute ? root : programs).scrollIntoView({ block: "start" });
        };
      }
      else if (["detailRequirements", "detailDeadlines", "detailFinance"].includes(id)) {
        target.innerHTML = `${id === "detailDeadlines" ? '<div data-reviewed-calendar></div>' : ""}${renderApplicantSection(resolved, domains)}`;
        if (id === "detailDeadlines") mountDeadlineCalendar(target.querySelector("[data-reviewed-calendar]"), getReviewedDeadlineEvents(resolved), calendarState);
      }
      else target.innerHTML = renderAdmissionsContext(resolved, {
        domains, includeAssessment: id === "detailRequirements", includeUnknowns: id === "detailRequirements" || programOnly,
        includeHistory: id === "admissionsUniversityInfo", presentation: "simple", programOnly,
        includeSourceNote: !["detailFinance", "detailDeadlines", "admissionsStudyInfo"].includes(id),
      });
    }
  }

  function renderStudyDetails(body, data, status, retry = refreshContext) {
    const option = data?.selected_option;
    const studyInfo = body.querySelector("[data-study-info]");
    const sourceHost = body.querySelector("[data-study-sources]");
    body.querySelector(".program-card__body-inner").insertBefore(studyInfo, sourceHost);
    const heading = body.querySelector("h3");
    if (heading) heading.textContent = stabilizeNumericRanges(option ? admissionsProgramLabel(option, { includeAward: true }).title : label("study_info"));
    const overview = body.querySelector("[data-study-overview]");
    overview.innerHTML = status === "ready" ? renderStudyOptionOverview(data, { includeSources: false })
      : status === "loading" ? loading() : failure("context");
    overview.querySelector("[data-admissions-retry]")?.addEventListener("click", retry);
    studyInfo.innerHTML = status === "ready" && option ? renderAdmissionsContext(data, {
      domains: targets.admissionsStudyInfo, presentation: "simple", programOnly: !data.selected_route,
      overviewCoverage: !data.selected_route ? studyOverviewCoverage(data) : null, includeSourceNote: false,
    }) : "";
    studyInfo.hidden = !studyInfo.innerHTML.trim();
    sourceHost.innerHTML = status === "ready" ? renderStudyOptionSources(data, { includeStudyInfo: !studyInfo.hidden }) : "";
    sourceHost.querySelector(".admissions-programs__references-body")?.append(studyInfo);
  }

  async function refreshContext() {
    calendarState = {};
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
  programs.innerHTML = `<div id="admissionsProfileSuggestions" class="admissions-programs__suggestions"></div><form class="admissions-programs__toolbar" id="admissionsSearchForm">
      <label class="admissions-context__field" for="admissionsSearch"><span>${escapeHtml(label("search_label"))}</span><span class="program-search">${heroIcon("magnifying-glass", "ui-icon ui-icon--18 program-search__icon")}<input class="program-search__input" type="search" id="admissionsSearch" value="${escapeHtmlAttr(search)}" maxlength="200" placeholder="${escapeHtmlAttr(t("university.programs.search_placeholder"))}"></span></label>
      ${selectHtml("admissionsStudyLevel", label("level_label"), [["", label("all_levels")], ...ADMISSION_LEVELS.map((value) => [value, label(`level.${value}`)])], filterLevel)}
      <button type="submit" id="admissionsSearchSubmit">${escapeHtml(label("search"))}</button>
    </form><article id="admissionsSelectedProgram" class="program-card" hidden><div data-selected-program-heading></div><div class="program-card__select-actions" data-pinned-select-action></div></article>
    <section id="admissionsStudyDetails" class="admissions-study program-card__body" role="region" aria-labelledby="admissionsStudyTitle" hidden>
      <div class="admissions-context__heading sr-only"><h3 id="admissionsStudyTitle"></h3></div>
      <div class="program-card__body-inner">
      <div id="admissionsStudyOverview" class="admissions-programs__overview" data-study-overview></div>
      <div id="admissionsStudyInfo" class="admissions-programs__study-info" data-study-info></div>
      <div id="admissionsStudySources" class="admissions-programs__source-host" data-study-sources></div>
      </div>
    </section><div id="admissionsProgramList" class="admissions-programs__list program-list" role="list"></div>
    <div class="admissions-programs__pagination"><button type="button" id="admissionsPrevious">${heroIcon("chevron-left", "ui-icon ui-icon--16")}${escapeHtml(label("previous"))}</button><span id="admissionsProgramCount" class="admissions-programs__count" aria-live="polite"></span><button type="button" id="admissionsNext">${escapeHtml(label("next"))}${heroIcon("chevron-right", "ui-icon ui-icon--16")}</button></div>`;
  const disposeProgramSelect = initCustomSelect("admissionsStudyLevel");
  const studyDetails = programs.querySelector("#admissionsStudyDetails");
  const selectedProgramHost = programs.querySelector("#admissionsSelectedProgram");
  const pinnedSelectAction = selectedProgramHost.querySelector("[data-pinned-select-action]");
  const list = programs.querySelector("#admissionsProgramList");
  const previous = programs.querySelector("#admissionsPrevious");
  const next = programs.querySelector("#admissionsNext");
  const submit = programs.querySelector("#admissionsSearchSubmit");

  function renderProfileSuggestions() {
    const host = programs.querySelector("#admissionsProfileSuggestions");
    const suggestions = [
      ...(suggestedMajor && !search ? [["major", translateProgramName(suggestedMajor, suggestedMajor)]] : []),
      ...(suggestedLevel && filterLevel ? [["level", label(`level.${filterLevel}`)]] : []),
    ];
    host.innerHTML = `${suggestions.length ? `<span class="sr-only">${escapeHtml(t("university.programs.entry.profile_suggestions"))}</span>${suggestions.map(([key, value]) => `<button type="button" data-remove-suggestion="${key}" aria-label="${escapeHtmlAttr(tFormat("university.programs.entry.remove_suggestion", { value }))}">${escapeHtml(value)}${heroIcon("x-mark", "ui-icon ui-icon--16")}</button>`).join("")}` : ""}${search || filterLevel || suggestedMajor ? `<button type="button" data-show-all-programs>${escapeHtml(t("university.programs.entry.show_all"))}</button>` : ""}`;
    host.hidden = !host.innerHTML;
    const clearLevel = () => {
      filterLevel = "";
      suggestedLevel = false;
      const select = programs.querySelector("#admissionsStudyLevel");
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    host.querySelector('[data-remove-suggestion="major"]')?.addEventListener("click", () => {
      suggestedMajor = "";
      page = 1;
      void refreshPrograms();
    });
    host.querySelector('[data-remove-suggestion="level"]')?.addEventListener("click", clearLevel);
    host.querySelector("[data-show-all-programs]")?.addEventListener("click", () => {
      suggestedMajor = search = "";
      programs.querySelector("#admissionsSearch").value = "";
      clearLevel();
    });
  }

  function programToggle(option) {
    const { title, officialTitle, courseCode } = admissionsProgramLabel(option, { includeAward: true });
    const original = getCurrentLanguage() !== "eng" && title !== officialTitle ? officialTitle : "";
    const visibleAwards = (option.awards || []).filter(award => !title.toLowerCase().includes(`(${award.toLowerCase()})`));
    const summary = courseCode ? tFormat("university.admissions.reading.mit_course_code", { code: courseCode }) : "";
    const restriction = programRestriction(option);
    return `<button type="button" class="admissions-programs__option program-card__toggle" data-study-option="${escapeHtmlAttr(option.id)}" aria-expanded="false" aria-controls="admissionsStudyDetails">
      <span class="program-card__text"><span class="program-card__kicker">${escapeHtml([...option.levels.map(value => label(`level.${value}`)), ...visibleAwards].join(" · "))}</span><span class="admissions-programs__option-title program-card__title">${escapeHtml(title)}</span>${original ? `<span class="admissions-programs__original" lang="en">${escapeHtml(original)}</span>` : ""}${summary ? `<span class="program-card__summary">${escapeHtml(summary)}</span>` : ""}${restriction ? `<span class="admissions-programs__restriction">${escapeHtml(t(`university.programs.entry.${restriction}`))}</span>` : ""}</span>
      <span class="program-card__chevron" aria-hidden="true">${heroIcon("chevron-right", "ui-icon ui-icon--16")}</span></button>`;
  }

  function programSelectAction(option) {
    return option.id === context.study_option_id
      ? `<span class="program-card__selection-state" data-selected-study-option="${escapeHtmlAttr(option.id)}" role="status">${heroIcon("check", "ui-icon ui-icon--16")}${escapeHtml(t("admission.choice.selected"))}</span>`
      : `<button type="button" class="program-card__admission-action" data-select-study-option="${escapeHtmlAttr(option.id)}">${escapeHtml(label("select_program"))}</button>`;
  }

  function animateStudyHeight(body, optionId, from, to, close = false) {
    body.getAnimations().forEach(animation => animation.cancel());
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) {
      if (close) body.hidden = true;
      return;
    }
    const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-medium")) || 240;
    const animation = body.animate([{ height: `${from}px`, opacity: close ? 1 : 0 }, { height: `${to}px`, opacity: close ? 0 : 1 }], {
      duration, easing: "ease-in-out",
    });
    animation.onfinish = () => {
      if (close && !openProgramIds.has(optionId)) body.hidden = true;
    };
  }

  function findProgramCard(id) {
    return [...programs.querySelectorAll("[data-study-option]")]
      .find(button => button.dataset.studyOption === id)?.closest(".program-card") || null;
  }

  function ensurePreview(option) {
    let entry = previews.get(option.id);
    if (entry) return entry;
    const body = document.createElement("section");
    body.id = `admissionsPreview${++previewSerial}`;
    body.className = "admissions-study program-card__body";
    body.setAttribute("role", "region");
    body.setAttribute("aria-label", admissionsProgramLabel(option).title);
    body.hidden = true;
    body.innerHTML = `<div class="program-card__body-inner"><div class="admissions-programs__overview" data-study-overview></div>
      <div class="admissions-programs__study-info" data-study-info></div>
      <div class="admissions-programs__source-host" data-study-sources></div></div>`;
    entry = { body, abort: null, data: null };
    previews.set(option.id, entry);
    renderStudyDetails(body, null, "loading");
    return entry;
  }

  function renderProgramSelection(status = root.dataset.state) {
    const option = resolved?.selected_option || items.find(row => row.id === context.study_option_id);
    const selectedButton = [...list.querySelectorAll("[data-study-option]")].find(button => button.dataset.studyOption === context.study_option_id);
    selectedProgramHost.hidden = !context.study_option_id || Boolean(selectedButton);
    const heading = selectedProgramHost.querySelector("[data-selected-program-heading]");
    if (selectedProgramHost.hidden) {
      heading.replaceChildren();
      pinnedSelectAction.replaceChildren();
    } else {
      if (heading.querySelector("[data-study-option]")?.dataset.studyOption !== option?.id) heading.innerHTML = option ? programToggle(option) : "";
      pinnedSelectAction.innerHTML = option ? programSelectAction(option) : "";
    }
    const selectedCard = findProgramCard(context.study_option_id);
    if (selectedCard) {
      selectedCard.querySelector(".program-card__select-actions").before(studyDetails);
      const restrictionDisclosure = selectedButton?.closest(".admissions-programs__restricted");
      if (restrictionDisclosure) restrictionDisclosure.open = true;
    } else selectedProgramHost.insertBefore(studyDetails, pinnedSelectAction);
    const selectedOpen = Boolean(selectedCard && openProgramIds.has(context.study_option_id));
    if (selectedOpen) studyDetails.hidden = false;
    else if (!studyDetails.getAnimations().length) studyDetails.hidden = true;
    studyDetails.inert = !selectedOpen;
    studyDetails.setAttribute("aria-hidden", String(!selectedOpen));
    for (const [id, entry] of previews) {
      if (id === context.study_option_id) {
        entry.abort?.abort();
        entry.body.remove();
        previews.delete(id);
        continue;
      }
      const card = findProgramCard(id);
      if (!card) continue;
      card.querySelector(".program-card__select-actions").before(entry.body);
      const open = openProgramIds.has(id);
      if (open) entry.body.hidden = false;
      else if (!entry.body.getAnimations().length) entry.body.hidden = true;
      entry.body.inert = !open;
      entry.body.setAttribute("aria-hidden", String(!open));
    }
    programs.querySelectorAll("[data-study-option]").forEach(button => {
      const id = button.dataset.studyOption;
      const open = openProgramIds.has(id);
      button.setAttribute("aria-expanded", String(open));
      if (!open) button.removeAttribute("aria-controls");
      else button.setAttribute("aria-controls", id === context.study_option_id ? studyDetails.id : previews.get(id)?.body.id || "");
      button.closest(".program-card").classList.toggle("is-open", open);
      const action = button.closest(".program-card").querySelector(".program-card__select-actions");
      if (action && Boolean(action.querySelector("[data-selected-study-option]")) !== (id === context.study_option_id)) {
        action.innerHTML = programSelectAction(items.find(row => row.id === id) || option);
      }
    });
    selectedProgramHost.classList.toggle("is-open", selectedOpen && selectedCard === selectedProgramHost);
    if (status === "loading") studyDetails.setAttribute("aria-busy", "true");
    else studyDetails.removeAttribute("aria-busy");
  }

  function selectStudyOption(option, { expand = true } = {}) {
    const previousId = context.study_option_id;
    const previousOption = resolved?.selected_option || items.find(row => row.id === previousId);
    const keepPreviousOpen = previousId && previousId !== option.id && openProgramIds.has(previousId)
      && items.some(row => row.id === previousId) && previousOption;
    const previousPreview = keepPreviousOpen ? ensurePreview(previousOption) : null;
    if (previousId && previousId !== option.id && !keepPreviousOpen) openProgramIds.delete(previousId);
    const selectedPreview = previews.get(option.id);
    selectedPreview?.abort?.abort();
    selectedPreview?.body.remove();
    previews.delete(option.id);
    studyDetails.getAnimations().forEach(animation => animation.cancel());
    context.study_option_id = option.id;
    if (expand) openProgramIds.add(option.id);
    else openProgramIds.delete(option.id);
    context.application_route_id = "";
    contextDirty = false;
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
    if (previousPreview) void previewStudyOption(previousOption, previousPreview);
  }

  const onProgramClick = event => {
    const selectButton = event.target.closest("[data-select-study-option]");
    if (selectButton) {
      const option = items.find(row => row.id === selectButton.dataset.selectStudyOption);
      if (!option) return;
      if (option.id !== context.study_option_id) selectStudyOption(option, { expand: openProgramIds.has(option.id) });
      return;
    }
    const button = event.target.closest("[data-study-option]");
    if (!button) return;
    const option = items.find(row => row.id === button.dataset.studyOption) || resolved?.selected_option;
    if (!option) return;
    const id = option.id;
    const existing = id === context.study_option_id ? studyDetails : previews.get(id)?.body;
    if (openProgramIds.has(id)) {
      openProgramIds.delete(id);
      const preview = previews.get(id);
      preview?.abort?.abort();
      if (preview) preview.abort = null;
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("aria-controls");
      button.closest(".program-card").classList.remove("is-open");
      existing.inert = true;
      existing.setAttribute("aria-hidden", "true");
      animateStudyHeight(existing, id, existing.getBoundingClientRect().height, 0, true);
      return;
    }
    openProgramIds.add(id);
    const preview = id === context.study_option_id ? null : ensurePreview(option);
    const body = preview?.body || studyDetails;
    const wasHidden = body.hidden;
    if (!preview) renderStudyDetails(body, resolved, root.dataset.state);
    else if (!preview.data && !preview.abort) {
      renderStudyDetails(body, null, "loading");
      void previewStudyOption(option, preview);
    }
    renderProgramSelection(id === context.study_option_id ? root.dataset.state : "ready");
    animateStudyHeight(body, id, wasHidden ? 0 : body.getBoundingClientRect().height, body.scrollHeight);
  };

  async function previewStudyOption(option, entry) {
    entry.abort?.abort();
    const request = entry.abort = new AbortController();
    entry.body.setAttribute("aria-busy", "true");
    try {
      const previewContext = { ...context, study_option_id: option.id, application_route_id: "", study_level: option.levels.length === 1 ? option.levels[0] : "", applicant_route: "", intended_entry_cycle: "", fee_status_context: "unknown" };
      const response = await fetch(`${API_BASE}/universities/${encodeURIComponent(institutionId)}/admissions-context`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal,
        body: JSON.stringify(admissionsRequest({}, previewContext, institutionId)),
      });
      if (!response.ok) throw new Error(`Study preview HTTP ${response.status}`);
      const data = await response.json();
      if (request !== entry.abort || previews.get(option.id) !== entry || !openProgramIds.has(option.id) || !currentPage()) return;
      const height = entry.body.getBoundingClientRect().height;
      entry.data = data;
      entry.abort = null;
      renderStudyDetails(entry.body, data, "ready");
      entry.body.removeAttribute("aria-busy");
      animateStudyHeight(entry.body, option.id, height, entry.body.scrollHeight);
    } catch (error) {
      if (request.signal.aborted || request !== entry.abort || previews.get(option.id) !== entry || !openProgramIds.has(option.id) || !currentPage()) return;
      entry.abort = null;
      renderStudyDetails(entry.body, null, "error", () => void previewStudyOption(option, entry));
      entry.body.removeAttribute("aria-busy");
    }
  }
  programs.addEventListener("click", onProgramClick);

  async function refreshPrograms() {
    catalogAbort?.abort();
    const request = catalogAbort = new AbortController();
    studyDetails.getAnimations().forEach(animation => animation.cancel());
    previews.forEach(entry => entry.body.getAnimations().forEach(animation => animation.cancel()));
    selectedProgramHost.insertBefore(studyDetails, pinnedSelectAction);
    selectedProgramHost.hidden = !context.study_option_id;
    list.innerHTML = loading();
    previous.disabled = next.disabled = submit.disabled = true;
    try {
      const query = new URLSearchParams({ search, page, limit, lang: searchLanguage });
      if (!search && suggestedMajor) query.set("major", suggestedMajor);
      if (filterLevel) query.set("study_level", filterLevel);
      const response = await fetch(`${API_BASE}/universities/${encodeURIComponent(institutionId)}/study-options?${query}`, { signal: request.signal });
      if (!response.ok) throw new Error(`Study options HTTP ${response.status}`);
      const data = await response.json();
      if (request !== catalogAbort || !currentPage()) return;
      items = data.items;
      total = data.total;
      const previousSharedIds = sharedRoutes.map(route => route.id).join(",");
      sharedRoutes = data.shared_routes || [];
      if (!resolved?.selected_option && previousSharedIds !== sharedRoutes.map(route => route.id).join(",")) renderControls(root.dataset.state);
      const selectedIndex = items.findIndex(option => option.id === context.study_option_id);
      if (selectedIndex > 0) items.unshift(items.splice(selectedIndex, 1)[0]);
      for (const [id, entry] of previews) {
        if (items.some(option => option.id === id)) continue;
        entry.abort?.abort();
        previews.delete(id);
        openProgramIds.delete(id);
      }
      const optionHtml = option => `<article class="program-card" role="listitem">${programToggle(option)}<div class="program-card__select-actions">${programSelectAction(option)}</div></article>`;
      const restricted = items.filter(option => programRestriction(option));
      const standard = items.filter(option => !programRestriction(option));
      list.innerHTML = items.length ? `${standard.map(optionHtml).join("")}${restricted.length ? `<details class="admissions-programs__restricted" role="listitem"><summary>${escapeHtml(t("university.programs.entry.restricted_options"))} (${restricted.length})${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="program-list" role="list">${restricted.map(optionHtml).join("")}</div></details>` : ""}` : empty(label("no_options"));
      renderProfileSuggestions();
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
    if (search) suggestedMajor = "";
    filterLevel = programs.querySelector("#admissionsStudyLevel").value;
    suggestedLevel = false;
    page = 1;
    openProgramIds.clear();
    previews.forEach(entry => { entry.abort?.abort(); entry.body.remove(); });
    previews.clear();
    void refreshPrograms();
  };
  programs.querySelector("#admissionsStudyLevel").addEventListener("change", () => programs.querySelector("#admissionsSearchForm").requestSubmit());
  programs.querySelector("#admissionsSearch").addEventListener("search", event => {
    if (!event.target.value) programs.querySelector("#admissionsSearchForm").requestSubmit();
  });
  previous.onclick = () => { page -= 1; void refreshPrograms(); };
  next.onclick = () => { page += 1; void refreshPrograms(); };
  const onProfile = () => {
    previews.forEach(entry => { entry.abort?.abort(); entry.body.remove(); });
    previews.clear();
    studyDetails.getAnimations().forEach(animation => animation.cancel());
    context = readAdmissionContext(new URL(window.location.href), loadProfileForApi(), institutionId);
    contextDirty = false;
    saveStatus = "";
    openProgramIds.clear();
    if (context.study_option_id) openProgramIds.add(context.study_option_id);
    void refreshContext();
  };
  const onProfileUpdated = () => {
    const hints = programProfileSuggestions(loadProfileForApi());
    const hadSuggestedMajor = Boolean(suggestedMajor);
    if (suggestedMajor) suggestedMajor = hints.major;
    if (suggestedLevel) {
      filterLevel = hints.level;
      programs.querySelector("#admissionsStudyLevel").value = filterLevel;
      programs.querySelector("#admissionsStudyLevel").dispatchEvent(new Event("change", { bubbles: true }));
      suggestedLevel = Boolean(filterLevel);
    } else if (hadSuggestedMajor) { page = 1; void refreshPrograms(); }
    onProfile();
  };
  window.addEventListener("profileUpdated", onProfileUpdated);
  window.addEventListener("popstate", onProfile);
  const ready = Promise.all([refreshPrograms(), refreshContext()]);
  void ready.then(updateTabArrows);
  const dispose = () => {
    browsingByInstitution.set(institutionId, { search, language: searchLanguage, level: filterLevel, page, major: suggestedMajor, suggestedLevel });
    disposed = true;
    contextAbort?.abort();
    catalogAbort?.abort();
    previews.forEach(entry => entry.abort?.abort());
    contextSelectDisposers.forEach((dispose) => dispose());
    disposeProgramSelect();
    programs.removeEventListener("click", onProgramClick);
    tabs.removeEventListener("scroll", updateTabArrows);
    tabs.removeEventListener("click", onTabClick);
    window.removeEventListener("resize", updateTabArrows);
    window.removeEventListener("profileUpdated", onProfileUpdated);
    window.removeEventListener("popstate", onProfile);
  };
  return { ready, dispose };
}
