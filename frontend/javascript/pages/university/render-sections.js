import {
  aiName,
  escapeHtml,
  escapeHtmlAttr,
  getSelectedAdmissionTrack,
  moneyUSD,
  motionPress,
  replayMotion,
  saveSelectedAdmissionTrack,
  markMotionEnter,
} from "../../utils.js";
import { t } from "../../i18n.js";
import {
  applyPercentWidths,
  getTrackFundingType,
  getTrackFundingOptions,
  renderExamGroup,
  renderTrackChanceChip,
  renderTrackFundingBadge,
  renderUniChanceSummary,
  splitExamEntries,
  trackLookupKey,
} from "../../university-detail-helpers.js";
import { translateTemplate, translateWord } from "../../university-translations.js";
import {
  costBreakdownCoverageNote,
  formatFundingOptionsCount,
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

export function renderAdmissionSection({
  annualCostForTrack,
  container,
  uniChance,
  uniChanceByTrackKey,
  university,
}) {
  if (!container) return;

  const warningHtml = uniChance?.missingEvidence
    ? `<div class="chance-warning">${escapeHtml(translateTemplate("add_profile_evidence", "Add exam scores or language evidence in your profile to unlock a reliable {chance} estimate for this university.", { chance: aiName("chance") }))}</div>`
    : "";
  const admissionsData = university?.academics?.admissions && typeof university.academics.admissions === "object"
    ? university.academics.admissions
    : null;
  const admissionsOverviewHtml = renderAdmissionsOverview(admissionsData);

  if (!university.admission_tracks || university.admission_tracks.length === 0) {
    container.innerHTML = `${warningHtml}${renderUniChanceSummary(uniChance)}${admissionsOverviewHtml}<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.admission_tracks", "Admission tracks"))}</div>`;
    applyPercentWidths(container);
    markMotionEnter(container, ".admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 12, staggerMs: 18 });
    return;
  }

  const tracks = Array.isArray(university.admission_tracks) ? university.admission_tracks : [];
  const trackEntries = tracks
    .map((track, idx) => ({
      idx,
      options: getTrackFundingOptions(track),
      track,
    }))
    .filter(({ options }) => options.length > 0);
  const bestTrackKey = String(uniChance?.bestTrackKey || "").trim();
  const recommendedTrackKey = String(uniChance?.recommendedTrackKey || bestTrackKey || "").trim();
  const selectedTrackKey = getSelectedAdmissionTrack(university.id);
  const effectiveSelectedTrackKey = selectedTrackKey || bestTrackKey;
  const selectedTrackTooltip = t(
    "admission.track.select_tooltip",
    "Select this admission track to use it for admission chance display and for UniFit ranking.",
  );

  let tracksHtml = warningHtml + renderUniChanceSummary(uniChance) + admissionsOverviewHtml;

  trackEntries.forEach(({ track, options }) => {
    const trackLabel = trTrackLabel(track.label || "");
    const trackDescription = trTrackDescription(university.id, track.id, track.description || "");
    const majors = Array.isArray(track.applicable_majors) ? track.applicable_majors : [];
    const translatedMajors = majors.map((major) => trProgramName(major)).filter(Boolean);
    const majorsBadge = translatedMajors.length
      ? `
        <div class="track-applicable-majors">
          <strong>${escapeHtml(translateWord("placeholder.field.applicable_majors", "Applicable majors"))}:</strong>
          ${translatedMajors.map((major) => `<span class="tag">${escapeHtml(major)}</span>`).join("")}
        </div>
      `
      : "";

    const optionCardsHtml = options.map((option, optionIdx) => {
      const trackKey = trackLookupKey(option, optionIdx);
      const trackChance = uniChanceByTrackKey.get(trackKey);
      const isRecommendedTrack = Boolean(recommendedTrackKey && trackKey === recommendedTrackKey);
      const isSelectedTrack = Boolean(effectiveSelectedTrackKey && trackKey === effectiveSelectedTrackKey);

      const selectionBadges = [];
      if (isRecommendedTrack) selectionBadges.push(escapeHtml(t("admission.track.recommended", "Recommended")));

      const selectionBadgeHtml = selectionBadges.length
        ? `<div class="track-selection-badge">${selectionBadges.join(" / ")}</div>`
        : "";

      const optionPriceOverride = option.finance_override?.total_cost_year_usd;
      const optionPrice = annualCostForTrack(option);
      const isGrantTrack = getTrackFundingType(option) === "grant";
      const priceTitle = isGrantTrack
        ? (optionPriceOverride != null
          ? translateWord("est_net_cost", "Est. Net Cost")
          : translateWord("base_cost_before_grant", "Base Cost (before grant)"))
        : translateWord("est_cost", "Est. Cost");
      const priceValue = Number.isFinite(Number(optionPrice))
        ? moneyUSD(optionPrice)
        : unknownFieldText("placeholder.field.cost", "Cost");

      const requirements = option.requirements || {};
      const minParts = splitExamEntries(requirements);
      const minList = [
        renderExamGroup(
          translateWord("academic_requirements", "Academic requirements"),
          minParts.acad,
          "#2563eb",
        ),
        renderTrackLanguageExamGroup(option, "requirements"),
      ].filter(Boolean).join("");

      const statsAvg = option.stats_avg || {};
      const avgParts = splitExamEntries(statsAvg);
      const avgList = [
        renderExamGroup(
          translateWord("academic_average", "Academic average"),
          avgParts.acad,
          "#2563eb",
        ),
        renderTrackLanguageExamGroup(option, "average"),
      ].filter(Boolean).join("");

      const minContent = minList || `<div class="track-muted-italic">${escapeHtml(unknownFieldText("placeholder.field.minimum_requirements", "Minimum requirements"))}</div>`;
      const avgContent = avgList || `<div class="track-muted-italic">${escapeHtml(translateWord("average_admitted_unavailable", "No verified average admitted data published."))}</div>`;
      const extraRequirementItems = Array.isArray(option.extra_requirements)
        ? option.extra_requirements
          .map((item) => trTrackDescription(university.id, option.id, item))
          .filter(Boolean)
        : [];
      const extraReqInfo = extraRequirementItems.length
        ? `
          <div class="track-extra-req">
            <div class="track-extra-req-title">${escapeHtml(translateWord("extra_requirements", "Extra requirements"))}</div>
            <ul class="track-extra-req-list">${extraRequirementItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
        `
        : "";

      const optionLabelRaw = String(option.label || "").trim();
      const parentLabelRaw = String(track.label || "").trim();
      const optionLabel = optionLabelRaw && optionLabelRaw !== parentLabelRaw
        ? trTrackLabel(optionLabelRaw)
        : "";
      const fundingMeta = [
        option.funding_program
          ? [t("admission.track.funding_program", "Funding program"), trTrackDescription(university.id, option.id, option.funding_program)]
          : null,
        option.funding_source
          ? [t("admission.track.funding_source", "Funding source"), trTrackDescription(university.id, option.id, option.funding_source)]
          : null,
      ].filter(Boolean);

      return `
        <article class="admission-option-card${isGrantTrack ? " admission-option-card--grant" : ""}">
          <div class="admission-option-head">
            <div class="admission-option-title-wrap">
              ${renderTrackFundingBadge(option)}
              ${optionLabel ? `<div class="admission-option-title">${escapeHtml(optionLabel)}</div>` : ""}
              ${renderTrackChanceChip(trackChance)}
            </div>
            ${selectionBadgeHtml}
          </div>

          ${renderFundingMetaTags(fundingMeta)}

          <div class="track-cost-preview${isGrantTrack ? " track-cost-preview--grant" : ""}">
            <strong>${escapeHtml(priceTitle)}:</strong> ${escapeHtml(priceValue)}
          </div>

          <div class="track-stats-grid">
            <div class="track-stats-box track-stats-box--min">
              <div class="track-stats-title">${escapeHtml(translateWord("minimum_to_apply", "Minimum to apply"))}</div>
              <div class="track-stats-values">${minContent}</div>
            </div>
            <div class="track-stats-box track-stats-box--avg">
              <div class="track-stats-title track-stats-title--avg">${escapeHtml(translateWord("real_average_admitted", "Average admitted"))}</div>
              <div class="track-stats-values">${avgContent}</div>
            </div>
          </div>

          ${extraReqInfo}

          <div class="track-select-row">
            <button
              type="button"
              class="track-select-btn${isSelectedTrack ? " is-active" : ""}"
              data-track-select-key="${escapeHtml(trackKey)}"
              title="${escapeHtml(selectedTrackTooltip)}"
              ${isSelectedTrack ? "disabled" : ""}
            >
              ${escapeHtml(isSelectedTrack ? t("admission.track.selected", "Selected") : t("admission.track.select", "Select"))}
            </button>
          </div>
        </article>
      `;
    }).join("");

    const trackHasGrantOnlyOptions = options.length > 0 && options.every((option) => getTrackFundingType(option) === "grant");

    tracksHtml += `
      <section class="track-card${trackHasGrantOnlyOptions ? " track-card--grant" : ""}">
        <div class="track-header">
          <div>
            <h3 class="track-title">${escapeHtml(trackLabel || unknownFieldText("placeholder.field.track_name", "Track name"))}</h3>
            ${trackDescription ? `<p class="track-description">${escapeHtml(trackDescription)}</p>` : ""}
          </div>
          <div class="track-option-count">${escapeHtml(formatFundingOptionsCount(options.length))}</div>
        </div>

        ${majorsBadge}

        <div class="track-funding-options-block">
          <div class="track-funding-options-title">${escapeHtml(translateWord("admission.track.funding_options", "Funding options"))}</div>
          <div class="track-funding-options-grid">${optionCardsHtml}</div>
        </div>
      </section>
    `;
  });

  container.innerHTML = tracksHtml;
  container.querySelectorAll("[data-track-select-key]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      motionPress(button);
      const trackKey = String(button.getAttribute("data-track-select-key") || "").trim();
      if (!trackKey) return;
      saveSelectedAdmissionTrack(university.id, trackKey);
      container.querySelectorAll("[data-track-select-key]").forEach((node) => {
        const active = String(node.getAttribute("data-track-select-key") || "").trim() === trackKey;
        node.classList.toggle("is-active", active);
        node.disabled = active;
        node.textContent = active
          ? t("admission.track.selected", "Selected")
          : t("admission.track.select", "Select");
      });
      replayMotion(button.closest(".admission-option-card") || button, "motion-state-pulse", { timeoutMs: 520 });
      replayMotion(button.closest(".track-card") || container, "motion-panel-enter", { timeoutMs: 420 });
    });
  });

  applyPercentWidths(container);
  markMotionEnter(container, ".track-card, .admission-option-card, .admissions-summary-card, .admissions-program-card, .admission-empty-state", { limit: 18, staggerMs: 18 });
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
      const allFundingOptions = (Array.isArray(university.admission_tracks) ? university.admission_tracks : [])
        .flatMap((track) => getTrackFundingOptions(track));
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
      const tracks = (Array.isArray(university.admission_tracks) && university.admission_tracks.length > 0)
        ? university.admission_tracks
        : [{ label: translateWord("general_tuition", "General Tuition"), finance_override: null }];

      let financeHtml = "";

      tracks.forEach((track) => {
        const optionRows = getTrackFundingOptions(track);
        const trackHasGrantOnlyOptions = optionRows.length > 0 && optionRows.every((option) => getTrackFundingType(option) === "grant");

        const optionCardsHtml = optionRows.map((option) => {
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

          const optionLabelRaw = String(option.label || "").trim();
          const parentLabelRaw = String(track.label || "").trim();
          const optionLabel = optionLabelRaw && optionLabelRaw !== parentLabelRaw
            ? trTrackLabel(optionLabelRaw)
            : "";
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
                ${breakdownEntries.map((entry) => `<span class="cost-progress-segment ${entry.colorClass}" style="--fill-width:${entry.percent}%"></span>`).join("")}
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
              <h3>${escapeHtml(trTrackLabel(track.label || "") || translateWord("placeholder.field.track_name", "Track name"))}</h3>
              ${track.description ? `<p>${escapeHtml(trTrackDescription(university.id, track.id, track.description))}</p>` : ""}
            </div>

            <div class="finance-track-options-title">${escapeHtml(translateWord("admission.track.funding_options", "Funding options"))}</div>
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
