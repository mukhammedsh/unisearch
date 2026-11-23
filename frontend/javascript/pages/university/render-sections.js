import { escapeHtml, escapeHtmlAttr, loadProfile, loadProfileForApi, markMotionEnter } from "../../utils.js";
import { t } from "../../i18n.js";
import { formatMoney, formatPrice } from "../../currency.js";
import {
  applyPercentWidths,
  getAdmissionChoicesFromCategories,
  getGrantsFromCategories,
  getTrackFundingType,
  isPlainObject,
  renderTrackFundingBadge,
} from "../../university-detail-helpers.js";
import { translateWord } from "../../university-translations.js";
import {
  costBreakdownCoverageNote,
  modeAwareAnnualCost,
  modeAwareBreakdown,
  moneyOrUnknown,
  renderInlineIcon,
  renderScholarshipLine,
  trProgramName,
  trTrackDescription,
  trTrackLabel,
  translateCostBreakdownLabel,
  unknownFieldText,
} from "../_shared.js";
import {
  GENERAL_PROGRAM_KEY,
  categoryMatchesStudyLevel,
  cycleMatches,
  getAdmissionContextProfile,
  getCategoryLevelsList,
  getUndergraduateCategories,
  normalizeLevelKey,
  safeHttpUrl,
  selectAdmissionProgram,
  selectedAdmissionContext,
} from "./section-context.js";
import {
  getFundingAwardsForSelection,
  renderFinanceMetaList,
  renderFinancePolicyOverview,
  renderFundingAwardList,
  renderOneTimeCosts,
  resolveFeeStatusAndAid,
} from "./funding-awards.js";
import { extractUniversityDeadlines, renderDeadlinesTabSection } from "./deadlines-section.js";
import { renderAdmissionSection } from "./admission-section.js";

export {
  getAdmissionContextProfile,
  getUndergraduateCategories,
  selectAdmissionProgram,
  getFundingAwardsForSelection,
  resolveFeeStatusAndAid,
  extractUniversityDeadlines,
  renderDeadlinesTabSection,
  renderAdmissionSection,
};

export function getFinanceChoicesForStudyLevel(categories, studyLevel) {
  const selectedLevelKey = normalizeLevelKey(studyLevel);
  const sourceCategories = Array.isArray(categories) ? categories : [];
  return sourceCategories
    .filter((category) => categoryMatchesStudyLevel(category, selectedLevelKey))
    .flatMap((category) => getAdmissionChoicesFromCategories([category]));
}

export function getFinanceForChoice(choice, universityFinance) {
  if (choice?.finance_override && typeof choice.finance_override === "object") {
    if (getTrackFundingType(choice) === "grant" && choice.__is_funding_option) return null;
    return choice.finance_override;
  }
  const levels = getCategoryLevelsList(choice).map(normalizeLevelKey);
  const scope = String(choice?.scope || "").toLowerCase();
  const isGraduate = levels.some((level) => ["master", "mba", "doctorate", "professional"].includes(level))
    || /^(graduate|postgraduate|doctoral)/.test(scope);
  return isGraduate ? null : universityFinance;
}

function modeAwareAnnualCostIfKnown(finance, studyMode) {
  if (!finance || typeof finance !== "object") return undefined;
  const total = modeAwareAnnualCost(finance, studyMode);
  const publishedTotal = finance.total_cost_year_usd;
  const hasPublishedTotal = publishedTotal != null
    && String(publishedTotal).trim() !== ""
    && Number.isFinite(Number(publishedTotal));
  return !hasPublishedTotal && Number(total) === 0 ? undefined : total;
}

function publishedAnnualCostRange(finance) {
  if (!finance || typeof finance !== "object") return null;
  const nestedRange = finance.total_cost_year_range && typeof finance.total_cost_year_range === "object"
    ? finance.total_cost_year_range
    : {};
  const minValue = nestedRange.min ?? finance.total_cost_year_min;
  const maxValue = nestedRange.max ?? finance.total_cost_year_max;
  const currency = String(nestedRange.currency || finance.currency || "").trim().toUpperCase();
  if (minValue == null || maxValue == null || String(minValue).trim() === "" || String(maxValue).trim() === "" || !currency) return null;
  const min = Number(minValue);
  const max = Number(maxValue);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
  return {
    min,
    max,
    currency,
    academicYear: String(nestedRange.academic_year || finance.academic_year || "").trim(),
    feeStatus: String(finance.fee_status || "").trim().toLowerCase(),
    scope: String(finance.scope || "").trim(),
  };
}

