import { escapeHtml, escapeHtmlAttr, loadProfileForApi } from "../../utils.js";
import { getCurrentLanguage, t } from "../../i18n.js";
import { isPlainObject } from "../../university-detail-helpers.js";
import { translateAdmissionText } from "../../university-translations.js";
import { parseExactDeadlineDate } from "./deadline-calendar.js";
import { formatStudyLevelCounts, trProgramName } from "../_shared.js";

export const GENERAL_PROGRAM_KEY = "__general__";
export const admissionProgramSelectionByUniversity = new Map();
// Programs picked in the comparison setup. Many legacy programs exist only as names on admission
// categories, with no entry in academics.programs (and so no URL id), so the pick is kept here.
/** @type {Map<string, string>} */
export const compareProgramChoiceByUniversity = new Map();
export const admissionStudyLevelSelectionByUniversity = new Map();
export const visibleAdmissionContextByUniversity = new Map();

export function safeHttpUrl(value) {
  try {
    const source = String(value || "").trim();
    const url = new URL(source);
    return ["https:", "http:"].includes(url.protocol) ? source : "";
  } catch {
    return "";
  }
}

export function normalizeProgramToken(value) {
  const token = String(value || "").trim().toLowerCase().replaceAll("&", " and ")
    .replace(/[^\p{L}\p{N}]+/gu, "_");
  return token.replace(/^_|_$/g, "");
}

