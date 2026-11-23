import {
  escapeHtml,
  escapeHtmlAttr,
  formatExamValue,
  getExamDisplayName,
  getFlagImg,
  loadProfile,
  nested,
} from "../../utils.js";
import {
  chanceNoDataHelpNote,
  getGrantsFromCategories,
} from "../../university-detail-helpers.js";
import { heroIcon } from "../../icons.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { convert, formatMoney, getPreferredCurrency } from "../../currency.js";
import { routeUniversityDetail } from "../../routes.js";
import {
  renderInlineIcon,
  renderLocationMarkup,
  textOrUnknown,
  toFiniteNumber,
  trCity,
  trCountry,
  trUniversityName,
  uniThumbnailSrc,
} from "../_shared.js";
import { translateWord } from "../../university-translations.js";
import {
  buildRankSourceTooltip,
  renderUniversityCardCosts,
  universityCardPriceInfo,
} from "./card-tooltips.js";
import {
  budgetTooltip,
  closePreferenceLabels,
  exactBudgetMoney,
  missingExamNames,
  reviewedMissingInputs,
  unmetMinimums,
} from "./unifit-explanation.js";

const tooltipMoney = (usd) => {
  const code = getPreferredCurrency();
  const amount = convert(Number(usd), "USD", code);
  return Number.isFinite(amount) ? formatMoney(amount, code) : formatMoney(Number(usd), "USD");
};
const tooltipBudgetMoney = (usd) => exactBudgetMoney(usd, loadProfile(), { convert, formatMoney, fallback: tooltipMoney });
const tooltipHelpers = { money: tooltipMoney, budgetMoney: tooltipBudgetMoney, tr: t, trf: tFormat };
const cardExamLabel = (id) => getExamDisplayName(id, { locale: getCurrentLanguage() });
const preferenceTooltip = (match, fallbackKey) => {
  const labels = closePreferenceLabels(match).map((label) => t(`universities.tradeoff.${label}`).toLocaleLowerCase());
  return labels.length ? tFormat("universities.tip.preferences_close", { dimensions: labels.join(", ") }) : t(fallbackKey);
};

