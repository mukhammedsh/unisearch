import { escapeHtml, escapeHtmlAttr, markMotionEnter, motionPress } from "../../utils.js";
import { t } from "../../i18n.js";
import { applyPercentWidths } from "../../university-detail-helpers.js";
import { translateWord } from "../../university-translations.js";
import { bindInfoTooltips } from "../../tooltip.js";
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

  let rankHtml = `<span>${escapeHtml(t("common.no_data", "No data"))}</span>`;
  if (officialRank) {
    rankHtml = `<span class="d-rank-emphasis">#${university.rank}</span>`;
  } else if (rankStatus) {
    rankHtml = `<span>${escapeHtml(rankingStatusLabel(rankStatus))}</span>`;
  }

  const campusSizeRaw = typeof university.student_life?.size === "string" ? String(university.student_life.size).trim() : "";
  const campusSize = campusSizeRaw
    ? escapeHtml(formatCampusSizeValue(campusSizeRaw))
    : escapeHtml(t("common.no_data", "No data"));
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
          <span class="uni-tag uni-tag--placeholder">${escapeHtml(t("common.no_data", "No data"))}</span>
        </div>
      </div>
    `;
  const studentCountValue = toFiniteNumber(university?.student_count);
  const studentCount = studentCountValue !== null
    ? new Intl.NumberFormat("en-US").format(studentCountValue)
    : t("common.no_data", "No data");
  const formats = Array.isArray(university.academics?.formats)
    ? university.academics.formats.map((value) => escapeHtml(trStudyMode(String(value)))).filter(Boolean).join(", ")
    : "";

  container.innerHTML = `
    ${description}
    ${tagsHtml}
    <div class="d-kv"><span>${escapeHtml(translateWord("total_students", "Total Students"))}</span><span>${escapeHtml(studentCount)}</span></div>
    <div class="d-kv d-kv--last"><span>${escapeHtml(translateWord("study_formats", "Study Formats"))}</span><span>${formats || escapeHtml(t("common.no_data", "No data"))}</span></div>
  `;
}

const programSearchQueryByUniversity = new Map();
const programOpenKeyByUniversity = new Map();

export function renderProgramsSection({
  admissionsData,
  container,
  university,
  profileMajor = "",
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

    container.innerHTML = `
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
        ${items.map((item, displayIdx) => {
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
        if (!wasOpen) applyPercentWidths(card);
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
    container.innerHTML = `${majorsHtml}${renderSignalRows(signalRows)}`;
  }

  applyPercentWidths(container);
  markMotionEnter(container, ".program-card, .program-major-chip, .program-signal, .program-empty", { limit: 18, staggerMs: 18 });
}
