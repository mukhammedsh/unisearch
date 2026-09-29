import {
  aiName,
  escapeHtml,
  escapeHtmlAttr,
  getSelectedAdmissionChoice,
  loadProfile,
  loadProfileForApi,
  formatExamValue,
  getExamDisplayName,
  motionPress,
  replayMotion,
  saveSelectedAdmissionChoice,
  markMotionEnter,
} from "../../utils.js";
import { heroIcon } from "../../icons.js";
import { getCurrentLanguage, t } from "../../i18n.js";
import { FALLBACK_RATES, convert, formatMoney, formatPrice } from "../../currency.js";
import {
  admissionChoiceKey,
  applyPercentWidths,
  getAdmissionChoicesFromCategories,
  getGrantsFromCategories,
  getTrackFundingType,
  renderExamGroup,
  renderTrackChanceChip,
  renderTrackFactors,
  renderTrackFundingBadge,
  renderUniChanceSummary,
  splitExamEntries,
} from "../../university-detail-helpers.js";
import { translateAdmissionText, translateFundingAwardField, translateTemplate, translateWord } from "../../university-translations.js";
import { getCalendarCells, parseExactDeadlineDate } from "./deadline-calendar.js";
import { createDeadlineIcs } from "./deadline-calendar.js";
import {
  costBreakdownCoverageNote,
  modeAwareAnnualCost,
  modeAwareBreakdown,
  moneyOrUnknown,
  renderAdmissionsOverview,
  renderRoiBox,
  renderInlineIcon,
  renderScholarshipLine,
  renderTrackLanguageExamGroup,
  safeUrl,
  trProgramName,
  trStudyLevel,
  trTrackDescription,
  trTrackLabel,
  translateCostBreakdownLabel,
  unknownFieldText,
} from "../_shared.js";

function fundingMetaShortLabel(label) {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === String(t("admission.track.funding_program", "Funding program")).trim().toLowerCase()) {
    return t("admission.track.funding_program_short", "Program");
  }
  if (normalized === String(t("admission.track.funding_source", "Funding source")).trim().toLowerCase()) {
    return t("admission.track.funding_source_short", "Source");
  }
  return label;
}

function renderFundingMetaTags(fundingMeta) {
  if (!Array.isArray(fundingMeta) || !fundingMeta.length) return "";

  return `
    <div class="admission-option-meta">
      ${fundingMeta.map(([label, value]) => `<span class="tag" title="${escapeHtmlAttr(`${label}: ${value}`)}"><small>${escapeHtml(fundingMetaShortLabel(label))}</small> <span>${escapeHtml(value)}</span></span>`).join("")}
    </div>
  `;
}

function renderFinanceMetaList(fundingMeta) {
  if (!Array.isArray(fundingMeta) || !fundingMeta.length) return "";

  return `
    <dl class="finance-option-meta">
      ${fundingMeta.map(([label, value]) => `
        <div class="finance-option-meta__row">
          <dt>${escapeHtml(fundingMetaShortLabel(label))}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `).join("")}
    </dl>
  `;
}

function oneTimeCostTimingLabel(timing) {
  const normalized = String(timing || "").trim().toLowerCase();
  if (normalized === "enrollment") {
    return t("university.finance.one_time.timing.enrollment", "Paid once upon enrollment");
  }
  return "";
}

function renderOneTimeCosts(finance) {
  const costs = Array.isArray(finance?.one_time_costs) ? finance.one_time_costs : [];
  const currency = String(finance?.currency || "USD").trim().toUpperCase();
  const rows = costs
    .filter((cost) => cost && typeof cost === "object" && Number.isFinite(Number(cost.amount)) && Number(cost.amount) > 0)
    .map((cost) => {
      const timing = oneTimeCostTimingLabel(cost.timing);
      const grantNote = cost.applies_to_grant_holders === true
        ? t("university.finance.one_time.applies_to_grant_holders", "Also required for grant holders")
        : "";
      const notes = [timing, grantNote].filter(Boolean).join(" · ");
      return `
        <div class="finance-one-time-costs__row">
          <dt>${escapeHtml(translateCostBreakdownLabel(cost.type))}</dt>
          <dd>
            <strong>${escapeHtml(formatPrice(cost.amount, currency))}</strong>
            ${notes ? `<span>${escapeHtml(notes)}</span>` : ""}
          </dd>
        </div>
      `;
    });

  if (!rows.length) return "";
  return `
    <section class="finance-one-time-costs" aria-labelledby="finance-one-time-costs-title">
      <h3 id="finance-one-time-costs-title">${escapeHtml(t("university.finance.one_time.title", "One-time payments"))}</h3>
      <dl>${rows.join("")}</dl>
    </section>
  `;
}

function admissionChoiceSelectionAttrs({ category, choiceKey, funding = null, profile }) {
  return [
    `data-admission-choice="${escapeHtmlAttr(choiceKey)}"`,
    `data-category-id="${escapeHtmlAttr(String(category?.id || ""))}"`,
    `data-requirement-profile-id="${escapeHtmlAttr(String(profile?.id || ""))}"`,
    `data-funding-option-id="${escapeHtmlAttr(String(funding?.id || ""))}"`,
  ].join(" ");
}

const GENERAL_PROGRAM_KEY = "__general__";
const MIT_ID = "mit-usa-cambridge";
const admissionProgramSelectionByUniversity = new Map();
const admissionProfileSelectionByCategory = new Map();

const admissionStudyLevelSelectionByUniversity = new Map();
const deadlinesActiveLevelByUniversity = new Map();
const deadlineCalendarMonthByUniversity = new Map();
const deadlineCalendarDayByUniversity = new Map();
const visibleAdmissionContextByUniversity = new Map();

export function selectAdmissionProgram(university, program) {
  const universityId = String(university?.id || "").trim();
  const programId = normalizeProgramToken(program?.id);
  if (!universityId || !programId) return;
  admissionProgramSelectionByUniversity.set(universityId, normalizeProgramToken(program.name || program.program_name || program.id));
  const params = new URLSearchParams(window.location.search);
  params.set("admission_program", String(program.id));
  const level = Array.isArray(program.study_levels) ? program.study_levels[0] : (program.study_level || program.level);
  const levelKey = normalizeLevelKey(level);
  admissionStudyLevelSelectionByUniversity.set(universityId, levelKey);
  params.set("admission_level", levelKey);
  params.delete("admission_route");
  params.delete("admission_cycle");
  window.history?.pushState?.({}, "", `${window.location.pathname}?${params}${window.location.hash || ""}`);
}

function updateAdmissionUrl(values) {
  const params = new URLSearchParams(window.location.search);
  Object.entries(values).forEach(([key, value]) => {
    const param = `admission_${key}`;
    if (value) params.set(param, value);
    else params.delete(param);
  });
  window.history?.pushState?.({}, "", `${window.location.pathname}?${params}${window.location.hash || ""}`);
}

export function getAdmissionContextProfile(university, baseProfile = loadProfileForApi()) {
  const profile = { ...baseProfile };
  profile.study_level = baseProfile?.study_level || baseProfile?.studyLevel || profile.study_level;
  profile.applicant_route = baseProfile?.applicant_route || baseProfile?.applicantRoute || profile.applicant_route;
  profile.intended_entry_cycle = baseProfile?.intended_entry_cycle || baseProfile?.intendedEntryCycle || profile.intended_entry_cycle;
  const id = String(university?.id || "");
  const params = new URLSearchParams(window.location.search);
  const programs = Array.isArray(university?.academics?.programs) ? university.academics.programs : [];
  const saved = baseProfile?.selectedAdmissionChoices?.[id] || {};
  const queryProgram = params.get("admission_program");
  const profileLevel = normalizeLevelKey(baseProfile?.study_level || baseProfile?.studyLevel);
  const programMatchesLevel = (program) => {
    const levels = Array.isArray(program?.study_levels) ? program.study_levels : [program?.study_level || program?.level].filter(Boolean);
    return !profileLevel || profileLevel === "any" || levels.some((level) => normalizeLevelKey(level) === profileLevel);
  };
  const selectedProgram = programs.find((program) => String(program?.id || "") === queryProgram)
    || programs.find((program) => String(program?.id || "") === String(saved.programId || ""))
    || programs.find((program) => normalizeProgramToken(program?.name || program?.program_name) === normalizeProgramToken(trProgramName(saved.programName || saved.program_name)))
    || programs.find((program) => programMatchesLevel(program) && normalizeProgramToken(program?.name || program?.program_name) === normalizeProgramToken(trProgramName(baseProfile?.major)));
  if (selectedProgram) {
    const rawLevel = Array.isArray(selectedProgram.study_levels) ? selectedProgram.study_levels[0] : (selectedProgram.study_level || selectedProgram.level);
    profile.study_level = rawLevel || profile.study_level;
    profile.studyLevel = profile.study_level;
    const previousChoice = profile.selectedAdmissionChoices?.[id] || saved;
    if (queryProgram === String(selectedProgram.id || "")) {
      const sameProgram = String(previousChoice.programId || "") === String(selectedProgram.id || "");
      const rawLevelKey = normalizeLevelKey(rawLevel);
      const applicableCategories = getVisibleAdmissionCategories(
        getAdmissionCategories(university).filter((category) => categoryMatchesStudyLevel(category, rawLevelKey)),
        normalizeProgramToken(selectedProgram.name || selectedProgram.program_name || selectedProgram.id),
        university,
      );
      const savedChoiceCategoryId = String(previousChoice.categoryId || previousChoice.category_id || "");
      const legacyChoiceApplies = !previousChoice.programId && Boolean(previousChoice.choiceKey || previousChoice.choice_key)
        && applicableCategories.some((category) => String(category.id || "") === savedChoiceCategoryId);
      profile.selectedAdmissionChoices = {
        ...(profile.selectedAdmissionChoices || {}),
        [id]: sameProgram || legacyChoiceApplies
          ? { ...previousChoice, programId: selectedProgram.id }
          : { programId: selectedProgram.id },
      };
    }
  }

  const categories = getAdmissionCategories(university);
  const selectedProgramLevels = selectedProgram
    ? (Array.isArray(selectedProgram.study_levels) ? selectedProgram.study_levels : [selectedProgram.study_level || selectedProgram.level].filter(Boolean))
      .map(normalizeLevelKey)
    : [];
  const allowedLevels = new Set([...getAvailableStudyLevels(categories).map((level) => level.key), "all"]);
  const requestedLevel = params.get("admission_level");
  const levelKey = allowedLevels.has(requestedLevel)
    && (!selectedProgramLevels.length || requestedLevel === "all" || selectedProgramLevels.includes(requestedLevel))
    ? requestedLevel
    : "";
  if (levelKey) {
    const categoryLevel = categories.flatMap(getCategoryLevelsList).find((level) => normalizeLevelKey(level) === levelKey);
    const selectedProgramLevel = selectedProgram?.study_levels?.[0] || selectedProgram?.study_level || selectedProgram?.level;
    if (levelKey === "all" && !selectedProgramLevel) {
      delete profile.study_level;
      delete profile.studyLevel;
    } else {
      profile.study_level = categoryLevel || selectedProgramLevel || levelKey;
      profile.studyLevel = profile.study_level;
    }
  }
  const currentLevel = normalizeLevelKey(profile.study_level || profile.studyLevel);
  const scopedCategories = getVisibleAdmissionCategories(
    categories.filter((category) => categoryMatchesStudyLevel(category, currentLevel)),
    selectedProgram ? normalizeProgramToken(selectedProgram.name || selectedProgram.program_name || selectedProgram.id) : GENERAL_PROGRAM_KEY,
    university,
  );
  const routes = [...new Set(scopedCategories.map((category) => String(category.applicant_route || "").trim()).filter(Boolean))];
  const requestedRoute = params.get("admission_route") || profile.applicant_route || profile.applicantRoute;
  let safeRoute = ["first_year", "transfer", "graduate"].includes(requestedRoute) ? requestedRoute : "";
  if (["doctorate", "master", "mba"].includes(currentLevel)) safeRoute = "graduate";
  else if (safeRoute && routes.length && !routes.includes(safeRoute)) safeRoute = "";
  if (safeRoute) profile.applicant_route = safeRoute;
  else delete profile.applicant_route;
  if (profile.applicant_route) profile.applicantRoute = profile.applicant_route;
  else {
    delete profile.applicant_route;
    delete profile.applicantRoute;
  }
  const cycle = params.get("admission_cycle");
  if (cycle && cycle.length <= 40) profile.intended_entry_cycle = cycle;
  if (profile.intended_entry_cycle) profile.intendedEntryCycle = profile.intended_entry_cycle;
  return profile;
}

function cycleMatches(sourceCycle, requestedCycle) {
  const parse = (value) => {
    const text = String(value || "").toLowerCase();
    if (/\b20\d{2}\s*[-–/]\s*\d{2,4}\b/.test(text)) return null;
    const years = [...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => match[0]);
    const terms = ["fall", "autumn", "spring", "winter", "summer"].filter((term) => text.includes(term));
    if (terms.length > 1 || years.length > 1) return null;
    return { year: years[0] || "", term: terms[0] === "autumn" ? "fall" : (terms[0] || "") };
  };
  const source = parse(sourceCycle);
  const requested = parse(requestedCycle);
  if (!source || !requested) return null;
  if (source.year && requested.year && source.year !== requested.year) return false;
  if (source.term && requested.term && source.term !== requested.term) return false;
  return source.year && requested.year && source.term && requested.term ? true : null;
}

function normalizeLevelKey(rawLevel) {
  const norm = String(rawLevel || "").trim().toLowerCase();
  if (norm.includes("bachelor") || norm.includes("undergrad") || norm.includes("integrated master") || norm.includes("бакалавр")) return "bachelor";
  if (norm.includes("master") || norm.includes("msc") || norm.includes("mres") || norm.includes("meng") || norm.includes("магистр")) return "master";
  if (norm.includes("phd") || norm.includes("doctor") || norm.includes("dphil") || norm.includes("доктор") || norm.includes("аспирант")) return "doctorate";
  if (norm.includes("mba") || norm.includes("мба")) return "mba";
  if (norm.includes("professional") || /\bjd\b|juris doctor/.test(norm)) return "professional";
  return norm || "general";
}

function normalizeAwardLevels(award) {
  const rawLevels = Array.isArray(award?.study_levels)
    ? award.study_levels
    : [award?.study_level || ""];
  return rawLevels
    .flatMap((value) => String(value || "").split(/[\/,&]+/))
    .map((value) => normalizeLevelKey(value))
    .filter((value) => value && value !== "general");
}

function awardMatchesVisiblePrograms(award, categories, selectedLevel) {
  const explicitIds = Array.isArray(award?.program_ids) ? award.program_ids : [];
  if (explicitIds.length) {
    const visibleIds = new Set((Array.isArray(categories) ? categories : [])
      .flatMap((category) => Array.isArray(category?.program_ids) ? category.program_ids : [])
      .map((value) => String(value || "").trim().toLowerCase()));
    return explicitIds.some((id) => visibleIds.has(String(id || "").trim().toLowerCase()));
  }
  const scope = String(award?.program_scope || "").trim().toLowerCase();
  if (!scope) return true;
  if (scope.includes("selected postgraduate taught") && selectedLevel !== "bachelor") return false;

  const categoryText = (Array.isArray(categories) ? categories : [])
    .flatMap((category) => [
      category?.id,
      category?.label,
      category?.name,
      ...(Array.isArray(category?.program_names) ? category.program_names : []),
      ...(Array.isArray(category?.program_ids) ? category.program_ids : []),
    ])
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  const scopedTerms = ["mba", "hbs", "gsb", "mfin", "mban", "mpp", "mpa", "jd", "college"];
  const termsInScope = scopedTerms.filter((term) => new RegExp(`\\b${term}\\b`).test(scope));
  if (termsInScope.length && !termsInScope.some((term) => new RegExp(`\\b${term}\\b`).test(categoryText))) {
    return false;
  }

  if (/except\s+medicine/.test(scope) && /medicine/.test(categoryText)) return false;
  if (/centre for doctoral training/.test(scope) && !/\bcdt\b|centre for doctoral training/.test(categoryText)) return false;
  if (/business school/.test(scope) && !/business|mba|mfin|mban/.test(categoryText)) return false;
  return true;
}

export function getFundingAwardsForSelection(finance, categories, studyLevel, programCategories = categories) {
  const awards = Array.isArray(finance?.scholarships_and_funding)
    ? finance.scholarships_and_funding
    : [];
  const selectedLevel = normalizeLevelKey(studyLevel);
  return awards.filter((award) => {
    if (!award || typeof award !== "object") return false;
    const routes = programCategories.map((category) => category.applicant_route).filter(Boolean);
    if (Array.isArray(award.applicant_routes) && award.applicant_routes.length && routes.length
      && !routes.some((route) => award.applicant_routes.includes(route))) return false;
    const levels = normalizeAwardLevels(award);
    if (selectedLevel && !["all", "any", "general"].includes(selectedLevel) && levels.length && !levels.includes(selectedLevel)) {
      return false;
    }
    return awardMatchesVisiblePrograms(award, programCategories, selectedLevel);
  });
}