function publishedAnnualCostRangeForChoice(choice, universityFinance) {
  const choiceRange = publishedAnnualCostRange(choice?.finance_override);
  if (choiceRange) return choiceRange;
  const universityRange = publishedAnnualCostRange(universityFinance);
  const categoryScope = String(choice?.category_label || choice?.label || "")
    .split("(")[0]
    .trim()
    .toLowerCase();
  if (!universityRange?.scope || !categoryScope || !universityRange.scope.toLowerCase().includes(categoryScope)) return null;
  return universityRange;
}

function getCommonAnnualCostRange(choices, universityFinance) {
  if (!choices.length) return null;
  const ranges = choices.map((choice) => publishedAnnualCostRangeForChoice(choice, universityFinance));
  if (ranges.some((range) => !range)) return null;
  const signatures = new Set(ranges.map((range) => JSON.stringify(range)));
  if (signatures.size !== 1) return null;
  const range = ranges[0];
  return range.academicYear && (range.scope || range.feeStatus) ? range : null;
}

function getProgramTuitionForChoice(choice, university) {
  const programIds = Array.isArray(choice?.program_ids) ? choice.program_ids.map((id) => String(id || "").trim().toLowerCase()) : [];
  const selectedProgramId = String(choice?.program_id || choice?.programId || "").trim().toLowerCase();
  if (!programIds.length && !selectedProgramId) return null;
  const catalogPrograms = Array.isArray(university?.academics?.programs) ? university.academics.programs : [];
  const identifiersFor = (item) => [item?.id, item?.course_number, item?.name, item?.title]
    .map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  const selectedProgram = selectedProgramId
    ? catalogPrograms.find((item) => [item?.id, item?.course_number].some((id) => String(id || "").trim().toLowerCase() === selectedProgramId))
    : null;
  if (selectedProgramId && (!selectedProgram || (programIds.length && !identifiersFor(selectedProgram).some((id) => programIds.includes(id))))) return null;
  const resolvedPrograms = selectedProgram ? [selectedProgram] : programIds.map((programId) => {
    return catalogPrograms.find((item) => identifiersFor(item).includes(programId));
  });
  if (!selectedProgram && resolvedPrograms.some((program) => !program)) return null;
  const programs = [...new Set(resolvedPrograms)];
  const pricedPrograms = programs.map((program) => ({
    program,
    amount: Number(program?.tuition_year_usd),
    sourceUrl: String(program?.tuition_source_url || "").trim(),
    currency: String(program?.currency || "USD").trim().toUpperCase(),
    cycle: String(program?.tuition_cycle || "").trim(),
  }));
  if (!pricedPrograms.length || pricedPrograms.some(({ amount, sourceUrl, cycle }) => !Number.isFinite(amount) || amount <= 0 || !sourceUrl || !cycle)) return null;
  const tuitionSignatures = new Set(pricedPrograms.map(({ amount, currency, cycle }) => {
    const year = cycle.match(/\b20\d{2}[-–]\d{2,4}\b/)?.[0] || "";
    return JSON.stringify([amount, currency, year]);
  }));
  const { amount, sourceUrl, currency, cycle } = pricedPrograms[0] || {};
  const year = cycle?.match(/\b20\d{2}[-–]\d{2,4}\b/)?.[0] || "";
  if (tuitionSignatures.size !== 1 || !year) return null;
  return {
    finance: {
      total_cost_year_usd: amount,
      costs_breakdown_year_usd: { Tuition: amount },
      currency,
    },
    year,
    sourceUrl,
  };
}

function annualCostRangeContext(range) {
  if (!range) return "";
  const applicantCategory = {
    domestic: t("university.finance.range_applicants.domestic", "Domestic applicants"),
    home: t("university.finance.range_applicants.home", "Home-fee applicants"),
    overseas: t("university.finance.range_applicants.overseas", "Overseas applicants"),
    international: t("university.finance.range_applicants.international", "International applicants"),
  }[range.feeStatus] || "";
  const scope = range.scope && range.scope.toLowerCase() !== "program"
    ? `${t("university.finance.range_scope_label", "Applies to")}: ${range.scope}`
    : "";
  const academicYear = range.academicYear
    ? `${t("university.finance.academic_year_label", "Academic year")}: ${range.academicYear}`
    : "";
  return [scope, applicantCategory, academicYear].filter(Boolean).join(" · ");
}

