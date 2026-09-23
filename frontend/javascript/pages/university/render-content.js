import { escapeHtml, escapeHtmlAttr, markMotionEnter, motionPress } from "../../utils.js";
import { t } from "../../i18n.js";
import { applyPercentWidths } from "../../university-detail-helpers.js";
import { translateWord } from "../../university-translations.js";
import { bindInfoTooltips } from "../../tooltip.js";
import { loadProfile } from "../../utils/persistence.js";
import {
  admissionsDataTypeKey,
  admissionsDataTypeLabel,
  admissionsFactChips,
  formatCampusSizeValue,
  formatUiNumber,
  localizeDuration,
  renderAdmissionsChipRow,
  renderAdmissionsSourceLink,
  admissionsSignalSummary,
  renderInlineIcon,
  rankingStatusLabel,
  trProgramLanguage,
  trProgramName,
  trStudyLevel,
  trStudyMode,
  trTag,
  trUniversityDescription,
  unknownFieldText,
  unknownLabelText,
  safeUrl,
  toFiniteNumber,
} from "../_shared.js";

export function renderOverviewSection({
  acceptanceMeta,
  acceptanceRate,
  container,
  officialRank,
  rankStatus,
  university,
}) {
  if (!container) return;

  const acceptanceDisplay = acceptanceRate === null
    ? t("common.no_data", "No data")
    : `${Math.round(acceptanceRate * 100) / 100}%`;
  const acceptanceSourceUrl = safeUrl(acceptanceMeta?.source_url);
  const acceptanceSourceLabel = String(acceptanceMeta?.source || "").trim() || t("university.admissions.official_source", "Official source");
  const acceptanceChecked = String(acceptanceMeta?.verified_at || "").trim();
  const acceptanceBasis = acceptanceMeta?.basis && typeof acceptanceMeta.basis === "object" ? acceptanceMeta.basis : {};
  const acceptanceCycle = String(acceptanceBasis?.cycle || "").trim();
  const acceptanceApplicants = toFiniteNumber(acceptanceBasis?.applicants);
  const acceptanceAdmitted = toFiniteNumber(acceptanceBasis?.admitted);
  const acceptanceInfoTitle = escapeHtml(t("university.admissions.official_source", "Official source"));
  const acceptanceTooltip = acceptanceSourceUrl ? `
    <span class="d-info-wrap">
      <button type="button" class="d-info" aria-label="${acceptanceInfoTitle}" title="${acceptanceInfoTitle}">${renderInlineIcon("information-circle", 14, "d-info-icon")}</button>
      <span class="d-tooltip" role="tooltip">
        <strong>${acceptanceInfoTitle}</strong>
        <span>${escapeHtml(acceptanceSourceLabel)}</span>
        ${acceptanceChecked ? `<span>${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(acceptanceChecked)}</span>` : ""}
        ${acceptanceCycle ? `<span>${escapeHtml(t("university.admissions.cycle", "Cycle"))}: ${escapeHtml(acceptanceCycle)}</span>` : ""}
        ${acceptanceApplicants !== null ? `<span>${escapeHtml(t("university.admissions.counts.applicants", "Applicants"))}: ${escapeHtml(formatUiNumber(acceptanceApplicants))}</span>` : ""}
        ${acceptanceAdmitted !== null ? `<span>${escapeHtml(t("university.admissions.counts.admitted", "Admitted"))}: ${escapeHtml(formatUiNumber(acceptanceAdmitted))}</span>` : ""}
        <span><a href="${escapeHtmlAttr(acceptanceSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.open_source", "Open source"))}</a></span>
      </span>
    </span>
  ` : "";
  const acceptanceRow = `
    <div class="d-kv">
      <span class="d-kv-label">
        ${escapeHtml(t("ranking.acceptance", "Acceptance Rate"))}
        ${acceptanceTooltip}
      </span>
      <span>${escapeHtml(acceptanceDisplay)}</span>
    </div>
  `;

  const rankMeta = university && typeof university.rank_meta === "object" ? university.rank_meta : {};
  const rankSource = String(rankMeta.source || "").trim();
  const rankVerifiedAt = String(rankMeta.verified_at || "").trim();
  const rankInfoTitle = escapeHtml(translateWord("global_rank", "Global Rank"));
  const rankTooltip = rankSource ? `
    <span class="d-info-wrap">
      <button type="button" class="d-info" aria-label="${rankInfoTitle}" title="${rankInfoTitle}">${renderInlineIcon("information-circle", 14, "d-info-icon")}</button>
      <span class="d-tooltip" role="tooltip">
        <strong>${rankInfoTitle}</strong>
        <span>${escapeHtml(rankSource)}</span>
        ${rankStatus ? `<span>${escapeHtml(rankingStatusLabel(rankStatus))}</span>` : ""}
        ${rankVerifiedAt ? `<span>${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(rankVerifiedAt)}</span>` : ""}
      </span>
    </span>
  ` : "";

  let rankHtml = `<span>${escapeHtml(unknownFieldText("placeholder.field.global_rank", "Global Rank"))}</span>`;
  if (officialRank) {
    rankHtml = `<span class="d-rank-emphasis">#${university.rank}</span>`;
  } else if (rankStatus) {
    rankHtml = `<span>${escapeHtml(rankingStatusLabel(rankStatus))}</span>`;
  }

  const campusSizeRaw = typeof university.student_life?.size === "string" ? String(university.student_life.size).trim() : "";
  const campusSize = campusSizeRaw
    ? escapeHtml(formatCampusSizeValue(campusSizeRaw))
    : escapeHtml(unknownFieldText("campus_size", "Campus Size"));
  const campusSizeLabel = escapeHtml(translateWord("campus_size", "Campus Size"));
  const campusSizeInfoTitle = escapeHtml(translateWord("campus_size_info_title", "How campus size works"));
  const campusSizeInfoSmall = escapeHtml(translateWord("campus_size_info_small", "Small: up to 500,000 m2 (up to 50 ha)"));
  const campusSizeInfoMedium = escapeHtml(translateWord("campus_size_info_medium", "Medium: 500,000-2,000,000 m2 (50-200 ha)"));
  const campusSizeInfoLarge = escapeHtml(translateWord("campus_size_info_large", "Large: above 2,000,000 m2 (200+ ha)"));
  const campusSizeInfoNote = escapeHtml(translateWord("campus_size_info_note", "Approximate ranges used for quick comparison."));

  container.innerHTML = `
    <div class="d-kv">
      <span class="d-kv-label">
        ${escapeHtml(translateWord("global_rank", "Global Rank"))}
        ${rankTooltip}
      </span>
      ${rankHtml}
    </div>
    ${acceptanceRow}
    <div class="d-kv d-kv--last">
      <span class="d-kv-label">
        ${campusSizeLabel}
        <span class="d-info-wrap">
          <button type="button" class="d-info" aria-label="${campusSizeInfoTitle}" title="${campusSizeInfoTitle}">${renderInlineIcon("information-circle", 14, "d-info-icon")}</button>
          <span class="d-tooltip" role="tooltip">
            <strong>${campusSizeInfoTitle}</strong>
            <span>${campusSizeInfoSmall}</span>
            <span>${campusSizeInfoMedium}</span>
            <span>${campusSizeInfoLarge}</span>
            <span>${campusSizeInfoNote}</span>
          </span>
        </span>
      </span>
      <span>${campusSize}</span>
    </div>
  `;
  bindInfoTooltips({ wrapSelector: ".d-info-wrap", buttonSelector: ".d-info" });
}

