import { t, tFormat } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr, initials, bindImageFallbacks, aiName } from "../../utils.js";
import { heroIcon } from "../../icons.js";
import { 
  renderInlineIcon, 
  trUniversityName as trUniName, 
  trCity, 
  trCountry, 
  trTrackLabel,
  unknownFieldText,
  unknownLabelText,
  trState,
  trTrackDescription,
} from "../_shared.js";
import { 
  translateWord,
  humanizeMachineLabel,
  translateUnknownWord,
} from "../../university-translations.js";
import { 
  renderTrackChanceChip, 
  renderTrackFundingBadge, 
  getTrackFundingType,
  splitExamEntries,
  renderExamGroup,
  renderUniChanceSummary,
  chanceTone,
  getTrackFundingType as getEngineFundingType,
} from "../../university-detail-helpers.js";
import { 
  renderTrackLanguageExamGroup,
  modeAwareAnnualCost,
} from "../_shared.js";
import { moneyUSD } from "../../utils.js";
import { routeUniversityDetail } from "../../routes.js";
import { 
  compareUniversityName, 
  compareLocationText, 
  compareRankText, 
  compareSelectedAnnualCost, 
  formatCompareCost, 
  compareAcceptanceText,
  compareBestBadges,
  buildCompareSpecs,
  compareSpecRawValue,
  compareSpecSections,
  buildCompareAdvantages,
  buildCompareCategoryScores,
  compareCategoryMeta,
  COMPARE_PAIR_SIZE,
  normalizeCompareIdList,
  compareAdmissionOptionEntries,
  trTrackLabel as trEngineTrackLabel,
} from "./compare-engine.js";

/**
 * UI Rendering for university comparison
 */

export function renderCompareSlotLabel(index) {
  return tFormat("universities.compare.slot_label", { index: String(index + 1) }, `University ${index + 1}`);
}

