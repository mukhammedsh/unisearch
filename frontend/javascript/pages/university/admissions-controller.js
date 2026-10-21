import { API_BASE, escapeHtml, escapeHtmlAttr, initCustomSelect, loadProfile, loadProfileForApi, saveSelectedAdmissionChoice, stabilizeNumericRanges } from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { translateAdmissionSummary, translateProgramName } from "../../university-translations.js";
import { admissionsCycleLabel, admissionsProgramLabel, admissionsRouteName, renderAdmissionsContext, renderStudyOptionOverview } from "./admissions-render.js";
import { safeUrl, localizeDuration, trStudyMode } from "../_shared.js";
import { heroIcon } from "../../icons.js";
import { renderApplicantSection } from "./admissions-presentation.js";
import { getReviewedDeadlineEvents } from "./deadline-calendar.js";
import { mountDeadlineCalendar } from "./deadline-calendar-view.js";

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

export function hasReadableAdmissionContext(resolved) {
  return Boolean(resolved?.selected_route && (resolved.selected_option || resolved.reading_scope === "institution_route"));
}

export function automaticAdmissionRoute(resolved, context, allowAutomaticRoute) {
  const routes = resolved?.available_routes || [];
  return allowAutomaticRoute && !context.application_route_id && resolved?.selected_option
    && routes.length === 1 && !Object.values(resolved.context_applicability || {}).includes("mismatched") ? routes[0].id : "";
}