export function reviewedCardIndicators(match, budget) {
  if (!match || match.finalScore == null || !Number.isFinite(Number(match.finalScore))) return [];
  const indicators = [];
  // `legend` names the meaning of the icon for the UniFit banner legend (see LEGEND_LABEL_KEYS).
  const add = (icon, tone, label, detail, priority = 2, value = "", legend = "") => indicators.push({ icon, tone, label, detail, priority, value, legend });
  const programSelected = Boolean(match.admissionsContext?.study_option_id);
  if (match.subjectMatch?.status === "missing") {
    add(
      "academic-cap",
      "warning",
      t(programSelected ? "universities.match.selected_subject_mismatch" : "universities.match.subject_missing"),
      t(programSelected ? "universities.match.selected_subject_mismatch_detail" : "universities.match.subject_missing_detail"),
      0,
      "",
      "subject_missing"
    );
  } else if (match.subjectMatch?.status === "matched") {
    // Name how many programs match and what choosing one unlocks, instead of restating the label.
    const count = Array.isArray(match.subjectMatch.option_ids) ? match.subjectMatch.option_ids.length : 0;
    const detail = programSelected ? t("universities.tip.subject_selected")
      : count ? tFormat("universities.tip.subject_options", { count }) : t("universities.match.subject_matched_detail");
    add("academic-cap", "match", t("universities.match.subject_matched"), detail, 2, "", "subject_matched");
  }
  const mismatch = match.preferenceMismatch == null ? NaN : Number(match.preferenceMismatch);
  if (Number.isFinite(mismatch) && mismatch <= 0.22) {
    add(
      "heart",
      "match",
      t(mismatch <= 0.14 ? "universities.badge.your_vibe" : "universities.badge.top_match"),
      preferenceTooltip(match, "universities.match.preference_detail"),
      3,
      "",
      "vibe"
    );
  }
  // A published check of the selected route that the profile cannot answer yet: say what to add.
  const missingInputs = reviewedMissingInputs(match.requirementChecks, {
    examLabel: cardExamLabel,
    joiner: t("admission.requirements_fit.check.or", "or"),
  }).slice(0, 3);
  if (missingInputs.length) {
    add(
      "clipboard-document-list",
      "warning",
      t("universities.badge.conditional_exam_needed"),
      tFormat("universities.tip.add_to_profile", { exams: missingInputs.join(", ") }),
      1,
      "",
      "exam_needed"
    );
  }
  const checks = Array.isArray(match.requirementChecks) ? match.requirementChecks.filter((check) => check.measurable) : [];
  if (typeof match.requirementsFitPercent === "number" && Number.isFinite(match.requirementsFitPercent) && checks.length) {
    const met = checks.filter((check) => check.status === "met").length;
    const percent = new Intl.NumberFormat(
      { eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" }[getCurrentLanguage()] || "en-US",
      { maximumFractionDigits: 1 }
    ).format(match.requirementsFitPercent);
    add(
      "clipboard-document-list",
      met < checks.length ? "warning" : "finance",
      tFormat("universities.match.score", { percent }),
      tFormat("universities.match.checks_detail", { met, total: checks.length }),
      met < checks.length ? 0 : 2,
      `${percent}%`,
      met < checks.length ? "requirements_below" : "requirements_met"
    );
  }
  const assessment = match.budgetAssessment || {};
  // Prices that differ by fee status (Home / Overseas) cannot be compared until the reader sets one.
  const feeStatusUnknown = assessment.status === "unknown_cost" && assessment.evidence === "fee_status_unknown";
  if (Number(budget) > 0 && match.costQuote && (feeStatusUnknown || ["within_budget", "over_budget", "uncertain_range"].includes(assessment.status))) {
    const state = feeStatusUnknown ? "uncertain" : { within_budget: "within", over_budget: "over", uncertain_range: "uncertain" }[assessment.status];
    const detail = budgetTooltip({
      status: feeStatusUnknown ? "fee_status" : { within: "within", over: "over", uncertain: "range" }[state],
      costMin: match.costQuote.minUSD,
      costMax: match.costQuote.maxUSD,
      budget,
      tuitionOnly: assessment.basis === "tuition",
    }, tooltipHelpers);
    add(
      "banknotes",
      state === "over" ? "budget" : "finance",
      t(`universities.match.budget_${state}`),
      detail,
      state === "over" ? 1 : 2,
      "",
      { over: "over_budget", within: "within_budget", uncertain: "budget_check" }[state]
    );
  }
  return indicators.sort((a, b) => a.priority - b.priority);
}

export function renderUniversityCard(u, myBudget, idx = 99, options = {}, ctx = {}) {
  const hideMedia = Boolean(options && options.hideMedia);
  const mapVariant = Boolean(options && options.mapVariant);
  const cardIsActive = Boolean(options && options.isActive);
  const costBasis = ctx.costBasis || "annual_total";
  const priceFilterActive = Boolean(ctx.priceFilterActive);
  const studyLevel = ctx.studyLevel || "";
  const isCompareMode = Boolean(ctx.isCompareMode);
  const compareUniversityIds = ctx.compareUniversityIds instanceof Set ? ctx.compareUniversityIds : new Set();
  const linkAttrs = ctx.linkAttrs || "";

  const id = u.id;
  const name = textOrUnknown(trUniversityName(u), "placeholder.field.university_name", "University name");
  const countryRaw = nested(u, ["location", "country"], "");
  const cityRaw = nested(u, ["location", "city"], "");
  const locHtml = renderLocationMarkup({
    city: trCity(cityRaw),
    country: trCountry(countryRaw),
    flagHtml: countryRaw ? getFlagImg(countryRaw) : "",
    wrapperClass: "uni-loc",
    iconClass: "uni-loc-icon",
    showIcon: false,
    cityClass: "uni-loc-city",
    countryClass: "uni-loc-country",
    fallbackClass: "uni-loc-line",
  });
  const reviewedAdmissions = u?.admissions_catalog?.availability === "reviewed";
  const match = u.matchData || {};
  const priceInfo = universityCardPriceInfo(u, costBasis);
  const cost = priceInfo.amount;
  const uniCurrency = priceInfo.currency;

  const statusIndicators = [];
  // `legend` is the meaning key the UniFit banner legend lists for this icon (LEGEND_LABEL_KEYS).
  const addStatusIndicator = (iconName, tone, label, detail = "", value = "", legend = "") => {
    const cleanLabel = String(label || "").trim();
    const cleanDetail = String(detail || "").trim();
    const ariaText = cleanDetail ? `${cleanLabel}: ${cleanDetail}` : cleanLabel;
    const tooltipHtml = cleanDetail
      ? `<strong class="uni-status-tooltip__title">${escapeHtml(cleanLabel)}</strong><span class="uni-status-tooltip__text">${escapeHtml(cleanDetail)}</span>`
      : `<strong class="uni-status-tooltip__title">${escapeHtml(cleanLabel)}</strong>`;
    statusIndicators.push(`
      <span class="uni-status-tooltip">
        <button class="uni-status-trigger uni-status-trigger--${tone}${value ? " uni-status-trigger--score" : ""}" type="button"${legend ? ` data-legend="${escapeHtmlAttr(legend)}" data-legend-icon="${escapeHtmlAttr(iconName)}" data-legend-tone="${escapeHtmlAttr(tone)}"` : ""} aria-label="${escapeHtmlAttr(ariaText)}" aria-expanded="false">
          <span aria-hidden="true">${renderInlineIcon(iconName, 16, "uni-status-icon")}</span>${value ? `<span class="uni-status-value" aria-hidden="true">${escapeHtml(value)}</span>` : ""}
        </button>
        <span class="u-tooltip uni-status-tooltip__content" role="tooltip">${tooltipHtml}</span>
      </span>
    `);
  };

  const badgeHints = (match.uiBadgeHints && typeof match.uiBadgeHints === "object") ? match.uiBadgeHints : {};
  const preferenceMismatch = Number(match.preferenceMismatch);
  const hintedVibe = String(badgeHints.vibe || "").toLowerCase();
  const hintedRequirements = reviewedAdmissions ? "" : String(badgeHints.requirements || "").toLowerCase();
  const hintedBudgetAid = reviewedAdmissions ? "" : String(badgeHints.budgetAid || "").toLowerCase();
  const conditionalCount = Number(match.conditionalRequirements || 0);
  const hasConditionalExamWarning = !reviewedAdmissions && ((badgeHints.showConditionalExamNeeded === true) || (!!match.conditional && conditionalCount > 0));
  const hasVeryHighVibeMatch = hintedVibe === "your_vibe" || (!hintedVibe && Number.isFinite(preferenceMismatch) && preferenceMismatch <= 0.14);
  const hasHighVibeMatch = hintedVibe === "top_match" || (!hintedVibe && Number.isFinite(preferenceMismatch) && preferenceMismatch > 0.14 && preferenceMismatch <= 0.22);
  const meetsMinRequirements = !reviewedAdmissions && (hintedRequirements === "requirements_met" || (!hintedRequirements && match.meetMinRequirements === true && !hasConditionalExamWarning));
  const hasRequirementsScore = !reviewedAdmissions && match.requirementsFitPercent !== null && match.requirementsFitPercent !== undefined;
  const belowRequirements = !reviewedAdmissions && (hintedRequirements === "below_requirements" || (!hintedRequirements && hasRequirementsScore && match.meetMinRequirements === false));
  const hasGrant = !reviewedAdmissions && getGrantsFromCategories(u?.admission_categories).length > 0;
  const aidAny = !reviewedAdmissions && (Object.hasOwn(match, "aidAny") ? match.aidAny === true : hasGrant);
  const hasUserBudget = Number.isFinite(Number(myBudget)) && Number(myBudget) > 0;
  const compareCostUSD = priceInfo.amountUSD ?? (cost !== null && uniCurrency ? (uniCurrency === "USD" ? cost : convert(cost, uniCurrency, "USD")) : cost);
  const overBudget = !reviewedAdmissions && costBasis === "annual_total" && hasUserBudget && compareCostUSD !== null && Number.isFinite(Number(compareCostUSD)) && Number(compareCostUSD) > Number(myBudget);
  const showOverBudgetAid = hintedBudgetAid === "over_budget_aid" || (!hintedBudgetAid && overBudget && aidAny);
  const showOverBudgetStrict = hintedBudgetAid === "over_budget" || (!hintedBudgetAid && overBudget && !aidAny);
  const showAidAvailable = hintedBudgetAid === "aid_available" || (!hintedBudgetAid && !overBudget && aidAny);
  const hasMissingProgram = !reviewedAdmissions && Boolean(badgeHints.missingProgram || match.missingProgram);

  // Earlier-format tooltips: one or two plain sentences (what to add, what falls short, price against budget).
  // The per-check breakdown stays on the university page.
  const requirementChecks = !reviewedAdmissions && Array.isArray(match.requirementChecks) ? match.requirementChecks : [];
  const orJoiner = t("admission.requirements_fit.check.or", "or");
  const missingExams = missingExamNames(requirementChecks, {
    examLabel: cardExamLabel,
    languageTest: t("universities.ux2.tip.language_test"),
    joiner: orJoiner,
  }).slice(0, 3);
  const examNeededDetail = missingExams.length
    ? tFormat("universities.tip.add_to_profile", { exams: missingExams.join(", ") })
    : t("universities.why.conditional_exam_needed");
  const unmet = unmetMinimums(requirementChecks, {
    examLabel: cardExamLabel,
    joiner: orJoiner,
    formatValue: (exam, value, context) => formatExamValue(exam, value, { context }),
  }).slice(0, 2);
  const belowDetail = unmet.length
    ? tFormat("universities.tip.below_minimum", { items: unmet.map((item) => tFormat("universities.tip.minimum_gap", item)).join("; ") })
    : t("admission.chance.requirements_not_met");
  const overBudgetDetail = budgetTooltip({ status: "over", costMin: compareCostUSD, budget: myBudget }, tooltipHelpers);

  if (reviewedAdmissions) {
    reviewedCardIndicators(match, myBudget).forEach(({ icon, tone, label, detail, value, legend }) => addStatusIndicator(icon, tone, label, detail, value, legend));
  } else {
    if (hasMissingProgram) {
      addStatusIndicator(
        "academic-cap",
        "warning",
        t("universities.badge.no_matching_program", "Program Not Offered"),
        t("universities.why.no_matching_program", "This university does not offer the study program selected in your profile."),
        "",
        "subject_missing"
      );
    }
    if (hasConditionalExamWarning) {
      addStatusIndicator("clipboard-document-list", "warning", t("universities.badge.conditional_exam_needed", "Exam result needed"), examNeededDetail, "", "exam_needed");
    }
    if (hasVeryHighVibeMatch) {
      addStatusIndicator("heart", "match", t("universities.badge.your_vibe", "Your Vibe"), preferenceTooltip(match, "universities.why.your_vibe"), "", "vibe");
    } else if (hasHighVibeMatch) {
      addStatusIndicator("heart", "match", t("universities.badge.top_match", "Good Match"), preferenceTooltip(match, "universities.why.top_match"), "", "vibe");
    }
    if (belowRequirements) {
      addStatusIndicator("exclamation-triangle", "warning", t("universities.badge.below_requirements", "Below Requirements"), belowDetail, "", "requirements_below");
    } else if (meetsMinRequirements) {
      addStatusIndicator("check-circle", "requirements", t("universities.badge.requirements_met", "Requirements Met"), t("universities.tip.requirements_met"), "", "requirements_met");
    } else if (match.requirementsReason && !hasConditionalExamWarning) {
      addStatusIndicator("information-circle", "warning", t("common.no_data", "No data"), chanceNoDataHelpNote({ reason: match.requirementsReason, scoreMeaning: match.scoreMeaning }), "", "no_data");
    }
    if (showOverBudgetAid) {
      addStatusIndicator("banknotes", "budget", t("universities.badge.over_budget_aid", "Over Budget • Aid Available"), overBudgetDetail, "", "over_budget_aid");
    } else if (showOverBudgetStrict) {
      addStatusIndicator("banknotes", "budget", t("universities.badge.over_budget", "Over Budget"), overBudgetDetail, "", "over_budget");
    } else if (showAidAvailable) {
      addStatusIndicator("banknotes", "aid", t("universities.badge.aid_available", "Aid Available"), "", "", "aid");
    }
  }

  const MAX_VISIBLE_BADGES = reviewedAdmissions ? 3 : 4;
  let statusHtml = "";
  if (statusIndicators.length <= MAX_VISIBLE_BADGES) {
    statusHtml = statusIndicators.join("");
  } else {
    const visible = statusIndicators.slice(0, MAX_VISIBLE_BADGES - 1);
    const hidden = statusIndicators.slice(MAX_VISIBLE_BADGES - 1);
    const hiddenCount = hidden.length;
    const overflowLabel = tFormat("universities.badge.overflow_more", { count: String(hiddenCount) }, `+${hiddenCount} more badges`);
    const overflowAria = t("universities.badge.overflow_label", "Additional status indicators");
    const overflowHtml = `
      <span class="uni-status-overflow">
        <button type="button" class="uni-status-overflow-trigger" aria-label="${escapeHtmlAttr(overflowLabel)}" aria-expanded="false" title="${escapeHtmlAttr(overflowLabel)}">
          <span aria-hidden="true">+${hiddenCount}</span>
        </button>
        <span class="uni-status-overflow-popover" role="region" aria-label="${escapeHtmlAttr(overflowAria)}" hidden>
          ${hidden.join("")}
        </span>
      </span>
    `;
    statusHtml = `${visible.join("")}${overflowHtml}`;
  }

  const thumbSrc = uniThumbnailSrc(id);
  const thumbSrcMedium = uniThumbnailSrc(id, { size: "medium" });
  const thumbSrcFull = uniThumbnailSrc(id, { forceFull: true });
  const thumbSrcFullFallback = uniThumbnailSrc(id, { forceFull: true, format: "jpg" });
  const thumbSrcset = `${thumbSrc} 640w, ${thumbSrcMedium} 960w, ${thumbSrcFull} 1600w`;
  const loadingAttr = idx < 4 ? "eager" : "lazy";
  const fetchPriorityAttr = idx < 2 ? "high" : "auto";
  const detailHref = routeUniversityDetail(id);
  const safeName = escapeHtml(name);
  const overlayTitle = String(name || "");
  const rankValue = toFiniteNumber(u?.rank);
  const rankLabel = escapeHtml(translateWord("global_rank", "Global Rank"));
  const isCompared = isCompareMode && compareUniversityIds.has(String(id));
  const detailLabel = escapeHtml(isCompareMode
    ? (isCompared ? t("universities.card.compare_selected_short", "Selected") : t("universities.card.compare_short", "Compare"))
    : t("universities.card.view_details", "View details"));
  const sourceTooltip = buildRankSourceTooltip(u);
  const rankValueText = rankValue !== null && rankValue > 0 ? `#${escapeHtml(String(rankValue))}` : escapeHtml(t("common.na", "N/A"));
  const rankAriaLabel = sourceTooltip
    ? `${rankLabel}: ${rankValueText}: ${sourceTooltip}`
    : `${rankLabel}: ${rankValueText}`;
  const rankInnerHtml = `
    <span class="uni-metric-icon" aria-hidden="true">${renderInlineIcon("globe-alt", 14, "uni-metric-svg")}</span>
    <span class="uni-metric-label">${rankLabel}:</span>
    <span class="uni-metric-value">${rankValueText}</span>
  `;
  const metricsHtml = `
    <div class="uni-metrics" aria-label="${escapeHtml(t("universities.card.metrics", "Key metrics"))}">
      ${sourceTooltip ? `
      <span class="ui-tooltip-wrap uni-metric-tooltip">
        <button type="button" class="ui-tooltip-trigger uni-metric uni-metric--rank uni-metric-trigger${rankValue !== null && rankValue > 0 ? "" : " uni-metric--missing"}" aria-label="${escapeHtmlAttr(rankAriaLabel)}" aria-expanded="false">
${rankInnerHtml}
        </button>
        <span class="ui-tooltip-bubble uni-metric-tooltip__content" role="tooltip">
          <strong class="ui-tooltip-title">${rankLabel}</strong>
          <span class="ui-tooltip-text">${escapeHtml(sourceTooltip)}</span>
        </span>
      </span>
      ` : `
      <span class="uni-metric uni-metric--rank${rankValue !== null && rankValue > 0 ? "" : " uni-metric--missing"}">
${rankInnerHtml}
      </span>
      `}
    </div>
  `;
  const statusClass = statusHtml ? " uni-card--has-status" : " uni-card--compact";
  const priceHtml = renderUniversityCardCosts(u, costBasis, options.costTooltipScope || (mapVariant ? "map-result" : "catalog"), {
    priceFilterActive,
    studyLevel,
  });
  // The catalog API flags universities that have no campus photo; those cards show the placeholder
  // without requesting an image that does not exist (older API responses omit the flag).
  const hasCover = u?.cover_available !== false;
  const mediaHtml = hideMedia ? "" : `
    <div class="uni-media">
      ${hasCover ? `<img class="uni-media-img" src="${thumbSrc}" srcset="${escapeHtmlAttr(thumbSrcset)}" sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(thumbSrcFullFallback)}" data-remove-on-error="1">` : ""}
      <div class="uni-media-empty">
        ${renderInlineIcon("building-office-2", 24)}
        <span>${escapeHtml(t("universities.card.photo_unavailable"))}</span>
      </div>
    </div>`;
  const backdropHtml = hideMedia && mapVariant && hasCover
    ? `<div class="uni-card-backdrop" aria-hidden="true"><img src="${thumbSrc}" srcset="${escapeHtmlAttr(thumbSrcset)}" sizes="(min-width: 1024px) 360px, 100vw" alt="" loading="${loadingAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(thumbSrcFullFallback)}" data-remove-on-error="1"></div>`
    : "";
  const headHtml = hideMedia
    ? `<div class="uni-head"><div class="uni-head-copy"><h3 class="uni-title" title="${safeName}">${safeName}</h3>${locHtml}</div></div>`
    : `<h3 class="uni-title" title="${safeName}">${safeName}</h3>${locHtml}`;
  const detailsHtml = mapVariant
    ? `<a class="uni-details" href="${detailHref}"${linkAttrs}>${detailLabel}<span aria-hidden="true">→</span></a>`
    : `<span class="uni-details">${detailLabel}<span aria-hidden="true">→</span></span>`;
  const overlayHtml = mapVariant
    ? ""
    : `<a class="uni-card-link-overlay" href="${detailHref}"${linkAttrs} aria-label="${safeName}" title="${escapeHtml(overlayTitle)}"></a>`;
  return `
    <article class="uni-card${statusClass}${isCompared ? " uni-card--compare-selected" : ""}${hideMedia ? " uni-card--no-media" : ""}${mapVariant ? " uni-card--map" : ""}${cardIsActive ? " is-active" : ""}" data-uni-id="${escapeHtmlAttr(id)}" aria-selected="${isCompared ? "true" : "false"}">
      ${mediaHtml}${backdropHtml}
      ${statusHtml ? `<div class="uni-card-statuses" aria-label="${escapeHtmlAttr(t("universities.card.statuses", "University status"))}">${statusHtml}</div>` : ""}
      <div class="uni-body">
        ${headHtml}
        ${metricsHtml}
        <div class="uni-footer">
          ${priceHtml}
          ${detailsHtml}
        </div>
      </div>
      ${overlayHtml}
    </article>
  `;
}

export function renderCatalogPagination(container, { total, currentPage, pageSize, onPageChange }) {
  if (!container) return;
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) {
    container.replaceChildren();
    return;
  }
  let html = "";
  const p = currentPage;
  const maxVisible = 5;
  const createBtn = (page, content, isActive = false, extraClass = "", isDisabled = false) => {
    const activeClass = isActive ? "page-btn--active" : "";
    const disabledClass = isDisabled ? "page-btn--disabled" : "";
    const classes = ["page-btn", activeClass, disabledClass, extraClass].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" data-page="${page}"${isActive ? ' aria-current="page"' : ""}${isDisabled ? " disabled" : ""}>${content}</button>`;
  };
  html += createBtn(1, heroIcon("chevron-double-left", "page-btn__icon", { "stroke-width": 2 }), false, "page-btn--nav page-btn--first", p <= 1);
  html += createBtn(
    Math.max(1, p - 1),
    `${heroIcon("chevron-left", "page-btn__icon", { "stroke-width": 2 })}<span class="page-btn__text">${escapeHtml(t("universities.pagination.prev", "Prev"))}</span>`,
    false,
    "page-btn--nav page-btn--prev",
    p <= 1
  );
  let startPage;
  let endPage;
  if (totalPages <= maxVisible) {
    startPage = 1;
    endPage = totalPages;
  } else {
    const maxPagesBefore = Math.floor(maxVisible / 2);
    const maxPagesAfter = Math.ceil(maxVisible / 2) - 1;
    if (p <= maxPagesBefore + 1) {
      startPage = 1;
      endPage = maxVisible;
    } else if (p + maxPagesAfter >= totalPages) {
      startPage = totalPages - maxVisible + 1;
      endPage = totalPages;
    } else {
      startPage = p - maxPagesBefore;
      endPage = p + maxPagesAfter;
    }
  }
  if (startPage > 1) html += '<span class="page-dots">...</span>';
  for (let i = startPage; i <= endPage; i++) {
    html += createBtn(i, `<span class="page-btn__text">${i}</span>`, i === p, "page-btn--num");
  }
  if (endPage < totalPages) html += '<span class="page-dots">...</span>';
  html += createBtn(
    Math.min(totalPages, p + 1),
    `<span class="page-btn__text">${escapeHtml(t("universities.pagination.next", "Next"))}</span>${heroIcon("chevron-right", "page-btn__icon", { "stroke-width": 2 })}`,
    false,
    "page-btn--nav page-btn--next",
    p >= totalPages
  );
  html += createBtn(totalPages, heroIcon("chevron-double-right", "page-btn__icon", { "stroke-width": 2 }), false, "page-btn--nav page-btn--last", p >= totalPages);
  container.innerHTML = html;
  container.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      const newPage = Number(b.dataset.page);
      if (newPage && newPage !== currentPage) {
        onPageChange?.(newPage);
      }
    };
  });
}