function hasFundingSpecificFinanceOverride(university, choice) {
  const category = (Array.isArray(university?.admission_categories) ? university.admission_categories : [])
    .find((item) => String(item?.id || "") === String(choice?.category_id || ""));
  if (!category) return false;
  const profiles = Array.isArray(category.requirement_profiles) ? category.requirement_profiles : [];
  const profile = profiles.find((item) => String(item?.id || "") === String(choice?.requirement_profile_id || ""));
  const fundingOptions = Array.isArray(profile?.funding_options) && profile.funding_options.length
    ? profile.funding_options
    : (Array.isArray(category.funding_options) ? category.funding_options : []);
  const funding = fundingOptions.find((item) => String(item?.id || "") === String(choice?.funding_option_id || ""));
  return isPlainObject(funding?.finance_override);
}

function getCourseFinanceWithoutAwardOverride(university, choice) {
  const categories = Array.isArray(university?.admission_categories) ? university.admission_categories : [];
  const category = categories.find((item) => String(item?.id || "") === String(choice?.category_id || ""));
  if (!category) return null;
  const profiles = Array.isArray(category.requirement_profiles) ? category.requirement_profiles : [];
  const profile = profiles.find((item) => String(item?.id || "") === String(choice?.requirement_profile_id || ""));
  if (isPlainObject(profile?.finance_override)) return profile.finance_override;
  if (isPlainObject(category.finance_override)) return category.finance_override;
  const levels = getCategoryLevelsList(choice).map(normalizeLevelKey);
  const scope = String(choice?.scope || "").toLowerCase();
  const isGraduate = levels.some((level) => ["master", "mba", "doctorate", "professional"].includes(level))
    || /^(graduate|postgraduate|doctoral)/.test(scope);
  return isGraduate ? null : university?.finance || null;
}

