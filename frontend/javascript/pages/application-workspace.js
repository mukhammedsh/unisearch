import { t } from "../i18n.js";
import { loadProfile } from "../utils/persistence.js";
import { routeUniversityDetail } from "../routes.js";
import { fetchUniversityDetailCached, readIdListStorage, SAVED_UNIVERSITIES_KEY } from "./shared/cache.js";
import { createDeadlineIcs, parseExactDeadlineDate } from "./university/deadline-calendar.js";
import { buildPostOfferTasks } from "./application-workspace-postoffer.js";
import { resolveQualificationGuidance } from "./university/render-content.js";
import { translateFundingAwardField } from "../university-translations.js";

export const APPLICATION_CHECKLIST_KEY = "unisearch_application_checklist_v1";
export const APPLICATION_POST_OFFER_KEY = "unisearch_application_post_offer_v1";
const MAX_WORKSPACE_UNIVERSITIES = 5;

function text(value) {
  return String(value ?? "").trim();
}

function safeUrl(value) {
  try {
    const url = new URL(text(value));
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function readChecklist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APPLICATION_CHECKLIST_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeChecklist(value) {
  try {
    localStorage.setItem(APPLICATION_CHECKLIST_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readPostOfferState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APPLICATION_POST_OFFER_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writePostOfferState(value) {
  try {
    localStorage.setItem(APPLICATION_POST_OFFER_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function levelsOf(track) {
  const values = [track?.study_level, track?.degree_level, track?.studyLevel, ...(Array.isArray(track?.study_levels) ? track.study_levels : [])];
  return values.map((item) => text(item).toLowerCase()).filter(Boolean);
}

function levelMatches(left, right) {
  const normalize = (value) => {
    const raw = text(value).toLowerCase();
    if (/bachelor|undergraduate|first-year/.test(raw)) return "bachelor";
    if (/master|graduate|mba|mfin|mban/.test(raw)) return "master";
    if (/phd|doctor/.test(raw)) return "doctorate";
    return raw;
  };
  return normalize(left) === normalize(right);
}

function findSelectedCategory(university, selection) {
  const categories = Array.isArray(university?.admission_categories) ? university.admission_categories : [];
  if (!selection?.choiceKey) {
    return selection?.categoryId
      ? categories.find((category) => text(category?.id) === text(selection.categoryId)) || null
      : null;
  }
  return categories.find((category) => {
    if (text(category?.id) === text(selection.categoryId)) return true;
    return (Array.isArray(category?.requirement_profiles) ? category.requirement_profiles : []).some((profile) => {
      if (text(profile?.id) === text(selection.requirementProfileId)) return true;
      return (Array.isArray(profile?.funding_options) ? profile.funding_options : [])
        .some((option) => text(option?.id) === text(selection.fundingOptionId));
    });
  }) || null;
}

function selectedTrackLabel(category, selection) {
  if (!category) return "";
  const profiles = Array.isArray(category.requirement_profiles) ? category.requirement_profiles : [];
  const profile = profiles.find((row) => text(row?.id) === text(selection?.requirementProfileId));
  const funding = (Array.isArray(profile?.funding_options) ? profile.funding_options : [])
    .find((row) => text(row?.id) === text(selection?.fundingOptionId));
  return [selection?.programName, category?.label || category?.name, profile?.label, funding?.label || funding?.name]
    .map(text).filter(Boolean).join(" · ");
}

function normalizeDeadline(value, metadata = {}) {
  const deadlineText = text(value);
  const dateValue = deadlineText.match(/^(\d{4}-\d{2}-\d{2})(?=$|[T ;])/ )?.[1] || deadlineText;
  const exactDate = parseExactDeadlineDate(dateValue);
  return {
    raw: deadlineText,
    date: exactDate,
    cycle: text(metadata.cycle || metadata.academic_year || metadata.academicYear),
    timezone: text(metadata.deadline_timezone || metadata.timezone || metadata.time_zone || metadata.timezone_name || metadata.timezone_abbreviation || (metadata.time_uk || /\bUK time\b/i.test(deadlineText) ? "UK time" : "")),
    time: text(metadata.time || metadata.time_uk || metadata.deadline_time || metadata.cutoff_time || deadlineText.match(/\b(\d{1,2}:\d{2})\b/)?.[1]),
    label: text(metadata.round)
      ? `${t("application_workspace.round", "Round")} ${text(metadata.round)}`
      : text(metadata.deadline_type)
        ? t(`application_workspace.deadline_type_${text(metadata.deadline_type).toLowerCase()}`, text(metadata.deadline_type).replaceAll("_", " "))
        : text(metadata.label),
    sourceUrl: safeUrl(metadata.source_url || metadata.sourceUrl || metadata.source),
    verifiedAt: text(metadata.verified_at || metadata.verifiedAt),
    approximate: metadata.approximate === true || metadata.is_approximate === true,
  };
}

function cycleDeadline(value, category) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { value, cycleLabel: "" };
  const route = `${text(category?.id)} ${text(category?.label)} ${text(category?.name)}`.toLowerCase();
  const entries = Object.entries(value);
  const matchingEntry = entries.find(([key]) => {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    if (/earlyaction|earlydecision|early/.test(route)) return /earlyaction|earlydecision|early/.test(normalized);
    if (/regularaction|regular/.test(route)) return /regularaction|regular/.test(normalized);
    if (/round\s*1|round1/.test(route)) return /round1|roundone/.test(normalized);
    return false;
  });
  const entry = value.date || value.deadline || value.application_deadline
    ? ["", value]
    : matchingEntry || (entries.length === 1 ? entries[0] : null);
  const key = text(entry?.[0]).toLowerCase().replaceAll("_", " ");
  const cycleLabel = key === "early action" ? t("application_workspace.cycle_early_action", "Early Action")
    : key === "regular action" ? t("application_workspace.cycle_regular_action", "Regular Action")
      : key ? `${t("application_workspace.round", "Round")} ${key.replace(/^round\s*/i, "")}` : "";
  return entry ? { value: entry[1], cycleLabel } : { value: "", cycleLabel: "" };
}

function selectedProgram(university, selection) {
  const programs = Array.isArray(university?.academics?.programs) ? university.academics.programs : [];
  const programId = text(selection?.programId || selection?.program_id);
  if (programId) {
    const byId = programs.find((program) => text(program?.id || program?.course_number) === programId);
    if (byId) return byId;
  }
  const programName = text(selection?.programName || selection?.program_name).toLowerCase().replace(/\s+/g, " ");
  return programName
    ? programs.find((program) => text(program?.name || program?.title).toLowerCase().replace(/\s+/g, " ") === programName) || null
    : null;
}

function sharedUndergraduateDeadline(university, category, selection) {
  if (!category || !levelsOf(category).some((level) => levelMatches(level, "Bachelor"))) return null;
  const program = selectedProgram(university, selection);
  const oxfordUndergraduateRoute = university?.id === "university-of-oxford-uk-oxford";
  if (!program && !oxfordUndergraduateRoute) return null;
  if (program && !levelsOf(program).some((level) => levelMatches(level, "Bachelor"))) return null;

  const references = ["program_ids", "applicable_program_ids", "program_names", "applicable_programs"]
    .flatMap((key) => Array.isArray(category[key]) ? category[key] : category[key] ? [category[key]] : [])
    .map((value) => text(value).toLowerCase());
  const programKeys = program
    ? [text(program.id), text(program.course_number), text(program.name || program.title)]
      .map((value) => value.toLowerCase()).filter(Boolean)
    : [];
  if (references.length && program && !references.some((reference) => programKeys.includes(reference))) return null;
  if (references.length && !program && !oxfordUndergraduateRoute) return null;

  const fact = university?.deadlines?.undergraduate;
  if (!fact || typeof fact !== "object") return null;
  const sourceUrl = safeUrl(fact.source_url || fact.sourceUrl);
  const deadline = normalizeDeadline(fact.application_deadline, fact);
  if (!deadline.date || !sourceUrl) return null;
  return { ...deadline, sourceUrl, cycle: text(fact.cycle), sharedRoute: references.length > 0 || oxfordUndergraduateRoute };
}

function qualificationWarning(university, selection, profile) {
  const category = findSelectedCategory(university, selection);
  const program = selectedProgram(university, selection);
  const oxfordUndergraduateRoute = university?.id === "university-of-oxford-uk-oxford"
    && category
    && levelsOf(category).some((level) => levelMatches(level, "Bachelor"));
  if (!program && !oxfordUndergraduateRoute) return null;
  if (program && !levelsOf(program).some((level) => levelMatches(level, "Bachelor"))) return null;
  const result = resolveQualificationGuidance({ profile, university, program });
  if (result.status !== "not_accepted") return null;
  return { sourceUrl: safeUrl(result.programUrl || result.sourceUrl) };
}

function courseDeadlines(category) {
  if (!category) return [];
  const rows = [
    ...(Array.isArray(category.deadlines) ? category.deadlines : []),
    ...(Array.isArray(category.admission_rounds) ? category.admission_rounds : []),
  ];
  const normalized = rows.map((row) => {
    const value = row?.application_deadline || row?.deadline || row?.date || row;
    return normalizeDeadline(value, { ...category, ...((row && typeof row === "object") ? row : {}) });
  }).filter((row) => row.raw);
  if (!normalized.length && category.application_deadline) {
    const selected = cycleDeadline(category.application_deadline, category);
    const direct = normalizeDeadline(selected.value, { ...category, cycle: selected.cycleLabel || category.cycle });
    normalized.push(direct);
  }
  const unique = new Map();
  normalized.forEach((deadline) => {
    const key = [deadline.raw, deadline.cycle, deadline.label, deadline.sourceUrl].join("|");
    if (!unique.has(key)) unique.set(key, deadline);
  });
  return [...unique.values()];
}

function awardStudyLevels(award) {
  const raw = award?.study_levels ?? award?.study_level;
  return (Array.isArray(raw) ? raw : [raw]).flatMap((value) => text(value).split(/\s*\/\s*|\s+or\s+/i)).map(text).filter(Boolean);
}

function assessApplicantScope(award) {
  const scope = text(award.applicant_scope || award.applicantScope || award.target_audience).toLowerCase();
  if (!scope) return "unknown";
  if (/worldwide|all nationalit|any nationalit|all countries|any country|all applicants/.test(scope)) return "eligible";
  return "unknown";
}

function assessProgramScope(award, category, selection) {
  const scope = text(award.program_scope || award.programScope).toLowerCase();
  const route = `${text(selection?.programName)} ${text(selection?.programId)} ${text(category?.label)} ${text(category?.name)} ${text(category?.id)}`.toLowerCase();
  if (!scope || /all programs|all courses|any degree|all eligible programs/.test(scope)) return "eligible";
  const exclusion = scope.match(/(?:excluding|except)\s+(?:the\s+)?([^.;,]+)/i);
  if (exclusion) {
    const excludedTerms = exclusion[1].split(/\s+(?:and|or)\s+/i).map((term) => term.replace(/\b(?:course|courses|program|programmes|programme)\b/g, "").trim()).filter(Boolean);
    if (excludedTerms.some((term) => term && route.includes(term))) return "ineligible";
  }
  const phrases = [text(selection?.programName), text(category?.label), text(category?.name)].map((value) => value.toLowerCase()).filter((value) => value.length >= 6);
  if (phrases.some((phrase) => scope.includes(phrase))) return "eligible";
  if (/first.year/.test(scope) && /first.year/.test(route)) return "eligible";
  if (/medicine/.test(scope) && /medicine/.test(route)) return "eligible";
  if (/all undergraduate courses/.test(scope) && levelsOf(category || {}).some((level) => levelMatches(level, "Bachelor"))) return "eligible";
  return "unknown";
}

function scholarshipCourseDeadline(university, category, selection) {
  const selectedLevel = levelsOf(category || {})[0];
  const awards = Array.isArray(university?.finance?.scholarships_and_funding) ? university.finance.scholarships_and_funding : [];
  for (const award of awards) {
    const awardLevels = awardStudyLevels(award);
    if (selectedLevel && awardLevels.length && !awardLevels.some((level) => levelMatches(level, selectedLevel))) continue;
    if (assessProgramScope(award, category, selection) !== "eligible") continue;
    const selected = cycleDeadline(award.course_application_deadline || award.courseApplicationDeadline, category);
    const deadline = normalizeDeadline(selected.value, {
      ...award,
      cycle: [award.academic_year || award.academicYear, selected.cycleLabel].filter(Boolean).join(" · "),
    });
    if (deadline.date) return deadline;
  }
  return null;
}

function awardTasks(university, category, selection) {
  const awards = Array.isArray(university?.finance?.scholarships_and_funding)
    ? university.finance.scholarships_and_funding
    : [];
  const selectedLevel = levelsOf(category || {})[0] || text(selection?.studyLevel);
  if (!category) {
    return [{
      id: `${university.id}:funding-review`,
      kind: "funding",
      title: t("application_workspace.funding_research", "Check funding eligibility and application steps"),
      detail: t("application_workspace.funding_unknown_detail", "Award eligibility, required documents, and deadline are not confirmed in the available data."),
      sourceUrl: safeUrl(university?.finance?.source_url),
      cycle: "",
      date: null,
      rawDeadline: "",
      timezone: "",
      warning: true,
      awardId: "",
    }];
  }
  const matchingAwards = awards.filter((award) => {
    const awardLevels = awardStudyLevels(award);
    if (selectedLevel && awardLevels.length && !awardLevels.some((level) => levelMatches(level, selectedLevel))) return false;
    if (assessProgramScope(award, category, selection) === "ineligible") return false;
    return true;
  });

  if (!matchingAwards.length) {
    const selectedFundingId = text(selection?.fundingOptionId);
    const selectedFundingIsGrant = /grant|scholarship|fellowship|aid|bursary/i.test(selectedFundingId);
    const sourceUrl = safeUrl(category?.source_url || category?.sourceUrl || university?.finance?.source_url);
    return [{
      id: `${university.id}:funding-review`,
      kind: "funding",
      title: selectedFundingIsGrant ? t("application_workspace.funding_selected", "Review the selected funding option") : t("application_workspace.funding_research", "Check funding eligibility and application steps"),
      detail: t("application_workspace.funding_unknown_detail", "Award eligibility, required documents, and deadline are not confirmed in the available data."),
      sourceUrl,
      cycle: text(category?.cycle),
      date: null,
      rawDeadline: text(category?.financial_aid_deadline),
      timezone: "",
      warning: true,
      awardId: "",
    }];
  }

  return matchingAwards.map((award) => {
    const process = text(award.application_process || award.applicationProcess).toLowerCase();
    const awardCutoff = award.award_application_deadline ?? award.awardApplicationDeadline;
    const baseDeadline = awardCutoff || (process === "automatic" ? award.course_application_deadline : "") || award.deadline;
    const cutoff = cycleDeadline(baseDeadline, category);
    const legacyDeadlines = !cutoff.value && Array.isArray(award.deadlines) ? award.deadlines : [];
    const deadlineOptions = Array.isArray(cutoff.value)
      ? cutoff.value.map((item) => ({ value: item, cycleLabel: text(item?.round) ? `${t("application_workspace.round", "Round")} ${item.round}` : "" }))
      : [{ value: cutoff.value || legacyDeadlines[0] || "", cycleLabel: cutoff.cycleLabel }];
    const normalizedDeadlines = deadlineOptions.map(({ value, cycleLabel }) => {
      const objectValue = value && typeof value === "object" ? (value.date || value.deadline || value.application_deadline || "") : value;
      return {
        deadline: normalizeDeadline(objectValue, {
          ...award,
          ...(value && typeof value === "object" ? value : {}),
          cycle: award.academic_year || award.academicYear || award.cycle,
        }),
        cycleLabel,
      };
    });
    const eligibilityValue = text(award.eligibility || award.description);
    let detail = eligibilityValue ? translateFundingAwardField(award, "eligibility", eligibilityValue) : "";
    if (!detail && text(award.competition)) detail = translateFundingAwardField(award, "competition", award.competition);
    const unknown = Array.isArray(award.unknown_fields) ? award.unknown_fields : (Array.isArray(award.unknownFields) ? award.unknownFields : []);
    const applicantScopeValue = text(award.applicant_scope || award.applicantScope || award.target_audience);
    const applicantScope = applicantScopeValue ? translateFundingAwardField(award, "applicant_scope", applicantScopeValue) : "";
    const applicantMatch = assessApplicantScope(award);
    const programMatch = assessProgramScope(award, category, selection);
    const awardSteps = Array.isArray(award.steps) ? award.steps.map((value, index) => translateFundingAwardField(award, `steps.${index}`, value)).map(text).filter(Boolean) : [];
    const documents = Array.isArray(award.documents) ? award.documents.map((value, index) => translateFundingAwardField(award, `documents.${index}`, value)).map(text).filter(Boolean) : [];
    const coverage = Array.isArray(award.coverage)
      ? award.coverage.map((value, index) => translateFundingAwardField(award, `coverage.${index}`, value)).map(text).filter(Boolean)
      : [text(award.coverage) ? translateFundingAwardField(award, "coverage", award.coverage) : ""].map(text).filter(Boolean);
    return normalizedDeadlines.map(({ deadline, cycleLabel }, deadlineIndex) => {
      const detailLines = [
        detail,
        process ? `${t("application_workspace.application_process", "Application process")}: ${process === "automatic" ? t("application_workspace.process_automatic", "Automatic consideration") : process === "course_application_selection" ? t("application_workspace.process_course_application_selection", "Select the award in the course application") : process === "post_offer" ? t("application_workspace.process_post_offer", "Separate application after an offer") : process === "separate" ? t("application_workspace.process_separate", "Separate application") : t("application_workspace.process_unknown", "Not specified")}` : "",
        applicantScope ? `${t("application_workspace.applicant_scope", "Applicant scope")}: ${applicantScope}` : "",
        text(award.program_scope || award.programScope) ? `${t("application_workspace.program_scope", "Eligible programs")}: ${translateFundingAwardField(award, "program_scope", award.program_scope || award.programScope)}` : "",
        coverage.length ? `${t("application_workspace.coverage", "Coverage")}: ${coverage.join("; ")}` : "",
        text(award.competition) ? `${t("application_workspace.competition", "Competition")}: ${translateFundingAwardField(award, "competition", award.competition)}` : "",
        text(award.renewal) ? `${t("application_workspace.renewal", "Renewal")}: ${translateFundingAwardField(award, "renewal", award.renewal)}` : "",
        awardSteps.length ? `${t("application_workspace.steps", "Steps")}: ${awardSteps.join("; ")}` : "",
        documents.length ? `${t("application_workspace.documents", "Documents")}: ${documents.join("; ")}` : "",
      ].filter(Boolean);
      return {
      id: `${university.id}:award:${text(award.id || award.name) || "funding"}${normalizedDeadlines.length > 1 ? `:round-${deadlineIndex + 1}` : ""}`,
      kind: "funding",
      awardId: text(award.id),
      title: `${applicantMatch === "unknown" || programMatch === "unknown" ? t("application_workspace.check_award_eligibility", "Check eligibility and next steps") : process === "automatic" ? t("application_workspace.review_automatic_award", "Check automatic award consideration") : process === "post_offer" ? t("application_workspace.post_offer_award", "Submit post-offer award application") : t("application_workspace.separate_award", "Apply for funding award")}: ${text(award.name) ? translateFundingAwardField(award, "name", award.name) : t("application_workspace.award_fallback", "Funding award")}${cycleLabel ? ` · ${cycleLabel}` : ""}`,
      detail: detailLines.join("\n"),
      detailLines,
      sourceUrl: safeUrl(award.source_url || award.sourceUrl),
      cycle: [deadline.cycle || text(award.academic_year || award.academicYear), cycleLabel].filter(Boolean).join(" · "),
      date: deadline.date,
      rawDeadline: deadline.raw,
      timezone: deadline.timezone,
      time: deadline.time,
      warning: !deadline.date || deadline.approximate || unknown.length > 0 || applicantMatch === "unknown" || programMatch === "unknown",
      calendarEligible: Boolean(deadline.date && !deadline.approximate && safeUrl(award.source_url || award.sourceUrl)),
      process,
      };
    });
  }).flat();
}

export function buildApplicationTasks(university, selection = {}, _applicantContext = {}) {
  const category = findSelectedCategory(university, selection);
  const track = selectedTrackLabel(category, selection);
  const deadlines = courseDeadlines(category);
  const exactCategoryDeadlines = deadlines.filter((deadline) => deadline.date);
  const routeDeadline = sharedUndergraduateDeadline(university, category, selection);
  const fallbackDeadline = deadlines.length > 1 || exactCategoryDeadlines.length
    ? null
    : routeDeadline || scholarshipCourseDeadline(university, category, selection) || deadlines[0] || normalizeDeadline("", category || {});
  const selectedDeadlines = deadlines.length > 1
    ? deadlines
    : exactCategoryDeadlines.length ? exactCategoryDeadlines : [fallbackDeadline];
  const courseTasks = selectedDeadlines.map((deadline, index) => {
    const roundLabel = deadline.label || (selectedDeadlines.length > 1 ? `${t("application_workspace.round", "Round")} ${index + 1}` : "");
    const courseSource = safeUrl(category?.source_url || category?.sourceUrl || deadline.sourceUrl);
    return {
      id: `${university.id}:course-application${selectedDeadlines.length > 1 ? `:round-${index + 1}` : ""}`,
      kind: "application",
      title: `${t("application_workspace.course_application", "Submit the course application")}${roundLabel ? ` · ${roundLabel}` : ""}`,
      detail: [
        track || t("application_workspace.track_not_selected", "No admission track is selected; confirm the route on the university page."),
        deadline.sharedRoute ? t("application_workspace.deadline_scope_shared_route", "This is the published deadline for the selected shared undergraduate route; check the official page for course-specific requirements.") : "",
      ].filter(Boolean).join("\n"),
      detailLines: [
        track || t("application_workspace.track_not_selected", "No admission track is selected; confirm the route on the university page."),
        deadline.sharedRoute ? t("application_workspace.deadline_scope_shared_route", "This is the published deadline for the selected shared undergraduate route; check the official page for course-specific requirements.") : "",
      ].filter(Boolean),
      sourceUrl: courseSource,
      actionHref: category ? "" : routeUniversityDetail(university.id),
      cycle: deadline.cycle || text(category?.cycle),
      date: deadline.date,
      rawDeadline: deadline.raw,
      timezone: deadline.timezone,
      time: deadline.time,
      warning: !deadline.date || !deadline.timezone || !courseSource,
      calendarEligible: Boolean(deadline.date && courseSource && !deadline.approximate),
    };
  });
  const aids = awardTasks(university, category, selection);
  const separateAidDeadline = text(category?.financial_aid_deadline);
  if (separateAidDeadline) {
    const aidDeadline = normalizeDeadline(separateAidDeadline, category);
    const exactAwardDeadline = aids.find((task) => task.date);
    const resolvedAidDeadline = aidDeadline.date ? aidDeadline : exactAwardDeadline || aidDeadline;
    aids.unshift({
      id: `${university.id}:financial-aid-documents`,
      kind: "funding",
      title: t("application_workspace.financial_aid_application", "Submit financial aid materials"),
      detail: t("application_workspace.financial_aid_docs_detail", "The university lists a separate aid deadline. Confirm required documents and applicant eligibility."),
      sourceUrl: safeUrl(exactAwardDeadline?.sourceUrl || category?.source_url || category?.sourceUrl),
      cycle: resolvedAidDeadline.cycle || aidDeadline.cycle,
      date: resolvedAidDeadline.date,
      rawDeadline: aidDeadline.date ? aidDeadline.raw : (resolvedAidDeadline.rawDeadline || aidDeadline.raw),
      timezone: resolvedAidDeadline.timezone,
      time: resolvedAidDeadline.time,
      warning: !resolvedAidDeadline.date || !resolvedAidDeadline.timezone,
      calendarEligible: Boolean(resolvedAidDeadline.date && safeUrl(category?.source_url || category?.sourceUrl)),
      awardId: "financial-aid-documents",
    });
  }
  const tasks = [...courseTasks, ...aids];
  const qualification = qualificationWarning(university, selection, _applicantContext);
  if (qualification) {
    tasks.forEach((task) => {
      task.qualificationWarning = true;
      task.qualificationSourceUrl = qualification.sourceUrl;
    });
  }
  return tasks;
}

export function createApplicationTaskIcs(task) {
  if (!task?.date || !task?.sourceUrl || task?.calendarEligible === false || (!Object.hasOwn(task, "calendarEligible") && task?.warning)) return null;
  const time = text(task.time).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const zoneText = text(task.timezone).toLowerCase();
  const timeZone = zoneText.includes("eastern") ? "America/New_York"
    : zoneText.includes("pacific") ? "America/Los_Angeles"
      : zoneText.includes("uk") || zoneText.includes("british") ? "Europe/London"
        : (/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(text(task.timezone)) ? text(task.timezone) : "");
  if (time && timeZone) {
    const [, hourRaw, minuteRaw, secondRaw = "00"] = time;
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    const second = Number(secondRaw);
    if (hour > 23 || minute > 59 || second > 59) return null;
    const [year, month, day] = task.date.split("-").map(Number);
    const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    let utcMillis = wallClockUtc;
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(utcMillis)).map(({ type, value }) => [type, value]));
      const asWallUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      utcMillis += wallClockUtc - asWallUtc;
    }
    const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const start = new Date(utcMillis);
    const end = new Date(utcMillis + 15 * 60 * 1000);
    const dateCompact = task.date.replaceAll("-", "");
    const nextDate = new Date(`${task.date}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const allDay = createDeadlineIcs({
      title: task.title,
      deadline: task.date,
      cycle: task.cycle,
      scope: `${task.detail || ""}${task.rawDeadline ? `\nOriginal cutoff: ${task.rawDeadline}` : ""}${task.timezone ? `\nCutoff time zone: ${task.timezone}` : ""}`,
      sourceUrl: task.sourceUrl,
      approximate: task.approximate,
    });
    if (!allDay) return null;
    return allDay
      .replace(`DTSTART;VALUE=DATE:${dateCompact}`, `DTSTART:${stamp(start)}`)
      .replace(`DTEND;VALUE=DATE:${nextDate.toISOString().slice(0, 10).replaceAll("-", "")}`, `DTEND:${stamp(end)}`);
  }
  return createDeadlineIcs({
    title: task.title,
    deadline: task.date,
    cycle: task.cycle,
    scope: task.detail,
    sourceUrl: task.sourceUrl,
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function taskDeadline(task) {
  if (!task.rawDeadline) return t("application_workspace.deadline_unknown", "Deadline not confirmed");
  if (!task.date) return `${t("application_workspace.verify_deadline", "Verify on official page")}: ${task.rawDeadline}`;
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${task.date}T00:00:00Z`));
  return `${date}${task.time ? ` · ${task.time}` : ""}${task.timezone ? ` · ${task.timezone}` : ` · ${t("application_workspace.timezone_unknown", "time zone not stated")}`}`;
}

function renderTask(task, state) {
  const done = state[task.id] === true;
  const ics = createApplicationTaskIcs(task);
  return `<li class="application-workspace__task${done ? " is-done" : ""}" data-task-id="${escapeHtml(task.id)}">
    <label class="application-workspace__check"><input type="checkbox" data-task-toggle="${escapeHtml(task.id)}" ${done ? "checked" : ""}><span>${escapeHtml(task.title)}</span></label>
    ${task.detailLines?.length ? `<ul class="application-workspace__detail-list">${task.detailLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : task.detail ? `<p class="application-workspace__detail">${escapeHtml(task.detail).replaceAll("\n", "<br>")}</p>` : ""}
    ${task.qualificationWarning ? `<p class="application-workspace__qualification-warning">${escapeHtml(t("application_workspace.qualification_not_accepted", "The selected qualification is listed as not accepted for this route. Review accepted alternatives and the official program requirements before treating this plan as applicable."))}${task.qualificationSourceUrl ? ` <a href="${escapeHtml(task.qualificationSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("application_workspace.qualification_source", "Official program requirements"))}</a>` : ""}</p>` : ""}
    <p class="application-workspace__meta">${task.cycle ? `${escapeHtml(t("application_workspace.cycle", "Cycle"))}: ${escapeHtml(task.cycle)} · ` : ""}${escapeHtml(taskDeadline(task))}</p>
    ${task.warning ? `<p class="application-workspace__warning">${escapeHtml(t("application_workspace.verify_warning", "Confirm eligibility, exact cutoff, and time zone with the official source."))}</p>` : ""}
    <div class="application-workspace__links">${task.sourceUrl ? `<a href="${escapeHtml(task.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("application_workspace.official_source", "Official source"))}</a>` : task.actionHref ? `<a href="${escapeHtml(task.actionHref)}">${escapeHtml(t("application_workspace.select_track", "Open university and select an admission track"))}</a>` : `<span>${escapeHtml(t("application_workspace.source_unknown", "Official source not recorded"))}</span>`}${ics ? `<button type="button" data-export-task="${escapeHtml(task.id)}">${escapeHtml(t("application_workspace.add_calendar", "Add to calendar (.ics)"))}</button>` : ""}</div>
  </li>`;
}

function renderPostOfferTask(task, state) {
  const done = state[task.id] === true;
  return `<li class="application-workspace__task application-workspace__postoffer-task${done ? " is-done" : ""}" data-task-id="${escapeHtml(task.id)}">
    <label class="application-workspace__check"><input type="checkbox" data-task-toggle="${escapeHtml(task.id)}" ${done ? "checked" : ""}><span>${escapeHtml(t(task.titleKey, task.titleFallback))}</span></label>
    <p class="application-workspace__detail">${escapeHtml(t(task.detailKey, task.detailFallback))}</p>
    <p class="application-workspace__meta">${escapeHtml(t("application_workspace.post_offer_no_deadline", "No deadline is set here; follow the current official instructions."))}</p>
    <div class="application-workspace__links">${task.sourceUrl ? `<a href="${escapeHtml(task.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t(task.sourceLabelKey, task.sourceLabelFallback))}</a>` : `<span>${escapeHtml(t("application_workspace.post_offer_source_unknown", "Official fee source not recorded; confirm directly with the university."))}</span>`}</div>
  </li>`;
}

function renderPostOfferSection(university, checklist, postOfferState) {
  const tasks = buildPostOfferTasks(university);
  if (!tasks.length) return "";
  const accepted = postOfferState[university.id] === true;
  return `<section class="application-workspace__postoffer" aria-labelledby="postoffer-${escapeHtml(university.id)}">
    <h4 id="postoffer-${escapeHtml(university.id)}">${escapeHtml(t("application_workspace.post_offer_heading", "After an offer is accepted"))}</h4>
    <label class="application-workspace__check application-workspace__postoffer-gate"><input type="checkbox" data-postoffer-gate="${escapeHtml(university.id)}" ${accepted ? "checked" : ""}><span>${escapeHtml(t("application_workspace.post_offer_gate", "I have received and accepted an offer"))}</span></label>
    <p class="application-workspace__meta" data-postoffer-locked ${accepted ? "hidden" : ""}>${escapeHtml(t("application_workspace.post_offer_locked", "Start these steps only after accepting an offer. This status is self-reported and is not verified by the university."))}</p>
    <ol class="application-workspace__postoffer-list" data-postoffer-tasks ${accepted ? "" : "hidden"}>${tasks.map((task) => renderPostOfferTask(task, checklist)).join("")}</ol>
  </section>`;
}

function downloadIcs(task) {
  const content = createApplicationTaskIcs(task);
  if (!content) return;
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `unisearch-application-${task.date}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function initApplicationWorkspace({ button = document.querySelector("[data-open-application-workspace]"), host = document.getElementById("applicationWorkspace") } = {}) {
  if (!button || !host || button.dataset.workspaceBound === "true") return;
  button.dataset.workspaceBound = "true";
  let taskIndex = new Map();
  const render = async () => {
    const savedIds = readIdListStorage(SAVED_UNIVERSITIES_KEY).slice(0, MAX_WORKSPACE_UNIVERSITIES);
    if (!savedIds.length) {
      host.innerHTML = `<div class="application-workspace__head"><div><h2 id="applicationWorkspaceTitle">${escapeHtml(t("application_workspace.title", "Application plan"))}</h2></div><button type="button" data-close-application-workspace>${escapeHtml(t("application_workspace.close", "Close"))}</button></div><p class="application-workspace__empty">${escapeHtml(t("application_workspace.empty_saved", "Save universities to build an application plan."))}</p>`;
      return;
    }
    host.setAttribute("aria-busy", "true");
    const universities = await Promise.all(savedIds.map(async (id) => {
      try { return await fetchUniversityDetailCached(id); } catch { return { id, name: id, _loadError: true }; }
    }));
    const profile = loadProfile() || {};
    const selections = profile.selectedAdmissionChoices || {};
    const checklist = readChecklist();
    const postOfferState = readPostOfferState();
    taskIndex = new Map();
    const sections = universities.map((university) => {
      const tasks = university._loadError ? [] : buildApplicationTasks(university, selections[university.id] || {}, profile);
      tasks.forEach((task) => taskIndex.set(task.id, task));
      const name = text(university.name || university.short_name || university.id);
      return `<section class="application-workspace__university"><h3>${escapeHtml(name)}</h3>${university._loadError ? `<p>${escapeHtml(t("application_workspace.load_error", "University details could not be loaded. Open the university page and retry."))}</p>` : `<ol>${tasks.map((task) => renderTask(task, checklist)).join("")}</ol>${renderPostOfferSection(university, checklist, postOfferState)}`}</section>`;
    }).join("");
    host.innerHTML = `<div class="application-workspace__head"><div><h2 id="applicationWorkspaceTitle">${escapeHtml(t("application_workspace.title", "Application plan"))}</h2><p>${escapeHtml(t("application_workspace.intro", "Track course applications and funding awards for your saved universities."))}</p></div><button type="button" data-close-application-workspace>${escapeHtml(t("application_workspace.close", "Close"))}</button></div><div class="application-workspace__list">${sections}</div>`;
    host.removeAttribute("aria-busy");
  };
  button.addEventListener("click", async () => {
    host.hidden = false;
    await render();
    host.querySelector("[data-close-application-workspace]")?.focus();
  });
  host.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-application-workspace]")) host.hidden = true;
    const exportButton = event.target.closest("[data-export-task]");
    if (exportButton) downloadIcs(taskIndex.get(exportButton.getAttribute("data-export-task")));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !host.hidden) {
      host.hidden = true;
      button.focus();
    }
  });
  host.addEventListener("change", (event) => {
    const offerGate = event.target.closest("[data-postoffer-gate]");
    if (offerGate) {
      const postOfferState = readPostOfferState();
      const universityId = offerGate.getAttribute("data-postoffer-gate");
      if (offerGate.checked) postOfferState[universityId] = true;
      else delete postOfferState[universityId];
      writePostOfferState(postOfferState);
      const section = offerGate.closest(".application-workspace__postoffer");
      section?.querySelector("[data-postoffer-locked]")?.toggleAttribute("hidden", offerGate.checked);
      section?.querySelector("[data-postoffer-tasks]")?.toggleAttribute("hidden", !offerGate.checked);
      return;
    }
    const input = event.target.closest("[data-task-toggle]");
    if (!input) return;
    const checklist = readChecklist();
    if (input.checked) checklist[input.getAttribute("data-task-toggle")] = true;
    else delete checklist[input.getAttribute("data-task-toggle")];
    writeChecklist(checklist);
    input.closest(".application-workspace__task")?.classList.toggle("is-done", input.checked);
  });
}