function selectedAdmissionContext(university, profile) {
  const universityId = String(university?.id || "").trim();
  const categories = getAdmissionCategories(university);
  const availableLevels = getAvailableStudyLevels(categories);
  const params = new URLSearchParams(window.location.search);
  const programs = Array.isArray(university?.academics?.programs) ? university.academics.programs : [];
  const storedChoice = profile?.selectedAdmissionChoices?.[universityId] || {};
  const queryProgramId = params.get("admission_program");
  const profileLevel = normalizeLevelKey(profile?.study_level || profile?.studyLevel);
  const programMatchesLevel = (program) => {
    const levels = Array.isArray(program?.study_levels) ? program.study_levels : [program?.study_level || program?.level].filter(Boolean);
    return !profileLevel || profileLevel === "any" || levels.some((level) => normalizeLevelKey(level) === profileLevel);
  };
  const storedProgram = programs.find((program) => String(program?.id || "") === queryProgramId)
    || programs.find((program) => String(program?.id || "") === String(storedChoice.programId || ""))
    || programs.find((program) => normalizeProgramToken(program?.name || program?.program_name) === normalizeProgramToken(trProgramName(storedChoice.programName || storedChoice.program_name)))
    || programs.find((program) => programMatchesLevel(program) && normalizeProgramToken(program?.name || program?.program_name) === normalizeProgramToken(trProgramName(profile?.major)));
  if (storedProgram) admissionProgramSelectionByUniversity.set(universityId, normalizeProgramToken(storedProgram.name || storedProgram.program_name || storedProgram.id));
  const storedProgramLevels = storedProgram
    ? (Array.isArray(storedProgram.study_levels) ? storedProgram.study_levels : [storedProgram.study_level || storedProgram.level].filter(Boolean))
      .map(normalizeLevelKey)
    : [];
  const queryLevelRaw = params.get("admission_level");
  const queryLevel = [...availableLevels.map((level) => level.key), "all"].includes(queryLevelRaw)
    && (!storedProgramLevels.length || storedProgramLevels.includes(queryLevelRaw))
    ? queryLevelRaw
    : "";
  const storedLevel = queryLevel || "";
  const selectedLevel = storedLevel
    || (storedProgram && normalizeLevelKey(storedProgram.study_levels?.[0] || storedProgram.study_level || storedProgram.level))
    || (profileLevel && profileLevel !== "general"
      ? profileLevel
      : (availableLevels.some((level) => level.key === "bachelor") ? "bachelor" : "all"));
  if (queryLevel) admissionStudyLevelSelectionByUniversity.set(universityId, queryLevel);
  else admissionStudyLevelSelectionByUniversity.delete(universityId);
  const selectedProgram = storedProgram
    ? normalizeProgramToken(storedProgram.name || storedProgram.program_name || storedProgram.id)
    : GENERAL_PROGRAM_KEY;
  if (storedProgram) admissionProgramSelectionByUniversity.set(universityId, selectedProgram);
  else admissionProgramSelectionByUniversity.delete(universityId);
  const levelCategories = categories.filter((category) => categoryMatchesStudyLevel(category, selectedLevel));
  const programCategories = getVisibleAdmissionCategories(levelCategories, selectedProgram, university);
  let visibleCategories = programCategories;
  const routeOptions = [...new Set(programCategories.map((category) => String(category.applicant_route || "").trim()).filter(Boolean))];
  const queryRoute = params.get("admission_route");
  const requestedRoute = ["first_year", "transfer", "graduate"].includes(queryRoute)
    ? queryRoute
    : (profile?.applicant_route || profile?.applicantRoute || "");
  const route = !routeOptions.length || !requestedRoute || routeOptions.includes(requestedRoute) ? requestedRoute : "";
  const cycleOptions = [...new Set(programCategories.flatMap((category) => [
    category.cycle,
    ...(Array.isArray(category.deadlines) ? category.deadlines.map((deadline) => deadline?.cycle) : []),
    ...(Array.isArray(category.admission_rounds) ? category.admission_rounds.map((round) => round?.cycle) : []),
  ]).map((value) => String(value || "").trim()).filter(Boolean))];
  const queryCycle = params.get("admission_cycle");
  const requestedCycle = queryCycle && queryCycle.length <= 40
    ? queryCycle
    : (profile?.intended_entry_cycle || profile?.intendedEntryCycle || "");
  const cycle = requestedCycle;
  if (route && visibleCategories.some((category) => category.applicant_route)) {
    visibleCategories = visibleCategories.filter((category) => !category.applicant_route || category.applicant_route === route);
  }
  if (cycle && visibleCategories.some((category) => category.cycle)) {
    visibleCategories = visibleCategories.filter((category) => !category.cycle || cycleMatches(category.cycle, cycle) !== false);
  }
  return { selectedLevel, selectedProgram, selectedProgramId: storedProgram?.id || "", route, cycle, visibleCategories, levelCategories, programCategories };
}

function renderAdmissionContextControls(categories, context) {
  const routes = [...new Set(categories.map((category) => String(category.applicant_route || "").trim()).filter(Boolean))];
  const cycles = [...new Set(categories.flatMap((category) => [
    category.cycle,
    ...(Array.isArray(category.deadlines) ? category.deadlines.map((deadline) => deadline?.cycle) : []),
    ...(Array.isArray(category.admission_rounds) ? category.admission_rounds.map((round) => round?.cycle) : []),
  ]).map((value) => String(value || "").trim()).filter((value) => value && value.length <= 40))];
  const select = (key, label, value, options) => `
    <label class="admission-context-control">
      <span>${escapeHtml(label)}</span>
      <select data-admission-context="${key}">
        <option value="">${escapeHtml(t("university.admissions.context.unknown", "Unknown"))}</option>
        ${value && !options.includes(value) ? (() => {
          const provenMismatch = key === "cycle"
            ? options.length > 0 && options.every((option) => cycleMatches(option, value) === false)
            : !options.includes(value);
          const note = provenMismatch
            ? ` (${escapeHtml(t(key === "cycle" ? "university.admissions.context.unmatched_cycle" : "university.admissions.context.unmatched", key === "cycle" ? "does not match listed cycle data" : "not matched to listed routes"))})`
            : "";
          return `<option value="${escapeHtmlAttr(value)}" selected>${escapeHtml(key === "cycle" ? localizeMitDeadlineText(value) : applicantRouteLabel(value))}${note}</option>`;
        })() : ""}
        ${options.map((option) => `<option value="${escapeHtmlAttr(option)}"${option === value ? " selected" : ""}>${escapeHtml(key === "route" ? applicantRouteLabel(option) : localizeMitDeadlineText(option))}</option>`).join("")}
      </select>
    </label>`;
  const controls = [];
  if (routes.length) controls.push(select("route", t("university.admissions.route_label", "Applicant route"), context.route, routes));
  if (cycles.length) controls.push(select("cycle", t("university.admissions.cycle_label", "Entry cycle"), context.cycle, cycles));
  return controls.length ? `<div class="admission-context-controls">${controls.join("")}</div>` : "";
}

function applicantRouteLabel(route) {
  const labels = {
    first_year: t("university.admissions.route.first_year", "First-year"),
    transfer: t("university.admissions.route.transfer", "Transfer"),
    graduate: t("university.admissions.route.graduate", "Graduate"),
  };
  return labels[String(route || "")] || t("university.admissions.context.unknown", "Unknown");
}

function renderSelectedProgramContext(university, selectedProgram) {
  if (selectedProgram === GENERAL_PROGRAM_KEY) return "";
  const program = university.academics?.programs?.find((item) =>
    normalizeProgramToken(item.id) === selectedProgram
    || normalizeProgramToken(item.name || item.program_name) === selectedProgram);
  if (!program) return "";
  const context = selectedAdmissionContext(university, getAdmissionContextProfile(university));
  return `<div class="mit-section-context"><span>${escapeHtml(t("university.admissions.selected_program", "Selected program"))}</span><strong>${escapeHtml(trProgramName(program.name || program.program_name) || program.name || program.program_name)}</strong><span>${escapeHtml(applicantRouteLabel(context.route))} · ${escapeHtml(context.cycle ? localizeMitDeadlineText(context.cycle) : t("university.admissions.context.unknown", "Unknown"))}</span></div>`;
}

