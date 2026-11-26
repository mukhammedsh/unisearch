import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { t } from "../../i18n.js";
import { translateWord } from "../../university-translations.js";
import { bindInfoTooltips } from "../../tooltip.js";
import {
  campusAreaFact,
  formatUiNumber,
  renderInlineIcon,
  safeUrl,
  toFiniteNumber,
  trFactSource,
  trStudyMode,
  trUniversityDescription,
} from "../_shared.js";
import {
  getProgramLevelKeys,
  renderProgramCoverage,
  resolveDisplayedCoverageProgram,
  resolveProgramByIdentifier,
  resolveProgramByName,
  resolveProgramCoverage,
} from "./program-coverage.js";
import { renderProgramsSection } from "./programs-section.js";
import { renderQualificationGuidance, resolveQualificationGuidance } from "./qualification-guidance.js";

export {
  getProgramLevelKeys,
  renderProgramCoverage,
  resolveDisplayedCoverageProgram,
  resolveProgramByIdentifier,
  resolveProgramByName,
  resolveProgramCoverage,
  renderProgramsSection,
  renderQualificationGuidance,
  resolveQualificationGuidance,
};

// Groups free-text program formats into the university-level formats an applicant compares: campus, hybrid, online.
// "Full-time", "evening" or other schedule wording names no format and is left to the program pages.
export function universityStudyFormats(values) {
  const found = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").toLowerCase();
    // A mixed format is one hybrid format, not separate campus and online options.
    if (/\b(hybrid|blended|low-residency)\b/.test(text)) {
      found.add("hybrid");
      continue;
    }
    // The detail API returns these values already translated, so the Russian and Kazakh forms are matched as well.
    if (/\b(online|distance|remote)\b|онлайн|дистанц|қашықтан/.test(text)) found.add("online");
    if (/\b(on-campus|on campus|campus|in-person|in person|residential)\b|on_campus|кампус/.test(text)) found.add("on_campus");
  }
  return ["on_campus", "hybrid", "online"].filter((bucket) => found.has(bucket));
}

function renderSourceEntry({ checkedAt = "", label = "", scope = "", url = "" }) {
  const href = safeUrl(url);
  if (!href) return "";
  const checked = String(checkedAt || "").trim();
  const date = checked
    ? `${t("university.admissions.checked", "Last checked")}: ${checked}`
    : t("university.admissions.check_date_unrecorded", "Check date not recorded");
  const title = label || t("university.admissions.official_source", "Official source");
  const scopeLabel = t("university.admissions.catalog.scope", "Source scope");
  const scopeHtml = scope
    ? `<p class="d-fact-source__scope"><span class="d-fact-source__scope-label">${escapeHtml(scopeLabel)}:</span> ${escapeHtml(scope)}</p>`
    : "";
  return `<div class="d-fact-source">
    <div class="d-fact-source__head">
      <a class="d-fact-source__link" href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(title)}</span>${renderInlineIcon("arrow-up-right", 12, "d-fact-source__ext")}</a>
      <span class="d-fact-source__date">${escapeHtml(date)}</span>
    </div>
    ${scopeHtml}
  </div>`;
}

function renderFactsStrip(facts) {
  const cells = facts.map((fact) => `<div class="d-kv"${fact.rowAttr || ""}>
    <span class="d-kv-label">${renderInlineIcon(fact.icon, 16, "d-kv-icon")}<span>${escapeHtml(fact.label)}</span>${fact.tooltipHtml || ""}</span>
    <div class="d-kv-body${fact.bodyClass ? ` ${fact.bodyClass}` : ""}">${fact.valueHtml}${fact.subHtml || ""}</div>
  </div>`);
  return `<div class="d-facts-strip" data-count="${facts.length}">${cells.join("")}</div>`;
}

function renderFactSources(groups) {
  const validGroups = groups
    .map((group) => ({
      ...group,
      items: group.entries.map(renderSourceEntry).filter(Boolean),
    }))
    .filter((group) => group.items.length > 0);
  if (!validGroups.length) return "";
  const totalCount = validGroups.reduce((sum, group) => sum + group.items.length, 0);
  const summaryLabel = t(totalCount > 1 ? "university.ux2.sources.many" : "university.ux2.sources.one");
  const rows = validGroups.map((group) => `<div class="d-facts-sources__row">
    <dt class="d-facts-sources__metric">${escapeHtml(group.label)}</dt>
    <dd class="d-facts-sources__entries">${group.items.join("")}${group.note ? `<p class="d-fact-source__note">${escapeHtml(group.note)}</p>` : ""}</dd>
  </div>`);
  return `<details class="d-facts-sources">
    <summary class="d-facts-sources__summary">
      ${renderInlineIcon("document-check", 16, "d-facts-sources__icon")}
      <span>${escapeHtml(summaryLabel)}</span>
      <span class="d-facts-sources__count">${totalCount}</span>
      ${renderInlineIcon("chevron-down", 14, "d-facts-sources__chevron")}
    </summary>
    <div class="d-facts-sources__panel">
      <dl class="d-facts-sources__list">${rows.join("")}</dl>
    </div>
  </details>`;
}