export function renderExtraSection({ container, university }) {
  if (!container) return;

  const translatedDescription = trUniversityDescription(university);
  const description = translatedDescription
    ? `<p class="uni-description">${escapeHtml(String(translatedDescription)).replace(/\n/g, "<br>")}</p>`
    : `<p class="uni-description uni-description--placeholder">${escapeHtml(unknownFieldText("placeholder.field.description", "Description"))}</p>`;
  const tags = Array.isArray(university.tags)
    ? university.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
    : (typeof university.tags === "string" ? university.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : []);
  const tagsHtml = tags.length
    ? `
      <div class="uni-tags-wrap">
        <div class="uni-tags-title">${escapeHtml(translateWord("focus_tags", "Focus Tags"))}</div>
        <div class="uni-tags-list">
          ${tags.map((tag) => `<span class="uni-tag">${escapeHtml(trTag(tag))}</span>`).join("")}
        </div>
      </div>
    `
    : `
      <div class="uni-tags-wrap">
        <div class="uni-tags-title">${escapeHtml(translateWord("focus_tags", "Focus Tags"))}</div>
        <div class="uni-tags-list">
          <span class="uni-tag uni-tag--placeholder">${escapeHtml(unknownFieldText("focus_tags", "Focus Tags"))}</span>
        </div>
      </div>
    `;
  const studentCountValue = toFiniteNumber(university?.student_count);
  const studentCount = studentCountValue !== null
    ? new Intl.NumberFormat("en-US").format(studentCountValue)
    : unknownFieldText("total_students", "Total Students");
  const formats = Array.isArray(university.academics?.formats)
    ? university.academics.formats.map((value) => escapeHtml(trStudyMode(String(value)))).filter(Boolean).join(", ")
    : "";

  container.innerHTML = `
    ${description}
    ${tagsHtml}
    <div class="d-kv"><span>${escapeHtml(translateWord("total_students", "Total Students"))}</span><span>${escapeHtml(studentCount)}</span></div>
    <div class="d-kv d-kv--last"><span>${escapeHtml(translateWord("study_formats", "Study Formats"))}</span><span>${formats || escapeHtml(unknownFieldText("study_formats", "Study Formats"))}</span></div>
  `;
}

const COVERAGE_LEVELS = ["bachelor", "master", "doctorate", "professional", "mba"];

function coverageState(value) {
  if (value === "available") {
    return {
      label: t("university.coverage.available", "Catalogued"),
      className: "is-available",
    };
  }
  if (value === "not_catalogued") {
    return {
      label: t("university.coverage.not_catalogued", "Not catalogued"),
      className: "is-not-catalogued",
    };
  }
  return {
    label: t("university.coverage.unknown", "Coverage unavailable"),
    className: "is-unknown",
  };
}

function coverageRow(labelKey, fallback, value) {
  const state = coverageState(value);
  return `<li class="university-coverage__row">
    <span>${escapeHtml(t(labelKey, fallback))}</span>
    <span class="university-coverage__state ${state.className}">${escapeHtml(state.label)}</span>
  </li>`;
}

export function renderCoverageSection({ container, coverageByLevel }) {
  if (!container) return;
  const coverage = coverageByLevel && typeof coverageByLevel === "object" ? coverageByLevel : {};
  const levels = COVERAGE_LEVELS.filter((level) => coverage[level] && typeof coverage[level] === "object");

  if (!levels.length) {
    container.innerHTML = `<p class="university-coverage__empty">${escapeHtml(t(
      "university.coverage.no_levels",
      "UniSearch has no study-level coverage recorded for this university yet. This does not indicate which programs the university offers.",
    ))}</p>`;
    return;
  }

  container.innerHTML = `<div class="university-coverage">
    ${levels.map((level) => {
      const row = coverage[level];
      const deadlines = row.deadlines && typeof row.deadlines === "object" ? row.deadlines : {};
      const costs = row.costs && typeof row.costs === "object" ? row.costs : {};
      const levelLabel = t(`university.coverage.level.${level}`, {
        bachelor: "Bachelor's",
        master: "Master's",
        doctorate: "Doctorate",
        professional: "Professional",
        mba: "MBA",
      }[level]);
      return `<section class="university-coverage__level" aria-label="${escapeHtml(levelLabel)}">
        <h4>${escapeHtml(levelLabel)}</h4>
        <ul class="university-coverage__list">
          ${coverageRow("university.coverage.programs", "Programs", row.programs)}
          ${coverageRow("university.coverage.requirements", "Admission requirements", row.admissions_requirements)}
          ${coverageRow("university.coverage.deadlines_exact", "Deadlines with exact date and year", deadlines.exact_dated)}
          ${coverageRow("university.coverage.deadlines_approximate", "Approximate or yearless deadlines", deadlines.approximate_or_yearless)}
          ${coverageRow("university.coverage.costs_program", "Program-specific costs", costs.program_specific)}
          ${level === "bachelor" ? coverageRow("university.coverage.costs_undergraduate", "University-wide undergraduate cost data", costs.undergraduate_root_finance) : ""}
          ${coverageRow("university.coverage.aid", "Aid and funding", row.aid_funding)}
        </ul>
      </section>`;
    }).join("")}
  </div>`;
}

const programSearchQueryByUniversity = new Map();
const programOpenKeyByUniversity = new Map();
const programStudyLevelSelectionByUniversity = new Map();

function normalizeProgramLevelKey(rawLevel) {
  const norm = String(rawLevel || "").trim().toLowerCase();
  if (norm.includes("bachelor") || norm.includes("undergrad") || norm.includes("integrated master") || norm.includes("бакалавр")) return "bachelor";
  if (/(^|[^a-z])m\.?b\.?a\.?($|[^a-z])/.test(norm) || norm.includes("master of business administration")) return "mba";
  if (norm.includes("professional") || norm.includes("professional degree") || norm.includes("профессиональн")) return "professional";
  if (norm.includes("master") || norm.includes("msc") || norm.includes("mres") || norm.includes("meng") || norm.includes("mfin") || norm.includes("mban") || norm.includes("mst") || norm.includes("bcl") || norm.includes("llm") || norm.includes("магистр")) return "master";
  if (norm.includes("phd") || norm.includes("doctor") || norm.includes("dphil") || norm.includes("доктор") || norm.includes("аспирант")) return "doctorate";
  return norm || "general";
}

export function getProgramLevelKeys(program) {
  const levels = getProgramLevelsList(program);
  if (!levels.length) return [];
  const name = String(program?.name || "").toLowerCase();
  const isMbaProgram = /(^|[^a-z])m\.?b\.?a\.?($|[^a-z])/.test(name) || name.includes("master of business administration");
  const keys = levels.map(normalizeProgramLevelKey);
  if (isMbaProgram) {
    return [...new Set(keys.map((key) => key === "master" || key === "professional" ? "mba" : key))];
  }
  return [...new Set(keys)];
}

const PROGRAM_COVERAGE_SCOPE_KEYS = {
  program_specific: "university.program_coverage.scope.program_specific",
  shared_admission_route: "university.program_coverage.scope.shared_route",
  institution_wide_route: "university.program_coverage.scope.institution_route",
  university_guidance: "university.program_coverage.scope.university_guidance",
  award_program_scope: "university.program_coverage.scope.award_scope",
  not_catalogued: "university.program_coverage.scope.not_catalogued",
};

function normalizedProgramCoverageText(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function programCoverageSourceUrl(value) {
  const sourceUrl = safeUrl(value);
  return /^https:\/\//i.test(sourceUrl) ? sourceUrl : "";
}

export function resolveProgramCoverage({ coverageByProgram = [], program = null } = {}) {
  if (!program || typeof program !== "object") return null;
  const rows = Array.isArray(coverageByProgram) ? coverageByProgram : [];
  const programId = String(program.id || program.program_id || program.course_number || "").trim();
  const programName = normalizedProgramCoverageText(program.name || program.program_name);
  return rows.find((row) => {
    if (!row || typeof row !== "object") return false;
    const rowId = String(row.program_id || "").trim();
    if (programId && rowId && rowId === programId) return true;
    return Boolean(programName && normalizedProgramCoverageText(row.program_name) === programName);
  }) || null;
}

function programCoverageScopeLabel(scope) {
  const value = String(scope || "not_catalogued").trim();
  const key = PROGRAM_COVERAGE_SCOPE_KEYS[value];
  const fallback = {
    program_specific: "Specific to this program",
    shared_admission_route: "Shared admission route",
    institution_wide_route: "University-wide admission route",
    university_guidance: "University-level guidance; not a program price",
    award_program_scope: "Award record; confirm program and applicant eligibility",
    not_catalogued: "No data catalogued",
  }[value] || "No data catalogued";
  return t(key || "university.program_coverage.scope.not_catalogued", fallback);
}

function programCoverageFactStatus(fact, kind) {
  const status = String(fact?.status || "not_catalogued").trim();
  if (status === "not_catalogued") return t("university.program_coverage.not_catalogued", "Not catalogued");
  if (kind === "deadline" && status === "exact_dated") return t("university.program_coverage.deadline_exact", "Published dated course deadline");
  if (kind === "deadline" && status === "approximate_or_yearless") return t("university.program_coverage.deadline_approximate", "Published wording; exact date or year is missing");
  return t("university.program_coverage.catalogued", "Catalogued");
}

function programCoverageValueStrings(value, inheritedCurrency = "") {
  const output = [];
  const visit = (item, currency = inheritedCurrency) => {
    if (typeof item === "string" || typeof item === "number") {
      const rendered = String(item).trim();
      if (rendered) output.push(rendered);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child) => visit(child, currency));
      return;
    }
    if (!item || typeof item !== "object") return;
    const itemCurrency = String(item.currency || currency || "").trim();
    const date = item.date || item.deadline || item.application_deadline;
    if (date) {
      const parts = [String(date)];
      if (item.time) parts.push(String(item.time));
      if (item.round) parts.push(`${t("university.program_coverage.round", "Round")} ${item.round}`);
      output.push(parts.join(" · "));
      return;
    }
    Object.entries(item).forEach(([key, child]) => {
      if (key === "currency" || key === "verified_at" || key === "source_url") return;
      if (typeof child === "number" && Number.isFinite(child) && child > 0) {
        const amountCurrency = key.match(/(?:^|_)(usd|gbp|eur|cad|aud)$/i)?.[1]?.toUpperCase() || itemCurrency;
        const amount = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(child);
        const field = t(`university.program_coverage.value.${key}`, key.replaceAll("_", " "));
        output.push(`${field}: ${amountCurrency ? `${amountCurrency} ` : ""}${amount}`);
      } else if (child && typeof child === "object") visit(child, itemCurrency);
      else if (typeof child === "string" && child.trim()) output.push(child.trim());
    });
  };
  visit(value);
  return [...new Set(output)];
}

