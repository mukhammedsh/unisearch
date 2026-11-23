import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { t } from "../../i18n.js";
import { humanizeMachineLabel, translateWord } from "../../university-translations.js";
import { bindInfoTooltips } from "../../tooltip.js";
import {
  campusAreaFact,
  formatUiNumber,
  rankingStatusLabel,
  renderInlineIcon,
  safeUrl,
  toFiniteNumber,
  trFactSource,
  trStudyMode,
  trTag,
  trUniversityDescription,
  unknownFieldText,
} from "../_shared.js";
import {
  getProgramLevelKeys,
  renderCoverageSection,
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
  renderCoverageSection,
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

function disclosure(summary, body) {
  return `<details class="d-fact-scope"><summary>${escapeHtml(summary)}${renderInlineIcon("chevron-down", 14, "admissions-disclosure-icon")}</summary>${body}</details>`;
}

// `expandScope` prints the scope as plain text, for sources that already sit inside a disclosure.
function metricSourceLink(url, label, checkedAt = "", scope = "", expandScope = false) {
  const href = safeUrl(url);
  if (!href) return "";
  const checked = String(checkedAt || "").trim();
  const date = checked ? `${t("university.admissions.checked", "Last checked")}: ${checked}` : t("university.admissions.check_date_unrecorded", "Check date not recorded");
  const scopeLabel = t("university.admissions.catalog.scope", "Source scope");
  // The scope is the longest and least often needed part, so it sits in a collapsed disclosure under the link and date.
  const scopeLine = !scope ? ""
    : expandScope ? `<span>${escapeHtml(scopeLabel)}: ${escapeHtml(scope)}</span>`
      : disclosure(scopeLabel, `<span>${escapeHtml(scope)}</span>`);
  return `<span class="d-fact-source"><a href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || t("university.admissions.official_source", "Official source"))}</a><span>${escapeHtml(date)}</span>${scopeLine}</span>`;
}

export function renderOverviewSection({
  acceptanceMeta,
  acceptanceRate,
  container,
  includeAdmissionRate = true,
  officialRank,
  rankStatus,
  university,
}) {
  if (!container) return;

  const acceptanceDisplay = acceptanceRate === null
    ? t("common.no_data", "No data")
    : `${Math.round(acceptanceRate * 100) / 100}%`;
  const acceptanceSourceUrl = safeUrl(acceptanceMeta?.source_url);
  const acceptanceSource = String(acceptanceMeta?.source || "").trim();
  const acceptanceSourceLabel = acceptanceSource ? trFactSource(acceptanceSource) : t("university.admissions.official_source", "Official source");
  const acceptanceChecked = String(acceptanceMeta?.verified_at || "").trim();
  const acceptanceBasis = acceptanceMeta?.basis && typeof acceptanceMeta.basis === "object" ? acceptanceMeta.basis : {};
  const acceptanceCycle = String(acceptanceBasis?.cycle || "").trim();
  const acceptanceApplicants = toFiniteNumber(acceptanceBasis?.applicants);
  const acceptanceAdmitted = toFiniteNumber(acceptanceBasis?.admitted);
  const acceptanceInfoTitle = escapeHtml(t("university.admissions.official_source", "Official source"));
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
  const acceptanceRow = `
    <div class="d-kv">
      <span class="d-kv-label">
        ${escapeHtml(acceptanceLabel)}
        ${acceptanceTooltip}
      </span>
      <span>${escapeHtml(acceptanceDisplay)}</span>
    </div>
  `;

  const rankMeta = university && typeof university.rank_meta === "object" ? university.rank_meta : {};
  const rankSourceValue = String(rankMeta.source || "").trim();
  const rankSource = rankSourceValue ? trFactSource(rankSourceValue) : "";
  const rankSourceUrl = safeUrl(rankMeta.source_url);
  const rankVerifiedAt = String(rankMeta.verified_at || "").trim();
  const rankInfoTitle = escapeHtml(translateWord("global_rank", "Global Rank"));
  const rankTooltip = rankSource && !rankSourceUrl ? `
    <span class="d-info-wrap">
      <button type="button" class="d-info" aria-label="${rankInfoTitle}" title="${rankInfoTitle}">${renderInlineIcon("information-circle", 14, "d-info-icon")}</button>
      <span class="d-tooltip" role="tooltip">
        <strong>${rankInfoTitle}</strong>
        <span>${escapeHtml(rankSource)}</span>
        ${!officialRank && rankStatus ? `<span>${escapeHtml(rankingStatusLabel(rankStatus))}</span>` : ""}
        ${rankVerifiedAt ? `<span>${escapeHtml(t("university.admissions.checked", "Checked"))}: ${escapeHtml(rankVerifiedAt)}</span>` : ""}
      </span>
    </span>
  ` : "";

  let rankValueHtml = `<span>${escapeHtml(t("common.no_data", "No data"))}</span>`;
  if (officialRank) {
    rankValueHtml = `<span class="d-rank-emphasis">#${university.rank}</span>`;
  } else if (rankStatus) {
    rankValueHtml = `<span>${escapeHtml(rankingStatusLabel(rankStatus))}</span>`;
  }
  const rankSourceLink = rankSourceUrl ? metricSourceLink(rankSourceUrl,
    rankSource || t("university.admissions.official_source", "Official source"), rankVerifiedAt) : "";
  const rankHtml = `<span class="d-kv-value">${rankValueHtml}${rankSourceLink}</span>`;

  const campusArea = campusAreaFact(university.student_life);
  const studentCountValue = toFiniteNumber(university?.student_count);
  const studentCount = studentCountValue !== null ? formatUiNumber(studentCountValue) : t("common.no_data", "No data");
  const studentCountFact = university?.fact_provenance?.facts?.student_count;
  const studentCountScope = String(studentCountFact?.basis?.scope || "").trim();
  const studentCountSource = metricSourceLink(studentCountFact?.source_url,
    trFactSource(studentCountFact?.source) || t("university.admissions.official_source", "Official source"), studentCountFact?.verified_at, studentCountScope);
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
  const formatSources = [...formatSourceMap.values()].map((source) => {
    const modes = [...source.modes].map(trStudyMode);
    const title = [...source.titles].join(" · ") || new URL(source.url).hostname.replace(/^www\./, "");
    const label = [...modes, title].filter(Boolean).join(" · ");
    return metricSourceLink(source.url, label, [...source.dates].join(", "), [...source.scopes].join("; "), true);
  }).filter(Boolean);
  // Program-level wording (for example one evening professional program) does not describe the whole university:
  // the overview names only the recognised formats and keeps the original values when none is recognised.
  // Formats are shown only with a linked official source, so reviewed-catalog modes without one stay hidden.
  const formats = formatSources.length && formatValues.length
    ? formatValues.length > 3
      ? `<details class="admissions-catalog__evidence"><summary>${escapeHtml(t("university.admissions.reading.formats_vary"))}${renderInlineIcon("chevron-down", 14, "admissions-disclosure-icon")}</summary><ul class="admissions-catalog__items">${formatValues.map((value) => `<li>${value}</li>`).join("")}</ul></details>`
      : formatValues.join(", ")
    : "";
  // Sources and the availability note share one collapsed disclosure, so the row stays a value plus one line.
  const formatSourcesBlock = formatSources.length
    ? disclosure(t(formatSources.length > 1 ? "university.ux2.sources.many" : "university.ux2.sources.one"),
      `${formatSources.join("")}<span class="d-fact-source">${escapeHtml(t("university.ux2.format_scope_note"))}</span>`)
    : "";

  // A row without data is left out rather than shown as "No data"; the last remaining row drops its divider.
  const rows = [
    `<div class="d-kv">
      <span class="d-kv-label">
        ${escapeHtml(translateWord("global_rank", "Global Rank"))}:
        ${rankTooltip}
      </span>
      ${rankHtml}
    </div>`,
    includeAdmissionRate ? acceptanceRow : "",
    `<div class="d-kv"><span>${escapeHtml(translateWord("total_students", "Total Students"))}</span><span class="d-kv-value"><span>${escapeHtml(studentCount)}</span>${studentCountSource}</span></div>`,
    formats ? `<div class="d-kv"><span>${escapeHtml(translateWord("study_formats", "Study Formats"))}</span><div class="d-study-formats">${formats}${formatSourcesBlock}</div></div>` : "",
    campusArea ? `<div class="d-kv" data-campus-area><span>${escapeHtml(t("university.ux2.campus.area_label"))}</span><div class="d-campus-area"><span>${escapeHtml(campusArea.text)}</span>${campusArea.comparison ? `<span class="d-campus-area__note">${escapeHtml(campusArea.comparison)}</span>` : ""}${campusArea.sourceUrl ? metricSourceLink(campusArea.sourceUrl, campusArea.sourceTitle || t("university.ux2.campus.source"), campusArea.checkedAt, campusArea.scope) : ""}</div></div>` : "",
  ].filter(Boolean);
  const last = rows.length - 1;
  rows[last] = rows[last].replace('class="d-kv', 'class="d-kv d-kv--last');
  container.innerHTML = rows.join("");
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
          ${tags.map((tag) => {
            const translated = trTag(tag);
            const display = translated === tag ? humanizeMachineLabel(tag, tag) : translated;
            return `<span class="uni-tag">${escapeHtml(display)}</span>`;
          }).join("")}
        </div>
      </div>
    `
    : `
      <div class="uni-tags-wrap">
        <div class="uni-tags-title">${escapeHtml(translateWord("focus_tags", "Focus Tags"))}</div>
        <div class="uni-tags-list">
          <span class="uni-tag uni-tag--placeholder">${escapeHtml(t("common.no_data", "No data"))}</span>
        </div>
      </div>
    `;
  container.innerHTML = `
    ${description}
    ${tagsHtml}
  `;
}