export function renderOverviewSection({
  acceptanceMeta,
  acceptanceRate,
  container,
  includeAdmissionRate = true,
  officialRank,
  university,
}) {
  if (!container) return;

  const officialSourceLabel = t("university.admissions.official_source", "Official source");
  const facts = [];
  const sourceGroups = [];

  const rankValue = toFiniteNumber(university?.rank);
  if (officialRank && rankValue !== null && rankValue > 0) {
    const rankLabel = translateWord("global_rank", "Global Rank");
    const rankMeta = university && typeof university.rank_meta === "object" ? university.rank_meta : {};
    const rankSourceValue = String(rankMeta.source || "").trim();
    const rankSource = rankSourceValue ? trFactSource(rankSourceValue) : "";
    const rankSourceUrl = safeUrl(rankMeta.source_url);
    const rankVerifiedAt = String(rankMeta.verified_at || "").trim();
    const rankInfoTitle = escapeHtml(rankLabel);
    const rankTooltip = rankSource && !rankSourceUrl ? `
      <span class="d-info-wrap">
        <button type="button" class="d-info" aria-label="${rankInfoTitle}" title="${rankInfoTitle}">${renderInlineIcon("information-circle", 14, "d-info-icon")}</button>
        <span class="d-tooltip" role="tooltip">
          <strong>${rankInfoTitle}</strong>
          <span>${escapeHtml(rankSource)}</span>
          ${rankVerifiedAt ? `<span>${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(rankVerifiedAt)}</span>` : ""}
        </span>
      </span>
    ` : "";

    facts.push({
      icon: "trophy",
      label: rankLabel,
      tooltipHtml: rankTooltip,
      valueHtml: `<span class="d-kv-metric d-rank-emphasis">#${rankValue}</span>`,
      subHtml: rankSource ? `<span class="d-kv-sub">${escapeHtml(rankSource)}</span>` : "",
    });
    if (rankSourceUrl) {
      sourceGroups.push({
        label: rankLabel,
        entries: [{ url: rankSourceUrl, label: rankSource || officialSourceLabel, checkedAt: rankVerifiedAt }],
      });
    }
  }

  if (includeAdmissionRate && acceptanceRate !== null && acceptanceRate !== undefined) {
    const acceptanceDisplay = `${Math.round(acceptanceRate * 100) / 100}%`;
    const acceptanceSourceUrl = safeUrl(acceptanceMeta?.source_url);
    const acceptanceSource = String(acceptanceMeta?.source || "").trim();
    const acceptanceSourceLabel = acceptanceSource ? trFactSource(acceptanceSource) : officialSourceLabel;
    const acceptanceChecked = String(acceptanceMeta?.verified_at || "").trim();
    const acceptanceBasis = acceptanceMeta?.basis && typeof acceptanceMeta.basis === "object" ? acceptanceMeta.basis : {};
    const acceptanceCycle = String(acceptanceBasis?.cycle || "").trim();
    const acceptanceApplicants = toFiniteNumber(acceptanceBasis?.applicants);
    const acceptanceAdmitted = toFiniteNumber(acceptanceBasis?.admitted);
    const acceptanceInfoTitle = escapeHtml(officialSourceLabel);
    const acceptanceKind = String(university?.academics?.admissions?.university_wide?.kind || "").trim().toLowerCase();
    const acceptanceLabel = acceptanceKind.startsWith("undergraduate")
      ? t("ranking.acceptance_undergraduate", "Undergraduate acceptance rate")
      : t("ranking.acceptance", "Acceptance Rate");
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
    facts.push({
      icon: "chart-bar",
      label: acceptanceLabel,
      tooltipHtml: acceptanceTooltip,
      valueHtml: `<span class="d-kv-metric">${escapeHtml(acceptanceDisplay)}</span>`,
    });
  }

  const studentCountValue = toFiniteNumber(university?.student_count);
  if (studentCountValue !== null && studentCountValue > 0) {
    const studentsLabel = translateWord("total_students", "Total Students");
    const studentCountFact = university?.fact_provenance?.facts?.student_count;
    const studentCountScope = String(studentCountFact?.basis?.scope || "").trim();
    facts.push({
      icon: "users",
      label: studentsLabel,
      valueHtml: `<span class="d-kv-metric">${escapeHtml(formatUiNumber(studentCountValue))}</span>`,
    });
    if (safeUrl(studentCountFact?.source_url)) {
      sourceGroups.push({
        label: studentsLabel,
        entries: [{
          url: studentCountFact.source_url,
          label: trFactSource(studentCountFact.source) || officialSourceLabel,
          checkedAt: studentCountFact.verified_at,
          scope: studentCountScope,
        }],
      });
    }
  }

  const rawFormats = Array.isArray(university.academics?.formats) ? university.academics.formats : [];
  const formatBuckets = universityStudyFormats(rawFormats);
  const formatValues = formatBuckets.length
    ? formatBuckets.map((bucket) => escapeHtml(bucket === "hybrid" ? t("university.ux2.format.hybrid") : trStudyMode(bucket === "online" ? "Online" : "On-campus")))
    : [...new Set(rawFormats
      .filter((value) => String(value || "").trim().toLowerCase() !== "not_stated")
      .map((value) => escapeHtml(trStudyMode(String(value))))
      .filter(Boolean))];
  const formatSourceMap = new Map();
  for (const source of Array.isArray(university?.verified_sources) ? university.verified_sources : []) {
    if (source?.topic !== "formats") continue;
    const url = safeUrl(source.url);
    if (!url) continue;
    let entry = formatSourceMap.get(url);
    if (!entry) formatSourceMap.set(url, entry = { url, titles: new Set(), modes: new Set(), scopes: new Set(), dates: new Set() });
    if (source.title) entry.titles.add(trFactSource(source.title) || source.title);
    if (source.scope) entry.scopes.add(source.scope);
    if (source.checked_at) entry.dates.add(source.checked_at);
    for (const mode of Array.isArray(source.format_modes) ? source.format_modes : []) entry.modes.add(mode);
  }
  const formatEntries = [...formatSourceMap.values()].map((source) => {
    const modes = [...source.modes].map(trStudyMode);
    const title = [...source.titles].join(" · ") || new URL(source.url).hostname.replace(/^www\./, "");
    return {
      url: source.url,
      label: [...modes, title].filter(Boolean).join(" · "),
      checkedAt: [...source.dates].join(", "),
      scope: [...source.scopes].join("; "),
    };
  });
  // Program-level wording (for example one evening professional program) does not describe the whole university:
  // the overview names only the recognised formats and keeps the original values when none is recognised.
  // Formats are shown only with a linked official source, so reviewed-catalog modes without one stay hidden.
  if (formatEntries.length && formatValues.length) {
    const formatsLabel = translateWord("study_formats", "Study Formats");
    const formatsHtml = formatValues.length > 3
      ? `<details class="admissions-catalog__evidence motion-disclosure"><summary>${escapeHtml(t("university.admissions.reading.formats_vary"))}${renderInlineIcon("chevron-down", 14, "admissions-disclosure-icon")}</summary><ul class="admissions-catalog__items">${formatValues.map((value) => `<li>${value}</li>`).join("")}</ul></details>`
      : `<span class="d-kv-metric">${formatValues.join(", ")}</span>`;
    facts.push({
      icon: "academic-cap",
      label: formatsLabel,
      bodyClass: "d-study-formats",
      valueHtml: formatsHtml,
    });
    sourceGroups.push({
      label: formatsLabel,
      entries: formatEntries,
      note: t("university.ux2.format_scope_note"),
    });
  }

  const campusArea = campusAreaFact(university.student_life);
  if (campusArea) {
    const campusLabel = t("university.ux2.campus.area_label");
    facts.push({
      icon: "map",
      label: campusLabel,
      rowAttr: " data-campus-area",
      bodyClass: "d-campus-area",
      valueHtml: `<span class="d-kv-metric">${escapeHtml(campusArea.text)}</span>`,
      subHtml: campusArea.comparison ? `<span class="d-kv-sub d-campus-area__note">${escapeHtml(campusArea.comparison)}</span>` : "",
    });
    if (safeUrl(campusArea.sourceUrl)) {
      sourceGroups.push({
        label: campusLabel,
        entries: [{
          url: campusArea.sourceUrl,
          label: campusArea.sourceTitle || t("university.ux2.campus.source"),
          checkedAt: campusArea.checkedAt,
          scope: campusArea.scope,
        }],
      });
    }
  }

  const syncAboutBox = (node) => {
    const box = node?.closest?.(".d-box");
    if (!box) return;
    const panels = typeof box.querySelectorAll === "function" ? [...box.querySelectorAll(".d-box-text")] : [];
    if (panels.length) box.hidden = panels.every((panel) => panel.hidden);
  };

  if (!facts.length) {
    container.innerHTML = "";
    container.hidden = true;
    syncAboutBox(container);
    return;
  }
  container.hidden = false;
  container.innerHTML = `${renderFactsStrip(facts)}${renderFactSources(sourceGroups)}`;
  syncAboutBox(container);
  bindInfoTooltips({ wrapSelector: ".d-info-wrap", buttonSelector: ".d-info" });
}

export function renderExtraSection({ container, university }) {
  if (!container) return;

  const translatedDescription = trUniversityDescription(university);
  const description = translatedDescription
    ? `<p class="uni-description">${escapeHtml(String(translatedDescription)).replace(/\n/g, "<br>")}</p>`
    : "";
  const box = container.closest?.(".d-box");
  if (!description) {
    container.innerHTML = "";
    container.hidden = true;
  } else {
    container.hidden = false;
    container.innerHTML = description;
  }
  if (box && typeof box.querySelectorAll === "function") {
    const panels = [...box.querySelectorAll(".d-box-text")];
    if (panels.length) box.hidden = panels.every((panel) => panel.hidden);
  }
}
