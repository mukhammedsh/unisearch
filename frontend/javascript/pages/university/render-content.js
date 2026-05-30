import { escapeHtml, escapeHtmlAttr, markMotionEnter } from "../../utils.js";
import { t } from "../../i18n.js";
import { applyPercentWidths } from "../../university-detail-helpers.js";
import { translateWord } from "../../university-translations.js";
import { bindInfoTooltips } from "../../tooltip.js";
import {
  formatCampusSizeValue,
  formatUiNumber,
  localizeDuration,
  renderAdmissionsOverview,
  renderInlineIcon,
  renderProgramAdmissionsSignals,
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
    <div class="d-kv"><span>${escapeHtml(translateWord("global_rank", "Global Rank"))}</span>${rankHtml}</div>
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

export function renderProgramsSection({
  admissionsData,
  container,
  university,
}) {
  if (!container) return;

  const programs = Array.isArray(university?.academics?.programs)
    ? university.academics.programs.filter((program) => program && typeof program === "object")
    : [];
  const admissionsProgramsHtml = renderProgramAdmissionsSignals(admissionsData);

  const prettyField = (key) =>
    String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const isMajorTagField = (key) => {
    const normalized = String(key || "").trim().toLowerCase();
    return normalized === "major_tags" || normalized === "majors" || normalized === "applicable_majors";
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
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (String(key) === "acceptance_rate_percent") return `${value}%`;
    if (String(key) === "study_mode") return trStudyMode(String(value));
    if (String(key) === "duration") return localizeDuration(value);
    return String(value);
  };

  const renderValueCell = (label, key, rawValue, formattedValue) => {
    if (Array.isArray(rawValue) && rawValue.length) {
      const translatedItems = rawValue.map((item) => {
        const raw = String(item);
        if (String(key) === "study_levels") return trStudyLevel(raw);
        if (String(key) === "language") return trProgramLanguage(raw);
        if (String(key) === "study_mode") return trStudyMode(raw);
        if (isMajorTagField(key)) return trProgramName(raw) || raw;
        return raw;
      });
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

  if (programs.length) {
    const knownKeys = new Set(["name", "study_levels", "acceptance_rate_percent", "duration", "language", "study_mode"]);
    container.innerHTML = `
      <div class="program-list">
        ${programs.map((program, idx) => {
          const programAcceptance = toFiniteNumber(program.acceptance_rate_percent);
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
            .filter(([key, value]) => !knownKeys.has(key) && value !== null && value !== undefined && value !== "")
            .map(([key, value]) => ({
              label: (key === "major_tags" || key === "majors")
                ? translateWord("fields_of_study", "Fields of study")
                : (key === "applicable_majors"
                  ? t("placeholder.field.applicable_majors", "Applicable majors")
                  : prettyField(key)),
              key,
              rawValue: value,
              value: formatProgramValue(key, value),
            }));

          const allRows = [...rows, ...extraRows];
          return `
            <div class="program-card">
              <div class="program-card-head">
                <span class="program-card-index">${escapeHtml(translateWord("program", "Program"))} ${idx + 1}</span>
              </div>
              <div class="program-card-title">
                ${escapeHtml(trProgramName(program.name || "") || unknownFieldText("placeholder.field.program_name", "Program name"))}
              </div>
              <div class="program-card-rows">
                ${allRows.map((row) => `
                  <div class="program-card-row">
                    <span class="program-card-label">${escapeHtml(row.label)}</span>
                    ${renderValueCell(row.label, row.key, row.rawValue, row.value)}
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
      ${admissionsProgramsHtml}
    `;
  } else {
    const majors = Array.isArray(university?.academics?.majors)
      ? university.academics.majors.map((major) => String(major || "").trim()).filter(Boolean)
      : [];
    const majorsHtml = majors.length
      ? majors.map((major) => `<span class="program-major-chip">${escapeHtml(trProgramName(major))}</span>`).join(" ")
      : `<div class="program-empty">${escapeHtml(unknownFieldText("placeholder.field.programs", "Programs"))}</div>`;
    container.innerHTML = `${majorsHtml}${admissionsProgramsHtml}`;
  }

  applyPercentWidths(container);
  markMotionEnter(container, ".program-card, .program-major-chip, .admissions-summary-card, .admissions-program-card, .program-empty", { limit: 18, staggerMs: 18 });
}
