import {
  escapeHtml,
  escapeHtmlAttr,
  getSelectedAdmissionChoice,
  loadProfile,
  markMotionEnter,
  motionPress,
  replayMotion,
  saveSelectedAdmissionChoice,
} from "../../utils.js";
import { heroIcon } from "../../icons.js";
import { t } from "../../i18n.js";
import { formatPrice } from "../../currency.js";
import {
  admissionChoiceKey,
  getAdmissionChoicesFromCategories,
  getTrackFundingType,
  isPlainObject,
  renderExamGroup,
  renderTrackFundingBadge,
  splitExamEntries,
} from "../../university-detail-helpers.js";
import { translateWord } from "../../university-translations.js";
import {
  renderAdmissionsOverview,
  renderTrackLanguageExamGroup,
  safeUrl,
  trProgramName,
  trStudyLevel,
  trTrackDescription,
  trTrackLabel,
  unknownFieldText,
} from "../_shared.js";
import {
  GENERAL_PROGRAM_KEY,
  admissionChoiceSelectionAttrs,
  admissionProgramSelectionByUniversity,
  admissionStudyLevelSelectionByUniversity,
  applicantRouteLabel,
  getAdmissionCategories,
  getAdmissionContextProfile,
  getAvailableStudyLevels,
  getCategoryLevelsList,
  localizeDeadlineDate,
  normalizeLevelKey,
  normalizeProgramToken,
  renderAdmissionContextControls,
  renderStudyLevelFilter,
  selectedAdmissionContext,
  uniqueNonEmpty,
  updateAdmissionUrl,
  visibleAdmissionContextByUniversity,
} from "./section-context.js";
import { refreshFundingAwardsForVisibleAdmission, renderFundingMetaTags } from "./funding-awards.js";

