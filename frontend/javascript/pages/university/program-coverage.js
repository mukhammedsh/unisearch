import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { getCurrentLanguage, t } from "../../i18n.js";
import { translateAdmissionText } from "../../university-translations.js";
import { safeUrl, trProgramName } from "../_shared.js";

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

export function normalizeProgramLevelKey(rawLevel) {
  const norm = String(rawLevel || "").trim().toLowerCase();
  if (norm.includes("bachelor") || norm.includes("undergrad") || norm.includes("integrated master") || norm.includes("бакалавр")) return "bachelor";
  if (/(^|[^a-z])m\.?b\.?a\.?($|[^a-z])/.test(norm) || norm.includes("master of business administration")) return "mba";
  if (norm.includes("professional") || norm.includes("professional degree") || norm.includes("профессиональн")) return "professional";
  if (norm.includes("master") || norm.includes("msc") || norm.includes("mres") || norm.includes("meng") || norm.includes("mfin") || norm.includes("mban") || norm.includes("mst") || norm.includes("bcl") || norm.includes("llm") || norm.includes("магистр")) return "master";
  if (norm.includes("phd") || norm.includes("doctor") || norm.includes("dphil") || norm.includes("доктор") || norm.includes("аспирант")) return "doctorate";
  return norm || "general";
}

export function getProgramLevelsList(program) {
  const levels = Array.isArray(program?.study_levels)
    ? program.study_levels
    : (program?.study_level ? [program.study_level] : []);
  return levels.map((l) => String(l || "").trim()).filter(Boolean);
}

export function getProgramLevelKeys(program) {
  const levels = getProgramLevelsList(program);
  if (!levels.length) return [];
  const name = String(program?.name || "").toLowerCase();
  const award = String(program?.degree_type || "").toLowerCase();
  const isMbaProgram = /(^|[^a-z])m\.?b\.?a\.?($|[^a-z])/.test(`${award} ${name}`) || name.includes("master of business administration");
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
  route_wide: "university.program_coverage.scope.route_wide",
  institution_wide: "university.program_coverage.scope.institution_wide",
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
  const programNames = new Set([program.source_name, program.name, program.program_name]
    .map(normalizedProgramCoverageText).filter(Boolean));
  return rows.find((row) => {
    if (!row || typeof row !== "object") return false;
    const rowId = String(row.program_id || "").trim();
    if (programId && rowId && rowId === programId) return true;
    return programNames.has(normalizedProgramCoverageText(row.program_name));
  }) || null;
}

export function resolveProgramByIdentifier(programs, identifier) {
  const candidates = Array.isArray(programs) ? programs : [];
  const target = String(identifier || "").trim();
  if (!target) return null;
  const currentIdMatch = candidates.find((program) => [program?.id, program?.program_id]
    .some((value) => String(value || "").trim() === target));
  if (currentIdMatch) return currentIdMatch;
  return candidates.find((program) => [program?.course_number, program?.legacy_id, ...(Array.isArray(program?.legacy_ids) ? program.legacy_ids : [])]
    .some((value) => String(value || "").trim() === target)) || null;
}

export function resolveProgramByName(programs, names, { allowPartial = false } = {}) {
  const candidates = Array.isArray(programs) ? programs : [];
  const targets = (Array.isArray(names) ? names : [names])
    .map((value) => normalizedProgramCoverageText(value))
    .filter(Boolean);
  if (!targets.length) return null;
  const namedPrograms = candidates.map((program) => ({
    program,
    names: [program?.source_name, program?.name, program?.program_name].map(normalizedProgramCoverageText).filter(Boolean),
  })).filter((entry) => entry.names.length);
  const exactMatches = namedPrograms.filter(({ names }) => names.some((name) => targets.includes(name)));
  if (exactMatches.length === 1) return exactMatches[0].program;
  if (exactMatches.length > 1 || !allowPartial) return null;
  const partialMatches = namedPrograms.filter(({ names }) => names.some((name) => targets.some((target) => name.includes(target) || target.includes(name))));
  return partialMatches.length === 1 ? partialMatches[0].program : null;
}

function programCoverageScopeLabel(scope) {
  const value = String(scope || "not_catalogued").trim();
  const key = PROGRAM_COVERAGE_SCOPE_KEYS[value];
  const fallback = {
    program_specific: "Specific to this program",
    shared_admission_route: "Shared admission route",
    institution_wide_route: "University-wide admission route",
    route_wide: "Route-wide",
    institution_wide: "Institution-wide",
    university_guidance: "University-level guidance; not a program price",
    award_program_scope: "Award record; confirm program and applicant eligibility",
    not_catalogued: "No data catalogued",
  }[value] || "No data catalogued";
  return t(key || "university.program_coverage.scope.not_catalogued", fallback);
}