export function renderFinanceSection({
  annualCostForTrack,
  container,
  priceEl,
  profileStudyMode,
  scholarshipContainer,
  university,
}) {
  if (university.finance) {
    const profile = loadProfile() || {};
    const selectedStudyLevel = profile.studyLevel || profile.study_level;
    const admissionContext = selectedAdmissionContext(university, getAdmissionContextProfile(university, loadProfileForApi()));
    const isProgramSelected = admissionContext.selectedProgram !== GENERAL_PROGRAM_KEY;
    const financeCategories = admissionContext.visibleCategories;
    const financeStudyLevel = admissionContext.selectedLevel || selectedStudyLevel;
    const selectedProgramRecord = (Array.isArray(university?.academics?.programs) ? university.academics.programs : [])
      .find((program) => [program?.id, program?.course_number].some((value) => String(value || "") === String(admissionContext.selectedProgramId || "")));
    const directProgramTuition = (() => {
      const rawAmount = selectedProgramRecord?.tuition_year_usd;
      const amount = Number(rawAmount);
      const sourceUrl = safeHttpUrl(selectedProgramRecord?.tuition_source_url || selectedProgramRecord?.source_url);
      const cycle = String(selectedProgramRecord?.tuition_cycle || "").trim();
      if (!selectedProgramRecord || rawAmount == null || String(rawAmount).trim() === "" || !Number.isFinite(amount) || amount < 0 || !sourceUrl || !cycle) return null;
      return { amount, currency: String(selectedProgramRecord.currency || university.finance.currency || "USD"), cycle, sourceUrl };
    })();
    const directTuitionMatchesCycle = directProgramTuition
      && (!admissionContext.cycle || cycleMatches(directProgramTuition.cycle, admissionContext.cycle) === true);
    const policyData = resolveFeeStatusAndAid({
      university,
      profile,
      studyLevel: financeStudyLevel,
    });

    if (scholarshipContainer) {
      const categoriesForLevel = admissionContext.visibleCategories;
      const awardsHtml = renderFundingAwardList(
        university.finance,
        categoriesForLevel,
        admissionContext.selectedLevel || selectedStudyLevel,
        categoriesForLevel,
      );
      const grants = getGrantsFromCategories(categoriesForLevel);
      const legacyGrantsHtml = grants.length
        ? grants.map((grant) => renderScholarshipLine(
            "information-circle",
            "scholarship-line--muted",
            `${trTrackDescription(university.id, grant.id, grant.name)} · ${t("university.finance.award_not_confirmed", "Award not confirmed")}`,
          )).join("")
        : "";
      const policyLineHtml = policyData.aidBadge
        ? renderScholarshipLine(
            "information-circle",
            "scholarship-line--muted",
            `${policyData.aidBadge}: ${policyData.thresholds.length ? policyData.thresholds[0].label : policyData.feeStatusBadge || t("placeholder.field.financial_aid", "Financial aid")}`,
          )
        : "";
      const fundingSourceUrl = categoriesForLevel.map((category) => safeHttpUrl(category.funding_source_url)).find(Boolean);
      const fundingNextStepHtml = fundingSourceUrl
        ? `<div class="scholarship-line scholarship-line--muted">${renderInlineIcon("arrow-top-right-on-square", 16, "scholarship-line-icon")}<a href="${escapeHtmlAttr(fundingSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("placeholder.field.financial_aid", "Financial aid"))}</a></div>`
        : "";
      const emptyHtml = renderScholarshipLine(
        "question-mark-circle",
        "scholarship-line--muted",
        t("university.finance.aid_not_catalogued", "No grant options are catalogued here. Check the university's official financial aid policy."),
      );
      const hasScopedAwards = Array.isArray(university.finance.scholarships_and_funding)
        && university.finance.scholarships_and_funding.length > 0;
      scholarshipContainer.innerHTML = `
        <p class="finance-awards-disclaimer">${escapeHtml(t("university.finance.awards_not_guaranteed", "These are funding opportunities, not award offers. Estimated costs do not decrease unless aid is officially awarded."))}</p>
        ${awardsHtml || (hasScopedAwards
          ? renderScholarshipLine("information-circle", "scholarship-line--muted", t("university.finance.award_none_for_scope", "No listed awards match this study level and program."))
          : (legacyGrantsHtml || policyLineHtml || emptyHtml))}
        ${awardsHtml ? legacyGrantsHtml : fundingNextStepHtml}
      `;
    }

    if (priceEl) {
      let minTotal = financeStudyLevel ? undefined : modeAwareAnnualCostIfKnown(university.finance, profileStudyMode);
      const allFundingOptions = getFinanceChoicesForStudyLevel(financeCategories, financeStudyLevel);
      const summaryRange = getCommonAnnualCostRange(allFundingOptions, university.finance);
      if (isProgramSelected && !allFundingOptions.length && directTuitionMatchesCycle) minTotal = directProgramTuition.amount;
      if (allFundingOptions.length) {
        const prices = allFundingOptions
          .map((option) => annualCostForTrack(option))
          .filter((price) => price != null && Number.isFinite(Number(price)) && Number(price) >= 0);
        if (prices.length > 0) minTotal = Math.min(...prices);
      }
      const uniCurrency = university?.finance?.currency || "USD";
      const currentCycleRange = summaryRange && admissionContext.cycle
        ? (cycleMatches(summaryRange.academicYear, admissionContext.cycle) === true ? summaryRange : null)
        : summaryRange;
      if (directTuitionMatchesCycle && isProgramSelected && !allFundingOptions.length) {
        priceEl.textContent = formatPrice(directProgramTuition.amount, directProgramTuition.currency);
        const priceCard = priceEl.closest?.(".total-price-card");
        const title = priceCard?.querySelector(".price-header");
        const context = priceCard?.querySelector(".price-context");
        if (title) title.textContent = t("university.finance.published_tuition_per_year", "Published tuition / year");
        if (context) context.textContent = directProgramTuition.cycle;
      } else if (currentCycleRange) {
        priceEl.textContent = `${formatMoney(currentCycleRange.min, currentCycleRange.currency)}–${formatMoney(currentCycleRange.max, currentCycleRange.currency)}`;
        const priceCard = priceEl.closest?.(".total-price-card");
        const title = priceCard?.querySelector(".price-header");
        const context = priceCard?.querySelector(".price-context");
        if (title) title.textContent = t("university.finance.published_range_title", "Published annual cost range");
        if (context) context.textContent = annualCostRangeContext(currentCycleRange);
      } else {
        priceEl.innerHTML = minTotal != null && Number.isFinite(Number(minTotal))
          ? `<span class="price-prefix">${escapeHtml(translateWord("from", "from"))}</span> ${escapeHtml(formatPrice(minTotal, uniCurrency))}`
          : escapeHtml(unknownFieldText("placeholder.field.cost", "Cost"));
        const priceCard = priceEl.closest?.(".total-price-card");
        const title = priceCard?.querySelector(".price-header");
        const context = priceCard?.querySelector(".price-context");
        if (title) title.textContent = t("university.finance.lowest_annual_estimate", "Lowest annual estimate");
        if (context) context.textContent = t("university.finance.estimate_context", "Across published funding options");
      }
    }
    if (container) {
      const choices = getFinanceChoicesForStudyLevel(financeCategories, financeStudyLevel);
      const financeChoices = choices.length
        ? choices
        : (isProgramSelected || financeStudyLevel ? [] : [{ label: translateWord("general_tuition", "General Tuition"), finance_override: null, category_label: translateWord("general_tuition", "General Tuition") }]);
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
          const grantHasAwardSpecificOverride = isGrantTrack && hasFundingSpecificFinanceOverride(university, option);
          let financeData = grantHasAwardSpecificOverride
            ? getCourseFinanceWithoutAwardOverride(university, option)
            : getFinanceForChoice(option, university.finance);
          const programTuition = financeData ? null : getProgramTuitionForChoice(option, university);
          if (programTuition) financeData = programTuition.finance;
          const totalRange = grantHasAwardSpecificOverride
            ? publishedAnnualCostRange(financeData)
            : publishedAnnualCostRangeForChoice(option, university.finance);
          const total = totalRange ? undefined : modeAwareAnnualCostIfKnown(financeData, profileStudyMode);
          const breakdown = modeAwareBreakdown(financeData || {}, profileStudyMode);
          const uniCurrency = financeData?.currency || university?.finance?.currency || "USD";
          const totalText = totalRange
            ? `${formatMoney(totalRange.min, totalRange.currency)}–${formatMoney(totalRange.max, totalRange.currency)}`
            : moneyOrUnknown(total, "placeholder.field.total_cost", "Total cost", uniCurrency);
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

          const optionLabel = trTrackLabel(option.funding_label || option.label || option.name || option.requirement_profile_label || "");
          const fundingMeta = [
            option.funding_program
              ? [t("admission.track.funding_program", "Funding program"), trTrackDescription(university.id, option.id, option.funding_program)]
              : null,
            option.funding_source
              ? [t("admission.track.funding_source", "Funding source"), trTrackDescription(university.id, option.id, option.funding_source)]
              : null,
          ].filter(Boolean);

          const totalTitle = programTuition
            ? t("university.finance.published_tuition_per_year", "Published tuition / year")
            : isGrantTrack
              ? t("university.finance.cost_before_aid", "Estimated cost before aid")
              : translateWord("total_per_year", "Total / year");
          const grantEstimateNoteHtml = isGrantTrack
            ? `<p class="finance-aid-note">${escapeHtml(t("university.finance.awards_not_deducted", "A possible award is not subtracted from this amount until it has been officially granted."))}</p>`
            : "";
          const rangeContext = annualCostRangeContext(totalRange);
          const rangeContextHtml = totalRange && rangeContext
            ? `<p class="finance-cost-range-context">${escapeHtml(rangeContext)}</p>`
            : "";
          const rangeNote = totalRange && (financeData?.note || financeData?.costs_breakdown_note)
            ? `<p class="finance-cost-range-note">${escapeHtml(financeData.note || financeData.costs_breakdown_note)}</p>`
            : "";
          const programTuitionNote = programTuition
            ? `<p class="finance-cost-range-note">${escapeHtml(t("university.finance.program_tuition_context", "Published gross tuition for {year}; potential awards are not deducted. Confirm the rate for your entry cycle.").replace("{year}", programTuition.year))} <a href="${escapeHtmlAttr(programTuition.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.finance.official_tuition_source", "Official tuition source"))}</a></p>`
            : "";
          const breakdownHtml = breakdownEntries.length > 1
            ? `
              <div class="cost-progress-bar" aria-hidden="true">
                ${breakdownEntries.map((entry) => `<span class="cost-progress-segment ${entry.colorClass}" data-width-pct="${escapeHtmlAttr(entry.percent)}"></span>`).join("")}
              </div>
              <dl class="cost-legend">
                ${breakdownEntries.map((entry) => `
                  <div class="cost-legend-row">
                    <dt class="cost-legend-label-wrap">
                      <span class="cost-legend-dot ${entry.colorClass}"></span>
                      <span class="cost-legend-label">${escapeHtml(entry.label)}</span>
                    </dt>
                    <dd class="cost-legend-value">${escapeHtml(formatPrice(entry.value, uniCurrency))}</dd>
                  </div>
                `).join("")}
              </dl>
            `
            : (breakdownEntries.length === 1
              ? `<div class="cost-legend-single">${escapeHtml(breakdownEntries[0].label)}: <strong>${escapeHtml(formatPrice(breakdownEntries[0].value, uniCurrency))}</strong></div>`
              : `<div class="cost-legend-single">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`);
          const breakdownNoteHtml = breakdownNote
            ? `<div class="finance-breakdown-note">${escapeHtml(breakdownNote)}</div>`
            : "";

          return `
            <article class="finance-option-card ${isGrantTrack ? "finance-option-card--grant" : "finance-option-card--paid"}">
              <div class="finance-option-head">
                ${renderTrackFundingBadge(option)}
                ${optionLabel ? `<h4 class="finance-option-label">${escapeHtml(optionLabel)}</h4>` : ""}
              </div>

              <div class="finance-option-total${isGrantTrack ? " finance-option-total--grant" : ""}">
                <span class="finance-option-total__label">${escapeHtml(totalTitle)}</span>
                <strong class="finance-option-total__value">${escapeHtml(totalText)}</strong>
                ${rangeContextHtml}
                ${rangeNote}
                ${programTuitionNote}
              </div>

              ${grantEstimateNoteHtml}

              ${renderFinanceMetaList(fundingMeta)}

              <div class="cost-breakdown-list">
                <div class="finance-breakdown-title">${escapeHtml(t("university.finance.cost_breakdown", "Cost breakdown"))}</div>
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

      if (isProgramSelected && !financeChoices.length && directProgramTuition) {
        const requestedCycleNote = admissionContext.cycle && !directTuitionMatchesCycle
          ? `<p class="finance-cycle-unknown">${escapeHtml(t("university.finance.program_cycle_unknown", "Cost for the selected entry cycle has not been confirmed. The published amount below is a reference for a different or unclear period."))}</p>`
          : "";
        financeHtml = `
          <article class="finance-option-card finance-program-tuition-reference">
            <div class="finance-option-head"><h4 class="finance-option-label">${escapeHtml(trProgramName(selectedProgramRecord.name || selectedProgramRecord.program_name) || selectedProgramRecord.name || selectedProgramRecord.program_name || "")}</h4></div>
            <div class="finance-option-total"><span class="finance-option-total__label">${escapeHtml(t("university.finance.published_tuition_per_year", "Published tuition / year"))}</span><strong class="finance-option-total__value">${escapeHtml(formatPrice(directProgramTuition.amount, directProgramTuition.currency))}</strong><p class="finance-cost-range-context">${escapeHtml(t("university.finance.program_tuition_context", "Published gross tuition for {year}; potential awards are not deducted. Confirm the rate for your entry cycle.").replace("{year}", directProgramTuition.cycle))}</p>${requestedCycleNote}<a href="${escapeHtmlAttr(directProgramTuition.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.finance.official_tuition_source", "Official tuition source"))}</a></div>
          </article>`;
      }

      const policyHtml = renderFinancePolicyOverview(policyData);
      const oneTimeCostsHtml = renderOneTimeCosts(university.finance);
      const financeGridHtml = financeHtml
        ? `<div class="finance-grid-new">${financeHtml}</div>`
        : `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.cost_breakdown", "Cost breakdown"))}</div>`;
      container.innerHTML = `${policyHtml}${oneTimeCostsHtml}${financeGridHtml}`;
      applyPercentWidths(container);
      markMotionEnter(container, ".finance-policy-card, .finance-one-time-costs, .finance-track-group, .finance-option-card, .admission-empty-state", { limit: 18, staggerMs: 18 });
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
}
