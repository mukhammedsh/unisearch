import { escapeHtml, escapeHtmlAttr, markMotionEnter, motionPress } from "../../utils.js";
import { t } from "../../i18n.js";
import { applyPercentWidths } from "../../university-detail-helpers.js";
import { translateWord } from "../../university-translations.js";
import { loadProfile } from "../../utils/persistence.js";
import {
  admissionsDataTypeKey,
  admissionsDataTypeLabel,
  admissionsFactChips,
  admissionsSignalSummary,
  formatStudyLevelCounts,
  localizeDuration,
  renderAdmissionsChipRow,
  renderAdmissionsSourceLink,
  renderInlineIcon,
  safeUrl,
  toFiniteNumber,
  trProgramLanguage,
  trProgramName,
  trStudyLevel,
  trStudyMode,
  trTrackDescription,
  unknownFieldText,
  unknownLabelText,
} from "../_shared.js";
import {
  getProgramLevelKeys,
  getProgramLevelsList,
  normalizeProgramLevelKey,
  renderProgramCoverage,
} from "./program-coverage.js";

const programSearchQueryByUniversity = new Map();
const programOpenKeysByUniversity = new Map();
const programStudyLevelSelectionByUniversity = new Map();

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

  return formatStudyLevelCounts(counts, {
    mbaKey: "university.coverage.level.mba",
    professionalKey: "university.coverage.level.professional",
  });
}

const hiddenProgramMetadata = new Set([
  "id", "source_name", "url", "source_url", "source_urls", "catalog_url", "deadline_source_url", "tuition_source_url",
  "verified_at", "tuition_verified_at", "cycle", "tuition_cycle", "requirements_cycle",
  "currency", "deadlines", "scholarship_eligibility",
  "admission_route_id", "price_facts", "tuition_total_usd", "selection_timing",
]);

function prettyField(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isMajorTagField(key) {
  const normalized = String(key || "").trim().toLowerCase();
  return normalized === "major_tags" || normalized === "majors" || normalized === "applicable_majors";
}

function tokenizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", " ")
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeSignalKey(value) {
  return tokenizeName(value).join(" ");
}

function parentheticalRanges(text) {
  const ranges = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("(", cursor);
    if (start < 0) break;
    const close = text.indexOf(")", start + 1);
    if (close < 0) break;
    ranges.push([start, close + 1]);
    cursor = close + 1;
  }
  return ranges;
}

function stripParenthetical(value) {
  const text = String(value || "");
  const parts = [];
  let cursor = 0;
  for (const [start, end] of parentheticalRanges(text)) {
    parts.push(text.slice(cursor, start), " ");
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return parts.join("");
}

function parenTokenSet(value) {
  const text = String(value || "");
  return new Set(parentheticalRanges(text).flatMap(([start, end]) => tokenizeName(text.slice(start, end))));
}

function formatProgramValue(key, value, universityId = "") {
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
  if (["description", "entry_requirements", "tuition_status", "department"].includes(String(key))) {
    return trTrackDescription(universityId, "", value);
  }
  return String(value);
}

function formatListValue(key, value, universityId = "") {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => {
      const raw = String(item ?? "").trim();
      if (!raw) return "";
      if (String(key) === "study_levels") return trStudyLevel(raw);
      if (String(key) === "language") return trProgramLanguage(raw);
      if (String(key) === "study_mode") return trStudyMode(raw);
      if (isMajorTagField(key)) return trProgramName(raw) || raw;
      if (String(key) === "required_documents") return trTrackDescription(universityId, "", raw);
      return raw;
    })
    .filter(Boolean);
}