function localizeDeadlineDate(value) {
  const raw = String(value || "").trim();
  if (getCurrentLanguage() !== "rus") return raw;
  const exact = parseExactDeadlineDate(raw);
  if (exact) return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${exact}T00:00:00Z`));
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const partial = raw.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  const monthIndex = partial ? month.findIndex((name) => name.toLowerCase() === partial[1].toLowerCase()) : -1;
  return monthIndex >= 0 ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2028, monthIndex, Number(partial[2])))) : translateAdmissionText(raw, raw);
}

function localizeMitDeadlineText(value) {
  const raw = String(value || "");
  if (getCurrentLanguage() !== "rus") return raw;
  return translateAdmissionText(raw, raw)
    .replace(/\b(Fall|Spring) (\d{4}) entry\b/g, (_, season, year) =>
      `${t(season === "Fall" ? "university.deadlines.season.fall" : "university.deadlines.season.spring", season)} ${year}`)
    .replace(/\b(\d{4}) entry\b/g, (_, year) => t("university.deadlines.entry_year", "Entry in {year}").replace("{year}", year))
    .replace(/\bMid-March\b/g, t("university.deadlines.mid_march", "Mid-March"))
    .replace(/\bMid-December\b/g, t("university.deadlines.mid_december", "Mid-December"));
}

function fundingDeadlineText(value, award = null, field = "deadline") {
  if (value == null || value === "") return t("university.finance.award_unknown", "Not published");
  if (Array.isArray(value)) return value.map((item) => fundingDeadlineText(item, award, field)).join(" · ");
  if (typeof value === "object") {
    if (value.date) {
      const round = value.round ? ` · ${t("university.finance.award_round", "Round")} ${value.round}` : "";
      const time = value.time ? ` ${value.time}` : "";
      const label = value.label ? `${translateFundingAwardField(award, `${field}_label`, value.label)}: ` : "";
      return `${label}${value.date}${time}${round}`;
    }
    return Object.entries(value)
      .map(([key, date]) => `${t(`university.finance.award.deadline_label.${key}`, translateWord(key, key.replaceAll("_", " ")))}: ${fundingDeadlineText(date, award, field)}`)
      .join(" · ");
  }
  return translateFundingAwardField(award, field, value);
}

function fundingProcessLabel(process) {
  const labels = {
    automatic: t("university.finance.award_process.automatic", "No separate award application; reviewed with the course application"),
    course_application_selection: t("university.finance.award_process.course_application_selection", "Select the award in the course application"),
    separate: t("university.finance.award_process.separate", "Separate award application required"),
    post_offer: t("university.finance.award_process.post_offer", "Apply after receiving an admission offer"),
  };
  return labels[String(process || "").trim().toLowerCase()] || t("university.finance.award_unknown", "Not published");
}

function renderFundingAwardList(finance, categories, studyLevel, programCategories = categories) {
  const awards = getFundingAwardsForSelection(finance, categories, studyLevel, programCategories);
  if (!awards.length) return "";

  const unknown = t("university.finance.award_unknown", "Not published");
  const row = (label, value) => `
    <div class="finance-award-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || unknown)}</dd>
    </div>
  `;
  return `
    <div class="finance-awards-list">
      ${awards.map((award) => {
        const basisDefaults = {
          need: "Need-based",
          merit: "Merit-based",
          need_and_merit: "Need and merit",
        };
        const basis = t(`university.finance.award_basis.${award.basis}`, basisDefaults[award.basis] || t("university.finance.award_unknown", "Not published"));
        const levels = normalizeAwardLevels(award).map((level) => trStudyLevel(level)).join(" / ") || unknown;
        const coverage = Array.isArray(award.coverage)
          ? award.coverage.map((item, index) => t(`university.finance.award.coverage_item.${item}`, translateFundingAwardField(award, `coverage.${index}`, translateWord(item, item.replaceAll("_", " "))))).join(", ")
          : translateFundingAwardField(award, "coverage", award.coverage);
        const steps = Array.isArray(award.steps) ? award.steps : [];
        const documents = Array.isArray(award.documents) ? award.documents : [];
        const sourceLinks = [award.source_url, ...(Array.isArray(award.source_urls) ? award.source_urls : [])]
          .map((url) => safeHttpUrl(url))
          .filter((url, index, all) => url && all.indexOf(url) === index);
        const scholarshipName = translateFundingAwardField(award, "name", award.name || award.label || t("university.finance.award_title_fallback", "Funding award"));
        const applicantScope = award.applicant_scope || award.target_audience;
        const applicantScopeText = String(applicantScope || "").toLowerCase() === "domestic_only"
          ? t("university.finance.award.applicant_scope.domestic_only", "Home fee status only; this is not determined by citizenship alone")
          : translateFundingAwardField(award, "applicant_scope", applicantScope);
        const targetScope = [
          translateFundingAwardField(award, "program_scope", award.program_scope),
          applicantScope === "all" ? unknown : applicantScopeText,
        ]
          .filter(Boolean)
          .join(" · ");
        const cycle = translateFundingAwardField(award, "cycle", award.academic_year || award.cycle);
        const timezone = translateFundingAwardField(award, "deadline_timezone", award.deadline_timezone);
        return `
          <article class="finance-award-card">
            <header class="finance-award-head">
              <h4>${escapeHtml(scholarshipName)}</h4>
              <span class="finance-award-basis">${escapeHtml(basis)}</span>
            </header>
            <p class="finance-award-scope">${escapeHtml(targetScope || unknown)} · ${escapeHtml(levels)} · ${escapeHtml(cycle)}</p>
            <dl class="finance-award-facts">
              ${row(t("university.finance.award_coverage", "What it covers"), coverage)}
              ${row(t("university.finance.award_eligibility", "Who can apply"), translateFundingAwardField(award, "eligibility", award.eligibility))}
              ${row(t("university.finance.award_application", "How to apply"), fundingProcessLabel(award.application_process))}
              ${row(t("university.finance.award_course_deadline", "Course application deadline"), fundingDeadlineText(award.course_application_deadline, award, "course_application_deadline"))}
              ${row(t("university.finance.award_deadline", "Award application deadline"), fundingDeadlineText(award.award_application_deadline, award, "award_application_deadline"))}
              ${row(t("university.finance.award_timezone", "Time zone"), timezone)}
            </dl>
            <details class="finance-award-details">
              <summary>${escapeHtml(t("university.finance.award_details", "Steps, documents, and conditions"))}</summary>
              <div class="finance-award-details-content">
                ${row(t("university.finance.award_steps", "Application steps"), steps.length ? steps.map((step, index) => translateFundingAwardField(award, `steps.${index}`, step)).join(" • ") : unknown)}
                ${row(t("university.finance.award_documents", "Documents"), documents.length ? documents.map((document, index) => translateFundingAwardField(award, `documents.${index}`, document)).join(" • ") : unknown)}
                ${row(t("university.finance.award_competition", "Competition"), translateFundingAwardField(award, "competition", award.competition))}
                ${row(t("university.finance.award_renewal", "Renewal"), translateFundingAwardField(award, "renewal", award.renewal))}
                ${row(t("university.finance.award_verified", "Verified"), award.verified_at)}
                <div class="finance-award-row">
                  <dt>${escapeHtml(t("university.finance.award_source", "Official source"))}</dt>
                  <dd>${sourceLinks.length ? sourceLinks.map((url) => `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.finance.award_open_source", "Open university page"))}</a>`).join(" · ") : escapeHtml(unknown)}</dd>
                </div>
              </div>
            </details>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function refreshFundingAwardsForVisibleAdmission(university) {
  if (typeof document === "undefined") return;
  const container = document.getElementById("detailScholarshipInfo");
  if (!container) return;
  const context = visibleAdmissionContextByUniversity.get(String(university?.id || ""));
  if (!context) return;
  const awardsHtml = renderFundingAwardList(
    university?.finance,
    context.visibleCategories,
    context.selectedLevel,
    context.visibleCategories,
  );
  container.innerHTML = `
    <p class="finance-awards-disclaimer">${escapeHtml(t("university.finance.awards_not_guaranteed", "These are funding opportunities, not award offers. Estimated costs do not decrease unless aid is officially awarded."))}</p>
    ${awardsHtml || renderScholarshipLine("information-circle", "scholarship-line--muted", t("university.finance.award_none_for_scope", "No listed awards match this study level and program."))}
  `;
}

function getCategoryLevelsList(category) {
  const levels = Array.isArray(category?.study_levels)
    ? category.study_levels
    : (category?.study_level ? [category.study_level] : []);
  return levels.map((l) => String(l || "").trim()).filter(Boolean);
}

function categoryIsMba(category) {
  const searchable = [category?.label, category?.category_label, category?.name, category?.id, ...(Array.isArray(category?.program_names) ? category.program_names : [])]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return /\bmba\b|master of business administration/.test(searchable);
}

function categoryMatchesStudyLevel(category, selectedLevelKey) {
  if (!selectedLevelKey || ["all", "any", "general"].includes(selectedLevelKey)) return true;
  const levels = getCategoryLevelsList(category);
  const scope = String(category?.scope || "").trim().toLowerCase();
  const hasLegacyBachelorScope = ["general", "program", "program_group"].includes(scope);
  if (selectedLevelKey === "mba" && categoryIsMba(category)) return true;
  if (levels.length) return levels.some((lvl) => normalizeLevelKey(lvl) === selectedLevelKey);
  if (hasLegacyBachelorScope) return selectedLevelKey === "bachelor";
  return false;
}

export function getFinanceChoicesForStudyLevel(categories, studyLevel) {
  const selectedLevelKey = normalizeLevelKey(studyLevel);
  const sourceCategories = Array.isArray(categories) ? categories : [];
  return sourceCategories
    .filter((category) => categoryMatchesStudyLevel(category, selectedLevelKey))
    .flatMap((category) => getAdmissionChoicesFromCategories([category]));
}

export function getFinanceForChoice(choice, universityFinance) {
  if (choice?.finance_override && typeof choice.finance_override === "object") {
    if (getTrackFundingType(choice) === "grant" && choice.__is_funding_option) return null;
    return choice.finance_override;
  }
  const levels = getCategoryLevelsList(choice).map(normalizeLevelKey);
  const scope = String(choice?.scope || "").toLowerCase();
  const isGraduate = levels.some((level) => ["master", "mba", "doctorate", "professional"].includes(level))
    || /^(graduate|postgraduate|doctoral)/.test(scope);
  return isGraduate ? null : universityFinance;
}

function modeAwareAnnualCostIfKnown(finance, studyMode) {
  if (!finance || typeof finance !== "object") return undefined;
  const total = modeAwareAnnualCost(finance, studyMode);
  const publishedTotal = finance.total_cost_year_usd;
  const hasPublishedTotal = publishedTotal != null
    && String(publishedTotal).trim() !== ""
    && Number.isFinite(Number(publishedTotal));
  return !hasPublishedTotal && Number(total) === 0 ? undefined : total;
}

function publishedAnnualCostRange(finance) {
  if (!finance || typeof finance !== "object") return null;
  const nestedRange = finance.total_cost_year_range && typeof finance.total_cost_year_range === "object"
    ? finance.total_cost_year_range
    : {};
  const minValue = nestedRange.min ?? finance.total_cost_year_min;
  const maxValue = nestedRange.max ?? finance.total_cost_year_max;
  const currency = String(nestedRange.currency || finance.currency || "").trim().toUpperCase();
  if (minValue == null || maxValue == null || String(minValue).trim() === "" || String(maxValue).trim() === "" || !currency) return null;
  const min = Number(minValue);
  const max = Number(maxValue);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
  return {
    min,
    max,
    currency,
    academicYear: String(nestedRange.academic_year || finance.academic_year || "").trim(),
    feeStatus: String(finance.fee_status || "").trim().toLowerCase(),
    scope: String(finance.scope || "").trim(),
  };
}

function publishedAnnualCostRangeForChoice(choice, universityFinance) {
  const choiceRange = publishedAnnualCostRange(choice?.finance_override);
  if (choiceRange) return choiceRange;
  const universityRange = publishedAnnualCostRange(universityFinance);
  const categoryScope = String(choice?.category_label || choice?.label || "")
    .split("(")[0]
    .trim()
    .toLowerCase();
  if (!universityRange?.scope || !categoryScope || !universityRange.scope.toLowerCase().includes(categoryScope)) return null;
  return universityRange;
}

function getCommonAnnualCostRange(choices, universityFinance) {
  if (!choices.length) return null;
  const ranges = choices.map((choice) => publishedAnnualCostRangeForChoice(choice, universityFinance));
  if (ranges.some((range) => !range)) return null;
  const signatures = new Set(ranges.map((range) => JSON.stringify(range)));
  if (signatures.size !== 1) return null;
  const range = ranges[0];
  return range.academicYear && (range.scope || range.feeStatus) ? range : null;
}

function getProgramTuitionForChoice(choice, university) {
  const programIds = Array.isArray(choice?.program_ids) ? choice.program_ids.map((id) => String(id || "").trim().toLowerCase()) : [];
  const selectedProgramId = String(choice?.program_id || choice?.programId || "").trim().toLowerCase();
  if (!programIds.length && !selectedProgramId) return null;
  const catalogPrograms = Array.isArray(university?.academics?.programs) ? university.academics.programs : [];
  const identifiersFor = (item) => [item?.id, item?.course_number, item?.name, item?.title]
    .map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  const selectedProgram = selectedProgramId
    ? catalogPrograms.find((item) => [item?.id, item?.course_number].some((id) => String(id || "").trim().toLowerCase() === selectedProgramId))
    : null;
  if (selectedProgramId && (!selectedProgram || (programIds.length && !identifiersFor(selectedProgram).some((id) => programIds.includes(id))))) return null;
  const resolvedPrograms = selectedProgram ? [selectedProgram] : programIds.map((programId) => {
    return catalogPrograms.find((item) => identifiersFor(item).includes(programId));
  });
  if (!selectedProgram && resolvedPrograms.some((program) => !program)) return null;
  const programs = [...new Set(resolvedPrograms)];
  const pricedPrograms = programs.map((program) => ({
    program,
    amount: Number(program?.tuition_year_usd),
    sourceUrl: String(program?.tuition_source_url || "").trim(),
    currency: String(program?.currency || "USD").trim().toUpperCase(),
    cycle: String(program?.tuition_cycle || "").trim(),
  }));
  if (!pricedPrograms.length || pricedPrograms.some(({ amount, sourceUrl, cycle }) => !Number.isFinite(amount) || amount <= 0 || !sourceUrl || !cycle)) return null;
  const tuitionSignatures = new Set(pricedPrograms.map(({ amount, currency, cycle }) => {
    const year = cycle.match(/\b20\d{2}[-–]\d{2,4}\b/)?.[0] || "";
    return JSON.stringify([amount, currency, year]);
  }));
  const { amount, sourceUrl, currency, cycle } = pricedPrograms[0] || {};
  const year = cycle?.match(/\b20\d{2}[-–]\d{2,4}\b/)?.[0] || "";
  if (tuitionSignatures.size !== 1 || !year) return null;
  return {
    finance: {
      total_cost_year_usd: amount,
      costs_breakdown_year_usd: { Tuition: amount },
      currency,
    },
    year,
    sourceUrl,
  };
}

function annualCostRangeContext(range) {
  if (!range) return "";
  const applicantCategory = {
    domestic: t("university.finance.range_applicants.domestic", "Domestic applicants"),
    home: t("university.finance.range_applicants.home", "Home-fee applicants"),
    overseas: t("university.finance.range_applicants.overseas", "Overseas applicants"),
    international: t("university.finance.range_applicants.international", "International applicants"),
  }[range.feeStatus] || "";
  const scope = range.scope && range.scope.toLowerCase() !== "program"
    ? `${t("university.finance.range_scope_label", "Applies to")}: ${range.scope}`
    : "";
  const academicYear = range.academicYear
    ? `${t("university.finance.academic_year_label", "Academic year")}: ${range.academicYear}`
    : "";
  return [scope, applicantCategory, academicYear].filter(Boolean).join(" · ");
}

function hasFundingSpecificFinanceOverride(university, choice) {
  const category = (Array.isArray(university?.admission_categories) ? university.admission_categories : [])
    .find((item) => String(item?.id || "") === String(choice?.category_id || ""));
  if (!category) return false;
  const profiles = Array.isArray(category.requirement_profiles) ? category.requirement_profiles : [];
  const profile = profiles.find((item) => String(item?.id || "") === String(choice?.requirement_profile_id || ""));
  const fundingOptions = Array.isArray(profile?.funding_options) && profile.funding_options.length
    ? profile.funding_options
    : (Array.isArray(category.funding_options) ? category.funding_options : []);
  const funding = fundingOptions.find((item) => String(item?.id || "") === String(choice?.funding_option_id || ""));
  return isPlainObject(funding?.finance_override);
}

function getCourseFinanceWithoutAwardOverride(university, choice) {
  const categories = Array.isArray(university?.admission_categories) ? university.admission_categories : [];
  const category = categories.find((item) => String(item?.id || "") === String(choice?.category_id || ""));
  if (!category) return null;
  const profiles = Array.isArray(category.requirement_profiles) ? category.requirement_profiles : [];
  const profile = profiles.find((item) => String(item?.id || "") === String(choice?.requirement_profile_id || ""));
  if (isPlainObject(profile?.finance_override)) return profile.finance_override;
  if (isPlainObject(category.finance_override)) return category.finance_override;
  const levels = getCategoryLevelsList(choice).map(normalizeLevelKey);
  const scope = String(choice?.scope || "").toLowerCase();
  const isGraduate = levels.some((level) => ["master", "mba", "doctorate", "professional"].includes(level))
    || /^(graduate|postgraduate|doctoral)/.test(scope);
  return isGraduate ? null : university?.finance || null;
}

function safeHttpUrl(value) {
  try {
    const source = String(value || "").trim();
    const url = new URL(source);
    return ["https:", "http:"].includes(url.protocol) ? source : "";
  } catch {
    return "";
  }
}

function extractUniversityDeadlines(university, categories) {
  const items = [];
  const seenKeys = new Set();

  const addRound = (round) => {
    const key = round.publicationStatus === "conflicting" && round.id
      ? `${round.level}:${round.id}`
      : `${round.level}:${round.title}:${round.deadline}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    items.push(round);
  };

  if (university?.deadlines && typeof university.deadlines === "object") {
    const d = university.deadlines;
    if (d.undergraduate && typeof d.undergraduate === "object") {
      const ug = d.undergraduate;
      addRound({
        level: "Bachelor",
        levelKey: "bachelor",
        title: t("university.deadlines.undergraduate_ucas", "Undergraduate (UCAS)"),
        cycle: ug.cycle || ug.academic_year || "",
        scope: ug.scope || "Undergraduate",
        sourceUrl: safeHttpUrl(ug.source_url),
        deadline: ug.application_deadline || "",
        notification: ug.decision_release_date || "",
        portal: ug.application_portal || "",
        fee: ug.application_fee_gbp ? `£${ug.application_fee_gbp}` : "",
        notes: ug.interview_period ? `${t("university.deadlines.interviews_label", "Interviews")}: ${ug.interview_period}` : "",
      });
    }
    if (d.graduate_taught_masters && typeof d.graduate_taught_masters === "object") {
      const gt = d.graduate_taught_masters;
      if (gt.scholarship_deadline_guidance) addRound({
        level: "Master", levelKey: "master", title: t("university.deadlines.graduate_guidance_title", "Graduate deadline guidance"),
        cycle: gt.cycle || gt.academic_year || "", scope: gt.scope || "Graduate taught courses",
        sourceUrl: safeHttpUrl(gt.source_url), guidance: true,
        notes: t("university.deadlines.guidance_course_dependent", "Deadlines vary by course. Check the course page for its exact date."),
      });
      addRound({
        level: "Master",
        levelKey: "master",
        title: t("university.deadlines.postgraduate_taught", "Postgraduate taught courses"),
        cycle: gt.cycle || gt.academic_year || "",
        scope: gt.scope || "",
        sourceUrl: safeHttpUrl(gt.source_url),
        deadline: gt.main_january_scholarship_deadline || gt.early_december_deadline || "",
        portal: gt.application_portal || "",
        fee: gt.application_fee_gbp ? `£${gt.application_fee_gbp}` : "",
        notes: "",
      });
      (Array.isArray(gt.mba_rounds) ? gt.mba_rounds : []).forEach((round) => addRound({
        level: "MBA", levelKey: "mba", title: `${t("university.deadlines.mba_round", "MBA application round")} ${round.stage || ""}`.trim(),
        cycle: round.cycle || gt.cycle || "", scope: round.scope || "MBA",
        sourceUrl: safeHttpUrl(round.source_url || gt.source_url), deadline: round.deadline || "", notes: "",
      }));
    }
    if (d.graduate_research_dphil && typeof d.graduate_research_dphil === "object") {
      const gr = d.graduate_research_dphil;
      if (gr.scholarship_deadline_guidance) addRound({
        level: "PhD", levelKey: "doctorate", title: t("university.deadlines.graduate_guidance_title", "Graduate deadline guidance"),
        cycle: gr.cycle || gr.academic_year || "", scope: gr.scope || "Research graduate courses",
        sourceUrl: safeHttpUrl(gr.source_url), guidance: true,
        notes: t("university.deadlines.guidance_course_dependent", "Deadlines vary by course. Check the course page for its exact date."),
      });
      addRound({
        level: "PhD",
        levelKey: "doctorate",
        title: t("university.deadlines.doctoral_research", "Doctoral research courses"),
        cycle: gr.cycle || gr.academic_year || "",
        scope: gr.scope || "",
        sourceUrl: safeHttpUrl(gr.source_url),
        deadline: gr.main_scholarship_deadline || "",
        portal: gr.application_portal || "",
        notes: "",
      });
    }
  }

  if (Array.isArray(categories)) {
    categories.forEach((cat) => {
      const catLabel = cat.label || cat.name || "";
      const levels = getCategoryLevelsList(cat);
      const levelDisplay = categoryIsMba(cat) ? "MBA" : (levels[0] || "General");
      const levelKey = normalizeLevelKey(levelDisplay);
      const portal = cat.application_portal || (Array.isArray(cat.application_portals) ? cat.application_portals[0] : "");
      let fee = "";
      if (typeof cat.application_fee === "string") {
        fee = cat.application_fee;
      } else if (cat.application_fee && typeof cat.application_fee === "object") {
        fee = cat.application_fee.amount ? `${cat.application_fee.currency || "$"}${cat.application_fee.amount}` : "";
      } else if (cat.application_fee_usd) {
        fee = `$${cat.application_fee_usd}`;
      }
      const waiver = Boolean(cat.fee_waiver_available || cat.fee_waiver_policy || (cat.application_fee && typeof cat.application_fee === "object" && cat.application_fee.waiver_available));

      if (Array.isArray(cat.admission_rounds) && cat.admission_rounds.length) {
        cat.admission_rounds.forEach((r) => {
          addRound({
            level: levelDisplay,
            levelKey,
            title: `${catLabel}: ${r.name || r.id}`,
            cycle: r.cycle || cat.cycle || cat.academic_year || "",
            applicantRoute: cat.applicant_route || "",
            scope: r.scope || cat.scope || levelDisplay,
            sourceUrl: safeHttpUrl(r.source_url || cat.source_url),
            approximate: r.approximate === true || r.is_approximate === true,
            deadline: r.deadline || "",
            notification: r.notification || "",
            replyDeadline: r.reply_deadline || "",
            portal,
            fee,
            waiver,
            notes: r.description || "",
          });
        });
      }

      if (Array.isArray(cat.deadlines) && cat.deadlines.length) {
        cat.deadlines.forEach((dl) => {
          const eventNames = {
            course_application: t("university.deadlines.event.application", "Application"),
            standardized_test: t("university.deadlines.event.test", "Test scores"),
            aid_application: t("university.deadlines.event.aid", "Financial aid"),
            equal_consideration: t("university.deadlines.event.equal_consideration", "Equal consideration"),
          };
          const roundName = eventNames[dl.deadline_type] || translateAdmissionText(dl.round, dl.round) || catLabel;
          const dlDate = dl.application_deadline || dl.date || "";
          addRound({
            id: dl.id || "",
            level: levelDisplay,
            levelKey,
            title: university?.id === MIT_ID ? `${catLabel} · ${roundName}` : `${catLabel} (${roundName})`,
            cycle: dl.cycle || cat.cycle || cat.academic_year || "",
            applicantRoute: cat.applicant_route || "",
            applicantCategory: dl.applicant_category || "",
            applicantCategoryLabel: dl.applicant_category_label || "",
            applicabilityLabel: dl.applicability_label || "",
            scope: dl.scope || cat.scope || levelDisplay,
            sourceUrl: safeHttpUrl(dl.source_url || cat.source_url),
            conflictingSourceUrl: safeHttpUrl(dl.conflicting_source_url),
            publicationStatus: dl.publication_status || "",
            approximate: dl.approximate === true || dl.is_approximate === true,
            deadline: dlDate,
            time: dl.time || "",
            timezone: dl.timezone || "",
            notification: dl.decision_notification || "",
            aidDeadline: dl.financial_aid_deadline || "",
            replyDeadline: dl.reply_deadline || "",
            portal,
            fee: university?.id === MIT_ID && ["standardized_test", "aid_application"].includes(dl.deadline_type) ? "" : fee,
            waiver: university?.id === MIT_ID && ["standardized_test", "aid_application"].includes(dl.deadline_type) ? false : waiver,
            notes: dl.notes || dl.note || (dl.time_uk ? `${t("university.deadlines.time_label", "Time")}: ${dl.time_uk} UK` : ""),
          });
        });
      }

      if (cat.application_deadline && !cat.admission_rounds?.length && !cat.deadlines?.length) {
        addRound({
          level: levelDisplay,
          levelKey,
          title: catLabel,
          cycle: cat.cycle || cat.academic_year || university?.finance?.academic_year || "",
          applicantRoute: cat.applicant_route || "",
          deadline: cat.application_deadline,
          notification: cat.decision_notification || "",
          aidDeadline: cat.financial_aid_deadline || "",
          portal,
          fee,
          waiver,
          notes: cat.degree_level || "",
          scope: cat.scope || levelDisplay,
          sourceUrl: safeHttpUrl(cat.source_url),
          approximate: cat.approximate === true || cat.is_approximate === true,
        });
      }
    });
  }

  return items;
}

function renderDeadlineCalendar(universityId, deadlines) {
  const locale = getCurrentLanguage() === "rus" ? "ru-RU" : "en-US";
  const dated = deadlines.map((item, index) => ({ item, index, date: item.approximate || item.is_approximate ? null : parseExactDeadlineDate(item.deadline) }))
    .filter((entry) => entry.date);
  const undatedCount = deadlines.length - dated.length;
  if (!dated.length) {
    return `<section class="deadline-calendar"><h4>${escapeHtml(t("university.deadlines.calendar_title", "Deadline calendar"))}</h4><p>${escapeHtml(t("university.deadlines.calendar_no_exact", "No deadlines with an exact published date and year. See the timeline below for approximate or yearless deadlines."))}</p></section>`;
  }

  dated.sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date().toISOString().slice(0, 10);
  const firstRelevant = dated.find((entry) => entry.date >= today) || dated[0];
  const monthKey = deadlineCalendarMonthByUniversity.get(universityId) || firstRelevant.date.slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthTitle = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart);
  const weekFormatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, index) => weekFormatter.format(new Date(Date.UTC(2026, 0, 5 + index))));
  const monthEvents = dated.filter((entry) => entry.date.startsWith(monthKey));
  const selectedDay = deadlineCalendarDayByUniversity.get(universityId);
  const activeDay = selectedDay?.startsWith(monthKey) ? selectedDay : (monthEvents[0]?.date || "");
  const activeEvents = monthEvents.filter((entry) => entry.date === activeDay);
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  const cells = getCalendarCells(year, month - 1).map((day) => {
    if (day === null) return '<span class="deadline-calendar__blank" aria-hidden="true"></span>';
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    const count = monthEvents.filter((entry) => entry.date === date).length;
    if (!count) return `<span class="deadline-calendar__day">${day}</span>`;
    const fullDate = dateFormatter.format(new Date(`${date}T00:00:00Z`));
    return `<button type="button" class="deadline-calendar__day deadline-calendar__day--event${date === activeDay ? " is-active" : ""}" data-calendar-day="${date}" aria-label="${escapeHtmlAttr(fullDate)}: ${count} ${escapeHtmlAttr(t("university.deadlines.calendar_events", "deadlines"))}" aria-pressed="${date === activeDay}"><span>${day}</span><span class="deadline-calendar__count">${count}</span></button>`;
  }).join("");

  return `<section class="deadline-calendar" aria-label="${escapeHtmlAttr(t("university.deadlines.calendar_title", "Deadline calendar"))}">
    <div class="deadline-calendar__head">
      <h4>${escapeHtml(t("university.deadlines.calendar_title", "Deadline calendar"))}</h4>
      <div class="deadline-calendar__navigation">
        <button type="button" data-calendar-month="previous" aria-label="${escapeHtmlAttr(t("university.deadlines.calendar_previous", "Previous month"))}">${heroIcon("chevron-left", "ui-icon ui-icon--16")}</button>
        <strong aria-live="polite">${escapeHtml(monthTitle)}</strong>
        <button type="button" data-calendar-month="next" aria-label="${escapeHtmlAttr(t("university.deadlines.calendar_next", "Next month"))}">${heroIcon("chevron-right", "ui-icon ui-icon--16")}</button>
      </div>
    </div>
    <div class="deadline-calendar__grid" role="group" aria-label="${escapeHtmlAttr(monthTitle)}" data-calendar-month-key="${monthKey}">
      ${weekdays.map((day) => `<span class="deadline-calendar__weekday">${escapeHtml(day)}</span>`).join("")}
      ${cells}
    </div>
    <div class="deadline-calendar__details" aria-live="polite">
      ${activeEvents.length
        ? `<strong>${escapeHtml(dateFormatter.format(new Date(`${activeDay}T00:00:00Z`)))}</strong><ul>${activeEvents.map(({ item, index }) => `<li><a href="#deadline-card-${index}">${escapeHtml(item.title)}</a><button type="button" class="deadline-calendar__export" data-calendar-export="${index}">${escapeHtml(t("university.deadlines.export_ics", "Add to calendar (.ics)"))}</button></li>`).join("")}</ul>`
        : `<p>${escapeHtml(t("university.deadlines.calendar_empty_month", "No exact deadlines this month."))}</p>`}
    </div>
    ${undatedCount ? `<p class="deadline-calendar__note">${escapeHtml(t("university.deadlines.calendar_partial_note", "Deadlines without an exact date and year appear only in the list below."))}</p>` : ""}
  </section>`;
}

export function renderDeadlinesTabSection({ container, university, onContextChange }) {
  if (!container) return;
  const universityId = String(university.id || "").trim();
  const categories = getAdmissionCategories(university);
  const admissionContext = selectedAdmissionContext(university, getAdmissionContextProfile(university));
  const hasProgramSelection = admissionContext.selectedProgram !== GENERAL_PROGRAM_KEY;
  const deadlineCategories = admissionContext.visibleCategories;
  const allDeadlines = extractUniversityDeadlines(university, deadlineCategories)
    .filter((item) => !admissionContext.cycle || !item.cycle || cycleMatches(item.cycle, admissionContext.cycle) !== false);
  if (hasProgramSelection && !deadlineCategories.length) {
    container.innerHTML = `<div class="admission-empty-state">${escapeHtml(t("university.deadlines.program_not_reviewed", "Deadline details have not been reviewed for this program."))}</div>`;
    return;
  }
  if (!allDeadlines.some((item) => item.deadline || item.guidance)) {
    container.innerHTML = `${renderDeadlineCalendar(universityId, [])}<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.deadlines", "No deadlines published."))}</div>`;
    return;
  }

  const availableLevels = getAvailableStudyLevels(deadlineCategories);
  const activeLevel = admissionContext.selectedLevel || "all";

  const filtered = activeLevel === "all"
    ? allDeadlines
    : allDeadlines.filter((d) => d.levelKey === activeLevel || d.levelKey === "general");

  const filteredDeadlines = filtered.filter((item) => item.deadline || ["conflicting", "not_yet_published", "unknown"].includes(item.publicationStatus));
  const filteredGuidance = filtered.filter((item) => item.guidance);
  const milestones = filteredDeadlines.filter((item) => item.deadline).map((item, index) => ({
    step: index + 1,
    phase: trStudyLevel(item.level),
    date: item.deadline,
    title: item.title,
    desc: item.notes || "",
  }));
  const calendarIcon = heroIcon("calendar", "ui-icon ui-icon--18");

  const levelFilterHtml = availableLevels.length > 1 && !hasProgramSelection ? `
    <div class="admissions-level-filter" role="group" aria-label="${escapeHtmlAttr(t("university.deadlines.filter_by_level", "Filter deadlines by degree level"))}">
      <button
        type="button"
        class="admissions-level-tab${activeLevel === "all" ? " is-active" : ""}"
        data-deadlines-level="all"
      >${escapeHtml(t("university.deadlines.all_levels", "All Degrees"))} (${allDeadlines.length})</button>
      ${availableLevels.map((lvl) => {
        const count = allDeadlines.filter((d) => d.levelKey === lvl.key).length;
        if (!count) return "";
        return `
          <button
            type="button"
            class="admissions-level-tab${activeLevel === lvl.key ? " is-active" : ""}"
            data-deadlines-level="${escapeHtmlAttr(lvl.key)}"
          >${escapeHtml(lvl.label)} (${count})</button>
        `;
      }).join("")}
    </div>
  ` : "";

  const timelineHtml = milestones.length ? `
    <div class="deadlines-timeline-wrapper">
      <div class="deadlines-timeline-head">
        <h4 class="deadlines-timeline-title">
          ${calendarIcon}
          <span>${escapeHtml(t("university.deadlines.timeline_title", "Admissions Timeline"))}</span>
        </h4>
      </div>
      <div class="deadlines-timeline" role="list">
        ${milestones.map((m) => `
          <div class="timeline-milestone" role="listitem">
            <div class="timeline-milestone-head">
              <span class="timeline-milestone-step">${m.step}</span>
              <span class="timeline-milestone-phase">${escapeHtml(m.phase)}</span>
            </div>
            <div class="timeline-milestone-date">${escapeHtml(m.date)}</div>
            <div class="timeline-milestone-title">${escapeHtml(m.title)}</div>
            <p class="timeline-milestone-desc">${escapeHtml(m.desc)}</p>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  const guidanceHtml = filteredGuidance.length ? `
    <div class="deadline-guidance-list" aria-label="${escapeHtmlAttr(t("university.deadlines.guidance_title", "Admissions guidance"))}">
      ${filteredGuidance.map((item) => `<article class="deadline-guidance-item"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.notes)}</p>${item.scope ? `<span>${escapeHtml(item.scope)}</span>` : ""}${item.cycle ? `<span>${escapeHtml(t("university.admissions.cycle_label", "Cycle"))}: ${escapeHtml(item.cycle)}</span>` : ""}${item.sourceUrl ? `<a href="${escapeHtmlAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.deadlines.official_source", "Official source"))}</a>` : ""}</article>`).join("")}
    </div>
  ` : "";

  const cardsHtml = filteredDeadlines.length ? `
    <div class="admissions-deadlines-grid">
      ${filteredDeadlines.map((item, index) => {
        const feeStr = item.fee ? escapeHtml(String(item.fee)) : "";
        const waiverStr = item.waiver ? `<span class="admissions-fee-waiver">${escapeHtml(t("university.admissions.fee_waiver_available", "Fee waiver available"))}</span>` : "";
        const conflicting = item.publicationStatus === "conflicting";
        const publicationStatus = conflicting
          ? t("university.program_coverage.deadline_conflicting", "Official deadline information conflicts")
          : item.publicationStatus === "not_yet_published"
            ? t("university.program_coverage.deadline_not_published", "Not yet published by the university")
            : t("university.program_coverage.not_catalogued", "Not catalogued");
        const nextAction = conflicting
          ? t("university.program_coverage.next_action.deadline_conflicting", "Compare the official admissions pages and confirm the applicable deadline with the university.")
          : item.publicationStatus === "not_yet_published"
            ? t("university.program_coverage.next_action.deadline_not_published", "Check the official admissions page for updates to the deadline.")
            : t("university.program_coverage.next_action.deadline", "Confirm the course application deadline and entry year on the official admissions page.");
        return `
          <article class="admissions-deadline-item" id="deadline-card-${index}">
            <div class="admissions-deadline-item-head">
              <span class="admissions-deadline-level">${escapeHtml(trStudyLevel(item.level))}</span>
              ${item.portal ? `<span class="admissions-deadline-portal" title="${escapeHtmlAttr(item.portal)}">${escapeHtml(item.portal)}</span>` : ""}
            </div>
            <h4 class="admissions-deadline-name">${escapeHtml(item.title)}</h4>
            <div class="admissions-deadline-scope">${escapeHtml(t("university.admissions.route_label", "Applicant route"))}: ${escapeHtml(applicantRouteLabel(item.applicantRoute))}</div>
            ${item.applicantCategoryLabel ? `<div class="admissions-deadline-scope">${escapeHtml(t("university.deadlines.applicant_restriction", "Applicant restriction"))}: ${escapeHtml(item.applicantCategory === "us_citizen_or_permanent_resident_transfer" ? t("university.deadlines.us_citizen_permanent_resident_only", "U.S. citizens and U.S. permanent residents only") : item.applicantCategoryLabel)}</div>` : ""}
            ${item.applicabilityLabel ? `<div class="admissions-deadline-scope">${escapeHtml(t("university.deadlines.applicability", "Applies to"))}: ${escapeHtml(item.applicabilityLabel === "Spring entry only" ? t("university.deadlines.spring_entry_only", "Spring entry only") : item.applicabilityLabel)}</div>` : ""}
            ${item.cycle ? `<div class="admissions-deadline-cycle">${escapeHtml(t("university.admissions.cycle_label", "Cycle"))}: ${escapeHtml(localizeMitDeadlineText(item.cycle))}</div>` : ""}
            ${item.scope && universityId !== MIT_ID ? `<div class="admissions-deadline-scope">${escapeHtml(item.scope)}</div>` : ""}
            ${item.deadline ? `
              <div class="admissions-deadline-row admissions-deadline-row--primary">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.deadline_label", "Deadline"))}:</span>
                <strong class="admissions-deadline-date">${escapeHtml(localizeDeadlineDate(item.deadline))}</strong>
              </div>
            ` : `<p class="admissions-deadline-publication-status">${escapeHtml(publicationStatus)}</p>
              <p class="admissions-deadline-notes">${escapeHtml(nextAction)}</p>`}
            ${item.time ? `<div class="admissions-deadline-row admissions-deadline-time"><span class="admissions-deadline-label">${escapeHtml(t("university.deadlines.time_label", "Time"))}:</span><span>${escapeHtml(item.time)}${item.timezone ? ` ${escapeHtml(item.timezone)}` : ""}</span></div>` : ""}
            ${item.notification ? `
              <div class="admissions-deadline-row">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.notification_label", "Notification"))}:</span>
                <span>${escapeHtml(localizeMitDeadlineText(item.notification))}</span>
              </div>
            ` : ""}
            ${item.aidDeadline ? `
              <div class="admissions-deadline-row">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.aid_deadline_label", "Financial aid deadline"))}:</span>
                <span>${escapeHtml(localizeDeadlineDate(item.aidDeadline))}</span>
              </div>
            ` : ""}
            ${item.replyDeadline ? `
              <div class="admissions-deadline-row">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.reply_label", "Reply by"))}:</span>
                <span>${escapeHtml(item.replyDeadline)}</span>
              </div>
            ` : ""}
            ${feeStr ? `
              <div class="admissions-deadline-row admissions-deadline-fee-row">
                <span class="admissions-deadline-label">${escapeHtml(universityId === MIT_ID ? t("university.deadlines.application_fee", "Application fee") : t("university.admissions.portal_fee_label", "Fee"))}:</span>
                <span>${feeStr} ${waiverStr}</span>
              </div>
            ` : ""}
            ${item.notes && !(universityId === MIT_ID && item.notes === item.level) ? `<p class="admissions-deadline-notes">${escapeHtml(item.notes)}</p>` : ""}
            ${item.sourceUrl ? `<a class="admissions-deadline-source" href="${escapeHtmlAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.deadlines.official_source", "Official source"))}</a>` : ""}
            ${item.conflictingSourceUrl ? `<a class="admissions-deadline-source" href="${escapeHtmlAttr(item.conflictingSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.program_coverage.source", "Official source"))}</a>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  ` : `<div class="admission-empty-state">${escapeHtml(t("university.deadlines.none_for_level", "No published deadlines for this study level."))}</div>`;

  const calendarHtml = renderDeadlineCalendar(universityId, filteredDeadlines);
  if (universityId === MIT_ID) {
    const calendarWasOpen = container.querySelector?.(".mit-deadline-calendar")?.open === true;
    container.innerHTML = `${renderSelectedProgramContext(university, admissionContext.selectedProgram)}${levelFilterHtml}${guidanceHtml}${cardsHtml}<details class="mit-deadline-calendar"${calendarWasOpen ? " open" : ""}><summary>${escapeHtml(t("university.deadlines.show_calendar", "Show deadline calendar"))}</summary>${calendarHtml}</details>`;
  } else {
    container.innerHTML = `${renderSelectedProgramContext(university, admissionContext.selectedProgram)}${levelFilterHtml}${calendarHtml}${guidanceHtml}${timelineHtml}${cardsHtml}`;
  }

  container.querySelectorAll("[data-deadlines-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      motionPress(btn);
      const lvl = btn.getAttribute("data-deadlines-level") || "all";
      deadlinesActiveLevelByUniversity.set(universityId, lvl);
      admissionStudyLevelSelectionByUniversity.set(universityId, lvl);
      updateAdmissionUrl({ level: lvl, route: "", cycle: "" });
      deadlineCalendarMonthByUniversity.delete(universityId);
      deadlineCalendarDayByUniversity.delete(universityId);
      onContextChange?.();
      renderDeadlinesTabSection({ container, university });
    });
  });

  container.querySelectorAll("[data-calendar-month]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = deadlineCalendarMonthByUniversity.get(universityId)
        || container.querySelector(".deadline-calendar__grid")?.getAttribute("data-calendar-month-key");
      const visibleMonth = /^\d{4}-\d{2}$/.test(current || "") ? current : null;
      const dated = filteredDeadlines.map((item) => parseExactDeadlineDate(item.deadline)).filter(Boolean).sort();
      const defaultMonth = dated.find((date) => date >= new Date().toISOString().slice(0, 10))?.slice(0, 7) || dated[0]?.slice(0, 7);
      const [year, month] = (visibleMonth || defaultMonth).split("-").map(Number);
      const offset = button.getAttribute("data-calendar-month") === "next" ? 1 : -1;
      const direction = button.getAttribute("data-calendar-month");
      const next = new Date(Date.UTC(year, month - 1 + offset, 1));
      deadlineCalendarMonthByUniversity.set(universityId, `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
      deadlineCalendarDayByUniversity.delete(universityId);
      renderDeadlinesTabSection({ container, university });
      container.querySelector(`[data-calendar-month="${direction}"]`)?.focus();
    });
  });
  container.querySelectorAll("[data-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const day = button.getAttribute("data-calendar-day");
      deadlineCalendarDayByUniversity.set(universityId, day);
      renderDeadlinesTabSection({ container, university });
      container.querySelector(`[data-calendar-day="${day}"]`)?.focus();
    });
  });

  container.querySelectorAll("[data-calendar-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = filteredDeadlines[Number(button.getAttribute("data-calendar-export"))];
      if (!item || !parseExactDeadlineDate(item.deadline) || item.approximate || item.is_approximate) return;
      const uid = globalThis.crypto?.randomUUID?.() || `deadline-${Date.now()}@unisearch`;
      const ics = createDeadlineIcs(item, { uid });
      if (!ics) return;
      const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `unisearch-deadline-${parseExactDeadlineDate(item.deadline)}.ics`;
      link.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });

  markMotionEnter(container, ".timeline-milestone, .admissions-deadline-item", { limit: 16, staggerMs: 18 });
}

function getAvailableStudyLevels(categories) {
  const counts = new Map();
  categories.forEach((cat) => {
    const levels = getCategoryLevelsList(cat);
    levels.forEach((l) => {
      const k = normalizeLevelKey(l);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    if (categoryIsMba(cat)) counts.set("mba", (counts.get("mba") || 0) + 1);
  });

  const order = ["bachelor", "master", "doctorate", "professional", "mba"];
  const out = [];
  order.forEach((k) => {
    if (counts.has(k)) {
      let label = "";
      if (k === "bachelor") label = t("profile.option.study_level_bachelor", "Bachelor's");
      else if (k === "master") label = t("profile.option.study_level_master", "Master's");
      else if (k === "doctorate") label = t("profile.option.study_level_doctorate", "Doctorate / PhD");
      else if (k === "professional") label = t("profile.option.study_level_professional", "Professional");
      else if (k === "mba") label = t("profile.option.study_level_mba", "MBA");
      else label = trStudyLevel(k);
      out.push({ key: k, label, count: counts.get(k) });
    }
  });
  return out;
}

function renderStudyLevelFilter(availableLevels, activeLevelKey, totalCategories) {
  if (!availableLevels.length || availableLevels.length <= 1) return "";
  return `
    <div class="admissions-level-filter" role="group" aria-label="${escapeHtmlAttr(t("university.admissions.filter_by_level", "Filter admission tracks by degree level"))}">
      <button
        type="button"
        class="admissions-level-tab${activeLevelKey === "all" ? " is-active" : ""}"
        data-admission-level="all"
      >${escapeHtml(t("university.admissions.all_levels", "All Degrees"))} (${totalCategories})</button>
      ${availableLevels.map((lvl) => `
        <button
          type="button"
          class="admissions-level-tab${activeLevelKey === lvl.key ? " is-active" : ""}"
          data-admission-level="${escapeHtmlAttr(lvl.key)}"
        >${escapeHtml(lvl.label)} (${lvl.count})</button>
      `).join("")}
    </div>
  `;
}

export function resolveFeeStatusAndAid({ university, profile, uniChance, studyLevel }) {
  const fin = university?.finance || {};
  const country = String(university?.location?.country || "").trim().toLowerCase();
  const isUkUni = country.includes("kingdom") || country.includes("united kingdom") || country.includes("великобритан") || country === "gb" || country === "uk";
  const isUsUni = country.includes("united states") || country.includes("usa") || country.includes("сша") || country === "us";

  const reportedFeeStatus = uniChance?.citizenshipStatus || university?.citizenshipStatus || university?.citizenship_status || profile?.citizenshipStatus || profile?.citizenship_status;
  let feeStatusBadge = "";
  let feeStatusTone = "neutral";
  let feeStatusSummary = "";

  if (isUkUni || isUsUni) {
    const statusKey = String(reportedFeeStatus?.status || "unknown").toLowerCase();
    const categoryKey = String(reportedFeeStatus?.fee_category || "unknown").toLowerCase();
    const resolvedCategory = statusKey === "verified" ? categoryKey : "unknown";
    if (resolvedCategory === "home") {
      feeStatusBadge = t("university.finance.home_status", "Home fee status");
      feeStatusSummary = t("university.finance.fee_status_home_desc", "The available record indicates home fee status. Confirm current eligibility with the university.");
    } else if (resolvedCategory === "domestic") {
      feeStatusBadge = t("university.finance.domestic_status", "Domestic fee status");
      feeStatusSummary = t("university.finance.fee_status_domestic_desc", "The available record indicates domestic fee status. Confirm current eligibility with the university.");
    } else if (resolvedCategory === "overseas" || resolvedCategory === "international") {
      feeStatusBadge = t("university.finance.overseas_status", "Overseas fee status");
      feeStatusSummary = t("university.finance.fee_status_overseas_desc", "The available record indicates overseas fee status. Confirm current eligibility with the university.");
    } else {
      feeStatusBadge = t("university.finance.status_unconfirmed", "Fee status requires an eligibility check");
      feeStatusSummary = t("university.finance.status_unconfirmed_desc", "Citizenship alone does not establish home, domestic, or overseas fee status. Residency history and the university's rules may also matter.");
    }
  }

  const targetStudyLevel = normalizeLevelKey(studyLevel || profile?.studyLevel || profile?.study_level);
  const showUndergraduatePolicy = ["", "any", "all", "general", "bachelor"].includes(targetStudyLevel);
  const showDoctoralFunding = ["", "any", "all", "general", "doctorate"].includes(targetStudyLevel);
  const ugPolicy = fin.undergraduate_aid_policy || {};
  const aid = fin.financial_aid || {};
  let aidBadge = "";
  let aidTone = "neutral";
  let aidDescription = "";

  const domesticNeedBlind = ugPolicy.need_blind_domestic === true || aid.undergraduate_need_blind_domestic === true;
  const internationalNeedBlind = ugPolicy.need_blind_international === true || aid.international_need_blind === true;
  const genericNeedBlind = aid.need_blind === true && aid.basis === "need";
  const isUniversalNeedBlind = domesticNeedBlind && internationalNeedBlind;
  const hasNeedBlindPolicy = isUniversalNeedBlind || domesticNeedBlind || internationalNeedBlind || genericNeedBlind;
  const meetsFullDemonstratedNeed = showUndergraduatePolicy && (
    ugPolicy.meets_full_demonstrated_need === true || aid.meets_full_demonstrated_need === true
  );
  const zeroLoansPolicy = showUndergraduatePolicy && (
    ugPolicy.zero_loans_policy === true || aid.zero_loans_policy === true || aid.no_loans_policy === true
  );

  const isNeedBlindDomesticOnly = Boolean(
    domesticNeedBlind &&
    (ugPolicy.need_blind_international === false || aid.undergraduate_need_aware_international === true)
  );

  if (showUndergraduatePolicy && isUniversalNeedBlind) {
    aidBadge = t("university.finance.need_blind_universal", "Universal Need-Blind");
    aidTone = "positive";
    aidDescription = t("university.finance.need_blind_universal_desc", "Need-blind undergraduate admission applies to domestic and international applicants under the published policy.");
  } else if (showUndergraduatePolicy && isNeedBlindDomesticOnly) {
    aidBadge = t("university.finance.domestic_and_international_policy", "Different aid rules by applicant category");
    aidDescription = t("university.finance.domestic_and_international_policy_desc", "The university publishes different need-based aid rules for domestic and international applicants. Your category and aid eligibility require review under its official rules.");
  } else if (showUndergraduatePolicy && domesticNeedBlind) {
    aidBadge = t("university.finance.need_blind_domestic", "Need-Blind (Domestic)");
    aidTone = "positive";
    aidDescription = t("university.finance.need_blind_domestic_desc", "Need-blind undergraduate admission applies to domestic applicants covered by the published policy.");
  } else if (showUndergraduatePolicy && internationalNeedBlind) {
    aidBadge = t("university.finance.need_blind_international", "Need-Blind (International)");
    aidTone = "positive";
    aidDescription = t("university.finance.need_blind_international_desc", "Need-blind undergraduate admission applies to international applicants covered by the published policy.");
  } else if (showUndergraduatePolicy && genericNeedBlind) {
    aidBadge = t("university.finance.need_blind_unscoped", "Need-Blind Undergraduate Admission");
    aidTone = "positive";
    aidDescription = t("university.finance.need_blind_unscoped_desc", "The available record identifies undergraduate admission as need-blind but does not specify the applicant categories covered.");
  }

  const freeTuitionUsd = showUndergraduatePolicy ? (
    ugPolicy.free_tuition_family_income_threshold_usd ||
    ugPolicy.tuition_free_income_threshold_usd ||
    aid.free_tuition_threshold_usd ||
    aid.free_tuition_income_threshold_usd ||
    aid.tuition_free_income_threshold_usd ||
    (aid.income_thresholds?.under_150k ? 150000 : null)
  ) : null;
  const zeroParentContributionUsd = showUndergraduatePolicy ? (
    ugPolicy.zero_parent_contribution_income_threshold_usd ||
    aid.zero_parent_contribution_income_threshold_usd ||
    aid.zero_contribution_income_threshold_usd ||
    (aid.income_thresholds?.under_100k ? 100000 : null)
  ) : null;
  const fullRideUsd = showUndergraduatePolicy ? (
    ugPolicy.full_ride_income_threshold_usd ||
    aid.full_ride_threshold_usd ||
    aid.full_ride_income_threshold_usd
  ) : null;

  const thresholds = [];
  const incomeRaw = profile?.familyIncomeAmount;
  const hasIncomeAmount = incomeRaw !== null
    && incomeRaw !== undefined
    && !(typeof incomeRaw === "string" && incomeRaw.trim() === "");
  const incomeAmount = !hasIncomeAmount
    ? null
    : Number(incomeRaw);
  const incomeCurrency = String(profile?.familyIncomeCurrency || "USD").trim().toUpperCase();
  const hasComparableIncome = hasIncomeAmount
    && targetStudyLevel === "bachelor"
    && Number.isFinite(incomeAmount)
    && incomeAmount >= 0
    && Number.isFinite(FALLBACK_RATES[incomeCurrency])
    && FALLBACK_RATES[incomeCurrency] > 0;
  const incomeUsd = hasComparableIncome ? convert(incomeAmount, incomeCurrency, "USD") : null;
  const incomeComparisonFor = (thresholdUsd) => {
    const threshold = Number(thresholdUsd);
    if (!hasIncomeAmount || targetStudyLevel !== "bachelor") return "";
    if (!hasComparableIncome || !Number.isFinite(incomeUsd) || incomeUsd < 0 || !Number.isFinite(threshold) || threshold <= 0) {
      return t("university.finance.income_comparison_unknown", "Income comparison unavailable");
    }
    return incomeUsd < threshold
      ? t("university.finance.income_comparison_below", "Entered income is below this published threshold")
      : t("university.finance.income_comparison_at_or_above", "Entered income is at or above this published threshold");
  };
  if (zeroParentContributionUsd) {
    thresholds.push({
      label: t("university.finance.zero_parent_contribution_threshold", "Zero Parent Contribution Threshold"),
      value: `< $${Number(zeroParentContributionUsd).toLocaleString("en-US")} / yr`,
      comparison: incomeComparisonFor(zeroParentContributionUsd),
      note: t("university.finance.zero_parent_contrib", "The policy sets the expected parent contribution to zero; this does not establish total net price."),
    });
  }
  if (fullRideUsd) {
    thresholds.push({
      label: t("university.finance.full_ride_threshold", "Full-Ride Income Threshold"),
      value: `< $${Number(fullRideUsd).toLocaleString("en-US")} / yr`,
      comparison: incomeComparisonFor(fullRideUsd),
      note: t("university.finance.full_ride_threshold_note", "Eligibility for a full funding package depends on the university's full policy and applicant circumstances."),
    });
  }
  if (freeTuitionUsd) {
    thresholds.push({
      label: t("university.finance.free_tuition_threshold", "Free Tuition Threshold"),
      value: `< $${Number(freeTuitionUsd).toLocaleString("en-US")} / yr`,
      comparison: incomeComparisonFor(freeTuitionUsd),
      note: t("university.finance.free_tuition_note", "100% tuition coverage for qualifying families"),
    });
  }
  if (zeroLoansPolicy) {
    thresholds.push({
      label: t("university.finance.zero_loans", "Aid packages without loans"),
      value: t("university.finance.zero_loans_value", "No loans"),
      note: t("university.finance.zero_loans_note", "The published undergraduate aid policy says eligible aid packages do not include loans."),
    });
  }
  if (meetsFullDemonstratedNeed) {
    thresholds.push({
      label: t("university.finance.full_demonstrated_need", "Full demonstrated need met"),
      note: t("university.finance.full_demonstrated_need_note", "The university states that it meets 100% of demonstrated undergraduate financial need for applicants covered by this policy."),
    });
  }

  let phdFunding = null;
  if (showDoctoralFunding) {
    const doc = fin.doctorate_funding_guarantee
      || fin.graduate_financial_aid_models?.gsas_phd_guarantee
      || fin.graduate_funding?.phd_funding_guarantee
      || (typeof fin.phd_funding_guarantee === "string" ? fin.phd_funding_guarantee : null);
    if (doc) {
      const details = typeof doc === "string"
        ? doc
        : (doc.coverage || doc.commitment || doc.notes || (Array.isArray(doc.components) ? doc.components.join("; ") : ""));
      const duration = typeof doc === "object" && doc.duration_years ? `${doc.duration_years}-year ` : "";
      const stipendMin = typeof doc === "object" ? Number(doc.stipend_annual_usd_min) : NaN;
      const stipendMax = typeof doc === "object" ? Number(doc.stipend_annual_usd_max) : NaN;
      const stipendDetails = !details && Number.isFinite(stipendMin) && Number.isFinite(stipendMax)
        ? ` Annual stipend: $${stipendMin.toLocaleString("en-US")}–$${stipendMax.toLocaleString("en-US")} USD.`
        : "";
      const fullDetails = [details, stipendDetails].filter(Boolean).join(" ").trim();
      if (fullDetails) {
        phdFunding = {
          title: `${duration}${t("university.finance.doctoral_funding_title", "Doctoral funding")}`,
          details: fullDetails,
        };
      }
    }
  }

  return {
    hasPolicyData: Boolean(feeStatusBadge || aidBadge || thresholds.length || phdFunding),
    feeStatusBadge,
    feeStatusTone,
    feeStatusSummary,
    aidBadge,
    aidTone,
    aidDescription,
    thresholds,
    thresholdsNote: thresholds.length
      ? [
          thresholds.some((threshold) => threshold.comparison)
            ? t("university.finance.income_comparison_caveat", "This comparison is context only. It does not determine aid eligibility, award amount, or net price.")
            : "",
          university?.id === "stanford-university-usa-ca" && aid.income_thresholds_note
            ? t("university.finance.income_thresholds_note.stanford", "Stanford's income guidelines assume typical assets and US cost-of-living assumptions and may not apply to families living outside the United States.")
            : "",
        ].filter(Boolean).join(" ")
      : "",
    phdFunding,
  };
}

function renderFinancePolicyOverview(policy, mitUndergrad = false) {
  if (!policy || !policy.hasPolicyData) return "";

  const shieldIcon = heroIcon("document-check", "ui-icon ui-icon--16");
  const sparkIcon = heroIcon("sparkles", "ui-icon ui-icon--16");
  const capIcon = heroIcon("academic-cap", "ui-icon ui-icon--16");

  return `
    <section class="finance-policy-card" aria-labelledby="finance-policy-title">
      <div class="finance-policy-head">
        <h3 id="finance-policy-title" class="finance-policy-title">
          ${shieldIcon}
          <span>${escapeHtml(mitUndergrad
            ? t("university.finance.mit_aid_policy", "Undergraduate financial aid policy")
            : t("university.finance.policy_title", "Tuition Status & Financial Aid Policy"))}</span>
        </h3>
      </div>

      ${policy.feeStatusBadge ? `
        <div class="finance-fee-status-banner">
          <div class="finance-fee-status-left">
            <span class="finance-fee-status-kicker">${escapeHtml(t("university.finance.fee_status_label", "Your Tuition Fee Status"))}</span>
            <div class="finance-fee-status-badge finance-fee-status-badge--${escapeHtmlAttr(policy.feeStatusTone)}">
              <strong>${escapeHtml(policy.feeStatusBadge)}</strong>
            </div>
            ${policy.feeStatusSummary ? `<p class="finance-fee-status-desc">${escapeHtml(policy.feeStatusSummary)}</p>` : ""}
          </div>
          ${policy.aidBadge ? `
            <div class="finance-aid-policy-badge-box">
              <span class="finance-fee-status-kicker">${escapeHtml(t("university.finance.aid_policy_label", "Admissions Aid Policy"))}</span>
              <span class="finance-aid-badge finance-aid-badge--${escapeHtmlAttr(policy.aidTone)}">${escapeHtml(policy.aidBadge)}</span>
            </div>
          ` : ""}
        </div>
      ` : ""}

      ${policy.aidDescription ? `
        <div class="finance-aid-description-box">
          <p>${escapeHtml(policy.aidDescription)}</p>
        </div>
      ` : ""}

      ${policy.thresholds && policy.thresholds.length ? `
        <div class="finance-thresholds-section">
          <h4 class="finance-thresholds-heading">${sparkIcon} <span>${escapeHtml(t("university.finance.thresholds_title", "Income-Based Financial Aid & Full Rides"))}</span></h4>
          <div class="finance-thresholds-grid">
            ${policy.thresholds.map((th) => `
              <div class="finance-threshold-item">
                <span class="finance-threshold-label">${escapeHtml(th.label)}</span>
                <strong class="finance-threshold-value">${escapeHtml(th.value)}</strong>
                ${th.comparison ? `<p class="finance-threshold-note">${escapeHtml(th.comparison)}</p>` : ""}
                ${th.note ? `<p class="finance-threshold-note">${escapeHtml(th.note)}</p>` : ""}
              </div>
            `).join("")}
          </div>
          ${policy.thresholdsNote ? `<p class="finance-threshold-note">${escapeHtml(policy.thresholdsNote)}</p>` : ""}
        </div>
      ` : ""}

      ${policy.phdFunding ? `
        <div class="finance-phd-guarantee-card">
          <h4 class="finance-phd-title">${capIcon} <span>${escapeHtml(policy.phdFunding.title)}</span></h4>
          <p class="finance-phd-details">${escapeHtml(policy.phdFunding.details)}</p>
        </div>
      ` : ""}
    </section>
  `;
}


function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeProgramToken(value) {
  return String(value || "").trim().toLowerCase().replaceAll("&", " and ")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueNonEmpty(values) {
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const text = String(value || "").trim();
    const key = normalizeProgramToken(text);
    if (!text || seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

function getAdmissionCategories(university) {
  return Array.isArray(university?.admission_categories)
    ? university.admission_categories.filter(isPlainObject)
    : [];
}

function getCategoryProfiles(category) {
  return Array.isArray(category?.requirement_profiles)
    ? category.requirement_profiles.filter(isPlainObject)
    : [];
}

function getFundingOptions(category, profile) {
  const profileOptions = Array.isArray(profile?.funding_options)
    ? profile.funding_options.filter(isPlainObject)
    : [];
  if (profileOptions.length) return profileOptions;
  return Array.isArray(category?.funding_options)
    ? category.funding_options.filter(isPlainObject)
    : [];
}

function mergePlainDict(...values) {
  const out = {};
  values.forEach((value) => {
    if (!isPlainObject(value)) return;
    Object.assign(out, value);
  });
  return Object.keys(out).length ? out : null;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort((a, b) => a.localeCompare(b)).map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function valuesEqual(a, b) {
  return stableSerialize(a) === stableSerialize(b);
}

function diffPlainDict(override, baseline) {
  if (!isPlainObject(override)) return null;
  const out = {};
  const base = isPlainObject(baseline) ? baseline : {};
  Object.entries(override).forEach(([key, value]) => {
    if (!String(key || "").trim()) return;
    if (valuesEqual(value, base[key])) return;
    out[key] = value;
  });
  return Object.keys(out).length ? out : null;
}

function hasFundingLanguageOverride(funding, baselineLanguage, baselineMode) {
  if (!isPlainObject(funding)) return false;
  const hasList = Array.isArray(funding.language_requirements);
  const hasMode = Object.prototype.hasOwnProperty.call(funding, "language_requirements_mode");
  if (!hasList && !hasMode) return false;
  const nextList = hasList ? funding.language_requirements : baselineLanguage;
  const nextMode = hasMode ? funding.language_requirements_mode : baselineMode;
  return !valuesEqual(nextList || [], baselineLanguage || [])
    || String(nextMode || "all").toLowerCase() !== String(baselineMode || "all").toLowerCase();
}

function getStudyProgramOptions(university, categories, activeLevelKey) {
  const programNames = [];
  if (Array.isArray(university?.academics?.programs)) {
    university.academics.programs.forEach((program) => {
      const progLevels = Array.isArray(program?.study_levels)
        ? program.study_levels
        : (program?.study_level ? [program.study_level] : []);
      const normalizedLevels = progLevels.length
        ? progLevels.map(normalizeLevelKey)
        : [normalizeLevelKey(program?.level || "bachelor")];
      if (activeLevelKey !== "all" && !normalizedLevels.includes(activeLevelKey)) return;
      programNames.push(program?.name || program?.program_name);
    });
  }
  categories.forEach((category) => {
    if (Array.isArray(category.program_names)) programNames.push(...category.program_names);
  });
  return uniqueNonEmpty(programNames).map((name) => ({
    key: normalizeProgramToken(name),
    label: trProgramName(name),
    raw: name,
  })).filter((program) => program.key && program.label);
}

function categoryTokens(category) {
  return [
    ...(Array.isArray(category?.program_ids) ? category.program_ids : []),
    ...(Array.isArray(category?.program_names) ? category.program_names : []),
    ...(Array.isArray(category?.applicable_majors) ? category.applicable_majors : []),
  ].map(normalizeProgramToken).filter(Boolean);
}

function categoryMatchesProgram(category, programKey, university) {
  const scope = String(category?.scope || "general").trim().toLowerCase();
  if (scope === "general") return false;
  const wanted = normalizeProgramToken(programKey);
  if (!wanted) return false;
  const selectedProgram = (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
    .find((program) => normalizeProgramToken(program?.name || program?.program_name) === wanted);
  const programId = normalizeProgramToken(selectedProgram?.id || selectedProgram?.course_number);
  return categoryTokens(category).some((token) => token === wanted || (programId && token === programId));
}

function getVisibleAdmissionCategories(categories, selectedProgramKey, university) {
  const generalCategories = categories.filter((category) => String(category?.scope || "general").trim().toLowerCase() === "general");
  if (!selectedProgramKey || selectedProgramKey === GENERAL_PROGRAM_KEY) {
    return generalCategories.length ? generalCategories : categories;
  }
  const programCategories = categories.filter((category) => categoryMatchesProgram(category, selectedProgramKey, university));
  if (programCategories.length || university?.id === MIT_ID) return programCategories;
  return generalCategories.length ? generalCategories : categories;
}

function renderProgramSelector(university, categories, selectedProgramKey, hasExplicitProgramSelection, activeLevelKey = "all") {
  const programs = getStudyProgramOptions(university, categories, activeLevelKey);
  const items = [
    {
      key: GENERAL_PROGRAM_KEY,
      label: t("admission.program.general_requirements", "General requirements"),
      raw: "",
    },
    ...programs,
  ];
  if (items.length <= 1) return "";
  return `
    <div class="admission-program-selector" role="group" aria-label="${escapeHtmlAttr(t("admission.program.selector_label", "Program selection"))}">
      ${items.map((item) => {
        const active = (selectedProgramKey || GENERAL_PROGRAM_KEY) === item.key;
        return `
          <button
            type="button"
            class="admission-program-option${active ? " is-active" : ""}"
            data-admission-program="${escapeHtmlAttr(item.key)}"
          >${escapeHtml(item.label)}</button>
        `;
      }).join("")}
    </div>
    ${!hasExplicitProgramSelection ? `<div class="admission-scope-note">${escapeHtml(t("admission.program.not_selected_note", "Select a program when available. Requirements can differ by program."))}</div>` : ""}
  `;
}

function translatedProfileLabel(profile) {
  return trTrackLabel(profile?.label || profile?.name || "") || unknownFieldText("placeholder.field.requirement_profile", "Requirement profile");
}

function renderApplicablePrograms(category, profile) {
  const majors = uniqueNonEmpty([
    ...(Array.isArray(profile?.program_names) ? profile.program_names : []),
    ...(Array.isArray(category?.program_names) ? category.program_names : []),
    ...(Array.isArray(profile?.applicable_majors) ? profile.applicable_majors : []),
    ...(Array.isArray(category?.applicable_majors) ? category.applicable_majors : []),
  ]).map((major) => trProgramName(major)).filter(Boolean);
  if (!majors.length) return "";
  return `
    <div class="admission-applicable-programs">
      <strong>${escapeHtml(translateWord("placeholder.field.applicable_majors", "Applicable majors"))}:</strong>
      ${majors.map((major) => `<span class="tag">${escapeHtml(major)}</span>`).join("")}
    </div>
  `;
}

function renderPublishedAdmittedScoreRange({ category, funding, profile, requirements }) {
  if (Object.values(requirements || {}).some((value) => value !== null && value !== undefined
    && String(value).trim() !== "" && Number.isFinite(Number(value)))) return "";
  if (category?.applicant_route !== "first_year"
    || (category?.study_level !== "Bachelor" && !category?.study_levels?.includes("Bachelor"))) return "";
  const scoreProfile = funding?.score_profile || profile?.score_profile || category?.score_profile;
  if (!scoreProfile || scoreProfile.p25_raw === null || scoreProfile.p25_raw === undefined
    || scoreProfile.p75_raw === null || scoreProfile.p75_raw === undefined) return "";
  const sourceScope = String(scoreProfile.source_scope || "").trim();
  const sourceUrl = safeUrl(scoreProfile.source_url);
  const cohortKey = sourceScope === "official_common_data_set"
    && sourceUrl === "https://ir.mit.edu/projects/2024-25-common-data-set/"
    ? "admission.score_range.cohort.enrolled"
    : (sourceScope === "official_admissions_stats"
      && sourceUrl === "https://mitadmissions.org/apply/process/stats/" ? "admission.score_range.cohort.admitted" : "");
  if (!cohortKey) return "";
  const p25 = Number(scoreProfile.p25_raw);
  const p75 = Number(scoreProfile.p75_raw);
  const examId = String(scoreProfile.exam_id || scoreProfile.metric_id || "").trim();
  if (!Number.isFinite(p25) || !Number.isFinite(p75) || !examId || !sourceUrl) return "";
  const formatScore = (score) => formatExamValue(examId, score, { context: "score", locale: getCurrentLanguage() });
  const examLabel = getExamDisplayName(examId, { locale: getCurrentLanguage() }) || examId;

  return `
    <details class="track-published-score-range">
      <summary>${escapeHtml(t("admission.score_range.title", "Published first-year score range"))}</summary>
      <div>
      <span>${escapeHtml(examLabel)} ${escapeHtml(t("admission.score_range.percentiles", "25th–75th percentile"))}: ${escapeHtml(formatScore(p25))}–${escapeHtml(formatScore(p75))}</span>
      <span>${escapeHtml(t(cohortKey, sourceScope === "official_common_data_set"
        ? "Fall 2024 first-year students who enrolled"
        : "Class of 2029 admitted first-year students"))}</span>
      <span>${escapeHtml(t("admission.score_range.note", "Historical context only; not a required minimum or cutoff."))}</span>
      <a href="${escapeHtmlAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("admission.score_range.source", "Official source"))}</a>
      </div>
    </details>
  `;
}

function renderChoiceRequirements({ category, funding, profile, university }) {
  const requirements = mergePlainDict(category?.requirements, profile?.requirements, funding?.requirements) || {};
  const statsAvg = mergePlainDict(category?.stats_avg, profile?.stats_avg, funding?.stats_avg) || {};
  const languageChoice = {
    ...category,
    ...profile,
    ...(funding || {}),
    requirements,
    stats_avg: statsAvg,
    language_requirements: funding?.language_requirements || profile?.language_requirements || category?.language_requirements || [],
    language_requirements_mode: funding?.language_requirements_mode || profile?.language_requirements_mode || category?.language_requirements_mode,
  };
  const minParts = splitExamEntries(requirements);
  const avgParts = splitExamEntries(statsAvg);
  const minList = [
    renderExamGroup(translateWord("academic_requirements", "Academic requirements"), minParts.acad, "#2563eb"),
    renderTrackLanguageExamGroup(languageChoice, "requirements"),
  ].filter(Boolean).join("");
  const avgList = [
    renderExamGroup(translateWord("academic_average", "Academic average"), avgParts.acad, "#2563eb"),
    renderTrackLanguageExamGroup(languageChoice, "average"),
  ].filter(Boolean).join("");
  const admittedScoreRange = renderPublishedAdmittedScoreRange({ category, funding, profile, requirements });
  const requirementsNote = profile?.requirements_note || category?.requirements_note;
  const requirementsSource = safeUrl(profile?.requirements_source_url || category?.source_url);
  const requirementsNoteHtml = requirementsNote
    ? `<p class="admission-scope-note">${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, requirementsNote))}${requirementsSource ? ` <a href="${escapeHtmlAttr(requirementsSource)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.open_source", "Open source"))}</a>` : ""}</p>`
    : "";
  const rawExtraRequirementItems = Array.isArray(funding?.extra_requirements)
    ? funding.extra_requirements
    : (Array.isArray(profile?.extra_requirements) ? profile.extra_requirements : category?.extra_requirements);
  const extraRequirementItems = Array.isArray(rawExtraRequirementItems)
    ? [...new Set(rawExtraRequirementItems)]
    : [];
  let extraReqInfo = "";
  if (Array.isArray(extraRequirementItems) && extraRequirementItems.length) {
    if (extraRequirementItems.length <= 2) {
      extraReqInfo = `
        <div class="track-extra-req">
          <div class="track-extra-req-title">${escapeHtml(translateWord("extra_requirements", "Extra requirements"))}</div>
          <ul class="track-extra-req-list">${extraRequirementItems.map((item) => `<li>${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, item))}</li>`).join("")}</ul>
        </div>
      `;
    } else {
      const firstTwo = extraRequirementItems.slice(0, 2);
      const remaining = extraRequirementItems.slice(2);
      const chevronIcon = heroIcon("chevron-down", "ui-icon track-collapsible-chevron");
      extraReqInfo = `
        <div class="track-extra-req">
          <div class="track-extra-req-title">${escapeHtml(translateWord("extra_requirements", "Extra requirements"))}</div>
          <ul class="track-extra-req-list">${firstTwo.map((item) => `<li>${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, item))}</li>`).join("")}</ul>
          <details class="track-collapsible-details">
            <summary class="track-collapsible-summary">
              <span class="track-collapsible-title">${escapeHtml(t("admission.collapsible.additional_details", "Additional requirements & instructions"))} (+${remaining.length})</span>
              ${chevronIcon}
            </summary>
            <ul class="track-extra-req-list track-collapsible-content">
              ${remaining.map((item) => `<li>${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, item))}</li>`).join("")}
            </ul>
          </details>
        </div>
      `;
    }
  }
  return `
    <div class="admission-requirement-grid">
      <div class="track-stats-box track-stats-box--min">
        <div class="track-stats-title">${escapeHtml(translateWord("minimum_to_apply", "Minimum to apply"))}</div>
        <div class="track-stats-values">${requirementsNoteHtml}${minList || (requirementsNote ? "" : `<div class="track-muted-italic">${escapeHtml(unknownFieldText("placeholder.field.minimum_requirements", "Minimum requirements"))}</div>`)}</div>
      </div>
      ${admittedScoreRange ? `<div class="track-stats-box">${admittedScoreRange}</div>` : `<div class="track-stats-box track-stats-box--avg">
        <div class="track-stats-title track-stats-title--avg">${escapeHtml(translateWord("real_average_admitted", "Average admitted"))}</div>
        <div class="track-stats-values">${avgList || `<div class="track-muted-italic">${escapeHtml(translateWord("average_admitted_unavailable", "No verified average admitted data published."))}</div>`}</div>
      </div>`}
    </div>
    ${extraReqInfo}
  `;
}

function renderFundingDifferenceSection(title, html) {
  if (!html) return "";
  return `
    <div class="admission-funding-diff-section">
      <div class="admission-funding-diff-title">${escapeHtml(title)}</div>
      <div class="admission-funding-diff-content">${html}</div>
    </div>
  `;
}

function renderFundingDifferences({ category, funding, profile, university }) {
  const baselineRequirements = mergePlainDict(category?.requirements, profile?.requirements) || {};
  const baselineStatsAvg = mergePlainDict(category?.stats_avg, profile?.stats_avg) || {};
  const requirementDiff = diffPlainDict(funding?.requirements, baselineRequirements);
  const statsAvgDiff = diffPlainDict(funding?.stats_avg, baselineStatsAvg);
  const baselineLanguage = profile?.language_requirements || category?.language_requirements || [];
  const baselineLanguageMode = profile?.language_requirements_mode || category?.language_requirements_mode;
  const languageOverride = hasFundingLanguageOverride(funding, baselineLanguage, baselineLanguageMode);

  const minParts = splitExamEntries(requirementDiff || {});
  const avgParts = splitExamEntries(statsAvgDiff || {});
  const minList = [
    renderExamGroup(translateWord("academic_requirements", "Academic requirements"), minParts.acad, "#2563eb"),
    languageOverride
      ? renderTrackLanguageExamGroup({
        language_requirements: funding?.language_requirements || baselineLanguage,
        language_requirements_mode: funding?.language_requirements_mode || baselineLanguageMode,
      }, "requirements")
      : "",
  ].filter(Boolean).join("");
  const avgList = [
    renderExamGroup(translateWord("academic_average", "Academic average"), avgParts.acad, "#2563eb"),
    languageOverride
      ? renderTrackLanguageExamGroup({
        language_requirements: funding?.language_requirements || baselineLanguage,
        language_requirements_mode: funding?.language_requirements_mode || baselineLanguageMode,
      }, "average")
      : "",
  ].filter(Boolean).join("");

  const baselineExtra = Array.isArray(profile?.extra_requirements)
    ? profile.extra_requirements
    : (Array.isArray(category?.extra_requirements) ? category.extra_requirements : []);
  const extraOverride = Array.isArray(funding?.extra_requirements) && !valuesEqual(funding.extra_requirements, baselineExtra);
  const extraReqInfo = extraOverride && funding.extra_requirements.length
    ? `
      <ul class="admission-funding-diff-list">
        ${funding.extra_requirements.map((item) => `<li>${escapeHtml(trTrackDescription(university.id, funding?.id || profile?.id || category?.id, item))}</li>`).join("")}
      </ul>
    `
    : "";

  const sections = [
    renderFundingDifferenceSection(t("admission.funding_minimum_override", "Minimum changes"), minList),
    renderFundingDifferenceSection(t("admission.funding_average_override", "Average admitted changes"), avgList),
    renderFundingDifferenceSection(t("admission.funding_extra_override", "Additional requirements"), extraReqInfo),
  ].filter(Boolean).join("");

  if (!sections) {
    const isCompetitiveGrant = String(funding?.funding_type || "").toLowerCase() === "grant"
      || String(funding?.funding_source || "").toLowerCase() === "merit";
    const noteKey = isCompetitiveGrant
      ? "admission.funding_competitive_grant_note"
      : "admission.funding_no_specific_requirements";
    const fallbackNote = isCompetitiveGrant
      ? "The requirements above are the entry minimums for this profile. The grant is awarded separately through competition or ranking; no separate grant cutoff is listed in the data."
      : "No separate funding-specific requirements are listed in the data. Use the selected profile requirements above.";

    return `
      <div class="admission-funding-diff-note">
        ${escapeHtml(t(noteKey, fallbackNote))}
      </div>
    `;
  }

  return `
    <div class="admission-funding-diff">
      <div class="admission-funding-diff-kicker">${escapeHtml(t("admission.funding_differences", "Funding-specific differences"))}</div>
      ${sections}
    </div>
  `;
}

function renderFundingOptions({ annualCostForTrack, category, effectiveSelectedChoiceKey, profile, university }) {
  const fundingOptions = getFundingOptions(category, profile);
  if (!fundingOptions.length) return "";
  const baseChoice = getAdmissionChoicesFromCategories([{
    ...category,
    funding_options: [],
    requirement_profiles: [{ ...profile, funding_options: [] }],
  }])[0] || {};
  const basePrice = annualCostForTrack(baseChoice);
  const baseCurrency = (baseChoice.finance_override || university?.finance)?.currency || "USD";
  return `
    <div class="admission-funding-block">
      <div class="admission-funding-title">${escapeHtml(t("admission.funding_options", "Funding options"))}</div>
      <div class="admission-funding-list">
        ${fundingOptions.map((funding) => {
          const choiceKey = admissionChoiceKey(category, profile, funding);
          const isSelected = Boolean(effectiveSelectedChoiceKey && choiceKey === effectiveSelectedChoiceKey);
          const isGrant = getTrackFundingType(funding) === "grant";
          const hasBasePrice = basePrice !== null
            && basePrice !== undefined
            && !(typeof basePrice === "string" && basePrice.trim() === "")
            && Number.isFinite(Number(basePrice));
          const priceValue = hasBasePrice ? formatPrice(basePrice, baseCurrency) : unknownFieldText("placeholder.field.cost", "Cost");
          const fundingMeta = [
            funding.funding_program ? [t("admission.track.funding_program", "Funding program"), trTrackDescription(university.id, funding.id, funding.funding_program)] : null,
            funding.funding_source ? [t("admission.track.funding_source", "Funding source"), trTrackDescription(university.id, funding.id, funding.funding_source)] : null,
          ].filter(Boolean);
          const mainContent = renderFundingMetaTags(fundingMeta);
          return `
            <div class="admission-funding-option${isGrant ? " admission-funding-option--grant" : ""}${isSelected ? " is-active" : ""}" data-choice-key="${escapeHtmlAttr(choiceKey)}">
              <div class="admission-funding-option-header">
                <div class="admission-funding-option-title">
                  ${renderTrackFundingBadge(funding)}
                  <strong>${escapeHtml(trTrackLabel(funding.label || funding.name || "") || t("admission.funding_option_fallback", "Funding option"))}</strong>
                </div>
                <div class="admission-funding-option-side">
                  <div class="track-cost-preview${isGrant ? " track-cost-preview--grant" : ""}">
                    <strong>${escapeHtml(t("admission.funding_before_award", "Annual cost before any award"))}:</strong> ${escapeHtml(priceValue)}
                  </div>
                  <button type="button" class="track-select-btn${isSelected ? " is-active" : ""}" ${admissionChoiceSelectionAttrs({ category, choiceKey, funding, profile })} ${isSelected ? "disabled" : ""}>
                    ${escapeHtml(isSelected ? t("admission.choice.selected", "Selected") : t("admission.choice.select", "Select"))}
                  </button>
                </div>
              </div>
              ${mainContent ? `<div class="admission-funding-option-main">${mainContent}</div>` : ""}
              ${renderFundingDifferences({ category, funding, profile, university })}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

export function renderAdmissionSection({
  annualCostForTrack,
  container,
  uniChance,
  uniChanceByChoiceKey,
  university,
  onChoiceSelected,
  effectiveSelectedChoiceKeyOverride,
  onContextChange,
  compactMode = false,
}) {
  if (!container) return;
  const chanceByChoice = uniChanceByChoiceKey instanceof Map ? uniChanceByChoiceKey : new Map();

  const warningHtml = uniChance?.missingEvidence
    ? `<div class="chance-warning">${escapeHtml(translateTemplate("add_profile_evidence", "Add exam scores or language evidence in your profile to unlock a reliable {chance} estimate for this university.", { chance: aiName("chance") }))}</div>`
    : "";
  const admissionsData = university?.academics?.admissions && typeof university.academics.admissions === "object"
    ? university.academics.admissions
    : null;
  const admissionsOverviewHtml = renderAdmissionsOverview(admissionsData);
  const categories = getAdmissionCategories(university);
  if (!categories.length) {
    if (compactMode) {
      container.innerHTML = `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.admission_categories", "Admission categories"))}</div>`;
    } else {
      container.innerHTML = `${warningHtml}${renderUniChanceSummary(uniChance)}${admissionsOverviewHtml}<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.admission_categories", "Admission categories"))}</div>`;
    }
    applyPercentWidths(container);
    markMotionEnter(container, ".admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 12, staggerMs: 18 });
    return;
  }

  const universityId = String(university.id || "").trim();
  const openMitCategoryId = container.querySelector?.("details.admission-category-card[open]")?.dataset.admissionCategory || "";
  const contextProfile = getAdmissionContextProfile(university);
  const admissionContext = selectedAdmissionContext(university, contextProfile);
  const availableLevels = getAvailableStudyLevels(categories);
  let activeLevelStored = admissionContext.selectedLevel;
  if (!activeLevelStored) {
    const profileStudyLevel = normalizeLevelKey(loadProfile()?.studyLevel);
    if (availableLevels.some((l) => l.key === profileStudyLevel)) {
      activeLevelStored = profileStudyLevel;
    } else if (availableLevels.some((l) => l.key === "bachelor")) {
      activeLevelStored = "bachelor";
    } else {
      activeLevelStored = "all";
    }
    admissionStudyLevelSelectionByUniversity.set(universityId, activeLevelStored);
  }
  const activeLevelKey = activeLevelStored || "all";

  const levelFilteredCategories = admissionContext.levelCategories;
  const selectedProgramStored = admissionContext.selectedProgram === GENERAL_PROGRAM_KEY ? "" : admissionContext.selectedProgram;
  const hasExplicitProgramSelection = Boolean(selectedProgramStored);
  const selectedProgramKey = selectedProgramStored || GENERAL_PROGRAM_KEY;
  const visibleCategories = admissionContext.visibleCategories;
  const mitProgram = universityId === MIT_ID && !compactMode
    ? (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
      .find((program) => normalizeProgramToken(program?.id) === normalizeProgramToken(admissionContext.selectedProgramId || selectedProgramKey)
        || normalizeProgramToken(program?.name || program?.program_name) === selectedProgramKey)
    : null;
  if (universityId === MIT_ID && !compactMode && !mitProgram) {
    container.innerHTML = `<div class="mit-admission-context">
      <div>
        <h2>${escapeHtml(t("admission.mit.choose_program", "Choose a MIT program first"))}</h2>
        <p>${escapeHtml(t("admission.mit.choose_program_note", "Open a program to see the application options and requirements that apply to it."))}</p>
      </div>
      <button type="button" class="mit-admission-context__action" data-mit-open-programs>${escapeHtml(t("admission.mit.browse_programs", "Browse programs"))}</button>
    </div>`;
    container.querySelector?.("[data-mit-open-programs]")?.addEventListener("click", () => {
      document.querySelector('.d-tab-btn[data-tab="tab-programs"]')?.click();
    });
    return;
  }
  const mitBachelor = Boolean(mitProgram && (Array.isArray(mitProgram.study_levels) ? mitProgram.study_levels : [mitProgram.study_level || mitProgram.level])
    .some((level) => normalizeLevelKey(level) === "bachelor"));
  const mitMissingRoute = Boolean(mitProgram && !visibleCategories.length);
  visibleAdmissionContextByUniversity.set(universityId, {
    selectedLevel: activeLevelKey,
    selectedProgram: selectedProgramKey,
    visibleCategories,
  });
  const selectedChoiceKey = effectiveSelectedChoiceKeyOverride !== undefined
    ? effectiveSelectedChoiceKeyOverride
    : getSelectedAdmissionChoice(university.id);
  let contextChance = uniChance;
  if (mitProgram) {
    const categoryIds = new Set(visibleCategories.map((category) => String(category.id || "")));
    const allScopedChoices = (Array.isArray(uniChance?.choices) ? uniChance.choices : [])
      .filter((choice) => categoryIds.has(String(choice.categoryId || "")));
    const grantKeys = mitBachelor
      ? new Set(getAdmissionChoicesFromCategories(visibleCategories)
        .filter((choice) => getTrackFundingType(choice) === "grant")
        .map((choice) => String(choice.choice_key || choice.id || "")))
      : new Set();
    const scopedChoices = allScopedChoices.filter((choice) => !grantKeys.has(String(choice.choiceKey || "")));
    const recommended = scopedChoices[0];
    const active = scopedChoices.find((choice) => choice.choiceKey === selectedChoiceKey) || recommended;
    const choiceLabel = (choice) => mitBachelor
      ? (visibleCategories.find((category) => String(category.id || "") === String(choice.categoryId || ""))?.label || choice.choiceLabel)
      : choice.choiceLabel;
    contextChance = active ? {
      ...uniChance,
      overallChance: active.chancePercent,
      bestChoiceKey: active.choiceKey,
      bestChoiceLabel: choiceLabel(active),
      recommendedChoiceKey: recommended.choiceKey,
      recommendedChoiceLabel: choiceLabel(recommended),
      selectedByUser: active.choiceKey !== recommended.choiceKey,
      chanceModel: active.chanceModel,
      reason: active.reason,
      label: active.label,
    } : null;
  }
  const bestChoiceKey = String(contextChance?.bestChoiceKey || "").trim();
  const recommendedChoiceKey = String(contextChance?.recommendedChoiceKey || bestChoiceKey || "").trim();
  const effectiveSelectedChoiceKey = mitProgram ? bestChoiceKey : (selectedChoiceKey || bestChoiceKey);

  const studyLevelFilterHtml = !compactMode && !hasExplicitProgramSelection
    ? renderStudyLevelFilter(availableLevels, activeLevelKey, categories.length) : "";

  let html = "";
  const analysisHtml = `<details class="mit-admission-analysis"><summary>${escapeHtml(t("admission.mit.analysis", "Requirements fit and historical statistics"))}</summary>${renderUniChanceSummary(contextChance)}${admissionContext.route !== "transfer" && activeLevelKey === "bachelor" ? admissionsOverviewHtml : ""}</details>`;
  if (!compactMode) {
    if (mitProgram) {
      html += `<div class="mit-admission-context">
        <div>
          <span class="mit-admission-context__label">${escapeHtml(t("admission.mit.selected_program", "Selected program"))}</span>
          <h2>${escapeHtml(trProgramName(mitProgram.name || "") || mitProgram.name || "")}</h2>
          <p>${escapeHtml(mitMissingRoute
            ? (mitProgram.selection_timing === "after_initial_graduate_admission"
              ? t("admission.mit.after_initial_admission", "This combined degree is pursued after initial admission to a constituent MIT graduate program. Check the official page for the second-degree process.")
              : t("admission.mit.route_unverified", "Admissions details for this program have not been verified yet. Check its official page before applying."))
            : mitBachelor && admissionContext.route !== "transfer"
            ? t("admission.mit.undergraduate_target", "MIT first-year applicants apply to MIT as a whole and choose a major after the first year. This program is a study interest, not a separate admission target.")
            : mitBachelor
              ? t("admission.mit.transfer_target", "Transfer applicants follow MIT's separate transfer process. Confirm that the selected transfer route and entry term apply to you.")
            : t("admission.mit.program_options_note", "The application options below are linked to this program. Check its official page for the current entry cycle."))}</p>
          ${mitProgram.entry_requirements ? `<p><strong>${escapeHtml(t("admission.mit.program_condition", "Program-specific eligibility:"))}</strong> ${escapeHtml(trTrackDescription(university.id, "", mitProgram.entry_requirements))}</p>` : ""}
          ${mitMissingRoute && safeUrl(mitProgram.source_url || mitProgram.url) ? `<a href="${escapeHtmlAttr(safeUrl(mitProgram.source_url || mitProgram.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.open_source", "Open source"))}</a>` : ""}
          ${mitBachelor ? `<a href="https://mitadmissions.org/help/faq/majors/" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.open_source", "Open source"))}</a>` : ""}
          ${mitBachelor ? `<p>${escapeHtml(t("admission.mit.aid_separate", "MIT undergraduate financial aid is separate from admission and does not require a different admission route."))} <a href="https://mitadmissions.org/afford/" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.open_source", "Open source"))}</a></p>` : ""}
        </div>
        <button type="button" class="mit-admission-context__action" data-mit-open-programs>${escapeHtml(t("admission.mit.change_program", "Change program"))}</button>
      </div>`;
    }
    html += warningHtml + (mitProgram ? "" : renderSelectedProgramContext(university, selectedProgramKey) + studyLevelFilterHtml);
    if (mitProgram && !mitMissingRoute && !contextChance) html += `<p class="admission-scope-note">${escapeHtml(t("admission.mit.no_matching_chance", "No personal estimate is available for this program with the current profile."))}</p>`;
  }
  if (!mitProgram) html += renderProgramSelector(university, levelFilteredCategories, selectedProgramKey, hasExplicitProgramSelection, activeLevelKey);
  if (!compactMode) html += renderAdmissionContextControls(admissionContext.programCategories.length ? admissionContext.programCategories : levelFilteredCategories, admissionContext);
  if (!compactMode && visibleCategories.length) {
    const sourceUrl = safeUrl(visibleCategories[0].source_url);
    html += `<div class="admission-decision-actions">${sourceUrl ? `<a href="${escapeHtmlAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.next_official_step", "Open official application requirements"))}</a>` : ""}<button type="button" class="mit-admission-context__action" data-admission-open-tab="tab-deadlines">${escapeHtml(t("university.tab.deadlines", "Deadlines"))}</button><button type="button" class="mit-admission-context__action" data-admission-open-tab="tab-finance">${escapeHtml(t("university.tab.costs", "Costs"))}</button></div>`;
  }
  if (selectedProgramKey !== GENERAL_PROGRAM_KEY && visibleCategories.length && visibleCategories.every((category) => String(category?.scope || "general").toLowerCase() === "general")) {
    html += `<div class="admission-scope-note">${escapeHtml(t("admission.program.using_general_note", "No program-specific score data is published here, so general requirements are shown."))}</div>`;
  }

  html += `<div class="admission-category-list">`;
  visibleCategories.forEach((category, categoryIdx) => {
    const profiles = getCategoryProfiles(category);
    const profileRows = profiles.length ? profiles : [{ id: "general", label: t("admission.profile.general", "General") }];
    const categoryKey = `${universityId}:${category.id || categoryIdx}`;
    const choiceKeyStr = String(effectiveSelectedChoiceKey || "").trim();
    let effectiveProfileId = "";
    if (choiceKeyStr) {
      const delimiter = choiceKeyStr.includes("::") ? "::" : ":";
      const parts = choiceKeyStr.split(delimiter);
      if (parts.length >= 2 && parts[0] === String(category.id || categoryIdx)) {
        effectiveProfileId = parts[1];
      }
    }
    const selectedProfileId = admissionProfileSelectionByCategory.get(categoryKey) || effectiveProfileId;
    const activeProfile = profileRows.find((profile) => String(profile.id || "") === selectedProfileId) || profileRows[0];
    const categoryLabel = trTrackLabel(category.label || category.name || "") || unknownFieldText("placeholder.field.admission_category", "Admission category");
    const categoryDescription = trTrackDescription(university.id, category.id, category.description || "");
    const profileDescription = trTrackDescription(university.id, activeProfile.id || category.id, activeProfile.description || "");
    const scopeLabel = mitBachelor
      ? t("admission.scope.university_wide", "University-wide")
      : (String(category.scope || "general").toLowerCase() === "general"
        ? t("admission.scope.general", "General")
        : t("admission.scope.program_specific", "Program-specific"));
    const routeText = `${t("university.admissions.route_label", "Applicant route")}: ${applicantRouteLabel(category.applicant_route)}`;
    const activeProfileLabel = translatedProfileLabel(activeProfile);
    const activeChoiceKey = admissionChoiceKey(category, activeProfile, null);
    const fundingOptions = getFundingOptions(category, activeProfile);
    const activeChoiceChance = chanceByChoice.get(activeChoiceKey)
      || fundingOptions.map((funding) => chanceByChoice.get(admissionChoiceKey(category, activeProfile, funding))).find(Boolean);
    const profileHasFundingOptions = fundingOptions.length > 0;
    const noPublishedMinimums = activeChoiceChance?.reason === "no_published_requirements";
    const profileIsSelected = !profileHasFundingOptions && Boolean(effectiveSelectedChoiceKey && effectiveSelectedChoiceKey === activeChoiceKey);
    const profileIsRecommended = !profileHasFundingOptions && activeChoiceChance?.chancePercent != null && Boolean(recommendedChoiceKey && recommendedChoiceKey === activeChoiceKey);

    const catLevels = getCategoryLevelsList(category);
    const catLevelBadges = catLevels.length
      ? ` &middot; ${catLevels.map((l) => `<span class="admission-level-badge">${escapeHtml(trStudyLevel(l))}</span>`).join(" ")}`
      : "";

    let deadlinePillHtml = "";
    const catRounds = category.admission_rounds || [];
    const catDeadlines = category.deadlines || [];
    const firstRoundDate = catRounds[0]?.deadline || catDeadlines[0]?.application_deadline || catDeadlines[0]?.date || category.application_deadline;
    if (firstRoundDate) {
      deadlinePillHtml = `
        <div class="admission-category-deadline-pill">
          ${heroIcon("document-check", "ui-icon ui-icon--14")}
          <span><strong>${escapeHtml(t("university.admissions.deadline_label", "Deadline"))}:</strong> ${escapeHtml(localizeDeadlineDate(firstRoundDate))}</span>
        </div>
      `;
    }

    const categoryId = String(category.id || categoryIdx);
    const mitRouteOpen = openMitCategoryId ? openMitCategoryId === categoryId : categoryIdx === 0;
    html += `
      ${mitProgram ? `<details class="admission-category-card" name="mit-admission-routes" data-admission-category="${escapeHtmlAttr(categoryId)}"${mitRouteOpen ? " open" : ""}>` : `<section class="admission-category-card" data-admission-category="${escapeHtmlAttr(categoryId)}">`}
        ${mitProgram ? '<summary class="admission-category-head">' : '<div class="admission-category-head">'}
          <div>
            <div class="admission-category-kicker">${escapeHtml(t("admission.category", "Admission category"))} &middot; ${escapeHtml(scopeLabel)}${catLevelBadges} &middot; ${escapeHtml(routeText)}</div>
            <h3 class="admission-category-title">${escapeHtml(categoryLabel)}</h3>
            ${categoryDescription ? `<p class="admission-category-description">${escapeHtml(categoryDescription)}</p>` : ""}
            ${deadlinePillHtml}
          </div>
          ${mitProgram ? heroIcon("chevron-down", "ui-icon ui-icon--18 mit-route-chevron") : `<div class="admission-category-count">${escapeHtml(t("admission.profile_count", "{count} profiles").replace("{count}", String(profileRows.length)))}</div>`}
        ${mitProgram ? "</summary>" : "</div>"}

        ${mitProgram || hasExplicitProgramSelection ? "" : renderApplicablePrograms(category, activeProfile)}

        ${profileRows.length > 1 ? `
        <div class="requirement-profile-tabs" role="tablist" aria-label="${escapeHtmlAttr(t("admission.profile.tabs_label", "Requirement profiles"))}">
          ${profileRows.map((profile) => {
            const active = profile === activeProfile;
            return `
              <button
                type="button"
                class="requirement-profile-tab${active ? " is-active" : ""}"
                data-admission-category-key="${escapeHtmlAttr(categoryKey)}"
                data-requirement-profile="${escapeHtmlAttr(String(profile.id || ""))}"
                role="tab"
                aria-selected="${active ? "true" : "false"}"
              >${escapeHtml(translatedProfileLabel(profile))}</button>
            `;
          }).join("")}
        </div>
        ` : ""}

        <div class="requirement-profile-panel">
          ${!noPublishedMinimums && (profileRows.length > 1 || profileIsRecommended || activeChoiceChance) ? `
          <div class="requirement-profile-head">
            ${profileRows.length > 1 ? `
            <div>
              <div class="requirement-profile-kicker">${escapeHtml(t("admission.profile", "Requirement profile"))}</div>
              <h4 class="requirement-profile-title">${escapeHtml(activeProfileLabel)}</h4>
            </div>
            ` : `<div></div>`}
            <div class="requirement-profile-badges">
              ${profileIsRecommended ? `<span class="track-selection-badge">${escapeHtml(t("admission.choice.recommended", "Recommended"))}</span>` : ""}
              ${renderTrackChanceChip(activeChoiceChance)}
            </div>
          </div>
          ` : ""}
          ${noPublishedMinimums ? renderTrackChanceChip(activeChoiceChance) : ""}
          ${renderTrackFactors(activeChoiceChance)}
          ${profileDescription && profileDescription !== categoryDescription && profileRows.length === 1 ? `<p class="admission-scope-note">${escapeHtml(profileDescription)}</p>` : ""}
          ${activeChoiceChance?.chancePercent != null && (activeProfile.requirements_note || category.requirements_note) ? `<p class="admission-scope-note">${escapeHtml(t("admission.requirements_fit.unscored_conditions", "The percentage covers numeric minimums only. Subject, grade, document, and eligibility conditions still need separate review."))}</p>` : ""}

          ${renderChoiceRequirements({ category, funding: null, profile: activeProfile, university })}

          ${profileHasFundingOptions
            ? (mitBachelor ? "" : renderFundingOptions({ annualCostForTrack, category, effectiveSelectedChoiceKey, profile: activeProfile, university }))
            : `
              <div class="track-select-row">
                <button type="button" class="track-select-btn${profileIsSelected ? " is-active" : ""}" ${admissionChoiceSelectionAttrs({ category, choiceKey: activeChoiceKey, profile: activeProfile })} ${profileIsSelected ? "disabled" : ""}>
                  ${escapeHtml(profileIsSelected ? t("admission.choice.selected", "Selected") : t("admission.choice.select", "Select"))}
                </button>
              </div>
            `}
        </div>
      ${mitProgram ? "</details>" : "</section>"}
    `;
  });
  html += `</div>`;
  if (!compactMode) html += analysisHtml;

  container.innerHTML = html;
  container.querySelectorAll("[data-admission-open-tab]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector(`.d-tab-btn[data-tab="${button.dataset.admissionOpenTab}"]`)?.click());
  });
  container.querySelector?.("[data-mit-open-programs]")?.addEventListener("click", () => {
    document.querySelector('.d-tab-btn[data-tab="tab-programs"]')?.click();
  });
  container.querySelectorAll("[data-admission-context]").forEach((select) => {
    select.addEventListener("change", () => {
      const key = select.getAttribute("data-admission-context");
      updateAdmissionUrl({ [key]: select.value });
      onContextChange?.();
    });
  });
  container.querySelectorAll("[data-admission-level]").forEach((button) => {
    button.addEventListener("click", () => {
      motionPress(button);
      const lvlKey = String(button.getAttribute("data-admission-level") || "").trim() || "all";
      admissionStudyLevelSelectionByUniversity.set(universityId, lvlKey);
      updateAdmissionUrl({ level: lvlKey, route: "", cycle: "" });
      onContextChange?.();
      renderAdmissionSection({
        annualCostForTrack,
        container,
        uniChance,
        uniChanceByChoiceKey: chanceByChoice,
        university,
        onChoiceSelected,
        effectiveSelectedChoiceKeyOverride,
        onContextChange,
        compactMode,
      });
    });
  });

  container.querySelectorAll("[data-admission-program]").forEach((button) => {
    button.addEventListener("click", () => {
      motionPress(button);
      const programKey = String(button.getAttribute("data-admission-program") || "").trim() || GENERAL_PROGRAM_KEY;
      admissionProgramSelectionByUniversity.set(universityId, programKey);
      const selectedProgram = (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
        .find((program) => normalizeProgramToken(program?.name || program?.program_name || program?.id) === programKey);
      updateAdmissionUrl({
        program: selectedProgram?.id || "",
        level: selectedProgram ? normalizeLevelKey(selectedProgram.study_levels?.[0] || selectedProgram.study_level || selectedProgram.level) : "",
        route: "",
        cycle: "",
      });
      if (selectedProgram) admissionStudyLevelSelectionByUniversity.set(universityId, normalizeLevelKey(selectedProgram.study_levels?.[0] || selectedProgram.study_level || selectedProgram.level));
      onContextChange?.();
      renderAdmissionSection({
        annualCostForTrack,
        container,
        uniChance,
        uniChanceByChoiceKey: chanceByChoice,
        university,
        onChoiceSelected,
        effectiveSelectedChoiceKeyOverride,
        onContextChange,
        compactMode,
      });
    });
  });

  container.querySelectorAll("[data-requirement-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      motionPress(button);
      const categoryKey = String(button.getAttribute("data-admission-category-key") || "").trim();
      const profileId = String(button.getAttribute("data-requirement-profile") || "").trim();
      if (categoryKey && profileId) admissionProfileSelectionByCategory.set(categoryKey, profileId);
      renderAdmissionSection({
        annualCostForTrack,
        container,
        uniChance,
        uniChanceByChoiceKey: chanceByChoice,
        university,
        onChoiceSelected,
        effectiveSelectedChoiceKeyOverride,
        compactMode,
      });
    });
  });

  container.querySelectorAll("[data-admission-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      motionPress(button);
      const choiceKey = String(button.getAttribute("data-admission-choice") || "").trim();
      if (!choiceKey) return;
      const selection = {
        programId: admissionContext.selectedProgramId || "",
        categoryId: String(button.getAttribute("data-category-id") || "").trim(),
        requirementProfileId: String(button.getAttribute("data-requirement-profile-id") || "").trim(),
        fundingOptionId: String(button.getAttribute("data-funding-option-id") || "").trim(),
        choiceKey,
      };
      if (typeof onChoiceSelected === "function") {
        onChoiceSelected(selection);
      } else {
        saveSelectedAdmissionChoice(university.id, selection);
      }
      replayMotion(button.closest(".admission-funding-option") || button.closest(".requirement-profile-panel") || button, "motion-state-pulse", { timeoutMs: 520 });
    });
  });

  applyPercentWidths(container);
  markMotionEnter(container, ".admission-category-card, .admission-funding-option, .admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 18, staggerMs: 18 });
  refreshFundingAwardsForVisibleAdmission(university);
}

export function renderFinanceSection({
  annualCostForTrack,
  container,
  priceEl,
  profileStudyMode,
  scholarshipContainer,
  uniRoi,
  uniChance,
  university,
}) {
  if (university.finance) {
    const profile = loadProfile() || {};
    const selectedStudyLevel = profile.studyLevel || profile.study_level;
    const admissionContext = selectedAdmissionContext(university, getAdmissionContextProfile(university, loadProfileForApi()));
    const isProgramSelected = admissionContext.selectedProgram !== GENERAL_PROGRAM_KEY;
    const financeCategories = admissionContext.visibleCategories;
    const financeStudyLevel = admissionContext.selectedLevel || selectedStudyLevel;
    const mitBachelorFinance = university.id === MIT_ID && financeStudyLevel === "bachelor";
    const selectedProgramRecord = (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
      .find((program) => [program?.id, program?.course_number].some((value) => String(value || "") === String(admissionContext.selectedProgramId || "")));
    const directProgramTuition = (() => {
      const rawAmount = selectedProgramRecord?.tuition_year_usd;
      const amount = Number(rawAmount);
      const sourceUrl = safeHttpUrl(selectedProgramRecord?.tuition_source_url || selectedProgramRecord?.source_url);
      const cycle = String(selectedProgramRecord?.tuition_cycle || "").trim();
      if (!selectedProgramRecord || rawAmount == null || String(rawAmount).trim() === "" || !Number.isFinite(amount) || amount < 0 || !sourceUrl || !cycle) return null;
      return { amount, currency: String(selectedProgramRecord.currency || university.finance.currency || "USD"), cycle, sourceUrl };
    })();
    const directTuitionMatchesCycle = directProgramTuition
      && (!admissionContext.cycle || cycleMatches(directProgramTuition.cycle, admissionContext.cycle) === true);
    const policyData = resolveFeeStatusAndAid({
      university,
      profile,
      uniChance,
      studyLevel: financeStudyLevel,
    });

    if (scholarshipContainer) {
      const categoriesForLevel = admissionContext.visibleCategories;
      const awardsHtml = renderFundingAwardList(
        university.finance,
        categoriesForLevel,
        admissionContext.selectedLevel || selectedStudyLevel,
        categoriesForLevel,
      );
      const grants = getGrantsFromCategories(categoriesForLevel);
      const legacyGrantsHtml = grants.length
        ? grants.map((grant) => renderScholarshipLine(
            "information-circle",
            "scholarship-line--muted",
            `${trTrackDescription(university.id, grant.id, grant.name)} · ${t("university.finance.award_not_confirmed", "Award not confirmed")}`,
          )).join("")
        : "";
      const policyLineHtml = policyData.aidBadge
        ? renderScholarshipLine(
            "information-circle",
            "scholarship-line--muted",
            `${policyData.aidBadge}: ${policyData.thresholds.length ? policyData.thresholds[0].label : policyData.feeStatusBadge || t("placeholder.field.financial_aid", "Financial aid")}`,
          )
        : "";
      const fundingSourceUrl = categoriesForLevel.map((category) => safeHttpUrl(category.funding_source_url)).find(Boolean);
      const fundingNextStepHtml = fundingSourceUrl
        ? `<div class="scholarship-line scholarship-line--muted">${renderInlineIcon("arrow-top-right-on-square", 16, "scholarship-line-icon")}<a href="${escapeHtmlAttr(fundingSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("placeholder.field.financial_aid", "Financial aid"))}</a></div>`
        : "";
      const emptyHtml = renderScholarshipLine(
        "question-mark-circle",
        "scholarship-line--muted",
        t("university.finance.aid_not_catalogued", "No grant options are catalogued here. Check the university's official financial aid policy."),
      );
      const hasScopedAwards = Array.isArray(university.finance.scholarships_and_funding)
        && university.finance.scholarships_and_funding.length > 0;
      scholarshipContainer.innerHTML = mitBachelorFinance ? `
        <p class="finance-awards-disclaimer">${escapeHtml(t("university.finance.awards_not_guaranteed", "These are funding opportunities, not award offers. Estimated costs do not decrease unless aid is officially awarded."))}</p>
        <details class="mit-aid-details"><summary>${escapeHtml(t("university.finance.mit_aid_details", "See funding details"))}</summary>${awardsHtml || emptyHtml}</details>
      ` : `
        <p class="finance-awards-disclaimer">${escapeHtml(t("university.finance.awards_not_guaranteed", "These are funding opportunities, not award offers. Estimated costs do not decrease unless aid is officially awarded."))}</p>
        ${awardsHtml || (hasScopedAwards
          ? renderScholarshipLine("information-circle", "scholarship-line--muted", t("university.finance.award_none_for_scope", "No listed awards match this study level and program."))
          : (legacyGrantsHtml || policyLineHtml || emptyHtml))}
        ${awardsHtml ? legacyGrantsHtml : fundingNextStepHtml}
      `;
    }

    if (priceEl) {
      let minTotal = financeStudyLevel ? undefined : modeAwareAnnualCostIfKnown(university.finance, profileStudyMode);
      const allFundingOptions = getFinanceChoicesForStudyLevel(financeCategories, financeStudyLevel);
      const summaryRange = getCommonAnnualCostRange(allFundingOptions, university.finance);
      if (isProgramSelected && !allFundingOptions.length && directTuitionMatchesCycle) minTotal = directProgramTuition.amount;
      if (allFundingOptions.length) {
        const prices = allFundingOptions
          .map((option) => annualCostForTrack(option))
          .filter((price) => price != null && Number.isFinite(Number(price)) && Number(price) >= 0);
        if (prices.length > 0) minTotal = Math.min(...prices);
      }
      const uniCurrency = university?.finance?.currency || "USD";
      const currentCycleRange = summaryRange && admissionContext.cycle
        ? (cycleMatches(summaryRange.academicYear, admissionContext.cycle) === true ? summaryRange : null)
        : summaryRange;
      if (directTuitionMatchesCycle && isProgramSelected && !allFundingOptions.length) {
        priceEl.textContent = formatPrice(directProgramTuition.amount, directProgramTuition.currency);
        const priceCard = priceEl.closest?.(".total-price-card");
        const title = priceCard?.querySelector(".price-header");
        const context = priceCard?.querySelector(".price-context");
        if (title) title.textContent = t("university.finance.published_tuition_per_year", "Published tuition / year");
        if (context) context.textContent = directProgramTuition.cycle;
      } else if (currentCycleRange) {
        priceEl.textContent = `${formatMoney(currentCycleRange.min, currentCycleRange.currency)}–${formatMoney(currentCycleRange.max, currentCycleRange.currency)}`;
        const priceCard = priceEl.closest?.(".total-price-card");
        const title = priceCard?.querySelector(".price-header");
        const context = priceCard?.querySelector(".price-context");
        if (title) title.textContent = t("university.finance.published_range_title", "Published annual cost range");
        if (context) context.textContent = annualCostRangeContext(currentCycleRange);
      } else {
        priceEl.innerHTML = minTotal != null && Number.isFinite(Number(minTotal))
          ? `<span class="price-prefix">${escapeHtml(translateWord("from", "from"))}</span> ${formatPrice(minTotal, uniCurrency)}`
          : escapeHtml(unknownFieldText("placeholder.field.cost", "Cost"));
        const priceCard = priceEl.closest?.(".total-price-card");
        const title = priceCard?.querySelector(".price-header");
        const context = priceCard?.querySelector(".price-context");
        if (title) title.textContent = t("university.finance.lowest_annual_estimate", "Lowest annual estimate");
        if (context) context.textContent = t("university.finance.estimate_context", "Across published funding options");
      }
      if (mitBachelorFinance) {
        const publishedBudget = modeAwareAnnualCostIfKnown(university.finance, profileStudyMode);
        const budgetMatchesCycle = !admissionContext.cycle || cycleMatches(university.finance.academic_year, admissionContext.cycle) === true;
        priceEl.textContent = budgetMatchesCycle && publishedBudget != null && Number.isFinite(Number(publishedBudget))
          ? formatPrice(publishedBudget, uniCurrency)
          : unknownFieldText("placeholder.field.cost", "Cost");
        const priceCard = priceEl.closest?.(".total-price-card");
        const title = priceCard?.querySelector(".price-header");
        const context = priceCard?.querySelector(".price-context");
        if (title) title.textContent = t("university.finance.mit_budget", "Published undergraduate annual budget");
        if (context) context.textContent = university.finance.academic_year || "";
      }
    }
    if (container) {
      const choices = getFinanceChoicesForStudyLevel(financeCategories, financeStudyLevel);
      const financeChoices = choices.length
        ? choices
        : (isProgramSelected || financeStudyLevel ? [] : [{ label: translateWord("general_tuition", "General Tuition"), finance_override: null, category_label: translateWord("general_tuition", "General Tuition") }]);
      if (mitBachelorFinance) {
        const breakdown = modeAwareBreakdown(university.finance, profileStudyMode);
        const currency = university.finance.currency || "USD";
        const rows = Object.entries(breakdown || {}).filter(([, amount]) => Number(amount) > 0);
        const sourceUrl = safeHttpUrl(university.finance.source_url);
        container.innerHTML = `
          ${renderSelectedProgramContext(university, admissionContext.selectedProgram) || `<div class="mit-finance-hint"><span>${escapeHtml(t("university.finance.mit_select_program", "MIT's undergraduate budget is shown. Select a program to see its applicable costs and funding."))}</span><button type="button" data-mit-open-programs>${escapeHtml(t("admission.mit.browse_programs", "Browse programs"))}</button></div>`}
          <section class="mit-annual-budget">
            <div class="mit-annual-budget__head"><h3>${escapeHtml(t("university.finance.mit_budget", "Published undergraduate annual budget"))}</h3><span>${escapeHtml(university.finance.academic_year || "")}</span></div>
            <dl>${rows.map(([key, amount]) => `<div><dt>${escapeHtml(translateCostBreakdownLabel(key))}</dt><dd>${escapeHtml(formatPrice(amount, currency))}</dd></div>`).join("")}</dl>
            ${sourceUrl ? `<a href="${escapeHtmlAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.deadlines.official_source", "Official source"))}</a>` : ""}
          </section>
          ${renderFinancePolicyOverview({ ...policyData, feeStatusBadge: "", phdFunding: null }, true)}
          ${renderOneTimeCosts(university.finance)}
        `;
        container.querySelector?.("[data-mit-open-programs]")?.addEventListener("click", () => {
          document.querySelector('.d-tab-btn[data-tab="tab-programs"]')?.click();
        });
        return;
      }
      let financeHtml = "";

      const groupedChoices = new Map();
      financeChoices.forEach((choice) => {
        const key = `${choice.category_id || "general"}::${choice.requirement_profile_id || "general"}`;
        if (!groupedChoices.has(key)) {
          groupedChoices.set(key, {
            categoryLabel: choice.category_label || choice.label || translateWord("general_tuition", "General Tuition"),
            profileLabel: choice.requirement_profile_label || choice.label || "",
            rows: [],
          });
        }
        groupedChoices.get(key).rows.push(choice);
      });

      groupedChoices.forEach((group) => {
        const trackHasGrantOnlyOptions = group.rows.length > 0 && group.rows.every((option) => getTrackFundingType(option) === "grant");

        const optionCardsHtml = group.rows.map((option) => {
          const isGrantTrack = getTrackFundingType(option) === "grant";
          const grantHasAwardSpecificOverride = isGrantTrack && hasFundingSpecificFinanceOverride(university, option);
          let financeData = grantHasAwardSpecificOverride
            ? getCourseFinanceWithoutAwardOverride(university, option)
            : getFinanceForChoice(option, university.finance);
          const programTuition = financeData ? null : getProgramTuitionForChoice(option, university);
          if (programTuition) financeData = programTuition.finance;
          const totalRange = grantHasAwardSpecificOverride
            ? publishedAnnualCostRange(financeData)
            : publishedAnnualCostRangeForChoice(option, university.finance);
          const total = totalRange ? undefined : modeAwareAnnualCostIfKnown(financeData, profileStudyMode);
          const breakdown = modeAwareBreakdown(financeData || {}, profileStudyMode);
          const uniCurrency = financeData?.currency || university?.finance?.currency || "USD";
          const totalText = totalRange
            ? `${formatMoney(totalRange.min, totalRange.currency)}–${formatMoney(totalRange.max, totalRange.currency)}`
            : moneyOrUnknown(total, "placeholder.field.total_cost", "Total cost", uniCurrency);
          const colorClasses = ["cost-color-1", "cost-color-2", "cost-color-3", "cost-color-4", "cost-color-5"];
          const breakdownEntries = Object.entries(breakdown || {})
            .map(([key, value], idx) => {
              const numericVal = Number(value) || 0;
              return {
                colorClass: colorClasses[idx % colorClasses.length],
                label: translateCostBreakdownLabel(key),
                percent: Number.isFinite(Number(total)) && Number(total) > 0 ? ((numericVal / Number(total)) * 100) : 0,
                value: numericVal,
              };
            })
            .filter((entry) => entry.value > 0);
          const breakdownNote = costBreakdownCoverageNote(financeData || {}, breakdownEntries, total);

          const optionLabel = trTrackLabel(option.funding_label || option.label || option.name || option.requirement_profile_label || "");
          const fundingMeta = [
            option.funding_program
              ? [t("admission.track.funding_program", "Funding program"), trTrackDescription(university.id, option.id, option.funding_program)]
              : null,
            option.funding_source
              ? [t("admission.track.funding_source", "Funding source"), trTrackDescription(university.id, option.id, option.funding_source)]
              : null,
          ].filter(Boolean);

          const totalTitle = programTuition
            ? t("university.finance.published_tuition_per_year", "Published tuition / year")
            : isGrantTrack
              ? t("university.finance.cost_before_aid", "Estimated cost before aid")
              : translateWord("total_per_year", "Total / year");
          const grantEstimateNoteHtml = isGrantTrack
            ? `<p class="finance-aid-note">${escapeHtml(t("university.finance.awards_not_deducted", "A possible award is not subtracted from this amount until it has been officially granted."))}</p>`
            : "";
          const rangeContext = annualCostRangeContext(totalRange);
          const rangeContextHtml = totalRange && rangeContext
            ? `<p class="finance-cost-range-context">${escapeHtml(rangeContext)}</p>`
            : "";
          const rangeNote = totalRange && (financeData?.note || financeData?.costs_breakdown_note)
            ? `<p class="finance-cost-range-note">${escapeHtml(financeData.note || financeData.costs_breakdown_note)}</p>`
            : "";
          const programTuitionNote = programTuition
            ? `<p class="finance-cost-range-note">${escapeHtml(t("university.finance.program_tuition_context", "Published gross tuition for {year}; potential awards are not deducted. Confirm the rate for your entry cycle.").replace("{year}", programTuition.year))} <a href="${escapeHtmlAttr(programTuition.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.finance.official_tuition_source", "Official tuition source"))}</a></p>`
            : "";
          const breakdownHtml = breakdownEntries.length > 1
            ? `
              <div class="cost-progress-bar" aria-hidden="true">
                ${breakdownEntries.map((entry) => `<span class="cost-progress-segment ${entry.colorClass}" style="--fill-width:${entry.percent}%; --fill-scale:${Math.max(0, Math.min(100, Number(entry.percent) || 0)) / 100}"></span>`).join("")}
              </div>
              <dl class="cost-legend">
                ${breakdownEntries.map((entry) => `
                  <div class="cost-legend-row">
                    <dt class="cost-legend-label-wrap">
                      <span class="cost-legend-dot ${entry.colorClass}"></span>
                      <span class="cost-legend-label">${escapeHtml(entry.label)}</span>
                    </dt>
                    <dd class="cost-legend-value">${escapeHtml(formatPrice(entry.value, uniCurrency))}</dd>
                  </div>
                `).join("")}
              </dl>
            `
            : (breakdownEntries.length === 1
              ? `<div class="cost-legend-single">${escapeHtml(breakdownEntries[0].label)}: <strong>${escapeHtml(formatPrice(breakdownEntries[0].value, uniCurrency))}</strong></div>`
              : `<div class="cost-legend-single">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`);
          const breakdownNoteHtml = breakdownNote
            ? `<div class="finance-breakdown-note">${escapeHtml(breakdownNote)}</div>`
            : "";

          return `
            <article class="finance-option-card ${isGrantTrack ? "finance-option-card--grant" : "finance-option-card--paid"}">
              <div class="finance-option-head">
                ${renderTrackFundingBadge(option)}
                ${optionLabel ? `<h4 class="finance-option-label">${escapeHtml(optionLabel)}</h4>` : ""}
              </div>

              <div class="finance-option-total${isGrantTrack ? " finance-option-total--grant" : ""}">
                <span class="finance-option-total__label">${escapeHtml(totalTitle)}</span>
                <strong class="finance-option-total__value">${escapeHtml(totalText)}</strong>
                ${rangeContextHtml}
                ${rangeNote}
                ${programTuitionNote}
              </div>

              ${grantEstimateNoteHtml}

              ${renderFinanceMetaList(fundingMeta)}

              <div class="cost-breakdown-list">
                <div class="finance-breakdown-title">${escapeHtml(t("university.finance.cost_breakdown", "Cost breakdown"))}</div>
                ${breakdownHtml}
                ${breakdownNoteHtml}
              </div>
            </article>
          `;
        }).join("");

        financeHtml += `
          <section class="finance-track-group${trackHasGrantOnlyOptions ? " finance-track-group--grant" : ""}">
            <div class="finance-track-group-head">
              <h3>${escapeHtml(trTrackLabel(group.categoryLabel || "") || t("admission.category", "Admission category"))}</h3>
              ${group.profileLabel ? `<p>${escapeHtml(t("admission.profile", "Requirement profile"))}: ${escapeHtml(trTrackLabel(group.profileLabel) || group.profileLabel)}</p>` : ""}
            </div>

            <div class="finance-track-options-title">${escapeHtml(t("admission.funding_options", "Funding options"))}</div>
            <div class="finance-track-options-grid">${optionCardsHtml}</div>
          </section>
        `;
      });

      if (isProgramSelected && !financeChoices.length && directProgramTuition) {
        const requestedCycleNote = admissionContext.cycle && !directTuitionMatchesCycle
          ? `<p class="finance-cycle-unknown">${escapeHtml(t("university.finance.program_cycle_unknown", "Cost for the selected entry cycle has not been confirmed. The published amount below is a reference for a different or unclear period."))}</p>`
          : "";
        financeHtml = `
          <article class="finance-option-card finance-program-tuition-reference">
            <div class="finance-option-head"><h4 class="finance-option-label">${escapeHtml(trProgramName(selectedProgramRecord.name || selectedProgramRecord.program_name) || selectedProgramRecord.name || selectedProgramRecord.program_name || "")}</h4></div>
            <div class="finance-option-total"><span class="finance-option-total__label">${escapeHtml(t("university.finance.published_tuition_per_year", "Published tuition / year"))}</span><strong class="finance-option-total__value">${escapeHtml(formatPrice(directProgramTuition.amount, directProgramTuition.currency))}</strong><p class="finance-cost-range-context">${escapeHtml(t("university.finance.program_tuition_context", "Published gross tuition for {year}; potential awards are not deducted. Confirm the rate for your entry cycle.").replace("{year}", directProgramTuition.cycle))}</p>${requestedCycleNote}<a href="${escapeHtmlAttr(directProgramTuition.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.finance.official_tuition_source", "Official tuition source"))}</a></div>
          </article>`;
      }

      const policyHtml = renderFinancePolicyOverview(policyData);
      const oneTimeCostsHtml = renderOneTimeCosts(university.finance);
      const roiHtml = university.id === MIT_ID ? "" : renderRoiBox(uniRoi);
      const financeGridHtml = financeHtml
        ? `<div class="finance-grid-new">${financeHtml}</div>`
        : `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`;
      container.innerHTML = `${renderSelectedProgramContext(university, admissionContext.selectedProgram)}${policyHtml}${oneTimeCostsHtml}${financeGridHtml}${roiHtml}`;
      markMotionEnter(container, ".finance-policy-card, .finance-one-time-costs, .finance-track-group, .finance-option-card, .roi-box, .admission-empty-state", { limit: 18, staggerMs: 18 });
    }
    return;
  }

  if (scholarshipContainer) {
    scholarshipContainer.innerHTML = renderScholarshipLine("question-mark-circle", "scholarship-line--muted", unknownFieldText("placeholder.field.financial_aid", "Financial aid"));
  }
  if (priceEl) {
    priceEl.textContent = unknownFieldText("placeholder.field.cost", "Cost");
  }
  if (container) {
    container.innerHTML = `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`;
    markMotionEnter(container, ".admission-empty-state", { limit: 1 });
  }
}
