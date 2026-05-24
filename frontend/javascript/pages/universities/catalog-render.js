import { t, tFormat } from "../../i18n.js";
import {
  escapeHtml,
  escapeHtmlAttr,
  initials,
  nested,
  getFlagImg
} from "../../utils.js";
import {
  toFiniteNumber,
  renderInlineIcon,
  renderLocationMarkup,
  renderUniPill,
  textOrUnknown,
  moneyOrUnknown,
  trUniversityName,
  trCity,
  trCountry,
  uniLogoSrc,
  uniThumbnailSrc,
  shouldOpenUniversitiesInNewTab
} from "../_shared.js";
import { translateWord } from "../../university-translations.js";
import { routeUniversityDetail } from "../../routes.js";

/**
 * Rendering logic for university catalog cards and pagination
 */

export function universityLinkAttrs() {
  return shouldOpenUniversitiesInNewTab() ? ' target="_blank" rel="noopener noreferrer"' : '';
}

export function renderUniversityCard(u, options = {}) {
  const {
    myBudget = 0,
    idx = 99,
    savedUniversityIds = new Set(),
    compareUniversityIds = new Set(),
    isCompareSelectionMode = false,
    budgetVsPrestige = 50
  } = options;

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

  const match = u.matchData || {};

  const baseCost =
    (match.costYearUSD !== undefined ? match.costYearUSD : null) ??
    (match.cost !== undefined ? match.cost : null) ??
    nested(u, ["finance", "total_cost_year_usd"], 0);

  const cost =
    (match.finalPrice !== undefined ? match.finalPrice : null) ??
    (match.costWithAmountUSD !== undefined ? match.costWithAmountUSD : null) ??
    baseCost;

  const badgeHints = (match.uiBadgeHints && typeof match.uiBadgeHints === "object") ? match.uiBadgeHints : {};
  const preferenceMismatch = Number(match.preferenceMismatch);
  const grantChance = Number(match.grantChance);
  const generalChance = Number(match.generalChance);
  const selectedChanceType = String(match.selectedChanceType || "").toLowerCase();
  const hintedVibe = String(badgeHints.vibe || "").toLowerCase();
  const hintedFinance = String(badgeHints.finance || "").toLowerCase();
  const financePref = Number(budgetVsPrestige);
  const inGrantMode = selectedChanceType ? selectedChanceType === "grant" : financePref < 50;
  const inPaidMode = selectedChanceType ? selectedChanceType === "general" : financePref > 50;
  const conditionalCount = Number(match.conditionalRequirements || 0);
  const hasConditionalExamWarning = (badgeHints.showConditionalExamNeeded === true) || (!!match.conditional && conditionalCount > 0);
  const hasVeryHighVibeMatch = hintedVibe === "your_vibe" || (!hintedVibe && Number.isFinite(preferenceMismatch) && preferenceMismatch <= 0.14);
  const hasHighVibeMatch = hintedVibe === "top_match" || (!hintedVibe && Number.isFinite(preferenceMismatch) && preferenceMismatch > 0.14 && preferenceMismatch <= 0.22);
  const likelyGrant = hintedFinance === "likely_grant" || (!hintedFinance && inGrantMode && Number.isFinite(grantChance) && grantChance >= 65);
  const paidAdmission = hintedFinance === "paid_admission" || (!hintedFinance && inPaidMode && Number.isFinite(generalChance) && generalChance >= 45);
  const meetsMinRequirements = match.meetMinRequirements === true && !hasConditionalExamWarning;
  const belowRequirements = match.meetMinRequirements === false;
  const aidAny = !!(match.aidAny || match.aidEligible || nested(u, ["finance", "financial_aid", "merit_based"], false) || nested(u, ["finance", "financial_aid", "need_based"], false));
  const hasUserBudget = Number.isFinite(Number(myBudget)) && Number(myBudget) > 0;
  const overBudget = hasUserBudget && Number.isFinite(Number(cost)) && Number(cost) > Number(myBudget);

  const badges = [];
  let whyText = "";
  const acc = toFiniteNumber(u?.academics?.acceptance_rate_percent);
  const acceptanceValueText = acc !== null
    ? `${Math.round(acc * 100) / 100}%`
    : t("common.na", "N/A");

  if (hasConditionalExamWarning) {
    badges.push(
      renderUniPill("clipboard-document-list", "uni-pill--warn", t("universities.badge.conditional_exam_needed", "Conditional / Exam Needed"))
    );
    whyText = t("universities.why.conditional_exam_needed", "Some required exam evidence is missing, so this result is conditional.");
  }

  if (hasVeryHighVibeMatch) {
    badges.push(
      renderUniPill("sparkles", "uni-pill--success", t("universities.badge.your_vibe", "Your Vibe"))
    );
    if (!whyText) whyText = t("universities.why.your_vibe", "This university strongly matches your Focus, Atmosphere, and Location sliders.");
  } else if (hasHighVibeMatch) {
    badges.push(
      renderUniPill("check-badge", "uni-pill--success", t("universities.badge.top_match", "Good Match"))
    );
    if (!whyText) whyText = t("universities.why.top_match", "This university is a good preference match for your current slider setup.");
  }

  if (likelyGrant) {
    badges.push(
      renderUniPill("banknotes", "uni-pill--success", t("universities.badge.likely_grant", "Likely Grant"))
    );
    if (!whyText) whyText = t("universities.why.likely_grant", "In grant-priority mode, this university has a strong grant admission chance.");
  } else if (paidAdmission) {
    badges.push(
      renderUniPill("briefcase", "uni-pill--budget", t("universities.badge.paid_admission", "Paid Admission"))
    );
    if (!whyText) whyText = t("universities.why.paid_admission", "In willing-to-pay mode, this university has a strong general admission chance.");
  }

  if (belowRequirements) {
    badges.push(renderUniPill("exclamation-triangle", "uni-pill--warn", t("universities.badge.below_requirements", "Below Requirements")));
  } else if (meetsMinRequirements) {
    badges.push(renderUniPill("check-circle", "uni-pill--success", t("universities.badge.requirements_met", "Requirements Met")));
  }

  if (overBudget) {
    if (aidAny) badges.push(renderUniPill("banknotes", "uni-pill--budget", t("universities.badge.over_budget_aid", "Over Budget • Aid Available")));
    else badges.push(renderUniPill("banknotes", "uni-pill--budget", t("universities.badge.over_budget", "Over Budget")));
  } else if (aidAny) {
    badges.push(renderUniPill("check-circle", "uni-pill--success", t("universities.badge.aid_available", "Aid Available")));
  }

  const visibleBadges = badges.slice();
  const badgeCountClass = `uni-badge--count-${Math.min(Math.max(visibleBadges.length, 1), 8)}`;
  const badgeContainerClass = `uni-badge ${badgeCountClass}`;
  const badgesHTML = visibleBadges.join(" ");

  const logoSrc = uniLogoSrc(id);
  const logoSrcFull = uniLogoSrc(id, { forceFull: true });
  const thumbSrc = uniThumbnailSrc(id);
  const thumbSrcMedium = uniThumbnailSrc(id, { size: "medium" });
  const thumbSrcFull = uniThumbnailSrc(id, { forceFull: true });
  const thumbSrcFullFallback = uniThumbnailSrc(id, { forceFull: true, format: "jpg" });
  const thumbSrcset = `${thumbSrc} 640w, ${thumbSrcMedium} 960w, ${thumbSrcFull} 1600w`;
  const loadingAttr = idx < 4 ? "eager" : "lazy";
  const fetchPriorityAttr = idx < 2 ? "high" : "auto";
  const detailHref = routeUniversityDetail(id);
  const safeName = escapeHtml(name);
  const safeWhyText = escapeHtml(whyText || "");
  const overlayTitle = whyText ? `${name}. ${whyText}` : String(name || "");
  const rankValue = toFiniteNumber(u?.rank);
  const rankLabel = escapeHtml(translateWord("global_rank", "Global Rank"));
  const costText = moneyOrUnknown(cost, "placeholder.field.cost", "Cost");
  const isSaved = savedUniversityIds.has(String(id));
  const showCompareAction = isCompareSelectionMode;
  const isCompared = showCompareAction && compareUniversityIds.has(String(id));
  const detailLabel = escapeHtml(isCompareSelectionMode
    ? (isCompared ? t("universities.card.compare_selected", "Selected for comparison") : t("universities.card.compare", "Add to compare"))
    : t("universities.card.view_details", "View details"));

  const metricsHtml = `
    <div class="uni-metrics" aria-label="${escapeHtml(t("universities.card.metrics", "Key metrics"))}">
      <div class="uni-metric${rankValue !== null && rankValue > 0 ? "" : " uni-metric--missing"}">
        <span class="uni-metric-label">${rankLabel}</span>
        <span class="uni-metric-value">${rankValue !== null && rankValue > 0 ? `#${escapeHtml(String(rankValue))}` : escapeHtml(t("common.na", "N/A"))}</span>
      </div>
      <div class="uni-metric${acc !== null ? "" : " uni-metric--missing"}">
        <span class="uni-metric-label">${escapeHtml(t("ranking.acceptance", "Acceptance Rate"))}</span>
        <span class="uni-metric-value">${escapeHtml(acceptanceValueText)}</span>
      </div>
    </div>
  `;

  const saveLabel = t("universities.card.save", "Add to favorites");
  const compareDefaultLabel = t("universities.card.compare", "Add to compare");
  const compareSelectedLabel = t("universities.card.compare_selected", "Selected for comparison");
  const compareLabel = isCompared ? compareSelectedLabel : compareDefaultLabel;
  const saveActionHtml = showCompareAction
    ? ""
    : `<button class="uni-action-btn uni-action-btn--favorite${isSaved ? " is-active" : ""}" type="button" data-card-action="save" aria-pressed="${isSaved ? "true" : "false"}" title="${escapeHtmlAttr(saveLabel)}" aria-label="${escapeHtmlAttr(saveLabel)}">${renderInlineIcon("star", 16, "uni-action-icon")}</button>`;
  const compareActionHtml = showCompareAction
    ? `<button class="uni-action-btn uni-action-btn--compare${isCompared ? " is-active" : ""}" type="button" data-card-action="compare" aria-pressed="${isCompared ? "true" : "false"}" title="${escapeHtmlAttr(compareLabel)}" aria-label="${escapeHtmlAttr(compareLabel)}">${renderInlineIcon(isCompared ? "check-circle" : "adjustments-horizontal", 16, "uni-action-icon")}</button>`
    : "";

  return `
    <article class="uni-card${isCompared ? " uni-card--compare-selected" : ""}" data-uni-id="${escapeHtmlAttr(id)}" aria-selected="${isCompared ? "true" : "false"}">
      <div class="uni-media">
        <img class="uni-media-img" src="${thumbSrc}" srcset="${escapeHtmlAttr(thumbSrcset)}" sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(thumbSrcFullFallback)}" data-final-src="${escapeHtmlAttr(logoSrcFull)}">
        <div class="uni-card-actions">
          ${saveActionHtml}
          ${compareActionHtml}
        </div>
        <div class="uni-price"><small>${escapeHtml(t("universities.card.est_cost_year", "Est. Cost/Year"))}</small><b>${escapeHtml(costText)}</b></div>
        <div class="uni-logo"><img src="${logoSrc}" alt="${initials(name)}" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(name))}"></div>
      </div>
      <div class="uni-body">
        <h3 class="uni-title" title="${safeName}">${safeName}</h3>
        ${locHtml}
        ${metricsHtml}
        <div class="uni-card-separator" aria-hidden="true"></div>
        ${badgesHTML ? `<div class="${badgeContainerClass}">${badgesHTML}</div>` : ""}
        ${whyText ? `<div class="uni-why" title="${safeWhyText}">${safeWhyText}</div>` : ""}
        <div class="uni-footer">
          <span class="uni-details">${detailLabel}<span aria-hidden="true">→</span></span>
        </div>
      </div>
      <a class="uni-card-link-overlay" href="${detailHref}"${universityLinkAttrs()} aria-label="${safeName}" title="${escapeHtml(overlayTitle)}"></a>
    </article>
  `;
}

export function renderPagination(container, currentPage, totalItems, itemsPerPage) {
  if (!container) return;

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = "";
  const p = currentPage;
  const maxVisible = 5;

  const createBtn = (page, text, isActive = false) => {
    const activeClass = isActive ? "page-btn--active" : "";
    return `<button class="page-btn ${activeClass}" data-page="${page}">${text}</button>`;
  };

  if (p > 1) {
    html += createBtn(1, "«");
    html += createBtn(p - 1, `‹ ${escapeHtml(t("universities.pagination.prev", "Prev"))}`);
  }

  let startPage, endPage;
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

  if (startPage > 1) html += `<span class="page-dots">...</span>`;
  for (let i = startPage; i <= endPage; i++) {
    html += createBtn(i, i, i === p);
  }
  if (endPage < totalPages) html += `<span class="page-dots">...</span>`;

  if (p < totalPages) {
    html += createBtn(p + 1, `${escapeHtml(t("universities.pagination.next", "Next"))} ›`);
    html += createBtn(totalPages, "»");
  }

  container.innerHTML = html;
}