function renderValueCell(label, key, rawValue, formattedValue, universityId = "") {
  if (Array.isArray(rawValue) && rawValue.length) {
    const translatedItems = formatListValue(key, rawValue, universityId);
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
}

function renderSignalRows(rows, admissionsData, institutionWideOnly) {
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
}

function matchSignalsToPrograms(programs, signalRows) {
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
  return { signalsByProgram, residualSignalRows };
}

function bindProgramCardEvents({
  container,
  university,
  universityKey,
  expandLabel,
  collapseLabel,
  coverageProgram,
  selectedProgram,
  programs,
  onProgramAdmissionSelected,
  admissionsData,
  profileMajor,
}) {
  const openKeys = programOpenKeysByUniversity.get(universityKey) || new Set();
  programOpenKeysByUniversity.set(universityKey, openKeys);
  const prefersReducedMotion = () =>
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const setToggleState = (button, card, body, isOpen) => {
    const title = card.querySelector(".program-card__title")?.textContent?.trim() || "";
    const label = `${isOpen ? collapseLabel : expandLabel}${title ? `: ${title}` : ""}`;
    body.getAnimations?.().forEach((animation) => animation.cancel());
    const from = body.getBoundingClientRect?.().height || 0;
    card.classList.toggle("is-open", isOpen);
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    button.setAttribute("aria-label", label);
    body.inert = !isOpen;
    body.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) {
      body.removeAttribute("hidden");
    } else if (prefersReducedMotion() || !body.animate) {
      body.setAttribute("hidden", "");
    }
    if (prefersReducedMotion() || !body.animate) return;
    const to = isOpen ? body.scrollHeight : 0;
    if (from === to) return;
    const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-medium")) || 240;
    const animation = body.animate([
      { height: `${from}px`, opacity: isOpen ? 0 : 1 },
      { height: `${to}px`, opacity: isOpen ? 1 : 0 },
    ], { duration, easing: "ease-in-out" });
    if (!isOpen) animation.onfinish = () => {
      if (!card.classList.contains("is-open")) body.setAttribute("hidden", "");
    };
  };

  container.querySelectorAll("[data-program-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".program-card");
      const body = card?.querySelector(".program-card__body");
      if (!card || !body) return;
      const wasOpen = card.classList.contains("is-open");
      setToggleState(button, card, body, !wasOpen);
      const key = card.getAttribute("data-program-key") || "";
      if (key && !wasOpen) openKeys.add(key);
      else openKeys.delete(key);
      if (!wasOpen) applyPercentWidths(card);
    });
  });

  container.querySelectorAll("[data-program-admission]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = programs.find((program) => String(program.id || program.source_name || program.name || "") === button.dataset.programAdmission);
      if (selected && typeof onProgramAdmissionSelected === "function") onProgramAdmissionSelected(selected);
    });
  });

  container.querySelectorAll("[data-program-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      motionPress(btn);
      const lvl = String(btn.getAttribute("data-program-level") || "").trim() || "all";
      programStudyLevelSelectionByUniversity.set(universityKey, lvl);
      renderProgramsSection({ admissionsData, container, university, profileMajor, coverageProgram, selectedProgram, onProgramAdmissionSelected });
    });
  });
}

function bindProgramSearchEvents({ container, universityKey }) {
  const searchInput = container.querySelector("[data-program-search]");
  const searchClear = container.querySelector("[data-program-search-clear]");
  const searchEmpty = container.querySelector("[data-program-empty]");
  const searchForm = container.querySelector("[data-program-search-form]");
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
  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyProgramFilter();
  });
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
}