function hasUnpublishedDeadline(fact) {
  const publicationStatuses = [fact?.publication_status, ...(Array.isArray(fact?.publication_facts) ? fact.publication_facts.map((item) => item?.publication_status) : [])];
  return publicationStatuses.includes("not_yet_published");
}

function hasConflictingDeadline(fact) {
  const publicationStatuses = [fact?.publication_status, ...(Array.isArray(fact?.publication_facts) ? fact.publication_facts.map((item) => item?.publication_status) : [])];
  return publicationStatuses.includes("conflicting");
}

function hasUnpublishedPrice(fact) {
  return Array.isArray(fact?.publication_facts) && fact.publication_facts.some((item) => item?.publication_status === "not_yet_published");
}

function hasConflictingPrice(fact) {
  return fact?.publication_status === "conflicting"
    || (Array.isArray(fact?.publication_facts) && fact.publication_facts.some((item) => item?.publication_status === "conflicting"));
}

function programCoverageFactStatus(fact, kind) {
  const status = String(fact?.status || "not_catalogued").trim();
  if (kind === "deadline" && hasConflictingDeadline(fact)) return t("university.program_coverage.deadline_conflicting", "Official deadline information conflicts");
  if (kind === "deadline" && status === "not_catalogued" && hasUnpublishedDeadline(fact)) return t("university.program_coverage.deadline_not_published", "Not yet published by the university");
  if (kind === "cost" && hasConflictingPrice(fact)) return t("university.program_coverage.price_conflicting", "Official fee information conflicts");
  if (kind === "cost" && hasUnpublishedPrice(fact)) return t("university.program_coverage.price_not_published", "Current fee not yet published");
  if (status === "not_catalogued") return t("university.program_coverage.not_catalogued", "Not catalogued");
  if (kind === "deadline" && status === "exact_dated") return t("university.program_coverage.deadline_exact", "Published dated course deadline");
  if (kind === "deadline" && status === "approximate_or_yearless") return t("university.program_coverage.deadline_approximate", "Published wording; exact date or year is missing");
  return t("university.program_coverage.catalogued", "Catalogued");
}