function renderProgramCoverageFact(labelKey, labelFallback, fact, kind) {
  const row = fact && typeof fact === "object" ? fact : {};
  const status = programCoverageFactStatus(row, kind);
  const scope = programCoverageScopeLabel(row.scope);
  const guidanceCost = kind === "cost" && row.scope === "university_guidance";
  const scopedGuidanceValues = guidanceCost && row.values && typeof row.values === "object"
    ? { undergraduate_home_expected_tuition_gbp: row.values.undergraduate_home_expected_tuition_gbp }
    : {};
  const values = programCoverageValueStrings(guidanceCost ? scopedGuidanceValues : row.values);
  const sourceUrl = programCoverageSourceUrl(row.source_url);
  const cycle = String(row.cycle || "").trim();
  const verifiedAt = String(row.verified_at || "").trim();
  const nextAction = row.status === "not_catalogued"
    ? t(`university.program_coverage.next_action.${kind}`, "Check the official course page for this entry cycle.")
    : "";
  return `<div class="program-coverage__fact" data-coverage-kind="${escapeHtmlAttr(kind)}">
    <div class="program-coverage__fact-heading"><strong>${escapeHtml(t(labelKey, labelFallback))}</strong><span class="program-coverage__status">${escapeHtml(status)}</span></div>
    <p class="program-coverage__scope">${escapeHtml(scope)}</p>
    ${nextAction ? `<p class="program-coverage__meta">${escapeHtml(nextAction)}</p>` : ""}
    ${values.length ? `<p class="program-coverage__values">${escapeHtml(values.join("; "))}</p>` : ""}
    <p class="program-coverage__meta"><strong>${escapeHtml(t("university.program_coverage.cycle", "Cycle"))}:</strong> ${escapeHtml(cycle || t("university.program_coverage.cycle_unknown", "Unknown"))}</p>
    ${verifiedAt ? `<p class="program-coverage__meta"><strong>${escapeHtml(t("university.program_coverage.verified", "Verified"))}:</strong> ${escapeHtml(verifiedAt)}</p>` : ""}
    ${sourceUrl ? `<a class="program-coverage__source" href="${escapeHtmlAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.program_coverage.source", "Official source"))}</a>` : `<p class="program-coverage__meta">${escapeHtml(t("university.program_coverage.source_unknown", "Official source not catalogued"))}</p>`}
  </div>`;
}

function isIntegratedUndergraduateProgram(program) {
  const levels = getProgramLevelsList(program).map((level) => normalizedProgramCoverageText(level));
  const hasBachelor = levels.some((level) => /\b(?:bachelor|undergraduate|undergrad)\b/.test(level));
  const hasIntegratedMaster = levels.some((level) => /\bintegrated master\b/.test(level));
  const hasStandaloneGraduate = levels.some((level) =>
    /\b(?:postgraduate|doctorate|doctoral|dphil|phd)\b/.test(level)
    || (/\bmaster\b/.test(level) && !/\bintegrated master\b/.test(level)));
  return hasBachelor && hasIntegratedMaster && !hasStandaloneGraduate;
}