export function programProfileSuggestions(profile) {
  const level = String(profile?.study_level || "").toLowerCase();
  return { major: String(profile?.major || "").trim(), level: LEVELS.includes(LEVEL_ALIASES[level] || level) ? LEVEL_ALIASES[level] || level : "" };
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
    ${relationship ? `<details class="admissions-catalog__evidence"><summary>${escapeHtml(label("detail"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><p>${escapeHtml(translateAdmissionSummary(relationship) || relationship)}</p></details>` : ""}
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
  let calendarState = {};
  let contextAbort = null;
  let catalogAbort = null;
  let disposed = false;
  let contextSelectDisposers = [];
  let saveStatus = "";
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
    const scope = [
      ...(option?.catalog_classification === "ucas_course_choice" ? [] : option?.awards || []),
      option ? route ? routeName(route) : resolved.available_routes?.length ? label("route_not_selected") : t("university.admissions.reading.no_route_short") : "",
      context.applicant_route ? label(`applicant.${context.applicant_route}`) : "",
      admissionsCycleLabel(context.intended_entry_cycle),
      context.fee_status_context && context.fee_status_context !== "unknown" ? label(`fee.${context.fee_status_context}`) : "",
    ].filter(Boolean);
    selectionSummary.innerHTML = `<div class="admissions-selection__text"><div class="admissions-selection__primary"><span>${escapeHtml(label("reference_scope"))}</span><strong>${escapeHtml(option ? admissionsProgramLabel(option, { includeAward: true }).title : routeName(route))}</strong></div>${scope.length ? `<span>${[...new Set(scope)].map(value => escapeHtml(value)).join(" · ")}</span>` : ""}</div>
      <div class="admissions-selection__actions"><button type="button" data-admissions-open-tab="tab-admission" aria-controls="admissionsSelectionEditor" aria-expanded="${!route}">${escapeHtml(t("university.admissions.reading.edit_selection"))}</button></div>`;
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
    const route = resolved?.selected_route;
    const routes = option ? resolved?.available_routes || [] : sharedRoutes;
    const readable = hasReadableAdmissionContext(resolved);
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
    const destination = getApplicationLink(resolved);
    root.innerHTML = `<div class="admissions-context__heading"><div><h2>${escapeHtml(label("simple_title"))}</h2>${route || noRoute || routeEntries ? "" : `<p>${escapeHtml(label("route_intro"))}</p>`}</div>
        </div>
      ${legacyPending ? `<p class="admissions-context__note">${escapeHtml(label("legacy_pending"))}</p>` : ""}
      ${resetPending ? `<p class="admissions-context__note" data-admission-reset-notice>${escapeHtml(label("reset_notice"))}</p>` : ""}
      ${route && routeHelp(route) ? `<p class="admissions-context__note" data-route-audience>${escapeHtml(routeHelp(route))}</p>` : ""}
      <div id="admissionsSelectionEditor" class="admissions-selection-editor" ${route ? "hidden" : ""}><div class="admissions-selection-editor__body">
      <div class="admissions-context__actions"><button type="button" id="admissionsChooseProgram">${escapeHtml(label(option ? "change_program" : "browse_programs"))}</button></div>
      ${!option && sharedRoutes.length ? `<div class="admissions-entry" data-shared-admission><p>${escapeHtml(t("university.admissions.entry.institution_wide"))}</p><div class="admissions-context__actions">${sharedRoutes.map(item => `<button type="button" data-shared-route="${escapeHtmlAttr(item.id)}" ${status === "loading" ? "disabled" : ""}>${escapeHtml(routeName(item))}</button>`).join("")}</div></div>` : ""}
      ${option && !route && explainedRoutes.length ? `<div class="admissions-entry" data-route-options><p>${escapeHtml(t("university.admissions.entry.route_situations"))}</p>${explainedRoutes.filter(item => !specialRoutes.includes(item)).map(routeOption).join("")}${specialRoutes.length ? `<details class="admissions-special-routes"><summary>${escapeHtml(tFormat("university.admissions.reading.special_routes", { count: specialRoutes.length }))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary><div class="admissions-entry">${specialRoutes.map(routeOption).join("")}</div></details>` : ""}</div>` : ""}
      <form id="admissionsContextForm" class="admissions-context__form" ${(option && !noRoute) || readable ? "" : "hidden"}>
        <div class="admissions-context__primary" ${routeEntries ? "hidden" : ""}>
        ${routes.length === 1 && route ? `<div><span class="admissions-context__note">${escapeHtml(label("route_label"))}</span><p class="admissions-route-name">${escapeHtml(routeName(route))}</p><input type="hidden" id="admissionsRoute" value="${escapeHtmlAttr(route.id)}"></div>` : selectHtml("admissionsRoute", label("route_label"), [["", label("choose_route")], ...routes.map((row) => [row.id, routeName(row)])], context.application_route_id, status === "loading")}
        </div>
        <details id="admissionsAdvanced" class="admissions-context__advanced" data-admissions-advanced ${advancedOpen ? "open" : ""}><summary>${escapeHtml(label("reference_filters"))}${heroIcon("chevron-down", "admissions-disclosure-icon")}</summary>
        ${profileHints.length ? `<div class="admissions-entry" data-profile-context-hints><p class="admissions-context__note">${escapeHtml(tFormat("university.admissions.entry.profile_hints", { details: profileHints.join(" · ") }))}</p><div class="admissions-context__actions"><button type="button" data-use-profile-context ${status === "loading" ? "disabled" : ""}>${escapeHtml(t("university.admissions.entry.use_profile"))}</button></div></div>` : ""}
        <div class="admissions-context__fields">
        ${selectHtml("admissionsApplicant", label("applicant_label"), [["", label("unspecified")], ...["first_year", "transfer", "graduate"].map((value) => [value, label(`applicant.${value}`)])], context.applicant_route)}
        <label class="admissions-context__field" for="admissionsCycle"><span>${escapeHtml(label("cycle_label"))}</span><input id="admissionsCycle" type="text" maxlength="40" list="admissionsCycleOptions" aria-describedby="admissionsCycleHelp admissionsCycleNotice" value="${escapeHtmlAttr(context.intended_entry_cycle)}" placeholder="${escapeHtmlAttr(label("cycle_example"))}"></label>
        <datalist id="admissionsCycleOptions">${cycles.map(value => `<option value="${escapeHtmlAttr(value)}"></option>`).join("")}</datalist>
        ${selectHtml("admissionsFee", label("fee_label"), ["unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"].map((value) => [value, label(`fee.${value}`)]), context.fee_status_context)}
        </div><p class="admissions-context__note" id="admissionsCycleHelp">${escapeHtml(t("university.admissions.reading.cycle_help"))}</p><p class="admissions-context__note" id="admissionsCycleNotice" role="status" hidden>${escapeHtml(t("university.admissions.reading.cycle_invalid"))}</p></details>
        <div class="admissions-context__actions" ${routeEntries ? "hidden" : ""}><button type="submit" id="admissionsContextApply" class="${route ? "is-applied" : ""}" ${status === "loading" || (!option && !readable) ? "disabled" : ""}>${escapeHtml(route ? t("university.admissions.reading.update_selection") : label("show_requirements"))}</button></div>
      </form></div></div>
      <div class="admissions-context__actions" ${((option && !noRoute) || readable) && !routeEntries ? "" : "hidden"}>${destination ? `<a class="admissions-application-link" href="${escapeHtmlAttr(destination)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.reading.official_application"))}${heroIcon("arrow-top-right-on-square", "ui-icon ui-icon--16")}</a>` : ""}<button type="button" id="admissionsSaveChoice" ${canSave ? "" : "disabled"}>${escapeHtml(label("save_choice"))}</button><span id="admissionsSaveStatus" class="admissions-context__note" role="status">${saveStatus ? escapeHtml(label(saveStatus)) : ""}</span></div>
      <div class="admissions-context__status" aria-live="polite">${status === "loading" ? loading() : status === "error" ? failure("context") : incompatible ? empty(label("incompatible_context")) : readable || routeEntries ? "" : !option ? sharedRoutes.length ? "" : empty(label("choose_program_hint")) : noRoute ? `<p data-no-application-route>${escapeHtml(t("university.admissions.reading.no_application_route"))}</p>${programSource ? `<a href="${escapeHtmlAttr(safeUrl(programSource.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label("official_course_page"))}</a>` : ""}` : !route ? empty(label("route_required")) : ""}</div>`;
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
    const readable = hasReadableAdmissionContext(resolved);
    studyDetails.querySelector("h3").textContent = stabilizeNumericRanges(option ? admissionsProgramLabel(option, { includeAward: true }).title : label("study_info"));
    document.getElementById("admissionsStudyRelationship").innerHTML = renderStudyOptionRelationship(option);
    document.getElementById("admissionsStudyOverview").innerHTML = status === "ready" ? renderStudyOptionOverview(resolved) : "";
    studyDetails.querySelector("#admissionsViewRequirements").disabled = status !== "ready" || !option;
    renderProgramSelection(status);
    for (const [id, domains] of Object.entries(targets)) {
      const target = document.getElementById(id);
      const programOnly = id === "admissionsStudyInfo" && !resolved?.selected_route;
      if (id === "admissionsUniversityInfo") {
        target.hidden = status !== "ready" || !readable;
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
        domains, includeAssessment: id === "detailRequirements", includeUnknowns: id === "detailRequirements",
        includeHistory: id === "admissionsUniversityInfo", presentation: "simple", programOnly,
        includeSourceNote: !["detailFinance", "detailDeadlines", "admissionsStudyInfo"].includes(id),
      });
    }
  }

  async function refreshContext({ allowAutomaticRoute = false } = {}) {
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
      const automaticRoute = automaticAdmissionRoute(data, context, allowAutomaticRoute);
      if (automaticRoute) {
        context.application_route_id = automaticRoute;
        window.history.replaceState({}, "", admissionContextUrl(window.location.href, context));
        return refreshContext();
      }
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
    const essentials = [option.format?.duration && option.format.duration !== "not_stated" ? localizeDuration(option.format.duration) : "", option.format?.mode && option.format.mode !== "not_stated" ? trStudyMode(option.format.mode) : "", ...(option.ucas_course_codes || [])].filter(Boolean);
    const awards = option.awards.map(award => option.catalog_classification === "ucas_course_choice" && ["BEng", "MEng"].includes(award)
      ? t(`university.admissions.reading.degree.${award === "MEng" ? "MEng_integrated" : award}`) : award);
    const restriction = programRestriction(option);
    return `<button type="button" class="admissions-programs__option program-card__toggle" data-study-option="${escapeHtmlAttr(option.id)}" aria-expanded="false" aria-controls="admissionsStudyDetails">
      <span class="program-card__text"><span class="program-card__kicker">${escapeHtml(option.levels.map(value => label(`level.${value}`)).join(" · "))}</span><span class="admissions-programs__option-title program-card__title">${escapeHtml(title)}</span>${original ? `<span class="admissions-programs__original" lang="en">${escapeHtml(original)}</span>` : ""}<span class="program-card__summary">${escapeHtml([...awards, ...essentials].join(" · "))}${courseCode ? ` · ${escapeHtml(tFormat("university.admissions.reading.mit_course_code", { code: courseCode }))}` : ""}</span>${restriction ? `<span class="admissions-programs__restriction">${escapeHtml(t(`university.programs.entry.${restriction}`))}</span>` : ""}</span>
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
    if (selectedButton) {
      selectedButton.closest(".program-card").append(studyDetails);
      const restrictionDisclosure = selectedButton.closest(".admissions-programs__restricted");
      if (restrictionDisclosure) restrictionDisclosure.open = true;
    }
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
    void refreshContext({ allowAutomaticRoute: true });
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
      const optionHtml = option => `<article class="program-card" role="listitem">${programToggle(option)}</article>`;
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
