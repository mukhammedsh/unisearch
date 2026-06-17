import {
  aiName,
  escapeHtml,
  escapeHtmlAttr,
  getSelectedAdmissionChoice,
  moneyUSD,
  motionPress,
  replayMotion,
  saveSelectedAdmissionChoice,
  markMotionEnter,
} from "../../utils.js";
import { t } from "../../i18n.js";
import {
  admissionChoiceKey,
  applyPercentWidths,
  getAdmissionChoicesFromCategories,
  getTrackFundingType,
  renderExamGroup,
  renderTrackChanceChip,
  renderTrackFactors,
  renderTrackFundingBadge,
  renderUniChanceSummary,
  splitExamEntries,
} from "../../university-detail-helpers.js";
import { translateTemplate, translateWord } from "../../university-translations.js";
import {
  costBreakdownCoverageNote,
  modeAwareAnnualCost,
  modeAwareBreakdown,
  moneyOrUnknown,
  renderAdmissionsOverview,
  renderRoiBox,
  renderScholarshipLine,
  renderTrackLanguageExamGroup,
  trProgramName,
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

function admissionChoiceSelectionAttrs({ category, choiceKey, funding = null, profile }) {
  return [
    `data-admission-choice="${escapeHtmlAttr(choiceKey)}"`,
    `data-category-id="${escapeHtmlAttr(String(category?.id || ""))}"`,
    `data-requirement-profile-id="${escapeHtmlAttr(String(profile?.id || ""))}"`,
    `data-funding-option-id="${escapeHtmlAttr(String(funding?.id || ""))}"`,
  ].join(" ");
}

const GENERAL_PROGRAM_KEY = "__general__";
const admissionProgramSelectionByUniversity = new Map();
const admissionProfileSelectionByCategory = new Map();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeProgramToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
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
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
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

function getBachelorProgramOptions(university, categories) {
  const programNames = [];
  if (Array.isArray(university?.academics?.programs)) {
    university.academics.programs.forEach((program) => {
      const level = String(program?.level || program?.study_level || "bachelor").trim().toLowerCase();
      if (level && !/bachelor|undergraduate/.test(level)) return;
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

function categoryMatchesProgram(category, programKey) {
  const scope = String(category?.scope || "general").trim().toLowerCase();
  if (scope === "general") return false;
  const wanted = normalizeProgramToken(programKey);
  if (!wanted) return false;
  return categoryTokens(category).some((token) => token === wanted);
}

function getVisibleAdmissionCategories(categories, selectedProgramKey) {
  const generalCategories = categories.filter((category) => String(category?.scope || "general").trim().toLowerCase() === "general");
  if (!selectedProgramKey || selectedProgramKey === GENERAL_PROGRAM_KEY) {
    return generalCategories.length ? generalCategories : categories;
  }
  const programCategories = categories.filter((category) => categoryMatchesProgram(category, selectedProgramKey));
  if (programCategories.length) return programCategories;
  return generalCategories.length ? generalCategories : categories;
}

function renderProgramSelector(university, categories, selectedProgramKey, hasExplicitProgramSelection) {
  const programs = getBachelorProgramOptions(university, categories);
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
  return trTrackLabel(profile?.label || "") || unknownFieldText("placeholder.field.requirement_profile", "Requirement profile");
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
  const extraRequirementItems = Array.isArray(funding?.extra_requirements)
    ? funding.extra_requirements
    : (Array.isArray(profile?.extra_requirements) ? profile.extra_requirements : category?.extra_requirements);
  const extraReqInfo = Array.isArray(extraRequirementItems) && extraRequirementItems.length
    ? `
      <div class="track-extra-req">
        <div class="track-extra-req-title">${escapeHtml(translateWord("extra_requirements", "Extra requirements"))}</div>
        <ul class="track-extra-req-list">${extraRequirementItems.map((item) => `<li>${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, item))}</li>`).join("")}</ul>
      </div>
    `
    : "";
  return `
    <div class="admission-requirement-grid">
      <div class="track-stats-box track-stats-box--min">
        <div class="track-stats-title">${escapeHtml(translateWord("minimum_to_apply", "Minimum to apply"))}</div>
        <div class="track-stats-values">${minList || `<div class="track-muted-italic">${escapeHtml(unknownFieldText("placeholder.field.minimum_requirements", "Minimum requirements"))}</div>`}</div>
      </div>
      <div class="track-stats-box track-stats-box--avg">
        <div class="track-stats-title track-stats-title--avg">${escapeHtml(translateWord("real_average_admitted", "Average admitted"))}</div>
        <div class="track-stats-values">${avgList || `<div class="track-muted-italic">${escapeHtml(translateWord("average_admitted_unavailable", "No verified average admitted data published."))}</div>`}</div>
      </div>
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

function renderFundingOptions({ annualCostForTrack, category, effectiveSelectedChoiceKey, profile, recommendedChoiceKey, uniChanceByChoiceKey, university }) {
  const fundingOptions = getFundingOptions(category, profile);
  if (!fundingOptions.length) return "";
  return `
    <div class="admission-funding-block">
      <div class="admission-funding-title">${escapeHtml(t("admission.funding_options", "Funding options"))}</div>
      <div class="admission-funding-list">
        ${fundingOptions.map((funding) => {
          const choiceKey = admissionChoiceKey(category, profile, funding);
          const choice = getAdmissionChoicesFromCategories([{ ...category, requirement_profiles: [{ ...profile, funding_options: [funding] }] }])[0] || {};
          const chance = uniChanceByChoiceKey.get(choiceKey);
          const isSelected = Boolean(effectiveSelectedChoiceKey && choiceKey === effectiveSelectedChoiceKey);
          const isRecommended = Boolean(recommendedChoiceKey && choiceKey === recommendedChoiceKey);
          const isGrant = getTrackFundingType(funding) === "grant";
          const optionPrice = annualCostForTrack(choice);
          const priceValue = Number.isFinite(Number(optionPrice)) ? moneyUSD(optionPrice) : unknownFieldText("placeholder.field.cost", "Cost");
          const fundingMeta = [
            funding.funding_program ? [t("admission.track.funding_program", "Funding program"), trTrackDescription(university.id, funding.id, funding.funding_program)] : null,
            funding.funding_source ? [t("admission.track.funding_source", "Funding source"), trTrackDescription(university.id, funding.id, funding.funding_source)] : null,
          ].filter(Boolean);
          return `
            <div class="admission-funding-option${isGrant ? " admission-funding-option--grant" : ""}${isSelected ? " is-active" : ""}" data-choice-key="${escapeHtmlAttr(choiceKey)}">
              <div class="admission-funding-option-main">
                <div class="admission-funding-option-title">
                  ${renderTrackFundingBadge(funding)}
                  <strong>${escapeHtml(trTrackLabel(funding.label || "") || t("admission.funding_option_fallback", "Funding option"))}</strong>
                  ${isRecommended ? `<span class="track-selection-badge">${escapeHtml(t("admission.choice.recommended", "Recommended"))}</span>` : ""}
                  ${renderTrackChanceChip(chance)}
                </div>
                ${renderTrackFactors(chance)}
                ${renderFundingMetaTags(fundingMeta)}
              </div>
              <div class="admission-funding-option-side">
                <div class="track-cost-preview${isGrant ? " track-cost-preview--grant" : ""}">
                  <strong>${escapeHtml(translateWord("est_cost", "Est. Cost"))}:</strong> ${escapeHtml(priceValue)}
                </div>
                <button type="button" class="track-select-btn${isSelected ? " is-active" : ""}" ${admissionChoiceSelectionAttrs({ category, choiceKey, funding, profile })} ${isSelected ? "disabled" : ""}>
                  ${escapeHtml(isSelected ? t("admission.choice.selected", "Selected") : t("admission.choice.select", "Select"))}
                </button>
              </div>
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
    container.innerHTML = `${warningHtml}${renderUniChanceSummary(uniChance)}${admissionsOverviewHtml}<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.admission_categories", "Admission categories"))}</div>`;
    applyPercentWidths(container);
    markMotionEnter(container, ".admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 12, staggerMs: 18 });
    return;
  }

  const universityId = String(university.id || "").trim();
  const selectedProgramStored = admissionProgramSelectionByUniversity.get(universityId) || "";
  const hasExplicitProgramSelection = Boolean(selectedProgramStored);
  const selectedProgramKey = selectedProgramStored || GENERAL_PROGRAM_KEY;
  const visibleCategories = getVisibleAdmissionCategories(categories, selectedProgramKey);
  const bestChoiceKey = String(uniChance?.bestChoiceKey || "").trim();
  const recommendedChoiceKey = String(uniChance?.recommendedChoiceKey || bestChoiceKey || "").trim();
  const selectedChoiceKey = getSelectedAdmissionChoice(university.id);
  const effectiveSelectedChoiceKey = selectedChoiceKey || bestChoiceKey;

  let html = warningHtml + renderUniChanceSummary(uniChance) + admissionsOverviewHtml;
  html += renderProgramSelector(university, categories, selectedProgramKey, hasExplicitProgramSelection);
  if (selectedProgramKey !== GENERAL_PROGRAM_KEY && visibleCategories.every((category) => String(category?.scope || "general").toLowerCase() === "general")) {
    html += `<div class="admission-scope-note">${escapeHtml(t("admission.program.using_general_note", "No program-specific score data is published here, so general requirements are shown."))}</div>`;
  }

  html += `<div class="admission-category-list">`;
  visibleCategories.forEach((category, categoryIdx) => {
    const profiles = getCategoryProfiles(category);
    const profileRows = profiles.length ? profiles : [{ id: "general", label: t("admission.profile.general", "General") }];
    const categoryKey = `${universityId}:${category.id || categoryIdx}`;
    const selectedProfileId = admissionProfileSelectionByCategory.get(categoryKey);
    const activeProfile = profileRows.find((profile) => String(profile.id || "") === selectedProfileId) || profileRows[0];
    const categoryLabel = trTrackLabel(category.label || "") || unknownFieldText("placeholder.field.admission_category", "Admission category");
    const categoryDescription = trTrackDescription(university.id, category.id, category.description || "");
    const scopeLabel = String(category.scope || "general").toLowerCase() === "general"
      ? t("admission.scope.general", "General")
      : t("admission.scope.program_specific", "Program-specific");
    const activeProfileLabel = translatedProfileLabel(activeProfile);
    const activeChoiceKey = admissionChoiceKey(category, activeProfile, null);
    const activeChoiceChance = chanceByChoice.get(activeChoiceKey);
    const fundingOptions = getFundingOptions(category, activeProfile);
    const profileHasFundingOptions = fundingOptions.length > 0;
    const profileIsSelected = !profileHasFundingOptions && Boolean(effectiveSelectedChoiceKey && effectiveSelectedChoiceKey === activeChoiceKey);
    const profileIsRecommended = !profileHasFundingOptions && Boolean(recommendedChoiceKey && recommendedChoiceKey === activeChoiceKey);

    html += `
      <section class="admission-category-card" data-admission-category="${escapeHtmlAttr(String(category.id || categoryIdx))}">
        <div class="admission-category-head">
          <div>
            <div class="admission-category-kicker">${escapeHtml(t("admission.category", "Admission category"))} &middot; ${escapeHtml(scopeLabel)}</div>
            <h3 class="admission-category-title">${escapeHtml(categoryLabel)}</h3>
            ${categoryDescription ? `<p class="admission-category-description">${escapeHtml(categoryDescription)}</p>` : ""}
          </div>
          <div class="admission-category-count">${escapeHtml(t("admission.profile_count", "{count} profiles").replace("{count}", String(profileRows.length)))}</div>
        </div>

        ${renderApplicablePrograms(category, activeProfile)}

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

        <div class="requirement-profile-panel">
          <div class="requirement-profile-head">
            <div>
              <div class="requirement-profile-kicker">${escapeHtml(t("admission.profile", "Requirement profile"))}</div>
              <h4 class="requirement-profile-title">${escapeHtml(activeProfileLabel)}</h4>
            </div>
            <div class="requirement-profile-badges">
              ${profileIsRecommended ? `<span class="track-selection-badge">${escapeHtml(t("admission.choice.recommended", "Recommended"))}</span>` : ""}
              ${!profileHasFundingOptions ? renderTrackChanceChip(activeChoiceChance) : ""}
            </div>
          </div>
          ${!profileHasFundingOptions ? renderTrackFactors(activeChoiceChance) : ""}

          ${renderChoiceRequirements({ category, funding: null, profile: activeProfile, university })}

          ${profileHasFundingOptions
            ? renderFundingOptions({ annualCostForTrack, category, effectiveSelectedChoiceKey, profile: activeProfile, recommendedChoiceKey, uniChanceByChoiceKey: chanceByChoice, university })
            : `
              <div class="track-select-row">
                <button type="button" class="track-select-btn${profileIsSelected ? " is-active" : ""}" ${admissionChoiceSelectionAttrs({ category, choiceKey: activeChoiceKey, profile: activeProfile })} ${profileIsSelected ? "disabled" : ""}>
                  ${escapeHtml(profileIsSelected ? t("admission.choice.selected", "Selected") : t("admission.choice.select", "Select"))}
                </button>
              </div>
            `}
        </div>
      </section>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
  container.querySelectorAll("[data-admission-program]").forEach((button) => {
    button.addEventListener("click", () => {
      motionPress(button);
      const programKey = String(button.getAttribute("data-admission-program") || "").trim() || GENERAL_PROGRAM_KEY;
      admissionProgramSelectionByUniversity.set(universityId, programKey);
      renderAdmissionSection({ annualCostForTrack, container, uniChance, uniChanceByChoiceKey: chanceByChoice, university });
    });
  });

  container.querySelectorAll("[data-requirement-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      motionPress(button);
      const categoryKey = String(button.getAttribute("data-admission-category-key") || "").trim();
      const profileId = String(button.getAttribute("data-requirement-profile") || "").trim();
      if (categoryKey && profileId) admissionProfileSelectionByCategory.set(categoryKey, profileId);
      renderAdmissionSection({ annualCostForTrack, container, uniChance, uniChanceByChoiceKey: chanceByChoice, university });
    });
  });

  container.querySelectorAll("[data-admission-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      motionPress(button);
      const choiceKey = String(button.getAttribute("data-admission-choice") || "").trim();
      if (!choiceKey) return;
      saveSelectedAdmissionChoice(university.id, {
        categoryId: String(button.getAttribute("data-category-id") || "").trim(),
        requirementProfileId: String(button.getAttribute("data-requirement-profile-id") || "").trim(),
        fundingOptionId: String(button.getAttribute("data-funding-option-id") || "").trim(),
        choiceKey,
      });
      replayMotion(button.closest(".admission-funding-option") || button.closest(".requirement-profile-panel") || button, "motion-state-pulse", { timeoutMs: 520 });
    });
  });

  applyPercentWidths(container);
  markMotionEnter(container, ".admission-category-card, .admission-funding-option, .admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 18, staggerMs: 18 });
}

export function renderFinanceSection({
  annualCostForTrack,
  container,
  onSummaryChanged,
  priceEl,
  profileStudyMode,
  scholarshipContainer,
  uniRoi,
  university,
}) {
  if (university.finance) {
    if (scholarshipContainer) {
      const aid = university.finance.financial_aid || {};
      const hasMerit = typeof aid.merit_based === "boolean";
      const hasNeed = typeof aid.need_based === "boolean";
      const meritHtml = hasMerit
        ? (aid.merit_based
          ? renderScholarshipLine("check-circle", "scholarship-line--positive", translateWord("merit_based_scholarships_available", "Merit-based scholarships available"))
          : renderScholarshipLine("x-circle", "scholarship-line--muted", translateWord("no_merit_based_scholarships", "No merit-based scholarships")))
        : renderScholarshipLine("question-mark-circle", "scholarship-line--muted", unknownFieldText("placeholder.field.merit_scholarships", "Merit-based scholarships"));
      const needHtml = hasNeed
        ? (aid.need_based
          ? renderScholarshipLine("check-circle", "scholarship-line--positive", translateWord("need_based_financial_aid", "Need-based financial aid"))
          : renderScholarshipLine("x-circle", "scholarship-line--muted", translateWord("no_need_based_aid", "No need-based aid")))
        : renderScholarshipLine("question-mark-circle", "scholarship-line--muted", unknownFieldText("placeholder.field.need_based_aid", "Need-based aid"));
      scholarshipContainer.innerHTML = meritHtml + needHtml;
    }

    if (priceEl) {
      let minTotal = modeAwareAnnualCost(university.finance || {}, profileStudyMode);
      const allFundingOptions = getAdmissionChoicesFromCategories(university.admission_categories);
      if (allFundingOptions.length) {
        const prices = allFundingOptions
          .map((option) => annualCostForTrack(option))
          .filter((price) => Number.isFinite(Number(price)) && Number(price) > 0);
        if (prices.length > 0) minTotal = Math.min(...prices);
      }
      priceEl.innerHTML = Number.isFinite(Number(minTotal))
        ? `<span class="price-prefix">${escapeHtml(translateWord("from", "from"))}</span>${moneyUSD(minTotal)}`
        : escapeHtml(unknownFieldText("placeholder.field.cost", "Cost"));
    }
    onSummaryChanged?.();

    if (container) {
      const choices = getAdmissionChoicesFromCategories(university.admission_categories);
      const financeChoices = choices.length
        ? choices
        : [{ label: translateWord("general_tuition", "General Tuition"), finance_override: null, category_label: translateWord("general_tuition", "General Tuition") }];
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
          const financeData = option.finance_override || university.finance;
          const total = modeAwareAnnualCost(financeData || {}, profileStudyMode);
          const breakdown = modeAwareBreakdown(financeData || {}, profileStudyMode);
          const totalText = moneyOrUnknown(total, "placeholder.field.total_cost", "Total cost");
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

          const optionLabel = trTrackLabel(option.funding_label || option.label || option.requirement_profile_label || "");
          const fundingMeta = [
            option.funding_program
              ? [t("admission.track.funding_program", "Funding program"), trTrackDescription(university.id, option.id, option.funding_program)]
              : null,
            option.funding_source
              ? [t("admission.track.funding_source", "Funding source"), trTrackDescription(university.id, option.id, option.funding_source)]
              : null,
          ].filter(Boolean);

          const totalTitle = isGrantTrack
            ? translateWord("est_net_cost", "Est. Net Cost")
            : translateWord("total_per_year", "Total / year");
          const breakdownHtml = breakdownEntries.length > 1
            ? `
              <div class="cost-progress-bar">
                ${breakdownEntries.map((entry) => `<span class="cost-progress-segment ${entry.colorClass}" style="--fill-width:${entry.percent}%; --fill-scale:${Math.max(0, Math.min(100, Number(entry.percent) || 0)) / 100}"></span>`).join("")}
              </div>
              <div class="cost-legend">
                ${breakdownEntries.map((entry) => `
                  <div class="cost-legend-row">
                    <div class="cost-legend-label-wrap">
                      <span class="cost-legend-dot ${entry.colorClass}"></span>
                      <span class="cost-legend-label">${escapeHtml(entry.label)}</span>
                    </div>
                    <span class="cost-legend-value">${escapeHtml(moneyUSD(entry.value))}</span>
                  </div>
                `).join("")}
              </div>
            `
            : (breakdownEntries.length === 1
              ? `<div class="cost-legend-single">${escapeHtml(breakdownEntries[0].label)}: <strong>${escapeHtml(moneyUSD(breakdownEntries[0].value))}</strong></div>`
              : `<div class="cost-legend-single">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`);
          const breakdownNoteHtml = breakdownNote
            ? `<div class="finance-breakdown-note">${escapeHtml(breakdownNote)}</div>`
            : "";

          return `
            <article class="finance-option-card${isGrantTrack ? " finance-option-card--grant" : ""}">
              <div class="finance-option-head">
                ${renderTrackFundingBadge(option)}
                ${optionLabel ? `<div class="finance-option-label">${escapeHtml(optionLabel)}</div>` : ""}
              </div>
              ${renderFundingMetaTags(fundingMeta)}

              <div class="finance-option-total${isGrantTrack ? " finance-option-total--grant" : ""}">
                <strong>${escapeHtml(totalTitle)}:</strong> ${escapeHtml(totalText)}
              </div>

              <div class="cost-breakdown-list">
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

      const roiHtml = renderRoiBox(uniRoi);
      const financeGridHtml = financeHtml
        ? `<div class="finance-grid-new">${financeHtml}</div>`
        : `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`;
      container.innerHTML = `${financeGridHtml}${roiHtml}`;
      markMotionEnter(container, ".finance-track-group, .finance-option-card, .roi-box, .admission-empty-state", { limit: 18, staggerMs: 18 });
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
  onSummaryChanged?.();
}