function awardScopeFitsProgram(award, program) {
  if (!isIntegratedUndergraduateProgram(program)) return true;
  const scope = normalizedProgramCoverageText(award?.program_scope);
  const graduateOnly = /\b(?:master(?:['’]s|s)?|dphil|doctoral|phd)\b/.test(scope)
    && !/\b(?:undergraduate|bachelor|first year)\b/.test(scope);
  return !graduateOnly;
}

function renderProgramCoverageAwards(awards, program) {
  const data = awards && typeof awards === "object" ? awards : {};
  const items = Array.isArray(data.items) ? data.items.filter((award) => awardScopeFitsProgram(award, program)) : [];
  if (data.status !== "available" || items.length === 0) {
    return `<div class="program-coverage__fact" data-coverage-kind="awards"><div class="program-coverage__fact-heading"><strong>${escapeHtml(t("university.program_coverage.awards", "Potential awards"))}</strong><span class="program-coverage__status">${escapeHtml(t("university.program_coverage.not_catalogued", "Not catalogued"))}</span></div><p class="program-coverage__scope">${escapeHtml(programCoverageScopeLabel(data.scope))}</p><p class="program-coverage__meta">${escapeHtml(t("university.program_coverage.next_action.awards", "Check the official course funding page and each award's eligibility and application steps."))}</p></div>`;
  }
  return `<div class="program-coverage__fact program-coverage__fact--awards" data-coverage-kind="awards">
    <div class="program-coverage__fact-heading"><strong>${escapeHtml(t("university.program_coverage.awards", "Potential awards"))}</strong><span class="program-coverage__status">${escapeHtml(t("university.program_coverage.award_potential", "Potential award records; not confirmed funding"))}</span></div>
    <p class="program-coverage__scope">${escapeHtml(t("university.program_coverage.award_caution", "Records do not confirm applicant eligibility or an award. Check each award's stated scope."))}</p>
    <ul class="program-coverage__awards-list">${items.map((award) => {
      const name = String(award?.name || "").trim() || t("university.program_coverage.award_fallback", "Unnamed award");
      const programScope = String(award?.program_scope || "").trim();
      const applicantScope = String(award?.applicant_scope || "").trim();
      const cycle = String(award?.cycle || "").trim();
      const sourceUrl = programCoverageSourceUrl(award?.source_url);
      const awardDeadline = programCoverageValueStrings(award?.award_application_deadline);
      const timezone = String(award?.deadline_timezone || "").trim();
      return `<li class="program-coverage__award">
        <strong>${escapeHtml(name)}</strong>
        ${programScope ? `<p class="program-coverage__meta"><strong>${escapeHtml(t("university.program_coverage.award_program_scope", "Award program scope"))}:</strong> ${escapeHtml(programScope)}</p>` : ""}
        ${applicantScope ? `<p class="program-coverage__meta"><strong>${escapeHtml(t("university.program_coverage.award_applicant_scope", "Applicant scope to check"))}:</strong> ${escapeHtml(applicantScope)}</p>` : ""}
        ${awardDeadline.length ? `<p class="program-coverage__meta"><strong>${escapeHtml(t("university.program_coverage.award_deadline", "Award application deadline"))}:</strong> ${escapeHtml(awardDeadline.join("; "))}${timezone ? ` · ${escapeHtml(timezone)}` : ""}</p>` : `<p class="program-coverage__meta">${escapeHtml(t("university.program_coverage.award_deadline_unknown", "Award application deadline not catalogued"))}</p>`}
        <p class="program-coverage__meta"><strong>${escapeHtml(t("university.program_coverage.cycle", "Cycle"))}:</strong> ${escapeHtml(cycle || t("university.program_coverage.cycle_unknown", "Unknown"))}</p>
        ${award.verified_at ? `<p class="program-coverage__meta"><strong>${escapeHtml(t("university.program_coverage.verified", "Verified"))}:</strong> ${escapeHtml(String(award.verified_at))}</p>` : ""}
        ${sourceUrl ? `<a class="program-coverage__source" href="${escapeHtmlAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.program_coverage.source", "Official source"))}</a>` : `<p class="program-coverage__meta">${escapeHtml(t("university.program_coverage.source_unknown", "Official source not catalogued"))}</p>`}
      </li>`;
    }).join("")}</ul>
  </div>`;
}

export function renderProgramCoverage(coverageByProgram, program) {
  const row = resolveProgramCoverage({ coverageByProgram, program });
  const heading = t("university.program_coverage.title", "Coverage for selected program");
  if (!program) {
    return `<section class="program-coverage" aria-label="${escapeHtmlAttr(heading)}"><h3 class="program-coverage__title">${escapeHtml(heading)}</h3><p class="program-coverage__meta">${escapeHtml(t("university.program_coverage.select_program", "Select a specific program in your admission track or profile to check its data."))}</p></section>`;
  }
  if (!row) {
    return `<section class="program-coverage" aria-label="${escapeHtmlAttr(heading)}"><h3 class="program-coverage__title">${escapeHtml(heading)}</h3><p class="program-coverage__meta">${escapeHtml(t("university.program_coverage.no_program_record", "No coverage record is catalogued for this selected program."))}</p></section>`;
  }
  const programName = String(row.program_name || program.name || "").trim();
  return `<section class="program-coverage" aria-label="${escapeHtmlAttr(heading)}">
    <h3 class="program-coverage__title">${escapeHtml(heading)}</h3>
    ${programName ? `<p class="program-coverage__program">${escapeHtml(programName)}</p>` : ""}
    <div class="program-coverage__facts">
      ${renderProgramCoverageFact("university.program_coverage.requirements", "Requirements", row.requirements, "requirements")}
      ${renderProgramCoverageFact("university.program_coverage.course_deadline", "Course application deadline", row.deadline, "deadline")}
      ${renderProgramCoverageFact("university.program_coverage.tuition", "Tuition and mandatory fees", row.tuition_mandatory_fees, "cost")}
      ${renderProgramCoverageAwards(row.awards, program)}
    </div>
  </section>`;
}

export function resolveDisplayedCoverageProgram(displayItems, selectedProgram, expandedProgramKey) {
  const key = String(expandedProgramKey || "").trim();
  if (key && Array.isArray(displayItems)) {
    const expandedProgram = displayItems.find((item) => item?.key === key)?.program;
    if (expandedProgram) return expandedProgram;
  }
  return selectedProgram || null;
}

function getProgramLevelsList(program) {
  const levels = Array.isArray(program?.study_levels)
    ? program.study_levels
    : (program?.study_level ? [program.study_level] : []);
  return levels.map((l) => String(l || "").trim()).filter(Boolean);
}

function programMatchesStudyLevel(program, selectedLevelKey) {
  if (!selectedLevelKey || selectedLevelKey === "all") return true;
  return getProgramLevelKeys(program).includes(selectedLevelKey);
}

function getAvailableProgramLevels(programs) {
  const counts = new Map();
  programs.forEach((prog) => {
    const resolved = getProgramLevelKeys(prog);
    const seenForProg = new Set();
    resolved.forEach((l) => {
      const k = normalizeProgramLevelKey(l);
      if (!seenForProg.has(k)) {
        seenForProg.add(k);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    });
  });

  const order = ["bachelor", "master", "doctorate", "professional", "mba"];
  const out = [];
  order.forEach((k) => {
    if (counts.has(k)) {
      let label = "";
      if (k === "bachelor") label = t("profile.option.study_level_bachelor", "Bachelor's");
      else if (k === "master") label = t("profile.option.study_level_master", "Master's");
      else if (k === "doctorate") label = t("profile.option.study_level_doctorate", "Doctorate / PhD");
      else if (k === "mba") label = t("university.coverage.level.mba", "MBA");
      else if (k === "professional") label = t("university.coverage.level.professional", "Professional");
      else label = trStudyLevel(k);
      out.push({ key: k, label, count: counts.get(k) });
    }
  });
  return out;
}

export function renderProgramsSection({
  admissionsData,
  container,
  university,
  profileMajor = "",
  coverageProgram = null,
}) {
  if (!container) return;

  const programs = Array.isArray(university?.academics?.programs)
    ? university.academics.programs.filter((program) => program && typeof program === "object")
    : [];
  const signalRows = Array.isArray(admissionsData?.programs)
    ? admissionsData.programs.filter((row) => row && typeof row === "object")
    : [];
  const programLevel = admissionsData?.program_level && typeof admissionsData.program_level === "object"
    ? admissionsData.program_level
    : {};
  const institutionWideOnly = String(programLevel?.kind || "").trim().toLowerCase() === "institution_wide_only";

  const prettyField = (key) =>
    String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const hiddenProgramMetadata = new Set([
    "id", "url", "source_url", "source_urls", "deadline_source_url", "tuition_source_url",
    "verified_at", "tuition_verified_at", "cycle", "tuition_cycle", "requirements_cycle",
    "currency", "deadlines", "scholarship_eligibility",
  ]);

  const isMajorTagField = (key) => {
    const normalized = String(key || "").trim().toLowerCase();
    return normalized === "major_tags" || normalized === "majors" || normalized === "applicable_majors";
  };

  const tokenizeName = (value) =>
    String(value || "")
      .toLowerCase()
      .replaceAll("&", " ")
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter(Boolean);

  const normalizeSignalKey = (value) => tokenizeName(value).join(" ");

  const stripParenthetical = (value) => String(value || "").replace(/\([^)]*\)/g, " ");

  const parenTokenSet = (value) => {
    const groups = String(value || "").match(/\([^)]*\)/g) || [];
    return new Set(groups.flatMap((group) => tokenizeName(group)));
  };

  const formatProgramValue = (key, value) => {
    if (value === null || value === undefined || value === "") return "";
    if (Array.isArray(value)) {
      return value.map((item) => {
        const raw = String(item);
        if (String(key) === "study_levels") return trStudyLevel(raw);
        if (String(key) === "language") return trProgramLanguage(raw);
        if (String(key) === "study_mode") return trStudyMode(raw);
        return raw;
      }).join(", ");
    }
    if (typeof value === "boolean") return value ? t("common.yes", "Yes") : t("common.no", "No");
    if (String(key) === "acceptance_rate_percent") return `${value}%`;
    if (typeof value === "number" && /(?:_usd|_gbp|_eur)$/.test(String(key))) {
      const currency = String(key).split("_").at(-1).toUpperCase();
      return `${currency} ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}`;
    }
    if (String(key) === "study_mode") return trStudyMode(String(value));
    if (String(key) === "duration") return localizeDuration(value);
    return String(value);
  };

  const formatListValue = (key, value) => {
    const list = Array.isArray(value) ? value : [value];
    return list
      .map((item) => {
        const raw = String(item ?? "").trim();
        if (!raw) return "";
        if (String(key) === "study_levels") return trStudyLevel(raw);
        if (String(key) === "language") return trProgramLanguage(raw);
        if (String(key) === "study_mode") return trStudyMode(raw);
        if (isMajorTagField(key)) return trProgramName(raw) || raw;
        return raw;
      })
      .filter(Boolean);
  };

  const renderValueCell = (label, key, rawValue, formattedValue) => {
    if (Array.isArray(rawValue) && rawValue.length) {
      const translatedItems = formatListValue(key, rawValue);
      if (!translatedItems.length) {
        return `<span class="program-card-value program-card-value--empty">${escapeHtml(unknownLabelText(label, label))}</span>`;
      }
      return `
        <div class="program-card-tags">
          ${translatedItems.map((item) => `<span class="program-tag">${escapeHtml(String(item))}</span>`).join("")}
        </div>
      `;
    }

    if (String(key) === "acceptance_rate_percent") {
      const num = toFiniteNumber(rawValue);
      if (num !== null) {
        const pct = Math.max(0, Math.min(100, num));
        return `
          <div class="program-acceptance">
            <div class="program-acceptance-head">
              <span class="program-pill program-pill--accent">${escapeHtml(`${Math.round(pct * 100) / 100}%`)}</span>
            </div>
            <div class="program-acceptance-track" aria-hidden="true">
              <div class="program-acceptance-fill" data-width-pct="${pct}"></div>
            </div>
          </div>
        `;
      }
      return `<span class="program-card-value program-card-value--empty">${escapeHtml(unknownLabelText(label, label))}</span>`;
    }

    if (!String(formattedValue || "").trim()) {
      return `<span class="program-card-value program-card-value--empty">${escapeHtml(unknownLabelText(label, label))}</span>`;
    }

    return `<span class="program-card-value">${escapeHtml(formattedValue)}</span>`;
  };

  const renderSignalRows = (rows) => {
    if (!rows.length) return "";
    return `
      <div class="program-signal">
        <div class="program-signal__label">${escapeHtml(t("university.admissions.program_signals", "Admissions data by program"))}</div>
        ${rows.map((row) => {
          const typeKey = admissionsDataTypeKey(row);
          const checked = String(row?.provenance?.verified_at || admissionsData?.status_date || "").trim();
          return `
            <div class="program-signal__row">
              <span class="program-signal__type">${escapeHtml(admissionsDataTypeLabel(typeKey))}</span>
              ${renderAdmissionsChipRow(admissionsFactChips(row))}
              <p class="program-signal__note">${escapeHtml(admissionsSignalSummary(row, { institutionWideOnly }))}</p>
              ${checked ? `<div class="program-signal__meta">${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(checked)}</div>` : ""}
              ${renderAdmissionsSourceLink(row, { explainsAbsence: typeKey === "verified-null" })}
            </div>
          `;
        }).join("")}
      </div>
    `;
  };

  if (programs.length) {
    const knownKeys = new Set(["name", "study_levels", "acceptance_rate_percent", "duration", "language", "study_mode"]);
    const programIndexByExactKey = new Map();
    const programIndexesByCoreKey = new Map();
    programs.forEach((program, idx) => {
      const exactKey = normalizeSignalKey(program?.name);
      if (exactKey && !programIndexByExactKey.has(exactKey)) programIndexByExactKey.set(exactKey, idx);
      const coreKey = normalizeSignalKey(stripParenthetical(program?.name));
      if (!coreKey) return;
      if (!programIndexesByCoreKey.has(coreKey)) programIndexesByCoreKey.set(coreKey, []);
      programIndexesByCoreKey.get(coreKey).push(idx);
    });
    const programParenTokens = programs.map((program) => parenTokenSet(program?.name));
    const signalsByProgram = new Map();
    const residualSignalRows = [];
    signalRows.forEach((row) => {
      const key = normalizeSignalKey(row?.program_name);
      if (!key) return;
      let targetIdx = programIndexByExactKey.has(key) ? programIndexByExactKey.get(key) : -1;
      if (targetIdx < 0) {
        const coreKey = normalizeSignalKey(stripParenthetical(row?.program_name));
        const candidates = (coreKey && programIndexesByCoreKey.get(coreKey)) || [];
        if (candidates.length === 1) targetIdx = candidates[0];
      }
      if (targetIdx < 0) {
        const translatedCoreKey = normalizeSignalKey(stripParenthetical(trProgramName(row?.program_name || "")));
        const translatedCandidates = (translatedCoreKey && programIndexesByCoreKey.get(translatedCoreKey)) || [];
        if (translatedCandidates.length === 1) targetIdx = translatedCandidates[0];
      }
      if (targetIdx < 0) {
        const signalParen = parenTokenSet(row?.program_name);
        if (signalParen.size > 0) {
          let bestIdx = -1;
          let bestScore = 0;
          let tied = false;
          programParenTokens.forEach((programTokens, idx) => {
            let score = 0;
            signalParen.forEach((token) => {
              if (programTokens.has(token)) score += 1;
            });
            if (score > bestScore) {
              bestScore = score;
              bestIdx = idx;
              tied = false;
            } else if (score === bestScore && score > 0) {
              tied = true;
            }
          });
          if (bestIdx >= 0 && bestScore >= 2 && !tied) targetIdx = bestIdx;
        }
      }
      if (targetIdx < 0) {
        residualSignalRows.push(row);
        return;
      }
      if (!signalsByProgram.has(targetIdx)) signalsByProgram.set(targetIdx, []);
      signalsByProgram.get(targetIdx).push(row);
    });
    const expandLabel = t("university.programs.expand", "Show details");
    const collapseLabel = t("university.programs.collapse", "Hide details");
    const universityKey = String(university?.id || "").trim();
    const majorTokenSets = [
      tokenizeName(profileMajor),
      tokenizeName(trProgramName(profileMajor || "")),
    ].filter((tokens) => tokens.length);
    const rawFieldTags = (program) => [
      ...(Array.isArray(program?.major_tags) ? program.major_tags : []),
      ...(Array.isArray(program?.majors) ? program.majors : []),
      ...(Array.isArray(program?.applicable_majors) ? program.applicable_majors : []),
    ].map((tag) => normalizeSignalKey(tag)).filter(Boolean);
    const programMatchesMajor = (program) => {
      if (!majorTokenSets.length) return false;
      const tags = rawFieldTags(program);
      const nameTokens = new Set(tokenizeName(program?.name));
      return majorTokenSets.some((tokens) =>
        tags.includes(tokens.join(" ")) || tokens.every((token) => nameTokens.has(token)));
    };
    const items = programs.map((program, originalIdx) => {
      const title = trProgramName(program.name || "")
        || unknownFieldText("placeholder.field.program_name", "Program name");
      const summaryParts = [
        formatProgramValue("duration", program.duration),
        formatListValue("language", program.language).join(", "),
        formatProgramValue("study_mode", program.study_mode),
      ].filter((part) => String(part || "").trim());
      const fieldParts = [
        ...formatListValue("major_tags", program.major_tags),
        ...formatListValue("majors", program.majors),
        ...formatListValue("applicable_majors", program.applicable_majors),
      ].filter((part, pos, arr) => part && arr.indexOf(part) === pos);
      const summaryText = [...summaryParts, ...fieldParts].filter(Boolean).join(" · ");
      return {
        program,
        originalIdx,
        key: normalizeSignalKey(program?.name) || `program-${originalIdx}`,
        title,
        summaryText,
        haystack: normalizeSignalKey(`${title} ${summaryText} ${program?.name || ""}`),
        isMajorMatch: programMatchesMajor(program),
      };
    }).sort((a, b) => Number(b.isMajorMatch) - Number(a.isMajorMatch));
    const storedOpenKey = programOpenKeyByUniversity.get(universityKey) || "";

    const availableLevels = getAvailableProgramLevels(programs);
    let activeLevelStored = programStudyLevelSelectionByUniversity.get(universityKey);
    if (!activeLevelStored) {
      const profileStudyLevel = normalizeProgramLevelKey(loadProfile()?.studyLevel);
      if (availableLevels.some((l) => l.key === profileStudyLevel)) {
        activeLevelStored = profileStudyLevel;
      } else if (availableLevels.some((l) => l.key === "bachelor")) {
        activeLevelStored = "bachelor";
      } else {
        activeLevelStored = "all";
      }
      programStudyLevelSelectionByUniversity.set(universityKey, activeLevelStored);
    }
    const activeLevelKey = activeLevelStored || "all";

    const displayItems = availableLevels.length > 1
      ? items.filter((item) => programMatchesStudyLevel(item.program, activeLevelKey))
      : items;
    const displayedCoverageProgram = resolveDisplayedCoverageProgram(displayItems, coverageProgram, storedOpenKey);


    const levelFilterHtml = availableLevels.length > 1
      ? `
        <div class="programs-level-filter" role="group" aria-label="${escapeHtmlAttr(t("university.programs.filter_by_level", "Filter programs by degree level"))}">
          <button
            type="button"
            class="programs-level-tab${activeLevelKey === "all" ? " is-active" : ""}"
            data-program-level="all"
          >${escapeHtml(t("university.admissions.all_levels", "All Degrees"))} (${programs.length})</button>
          ${availableLevels.map((lvl) => `
            <button
              type="button"
              class="programs-level-tab${activeLevelKey === lvl.key ? " is-active" : ""}"
              data-program-level="${escapeHtmlAttr(lvl.key)}"
            >${escapeHtml(lvl.label)} (${lvl.count})</button>
          `).join("")}
        </div>
      `
      : "";

    container.innerHTML = `
      ${levelFilterHtml}
      <div class="program-search">
        ${renderInlineIcon("magnifying-glass", 18, "program-search__icon")}
        <input
          type="search"
          class="program-search__input"
          data-program-search
          placeholder="${escapeHtmlAttr(t("university.programs.search_placeholder", "Search programs..."))}"
          aria-label="${escapeHtmlAttr(t("university.programs.search_label", "Search programs"))}"
          autocomplete="off"
        >
        <button
          type="button"
          class="program-search__clear"
          data-program-search-clear
          aria-label="${escapeHtmlAttr(t("university.programs.clear_search", "Clear search"))}"
          hidden
        >${renderInlineIcon("x-mark", 16)}</button>
      </div>
      <div class="program-list" role="list">
        ${displayItems.map((item, displayIdx) => {
          const program = item.program;
          const idx = item.originalIdx;
          const { title, summaryText } = item;
          const programAcceptance = toFiniteNumber(program.acceptance_rate_percent);
          const bodyId = `program-body-${displayIdx}`;
          const isOpen = item.key === storedOpenKey;
          const rows = [
            ...(programAcceptance !== null ? [{
              label: translateWord("acceptance_rate", "Acceptance Rate"),
              key: "acceptance_rate_percent",
              rawValue: program.acceptance_rate_percent,
              value: formatProgramValue("acceptance_rate_percent", program.acceptance_rate_percent),
            }] : []),
            {
              label: translateWord("study_levels", "Study Levels"),
              key: "study_levels",
              rawValue: program.study_levels,
              value: formatProgramValue("study_levels", program.study_levels),
            },
            {
              label: translateWord("duration", "Duration"),
              key: "duration",
              rawValue: program.duration,
              value: formatProgramValue("duration", program.duration),
            },
            {
              label: translateWord("language", "Language"),
              key: "language",
              rawValue: program.language,
              value: formatProgramValue("language", program.language),
            },
            {
              label: translateWord("study_mode", "Study Mode"),
              key: "study_mode",
              rawValue: program.study_mode,
              value: formatProgramValue("study_mode", program.study_mode),
            },
          ];

          const extraRows = Object.entries(program)
            .filter(([key, value]) => !knownKeys.has(key)
              && !hiddenProgramMetadata.has(key)
              && value !== null && value !== undefined && value !== ""
              && (typeof value !== "object" || (Array.isArray(value) && value.length > 0)))
            .map(([key, value]) => ({
              label: (key === "major_tags" || key === "majors")
                ? translateWord("fields_of_study", "Fields of study")
                : (key === "applicable_majors"
                  ? t("placeholder.field.applicable_majors", "Applicable majors")
                  : t(`university.programs.field.${key}`, prettyField(key))),
              key,
              rawValue: value,
              value: formatProgramValue(key, value),
            }));

          const allRows = [...rows, ...extraRows];
          const matchedSignals = signalsByProgram.get(idx) || [];
          const toggleLabel = `${isOpen ? collapseLabel : expandLabel}: ${title}`;
          return `
            <article
              class="program-card${isOpen ? " is-open" : ""}${item.isMajorMatch ? " program-card--major" : ""}"
              role="listitem"
              data-program-key="${escapeHtmlAttr(item.key)}"
              data-search="${escapeHtmlAttr(item.haystack)}"
            >
              <button
                type="button"
                class="program-card__toggle"
                data-program-toggle="${displayIdx}"
                aria-expanded="${isOpen ? "true" : "false"}"
                aria-controls="${bodyId}"
                aria-label="${escapeHtmlAttr(toggleLabel)}"
              >
                <span class="program-card__text">
                  <span class="program-card__kicker-row">
                    <span class="program-card__kicker">${escapeHtml(translateWord("program", "Program"))} ${displayIdx + 1}</span>
                    ${item.isMajorMatch ? `<span class="program-card__major-badge">${escapeHtml(t("university.programs.major_badge", "Your major"))}</span>` : ""}
                  </span>
                  <span class="program-card__title">${escapeHtml(title)}</span>
                  ${summaryText ? `<span class="program-card__summary">${escapeHtml(summaryText)}</span>` : ""}
                </span>
                <span class="program-card__chevron" aria-hidden="true">${renderInlineIcon("chevron-right", 16)}</span>
              </button>
              <div class="program-card__body" id="${bodyId}" role="region"${isOpen ? "" : " hidden"}>
                <div class="program-card__body-inner">
                  <div class="program-card-rows">
                    ${allRows.map((row) => `
                      <div class="program-card-row">
                        <span class="program-card-label">${escapeHtml(row.label)}</span>
                        ${renderValueCell(row.label, row.key, row.rawValue, row.value)}
                      </div>
                    `).join("")}
                  </div>
                  ${renderSignalRows(matchedSignals)}
                </div>
              </div>
            </article>
          `;
        }).join("")}
      </div>
      <div class="program-empty" data-program-empty hidden>${escapeHtml(t("university.programs.no_results", "No programs match this search."))}</div>
      ${(() => {
        const residual = residualSignalRows;
        if (!residual.length) return "";
        return `
          <div class="program-signal program-signal--residual">
            <div class="program-signal__label">${escapeHtml(t("university.admissions.program_signals", "Admissions data by program"))}</div>
            ${residual.map((row) => {
              const typeKey = admissionsDataTypeKey(row);
              const checked = String(row?.provenance?.verified_at || admissionsData?.status_date || "").trim();
              return `
                <div class="program-signal__row">
                  <span class="program-signal__type">${escapeHtml(admissionsDataTypeLabel(typeKey))} · ${escapeHtml(trProgramName(row?.program_name || ""))}</span>
                  ${renderAdmissionsChipRow(admissionsFactChips(row))}
                  <p class="program-signal__note">${escapeHtml(admissionsSignalSummary(row, { institutionWideOnly }))}</p>
                  ${checked ? `<div class="program-signal__meta">${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(checked)}</div>` : ""}
                  ${renderAdmissionsSourceLink(row, { explainsAbsence: typeKey === "verified-null" })}
                </div>
              `;
            }).join("")}
          </div>
        `;
      })()}
      <div data-program-coverage-host>${renderProgramCoverage(university?.coverage_by_program, displayedCoverageProgram)}</div>
    `;

    const pendingCloseByCard = new WeakMap();
    const prefersReducedMotion = () =>
      typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const setToggleState = (button, card, body, isOpen) => {
      const title = card.querySelector(".program-card__title")?.textContent?.trim() || "";
      const label = `${isOpen ? collapseLabel : expandLabel}${title ? `: ${title}` : ""}`;
      const pendingClose = pendingCloseByCard.get(card);
      if (pendingClose) {
        clearTimeout(pendingClose);
        pendingCloseByCard.delete(card);
      }
      body.classList.remove("program-card__body--enter", "program-card__body--exit");
      card.classList.toggle("is-open", isOpen);
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
      button.setAttribute("aria-label", label);
      if (isOpen) {
        body.removeAttribute("hidden");
        if (!prefersReducedMotion()) body.classList.add("program-card__body--enter");
      } else if (prefersReducedMotion()) {
        body.setAttribute("hidden", "");
      } else {
        body.classList.add("program-card__body--exit");
        pendingCloseByCard.set(card, setTimeout(() => {
          body.setAttribute("hidden", "");
          body.classList.remove("program-card__body--exit");
          pendingCloseByCard.delete(card);
        }, 160));
      }
    };

    container.querySelectorAll("[data-program-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        motionPress(button);
        const card = button.closest(".program-card");
        const body = card?.querySelector(".program-card__body");
        if (!card || !body) return;
        const wasOpen = card.classList.contains("is-open");
        container.querySelectorAll(".program-card.is-open").forEach((other) => {
          if (other === card) return;
          const otherButton = other.querySelector("[data-program-toggle]");
          const otherBody = other.querySelector(".program-card__body");
          if (otherButton && otherBody) setToggleState(otherButton, other, otherBody, false);
        });
        setToggleState(button, card, body, !wasOpen);
        programOpenKeyByUniversity.set(universityKey, !wasOpen ? (card.getAttribute("data-program-key") || "") : "");
        const coverageHost = container.querySelector("[data-program-coverage-host]");
        const expandedKey = !wasOpen ? (card.getAttribute("data-program-key") || "") : "";
        const activeCoverageProgram = resolveDisplayedCoverageProgram(displayItems, coverageProgram, expandedKey);
        if (coverageHost) {
          coverageHost.innerHTML = renderProgramCoverage(university?.coverage_by_program, activeCoverageProgram);
        }
        if (!wasOpen) applyPercentWidths(card);
      });
    });

    container.querySelectorAll("[data-program-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        motionPress(btn);
        const lvl = String(btn.getAttribute("data-program-level") || "").trim() || "all";
        programStudyLevelSelectionByUniversity.set(universityKey, lvl);
        renderProgramsSection({ admissionsData, container, university, profileMajor, coverageProgram });
      });
    });

    const searchInput = container.querySelector("[data-program-search]");
    const searchClear = container.querySelector("[data-program-search-clear]");
    const searchEmpty = container.querySelector("[data-program-empty]");
    const applyProgramFilter = () => {
      const queryTokens = tokenizeName(searchInput ? searchInput.value : "");
      let visibleCount = 0;
      container.querySelectorAll(".program-card").forEach((card) => {
        const haystack = String(card.getAttribute("data-search") || "");
        const visible = !queryTokens.length || queryTokens.every((token) => haystack.includes(token));
        if (visible) {
          card.removeAttribute("hidden");
          visibleCount += 1;
        } else {
          card.setAttribute("hidden", "");
        }
      });
      if (searchEmpty) {
        if (visibleCount > 0) searchEmpty.setAttribute("hidden", "");
        else searchEmpty.removeAttribute("hidden");
      }
      if (searchClear) {
        if (searchInput && String(searchInput.value || "").trim()) searchClear.removeAttribute("hidden");
        else searchClear.setAttribute("hidden", "");
      }
    };
    if (searchInput) {
      searchInput.value = programSearchQueryByUniversity.get(universityKey) || "";
      searchInput.addEventListener("input", () => {
        programSearchQueryByUniversity.set(universityKey, searchInput.value);
        applyProgramFilter();
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && String(searchInput.value || "")) {
          searchInput.value = "";
          programSearchQueryByUniversity.set(universityKey, "");
          applyProgramFilter();
        }
      });
      if (searchClear) {
        searchClear.addEventListener("click", () => {
          motionPress(searchClear);
          searchInput.value = "";
          programSearchQueryByUniversity.set(universityKey, "");
          applyProgramFilter();
          searchInput.focus();
        });
      }
      applyProgramFilter();
    }
  } else {
    const majors = Array.isArray(university?.academics?.majors)
      ? university.academics.majors.map((major) => String(major || "").trim()).filter(Boolean)
      : [];
    const majorsHtml = majors.length
      ? majors.map((major) => `<span class="program-major-chip">${escapeHtml(trProgramName(major))}</span>`).join(" ")
      : `<div class="program-empty">${escapeHtml(unknownFieldText("placeholder.field.programs", "Programs"))}</div>`;
    container.innerHTML = `${majorsHtml}${renderSignalRows(signalRows)}<div data-program-coverage-host>${renderProgramCoverage(university?.coverage_by_program, coverageProgram)}</div>`;
  }

  applyPercentWidths(container);
  markMotionEnter(container, ".program-card, .program-major-chip, .program-signal, .program-empty", { limit: 18, staggerMs: 18 });
}