function programCoveragePriceFactStrings(facts) {
  return facts.flatMap((fact) => {
    if (!fact || typeof fact !== "object") return [];
    const kind = String(fact.kind || "").trim().toLowerCase();
    const feeStatus = String(fact.fee_status || "").trim().toLowerCase();
    const period = String(fact.period || "").trim().toLowerCase();
    const quantityBasis = String(fact.quantity_basis || "").trim().toLowerCase();
    const labels = [
      kind ? t(`university.program_coverage.price.kind.${kind}`, kind.replaceAll("_", " ")) : "",
      feeStatus ? t(`university.program_coverage.price.fee_status.${feeStatus}`, feeStatus.replaceAll("_", " ")) : "",
      period ? t(`university.program_coverage.price.period.${period}`, period.replaceAll("_", " ")) : "",
      quantityBasis ? t(`university.program_coverage.price.quantity_basis.${quantityBasis}`, quantityBasis.replaceAll("_", " ")) : "",
    ].filter(Boolean);
    if (["not_yet_published", "conflicting"].includes(fact.publication_status)) {
      const currency = String(fact.currency || "").trim();
      const amount = fact.publication_status === "conflicting"
        ? t("university.program_coverage.price_conflicting", "Official fee information conflicts")
        : t("university.program_coverage.price_not_published", "Current fee not yet published");
      return [`${labels.join(" · ")}: ${amount}${currency ? ` (${currency})` : ""}`];
    }
    if (typeof fact.amount !== "number" || !Number.isFinite(fact.amount) || fact.amount <= 0) return [];
    const locale = getCurrentLanguage().startsWith("ru") ? "ru-RU" : "en-US";
    const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(fact.amount);
    const currency = String(fact.currency || "").trim();
    return [`${labels.join(" · ")}: ${currency ? `${currency} ` : ""}${amount}`];
  });
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

function localizedProgramCoverageCycle(value) {
  const cycle = String(value || "").trim();
  if (!getCurrentLanguage().startsWith("ru")) return cycle;
  const normalizedCycle = cycle.replace(/[‐‑‒–—−]/g, "-");
  const fallEntry = normalizedCycle.match(/^Fall (20\d{2}) entry$/i);
  if (fallEntry) return t("university.program_coverage.cycle.fall_entry", "Fall {year} entry").replace("{year}", fallEntry[1]);
  const quarterlyTuition = normalizedCycle.match(/^(20\d{2}-2\d) published (?:Engineering|standard) graduate tuition; billed quarterly by unit load\. Student-specific annual total depends on units and enrolled quarters; (20\d{2}-2\d) rates are unknown\.?$/i);
  if (quarterlyTuition) {
    return t(
      "university.program_coverage.cycle.stanford_quarterly_tuition",
      "Опубликованная стоимость обучения за {year} начисляется поквартально в зависимости от числа учебных единиц. Годовая сумма зависит от учебной нагрузки и числа кварталов обучения; тарифы на {next_year} пока неизвестны.",
    ).replace("{year}", quarterlyTuition[1].replace("-", "–"))
      .replace("{next_year}", quarterlyTuition[2].replace("-", "–"));
  }
  const mdTuition = normalizedCycle.match(/^(20\d{2}-2\d) academic year; regular MD tuition payable in Autumn, Winter, Spring, and Summer quarters; (20\d{2}-2\d) rate not confirmed\.?$/i);
  if (mdTuition) {
    return t(
      "university.program_coverage.cycle.stanford_md_tuition",
      "Учебный год {year}; обычная стоимость обучения по программе MD начисляется за осенний, зимний, весенний и летний кварталы; тариф на {next_year} не подтверждён.",
    ).replace("{year}", mdTuition[1].replace("-", "–"))
      .replace("{next_year}", mdTuition[2].replace("-", "–"));
  }
  return translateAdmissionText(cycle, cycle);
}

function renderProgramCoverageFact(labelKey, labelFallback, fact, kind) {
  const row = fact && typeof fact === "object" ? fact : {};
  const status = programCoverageFactStatus(row, kind);
  const scope = programCoverageScopeLabel(row.scope);
  const deadlineNotPublished = kind === "deadline" && row.status === "not_catalogued" && hasUnpublishedDeadline(row);
  const deadlineConflicting = kind === "deadline" && hasConflictingDeadline(row);
  const priceNotPublished = kind === "cost" && hasUnpublishedPrice(row);
  const priceConflicting = kind === "cost" && hasConflictingPrice(row);
  const guidanceCost = kind === "cost" && row.scope === "university_guidance";
  const scopedGuidanceValues = guidanceCost && row.values && typeof row.values === "object"
    ? { undergraduate_home_expected_tuition_gbp: row.values.undergraduate_home_expected_tuition_gbp }
    : {};
  const priceFacts = Array.isArray(row.price_facts) ? row.price_facts : [];
  const values = deadlineNotPublished ? [] : kind === "cost" && (priceFacts.length || priceNotPublished || priceConflicting)
    ? programCoveragePriceFactStrings([...priceFacts, ...(Array.isArray(row.publication_facts) ? row.publication_facts : [])])
    : programCoverageValueStrings(guidanceCost ? scopedGuidanceValues : row.values);
  const sourceUrl = programCoverageSourceUrl(row.source_url);
  const cycle = localizedProgramCoverageCycle(row.cycle);
  const verifiedAt = String(row.verified_at || "").trim();
  const nextAction = deadlineConflicting
    ? t("university.program_coverage.next_action.deadline_conflicting", "Compare the official admissions pages and confirm the applicable deadline with the university.")
    : priceConflicting
      ? t("university.program_coverage.next_action.price_conflicting", "Compare the official fee pages and confirm the applicable rate with the university.")
      : priceNotPublished
      ? t("university.program_coverage.next_action.price_not_published", "Check the official fee page when current rates are published.")
      : row.status === "not_catalogued"
        ? deadlineNotPublished
          ? t("university.program_coverage.next_action.deadline_not_published", "Check the official admissions page for updates to the deadline.")
          : t(`university.program_coverage.next_action.${kind}`, "Check the official course page for this entry cycle.")
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
  const routeWideDeadline = ["shared_admission_route", "institution_wide_route", "route_wide", "institution_wide"].includes(row.deadline?.scope);
  return `<section class="program-coverage" aria-label="${escapeHtmlAttr(heading)}">
    <h3 class="program-coverage__title">${escapeHtml(heading)}</h3>
    ${programName ? `<p class="program-coverage__program">${escapeHtml(trProgramName(programName) || programName)}</p>` : ""}
    <div class="program-coverage__facts">
      ${renderProgramCoverageFact("university.program_coverage.requirements", "Requirements", row.requirements, "requirements")}
      ${renderProgramCoverageFact(routeWideDeadline ? "university.program_coverage.route_deadline" : "university.program_coverage.course_deadline", routeWideDeadline ? "Application deadline" : "Course application deadline", row.deadline, "deadline")}
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