export function renderCompareCard(u, index, options = {}) {
  const id = String(u?.id || "");
  const metrics = options.metrics;
  const chances = options.chances || new Map();
  const choices = options.choices || new Map();
  const uniLogoSrc = options.uniLogoSrc || ((id) => "");
  
  const logoSrc = uniLogoSrc(id);
  const logoSrcFull = uniLogoSrc(id, { forceFull: true });
  const badges = compareBestBadges(u, metrics);
  const name = compareUniversityName(u);
  
  const uniChance = chances.get(id);
  const selectedKey = choices.get(id);
  const trackChance = (uniChance?.tracks || []).find((x) => String(x.trackKey) === selectedKey);
  const chanceHtml = trackChance ? `<div class="compare-uni-card__chance">${renderTrackChanceChip(trackChance)}</div>` : "";

  return `
    <article class="compare-uni-card compare-uni-card--pair" data-compare-slot="${index + 1}" data-uni-id="${escapeHtmlAttr(id)}">
      <div class="compare-uni-card__head">
        <div class="compare-uni-card__identity">
          <span class="compare-uni-card__slot">${escapeHtml(renderCompareSlotLabel(index))}</span>
          <div class="compare-uni-card__logo">
            <img src="${logoSrc}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(name))}">
          </div>
        </div>
      </div>
      <h3>${escapeHtml(name)}</h3>
      <p>${escapeHtml(compareLocationText(u))}</p>
      <div class="compare-uni-card__metrics">
        <span><small>${escapeHtml(translateWord("global_rank", "Rank"))}</small><strong>${escapeHtml(compareRankText(u))}</strong></span>
        <span><small>${escapeHtml(t("universities.card.cost_short", "Cost"))}</small><strong>${escapeHtml(formatCompareCost(compareSelectedAnnualCost(u, selectedKey)))}</strong></span>
        <span><small>${escapeHtml(t("ranking.acceptance", "Acceptance"))}</small><strong>${escapeHtml(compareAcceptanceText(u))}</strong></span>
      </div>
      ${chanceHtml}
      ${badges.length ? `<div class="compare-uni-card__badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
      <a class="compare-uni-card__link" href="${routeUniversityDetail(id)}">${escapeHtml(t("universities.card.view_details", "View details"))}</a>
    </article>
  `;
}

export function renderCompareTable(universities, metrics) {
  const sections = compareSpecSections();
  const sectionOrder = ["overview", "programs", "admissions", "finance", "outcomes", "data", "context"];
  const orderedSpecs = (metrics.specs || []).slice().sort((a, b) => {
    const left = sectionOrder.includes(a.section) ? sectionOrder.indexOf(a.section) : sectionOrder.length;
    const right = sectionOrder.includes(b.section) ? sectionOrder.indexOf(b.section) : sectionOrder.length;
    if (left !== right) return left - right;
    return (a.order || 0) - (b.order || 0);
  });

  const compareCell = (text, opts = {}) => {
    const tone = opts.tone ? ` compare-cell--${opts.tone}` : "";
    const sub = opts.sub ? `<small>${escapeHtml(opts.sub)}</small>` : "";
    return `<td class="compare-cell${tone}"><span>${escapeHtml(text || t("common.na", "N/A"))}</span>${sub}</td>`;
  };

  const compareSectionRow = (label, kind) => `
    <tr class="compare-table__section-row" data-section="${escapeHtmlAttr(kind)}">
      <td colspan="${universities.length + 1}">${escapeHtml(label)}</td>
    </tr>
  `;

  const compareDataRow = (label, renderValue) => `
    <tr>
      <td>${escapeHtml(label)}</td>
      ${universities.map((u) => {
        const value = renderValue(u);
        if (value && typeof value === "object") return compareCell(value.text, value);
        return compareCell(String(value || ""));
      }).join("")}
    </tr>
  `;

  const compareSpecValue = (spec, u) => {
    const raw = compareSpecRawValue(spec, u);
    const text = raw === null || raw === undefined || raw === ""
      ? t("common.na", "N/A")
      : (spec.formatter ? spec.formatter(raw, u) : String(raw));
    const bestIds = metrics.bestBySpec?.get(spec.key) || new Set();
    
    // We need compareSourceText here, but it's in compare-engine.js
    const source = spec.sourceKey ? nestedSource(u, spec.sourceKey) : "";
    const sub = source ? tFormat("universities.compare.source_note", { source }, `Source: ${source}`) : "";

    return {
      text,
      tone: bestIds.has(String(u?.id || "")) ? "best" : "",
      sub: sub,
    };
  };

  function nestedSource(u, key) {
    const s = (u?.meta?.sources && typeof u.meta.sources === "object") ? u.meta.sources[key] : "";
    return String(s || "").trim();
  }

  let currentSection = "";
  const rowsHtml = orderedSpecs.map((spec) => {
    let sectionHtml = "";
    if (spec.section !== currentSection) {
      sectionHtml = compareSectionRow(sections[spec.section] || humanizeMachineLabel(spec.section, spec.section), spec.section);
      currentSection = spec.section;
    }
    return `${sectionHtml}${compareDataRow(spec.label, (u) => compareSpecValue(spec, u))}`;
  }).join("");

  return `
    <div class="compare-table-wrap compare-table-wrap--pair">
      <table class="compare-table">
        <thead>
          <tr>
            <th>${escapeHtml(t("universities.compare.row.metric", "Metric"))}</th>
            ${universities.map((u) => `<th>${escapeHtml(compareUniversityName(u))}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

export function renderCompareKeyDifferences(universities, metrics) {
  const advantages = buildCompareAdvantages(universities, metrics);
  return `
    <section class="compare-analysis-block compare-key-differences" aria-labelledby="compareKeyDifferencesTitle">
      <div class="compare-block-head">
        <div class="compare-block-icon">${renderInlineIcon("sparkles", 20, "compare-block-icon-svg")}</div>
        <div>
          <h2 id="compareKeyDifferencesTitle">${escapeHtml(t("universities.compare.differences.title", "Key differences"))}</h2>
          <p>${escapeHtml(t("universities.compare.differences.subtitle", "Shows the clearest published advantages for each selected university."))}</p>
        </div>
      </div>
      <div class="compare-reasons compare-reasons--pair">
        ${universities.map((u, index) => {
          const id = String(u?.id || "");
          const items = advantages.get(id) || [];
          return `
            <article class="compare-reason-group" data-compare-slot="${index + 1}">
              <span class="compare-reason-slot">${escapeHtml(renderCompareSlotLabel(index))}</span>
              <h3>${escapeHtml(tFormat("universities.compare.differences.reasons_for", { name: compareUniversityName(u) }, compareUniversityName(u)))}</h3>
              ${items.length ? `
                <ul class="compare-reason-list">
                  ${items.map((item) => `
                    <li>
                      <span class="compare-reason-icon">${renderInlineIcon("check-circle", 18, "compare-reason-icon-svg")}</span>
                      <span>${escapeHtml(item.text)}</span>
                    </li>
                  `).join("")}
                </ul>
              ` : `<p class="compare-reason-empty">${escapeHtml(t("universities.compare.differences.no_clear_advantage", "No clear published advantage found across comparable metrics."))}</p>`}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function renderCompareOverview(universities, metrics) {
  const categoryMeta = compareCategoryMeta();
  const scores = buildCompareCategoryScores(universities, metrics);
  const categories = Object.keys(categoryMeta).filter((category) => (
    universities.some((u) => scores.get(String(u?.id || ""))?.has(category))
  ));
  
  if (!categories.length) return "";

  return `
    <section class="compare-analysis-block compare-overview" aria-labelledby="compareOverviewTitle">
      <div class="compare-block-head">
        <div class="compare-block-icon">${renderInlineIcon("clipboard-document-list", 20, "compare-block-icon-svg")}</div>
        <div>
          <h2 id="compareOverviewTitle">${escapeHtml(t("universities.compare.overview.title", "Overview"))}</h2>
          <p>${escapeHtml(t("universities.compare.overview.subtitle", "0-100 within this comparison only: 100 marks the stronger selected university in that category, not an absolute university score."))}</p>
        </div>
      </div>
      <div class="compare-score-grid">
        ${categories.map((category) => {
          const meta = categoryMeta[category];
          return `
            <article class="compare-score-card">
              <div class="compare-score-card__head">
                <span>${renderInlineIcon(meta.icon, 18, "compare-score-card-icon")}</span>
                <div>
                  <h3>${escapeHtml(meta.title)}</h3>
                  <p>${escapeHtml(meta.subtitle)}</p>
                </div>
              </div>
              <div class="compare-score-list">
                ${universities.map((u) => {
                  const id = String(u?.id || "");
                  const score = scores.get(id)?.get(category);
                  const width = Number.isFinite(score) ? Math.max(0, score) : 0;
                  return `
                    <div class="compare-score-row">
                      <div class="compare-score-row__top">
                        <span>${escapeHtml(compareUniversityName(u))}</span>
                        <strong>${Number.isFinite(score) ? tFormat("universities.compare.score_value", { score: String(score) }, `${score}/100`) : t("common.na", "N/A")}</strong>
                      </div>
                      <div class="compare-score-track" aria-hidden="true"><span style="width:${width}%"></span></div>
                    </div>
                  `;
                }).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function renderCompareConclusion(universities, metrics) {
  const categoryMeta = compareCategoryMeta();
  const scores = buildCompareCategoryScores(universities, metrics);
  const winners = Object.keys(categoryMeta).map((category) => {
    const rows = universities
      .map((u) => ({ university: u, id: String(u?.id || ""), score: scores.get(String(u?.id || ""))?.get(category) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score);
    if (!rows.length) return null;
    return { category, title: categoryMeta[category].title, university: rows[0].university, score: rows[0].score };
  }).filter(Boolean);
  
  const unique = [];
  winners.forEach((winner) => {
    if (unique.some((row) => row.category === winner.category && String(row.university?.id || "") === String(winner.university?.id || ""))) return;
    unique.push(winner);
  });
  
  const selected = unique.slice(0, 3);
  const body = selected.length
    ? tFormat(
        "universities.compare.conclusion.body",
        {
          summary: selected.map((row) => `${row.title}: ${compareUniversityName(row.university)}`).join("; "),
        },
        `Best relative fits by category: ${selected.map((row) => `${row.title}: ${compareUniversityName(row.university)}`).join("; ")}.`
      )
    : t("universities.compare.conclusion.empty", "The selected universities are close on the comparable published metrics. Use the highlighted table rows and official sources before making the final decision.");

  return `
    <section class="compare-analysis-block compare-conclusion" aria-labelledby="compareConclusionTitle">
      <div class="compare-block-head">
        <div class="compare-block-icon">${renderInlineIcon("information-circle", 20, "compare-block-icon-svg")}</div>
        <div>
          <h2 id="compareConclusionTitle">${escapeHtml(t("universities.compare.conclusion.title", "Conclusion"))}</h2>
          <p>${escapeHtml(body)}</p>
        </div>
      </div>
    </section>
  `;
}

export function renderCompareResultsPage(container, universities, options = {}) {
  if (!container) return;
  const metrics = options.metrics || metrics(universities, options.choices);
  
  const cardsHtml = universities.map((u, i) => renderCompareCard(u, i, options)).join("");
  const keyDifferencesHtml = renderCompareKeyDifferences(universities, metrics);
  const overviewHtml = renderCompareOverview(universities, metrics);
  const conclusionHtml = renderCompareConclusion(universities, metrics);
  const tableHtml = renderCompareTable(universities, metrics);

  container.innerHTML = `
    <div class="compare-results-head compare-results-head--pair">
      <div>
        <p class="compare-results-kicker">${escapeHtml(t("universities.compare.results.kicker", "Comparison results"))}</p>
        <h1>${escapeHtml(t("universities.compare.results.title", "University comparison"))}</h1>
      </div>
      <div class="compare-results-actions">
        <button class="compare-results-action" type="button" data-action="back-to-compare-select">${escapeHtml(t("universities.compare.results.back_to_selection", "Back to selection"))}</button>
        <button class="compare-results-action compare-results-action--ghost" type="button" data-action="clear-compare-results">${escapeHtml(t("universities.compare.clear", "Clear"))}</button>
      </div>
    </div>
    <div class="compare-uni-grid compare-uni-grid--pair">${cardsHtml}</div>
    ${keyDifferencesHtml}
    ${overviewHtml}
    <section class="compare-analysis-block compare-tests" aria-labelledby="compareTestsTitle">
      <div class="compare-block-head">
        <div class="compare-block-icon">${renderInlineIcon("document-check", 20, "compare-block-icon-svg")}</div>
        <div>
          <h2 id="compareTestsTitle">${escapeHtml(t("universities.compare.tests.title", "Tests and characteristics"))}</h2>
          <p>${escapeHtml(t("universities.compare.tests.subtitle", "Detailed table of published values. Green cells mark the strongest comparable value in each row."))}</p>
        </div>
      </div>
      ${tableHtml}
    </section>
    ${conclusionHtml}
  `;
  
  bindImageFallbacks(container);
}

export function renderCompareTray(container, options = {}) {
  if (!container) return;
  const ids = options.ids || [];
  const isReady = ids.length === COMPARE_PAIR_SIZE;
  const canCompare = isReady;
  
  if (!ids.length || options.hidden) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;
  container.classList.toggle("is-ready", isReady);
  
  const helperText = isReady
    ? t("universities.compare.pair_ready", "Comparison pair is ready")
    : t("universities.compare.need_more", "Choose the second university");
    
  const slotsHtml = Array.from({ length: COMPARE_PAIR_SIZE }, (_, index) => {
    const id = ids[index] || "";
    const name = id ? options.getUniversityName(id) : "";
    return `
      <div class="compare-tray__slot${id ? "" : " compare-tray__slot--empty"}" role="listitem">
        <span class="compare-tray__slot-label">${escapeHtml(renderCompareSlotLabel(index))}</span>
        <strong class="compare-tray__slot-name">${escapeHtml(name || t("universities.compare.pair_empty", "Empty slot"))}</strong>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="compare-tray__header">
      <span class="compare-tray__text">${escapeHtml(helperText)}</span>
    </div>
    <div class="compare-tray__body">
      <div class="compare-tray__pair" role="list" aria-label="${escapeHtmlAttr(t("universities.compare.pair_label", "Comparison pair"))}">
        ${slotsHtml}
      </div>
      <div class="compare-tray__actions">
        <button class="compare-tray__btn" type="button" data-action="clear-compare">${escapeHtml(t("universities.compare.clear", "Clear"))}</button>
        <button class="compare-tray__btn compare-tray__btn--primary" type="button" data-action="open-compare"${canCompare ? "" : " disabled"}>${escapeHtml(t(canCompare ? "universities.compare.continue" : "universities.compare.open", canCompare ? "Continue" : "Compare"))}</button>
      </div>
    </div>
  `;
}

export function renderCompareTrackChanceBadge(trackChance) {
  const chanceRaw = trackChance?.chancePercent;
  const chance = (chanceRaw === null || chanceRaw === undefined || String(chanceRaw).trim() === "")
    ? null
    : Number(chanceRaw);
  if (!Number.isFinite(chance)) {
    return `
      <div class="compare-track-chance">
        <span>${escapeHtml(aiName("chance"))}</span>
        <strong>${escapeHtml(t("common.no_data", "No data"))}</strong>
      </div>
    `;
  }
  const tone = chanceTone(chance);
  const chanceModel = String(trackChance?.chanceModel || "").trim().toLowerCase();
  const method = chanceModel === "estimated_fallback"
    ? t("admission.chance_method.estimated_short", "Estimated")
    : "";
  return `
    <div class="compare-track-chance ${tone.cls}">
      <span>${escapeHtml(aiName("chance"))}</span>
      <strong>${chance}%</strong>
      ${method ? `<small>${escapeHtml(method)}</small>` : ""}
    </div>
  `;
}

export function renderCompareAdmissionOptionCard(u, entry, options = {}) {
  const id = String(u?.id || "");
  const { track, option, key } = entry;
  const choices = options.choices || new Map();
  const chances = options.chances || new Map();
  const selected = choices.get(id) === key;
  const uniChance = chances.get(id);
  const trackChance = (uniChance?.tracks || []).find((x) => String(x.trackKey) === key);
  const recommendedKey = String(uniChance?.recommendedTrackKey || "").trim();
  const isRecommendedTrack = Boolean(recommendedKey && key === recommendedKey);
  
  const optionLabelRaw = String(option?.label || "").trim();
  const parentLabelRaw = String(track?.label || "").trim();
  const optionLabel = optionLabelRaw && optionLabelRaw !== parentLabelRaw ? trTrackLabel(optionLabelRaw) : "";
  const parentLabel = parentLabelRaw ? trTrackLabel(parentLabelRaw) : "";
  const titleLabel = optionLabel || parentLabel || translateUnknownWord("placeholder.field.admission_tracks", "Admission tracks");
  
  const fundingMeta = [
    option?.funding_program
      ? [t("admission.track.funding_program", "Funding program"), trTrackDescription(id, option.id, option.funding_program)]
      : null,
    option?.funding_source
      ? [t("admission.track.funding_source", "Funding source"), trTrackDescription(id, option.id, option.funding_source)]
      : null,
  ].filter(Boolean);
  
  const price = (() => {
    const finance = (option?.finance_override && typeof option.finance_override === "object") ? option.finance_override : (u?.finance || {});
    const profileMode = normalizeStudyModeForCost(options.profile?.studyMode || options.profile?.study_mode || "");
    return modeAwareAnnualCost(finance, profileMode) ?? finance?.total_cost_year_usd ?? u?.finance?.total_cost_year_usd;
  })();
  const priceText = Number.isFinite(Number(price)) ? moneyUSD(price) : unknownFieldText("placeholder.field.cost", "Cost");
  const isGrantTrack = getTrackFundingType(option) === "grant";

  const requirements = option?.requirements || {};
  const minParts = splitExamEntries(requirements);
  const minList = [
    renderExamGroup(translateWord("academic_requirements", "Academic requirements"), minParts.acad, "#2563eb"),
    renderTrackLanguageExamGroup(option, "requirements"),
  ].filter(Boolean).join("");

  const statsAvg = option?.stats_avg || {};
  const avgParts = splitExamEntries(statsAvg);
  const avgList = [
    renderExamGroup(translateWord("academic_average", "Academic average"), avgParts.acad, "#2563eb"),
    renderTrackLanguageExamGroup(option, "average"),
  ].filter(Boolean).join("");

  const minContent = minList || `<div class="track-muted-italic">${escapeHtml(unknownFieldText("placeholder.field.minimum_requirements", "Minimum requirements"))}</div>`;
  const avgContent = avgList || `<div class="track-muted-italic">${escapeHtml(translateWord("average_admitted_unavailable", "No verified average admitted data published."))}</div>`;
  
  const selectionBadges = [];
  if (selected) selectionBadges.push(escapeHtml(t("admission.track.selected", "Selected")));
  if (isRecommendedTrack) selectionBadges.push(escapeHtml(t("admission.track.recommended", "Recommended")));
  const selectionBadgeHtml = selectionBadges.length
    ? `<div class="track-selection-badge">${selectionBadges.join(" / ")}</div>`
    : "";

  return `
    <article class="admission-option-card${isGrantTrack ? " admission-option-card--grant" : ""}" data-uni-id="${escapeHtmlAttr(id)}" data-option-key="${escapeHtmlAttr(key)}">
      <div class="admission-option-head">
        <div class="admission-option-title-wrap">
          ${renderTrackFundingBadge(option)}
          <div class="admission-option-title">${escapeHtml(titleLabel)}</div>
        </div>
        <div class="admission-option-head-side">
          ${renderCompareTrackChanceBadge(trackChance)}
          ${selectionBadgeHtml}
        </div>
      </div>
      ${fundingMeta.length ? `<div class="admission-option-meta">${fundingMeta.map(([label, value]) => `<span class="tag"><small>${escapeHtml(label)}</small>${escapeHtml(value)}</span>`).join("")}</div>` : ""}

      <div class="track-cost-preview${isGrantTrack ? " track-cost-preview--grant" : ""}">
        <strong>${escapeHtml(translateWord("est_cost", "Est. Cost"))}:</strong> ${escapeHtml(priceText)}
      </div>

      <div class="track-stats-grid">
        <div class="track-stats-box track-stats-box--min">
          <div class="track-stats-title">${escapeHtml(translateWord("minimum_to_apply", "Minimum to apply"))}</div>
          <div class="track-stats-values">${minContent}</div>
        </div>
        <div class="track-stats-box track-stats-box--avg">
          <div class="track-stats-title track-stats-title--avg">
            ${escapeHtml(translateWord("real_average_admitted", "Average admitted"))}
          </div>
          <div class="track-stats-values">${avgContent}</div>
        </div>
      </div>

      <div class="track-select-row">
        <button class="track-select-btn${selected ? " is-active" : ""}" type="button" data-action="select-compare-admission" data-uni-id="${escapeHtmlAttr(id)}" data-option-key="${escapeHtmlAttr(key)}"${selected ? " disabled" : ""}>
          ${escapeHtml(selected ? t("admission.track.selected", "Selected") : t("admission.track.select", "Select"))}
        </button>
      </div>
    </article>
  `;
}

export function renderCompareConfigurePage(container, universities, options = {}) {
  if (!container) return;
  const ready = options.ready;
  const chances = options.chances || new Map();
  const choices = options.choices || new Map();
  
  container.innerHTML = `
    <div class="compare-results-head compare-results-head--pair">
      <div>
        <p class="compare-results-kicker">${escapeHtml(t("universities.compare.configure.kicker", "Before comparison"))}</p>
        <h1>${escapeHtml(t("universities.compare.configure.title", "Choose tracks and funding"))}</h1>
        <p class="compare-config-subtitle">${escapeHtml(t("universities.compare.configure.subtitle", "Pick one admission track and one funding option for each university. The comparison will use these selected options for requirements, language proof, cost, and funding."))}</p>
      </div>
      <div class="compare-results-actions">
        <button class="compare-results-action compare-results-action--ghost" type="button" data-action="back-to-compare-select">${escapeHtml(t("universities.compare.results.back_to_selection", "Back to selection"))}</button>
        <button class="compare-results-action" type="button" data-action="build-compare-results"${ready ? "" : " disabled"}>${escapeHtml(t("universities.compare.continue", "Continue"))}</button>
      </div>
    </div>
    <section class="compare-config-panel" aria-label="${escapeHtmlAttr(t("universities.compare.configure.title", "Choose tracks and funding"))}">
      ${universities.map((u, index) => {
        const id = String(u?.id || "");
        const entries = compareAdmissionOptionEntries(u);
        const selected = choices.get(id);
        return `
          <article class="compare-config-column" data-uni-id="${escapeHtmlAttr(id)}">
            <div class="compare-config-column__head">
              <span>${escapeHtml(renderCompareSlotLabel(index))}</span>
              <h2>${escapeHtml(compareUniversityName(u))}</h2>
              <p>${escapeHtml(selected ? t("universities.compare.configure.selected", "Track and funding selected") : t("universities.compare.configure.required", "Select one option before comparing"))}</p>
            </div>
            <div class="compare-config-chance">
              ${renderUniChanceSummary(chances.get(id))}
            </div>
            <div class="compare-config-options">
              ${entries.length ? entries.map((entry) => renderCompareAdmissionOptionCard(u, entry, options)).join("") : `<div class="admission-empty-state">${escapeHtml(unknownFieldText("placeholder.field.admission_tracks", "Admission tracks"))}</div>`}
            </div>
          </article>
        `;
      }).join("")}
    </section>
    <div class="compare-config-footer">
      <button class="compare-results-action compare-results-action--large" type="button" data-action="build-compare-results"${ready ? "" : " disabled"}>${escapeHtml(t("universities.compare.continue", "Continue"))}</button>
    </div>
  `;
}