function normalizeQualificationLevel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (["bachelor", "undergraduate", "undergrad"].includes(key)) return "Bachelor";
  if (["master", "mba", "doctorate", "phd", "graduate"].includes(key)) return "graduate";
  return "";
}

function normalizeQualificationText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isOfficialSource(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function qualificationCycleIsCurrent(cycle, verifiedAt) {
  const yearMatch = String(cycle || "").match(/\b(20\d{2})\b/);
  if (!yearMatch) return true;
  const entryYear = Number(yearMatch[1]);
  const verifiedYear = Number(String(verifiedAt || "").slice(0, 4));
  if (!Number.isInteger(entryYear) || !Number.isInteger(verifiedYear)) return false;
  return entryYear >= verifiedYear && entryYear <= verifiedYear + 1;
}

const QUALIFICATION_SCOPE_KEYS = new Map([
  ["Undergraduate first-year qualification status; this credential alone does not meet the standard offer. Oxford says applicants need further study and another accepted qualification.", "university.qualification_guidance.scope.oxford_attestat"],
  ["All undergraduate courses at qualification-type level; course-specific grades and subjects are not checked here.", "university.qualification_guidance.scope.oxford_ib"],
  ["Qualification-type level only; course-specific thresholds are not checked here.", "university.qualification_guidance.scope.imperial_ib"],
  ["Contextual admissions guidance only; no country-level qualification acceptance or rejection is inferred.", "university.qualification_guidance.scope.contextual_review"],
  ["MIT reviews international academic records in the context of the school and country. Its published guidance does not set a country-level acceptance decision for this credential.", "university.qualification_guidance.scope.mit_review"],
  ["Stanford says it considers international applications in the context of the school and country. This source does not publish a country-level acceptance decision for this credential.", "university.qualification_guidance.scope.stanford_review"],
  ["Harvard states that application requirements are the same for students attending high school inside or outside the United States; it does not publish a country-level diploma acceptance decision here.", "university.qualification_guidance.scope.harvard_review"],
  ["Oxford publishes country-specific school-leaving qualification decisions for undergraduate first-year entry. Course subject and grade requirements still apply.", "university.qualification_guidance.scope.oxford_review"],
  ["Imperial publishes accepted undergraduate qualification equivalencies, while course pages can require higher or additional subjects.", "university.qualification_guidance.scope.imperial_review"],
  ["Open the selected official programme page to review its current requirements.", "university.qualification_guidance.scope.graduate_review"],
]);

const QUALIFICATION_CYCLE_SCOPE_KEYS = new Map([
  ["Current published policy; the source does not name a specific entry year.", "university.qualification_guidance.cycle_scope.current_policy"],
  ["Current published guidance; the source does not name a specific entry year.", "university.qualification_guidance.cycle_scope.current_guidance"],
  ["Current published guidance; verify applicability to the intended entry year.", "university.qualification_guidance.cycle_scope.verify_entry_year"],
  ["Use the selected programme's named entry cycle and current course page.", "university.qualification_guidance.cycle_scope.program_page"],
]);

export function resolveQualificationGuidance({ profile = {}, university = {}, program = null } = {}) {
  const catalog = university?.qualification_guidance && typeof university.qualification_guidance === "object"
    ? university.qualification_guidance
    : {};
  const profileLevel = normalizeQualificationLevel(profile.studyLevel || profile.study_level);
  const programLevels = getProgramLevelKeys(program);
  const level = profileLevel || (programLevels.includes("bachelor") ? "Bachelor" : (programLevels.length ? "graduate" : ""));
  const route = String(profile.applicantRoute || profile.applicant_route || "").trim();
  const country = String(profile.countryOfEducation || profile.country_of_education || "").trim().toUpperCase();
  const credential = String(profile.educationCredential || profile.education_credential || "").trim();
  const credentialText = normalizeQualificationText(profile.educationCredentialOther || profile.education_credential_other);
  const cycle = String(profile.intendedEntryCycle || profile.intended_entry_cycle || "").trim();
  const rules = Array.isArray(catalog.rules) ? catalog.rules : [];

  const exactRule = rules.find((rule) => {
    if (normalizeQualificationLevel(rule.study_level) !== level) return false;
    if (!Array.isArray(rule.applicant_routes) || !rule.applicant_routes.includes(route)) return false;
    if (String(rule.education_country || "").toUpperCase() !== "*" && String(rule.education_country || "").toUpperCase() !== country) return false;
    const credentialOptions = Array.isArray(rule.education_credentials_any)
      ? rule.education_credentials_any
      : [rule.education_credential];
    if (!credentialOptions.includes(credential)) return false;
    const textMatches = Array.isArray(rule.credential_text_matches_any) ? rule.credential_text_matches_any : [];
    if (textMatches.length && !textMatches.some((part) => credentialText === normalizeQualificationText(part))) return false;
    if (Array.isArray(rule.program_ids) && rule.program_ids.length && !rule.program_ids.includes(String(program?.id || ""))) return false;
    if (program && level === "Bachelor" && !getProgramLevelKeys(program).includes("bachelor")) return false;
    return true;
  });

  let status = exactRule?.status || "needs_review";
  const ruleReasonKey = (item) => {
    const id = String(item?.id || "");
    if (id.includes("oxford-kazakhstan-attestat")) return "university.qualification_guidance.reason.oxford_attestat";
    if (id.includes("international-baccalaureate") || id.includes("imperial-ib")) return "university.qualification_guidance.reason.accepted_ib";
    if (id.includes("us-high-school-context")) return "university.qualification_guidance.reason.contextual_review";
    return item?.requires_program_page ? "university.qualification_guidance.reason.graduate_review" : "university.qualification_guidance.reason.unknown";
  };
  let reasonKey = exactRule?.reason_key || ruleReasonKey(exactRule);
  let reason = exactRule?.reason || "No verified decision for this exact qualification combination is catalogued.";
  let scope = exactRule?.scope || "";
  let scopeKey = exactRule?.scope_key || QUALIFICATION_SCOPE_KEYS.get(exactRule?.scope || "") || "";
  let cycleScope = exactRule?.cycle_scope || "";
  let cycleScopeKey = exactRule?.cycle_scope_key || QUALIFICATION_CYCLE_SCOPE_KEYS.get(cycleScope) || "";
  let sourceUrl = exactRule?.source_url || "";
  let verifiedAt = exactRule?.verified_at || catalog.verified_at || "";
  let matchedRuleId = exactRule?.id || "";
  let requiresProgramPage = false;

  if (!exactRule) {
    const fallbacks = Array.isArray(catalog.fallbacks) ? catalog.fallbacks : [];
    const fallback = fallbacks.find((item) => normalizeQualificationLevel(item.study_level) === level
      && Array.isArray(item.applicant_routes)
      && item.applicant_routes.includes(route));
    if (fallback) {
      status = fallback.status || "needs_review";
      reasonKey = fallback.reason_key || ruleReasonKey(fallback);
      reason = fallback.reason || reason;
      scope = fallback.scope || "";
      scopeKey = fallback.scope_key || QUALIFICATION_SCOPE_KEYS.get(scope) || "";
      cycleScope = fallback.cycle_scope || "";
      cycleScopeKey = fallback.cycle_scope_key || QUALIFICATION_CYCLE_SCOPE_KEYS.get(cycleScope) || "";
      sourceUrl = fallback.source_url || "";
      verifiedAt = fallback.verified_at || catalog.verified_at || "";
      matchedRuleId = fallback.id || "";
      requiresProgramPage = fallback.requires_program_page === true;
    }
  }

  const cycleMatches = qualificationCycleIsCurrent(cycle, verifiedAt);
  if (!cycleMatches) {
    status = "needs_review";
    reasonKey = "university.qualification_guidance.reason.cycle_review";
    reason = "The intended entry cycle is outside the cycle supported by this verification.";
    scopeKey = "";
  }
  if (requiresProgramPage) {
    sourceUrl = isOfficialSource(program?.url) ? program.url : "";
    if (!sourceUrl) {
      reasonKey = "university.qualification_guidance.reason.select_program";
      reason = "Choose the exact graduate programme to open its official course requirements.";
    }
  }
  if (sourceUrl && !isOfficialSource(sourceUrl)) sourceUrl = "";

  const needsExactCredential = !exactRule
    && country === "KZ"
    && credential === "national_secondary"
    && level === "Bachelor"
    && route === "first_year"
    && String(university?.id || "") === "university-of-oxford-uk-oxford";

  return {
    status,
    reasonKey,
    reason,
    scope,
    scopeKey,
    cycleScope,
    cycleScopeKey,
    sourceUrl,
    verifiedAt,
    matchedRuleId,
    needsExactCredential,
    cycle,
    programName: String(program?.name || "").trim(),
    programUrl: isOfficialSource(program?.url) ? String(program.url) : "",
    studyLevel: level,
  };
}

export function renderQualificationGuidance({ container, profile = {}, university = {}, program = null } = {}) {
  if (!container) return null;
  const result = resolveQualificationGuidance({ profile, university, program });
  const statusKeys = {
    accepted: "university.qualification_guidance.status.accepted",
    not_accepted: "university.qualification_guidance.status.not_accepted",
    needs_review: "university.qualification_guidance.status.needs_review",
  };
  const statusClass = result.status === "accepted" ? "accepted" : (result.status === "not_accepted" ? "not-accepted" : "review");
  const statusLabel = t(statusKeys[result.status] || statusKeys.needs_review, result.status === "accepted" ? "Accepted qualification" : (result.status === "not_accepted" ? "Explicitly not accepted" : "Needs official review"));
  const reason = t(result.reasonKey, result.reason);
  const selectedProgram = result.programName
    ? `<p class="qualification-guidance__meta"><strong>${escapeHtml(t("university.qualification_guidance.program_label", "Programme"))}:</strong> ${escapeHtml(result.programName)}</p>`
    : "";
  const programSource = result.programUrl
    ? `<a class="qualification-guidance__source" href="${escapeHtmlAttr(result.programUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.qualification_guidance.program_source", "Open official programme requirements"))}</a>`
    : "";
  const levelText = result.studyLevel
    ? `<p class="qualification-guidance__meta"><strong>${escapeHtml(t("university.qualification_guidance.level_label", "Study level"))}:</strong> ${escapeHtml(result.studyLevel === "Bachelor" ? trStudyLevel("Bachelor") : trStudyLevel(String(profile.studyLevel || "Graduate")))}</p>`
    : "";
  const selectedCycle = result.cycle
    ? `<p class="qualification-guidance__meta"><strong>${escapeHtml(t("university.qualification_guidance.cycle_label", "Intended entry cycle"))}:</strong> ${escapeHtml(result.cycle)}</p>`
    : `<p class="qualification-guidance__meta">${escapeHtml(t("university.qualification_guidance.cycle_unspecified", "Entry cycle not specified in your profile."))}</p>`;
  const scopeText = result.scopeKey ? t(result.scopeKey, result.scope) : result.scope;
  const scope = scopeText
    ? `<p class="qualification-guidance__meta">${escapeHtml(scopeText)}</p>`
    : "";
  const cycleScopeText = result.cycleScopeKey ? t(result.cycleScopeKey, result.cycleScope) : result.cycleScope;
  const cycleScope = cycleScopeText
    ? `<p class="qualification-guidance__meta"><strong>${escapeHtml(t("university.qualification_guidance.cycle_scope_label", "Cycle coverage"))}:</strong> ${escapeHtml(cycleScopeText)}</p>`
    : "";
  const checked = result.verifiedAt
    ? `<p class="qualification-guidance__meta"><strong>${escapeHtml(t("university.qualification_guidance.checked_label", "Official page checked"))}:</strong> ${escapeHtmlAttr(result.verifiedAt)}</p>`
    : "";
  const source = result.sourceUrl
    ? `<a class="qualification-guidance__source" href="${escapeHtmlAttr(result.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.qualification_guidance.official_source", "Open official qualification guidance"))}</a>`
    : "";
  const exactCredentialAction = result.needsExactCredential
    ? `<p class="qualification-guidance__action"><a href="/profile.html" data-route="profile">${escapeHtml(t("university.qualification_guidance.exact_credential_action", "Add the exact certificate title in your profile (choose Other) to check the published Kazakhstan entry."))}</a></p>`
    : "";
  const dataNotice = `<p class="qualification-guidance__meta">${escapeHtml(t("university.qualification_guidance.no_eligibility_notice", "This is qualification guidance, not an admission or eligibility decision. Grades, subjects, programme rules, and the applicable cycle still need review."))}</p>`;

  container.innerHTML = `
    <div class="qualification-guidance__result">
      <span class="qualification-guidance__status qualification-guidance__status--${statusClass}">${escapeHtml(statusLabel)}</span>
      <p class="qualification-guidance__text">${escapeHtml(reason)}</p>
      ${selectedProgram}
      ${levelText}
      ${selectedCycle}
      ${scope}
      ${cycleScope}
      ${checked}
      ${exactCredentialAction}
      ${source}
      ${programSource}
      ${dataNotice}
    </div>
  `;
  return result;
}