export function uniqueNonEmpty(values) {
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

export function getAdmissionCategories(university) {
  return Array.isArray(university?.admission_categories)
    ? university.admission_categories.filter(isPlainObject)
    : [];
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
    .find((program) => [program?.source_name, program?.name, program?.program_name]
      .some((name) => normalizeProgramToken(name) === wanted));
  const programId = normalizeProgramToken(selectedProgram?.id || selectedProgram?.course_number);
  return categoryTokens(category).some((token) => token === wanted || (programId && token === programId));
}

function getVisibleAdmissionCategories(categories, selectedProgramKey, university) {
  const generalCategories = categories.filter((category) => String(category?.scope || "general").trim().toLowerCase() === "general");
  if (!selectedProgramKey || selectedProgramKey === GENERAL_PROGRAM_KEY) {
    return generalCategories.length ? generalCategories : categories;
  }
  const programCategories = categories.filter((category) => categoryMatchesProgram(category, selectedProgramKey, university));
  if (programCategories.length) return programCategories;
  return generalCategories.length ? generalCategories : categories;
}

export function normalizeLevelKey(rawLevel) {
  const norm = String(rawLevel || "").trim().toLowerCase();
  if (norm.includes("bachelor") || norm.includes("undergrad") || norm.includes("integrated master") || norm.includes("бакалавр")) return "bachelor";
  if (norm.includes("master") || norm.includes("msc") || norm.includes("mres") || norm.includes("meng") || norm.includes("магистр")) return "master";
  if (norm.includes("phd") || norm.includes("doctor") || norm.includes("dphil") || norm.includes("доктор") || norm.includes("аспирант")) return "doctorate";
  if (norm.includes("mba") || norm.includes("мба")) return "mba";
  if (norm.includes("professional") || /\bjd\b|juris doctor/.test(norm)) return "professional";
  return norm || "general";
}

export function getCategoryLevelsList(category) {
  const levels = Array.isArray(category?.study_levels)
    ? category.study_levels
    : (category?.study_level ? [category.study_level] : []);
  return levels.map((l) => String(l || "").trim()).filter(Boolean);
}

export function categoryIsMba(category) {
  const searchable = [category?.label, category?.category_label, category?.name, category?.id, ...(Array.isArray(category?.program_names) ? category.program_names : [])]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return /\bmba\b|master of business administration/.test(searchable);
}

export function categoryMatchesStudyLevel(category, selectedLevelKey) {
  if (!selectedLevelKey || ["all", "any", "general"].includes(selectedLevelKey)) return true;
  const levels = getCategoryLevelsList(category);
  const scope = String(category?.scope || "").trim().toLowerCase();
  const hasLegacyBachelorScope = ["general", "program", "program_group"].includes(scope);
  if (selectedLevelKey === "mba" && categoryIsMba(category)) return true;
  if (levels.length) return levels.some((lvl) => normalizeLevelKey(lvl) === selectedLevelKey);
  if (hasLegacyBachelorScope) return selectedLevelKey === "bachelor";
  return false;
}

// Admission categories that describe undergraduate (bachelor) study.
export function getUndergraduateCategories(categories) {
  return (Array.isArray(categories) ? categories : []).filter((category) => categoryMatchesStudyLevel(category, "bachelor"));
}

export function cycleMatches(sourceCycle, requestedCycle) {
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

export function getAvailableStudyLevels(categories) {
  const counts = new Map();
  categories.forEach((cat) => {
    const levels = getCategoryLevelsList(cat);
    levels.forEach((l) => {
      const k = normalizeLevelKey(l);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    if (categoryIsMba(cat)) counts.set("mba", (counts.get("mba") || 0) + 1);
  });

  return formatStudyLevelCounts(counts, {
    mbaKey: "profile.option.study_level_mba",
    professionalKey: "profile.option.study_level_professional",
  });
}

export function renderStudyLevelFilter(availableLevels, activeLevelKey, totalCategories) {
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

export function selectAdmissionProgram(university, program) {
  const universityId = String(university?.id || "").trim();
  const programId = String(program?.id || "").trim();
  const programName = String(program?.source_name || program?.name || program?.program_name || "").trim();
  if (!universityId || (!programId && !programName)) return;
  admissionProgramSelectionByUniversity.set(universityId, normalizeProgramToken(programName || programId));
  const params = new URLSearchParams(window.location.search);
  params.set("admission_program", programId || programName);
  const level = Array.isArray(program.study_levels) ? program.study_levels[0] : (program.study_level || program.level);
  const levelKey = normalizeLevelKey(level);
  admissionStudyLevelSelectionByUniversity.set(universityId, levelKey);
  params.set("admission_level", levelKey);
  params.delete("admission_route");
  params.delete("admission_cycle");
  window.history?.pushState?.({}, "", `${window.location.pathname}?${params}${window.location.hash || ""}`);
}

export function updateAdmissionUrl(values) {
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
  const queryNameMatches = queryProgram ? programs.filter((program) =>
    [program?.source_name, program?.name, program?.program_name].some((name) => String(name || "").trim() === queryProgram)) : [];
  const savedProgramToken = normalizeProgramToken(trProgramName(saved.programName || saved.program_name));
  const majorToken = normalizeProgramToken(trProgramName(baseProfile?.major));
  const selectedProgram = (queryProgram && programs.find((program) => String(program?.id || "") === queryProgram))
    || (queryNameMatches.length === 1 ? queryNameMatches[0] : null)
    || (saved.programId && programs.find((program) => String(program?.id || "") === String(saved.programId)))
    || (savedProgramToken && programs.find((program) => [program?.source_name, program?.name, program?.program_name]
      .filter(Boolean)
      .some((name) => normalizeProgramToken(name) === savedProgramToken)))
    || (majorToken && programs.find((program) => programMatchesLevel(program)
      && [program?.source_name, program?.name, program?.program_name].filter(Boolean).some((name) => normalizeProgramToken(name) === majorToken)));
  if (selectedProgram) {
    const rawLevel = Array.isArray(selectedProgram.study_levels) ? selectedProgram.study_levels[0] : (selectedProgram.study_level || selectedProgram.level);
    profile.study_level = rawLevel || profile.study_level;
    profile.studyLevel = profile.study_level;
    const previousChoice = profile.selectedAdmissionChoices?.[id] || saved;
    const selectedId = String(selectedProgram.id || "");
    const selectedName = String(selectedProgram.source_name || selectedProgram.name || selectedProgram.program_name || "").trim();
    if (queryProgram && (queryProgram === selectedId || queryProgram === selectedName || queryProgram === String(selectedProgram.name || "").trim())) {
      const sameProgram = selectedId
        ? String(previousChoice.programId || "") === selectedId
        : String(previousChoice.programName || previousChoice.program_name || "").trim() === selectedName;
      const rawLevelKey = normalizeLevelKey(rawLevel);
      const applicableCategories = getVisibleAdmissionCategories(
        getAdmissionCategories(university).filter((category) => categoryMatchesStudyLevel(category, rawLevelKey)),
        normalizeProgramToken(selectedName || selectedProgram.id),
        university,
      );
      const savedChoiceCategoryId = String(previousChoice.categoryId || previousChoice.category_id || "");
      const legacyChoiceApplies = !previousChoice.programId && Boolean(previousChoice.choiceKey || previousChoice.choice_key)
        && applicableCategories.some((category) => String(category.id || "") === savedChoiceCategoryId);
      profile.selectedAdmissionChoices = {
        ...(isPlainObject(profile.selectedAdmissionChoices) ? profile.selectedAdmissionChoices : null),
        [id]: sameProgram || legacyChoiceApplies
          ? { ...previousChoice, ...(selectedId ? { programId: selectedId } : { programName: selectedName }) }
          : selectedId ? { programId: selectedId } : { programName: selectedName },
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
    selectedProgram ? normalizeProgramToken(selectedProgram.source_name || selectedProgram.name || selectedProgram.program_name || selectedProgram.id) : GENERAL_PROGRAM_KEY,
    university,
  );
  const routes = [...new Set(scopedCategories.map((category) => String(category.applicant_route || "").trim()).filter(Boolean))];
  const requestedRoute = params.get("admission_route");
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
  const canonicalLevel = { bachelor: "Bachelor", master: "Master", doctorate: "Doctorate", mba: "MBA", professional: "Professional" }[currentLevel];
  if (canonicalLevel) profile.studyLevel = profile.study_level = canonicalLevel;
  return profile;
}

export function selectedAdmissionContext(university, profile) {
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
  const queryNameMatches = queryProgramId ? programs.filter((program) => [program?.source_name, program?.name, program?.program_name]
    .some((name) => String(name || "").trim() === queryProgramId)) : [];
  const savedProgramToken = normalizeProgramToken(trProgramName(storedChoice.programName || storedChoice.program_name));
  const majorToken = normalizeProgramToken(trProgramName(profile?.major));
  const storedProgram = (queryProgramId && programs.find((program) => String(program?.id || "") === queryProgramId))
    || (queryNameMatches.length === 1 ? queryNameMatches[0] : null)
    || (storedChoice.programId && programs.find((program) => String(program?.id || "") === String(storedChoice.programId)))
    || (savedProgramToken && programs.find((program) => [program?.source_name, program?.name, program?.program_name]
      .filter(Boolean)
      .some((name) => normalizeProgramToken(name) === savedProgramToken)))
    || (majorToken && programs.find((program) => programMatchesLevel(program)
      && [program?.source_name, program?.name, program?.program_name].filter(Boolean).some((name) => normalizeProgramToken(name) === majorToken)));
  if (storedProgram) admissionProgramSelectionByUniversity.set(universityId, normalizeProgramToken(storedProgram.source_name || storedProgram.name || storedProgram.program_name || storedProgram.id));
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
  const compareProgramChoice = compareProgramChoiceByUniversity.get(universityId) || "";
  const selectedProgram = storedProgram
    ? normalizeProgramToken(storedProgram.source_name || storedProgram.name || storedProgram.program_name || storedProgram.id)
    : (compareProgramChoice || GENERAL_PROGRAM_KEY);
  if (storedProgram || compareProgramChoice) admissionProgramSelectionByUniversity.set(universityId, selectedProgram);
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

export function renderAdmissionContextControls(categories, context) {
  const routes = [...new Set(categories.map((category) => String(category.applicant_route || "").trim()).filter(Boolean))];
  const cycles = [...new Set(categories.flatMap((category) => [
    category.cycle,
    ...(Array.isArray(category.deadlines) ? category.deadlines.map((deadline) => deadline?.cycle) : []),
    ...(Array.isArray(category.admission_rounds) ? category.admission_rounds.map((round) => round?.cycle) : []),
  ]).map((value) => String(value || "").trim()).filter((value) => value && value.length <= 40))];
  const select = (key, label, value, options) => `
    <label class="admission-context-control" for="admissionContext-${escapeHtmlAttr(key)}">
      <span>${escapeHtml(label)}</span>
      <select id="admissionContext-${escapeHtmlAttr(key)}" class="ui-select" data-flags="off" data-admission-context="${key}">
        <option value="">${escapeHtml(t("university.admissions.context.unknown", "Unknown"))}</option>
        ${value && !options.includes(value) ? (() => {
          const provenMismatch = key === "cycle"
            ? options.length > 0 && options.every((option) => cycleMatches(option, value) === false)
            : !options.includes(value);
          const note = provenMismatch
            ? ` (${escapeHtml(t(key === "cycle" ? "university.admissions.context.unmatched_cycle" : "university.admissions.context.unmatched", key === "cycle" ? "does not match listed cycle data" : "not matched to listed routes"))})`
            : "";
          return `<option value="${escapeHtmlAttr(value)}" selected>${escapeHtml(key === "cycle" ? localizeDeadlineCycle(value) : applicantRouteLabel(value))}${note}</option>`;
        })() : ""}
        ${options.map((option) => `<option value="${escapeHtmlAttr(option)}"${option === value ? " selected" : ""}>${escapeHtml(key === "route" ? applicantRouteLabel(option) : localizeDeadlineCycle(option))}</option>`).join("")}
      </select>
    </label>`;
  const controls = [];
  if (routes.length) controls.push(select("route", t("university.admissions.route_label", "Applicant route"), context.route, routes));
  if (cycles.length) controls.push(select("cycle", t("university.admissions.cycle_label", "Entry cycle"), context.cycle, cycles));
  return controls.length ? `<div class="admission-context-controls">${controls.join("")}</div>` : "";
}

export function applicantRouteLabel(route) {
  const labels = {
    first_year: t("university.admissions.route.first_year", "First-year"),
    transfer: t("university.admissions.route.transfer", "Transfer"),
    graduate: t("university.admissions.route.graduate", "Graduate"),
  };
  return labels[String(route || "")] || t("university.admissions.context.unknown", "Unknown");
}

const KAZAKH_MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];

function formatKazakhDate(date, includeYear = true) {
  const day = date.getUTCDate();
  const month = KAZAKH_MONTHS[date.getUTCMonth()];
  return includeYear ? `${date.getUTCFullYear()} жылғы ${day} ${month}` : `${day} ${month}`;
}

export function localizeDeadlineDate(value) {
  const raw = String(value || "").trim();
  const language = getCurrentLanguage();
  if (language !== "rus" && language !== "kaz") return raw;
  const locale = language === "kaz" ? "kk-KZ" : "ru-RU";
  const exact = parseExactDeadlineDate(raw);
  if (exact) {
    const date = new Date(`${exact}T00:00:00Z`);
    return language === "kaz" ? formatKazakhDate(date) : new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const partial = raw.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  const monthIndex = partial ? month.findIndex((name) => name.toLowerCase() === partial[1].toLowerCase()) : -1;
  if (monthIndex >= 0) {
    const date = new Date(Date.UTC(2028, monthIndex, Number(partial[2])));
    return language === "kaz" ? formatKazakhDate(date, false) : new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
  }
  return translateAdmissionText(raw, raw);
}

export function localizeDeadlineCycle(value) {
  const raw = String(value || "");
  if (getCurrentLanguage() !== "rus" && getCurrentLanguage() !== "kaz") return raw;
  return translateAdmissionText(raw, raw)
    .replace(/\b(Fall|Spring) (\d{4}) entry\b/g, (_, season, year) =>
      `${t(season === "Fall" ? "university.deadlines.season.fall" : "university.deadlines.season.spring", season)} ${year}`)
    .replace(/\b(\d{4}) entry\b/g, (_, year) => t("university.deadlines.entry_year", "Entry in {year}").replace("{year}", year))
    .replace(/\bMid-March\b/g, t("university.deadlines.mid_march", "Mid-March"))
    .replace(/\bMid-December\b/g, t("university.deadlines.mid_december", "Mid-December"));
}

export function admissionChoiceSelectionAttrs({ category, choiceKey, funding = null, profile }) {
  return [
    `data-admission-choice="${escapeHtmlAttr(choiceKey)}"`,
    `data-category-id="${escapeHtmlAttr(String(category?.id || ""))}"`,
    `data-requirement-profile-id="${escapeHtmlAttr(String(profile?.id || ""))}"`,
    `data-funding-option-id="${escapeHtmlAttr(String(funding?.id || ""))}"`,
  ].join(" ");
}