export function renderProgramsSection({
  admissionsData,
  container,
  university,
  profileMajor = "",
  coverageProgram = null,
  selectedProgram = null,
  onProgramAdmissionSelected = null,
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
  const universityKey = String(university?.id || "").trim();

  if (programs.length) {
    const knownKeys = new Set(["name", "study_levels", "acceptance_rate_percent", "duration", "language", "study_mode", "description"]);
    const { signalsByProgram, residualSignalRows } = matchSignalsToPrograms(programs, signalRows);

    const expandLabel = t("university.programs.expand", "Show details");
    const collapseLabel = t("university.programs.collapse", "Hide details");

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
    const selectedKey = String(selectedProgram?.id || selectedProgram?.source_name || selectedProgram?.name || "").trim();
    const items = programs.map((program, originalIdx) => {
      const title = trProgramName(program.name || "")
        || unknownFieldText("placeholder.field.program_name", "Program name");
      const summaryParts = [
        formatProgramValue("duration", program.duration, university?.id),
        formatListValue("language", program.language, university?.id).join(", "),
        formatProgramValue("study_mode", program.study_mode, university?.id),
      ].filter((part) => String(part || "").trim());
      const fieldParts = [
        ...formatListValue("major_tags", program.major_tags, university?.id),
        ...formatListValue("majors", program.majors, university?.id),
        ...formatListValue("applicable_majors", program.applicable_majors, university?.id),
      ].filter((part, pos, arr) => part && arr.indexOf(part) === pos);
      const summaryText = [...summaryParts, ...fieldParts].filter(Boolean).join(" · ");
      return {
        program,
        originalIdx,
        key: normalizeSignalKey(program?.source_name || program?.name) || `program-${originalIdx}`,
        title,
        summaryText,
        haystack: normalizeSignalKey(`${title} ${summaryText} ${program?.name || ""} ${program?.source_name || ""}`),
        isSelected: Boolean(selectedKey && selectedKey === String(program?.id || program?.source_name || program?.name || "").trim()),
        isMajorMatch: programMatchesMajor(program),
      };
    }).sort((a, b) => Number(b.isSelected) - Number(a.isSelected) || Number(b.isMajorMatch) - Number(a.isMajorMatch));
    const storedOpenKeys = programOpenKeysByUniversity.get(universityKey) || new Set();

    const availableLevels = getAvailableProgramLevels(programs);
    let activeLevelStored = programStudyLevelSelectionByUniversity.get(universityKey);
    if (!activeLevelStored) {
      const profileStudyLevel = normalizeProgramLevelKey(loadProfile()?.studyLevel);
      const selectedLevel = selectedProgram ? getProgramLevelKeys(selectedProgram).find((key) => availableLevels.some((level) => level.key === key)) : "";
      if (selectedLevel) {
        activeLevelStored = selectedLevel;
      } else if (availableLevels.some((l) => l.key === profileStudyLevel)) {
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
    const levelFilterHtml = availableLevels.length > 1
      ? `
        <div class="programs-level-filter" role="group" aria-label="${escapeHtmlAttr(t("university.programs.filter_by_level", "Filter programs by degree level"))}">
          <button type="button" class="programs-level-tab${activeLevelKey === "all" ? " is-active" : ""}" data-program-level="all">${escapeHtml(t("university.programs.all_levels", "All levels"))} (${programs.length})</button>
          ${availableLevels.map((lvl) => `
            <button type="button" class="programs-level-tab${activeLevelKey === lvl.key ? " is-active" : ""}" data-program-level="${escapeHtmlAttr(lvl.key)}">${escapeHtml(lvl.label)} (${lvl.count})</button>
          `).join("")}
        </div>
      `
      : "";

    container.innerHTML = `
      ${levelFilterHtml}
      <form class="admissions-programs__toolbar admissions-programs__toolbar--catalog" data-program-search-form>
        <div class="admissions-context__field">
          <label for="program-search-input">${escapeHtml(t("university.admissions.catalog.search_label", "Study option or subject"))}</label>
          <span class="program-search">
            ${renderInlineIcon("magnifying-glass", 18, "program-search__icon")}
            <input
              type="search"
              id="program-search-input"
              class="program-search__input"
              maxlength="200"
              placeholder="${escapeHtmlAttr(t("university.programs.search_placeholder", "Search programs..."))}"
              autocomplete="off"
              data-program-search
            />
            <button type="button" class="program-search__clear" data-program-search-clear hidden aria-label="${escapeHtmlAttr(t("university.programs.search_clear", "Clear search"))}">
              ${renderInlineIcon("x-mark", 16)}
            </button>
          </span>
        </div>
        <button type="submit" data-program-search-submit>${escapeHtml(t("university.admissions.catalog.search", "Search"))}</button>
      </form>
      <div class="program-list" role="list">
        ${displayItems.map((item, displayIdx) => {
          const { program, key, title, haystack } = item;
          const isOpen = storedOpenKeys.has(key);
          const matchedSignals = signalsByProgram.get(item.originalIdx) || [];
          const sourceUrl = safeUrl(program.url);
          const catalogUrl = safeUrl(program.catalog_url);
          const referenceUrl = safeUrl(program.source_url);
          const tuitionSourceUrl = safeUrl(program.tuition_source_url);
          const deadlineSourceUrl = safeUrl(program.deadline_source_url);
          const description = trTrackDescription(university?.id, "", program.description || "");
          const originalTitle = String(program.source_name || program.name || "").trim();
          const original = title !== originalTitle ? originalTitle : "";
          const kicker = [...getProgramLevelsList(program).map(trStudyLevel), String(program.degree_type || "").trim()].filter(Boolean).join(" · ");
          const selectionToken = String(program.id || originalTitle).trim();
          const bodyId = `program-body-${displayIdx}`;

          const allRows = [
            ...(toFiniteNumber(program.acceptance_rate_percent) !== null ? [{
              label: translateWord("acceptance_rate", "Acceptance Rate"),
              key: "acceptance_rate_percent",
              rawValue: program.acceptance_rate_percent,
              value: formatProgramValue("acceptance_rate_percent", program.acceptance_rate_percent, university?.id),
            }] : []),
            {
              label: translateWord("study_levels", "Study Levels"),
              key: "study_levels",
              rawValue: program.study_levels,
              value: formatProgramValue("study_levels", program.study_levels, university?.id),
            },
            {
              label: translateWord("duration", "Duration"),
              key: "duration",
              rawValue: program.duration,
              value: formatProgramValue("duration", program.duration, university?.id),
            },
            {
              label: translateWord("language", "Language"),
              key: "language",
              rawValue: program.language,
              value: formatProgramValue("language", program.language, university?.id),
            },
            {
              label: translateWord("study_mode", "Study Mode"),
              key: "study_mode",
              rawValue: program.study_mode,
              value: formatProgramValue("study_mode", program.study_mode, university?.id),
            },
          ].filter(({ rawValue }) => rawValue != null && rawValue !== "" && (!Array.isArray(rawValue) || rawValue.length));
          const basicRowCount = allRows.length;
          Object.entries(program).forEach(([k, v]) => {
            if (hiddenProgramMetadata.has(k) || knownKeys.has(k) || isMajorTagField(k)) return;
            if (v === null || v === undefined || v === "" || (typeof v === "object" && (!Array.isArray(v) || !v.length))) return;
            allRows.push({
              key: k,
              label: t(`university.programs.field.${k}`, prettyField(k)),
              rawValue: v,
              value: formatProgramValue(k, v, university?.id),
            });
          });
          const subjectTags = [
            ...formatListValue("major_tags", program.major_tags, university?.id),
            ...formatListValue("majors", program.majors, university?.id),
            ...formatListValue("applicable_majors", program.applicable_majors, university?.id),
          ].filter((part, pos, parts) => part && parts.indexOf(part) === pos);
          const directions = subjectTags.length
            ? `<p class="program-card__description"><span class="program-card-label">${escapeHtml(t("university.programs.field.subjects"))}:</span> ${subjectTags.map(escapeHtml).join(" · ")}</p>` : "";
          const renderRows = (rows, className = "", plainValues = false) => rows.length ? `<dl class="program-card-rows${className ? ` ${className}` : ""}">
            ${rows.map((row) => `<div class="program-card-row"><dt class="program-card-label">${escapeHtml(row.label)}</dt><dd${plainValues ? ' class="program-card-value"' : ""}>${plainValues ? escapeHtml(row.value) : renderValueCell(row.label, row.key, row.rawValue, row.value, university?.id)}</dd></div>`).join("")}</dl>` : "";
          const signalsHtml = renderSignalRows(matchedSignals, admissionsData, institutionWideOnly);
          const sourceLinks = [
            [sourceUrl, t("university.programs.official_page", "Official program page")],
            [catalogUrl, t("university.programs.official_catalog", "Official degree catalog")],
            [referenceUrl, t("university.admissions.reading.official_source", "Official source")],
            [tuitionSourceUrl, t("university.finance.official_tuition_source", "Official tuition source")],
            [deadlineSourceUrl, t("university.deadlines.official_source", "Official source")],
          ].filter(([url], index, links) => url && links.findIndex(([candidate]) => candidate === url) === index)
            .map(([url, label]) => `<a class="program-card__source" href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}${renderInlineIcon("arrow-top-right-on-square", 16)}</a>`).join("");
          const sourceDate = String(program.verified_at || "").trim();

          const toggleLabel = `${isOpen ? collapseLabel : expandLabel}${title ? `: ${title}` : ""}`;

          return `
            <article class="program-card${isOpen ? " is-open" : ""}" role="listitem" data-program-key="${escapeHtmlAttr(key)}" data-search="${escapeHtmlAttr(haystack)}">
              <button
                type="button"
                class="program-card__toggle"
                data-program-toggle
                aria-expanded="${isOpen ? "true" : "false"}"
                aria-controls="${bodyId}"
                aria-label="${escapeHtmlAttr(toggleLabel)}"
              >
                <span class="program-card__text">
                  ${kicker ? `<span class="program-card__kicker">${escapeHtml(kicker)}</span>` : ""}
                  <span class="program-card__title">${escapeHtml(title)}</span>
                  ${original ? `<span class="admissions-programs__original" lang="en">${escapeHtml(original)}</span>` : ""}
                </span>
                <span class="program-card__chevron" aria-hidden="true">${renderInlineIcon("chevron-right", 16)}</span>
              </button>
              <div class="program-card__body" id="${bodyId}" role="region" aria-label="${escapeHtmlAttr(title)}" aria-hidden="${!isOpen}"${isOpen ? "" : " hidden inert"}>
                <div class="program-card__body-inner">
                  <div class="admissions-programs__overview">
                    ${description ? `<p class="program-card__description">${escapeHtml(description)}</p>` : ""}
                    ${directions}
                    ${renderRows(allRows.slice(0, basicRowCount), "admissions-programs__essentials", true)}
                  </div>
                  ${renderRows(allRows.slice(basicRowCount))}
                  ${signalsHtml || sourceLinks.trim() ? `<div class="admissions-programs__sources"><details class="admissions-programs__references"><summary>${escapeHtml(t("university.admissions.reading.source_and_date"))}${renderInlineIcon("chevron-down", 16, "admissions-disclosure-icon")}</summary><div class="admissions-programs__references-body">${signalsHtml}${sourceLinks.trim() ? `<div class="program-card__actions">${sourceLinks}</div>` : ""}${sourceLinks.trim() && sourceDate ? `<p class="program-signal__meta">${escapeHtml(t("university.admissions.checked"))}: ${escapeHtml(sourceDate)}</p>` : ""}</div></details></div>` : ""}
                </div>
              </div>
              <div class="program-card__select-actions">${item.isSelected
                ? `<span class="program-card__selection-state" data-selected-program role="status">${renderInlineIcon("check", 16)}${escapeHtml(t("admission.choice.selected"))}</span>`
                : `<button type="button" class="program-card__admission-action" data-program-admission="${escapeHtmlAttr(selectionToken)}">${escapeHtml(t("university.admissions.catalog.select_program"))}</button>`}</div>
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
      <div data-program-coverage-host>${renderProgramCoverage(university?.coverage_by_program, coverageProgram)}</div>
    `;

    bindProgramCardEvents({
      container,
      university,
      universityKey,
      expandLabel,
      collapseLabel,
      coverageProgram,
      selectedProgram,
      programs,
      onProgramAdmissionSelected,
      admissionsData,
      profileMajor,
    });

    bindProgramSearchEvents({ container, universityKey });
  } else {
    const majors = Array.isArray(university?.academics?.majors)
      ? university.academics.majors.map((major) => String(major || "").trim()).filter(Boolean)
      : [];
    const majorsHtml = majors.length
      ? majors.map((major) => `<span class="program-major-chip">${escapeHtml(trProgramName(major))}</span>`).join(" ")
      : `<div class="program-empty">${escapeHtml(unknownFieldText("placeholder.field.programs", "Programs"))}</div>`;
    container.innerHTML = `${majorsHtml}${renderSignalRows(signalRows, admissionsData, institutionWideOnly)}<div data-program-coverage-host>${renderProgramCoverage(university?.coverage_by_program, coverageProgram)}</div>`;
  }

  applyPercentWidths(container);
  markMotionEnter(container, ".program-card, .program-major-chip, .program-signal, .program-empty", { limit: 18, staggerMs: 18 });
}