const admissionProfileSelectionByCategory = new Map();

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
    return `{${Object.keys(value).sort((a, b) => a.localeCompare(b)).map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
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

function getStudyProgramOptions(university, categories, activeLevelKey) {
  const programNames = [];
  if (Array.isArray(university?.academics?.programs)) {
    university.academics.programs.forEach((program) => {
      const progLevels = Array.isArray(program?.study_levels)
        ? program.study_levels
        : (program?.study_level ? [program.study_level] : []);
      const normalizedLevels = progLevels.length
        ? progLevels.map(normalizeLevelKey)
        : [normalizeLevelKey(program?.level || "bachelor")];
      if (activeLevelKey !== "all" && !normalizedLevels.includes(activeLevelKey)) return;
      programNames.push(program?.source_name || program?.name || program?.program_name);
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

function renderProgramSelector(university, categories, selectedProgramKey, hasExplicitProgramSelection, activeLevelKey = "all") {
  const programs = getStudyProgramOptions(university, categories, activeLevelKey);
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
  return trTrackLabel(profile?.label || profile?.name || "") || unknownFieldText("placeholder.field.requirement_profile", "Requirement profile");
}

function renderApplicablePrograms(category, profile) {
  // Program names and majors often name the same programme; compare them after translation so each shows once.
  const majors = uniqueNonEmpty([
    ...(Array.isArray(profile?.program_names) ? profile.program_names : []),
    ...(Array.isArray(category?.program_names) ? category.program_names : []),
    ...(Array.isArray(profile?.applicable_majors) ? profile.applicable_majors : []),
    ...(Array.isArray(category?.applicable_majors) ? category.applicable_majors : []),
  ].map((major) => trProgramName(major))).filter(Boolean);
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
    ...funding,
    requirements,
    stats_avg: statsAvg,
    language_requirements: funding?.language_requirements || profile?.language_requirements || category?.language_requirements || [],
    language_requirements_mode: funding?.language_requirements_mode || profile?.language_requirements_mode || category?.language_requirements_mode,
  };
  const minParts = splitExamEntries(requirements);
  const avgParts = splitExamEntries(statsAvg);
  const minList = [
    renderExamGroup(translateWord("academic_requirements", "Academic requirements"), minParts.acad, "info"),
    renderTrackLanguageExamGroup(languageChoice, "requirements"),
  ].filter(Boolean).join("");
  const avgList = [
    renderExamGroup(translateWord("academic_average", "Academic average"), avgParts.acad, "info"),
    renderTrackLanguageExamGroup(languageChoice, "average"),
  ].filter(Boolean).join("");
  const requirementsNote = profile?.requirements_note || category?.requirements_note;
  const requirementsSource = safeUrl(profile?.requirements_source_url || category?.source_url);
  const requirementsNoteHtml = requirementsNote
    ? `<p class="admission-scope-note">${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, requirementsNote))}${requirementsSource ? ` <a href="${escapeHtmlAttr(requirementsSource)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.open_source", "Open source"))}</a>` : ""}</p>`
    : "";
  const rawExtraRequirementItems = Array.isArray(funding?.extra_requirements)
    ? funding.extra_requirements
    : (Array.isArray(profile?.extra_requirements) ? profile.extra_requirements : category?.extra_requirements);
  const extraRequirementItems = Array.isArray(rawExtraRequirementItems)
    ? [...new Set(rawExtraRequirementItems)]
    : [];
  let extraReqInfo = "";
  if (Array.isArray(extraRequirementItems) && extraRequirementItems.length) {
    if (extraRequirementItems.length <= 2) {
      extraReqInfo = `
        <div class="track-extra-req">
          <div class="track-extra-req-title">${escapeHtml(translateWord("extra_requirements", "Extra requirements"))}</div>
          <ul class="track-extra-req-list">${extraRequirementItems.map((item) => `<li>${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, item))}</li>`).join("")}</ul>
        </div>
      `;
    } else {
      const firstTwo = extraRequirementItems.slice(0, 2);
      const remaining = extraRequirementItems.slice(2);
      const chevronIcon = heroIcon("chevron-down", "ui-icon track-collapsible-chevron");
      extraReqInfo = `
        <div class="track-extra-req">
          <div class="track-extra-req-title">${escapeHtml(translateWord("extra_requirements", "Extra requirements"))}</div>
          <ul class="track-extra-req-list">${firstTwo.map((item) => `<li>${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, item))}</li>`).join("")}</ul>
          <details class="track-collapsible-details motion-disclosure">
            <summary class="track-collapsible-summary">
              <span class="track-collapsible-title">${escapeHtml(t("admission.collapsible.additional_details", "Additional requirements & instructions"))} (+${remaining.length})</span>
              ${chevronIcon}
            </summary>
            <ul class="track-extra-req-list track-collapsible-content">
              ${remaining.map((item) => `<li>${escapeHtml(trTrackDescription(university.id, profile?.id || category?.id, item))}</li>`).join("")}
            </ul>
          </details>
        </div>
      `;
    }
  }
  return `
    <div class="admission-requirement-grid">
      <div class="track-stats-box track-stats-box--min">
        <div class="track-stats-title">${escapeHtml(translateWord("minimum_to_apply", "Minimum to apply"))}</div>
        <div class="track-stats-values">${requirementsNoteHtml}${minList || (requirementsNote ? "" : `<div class="track-muted-italic">${escapeHtml(unknownFieldText("placeholder.field.minimum_requirements", "Minimum requirements"))}</div>`)}</div>
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
    renderExamGroup(translateWord("academic_requirements", "Academic requirements"), minParts.acad, "info"),
    languageOverride
      ? renderTrackLanguageExamGroup({
        language_requirements: funding?.language_requirements || baselineLanguage,
        language_requirements_mode: funding?.language_requirements_mode || baselineLanguageMode,
      }, "requirements")
      : "",
  ].filter(Boolean).join("");
  const avgList = [
    renderExamGroup(translateWord("academic_average", "Academic average"), avgParts.acad, "info"),
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
    if (funding?.description || funding?.funding_description) return "";
    const isCompetitiveGrant = String(funding?.funding_source || "").toLowerCase() === "merit";
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

function renderFundingOptions({ annualCostForTrack, category, effectiveSelectedChoiceKey, profile, university }) {
  const fundingOptions = getFundingOptions(category, profile);
  if (!fundingOptions.length) return "";
  const baseChoice = getAdmissionChoicesFromCategories([{
    ...category,
    funding_options: [],
    requirement_profiles: [{ ...profile, funding_options: [] }],
  }])[0] || {};
  const basePrice = annualCostForTrack(baseChoice);
  const baseCurrency = (baseChoice.finance_override || university?.finance)?.currency || "USD";
  return `
    <div class="admission-funding-block">
      <div class="admission-funding-title">${escapeHtml(t("admission.funding_options", "Funding options"))}</div>
      <div class="admission-funding-list">
        ${fundingOptions.map((funding) => {
          const choiceKey = admissionChoiceKey(category, profile, funding);
          const isSelected = Boolean(effectiveSelectedChoiceKey && choiceKey === effectiveSelectedChoiceKey);
          const isGrant = getTrackFundingType(funding) === "grant";
          const hasBasePrice = basePrice !== null
            && basePrice !== undefined
            && !(typeof basePrice === "string" && basePrice.trim() === "")
            && Number.isFinite(Number(basePrice));
          const priceValue = hasBasePrice ? formatPrice(basePrice, baseCurrency) : unknownFieldText("placeholder.field.cost", "Cost");
          const fundingMeta = [
            funding.funding_program ? [t("admission.track.funding_program", "Funding program"), trTrackDescription(university.id, funding.id, funding.funding_program)] : null,
            funding.funding_source ? [t("admission.track.funding_source", "Funding source"), trTrackDescription(university.id, funding.id, funding.funding_source)] : null,
          ].filter(Boolean);
          const mainContent = renderFundingMetaTags(fundingMeta);
          return `
            <div class="admission-funding-option${isGrant ? " admission-funding-option--grant" : ""}${isSelected ? " is-active" : ""}" data-choice-key="${escapeHtmlAttr(choiceKey)}">
              <div class="admission-funding-option-header">
                <div class="admission-funding-option-title">
                  ${renderTrackFundingBadge(funding)}
                  <strong>${escapeHtml(trTrackLabel(funding.label || funding.name || "") || t("admission.funding_option_fallback", "Funding option"))}</strong>
                </div>
                <div class="admission-funding-option-side">
                  <div class="track-cost-preview${isGrant ? " track-cost-preview--grant" : ""}">
                    <strong>${escapeHtml(t("admission.funding_before_award", "Annual cost before any award"))}:</strong> ${escapeHtml(priceValue)}
                  </div>
                  <button type="button" class="track-select-btn${isSelected ? " is-active" : ""}" ${admissionChoiceSelectionAttrs({ category, choiceKey, funding, profile })} ${isSelected ? "disabled" : ""}>
                    ${escapeHtml(isSelected ? t("admission.choice.selected", "Selected") : t("admission.choice.select", "Select"))}
                  </button>
                </div>
              </div>
              ${mainContent ? `<div class="admission-funding-option-main">${mainContent}</div>` : ""}
              ${funding.description || funding.funding_description ? `<div class="admission-funding-diff-note">${escapeHtml(trTrackDescription(university.id, funding.id, funding.description || funding.funding_description))}</div>` : ""}
              ${renderFundingDifferences({ category, funding, profile, university })}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderAdmissionCategoryCard({
  annualCostForTrack,
  category,
  categoryIdx,
  effectiveSelectedChoiceKey,
  hasExplicitProgramSelection,
  university,
  universityId,
}) {
  const profiles = getCategoryProfiles(category);
  const profileRows = profiles.length ? profiles : [{ id: "general", label: t("admission.profile.general", "General") }];
  const categoryKey = `${universityId}:${category.id || categoryIdx}`;
  const choiceKeyStr = String(effectiveSelectedChoiceKey || "").trim();
  let effectiveProfileId = "";
  if (choiceKeyStr) {
    const delimiter = choiceKeyStr.includes("::") ? "::" : ":";
    const parts = choiceKeyStr.split(delimiter);
    if (parts.length >= 2 && parts[0] === String(category.id || categoryIdx)) {
      effectiveProfileId = parts[1];
    }
  }
  const selectedProfileId = admissionProfileSelectionByCategory.get(categoryKey) || effectiveProfileId;
  const activeProfile = profileRows.find((profile) => String(profile.id || "") === selectedProfileId) || profileRows[0];
  const categoryLabel = trTrackLabel(category.label || category.name || "") || unknownFieldText("placeholder.field.admission_category", "Admission category");
  const categoryDescription = trTrackDescription(university.id, category.id, category.description || "");
  const profileDescription = trTrackDescription(university.id, activeProfile.id || category.id, activeProfile.description || "");
  const scopeLabel = String(category.scope || "general").toLowerCase() === "general"
    ? t("admission.scope.general", "General")
    : t("admission.scope.program_specific", "Program-specific");
  const routeText = `${t("university.admissions.route_label", "Applicant route")}: ${applicantRouteLabel(category.applicant_route)}`;
  const activeProfileLabel = translatedProfileLabel(activeProfile);
  const activeChoiceKey = admissionChoiceKey(category, activeProfile, null);
  const fundingOptions = getFundingOptions(category, activeProfile);
  const profileHasFundingOptions = fundingOptions.length > 0;
  const profileIsSelected = !profileHasFundingOptions && Boolean(effectiveSelectedChoiceKey && effectiveSelectedChoiceKey === activeChoiceKey);

  const catLevels = getCategoryLevelsList(category);
  const catLevelBadges = catLevels.length
    ? ` &middot; ${catLevels.map((l) => `<span class="admission-level-badge">${escapeHtml(trStudyLevel(l))}</span>`).join(" ")}`
    : "";

  let deadlinePillHtml = "";
  const catRounds = category.admission_rounds || [];
  const catDeadlines = category.deadlines || [];
  const firstRoundDate = catRounds[0]?.deadline || catDeadlines[0]?.application_deadline || catDeadlines[0]?.date || category.application_deadline;
  if (firstRoundDate) {
    deadlinePillHtml = `
      <div class="admission-category-deadline-pill">
        ${heroIcon("document-check", "ui-icon ui-icon--14")}
        <span><strong>${escapeHtml(t("university.admissions.deadline_label", "Deadline"))}:</strong> ${escapeHtml(localizeDeadlineDate(firstRoundDate))}</span>
      </div>
    `;
  }

  const categoryId = String(category.id || categoryIdx);
  return `
    <section class="admission-category-card" data-admission-category="${escapeHtmlAttr(categoryId)}">
      <div class="admission-category-head">
        <div>
          <div class="admission-category-kicker">${escapeHtml(t("admission.category", "Admission category"))} &middot; ${escapeHtml(scopeLabel)}${catLevelBadges} &middot; ${escapeHtml(routeText)}</div>
          <h3 class="admission-category-title">${escapeHtml(categoryLabel)}</h3>
          ${categoryDescription && categoryDescription !== trTrackDescription(university.id, activeProfile.id || category.id, activeProfile.requirements_note || category.requirements_note || "") ? `<p class="admission-category-description">${escapeHtml(categoryDescription)}</p>` : ""}
          ${deadlinePillHtml}
        </div>
        <div class="admission-category-count">${escapeHtml(t("admission.profile_count", "{count} profiles").replace("{count}", String(profileRows.length)))}</div>
      </div>

      ${hasExplicitProgramSelection ? "" : renderApplicablePrograms(category, activeProfile)}

      ${profileRows.length > 1 ? `
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
      ` : ""}

      <div class="requirement-profile-panel">
        ${profileRows.length > 1 ? `
        <div class="requirement-profile-head">
          <div>
            <div class="requirement-profile-kicker">${escapeHtml(t("admission.profile", "Requirement profile"))}</div>
            <h4 class="requirement-profile-title">${escapeHtml(activeProfileLabel)}</h4>
          </div>
        </div>
        ` : ""}
        ${profileDescription && profileDescription !== categoryDescription && profileDescription !== trTrackDescription(university.id, activeProfile.id || category.id, activeProfile.requirements_note || category.requirements_note || "") && profileRows.length === 1 ? `<p class="admission-scope-note">${escapeHtml(profileDescription)}</p>` : ""}

        ${renderChoiceRequirements({ category, funding: null, profile: activeProfile, university })}

        ${profileHasFundingOptions
          ? renderFundingOptions({ annualCostForTrack, category, effectiveSelectedChoiceKey, profile: activeProfile, university })
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
}

function attachAdmissionSectionEventListeners({
  annualCostForTrack,
  compactMode,
  container,
  effectiveSelectedChoiceKeyOverride,
  onChoiceSelected,
  onContextChange,
  university,
  universityId,
  admissionContext,
}) {
  container.querySelectorAll("[data-admission-context]").forEach((select) => {
    select.addEventListener("change", () => {
      const key = select.getAttribute("data-admission-context");
      updateAdmissionUrl({ [key]: select.value });
      onContextChange?.();
    });
  });
  container.querySelectorAll("[data-admission-level]").forEach((button) => {
    button.addEventListener("click", () => {
      motionPress(button);
      const lvlKey = String(button.getAttribute("data-admission-level") || "").trim() || "all";
      admissionStudyLevelSelectionByUniversity.set(universityId, lvlKey);
      updateAdmissionUrl({ level: lvlKey, route: "", cycle: "" });
      onContextChange?.();
      renderAdmissionSection({
        annualCostForTrack,
        container,
        university,
        onChoiceSelected,
        effectiveSelectedChoiceKeyOverride,
        onContextChange,
        compactMode,
      });
    });
  });

  container.querySelectorAll("[data-admission-program]").forEach((button) => {
    button.addEventListener("click", () => {
      motionPress(button);
      const programKey = String(button.getAttribute("data-admission-program") || "").trim() || GENERAL_PROGRAM_KEY;
      admissionProgramSelectionByUniversity.set(universityId, programKey);
      const selectedProgram = (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
        .find((program) => normalizeProgramToken(program?.name || program?.program_name || program?.id) === programKey);
      updateAdmissionUrl({
        program: selectedProgram?.id || "",
        level: selectedProgram ? normalizeLevelKey(selectedProgram.study_levels?.[0] || selectedProgram.study_level || selectedProgram.level) : "",
        route: "",
        cycle: "",
      });
      if (selectedProgram) admissionStudyLevelSelectionByUniversity.set(universityId, normalizeLevelKey(selectedProgram.study_levels?.[0] || selectedProgram.study_level || selectedProgram.level));
      onContextChange?.();
      renderAdmissionSection({
        annualCostForTrack,
        container,
        university,
        onChoiceSelected,
        effectiveSelectedChoiceKeyOverride,
        onContextChange,
        compactMode,
      });
    });
  });

  container.querySelectorAll("[data-requirement-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      motionPress(button);
      const categoryKey = String(button.getAttribute("data-admission-category-key") || "").trim();
      const profileId = String(button.getAttribute("data-requirement-profile") || "").trim();
      if (categoryKey && profileId) admissionProfileSelectionByCategory.set(categoryKey, profileId);
      renderAdmissionSection({
        annualCostForTrack,
        container,
        university,
        onChoiceSelected,
        effectiveSelectedChoiceKeyOverride,
        compactMode,
      });
    });
  });

  container.querySelectorAll("[data-admission-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      motionPress(button);
      const choiceKey = String(button.getAttribute("data-admission-choice") || "").trim();
      if (!choiceKey) return;
      const selection = {
        programId: admissionContext.selectedProgramId || "",
        categoryId: String(button.getAttribute("data-category-id") || "").trim(),
        requirementProfileId: String(button.getAttribute("data-requirement-profile-id") || "").trim(),
        fundingOptionId: String(button.getAttribute("data-funding-option-id") || "").trim(),
        choiceKey,
      };
      if (typeof onChoiceSelected === "function") {
        onChoiceSelected(selection);
      } else {
        saveSelectedAdmissionChoice(university.id, selection);
      }
      replayMotion(button.closest(".admission-funding-option") || button.closest(".requirement-profile-panel") || button, "motion-state-pulse", { timeoutMs: 520 });
    });
  });
}

export function renderAdmissionSection({
  annualCostForTrack,
  container,
  university,
  onChoiceSelected,
  effectiveSelectedChoiceKeyOverride,
  onContextChange,
  compactMode = false,
}) {
  if (!container) return;

  const admissionsData = university?.academics?.admissions && typeof university.academics.admissions === "object"
    ? university.academics.admissions
    : null;
  const admissionsOverviewHtml = renderAdmissionsOverview(admissionsData);
  const categories = getAdmissionCategories(university);
  if (!categories.length) {
    if (compactMode) {
      container.innerHTML = `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.admission_categories", "Admission categories"))}</div>`;
    } else {
      container.innerHTML = `${admissionsOverviewHtml}<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.admission_categories", "Admission categories"))}</div>`;
    }
    markMotionEnter(container, ".admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 12, staggerMs: 18 });
    return;
  }

  const universityId = String(university.id || "").trim();
  const contextProfile = getAdmissionContextProfile(university);
  const admissionContext = selectedAdmissionContext(university, contextProfile);
  const availableLevels = getAvailableStudyLevels(categories);
  let activeLevelStored = admissionContext.selectedLevel;
  if (!activeLevelStored) {
    const profileStudyLevel = normalizeLevelKey(loadProfile()?.studyLevel);
    if (availableLevels.some((l) => l.key === profileStudyLevel)) {
      activeLevelStored = profileStudyLevel;
    } else if (availableLevels.some((l) => l.key === "bachelor")) {
      activeLevelStored = "bachelor";
    } else {
      activeLevelStored = "all";
    }
    admissionStudyLevelSelectionByUniversity.set(universityId, activeLevelStored);
  }
  const activeLevelKey = activeLevelStored || "all";

  const levelFilteredCategories = admissionContext.levelCategories;
  const selectedProgramStored = admissionContext.selectedProgram === GENERAL_PROGRAM_KEY ? "" : admissionContext.selectedProgram;
  const hasExplicitProgramSelection = Boolean(selectedProgramStored);
  const selectedProgramKey = selectedProgramStored || GENERAL_PROGRAM_KEY;
  const visibleCategories = admissionContext.visibleCategories;
  visibleAdmissionContextByUniversity.set(universityId, {
    selectedLevel: activeLevelKey,
    selectedProgram: selectedProgramKey,
    visibleCategories,
  });
  const selectedChoiceKey = effectiveSelectedChoiceKeyOverride !== undefined
    ? effectiveSelectedChoiceKeyOverride
    : getSelectedAdmissionChoice(university.id);
  const effectiveSelectedChoiceKey = selectedChoiceKey || "";

  const studyLevelFilterHtml = !compactMode && !hasExplicitProgramSelection
    ? renderStudyLevelFilter(availableLevels, activeLevelKey, categories.length) : "";

  let html = "";
  const overviewDetailsHtml = admissionContext.route !== "transfer" && activeLevelKey === "bachelor"
    ? admissionsOverviewHtml
    : "";
  const analysisHtml = overviewDetailsHtml
    ? `<details class="mit-admission-analysis motion-disclosure"><summary>${escapeHtml(t("admission.mit.analysis", "Requirements fit and historical statistics"))}</summary>${overviewDetailsHtml}</details>`
    : "";
  if (!compactMode) {
    html += studyLevelFilterHtml;
  }
  if (compactMode) {
    html += renderProgramSelector(university, levelFilteredCategories, selectedProgramKey, hasExplicitProgramSelection, activeLevelKey);
  }
  if (!compactMode) html += renderAdmissionContextControls(admissionContext.programCategories.length ? admissionContext.programCategories : levelFilteredCategories, admissionContext);
  if (!compactMode && visibleCategories.length) {
    const sourceUrl = safeUrl(visibleCategories[0].source_url);
    if (sourceUrl) {
      html += `<div class="admission-decision-actions"><a href="${escapeHtmlAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.admissions.next_official_step", "Open official application requirements"))}</a></div>`;
    }
  }
  if (selectedProgramKey !== GENERAL_PROGRAM_KEY && visibleCategories.length && visibleCategories.every((category) => String(category?.scope || "general").toLowerCase() === "general")) {
    html += `<div class="admission-scope-note">${escapeHtml(t("admission.program.using_general_note", "No program-specific score data is published here, so general requirements are shown."))}</div>`;
  }

  html += `<div class="admission-category-list">`;
  visibleCategories.forEach((category, categoryIdx) => {
    html += renderAdmissionCategoryCard({
      annualCostForTrack,
      category,
      categoryIdx,
      effectiveSelectedChoiceKey,
      hasExplicitProgramSelection,
      university,
      universityId,
    });
  });
  html += `</div>`;
  if (!compactMode) html += analysisHtml;

  container.innerHTML = html;

  attachAdmissionSectionEventListeners({
    annualCostForTrack,
    compactMode,
    container,
    effectiveSelectedChoiceKeyOverride,
    onChoiceSelected,
    onContextChange,
    university,
    universityId,
    admissionContext,
  });

  markMotionEnter(container, ".admission-category-card, .admission-funding-option, .admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 18, staggerMs: 18 });
  refreshFundingAwardsForVisibleAdmission(university);
}
